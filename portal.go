package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	firebase "firebase.google.com/go/v4"
)

type ApigeeCredential struct {
	ConsumerKey    string `json:"consumerKey"`
	ConsumerSecret string `json:"consumerSecret"`
	ApiProducts    []struct {
		Apiproduct string `json:"apiproduct"`
	} `json:"apiProducts"`
}

type ApigeeAttribute struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type ApigeeApp struct {
	AppId       string             `json:"appId"`
	Name        string             `json:"name"`
	Attributes  []ApigeeAttribute  `json:"attributes"`
	Credentials []ApigeeCredential `json:"credentials"`
}

type ApigeeAppList struct {
	App []ApigeeApp `json:"app"`
}

type ApigeeAppCreateReq struct {
	Name        string            `json:"name"`
	ApiProducts []string          `json:"apiProducts"`
	Attributes  []ApigeeAttribute `json:"attributes"`
}

type ApigeeAppUpdateReq struct {
	Name       string            `json:"name"`
	Attributes []ApigeeAttribute `json:"attributes"`
}

type ApigeeKeyUpdateReq struct {
	ApiProducts []string `json:"apiProducts"`
}

var firebaseApp *firebase.App

var demoSpec = `openapi: 3.1.0
info:
  title: Apigee Mock Target JSON API
  description: A basic OpenAPI specification for the Apigee mock JSON target endpoint.
  version: 1.0.0
servers:
  - url: https://mocktarget.apigee.net
    description: Apigee Mock Target Server
paths:
  /json:
    get:
      summary: Retrieve sample JSON mock data
      description: Returns a mock JSON object containing a sample person's name and location.
      responses:
        '200':
          description: Successful response containing the mock data.
          content:
            application/json:
              schema:
                type: object
                properties:
                  firstName:
                    type: string
                    example: John
                  lastName:
                    type: string
                    example: Doe
                  city:
                    type: string
                    example: San Jose
                  state:
                    type: string
                    example: CA
                required:
                  - firstName
                  - lastName
                  - city
                  - state`

func getFirebaseApp() (*firebase.App, error) {
	if firebaseApp != nil {
		return firebaseApp, nil
	}
	app, err := firebase.NewApp(context.Background(), nil)
	if err != nil {
		return nil, err
	}
	firebaseApp = app
	return firebaseApp, nil
}

func authenticateFirebase(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			jsonResponse(w, http.StatusUnauthorized, map[string]string{"error": "Missing or invalid Authorization header"})
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		app, err := getFirebaseApp()
		if err != nil {
			log.Printf("Failed to init firebase app: %v", err)
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "Internal auth error"})
			return
		}

		client, err := app.Auth(context.Background())
		if err != nil {
			log.Printf("Failed to get auth client: %v", err)
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "Internal auth error"})
			return
		}

		token, err := client.VerifyIDToken(context.Background(), tokenString)
		if err != nil {
			log.Printf("Firebase token validation failed: %v", err)
			jsonResponse(w, http.StatusUnauthorized, map[string]string{"error": "Invalid token"})
			return
		}

		email, ok := token.Claims["email"].(string)
		if !ok || email == "" {
			jsonResponse(w, http.StatusUnauthorized, map[string]string{"error": "Token missing email claim"})
			return
		}

		pathEmail := r.PathValue("email")
		if pathEmail != "" && pathEmail != email {
			jsonResponse(w, http.StatusForbidden, map[string]string{"error": "Forbidden: token email does not match requested email"})
			return
		}

		ctx := context.WithValue(r.Context(), "user_email", email)
		next(w, r.WithContext(ctx))
	}
}

func userLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	email := r.PathValue("email")
	if email == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	portalId := r.PathValue("portalId")
	if portalId == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "portalId is required"})
		return
	}

	go processApigeeUserRegistration(email, portalId)

	jsonResponse(w, http.StatusOK, map[string]string{"status": "success"})
}

