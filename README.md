# Apigee AI Portal

The **Apigee AI Portal** is a modern, agent-centric storefront template created with **[Antigravity CLI](https://antigravity.google/)** and designed for Google Cloud AI and API products, but also for any API products. It provides a robust and flexible foundation for building sophisticated API developer portals that leverage the power of Google Cloud's AI ecosystem.

[![Apigee AI Portal](https://amalbagee.web.app/apigee/ai-portal1.png)](https://amalbagee.web.app/apigee/ai-portal1.png)

## Key Advantages

*  **Serverless** deployment using an Apigee proxy.
* By default uses an **OIDC proxy** in Apigee as IDP, but can be changed to use any OIDC server.
*   **Seamless Integration**: Designed to integrate flawlessly with **[Apigee X](https://cloud.google.com/apigee)** and **Apigee hybrid** APIs, providing a unified management and discovery experience.
*   **Agentic Customization**: Built for high extensibility, the portal can be easily customized using **[Antigravity](https://antigravity.google)**, **Gemini CLI**, or other agentic coding solutions, enabling rapid iteration and AI-driven development.
*   **Enterprise-Grade Monitoring**: Fully supported through **[Google Cloud Monitoring](https://cloud.google.com/monitoring)**, ensuring you have deep visibility into portal performance and usage patterns.

## Getting Started

### Prerequisites

- Google Cloud Project, Apigee, API Hub, and Identity Platform provisioned.
- Google Cloud SDK (gcloud) installed and authenticated, or access to [Cloud Shell](https://docs.cloud.google.com/shell/docs).
- [Apigee Feature Templater](https://github.com/apigee/apigee-templater) and [Firebase CLI](https://firebase.google.com/docs/cli) installed.

## Deploy

To deploy the solution, you will need to deploy 2 Apigee proxies and the web client, like this.

```sh
# initialize .env file and client config
source ./sh/initialize.sh

# deploy proxies
aft -i ./proxies/OIDC-OAuth21-IDP.yaml -o "$GOOGLE_CLOUD_PROJECT:OIDC-OAuth21-IDP:$APIGEE_ENVIRONMENT:$PROXY_SA"
aft -i ./proxies/REST-Portals.yaml -o "$GOOGLE_CLOUD_PROJECT:REST-Portals:$APIGEE_ENVIRONMENT:$PROXY_SA"

# deploy frontend to firebase hosting
firebase deploy --project $GOOGLE_CLOUD_PROJECT
```

## Security Configuration (OIDC Keys Setup)

To secure the built-in OIDC Identity Provider proxy, you must generate a custom RSA 2048 key pair (used for JWT signing and verification) and save it to the Apigee environment-scoped Key Value Map (**KVM**) named `OIDC-Users`. You do not need to do this if you are using your own OIDC service.

### 1. Generate RSA Key Pair
Run the following commands in your terminal or Cloud Shell to generate the keys:
```bash
# Generate a private key
openssl genrsa -out private.pem 2048

# Extract the public key
openssl rsa -in private.pem -outform PEM -pubout -out public.pem
```

### 2. Generate the JWKS (JSON Web Key Set) Payload
Convert your public key into standard JWKS format using this Node.js command:
```bash
node -e "const crypto = require('crypto'); const fs = require('fs'); const key = crypto.createPublicKey(fs.readFileSync('public.pem')); const jwk = key.export({ format: 'jwk' }); console.log(JSON.stringify({ keys: [{ ...jwk, kid: 'kid-1', use: 'sig', alg: 'RS256' }] }));" > jwks.json
```

### 3. Save to Apigee KVM (using curl)
Populate the values into the `OIDC-Users` KVM map in your Apigee environment. Replace `${ORG}` and `${ENV}` with your Google Cloud organization and Apigee environment names:

#### Creating the KVM entries (First-time setup):
```bash
# Set public_key
curl -X POST "https://apigee.googleapis.com/v1/organizations/${ORG}/environments/${ENV}/keyvaluemaps/OIDC-Users/entries" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ name: "key:public_key", value: require("fs").readFileSync("public.pem", "utf8") }))')"

# Set private_key
curl -X POST "https://apigee.googleapis.com/v1/organizations/${ORG}/environments/${ENV}/keyvaluemaps/OIDC-Users/entries" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ name: "key:private_key", value: require("fs").readFileSync("private.pem", "utf8") }))')"

# Set JWKS JSON payload
curl -X POST "https://apigee.googleapis.com/v1/organizations/${ORG}/environments/${ENV}/keyvaluemaps/OIDC-Users/entries" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ name: "key:jwks", value: require("fs").readFileSync("jwks.json", "utf8").trim() }))')"
```

#### Updating/Rotating the KVM entries (Upsert):
```bash
# Update public_key
curl -X PUT "https://apigee.googleapis.com/v1/organizations/${ORG}/environments/${ENV}/keyvaluemaps/OIDC-Users/entries/key:public_key" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ name: "key:public_key", value: require("fs").readFileSync("public.pem", "utf8") }))')"

# Update private_key
curl -X PUT "https://apigee.googleapis.com/v1/organizations/${ORG}/environments/${ENV}/keyvaluemaps/OIDC-Users/entries/key:private_key" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ name: "key:private_key", value: require("fs").readFileSync("private.pem", "utf8") }))')"

# Update JWKS JSON payload
curl -X PUT "https://apigee.googleapis.com/v1/organizations/${ORG}/environments/${ENV}/keyvaluemaps/OIDC-Users/entries/key:jwks" \
  -H "Authorization: Bearer $(gcloud auth application-default print-access-token)" \
  -H "Content-Type: application/json" \
  -d "$(node -e 'console.log(JSON.stringify({ name: "key:jwks", value: require("fs").readFileSync("jwks.json", "utf8").trim() }))')"
```

> [!NOTE]
> Make sure to delete the generated local `.pem` and `.json` files after successfully uploading them to the KVM to prevent them from being accidentally committed to your repository.

## Customization

The portal is designed to be easily themed and extended. You can create new themes or modify existing ones using AI agents to match your brand and functional requirements. For automated modifications, tools like **Anitgravity** are highly recommended.

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.
