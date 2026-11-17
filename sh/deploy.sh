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
bun run ./sh/build-portal.js

# 4. Deploy REST-Portals proxy (API + /portal UI)
echo "Deploying REST-Portals proxy to $GOOGLE_CLOUD_PROJECT ($APIGEE_ENVIRONMENT)..."
REST_PARAMS="APIHUB_LOCATION=${GOOGLE_CLOUD_LOCATION:-europe-west1}"
aft -i ./proxies/REST-Portals.yaml --project "$GOOGLE_CLOUD_PROJECT" --env "$APIGEE_ENVIRONMENT" --sa "$PROXY_SA" --parameters "$REST_PARAMS"

# 5. Deploy OIDC-OAuth21-IDP proxy (OAuth / OIDC identity provider)
echo "Deploying OIDC-OAuth21-IDP proxy to $GOOGLE_CLOUD_PROJECT ($APIGEE_ENVIRONMENT)..."
OIDC_PARAMS="GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-},GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-},APIHUB_LOCATION=${GOOGLE_CLOUD_LOCATION:-europe-west1}"
aft -i ./proxies/OIDC-OAuth21-IDP.yaml --project "$GOOGLE_CLOUD_PROJECT" --env "$APIGEE_ENVIRONMENT" --sa "$PROXY_SA" --parameters "$OIDC_PARAMS"
