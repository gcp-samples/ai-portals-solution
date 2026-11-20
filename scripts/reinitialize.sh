#!/bin/bash

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

if ! aft -v 2>/dev/null | grep -q "Apigee Feature Templater"; then
  npm i apigee-templater -g
fi

if [ -z "$APIGEE_ENVIRONMENT" ] || [ -z "$APIGEE_HOST" ]; then
  export APIGEE_CONFIG=$(aft describe --project "$GOOGLE_CLOUD_PROJECT" -f json --no-anim)
  [ -z "$APIGEE_ENVIRONMENT" ] && export APIGEE_ENVIRONMENT=$(jq -r '.environmentGroups[0].attachments[0].environment' <<< "$APIGEE_CONFIG")
  [ -z "$APIGEE_HOST" ] && export APIGEE_HOST=$(jq -r '.environmentGroups[0].hostnames[0]' <<< "$APIGEE_CONFIG")
fi

if [ -z "$PROXY_SA" ]; then
  export PROXY_SA="portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"
fi

echo "Your APIGEE_ENVIRONMENT: $APIGEE_ENVIRONMENT"
echo "Your APIGEE_HOST: $APIGEE_HOST"
echo "Your PROXY_SA: $PROXY_SA"
echo "Your GOOGLE_CLOUD_PROJECT: $GOOGLE_CLOUD_PROJECT"
echo "Your GOOGLE_CLOUD_LOCATION: $GOOGLE_CLOUD_LOCATION"
