# Apigee AI Portal Tutorial
This tutorial will guide you through deploying the Apigee AI Portal using an Apigee proxy as the BFF, and Firebase Hosting as the static web hosting, but of course any static hosting service would also work fine.

## Prerequisites
To use this tutorial, you will need these resources to be provisioned:
* **Google Cloud Project** with the **owner** rights.
* **[Identity Platform](https://cloud.google.com/security/products/identity-platform)**  configured in the project, with at least the [email provider](https://docs.cloud.google.com/apigee/docs) enabled.
* **[Apigee X](https://docs.cloud.google.com/apigee/docs)** provisioned in the project in a region of your choice.

## Initialize
To begin we need to initialize your environment. First open [Identity Platform](https://console.cloud.google.com/customer-identity/providers) in the Google Cloud Console, click on **Application Setup Details**, and have your **apiKey** ready to enter in the next step.

[![Identity Platform Setup](https://amalbagee.web.app/google-cloud/identity-platform1.png)](https://amalbagee.web.app/google-cloud/identity-platform1.png)

### Run Initialize Script

This script will:
* Set your environment variables for your **Google Cloud Project** and **Region**, as well as the **Identity Platform** API key from above.
* Install the tool [Apigee Feature Templater (aft)](https://github.com/apigee/apigee-templater).
* Create [Apigee API hub](https://docs.cloud.google.com/apigee/docs/apihub/what-is-api-hub) attributes for API **Category**, **Tags**, and **API Product**.

Enter your values by running this script:
```sh
source ./sh/initialize.sh
```

**If you've already initialized,** run this script to just load the variables:

```sh
source ./sh/reinitialize.sh
```

## Test Local Portal

Before we deploy the portal, let's test it locally in Cloud Shell with demo data.

Run this command to run the portal, and then click on the **Web Preview** button at the top of the screen, and then on **Preview on port 8080** to open the portal in your browser.

```sh
cd public && npx serve -p 8080
```

### Open in Web Browser
![Web Preview](https://amalbagee.web.app/cloud-shell/web-preview.png)

You should get a tab opened up with the **Apigee AI Portal**.

[![Apigee AI Portal](https://amalbagee.web.app/apigee/ai-portal1.png)](https://amalbagee.web.app/apigee/ai-portal1.png)

Log in with the test user **test@example.com** and browse the products and documentation.

To close the app preview, press **ctrl+c** in your Cloud Shell terminal.

## Connect Apigee
Next we will use an **Apigee Proxy** as BFF (Backend-For-Frontend) to connect the frontend to the API data in **Apigee** and **API Hub**.

Run this command to deploy the proxy:

```sh
aft -i ./proxies/REST-Portals.yaml -o "$GOOGLE_CLOUD_PROJECT:REST-Portals:$APIGEE_ENVIRONMENT:$PROXY_SA" -p "AUTH_API_KEY=$AUTH_API_KEY"
```

## Configure Firebase Hosting
In this lab we will use [Firebase Hosting](https://firebase.google.com/docs/hosting) as an easy and free static hosting service for our frontend.

Run this command to deploy the portal:
```sh
firebase deploy
```
