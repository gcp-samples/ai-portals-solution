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
