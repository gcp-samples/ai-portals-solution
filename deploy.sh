SECONDS=0
gcloud run deploy apigee-ai-portal --source . --project $PROJECT_ID --region $REGION --allow-unauthenticated --env-vars-file .env
duration=$SECONDS
echo "Total deployment finished in $((duration / 60)) minutes and $((duration % 60)) seconds."
