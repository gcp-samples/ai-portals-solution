function transformApisToProducts(input, apigeeProducts) {
  if (!input || !Array.isArray(input.apis)) {
    return { products: [] };
  }

  var products = input.apis.map(function (api) {
    // 1. Map ID from name (extract the last part of the path)
    var id = api.name ? api.name.split("/").pop() : "";

    // 2. Extract displayName
    var displayName = api.displayName || "";

    // 3. Extract versions and sourceId (version resource name)
    var versions = api.versions || [];
    var sourceId = (versions && versions.length > 0) ? versions[0] : "";

    // 4. Extract createTime
    var createTime = api.createTime || "";

    // 5. Extract updateTime
    var updateTime = api.updateTime || "";

    // 6. Extract targetUser (just the displayName value)
    var targetUser = null;
    if (
      api.targetUser &&
      api.targetUser.enumValues &&
      api.targetUser.enumValues.values &&
      api.targetUser.enumValues.values[0]
    ) {
      targetUser = api.targetUser.enumValues.values[0].displayName || null;
    }

    // 7. Extract categories, tags, and api-style from attributes
    var categories = [];
    var tags = [];
    var displayStyle = "REST"; // default fallback style

    // First-class system property check for apiStyle (or snake_case api_style) from API Hub
    var systemStyleObj = api.apiStyle || api.api_style;
    if (
      systemStyleObj &&
      systemStyleObj.enumValues &&
      systemStyleObj.enumValues.values &&
      systemStyleObj.enumValues.values[0]
    ) {
      displayStyle = systemStyleObj.enumValues.values[0].displayName || systemStyleObj.enumValues.values[0].id || displayStyle;
    }

    if (api.attributes) {
      var keys = Object.keys(api.attributes);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var attr = api.attributes[key];
        if (key.slice(-9) === "/category") {
          var vals = (attr && attr.enumValues && attr.enumValues.values) || [];
          categories = vals
            .map(function (v) {
              return v.displayName;
            })
            .filter(Boolean);
        } else if (key.slice(-5) === "/tags") {
          tags = (attr && attr.stringValues && attr.stringValues.values) || [];
        } else if (key.slice(-10) === "/api-style" || key.slice(-10) === "/api_style" || key.slice(-6) === "/style") {
          // Extract style from enum values
          if (attr && attr.enumValues && attr.enumValues.values && attr.enumValues.values.length > 0) {
            displayStyle = attr.enumValues.values[0].displayName || attr.enumValues.values[0].id || displayStyle;
          }
          // Extract style from string values
          else if (attr && attr.stringValues && attr.stringValues.values && attr.stringValues.values.length > 0) {
            displayStyle = attr.stringValues.values[0] || displayStyle;
          }
        }
      }
    }

    // 8. Find matching packages (Apigee API Products)
    var packages = [];
    var apigeeProductsList = (apigeeProducts && Array.isArray(apigeeProducts.apiProduct)) ? apigeeProducts.apiProduct : [];

    for (var p = 0; p < apigeeProductsList.length; p++) {
      var prod = apigeeProductsList[p];
      var isMatched = false;
      var matchingConfigs = [];

      // Check operationConfigs in operationGroup
      if (prod.operationGroup && Array.isArray(prod.operationGroup.operationConfigs)) {
        var opConfigs = prod.operationGroup.operationConfigs;
        for (var o = 0; o < opConfigs.length; o++) {
          if (opConfigs[o] && opConfigs[o].apiSource === displayName) {
            isMatched = true;
            matchingConfigs.push(opConfigs[o]);
          }
        }
      }

      // Check operationConfigs in llmOperationGroup
      if (prod.llmOperationGroup && Array.isArray(prod.llmOperationGroup.operationConfigs)) {
        var llmConfigs = prod.llmOperationGroup.operationConfigs;
        for (var l = 0; l < llmConfigs.length; l++) {
          if (llmConfigs[l] && llmConfigs[l].apiSource === displayName) {
            isMatched = true;
            matchingConfigs.push(llmConfigs[l]);
          }
        }
      }

      // Check operationConfigs in payloadOperationGroup
      if (prod.payloadOperationGroup && Array.isArray(prod.payloadOperationGroup.operationConfigs)) {
        var payloadConfigs = prod.payloadOperationGroup.operationConfigs;
        for (var l = 0; l < payloadConfigs.length; l++) {
          if (payloadConfigs[l] && payloadConfigs[l].apiSource === displayName) {
            isMatched = true;
            matchingConfigs.push(payloadConfigs[l]);
          }
        }
      }

      if (isMatched) {
        var tokenLimits = [];
        var callLimits = [];

        for (var m = 0; m < matchingConfigs.length; m++) {
          var config = matchingConfigs[m];

          // Map normal 'quota' if it exists and has a limit
          if (config.quota && typeof config.quota === 'object' && config.quota.limit) {
            callLimits.push({
              callLimit: Number(config.quota.limit) || 0,
              type: "USER"
            });
          }

          // Map 'llmTokenQuota' if it exists and has a limit
          if (config.llmTokenQuota && typeof config.llmTokenQuota === 'object' && config.llmTokenQuota.limit) {
            var modelName = "";
            if (Array.isArray(config.llmOperations) && config.llmOperations.length > 0 && config.llmOperations[0]) {
              modelName = config.llmOperations[0].model || "";
            }
            tokenLimits.push({
              modelName: modelName,
              tokenLimit: Number(config.llmTokenQuota.limit) || 0,
              type: "USER"
            });
          }
        }

        // Support root-level quota mapping if we have matching config but no config-level quota/tokenLimit was added
        if (tokenLimits.length === 0 && prod.llmQuota) {
          var rootModelName = "";
          if (prod.llmOperationGroup && Array.isArray(prod.llmOperationGroup.operationConfigs)) {
            var rConfigs = prod.llmOperationGroup.operationConfigs;
            for (var rc = 0; rc < rConfigs.length; rc++) {
              if (rConfigs[rc] && Array.isArray(rConfigs[rc].llmOperations) && rConfigs[rc].llmOperations.length > 0 && rConfigs[rc].llmOperations[0]) {
                rootModelName = rConfigs[rc].llmOperations[0].model || "";
                break;
              }
            }
          }
          tokenLimits.push({
            modelName: rootModelName,
            tokenLimit: Number(prod.llmQuota) || 0,
            type: "USER"
          });
        }

        if (callLimits.length === 0 && prod.quota && typeof prod.quota === 'object' && prod.quota.limit) {
          callLimits.push({
            callLimit: Number(prod.quota.limit) || 0,
            type: "USER"
          });
        } else if (callLimits.length === 0 && prod.quota && (typeof prod.quota === 'string' || typeof prod.quota === 'number')) {
          callLimits.push({
            callLimit: Number(prod.quota) || 0,
            type: "USER"
          });
        }

        packages.push({
          packageId: prod.name || "",
          requestTokenPricePerMillion: 0.0,
          responseTokenPricePerMillion: 0.0,
          requestCallPricePerThousand: 0.0,
          responseCallPricePerThousand: 0.0,
          tokenLimits: tokenLimits,
          callLimits: callLimits
        });
      }
    }

    return {
      id: id,
      displayName: displayName,
      displayStyle: displayStyle,
      sourceId: sourceId,
      versions: versions,
      createTime: createTime,
      updateTime: updateTime,
      targetUser: targetUser,
      categories: categories,
      tags: tags,
      packages: packages,
    };
  }).filter(function (p) {
    return p.packages && p.packages.length > 0;
  });

  return { products: products };
}

