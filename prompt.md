Create an API portal web app in vanilla HTML/CSS/JS that lets users register, manage their API subscriptions, and view their usage analytics. The style should be modern & visually pleasing, with support for light and dark modes via a header switch. The web app should be created in the ./public directory, and use the ./public/views directory for view HTML/JS/CSS files. The web app authenticates users either in demoMode with a demo test@example.com account, or using Google Cloud Identity Platform and Firebase Auth with the portal "authApiKey" and "authDomain" configuration properties.

## General
* The app should have a local "demoMode" (default true), "portalId" (default "demo") and "apiHost" (default "") configuration properties. If demoMode is true, then data should be fetched from local "mock-" JSON files.
* The app should have a default landing page that is visible to all, and has typical landing page features.
* Each additional view should be loaded dynamically from the views directory as a HTML/JS/CSS snippet that contains all of the view HTML and JS logic. CSS should be used from the parent app.
* Upon loading, the portal configuration should either be loaded from "mock-portal.json" or fetched from "{apiHost}/api/portals/{portalId}".
* The app should include the Firebase Auth client libraries for Email/Password, Google and SAML SSO. It should also include the Scalar API reference library from "https://cdn.jsdelivr.net/npm/@scalar/api-reference".
* If demoMode is true, then the user can sign-in with the demo email test@example.com. If demoMode is false, then the Firebase Auth library is initialized with the "authApiKey" and "authDomain" properties from the portal config.
* After signing-in and demoMode is false, a login message is posted to "{apiHost}/api/portals/{portalId}/users/{email}/login" with a Firebase ID token to authenticate. After signing-in, an ID token is always needed for API calls, as long as demoMode is false.
* After signing-in, the user's apps are also loaded from "{apiHost}/api/portals/{portalId}/users/{email}/apps", or from "mock-apps.json" if demoMode is true.

## Catalog View
* The product data is loaded from either "mock-products.json" in demoMode or from "{apiHost}/api/portals/{portalId}/products".
* The Catalog View parses the product data, and shows all of the Categories as filter options, and lets the user browse the products either as a Grid or Card view. The user can also sort and filter, also by text filter.
* If the user clicks on a product, the user is shown the Product Detail View.

## Product Detail View
* The Product Detail View shows the product details in a nice layout. If the "displayStyle" is "REST", then the OpenAPI specification should be fetched from "{apiHost}/api/products/{productId}/spec, and if successfully fetched, then shown in a Scalar API reference script view.
* The Product Detail View also shows if the product is currently contained in any apps, and links to those apps if so. If not, the user can create a new app directory from the view.

## User App View
* The user can open the app subscription view from their profie menu in the header.
* The view shows all of their app subscriptions, and let's them view the details of each app, including clientId and clientSecret.
* The user can also add/remove products from the apps, and save them. If demoMode is false, they are saved to the server.
* The user can also create new apps, and select the products, and save to the server if demoMode is false.

## Analytics View
* The user can view their analyitcs, either from "mock-analytics.json" if demoMode is true, or from the "{apiHost}/api/portals/{portalId}/users/{email}/analytics" API.
* The analiytcs should be shown in a variety of graphs and tables, and the user should be able to filter and explore the data in an interactive way.
