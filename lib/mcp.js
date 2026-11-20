/**
 * Model Context Protocol (MCP) ES5 Library
 * Provides handlers for MCP standard requests with live Apigee/API Hub support
 * and mockCatalog fallback for offline unit tests.
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
      version: "1.1.0",
    },
  };
}

function toolsList() {
  return {
    tools: [
      {
        name: "getCatalog",
        description: "Retrieves the list of available API products in the API Hub / Apigee catalog.",
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
        description: "Searches the API Hub / Apigee catalog for APIs matching the search query.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search term or keyword to match against API name, description, tags, or style."
            }
          },
          required: ["query"]
        }
      },
      {
        name: "getApps",
        description: "Lists the authenticated developer's applications, subscribed API products, and credentials.",
        inputSchema: {
          type: "object",
          properties: {
            appName: {
              type: "string",
              description: "Optional application name to filter by."
            }
          }
        }
      },
      {
        name: "getCredentials",
        description: "Retrieves API credentials (clientId and clientSecret) for the authenticated developer's applications.",
        inputSchema: {
          type: "object",
          properties: {
            appName: {
              type: "string",
              description: "Optional application name to retrieve credentials for."
            },
            apiProduct: {
              type: "string",
              description: "Optional API product name to filter credentials by."
            }
          }
        }
      },
      {
        name: "createApp",
        description: "Creates a new developer application and optionally subscribes it to an API product, returning new credentials.",
        inputSchema: {
          type: "object",
          properties: {
            appName: {
              type: "string",
              description: "Name of the new developer application."
            },
            description: {
              type: "string",
              description: "Optional description of the application."
            },
            apiProduct: {
              type: "string",
              description: "Optional API product name to subscribe the new app to."
            }
          },
          required: ["appName"]
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
              description: "Optional email of the developer (defaults to authenticated user)."
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
          required: ["appName", "apiProduct"]
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
              description: "Optional email of the developer (defaults to authenticated user)."
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
          required: ["appName", "apiProduct"]
        }
      }
    ],
  };
}

function formatLiveCatalog(liveContext) {
  if (!liveContext || !liveContext.apis || !Array.isArray(liveContext.apis.apis)) {
    return null;
  }
  var apigeeProducts = (liveContext.products && Array.isArray(liveContext.products.apiProduct))
    ? liveContext.products.apiProduct
    : [];

  var items = [];
  for (var i = 0; i < liveContext.apis.apis.length; i++) {
    var api = liveContext.apis.apis[i];
    if (!api) continue;
    var displayName = api.displayName || (api.name ? api.name.split("/").pop() : "");
    var id = api.name ? api.name.split("/").pop() : displayName;
    var packages = [];
    for (var p = 0; p < apigeeProducts.length; p++) {
      var prod = apigeeProducts[p];
      if (!prod) continue;
      var matched = false;
      var groups = [prod.operationGroup, prod.llmOperationGroup, prod.payloadOperationGroup];
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g];
        if (grp && Array.isArray(grp.operationConfigs)) {
          for (var c = 0; c < grp.operationConfigs.length; c++) {
            if (grp.operationConfigs[c] && grp.operationConfigs[c].apiSource === displayName) {
              matched = true;
              break;
            }
          }
        }
        if (matched) break;
      }
      if (matched) {
        packages.push(prod.name);
      }
    }
    items.push({
      id: id,
      name: displayName,
      displayName: displayName,
      description: api.description || "",
      apiProducts: packages
    });
  }
  return items;
}

function formatApigeeApps(appsData) {
  var list = [];
  if (appsData && Array.isArray(appsData.app)) {
    list = appsData.app;
  } else if (appsData && appsData.name && appsData.appId) {
    list = [appsData];
  }
  return list.map(function (a) {
    var creds = (a.credentials || []).map(function (c) {
      var prods = (c.apiProducts || []).map(function (p) { return p.apiproduct; }).filter(Boolean);
      return {
        clientId: c.consumerKey || "",
        clientSecret: c.consumerSecret || "",
        status: c.status || "",
        apiProducts: prods
      };
    });
    return {
      id: a.appId || "",
      name: a.name || "",
      status: a.status || "",
      credentials: creds
    };
  });
}

/**
 * Executes a specific tool by name.
 */
