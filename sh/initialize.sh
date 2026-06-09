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

source .env

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

curl -X POST "https://apihub.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes?attributeId=productName" \
-H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
-H 'Content-Type: application/json; charset=utf-8' \
--data-binary @- << EOF

{
  "name": "projects/$GOOGLE_CLOUD_PROJECT/locations/$GOOGLE_CLOUD_LOCATION/attributes/tags",
  "displayName": "Product Name",
  "description": "The API product name, if it differs from the API name.",
  "scope": "API",
  "dataType": "STRING",
  "cardinality": 1
}
EOF

# Create IAM service account and assign roles
if ! gcloud iam service-accounts describe portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com 2>/dev/null | grep -q "description: Portal service account"; then
  gcloud iam service-accounts create "portal-service" --project="$GOOGLE_CLOUD_PROJECT" \
      --description="Portal service account" \
      --display-name="Portal Service Account"
  sleep 10
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
      --member="serviceAccount:ai-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
      --role="roles/apigee.developerAdmin"
  gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
      --member="serviceAccount:ai-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com" \
      --role="roles/apihub.viewer"
fi

# Initialize Identity Platform
gcloud services enable identitytoolkit.googleapis.com --project $GOOGLE_CLOUD_PROJECT
sleep 5
curl -X POST "https://identitytoolkit.googleapis.com/v2/projects/$GOOGLE_CLOUD_PROJECT/identityPlatform:initializeAuth" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "x-goog-user-project: $GOOGLE_CLOUD_PROJECT"

cat << EOF > .firebaserc
{
  "projects": {
    "default": "$GOOGLE_CLOUD_PROJECT"
  }
}
EOF

cat << EOF > ./public/CONFIG.local.json
{
  demoMode: true,
  portalId: "demo",
  apiHost: "https://$APIGEE_HOST",
  portalConfig: null,
}
EOF

source ./sh/reinitialize.sh
