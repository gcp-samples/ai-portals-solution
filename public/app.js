/**
 * Master Client-side logic for the Apigee AI Developer Portal
 */

const CONFIG = {
  demoMode: true,
  portalId: "demo",
  apiHost: "",
  oidcEndpoint: "",
  clientId: "",
  portalConfig: null,
};

// Global view initializers
window.viewInitializers = {};

class AppPortal {
  constructor() {
    this.user = null;
    this.currentView = "";
    this.products = [];
    this.apps = [];
    this.initialLoad = false;
    this.codeDefaultDemoMode = CONFIG.demoMode;
  }

  async init() {
    this.initialLoad = true;

    // Load local config overrides if present
    try {
      const response = await fetch("/CONFIG.local.json");
      if (response.ok) {
        const localConfig = await response.json();
        Object.assign(CONFIG, localConfig);
        this.codeDefaultDemoMode = CONFIG.demoMode;
        console.log("Loaded CONFIG.local.json overrides:", localConfig);
      }
    } catch (e) {
      console.log("No CONFIG.local.json found or failed to parse, using default configuration.");
    }

    this.loadSettingsFromStorage();
    this.setupTheme();
    this.setupEventListeners();

    // Load config based on mode
    await this.loadPortalConfig();

    // Handle OIDC authorization callback if query params are present
    if (!CONFIG.demoMode) {
      await this.discoverOidcEndpoint();
      await this.handleOidcCallback();
    }

    // Process initial route
    this.handleRoute();
    window.addEventListener("hashchange", () => this.handleRoute());
    this.initialLoad = false;
  }

  loadSettingsFromStorage() {
    if (this.codeDefaultDemoMode) {
      const savedMode = localStorage.getItem("portal_demo_mode");
      if (savedMode !== null) {
        CONFIG.demoMode = savedMode === "true";
      } else {
        CONFIG.demoMode = this.codeDefaultDemoMode;
      }
    } else {
      CONFIG.demoMode = false;
    }

    const savedTheme = localStorage.getItem("portal_theme");
    this.theme = savedTheme || "dark";

    // Load cached user based on mode
    if (CONFIG.demoMode) {
      const demoUser = localStorage.getItem("portal_demo_user");
      if (demoUser) {
        this.setUser(JSON.parse(demoUser));
      }
    } else {
      const liveUser = localStorage.getItem("portal_live_user");
      if (liveUser) {
        this.setUser(JSON.parse(liveUser));
      }
    }

    // Set selector value
    const selector = document.getElementById("mode-selector");
    if (selector) {
      selector.value = CONFIG.demoMode ? "demo" : "live";
    }
    this.updateModeBadge();
  }

  setupTheme() {
    if (this.theme === "light") {
      document.body.classList.add("light");
      document.getElementById("sun-icon").style.display = "none";
      document.getElementById("moon-icon").style.display = "block";
    } else {
      document.body.classList.remove("light");
      document.getElementById("sun-icon").style.display = "block";
      document.getElementById("moon-icon").style.display = "none";
    }
    setTimeout(() => lucide.createIcons(), 50);
  }

  toggleTheme() {
    this.theme = this.theme === "dark" ? "light" : "dark";
    localStorage.setItem("portal_theme", this.theme);
    this.setupTheme();
  }

  updateModeBadge() {
    const badge = document.getElementById("mode-badge");
    if (badge) {
      badge.textContent = CONFIG.demoMode ? "DEMO MODE" : "LIVE APIS";
      badge.className = CONFIG.demoMode ? "dev-badge" : "dev-badge prod";
    }
    const demoInfo = document.getElementById("demo-info");
    if (demoInfo) {
      demoInfo.style.display = CONFIG.demoMode ? "block" : "none";
    }
    const devToolbar = document.getElementById("dev-toolbar");
    if (devToolbar) {
      devToolbar.style.display = CONFIG.demoMode || this.codeDefaultDemoMode ? "flex" : "none";
    }
    const selector = document.getElementById("mode-selector");
    if (selector) {
      selector.value = CONFIG.demoMode ? "demo" : "live";
    }
  }