func processApigeeUserRegistration(email, portalId string) {
	ctx := context.Background()

	// Load portal
	sfFile := filepath.Join(dataDir, portalId+".json")
	sfData, err := os.ReadFile(sfFile)
	if err != nil {
		log.Printf("processApigeeUserRegistration: failed to read portal %s: %v", portalId, err)
		return
	}

	var sf Portal
	if err := json.Unmarshal(sfData, &sf); err != nil {
		log.Printf("processApigeeUserRegistration: failed to parse portal %s: %v", portalId, err)
		return
	}

	// Collect unique Apigee organizations (project IDs)
	apigeeOrgs := make(map[string]bool)
	for _, pgConfig := range sf.ProductGroups {
		pgFile := filepath.Join(productGroupsDir, pgConfig.ProductGroupId+".json")
		pgData, err := os.ReadFile(pgFile)
		if err != nil {
			log.Printf("processApigeeUserRegistration: failed to read product group %s: %v", pgConfig.ProductGroupId, err)
			continue
		}

		var pg ProductGroup
		if err := json.Unmarshal(pgData, &pg); err != nil {
			continue
		}

		for _, source := range pg.Sources {
			if source.Type == "apigee" && source.Name != "" {
				apigeeOrgs[source.Name] = true
			}
		}
	}

	firstName := email
	if idx := strings.Index(email, "@"); idx != -1 {
		firstName = email[:idx]
	}

	devPayload := map[string]string{
		"email":     email,
		"firstName": firstName,
		"lastName":  "User",
		"userName":  firstName,
	}

	for org := range apigeeOrgs {
		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers", org)
		var res interface{}
		err := doApigeeRequest(ctx, "POST", url, devPayload, &res)
		if err != nil {
			// A 409 Conflict indicates the developer already exists, which is acceptable.
			// log.Printf("processApigeeUserRegistration: developer %s check/create in org %s: %v", email, org, err)
		} else {
			log.Printf("processApigeeUserRegistration: created apigee developer %s in org %s", email, org)
		}
	}
}

func portalHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", "GET")
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "Method not allowed"})
		return
	}

	name := r.PathValue("id")
	if name == "" {
		// Fallback just in case
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) >= 4 {
			name = parts[3]
		}
	}

	if name == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "Missing portal name"})
		return
	}

	// Sanitize name
	name = filepath.Base(filepath.Clean(name))
	filePath := filepath.Join(dataDir, name+".json")

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			jsonResponse(w, http.StatusNotFound, map[string]string{"error": "portal not found"})
		} else {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "Failed to read portal"})
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write(fileData)
}

