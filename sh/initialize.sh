#!/bin/bash

if [ -f "../.env" ]; then
  source ../.env
fi

read -e -i "$GOOGLE_CLOUD_PROJECT" -p "Enter your Google Cloud Project Id: " GOOGLE_CLOUD_PROJECT
read -e -i "$GOOGLE_CLOUD_LOCATION" -p "Enter your Google Cloud Region: " GOOGLE_CLOUD_LOCATION
read -e -i "$AUTH_API_KEY" -p "Enter your Identity Platfrom API Key: " AUTH_API_KEY

echo "Saving $GOOGLE_CLOUD_PROJECT and $GOOGLE_CLOUD_LOCATION..."

echo "export GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT" > .env
echo "export GOOGLE_CLOUD_LOCATION=$GOOGLE_CLOUD_LOCATION" >> .env
echo "export AUTH_API_KEY=$AUTH_API_KEY" >> .env
echo "export AUTH_DOMAIN=$GOOGLE_CLOUD_PROJECT.firebaseapp.com" >> .env

source .env

# create apigee data collectors
# dc_ai_model
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_model", "description": "Model name", "type": "STRING"}'
# dc_ai_cost_center
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_cost_center", "description": "Model cost center", "type": "STRING"}'
# dc_ai_total_token_count
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_total_token_count", "description": "Total token count", "type": "INTEGER"}'
# dc_ai_prompt_token_count
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_prompt_token_count", "description": "Prompt token count", "type": "INTEGER"}'
# dc_ai_response_token_count
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_response_token_count", "description": "Response token count", "type": "INTEGER"}'
# dc_ai_response_type
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_response_type", "description": "Model response type", "type": "STRING"}'
# dc_ai_time_first_token
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_ai_time_first_token", "description": "Time to first token (ms)", "type": "INTEGER"}'
# dc_request_cost
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_request_cost", "description": "The cost of the request data.", "type": "FLOAT"}'
# dc_response_cost
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_response_cost", "description": "The cost of the response data.", "type": "FLOAT"}'
# dc_total_cost
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/datacollectors" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H 'Content-Type: application/json; charset=utf-8' \
-d '{"name": "dc_total_cost", "description": "The total cost for the call.", "type": "FLOAT"}'

# create KVM cost entries
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "AI-Config",
  "encrypted": "false"
}'
# create default request & response price entry
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "DefaultRequestTokenPricePerMillion",
  "value": "1"
}'
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "DefaultResponseTokenPricePerMillion",
  "value": "5"
}'
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "gemini-flash-latest-RequestTokenPricePerMillion",
  "value": "0.5"
}'
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "gemini-flash-latest-ReponseTokenPricePerMillion",
  "value": "3"
}'
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "claude-4.6-opus-RequestTokenPricePerMillion",
  "value": "5"
}'
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Config/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "claude-4.6-opus-ReponseTokenPricePerMillion",
  "value": "25"
}'
# create AI-Portals KVM & entries
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d '{
  "name": "AI-Portals",
  "encrypted": "false"
}'
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Portals/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d @- <<EOF
{
  "name": "portal-title",
  "value": "Apigee AI Portal"
}
EOF
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Portals/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d @- <<EOF
{
  "name": "portal-auth-apikey",
  "value": "$AUTH_API_KEY"
}
EOF
curl -X POST "https://apigee.googleapis.com/v1/organizations/$GOOGLE_CLOUD_PROJECT/environments/$APIGEE_ENVIRONMENT/keyvaluemaps/AI-Portals/entries" -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" -H "Content-Type: application/json" -d @- <<EOF
{
  "name": "portal-auth-domain",
  "value": "$AUTH_DOMAIN"
}
EOF

# crate api hub attributes
curl -X POST "https://apihub.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes?attributeId=category" \
-H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
-H 'Content-Type: application/json; charset=utf-8' \
--data-binary @- << EOF

{
  "name": "projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes/category",
  "displayName": "Category",
  "description": "The category of the API.",
  "scope": "API",
  "dataType": "ENUM",
  "allowedValues": [
    {
      "id": "models",
      "displayName": "Models",
      "description": "AI models for the organization."
    },
    {
      "id": "tools",
      "displayName": "Tools",
      "description": "Tools to help agents do things."
    },
    {
      "id": "agents",
      "displayName": "Agents",
      "description": "Agents and sub-agents to help users in different domains."
    }
  ],
  "cardinality": 1
}
EOF

curl -X POST "https://apihub.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes?attributeId=tags" \
-H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
-H 'Content-Type: application/json; charset=utf-8' \
--data-binary @- << EOF

{
  "name": "projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes/tags",
  "displayName": "Tags",
  "description": "The tags connected to the API.",
  "scope": "API",
  "dataType": "STRING",
  "cardinality": 4
}
EOF

# curl -X POST "https://apihub.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes?attributeId=productNames" \
# -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
# -H 'Content-Type: application/json; charset=utf-8' \
# --data-binary @- << EOF

# {
#   "name": "projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes/tags",
#   "displayName": "Product Names",
#   "description": "The API product names, if it differs from the API name.",
#   "scope": "API",
#   "dataType": "STRING",
#   "cardinality": 10
# }
# EOF

# Create IAM service account and assign roles
if ! gcloud iam service-accounts describe portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com 2>/dev/null | grep -q "description: Portal Service Account"; then
  gcloud iam service-accounts create "portal-service" --project="$GOOGLE_CLOUD_PROJECT" \
      --description="Portal Service Account" \
      --display-name="Portal Service Account"
  sleep 10
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
      --member="serviceAccount:portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
      --role="roles/apigee.developerAdmin"
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
      --member="serviceAccount:portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
      --role="roles/apihub.viewer"
  gcloud iam service-accounts add-iam-policy-binding \
    portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --member="user:$(gcloud config get-value account 2>/dev/null)" \
    --role="roles/iam.serviceAccountTokenCreator" --project $GOOGLE_CLOUD_PROJECT
  PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_CLOUD_PROJECT --format="value(projectNumber)")
  gcloud iam service-accounts add-iam-policy-binding \
    portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-apigee.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountTokenCreator" --project $GOOGLE_CLOUD_PROJECT
  # give apigee actAs rights for service account
  PROJECT_NUMBER=$(gcloud projects describe $GOOGLE_CLOUD_PROJECT --format="value(projectNumber)")
  gcloud iam service-accounts add-iam-policy-binding \
    portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com \
    --member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-apigee.iam.gserviceaccount.com" \
    --role="roles/iam.serviceAccountTokenCreator" --project $GOOGLE_CLOUD_PROJECT
fi

# Initialize Identity Platform
# gcloud services enable identitytoolkit.googleapis.com --project $GOOGLE_CLOUD_PROJECT
# sleep 5
# curl -X POST "https://identitytoolkit.googleapis.com/v2/projects/$GOOGLE_CLOUD_PROJECT/identityPlatform:initializeAuth" \
#   -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
#   -H "x-goog-user-project: $GOOGLE_CLOUD_PROJECT"

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

source ./sh/reinitialize.sh
