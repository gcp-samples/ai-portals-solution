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

- Google Cloud Project with Apigee and API Hub provisioned.
- Google Cloud SDK (`gcloud`) installed and authenticated, or access to [Cloud Shell](https://docs.cloud.google.com/shell/docs).
- [Bun](https://bun.sh/) (used to bundle the frontend portal into a single HTML file).
- [Apigee Feature Templater (`aft` v5)](https://github.com/apigee/apigee-templater) and `jq` installed.

## Deploy

The solution is managed with three scripts in `sh/` (configured via `.env` — see [env.example](env.example)):

1. **Initialize (first-time setup):** Creates `.env`, Apigee data collectors, KVMs, API Hub attributes, and the `portal-service` IAM service account.
   ```sh
   source ./sh/initialize.sh
   ```
2. **Reinitialize (optional):** Reloads `.env` and refreshes `APIGEE_ENVIRONMENT`, `APIGEE_HOST`, and `PROXY_SA` in your current shell.
   ```sh
   source ./sh/reinitialize.sh
   ```
3. **Deploy:** Compiles `public/index.html` into a single-file bundle with `bun`, embeds it as a resource in `REST-Portals.yaml` (served at `/portal`), and deploys both `REST-Portals` and `OIDC-OAuth21-IDP` proxies using `aft`.
   ```sh
   ./sh/deploy.sh
   ```

Once deployed, access the developer portal at `https://<your-apigee-host>/portal`.

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

## Automation & Machine-to-Machine API Access

To call `POST Login`, `GET Apps`, and `POST App` from an automation script on behalf of users:

### Recommended Pattern: `client_credentials` + `portal:admin` Scope
1. Provision a machine OAuth client (e.g. `portal-admin`) in `sh/initialize.sh` (stored in the `OIDC-Users` KVM) with an allowed `portal:admin` scope.
2. Add `grant_type=client_credentials` support to `OIDC-OAuth21-IDP.yaml` (`POST /token`) to validate `client_id`/`client_secret` and mint a short-lived RS256 JWT with `scope: "portal:admin"`.
3. In `REST-Portals.yaml`, allow callers with `portal:admin` scope to target `{userEmail}` from the URL path (instead of requiring `jwt.JWT-AccessToken.claim.email`).

Once enabled, an automation script obtains a token and calls the portal APIs as follows:

```bash
PORTAL_HOST="https://<your-apigee-host>"
USER_EMAIL="developer@example.com"

# 1. Obtain a machine access token (requires client_credentials support on /token)
ACCESS_TOKEN=$(curl -s -X POST "${PORTAL_HOST}/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${PORTAL_ADMIN_CLIENT_ID}&client_secret=${PORTAL_ADMIN_CLIENT_SECRET}&scope=portal:admin" \
  | jq -r '.access_token')

# 2. POST Login (creates/ensures the developer exists in Apigee)
curl -s -X POST "${PORTAL_HOST}/api/portals/demo/users/${USER_EMAIL}/login" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"${USER_EMAIL}\", \"firstName\": \"Jane\", \"lastName\": \"Doe\", \"userName\": \"${USER_EMAIL}\"}"

# 3. GET Apps (lists the developer's apps and credentials)
curl -s -X GET "${PORTAL_HOST}/api/portals/demo/users/${USER_EMAIL}/apps" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"

# 4. POST App (creates a new developer app, optionally subscribing to products)
curl -s -X POST "${PORTAL_HOST}/api/portals/demo/users/${USER_EMAIL}/apps" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "coding-agent-app", "apiProducts": ["coding-agent-product"]}'
```

### Alternative (Works Today Without Proxy Changes): Mint a Per-User RS256 JWT
Because `REST-Portals` verifies RS256 JWTs against `key:public_key` in `OIDC-Users` and `SC-GetApps` currently scopes lookups to `jwt.JWT-AccessToken.claim.email`, an automation script that holds `private.pem` can sign a short-lived JWT with `iss: "${HOST}"` and `email: "${USER_EMAIL}"`:

```bash
ACCESS_TOKEN=$(bun -e "
  const crypto = require('crypto'), fs = require('fs');
  const b64u = s => Buffer.from(s).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'kid-1' }));
  const payload = b64u(JSON.stringify({
    iss: '${HOST}',
    sub: '${USER_EMAIL}',
    email: '${USER_EMAIL}',
    iat: now,
    exp: now + 300
  }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(header + '.' + payload), fs.readFileSync('private.pem', 'utf8')).toString('base64url');
  console.log(header + '.' + payload + '.' + sig);
")
```

## Customization

The portal is designed to be easily themed and extended. You can create new themes or modify existing ones using AI agents to match your brand and functional requirements. For automated modifications, tools like **Anitgravity** are highly recommended.

## License

This project is licensed under the Apache License 2.0. See the `LICENSE` file for details.
