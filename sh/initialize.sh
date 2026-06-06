#!/bin/bash

if [ -f "../.env" ]; then
  source ../.env
fi

read -e -i "$GOOGLE_CLOUD_PROJECT" -p "Enter your Google Cloud Project Id: " project_id
read -e -i "$GOOGLE_CLOUD_LOCATION" -p "Enter your Google Cloud Region: " region

echo "Saving $project_id and $region..."

echo "export GOOGLE_CLOUD_PROJECT=$project_id" > .env
echo "export GOOGLE_CLOUD_LOCATION=$region" >> .env

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

source ./sh/reinitialize.sh