  async togglePortalMode(mode) {
    const prevMode = CONFIG.demoMode;
    CONFIG.demoMode = mode === "demo";
    if (this.codeDefaultDemoMode) {
      localStorage.setItem("portal_demo_mode", CONFIG.demoMode);
    }

    // Reset Auth state if switching modes
    this.user = null;
    localStorage.removeItem("portal_demo_user");

    // Refresh the page automatically to completely reload configs and routing
    window.location.reload();
  }

  setupEventListeners() {
    // Theme toggle
    document.getElementById("theme-toggle").addEventListener("click", () => this.toggleTheme());

    // Auth Modal actions
    document
      .getElementById("btn-show-login")
      ?.addEventListener("click", () => this.openAuthModal());
    document
      .getElementById("btn-close-auth")
      .addEventListener("click", () => this.closeAuthModal());

    // Profile menu toggle
    document.addEventListener("click", (e) => {
      const profileBtn = e.target.closest(".profile-btn");
      const dropdown = document.getElementById("user-dropdown");

      if (profileBtn) {
        dropdown.classList.toggle("show");
      } else if (
        dropdown &&
        (!e.target.closest(".user-menu") || e.target.closest(".dropdown-item"))
      ) {
        dropdown.classList.remove("show");
      }
    });

    // Google Sign In
    document
      .getElementById("btn-google-auth")
      .addEventListener("click", () => this.handleGoogleSignIn());

    // SAML Sign In
    document
      .getElementById("btn-saml-auth")
      .addEventListener("click", () => this.handleSAMLSignIn());
  }

  // Load Portal Configurations
  async loadPortalConfig() {
    try {
      let config;
      let liveConfigFetched = false;

      // On initial page load, check if live config supports identity platform
      if (this.initialLoad && !this.codeDefaultDemoMode) {
        try {
          const res = await fetch(`${CONFIG.apiHost}/api/portals/${CONFIG.portalId}`);
          if (res.ok) {
            const tempConfig = await res.json();
            if (
              tempConfig &&
              tempConfig.authType === "identity-platform" &&
              tempConfig.authApiKey
            ) {
              CONFIG.demoMode = false;
              this.updateModeBadge();
              config = tempConfig;
              liveConfigFetched = true;
              console.log(
                "Automatically switched to Live APIs on load due to Identity Platform configuration.",
              );
            }
          }
        } catch (e) {
          console.warn("Could not check live API config on load, using default/demo fallback.", e);
        }
      }

      // If we didn't fetch live config during initial load check, load based on mode
      if (!liveConfigFetched) {
        if (CONFIG.demoMode) {
          const res = await fetch("/mock-portal.json");
          config = await res.json();
        } else {
          const res = await fetch(`${CONFIG.apiHost}/api/portals/${CONFIG.portalId}`);
          if (res.ok) {
            config = await res.json();
          } else {
            console.warn("Live API config fetch failed. Falling back to Demo Mode.");
            CONFIG.demoMode = true;
            if (this.codeDefaultDemoMode) {
              localStorage.setItem("portal_demo_mode", "true");
            }
            this.updateModeBadge();
            const mockRes = await fetch("/mock-portal.json");
            config = await mockRes.json();
          }
        }
      }

      CONFIG.portalConfig = config;
      if (config.oidcEndpoint) CONFIG.oidcEndpoint = config.oidcEndpoint;
      if (config.clientId) CONFIG.clientId = config.clientId;

      // Update UI title
      const title = config.name || "Apigee AI Portal";
      document.getElementById("portal-title").textContent = title;
      document.getElementById("footer-portal-title").textContent = title;
      document.title = title;

      this.updateAuthHeaderUI();

      if (!CONFIG.demoMode) {
        await this.discoverOidcEndpoint();
        await this.getOrRegisterClientId();
      }
    } catch (err) {
      console.error("Failed to load portal configuration:", err);
      this.showToast("Failed to load portal configuration. Running in fallback mode.", "error");
    }
  }

