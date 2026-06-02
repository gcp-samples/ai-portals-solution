package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/oauth2/google"
	"gopkg.in/yaml.v3"
)

const dataDir = "./data/portals"
const taxonomiesDir = "./data/taxonomies"
const productGroupsDir = "./data/product-groups"
const audiencesDir = "./data/audiences"
const themesDir = "./data/themes"
const imagesDir = "./data/images"
const sessionsDir = "./data/sessions"

var (
	apigeeCache      = make(map[string]apigeeCacheEntry)
	apigeeSpecCache  = make(map[string]string)
	apigeeCacheMutex sync.Mutex
)

var readOnlyUsers = []string{
	"test@example.com",
}

func isReadOnlyUser(email string) bool {
	for _, e := range readOnlyUsers {
		if strings.EqualFold(e, email) {
			return true
		}
	}
	return false
}

// Helper function to handle JSON responses
func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

// withCORS middleware adds CORS headers for permissive access
func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func getGCPClient(ctx context.Context) (*http.Client, error) {
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/cloud-platform")
	if err != nil {
		return nil, err
	}
	return client, nil
}

func getGcpJson(client *http.Client, url string, target interface{}) error {
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GCP API error (%d): %s", resp.StatusCode, string(bodyBytes))
	}
	return json.NewDecoder(resp.Body).Decode(target)
}

func generateIdFromDisplayName(name string) string {
	slug := strings.ToLower(name)
	reg := regexp.MustCompile("[^a-z0-9]+")
	slug = reg.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")

	return slug
}

