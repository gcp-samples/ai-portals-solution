SECONDS=0
gcloud run deploy apigee-ai-portal --source . --project $GOOGLE_CLOUD_PROJECT --region $GOOGLE_CLOUD_LOCATION --allow-unauthenticated --env-vars-file .env
duration=$SECONDS
echo "Total deployment finished in $((duration / 60)) minutes and $((duration % 60)) seconds."
