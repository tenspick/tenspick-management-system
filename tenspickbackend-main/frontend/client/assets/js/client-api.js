/* ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL
 * API SERVICE
 * ============================================================ */

(function (window, document) {
  "use strict";

  /* ============================================================
   * CONFIGURATION
   * ============================================================ */

  const DEBUG = true;

  const API_SUFFIX =
    "/backend/public/index.php/api";


  /* ============================================================
   * APPLICATION ROOT
   * ============================================================ */

  function detectAppRoot() {
    const pathname =
      window.location.pathname || "";

    const normalized =
      pathname.replace(
        /\/+/g,
        "/"
      );


    /*
     * ----------------------------------------------------------
     * FRONTEND PATH
     * ----------------------------------------------------------
     *
     * Example:
     *
     * /tenspickk/frontend/client/index.php
     *
     * returns:
     *
     * /tenspickk
     *
     */

    const frontendMarker =
      "/frontend/";

    const frontendIndex =
      normalized
        .toLowerCase()
        .indexOf(
          frontendMarker
        );


    if (
      frontendIndex !== -1
    ) {

      return normalized.substring(
        0,
        frontendIndex
      );
    }


    /*
     * ----------------------------------------------------------
     * BACKEND PATH
     * ----------------------------------------------------------
     *
     * Example:
     *
     * /tenspickk/backend/public/index.php
     *
     * returns:
     *
     * /tenspickk
     *
     */

    const backendMarker =
      "/backend/";

    const backendIndex =
      normalized
        .toLowerCase()
        .indexOf(
          backendMarker
        );


    if (
      backendIndex !== -1
    ) {

      return normalized.substring(
        0,
        backendIndex
      );
    }


    /*
     * ----------------------------------------------------------
     * SCRIPT FALLBACK
     * ----------------------------------------------------------
     */

    const scripts =
      document.getElementsByTagName(
        "script"
      );


    for (
      let i = 0;
      i < scripts.length;
      i++
    ) {

      const src =
        scripts[i].src || "";


      if (!src) {
        continue;
      }


      const scriptPath =
        src.split("?")[0];


      const scriptIndex =
        scriptPath
          .toLowerCase()
          .indexOf(
            frontendMarker
          );


      if (
        scriptIndex !== -1
      ) {

        return scriptPath.substring(
          0,
          scriptIndex
        );
      }
    }


    /*
     * ----------------------------------------------------------
     * DEFAULT
     * ----------------------------------------------------------
     */

    return "";
  }


  const APP_ROOT =
    detectAppRoot();


  /* ============================================================
   * API BASE
   * ============================================================ */

  const API_BASE =
    window.location.origin +
    APP_ROOT +
    API_SUFFIX;


  /* ============================================================
   * LOGGING
   * ============================================================ */

  function log() {

    if (!DEBUG) {
      return;
    }

    console.log(
      "[Tenspick Client API]",
      ...arguments
    );
  }


  function warn() {

    if (!DEBUG) {
      return;
    }

    console.warn(
      "[Tenspick Client API]",
      ...arguments
    );
  }


  function errorLog() {

    console.error(
      "[Tenspick Client API]",
      ...arguments
    );
  }


  /* ============================================================
   * NORMALIZE PATH
   * ============================================================ */

  function normalizePath(path) {

    if (
      path === null ||
      path === undefined ||
      path === ""
    ) {

      return "";
    }


    let value =
      String(path).trim();


    /*
     * Remove accidental absolute API prefix.
     *
     * This prevents:
     *
     * /api/api/...
     *
     * when a caller accidentally passes /api/...
     */

    const apiPrefix =
      "/api";


    if (
      value.toLowerCase()
        .startsWith(
          apiPrefix + "/"
        )
    ) {

      value =
        value.substring(
          apiPrefix.length
        );
    }


    /*
     * Make sure path begins with /
     */

    if (
      !value.startsWith("/")
    ) {

      value =
        "/" + value;
    }


    /*
     * Prevent duplicate slashes.
     */

    value =
      value.replace(
        /\/+/g,
        "/"
      );


    return value;
  }


  /* ============================================================
   * BUILD URL
   * ============================================================ */

  function buildUrl(
    endpoint
  ) {

    const path =
      normalizePath(
        endpoint
      );


    return API_BASE + path;
  }


  /* ============================================================
   * REQUEST BODY
   * ============================================================ */

  function prepareBody(
    body,
    headers,
    fetchOptions
  ) {

    if (
      body === null ||
      body === undefined
    ) {

      return;
    }


    /*
     * FormData
     */

    if (
      body instanceof FormData
    ) {

      fetchOptions.body =
        body;

      return;
    }


    /*
     * Blob
     */

    if (
      body instanceof Blob
    ) {

      fetchOptions.body =
        body;

      return;
    }


    /*
     * ArrayBuffer
     */

    if (
      body instanceof ArrayBuffer
    ) {

      fetchOptions.body =
        body;

      return;
    }


    /*
     * URLSearchParams
     */

    if (
      body instanceof URLSearchParams
    ) {

      if (
        !headers["Content-Type"]
      ) {

        headers["Content-Type"] =
          "application/x-www-form-urlencoded;charset=UTF-8";
      }


      fetchOptions.body =
        body;

      return;
    }


    /*
     * String body
     */

    if (
      typeof body === "string"
    ) {

      fetchOptions.body =
        body;

      return;
    }


    /*
     * Plain object / array
     *
     * Automatically JSON encode.
     */

    if (
      typeof body === "object"
    ) {

      headers["Content-Type"] =
        "application/json";

      fetchOptions.body =
        JSON.stringify(
          body
        );

      return;
    }


    /*
     * Primitive values.
     */

    fetchOptions.body =
      String(body);
  }


  /* ============================================================
   * PARSE RESPONSE
   * ============================================================ */

  async function parseResponse(
    response
  ) {

    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    /*
     * ----------------------------------------------------------
     * JSON
     * ----------------------------------------------------------
     */

    if (
      contentType
        .toLowerCase()
        .includes(
          "application/json"
        )
    ) {

      try {

        return await response.json();

      } catch (error) {

        return {
          success: false,

          message:
            "Invalid JSON response from server.",

          data: null
        };
      }
    }


    /*
     * ----------------------------------------------------------
     * NON-JSON RESPONSE
     * ----------------------------------------------------------
     */

    let text = "";


    try {

      text =
        await response.text();

    } catch (error) {

      text = "";
    }


    /*
     * Sometimes PHP returns JSON without
     * a proper Content-Type header.
     */

    if (text) {

      try {

        return JSON.parse(
          text
        );

      } catch (error) {

        /*
         * Not JSON.
         */
      }
    }


    return {
      success: false,

      message:
        text
          ? text.substring(
              0,
              500
            )
          : "Invalid server response.",

      data: null
    };
  }


  /* ============================================================
   * MESSAGE
   * ============================================================ */

  function getMessage(
    result,
    fallback
  ) {

    if (
      result &&
      typeof result.message ===
        "string" &&
      result.message.trim()
    ) {

      return result.message.trim();
    }


    return (
      fallback ||
      "An unexpected error occurred."
    );
  }


  /* ============================================================
   * SUCCESS
   * ============================================================ */

  function isSuccess(
    result
  ) {

    return Boolean(
      result &&
      (
        result.success === true ||
        result.status === "success"
      )
    );
  }


  /* ============================================================
   * CREATE API ERROR
   * ============================================================ */

  function createApiError(
    message,
    status,
    result,
    url
  ) {

    const error =
      new Error(
        message
      );


    error.name =
      "TenspickAPIError";


    error.type =
      "api";


    error.status =
      Number(status) || 0;


    error.statusCode =
      Number(status) || 0;


    error.url =
      url;


    error.result =
      result;


    error.data =
      result;


    error.isUnauthorized =
      (
        error.status === 401 ||
        error.status === 403
      );


    return error;
  }


  /* ============================================================
   * REQUEST
   * ============================================================ */

  async function request(
    endpoint,
    options
  ) {

    const config =
      options || {};


    const method =
      String(
        config.method ||
        "GET"
      ).toUpperCase();


    const url =
      buildUrl(
        endpoint
      );


    /*
     * ----------------------------------------------------------
     * HEADERS
     * ----------------------------------------------------------
     */

    const headers = {
      Accept:
        "application/json",

      "X-Requested-With":
        "XMLHttpRequest",

      ...(config.headers || {})
    };


    /*
     * ----------------------------------------------------------
     * FETCH OPTIONS
     * ----------------------------------------------------------
     */

    const fetchOptions = {
      ...config,

      method:
        method,

      credentials:
        "include",

      headers:
        headers,

      cache:
        "no-store"
    };


    /*
     * Remove custom body from fetch options
     * before preparing it.
     */

    if (
      Object.prototype.hasOwnProperty.call(
        config,
        "body"
      )
    ) {

      delete fetchOptions.body;


      prepareBody(
        config.body,
        headers,
        fetchOptions
      );
    }


    /*
     * ----------------------------------------------------------
     * REQUEST LOG
     * ----------------------------------------------------------
     */

    log(
      method,
      url
    );


    let response;


    /* ==========================================================
       FETCH
       ========================================================== */

    try {

      response =
        await fetch(
          url,
          fetchOptions
        );

    } catch (
      networkError
    ) {

      errorLog(
        "Network error:",
        networkError
      );


      const error =
        new Error(
          "Unable to connect to the server. Please check your internet connection or server."
        );


      error.name =
        "TenspickNetworkError";


      error.type =
        "network";


      error.original =
        networkError;


      error.status =
        0;


      error.statusCode =
        0;


      throw error;
    }


    /* ==========================================================
       PARSE
       ========================================================== */

    const result =
      await parseResponse(
        response
      );


    log(
      "Response:",
      response.status,
      result
    );


    /* ==========================================================
       AUTHENTICATION
       ========================================================== */

    if (
      response.status === 401 ||
      response.status === 403
    ) {

      const message =
        getMessage(
          result,
          "Client authentication required."
        );


      /*
       * Allow ClientAuth to handle the
       * expired session.
       */

      if (
        window.TenspickClientAuth &&
        typeof window
          .TenspickClientAuth
          .handleUnauthorized ===
          "function"
      ) {

        try {

          window.TenspickClientAuth
            .handleUnauthorized(
              response.status,
              message
            );

        } catch (
          authHandlerError
        ) {

          warn(
            "Authentication handler failed:",
            authHandlerError
          );
        }
      }


      throw createApiError(
        message,
        response.status,
        result,
        url
      );
    }


    /* ==========================================================
       HTTP ERROR
       ========================================================== */

    if (
      !response.ok
    ) {

      const message =
        getMessage(
          result,
          "The server returned an error."
        );


      throw createApiError(
        message,
        response.status,
        result,
        url
      );
    }


    /* ==========================================================
       APPLICATION-LEVEL ERROR
       ========================================================== */

    /*
     * HTTP 200 does not always mean application success.
     *
     * Example:
     *
     * {
     *     success: false,
     *     message: "..."
     * }
     *
     * For GET requests we treat this as an error so
     * pages do not accidentally render empty data.
     */

    if (
      result &&
      result.success === false
    ) {

      const message =
        getMessage(
          result,
          "The request could not be completed."
        );


      throw createApiError(
        message,
        response.status,
        result,
        url
      );
    }


    /* ==========================================================
       SUCCESS
       ========================================================== */

    return {

      ok:
        true,

      status:
        response.status,

      data:
        result,

      response:
        response
    };
  }


  /* ============================================================
   * GET
   * ============================================================ */

  function get(
    path
  ) {

    return request(
      path,
      {
        method:
          "GET"
      }
    );
  }


  /* ============================================================
   * POST
   * ============================================================ */

  function post(
    path,
    body
  ) {

    return request(
      path,
      {
        method:
          "POST",

        body:
          body === undefined
            ? {}
            : body
      }
    );
  }


  /* ============================================================
   * PUT
   * ============================================================ */

  function put(
    path,
    body
  ) {

    return request(
      path,
      {
        method:
          "PUT",

        body:
          body === undefined
            ? {}
            : body
      }
    );
  }


  /* ============================================================
   * DELETE
   * ============================================================ */

  function remove(
    path
  ) {

    return request(
      path,
      {
        method:
          "DELETE"
      }
    );
  }


  /* ============================================================
   * PATCH
   * ============================================================ */

  function patch(
    path,
    body
  ) {

    return request(
      path,
      {
        method:
          "PATCH",

        body:
          body === undefined
            ? {}
            : body
      }
    );
  }


  /* ============================================================
   * OPTIONS
   * ============================================================ */

  function options(
    path
  ) {

    return request(
      path,
      {
        method:
          "OPTIONS"
      }
    );
  }


  /* ============================================================
   * PUBLIC API
   * ============================================================ */

  window.TenspickClientAPI = {

    /*
     * Base URL
     */

    base:
      API_BASE,


    /*
     * Application root
     */

    appRoot:
      APP_ROOT,


    /*
     * HTTP methods
     */

    get:
      get,

    post:
      post,

    put:
      put,

    delete:
      remove,

    patch:
      patch,

    options:
      options,


    /*
     * Generic request
     */

    request:
      request,


    /*
     * Utilities
     */

    normalizePath:
      normalizePath,

    buildUrl:
      buildUrl,

    isSuccess:
      isSuccess,

    getMessage:
      getMessage,


    /*
     * Error helper
     */

    createApiError:
      createApiError,


    /*
     * Root getter
     */

    getAppRoot:
      function () {
        return APP_ROOT;
      },


    /*
     * Base getter
     */

    getBase:
      function () {
        return API_BASE;
      }
  };


  /* ============================================================
   * DEBUG INFORMATION
   * ============================================================ */

  log(
    "Initialized.",
    {
      appRoot:
        APP_ROOT,

      apiBase:
        API_BASE
    }
  );

})(window, document);