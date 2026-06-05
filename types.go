package main

import (
	"time"

	"golang.org/x/oauth2"
)

type UserSessionData struct {
	Email             string        `json:"email" yaml:"email"`
	Name              string        `json:"name" yaml:"name"`
	Picture           string        `json:"picture" yaml:"picture"`
	AuthorizationCode string        `json:"authorization_code" yaml:"authorization_code"`
	Token             *oauth2.Token `json:"token" yaml:"token"`
	IDToken           string        `json:"id_token" yaml:"id_token"`
}

type Product struct {
	Id                 string   `json:"id" yaml:"id"`
	SourceId           string   `json:"sourceId,omitempty" yaml:"sourceId,omitempty"`
	ProductId          string   `json:"productId,omitempty" yaml:"productId,omitempty"`
	Name               string   `json:"name" yaml:"name"`
	DisplayName        string   `json:"displayName,omitempty" yaml:"displayName,omitempty"`
	Description        string   `json:"description,omitempty" yaml:"description,omitempty"`
	DisplayDescription string   `json:"displayDescription,omitempty" yaml:"displayDescription,omitempty"`
	Endpoints          []string `json:"endpoints,omitempty" yaml:"endpoints,omitempty"`
	SpecContents       string   `json:"specContents,omitempty" yaml:"specContents,omitempty"`
	Type               string   `json:"type,omitempty" yaml:"type,omitempty"`
	AuthType           string   `json:"authType,omitempty" yaml:"authType,omitempty"`
	Style              string   `json:"style,omitempty" yaml:"style,omitempty"`
	DisplayStyle       string   `json:"displayStyle,omitempty" yaml:"displayStyle,omitempty"`
	Image              string   `json:"image,omitempty" yaml:"image,omitempty"`
	Categories         []string `json:"categories" yaml:"categories"`
	Tags               []string `json:"tags" yaml:"tags"`
}

type SelectedProduct struct {
	Id                 string   `json:"id" yaml:"id"`
	ProductId          string   `json:"productId,omitempty" yaml:"productId,omitempty"`
	DisplayName        string   `json:"displayName,omitempty" yaml:"displayName,omitempty"`
	DisplayDescription string   `json:"displayDescription,omitempty" yaml:"displayDescription,omitempty"`
	DisplayStyle       string   `json:"displayStyle,omitempty" yaml:"displayStyle,omitempty"`
	Image              string   `json:"image,omitempty" yaml:"image,omitempty"`
	Categories         []string `json:"categories" yaml:"categories"`
	Tags               []string `json:"tags" yaml:"tags"`
}

type Source struct {
	Project           string            `json:"project" yaml:"project"`
	Type              string            `json:"type" yaml:"type"`
	Region            string            `json:"region" yaml:"region"`
	AllProducts       bool              `json:"allProducts" yaml:"allProducts"`
	SelectedProducts  []SelectedProduct `json:"selectedProducts" yaml:"selectedProducts"`
	AllUsers          bool              `json:"allUsers" yaml:"allUsers"`
	SelectedAudiences []string          `json:"selectedAudiences" yaml:"selectedAudiences"`
}

type Qualifier struct {
	Type  string `json:"type" yaml:"type"`
	Value string `json:"value" yaml:"value"`
}

type Audience struct {
	Id          string      `json:"id" yaml:"id"`
	Name        string      `json:"name" yaml:"name"`
	Description string      `json:"description" yaml:"description"`
	Qualifiers  []Qualifier `json:"qualifiers" yaml:"qualifiers"`
}

type ProductGroup struct {
	Id       string   `json:"id" yaml:"id"`
	Name     string   `json:"name" yaml:"name"`
	Taxonomy string   `json:"taxonomy" yaml:"taxonomy"`
	Sources  []Source `json:"sources" yaml:"sources"`
}

type ProductGroupConfig struct {
	ProductGroupId    string   `json:"productGroupId" yaml:"productGroupId"`
	AllUsers          bool     `json:"allUsers" yaml:"allUsers"`
	SelectedAudiences []string `json:"selectedAudiences" yaml:"selectedAudiences"`
}

type Portal struct {
	Id            string               `json:"id" yaml:"id"`
	Name          string               `json:"name" yaml:"name"`
	AuthType      string               `json:"authType" yaml:"authType"`
	AuthApiKey    *string              `json:"authApiKey" yaml:"authApiKey"`
	AuthDomain    *string              `json:"authDomain" yaml:"authDomain"`
	ProductGroups []ProductGroupConfig `json:"productGroups" yaml:"productGroups"`
}

type Category struct {
	Id          string `json:"id" yaml:"id"`
	Name        string `json:"name" yaml:"name"`
	Description string `json:"description" yaml:"description"`
}

type Tag struct {
	Id          string `json:"id" yaml:"id"`
	Name        string `json:"name" yaml:"name"`
	Description string `json:"description" yaml:"description"`
}

type Taxonomy struct {
	Id         string   `json:"id" yaml:"id"`
	Name       string   `json:"name" yaml:"name"`
	Categories []string `json:"categories" yaml:"categories"`
	Tags       []string `json:"tags" yaml:"tags"`
}

type Theme struct {
	Id         string   `json:"id" yaml:"id"`
	Name       string   `json:"name" yaml:"name"`
	GithubRepo string   `json:"githubRepo" yaml:"githubRepo"`
	Images     []string `json:"images" yaml:"images"`
}

type apigeeCacheEntry struct {
	Data      []Product
	Timestamp time.Time
}

type Credential struct {
	ClientId     string   `json:"clientId" yaml:"clientId"`
	ClientSecret string   `json:"clientSecret" yaml:"clientSecret"`
	Products     []string `json:"products" yaml:"products"`
}

type App struct {
	Id          string       `json:"id" yaml:"id"`
	ProjectId   string       `json:"projectId,omitempty" yaml:"projectId,omitempty"`
	Name        string       `json:"name" yaml:"name"`
	Description string       `json:"description" yaml:"description"`
	Credentials []Credential `json:"credentials" yaml:"credentials"`
}

type ProductsResponse struct {
	Products []Product `json:"products"`
}

type AppsResponse struct {
	Apps []App `json:"apps"`
}