func getApigeeProducts(ctx context.Context, projectId, region string, tryCache bool) ([]Product, error) {
	cacheKey := fmt.Sprintf("%s:%s", projectId, region)
	if tryCache {
		apigeeCacheMutex.Lock()
		entry, ok := apigeeCache[cacheKey]
		if ok {
			apigeeCacheMutex.Unlock()
			return entry.Data, nil
		}
		apigeeCacheMutex.Unlock()
	}

	client, err := getGCPClient(ctx)
	if err != nil {
		return nil, fmt.Errorf("Failed to authenticate with Google Cloud")
	}

	deploymentsUrl := fmt.Sprintf("https://apihub.googleapis.com/v1/projects/%s/locations/%s/deployments", projectId, region)
	var depsResp struct {
		Deployments []map[string]interface{} `json:"deployments"`
	}
	getGcpJson(client, deploymentsUrl, &depsResp) // ignore error as it's optional

	apisUrl := fmt.Sprintf("https://apihub.googleapis.com/v1/projects/%s/locations/%s/apis", projectId, region)
	var apisResp struct {
		Apis []struct {
			Name        string `json:"name"`
			DisplayName string `json:"displayName"`
			Description string `json:"description"`
			ApiStyle    struct {
				EnumValues struct {
					Values []struct {
						DisplayName string `json:"displayName"`
					} `json:"values"`
				} `json:"enumValues"`
			} `json:"apiStyle"`
		} `json:"apis"`
	}
	if err := getGcpJson(client, apisUrl, &apisResp); err != nil {
		return nil, err
	}

	var results []Product
	specsToCache := make(map[string]string)

	for _, api := range apisResp.Apis {
		parts := strings.Split(api.Name, "/")
		apiId := parts[len(parts)-1]

		apiDisplayName := api.DisplayName
		if apiDisplayName == "" {
			apiDisplayName = apiId
		}

		apiStyle := ""
		if len(api.ApiStyle.EnumValues.Values) > 0 {
			apiStyle = api.ApiStyle.EnumValues.Values[0].DisplayName
		}

		versionsUrl := fmt.Sprintf("https://apihub.googleapis.com/v1/%s/versions", api.Name)
		var versionsResp struct {
			ApiVersions []map[string]interface{} `json:"versions"`
		}
		if err := getGcpJson(client, versionsUrl, &versionsResp); err == nil {
			for _, vRaw := range versionsResp.ApiVersions {
				vName, _ := vRaw["name"].(string)
				vDisplayName, _ := vRaw["displayName"].(string)
				if vDisplayName == "" {
					parts := strings.Split(vName, "/")
					vDisplayName = parts[len(parts)-1]
				}

				// Combine names and descriptions
				productName := fmt.Sprintf("%s (%s)", apiDisplayName, vDisplayName)
				productDesc := api.Description
				vDesc, _ := vRaw["description"].(string)
				if vDesc != "" {
					if productDesc != "" {
						productDesc += "\n\n" + vDesc
					} else {
						productDesc = vDesc
					}
				}

				displayStyle := apiStyle
				if displayStyle == "" {
					displayStyle = "REST"
				}

				versionProduct := Product{
					Id:                 generateIdFromDisplayName(productName),
					SourceId:           vName, // Use version name as the unique ID from source
					ProductId:          apiDisplayName,
					Name:               productName,
					DisplayName:        apiDisplayName,
					Description:        productDesc,
					DisplayDescription: productDesc,
					Type:               "apigee",
					Style:              apiStyle,
					DisplayStyle:       displayStyle,
				}

				// Get specs for this version (only for REST)
				if apiStyle == "REST" {
					specsUrl := fmt.Sprintf("https://apihub.googleapis.com/v1/%s/specs", vName)
					var specsResp struct {
						Specs []map[string]interface{} `json:"specs"`
					}
					if err := getGcpJson(client, specsUrl, &specsResp); err == nil {
						// Just grab the first spec contents for now
						for _, sRaw := range specsResp.Specs {
							sName, _ := sRaw["name"].(string)
							contentsUrl := fmt.Sprintf("https://apihub.googleapis.com/v1/%s:contents", sName)
							var contentsResp map[string]interface{}
							if err := getGcpJson(client, contentsUrl, &contentsResp); err == nil {
								if contents, ok := contentsResp["contents"].(string); ok {
									specsToCache[versionProduct.Id] = contents
									break // Got a spec, stop looking for more specs for this version
								}
							}
						}
					}
				}

				// Get deployment for this version
				var endpoints []string
				for _, d := range depsResp.Deployments {
					apiVersions, _ := d["apiVersions"].([]interface{})
					for _, av := range apiVersions {
						avStr, _ := av.(string)
						if avStr == vName { // Exact match for the version
							foundEndpointsForDeployment := false
							if eps, ok := d["endpoints"].([]interface{}); ok && len(eps) > 0 {
								for _, epInter := range eps {
									if uriStr, ok := epInter.(string); ok && uriStr != "" {
										endpoints = append(endpoints, uriStr)
										foundEndpointsForDeployment = true
									} else if epMap, ok := epInter.(map[string]interface{}); ok {
										if uri, ok := epMap["uri"].(string); ok && uri != "" {
											endpoints = append(endpoints, uri)
											foundEndpointsForDeployment = true
										}
									}
								}
							}
							if !foundEndpointsForDeployment {
								if uri, ok := d["resourceUri"].(string); ok && uri != "" {
									endpoints = append(endpoints, uri)
								} else if uri, ok := d["deploymentUri"].(string); ok && uri != "" {
									endpoints = append(endpoints, uri)
								}
							}
							break
						}
					}
				}

				if len(endpoints) > 0 {
					versionProduct.Endpoints = endpoints
				}

				results = append(results, versionProduct)
			}
		} else {
			displayStyle := apiStyle
			if displayStyle == "" {
				displayStyle = "REST"
			}
			// If we couldn't get versions, fallback to creating a product for the API itself
			apiData := Product{
				Id:                 generateIdFromDisplayName(apiDisplayName),
				SourceId:           api.Name,
				Name:               apiDisplayName,
				DisplayName:        apiDisplayName,
				Description:        api.Description,
				DisplayDescription: api.Description,
				Type:               "apigee",
				Style:              apiStyle,
				DisplayStyle:       displayStyle,
			}
			results = append(results, apiData)
		}
	}

	if results == nil {
		results = []Product{}
	}

	apigeeCacheMutex.Lock()
	entryToCache := apigeeCacheEntry{
		Data:      results,
		Timestamp: time.Now(),
	}
	apigeeCache[cacheKey] = entryToCache
	for k, v := range specsToCache {
		apigeeSpecCache[k] = v
	}

	if err := os.MkdirAll("./data/products", 0755); err == nil {
		if fileData, err := yaml.Marshal(entryToCache); err == nil {
			fileName := fmt.Sprintf("./data/products/apigee_%s_%s.yaml", projectId, region)
			os.WriteFile(fileName, fileData, 0644)
		}
		if len(specsToCache) > 0 {
			if specData, err := yaml.Marshal(specsToCache); err == nil {
				specFileName := fmt.Sprintf("./data/products/apigee_specs_%s_%s.yaml", projectId, region)
				os.WriteFile(specFileName, specData, 0644)
			}
		}
	}
	apigeeCacheMutex.Unlock()

	return results, nil
}

