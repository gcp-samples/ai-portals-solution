#!/usr/bin/env node

const crypto = require('crypto');

// 1. Generate high-entropy secure code verifier (standard OAuth 2.1)
function generateVerifier() {
    const buffer = crypto.randomBytes(32);
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// 2. Generate correct S256 code challenge
function generateChallenge(verifier) {
    const hash = crypto.createHash('sha256').update(verifier).digest();
    return hash.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Check if they want to test a specific verifier
const args = process.argv.slice(2);
let verifier = args[0];

if (verifier) {
    console.log(`\n🔍 Verifying user-provided verifier: "${verifier}"`);
} else {
    verifier = generateVerifier();
    console.log(`\n✨ Generated new random PKCE code pair:`);
}

const challenge = generateChallenge(verifier);

console.log(`----------------------------------------------------------------`);
console.log(`🔑 Code Verifier:  ${verifier}`);
console.log(`🎯 Code Challenge: ${challenge}`);
console.log(`----------------------------------------------------------------`);

// Validate RFC 7636 example if the standard one is requested
if (verifier === "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") {
    console.log(`\n✅ Matches RFC 7636 Appendix B perfectly!`);
    console.log(`   Expected Challenge (RFC): E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`);
    console.log(`   Calculated Challenge:    ${challenge}`);
}

console.log(`\n🚀 HOW TO TEST THIS WITH YOUR APIGEE IDP PROXY:`);
console.log(`1. Copy this Authorization URL and open it in your browser:`);
console.log(`   https://<your-apigee-domain>/oauth/v2/authorize?client_id=my-portal-client&redirect_uri=https://localhost:8080/callback&response_type=code&scope=openid%20profile%20email&code_challenge=${challenge}&code_challenge_method=S256`);
console.log(`\n2. Sign in using your registered credentials.`);
console.log(`\n3. After successful login, you will be redirected to localhost (which might show connection refused, this is normal!).`);
console.log(`   Copy the 'code' parameter from the URL address bar:`);
console.log(`   e.g., https://localhost:8080/callback?code=YOUR_AUTH_CODE`);
console.log(`\n4. Exchange the authorization code for tokens using curl:`);
console.log(`   curl -X POST https://<your-apigee-domain>/oauth/v2/token \\`);
console.log(`     -H "Content-Type: application/x-www-form-urlencoded" \\`);
console.log(`     -d "grant_type=authorization_code" \\`);
console.log(`     -d "client_id=my-portal-client" \\`);
console.log(`     -d "redirect_uri=https://localhost:8080/callback" \\`);
console.log(`     -d "code=YOUR_AUTH_CODE" \\`);
console.log(`     -d "code_verifier=${verifier}"`);
console.log(`\n----------------------------------------------------------------`);
