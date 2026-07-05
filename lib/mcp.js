/**
 * Model Context Protocol (MCP) ES5 Library
 * Provides handlers for various MCP standard requests.
 */

function initialize(request) {
  return {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: "portals-mcp-server",
      version: "1.0.0",
    },
  };
}

function toolsList() {
  return {
    tools: [
      {
        name: "checkAppCredentials",
        description:
          "Compares client credentials between an updated input app and the original Apigee app data to identify added and removed API products.",
        inputSchema: {
          type: "object",
          properties: {
            inputApp: {
              type: "object",
              description: "The application object containing updated/modified credentials.",
            },
            originalApp: {
              type: "object",
              description: "The original Apigee application object containing current credentials.",
            },
          },
          required: ["inputApp", "originalApp"],
        },
      },
    ],
  };
}

/**
 * Executes a specific tool by name.
 */
function callTool(name, args) {
  if (name === "checkAppCredentials") {
    if (!args || !args.inputApp || !args.originalApp) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: Both 'inputApp' and 'originalApp' arguments are required.",
          },
        ],
      };
    }

    // Assuming checkAppCredentials from transformations.js is loaded in the same environment
    if (typeof checkAppCredentials !== "function") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: checkAppCredentials library function is not loaded.",
          },
        ],
      };
    }

    try {
      var result = checkAppCredentials(args.inputApp, args.originalApp);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error executing checkAppCredentials: " + e.message,
          },
        ],
      };
    }
  }

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: "Error: Tool '" + name + "' not found.",
      },
    ],
  };
}