function transformApp(app) {
  if (!app) {
    return null;
  }

  // 1. Map ID from appId
  var id = app.appId || "";

  // 2. Map name from name
  var name = app.name || "";

  // 3. Extract description from attributes (find attribute with name "description")
  var description = "";
  if (app.attributes && Array.isArray(app.attributes)) {
    for (var i = 0; i < app.attributes.length; i++) {
      var attr = app.attributes[i];
      if (attr && attr.name === "description") {
        description = attr.value || "";
        break;
      }
    }
  }

  // 4. Map credentials
  var credentials = [];
  if (app.credentials && Array.isArray(app.credentials)) {
    credentials = app.credentials.map(function (cred) {
      var clientId = cred.consumerKey || "";
      var clientSecret = cred.consumerSecret || "";

      var products = [];
      if (cred.apiProducts && Array.isArray(cred.apiProducts)) {
        products = cred.apiProducts
          .map(function (prod) {
            return prod.apiproduct || "";
          })
          .filter(Boolean);
      }

      return {
        clientId: clientId,
        clientSecret: clientSecret,
        products: products,
      };
    });
  }

  return {
    credentials: credentials,
    description: description,
    id: id,
    name: name,
  };
}

function transformApps(input) {
  if (!input || !Array.isArray(input.app)) {
    return { apps: [] };
  }

  var apps = input.app.map(function (app) {
    return transformApp(app);
  }).filter(Boolean);

  return { apps: apps };
}

