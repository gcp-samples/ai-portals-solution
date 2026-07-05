var fs = require('fs');
var path = require('path');
var assert = require('assert');

// 1. Load transformations.js code and execute it globally
var transformationsCode = fs.readFileSync(path.join(__dirname, '../transformations.js'), 'utf8');
eval(transformationsCode);

// 2. Load test data
var apis = JSON.parse(fs.readFileSync(path.join(__dirname, 'apis.json'), 'utf8'));
var products = JSON.parse(fs.readFileSync(path.join(__dirname, 'products.json'), 'utf8'));

console.log('Running transformApisToProducts unit tests...');

try {
  // 3. Run the transformation
  var result = transformApisToProducts(apis, products);

  // 4. Assertions on the root structure
  assert.ok(result, 'Result should be defined');
  assert.ok(Array.isArray(result.products), 'result.products should be an array');
  assert.strictEqual(result.products.length, 10, 'Should transform exactly 10 products with Apigee product packages');

  // Verify that all returned products have at least one package
  result.products.forEach(function(p) {
    assert.ok(p.packages && p.packages.length > 0, 'Every returned product should have at least one package');
  });

  // Helper to find a product by displayName
  function findProduct(displayName) {
    return result.products.filter(function(p) {
      return p.displayName === displayName;
    })[0];
  }

  // Helper to find a package by packageId inside a product
  function findPackage(product, packageId) {
    if (!product || !product.packages) return null;
    return product.packages.filter(function(pkg) {
      return pkg.packageId === packageId;
    })[0];
  }

  // Test Case 1: Validate Claude Admin product mapping
  var claudeAdminApi = findProduct('AI-admin_-Claude');
  assert.ok(claudeAdminApi, 'Claude Admin API should exist');
  assert.ok(Array.isArray(claudeAdminApi.packages), 'Claude Admin API packages should be an array');
  
  var claudeAdminPkg = findPackage(claudeAdminApi, 'Claude admin_ Product');
  assert.ok(claudeAdminPkg, 'Claude Admin package should exist');
  assert.strictEqual(claudeAdminPkg.tokenLimits.length, 1, 'Claude Admin package should have exactly 1 token limit');
  assert.strictEqual(claudeAdminPkg.tokenLimits[0].tokenLimit, 10000, 'Claude Admin token limit should be 10000');
  assert.strictEqual(claudeAdminPkg.tokenLimits[0].modelName, 'claude-opus-4-7', 'Claude Admin modelName should match');
  assert.strictEqual(claudeAdminPkg.tokenLimits[0].type, 'USER', 'Claude Admin token limit type should be USER');

  // Test Case 2: Validate ai-auth product mapping to test-product
  var authApi = findProduct('ai-auth');
  assert.ok(authApi, 'Auth API should exist');
  
  var authPkg = findPackage(authApi, 'test-product');
  assert.ok(authPkg, 'test-product package should exist under ai-auth');
  assert.strictEqual(authPkg.tokenLimits.length, 1, 'test-product should have exactly 1 token limit');
  assert.strictEqual(authPkg.tokenLimits[0].tokenLimit, 100, 'test-product token limit should be 100');
  assert.strictEqual(authPkg.tokenLimits[0].modelName, 'gemini-flash-latest', 'test-product modelName should match');

  // Test Case 3: Validate API Analytics matching all configured products
  var analyticsApi = findProduct('AI-Analytics');
  assert.ok(analyticsApi, 'Analytics API should exist');
  assert.strictEqual(analyticsApi.packages.length, 8, 'Analytics API should map to 8 different product packages');

  // Test Case 4: Validate handling when inputs are invalid/missing
  var emptyResult = transformApisToProducts(null, null);
  assert.deepStrictEqual(emptyResult, { products: [] }, 'Should return empty products array when input is null');

  console.log('Running transformAppToApigee unit tests...');

  // Test Case 5: Validate transformAppToApigee with standard input
  var inputApp = {
    name: "New App",
    description: "Created via product detail subscription.",
    credentials: [
      {
        clientId: "",
        clientSecret: "",
        products: ["Claude Core Product"]
      }
    ]
  };

  var expectedOutput = {
    name: "New App",
    apiProducts: ["Claude Core Product"],
    attributes: [
      {
        name: "description",
        value: "Created via product detail subscription."
      }
    ]
  };

  var transformedApp = transformAppToApigee(inputApp);
  assert.deepStrictEqual(transformedApp, expectedOutput, 'Should map name, apiProducts, and description attribute correctly');

  // Test Case 6: Validate transformAppToApigee with no description or credentials
  var minimalApp = {
    name: "Minimal App"
  };
  var expectedMinimal = {
    name: "Minimal App",
    apiProducts: [],
    attributes: []
  };
  var transformedMinimal = transformAppToApigee(minimalApp);
  assert.deepStrictEqual(transformedMinimal, expectedMinimal, 'Should handle app with no description or credentials');

  // Test Case 7: Validate transformAppToApigee with multiple credentials and duplicate products
  var multiCredApp = {
    name: "Multi App",
    credentials: [
      { products: ["Prod A", "Prod B"] },
      { products: ["Prod B", "Prod C"] }
    ]
  };
  var transformedMulti = transformAppToApigee(multiCredApp);
  assert.deepStrictEqual(transformedMulti.apiProducts, ["Prod A", "Prod B", "Prod C"], 'Should collect and deduplicate products across all credentials');

  // Test Case 8: Validate transformAppToApigee null/empty handling
  assert.deepStrictEqual(transformAppToApigee(null), { name: "", apiProducts: [], attributes: [] }, 'Should handle null input');

  console.log('Running transformApp and transformApps unit tests...');

  // Test Case 9: Validate transformApp with a standard single app
  var apigeeApp = {
    appId: "app-12345",
    name: "My Awesome App",
    attributes: [
      { name: "description", value: "App description here" }
    ],
    credentials: [
      {
        consumerKey: "key-123",
        consumerSecret: "secret-456",
        apiProducts: [
          { apiproduct: "Product A" },
          { apiproduct: "Product B" }
        ]
      }
    ]
  };

  var expectedTransformedApp = {
    id: "app-12345",
    name: "My Awesome App",
    description: "App description here",
    credentials: [
      {
        clientId: "key-123",
        clientSecret: "secret-456",
        products: ["Product A", "Product B"]
      }
    ]
  };

  var resultApp = transformApp(apigeeApp);
  assert.deepStrictEqual(resultApp, expectedTransformedApp, 'Should map single app correctly');

  // Test Case 10: Validate transformApps refactored logic with list
  var appListInput = {
    app: [apigeeApp]
  };
  var expectedListResult = {
    apps: [expectedTransformedApp]
  };
  var resultApps = transformApps(appListInput);
  assert.deepStrictEqual(resultApps, expectedListResult, 'Should map list of apps correctly using the refactored logic');

  // Test Case 11: Validate transformApp null handling
  assert.strictEqual(transformApp(null), null, 'Should return null for null input');

  console.log('Running checkAppCredentials unit tests...');

  // Test Case 12: Validate with the user's exact example
  var inputObjUser = {
    "credentials": [
      {
        "clientId": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
        "clientSecret": "GxrXEZw940JVjwbELKlLOaH0MSUK1uGAPQ62AUYDs87KiKGkhd1miA3DCWFbyT9q",
        "products": ["Claude Core Product", "DeepSeek Core Product"]
      }
    ],
    "description": "Created via product detail subscription.",
    "id": "78a7946c-628b-425f-ae1e-33c60521f885",
    "name": "New App 2"
  };

  var originalAppUser = {
    "appId": "78a7946c-628b-425f-ae1e-33c60521f885",
    "attributes": [
      { "name": "description", "value": "Created via product detail subscription." }
    ],
    "createdAt": "1782973994982",
    "credentials": [
      {
        "apiProducts": [
          { "apiproduct": "Claude Core Product", "status": "approved" }
        ],
        "consumerKey": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
        "consumerSecret": "GxrXEZw940JVjwbELKlLOaH0MSUK1uGAPQ62AUYDs87KiKGkhd1miA3DCWFbyT9q",
        "expiresAt": "-1",
        "issuedAt": "1782973995028",
        "status": "approved"
      }
    ],
    "developerId": "01447a05-8000-43b2-987b-8653269f3296",
    "lastModifiedAt": "1782973994982",
    "name": "New App 2",
    "status": "approved",
    "appFamily": "default"
  };

  var expectedChangesUser = [
    {
      "clientId": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
      "consumerKey": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
      "apiproduct": "DeepSeek Core Product",
      "apiProduct": "DeepSeek Core Product",
      "operationName": "ADDED",
      "apiProducts": ["Claude Core Product", "DeepSeek Core Product"]
    }
  ];

  var resultChangesUser = checkAppCredentials(inputObjUser, originalAppUser);
  assert.deepStrictEqual(resultChangesUser, expectedChangesUser, 'Should detect DeepSeek Core Product as ADDED with apiProducts array');

  // Test Case 13: Validate removed product
  var inputObjRemoved = {
    "credentials": [
      {
        "clientId": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
        "products": []
      }
    ]
  };

  var expectedChangesRemoved = [
    {
      "clientId": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
      "consumerKey": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
      "apiproduct": "Claude Core Product",
      "apiProduct": "Claude Core Product",
      "operationName": "REMOVED",
      "apiProducts": []
    }
  ];

  var resultChangesRemoved = checkAppCredentials(inputObjRemoved, originalAppUser);
  assert.deepStrictEqual(resultChangesRemoved, expectedChangesRemoved, 'Should detect Claude Core Product as REMOVED');

  // Test Case 14: Validate no-op when credentials match perfectly
  var inputObjNoOp = {
    "credentials": [
      {
        "clientId": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
        "products": ["Claude Core Product"]
      }
    ]
  };

  var resultChangesNoOp = checkAppCredentials(inputObjNoOp, originalAppUser);
  assert.deepStrictEqual(resultChangesNoOp, [], 'Should detect no changes when products match perfectly');

  // Test Case 15: Validate null/empty handling
  assert.deepStrictEqual(checkAppCredentials(null, null), [], 'Should return empty array for null input');

  console.log('\x1b[32m%s\x1b[0m', '✔ All unit tests passed successfully!');
} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', '✖ Unit tests failed:');
  console.error(err);
  process.exit(1);
}