function callTool(name, args, liveContext) {
  args = args || {};

  if (name === "getCatalog") {
    var limit = args.limit ? parseInt(args.limit, 10) : undefined;
    var liveItems = formatLiveCatalog(liveContext);
    var products = liveItems !== null ? liveItems : mockCatalog;
    if (limit && limit > 0) {
      products = products.slice(0, limit);
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
    if (typeof args.query !== "string" || !args.query) {
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
    var liveItems = formatLiveCatalog(liveContext);
    var sourceList = liveItems !== null ? liveItems : mockCatalog;
    var results = [];
    for (var i = 0; i < sourceList.length; i++) {
      var prod = sourceList[i];
      var matchName = prod.name && prod.name.toLowerCase().indexOf(query) !== -1;
      var matchDisplay = prod.displayName && prod.displayName.toLowerCase().indexOf(query) !== -1;
      var matchDesc = prod.description && prod.description.toLowerCase().indexOf(query) !== -1;
      var matchPkg = prod.apiProducts && prod.apiProducts.join(" ").toLowerCase().indexOf(query) !== -1;
      if (matchName || matchDisplay || matchDesc || matchPkg) {
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

  if (name === "getApps" || name === "getCredentials") {
    var apps = liveContext && liveContext.apps ? formatApigeeApps(liveContext.apps) : [];
    if (args.appName) {
      var targetApp = args.appName.toLowerCase();
      apps = apps.filter(function (a) {
        return a.name && a.name.toLowerCase() === targetApp;
      });
    }
    if (name === "getCredentials" && args.apiProduct) {
      var targetProd = args.apiProduct.toLowerCase();
      apps = apps.filter(function (a) {
        return a.credentials.some(function (c) {
          return c.apiProducts.some(function (p) {
            return p.toLowerCase() === targetProd;
          });
        });
      });
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(apps),
        },
      ],
    };
  }

  if (name === "createApp") {
    if (!args.appName) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: 'appName' is required." }],
      };
    }
    if (liveContext && liveContext.error) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error creating app: " + liveContext.error }],
      };
    }
    var created = liveContext && liveContext.createdApp
      ? formatApigeeApps(liveContext.createdApp)[0]
      : { name: args.appName, status: "approved", credentials: [] };
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ success: true, app: created }),
        },
      ],
    };
  }

  if (name === "subscribe") {
    if (!args.appName || !args.apiProduct) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: 'appName' and 'apiProduct' are required.",
          },
        ],
      };
    }
    if (liveContext && liveContext.error) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error subscribing: " + liveContext.error }],
      };
    }
    var email = (liveContext && liveContext.developerEmail) || args.developerEmail || "";
    var response = {
      success: true,
      message: "Successfully subscribed application '" + args.appName + "' of '" + email + "' to API product '" + args.apiProduct + "'.",
      subscription: {
        appName: args.appName,
        developerEmail: email,
        apiProduct: args.apiProduct,
        status: "approved",
        updatedAt: new Date().toISOString(),
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
    if (!args.appName || !args.apiProduct) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: "Error: 'appName' and 'apiProduct' are required.",
          },
        ],
      };
    }
    if (liveContext && liveContext.error) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error unsubscribing: " + liveContext.error }],
      };
    }
    var email = (liveContext && liveContext.developerEmail) || args.developerEmail || "";
    var response = {
      success: true,
      message: "Successfully unsubscribed application '" + args.appName + "' of '" + email + "' from API product '" + args.apiProduct + "'.",
      unsubscribed: {
        appName: args.appName,
        developerEmail: email,
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
