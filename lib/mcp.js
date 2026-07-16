/**
 * Model Context Protocol (MCP) ES5 Library
 * Provides handlers for various MCP standard requests.
 */

var mockCatalog = [
  {
    name: "Qwen admin_ Product",
    displayName: "Qwen admin_ Product",
    description: "Access to Qwen family models including qwen3-next-80b-a3b-thinking-maas for advanced multilingual generation.",
    approvalType: "auto"
  },
  {
    name: "DeepSeek admin_ Product",
    displayName: "DeepSeek admin_ Product",
    description: "Provides low-latency access to DeepSeek models (e.g. deepseek-v3.2-maas).",
    approvalType: "auto"
  },
  {
    name: "Claude admin_ Product",
    displayName: "Claude admin_ Product",
    description: "Claude developer access product supporting advanced Claude models.",
    approvalType: "auto"
  },
  {
    name: "Gemini Core Product",
    displayName: "Gemini Core Product",
    description: "Developer access to Gemini models including multimodal capabilities.",
    approvalType: "auto"
  }
];

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
        name: "getCatalog",
        description: "Retrieves the list of available API products in the catalog.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "integer",
              description: "Optional limit on the number of products returned."
            }
          }
        }
      },
      {
        name: "searchCatalog",
        description: "Searches the catalog of API products for matches against the search query.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search term or keyword to match against product name or description."
            }
          },
          required: ["query"]
        }
      },
      {
        name: "subscribe",
        description: "Subscribes a developer's application to a specific API product.",
        inputSchema: {
          type: "object",
          properties: {
            developerEmail: {
              type: "string",
              description: "The email of the developer owning the app."
            },
            appName: {
              type: "string",
              description: "The name of the developer application."
            },
            apiProduct: {
              type: "string",
              description: "The name of the API product to subscribe to."
            }
          },
          required: ["developerEmail", "appName", "apiProduct"]
        }
      },
      {
        name: "unsubscribe",
        description: "Unsubscribes a developer's application from a specific API product.",
        inputSchema: {
          type: "object",
          properties: {
            developerEmail: {
              type: "string",
              description: "The email of the developer owning the app."
            },
            appName: {
              type: "string",
              description: "The name of the developer application."
            },
            apiProduct: {
              type: "string",
              description: "The name of the API product to unsubscribe from."
            }
          },
          required: ["developerEmail", "appName", "apiProduct"]
        }
      }
    ],
  };
}

/**
 * Executes a specific tool by name.
 */
function callTool(name, args) {
  if (name === "getCatalog") {
    var limit = args && args.limit ? parseInt(args.limit, 10) : undefined;
    var products = mockCatalog;
    if (limit && limit > 0) {
      products = mockCatalog.slice(0, limit);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(products),
        },
      ],
    };
  }

  if (name === "searchCatalog") {
    if (!args || typeof args.query !== "string") {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: The 'query' argument is required.",
          },
        ],
      };
    }
    var query = args.query.toLowerCase();
    var results = [];
    for (var i = 0; i < mockCatalog.length; i++) {
      var prod = mockCatalog[i];
      if (
        prod.name.toLowerCase().indexOf(query) !== -1 ||
        prod.displayName.toLowerCase().indexOf(query) !== -1 ||
        (prod.description && prod.description.toLowerCase().indexOf(query) !== -1)
      ) {
        results.push(prod);
      }
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(results),
        },
      ],
    };
  }

  if (name === "subscribe") {
    if (!args || !args.developerEmail || !args.appName || !args.apiProduct) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: 'developerEmail', 'appName', and 'apiProduct' are all required.",
          },
        ],
      };
    }
    var response = {
      success: true,
      message: "Successfully subscribed application '" + args.appName + "' of '" + args.developerEmail + "' to API product '" + args.apiProduct + "'.",
      subscription: {
        appName: args.appName,
        developerEmail: args.developerEmail,
        apiProduct: args.apiProduct,
        status: "approved",
        createdAt: new Date().toISOString(),
      },
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response),
        },
      ],
    };
  }

  if (name === "unsubscribe") {
    if (!args || !args.developerEmail || !args.appName || !args.apiProduct) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: 'developerEmail', 'appName', and 'apiProduct' are all required.",
          },
        ],
      };
    }
    var response = {
      success: true,
      message: "Successfully unsubscribed application '" + args.appName + "' of '" + args.developerEmail + "' from API product '" + args.apiProduct + "'.",
      unsubscribed: {
        appName: args.appName,
        developerEmail: args.developerEmail,
        apiProduct: args.apiProduct,
        status: "removed",
        unsubscribedAt: new Date().toISOString(),
      },
    };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response),
        },
      ],
    };
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