func productHandler(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("id")
	if name == "" {
		// Fallback just in case
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) >= 4 {
			name = parts[3]
		}
	}

	if name == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "Missing portal name"})
		return
	}

	// Sanitize name
	name = filepath.Base(filepath.Clean(name))
	filePath := filepath.Join(dataDir, name+".json")

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			jsonResponse(w, http.StatusNotFound, map[string]string{"error": "Portal not found"})
		} else {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "Failed to read portal"})
		}
		return
	}

	var sf Portal
	if err := json.Unmarshal(fileData, &sf); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "Invalid portal data"})
		return
	}

	var allProducts []Product
	for _, pgConfig := range sf.ProductGroups {
		// Read product group
		pgFile := filepath.Join(productGroupsDir, pgConfig.ProductGroupId+".json")
		pgData, err := os.ReadFile(pgFile)
		if err != nil {
			log.Printf("Failed to read product group %s: %v", pgConfig.ProductGroupId, err)
			continue
		}

		var pg ProductGroup
		if err := json.Unmarshal(pgData, &pg); err != nil {
			log.Printf("Failed to parse product group %s: %v", pgConfig.ProductGroupId, err)
			continue
		}

		for _, source := range pg.Sources {
			var products []Product
			var fetchErr error

			if source.Type == "vertex" {
				// products, fetchErr = getVertexProducts(r.Context(), source.Name, source.Region)
			} else if source.Type == "apigee" {
				products, fetchErr = getApigeeProducts(r.Context(), source.Name, source.Region, true)
			} else if source.Type == "manual" {
				// Handle manual products if necessary
				// Not fully implemented in getVertexProducts/getApigeeProducts yet
			}

			if fetchErr != nil {
				log.Printf("Failed to fetch products for source %s: %v", source.Name, fetchErr)
				continue
			}

			if source.AllProducts {
				allProducts = append(allProducts, products...)
			} else {
				selectedMap := make(map[string]SelectedProduct)
				for _, sp := range source.SelectedProducts {
					selectedMap[sp.Id] = sp
				}
				for _, p := range products {
					if sp, ok := selectedMap[p.Id]; ok {
						if sp.ProductId != "" {
							p.ProductId = sp.ProductId
						}
						if sp.DisplayName != "" {
							p.DisplayName = sp.DisplayName
						}
						if sp.DisplayDescription != "" {
							p.DisplayDescription = sp.DisplayDescription
						}
						if sp.DisplayStyle != "" {
							p.DisplayStyle = sp.DisplayStyle
						}
						if sp.Image != "" {
							p.Image = sp.Image
						}
						p.Categories = sp.Categories
						p.Tags = sp.Tags
						allProducts = append(allProducts, p)
					}
				}
			}
		}
	}

	if allProducts == nil {
		allProducts = []Product{}
	}

	jsonResponse(w, http.StatusOK, allProducts)
}

func productSpecHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/yaml")
	fmt.Fprint(w, demoSpec)
}

func doApigeeRequest(ctx context.Context, method, url string, body interface{}, target interface{}) error {
	client, err := getGCPClient(ctx)
	if err != nil {
		return err
	}

	var reqBody io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reqBody = bytes.NewReader(b)
	}

	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		respBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("apigee API error (%d): %s", resp.StatusCode, string(respBytes))
	}

	if target != nil && resp.StatusCode != http.StatusNoContent {
		return json.NewDecoder(resp.Body).Decode(target)
	}
	return nil
}

func mapApigeeAppToApp(a ApigeeApp) App {
	app := App{
		Id:          a.AppId,
		Name:        a.Name,
		Credentials: make([]Credential, 0),
	}
	for _, attr := range a.Attributes {
		if attr.Name == "Notes" || attr.Name == "description" {
			app.Description = attr.Value
		}
	}
	for _, cred := range a.Credentials {
		c := Credential{
			ClientId:     cred.ConsumerKey,
			ClientSecret: cred.ConsumerSecret,
			Products:     make([]string, 0),
		}
		for _, p := range cred.ApiProducts {
			c.Products = append(c.Products, p.Apiproduct)
		}
		app.Credentials = append(app.Credentials, c)
	}
	return app
}

