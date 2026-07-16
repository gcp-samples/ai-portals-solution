#!/usr/bin/env bash

# Helper script to test dynamic client registration against the deployed OIDC-OAuth21-IDP proxy.

if [ -z "$1" ]; then
  echo "Usage: ./test-register-client.sh <your-apigee-domain>"
  echo "Example: ./test-register-client.sh myorg-test.apigee.net"
  exit 1
fi

DOMAIN=$1

echo "📡 Registering new dynamic client on https://${DOMAIN}/oauth/v2/register-client..."

RESPONSE=$(curl -s -X POST "https://${DOMAIN}/oauth/v2/register-client" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Claude Code CLI",
    "redirect_uris": ["https://localhost:8080/callback"]
  }')

echo "--------------------------------------------------------"
echo "🎉 Registration Response:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo "--------------------------------------------------------"

CLIENT_ID=$(echo "$RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('client_id',''))" 2>/dev/null)

if [ -n "$CLIENT_ID" ] && [ "$CLIENT_ID" != "None" ]; then
  echo "✅ Successfully registered client ID: ${CLIENT_ID}"
  echo ""
  echo "🚀 You can now initiate authorization using this new client ID by running:"
  echo "https://${DOMAIN}/oauth/v2/authorize?client_id=${CLIENT_ID}&redirect_uri=https://localhost:8080/callback&response_type=code&scope=openid%20profile%20email&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256"
else
  echo "❌ Dynamic client registration failed or returned an unexpected response."
fi