function transformAppToApigee(app) {
  if (!app) {
    return {
      name: "",
      apiProducts: [],
      attributes: []
    };
  }

  var name = app.name || "";
  var apiProducts = [];

  if (app.credentials && Array.isArray(app.credentials)) {
    for (var i = 0; i < app.credentials.length; i++) {
      var cred = app.credentials[i];
      if (cred && cred.products && Array.isArray(cred.products)) {
        for (var j = 0; j < cred.products.length; j++) {
          var prod = cred.products[j];
          if (prod && apiProducts.indexOf(prod) === -1) {
            apiProducts.push(prod);
          }
        }
      }
    }
  }

  var attributes = [];
  if (app.description) {
    attributes.push({
      name: "description",
      value: app.description
    });
  }

  return {
    name: name,
    apiProducts: apiProducts,
    attributes: attributes
  };
}

function getApigeeTimeRange() {
  var now = new Date();

  // Create a date object set to exactly 3 months ago
  var threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  // Helper function to pad single digits with a leading zero (ES5 alternative to padStart)
  function pad(num) {
    return (num < 10 ? "0" : "") + num;
  }

  // Helper function to format the date to MM/DD/YYYY HH:mm
  function formatDate(date) {
    var month = pad(date.getMonth() + 1); // Months are 0-indexed
    var day = pad(date.getDate());
    var year = date.getFullYear();
    var hours = pad(date.getHours());
    var minutes = pad(date.getMinutes());

    return month + "/" + day + "/" + year + " " + hours + ":" + minutes;
  }

  // Combine both dates with the tilde separator
  var rawRange = formatDate(threeMonthsAgo) + "~" + formatDate(now);

  // URL-encode the string. encodeURIComponent leaves '~' unescaped naturally,
  // matching your Apigee URL format perfectly.
  return encodeURIComponent(rawRange);
}

function checkAppCredentials(inputApp, originalApp) {
  var changes = [];

  if (!inputApp || !originalApp) {
    return changes;
  }

  var inputCreds = inputApp.credentials || [];
  var originalCreds = originalApp.credentials || [];

  for (var i = 0; i < inputCreds.length; i++) {
    var inputCred = inputCreds[i];
    if (!inputCred || !inputCred.clientId) {
      continue;
    }

    var clientId = inputCred.clientId;

    // Find matching original credential
    var originalCred = null;
    for (var j = 0; j < originalCreds.length; j++) {
      if (originalCreds[j] && originalCreds[j].consumerKey === clientId) {
        originalCred = originalCreds[j];
        break;
      }
    }

    if (!originalCred) {
      continue;
    }

    var inputProducts = inputCred.products || [];
    var originalApiProducts = originalCred.apiProducts || [];

    // Extract list of original product names
    var originalProductNames = [];
    for (var k = 0; k < originalApiProducts.length; k++) {
      var prod = originalApiProducts[k];
      if (prod && prod.apiproduct) {
        originalProductNames.push(prod.apiproduct);
      }
    }

    // Check for ADDED apiProducts
    for (var p = 0; p < inputProducts.length; p++) {
      var inputProd = inputProducts[p];
      if (inputProd && originalProductNames.indexOf(inputProd) === -1) {
        changes.push({
          clientId: clientId,
          consumerKey: clientId,
          apiproduct: inputProd,
          apiProduct: inputProd,
          operationName: "ADDED",
          apiProducts: inputProducts
        });
      }
    }

    // Check for REMOVED apiProducts
    for (var r = 0; r < originalProductNames.length; r++) {
      var origProd = originalProductNames[r];
      if (origProd && inputProducts.indexOf(origProd) === -1) {
        changes.push({
          clientId: clientId,
          consumerKey: clientId,
          apiproduct: origProd,
          apiProduct: origProd,
          operationName: "REMOVED",
          apiProducts: inputProducts
        });
      }
    }
  }
  return changes;
}