func main() {
	if files, err := os.ReadDir("./data/products"); err == nil {
		apigeeCacheMutex.Lock()
		loadedCount := 0
		for _, file := range files {
			if !file.IsDir() && strings.HasPrefix(file.Name(), "apigee_") && (strings.HasSuffix(file.Name(), ".yaml") || strings.HasSuffix(file.Name(), ".yml")) {
				isYml := strings.HasSuffix(file.Name(), ".yml")
				ext := ".yaml"
				if isYml {
					ext = ".yml"
				}
				if strings.HasPrefix(file.Name(), "apigee_specs_") {
					nameParts := strings.Split(strings.TrimSuffix(strings.TrimPrefix(file.Name(), "apigee_specs_"), ext), "_")
					if len(nameParts) >= 2 {
						fileData, err := os.ReadFile(filepath.Join("./data/products", file.Name()))
						if err == nil {
							var specs map[string]string
							if err := yaml.Unmarshal(fileData, &specs); err == nil {
								for k, v := range specs {
									apigeeSpecCache[k] = v
								}
							} else {
								log.Printf("Failed to unmarshal apigee specs cache file %s: %v", file.Name(), err)
							}
						}
					}
				} else {
					// Parse projectId and region from filename: apigee_{projectId}_{region}.yaml
					nameParts := strings.Split(strings.TrimSuffix(strings.TrimPrefix(file.Name(), "apigee_"), ext), "_")
					if len(nameParts) >= 2 {
						// Handle cases where projectId might contain underscores by taking the last part as region
						regionStr := nameParts[len(nameParts)-1]
						projectIdStr := strings.Join(nameParts[:len(nameParts)-1], "_")
						cacheKey := fmt.Sprintf("%s:%s", projectIdStr, regionStr)

						fileData, err := os.ReadFile(filepath.Join("./data/products", file.Name()))
						if err == nil {
							var entry apigeeCacheEntry
							if err := yaml.Unmarshal(fileData, &entry); err == nil {
								apigeeCache[cacheKey] = entry
								loadedCount++
							} else {
								log.Printf("Failed to unmarshal apigee cache file %s: %v", file.Name(), err)
							}
						}
					}
				}
			}
		}
		apigeeCacheMutex.Unlock()
		if loadedCount > 0 {
			log.Printf("Loaded %d Apigee product cache entries from local files", loadedCount)
		}
	}

	// Pre-cache Apigee products on startup if project and region are provided
	projectId := os.Getenv("GOOGLE_CLOUD_PROJECT")
	region := os.Getenv("GOOGLE_CLOUD_REGION")
	if projectId != "" && region != "" {
		log.Printf("Pre-caching Apigee products for project: %s, region: %s", projectId, region)
		go func() {
			_, err := getApigeeProducts(context.Background(), projectId, region, false)
			if err != nil {
				log.Printf("Failed to pre-cache Apigee products: %v", err)
			} else {
				log.Println("Successfully pre-cached Apigee products")
			}
		}()
	}

	mux := http.NewServeMux()

	landingFs := http.FileServer(http.Dir("public"))
	mux.Handle("/", landingFs)

	// User subscription management API
	mux.HandleFunc("/api/portals/{id}", withCORS(portalHandler))
	mux.HandleFunc("/api/portals/{id}/products", withCORS(productHandler))
	mux.HandleFunc("/api/products/{productId}/spec", withCORS(productSpecHandler))
	mux.HandleFunc("/api/portals/{portalId}/users/{email}/login", withCORS(authenticateFirebase(userLoginHandler)))
	mux.HandleFunc("/api/portals/{portalId}/users/{email}/apps", withCORS(authenticateFirebase(userAppsHandler)))
	mux.HandleFunc("/api/portals/{portalId}/users/{email}/apps/{appName}", withCORS(authenticateFirebase(userAppsDetailHandler)))
	mux.HandleFunc("/api/portals/{portalId}/users/{email}/analytics", withCORS(authenticateFirebase(userAnalyticsHandler)))

	// Serve uploaded images statically
	imagesFs := http.FileServer(http.Dir("./data/images"))
	mux.Handle("/images/", http.StripPrefix("/images/", imagesFs))

	log.Println("Server listening on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatal(err)
	}
}
