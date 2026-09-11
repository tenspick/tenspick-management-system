/* ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL
 * APPLICATION BOOTSTRAP
 *
 * File:
 * assets/js/client-app.js
 * ============================================================ */

(function (window, document) {
  "use strict";

  /* ========================================================
   * STATE
   * ======================================================== */

  let initialized = false;

  let initializing = false;

  /* ========================================================
   * LOGGING
   * ======================================================== */

  function log() {
    console.log("[Tenspick Client Portal]", ...arguments);
  }

  function warn() {
    console.warn("[Tenspick Client Portal]", ...arguments);
  }

  function errorLog() {
    console.error("[Tenspick Client Portal]", ...arguments);
  }

  /* ========================================================
   * DEPENDENCY CHECK
   * ======================================================== */

  function checkDependencies() {
    const required = {
      API: window.TenspickClientAPI,

      Auth: window.TenspickClientAuth,

      Router: window.TenspickClientRouter,
    };

    const missing = [];

    Object.keys(required).forEach(function (key) {
      if (!required[key]) {
        missing.push(key);
      }
    });

    if (missing.length > 0) {
      errorLog("Missing required dependencies:", missing.join(", "));

      return false;
    }

    return true;
  }

  /* ========================================================
   * COMPONENT INITIALIZATION
   * ======================================================== */

  function initializeComponents() {
    /*
     * ----------------------------------------------------
     * SIDEBAR
     * ----------------------------------------------------
     */

    if (
      window.TenspickClientSidebar &&
      typeof window.TenspickClientSidebar.init === "function"
    ) {
      try {
        window.TenspickClientSidebar.init();
      } catch (error) {
        errorLog("Sidebar initialization failed:", error);
      }
    } else {
      warn("Sidebar component is not available.");
    }

    /*
     * ----------------------------------------------------
     * TOPBAR
     * ----------------------------------------------------
     */

    if (
      window.TenspickClientTopbar &&
      typeof window.TenspickClientTopbar.init === "function"
    ) {
      try {
        window.TenspickClientTopbar.init();
      } catch (error) {
        errorLog("Topbar initialization failed:", error);
      }
    } else {
      warn("Topbar component is not available.");
    }
  }

  /* ========================================================
   * SHOW BOOT ERROR
   * ======================================================== */

  function showBootError(message) {
    const loading = document.getElementById("clientGlobalLoading");

    const page = document.getElementById("clientPageContainer");

    const error = document.getElementById("clientGlobalError");

    const errorMessage = document.getElementById("clientGlobalErrorMessage");

    if (loading) {
      loading.hidden = true;
    }

    if (page) {
      page.hidden = true;
    }

    if (errorMessage) {
      errorMessage.textContent =
        message || "Unable to start the client portal.";
    }

    if (error) {
      error.hidden = false;
    }
  }

  /* ========================================================
   * AUTHENTICATION
   * ======================================================== */

  async function initializeAuthentication() {
    if (!window.TenspickClientAuth) {
      throw new Error("Client authentication service is not available.");
    }

    if (typeof window.TenspickClientAuth.init !== "function") {
      throw new Error("Client authentication module does not provide init().");
    }

    log("Checking client authentication...");

    let authenticated;

    try {
      authenticated = await window.TenspickClientAuth.init();
    } catch (error) {
      errorLog("Authentication initialization failed:", error);

      /*
       * Authentication module may already redirect
       * the browser when the session is invalid.
       *
       * We simply stop bootstrap here.
       */

      return false;
    }

    if (!authenticated) {
      log("Client is not authenticated.");

      return false;
    }

    log("Client authentication verified.");

    return true;
  }

  /* ========================================================
   * ROUTER
   * ======================================================== */

  async function initializeRouter() {
    if (!window.TenspickClientRouter) {
      throw new Error("Client router is not available.");
    }

    if (typeof window.TenspickClientRouter.init !== "function") {
      throw new Error("Client router does not provide init().");
    }

    log("Starting client router...");

    await window.TenspickClientRouter.init();

    log("Client router started.");
  }

  /* ========================================================
   * MAIN INIT
   * ======================================================== */

  async function init() {
    /*
     * Already completely initialized.
     */

    if (initialized) {
      return true;
    }

    /*
     * Prevent duplicate simultaneous initialization.
     */

    if (initializing) {
      return false;
    }

    initializing = true;

    log("Starting...");

    try {
      /* ==================================================
       * REQUIRED DEPENDENCIES
       * ================================================== */

      if (!checkDependencies()) {
        showBootError(
          "The client portal could not start because a required service is unavailable.",
        );

        return false;
      }

      /* ==================================================
       * COMPONENTS
       * ================================================== */

      initializeComponents();

      /* ==================================================
       * AUTHENTICATION
       * ================================================== */

      const authenticated = await initializeAuthentication();

      if (!authenticated) {
        /*
         * Auth module is responsible for redirecting
         * unauthenticated users when appropriate.
         */

        return false;
      }

      /* ==================================================
       * ROUTER
       * ================================================== */

      await initializeRouter();

      /* ==================================================
       * READY
       * ================================================== */

      initialized = true;

      log("Ready.");

      /*
       * Notify other optional modules that the
       * application has finished booting.
       */

      document.dispatchEvent(new CustomEvent("tenspick:client-ready"));

      return true;
    } catch (error) {
      errorLog("Application initialization failed:", error);

      showBootError(error?.message || "Unable to start the client portal.");

      return false;
    } finally {
      initializing = false;
    }
  }

  /* ========================================================
   * PUBLIC API
   * ======================================================== */

  window.TenspickClientApp = {
    init: init,

    isInitialized: function () {
      return initialized;
    },

    isInitializing: function () {
      return initializing;
    },
  };

  /* ========================================================
   * DOM READY
   * ======================================================== */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        init();
      },
      {
        once: true,
      },
    );
  } else {
    init();
  }
})(window, document);