  // Discovers OIDC endpoint dynamically from protected resource metadata (RFC 9396)
  async discoverOidcEndpoint() {
    if (CONFIG.oidcEndpoint) {
      return;
    }

    const apiHost = CONFIG.apiHost || window.location.origin;
    console.log("Discovering OIDC endpoints from oauth-protected-resource metadata...");
    try {
      const response = await fetch(`${apiHost}/.well-known/oauth-protected-resource`);
      if (response.ok) {
        const metadata = await response.json();
        if (metadata && metadata.authorization_servers && metadata.authorization_servers.length > 0) {
          CONFIG.oidcEndpoint = metadata.authorization_servers[0];
          console.log("Dynamically discovered OIDC Authorization Server:", CONFIG.oidcEndpoint);
          return;
        }
      }
    } catch (e) {
      console.log("No oauth-protected-resource metadata found, falling back to apiHost derivation.", e);
    }

    // Default fallback
    CONFIG.oidcEndpoint = CONFIG.apiHost || window.location.origin;
    console.log("Using fallback OIDC endpoint:", CONFIG.oidcEndpoint);
  }

  // Handle OIDC authorization callback if redirected with code
  async handleOidcCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");

    if (!code) return;

    console.log("Detected OIDC authorization code in redirect URL, initiating exchange...");
    this.showToast("Exchanging secure authorization code...", "info");

