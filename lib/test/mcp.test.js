var fs = require('fs');
var path = require('path');
var assert = require('assert');

// Load transformations.js and mcp.js into global context
var transformationsCode = fs.readFileSync(path.join(__dirname, '../transformations.js'), 'utf8');
eval(transformationsCode);

var mcpCode = fs.readFileSync(path.join(__dirname, '../mcp.js'), 'utf8');
eval(mcpCode);

console.log('Running mcp.js unit tests...');

try {
  // Test Case 1: initialize
  var initResult = initialize({});
  assert.ok(initResult, 'Initialize result should be defined');
  assert.strictEqual(initResult.protocolVersion, '2024-11-05', 'Protocol version should match');
  assert.ok(initResult.capabilities, 'Capabilities should exist');
  assert.strictEqual(initResult.serverInfo.name, 'portals-mcp-server', 'Server name should match');

  // Test Case 2: toolsList
  var toolsResult = toolsList();
  assert.ok(toolsResult, 'Tools list should be defined');
  assert.ok(Array.isArray(toolsResult.tools), 'Tools should be an array');
  assert.strictEqual(toolsResult.tools.length, 4, 'Should expose exactly 4 tools');
  
  var toolNames = toolsResult.tools.map(function(t) { return t.name; });
  assert.ok(toolNames.indexOf('getCatalog') !== -1, 'Should include getCatalog');
  assert.ok(toolNames.indexOf('searchCatalog') !== -1, 'Should include searchCatalog');
  assert.ok(toolNames.indexOf('subscribe') !== -1, 'Should include subscribe');
  assert.ok(toolNames.indexOf('unsubscribe') !== -1, 'Should include unsubscribe');
  assert.strictEqual(toolNames.indexOf('checkAppCredentials'), -1, 'Should NOT include checkAppCredentials');

  // Test Case 3: callTool - getCatalog
  var catResult = callTool('getCatalog', {});
  assert.ok(catResult, 'Get catalog result should be defined');
  assert.ok(!catResult.isError, 'Get catalog should not error');
  var catProducts = JSON.parse(catResult.content[0].text);
  assert.strictEqual(catProducts.length, 4, 'Should return 4 products in mockCatalog');

  // Test Case 4: callTool - getCatalog with limit
  var catLimitedResult = callTool('getCatalog', { limit: 2 });
  assert.ok(catLimitedResult, 'Get catalog limited result should be defined');
  assert.ok(!catLimitedResult.isError, 'Get catalog limited should not error');
  var catLimitedProducts = JSON.parse(catLimitedResult.content[0].text);
  assert.strictEqual(catLimitedProducts.length, 2, 'Should return exactly 2 products');

  // Test Case 5: callTool - searchCatalog with match
  var searchResult = callTool('searchCatalog', { query: 'Claude' });
  assert.ok(searchResult, 'Search result should be defined');
  assert.ok(!searchResult.isError, 'Search should not error');
  var searchProducts = JSON.parse(searchResult.content[0].text);
  assert.strictEqual(searchProducts.length, 1, 'Should return exactly 1 product matching Claude');
  assert.strictEqual(searchProducts[0].name, 'Claude admin_ Product', 'Product name should match');

  // Test Case 6: callTool - searchCatalog with no match
  var searchNoMatchResult = callTool('searchCatalog', { query: 'NonexistentProduct' });
  assert.ok(searchNoMatchResult, 'Search no match result should be defined');
  assert.ok(!searchNoMatchResult.isError, 'Search no match should not error');
  var noMatchProducts = JSON.parse(searchNoMatchResult.content[0].text);
  assert.strictEqual(noMatchProducts.length, 0, 'Should return 0 products');

  // Test Case 7: callTool - searchCatalog with missing query
  var searchMissingResult = callTool('searchCatalog', {});
  assert.ok(searchMissingResult, 'Search missing query result should be defined');
  assert.strictEqual(searchMissingResult.isError, true, 'Search missing query should error');

  // Test Case 8: callTool - subscribe with valid parameters
  var subResult = callTool('subscribe', {
    developerEmail: 'dev@example.com',
    appName: 'my-ai-app',
    apiProduct: 'Gemini Core Product'
  });
  assert.ok(subResult, 'Subscribe result should be defined');
  assert.ok(!subResult.isError, 'Subscribe should not error');
  var subData = JSON.parse(subResult.content[0].text);
  assert.strictEqual(subData.success, true, 'Subscribe success should be true');
  assert.strictEqual(subData.subscription.appName, 'my-ai-app', 'App name should match');
  assert.strictEqual(subData.subscription.apiProduct, 'Gemini Core Product', 'Product name should match');

  // Test Case 9: callTool - subscribe with missing parameters
  var subMissingResult = callTool('subscribe', {
    developerEmail: 'dev@example.com'
  });
  assert.ok(subMissingResult, 'Subscribe missing result should be defined');
  assert.strictEqual(subMissingResult.isError, true, 'Subscribe missing parameter should error');

  // Test Case 10: callTool - unsubscribe with valid parameters
  var unsubResult = callTool('unsubscribe', {
    developerEmail: 'dev@example.com',
    appName: 'my-ai-app',
    apiProduct: 'Gemini Core Product'
  });
  assert.ok(unsubResult, 'Unsubscribe result should be defined');
  assert.ok(!unsubResult.isError, 'Unsubscribe should not error');
  var unsubData = JSON.parse(unsubResult.content[0].text);
  assert.strictEqual(unsubData.success, true, 'Unsubscribe success should be true');
  assert.strictEqual(unsubData.unsubscribed.appName, 'my-ai-app', 'App name should match');
  assert.strictEqual(unsubData.unsubscribed.apiProduct, 'Gemini Core Product', 'Product name should match');

  // Test Case 11: callTool - unsubscribe with missing parameters
  var unsubMissingResult = callTool('unsubscribe', {
    developerEmail: 'dev@example.com'
  });
  assert.ok(unsubMissingResult, 'Unsubscribe missing result should be defined');
  assert.strictEqual(unsubMissingResult.isError, true, 'Unsubscribe missing parameter should error');

  // Test Case 12: callTool - unknown tool
  var callResultUnknown = callTool('unknownTool', {});
  assert.ok(callResultUnknown, 'Result should be defined');
  assert.strictEqual(callResultUnknown.isError, true, 'Should flag error for unknown tool');

  console.log('\x1b[32m%s\x1b[0m', '✔ All mcp.js unit tests passed successfully!');
} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', '✖ MCP unit tests failed:');
  console.error(err);
  process.exit(1);
}
