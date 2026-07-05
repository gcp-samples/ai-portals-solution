function transformApisToProducts(input, apigeeProducts) {
  if (!input || !Array.isArray(input.apis)) {
    return { products: [] };
  }

  var products = input.apis.map(function (api) {
    // 1. Map ID from name (extract the last part of the path)
    var id = api.name ? api.name.split("/").pop() : "";

    // 2. Extract displayName
    var displayName = api.displayName || "";

    // 3. Extract versions
    var versions = api.versions || [];

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

    // 7. Extract categories and tags from attributes
    var categories = [];
    var tags = [];

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

