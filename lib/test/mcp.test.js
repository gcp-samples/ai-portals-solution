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
  assert.strictEqual(initResult.serverInfo.name, 'apigee-mcp-server', 'Server name should match');

  // Test Case 2: toolsList
  var toolsResult = toolsList();
  assert.ok(toolsResult, 'Tools list should be defined');
  assert.ok(Array.isArray(toolsResult.tools), 'Tools should be an array');
  assert.strictEqual(toolsResult.tools.length, 1, 'Should expose exactly 1 tool');
  assert.strictEqual(toolsResult.tools[0].name, 'checkAppCredentials', 'Exposed tool name should match');

  // Test Case 3: callTool - valid execution of checkAppCredentials
  var inputObjUser = {
    "credentials": [
      {
        "clientId": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S",
        "clientSecret": "GxrXEZw940JVjwbELKlLOaH0MSUK1uGAPQ62AUYDs87KiKGkhd1miA3DCWFbyT9q",
        "products": ["Claude Core Product", "DeepSeek Core Product"]
      }
    ]
  };

  var originalAppUser = {
    "credentials": [
      {
        "apiProducts": [
          { "apiproduct": "Claude Core Product", "status": "approved" }
        ],
        "consumerKey": "fl877Uimj0UZ2QVpefE3sIDTaLmVa9cGgrNj1GkNMimC2L8S"
      }
    ]
  };

  var callResult = callTool('checkAppCredentials', {
    inputApp: inputObjUser,
    originalApp: originalAppUser
  });

  assert.ok(callResult, 'Call result should be defined');
  assert.ok(!callResult.isError, 'Call should not return error');
  assert.ok(Array.isArray(callResult.content), 'Content should be an array');
  assert.strictEqual(callResult.content[0].type, 'text', 'Content type should be text');
  
  var parsedContent = JSON.parse(callResult.content[0].text);
  assert.strictEqual(parsedContent.length, 1, 'Changes list length should match');
  assert.strictEqual(parsedContent[0].operationName, 'ADDED', 'Operation should be ADDED');
  assert.strictEqual(parsedContent[0].apiproduct, 'DeepSeek Core Product', 'Product should be DeepSeek');

  // Test Case 4: callTool - missing parameters
  var callResultMissing = callTool('checkAppCredentials', {});
  assert.ok(callResultMissing, 'Result should be defined');
  assert.strictEqual(callResultMissing.isError, true, 'Should flag error for missing parameters');

  // Test Case 5: callTool - unknown tool
  var callResultUnknown = callTool('unknownTool', {});
  assert.ok(callResultUnknown, 'Result should be defined');
  assert.strictEqual(callResultUnknown.isError, true, 'Should flag error for unknown tool');

  console.log('\x1b[32m%s\x1b[0m', '✔ All mcp.js unit tests passed successfully!');
} catch (err) {
  console.error('\x1b[31m%s\x1b[0m', '✖ MCP unit tests failed:');
  console.error(err);
  process.exit(1);
}