    const savedState = sessionStorage.getItem("oidc_state");
    if (savedState && state !== savedState) {
      console.error("OIDC state validation mismatch! Expected:", savedState, "Got:", state);
      this.showToast("Authentication security check failed: state mismatch.", "error");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const codeVerifier = sessionStorage.getItem("oidc_code_verifier");
    if (!codeVerifier) {
      console.error("Missing original OIDC code verifier in session storage.");
      this.showToast("Authentication failed: Missing original session code verifier.", "error");
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    try {
      const clientId = await this.getOrRegisterClientId();
      if (!clientId) {
        throw new Error("OIDC Client ID is not registered or available.");
      }

      const redirectUri = window.location.origin + window.location.pathname;
      const params = new URLSearchParams();
      params.append("grant_type", "authorization_code");
      params.append("client_id", clientId);
      params.append("redirect_uri", redirectUri);
      params.append("code", code);
      params.append("code_verifier", codeVerifier);

      const response = await fetch(`${CONFIG.oidcEndpoint}/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error_description || errBody.error || "Token exchange failed");
      }

      const data = await response.json();
      const idToken = data.id_token;
      if (!idToken) {
        throw new Error("No openid ID token was returned by the token endpoint");
      }

      const decoded = this.decodeJwt(idToken);
      if (!decoded) {
        throw new Error("Failed to decode user profile from received ID token");
      }

      const email = decoded.email;
      const displayName = decoded.name || email.split("@")[0];

      // Sync OIDC login with the developer gateway backend
      await this.liveLogin(email, idToken, displayName, "");

      const userObj = {
        email: email,
        displayName: displayName,
        photoURL: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
        token: idToken,
      };

      this.setUser(userObj);
      localStorage.setItem("portal_live_user", JSON.stringify(userObj));
      this.showToast("Signed in successfully via secure OIDC!", "success");

    } catch (err) {
      console.error("OIDC Callback execution failed:", err);
      this.showToast("OIDC authentication failed: " + err.message, "error");
    } finally {
      // Clear transient session storage states and clean query parameters from bar
      sessionStorage.removeItem("oidc_code_verifier");
      sessionStorage.removeItem("oidc_state");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  // Decodes client-side a standard base64url JWT token
  decodeJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.error("Error decoding JWT token claims:", e);
      return null;
    }
  }

  // Generates cryptographically secure high entropy PKCE verifier
  generateVerifier() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const array = new Uint32Array(44);
    window.crypto.getRandomValues(array);
    let verifier = '';
    for (let i = 0; i < array.length; i++) {
      verifier += chars[array[i] % chars.length];
    }
    return verifier;
  }

  // Hashes verifier with SHA-256 and base64url-encodes the result
  async generateChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hashBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Resolves configured client id or dynamically registers current redirect URI
  async getOrRegisterClientId() {
    if (CONFIG.clientId) {
      return CONFIG.clientId;
    }
    let storedId = localStorage.getItem("portal_client_id");
    if (storedId) {
      CONFIG.clientId = storedId;
      return storedId;
    }
    if (!CONFIG.oidcEndpoint) {
      console.warn("No OIDC endpoint configured for dynamic client registration.");
      return null;
    }
    try {
      const redirectUri = window.location.origin + window.location.pathname;
      const response = await fetch(`${CONFIG.oidcEndpoint}/register-client`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_name: "Apigee Developer Portal",
          redirect_uris: [redirectUri],
        }),
      });
      if (!response.ok) {
        throw new Error("OIDC Dynamic Client Registration request rejected by server.");
      }
      const data = await response.json();
      if (data && data.client_id) {
        localStorage.setItem("portal_client_id", data.client_id);
        CONFIG.clientId = data.client_id;
        console.log("OIDC Client dynamically registered:", data.client_id);
        return data.client_id;
      }
    } catch (e) {
      console.error("Dynamic client registration failed:", e);
    }
    return null;
  }

  // Initiates OIDC PKCE redirect
  async loginOidc() {
    try {
      this.showToast("Redirecting to secure single sign-on...", "info");

      const clientId = await this.getOrRegisterClientId();
      if (!clientId) {
        throw new Error("Could not retrieve or dynamically register OIDC client ID.");
      }

      const verifier = this.generateVerifier();
      sessionStorage.setItem("oidc_code_verifier", verifier);

      const challenge = await this.generateChallenge(verifier);
      const state = Array.from(window.crypto.getRandomValues(new Uint32Array(8)), dec => dec.toString(16)).join('');
      sessionStorage.setItem("oidc_state", state);

      const redirectUri = window.location.origin + window.location.pathname;
      const authorizeUrl = `${CONFIG.oidcEndpoint}/authorize` +
        `?client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=openid%20profile%20email` +
        `&code_challenge=${encodeURIComponent(challenge)}` +
        `&code_challenge_method=S256` +
        `&state=${encodeURIComponent(state)}`;

      window.location.href = authorizeUrl;
    } catch (err) {
      console.error("OIDC redirect generation failed:", err);
      this.showToast("Failed to initiate OIDC authorization redirection: " + err.message, "error");
    }
  }

  async liveLogin(email, token, firstName = "", lastName = "") {
    const url = `${CONFIG.apiHost}/api/portals/${CONFIG.portalId}/users/${email}/login`;
    const payload = {};
    if (firstName) payload.firstName = firstName;
    if (lastName) payload.lastName = lastName;
    payload.email = email;
    payload.userName = email;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || "Identity portal verification failed");
    }
    console.log("Logged in successfully to backend portal gateway");
  }

  // Auth Operations
  openAuthModal() {
    if (!CONFIG.demoMode) {
      this.loginOidc();
      return;
    }

    const dialog = document.getElementById("auth-dialog");
    if (dialog) {
      const authForm = document.getElementById("auth-form");
      if (authForm) {
        authForm.reset();
      }
      dialog.showModal();

      // Configure dialog visibility based on portal mode (Demo vs Live OIDC)
      const tabsContainer = document.getElementById("demo-auth-tabs-container");
      const formContainer = document.getElementById("auth-form");
      const oidcContainer = document.getElementById("oidc-auth-section");
      const socialContainer = document.getElementById("social-auth-section");
      const titleElement = document.getElementById("auth-dialog-title");

      if (CONFIG.demoMode) {
        if (tabsContainer) tabsContainer.style.display = "block";
        if (formContainer) formContainer.style.display = "block";
        if (oidcContainer) oidcContainer.style.display = "none";
        if (socialContainer) socialContainer.style.display = "block";
        this.setAuthTab("login");
      } else {
        if (tabsContainer) tabsContainer.style.display = "none";
        if (formContainer) formContainer.style.display = "none";
        if (oidcContainer) oidcContainer.style.display = "block";
        if (socialContainer) socialContainer.style.display = "none";
        if (titleElement) titleElement.textContent = "Secure Sign In";
      }

      const emailInput = document.getElementById("auth-email");
      if (emailInput && CONFIG.demoMode) {
        emailInput.focus();
      }
    }
  }

  closeAuthModal() {
    const dialog = document.getElementById("auth-dialog");
    if (dialog) dialog.close();
  }

  setAuthTab(tab) {
    const authForm = document.getElementById("auth-form");
    if (authForm) {
      authForm.reset();
    }
    const isLogin = tab === "login";
    document.getElementById("tab-login").classList.toggle("active", isLogin);
    document.getElementById("tab-register").classList.toggle("active", !isLogin);
    document.getElementById("auth-dialog-title").textContent = isLogin
      ? "Developer Sign In"
      : "Developer Register";
    document.getElementById("btn-auth-submit").textContent = isLogin
      ? "Sign In"
      : "Register Account";

    const namesGroup = document.getElementById("register-names");
    if (namesGroup) {
      namesGroup.style.display = isLogin ? "none" : "flex";
      const firstNameInput = document.getElementById("auth-first-name");
      const lastNameInput = document.getElementById("auth-last-name");
      if (firstNameInput) firstNameInput.required = !isLogin;
      if (lastNameInput) lastNameInput.required = !isLogin;
    }

    const passwordInput = document.getElementById("auth-password");
    if (passwordInput) {
      passwordInput.required = !CONFIG.demoMode;
      passwordInput.placeholder = CONFIG.demoMode ? "Optional in Demo mode" : "";
    }

    const emailInput = document.getElementById("auth-email");
    if (emailInput && CONFIG.demoMode && isLogin) {
      emailInput.value = "test@example.com";
    }
  }

  async handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const isLogin = document.getElementById("tab-login").classList.contains("active");

    if (CONFIG.demoMode) {
      // Demo authentication flow
      if (email === "test@example.com") {
        const demoUser = {
          email: "test@example.com",
          displayName: "Demo Developer",
          photoURL:
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
          token: "demo-token-123",
        };
        this.setUser(demoUser);
        localStorage.setItem("portal_demo_user", JSON.stringify(demoUser));
        this.showToast("Signed in as demo developer test@example.com", "success");
        this.closeAuthModal();
      } else {
        this.showToast("Invalid email for Demo mode. Please use test@example.com", "error");
      }
      return;
    }

    // Direct live submissions to OIDC
    await this.loginOidc();
  }

  async handleGoogleSignIn() {
    if (CONFIG.demoMode) {
      this.showToast("Google Auth not available in Demo mode. Use email login instead.", "warning");
      return;
    }
    await this.loginOidc();
  }

  async handleSAMLSignIn() {
    if (CONFIG.demoMode) {
      this.showToast("SAML SSO not available in Demo Mode.", "warning");
      return;
    }
    await this.loginOidc();
  }

  async signOut() {
    if (CONFIG.demoMode) {
      this.setUser(null);
      localStorage.removeItem("portal_demo_user");
      this.showToast("Signed out of demo session", "success");
      this.navigate("home");
    } else {
      this.setUser(null);
      localStorage.removeItem("portal_live_user");
      this.showToast("Signed out successfully", "success");
      this.navigate("home");
    }
  }

  setUser(user) {
    this.user = user;
    this.updateAuthHeaderUI();

    // Reload state or apps for authenticated views
    if (user) {
      document.querySelectorAll(".auth-required").forEach((el) => (el.style.display = "block"));
    } else {
      document.querySelectorAll(".auth-required").forEach((el) => (el.style.display = "none"));
    }

    // If we're on a protected page but signed out, redirect to home
    const currentHash = window.location.hash;
    if (!user && (currentHash === "#apps" || currentHash === "#analytics")) {
      this.navigate("home");
    }

    // Refresh current view if it depends on user data
    if (
      this.currentView === "apps" ||
      this.currentView === "analytics" ||
      this.currentView === "product-detail"
    ) {
      this.handleRoute();
    }
  }

  updateAuthHeaderUI() {
    const authSection = document.getElementById("auth-section");
    if (!authSection) return;

    if (this.user) {
      authSection.innerHTML = `
        <div class="user-menu">
          <div class="profile-btn">
            <img class="avatar" src="${this.user.photoURL}" alt="${this.user.displayName}">
            <span class="profile-name">${this.user.displayName}</span>
            <i data-lucide="chevron-down" style="width:1rem; height:1rem; color:var(--text-secondary);"></i>
          </div>
          <div class="dropdown-menu" id="user-dropdown">
            <div class="dropdown-header">
              <strong style="display:block; font-size:0.875rem;">${this.user.displayName}</strong>
              <span class="dropdown-email">${this.user.email}</span>
            </div>
            <div class="dropdown-item" onclick="app.navigate('apps')">
              <i data-lucide="layers" style="width:1rem; height:1rem;"></i>
              My Apps
            </div>
            <div class="dropdown-item" onclick="app.navigate('analytics')">
              <i data-lucide="line-chart" style="width:1rem; height:1rem;"></i>
              Analytics
            </div>
            <div class="dropdown-item" onclick="app.navigate('ard')">
              <i data-lucide="compass" style="width:1rem; height:1rem;"></i>
              Discovery (ARD)
            </div>
            <div style="border-top:1px solid var(--border-color); margin:0.25rem 0;"></div>
            <div class="dropdown-item danger" onclick="app.signOut()">
              <i data-lucide="log-out" style="width:1rem; height:1rem;"></i>
              Sign Out
            </div>
          </div>
        </div>
      `;
    } else {
      authSection.innerHTML = `
        <button class="btn btn-primary btn-sm" id="btn-show-login">Sign In</button>
      `;
      document
        .getElementById("btn-show-login")
        .addEventListener("click", () => this.openAuthModal());
    }
    setTimeout(() => lucide.createIcons(), 20);
  }

  // Client Side Routing
  navigate(route) {
    window.location.hash = route;
  }

  async handleRoute() {
    const hash = window.location.hash || "#home";
    const parts = hash.split("/");
    let view = parts[0].substring(1);
    const param = parts[1]; // e.g. productId in #product/:id

    if (view === "product") {
      view = "product-detail";
    }

    // Route guarding
    if ((view === "apps" || view === "analytics" || view === "ard") && !this.user) {
      this.showToast("Please sign in to view this section", "warning");
      this.navigate("home");
      return;
    }

    // Set active nav link
    document.querySelectorAll(".nav-link").forEach((link) => {
      const href = link.getAttribute("href");
      if (href === hash || (href === "#catalog" && hash.startsWith("#product"))) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    this.currentView = view;
    await this.loadView(view, param);
  }

  async loadView(viewName, param) {
    const mainContent = document.getElementById("main-content");

    // Add loading indicator class to body
    document.body.classList.add("view-loading");

    const fetchAndUpdate = async () => {
      const response = await fetch(`/views/${viewName}.html`);
      if (!response.ok) throw new Error(`Failed to fetch view ${viewName}`);

      const text = await response.text();

      // Inject Snippet
      mainContent.innerHTML = text;

      // Find & Evaluate nested JS script tags
      const scriptElements = mainContent.querySelectorAll("script");
      scriptElements.forEach((oldScript) => {
        const newScript = document.createElement("script");
        Array.from(oldScript.attributes).forEach((attr) =>
          newScript.setAttribute(attr.name, attr.value),
        );
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
      });

      // Execute the view's initializer if registered
      if (window.viewInitializers[viewName]) {
        await window.viewInitializers[viewName](param);
      }

      // Re-create icons for any new Lucide tags
      lucide.createIcons();
    };

    if (!document.startViewTransition) {
      // Show loading skeleton for fallback
      mainContent.innerHTML = `
        <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:400px; gap:1rem;">
          <div style="border: 4px solid var(--border-color); border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
          <div style="color:var(--text-secondary); font-weight:500;">Loading content...</div>
        </div>
        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      `;
      try {
        await fetchAndUpdate();
        // Accessibility Routing
        const autofocusEl = mainContent.querySelector("[autofocus]");
        if (autofocusEl) {
          autofocusEl.focus();
        } else {
          const heading = mainContent.querySelector("h1, h2");
          if (heading) {
            heading.setAttribute("tabindex", "-1");
            heading.focus();
          } else {
            mainContent.setAttribute("tabindex", "-1");
            mainContent.focus();
          }
        }
      } catch (err) {
        console.error(err);
        this.renderErrorView(mainContent, viewName);
      } finally {
        document.body.classList.remove("view-loading");
      }
    } else {
      try {
        const transition = document.startViewTransition(async () => {
          await fetchAndUpdate();
        });

        transition.finished.finally(() => {
          document.body.classList.remove("view-loading");
          // MANDATORY Accessibility Routing: Route focus to autofocus element, page header, or container
          const autofocusEl = mainContent.querySelector("[autofocus]");
          if (autofocusEl) {
            autofocusEl.focus();
          } else {
            const heading = mainContent.querySelector("h1, h2");
            if (heading) {
              heading.setAttribute("tabindex", "-1");
              heading.focus();
            } else {
              mainContent.setAttribute("tabindex", "-1");
              mainContent.focus();
            }
          }
        });
      } catch (err) {
        console.error(err);
        document.body.classList.remove("view-loading");
        this.renderErrorView(mainContent, viewName);
      }
    }
  }

  renderErrorView(mainContent, viewName) {
    mainContent.innerHTML = `
      <div class="panel" style="max-width:600px; margin: 4rem auto; text-align:center;">
        <i data-lucide="alert-triangle" style="width:3rem; height:3rem; color:var(--danger); margin-bottom:1rem;"></i>
        <h2>Failed to Load View</h2>
        <p style="color:var(--text-secondary); margin: 1rem 0;">The requested view "${viewName}" could not be loaded dynamically. Please make sure the views/ directory contains the correct files.</p>
        <button class="btn btn-primary" onclick="app.navigate('home')">Go back Home</button>
      </div>
    `;
    lucide.createIcons();
  }

  // Toast System
  showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    if (typeof container.showPopover === "function") {
      try {
        container.showPopover();
      } catch (e) {
        // Safe to ignore if already open
      }
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "info";
    if (type === "success") icon = "check-circle";
    if (type === "error") icon = "alert-octagon";
    if (type === "warning") icon = "alert-triangle";

    toast.innerHTML = `
      <i data-lucide="${icon}" style="width:1.25rem; height:1.25rem; flex-shrink:0;"></i>
      <span style="font-size:0.875rem; font-weight:500;">${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
      toast.style.animation = "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse";
      toast.style.opacity = "0";
      setTimeout(() => {
        toast.remove();
        if (container.childElementCount === 0 && typeof container.hidePopover === "function") {
          try {
            container.hidePopover();
          } catch (e) {
            // Safe to ignore
          }
        }
      }, 300);
    }, 4000);
  }

  // Unified Request Helper with Authorization Tokens
  async makeRequest(endpoint, options = {}) {
    const headers = options.headers || {};

    if (!CONFIG.demoMode && this.user && this.user.token) {
      headers["Authorization"] = `Bearer ${this.user.token}`;
    }

    options.headers = headers;
    const response = await fetch(endpoint, options);

    if (response.status === 401) {
      // Session expired or token invalid
      this.showToast("Your authentication token has expired. Please sign in again.", "warning");
      this.signOut();
      throw new Error("Unauthorized");
    }

    return response;
  }
}

// Instantiate Global Portal Object
const app = new AppPortal();
window.addEventListener("DOMContentLoaded", () => app.init());
