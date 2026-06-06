# Apigee AI Portal Proxy/Firebase Tutorial
This tutorial will guide you through deploying the Apigee AI Portal using an Apigee proxy as the BFF, and Firebase Hosting as the static web hosting, but of course any static hosting service would also work fine.

## Prerequisites
To use this tutorial, you will need these resources to be provisioned:
* **Google Cloud Project** with the **owner** rights.
* **Apigee X** provisioned in the project in a region of your choice.

## Initialize
To begin we need to initialize your environment.

* Set your **Google Cloud Project** and **Region** where Apigee X is provisioned.
* Install the tool [Apigee Feature Templater (aft)](https://github.com/apigee/apigee-templater).
* Create [Apigee API hub](https://docs.cloud.google.com/apigee/docs/apihub/what-is-api-hub) attributes for API **Category**, **Tags**, and **API Product**.

Enter your values by running this script:
```sh
source ./sh/initialize.sh
```

Run this script if **you've already initialized,** and just want to reload the variables:

```sh
source ./sh/reinitialize.sh
```

## Deploy Apigee Proxy
We will use an Apigee proxy as the BFF for our portal frontend.
Run this command to deploy the proxy:

```sh
aft -i ./proxies/REST-Portals.yaml -o "$GOOGLE_CLOUD_PROJECT:REST-Portals:$APIGEE_ENVIRONMENT:$PROXY_SA"
```
