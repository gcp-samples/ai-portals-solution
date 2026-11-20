#!/bin/bash

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
elif [ -f "../.env" ]; then
  set -a
  source ../.env
  set +a
fi

read -e -i "$GOOGLE_CLOUD_PROJECT" -p "Enter your Google Cloud Project Id: " GOOGLE_CLOUD_PROJECT
read -e -i "$GOOGLE_CLOUD_LOCATION" -p "Enter your Google Cloud Region: " GOOGLE_CLOUD_LOCATION

if ! aft -v 2>/dev/null | grep -q "Apigee Feature Templater"; then
  npm i apigee-templater -g
fi

APIGEE_CONFIG=$(aft describe --project "$GOOGLE_CLOUD_PROJECT" -f json --no-anim)

# Build list of "environment|hostname" options from environmentGroups
mapfile -t HOST_OPTIONS < <(jq -r '.environmentGroups[] | select(.attachments != null and (.attachments | length) > 0) | .attachments[0].environment as $env | .hostnames[] | "\($env)|\(.)"' <<< "$APIGEE_CONFIG")

if [ ${#HOST_OPTIONS[@]} -eq 0 ]; then
  echo "Error: No Apigee environment group hostnames found in project $GOOGLE_CLOUD_PROJECT." >&2
  return 1 2>/dev/null || exit 1
elif [ ${#HOST_OPTIONS[@]} -eq 1 ]; then
  IFS='|' read -r APIGEE_ENVIRONMENT APIGEE_HOST <<< "${HOST_OPTIONS[0]}"
else
  echo "Multiple Apigee environment group hostnames found:"
  DEFAULT_IDX=1
  for i in "${!HOST_OPTIONS[@]}"; do
    IFS='|' read -r opt_env opt_host <<< "${HOST_OPTIONS[$i]}"
    idx=$((i + 1))
    if [ "$opt_host" = "$APIGEE_HOST" ] && [ "$opt_env" = "$APIGEE_ENVIRONMENT" ]; then
      DEFAULT_IDX=$idx
    fi
    echo "  $idx) https://$opt_host (env: $opt_env)"
  done
  read -e -i "$DEFAULT_IDX" -p "Select the Apigee host to use [1-${#HOST_OPTIONS[@]}]: " HOST_CHOICE
  HOST_CHOICE=${HOST_CHOICE:-$DEFAULT_IDX}
  if ! [[ "$HOST_CHOICE" =~ ^[0-9]+$ ]] || [ "$HOST_CHOICE" -lt 1 ] || [ "$HOST_CHOICE" -gt ${#HOST_OPTIONS[@]} ]; then
    echo "Invalid selection, using default ($DEFAULT_IDX)."
    HOST_CHOICE=$DEFAULT_IDX
  fi
  IFS='|' read -r APIGEE_ENVIRONMENT APIGEE_HOST <<< "${HOST_OPTIONS[$((HOST_CHOICE - 1))]}"
fi

PROXY_SA="${PROXY_SA:-portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com}"
PORTAL_ADMIN_CLIENT_ID="${PORTAL_ADMIN_CLIENT_ID:-portal-admin}"
if [ -z "$PORTAL_ADMIN_CLIENT_SECRET" ]; then
  PORTAL_ADMIN_CLIENT_SECRET=$(bun -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
fi

echo "Saving configuration to .env..."
cat << EOF > .env
export GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT
export GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION
export APIGEE_ENVIRONMENT=$APIGEE_ENVIRONMENT
export APIGEE_HOST=$APIGEE_HOST
export PROXY_SA=$PROXY_SA

# Frontend portal configuration (injected into app.js during build)
export FRONTEND_DEMO_MODE=${FRONTEND_DEMO_MODE:-false}
export FRONTEND_PORTAL_ID=${FRONTEND_PORTAL_ID:-demo}
export FRONTEND_API_HOST=${FRONTEND_API_HOST:-}
export FRONTEND_OIDC_ENDPOINT=${FRONTEND_OIDC_ENDPOINT:-}
export FRONTEND_CLIENT_ID=${FRONTEND_CLIENT_ID:-}

# Google OAuth 2.0 credentials for upstream Google Sign-In in OIDC proxy (optional)
export GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
export GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}

# Machine-to-machine Portal Admin OAuth client (client_credentials + portal:admin scope)
export PORTAL_ADMIN_CLIENT_ID=$PORTAL_ADMIN_CLIENT_ID
export PORTAL_ADMIN_CLIENT_SECRET=$PORTAL_ADMIN_CLIENT_SECRET
EOF

set -a
source .env
set +a

ACCESS_TOKEN=$(gcloud auth application-default print-access-token)

# Helper to POST JSON to Google Cloud / Apigee APIs, ignoring 2xx and 409 (Already Exists)
api_post() {
  local label="$1"
  local url="$2"
  local data="$3"
  local resp http_code body
  resp=$(curl -s -w "\n%{http_code}" -X POST "$url" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "$data")
  http_code=$(echo "$resp" | tail -n1)
  body=$(echo "$resp" | sed '$d')
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    return 0
  elif [ "$http_code" -eq 409 ]; then
    return 0
  else
    echo "Error ($http_code) creating $label: $body" >&2
  fi
}

echo "Provisioning Apigee data collectors, KVMs, and API Hub attributes..."

# Create Apigee data collectors
api_post "datacollector dc_ai_model" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_model", "description": "Model name", "type": "STRING"}'
api_post "datacollector dc_ai_cost_center" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_cost_center", "description": "Model cost center", "type": "STRING"}'
api_post "datacollector dc_ai_total_token_count" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_total_token_count", "description": "Total token count", "type": "INTEGER"}'
api_post "datacollector dc_ai_prompt_token_count" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_prompt_token_count", "description": "Prompt token count", "type": "INTEGER"}'
api_post "datacollector dc_ai_response_token_count" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_response_token_count", "description": "Response token count", "type": "INTEGER"}'
api_post "datacollector dc_ai_response_type" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_response_type", "description": "Model response type", "type": "STRING"}'
api_post "datacollector dc_ai_time_first_token" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_ai_time_first_token", "description": "Time to first token (ms)", "type": "INTEGER"}'
api_post "datacollector dc_request_cost" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_request_cost", "description": "The cost of the request data.", "type": "FLOAT"}'
api_post "datacollector dc_response_cost" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_response_cost", "description": "The cost of the response data.", "type": "FLOAT"}'
api_post "datacollector dc_total_cost" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" '{"name": "dc_total_cost", "description": "The total cost for the call.", "type": "FLOAT"}'

# Create AI-Config KVM & cost entries
api_post "KVM AI-Config" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps" '{"name": "AI-Config", "encrypted": "false"}'
api_post "KVM entry DefaultRequestTokenPricePerMillion" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" '{"name": "DefaultRequestTokenPricePerMillion", "value": "1"}'
api_post "KVM entry DefaultResponseTokenPricePerMillion" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" '{"name": "DefaultResponseTokenPricePerMillion", "value": "5"}'
api_post "KVM entry gemini-flash-latest-RequestTokenPricePerMillion" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" '{"name": "gemini-flash-latest-RequestTokenPricePerMillion", "value": "0.5"}'
api_post "KVM entry gemini-flash-latest-ReponseTokenPricePerMillion" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" '{"name": "gemini-flash-latest-ReponseTokenPricePerMillion", "value": "3"}'
api_post "KVM entry claude-4.6-opus-RequestTokenPricePerMillion" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" '{"name": "claude-4.6-opus-RequestTokenPricePerMillion", "value": "5"}'
api_post "KVM entry claude-4.6-opus-ReponseTokenPricePerMillion" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" '{"name": "claude-4.6-opus-ReponseTokenPricePerMillion", "value": "25"}'

# Create AI-Portals KVM & entries
api_post "KVM AI-Portals" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps" '{"name": "AI-Portals", "encrypted": "false"}'
api_post "KVM entry portal-title" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Portals/entries" '{"name": "portal-title", "value": "Apigee AI Portal"}'
api_post "KVM entry portal-auth-apikey" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Portals/entries" "{\"name\": \"portal-auth-apikey\", \"value\": \"$AUTH_API_KEY\"}"
api_post "KVM entry portal-auth-domain" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Portals/entries" "{\"name\": \"portal-auth-domain\", \"value\": \"$AUTH_DOMAIN\"}"

# Generate OIDC RSA keys / JWKS if missing and populate OIDC-Users KVM
if [ ! -f "private.pem" ] || [ ! -f "public.pem" ]; then
  openssl genrsa -out private.pem 2048 2>/dev/null
  openssl rsa -in private.pem -outform PEM -pubout -out public.pem 2>/dev/null
fi
if [ ! -f "jwks.json" ]; then
  bun -e "const crypto = require('crypto'); const fs = require('fs'); const key = crypto.createPublicKey(fs.readFileSync('public.pem')); const jwk = key.export({ format: 'jwk' }); console.log(JSON.stringify({ keys: [{ ...jwk, kid: 'kid-1', use: 'sig', alg: 'RS256' }] }));" > jwks.json
fi

api_post "KVM OIDC-Users" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps" '{"name": "OIDC-Users", "encrypted": true}'
api_post "KVM entry key:public_key" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/OIDC-Users/entries" "$(bun -e 'console.log(JSON.stringify({ name: "key:public_key", value: require("fs").readFileSync("public.pem", "utf8") }))')"
api_post "KVM entry key:private_key" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/OIDC-Users/entries" "$(bun -e 'console.log(JSON.stringify({ name: "key:private_key", value: require("fs").readFileSync("private.pem", "utf8") }))')"
api_post "KVM entry key:jwks" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/OIDC-Users/entries" "$(bun -e 'console.log(JSON.stringify({ name: "key:jwks", value: require("fs").readFileSync("jwks.json", "utf8").trim() }))')"
api_post "KVM entry client:$PORTAL_ADMIN_CLIENT_ID" "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/OIDC-Users/entries" "$(bun -e "console.log(JSON.stringify({ name: 'client:' + process.env.PORTAL_ADMIN_CLIENT_ID, value: JSON.stringify({ client_id: process.env.PORTAL_ADMIN_CLIENT_ID, client_secret: process.env.PORTAL_ADMIN_CLIENT_SECRET, client_name: 'Portal Admin', grant_types: ['client_credentials'], scope: 'portal:admin' }) }))")"

# Create API Hub attributes
api_post "API Hub attribute category" "https://apihub.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes?attributeId=category" "{
  \"name\": \"projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes/category\",
  \"displayName\": \"Category\",
  \"description\": \"The category of the API.\",
  \"scope\": \"API\",
  \"dataType\": \"ENUM\",
  \"allowedValues\": [
    {\"id\": \"models\", \"displayName\": \"Models\", \"description\": \"AI models for the organization.\"},
    {\"id\": \"tools\", \"displayName\": \"Tools\", \"description\": \"Tools to help agents do things.\"},
    {\"id\": \"agents\", \"displayName\": \"Agents\", \"description\": \"Agents and sub-agents to help users in different domains.\"}
  ],
  \"cardinality\": 1
}"

api_post "API Hub attribute tags" "https://apihub.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes?attributeId=tags" "{
  \"name\": \"projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes/tags\",
  \"displayName\": \"Tags\",
  \"description\": \"The tags connected to the API.\",
  \"scope\": \"API\",
  \"dataType\": \"STRING\",
  \"cardinality\": 4
}"

# Create IAM service account and assign roles
if ! gcloud iam service-accounts describe "portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" >/dev/null 2>&1; then
  echo "Creating service account portal-service..."
  gcloud iam service-accounts create "portal-service" --project="$GOOGLE_CLOUD_PROJECT" \
      --description="Portal Service Account" \
      --display-name="Portal Service Account" >/dev/null
  sleep 10
  gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
      --member="serviceAccount:portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
      --role="roles/apigee.developerAdmin" >/dev/null
  gcloud projects add-iam-policy-binding "$GOOGLE_CLOUD_PROJECT" \
      --member="serviceAccount:portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
      --role="roles/apihub.editor" >/dev/null
  gcloud iam service-accounts add-iam-policy-binding \
    "portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
    --member="user:$(gcloud config get-value account 2>/dev/null)" \
    --role="roles/iam.serviceAccountTokenCreator" --project "$GOOGLE_CLOUD_PROJECT" >/dev/null
  PROJECT_NUMBER=$(gcloud projects describe "$GOOGLE_CLOUD_PROJECT" --format="value(projectNumber)")
  gcloud iam service-accounts add-iam-policy-binding \
    "portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
    --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-apigee.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountTokenCreator" --project "$GOOGLE_CLOUD_PROJECT" >/dev/null
fi

cat << EOF > .firebaserc
{
  "projects": {
    "default": "$GOOGLE_CLOUD_PROJECT"
  }
}
EOF

cat << EOF > ./public/CONFIG.local.json
{
  "demoMode": true,
  "portalId": "demo",
  "apiHost": "https://$APIGEE_HOST"
}
EOF

source ./scripts/reinitialize.sh
