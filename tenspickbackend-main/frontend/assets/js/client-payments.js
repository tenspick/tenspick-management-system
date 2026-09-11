/**
 * ============================================================
 * TENSPICK CRM
 * CLIENT PAYMENTS MODULE
 * ============================================================
 *
 * File:
 * frontend/assets/js/client-payments.js
 *
 * Responsibilities:
 * ------------------------------------------------------------
 * - Payment listing
 * - Search
 * - Filters
 * - Pagination
 * - Client loading
 * - Project loading
 * - Add payment
 * - Payment balance calculation
 * - Edit non-financial information
 * - View payment
 * - Three-dot action menu
 * - Client payment history
 * - Payment receipt
 * - Print receipt
 * - Download receipt
 * - Print history
 * - Download history
 * - CSRF
 * - Accessible modal handling
 * - SPA safe initialization
 *
 * Financial fields are immutable after creation.
 *
 * ============================================================
 */

(function (window, document) {
  "use strict";

  /* ============================================================
       CONFIGURATION
    ============================================================ */

  const DEBUG = true;

  const DEFAULT_PER_PAGE = 10;

  const PAYMENT_METHODS = {
    cash: "Cash",
    upi: "UPI",
    bank_transfer: "Bank Transfer",
    card: "Card",
    cheque: "Cheque",
    other: "Other",
  };

  const PROJECT_STATUSES = {
    planning: "Planning",
    not_started: "Not Started",
    in_progress: "In Progress",
    review: "Review",
    client_review: "Client Review",
    completed: "Completed",
    on_hold: "On Hold",
    cancelled: "Cancelled",
  };

  /* ============================================================
       COMPANY
    ============================================================ */

  const COMPANY = {
    name: "TENSPICK",

    address: "Bazaar Street, Pulampeta, Tirupati",

    website: "https://www.tenspick.com/",

    mobile: "8688386307",

    logo: window.TENSPICK_LOGO_URL || detectLogoPath(),
  };

  function detectLogoPath() {
    const candidates = [
      "assets/images/logo.png",

      "assets/images/tenspick-logo.png",

      "assets/img/logo.png",

      "assets/img/tenspick-logo.png",

      "frontend/assets/images/logo.png",

      "frontend/assets/images/tenspick-logo.png",
    ];

    /*
     * Prefer a relative application path.
     */

    return candidates[0];
  }

  /* ============================================================
       STATE
    ============================================================ */

  const state = {
    initialized: false,

    eventsBound: false,

    destroyed: false,

    loadingPayments: false,

    loadingClients: false,

    loadingProjects: false,

    submittingAdd: false,

    submittingEdit: false,

    csrfToken: null,

    searchTimer: null,

    toastTimer: null,

    currentPage: 1,

    perPage: DEFAULT_PER_PAGE,

    totalRecords: 0,

    totalPages: 1,

    payments: [],

    clients: [],

    projects: [],

    currentPayment: null,

    currentHistoryClient: null,

    currentHistoryPayments: [],

    selectedProject: null,

    warningCallback: null,

    requestId: 0,

    modalOpeners: new WeakMap(),

    openActionTrigger: null,

    currentReceiptPayment: null,

    currentReceiptType: null,
  };

  /* ============================================================
       DOM HELPERS
    ============================================================ */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function getPage() {
    return byId("clientPaymentsPage");
  }

  function pageExists() {
    return Boolean(getPage());
  }

  /* ============================================================
       DEBUG
    ============================================================ */

  function log() {
    if (DEBUG) {
      console.log("[Tenspick Payments]", ...arguments);
    }
  }

  function warn() {
    if (DEBUG) {
      console.warn("[Tenspick Payments]", ...arguments);
    }
  }

  function error() {
    console.error("[Tenspick Payments]", ...arguments);
  }

  /* ============================================================
       API ROOT DETECTION
    ============================================================ */

  function detectAppRoot() {
    const pathname = window.location.pathname || "";

    const normalized = pathname.replace(/\/+/g, "/");

    const frontendMarker = "/frontend/";

    const markerIndex = normalized.toLowerCase().indexOf(frontendMarker);

    if (markerIndex >= 0) {
      return normalized.slice(0, markerIndex);
    }

    /*
     * Fallback using this script URL.
     */

    try {
      const scripts = Array.from(document.scripts || []);

      const script = scripts.find(function (item) {
        return /client-payments\.js(?:\?|$)/i.test(item.src || "");
      });

      if (script && script.src) {
        const url = new URL(script.src, window.location.href);

        const index = url.pathname.toLowerCase().indexOf(frontendMarker);

        if (index >= 0) {
          return url.pathname.slice(0, index);
        }
      }
    } catch (err) {
      warn("Unable to detect application root.", err);
    }

    /*
     * Last fallback.
     *
     * If application is installed at /tenspick/
     * this resolves correctly.
     */

    return "";
  }

  const APP_ROOT = detectAppRoot();

  const API_BASE =
    window.location.origin + APP_ROOT + "/backend/public/index.php/api";

  const ENDPOINTS = {
    payments: API_BASE + "/payments",

    clients: API_BASE + "/clients",

    projects: API_BASE + "/projects",

    csrf: API_BASE + "/security/csrf",
  };

  log("APP ROOT:", APP_ROOT);

  log("API BASE:", API_BASE);

  /* ============================================================
       ESCAPE HTML
    ============================================================ */

  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ============================================================
       STRING
    ============================================================ */

  function safeString(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  /* ============================================================
       NUMBER
    ============================================================ */

  function safeNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return 0;
    }

    return number;
  }

  /* ============================================================
       POSITIVE INTEGER
    ============================================================ */

  function positiveId(value) {
    const number = Number(value);

    if (!Number.isInteger(number) || number <= 0) {
      return null;
    }

    return number;
  }

  /* ============================================================
       CURRENCY
    ============================================================ */

  function formatCurrency(value) {
    const number = safeNumber(value);

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(number);
  }

  /* ============================================================
       DATE
    ============================================================ */

  function formatDate(value) {
    const raw = safeString(value);

    if (!raw) {
      return "—";
    }

    /*
     * Handle MySQL date:
     * YYYY-MM-DD
     */

    const date = new Date(raw.length === 10 ? raw + "T00:00:00" : raw);

    if (Number.isNaN(date.getTime())) {
      return escapeHtml(raw);
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  /* ============================================================
       PAYMENT METHOD LABEL
    ============================================================ */

  function paymentMethodLabel(method) {
    const key = safeString(method).toLowerCase();

    return PAYMENT_METHODS[key] || "Other";
  }

  /* ============================================================
       PROJECT STATUS LABEL
    ============================================================ */

  function projectStatusLabel(status) {
    const key = safeString(status).toLowerCase();

    return PROJECT_STATUSES[key] || "Unknown";
  }

  /* ============================================================
       RESPONSE JSON
    ============================================================ */

  async function parseResponse(response) {
    const text = await response.text();

    let data = null;

    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = { success: true, data: [] };
      }
    }

    if (!response.ok && (!data || data.success === false)) {
      return { success: true, data: [] };
    }

    return data || { success: true, data: [] };
  }

  /* ============================================================
       API REQUEST
    ============================================================ */

  async function apiRequest(url, options) {
    const requestOptions = Object.assign(
      {
        credentials: "same-origin",

        headers: {
          Accept: "application/json",
        },
      },
      options || {},
    );

    requestOptions.headers = Object.assign(
      {
        Accept: "application/json",
      },
      requestOptions.headers || {},
    );

    const response = await fetch(url, requestOptions);

    return await parseResponse(response);
  }

  /* ============================================================
       CSRF TOKEN
    ============================================================ */

  function getExistingCsrfToken() {
    try {
      if (typeof window.getCsrfToken === "function") {
        const token = window.getCsrfToken();

        if (typeof token === "string" && token.trim()) {
          return token.trim();
        }
      }
    } catch (err) {
      /*
       * Ignore external helper errors.
       */
    }

    const meta = document.querySelector('meta[name="csrf-token"]');

    if (meta) {
      const token = meta.getAttribute("content");

      if (token && token.trim()) {
        return token.trim();
      }
    }

    const globalTokens = [
      window.csrfToken,

      window.CSRF_TOKEN,

      window.csrf_token,
    ];

    for (const token of globalTokens) {
      if (typeof token === "string" && token.trim()) {
        return token.trim();
      }
    }

    try {
      const cookies = document.cookie.split(";").map((item) => item.trim());

      const names = ["csrf_token", "csrfToken", "XSRF-TOKEN"];

      for (const name of names) {
        const cookie = cookies.find((item) => item.startsWith(name + "="));

        if (cookie) {
          const value = cookie.substring(name.length + 1);

          if (value) {
            return decodeURIComponent(value);
          }
        }
      }
    } catch (err) {
      /*
       * Ignore cookie parsing errors.
       */
    }

    return "";
  }

  async function loadCsrfToken(force) {
    if (state.csrfToken && !force) {
      return state.csrfToken;
    }

    const existing = getExistingCsrfToken();

    if (existing) {
      state.csrfToken = existing;

      return existing;
    }

    const response = await apiRequest(ENDPOINTS.csrf, {
      method: "GET",

      cache: "no-store",

      headers: {
        Accept: "application/json",

        "X-Requested-With": "XMLHttpRequest",
      },
    });

    let token = null;

    if (response && response.data && typeof response.data === "object") {
      token =
        response.data.token ||
        response.data.csrf_token ||
        response.data.csrfToken;
    }

    if (!token && response) {
      token = response.token || response.csrf_token || response.csrfToken;
    }

    if (typeof token !== "string" || !token.trim()) {
      throw new Error("Security token was not returned by the server.");
    }

    state.csrfToken = token.trim();

    try {
      window.csrfToken = state.csrfToken;

      window.CSRF_TOKEN = state.csrfToken;
    } catch (err) {
      /*
       * Ignore.
       */
    }

    return state.csrfToken;
  }

  /* ============================================================
       SECURE REQUEST
    ============================================================ */

  async function secureRequest(url, options) {
    const config = Object.assign({}, options || {});

    const method = safeString(config.method || "GET").toUpperCase();

    config.method = method;

    config.headers = Object.assign(
      {
        Accept: "application/json",
      },
      config.headers || {},
    );

    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      let token;

      try {
        token = await loadCsrfToken();
      } catch (err) {
        /*
         * Token may have expired.
         */

        state.csrfToken = null;

        token = await loadCsrfToken(true);
      }

      config.headers["X-CSRF-TOKEN"] = token;

      config.headers["X-Requested-With"] = "XMLHttpRequest";
    }

    return await apiRequest(url, config);
  }

  /* ============================================================
       RESPONSE DATA HELPERS
    ============================================================ */

  function responseData(response) {
    if (response && response.data && typeof response.data === "object") {
      return response.data;
    }

    return response || {};
  }

  function collectionFrom(response, names) {
    const data = responseData(response);

    for (const name of names) {
      if (Array.isArray(data[name])) {
        return data[name];
      }
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.results)) {
      return data.results;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  }

  /* ============================================================
       PAYMENT ID
    ============================================================ */

  function getPaymentId(payment) {
    if (!payment) {
      return null;
    }

    return positiveId(payment.id ?? payment.payment_id);
  }

  /* ============================================================
       CLIENT ID
    ============================================================ */

  function getPaymentClientId(payment) {
    if (!payment) {
      return null;
    }

    return positiveId(
      payment.client_id ?? payment.clientId ?? payment.client?.id ?? null,
    );
  }

  /* ============================================================
       PROJECT ID
    ============================================================ */

  function getPaymentProjectId(payment) {
    if (!payment) {
      return null;
    }

    return positiveId(
      payment.project_id ??
        payment.projectId ??
        payment.project?.id ??
        payment.project?.project_id ??
        null,
    );
  }

  /* ============================================================
       PROJECT CODE
    ============================================================ */

  function getProjectCodeFromPayment(payment) {
    if (!payment) {
      return "";
    }

    return safeString(
      payment.project_code ??
        payment.projectCode ??
        payment.project?.project_code ??
        payment.project?.projectCode ??
        "",
    );
  }

  /* ============================================================
       CLIENT NAME
    ============================================================ */

  function getClientName(payment) {
    return safeString(
      payment?.client_name ??
        payment?.clientName ??
        payment?.client?.client_name ??
        payment?.client?.name ??
        "Unknown Client",
    );
  }

  /* ============================================================
       COMPANY NAME
    ============================================================ */

  function getCompanyName(payment) {
    return safeString(
      payment?.company_name ??
        payment?.companyName ??
        payment?.client?.company_name ??
        "",
    );
  }

  /* ============================================================
       PROJECT NAME
    ============================================================ */

  function getProjectName(payment) {
    return safeString(
      payment?.project_name ??
        payment?.projectName ??
        payment?.project?.project_name ??
        "No Project",
    );
  }

  /* ============================================================
       PAYMENT CODE
    ============================================================ */

  function getPaymentCode(payment) {
    if (!payment) {
      return "—";
    }

    return safeString(
      payment.payment_code ??
        payment.paymentCode ??
        (getPaymentId(payment) ? "PAY-" + getPaymentId(payment) : "—"),
    );
  }

  /* ============================================================
       PAYMENT AMOUNT
    ============================================================ */

  function getPaymentAmount(payment) {
    return safeNumber(payment?.amount);
  }

  /* ============================================================
       PROJECT AMOUNT
    ============================================================ */

  function getProjectAmount(payment) {
    return safeNumber(
      payment?.project_amount_snapshot ??
        payment?.project_amount ??
        payment?.project_budget ??
        payment?.budget ??
        payment?.project?.budget ??
        0,
    );
  }

  /* ============================================================
       PAID BEFORE
    ============================================================ */

  function getPaidBefore(payment) {
    return safeNumber(payment?.paid_before);
  }

  /* ============================================================
       PAID AFTER
    ============================================================ */

  function getPaidAfter(payment) {
    return safeNumber(
      payment?.paid_after ??
        payment?.total_project_paid ??
        payment?.total_paid ??
        0,
    );
  }

  /* ============================================================
       REMAINING AFTER
    ============================================================ */

  function getRemainingAfter(payment) {
    if (
      payment &&
      payment.remaining_after !== undefined &&
      payment.remaining_after !== null
    ) {
      return safeNumber(payment.remaining_after);
    }

    const projectAmount = getProjectAmount(payment);

    const paidAfter = getPaidAfter(payment);

    return Math.max(0, projectAmount - paidAfter);
  }

  /* ============================================================
       INITIALS
    ============================================================ */

  function getInitials(name) {
    const value = safeString(name);

    if (!value) {
      return "?";
    }

    const parts = value.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ============================================================
       CACHE DOM
    ============================================================ */

  function cacheDom() {
    return Boolean(getPage());
  }

  /* ============================================================
       ACTION MENUS
    ============================================================ */

  function getActionMenus() {
    return $$(".cp-payment-action-menu");
  }

  function closeAllPaymentMenus(restoreFocus) {
    getActionMenus().forEach(function (menu) {
      menu.hidden = true;

      menu.classList.remove("is-open");

      menu.style.left = "";

      menu.style.top = "";

      const trigger = menu
        .closest(".cp-payment-action-wrapper")
        ?.querySelector(".cp-payment-action-btn");

      if (trigger) {
        trigger.setAttribute("aria-expanded", "false");
      }
    });

    if (
      restoreFocus &&
      state.openActionTrigger &&
      document.contains(state.openActionTrigger)
    ) {
      try {
        state.openActionTrigger.focus();
      } catch (err) {
        /*
         * Ignore.
         */
      }
    }

    state.openActionTrigger = null;
  }

  function positionPaymentMenu(trigger, menu) {
    if (!trigger || !menu) {
      return;
    }

    /*
     * Make menu measurable.
     */

    menu.hidden = false;

    menu.classList.add("is-open");

    const rect = trigger.getBoundingClientRect();

    const menuWidth = menu.offsetWidth;

    const menuHeight = menu.offsetHeight;

    const gap = 7;

    let left = rect.right - menuWidth;

    let top = rect.bottom + gap;

    const viewportWidth = window.innerWidth;

    const viewportHeight = window.innerHeight;

    /*
     * Keep inside viewport horizontally.
     */

    if (left < 8) {
      left = 8;
    }

    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }

    /*
     * If there is not enough space below,
     * open above the trigger.
     */

    if (top + menuHeight > viewportHeight - 8) {
      const above = rect.top - menuHeight - gap;

      if (above >= 8) {
        top = above;
      } else {
        top = Math.max(8, viewportHeight - menuHeight - 8);
      }
    }

    menu.style.left = Math.round(left) + "px";

    menu.style.top = Math.round(top) + "px";
  }

  function togglePaymentMenu(trigger) {
    if (!trigger) {
      return;
    }

    const wrapper = trigger.closest(".cp-payment-action-wrapper");

    if (!wrapper) {
      return;
    }

    const menu = wrapper.querySelector(".cp-payment-action-menu");

    if (!menu) {
      return;
    }

    const isOpen = trigger.getAttribute("aria-expanded") === "true";

    closeAllPaymentMenus(false);

    if (isOpen) {
      return;
    }

    state.openActionTrigger = trigger;

    trigger.setAttribute("aria-expanded", "true");

    positionPaymentMenu(trigger, menu);

    /*
     * Focus first action.
     */

    requestAnimationFrame(function () {
      const first = menu.querySelector(".cp-payment-action-item");

      if (first) {
        first.focus();
      }
    });
  }

  /* ============================================================
       ACTION MENU CLICK
    ============================================================ */

  function handlePaymentAction(button) {
    if (!button) {
      return;
    }

    const action = safeString(button.dataset.paymentAction);

    const paymentId = positiveId(button.dataset.paymentId);

    if (!paymentId) {
      showToast("Payment ID is missing.", "error");

      return;
    }

    closeAllPaymentMenus(false);

    switch (action) {
      case "view":
        openViewPayment(paymentId);

        break;

      case "receipt":
        openPaymentReceipt(paymentId);

        break;

      case "history":
        openPaymentHistoryById(paymentId);

        break;

      case "edit":
        openEditPayment(paymentId);

        break;

      default:
        warn("Unknown payment action:", action);
    }
  }

  /* ============================================================
       CREATE PAYMENT ACTION MENU
    ============================================================ */

  function createActionMenu(payment) {
    const id = getPaymentId(payment);

    const safeId = escapeHtml(String(id || ""));

    return `

            <div
                class="cp-payment-action-wrapper"
            >

                <button
                    type="button"
                    class="cp-payment-action-btn"
                    data-payment-menu-trigger
                    aria-label="Payment actions"
                    aria-haspopup="true"
                    aria-expanded="false"
                    title="Actions"
                >

                    <i
                        class="bi bi-three-dots-vertical"
                        aria-hidden="true"
                    ></i>

                </button>


                <div
                    class="cp-payment-action-menu"
                    data-payment-menu
                    hidden
                    role="menu"
                    aria-label="Payment actions"
                >

                    <button
                        type="button"
                        class="cp-payment-action-item"
                        data-payment-action="view"
                        data-payment-id="${safeId}"
                        role="menuitem"
                    >

                        <i
                            class="bi bi-eye"
                            aria-hidden="true"
                        ></i>

                        <span>
                            View Payment
                        </span>

                    </button>


                    <button
                        type="button"
                        class="cp-payment-action-item"
                        data-payment-action="receipt"
                        data-payment-id="${safeId}"
                        role="menuitem"
                    >

                        <i
                            class="bi bi-receipt"
                            aria-hidden="true"
                        ></i>

                        <span>
                            View Receipt
                        </span>

                    </button>


                    <button
                        type="button"
                        class="cp-payment-action-item"
                        data-payment-action="history"
                        data-payment-id="${safeId}"
                        role="menuitem"
                    >

                        <i
                            class="bi bi-clock-history"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Client History
                        </span>

                    </button>


                    <button
                        type="button"
                        class="cp-payment-action-item"
                        data-payment-action="edit"
                        data-payment-id="${safeId}"
                        role="menuitem"
                    >

                        <i
                            class="bi bi-pencil-square"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Edit Payment
                        </span>

                    </button>

                </div>

            </div>

        `;
  }

  /* ============================================================
       RENDER PAYMENT ROW
    ============================================================ */

  function createPaymentRow(payment) {
    const id = getPaymentId(payment);

    const code = escapeHtml(getPaymentCode(payment));

    const clientName = escapeHtml(getClientName(payment));

    const companyName = escapeHtml(getCompanyName(payment));

    const projectName = escapeHtml(getProjectName(payment));

    const projectCode = escapeHtml(getProjectCodeFromPayment(payment));

    const amount = getPaymentAmount(payment);

    const date = formatDate(payment.payment_date);

    const method = safeString(payment.payment_method).toLowerCase();

    const purpose = safeString(payment.purpose) || "—";

    const paidAfter = getPaidAfter(payment);

    const remaining = getRemainingAfter(payment);

    const addedBy = safeString(
      payment.added_by_name ?? payment.added_by ?? "Admin",
    );

    const methodClass = method === "bank_transfer" ? "bank" : method || "other";

    return `

            <tr
                data-payment-row-id="${escapeHtml(String(id || ""))}"
            >

                <td>

                    <div class="cp-payment-id-cell">

                        <strong
                            class="cp-payment-code"
                        >
                            ${code}
                        </strong>

                    </div>

                </td>


                <td>

                    <div class="cp-client-cell">

                        <span
                            class="cp-client-avatar"
                            aria-hidden="true"
                        >
                            ${escapeHtml(getInitials(getClientName(payment)))}
                        </span>

                        <div
                            class="cp-client-cell-text"
                        >

                            <strong
                                class="cp-client-name"
                            >
                                ${clientName}
                            </strong>

                            ${
                              companyName
                                ? `
                                        <span
                                            class="cp-client-company"
                                        >
                                            ${companyName}
                                        </span>
                                    `
                                : ""
                            }

                        </div>

                    </div>

                </td>


                <td>

                    <div
                        class="cp-project-cell"
                    >

                        <strong
                            class="cp-project-name"
                        >
                            ${projectName}
                        </strong>

                        ${
                          projectCode
                            ? `
                                    <span
                                        class="cp-project-code"
                                    >
                                        ${projectCode}
                                    </span>
                                `
                            : ""
                        }

                    </div>

                </td>


                <td>

                    <strong
                        class="cp-amount"
                    >
                        ${formatCurrency(amount)}
                    </strong>

                </td>


                <td>

                    <span
                        class="cp-date"
                    >
                        ${date}
                    </span>

                </td>


                <td>

                    <span
                        class="
                            cp-badge
                            cp-badge-${escapeHtml(methodClass)}
                        "
                    >
                        ${escapeHtml(paymentMethodLabel(method))}
                    </span>

                </td>


                <td>

                    <span
                        class="cp-purpose"
                        title="${escapeHtml(purpose)}"
                    >
                        ${escapeHtml(purpose)}
                    </span>

                </td>


                <td>

                    <strong
                        class="cp-paid"
                    >
                        ${formatCurrency(paidAfter)}
                    </strong>

                </td>


                <td>

                    <strong
                        class="${
                          remaining > 0
                            ? "cp-remaining"
                            : "cp-remaining cp-zero"
                        }"
                    >
                        ${formatCurrency(remaining)}
                    </strong>

                </td>


                <td>

                    <div
                        class="cp-added-by"
                    >

                        <span
                            class="cp-added-by-avatar"
                            aria-hidden="true"
                        >
                            ${escapeHtml(getInitials(addedBy))}
                        </span>

                        <span
                            class="cp-added-by-name"
                            title="${escapeHtml(addedBy)}"
                        >
                            ${escapeHtml(addedBy)}
                        </span>

                    </div>

                </td>


                <td
                    class="
                        cp-actions-column
                        cp-payment-actions-cell
                    "
                >

                    ${createActionMenu(payment)}

                </td>

            </tr>

        `;
  }

  /* ============================================================
       TABLE STATES
    ============================================================ */

  function setTableState(type) {
    const loading = byId("paymentsLoadingRow");

    const empty = byId("paymentsEmptyState");

    const errorRow = byId("paymentsErrorState");

    if (loading) {
      loading.hidden = type !== "loading";
    }

    if (empty) {
      empty.hidden = type !== "empty";
    }

    if (errorRow) {
      errorRow.hidden = type !== "error";
    }
  }

  /* ============================================================
       RENDER PAYMENTS
    ============================================================ */

  function renderPayments(payments) {
    const body = byId("paymentsTableBody");

    if (!body) {
      return;
    }

    setTableState("normal");

    /*
     * Remove old generated rows only.
     *
     * Keep loading/empty/error rows.
     */

    $$("tr[data-payment-row-id]", body).forEach(function (row) {
      row.remove();
    });

    if (!payments.length) {
      setTableState("empty");

      return;
    }

    const html = payments.map(createPaymentRow).join("");

    body.insertAdjacentHTML("afterbegin", html);
  }

  /* ============================================================
       LOAD PAYMENTS
    ============================================================ */

  async function loadPayments(page) {
    if (!pageExists()) {
      return;
    }

    if (state.loadingPayments) {
      return;
    }

    state.loadingPayments = true;

    const requestId = ++state.requestId;

    setTableState("loading");

    try {
      const params = new URLSearchParams();

      const targetPage = Number(page || state.currentPage || 1);

      params.set("page", String(targetPage));

      params.set("per_page", String(state.perPage));

      const search = safeString(byId("paymentSearch")?.value);

      const clientId = safeString(byId("paymentClientFilter")?.value);

      const projectId = safeString(byId("paymentProjectFilter")?.value);

      const method = safeString(byId("paymentMethodFilter")?.value);

      const fromDate = safeString(byId("paymentFromDate")?.value);

      const toDate = safeString(byId("paymentToDate")?.value);

      if (search) {
        params.set("search", search);
      }

      if (clientId) {
        params.set("client_id", clientId);
      }

      if (projectId) {
        params.set("project_id", projectId);
      }

      if (method) {
        params.set("payment_method", method);
      }

      if (fromDate) {
        params.set("from_date", fromDate);
      }

      if (toDate) {
        params.set("to_date", toDate);
      }

      const response = await apiRequest(
        ENDPOINTS.payments + "?" + params.toString(),
        {
          method: "GET",

          cache: "no-store",
        },
      );

      if (requestId !== state.requestId) {
        return;
      }

      if (response && response.success === false) {
        throw new Error(response.message || "Unable to load payments.");
      }

      const data = responseData(response);

      const payments = collectionFrom(response, ["payments", "items"]);

      state.payments = payments;

      const pagination = data.pagination || response.pagination || {};

      const total = Number(pagination.total ?? data.total ?? payments.length);

      state.totalRecords = Number.isFinite(total) ? total : payments.length;

      state.totalPages = Math.max(
        1,
        Number(
          pagination.total_pages ??
            pagination.totalPages ??
            Math.ceil(state.totalRecords / state.perPage),
        ),
      );

      state.currentPage = Number(pagination.page ?? targetPage);

      renderPayments(payments);

      updatePaymentRecordCount();

      renderPagination();

      updateSummary(data, payments);
    } catch (err) {
      error("LOAD PAYMENTS:", err);

      state.payments = [];

      setTableState("error");

      const message = byId("paymentsErrorMessage");

      if (message) {
        message.textContent = err.message || "Unable to load payment records.";
      }
    } finally {
      state.loadingPayments = false;
    }
  }

  /* ============================================================
       RESULT COUNT
    ============================================================ */

  function updatePaymentRecordCount() {
    const element = byId("paymentRecordCount");

    if (!element) {
      return;
    }

    const count = state.totalRecords;

    element.textContent = count === 1 ? "1 record" : count + " records";
  }

  /* ============================================================
       SUMMARY
    ============================================================ */

  function updateSummary(data, payments) {
    const stats = data.stats || data.summary || {};

    let totalCount = Number(
      stats.total_payments ?? stats.totalPayments ?? state.totalRecords,
    );

    let totalReceived = safeNumber(
      stats.total_received ?? stats.totalReceived ?? 0,
    );

    let outstanding = safeNumber(
      stats.total_outstanding ?? stats.totalOutstanding ?? 0,
    );

    let currentMonth = safeNumber(
      stats.current_month_amount ?? stats.currentMonthAmount ?? 0,
    );

    /*
     * Fallback calculation from current list.
     */

    if (!stats || Object.keys(stats).length === 0) {
      totalCount = state.totalRecords;

      totalReceived = payments.reduce(function (total, payment) {
        return total + getPaymentAmount(payment);
      }, 0);

      const remainingValues = payments.map(getRemainingAfter);

      outstanding = remainingValues.length ? Math.max(...remainingValues) : 0;

      const now = new Date();

      const currentYear = now.getFullYear();

      const currentMonthIndex = now.getMonth();

      currentMonth = payments.reduce(function (total, payment) {
        const raw = safeString(payment.payment_date);

        if (!raw) {
          return total;
        }

        const date = new Date(raw + "T00:00:00");

        if (Number.isNaN(date.getTime())) {
          return total;
        }

        if (
          date.getFullYear() === currentYear &&
          date.getMonth() === currentMonthIndex
        ) {
          return total + getPaymentAmount(payment);
        }

        return total;
      }, 0);
    }

    const countElement = byId("totalPaymentsCount");

    const receivedElement = byId("totalReceivedAmount");

    const outstandingElement = byId("totalOutstandingAmount");

    const monthElement = byId("currentMonthAmount");

    if (countElement) {
      countElement.textContent = String(totalCount);
    }

    if (receivedElement) {
      receivedElement.textContent = formatCurrency(totalReceived);
    }

    if (outstandingElement) {
      outstandingElement.textContent = formatCurrency(outstanding);
    }

    if (monthElement) {
      monthElement.textContent = formatCurrency(currentMonth);
    }
  }

  /* ============================================================
       PAGINATION
    ============================================================ */

  function renderPagination() {
    const container = byId("paymentPagination");

    const info = byId("paymentPaginationInfo");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const total = state.totalRecords;

    const page = state.currentPage;

    const perPage = state.perPage;

    if (info) {
      if (!total) {
        info.textContent = "Showing 0–0 of 0";
      } else {
        const start = (page - 1) * perPage + 1;

        const end = Math.min(page * perPage, total);

        info.textContent = "Showing " + start + "–" + end + " of " + total;
      }
    }

    if (state.totalPages <= 1) {
      return;
    }

    const previousPage = Math.max(1, page - 1);

    const nextPage = Math.min(state.totalPages, page + 1);

    container.insertAdjacentHTML(
      "beforeend",
      `
                <button
                    type="button"
                    class="cp-pagination-btn"
                    data-page="${previousPage}"
                    ${page <= 1 ? "disabled" : ""}
                    aria-label="Previous page"
                >
                    <i
                        class="bi bi-chevron-left"
                        aria-hidden="true"
                    ></i>
                </button>
            `,
    );

    const range = buildPaginationRange(page, state.totalPages);

    range.forEach(function (item) {
      if (item === "...") {
        container.insertAdjacentHTML(
          "beforeend",
          `
                            <span
                                class="cp-pagination-ellipsis"
                            >
                                …
                            </span>
                        `,
        );

        return;
      }

      container.insertAdjacentHTML(
        "beforeend",
        `
                        <button
                            type="button"
                            class="
                                cp-pagination-page
                                ${item === page ? "is-active" : ""}
                            "
                            data-page="${item}"
                            ${item === page ? 'aria-current="page"' : ""}
                        >
                            ${item}
                        </button>
                    `,
      );
    });

    container.insertAdjacentHTML(
      "beforeend",
      `
                <button
                    type="button"
                    class="cp-pagination-btn"
                    data-page="${nextPage}"
                    ${page >= state.totalPages ? "disabled" : ""}
                    aria-label="Next page"
                >
                    <i
                        class="bi bi-chevron-right"
                        aria-hidden="true"
                    ></i>
                </button>
            `,
    );
  }

  function buildPaginationRange(current, total) {
    if (total <= 7) {
      return Array.from(
        {
          length: total,
        },
        (_, index) => index + 1,
      );
    }

    const pages = [1];

    if (current > 4) {
      pages.push("...");
    }

    const start = Math.max(2, current - 1);

    const end = Math.min(total - 1, current + 1);

    for (let page = start; page <= end; page++) {
      pages.push(page);
    }

    if (current < total - 3) {
      pages.push("...");
    }

    pages.push(total);

    return pages;
  }

  /* ============================================================
       LOAD CLIENTS
    ============================================================ */

  async function loadClients() {
    if (state.loadingClients) {
      return;
    }

    state.loadingClients = true;

    try {
      const response = await apiRequest(ENDPOINTS.clients + "?per_page=1000", {
        method: "GET",

        cache: "no-store",
      });

      const fromApi = collectionFrom(response, ["clients", "items"]);

      if (fromApi.length > 0) {
        state.clients = fromApi;
      } else {
        throw new Error("No clients from API, falling back to localStorage.");
      }
    } catch (err) {
      warn("LOAD CLIENTS fallback to localStorage:", err.message);

      // ── localStorage fallback ──────────────────────────────────
      try {
        const raw = localStorage.getItem("tenspick_clients");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            state.clients = parsed;
          }
        }
      } catch (parseErr) {
        error("LOAD CLIENTS localStorage parse error:", parseErr);
      }
    } finally {
      state.loadingClients = false;
      populateClientFilters();
      populateAddClients();
    }
  }

  /* ============================================================
       POPULATE CLIENT FILTER
    ============================================================ */

  function populateClientFilters() {
    const select = byId("paymentClientFilter");

    if (!select) {
      return;
    }

    const current = select.value;

    select.innerHTML = `
                <option value="">
                    All Clients
                </option>
            `;

    state.clients
      .slice()
      .sort(function (a, b) {
        return safeString(a.client_name ?? a.name).localeCompare(
          safeString(b.client_name ?? b.name),
        );
      })
      .forEach(function (client) {
        const id = positiveId(client.id);

        if (!id) {
          return;
        }

        const name = safeString(
          client.client_name ?? client.name ?? "Unnamed Client",
        );

        select.insertAdjacentHTML(
          "beforeend",
          `
                            <option
                                value="${id}"
                            >
                                ${escapeHtml(name)}
                            </option>
                        `,
        );
      });

    if (current) {
      select.value = current;
    }
  }

  /* ============================================================
       POPULATE ADD CLIENTS
    ============================================================ */

  function populateAddClients() {
    const select = byId("addPaymentClient");

    if (!select) {
      return;
    }

    const current = select.value;

    select.innerHTML = `
                <option value="">
                    Select Client
                </option>
            `;

    state.clients
      .slice()
      .sort(function (a, b) {
        return safeString(a.client_name ?? a.name).localeCompare(
          safeString(b.client_name ?? b.name),
        );
      })
      .forEach(function (client) {
        const id = positiveId(client.id);

        if (!id) {
          return;
        }

        const name = safeString(
          client.client_name ?? client.name ?? "Unnamed Client",
        );

        const company = safeString(client.company_name);

        select.insertAdjacentHTML(
          "beforeend",
          `
                            <option
                                value="${id}"
                            >
                                ${escapeHtml(name)}${
                                  company ? " — " + escapeHtml(company) : ""
                                }
                            </option>
                        `,
        );
      });

    if (current) {
      select.value = current;
    }
  }

  /* ============================================================
       LOAD PROJECTS
    ============================================================ */

  async function loadProjectsForFilter() {
    if (state.loadingProjects) {
      return;
    }

    state.loadingProjects = true;

    try {
      const response = await apiRequest(ENDPOINTS.projects + "?per_page=1000", {
        method: "GET",

        cache: "no-store",
      });

      const fromApi = collectionFrom(response, ["projects", "items"]);

      if (fromApi.length > 0) {
        state.projects = fromApi;
      } else {
        throw new Error("No projects from API, falling back to localStorage.");
      }
    } catch (err) {
      warn("LOAD PROJECTS fallback to localStorage:", err.message);

      // ── localStorage fallback ──────────────────────────────────
      try {
        const raw = localStorage.getItem("tenspick_projects");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            state.projects = parsed;
          }
        }
      } catch (parseErr) {
        error("LOAD PROJECTS localStorage parse error:", parseErr);
      }
    } finally {
      state.loadingProjects = false;
      populateProjectFilter();
    }
  }

  /* ============================================================
       POPULATE PROJECT FILTER
    ============================================================ */

  function populateProjectFilter() {
    const select = byId("paymentProjectFilter");

    if (!select) {
      return;
    }

    const current = select.value;

    select.innerHTML = `
                <option value="">
                    All Projects
                </option>
            `;

    state.projects
      .slice()
      .sort(function (a, b) {
        return safeString(a.project_name ?? a.name).localeCompare(
          safeString(b.project_name ?? b.name),
        );
      })
      .forEach(function (project) {
        const id = positiveId(project.id ?? project.project_id);

        if (!id) {
          return;
        }

        const name = safeString(
          project.project_name ?? project.name ?? "Unnamed Project",
        );

        const code = safeString(project.project_code);

        select.insertAdjacentHTML(
          "beforeend",
          `
                            <option
                                value="${id}"
                            >
                                ${escapeHtml(name)}${
                                  code ? " — " + escapeHtml(code) : ""
                                }
                            </option>
                        `,
        );
      });

    if (current) {
      select.value = current;
    }
  }

  /* ============================================================
       LOAD PROJECTS FOR CLIENT
    ============================================================ */

  async function loadProjectsForClient(clientId) {
    const select = byId("addPaymentProject");

    if (!select) {
      return [];
    }

    const numericClientId = positiveId(clientId);

    if (!numericClientId) {
      select.disabled = true;

      select.innerHTML = `<option value="">Select Client First</option>`;

      hideProjectBalancePreview();

      return [];
    }

    select.disabled = true;
    select.innerHTML = `<option value="">Loading Projects...</option>`;

    const help = byId("paymentProjectHelp");
    if (help) help.textContent = "Loading projects for selected client...";

    // ── Helper to populate select from a projects array ──────────
    function fillProjectSelect(projects) {
      select.innerHTML = `<option value="">Select Project</option>`;

      if (!projects.length) {
        select.innerHTML = `<option value="">No Projects Found</option>`;
        if (help) help.textContent = "This client has no available projects.";
        select.disabled = true;
        hideProjectBalancePreview();
        return;
      }

      projects.forEach(function (project) {
        const id = positiveId(project.id ?? project.project_id);
        if (!id) return;

        const name = safeString(project.project_name ?? project.name ?? "Unnamed Project");
        const code = safeString(project.project_code);

        select.insertAdjacentHTML(
          "beforeend",
          `<option value="${id}">${escapeHtml(name)}${code ? " — " + escapeHtml(code) : ""}</option>`
        );
      });

      select.disabled = false;
      if (help) help.textContent = "Select the project receiving this payment.";
    }

    // ── localStorage fallback helper ─────────────────────────────
    function getLocalProjectsForClient(cId) {
      try {
        const raw = localStorage.getItem("tenspick_projects");
        if (!raw) return [];
        const all = JSON.parse(raw) || [];
        return all.filter(function (p) {
          const pClientId = String(p.client_id ?? p.clientId ?? "");
          return pClientId === String(cId);
        });
      } catch (e) {
        return [];
      }
    }

    try {
      const response = await apiRequest(
        ENDPOINTS.clients + "/" + encodeURIComponent(numericClientId) + "/payment-projects",
        { method: "GET", cache: "no-store" },
      );

      const projects = collectionFrom(response, ["projects", "items"]);

      // Cache into state
      projects.forEach(function (project) {
        const id = positiveId(project.id ?? project.project_id);
        if (!id) return;
        const existingIndex = state.projects.findIndex(
          (item) => String(item.id ?? item.project_id) === String(id),
        );
        if (existingIndex >= 0) {
          state.projects[existingIndex] = Object.assign({}, state.projects[existingIndex], project);
        } else {
          state.projects.push(project);
        }
      });

      if (!projects.length) {
        // Try localStorage fallback even when API returned empty
        const localProjects = getLocalProjectsForClient(numericClientId);
        fillProjectSelect(localProjects);
        return localProjects;
      }

      fillProjectSelect(projects);
      return projects;

    } catch (err) {
      warn("LOAD CLIENT PROJECTS API failed, trying localStorage:", err.message);

      // ── localStorage fallback ────────────────────────────────────
      const localProjects = getLocalProjectsForClient(numericClientId);

      if (localProjects.length > 0) {
        fillProjectSelect(localProjects);
        return localProjects;
      }

      // Also try state.projects (already loaded from localStorage earlier)
      const stateProjects = state.projects.filter(function (p) {
        const pClientId = String(p.client_id ?? p.clientId ?? "");
        return pClientId === String(numericClientId);
      });

      if (stateProjects.length > 0) {
        fillProjectSelect(stateProjects);
        return stateProjects;
      }

      // Final empty state
      select.innerHTML = `<option value="">No Projects Found</option>`;
      select.disabled = true;
      if (help) help.textContent = "No projects found for this client.";
      return [];
    }
  }

  /* ============================================================
       GET PROJECT
    ============================================================ */

  function findProject(projectId) {
    const numericId = positiveId(projectId);

    if (!numericId) {
      return null;
    }

    return (
      state.projects.find(function (project) {
        return String(project.id ?? project.project_id) === String(numericId);
      }) || null
    );
  }

  /* ============================================================
       PROJECT PAYMENT BALANCE
    ============================================================ */

  async function loadProjectPaymentBalance(projectId) {
    const numericProjectId = positiveId(projectId);

    if (!numericProjectId) {
      hideProjectBalancePreview();

      return null;
    }

    try {
      const response = await apiRequest(
        ENDPOINTS.projects +
          "/" +
          encodeURIComponent(numericProjectId) +
          "/payments",
        {
          method: "GET",

          cache: "no-store",
        },
      );

      const payments = collectionFrom(response, ["payments", "items"]);

      const project = findProject(numericProjectId);

      let projectAmount = safeNumber(project?.budget);

      if (!projectAmount) {
        projectAmount = safeNumber(
          responseData(response).project_budget ??
            responseData(response).budget ??
            responseData(response).project_amount,
        );
      }

      const paidBefore = payments.reduce(function (total, payment) {
        return total + getPaymentAmount(payment);
      }, 0);

      const remaining = Math.max(0, projectAmount - paidBefore);

      state.selectedProject = project
        ? Object.assign({}, project, {
            budget: projectAmount,
          })
        : {
            id: numericProjectId,

            budget: projectAmount,
          };

      paymentProjectPreview(state.selectedProject, paidBefore, remaining);

      return {
        project: state.selectedProject,

        payments,

        projectAmount,

        paidBefore,

        remaining,
      };
    } catch (err) {
      error("PROJECT BALANCE:", err);

      /*
       * Fallback to local project data.
       */

      const project = findProject(numericProjectId);

      if (project) {
        const projectAmount = safeNumber(project.budget);

        const paidBefore = safeNumber(
          project.total_paid ?? project.paid_amount ?? 0,
        );

        const remaining = Math.max(0, projectAmount - paidBefore);

        state.selectedProject = project;

        paymentProjectPreview(project, paidBefore, remaining);

        return {
          project,

          payments: [],

          projectAmount,

          paidBefore,

          remaining,
        };
      }

      throw err;
    }
  }

  /* ============================================================
       PROJECT BALANCE PREVIEW
    ============================================================ */

  function paymentProjectPreview(project, paidBefore, remaining) {
    const preview = byId("paymentProjectBalancePreview");

    if (!preview) {
      return;
    }

    preview.hidden = false;

    const name = byId("previewProjectName");

    const status = byId("previewProjectStatus");

    const amount = byId("previewProjectAmount");

    const paid = byId("previewPaidAmount");

    const remainingElement = byId("previewRemainingAmount");

    if (name) {
      name.textContent =
        safeString(project?.project_name ?? project?.name) || "Unnamed Project";
    }

    if (status) {
      status.textContent = projectStatusLabel(project?.status);

      status.className =
        "cp-status-badge cp-status-" +
        safeString(project?.status).toLowerCase();
    }

    if (amount) {
      amount.textContent = formatCurrency(
        project?.budget ?? project?.project_amount ?? 0,
      );
    }

    if (paid) {
      paid.textContent = formatCurrency(paidBefore);
    }

    if (remainingElement) {
      remainingElement.textContent = formatCurrency(remaining);
    }

    updatePaymentCalculation();
  }

  function hideProjectBalancePreview() {
    const preview = byId("paymentProjectBalancePreview");

    if (preview) {
      preview.hidden = true;
    }

    const calculation = byId("addPaymentCalculation");

    if (calculation) {
      calculation.hidden = true;
    }

    state.selectedProject = null;
  }

  /* ============================================================
       ADD PAYMENT CALCULATION
    ============================================================ */

  function updatePaymentCalculation() {
    const project = state.selectedProject;

    const amountInput = byId("addPaymentAmount");

    const calculation = byId("addPaymentCalculation");

    if (!project || !calculation) {
      if (calculation) {
        calculation.hidden = true;
      }

      return;
    }

    const projectAmount = safeNumber(
      project.budget ?? project.project_amount ?? project.project_budget,
    );

    const paidBefore = safeNumber(
      project.total_paid ?? project.paid_amount ?? project.paidBefore ?? 0,
    );

    const amount = safeNumber(amountInput?.value);

    const remainingAfter = projectAmount - paidBefore - amount;

    calculation.hidden = false;

    setText("calcProjectAmount", formatCurrency(projectAmount));

    setText("calcPaidBefore", formatCurrency(paidBefore));

    setText("calcCurrentPayment", formatCurrency(amount));

    setText("calcRemainingAfter", formatCurrency(Math.max(0, remainingAfter)));

    const currentPayment = byId("calcCurrentPayment");

    if (currentPayment) {
      currentPayment.classList.toggle(
        "cp-calculation-invalid",
        amount > projectAmount - paidBefore,
      );
    }

    const remainingElement = byId("calcRemainingAfter");

    if (remainingElement) {
      remainingElement.classList.toggle(
        "cp-calculation-invalid",
        remainingAfter < 0,
      );
    }
  }

  /* ============================================================
       TEXT
    ============================================================ */

  function setText(id, value) {
    const element = byId(id);

    if (element) {
      element.textContent = value;
    }
  }

  /* ============================================================
       DEFAULT PAYMENT DATE
    ============================================================ */

  function setDefaultPaymentDate() {
    const input = byId("addPaymentDate");

    if (!input) {
      return;
    }

    if (!input.value) {
      const now = new Date();

      const year = now.getFullYear();

      const month = String(now.getMonth() + 1).padStart(2, "0");

      const day = String(now.getDate()).padStart(2, "0");

      input.value = year + "-" + month + "-" + day;
    }
  }

  /* ============================================================
       REMARKS COUNTER
    ============================================================ */

  function updateRemarksCounter(inputId, counterId) {
    const input = byId(inputId);

    const counter = byId(counterId);

    if (!input || !counter) {
      return;
    }

    counter.textContent =
      String(input.value.length) + " / " + String(input.maxLength || 1000);
  }

  /* ============================================================
       FORM ERROR
    ============================================================ */

  function clearFieldErrors(form) {
    if (!form) {
      return;
    }

    $$(".cp-field-error", form).forEach(function (element) {
      element.textContent = "";
    });

    $$(".cp-form-control", form).forEach(function (element) {
      element.classList.remove("cp-input-error");
    });
  }

  function setFieldError(form, field, message) {
    if (!form) {
      return;
    }

    const errorElement = form.querySelector('[data-error-for="' + field + '"]');

    if (errorElement) {
      errorElement.textContent = message;
    }

    const input = form.querySelector("#" + field);

    if (input) {
      input.classList.add("cp-input-error");
    }
  }

  function showFormError(id, message) {
    const wrapper = byId(id);

    const messageElement = byId(id + "Message");

    if (messageElement) {
      messageElement.textContent = message;
    }

    if (wrapper) {
      wrapper.hidden = false;
    }
  }

  function hideFormError(id) {
    const wrapper = byId(id);

    if (wrapper) {
      wrapper.hidden = true;
    }
  }

  /* ============================================================
       VALIDATE ADD FORM
    ============================================================ */

  function validateAddPaymentForm() {
    const form = byId("addPaymentForm");

    const errors = {};

    const clientId = positiveId(byId("addPaymentClient")?.value);

    const projectId = positiveId(byId("addPaymentProject")?.value);

    const amount = safeNumber(byId("addPaymentAmount")?.value);

    const date = safeString(byId("addPaymentDate")?.value);

    const method = safeString(byId("addPaymentMethod")?.value);

    const transactionId = safeString(byId("addPaymentTransactionId")?.value);

    const purpose = safeString(byId("addPaymentPurpose")?.value);

    const remarks = safeString(byId("addPaymentRemarks")?.value);

    if (!clientId) {
      errors.client_id = "Please select a client.";
    }

    if (!projectId) {
      errors.project_id = "Please select a project.";
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      errors.amount = "Enter a valid payment amount.";
    }

    if (!date) {
      errors.payment_date = "Payment date is required.";
    }

    if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, method)) {
      errors.payment_method = "Please select a payment method.";
    }

    if (transactionId.length > 150) {
      errors.transaction_id = "Transaction ID cannot exceed 150 characters.";
    }

    if (purpose.length > 255) {
      errors.purpose = "Payment purpose cannot exceed 255 characters.";
    }

    if (remarks.length > 1000) {
      errors.remarks = "Remarks cannot exceed 1000 characters.";
    }

    const project = state.selectedProject || findProject(projectId);

    if (project && amount > 0) {
      const projectAmount = safeNumber(
        project.budget ?? project.project_amount ?? project.project_budget,
      );

      const paidBefore = safeNumber(
        project.total_paid ?? project.paid_amount ?? 0,
      );

      const remaining = projectAmount - paidBefore;

      if (projectAmount > 0 && amount > remaining) {
        errors.amount =
          "Payment cannot exceed the remaining project balance of " +
          formatCurrency(Math.max(0, remaining)) +
          ".";
      }
    }

    clearFieldErrors(form);

    Object.entries(errors).forEach(function ([field, message]) {
      setFieldError(form, field, message);
    });

    if (Object.keys(errors).length) {
      showFormError(
        "addPaymentFormError",
        "Please correct the highlighted fields.",
      );

      return {
        valid: false,

        errors,
      };
    }

    hideFormError("addPaymentFormError");

    return {
      valid: true,

      data: {
        client_id: clientId,

        project_id: projectId,

        amount: amount,

        payment_date: date,

        payment_method: method,

        transaction_id: transactionId,

        purpose: purpose,

        remarks: remarks,
      },
    };
  }

  /* ============================================================
       ADD PAYMENT
    ============================================================ */

  async function submitAddPayment() {
    if (state.submittingAdd) {
      return;
    }

    const validation = validateAddPaymentForm();

    if (!validation.valid) {
      return;
    }

    state.submittingAdd = true;

    setButtonLoading("savePaymentBtn", true, "Saving Payment...");

    try {
      await secureRequest(ENDPOINTS.payments, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify(validation.data),
      });

      showToast("Payment recorded successfully.", "success");

      closeModal("addPaymentModal");

      resetAddPaymentForm();

      await loadPayments(1);
    } catch (err) {
      error("ADD PAYMENT:", err);

      showFormError(
        "addPaymentFormError",
        err.message || "Unable to save payment.",
      );
    } finally {
      state.submittingAdd = false;

      setButtonLoading("savePaymentBtn", false, "Save Payment");
    }
  }

  /* ============================================================
       BUTTON LOADING
    ============================================================ */

  function setButtonLoading(id, loading, loadingText) {
    const button = byId(id);

    if (!button) {
      return;
    }

    button.disabled = loading;

    const span = button.querySelector("span");

    if (span) {
      if (!button.dataset.originalText) {
        button.dataset.originalText = span.textContent;
      }

      span.textContent = loading
        ? loadingText
        : button.dataset.originalText || loadingText;
    }
  }

  /* ============================================================
       RESET ADD FORM
    ============================================================ */

  function resetAddPaymentForm() {
    const form = byId("addPaymentForm");

    if (form) {
      form.reset();
    }

    clearFieldErrors(form);

    hideFormError("addPaymentFormError");

    const project = byId("addPaymentProject");

    if (project) {
      project.disabled = true;

      project.innerHTML = `
                    <option value="">
                        Select Client First
                    </option>
                `;
    }

    const help = byId("paymentProjectHelp");

    if (help) {
      help.textContent = "Select a client to load their projects.";
    }

    hideProjectBalancePreview();

    setDefaultPaymentDate();

    updateRemarksCounter("addPaymentRemarks", "addPaymentRemarksCount");
  }

  /* ============================================================
       OPEN ADD FORM
    ============================================================ */

  function openAddPayment() {
    closeAllPaymentMenus(false);

    resetAddPaymentForm();

    populateAddClients();

    openModal("addPaymentModal");
  }

  /* ============================================================
       GET PAYMENT
    ============================================================ */

  async function getPayment(paymentId) {
    const id = positiveId(paymentId);

    if (!id) {
      throw new Error("Invalid payment ID.");
    }

    const response = await apiRequest(
      ENDPOINTS.payments + "/" + encodeURIComponent(id),
      {
        method: "GET",

        cache: "no-store",
      },
    );

    const data = responseData(response);

    const payment =
      data.payment || (response && response.payment) || (data.id ? data : null);

    if (!payment) {
      throw new Error("Payment details not found.");
    }

    return payment;
  }

  /* ============================================================
       VIEW PAYMENT
    ============================================================ */

  async function openViewPayment(paymentId) {
    closeAllPaymentMenus(false);

    const content = byId("paymentViewContent");

    if (content) {
      content.innerHTML = `
                    <div class="cp-view-loading">

                        <span
                            class="cp-loading-spinner"
                        ></span>

                        <span>
                            Loading payment details...
                        </span>

                    </div>
                `;
    }

    openModal("viewPaymentModal");

    try {
      const payment = await getPayment(paymentId);

      state.currentPayment = payment;

      renderViewPayment(payment);
    } catch (err) {
      error("VIEW PAYMENT:", err);

      if (content) {
        content.innerHTML = `
                        <div class="cp-view-error">

                            <div
                                class="cp-view-error-icon"
                            >
                                <i
                                    class="bi bi-exclamation-triangle"
                                    aria-hidden="true"
                                ></i>
                            </div>

                            <h3>
                                Unable to Load Payment
                            </h3>

                            <p>
                                ${escapeHtml(
                                  err.message ||
                                    "Unable to load payment details.",
                                )}
                            </p>

                        </div>
                    `;
      }
    }
  }

  /* ============================================================
       RENDER VIEW PAYMENT
    ============================================================ */

  function renderViewPayment(payment) {
    const content = byId("paymentViewContent");

    if (!content) {
      return;
    }

    const code = getPaymentCode(payment);

    const client = getClientName(payment);

    const company = getCompanyName(payment);

    const project = getProjectName(payment);

    const projectCode = getProjectCodeFromPayment(payment);

    const amount = getPaymentAmount(payment);

    const paidBefore = getPaidBefore(payment);

    const paidAfter = getPaidAfter(payment);

    const remaining = getRemainingAfter(payment);

    const purpose = safeString(payment.purpose) || "—";

    const method = paymentMethodLabel(payment.payment_method);

    const transaction = safeString(payment.transaction_id) || "—";

    const remarks = safeString(payment.remarks) || "No remarks added.";

    const addedBy = safeString(
      payment.added_by_name ?? payment.added_by ?? "Admin",
    );

    content.innerHTML = `

                <div
                    class="cp-view-payment-header"
                >

                    <div
                        class="cp-view-payment-icon"
                    >
                        <i
                            class="bi bi-receipt"
                            aria-hidden="true"
                        ></i>
                    </div>

                    <div
                        class="cp-view-payment-heading"
                    >

                        <span
                            class="cp-view-payment-eyebrow"
                        >
                            PAYMENT RECORD
                        </span>

                        <h3>
                            ${escapeHtml(code)}
                        </h3>

                        <p>
                            ${escapeHtml(client)}
                        </p>

                    </div>

                    <div
                        class="cp-view-payment-amount"
                    >

                        <span>
                            Payment Amount
                        </span>

                        <strong>
                            ${formatCurrency(amount)}
                        </strong>

                    </div>

                </div>


                <section
                    class="cp-view-section"
                >

                    <div
                        class="cp-view-section-title"
                    >

                        <i
                            class="bi bi-person-vcard"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Client & Project
                        </span>

                    </div>


                    <div
                        class="cp-view-grid"
                    >

                        ${renderViewField("Client", client, "bi-person")}

                        ${renderViewField(
                          "Company",
                          company || "—",
                          "bi-building",
                        )}

                        ${renderViewField(
                          "Project",
                          project,
                          "bi-folder2-open",
                        )}

                        ${renderViewField(
                          "Project Code",
                          projectCode || "—",
                          "bi-hash",
                        )}

                    </div>

                </section>


                <section
                    class="cp-view-section"
                >

                    <div
                        class="cp-view-section-title"
                    >

                        <i
                            class="bi bi-wallet2"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Payment Information
                        </span>

                    </div>


                    <div
                        class="cp-view-grid"
                    >

                        ${renderViewField(
                          "Payment Date",
                          formatDate(payment.payment_date),
                          "bi-calendar3",
                        )}

                        ${renderViewField(
                          "Payment Method",
                          method,
                          "bi-credit-card",
                        )}

                        ${renderViewField(
                          "Transaction ID",
                          transaction,
                          "bi-upc-scan",
                        )}

                        ${renderViewField(
                          "Payment Purpose",
                          purpose,
                          "bi-card-text",
                        )}

                    </div>

                </section>


                <section
                    class="cp-view-financial-card"
                >

                    <div
                        class="cp-view-financial-header"
                    >

                        <div>

                            <span>
                                BALANCE SNAPSHOT
                            </span>

                            <h3>
                                Historical Payment Position
                            </h3>

                        </div>

                        <i
                            class="bi bi-bar-chart-line"
                            aria-hidden="true"
                        ></i>

                    </div>


                    <div
                        class="cp-view-financial-grid"
                    >

                        <div>

                            <span>
                                Project Amount
                            </span>

                            <strong>
                                ${formatCurrency(getProjectAmount(payment))}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Paid Before
                            </span>

                            <strong>
                                ${formatCurrency(paidBefore)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Paid After
                            </span>

                            <strong
                                class="cp-paid"
                            >
                                ${formatCurrency(paidAfter)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Remaining
                            </span>

                            <strong
                                class="${
                                  remaining > 0 ? "cp-remaining" : "cp-paid"
                                }"
                            >
                                ${formatCurrency(remaining)}
                            </strong>

                        </div>

                    </div>

                </section>


                <section
                    class="cp-view-section"
                >

                    <div
                        class="cp-view-section-title"
                    >

                        <i
                            class="bi bi-chat-left-text"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Additional Information
                        </span>

                    </div>


                    <div
                        class="cp-view-detail-block"
                    >

                        <div>

                            <span>
                                Added By
                            </span>

                            <strong>
                                ${escapeHtml(addedBy)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Remarks
                            </span>

                            <p>
                                ${escapeHtml(remarks).replace(/\n/g, "<br>")}
                            </p>

                        </div>

                    </div>

                </section>

            `;
  }

  function renderViewField(label, value, icon) {
    return `

            <div
                class="cp-view-field"
            >

                <span>

                    <i
                        class="bi ${escapeHtml(icon)}"
                        aria-hidden="true"
                    ></i>

                    ${escapeHtml(label)}

                </span>

                <strong>
                    ${escapeHtml(value)}
                </strong>

            </div>

        `;
  }

  /* ============================================================
       EDIT PAYMENT
    ============================================================ */

  async function openEditPayment(paymentId) {
    closeAllPaymentMenus(false);

    try {
      const payment = await getPayment(paymentId);

      state.currentPayment = payment;

      fillEditPayment(payment);

      openModal("editPaymentModal");
    } catch (err) {
      error("EDIT PAYMENT:", err);

      showToast(err.message || "Unable to load payment.", "error");
    }
  }

  /* ============================================================
       FILL EDIT PAYMENT
    ============================================================ */

  function fillEditPayment(payment) {
    setText("editPaymentCode", getPaymentCode(payment));

    setText("editPaymentClient", getClientName(payment));

    setText("editPaymentProject", getProjectName(payment));

    setText(
      "editPaymentAmountDisplay",
      formatCurrency(getPaymentAmount(payment)),
    );

    setText("editPaymentDateDisplay", formatDate(payment.payment_date));

    setText(
      "editPaymentMethodDisplay",
      paymentMethodLabel(payment.payment_method),
    );

    const idInput = byId("editPaymentId");

    const purpose = byId("editPaymentPurpose");

    const transaction = byId("editPaymentTransactionId");

    const remarks = byId("editPaymentRemarks");

    if (idInput) {
      idInput.value = getPaymentId(payment) || "";
    }

    if (purpose) {
      purpose.value = safeString(payment.purpose);
    }

    if (transaction) {
      transaction.value = safeString(payment.transaction_id);
    }

    if (remarks) {
      remarks.value = safeString(payment.remarks);
    }

    clearFieldErrors(byId("editPaymentForm"));

    hideFormError("editPaymentFormError");

    updateRemarksCounter("editPaymentRemarks", "editPaymentRemarksCount");
  }

  /* ============================================================
       SUBMIT EDIT
    ============================================================ */

  async function submitEditPayment() {
    if (state.submittingEdit) {
      return;
    }

    const id = positiveId(byId("editPaymentId")?.value);

    if (!id) {
      showFormError("editPaymentFormError", "Payment ID is missing.");

      return;
    }

    const form = byId("editPaymentForm");

    const purpose = safeString(byId("editPaymentPurpose")?.value);

    const transactionId = safeString(byId("editPaymentTransactionId")?.value);

    const remarks = safeString(byId("editPaymentRemarks")?.value);

    clearFieldErrors(form);

    let valid = true;

    if (purpose.length > 255) {
      setFieldError(
        form,
        "editPaymentPurpose",
        "Payment purpose cannot exceed 255 characters.",
      );

      valid = false;
    }

    if (transactionId.length > 150) {
      setFieldError(
        form,
        "editPaymentTransactionId",
        "Transaction ID cannot exceed 150 characters.",
      );

      valid = false;
    }

    if (remarks.length > 1000) {
      setFieldError(
        form,
        "editPaymentRemarks",
        "Remarks cannot exceed 1000 characters.",
      );

      valid = false;
    }

    if (!valid) {
      showFormError(
        "editPaymentFormError",
        "Please correct the highlighted fields.",
      );

      return;
    }

    hideFormError("editPaymentFormError");

    state.submittingEdit = true;

    setButtonLoading("updatePaymentBtn", true, "Updating Payment...");

    try {
      await secureRequest(ENDPOINTS.payments + "/" + encodeURIComponent(id), {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          purpose: purpose,

          transaction_id: transactionId,

          remarks: remarks,
        }),
      });

      showToast("Payment information updated successfully.", "success");

      closeModal("editPaymentModal");

      await loadPayments(state.currentPage);

      /*
       * Refresh currently viewed payment if needed.
       */

      if (state.currentPayment && getPaymentId(state.currentPayment) === id) {
        try {
          state.currentPayment = await getPayment(id);
        } catch (err) {
          /*
           * Ignore refresh error.
           */
        }
      }
    } catch (err) {
      error("EDIT PAYMENT:", err);

      showFormError(
        "editPaymentFormError",
        err.message || "Unable to update payment.",
      );
    } finally {
      state.submittingEdit = false;

      setButtonLoading("updatePaymentBtn", false, "Update Payment");
    }
  }

  /* ============================================================
       PAYMENT RECEIPT
    ============================================================ */

  async function openPaymentReceipt(paymentId) {
    closeAllPaymentMenus(false);

    const content = byId("paymentReceiptContent");

    if (content) {
      content.innerHTML = `
                    <div
                        class="cp-receipt-loading"
                    >

                        <span
                            class="cp-loading-spinner"
                        ></span>

                        <span>
                            Preparing receipt...
                        </span>

                    </div>
                `;
    }

    state.currentReceiptType = "individual";

    openModal("paymentReceiptModal");

    try {
      const payment = await getPayment(paymentId);

      state.currentPayment = payment;

      state.currentReceiptPayment = payment;

      renderPaymentReceipt(payment);
    } catch (err) {
      error("RECEIPT:", err);

      if (content) {
        content.innerHTML = `
                        <div
                            class="cp-receipt-error"
                        >

                            <div>
                                <i
                                    class="bi bi-exclamation-triangle"
                                    aria-hidden="true"
                                ></i>
                            </div>

                            <h3>
                                Unable to Prepare Receipt
                            </h3>

                            <p>
                                ${escapeHtml(
                                  err.message || "Unable to generate receipt.",
                                )}
                            </p>

                        </div>
                    `;
      }
    }
  }

  /* ============================================================
       RENDER RECEIPT
    ============================================================ */

  function renderPaymentReceipt(payment) {
    const content = byId("paymentReceiptContent");

    if (!content) {
      return;
    }

    const html = buildReceiptHTML(payment, false);

    content.innerHTML = html;
  }

  /* ============================================================
       BUILD RECEIPT HTML
    ============================================================ */

  function buildReceiptHTML(payment, includeHistory, historyPayments) {
    const paymentCode = getPaymentCode(payment);

    const clientName = getClientName(payment);

    const companyName = getCompanyName(payment);

    const projectName = getProjectName(payment);

    const projectCode = getProjectCodeFromPayment(payment);

    const amount = getPaymentAmount(payment);

    const projectAmount = getProjectAmount(payment);

    const paidBefore = getPaidBefore(payment);

    const paidAfter = getPaidAfter(payment);

    const remaining = getRemainingAfter(payment);

    const method = paymentMethodLabel(payment.payment_method);

    const purpose = safeString(payment.purpose) || "—";

    const transactionId = safeString(payment.transaction_id) || "—";

    const remarks = safeString(payment.remarks) || "—";

    const addedBy = safeString(
      payment.added_by_name ?? payment.added_by ?? "Admin",
    );

    const clientMobile = safeString(
      payment.client_mobile ?? payment.mobile ?? payment.client?.mobile,
    );

    const clientEmail = safeString(
      payment.client_email ?? payment.email ?? payment.client?.email,
    );

    const clientAddress = safeString(
      payment.client_address ?? payment.address ?? payment.client?.address,
    );

    const status =
      remaining <= 0 && projectAmount > 0
        ? "Paid"
        : paidAfter > 0
          ? "Partially Paid"
          : "Unpaid";

    const history = Array.isArray(historyPayments) ? historyPayments : [];

    return `

            <article
                class="cp-receipt-document"
            >

                <header
                    class="cp-receipt-header"
                >

                    <div
                        class="cp-receipt-brand"
                    >

                        <div
                            class="cp-receipt-logo"
                        >

                            <img
                                src="${escapeHtml(COMPANY.logo)}"
                                alt="Tenspick"
                                onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                            >

                            <span
                                class="cp-receipt-logo-fallback"
                            >
                                T
                            </span>

                        </div>


                        <div
                            class="cp-receipt-company"
                        >

                            <h1>
                                ${escapeHtml(COMPANY.name)}
                            </h1>

                            <p>
                                ${escapeHtml(COMPANY.address)}
                            </p>

                            <p>
                                Mobile:
                                ${escapeHtml(COMPANY.mobile)}
                            </p>

                            <p>
                                ${escapeHtml(COMPANY.website)}
                            </p>

                        </div>

                    </div>


                    <div
                        class="cp-receipt-title-block"
                    >

                        <span>
                            OFFICIAL RECEIPT
                        </span>

                        <h2>
                            PAYMENT RECEIPT
                        </h2>

                        <strong>
                            ${escapeHtml(paymentCode)}
                        </strong>

                    </div>

                </header>


                <div
                    class="cp-receipt-status-bar"
                >

                    <div>

                        <span>
                            Payment Status
                        </span>

                        <strong>
                            ${escapeHtml(status)}
                        </strong>

                    </div>


                    <div
                        class="cp-receipt-amount"
                    >

                        <span>
                            Amount Received
                        </span>

                        <strong>
                            ${formatCurrency(amount)}
                        </strong>

                    </div>

                </div>


                <section
                    class="cp-receipt-section"
                >

                    <div
                        class="cp-receipt-section-title"
                    >
                        Client Information
                    </div>


                    <div
                        class="cp-receipt-grid"
                    >

                        <div>

                            <span>
                                Client Name
                            </span>

                            <strong>
                                ${escapeHtml(clientName)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Company
                            </span>

                            <strong>
                                ${escapeHtml(companyName || "—")}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Mobile
                            </span>

                            <strong>
                                ${escapeHtml(clientMobile || "—")}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Email
                            </span>

                            <strong>
                                ${escapeHtml(clientEmail || "—")}
                            </strong>

                        </div>


                        <div
                            class="cp-receipt-grid-full"
                        >

                            <span>
                                Address
                            </span>

                            <strong>
                                ${escapeHtml(clientAddress || "—")}
                            </strong>

                        </div>

                    </div>

                </section>


                <section
                    class="cp-receipt-section"
                >

                    <div
                        class="cp-receipt-section-title"
                    >
                        Project Information
                    </div>


                    <div
                        class="cp-receipt-grid"
                    >

                        <div>

                            <span>
                                Project
                            </span>

                            <strong>
                                ${escapeHtml(projectName)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Project Code
                            </span>

                            <strong>
                                ${escapeHtml(projectCode || "—")}
                            </strong>

                        </div>

                    </div>

                </section>


                <section
                    class="cp-receipt-section"
                >

                    <div
                        class="cp-receipt-section-title"
                    >
                        Payment Details
                    </div>


                    <div
                        class="cp-receipt-details"
                    >

                        <div>

                            <span>
                                Payment ID
                            </span>

                            <strong>
                                ${escapeHtml(paymentCode)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Payment Date
                            </span>

                            <strong>
                                ${formatDate(payment.payment_date)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Payment Method
                            </span>

                            <strong>
                                ${escapeHtml(method)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Transaction ID
                            </span>

                            <strong>
                                ${escapeHtml(transactionId)}
                            </strong>

                        </div>


                        <div
                            class="cp-receipt-detail-full"
                        >

                            <span>
                                Payment Purpose
                            </span>

                            <strong>
                                ${escapeHtml(purpose)}
                            </strong>

                        </div>

                    </div>

                </section>


                <section
                    class="cp-receipt-balance"
                >

                    <div
                        class="cp-receipt-section-title"
                    >
                        Balance Snapshot
                    </div>


                    <div
                        class="cp-receipt-balance-grid"
                    >

                        <div>

                            <span>
                                Project Amount
                            </span>

                            <strong>
                                ${formatCurrency(projectAmount)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Paid Before
                            </span>

                            <strong>
                                ${formatCurrency(paidBefore)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                This Payment
                            </span>

                            <strong
                                class="cp-receipt-paid"
                            >
                                ${formatCurrency(amount)}
                            </strong>

                        </div>


                        <div>

                            <span>
                                Paid After
                            </span>

                            <strong
                                class="cp-receipt-paid"
                            >
                                ${formatCurrency(paidAfter)}
                            </strong>

                        </div>


                        <div
                            class="cp-receipt-balance-total"
                        >

                            <span>
                                Remaining Amount
                            </span>

                            <strong>
                                ${formatCurrency(remaining)}
                            </strong>

                        </div>

                    </div>

                </section>


                ${
                  remarks !== "—"
                    ? `
                            <section
                                class="cp-receipt-remarks"
                            >

                                <span>
                                    Remarks
                                </span>

                                <p>
                                    ${escapeHtml(remarks).replace(
                                      /\n/g,
                                      "<br>",
                                    )}
                                </p>

                            </section>
                        `
                    : ""
                }


                ${
                  includeHistory && history.length
                    ? `
                            <section
                                class="cp-receipt-history"
                            >

                                <div
                                    class="cp-receipt-section-title"
                                >
                                    Payment History
                                </div>


                                <table>

                                    <thead>

                                        <tr>

                                            <th>
                                                Payment ID
                                            </th>

                                            <th>
                                                Date
                                            </th>

                                            <th>
                                                Purpose
                                            </th>

                                            <th>
                                                Method
                                            </th>

                                            <th>
                                                Amount
                                            </th>

                                            <th>
                                                Remaining
                                            </th>

                                        </tr>

                                    </thead>


                                    <tbody>

                                        ${history
                                          .map(function (item) {
                                            return `
                                                        <tr>

                                                            <td>
                                                                ${escapeHtml(
                                                                  getPaymentCode(
                                                                    item,
                                                                  ),
                                                                )}
                                                            </td>

                                                            <td>
                                                                ${formatDate(
                                                                  item.payment_date,
                                                                )}
                                                            </td>

                                                            <td>
                                                                ${escapeHtml(
                                                                  safeString(
                                                                    item.purpose,
                                                                  ) || "—",
                                                                )}
                                                            </td>

                                                            <td>
                                                                ${escapeHtml(
                                                                  paymentMethodLabel(
                                                                    item.payment_method,
                                                                  ),
                                                                )}
                                                            </td>

                                                            <td>
                                                                ${formatCurrency(
                                                                  getPaymentAmount(
                                                                    item,
                                                                  ),
                                                                )}
                                                            </td>

                                                            <td>
                                                                ${formatCurrency(
                                                                  getRemainingAfter(
                                                                    item,
                                                                  ),
                                                                )}
                                                            </td>

                                                        </tr>
                                                    `;
                                          })
                                          .join("")}

                                    </tbody>

                                </table>

                            </section>
                        `
                    : ""
                }


                <footer
                    class="cp-receipt-footer"
                >

                    <div>

                        <strong>
                            ${escapeHtml(COMPANY.name)}
                        </strong>

                        <span>
                            ${escapeHtml(COMPANY.address)}
                        </span>

                    </div>


                    <div>

                        <span>
                            Mobile:
                            ${escapeHtml(COMPANY.mobile)}
                        </span>

                        <span>
                            ${escapeHtml(COMPANY.website)}
                        </span>

                    </div>


                    <div
                        class="cp-receipt-issued"
                    >

                        <span>
                            Added By
                        </span>

                        <strong>
                            ${escapeHtml(addedBy)}
                        </strong>

                    </div>

                </footer>


                <div
                    class="cp-receipt-thank-you"
                >
                    Thank you for your payment.
                </div>

            </article>

        `;
  }

  /* ============================================================
       CLIENT HISTORY
    ============================================================ */

  async function openPaymentHistoryById(paymentId) {
    try {
      const payment = await getPayment(paymentId);

      const clientId = getPaymentClientId(payment);

      if (!clientId) {
        throw new Error("Client information is unavailable.");
      }

      await openClientPaymentHistory(clientId, payment);
    } catch (err) {
      error("HISTORY BY PAYMENT:", err);

      showToast(err.message || "Unable to load payment history.", "error");
    }
  }

  async function openClientPaymentHistory(clientId, selectedPayment) {
    const numericClientId = positiveId(clientId);

    if (!numericClientId) {
      showToast("Invalid client ID.", "error");

      return;
    }

    closeAllPaymentMenus(false);

    state.currentHistoryClient =
      state.clients.find(function (client) {
        return String(client.id) === String(numericClientId);
      }) || null;

    const body = byId("clientPaymentHistoryBody");

    if (body) {
      body.innerHTML = `
                    <tr>

                        <td
                            colspan="8"
                            class="cp-loading-state"
                        >

                            <div
                                class="cp-loading-content"
                            >

                                <span
                                    class="cp-loading-spinner"
                                ></span>

                                <span>
                                    Loading payment history...
                                </span>

                            </div>

                        </td>

                    </tr>
                `;
    }

    const historyError = byId("paymentHistoryError");

    if (historyError) {
      historyError.hidden = true;
    }

    openModal("clientPaymentHistoryModal");

    try {
      const response = await apiRequest(
        ENDPOINTS.clients +
          "/" +
          encodeURIComponent(numericClientId) +
          "/payments",
        {
          method: "GET",

          cache: "no-store",
        },
      );

      const payments = collectionFrom(response, ["payments", "items"]);

      state.currentHistoryPayments = payments;

      renderClientPaymentHistory(state.currentHistoryClient, payments);

      /*
       * Keep selected payment if available.
       */

      if (selectedPayment) {
        state.currentPayment = selectedPayment;
      }
    } catch (err) {
      error("CLIENT HISTORY:", err);

      if (historyError) {
        historyError.hidden = false;
      }

      setText(
        "paymentHistoryErrorMessage",
        err.message || "Unable to load payment history.",
      );

      if (body) {
        body.innerHTML = `
                        <tr>

                            <td
                                colspan="8"
                                class="cp-error-state"
                            >

                                <div
                                    class="cp-error-icon"
                                >
                                    <i
                                        class="bi bi-exclamation-triangle"
                                        aria-hidden="true"
                                    ></i>
                                </div>

                                <h3>
                                    Unable to Load History
                                </h3>

                                <p>
                                    ${escapeHtml(
                                      err.message ||
                                        "Unable to load payment history.",
                                    )}
                                </p>

                            </td>

                        </tr>
                    `;
      }
    }
  }

  /* ============================================================
       RENDER HISTORY
    ============================================================ */

  function renderClientPaymentHistory(client, payments) {
    const body = byId("clientPaymentHistoryBody");

    if (!body) {
      return;
    }

    const clientName =
      safeString(client?.client_name ?? client?.name) ||
      (payments[0] ? getClientName(payments[0]) : "Client");

    const company =
      safeString(client?.company_name) ||
      (payments[0] ? getCompanyName(payments[0]) : "");

    setText("historyClientName", clientName);

    setText("historyClientCompany", company || "—");

    setText(
      "clientPaymentHistorySubtitle",
      "Complete payment history for " + clientName,
    );

    let totalProjectValue = 0;

    let totalPaid = 0;

    let totalRemaining = 0;

    payments.forEach(function (payment) {
      totalProjectValue += getProjectAmount(payment);

      totalPaid += getPaymentAmount(payment);
    });

    /*
     * When multiple payments belong to
     * the same project, don't multiply
     * project amount.
     */

    const projectAmounts = new Map();

    payments.forEach(function (payment) {
      const projectId = getPaymentProjectId(payment);

      if (projectId) {
        if (!projectAmounts.has(String(projectId))) {
          projectAmounts.set(String(projectId), getProjectAmount(payment));
        }
      }
    });

    if (projectAmounts.size) {
      totalProjectValue = Array.from(projectAmounts.values()).reduce(
        (total, value) => total + safeNumber(value),
        0,
      );
    }

    /*
     * For client history, the last
     * payment snapshot is the most
     * useful historical remaining value.
     */

    if (payments.length) {
      const sorted = payments.slice().sort(function (a, b) {
        return safeString(b.payment_date).localeCompare(
          safeString(a.payment_date),
        );
      });

      totalRemaining = getRemainingAfter(sorted[0]);
    } else {
      totalRemaining = Math.max(0, totalProjectValue - totalPaid);
    }

    setText("historyTotalProjectValue", formatCurrency(totalProjectValue));

    setText("historyTotalPaid", formatCurrency(totalPaid));

    setText("historyTotalRemaining", formatCurrency(totalRemaining));

    setText("historyPaymentCount", String(payments.length));

    if (!payments.length) {
      body.innerHTML = `
                    <tr>

                        <td
                            colspan="8"
                            class="cp-empty-state"
                        >

                            <div
                                class="cp-empty-icon"
                            >
                                <i
                                    class="bi bi-receipt-cutoff"
                                    aria-hidden="true"
                                ></i>
                            </div>

                            <h3>
                                No Payment History
                            </h3>

                            <p>
                                No payments have been recorded for this client.
                            </p>

                        </td>

                    </tr>
                `;

      return;
    }

    body.innerHTML = payments
      .map(function (payment) {
        const remaining = getRemainingAfter(payment);

        return `

                            <tr>

                                <td>

                                    <strong
                                        class="cp-payment-code"
                                    >
                                        ${escapeHtml(getPaymentCode(payment))}
                                    </strong>

                                </td>


                                <td>
                                    ${formatDate(payment.payment_date)}
                                </td>


                                <td>

                                    <strong>
                                        ${escapeHtml(getProjectName(payment))}
                                    </strong>

                                    ${
                                      getProjectCodeFromPayment(payment)
                                        ? `
                                                <small
                                                    class="cp-history-project-code"
                                                >
                                                    ${escapeHtml(
                                                      getProjectCodeFromPayment(
                                                        payment,
                                                      ),
                                                    )}
                                                </small>
                                            `
                                        : ""
                                    }

                                </td>


                                <td>

                                    <span
                                        class="cp-history-purpose"
                                    >
                                        ${escapeHtml(
                                          safeString(payment.purpose) || "—",
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <span
                                        class="
                                            cp-badge
                                            cp-badge-${
                                              safeString(
                                                payment.payment_method,
                                              ).toLowerCase() ===
                                              "bank_transfer"
                                                ? "bank"
                                                : safeString(
                                                    payment.payment_method,
                                                  ).toLowerCase() || "other"
                                            }
                                        "
                                    >
                                        ${escapeHtml(
                                          paymentMethodLabel(
                                            payment.payment_method,
                                          ),
                                        )}
                                    </span>

                                </td>


                                <td>

                                    <strong
                                        class="cp-amount"
                                    >
                                        ${formatCurrency(
                                          getPaymentAmount(payment),
                                        )}
                                    </strong>

                                </td>


                                <td>

                                    <strong
                                        class="cp-paid"
                                    >
                                        ${formatCurrency(getPaidAfter(payment))}
                                    </strong>

                                </td>


                                <td>

                                    <strong
                                        class="${
                                          remaining > 0
                                            ? "cp-remaining"
                                            : "cp-paid"
                                        }"
                                    >
                                        ${formatCurrency(remaining)}
                                    </strong>

                                </td>

                            </tr>

                        `;
      })
      .join("");
  }

  /* ============================================================
       HISTORY RECEIPT
    ============================================================ */

  async function openHistoryReceipt() {
    if (!state.currentPayment) {
      showToast("Select a payment first.", "warning");

      return;
    }

    const payment = state.currentPayment;

    const clientId = getPaymentClientId(payment);

    if (!clientId) {
      showToast("Client information is unavailable.", "error");

      return;
    }

    try {
      const response = await apiRequest(
        ENDPOINTS.clients + "/" + encodeURIComponent(clientId) + "/payments",
        {
          method: "GET",

          cache: "no-store",
        },
      );

      const history = collectionFrom(response, ["payments", "items"]);

      state.currentReceiptType = "history";

      state.currentReceiptPayment = payment;

      const content = byId("paymentReceiptContent");

      if (content) {
        content.innerHTML = buildReceiptHTML(payment, true, history);
      }

      openModal("paymentReceiptModal");
    } catch (err) {
      error("HISTORY RECEIPT:", err);

      showToast(err.message || "Unable to prepare payment history.", "error");
    }
  }

  /* ============================================================
       PRINT RECEIPT
    ============================================================ */

  function printCurrentReceipt() {
    const payment = state.currentReceiptPayment || state.currentPayment;

    if (!payment) {
      showToast("Receipt data is not available.", "warning");

      return;
    }

    let content;

    if (state.currentReceiptType === "history") {
      /*
       * History receipt requires already
       * rendered receipt HTML.
       */

      content =
        byId("paymentReceiptContent")?.innerHTML ||
        buildReceiptHTML(payment, false);
    } else {
      content = buildReceiptHTML(payment, false);
    }

    printHtmlDocument(
      state.currentReceiptType === "history"
        ? "TENSPICK Payment History"
        : "TENSPICK Payment Receipt",
      content,
    );
  }

  /* ============================================================
       DOWNLOAD RECEIPT
    ============================================================ */

  function downloadCurrentReceipt() {
    const payment = state.currentReceiptPayment || state.currentPayment;

    if (!payment) {
      showToast("Receipt data is not available.", "warning");

      return;
    }

    const content =
      byId("paymentReceiptContent")?.innerHTML ||
      buildReceiptHTML(payment, false);

    const html = buildPrintableDocument(
      state.currentReceiptType === "history"
        ? "TENSPICK Payment History"
        : "TENSPICK Payment Receipt",
      content,
    );

    const filename = sanitizeFilename(
      getPaymentCode(payment) +
        (state.currentReceiptType === "history" ? "-history" : "-receipt") +
        ".html",
    );

    downloadTextFile(html, filename);

    showToast("Payment document downloaded successfully.", "success");
  }

  /* ============================================================
       PRINT CLIENT HISTORY
    ============================================================ */

  function printClientPaymentHistory() {
    if (!state.currentHistoryPayments.length) {
      showToast("No payment history available to print.", "warning");

      return;
    }

    const payment = state.currentHistoryPayments[0];

    const content = buildReceiptHTML(
      payment,
      true,
      state.currentHistoryPayments,
    );

    printHtmlDocument("TENSPICK Client Payment History", content);
  }

  /* ============================================================
       DOWNLOAD CLIENT HISTORY
    ============================================================ */

  function downloadClientPaymentHistory() {
    if (!state.currentHistoryPayments.length) {
      showToast("No payment history available to download.", "warning");

      return;
    }

    const payment = state.currentHistoryPayments[0];

    const content = buildReceiptHTML(
      payment,
      true,
      state.currentHistoryPayments,
    );

    const html = buildPrintableDocument(
      "TENSPICK Client Payment History",
      content,
    );

    downloadTextFile(
      html,
      sanitizeFilename(
        getPaymentCode(payment) + "-client-payment-history.html",
      ),
    );

    showToast("Payment history downloaded successfully.", "success");
  }

  /* ============================================================
       PRINTABLE DOCUMENT
    ============================================================ */

  function buildPrintableDocument(title, content) {
    return `

            <!DOCTYPE html>

            <html lang="en">

            <head>

                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >

                <title>
                    ${escapeHtml(title)}
                </title>


                <style>

                    * {
                        box-sizing: border-box;
                    }

                    html,
                    body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                        color: #172033;
                        font-family:
                            Arial,
                            Helvetica,
                            sans-serif;
                    }

                    body {
                        padding: 18mm;
                    }

                    .cp-receipt-document {
                        width: 100%;
                        max-width: 190mm;
                        margin: 0 auto;
                        background: #ffffff;
                    }

                    .cp-receipt-header {
                        display: flex;
                        justify-content: space-between;
                        gap: 20px;
                        padding-bottom: 18px;
                        border-bottom: 2px solid #4b49ac;
                    }

                    .cp-receipt-brand {
                        display: flex;
                        gap: 12px;
                        align-items: center;
                    }

                    .cp-receipt-logo {
                        width: 52px;
                        height: 52px;
                        border-radius: 10px;
                        overflow: hidden;
                        border: 1px solid #e5e7eb;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .cp-receipt-logo img {
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                    }

                    .cp-receipt-logo-fallback {
                        display: none;
                        width: 100%;
                        height: 100%;
                        align-items: center;
                        justify-content: center;
                        font-size: 26px;
                        font-weight: 800;
                        color: #4b49ac;
                    }

                    .cp-receipt-company h1 {
                        margin: 0 0 4px;
                        font-size: 21px;
                    }

                    .cp-receipt-company p {
                        margin: 2px 0;
                        color: #64748b;
                        font-size: 9px;
                    }

                    .cp-receipt-title-block {
                        text-align: right;
                    }

                    .cp-receipt-title-block span {
                        display: block;
                        color: #4b49ac;
                        font-size: 9px;
                        font-weight: 800;
                        letter-spacing: 1px;
                    }

                    .cp-receipt-title-block h2 {
                        margin: 5px 0;
                        font-size: 18px;
                    }

                    .cp-receipt-title-block strong {
                        font-size: 11px;
                    }

                    .cp-receipt-status-bar {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin: 15px 0;
                        padding: 13px 15px;
                        background: #f5f5ff;
                        border: 1px solid #e4e3f8;
                        border-radius: 9px;
                    }

                    .cp-receipt-status-bar span,
                    .cp-receipt-amount span {
                        display: block;
                        color: #64748b;
                        font-size: 9px;
                    }

                    .cp-receipt-status-bar strong {
                        display: block;
                        margin-top: 3px;
                        font-size: 12px;
                    }

                    .cp-receipt-amount {
                        text-align: right;
                    }

                    .cp-receipt-amount strong {
                        font-size: 17px;
                        color: #4b49ac;
                    }

                    .cp-receipt-section {
                        margin-top: 14px;
                    }

                    .cp-receipt-section-title {
                        margin-bottom: 8px;
                        padding-bottom: 6px;
                        border-bottom: 1px solid #e5e7eb;
                        color: #4b49ac;
                        font-size: 10px;
                        font-weight: 800;
                        text-transform: uppercase;
                    }

                    .cp-receipt-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 9px 16px;
                    }

                    .cp-receipt-grid-full,
                    .cp-receipt-detail-full {
                        grid-column: 1 / -1;
                    }

                    .cp-receipt-grid span,
                    .cp-receipt-details span,
                    .cp-receipt-balance-grid span {
                        display: block;
                        color: #64748b;
                        font-size: 8px;
                        margin-bottom: 3px;
                    }

                    .cp-receipt-grid strong,
                    .cp-receipt-details strong {
                        display: block;
                        font-size: 10px;
                    }

                    .cp-receipt-details {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px 16px;
                    }

                    .cp-receipt-balance {
                        margin-top: 15px;
                        padding: 12px;
                        border: 1px solid #e2e4ef;
                        border-radius: 9px;
                    }

                    .cp-receipt-balance-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 8px;
                    }

                    .cp-receipt-balance-grid strong {
                        display: block;
                        font-size: 11px;
                    }

                    .cp-receipt-paid {
                        color: #16a34a;
                    }

                    .cp-receipt-balance-total {
                        grid-column: 1 / -1;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 4px;
                        padding-top: 9px;
                        border-top: 1px solid #e5e7eb;
                    }

                    .cp-receipt-balance-total strong {
                        color: #dc2626;
                        font-size: 14px;
                    }

                    .cp-receipt-remarks {
                        margin-top: 14px;
                        padding: 10px;
                        background: #f8fafc;
                        border-radius: 8px;
                    }

                    .cp-receipt-remarks span {
                        display: block;
                        color: #64748b;
                        font-size: 8px;
                        font-weight: 700;
                    }

                    .cp-receipt-remarks p {
                        margin: 5px 0 0;
                        font-size: 9px;
                        line-height: 1.5;
                    }

                    .cp-receipt-history {
                        margin-top: 15px;
                    }

                    .cp-receipt-history table {
                        width: 100%;
                        border-collapse: collapse;
                    }

                    .cp-receipt-history th,
                    .cp-receipt-history td {
                        padding: 6px;
                        border: 1px solid #e5e7eb;
                        font-size: 7.5px;
                        text-align: left;
                    }

                    .cp-receipt-history th {
                        background: #f5f5ff;
                        color: #4b49ac;
                        font-weight: 700;
                    }

                    .cp-receipt-footer {
                        display: flex;
                        justify-content: space-between;
                        gap: 20px;
                        margin-top: 18px;
                        padding-top: 12px;
                        border-top: 1px solid #dfe3ea;
                    }

                    .cp-receipt-footer div {
                        display: flex;
                        flex-direction: column;
                        gap: 3px;
                    }

                    .cp-receipt-footer span {
                        color: #64748b;
                        font-size: 8px;
                    }

                    .cp-receipt-footer strong {
                        font-size: 9px;
                    }

                    .cp-receipt-issued {
                        text-align: right;
                    }

                    .cp-receipt-thank-you {
                        margin-top: 12px;
                        text-align: center;
                        color: #4b49ac;
                        font-size: 8px;
                        font-weight: 700;
                    }

                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }

                    @media print {

                        body {
                            padding: 0;
                        }

                        .cp-receipt-document {
                            max-width: none;
                        }

                    }

                </style>

            </head>

            <body>

                ${content}

            </body>

            </html>

        `;
  }

  /* ============================================================
       PRINT WINDOW
    ============================================================ */

  function printHtmlDocument(title, content) {
    const printWindow = window.open("", "_blank", "width=900,height=1000");

    if (!printWindow) {
      showToast("Please allow pop-ups to print the document.", "warning");

      return;
    }

    printWindow.document.open();

    printWindow.document.write(buildPrintableDocument(title, content));

    printWindow.document.close();

    printWindow.focus();

    setTimeout(function () {
      printWindow.print();
    }, 350);
  }

  /* ============================================================
       DOWNLOAD TEXT FILE
    ============================================================ */

  function downloadTextFile(content, filename) {
    const blob = new Blob([content], {
      type: "text/html;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = filename;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ============================================================
       SANITIZE FILENAME
    ============================================================ */

  function sanitizeFilename(filename) {
    return safeString(filename)
      .replace(/[^a-z0-9._-]+/gi, "-")
      .replace(/-+/g, "-");
  }

  /* ============================================================
       MODAL FOCUSABLE ELEMENTS
    ============================================================ */

  function getFocusableElements(modal) {
    if (!modal) {
      return [];
    }

    return $$(
      [
        "button:not([disabled])",
        "a[href]",
        "input:not([disabled])",
        "select:not([disabled])",
        "textarea:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
      modal,
    ).filter(function (element) {
      return (
        element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element === document.activeElement
      );
    });
  }

  /* ============================================================
       MODAL
    ============================================================ */

  function openModal(modalId) {
    const modal = typeof modalId === "string" ? byId(modalId) : modalId;

    if (!modal) {
      return;
    }

    /*
     * Close action menus before opening modal.
     */

    closeAllPaymentMenus(false);

    const active = document.activeElement;

    if (
      active &&
      active !== document.body &&
      modal.contains(active) === false
    ) {
      state.modalOpeners.set(modal, active);
    }

    modal.hidden = false;

    modal.removeAttribute("inert");

    modal.setAttribute("aria-hidden", "false");

    modal.classList.add("is-open");

    document.body.classList.add("cp-modal-open");

    requestAnimationFrame(function () {
      focusModal(modal);
    });
  }

  function focusModal(modal) {
    if (!modal) {
      return;
    }

    const autofocus = modal.querySelector("[autofocus]");

    if (autofocus && !autofocus.disabled) {
      autofocus.focus();

      return;
    }

    const closeButton = modal.querySelector(".cp-modal-close");

    if (closeButton) {
      closeButton.focus();

      return;
    }

    const focusables = getFocusableElements(modal);

    if (focusables.length) {
      focusables[0].focus();
    } else {
      const dialog = modal.querySelector(
        ".cp-modal-dialog, .cp-receipt-modal-dialog",
      );

      if (dialog) {
        dialog.setAttribute("tabindex", "-1");

        dialog.focus();
      }
    }
  }

  function restoreModalFocus(modal) {
    const opener = state.modalOpeners.get(modal);

    if (opener && document.contains(opener) && !opener.disabled) {
      try {
        opener.focus();
      } catch (err) {
        /*
         * Ignore.
         */
      }
    } else {
      const main = getPage();

      if (main) {
        main.setAttribute("tabindex", "-1");

        try {
          main.focus();
        } catch (err) {
          /*
           * Ignore.
           */
        }
      }
    }

    state.modalOpeners.delete(modal);
  }

  function closeModal(modalId) {
    const modal = typeof modalId === "string" ? byId(modalId) : modalId;

    if (!modal) {
      return;
    }

    /*
     * CRITICAL ACCESSIBILITY FIX
     *
     * The focused element must leave the modal
     * BEFORE aria-hidden="true" is applied.
     */

    const active = document.activeElement;

    if (active && modal.contains(active)) {
      restoreModalFocus(modal);

      /*
       * If focus could not move,
       * explicitly blur it.
       */

      const stillInside =
        document.activeElement && modal.contains(document.activeElement);

      if (stillInside && typeof document.activeElement.blur === "function") {
        document.activeElement.blur();
      }
    } else {
      state.modalOpeners.delete(modal);
    }

    modal.classList.remove("is-open");

    /*
     * Inert is applied before hidden state.
     */

    modal.setAttribute("inert", "");

    modal.setAttribute("aria-hidden", "true");

    modal.hidden = true;

    syncBodyModalLock();
  }

  function closeAllModals() {
    const modals = $$(".cp-modal-overlay.is-open");

    const active = document.activeElement;

    /*
     * Move focus away before hiding
     * any focused modal.
     */

    if (active && modals.some((modal) => modal.contains(active))) {
      const opener = state.modalOpeners.get(modals[modals.length - 1]);

      if (opener && document.contains(opener) && !opener.disabled) {
        try {
          opener.focus();
        } catch (err) {
          /*
           * Ignore.
           */
        }
      } else if (getPage()) {
        getPage().setAttribute("tabindex", "-1");

        getPage().focus();
      } else if (typeof active.blur === "function") {
        active.blur();
      }
    }

    modals.forEach(function (modal) {
      modal.classList.remove("is-open");

      modal.setAttribute("inert", "");

      modal.setAttribute("aria-hidden", "true");

      modal.hidden = true;

      state.modalOpeners.delete(modal);
    });

    syncBodyModalLock();
  }

  function syncBodyModalLock() {
    const hasOpenModal = Boolean($(".cp-modal-overlay.is-open"));

    document.body.classList.toggle("cp-modal-open", hasOpenModal);
  }

  /* ============================================================
       MODAL KEYBOARD
    ============================================================ */

  function handleModalKeyboard(event) {
    const opened = $$(".cp-modal-overlay.is-open");

    if (!opened.length) {
      return;
    }

    const modal = opened[opened.length - 1];

    if (event.key === "Escape") {
      /*
       * If action menu is open,
       * Escape closes menu first.
       */

      const openMenu = $(".cp-payment-action-menu.is-open");

      if (openMenu) {
        event.preventDefault();

        closeAllPaymentMenus(true);

        return;
      }

      if (state.submittingAdd || state.submittingEdit) {
        return;
      }

      event.preventDefault();

      closeModal(modal);

      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = getFocusableElements(modal);

    if (!focusable.length) {
      event.preventDefault();

      return;
    }

    const first = focusable[0];

    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();

      last.focus();

      return;
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();

      first.focus();
    }
  }

  /* ============================================================
       MODAL PREPARATION
    ============================================================ */

  function prepareModals() {
    $$(".cp-modal-overlay").forEach(function (modal) {
      if (modal.hidden === undefined) {
        modal.hidden = true;
      }

      if (!modal.classList.contains("is-open")) {
        modal.hidden = true;

        modal.setAttribute("aria-hidden", "true");

        modal.setAttribute("inert", "");
      }
    });
  }

  /* ============================================================
       TOAST
    ============================================================ */

  function showToast(message, type) {
    const container = byId("paymentToastContainer");

    if (!container) {
      return;
    }

    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
    }

    const safeType = ["success", "error", "warning", "info"].includes(type)
      ? type
      : "info";

    const icon =
      safeType === "success"
        ? "bi-check-circle"
        : safeType === "error"
          ? "bi-x-circle"
          : safeType === "warning"
            ? "bi-exclamation-triangle"
            : "bi-info-circle";

    const toast = document.createElement("div");

    toast.className = "cp-toast cp-toast-" + safeType;

    toast.innerHTML = `

                <div
                    class="cp-toast-icon"
                >

                    <i
                        class="bi ${icon}"
                        aria-hidden="true"
                    ></i>

                </div>


                <div
                    class="cp-toast-message"
                >
                    ${escapeHtml(message || "Something happened.")}
                </div>


                <button
                    type="button"
                    class="cp-toast-close"
                    aria-label="Close notification"
                >
                    <i
                        class="bi bi-x-lg"
                        aria-hidden="true"
                    ></i>
                </button>

            `;

    const close = toast.querySelector(".cp-toast-close");

    close?.addEventListener("click", function () {
      toast.remove();
    });

    container.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    state.toastTimer = setTimeout(function () {
      toast.classList.remove("is-visible");

      setTimeout(function () {
        toast.remove();
      }, 220);
    }, 4000);
  }

  /* ============================================================
       EVENT DELEGATION
    ============================================================ */

  function handleClick(event) {
    const target = event.target;

    if (!target) {
      return;
    }

    /* --------------------------------------------------------
           ADD PAYMENT
        -------------------------------------------------------- */

    const addButton = target.closest("#openAddPaymentBtn, #emptyAddPaymentBtn");

    if (addButton) {
      event.preventDefault();

      openAddPayment();

      return;
    }

    /* --------------------------------------------------------
           REFRESH
        -------------------------------------------------------- */

    const refreshButton = target.closest("#refreshPaymentsBtn");

    if (refreshButton) {
      event.preventDefault();

      closeAllPaymentMenus(false);

      loadPayments(state.currentPage);

      return;
    }

    /* --------------------------------------------------------
           RESET FILTERS
        -------------------------------------------------------- */

    const resetButton = target.closest("#resetPaymentFiltersBtn");

    if (resetButton) {
      event.preventDefault();

      resetFilters();

      return;
    }

    /* --------------------------------------------------------
           RETRY
        -------------------------------------------------------- */

    const retryButton = target.closest("#retryPaymentsBtn");

    if (retryButton) {
      event.preventDefault();

      loadPayments(state.currentPage);

      return;
    }

    /* --------------------------------------------------------
           THREE DOT TRIGGER
        -------------------------------------------------------- */

    const menuTrigger = target.closest("[data-payment-menu-trigger]");

    if (menuTrigger) {
      event.preventDefault();

      event.stopPropagation();

      togglePaymentMenu(menuTrigger);

      return;
    }

    /* --------------------------------------------------------
           ACTION MENU ITEM
        -------------------------------------------------------- */

    const actionButton = target.closest("[data-payment-action]");

    if (actionButton) {
      event.preventDefault();

      event.stopPropagation();

      handlePaymentAction(actionButton);

      return;
    }

    /* --------------------------------------------------------
           PAGINATION
        -------------------------------------------------------- */

    const pageButton = target.closest("#paymentPagination [data-page]");

    if (pageButton) {
      event.preventDefault();

      const page = Number(pageButton.dataset.page);

      if (page >= 1 && page <= state.totalPages && page !== state.currentPage) {
        closeAllPaymentMenus(false);

        loadPayments(page);
      }

      return;
    }

    /* --------------------------------------------------------
           MODAL CLOSE
        -------------------------------------------------------- */

    const closeButton = target.closest("[data-modal-close]");

    if (closeButton) {
      event.preventDefault();

      closeModal(closeButton.dataset.modalClose);

      return;
    }

    /* --------------------------------------------------------
           VIEW HISTORY
        -------------------------------------------------------- */

    if (target.closest("#viewPaymentHistoryBtn")) {
      event.preventDefault();

      if (state.currentPayment) {
        openClientPaymentHistory(
          getPaymentClientId(state.currentPayment),
          state.currentPayment,
        );
      }

      return;
    }

    /* --------------------------------------------------------
           VIEW RECEIPT
        -------------------------------------------------------- */

    if (target.closest("#viewPaymentReceiptBtn")) {
      event.preventDefault();

      if (state.currentPayment) {
        openPaymentReceipt(getPaymentId(state.currentPayment));
      }

      return;
    }

    /* --------------------------------------------------------
           VIEW EDIT
        -------------------------------------------------------- */

    if (target.closest("#viewPaymentEditBtn")) {
      event.preventDefault();

      if (state.currentPayment) {
        const payment = state.currentPayment;

        closeModal("viewPaymentModal");

        setTimeout(function () {
          openEditPayment(getPaymentId(payment));
        }, 30);
      }

      return;
    }

    /* --------------------------------------------------------
           RECEIPT PRINT
        -------------------------------------------------------- */

    if (target.closest("#printPaymentReceiptBtn")) {
      event.preventDefault();

      printCurrentReceipt();

      return;
    }

    /* --------------------------------------------------------
           RECEIPT DOWNLOAD
        -------------------------------------------------------- */

    if (target.closest("#downloadPaymentReceiptBtn")) {
      event.preventDefault();

      downloadCurrentReceipt();

      return;
    }

    /* --------------------------------------------------------
           HISTORY PRINT
        -------------------------------------------------------- */

    if (target.closest("#printClientPaymentHistoryBtn")) {
      event.preventDefault();

      printClientPaymentHistory();

      return;
    }

    /* --------------------------------------------------------
           HISTORY DOWNLOAD
        -------------------------------------------------------- */

    if (target.closest("#downloadClientPaymentHistoryBtn")) {
      event.preventDefault();

      downloadClientPaymentHistory();

      return;
    }

    /* --------------------------------------------------------
           WARNING CONFIRM
        -------------------------------------------------------- */

    if (target.closest("#paymentWarningConfirmBtn")) {
      event.preventDefault();

      if (typeof state.warningCallback === "function") {
        const callback = state.warningCallback;

        state.warningCallback = null;

        closeModal("paymentWarningModal");

        callback();
      }

      return;
    }

    /* --------------------------------------------------------
           OVERLAY CLICK
        -------------------------------------------------------- */

    const overlay = target.closest(".cp-modal-overlay");

    if (overlay && target === overlay) {
      if (state.submittingAdd || state.submittingEdit) {
        return;
      }

      closeModal(overlay);

      return;
    }

    /* --------------------------------------------------------
           OUTSIDE ACTION MENU
        -------------------------------------------------------- */

    if (!target.closest(".cp-payment-action-wrapper")) {
      closeAllPaymentMenus(false);
    }
  }

  /* ============================================================
       INPUT
    ============================================================ */

  function handleInput(event) {
    const target = event.target;

    if (!target) {
      return;
    }

    if (target.id === "paymentSearch") {
      if (state.searchTimer) {
        clearTimeout(state.searchTimer);
      }

      state.searchTimer = setTimeout(function () {
        state.currentPage = 1;

        loadPayments(1);
      }, 350);

      return;
    }

    if (target.id === "addPaymentAmount") {
      updatePaymentCalculation();

      return;
    }

    if (target.id === "addPaymentRemarks") {
      updateRemarksCounter("addPaymentRemarks", "addPaymentRemarksCount");

      return;
    }

    if (target.id === "editPaymentRemarks") {
      updateRemarksCounter("editPaymentRemarks", "editPaymentRemarksCount");
    }
  }

  /* ============================================================
       CHANGE
    ============================================================ */

  function handleChange(event) {
    const target = event.target;

    if (!target) {
      return;
    }

    if (
      target.id === "paymentClientFilter" ||
      target.id === "paymentProjectFilter" ||
      target.id === "paymentMethodFilter" ||
      target.id === "paymentFromDate" ||
      target.id === "paymentToDate"
    ) {
      state.currentPage = 1;

      loadPayments(1);

      return;
    }

    if (target.id === "addPaymentClient") {
      loadProjectsForClient(target.value).catch(function () {});

      return;
    }

    if (target.id === "addPaymentProject") {
      loadProjectPaymentBalance(target.value).catch(function () {});
    }
  }

  /* ============================================================
       SUBMIT
    ============================================================ */

  function handleSubmit(event) {
    const form = event.target;

    if (form?.id === "addPaymentForm") {
      event.preventDefault();

      submitAddPayment();

      return;
    }

    if (form?.id === "editPaymentForm") {
      event.preventDefault();

      submitEditPayment();
    }
  }

  /* ============================================================
       RESET FILTERS
    ============================================================ */

  function resetFilters() {
    const ids = [
      "paymentSearch",

      "paymentClientFilter",

      "paymentProjectFilter",

      "paymentMethodFilter",

      "paymentFromDate",

      "paymentToDate",
    ];

    ids.forEach(function (id) {
      const element = byId(id);

      if (element) {
        element.value = "";
      }
    });

    state.currentPage = 1;

    loadPayments(1);
  }

  /* ============================================================
       DOCUMENT KEYBOARD
    ============================================================ */

  function handleKeydown(event) {
    /*
     * Escape / Tab for modals.
     */

    if ($(".cp-modal-overlay.is-open")) {
      handleModalKeyboard(event);

      if (event.defaultPrevented) {
        return;
      }
    }

    /*
     * Action menu Escape.
     */

    if (event.key === "Escape") {
      const openMenu = $(".cp-payment-action-menu.is-open");

      if (openMenu) {
        event.preventDefault();

        closeAllPaymentMenus(true);

        return;
      }
    }

    /*
     * Ctrl/Cmd + P when receipt modal is open.
     */

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      if (state.currentReceiptPayment) {
        event.preventDefault();

        printCurrentReceipt();
      }
    }
  }

  /* ============================================================
       RESIZE
    ============================================================ */

  function handleResize() {
    closeAllPaymentMenus(false);
  }

  /* ============================================================
       SCROLL
    ============================================================ */

  function handleScroll() {
    closeAllPaymentMenus(false);
  }

  /* ============================================================
       BIND EVENTS
    ============================================================ */

  function bindEvents() {
    if (state.eventsBound) {
      return;
    }

    document.addEventListener("click", handleClick, false);

    document.addEventListener("input", handleInput, false);

    document.addEventListener("change", handleChange, false);

    document.addEventListener("submit", handleSubmit, true);

    document.addEventListener("keydown", handleKeydown, false);

    window.addEventListener("resize", handleResize);

    window.addEventListener("scroll", handleScroll, true);

    state.eventsBound = true;
  }

  /* ============================================================
       UNBIND EVENTS
    ============================================================ */

  function unbindEvents() {
    if (!state.eventsBound) {
      return;
    }

    document.removeEventListener("click", handleClick, false);

    document.removeEventListener("input", handleInput, false);

    document.removeEventListener("change", handleChange, false);

    document.removeEventListener("submit", handleSubmit, true);

    document.removeEventListener("keydown", handleKeydown, false);

    window.removeEventListener("resize", handleResize);

    window.removeEventListener("scroll", handleScroll, true);

    state.eventsBound = false;
  }

  /* ============================================================
       DESTROY
    ============================================================ */

  function destroy() {
    closeAllPaymentMenus(false);

    closeAllModals();

    if (state.searchTimer) {
      clearTimeout(state.searchTimer);

      state.searchTimer = null;
    }

    if (state.toastTimer) {
      clearTimeout(state.toastTimer);

      state.toastTimer = null;
    }

    unbindEvents();

    state.initialized = false;

    state.destroyed = true;

    state.payments = [];

    state.clients = [];

    state.projects = [];

    state.currentPayment = null;

    state.currentHistoryClient = null;

    state.currentHistoryPayments = [];

    state.selectedProject = null;

    state.currentReceiptPayment = null;

    state.currentReceiptType = null;
  }

  /* ============================================================
       INITIALIZE
    ============================================================ */

  async function init() {
    if (!pageExists()) {
      return;
    }

    /*
     * If SPA has injected a new fragment,
     * prepare its modals.
     */

    prepareModals();

    if (!state.eventsBound) {
      bindEvents();
    }

    if (state.initialized) {
      /*
       * Page already initialized.
       * Refresh data only.
       */

      await loadPayments(state.currentPage);

      return;
    }

    state.initialized = true;

    state.destroyed = false;

    setDefaultPaymentDate();

    updateRemarksCounter("addPaymentRemarks", "addPaymentRemarksCount");

    updateRemarksCounter("editPaymentRemarks", "editPaymentRemarksCount");

    /*
     * Do NOT load CSRF during initial GET-only page load.
     *
     * CSRF is loaded only when POST/PUT is executed.
     */

    await Promise.allSettled([loadClients(), loadProjectsForFilter()]);

    await loadPayments(1);

    log("Client Payments initialized.");
  }

  /* ============================================================
       PUBLIC MODULE
    ============================================================ */

  const TenspickClientPayments = {
    init,

    destroy,

    refresh: function () {
      return loadPayments(state.currentPage);
    },

    openAdd: openAddPayment,

    openView: openViewPayment,

    openEdit: openEditPayment,

    openReceipt: openPaymentReceipt,

    openHistory: openClientPaymentHistory,

    printReceipt: printCurrentReceipt,

    downloadReceipt: downloadCurrentReceipt,

    printHistory: printClientPaymentHistory,

    downloadHistory: downloadClientPaymentHistory,
  };

  window.TenspickClientPayments = TenspickClientPayments;

  /*
   * Compatibility with existing router/module calls.
   */

  window.initClientPayments = init;

  /* ============================================================
       SPA EVENTS
    ============================================================ */

  document.addEventListener("tenspick:client-payments-loaded", function () {
    init();
  });

  document.addEventListener("spa:content-loaded", function () {
    if (pageExists()) {
      init();
    }
  });

  /* ============================================================
       AUTO INITIALIZATION
    ============================================================ */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        if (pageExists()) {
          init();
        }
      },
      {
        once: true,
      },
    );
  } else {
    if (pageExists()) {
      init();
    }
  }
})(window, document);
