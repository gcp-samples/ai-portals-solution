# Apigee AI Portal Tutorial

<walkthrough-tutorial-duration duration="30"></walkthrough-tutorial-duration>

This tutorial will guide you through deploying the Apigee AI Portal using an Apigee proxy as the BFF, and Firebase Hosting as the static web hosting, but of course any static hosting service would also work fine.

## Prerequisites
To use this tutorial, you will need these resources to be provisioned:
* **Google Cloud Project** with the **owner** rights.
* **[Identity Platform](https://cloud.google.com/security/products/identity-platform)**  configured in the project, with at least the **[email provider](https://docs.cloud.google.com/apigee/docs) enabled**.
* **[Apigee X](https://docs.cloud.google.com/apigee/docs)** provisioned in the project in a region of your choice.

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

## Initialize Identity Platform
To begin we need to initialize your environment. First open [Identity Platform](https://console.cloud.google.com/customer-identity/providers) in the Google Cloud Console. Make sure that you have at least the **Email / Password** provider enabled.

[![Identity Platform Users](https://amalbagee.web.app/google-cloud/identity-platform-providers1.png)](https://amalgagee.web.app/google-cloud/identity-platform-providers1.png)

Click on **Application Setup Details**, and have your **apiKey** ready to enter in the next step.

[![Identity Platform Setup](https://amalbagee.web.app/google-cloud/identity-platform1.png)](https://amalbagee.web.app/google-cloud/identity-platform1.png)

### Run Initialization Script

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

## Connect Apigee
Next we will use an **Apigee Proxy** as BFF (Backend-For-Frontend) to connect the frontend to the API data in **Apigee** and **API Hub**.

Run this command to deploy the proxy:

```sh
aft -i ./proxies/REST-Portals.yaml -o "$GOOGLE_CLOUD_PROJECT:REST-Portals:$APIGEE_ENVIRONMENT:$PROXY_SA" -p "AUTH_API_KEY=$AUTH_API_KEY"
```

## Configure Firebase Hosting
In this lab we will use [Firebase Hosting](https://firebase.google.com/docs/hosting) as an easy and free static hosting service for our frontend. The files <walkthrough-editor-open-file filePath="firebase.json">firebase.json</walkthrough-editor-open-file> and <walkthrough-editor-open-file filePath=".firebaserc">.firebaserc</walkthrough-editor-open-file> have the Firebase configuration, and <walkthrough-editor-open-file filePath="./public/CONFIG.local.json">CONFIG.local.json</walkthrough-editor-open-file> as the portal configuration to our Apigee proxy.

Run this command to deploy the portal to **Firebase Hosting**:
```sh
firebase deploy
```

Click on the **Hosting URL** that is displayed in the shell to open the portal. By default the portal is in **DEMO MODE**, however you can now click at the bottom and switch to **Cloud Identity Platform** to use the production APIs.

[![Portal Production APIs](https://amalbagee.web.app/apigee/ai-portal2.png)](https://amalbagee.web.app/apigee/ai-portal2.png)

## Conclusion

<walkthrough-conclusion-trophy></walkthrough-conclusion-trophy>

Congratulations, you've completed the AI Portal deployment lab! Play around with the products and subscriptions, and see how you can expand and manage the AI products offered through the portal to users and agents.

<walkthrough-inline-feedback></walkthrough-inline-feedback>
