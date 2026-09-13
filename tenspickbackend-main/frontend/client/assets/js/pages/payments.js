/* ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL - PAYMENTS PAGE
 * ============================================================
 *
 * ROUTES
 * ------------------------------------------------------------
 * #payments
 * #payments/{projectId}
 *
 * API
 * ------------------------------------------------------------
 * GET /api/client-auth/me
 * GET /api/client-portal/projects
 * GET /api/client-portal/payments
 * GET /api/client-portal/projects/{id}/payments
 *
 * SECURITY
 * ------------------------------------------------------------
 * client_id is NEVER sent from frontend.
 *
 * Backend identifies the authenticated client from
 * the PHP client session.
 *
 * FEATURES
 * ------------------------------------------------------------
 * - Payment summary
 * - Payment history
 * - Project filter
 * - Click payment to view receipt
 * - Complete client information
 * - Company information
 * - Project information
 * - Payment information
 * - Balance snapshot
 * - Receipt download / print
 * - Responsive mobile layout
 * - Router compatible
 *
 * ============================================================ */

(function () {
  "use strict";

  /* =========================================================
   * STATE
   * ========================================================= */

  const state = {
    root: null,

    initialized: false,

    destroyed: false,

    loading: false,

    loadingProjects: false,

    loadingClient: false,

    error: null,

    projects: [],

    payments: [],

    summary: null,

    client: null,

    selectedProjectId: null,

    selectedPayment: null,

    requestSequence: 0,
  };

  /* =========================================================
   * ENDPOINTS
   * ========================================================= */

  const ENDPOINTS = {
    client: "/client-auth/me",

    projects: "/client-portal/projects",

    payments: "/client-portal/payments",
  };

  /* =========================================================
   * HTML ESCAPE
   * ========================================================= */

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

  /* =========================================================
   * SAFE NUMBER
   * ========================================================= */

  function number(value) {
    const result = Number(value);

    return Number.isFinite(result) ? result : 0;
  }

  /* =========================================================
   * CURRENCY
   * ========================================================= */

  function formatCurrency(value) {
    const amount = number(value);

    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch (error) {
      return "₹" + amount.toFixed(2);
    }
  }

  /* =========================================================
   * DATE
   * ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const text = String(value).trim();

    /*
     * MySQL:
     *
     * YYYY-MM-DD
     * YYYY-MM-DD HH:MM:SS
     */

    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      const year = Number(match[1]);

      const month = Number(match[2]);

      const day = Number(match[3]);

      const date = new Date(year, month - 1, day);

      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      }
    }

    return text;
  }

  /* =========================================================
   * SORT DATE
   * ========================================================= */

  function sortableDate(value) {
    if (!value) {
      return 0;
    }

    const match = String(value).match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/,
    );

    if (match) {
      return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4] || 0),
        Number(match[5] || 0),
        Number(match[6] || 0),
      ).getTime();
    }

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /* =========================================================
   * PAYMENT HELPERS
   * ========================================================= */

  function getPaymentAmount(payment) {
    return number(
      payment?.amount ?? payment?.payment_amount ?? payment?.paid_amount ?? 0,
    );
  }

  function getPaymentCode(payment) {
    return (
      payment?.payment_code ??
      payment?.receipt_code ??
      payment?.receipt_number ??
      payment?.receipt_no ??
      (payment?.id ? "PAY-" + payment.id : "—")
    );
  }

  function getPaymentPurpose(payment) {
    return (
      payment?.purpose ??
      payment?.payment_purpose ??
      payment?.description ??
      "Advance Payment"
    );
  }

  function getPaymentDate(payment) {
    return (
      payment?.payment_date ??
      payment?.paid_date ??
      payment?.date ??
      payment?.created_at ??
      ""
    );
  }

  function getPaymentMethod(payment) {
    return payment?.payment_method ?? payment?.method ?? payment?.mode ?? "—";
  }

  function getPaymentProjectId(payment) {
    return payment?.project_id ?? payment?.project?.id ?? "";
  }

  function getPaymentProjectName(payment) {
    if (payment?.project_name) {
      return payment.project_name;
    }

    if (payment?.project?.project_name) {
      return payment.project.project_name;
    }

    if (payment?.project?.name) {
      return payment.project.name;
    }

    const projectId = getPaymentProjectId(payment);

    const project = state.projects.find(function (item) {
      return String(item?.id) === String(projectId);
    });

    if (project) {
      return project.project_name ?? project.name ?? project.title ?? "Project";
    }

    return "Project";
  }

  function getPaymentProjectCode(payment) {
    if (payment?.project_code) {
      return payment.project_code;
    }

    if (payment?.project?.project_code) {
      return payment.project.project_code;
    }

    const projectId = getPaymentProjectId(payment);

    const project = state.projects.find(function (item) {
      return String(item?.id) === String(projectId);
    });

    if (project) {
      return project.project_code ?? project.code ?? "—";
    }

    return "—";
  }

  function getPaymentTransactionId(payment) {
    return payment?.transaction_id ?? payment?.transaction ?? "—";
  }

  function getPaymentProjectAmount(payment) {
    return number(
      payment?.project_amount_snapshot ??
        payment?.project_amount ??
        payment?.current_project_budget ??
        payment?.budget ??
        payment?.total_amount ??
        0,
    );
  }

  function getPaymentPaidBefore(payment) {
    return number(payment?.paid_before ?? payment?.previous_paid ?? 0);
  }

  function getPaymentPaidAfter(payment) {
    if (payment?.paid_after !== undefined && payment?.paid_after !== null) {
      return number(payment.paid_after);
    }

    return getPaymentPaidBefore(payment) + getPaymentAmount(payment);
  }

  function getPaymentRemainingAfter(payment) {
    if (
      payment?.remaining_after !== undefined &&
      payment?.remaining_after !== null
    ) {
      return number(payment.remaining_after);
    }

    return Math.max(
      getPaymentProjectAmount(payment) - getPaymentPaidAfter(payment),
      0,
    );
  }

  function getPaymentStatus(payment) {
    const amount = getPaymentProjectAmount(payment);

    const paid = getPaymentPaidAfter(payment);

    const remaining = getPaymentRemainingAfter(payment);

    if (amount > 0 && remaining <= 0) {
      return "Paid";
    }

    if (paid > 0) {
      return "Partially Paid";
    }

    return "Pending";
  }

  function formatPaymentMethod(value) {
    if (!value) {
      return "—";
    }

    return String(value)
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  /* =========================================================
   * CLIENT HELPERS
   * ========================================================= */

  function getClientName() {
    return state.client?.client_name ?? state.client?.name ?? "—";
  }

  function getCompanyName() {
    return state.client?.company_name ?? state.client?.company ?? "—";
  }

  function getClientMobile() {
    return (
      state.client?.mobile ??
      state.client?.contact_person_mobile ??
      state.client?.phone ??
      "—"
    );
  }

  function getClientEmail() {
    return (
      state.client?.email ??
      state.client?.login_email ??
      state.client?.contact_person_email ??
      "—"
    );
  }

  function getClientAddress() {
    const address = state.client?.address ?? "";

    const city = state.client?.city ?? "";

    const clientState = state.client?.state ?? "";

    const pincode = state.client?.pincode ?? "";

    const parts = [address, city, clientState, pincode].filter(
      function (value) {
        return (
          value !== null && value !== undefined && String(value).trim() !== ""
        );
      },
    );

    if (parts.length) {
      return parts.join(", ");
    }

    return state.client?.billing_address ?? "—";
  }

  /* =========================================================
   * API RESPONSE UNWRAPPER
   * ========================================================= */

  function unwrap(response) {
    if (!response) {
      return null;
    }

    let current = response;

    /*
     * TenspickClientAPI result:
     *
     * {
     *   ok: true,
     *   status: 200,
     *   data: {...}
     * }
     */

    if (
      current.data &&
      typeof current.data === "object" &&
      !Array.isArray(current.data)
    ) {
      current = current.data;
    }

    /*
     * Backend result:
     *
     * {
     *   success: true,
     *   message: "...",
     *   data: {...}
     * }
     */

    if (
      current.data &&
      typeof current.data === "object" &&
      !Array.isArray(current.data)
    ) {
      current = current.data;
    }

    return current;
  }

  /* =========================================================
   * EXTRACT CLIENT
   * ========================================================= */

  function extractClient(response) {
    const payload = unwrap(response);

    if (!payload) {
      return null;
    }

    /*
     * Most common:
     *
     * {
     *   client: {...}
     * }
     */

    if (payload.client && typeof payload.client === "object") {
      return payload.client;
    }

    /*
     * If response itself is client object.
     */

    if (payload.client_name || payload.company_name) {
      return payload;
    }

    return null;
  }

  /* =========================================================
   * EXTRACT PROJECTS
   * ========================================================= */

  function extractProjects(response) {
    const payload = unwrap(response);

    if (!payload) {
      return [];
    }

    if (Array.isArray(payload.projects)) {
      return payload.projects;
    }

    if (Array.isArray(payload.items)) {
      return payload.items;
    }

    if (Array.isArray(payload.records)) {
      return payload.records;
    }

    return [];
  }

  /* =========================================================
   * EXTRACT PAYMENTS
   * ========================================================= */

  function extractPaymentData(response) {
    const payload = unwrap(response);

    const result = {
      payments: [],

      summary: null,

      count: 0,
    };

    if (!payload) {
      return result;
    }

    const arrays = [
      payload.payments,

      payload.payment_history,

      payload.history,

      payload.items,

      payload.records,

      payload.results,
    ];

    for (let index = 0; index < arrays.length; index++) {
      if (Array.isArray(arrays[index])) {
        result.payments = arrays[index].filter(function (payment) {
          return payment && typeof payment === "object";
        });

        break;
      }
    }

    /*
     * Backend summary.
     */

    if (payload.summary && typeof payload.summary === "object") {
      result.summary = payload.summary;
    }

    /*
     * Payment count.
     */

    result.count = result.payments.length;

    /*
     * Normalize values without destroying
     * original backend properties.
     */

    result.payments = result.payments.map(function (payment) {
      return {
        ...payment,

        _amount: getPaymentAmount(payment),

        _code: getPaymentCode(payment),

        _purpose: getPaymentPurpose(payment),

        _date: getPaymentDate(payment),

        _method: getPaymentMethod(payment),

        _projectId: getPaymentProjectId(payment),

        _projectName: getPaymentProjectName(payment),

        _projectCode: getPaymentProjectCode(payment),
      };
    });

    console.log("[Tenspick Client Payments] " + "Extracted payments:", result);

    return result;
  }

  /* =========================================================
   * BUILD SUMMARY
   * ========================================================= */

  function buildSummary(backendSummary, payments) {
    const summary = backendSummary || {};

    let totalAmount = number(
      summary.total_project_amount ??
        summary.total_amount ??
        summary.project_amount ??
        summary.total,
    );

    let totalPaid = number(
      summary.total_paid ?? summary.paid ?? summary.totalPaid,
    );

    let balance = number(
      summary.balance ?? summary.total_balance ?? summary.remaining,
    );

    /*
     * If backend total paid doesn't exist,
     * calculate it from actual records.
     */

    if (
      summary.total_paid === undefined &&
      summary.paid === undefined &&
      summary.totalPaid === undefined
    ) {
      totalPaid = payments.reduce(function (total, payment) {
        return total + getPaymentAmount(payment);
      }, 0);
    }

    /*
     * If total project amount isn't returned,
     * calculate from project list.
     */

    if (totalAmount <= 0) {
      totalAmount = state.projects.reduce(function (total, project) {
        return (
          total +
          number(
            project?.budget ??
              project?.total_amount ??
              project?.project_amount ??
              0,
          )
        );
      }, 0);
    }

    /*
     * Calculate balance when necessary.
     */

    if (
      summary.balance === undefined &&
      summary.total_balance === undefined &&
      summary.remaining === undefined
    ) {
      balance = Math.max(totalAmount - totalPaid, 0);
    }

    return {
      projectCount: number(summary.project_count ?? state.projects.length),

      totalAmount,

      totalPaid,

      balance,
    };
  }

  /* =========================================================
   * LOAD AUTHENTICATED CLIENT
   * ========================================================= */

  async function loadClient() {
    state.loadingClient = true;

    try {
      if (
        window.TenspickClientAuth &&
        typeof window.TenspickClientAuth.getClient === "function"
      ) {
        const existingClient = window.TenspickClientAuth.getClient();
        if (
          existingClient &&
          (existingClient.client_name || existingClient.company_name || existingClient.name)
        ) {
          state.client = existingClient;
        }
      }

      if (!state.client) {
        try {
          const raw = sessionStorage.getItem("tenspick_client") || sessionStorage.getItem("tenspick_client_auth");
          if (raw) {
            const parsed = JSON.parse(raw);
            state.client = parsed.client || parsed;
          }
        } catch (e) {}
      }

      const response = await window.TenspickClientAPI.get(ENDPOINTS.client);
      const client = extractClient(response);
      if (client) {
        state.client = client;
      }
    } catch (error) {
      console.warn(
        "[Tenspick Client Payments] Client information API note:",
        error
      );
      if (!state.client) {
        try {
          const raw = sessionStorage.getItem("tenspick_client") || sessionStorage.getItem("tenspick_client_auth");
          if (raw) {
            const parsed = JSON.parse(raw);
            state.client = parsed.client || parsed;
          }
        } catch (e) {}
      }
    } finally {
      state.loadingClient = false;
    }
  }

  /* =========================================================
   * LOAD PROJECTS
   * ========================================================= */

  async function loadProjects() {
    state.loadingProjects = true;
    try {
      let list = [];
      try {
        const cached = localStorage.getItem("tenspick_projects") || localStorage.getItem("tenspick_client_projects");
        if (cached) {
          list = JSON.parse(cached);
        }
      } catch (e) {}

      if (!list || !list.length) {
        if (window.TenspickClientAPI && typeof window.TenspickClientAPI.get === "function") {
          const response = await window.TenspickClientAPI.get(ENDPOINTS.projects);
          list = extractProjects(response);
        }
      }
      state.projects = Array.isArray(list) ? list : [];
    } catch (err) {
      console.warn("[Tenspick Client Payments] loadProjects note:", err);
      state.projects = [];
    } finally {
      state.loadingProjects = false;
    }
  }

  /* =========================================================
   * FALLBACK PAYMENTS FETCH
   * ========================================================= */

  async function fetchFallbackPayments() {
    let list = [];

    if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
      try {
        const sb = window.TenspickSupabase.getClient();
        const { data } = await sb.from("client_payments").select("*");
        if (data && Array.isArray(data) && data.length > 0) {
          list = data;
        }
      } catch (e) {
        console.warn("[Client Payments] Supabase fallback note:", e);
      }
    }

    if (!list.length) {
      try {
        const cached = localStorage.getItem("tenspick_client_payments") || localStorage.getItem("tenspick_payments");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            list = parsed;
          }
        }
      } catch (e) {}
    }

    // Filter by client if client identity is present
    if (list.length > 0 && state.client) {
      const cId = state.client.id || state.client.client_id;
      const cEmail = state.client.email || state.client.login_email;
      if (cId || cEmail) {
        const filtered = list.filter(p => {
          if (cId && String(p.client_id) === String(cId)) return true;
          if (cEmail && (p.client_email === cEmail || p.email === cEmail)) return true;
          return !p.client_id; // Include generic payments if unassigned
        });
        if (filtered.length > 0) list = filtered;
      }
    }

    return list;
  }

  /* =========================================================
   * LOAD PAYMENTS
   * ========================================================= */

  async function loadPayments(projectId) {
    const requestId = ++state.requestSequence;

    state.loading = true;
    state.error = null;

    render();

    try {
      let endpoint = ENDPOINTS.payments;

      if (projectId !== null && projectId !== undefined && projectId !== "") {
        endpoint =
          "/client-portal/projects/" +
          encodeURIComponent(String(projectId)) +
          "/payments";
      }

      const response = await window.TenspickClientAPI.get(endpoint);

      if (requestId !== state.requestSequence) {
        return;
      }

      const result = extractPaymentData(response);

      state.payments = result.payments;
      state.summary = buildSummary(result.summary, state.payments);
    } catch (error) {
      if (requestId !== state.requestSequence) {
        return;
      }

      console.warn(
        "[Tenspick Client Payments] Primary API failed, fetching fallback payments...",
        error
      );

      try {
        const fallbackList = await fetchFallbackPayments();
        const result = extractPaymentData({ payments: fallbackList });
        state.payments = result.payments;
        state.summary = buildSummary(result.summary, state.payments);
        state.error = null;
      } catch (fallbackErr) {
        state.payments = [];
        state.summary = null;
        state.error = error?.message || "Unable to load payment information.";
      }
    } finally {
      if (requestId === state.requestSequence) {
        state.loading = false;
        render();
      }
    }
  }

  /* =========================================================
   * FILTER
   * ========================================================= */

  function getFilteredPayments() {
    if (
      state.selectedProjectId === null ||
      state.selectedProjectId === undefined ||
      state.selectedProjectId === ""
    ) {
      return state.payments;
    }

    const id = String(state.selectedProjectId);

    return state.payments.filter(function (payment) {
      return String(payment._projectId) === id;
    });
  }

  /* =========================================================
   * OVERALL STATUS
   * ========================================================= */

  function getOverallStatus() {
    const summary = state.summary || {};

    const total = number(summary.totalAmount);

    const paid = number(summary.totalPaid);

    const balance = number(summary.balance);

    if (total > 0 && balance <= 0) {
      return "Paid";
    }

    if (paid > 0) {
      return "Partially Paid";
    }

    return "Pending";
  }

  function statusClass(status) {
    const value = String(status).toLowerCase().trim();

    if (value === "paid") {
      return "is-paid";
    }

    if (value === "partially paid" || value === "partial") {
      return "is-partial";
    }

    if (value === "pending") {
      return "is-pending";
    }

    return "is-neutral";
  }

  /* =========================================================
   * RENDER
   * ========================================================= */

  function render() {
    if (!state.root) {
      return;
    }

    state.root.innerHTML = getPageMarkup();

    bindEvents();
  }

  /* =========================================================
   * PAGE MARKUP
   * ========================================================= */

  function getPageMarkup() {
    const summary = state.summary || {
      projectCount: 0,

      totalAmount: 0,

      totalPaid: 0,

      balance: 0,
    };

    const payments = getFilteredPayments();

    const status = getOverallStatus();

    return `

            ${getStyles()}


            <section
                class="tsp-payments-page"
            >


                <!-- HEADER -->

                <div
                    class="tsp-payments-header"
                >

                    <div>

                        <div
                            class="tsp-payments-eyebrow"
                        >
                            FINANCIAL OVERVIEW
                        </div>


                        <h1>
                            Payments
                        </h1>


                        <p>
                            View your project payment status and payment history.
                        </p>

                    </div>


                    <div
                        class="tsp-payments-header-icon"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >

                            <rect
                                x="3"
                                y="5"
                                width="18"
                                height="14"
                                rx="2"
                            ></rect>

                            <path d="M7 9h4"></path>

                            <path d="M7 13h6"></path>

                            <path d="M7 16h3"></path>

                            <path d="M15 13h3"></path>

                        </svg>

                    </div>

                </div>


                ${
                  state.error
                    ? `

                            <div
                                class="tsp-payments-error"
                            >

                                <div
                                    class="tsp-payments-error-icon"
                                >
                                    !
                                </div>


                                <div
                                    class="tsp-payments-error-content"
                                >

                                    <strong>
                                        Unable to load payments
                                    </strong>

                                    <span>
                                        ${escapeHtml(state.error)}
                                    </span>

                                </div>


                                <button
                                    type="button"
                                    id="tspPaymentsRetry"
                                    class="tsp-payment-retry"
                                >
                                    Retry
                                </button>

                            </div>

                        `
                    : ""
                }


                <!-- SUMMARY -->

                <div
                    class="tsp-payment-summary-grid"
                >


                    <div
                        class="tsp-payment-summary-card"
                    >

                        <div
                            class="tsp-payment-card-icon blue"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >

                                <rect
                                    x="3"
                                    y="6"
                                    width="18"
                                    height="13"
                                    rx="2"
                                ></rect>

                                <path d="M7 10h10"></path>

                                <path d="M7 15h4"></path>

                            </svg>

                        </div>


                        <div
                            class="tsp-payment-summary-content"
                        >

                            <span>
                                TOTAL AMOUNT
                            </span>


                            <strong>
                                ${formatCurrency(summary.totalAmount)}
                            </strong>

                        </div>

                    </div>


                    <div
                        class="tsp-payment-summary-card"
                    >

                        <div
                            class="tsp-payment-card-icon green"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="8.5"
                                ></circle>

                                <path
                                    d="m8.5 12 2.2 2.2 4.8-5"
                                ></path>

                            </svg>

                        </div>


                        <div
                            class="tsp-payment-summary-content"
                        >

                            <span>
                                TOTAL PAID
                            </span>


                            <strong>
                                ${formatCurrency(summary.totalPaid)}
                            </strong>

                        </div>

                    </div>


                    <div
                        class="tsp-payment-summary-card"
                    >

                        <div
                            class="tsp-payment-card-icon amber"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >

                                <path d="M7 3h10"></path>
                                <path d="M7 21h10"></path>
                                <path d="M8 3c0 4 4 4 4 6"></path>
                                <path d="M16 3c0 4-4 4-4 6"></path>
                                <path d="M8 21c0-4 4-4 4-6"></path>
                                <path d="M16 21c0-4-4-4-4-6"></path>
                                <path d="M9 12h6"></path>

                            </svg>

                        </div>


                        <div
                            class="tsp-payment-summary-content"
                        >

                            <span>
                                BALANCE
                            </span>


                            <strong>
                                ${formatCurrency(summary.balance)}
                            </strong>

                        </div>

                    </div>


                    <div
                        class="tsp-payment-summary-card"
                    >

                        <div
                            class="tsp-payment-card-icon teal"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >

                                <path
                                    d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6l8-3Z"
                                ></path>

                                <path
                                    d="m9 12 2 2 4-4"
                                ></path>

                            </svg>

                        </div>


                        <div
                            class="tsp-payment-summary-content"
                        >

                            <span>
                                PAYMENT STATUS
                            </span>


                            <strong
                                class="tsp-payment-status-badge ${statusClass(status)}"
                            >
                                ${escapeHtml(status)}
                            </strong>

                        </div>

                    </div>

                </div>


                <!-- FILTER -->

                <div
                    class="tsp-payment-filter-card"
                >

                    <div
                        class="tsp-payment-filter-icon"
                    >

                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                        >

                            <path d="M3 7h18"></path>

                            <path
                                d="M5 7v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"
                            ></path>

                            <path d="M8 7V4h8v3"></path>

                        </svg>

                    </div>


                    <div
                        class="tsp-payment-filter-content"
                    >

                        <label
                            for="tspPaymentProjectFilter"
                        >
                            Filter by Project
                        </label>


                        <select
                            id="tspPaymentProjectFilter"
                            class="tsp-payment-project-select"
                        >

                            <option value="">
                                All Projects
                            </option>


                            ${state.projects
                              .map(function (project) {
                                const id = project?.id;

                                const selected =
                                  state.selectedProjectId !== null &&
                                  String(state.selectedProjectId) === String(id)
                                    ? "selected"
                                    : "";

                                return `

                                        <option
                                            value="${escapeHtml(id)}"
                                            ${selected}
                                        >

                                            ${escapeHtml(
                                              project?.project_name ??
                                                project?.name ??
                                                project?.project_code ??
                                                "Project " + id,
                                            )}

                                        </option>

                                    `;
                              })
                              .join("")}

                        </select>

                    </div>

                </div>


                <!-- HISTORY -->

                <div
                    class="tsp-payment-history-card"
                >

                    <div
                        class="tsp-payment-history-header"
                    >

                        <div>

                            <h2>
                                Payment History
                            </h2>


                            <p>

                                ${
                                  state.loading
                                    ? "Loading payments..."
                                    : payments.length === 1
                                      ? "1 payment"
                                      : `${payments.length} payments`
                                }

                            </p>

                        </div>


                        <div
                            class="tsp-payment-history-icon"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                            >

                                <circle
                                    cx="12"
                                    cy="12"
                                    r="8.5"
                                ></circle>

                                <path
                                    d="M12 7v5l3 2"
                                ></path>

                            </svg>

                        </div>

                    </div>


                    ${
                      state.loading
                        ? getLoadingMarkup()
                        : payments.length
                          ? getHistoryMarkup(payments)
                          : getEmptyMarkup()
                    }

                </div>


            </section>

        `;
  }

  /* =========================================================
   * HISTORY
   * ========================================================= */

  function getHistoryMarkup(payments) {
    const sorted = payments.slice().sort(function (a, b) {
      return sortableDate(b._date) - sortableDate(a._date);
    });

    return `

            <!-- DESKTOP -->

            <div
                class="tsp-payment-table-wrapper"
            >

                <table
                    class="tsp-payment-table"
                >

                    <thead>

                        <tr>

                            <th>
                                PAYMENT
                            </th>

                            <th>
                                PROJECT
                            </th>

                            <th>
                                DATE
                            </th>

                            <th>
                                METHOD
                            </th>

                            <th>
                                AMOUNT
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${sorted.map(renderPaymentRow).join("")}

                    </tbody>

                </table>

            </div>


            <!-- MOBILE -->

            <div
                class="tsp-payment-mobile-list"
            >

                ${sorted.map(renderMobilePayment).join("")}

            </div>

        `;
  }

  /* =========================================================
   * DESKTOP PAYMENT ROW
   * ========================================================= */

  function renderPaymentRow(payment) {
    return `

            <tr
                class="tsp-payment-row"
                data-payment-id="${escapeHtml(payment?.id)}"
                tabindex="0"
            >

                <td>

                    <div
                        class="tsp-payment-code"
                    >

                        <span
                            class="tsp-payment-code-icon"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                            >

                                <rect
                                    x="4"
                                    y="3"
                                    width="16"
                                    height="18"
                                    rx="2"
                                ></rect>

                                <path d="M8 8h8"></path>

                                <path d="M8 12h8"></path>

                                <path d="M8 16h5"></path>

                            </svg>

                        </span>


                        <div>

                            <strong>
                                ${escapeHtml(payment._code)}
                            </strong>


                            <small>
                                ${escapeHtml(payment._purpose)}
                            </small>

                        </div>

                    </div>

                </td>


                <td>

                    <div
                        class="tsp-payment-project"
                    >

                        <strong>
                            ${escapeHtml(payment._projectName)}
                        </strong>


                        <small>
                            ${escapeHtml(payment._projectCode)}
                        </small>

                    </div>

                </td>


                <td>

                    ${escapeHtml(formatDate(payment._date))}

                </td>


                <td>

                    <span
                        class="tsp-payment-method"
                    >

                        ${escapeHtml(formatPaymentMethod(payment._method))}

                    </span>

                </td>


                <td>

                    <strong
                        class="tsp-payment-amount"
                    >

                        ${formatCurrency(payment._amount)}

                    </strong>

                </td>

            </tr>

        `;
  }

  /* =========================================================
   * MOBILE PAYMENT
   * ========================================================= */

  function renderMobilePayment(payment) {
    return `

            <button
                type="button"
                class="tsp-payment-mobile-card"
                data-payment-id="${escapeHtml(payment?.id)}"
            >

                <div
                    class="tsp-payment-mobile-top"
                >

                    <div>

                        <strong>
                            ${escapeHtml(payment._code)}
                        </strong>


                        <span>
                            ${escapeHtml(payment._purpose)}
                        </span>

                    </div>


                    <strong
                        class="tsp-payment-amount"
                    >

                        ${formatCurrency(payment._amount)}

                    </strong>

                </div>


                <div
                    class="tsp-payment-mobile-details"
                >

                    <div>

                        <span>
                            Project
                        </span>

                        <strong>
                            ${escapeHtml(payment._projectName)}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Date
                        </span>

                        <strong>
                            ${escapeHtml(formatDate(payment._date))}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Method
                        </span>

                        <strong>
                            ${escapeHtml(formatPaymentMethod(payment._method))}
                        </strong>

                    </div>

                </div>

            </button>

        `;
  }

  /* =========================================================
   * LOADING
   * ========================================================= */

  function getLoadingMarkup() {
    return `

            <div
                class="tsp-payment-loading"
            >

                <div
                    class="tsp-payment-spinner"
                ></div>


                <p>
                    Loading payment history...
                </p>

            </div>

        `;
  }

  /* =========================================================
   * EMPTY
   * ========================================================= */

  function getEmptyMarkup() {
    return `

            <div
                class="tsp-payment-empty"
            >

                <div
                    class="tsp-payment-empty-icon"
                >

                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                    >

                        <rect
                            x="4"
                            y="5"
                            width="16"
                            height="14"
                            rx="2"
                        ></rect>

                        <path d="M8 10h8"></path>

                        <path d="M8 14h5"></path>

                    </svg>

                </div>


                <h3>
                    No payment history
                </h3>


                <p>
                    Your payment records will appear here once a payment has been recorded.
                </p>

            </div>

        `;
  }

  /* =========================================================
   * PAGE EVENTS
   * ========================================================= */

  function bindEvents() {
    if (!state.root) {
      return;
    }

    const filter = state.root.querySelector("#tspPaymentProjectFilter");

    if (filter) {
      filter.addEventListener("change", handleProjectChange);
    }

    const retry = state.root.querySelector("#tspPaymentsRetry");

    if (retry) {
      retry.addEventListener("click", function () {
        loadPayments(state.selectedProjectId);
      });
    }

    /*
     * Desktop rows.
     */

    state.root.querySelectorAll(".tsp-payment-row").forEach(function (row) {
      row.addEventListener("click", function () {
        openPaymentReceipt(row.dataset.paymentId);
      });

      row.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();

          openPaymentReceipt(row.dataset.paymentId);
        }
      });
    });

    /*
     * Mobile cards.
     */

    state.root
      .querySelectorAll(".tsp-payment-mobile-card")
      .forEach(function (card) {
        card.addEventListener("click", function () {
          openPaymentReceipt(card.dataset.paymentId);
        });
      });
  }

  /* =========================================================
   * PROJECT FILTER
   * ========================================================= */

  async function handleProjectChange(event) {
    const value = event.target.value;

    state.selectedProjectId = value === "" ? null : value;

    await loadPayments(state.selectedProjectId);
  }

  /* =========================================================
   * FIND PAYMENT
   * ========================================================= */

  function findPayment(paymentId) {
    return (
      state.payments.find(function (payment) {
        return String(payment?.id) === String(paymentId);
      }) || null
    );
  }

  /* =========================================================
   * OPEN RECEIPT
   * ========================================================= */

  function openPaymentReceipt(paymentId) {
    const payment = findPayment(paymentId);

    if (!payment) {
      console.error(
        "[Tenspick Client Payments] " + "Payment record not found:",
        paymentId,
      );

      return;
    }

    state.selectedPayment = payment;

    closePaymentReceipt();

    document.body.insertAdjacentHTML("beforeend", getReceiptMarkup(payment));

    bindReceiptEvents();

    document.body.classList.add("tsp-payment-receipt-open");
  }

  /* =========================================================
   * CLOSE RECEIPT
   * ========================================================= */

  function closePaymentReceipt() {
    const modal = document.getElementById("tspPaymentReceiptModal");

    if (modal) {
      modal.remove();
    }

    document.body.classList.remove("tsp-payment-receipt-open");
  }

  /* =========================================================
   * LOGO
   * ========================================================= */

  function getLogoMarkup() {
    return `

            <div
                class="tsp-receipt-logo"
                aria-label="TENSPICK"
            >

                <span>
                    T
                </span>

            </div>

        `;
  }

  /* =========================================================
   * RECEIPT
   * ========================================================= */

  function getReceiptMarkup(payment) {
    const projectAmount = getPaymentProjectAmount(payment);

    const paidBefore = getPaymentPaidBefore(payment);

    const thisPayment = getPaymentAmount(payment);

    const paidAfter = getPaymentPaidAfter(payment);

    const remaining = getPaymentRemainingAfter(payment);

    const paymentStatus = getPaymentStatus(payment);

    const receipt = getPaymentCode(payment);

    return `

            <div
                id="tspPaymentReceiptModal"
                class="tsp-payment-receipt-modal"
            >


                <div
                    class="tsp-payment-receipt-overlay"
                    data-receipt-close="true"
                ></div>


                <div
                    class="tsp-payment-receipt-dialog"
                >


                    <!-- ACTION BAR -->

                    <div
                        class="tsp-receipt-actions"
                    >

                        <button
                            type="button"
                            id="tspReceiptClose"
                            class="tsp-receipt-close"
                        >

                            <span>
                                ×
                            </span>

                            Close

                        </button>


                        <button
                            type="button"
                            id="tspReceiptPrint"
                            class="tsp-receipt-download"
                        >

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.8"
                            >

                                <path d="M6 9V3h12v6"></path>

                                <path
                                    d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"
                                ></path>

                                <rect
                                    x="6"
                                    y="14"
                                    width="12"
                                    height="7"
                                ></rect>

                            </svg>


                            Download Receipt

                        </button>

                    </div>


                    <!-- RECEIPT -->

                    <div
                        id="tspPrintableReceipt"
                        class="tsp-printable-receipt"
                    >


                        <!-- RECEIPT HEADER -->

                        <div
                            class="tsp-receipt-header"
                        >

                            <div
                                class="tsp-receipt-company"
                            >

                              <div class="tsp-receipt-company">
    <img
        src="assets/images/tenspick-logo.png"
        alt="TENSPICK"
        style="display:block;width:100px;height:auto;max-height:55px;object-fit:contain;object-position:left center;"
    >
</div>

                                <div>

                                    <h1>
                                        TENSPICK
                                    </h1>


                                    <p>
                                        Bazaar Street, PulamPeta, Tirupati
                                    </p>


                                    <p>
                                        Mobile: 8683886307
                                    </p>


                                    <p>
                                        https://www.tenspick.com/
                                    </p>

                                </div>

                            </div>


                            <div
                                class="tsp-receipt-heading"
                            >

                                <span>
                                    OFFICIAL RECEIPT
                                </span>


                                <h2>
                                    PAYMENT RECEIPT
                                </h2>


                                <strong>
                                    ${escapeHtml(receipt)}
                                </strong>

                            </div>

                        </div>


                        <div
                            class="tsp-receipt-divider"
                        ></div>


                        <!-- PAYMENT STATUS -->

                        <div
                            class="tsp-receipt-status-box"
                        >

                            <div>

                                <span>
                                    Payment Status
                                </span>


                                <strong>
                                    ${escapeHtml(paymentStatus)}
                                </strong>

                            </div>


                            <div
                                class="tsp-receipt-status-amount"
                            >

                                <span>
                                    Amount Received
                                </span>


                                <strong>
                                    ${formatCurrency(thisPayment)}
                                </strong>

                            </div>

                        </div>


                        <!-- CLIENT INFORMATION -->

                        <div
                            class="tsp-receipt-section"
                        >

                            <div
                                class="tsp-receipt-section-title"
                            >
                                CLIENT INFORMATION
                            </div>


                            <div
                                class="tsp-receipt-grid"
                            >

                                <div>

                                    <span>
                                        Client Name
                                    </span>


                                    <strong>
                                        ${escapeHtml(getClientName())}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Company
                                    </span>


                                    <strong>
                                        ${escapeHtml(getCompanyName())}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Mobile
                                    </span>


                                    <strong>
                                        ${escapeHtml(getClientMobile())}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Email
                                    </span>


                                    <strong>
                                        ${escapeHtml(getClientEmail())}
                                    </strong>

                                </div>


                                <div
                                    class="tsp-receipt-full"
                                >

                                    <span>
                                        Address
                                    </span>


                                    <strong>
                                        ${escapeHtml(getClientAddress())}
                                    </strong>

                                </div>

                            </div>

                        </div>


                        <!-- PROJECT INFORMATION -->

                        <div
                            class="tsp-receipt-section"
                        >

                            <div
                                class="tsp-receipt-section-title"
                            >
                                PROJECT INFORMATION
                            </div>


                            <div
                                class="tsp-receipt-grid"
                            >

                                <div>

                                    <span>
                                        Project
                                    </span>


                                    <strong>
                                        ${escapeHtml(
                                          getPaymentProjectName(payment),
                                        )}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Project Code
                                    </span>


                                    <strong>
                                        ${escapeHtml(
                                          getPaymentProjectCode(payment),
                                        )}
                                    </strong>

                                </div>

                            </div>

                        </div>


                        <!-- PAYMENT DETAILS -->

                        <div
                            class="tsp-receipt-section"
                        >

                            <div
                                class="tsp-receipt-section-title"
                            >
                                PAYMENT DETAILS
                            </div>


                            <div
                                class="tsp-receipt-grid"
                            >

                                <div>

                                    <span>
                                        Payment ID
                                    </span>


                                    <strong>
                                        ${escapeHtml(receipt)}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Payment Date
                                    </span>


                                    <strong>
                                        ${escapeHtml(
                                          formatDate(getPaymentDate(payment)),
                                        )}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Payment Method
                                    </span>


                                    <strong>
                                        ${escapeHtml(
                                          formatPaymentMethod(
                                            getPaymentMethod(payment),
                                          ),
                                        )}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Transaction ID
                                    </span>


                                    <strong>
                                        ${escapeHtml(
                                          getPaymentTransactionId(payment),
                                        )}
                                    </strong>

                                </div>


                                <div
                                    class="tsp-receipt-full"
                                >

                                    <span>
                                        Payment Purpose
                                    </span>


                                    <strong>
                                        ${escapeHtml(
                                          getPaymentPurpose(payment),
                                        )}
                                    </strong>

                                </div>

                            </div>

                        </div>


                        <!-- BALANCE -->

                        <div
                            class="tsp-receipt-balance"
                        >

                            <div
                                class="tsp-receipt-section-title"
                            >
                                BALANCE SNAPSHOT
                            </div>


                            <div
                                class="tsp-receipt-balance-grid"
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
                                        class="green"
                                    >
                                        ${formatCurrency(thisPayment)}
                                    </strong>

                                </div>


                                <div>

                                    <span>
                                        Paid After
                                    </span>


                                    <strong
                                        class="green"
                                    >
                                        ${formatCurrency(paidAfter)}
                                    </strong>

                                </div>

                            </div>


                            <div
                                class="tsp-receipt-remaining"
                            >

                                <span>
                                    Remaining Amount
                                </span>


                                <strong>
                                    ${formatCurrency(remaining)}
                                </strong>

                            </div>

                        </div>


                        <!-- FOOTER -->

                        <div
                            class="tsp-receipt-footer"
                        >

                            <div>

                                <strong>
                                    TENSPICK
                                </strong>


                                <span>
                                    Bazaar Street, PulamPeta, Tirupati
                                </span>

                            </div>


                            <div>

                                <span>
                                    Mobile: 8683886307
                                </span>


                                <span>
                                    https://www.tenspick.com/
                                </span>

                            </div>


                            <div
                                class="tsp-receipt-added-by"
                            >

                                <span>
                                    Added By
                                </span>


                                <strong>
                                    ${escapeHtml(
                                      payment?.added_by_name ??
                                        payment?.created_by_name ??
                                        "TENSPICK",
                                    )}
                                </strong>

                            </div>

                        </div>


                        <div
                            class="tsp-receipt-thankyou"
                        >

                            Thank you for your payment.

                        </div>

                    </div>

                </div>

            </div>

        `;
  }

  /* =========================================================
   * RECEIPT EVENTS
   * ========================================================= */

  function bindReceiptEvents() {
    const close = document.getElementById("tspReceiptClose");

    if (close) {
      close.addEventListener("click", closePaymentReceipt);
    }

    const overlay = document.querySelector(
      "#tspPaymentReceiptModal " + "[data-receipt-close='true']",
    );

    if (overlay) {
      overlay.addEventListener("click", closePaymentReceipt);
    }

    const print = document.getElementById("tspReceiptPrint");

    if (print) {
      print.addEventListener("click", printReceipt);
    }

    document.addEventListener("keydown", receiptKeyboardHandler);
  }

  function receiptKeyboardHandler(event) {
    const modal = document.getElementById("tspPaymentReceiptModal");

    if (!modal) {
      document.removeEventListener("keydown", receiptKeyboardHandler);

      return;
    }

    if (event.key === "Escape") {
      closePaymentReceipt();

      document.removeEventListener("keydown", receiptKeyboardHandler);
    }
  }

  /* =========================================================
   * PRINT / DOWNLOAD
   * ========================================================= */

  function printReceipt() {
    const receipt = document.getElementById("tspPrintableReceipt");

    if (!receipt) {
      return;
    }

    const printWindow = window.open("", "_blank", "width=900,height=1000");

    if (!printWindow) {
      alert("Please allow pop-ups to download the receipt.");

      return;
    }

    printWindow.document.open();

    printWindow.document.write(`

            <!DOCTYPE html>

            <html>

            <head>

                <meta charset="UTF-8">

                <title>
                    TENSPICK Payment Receipt
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
                    }


                    body {
                        font-family:
                            Arial,
                            Helvetica,
                            sans-serif;
                        color: #1d2939;
                    }


                    .tsp-printable-receipt {
                        width: 100%;
                        max-width: 860px;
                        margin: 0 auto;
                        padding: 25px;
                        background: #ffffff;
                    }


                    .tsp-receipt-header {
                        display: flex;
                        justify-content: space-between;
                        gap: 25px;
                    }


                    .tsp-receipt-company {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                    }


                    .tsp-receipt-logo {
                        width: 52px;
                        height: 52px;
                        flex: 0 0 52px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #dfe3ec;
                        border-radius: 10px;
                    }


                    .tsp-receipt-logo span {
                        color: #4a45b8;
                        font-size: 28px;
                        font-weight: 800;
                    }


                    .tsp-receipt-company h1 {
                        margin: 0 0 5px;
                        color: #172033;
                        font-size: 21px;
                    }


                    .tsp-receipt-company p {
                        margin: 2px 0;
                        color: #607089;
                        font-size: 8px;
                    }


                    .tsp-receipt-heading {
                        text-align: right;
                    }


                    .tsp-receipt-heading > span {
                        display: block;
                        color: #4a45b8;
                        font-size: 7px;
                        font-weight: 800;
                        letter-spacing: 1px;
                    }


                    .tsp-receipt-heading h2 {
                        margin: 7px 0 8px;
                        color: #172033;
                        font-size: 18px;
                    }


                    .tsp-receipt-heading strong {
                        color: #253247;
                        font-size: 9px;
                    }


                    .tsp-receipt-divider {
                        height: 2px;
                        margin: 17px 0 13px;
                        background: #4a45b8;
                    }


                    .tsp-receipt-status-box {
                        display: flex;
                        justify-content: space-between;
                        padding: 12px;
                        border: 1px solid #dce0f2;
                        border-radius: 8px;
                        background: #f9f9ff;
                    }


                    .tsp-receipt-status-box span,
                    .tsp-receipt-grid span,
                    .tsp-receipt-balance-grid span,
                    .tsp-receipt-remaining span,
                    .tsp-receipt-footer span {
                        display: block;
                        margin-bottom: 4px;
                        color: #7d8aa0;
                        font-size: 7px;
                    }


                    .tsp-receipt-status-box strong {
                        font-size: 9px;
                    }


                    .tsp-receipt-status-amount {
                        text-align: right;
                    }


                    .tsp-receipt-status-amount strong {
                        color: #4a45b8;
                        font-size: 16px;
                    }


                    .tsp-receipt-section {
                        margin-top: 14px;
                    }


                    .tsp-receipt-section-title {
                        padding-bottom: 6px;
                        border-bottom: 1px solid #e1e5ec;
                        color: #4a45b8;
                        font-size: 8px;
                        font-weight: 800;
                        letter-spacing: .5px;
                    }


                    .tsp-receipt-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px 28px;
                        padding-top: 9px;
                    }


                    .tsp-receipt-grid strong {
                        display: block;
                        color: #253247;
                        font-size: 8px;
                    }


                    .tsp-receipt-full {
                        grid-column: 1 / -1;
                    }


                    .tsp-receipt-balance {
                        margin-top: 16px;
                        padding: 11px;
                        border: 1px solid #dce0f2;
                        border-radius: 8px;
                        background: #f9f9ff;
                    }


                    .tsp-receipt-balance-grid {
                        display: grid;
                        grid-template-columns:
                            repeat(4, 1fr);
                        gap: 12px;
                        padding: 9px 0;
                    }


                    .tsp-receipt-balance-grid strong {
                        color: #253247;
                        font-size: 8px;
                    }


                    .tsp-receipt-balance-grid strong.green {
                        color: #009b58;
                    }


                    .tsp-receipt-remaining {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        padding-top: 9px;
                        border-top: 1px solid #dce0e9;
                    }


                    .tsp-receipt-remaining span {
                        margin: 0;
                    }


                    .tsp-receipt-remaining strong {
                        color: #e32d2d;
                        font-size: 12px;
                    }


                    .tsp-receipt-footer {
                        display: grid;
                        grid-template-columns:
                            1fr 1fr 1fr;
                        gap: 15px;
                        margin-top: 16px;
                        padding-top: 11px;
                        border-top: 1px solid #dce0e9;
                    }


                    .tsp-receipt-footer strong {
                        display: block;
                        color: #253247;
                        font-size: 8px;
                    }


                    .tsp-receipt-footer span {
                        margin-top: 3px;
                        margin-bottom: 0;
                    }


                    .tsp-receipt-added-by {
                        text-align: right;
                    }


                    .tsp-receipt-thankyou {
                        margin-top: 13px;
                        color: #4a45b8;
                        font-size: 8px;
                        font-weight: 800;
                        text-align: center;
                    }


                    @page {
                        size: A4;
                        margin: 12mm;
                    }

                </style>

            </head>


            <body>

                ${receipt.outerHTML}

            </body>

            </html>

        `);

    printWindow.document.close();

    printWindow.focus();

    setTimeout(function () {
      printWindow.print();

      setTimeout(function () {
        printWindow.close();
      }, 1200);
    }, 400);
  }

  /* =========================================================
   * STYLES
   * ========================================================= */

  function getStyles() {
    if (document.getElementById("tspClientPaymentsStyles")) {
      return "";
    }

    return `

            <style
                id="tspClientPaymentsStyles"
            >


                /* =========================================
                   PAGE
                ========================================== */

                .tsp-payments-page {
                    width: 100%;
                    box-sizing: border-box;
                }


                .tsp-payments-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 18px;
                    margin-bottom: 21px;
                }


                .tsp-payments-eyebrow {
                    margin-bottom: 7px;
                    color: #00a6a6;
                    font-size: 10px;
                    font-weight: 800;
                    letter-spacing: 1.2px;
                }


                .tsp-payments-header h1 {
                    margin: 0;
                    color: #071a2b;
                    font-size: 29px;
                    line-height: 1.1;
                    font-weight: 800;
                }


                .tsp-payments-header p {
                    margin: 7px 0 0;
                    color: #71829a;
                    font-size: 12px;
                    line-height: 1.45;
                }


                .tsp-payments-header-icon {
                    width: 54px;
                    height: 54px;
                    flex: 0 0 54px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 16px;
                    color: #00a6a6;
                    background: #eafafa;
                }


                .tsp-payments-header-icon svg {
                    width: 25px;
                    height: 25px;
                }


                /* =========================================
                   SUMMARY
                ========================================== */

                .tsp-payment-summary-grid {
                    display: grid;
                    grid-template-columns:
                        repeat(4, minmax(0, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }


                .tsp-payment-summary-card {
                    min-height: 87px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 15px;
                    box-sizing: border-box;
                    border: 1px solid #dfe5ed;
                    border-radius: 15px;
                    background: #ffffff;
                    box-shadow:
                        0 5px 18px
                        rgba(20, 40, 70, .035);
                }


                .tsp-payment-card-icon {
                    width: 45px;
                    height: 45px;
                    flex: 0 0 45px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 12px;
                }


                .tsp-payment-card-icon svg {
                    width: 22px;
                    height: 22px;
                }


                .tsp-payment-card-icon.blue {
                    color: #2864e8;
                    background: #edf3ff;
                }


                .tsp-payment-card-icon.green {
                    color: #009c61;
                    background: #eaf9f1;
                }


                .tsp-payment-card-icon.amber {
                    color: #c98300;
                    background: #fff7e8;
                }


                .tsp-payment-card-icon.teal {
                    color: #00a6a6;
                    background: #eafafa;
                }


                .tsp-payment-summary-content {
                    min-width: 0;
                }


                .tsp-payment-summary-content > span {
                    display: block;
                    margin-bottom: 4px;
                    color: #71829a;
                    font-size: 9px;
                    font-weight: 700;
                }


                .tsp-payment-summary-content > strong {
                    display: block;
                    color: #071a2b;
                    font-size: 17px;
                    line-height: 1.15;
                    font-weight: 800;
                }


                .tsp-payment-status-badge {
                    width: max-content;
                    padding: 5px 8px;
                    border-radius: 999px;
                    font-size: 9px !important;
                    line-height: 1.1 !important;
                }


                .tsp-payment-status-badge.is-paid {
                    color: #087443 !important;
                    background: #e8f8ef;
                }


                .tsp-payment-status-badge.is-partial {
                    color: #a96900 !important;
                    background: #fff2d8;
                }


                .tsp-payment-status-badge.is-pending {
                    color: #b44a4a !important;
                    background: #fff0f0;
                }


                .tsp-payment-status-badge.is-neutral {
                    color: #66768a !important;
                    background: #eef2f6;
                }


                /* =========================================
                   FILTER
                ========================================== */

                .tsp-payment-filter-card {
                    min-height: 89px;
                    display: flex;
                    align-items: center;
                    gap: 13px;
                    padding: 16px 18px;
                    margin-bottom: 20px;
                    box-sizing: border-box;
                    border: 1px solid #dfe5ed;
                    border-radius: 15px;
                    background: #ffffff;
                }


                .tsp-payment-filter-icon {
                    width: 42px;
                    height: 42px;
                    flex: 0 0 42px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #00a6a6;
                    border-radius: 11px;
                    background: #eafafa;
                }


                .tsp-payment-filter-icon svg {
                    width: 21px;
                    height: 21px;
                }


                .tsp-payment-filter-content {
                    width: 525px;
                    max-width: 100%;
                }


                .tsp-payment-filter-content label {
                    display: block;
                    margin-bottom: 5px;
                    color: #566b84;
                    font-size: 10px;
                    font-weight: 700;
                }


                .tsp-payment-project-select {
                    width: 100%;
                    height: 43px;
                    padding: 0 12px;
                    border: 1px solid #d6dee8;
                    border-radius: 9px;
                    outline: none;
                    color: #24364b;
                    background: #ffffff;
                    font: inherit;
                    font-size: 11px;
                }


                /* =========================================
                   HISTORY
                ========================================== */

                .tsp-payment-history-card {
                    overflow: hidden;
                    border: 1px solid #dfe5ed;
                    border-radius: 15px;
                    background: #ffffff;
                    box-shadow:
                        0 5px 18px
                        rgba(20, 40, 70, .03);
                }


                .tsp-payment-history-header {
                    min-height: 73px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 18px;
                    box-sizing: border-box;
                    border-bottom: 1px solid #edf1f5;
                }


                .tsp-payment-history-header h2 {
                    margin: 0;
                    color: #071a2b;
                    font-size: 16px;
                    font-weight: 800;
                }


                .tsp-payment-history-header p {
                    margin: 4px 0 0;
                    color: #7b8ca2;
                    font-size: 10px;
                }


                .tsp-payment-history-icon {
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 11px;
                    color: #00a6a6;
                    background: #f1f7f8;
                }


                .tsp-payment-history-icon svg {
                    width: 21px;
                    height: 21px;
                }


                .tsp-payment-table-wrapper {
                    width: 100%;
                    overflow-x: auto;
                }


                .tsp-payment-table {
                    width: 100%;
                    min-width: 690px;
                    border-collapse: collapse;
                }


                .tsp-payment-table th {
                    padding: 11px 18px;
                    color: #75869b;
                    background: #f8fafc;
                    font-size: 8px;
                    font-weight: 800;
                    text-align: left;
                }


                .tsp-payment-table td {
                    padding: 12px 18px;
                    color: #4f6177;
                    border-top: 1px solid #edf1f5;
                    font-size: 10px;
                    vertical-align: middle;
                }


                .tsp-payment-row {
                    cursor: pointer;
                    outline: none;
                    transition:
                        background .15s ease;
                }


                .tsp-payment-row:hover,
                .tsp-payment-row:focus {
                    background: #f8fbfc;
                }


                .tsp-payment-code {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }


                .tsp-payment-code-icon {
                    width: 32px;
                    height: 32px;
                    flex: 0 0 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 8px;
                    color: #2864e8;
                    background: #edf3ff;
                }


                .tsp-payment-code-icon svg {
                    width: 16px;
                    height: 16px;
                }


                .tsp-payment-code strong,
                .tsp-payment-project strong {
                    display: block;
                    color: #172b42;
                    font-size: 10px;
                    font-weight: 750;
                }


                .tsp-payment-code small,
                .tsp-payment-project small {
                    display: block;
                    margin-top: 3px;
                    color: #8493a6;
                    font-size: 8px;
                }


                .tsp-payment-method {
                    display: inline-flex;
                    padding: 4px 7px;
                    border-radius: 6px;
                    color: #53667c;
                    background: #f3f6f9;
                    font-size: 8px;
                    font-weight: 700;
                }


                .tsp-payment-amount {
                    color: #071a2b !important;
                    font-size: 11px !important;
                    font-weight: 800 !important;
                    white-space: nowrap;
                }


                .tsp-payment-mobile-list {
                    display: none;
                }


                /* =========================================
                   LOADING
                ========================================== */

                .tsp-payment-loading {
                    min-height: 145px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }


                .tsp-payment-spinner {
                    width: 26px;
                    height: 26px;
                    border: 3px solid #e4eaef;
                    border-top-color: #00a6a6;
                    border-radius: 50%;
                    animation:
                        tspPaymentSpin
                        .8s linear infinite;
                }


                @keyframes tspPaymentSpin {

                    to {
                        transform: rotate(360deg);
                    }

                }


                .tsp-payment-loading p {
                    margin: 0;
                    color: #8190a3;
                    font-size: 10px;
                }


                /* =========================================
                   EMPTY
                ========================================== */

                .tsp-payment-empty {
                    min-height: 175px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 25px;
                    text-align: center;
                }


                .tsp-payment-empty-icon {
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 10px;
                    color: #00a6a6;
                    border-radius: 13px;
                    background: #eef8f8;
                }


                .tsp-payment-empty-icon svg {
                    width: 23px;
                    height: 23px;
                }


                .tsp-payment-empty h3 {
                    margin: 0;
                    color: #1a2c42;
                    font-size: 13px;
                }


                .tsp-payment-empty p {
                    max-width: 430px;
                    margin: 5px 0 0;
                    color: #8291a5;
                    font-size: 10px;
                }


                /* =========================================
                   ERROR
                ========================================== */

                .tsp-payments-error {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 11px 13px;
                    margin-bottom: 17px;
                    border: 1px solid #f0d4d4;
                    border-radius: 10px;
                    background: #fff8f8;
                }


                .tsp-payments-error-icon {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 7px;
                    color: #c44949;
                    background: #ffeaea;
                    font-size: 12px;
                    font-weight: 900;
                }


                .tsp-payments-error-content {
                    flex: 1;
                    min-width: 0;
                }


                .tsp-payments-error-content strong {
                    display: block;
                    color: #7d3434;
                    font-size: 10px;
                }


                .tsp-payments-error-content span {
                    display: block;
                    margin-top: 2px;
                    color: #a36b6b;
                    font-size: 9px;
                    overflow-wrap: anywhere;
                }


                .tsp-payment-retry {
                    height: 30px;
                    padding: 0 10px;
                    border: 0;
                    border-radius: 7px;
                    color: #ffffff;
                    background: #00a6a6;
                    font-size: 9px;
                    font-weight: 800;
                    cursor: pointer;
                }


                /* =========================================
                   RECEIPT MODAL
                ========================================== */

                body.tsp-payment-receipt-open {
                    overflow: hidden;
                }


                .tsp-payment-receipt-modal {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 18px;
                }


                .tsp-payment-receipt-overlay {
                    position: absolute;
                    inset: 0;
                    background:
                        rgba(5, 17, 31, .66);
                    backdrop-filter:
                        blur(4px);
                }


                .tsp-payment-receipt-dialog {
                    position: relative;
                    z-index: 2;
                    width: min(900px, 100%);
                    max-height: calc(100vh - 36px);
                    overflow: auto;
                    border-radius: 14px;
                    background: #edf0f4;
                    box-shadow:
                        0 25px 70px
                        rgba(0,0,0,.28);
                }


                .tsp-receipt-actions {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 12px;
                    background: #ffffff;
                    border-bottom: 1px solid #e2e7ee;
                }


                .tsp-receipt-close,
                .tsp-receipt-download {
                    height: 35px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    padding: 0 11px;
                    border: 0;
                    border-radius: 8px;
                    font-size: 9px;
                    font-weight: 800;
                    cursor: pointer;
                }


                .tsp-receipt-close {
                    color: #53667c;
                    background: #f1f4f7;
                }


                .tsp-receipt-close span {
                    font-size: 17px;
                    line-height: 1;
                }


                .tsp-receipt-download {
                    color: #ffffff;
                    background: #4a45b8;
                }


                .tsp-receipt-download svg {
                    width: 15px;
                    height: 15px;
                }


                /* =========================================
                   RECEIPT
                ========================================== */

                .tsp-printable-receipt {
                    width: calc(100% - 26px);
                    max-width: 850px;
                    margin: 13px auto;
                    padding: 25px;
                    box-sizing: border-box;
                    border-radius: 11px;
                    background: #ffffff;
                }


                .tsp-receipt-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 20px;
                }


                .tsp-receipt-company {
                    display: flex;
                    align-items: center;
                    gap: 11px;
                }


                .tsp-receipt-logo {
                    width: 49px;
                    height: 49px;
                    flex: 0 0 49px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #dfe3ec;
                    border-radius: 9px;
                    background: #ffffff;
                }


                .tsp-receipt-logo span {
                    color: #4a45b8;
                    font-size: 27px;
                    font-weight: 800;
                }


                .tsp-receipt-company h1 {
                    margin: 0 0 4px;
                    color: #172033;
                    font-size: 20px;
                    font-weight: 800;
                }


                .tsp-receipt-company p {
                    margin: 2px 0;
                    color: #607089;
                    font-size: 7px;
                }


                .tsp-receipt-heading {
                    text-align: right;
                }


                .tsp-receipt-heading > span {
                    display: block;
                    color: #4a45b8;
                    font-size: 6px;
                    font-weight: 800;
                    letter-spacing: 1px;
                }


                .tsp-receipt-heading h2 {
                    margin: 6px 0 7px;
                    color: #172033;
                    font-size: 17px;
                    font-weight: 800;
                }


                .tsp-receipt-heading strong {
                    color: #253247;
                    font-size: 8px;
                }


                .tsp-receipt-divider {
                    height: 2px;
                    margin: 17px 0 12px;
                    background: #4a45b8;
                }


                .tsp-receipt-status-box {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 11px;
                    border: 1px solid #dce0f2;
                    border-radius: 8px;
                    background: #f9f9ff;
                }


                .tsp-receipt-status-box span,
                .tsp-receipt-grid span,
                .tsp-receipt-balance-grid span,
                .tsp-receipt-remaining span,
                .tsp-receipt-footer span {
                    display: block;
                    margin-bottom: 3px;
                    color: #7d8aa0;
                    font-size: 6px;
                }


                .tsp-receipt-status-box strong {
                    color: #253247;
                    font-size: 8px;
                }


                .tsp-receipt-status-amount {
                    text-align: right;
                }


                .tsp-receipt-status-amount strong {
                    color: #4a45b8;
                    font-size: 15px;
                }


                .tsp-receipt-section {
                    margin-top: 13px;
                }


                .tsp-receipt-section-title {
                    padding-bottom: 5px;
                    border-bottom: 1px solid #e1e5ec;
                    color: #4a45b8;
                    font-size: 7px;
                    font-weight: 800;
                    letter-spacing: .5px;
                }


                .tsp-receipt-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 9px 25px;
                    padding-top: 8px;
                }


                .tsp-receipt-grid strong {
                    display: block;
                    color: #253247;
                    font-size: 7px;
                    line-height: 1.4;
                }


                .tsp-receipt-full {
                    grid-column: 1 / -1;
                }


                .tsp-receipt-balance {
                    margin-top: 15px;
                    padding: 10px;
                    border: 1px solid #dce0f2;
                    border-radius: 8px;
                    background: #f9f9ff;
                }


                .tsp-receipt-balance-grid {
                    display: grid;
                    grid-template-columns:
                        repeat(4, 1fr);
                    gap: 10px;
                    padding: 8px 0;
                }


                .tsp-receipt-balance-grid strong {
                    color: #253247;
                    font-size: 7px;
                }


                .tsp-receipt-balance-grid strong.green {
                    color: #009b58;
                }


                .tsp-receipt-remaining {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding-top: 8px;
                    border-top: 1px solid #dce0e9;
                }


                .tsp-receipt-remaining span {
                    margin: 0;
                }


                .tsp-receipt-remaining strong {
                    color: #e32d2d;
                    font-size: 11px;
                }


                .tsp-receipt-footer {
                    display: grid;
                    grid-template-columns:
                        1fr 1fr 1fr;
                    gap: 13px;
                    margin-top: 15px;
                    padding-top: 10px;
                    border-top: 1px solid #dce0e9;
                }


                .tsp-receipt-footer strong {
                    display: block;
                    color: #253247;
                    font-size: 7px;
                }


                .tsp-receipt-footer span {
                    margin-top: 3px;
                    margin-bottom: 0;
                }


                .tsp-receipt-added-by {
                    text-align: right;
                }


                .tsp-receipt-thankyou {
                    margin-top: 12px;
                    color: #4a45b8;
                    font-size: 7px;
                    font-weight: 800;
                    text-align: center;
                }


                /* =========================================
                   TABLET
                ========================================== */

                @media (max-width: 1150px) {

                    .tsp-payment-summary-grid {
                        grid-template-columns:
                            repeat(2, minmax(0, 1fr));
                    }

                }


                /* =========================================
                   MOBILE
                ========================================== */

                @media (max-width: 760px) {

                    .tsp-payments-header h1 {
                        font-size: 26px;
                    }


                    .tsp-payments-header p {
                        font-size: 11px;
                    }


                    .tsp-payments-header-icon {
                        width: 46px;
                        height: 46px;
                        flex-basis: 46px;
                    }


                    .tsp-payment-summary-grid {
                        grid-template-columns: 1fr;
                        gap: 9px;
                    }


                    .tsp-payment-summary-card {
                        min-height: 75px;
                        padding: 13px;
                    }


                    .tsp-payment-summary-content > strong {
                        font-size: 16px;
                    }


                    .tsp-payment-filter-card {
                        padding: 14px;
                    }


                    .tsp-payment-history-header {
                        padding: 14px;
                    }


                    .tsp-payment-table-wrapper {
                        display: none;
                    }


                    .tsp-payment-mobile-list {
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                        padding: 11px;
                    }


                    .tsp-payment-mobile-card {
                        width: 100%;
                        box-sizing: border-box;
                        padding: 12px;
                        border: 1px solid #e5eaf0;
                        border-radius: 10px;
                        background: #ffffff;
                        text-align: left;
                        cursor: pointer;
                    }


                    .tsp-payment-mobile-top {
                        display: flex;
                        justify-content: space-between;
                        gap: 10px;
                    }


                    .tsp-payment-mobile-top strong {
                        color: #172b42;
                        font-size: 10px;
                    }


                    .tsp-payment-mobile-top span {
                        display: block;
                        margin-top: 3px;
                        color: #8493a6;
                        font-size: 8px;
                    }


                    .tsp-payment-mobile-details {
                        display: grid;
                        grid-template-columns:
                            1fr 1fr 1fr;
                        gap: 8px;
                        margin-top: 9px;
                        padding-top: 9px;
                        border-top: 1px solid #edf1f5;
                    }


                    .tsp-payment-mobile-details span {
                        display: block;
                        margin-bottom: 3px;
                        color: #8a98aa;
                        font-size: 7px;
                    }


                    .tsp-payment-mobile-details strong {
                        display: block;
                        color: #42566e;
                        font-size: 8px;
                        overflow-wrap: anywhere;
                    }


                    .tsp-payment-receipt-modal {
                        padding: 0;
                    }


                    .tsp-payment-receipt-dialog {
                        width: 100%;
                        max-height: 100vh;
                        border-radius: 0;
                    }


                    .tsp-printable-receipt {
                        width: calc(100% - 12px);
                        margin: 6px auto;
                        padding: 14px;
                    }


                    .tsp-receipt-logo {
                        width: 42px;
                        height: 42px;
                        flex-basis: 42px;
                    }


                    .tsp-receipt-logo span {
                        font-size: 22px;
                    }


                    .tsp-receipt-company h1 {
                        font-size: 15px;
                    }


                    .tsp-receipt-company p {
                        font-size: 6px;
                    }


                    .tsp-receipt-heading h2 {
                        font-size: 12px;
                    }


                    .tsp-receipt-balance-grid {
                        grid-template-columns:
                            repeat(2, 1fr);
                    }


                    .tsp-receipt-footer {
                        grid-template-columns: 1fr;
                    }


                    .tsp-receipt-added-by {
                        text-align: left;
                    }

                }


                @media (max-width: 430px) {

                    .tsp-payment-mobile-details {
                        grid-template-columns:
                            1fr 1fr;
                    }


                    .tsp-payment-mobile-details > div:last-child {
                        grid-column: 1 / -1;
                    }


                    .tsp-receipt-header {
                        flex-direction: column;
                    }


                    .tsp-receipt-heading {
                        width: 100%;
                        text-align: left;
                    }


                    .tsp-receipt-status-box {
                        gap: 10px;
                    }


                    .tsp-receipt-status-amount {
                        text-align: right;
                    }

                }


                /* =========================================
                   PRINT
                ========================================== */

                @media print {

                    body * {
                        visibility: hidden !important;
                    }


                    #tspPaymentReceiptModal,
                    #tspPaymentReceiptModal * {
                        visibility: visible !important;
                    }


                    .tsp-payment-receipt-modal {
                        position: static !important;
                        display: block !important;
                        padding: 0 !important;
                    }


                    .tsp-payment-receipt-overlay,
                    .tsp-receipt-actions {
                        display: none !important;
                    }


                    .tsp-payment-receipt-dialog {
                        position: static !important;
                        width: 100% !important;
                        max-height: none !important;
                        overflow: visible !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                    }


                    .tsp-printable-receipt {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        border-radius: 0 !important;
                    }

                }

            </style>

        `;
  }

  /* =========================================================
   * INIT
   * ========================================================= */

  async function init(container, params) {
    console.log("[Tenspick Client Payments] " + "Initializing...");

    if (!container) {
      throw new Error("Payments page container was not provided.");
    }

    if (
      !window.TenspickClientAPI ||
      typeof window.TenspickClientAPI.get !== "function"
    ) {
      throw new Error("TenspickClientAPI is not available.");
    }

    state.root = container;

    state.initialized = false;

    state.destroyed = false;

    state.error = null;

    state.projects = [];

    state.payments = [];

    state.summary = null;

    state.selectedPayment = null;

    const projectId = params?.id ?? params?.projectId ?? null;

    if (projectId !== null && projectId !== undefined && projectId !== "") {
      state.selectedProjectId = String(projectId);
    } else {
      state.selectedProjectId = null;
    }

    render();

    /*
     * Load client information, projects and
     * payments independently.
     *
     * Client information is required for the
     * receipt, but a temporary client API failure
     * should not prevent payment history.
     */

    await Promise.allSettled([loadClient(), loadProjects()]);

    /*
     * Preserve router project parameter.
     */

    if (projectId !== null && projectId !== undefined && projectId !== "") {
      state.selectedProjectId = String(projectId);
    }

    await loadPayments(state.selectedProjectId);

    state.initialized = true;

    console.log("[Tenspick Client Payments] " + "Initialized successfully.");

    return true;
  }

  /* =========================================================
   * REFRESH
   * ========================================================= */

  async function refresh() {
    if (!state.root) {
      return false;
    }

    await Promise.allSettled([loadClient(), loadProjects()]);

    await loadPayments(state.selectedProjectId);

    return true;
  }

  /* =========================================================
   * DESTROY
   * ========================================================= */

  function destroy() {
    state.requestSequence++;

    closePaymentReceipt();

    document.removeEventListener("keydown", receiptKeyboardHandler);

    state.root = null;

    state.initialized = false;

    state.destroyed = true;

    state.loading = false;

    state.loadingProjects = false;

    state.loadingClient = false;

    state.error = null;

    state.projects = [];

    state.payments = [];

    state.summary = null;

    state.client = null;

    state.selectedProjectId = null;

    state.selectedPayment = null;
  }

  /* =========================================================
   * GETTERS
   * ========================================================= */

  function getPayments() {
    return state.payments.slice();
  }

  function getProjects() {
    return state.projects.slice();
  }

  function getClient() {
    return state.client
      ? {
          ...state.client,
        }
      : null;
  }

  function getSummary() {
    return state.summary
      ? {
          ...state.summary,
        }
      : null;
  }

  function getSelectedProjectId() {
    return state.selectedProjectId;
  }

  /* =========================================================
   * PUBLIC MODULE
   * ========================================================= */

  window.TenspickClientPayments = {
    init,

    destroy,

    refresh,

    getPayments,

    getProjects,

    getClient,

    getSummary,

    getSelectedProjectId,
  };
})();
