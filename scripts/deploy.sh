#!/bin/bash
set -e

# 1. Resolve project root and load environment variables from .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

if [ -z "$GOOGLE_CLOUD_PROJECT" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT is not set. Please set it in .env or the environment."
  exit 1
fi

# 2. Discover Apigee environment and proxy service account if not already set
if [ -z "$APIGEE_ENVIRONMENT" ]; then
  APIGEE_CONFIG=$(aft describe --project "$GOOGLE_CLOUD_PROJECT" -f json --no-anim)
  APIGEE_ENVIRONMENT=$(jq -r '.environmentGroups[0].attachments[0].environment' <<< "$APIGEE_CONFIG")
fi

if [ -z "$PROXY_SA" ]; then
  PROXY_SA="portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"
fi

# 3. Compile public/index.html into a single file and update REST-Portals.yaml resource
echo "Building single-file portal HTML with bun..."
bun run ./scripts/build-portal.js

# 3b. Seed default LLM pricing into Apigee KVM (AI-Config / PriceList) only if missing (non-fatal)
PRICES_FILE="./config/default-prices.json"
if [ -f "$PRICES_FILE" ]; then
  echo "Checking Apigee KVM AI-Config/PriceList in $APIGEE_ENVIRONMENT..."
  APIGEE_TOKEN=$(gcloud auth application-default print-access-token 2>/dev/null || gcloud auth print-access-token 2>/dev/null || true)
  if [ -z "$APIGEE_TOKEN" ]; then
    echo "Warning: Could not obtain gcloud access token; skipping KVM seed."
  else
    KVM_BASE="https://apigee.googleapis.com/v1/organizations/${GOOGLE_CLOUD_PROJECT}/environments/${APIGEE_ENVIRONMENT}/keyvaluemaps"

    KVM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $APIGEE_TOKEN" "${KVM_BASE}/AI-Config" || echo "000")
    if [ "$KVM_STATUS" != "200" ]; then
      echo "Creating KVM AI-Config in $APIGEE_ENVIRONMENT (status was $KVM_STATUS)..."
      CREATE_KVM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${KVM_BASE}" \
        -H "Authorization: Bearer $APIGEE_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"name":"AI-Config","encrypted":false}' || echo "000")
      echo "Create KVM AI-Config HTTP status: $CREATE_KVM_STATUS"
    fi

    ENTRY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $APIGEE_TOKEN" "${KVM_BASE}/AI-Config/entries/PriceList" || echo "000")
    if [ "$ENTRY_STATUS" = "200" ]; then
      echo "KVM AI-Config/PriceList already exists; skipping default import."
    else
      echo "Importing default pricing from $PRICES_FILE into KVM AI-Config/PriceList..."
      ENTRY_PAYLOAD=$(jq -n --arg val "$(jq -c . "$PRICES_FILE")" '{name: "PriceList", value: $val}')
      IMPORT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${KVM_BASE}/AI-Config/entries" \
        -H "Authorization: Bearer $APIGEE_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ENTRY_PAYLOAD" || echo "000")
      echo "Import PriceList HTTP status: $IMPORT_STATUS"
    fi
  fi
fi

# 4. Deploy REST-Portals proxy (API + /portal UI)
echo "Deploying REST-Portals proxy to $GOOGLE_CLOUD_PROJECT ($APIGEE_ENVIRONMENT)..."
REST_PARAMS="APIHUB_LOCATION=${GOOGLE_CLOUD_LOCATION:-europe-west1}"
aft -i ./proxies/REST-Portals.yaml --project "$GOOGLE_CLOUD_PROJECT" --env "$APIGEE_ENVIRONMENT" --sa "$PROXY_SA" --parameters "$REST_PARAMS"

# 5. Deploy OIDC-OAuth21-IDP proxy (OAuth / OIDC identity provider)
echo "Deploying OIDC-OAuth21-IDP proxy to $GOOGLE_CLOUD_PROJECT ($APIGEE_ENVIRONMENT)..."
OIDC_PARAMS="GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-},GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-},APIHUB_LOCATION=${GOOGLE_CLOUD_LOCATION:-europe-west1}"
aft -i ./proxies/OIDC-OAuth21-IDP.yaml --project "$GOOGLE_CLOUD_PROJECT" --env "$APIGEE_ENVIRONMENT" --sa "$PROXY_SA" --parameters "$OIDC_PARAMS"