function decodeBase64(str) {
  if (!str) return "";
  // Check if it's not base64 (e.g. contains spaces, newlines, or YAML delimiters like ': ')
  if (/\s/.test(str) || str.indexOf(": ") !== -1) {
    return str;
  }
  try {
    var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var output = '';
    str = String(str).replace(/=+$/, '');
    if (str.length % 4 === 1) {
      return str;
    }
    for (
      var bc = 0, bs, buffer, idx = 0;
      (buffer = str.charAt(idx++));
      ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer),
        bc++ % 4) ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)))) : 0
    ) {
      buffer = chars.indexOf(buffer);
    }
    return output;
  } catch (e) {
    return str;
  }
}

function transformProductDetail(deploymentData, versionData, productKey, mockProducts) {
  var result = {
    id: productKey || "",
    endpoint: "",
    spec: null,
    displayStyle: ""
  };

  // Find the product in mockProducts to get its displayStyle and other details
  var product = null;
  if (mockProducts && Array.isArray(mockProducts.products)) {
    for (var i = 0; i < mockProducts.products.length; i++) {
      var p = mockProducts.products[i];
      if (p && (p.id === productKey || p.productId === productKey)) {
        product = p;
        break;
      }
    }
  }

  if (product) {
    result.displayStyle = product.displayStyle || "";
  }

  // 1. Extract endpoint URL from deploymentData
  if (deploymentData) {
    var deployments = [];
    if (Array.isArray(deploymentData.deployments)) {
      deployments = deploymentData.deployments;
    } else if (Array.isArray(deploymentData)) {
      deployments = deploymentData;
    } else {
      deployments = [deploymentData];
    }

    var targetVersion = product ? product.sourceId : "";

    for (var d = 0; d < deployments.length; d++) {
      var dep = deployments[d];
      if (!dep) continue;

      // If we have a list, verify it matches our product's version
      var match = true;
      if (targetVersion && dep.apiVersions && Array.isArray(dep.apiVersions)) {
        match = false;
        for (var av = 0; av < dep.apiVersions.length; av++) {
          if (dep.apiVersions[av] === targetVersion) {
            match = true;
            break;
          }
        }
      }

      if (match) {
        var endpoints = dep.endpoints || [];
        if (Array.isArray(endpoints) && endpoints.length > 0) {
          var ep = endpoints[0];
          if (typeof ep === 'string') {
            result.endpoint = ep;
          } else if (ep && typeof ep === 'object' && ep.uri) {
            result.endpoint = ep.uri;
          }
        } else if (dep.resourceUri) {
          result.endpoint = dep.resourceUri;
        } else if (dep.deploymentUri) {
          result.endpoint = dep.deploymentUri;
        }
        if (result.endpoint) {
          break;
        }
      }
    }
  }

  // Fallback to product endpoint if not found in deploymentData
  if (!result.endpoint && product && product.endpoints && product.endpoints.length > 0) {
    result.endpoint = product.endpoints[0];
  }

  // 2. Extract spec content or MCP schema data from versionData
  if (versionData) {
    var rawSpec = null;
    if (typeof versionData === 'string') {
      rawSpec = versionData;
    } else if (typeof versionData === 'object') {
      if (versionData.contents) {
        rawSpec = versionData.contents;
      } else if (versionData.specs && Array.isArray(versionData.specs) && versionData.specs.length > 0) {
        var spec = versionData.specs[0];
        rawSpec = spec.contents || spec.value || spec;
      } else if (versionData.value) {
        rawSpec = versionData.value;
      } else if (versionData.schema) {
        rawSpec = versionData.schema;
      } else {
        rawSpec = versionData;
      }
    }

    if (rawSpec) {
      if (typeof rawSpec === 'string') {
        var decoded = decodeBase64(rawSpec);
        try {
          result.spec = JSON.parse(decoded);
        } catch (e) {
          result.spec = decoded;
        }
      } else {
        result.spec = rawSpec;
      }
    }
  }

  return result;
}

