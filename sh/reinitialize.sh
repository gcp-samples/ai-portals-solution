source .env

if ! aft -v 2>/dev/null | grep -q "Apigee Feature Templater"; then
    npm i apigee-templater -g
fi

export APIGEE_CONFIG=$(aft -c $GOOGLE_CLOUD_PROJECT)
export APIGEE_ENVIRONMENT=$(jq -r '.environmentGroups[0].attachments[0].environment' <<< "$APIGEE_CONFIG")
echo "Your APIGEE_ENVIRONMENT: $APIGEE_ENVIRONMENT"
export APIGEE_HOST=$(jq -r '.environmentGroups[0].hostnames[0]' <<< "$APIGEE_CONFIG")
echo "Your APIGEE_HOST: $APIGEE_HOST"
export PROXY_SA="portal-service@$GOOGLE_CLOUD_PROJECT.iam.gserviceaccount.com"
echo "Your PROXY_SA: $PROXY_SA"

echo "Your GOOGLE_CLOUD_PROJECT: $GOOGLE_CLOUD_PROJECT"
echo "Your GOOGLE_CLOUD_LOCATION: $GOOGLE_CLOUD_LOCATION"