func userAppsHandler(w http.ResponseWriter, r *http.Request) {
	email := r.PathValue("email")
	portalId := r.PathValue("portalId")
	if email == "" || portalId == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "email and portalId are required"})
		return
	}

	ctx := context.Background()

	// 1. Read portal to find Apigee organizations (project IDs)
	portalPath := filepath.Join(dataDir, filepath.Base(filepath.Clean(portalId))+".json")
	sfData, err := os.ReadFile(portalPath)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "portal not found"})
		return
	}

	var sf Portal
	if err := json.Unmarshal(sfData, &sf); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "invalid portal data"})
		return
	}

	apigeeOrgs := make(map[string]bool)
	for _, pgConfig := range sf.ProductGroups {
		pgPath := filepath.Join(productGroupsDir, filepath.Base(filepath.Clean(pgConfig.ProductGroupId))+".json")
		pgData, err := os.ReadFile(pgPath)
		if err != nil {
			continue
		}

		var pg ProductGroup
		if err := json.Unmarshal(pgData, &pg); err == nil {
			for _, source := range pg.Sources {
				if source.Type == "apigee" && source.Name != "" {
					apigeeOrgs[source.Name] = true
				}
			}
		}
	}

	if r.Method == http.MethodGet {
		var allApps []App

		for projectId := range apigeeOrgs {
			url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps?expand=true", projectId, email)
			var list ApigeeAppList
			if err := doApigeeRequest(ctx, "GET", url, nil, &list); err != nil {
				log.Printf("Failed to get apps from org %s: %v", projectId, err)
				continue
			}

			for _, a := range list.App {
				app := mapApigeeAppToApp(a)
				app.ProjectId = projectId
				allApps = append(allApps, app)
			}
		}

		if allApps == nil {
			allApps = []App{}
		}
		jsonResponse(w, http.StatusOK, allApps)
		return
	}

	if r.Method == http.MethodPost {
		var app App
		if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}

		projectId := app.ProjectId
		if projectId == "" {
			// fallback to the first discovered Apigee org or ENV
			for org := range apigeeOrgs {
				projectId = org
				break
			}
			if projectId == "" {
				projectId = os.Getenv("PROJECT_ID")
			}
		}

		if projectId == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "projectId could not be determined for app creation"})
			return
		}

		req := ApigeeAppCreateReq{
			Name:        app.Name,
			ApiProducts: make([]string, 0),
		}
		if app.Description != "" {
			req.Attributes = []ApigeeAttribute{{Name: "description", Value: app.Description}}
		}
		if len(app.Credentials) > 0 {
			req.ApiProducts = app.Credentials[0].Products
		}

		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps", projectId, email)
		var created ApigeeApp
		if err := doApigeeRequest(ctx, "POST", url, req, &created); err != nil {
			log.Printf("Failed to create app for %s: %v", projectId, err)
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		mappedApp := mapApigeeAppToApp(created)
		mappedApp.ProjectId = projectId
		jsonResponse(w, http.StatusCreated, mappedApp)
		return
	}

	if r.Method == http.MethodPut {
		var app App
		if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}

		projectId := app.ProjectId
		if projectId == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "projectId property in payload is required"})
			return
		}

		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s", projectId, email, app.Name)
		req := ApigeeAppUpdateReq{Name: app.Name}
		if app.Description != "" {
			req.Attributes = []ApigeeAttribute{{Name: "description", Value: app.Description}}
		}

		var updatedApp ApigeeApp
		if err := doApigeeRequest(ctx, "PUT", url, req, &updatedApp); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if len(app.Credentials) > 0 && len(updatedApp.Credentials) > 0 {
			cred := app.Credentials[0]
			consumerKey := updatedApp.Credentials[0].ConsumerKey
			keyUrl := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s/keys/%s", projectId, email, app.Name, consumerKey)
			keyReq := ApigeeKeyUpdateReq{ApiProducts: cred.Products}
			var updatedKey ApigeeCredential
			if err := doApigeeRequest(ctx, "POST", keyUrl, keyReq, &updatedKey); err != nil {
				jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			updatedApp.Credentials[0] = updatedKey
		}

		mappedApp := mapApigeeAppToApp(updatedApp)
		mappedApp.ProjectId = projectId
		jsonResponse(w, http.StatusOK, mappedApp)
		return
	}

	if r.Method == http.MethodDelete {
		projectId := r.URL.Query().Get("projectId")
		appName := r.URL.Query().Get("name")
		if projectId == "" || appName == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "projectId and name query parameters are required"})
			return
		}
		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s", projectId, email, appName)
		if err := doApigeeRequest(ctx, "DELETE", url, nil, nil); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func userAppsDetailHandler(w http.ResponseWriter, r *http.Request) {
	email := r.PathValue("email")
	appName := r.PathValue("appName")
	if email == "" || appName == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "email and appName are required"})
		return
	}

	if (r.Method == http.MethodPut || r.Method == http.MethodDelete) && isReadOnlyUser(email) {
		jsonResponse(w, http.StatusForbidden, map[string]string{"error": "Your account is set to read-only. Please contact an administrator to make changes."})
		return
	}

	ctx := context.Background()

	if r.Method == http.MethodGet {
		projectId := r.URL.Query().Get("projectId")
		if projectId == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "projectId query parameter is required"})
			return
		}
		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s", projectId, email, appName)
		var app ApigeeApp
		if err := doApigeeRequest(ctx, "GET", url, nil, &app); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		mappedApp := mapApigeeAppToApp(app)
		mappedApp.ProjectId = projectId
		jsonResponse(w, http.StatusOK, mappedApp)
		return
	}

	if r.Method == http.MethodDelete {
		projectId := r.URL.Query().Get("projectId")
		if projectId == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "projectId query parameter is required"})
			return
		}
		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s", projectId, email, appName)
		if err := doApigeeRequest(ctx, "DELETE", url, nil, nil); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method == http.MethodPut {
		var app App
		if err := json.NewDecoder(r.Body).Decode(&app); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}

		projectId := app.ProjectId
		if projectId == "" {
			jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "projectId property in payload is required"})
			return
		}

		url := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s", projectId, email, appName)
		req := ApigeeAppUpdateReq{Name: appName}
		if app.Description != "" {
			req.Attributes = []ApigeeAttribute{{Name: "description", Value: app.Description}}
		}

		var updatedApp ApigeeApp
		if err := doApigeeRequest(ctx, "PUT", url, req, &updatedApp); err != nil {
			jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}

		if len(app.Credentials) > 0 && len(updatedApp.Credentials) > 0 {
			cred := app.Credentials[0]
			consumerKey := updatedApp.Credentials[0].ConsumerKey
			keyUrl := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/developers/%s/apps/%s/keys/%s", projectId, email, appName, consumerKey)
			keyReq := ApigeeKeyUpdateReq{ApiProducts: cred.Products}
			var updatedKey ApigeeCredential
			if err := doApigeeRequest(ctx, "POST", keyUrl, keyReq, &updatedKey); err != nil {
				jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
				return
			}
			updatedApp.Credentials[0] = updatedKey
		}

		mappedApp := mapApigeeAppToApp(updatedApp)
		mappedApp.ProjectId = projectId
		jsonResponse(w, http.StatusOK, mappedApp)
		return
	}

	jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
}

func userAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	email := r.PathValue("email")
	if email == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	portalId := r.PathValue("portalId")
	if portalId == "" {
		jsonResponse(w, http.StatusBadRequest, map[string]string{"error": "portalId is required"})
		return
	}

	if r.Method != http.MethodGet {
		jsonResponse(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}

	ctx := context.Background()

	// 1. Read portal to find Apigee organizations (project IDs)
	portalPath := filepath.Join(dataDir, filepath.Base(filepath.Clean(portalId))+".json")
	sfData, err := os.ReadFile(portalPath)
	if err != nil {
		jsonResponse(w, http.StatusNotFound, map[string]string{"error": "portal not found"})
		return
	}

	var sf Portal
	if err := json.Unmarshal(sfData, &sf); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]string{"error": "invalid portal data"})
		return
	}

	apigeeOrgs := make(map[string]bool)
	for _, pgConfig := range sf.ProductGroups {
		pgPath := filepath.Join(productGroupsDir, filepath.Base(filepath.Clean(pgConfig.ProductGroupId))+".json")
		pgData, err := os.ReadFile(pgPath)
		if err != nil {
			log.Printf("Failed to read product group %s: %v", pgConfig.ProductGroupId, err)
			continue
		}

		var pg ProductGroup
		if err := json.Unmarshal(pgData, &pg); err != nil {
			log.Printf("Failed to parse product group %s: %v", pgConfig.ProductGroupId, err)
			continue
		}

		for _, source := range pg.Sources {
			if source.Type == "apigee" && source.Name != "" {
				apigeeOrgs[source.Name] = true
			}
		}
	}

	if len(apigeeOrgs) == 0 {
		// No Apigee sources found, return empty stats
		jsonResponse(w, http.StatusOK, map[string]interface{}{
			"app":     []interface{}{},
			"product": []interface{}{},
			"model":   []interface{}{},
		})
		return
	}

	// 2. Compute timeRange (last 3 months)
	now := time.Now().UTC()
	threeMonthsAgo := now.AddDate(0, -3, 0)
	timeRange := fmt.Sprintf("%02d/%02d/%04d %02d:%02d~%02d/%02d/%04d %02d:%02d",
		threeMonthsAgo.Month(), threeMonthsAgo.Day(), threeMonthsAgo.Year(), threeMonthsAgo.Hour(), threeMonthsAgo.Minute(),
		now.Month(), now.Day(), now.Year(), now.Hour(), now.Minute())

	escapedTimeRange := strings.Replace(url.QueryEscape(timeRange), "+", "%20", -1)
	escapedFilter := strings.Replace(url.QueryEscape(fmt.Sprintf("(developer_email eq '%s')", email)), "+", "%20", -1)

	var appStats []interface{}
	var productStats []interface{}
	var modelStats []interface{}

	// Loop over discovered Apigee Orgs
	for projectId := range apigeeOrgs {
		// Get all environments for this org
		envUrl := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/environments", projectId)
		var envs []string
		if err := doApigeeRequest(ctx, "GET", envUrl, nil, &envs); err != nil {
			log.Printf("Failed to get environments for org %s: %v", projectId, err)
			continue
		}

		for _, env := range envs {
			// 1. Stats by developer_app
			appStatsUrl := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/environments/%s/stats/developer_app?select=sum(message_count),sum(dc_ai_prompt_token_count),sum(dc_ai_response_token_count),avg(dc_ai_time_first_token)&timeUnit=day&timeRange=%s&filter=%s",
				projectId, env, escapedTimeRange, escapedFilter)

			var appStatsResp map[string]interface{}
			if err := doApigeeRequest(ctx, "GET", appStatsUrl, nil, &appStatsResp); err != nil {
				log.Printf("Failed to get app stats for org %s env %s: %v", projectId, env, err)
			} else {
				delete(appStatsResp, "metaData")
				appStats = append(appStats, appStatsResp)
			}

			// 2. Stats by api_product
			prodStatsUrl := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/environments/%s/stats/api_product?select=sum(message_count),sum(dc_ai_prompt_token_count),sum(dc_ai_response_token_count),avg(dc_ai_time_first_token)&timeUnit=day&timeRange=%s&filter=%s",
				projectId, env, escapedTimeRange, escapedFilter)

			var prodStatsResp map[string]interface{}
			if err := doApigeeRequest(ctx, "GET", prodStatsUrl, nil, &prodStatsResp); err != nil {
				log.Printf("Failed to get product stats for org %s env %s: %v", projectId, env, err)
			} else {
				delete(prodStatsResp, "metaData")
				productStats = append(productStats, prodStatsResp)
			}

			// 3. Stats by dc_ai_model
			modelStatsUrl := fmt.Sprintf("https://apigee.googleapis.com/v1/organizations/%s/environments/%s/stats/dc_ai_model?select=sum(dc_ai_prompt_token_count),sum(dc_ai_response_token_count),avg(dc_ai_time_first_token),avg(dc_ai_time_first_token)&timeUnit=day&timeRange=%s&filter=%s",
				projectId, env, escapedTimeRange, escapedFilter)

			var modelStatsResp map[string]interface{}
			if err := doApigeeRequest(ctx, "GET", modelStatsUrl, nil, &modelStatsResp); err != nil {
				log.Printf("Failed to get model stats for org %s env %s: %v", projectId, env, err)
			} else {
				delete(modelStatsResp, "metaData")
				modelStats = append(modelStats, modelStatsResp)
			}
		}
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"app":     appStats,
		"product": productStats,
		"model":   modelStats,
	})
}
