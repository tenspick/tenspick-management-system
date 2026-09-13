/**
 * ============================================================
 * TENSPICK CRM
 * PROJECTS MODULE
 * ============================================================
 *
 * Frontend JavaScript
 *
 * Handles:
 *
 * - Project listing
 * - Search
 * - Filters
 * - Pagination
 * - Add project
 * - Edit project
 * - View project
 * - Delete project
 * - Client dropdown
 * - Staff / Project Manager dropdown
 * - Project action menu
 * - Responsive action menu positioning
 * - Project details popup
 * - Domain Purchased Email
 * - SEO Added Email
 *
 * API:
 *
 * GET     /api/projects
 * GET     /api/projects/{id}
 * POST    /api/projects
 * PUT     /api/projects/{id}
 * DELETE  /api/projects/{id}
 *
 * GET     /api/clients
 * GET     /api/staff
 *
 * ============================================================
 */

(function () {
  "use strict";

  /* ============================================================
       MODULE GUARD
       ============================================================ */

  if (
    window.TenspickProjects &&
    typeof window.TenspickProjects.destroy === "function"
  ) {
    try {
      window.TenspickProjects.destroy();
    } catch (error) {
      console.warn("[Projects] Previous module cleanup failed:", error);
    }
  }

  /* ============================================================
       CONFIG
       ============================================================ */

  const API_BASE =
    window.location.origin + "/tenspickk/backend/public/index.php/api";

  const PROJECTS_ENDPOINT = API_BASE + "/projects";

  const CLIENTS_ENDPOINT = API_BASE + "/clients";

  const STAFF_ENDPOINT = API_BASE + "/staff";

  const CSRF_ENDPOINT = API_BASE + "/security/csrf";

  const PER_PAGE = 10;

  const SEARCH_DELAY = 300;

  const MENU_GAP = 8;

  const VIEW_MODAL_ID = "projectViewModal";

  /* ============================================================
       STATUS MAP
       ============================================================ */

  const STATUS_MAP = {
    planning: {
      label: "Planning",
      className: "projects-status-planning",
    },

    not_started: {
      label: "Not Started",
      className: "projects-status-not-started",
    },

    in_progress: {
      label: "In Progress",
      className: "projects-status-in-progress",
    },

    review: {
      label: "Review",
      className: "projects-status-review",
    },

    client_review: {
      label: "Client Review",
      className: "projects-status-client-review",
    },

    completed: {
      label: "Completed",
      className: "projects-status-completed",
    },

    on_hold: {
      label: "On Hold",
      className: "projects-status-on-hold",
    },

    cancelled: {
      label: "Cancelled",
      className: "projects-status-cancelled",
    },
  };

  /* ============================================================
       STATE
       ============================================================ */

  const state = {
    initialized: false,

    destroyed: false,

    page: 1,

    perPage: PER_PAGE,

    total: 0,

    totalPages: 1,

    search: "",

    status: "",

    clientId: "",

    projectType: "",

    projects: [],

    clients: [],

    staff: [],

    editingId: null,

    deletingId: null,

    csrfToken: null,

    searchTimer: null,

    projectsAbortController: null,

    clientsAbortController: null,

    staffAbortController: null,

    singleProjectAbortController: null,

    clientsLoaded: false,

    staffLoaded: false,

    clientsLoading: false,

    staffLoading: false,

    previousModalFocus: null,

    previousDeleteModalFocus: null,

    previousViewModalFocus: null,

    saveLoading: false,

    deleteLoading: false,
  };

  /* ============================================================
       DOM
       ============================================================ */

  const dom = {};

  /* ============================================================
       CACHE DOM
       ============================================================ */

  function cacheDom() {
    dom.page = document.getElementById("projectsPage");

    if (!dom.page) {
      return false;
    }

    /* --------------------------------------------------------
           PAGE
           -------------------------------------------------------- */

    dom.addButton = document.getElementById("projectsAddBtn");

    dom.search = document.getElementById("projectsSearch");

    dom.statusFilter = document.getElementById("projectsStatusFilter");

    dom.clientFilter = document.getElementById("projectsClientFilter");

    dom.typeFilter = document.getElementById("projectsTypeFilter");

    dom.resetFilters = document.getElementById("projectsResetFilters");

    dom.table = document.getElementById("projectsTable");

    dom.tableBody = document.getElementById("projectsTableBody");

    dom.resultInfo = document.getElementById("projectsResultInfo");

    dom.paginationInfo = document.getElementById("projectsPaginationInfo");

    dom.paginationButtons = document.getElementById(
      "projectsPaginationButtons",
    );

    /* --------------------------------------------------------
           STATISTICS
           -------------------------------------------------------- */

    dom.totalCount = document.getElementById("projectsTotalCount");

    dom.inProgressCount = document.getElementById("projectsInProgressCount");

    dom.reviewCount = document.getElementById("projectsReviewCount");

    dom.completedCount = document.getElementById("projectsCompletedCount");

    /* --------------------------------------------------------
           PROJECT MODAL
           -------------------------------------------------------- */

    dom.modal = document.getElementById("projectModal");

    dom.modalOverlay = dom.modal
      ? dom.modal.querySelector(".projects-modal-overlay")
      : null;

    dom.modalTitle = document.getElementById("projectModalTitle");

    dom.modalClose = document.getElementById("projectModalClose");

    dom.form = document.getElementById("projectForm");

    dom.formId = document.getElementById("projectFormId");

    dom.client = document.getElementById("projectClient");

    dom.name = document.getElementById("projectName");

    dom.type = document.getElementById("projectType");

    dom.description = document.getElementById("projectDescription");

    dom.startDate = document.getElementById("projectStartDate");

    dom.expectedCompletion = document.getElementById(
      "projectExpectedCompletion",
    );

    dom.budget = document.getElementById("projectBudget");

    dom.status = document.getElementById("projectStatus");

    dom.progress = document.getElementById("projectProgress");

    dom.manager = document.getElementById("projectManager");

    dom.website = document.getElementById("projectWebsite");

    /* NEW */

    dom.domainPurchasedEmail = document.getElementById(
      "projectDomainPurchasedEmail",
    );

    dom.seoAddedEmail = document.getElementById("projectSeoAddedEmail");

    dom.hostingPlatform = document.getElementById("projectHostingPlatform");
    dom.hostingEmail = document.getElementById("projectHostingEmail");
    dom.domainRegistrar = document.getElementById("projectDomainRegistrar");
    dom.domainExpiryDate = document.getElementById("projectDomainExpiryDate");

    /* --------------------------------------------------------
           FORM BUTTONS
           -------------------------------------------------------- */

    dom.cancelButton = document.getElementById("projectCancelBtn");

    dom.saveButton = document.getElementById("projectSaveBtn");

    dom.saveSpinner = document.getElementById("projectSaveSpinner");

    dom.saveIcon = document.getElementById("projectSaveIcon");

    dom.saveText = document.getElementById("projectSaveText");

    /* --------------------------------------------------------
           DELETE MODAL
           -------------------------------------------------------- */

    dom.deleteModal = document.getElementById("projectDeleteModal");

    dom.deleteOverlay = dom.deleteModal
      ? dom.deleteModal.querySelector(".projects-modal-overlay")
      : null;

    dom.deleteMessage = document.getElementById("projectDeleteMessage");

    dom.deleteCancel = document.getElementById("projectDeleteCancel");

    dom.deleteConfirm = document.getElementById("projectDeleteConfirm");

    return true;
  }

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
       NUMBER
       ============================================================ */

  function toNumber(value, fallback = 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  /* ============================================================
       CURRENCY
       ============================================================ */

  function formatCurrency(value) {
    const amount = toNumber(value);

    return (
      "₹" +
      amount.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  /* ============================================================
       DATE
       ============================================================ */

  function normalizeDate(value) {
    if (!value) {
      return "";
    }

    return String(value).substring(0, 10);
  }

  function formatDate(value) {
    const raw = normalizeDate(value);

    if (!raw) {
      return "—";
    }

    const date = new Date(raw + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
      return escapeHtml(raw);
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  /* ============================================================
       STATUS
       ============================================================ */

  function getStatusLabel(status) {
    const key = String(status || "").toLowerCase();

    return STATUS_MAP[key]?.label || "Unknown";
  }

  function getStatusClass(status) {
    const key = String(status || "").toLowerCase();

    return STATUS_MAP[key]?.className || "projects-status-not-started";
  }

  function renderStatus(status) {
    return `
            <span
                class="projects-status ${escapeHtml(getStatusClass(status))}"
            >
                ${escapeHtml(getStatusLabel(status))}
            </span>
        `;
  }

  /* ============================================================
       API RESPONSE
       ============================================================ */

  async function parseJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json") || !response.ok) {
      return { success: true, data: [] };
    }

    return response.json().catch(() => ({ success: true, data: [] }));
  }

  /* ============================================================
       CSRF
       ============================================================ */

  async function fetchCsrfToken(force = false) {
    if (state.csrfToken && !force) {
      return state.csrfToken;
    }

    const response = await fetch(CSRF_ENDPOINT, {
      method: "GET",

      credentials: "include",

      headers: {
        Accept: "application/json",
      },
    });

    const result = await parseJsonResponse(response);

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to get security token.");
    }

    const token = result?.data?.token || result?.token || null;

    if (!token) {
      throw new Error("Security token was not returned.");
    }

    state.csrfToken = token;

    return token;
  }

  async function ensureCsrfToken() {
    if (state.csrfToken) {
      return state.csrfToken;
    }

    return fetchCsrfToken();
  }

  /* ============================================================
       CLIENT RESPONSE
       ============================================================ */

  function extractClients(result) {
    const data = result?.data || {};

    if (Array.isArray(data.clients)) {
      return data.clients;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(result?.clients)) {
      return result.clients;
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }

  /* ============================================================
       STAFF RESPONSE
       ============================================================ */

  function extractStaff(result) {
    const data = result?.data || {};

    if (Array.isArray(data.staff)) {
      return data.staff;
    }

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(result?.staff)) {
      return result.staff;
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }

  /* ============================================================
       STAFF NAME
       ============================================================ */

  function getStaffName(staff) {
    if (!staff) {
      return "Unnamed Staff";
    }

    return (
      staff.name ||
      staff.staff_name ||
      staff.full_name ||
      staff.employee_name ||
      (staff.first_name || staff.last_name
        ? [staff.first_name, staff.last_name].filter(Boolean).join(" ")
        : "") ||
      `Staff #${staff.id}`
    );
  }

  /* ============================================================
       CLIENT NAME
       ============================================================ */

  function getClientName(client) {
    if (!client) {
      return "Unnamed Client";
    }

    return (
      client.company_name ||
      client.client_name ||
      client.name ||
      client.business_name ||
      `Client #${client.id}`
    );
  }

  /* ============================================================
       LOAD CLIENTS
       ============================================================ */

  async function loadClients() {
    if (state.destroyed || state.clientsLoaded || state.clientsLoading) {
      return;
    }

    state.clientsLoading = true;

    try {
      let clientList = [];

      // 1. Try Supabase
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            const { data, error } = await sb.from("clients").select("*");
            if (!error && Array.isArray(data) && data.length > 0) {
              clientList = data;
            }
          }
        } catch (sbErr) {
          console.warn("[Projects] Supabase client load note:", sbErr);
        }
      }

      // 2. Try PHP API if Supabase didn't yield data
      if (!clientList.length) {
        try {
          const response = await fetch(CLIENTS_ENDPOINT + "?page=1&per_page=1000", {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" }
          });
          const result = await parseJsonResponse(response);
          if (response.ok && result.success) {
            clientList = extractClients(result);
          }
        } catch (apiErr) {
          console.warn("[Projects] PHP API client load note:", apiErr);
        }
      }

      // 3. Always merge LocalStorage items to avoid missing locally added clients
      try {
        const raw = localStorage.getItem("tenspick_clients");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(localItem => {
              if (!clientList.some(c => String(c.id) === String(localItem.id))) {
                clientList.push(localItem);
              }
            });
          }
        }
      } catch (e) {}

      state.clients = clientList;
      state.clientsLoaded = true;
      populateClientDropdowns();
    } catch (error) {
      console.error("[Projects] Client loading error:", error);
    } finally {
      state.clientsLoading = false;
    }
  }

  /* ============================================================
       LOAD STAFF
       ============================================================ */

  async function loadStaff() {
    if (state.destroyed || state.staffLoaded || state.staffLoading) {
      return;
    }

    state.staffLoading = true;

    try {
      let staffList = [];

      // 1. Try Supabase
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            const { data, error } = await sb.from("staff").select("*");
            if (!error && Array.isArray(data) && data.length > 0) {
              staffList = data;
            }
          }
        } catch (sbErr) {
          console.warn("[Projects] Supabase staff load note:", sbErr);
        }
      }

      // 2. Try PHP API if Supabase didn't yield data
      if (!staffList.length) {
        try {
          const response = await fetch(STAFF_ENDPOINT + "?page=1&per_page=1000&status=active", {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" }
          });
          const result = await parseJsonResponse(response);
          if (response.ok && result.success) {
            staffList = extractStaff(result);
          }
        } catch (apiErr) {
          console.warn("[Projects] PHP API staff load note:", apiErr);
        }
      }

      // 3. Always merge LocalStorage items
      try {
        const raw = localStorage.getItem("tenspick_staff");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(localItem => {
              if (!staffList.some(s => String(s.id) === String(localItem.id))) {
                staffList.push(localItem);
              }
            });
          }
        }
      } catch (e) {}

      state.staff = staffList;
      state.staffLoaded = true;
      renderStaffManagerSelect();
    } catch (error) {
      console.error("[Projects] Staff loading error:", error);
    } finally {
      state.staffLoading = false;
    }
  }

  /* ============================================================
       STAFF FALLBACK
       ============================================================ */

  async function loadStaffWithoutStatus() {
    try {
      const response = await fetch(STAFF_ENDPOINT + "?page=1&per_page=1000", {
        method: "GET",

        credentials: "include",

        headers: {
          Accept: "application/json",
        },
      });

      const result = await parseJsonResponse(response);

      if (!response.ok || !result.success) {
        return;
      }

      state.staff = extractStaff(result);

      /*
       * Filter active staff
       * client-side when the API
       * doesn't support status.
       */

      state.staff = state.staff.filter(function (staff) {
        if (staff.status === undefined) {
          return true;
        }

        return String(staff.status).toLowerCase() === "active";
      });

      state.staffLoaded = true;

      renderStaffManagerSelect();
    } catch (error) {
      console.error("[Projects] Staff fallback error:", error);
    }
  }

  /* ============================================================
       CLIENT DROPDOWNS
       ============================================================ */

  function populateClientDropdowns() {
    if (!dom.clientFilter || !dom.client) {
      return;
    }

    const filterValue = state.clientId || dom.clientFilter.value || "";

    const formValue = dom.client.value || "";

    dom.clientFilter.innerHTML = "";

    const allOption = document.createElement("option");

    allOption.value = "";

    allOption.textContent = "All Clients";

    dom.clientFilter.appendChild(allOption);

    dom.client.innerHTML = "";

    const selectOption = document.createElement("option");

    selectOption.value = "";

    selectOption.textContent = "Select Client";

    dom.client.appendChild(selectOption);

    state.clients.forEach(function (client) {
      const id = client.id;

      if (id === null || id === undefined || String(id).trim() === "") {
        return;
      }

      const name = getClientName(client);

      const code = client.client_code ? ` (${client.client_code})` : "";

      const label = name + code;

      const filterOption = document.createElement("option");

      filterOption.value = String(id);

      filterOption.textContent = label;

      dom.clientFilter.appendChild(filterOption);

      const formOption = document.createElement("option");

      formOption.value = String(id);

      formOption.textContent = label;

      dom.client.appendChild(formOption);
    });

    dom.clientFilter.value = filterValue;

    if (
      [...dom.client.options].some(function (option) {
        return option.value === String(formValue);
      })
    ) {
      dom.client.value = formValue;
    }
  }

  /* ============================================================
       PROJECT TYPES
       ============================================================ */

  function populateProjectTypes() {
    if (!dom.typeFilter) {
      return;
    }

    const current = state.projectType;

    const types = [
      ...new Set(
        state.projects
          .map(function (project) {
            return String(project.project_type || "").trim();
          })
          .filter(Boolean),
      ),
    ].sort(function (a, b) {
      return a.localeCompare(b);
    });

    dom.typeFilter.innerHTML = "";

    const all = document.createElement("option");

    all.value = "";

    all.textContent = "All Project Types";

    dom.typeFilter.appendChild(all);

    types.forEach(function (type) {
      const option = document.createElement("option");

      option.value = type;

      option.textContent = type;

      dom.typeFilter.appendChild(option);
    });

    dom.typeFilter.value = current;
  }

  /* ============================================================
       STAFF MANAGER SELECT
       ============================================================ */

  function ensureManagerSelect() {
    if (!dom.manager) {
      return null;
    }

    /*
     * The HTML can contain either:
     *
     * <input id="projectManager">
     *
     * or
     *
     * <select id="projectManager">
     *
     * Convert the old numeric input into
     * a select automatically.
     */

    if (dom.manager.tagName.toLowerCase() !== "select") {
      const select = document.createElement("select");

      select.id = "projectManager";

      select.name = "project_manager_id";

      select.className = dom.manager.className || "";

      select.required = false;

      select.setAttribute("aria-label", "Project Manager");

      dom.manager.replaceWith(select);

      dom.manager = select;
    }

    return dom.manager;
  }

  /* ============================================================
       RENDER STAFF MANAGER
       ============================================================ */

  function renderStaffManagerSelect() {
    const select = ensureManagerSelect();

    if (!select) {
      return;
    }

    const currentValue = select.value || "";

    select.innerHTML = "";

    const first = document.createElement("option");

    first.value = "";

    first.textContent = state.staff.length
      ? "Select Project Manager"
      : "No Staff Available";

    select.appendChild(first);

    state.staff.forEach(function (staff) {
      const id = staff.id;

      if (id === null || id === undefined || String(id).trim() === "") {
        return;
      }

      const option = document.createElement("option");

      option.value = String(id);

      option.textContent = getStaffName(staff);

      select.appendChild(option);
    });

    if (
      [...select.options].some(function (option) {
        return option.value === String(currentValue);
      })
    ) {
      select.value = currentValue;
    }
  }

  /* ============================================================
       STAFF DISPLAY NAME BY ID
       ============================================================ */

  function getStaffNameById(id) {
    if (id === null || id === undefined || String(id).trim() === "") {
      return "Unassigned";
    }

    const staff = state.staff.find(function (item) {
      return String(item.id) === String(id);
    });

    if (staff) {
      return getStaffName(staff);
    }

    return `Staff #${id}`;
  }

  /* ============================================================
       CLIENT DISPLAY NAME BY ID
       ============================================================ */

  function getClientNameById(id) {
    const client = state.clients.find(function (item) {
      return String(item.id) === String(id);
    });

    if (client) {
      return getClientName(client);
    }

    return `Client #${id || ""}`;
  }

  /* ============================================================
       PROJECT RESPONSE EXTRACTION
       ============================================================ */

  function extractProjectList(result) {
    const data = result?.data || {};

    let projects = [];

    if (Array.isArray(data.projects)) {
      projects = data.projects;
    } else if (Array.isArray(data.items)) {
      projects = data.items;
    } else if (Array.isArray(result?.projects)) {
      projects = result.projects;
    } else if (Array.isArray(data)) {
      projects = data;
    }

    const pagination = data.pagination || result?.pagination || {};

    const total = toNumber(
      pagination.total ?? data.total ?? result?.total ?? projects.length,
    );

    const page = toNumber(
      pagination.page ?? data.page ?? result?.page ?? state.page,
      state.page,
    );

    const perPage = toNumber(
      pagination.per_page ??
        pagination.perPage ??
        data.per_page ??
        result?.per_page ??
        state.perPage,
      state.perPage,
    );

    const calculatedPages = Math.max(
      1,
      Math.ceil(total / Math.max(1, perPage)),
    );

    const totalPages = toNumber(
      pagination.total_pages ??
        pagination.totalPages ??
        data.total_pages ??
        result?.total_pages ??
        calculatedPages,
      calculatedPages,
    );

    return {
      projects,
      total,
      page,
      perPage,
      totalPages,
    };
  }

  /* ============================================================
       POPULATE PROJECT TYPES
       ============================================================ */

  function populateProjectTypes() {
    if (!dom.typeFilter) return;
    const current = dom.typeFilter.value;
    const types = new Set();
    (state.projects || []).forEach(p => {
      if (p.project_type) types.add(p.project_type);
    });
    let html = '<option value="">All Types</option>';
    types.forEach(t => {
      html += `<option value="${escapeHtml(t)}"${t === current ? ' selected' : ''}>${escapeHtml(t)}</option>`;
    });
    dom.typeFilter.innerHTML = html;
  }

  /* ============================================================
       LOAD PROJECTS
       ============================================================ */

  async function loadProjects() {
    if (state.destroyed) {
      return;
    }

    if (state.projectsAbortController) {
      state.projectsAbortController.abort();
    }

    const controller = new AbortController();

    state.projectsAbortController = controller;

    showLoading();

    try {
      let loadedList = [];

      // 1. Try Supabase
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            const { data, error } = await sb.from("projects").select("*");
            if (!error && Array.isArray(data) && data.length > 0) {
              loadedList = data;
            }
          }
        } catch (sbErr) {
          console.warn("[Projects] Supabase load note:", sbErr);
        }
      }

      // 2. Try PHP API if Supabase yielded nothing
      if (!loadedList.length) {
        try {
          const params = new URLSearchParams();
          params.set("page", String(state.page));
          params.set("per_page", String(state.perPage));
          if (state.search) params.set("search", state.search);
          if (state.status) params.set("status", state.status);
          if (state.clientId) params.set("client_id", state.clientId);
          if (state.projectType) params.set("project_type", state.projectType);

          const response = await fetch(PROJECTS_ENDPOINT + "?" + params.toString(), {
            method: "GET",
            credentials: "include",
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });

          const result = await parseJsonResponse(response);
          if (response.ok && result.success) {
            const extracted = extractProjectList(result);
            loadedList = extracted.projects || [];
          }
        } catch (apiErr) {
          console.warn("[Projects] PHP API load note:", apiErr);
        }
      }

      // 3. Merge LocalStorage projects
      try {
        const raw = localStorage.getItem("tenspick_projects");
        if (raw) {
          const localProjects = JSON.parse(raw) || [];
          localProjects.forEach(lp => {
            if (!loadedList.some(p => String(p.id) === String(lp.id))) {
              loadedList.push(lp);
            }
          });
        }
      } catch (e) {}

      // Apply Filters
      let filteredProjects = loadedList;
      if (state.search) {
        const s = state.search.toLowerCase();
        filteredProjects = filteredProjects.filter(p =>
          (p.project_name || "").toLowerCase().includes(s) ||
          (p.client_name || "").toLowerCase().includes(s)
        );
      }
      if (state.status) {
        filteredProjects = filteredProjects.filter(p => p.status === state.status);
      }
      if (state.clientId) {
        filteredProjects = filteredProjects.filter(p => String(p.client_id) === String(state.clientId));
      }
      if (state.projectType) {
        filteredProjects = filteredProjects.filter(p => p.project_type === state.projectType);
      }

      state.projects = filteredProjects;
      state.total = filteredProjects.length;
      state.totalPages = Math.ceil(filteredProjects.length / state.perPage) || 1;

      populateProjectTypes();
      renderProjects();
      updateStatistics();
      renderPagination();
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.error("[Projects] loadProjects error:", error);
      renderProjects();
    }
  }

  /* ============================================================
       LOADING STATE
       ============================================================ */

  function showLoading() {
    if (!dom.tableBody) {
      return;
    }

    dom.tableBody.innerHTML = `
            <tr>

                <td
                    colspan="10"
                    class="projects-table-message"
                >

                    <div
                        class="projects-loading"
                    >

                        <span
                            class="projects-spinner"
                            aria-hidden="true"
                        ></span>

                        <span>
                            Loading projects...
                        </span>

                    </div>

                </td>

            </tr>
        `;
  }

  /* ============================================================
       ERROR STATE
       ============================================================ */

  function showError(message) {
    if (!dom.tableBody) {
      return;
    }

    dom.tableBody.innerHTML = `
            <tr>

                <td
                    colspan="10"
                    class="projects-table-message"
                >

                    <div
                        class="projects-empty-state"
                    >

                        <i
                            class="bi bi-exclamation-circle"
                            aria-hidden="true"
                        ></i>

                        <strong>
                            Unable to load projects
                        </strong>

                        <span>
                            ${escapeHtml(message)}
                        </span>

                        <button
                            type="button"
                            class="projects-btn projects-btn-light"
                            data-project-action="retry"
                        >

                            <i
                                class="bi bi-arrow-clockwise"
                                aria-hidden="true"
                            ></i>

                            Retry

                        </button>

                    </div>

                </td>

            </tr>
        `;
  }

  /* ============================================================
       EMPTY STATE
       ============================================================ */

  function showEmpty() {
    if (!dom.tableBody) {
      return;
    }

    dom.tableBody.innerHTML = `
            <tr>

                <td
                    colspan="10"
                    class="projects-table-message"
                >

                    <div
                        class="projects-empty-state"
                    >

                        <i
                            class="bi bi-kanban"
                            aria-hidden="true"
                        ></i>

                        <strong>
                            No projects found
                        </strong>

                        <span>
                            Try changing your search or filters.
                        </span>

                    </div>

                </td>

            </tr>
        `;
  }

  /* ============================================================
       RENDER PROJECTS
       ============================================================ */

  function renderProjects() {
    if (!dom.tableBody) {
      return;
    }

    if (state.projects.length === 0) {
      showEmpty();

      updateResultInfo();

      return;
    }

    dom.tableBody.innerHTML = state.projects.map(renderProjectRow).join("");

    updateResultInfo();
  }

  /* ============================================================
       RENDER PROJECT ROW
       ============================================================ */

  function renderProjectRow(project) {
    const id = toNumber(project.id);

    const projectName = project.project_name || "Untitled Project";

    const clientName =
      project.company_name ||
      project.client_name ||
      getClientNameById(project.client_id);

    const clientCode = project.client_code || "";

    const managerName =
      project.project_manager_name ||
      project.manager_name ||
      getStaffNameById(project.project_manager_id);

    const progressRaw = toNumber(project.progress_percentage);

    const progress = Math.max(0, Math.min(100, progressRaw));

    return `
            <tr
                data-project-id="${id}"
            >

                <!-- PROJECT -->

                <td>

                    <div
                        class="projects-project-cell"
                    >

                        <span
                            class="projects-project-name"
                            title="${escapeHtml(projectName)}"
                        >
                            ${escapeHtml(projectName)}
                        </span>

                    </div>

                </td>


                <!-- CLIENT -->

                <td>

                    <span
                        class="projects-client-name"
                    >
                        ${escapeHtml(clientName)}
                    </span>

                    ${
                      clientCode
                        ? `
                                <span
                                    class="projects-client-code"
                                >
                                    ${escapeHtml(clientCode)}
                                </span>
                            `
                        : ""
                    }

                </td>


                <!-- TYPE -->

                <td>
                    ${escapeHtml(project.project_type || "—")}
                </td>


                <!-- START -->

                <td>
                    ${formatDate(project.start_date)}
                </td>


                <!-- EXPECTED -->

                <td>
                    ${formatDate(project.expected_completion)}
                </td>


                <!-- BUDGET -->

                <td>
                    ${formatCurrency(project.budget)}
                </td>


                <!-- STATUS -->

                <td>
                    ${renderStatus(project.status)}
                </td>


                <!-- PROGRESS -->

                <td>

                    <div
                        class="projects-progress-cell"
                    >

                        <div
                            class="projects-progress-top"
                        >

                            <span
                                class="projects-progress-value"
                            >
                                ${progress}%
                            </span>

                        </div>

                        <div
                            class="projects-progress-bar"
                        >

                            <div
                                class="projects-progress-fill"
                                style="width:${progress}%"
                            ></div>

                        </div>

                    </div>

                </td>


                <!-- MANAGER -->

                <td>
                    ${escapeHtml(managerName)}
                </td>


                <!-- ACTIONS -->

                <td
                    class="projects-action-column"
                >

                    <div
                        class="projects-action-wrapper"
                    >

                        <button
                            type="button"
                            class="projects-action-btn"
                            data-project-action="menu"
                            data-project-id="${id}"
                            aria-label="Project actions"
                            aria-expanded="false"
                            title="Actions"
                        >

                            <i
                                class="bi bi-three-dots-vertical"
                                aria-hidden="true"
                            ></i>

                        </button>


                        <div
                            class="projects-action-menu"
                            hidden
                        >

                            <button
                                type="button"
                                class="projects-action-item"
                                data-project-action="view"
                                data-project-id="${id}"
                            >

                                <i
                                    class="bi bi-eye"
                                    aria-hidden="true"
                                ></i>

                                <span>
                                    View
                                </span>

                            </button>


                            <button
                                type="button"
                                class="projects-action-item"
                                data-project-action="edit"
                                data-project-id="${id}"
                            >

                                <i
                                    class="bi bi-pencil"
                                    aria-hidden="true"
                                ></i>

                                <span>
                                    Edit
                                </span>

                            </button>


                            ${!(window.TenspickAuth && window.TenspickAuth.isStaff()) ? `
                            <button
                                type="button"
                                class="projects-action-item projects-action-item-danger"
                                data-project-action="delete"
                                data-project-id="${id}"
                            >

                                <i
                                    class="bi bi-trash3"
                                    aria-hidden="true"
                                ></i>

                                <span>
                                    Delete
                                </span>

                            </button>
                            ` : ""}

                        </div>

                    </div>

                </td>

            </tr>
        `;
  }

  /* ============================================================
       RESULT INFO
       ============================================================ */

  function updateResultInfo() {
    if (!dom.resultInfo) {
      return;
    }

    if (state.total === 0) {
      dom.resultInfo.textContent = "No projects found";

      if (dom.paginationInfo) {
        dom.paginationInfo.textContent = "Showing 0 of 0";
      }

      return;
    }

    const start = (state.page - 1) * state.perPage + 1;

    const end = Math.min(state.page * state.perPage, state.total);

    dom.resultInfo.textContent = `Showing ${start}-${end} of ${state.total} projects`;

    if (dom.paginationInfo) {
      dom.paginationInfo.textContent = `Showing ${start}-${end} of ${state.total}`;
    }
  }

  /* ============================================================
       STATISTICS
       ============================================================ */

  function updateStatistics() {
    /*
     * Because the API is paginated,
     * statistics based only on the
     * current page are not globally
     * accurate.
     *
     * Prefer server-provided totals
     * when available.
     */

    const inProgress = state.projects.filter(function (project) {
      return project.status === "in_progress";
    }).length;

    const review = state.projects.filter(function (project) {
      return project.status === "review" || project.status === "client_review";
    }).length;

    const completed = state.projects.filter(function (project) {
      return project.status === "completed";
    }).length;

    if (dom.totalCount) {
      dom.totalCount.textContent = state.total;
    }

    if (dom.inProgressCount) {
      dom.inProgressCount.textContent = inProgress;
    }

    if (dom.reviewCount) {
      dom.reviewCount.textContent = review;
    }

    if (dom.completedCount) {
      dom.completedCount.textContent = completed;
    }
  }

  /* ============================================================
       PAGINATION
       ============================================================ */

  function renderPagination() {
    if (!dom.paginationButtons) {
      return;
    }

    if (state.totalPages <= 1) {
      dom.paginationButtons.innerHTML = "";

      return;
    }

    const buttons = [];

    buttons.push(`
            <button
                type="button"
                class="projects-page-btn"
                data-project-page="${state.page - 1}"
                ${state.page <= 1 ? "disabled" : ""}
                aria-label="Previous page"
            >

                <i
                    class="bi bi-chevron-left"
                    aria-hidden="true"
                ></i>

            </button>
        `);

    const maxVisible = 5;

    let start = Math.max(1, state.page - Math.floor(maxVisible / 2));

    let end = Math.min(state.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let page = start; page <= end; page++) {
      buttons.push(`
                <button
                    type="button"
                    class="projects-page-btn ${
                      page === state.page ? "active" : ""
                    }"
                    data-project-page="${page}"
                    ${page === state.page ? 'aria-current="page"' : ""}
                >
                    ${page}
                </button>
            `);
    }

    buttons.push(`
            <button
                type="button"
                class="projects-page-btn"
                data-project-page="${state.page + 1}"
                ${state.page >= state.totalPages ? "disabled" : ""}
                aria-label="Next page"
            >

                <i
                    class="bi bi-chevron-right"
                    aria-hidden="true"
                ></i>

            </button>
        `);

    dom.paginationButtons.innerHTML = buttons.join("");
  }

  /* ============================================================
       ADD PROJECT
       ============================================================ */

  async function openAddModal(event) {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }

    cacheDom();

    if (!dom.modal) {
      dom.modal = document.getElementById("projectModal");
    }

    if (!dom.form) {
      dom.form = document.getElementById("projectForm");
    }

    state.previousModalFocus = event?.currentTarget || document.activeElement;
    state.editingId = null;

    resetForm();

    if (!state.clientsLoaded) {
      await loadClients();
    } else {
      populateClientDropdowns();
    }

    if (!state.staffLoaded) {
      await loadStaff();
    } else {
      renderStaffManagerSelect();
    }

    if (dom.modalTitle) {
      dom.modalTitle.textContent = "Add Project";
    }

    if (dom.saveText) {
      dom.saveText.textContent = "Save Project";
    }

    openModal(dom.modal, "project");
  }

  /* ============================================================
       FETCH SINGLE PROJECT
       ============================================================ */

  async function fetchProject(projectId) {
    if (state.singleProjectAbortController) {
      state.singleProjectAbortController.abort();
    }

    state.singleProjectAbortController = new AbortController();

    const response = await fetch(
      PROJECTS_ENDPOINT + "/" + encodeURIComponent(projectId),
      {
        method: "GET",

        credentials: "include",

        headers: {
          Accept: "application/json",
        },

        signal: state.singleProjectAbortController.signal,
      },
    );

    const result = await parseJsonResponse(response);

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Unable to load project.");
    }

    return result?.data?.project || result?.project || result?.data || null;
  }

  /* ============================================================
       EDIT PROJECT
       ============================================================ */

  async function openEditModal(projectId) {
    cacheDom();
    const id = projectId;

    if (id === null || id === undefined || String(id).trim() === "") {
      return;
    }

    state.previousModalFocus = document.activeElement;

    try {
      setSaveLoading(true, "Loading...");

      /*
       * Make sure staff are available
       * before filling the manager.
       */

      if (!state.staffLoaded) {
        await loadStaff();
      }

      if (!state.clientsLoaded) {
        await loadClients();
      }

      const project = await fetchProject(id);

      if (!project) {
        throw new Error("Project not found.");
      }

      if (state.destroyed) {
        return;
      }

      state.editingId = id;

      fillForm(project);

      if (dom.modalTitle) {
        dom.modalTitle.textContent = "Edit Project";
      }

      if (dom.saveText) {
        dom.saveText.textContent = "Update Project";
      }

      openModal(dom.modal, "project");
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("[Projects] Edit error:", error);

      showAlert(error.message || "Unable to load project.");
    } finally {
      setSaveLoading(false);
    }
  }

  /* ============================================================
       FILL FORM
       ============================================================ */

  function fillForm(project) {
    if (!project || !dom.form) {
      return;
    }

    renderStaffManagerSelect();

    if (dom.formId) {
      dom.formId.value = project.id || "";
    }

    if (dom.client) {
      dom.client.value = project.client_id || "";
    }

    if (dom.name) {
      dom.name.value = project.project_name || "";
    }

    if (dom.type) {
      dom.type.value = project.project_type || "";
    }

    if (dom.description) {
      dom.description.value = project.description || "";
    }

    if (dom.startDate) {
      dom.startDate.value = normalizeDate(project.start_date);
    }

    if (dom.expectedCompletion) {
      dom.expectedCompletion.value = normalizeDate(project.expected_completion);
    }

    if (dom.budget) {
      dom.budget.value = project.budget ?? "";
    }

    if (dom.status) {
      dom.status.value = project.status || "planning";
    }

    if (dom.progress) {
      dom.progress.value = project.progress_percentage ?? 0;
    }

    if (dom.manager) {
      dom.manager.value = project.project_manager_id || "";
    }

    if (dom.website) {
      dom.website.value = project.live_website_link || "";
    }

    /*
     * NEW EMAIL FIELDS
     */

    if (dom.domainPurchasedEmail) {
      dom.domainPurchasedEmail.value = project.domain_purchased_email || "";
    }

    if (dom.seoAddedEmail) {
      dom.seoAddedEmail.value = project.seo_added_email || "";
    }

    if (dom.hostingPlatform) {
      dom.hostingPlatform.value = project.hosting_platform || "";
    }

    if (dom.hostingEmail) {
      dom.hostingEmail.value = project.hosting_email || "";
    }

    if (dom.domainRegistrar) {
      dom.domainRegistrar.value = project.domain_registrar || "";
    }

    if (dom.domainExpiryDate) {
      dom.domainExpiryDate.value = project.domain_expiry_date || "";
    }

    clearFormErrors();
  }

  /* ============================================================
       RESET FORM
       ============================================================ */

  function resetForm() {
    if (!dom.form) {
      return;
    }

    dom.form.reset();

    if (dom.formId) {
      dom.formId.value = "";
    }

    if (dom.status) {
      dom.status.value = "planning";
    }

    if (dom.progress) {
      dom.progress.value = "0";
    }

    /*
     * Rebuild manager dropdown
     * after form.reset().
     */

    renderStaffManagerSelect();

    if (dom.manager) {
      dom.manager.value = "";
    }

    if (dom.hostingPlatform) dom.hostingPlatform.value = "";
    if (dom.hostingEmail) dom.hostingEmail.value = "";
    if (dom.domainRegistrar) dom.domainRegistrar.value = "";
    if (dom.domainExpiryDate) dom.domainExpiryDate.value = "";

    clearFormErrors();
  }

  /* ============================================================
       COLLECT FORM DATA
       ============================================================ */

  function collectFormData() {
    const budgetValue = String(dom.budget?.value || "").trim();
    const progressValue = String(dom.progress?.value || "0").trim();
    const managerValue = String(dom.manager?.value || "").trim();
    const discountValue = String(document.getElementById("projectDiscountAmount")?.value || "").trim();
    const amountRecValue = String(document.getElementById("projectAmountReceived")?.value || "").trim();
    const amountRecDate = document.getElementById("projectAmountReceivedDate")?.value || "";

    const selectedClientId = dom.client?.value || "";
    const matchedClient = (state.clients || []).find(c => String(c.id) === String(selectedClientId));

    return {
      client_id: selectedClientId,
      client_name: matchedClient ? (matchedClient.company_name || matchedClient.name || matchedClient.client_name) : ("Client #" + selectedClientId),
      project_name: dom.name?.value.trim() || "",
      project_type: dom.type?.value.trim() || "",
      description: dom.description?.value.trim() || "",
      start_date: dom.startDate?.value || "",
      received_date: dom.startDate?.value || "",
      expected_completion: dom.expectedCompletion?.value || "",
      project_submitted_date: dom.expectedCompletion?.value || "",
      budget: budgetValue === "" ? 0 : Number(budgetValue),
      amount_quoted: budgetValue === "" ? 0 : Number(budgetValue),
      discount_amount: discountValue === "" ? 0 : Number(discountValue),
      amount_received: amountRecValue === "" ? 0 : Number(amountRecValue),
      amount_received_date: amountRecDate,
      status: dom.status?.value || "planning",
      progress_percentage: progressValue === "" ? 0 : Number(progressValue),
      project_manager_id: managerValue === "" ? null : Number(managerValue),
      live_website_link: dom.website?.value.trim() || "",
      domain_purchased_email: dom.domainPurchasedEmail?.value.trim() || "",
      seo_added_email: dom.seoAddedEmail?.value.trim() || "",
      hosting_platform: dom.hostingPlatform?.value.trim() || "",
      hosting_email: dom.hostingEmail?.value.trim() || "",
      domain_registrar: dom.domainRegistrar?.value.trim() || "",
      domain_expiry_date: dom.domainExpiryDate?.value || "",
    };
  }

  /* ============================================================
       EMAIL VALIDATION
       ============================================================ */

  function isValidEmail(email) {
    if (!email) {
      return true;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ============================================================
       FORM VALIDATION
       ============================================================ */

  function validateFormData(data) {
    const errors = {};

    if (!data.client_id || String(data.client_id).trim() === "") {
      errors.client_id = "Please select a client.";
    }

    if (!data.project_name) {
      errors.project_name = "Project name is required.";
    }

    if (data.project_name.length > 200) {
      errors.project_name = "Project name cannot exceed 200 characters.";
    }

    if (Number.isNaN(data.budget) || data.budget < 0) {
      errors.budget = "Enter a valid budget.";
    }

    if (
      Number.isNaN(data.progress_percentage) ||
      data.progress_percentage < 0 ||
      data.progress_percentage > 100
    ) {
      errors.progress_percentage = "Progress must be between 0 and 100.";
    }

    if (
      data.start_date &&
      data.expected_completion &&
      data.expected_completion < data.start_date
    ) {
      errors.expected_completion =
        "Completion date cannot be before start date.";
    }

    if (data.live_website_link) {
      try {
        new URL(data.live_website_link);
      } catch {
        errors.live_website_link = "Enter a valid website URL.";
      }
    }

    if (
      data.domain_purchased_email &&
      !isValidEmail(data.domain_purchased_email)
    ) {
      errors.domain_purchased_email = "Enter a valid domain purchase email.";
    }

    if (data.seo_added_email && !isValidEmail(data.seo_added_email)) {
      errors.seo_added_email = "Enter a valid SEO email.";
    }

    return {
      valid: Object.keys(errors).length === 0,

      errors,
    };
  }

  /* ============================================================
       SHOW VALIDATION ERRORS
       ============================================================ */

  function showValidationErrors(errors) {
    const inputMap = {
      client_id: dom.client,

      project_name: dom.name,

      budget: dom.budget,

      expected_completion: dom.expectedCompletion,

      progress_percentage: dom.progress,

      live_website_link: dom.website,

      domain_purchased_email: dom.domainPurchasedEmail,

      seo_added_email: dom.seoAddedEmail,
    };

    Object.entries(errors).forEach(function ([field, message]) {
      const errorElement = dom.form?.querySelector(
        `[data-error-for="${field}"]`,
      );

      if (errorElement) {
        errorElement.textContent = message;
      }

      const input = inputMap[field];

      if (input) {
        input.style.borderColor = "#dc3545";

        input.focus();
      }
    });
  }

  /* ============================================================
       CLEAR ERRORS
       ============================================================ */

  function clearFormErrors() {
    if (!dom.form) {
      return;
    }

    dom.form
      .querySelectorAll(".projects-field-error")
      .forEach(function (element) {
        element.textContent = "";
      });

    [
      dom.client,
      dom.name,
      dom.budget,
      dom.expectedCompletion,
      dom.progress,
      dom.website,
      dom.domainPurchasedEmail,
      dom.seoAddedEmail,
    ]
      .filter(Boolean)
      .forEach(function (element) {
        element.style.borderColor = "";
      });
  }

  /* ============================================================
       SAVE LOADING
       ============================================================ */

  function setSaveLoading(loading, text) {
    state.saveLoading = loading;

    if (!dom.saveButton) {
      return;
    }

    dom.saveButton.disabled = loading;

    if (dom.saveSpinner) {
      dom.saveSpinner.style.display = loading ? "inline-block" : "none";
    }

    if (dom.saveIcon) {
      dom.saveIcon.style.display = loading ? "none" : "inline-block";
    }

    if (dom.saveText) {
      if (text) {
        dom.saveText.textContent = text;
      } else {
        dom.saveText.textContent = state.editingId
          ? "Update Project"
          : "Save Project";
      }
    }
  }

  /* ============================================================
       SAVE PROJECT
       ============================================================ */

  async function saveProject(event) {
    event.preventDefault();

    if (state.saveLoading || state.destroyed) {
      return;
    }

    clearFormErrors();

    const data = collectFormData();

    const validation = validateFormData(data);

    if (!validation.valid) {
      showValidationErrors(validation.errors);

      return;
    }

    const editing = Boolean(state.editingId);

    try {
      setSaveLoading(true, editing ? "Updating..." : "Saving...");

      // 1. Save to LocalStorage for offline persistence & Client Portal sync
      // 1. Save to Supabase if configured
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            if (editing) {
              await sb.from("projects").update(data).eq("id", state.editingId);
            } else {
              await sb.from("projects").insert([data]);
            }
          }
        } catch (sbErr) {
          console.warn("[Projects] Supabase save note:", sbErr);
        }
      }

      // 2. Save to LocalStorage for offline persistence & Client Portal sync
      let localList = [];
      try {
        const raw = localStorage.getItem("tenspick_projects");
        if (raw) localList = JSON.parse(raw) || [];
      } catch (e) {}

      if (editing) {
        const idx = localList.findIndex(p => String(p.id) === String(state.editingId));
        if (idx >= 0) {
          localList[idx] = { ...localList[idx], ...data };
        } else {
          localList.unshift({ id: state.editingId, ...data });
        }
      } else {
        const newId = Date.now();
        const initialPayment = data.amount_received ? [{
          id: Date.now(),
          amount: data.amount_received,
          date: data.amount_received_date || new Date().toISOString().substring(0, 10),
          method: "Advance Payment",
          notes: "Initial Project Advance"
        }] : [];

        const newProject = {
          id: newId,
          ...data,
          payments: initialPayment,
          created_at: new Date().toISOString()
        };
        localList.unshift(newProject);
      }

      localStorage.setItem("tenspick_projects", JSON.stringify(localList));
      localStorage.setItem("tenspick_client_projects", JSON.stringify(localList));

      // 3. Attempt PHP API request silently
      try {
        const token = await ensureCsrfToken();
        const url = editing ? PROJECTS_ENDPOINT + "/" + encodeURIComponent(state.editingId) : PROJECTS_ENDPOINT;
        const method = editing ? "PUT" : "POST";
        await fetch(url, {
          method,
          credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json", "X-CSRF-Token": token },
          body: JSON.stringify(data)
        });
      } catch (apiErr) {
        console.warn("[Projects] API Save note:", apiErr);
      }

      closeModal(dom.modal, "project");
      showAlert(editing ? "Project updated successfully!" : "Project created successfully!", "success");
      await loadProjects();
    } catch (error) {
      console.error("[Projects] Save error:", error);
      showAlert(error.message || "Unable to save project.");
    } finally {
      setSaveLoading(false);
    }
  }

  /* ============================================================
       DELETE MODAL
       ============================================================ */

  function openDeleteModal(projectId) {
    cacheDom();
    if (window.TenspickAuth && window.TenspickAuth.isStaff()) {
      showAlert("Permission Denied: Staff members are not permitted to delete projects.");
      return;
    }

    const id = projectId;

    if (id === null || id === undefined || String(id).trim() === "") {
      return;
    }

    const project = state.projects.find(function (item) {
      return String(item.id) === String(id);
    });

    if (!project) {
      showAlert("Project not found.");

      return;
    }

    state.deletingId = id;

    state.previousDeleteModalFocus = document.activeElement;

    if (dom.deleteMessage) {
      dom.deleteMessage.textContent = `Are you sure you want to delete "${project.project_name}"?`;
    }

    openModal(dom.deleteModal, "delete");
  }

  /* ============================================================
       CONFIRM DELETE
       ============================================================ */

  async function confirmDelete() {
    if (state.deleteLoading) {
      return;
    }

    const id = state.deletingId;

    if (id === null || id === undefined || String(id).trim() === "") {
      return;
    }

    state.deleteLoading = true;

    const button = dom.deleteConfirm;

    const originalHTML = button ? button.innerHTML : "";

    try {
      if (button) {
        button.disabled = true;
        button.innerHTML = `
                    <span
                        class="projects-spinner"
                        aria-hidden="true"
                    ></span>
                    <span>
                        Deleting...
                    </span>
                `;
      }

      // 1. Delete from Supabase if configured
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            await sb.from("projects").delete().eq("id", id);
          }
        } catch (sbErr) {
          console.warn("[Projects] Supabase delete note:", sbErr);
        }
      }

      // 2. Delete from LocalStorage
      try {
        const raw = localStorage.getItem("tenspick_projects");
        if (raw) {
          let list = JSON.parse(raw) || [];
          list = list.filter(p => String(p.id) !== String(id));
          localStorage.setItem("tenspick_projects", JSON.stringify(list));
          localStorage.setItem("tenspick_client_projects", JSON.stringify(list));
        }
      } catch (e) {}

      // 3. Attempt PHP API delete
      try {
        const token = await ensureCsrfToken();
        await fetch(PROJECTS_ENDPOINT + "/" + encodeURIComponent(id), {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "X-CSRF-Token": token,
          },
        });
      } catch (apiErr) {
        console.warn("[Projects] API delete note:", apiErr);
      }

      closeModal(dom.deleteModal, "delete");
      state.deletingId = null;
      showAlert("Project deleted successfully.", "success");

      if (state.projects.length === 1 && state.page > 1) {
        state.page--;
      }

      await loadProjects();
    } catch (error) {
      console.error("[Projects] Delete error:", error);
      showAlert(error.message || "Unable to delete project.");
    } finally {
      state.deleteLoading = false;

      if (button) {
        button.disabled = false;

        button.innerHTML = originalHTML;
      }
    }
  }

  /* ============================================================
       CREATE VIEW MODAL
       ============================================================ */

  function createViewModal() {
    let modal = document.getElementById(VIEW_MODAL_ID);

    if (modal) {
      cacheViewDom(modal);

      return;
    }

    modal = document.createElement("div");

    modal.id = VIEW_MODAL_ID;

    modal.className = "projects-view-modal";

    modal.setAttribute("aria-hidden", "true");

    modal.setAttribute("inert", "");

    modal.innerHTML = `
            <div
                class="projects-view-overlay"
                data-project-view-close
            ></div>


            <div
                class="projects-view-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="projectViewTitle"
            >

                <div
                    class="projects-view-header"
                >

                    <div>

                        <span
                            class="projects-view-eyebrow"
                        >
                            Project Details
                        </span>

                        <h2
                            id="projectViewTitle"
                        >
                            Project
                        </h2>

                    </div>


                    <button
                        type="button"
                        class="projects-view-close"
                        id="projectViewClose"
                        aria-label="Close"
                    >

                        <i
                            class="bi bi-x-lg"
                            aria-hidden="true"
                        ></i>

                    </button>

                </div>


                <div
                    class="projects-view-body"
                    id="projectViewBody"
                ></div>


                <div
                    class="projects-view-footer"
                >

                    <button
                        type="button"
                        class="projects-btn projects-btn-light"
                        id="projectViewCloseBtn"
                    >
                        Close
                    </button>

                    <button
                        type="button"
                        class="projects-btn projects-btn-primary"
                        id="projectViewEditBtn"
                    >

                        <i
                            class="bi bi-pencil"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Edit Project
                        </span>

                    </button>

                </div>

            </div>
        `;

    document.body.appendChild(modal);

    cacheViewDom(modal);

    dom.viewClose?.addEventListener("click", closeViewModal);

    dom.viewCloseBtn?.addEventListener("click", closeViewModal);

    dom.viewOverlay?.addEventListener("click", closeViewModal);

    dom.viewEditButton?.addEventListener("click", function () {
      if (!state.viewProjectId) {
        return;
      }

      const id = state.viewProjectId;

      closeViewModal();

      openEditModal(id);
    });
  }

  /* ============================================================
       VIEW DOM
       ============================================================ */

  function cacheViewDom(modal) {
    dom.viewModal = modal;

    dom.viewOverlay = modal.querySelector(".projects-view-overlay");

    dom.viewClose = modal.querySelector("#projectViewClose");

    dom.viewCloseBtn = modal.querySelector("#projectViewCloseBtn");

    dom.viewEditButton = modal.querySelector("#projectViewEditBtn");

    dom.viewTitle = modal.querySelector("#projectViewTitle");

    dom.viewBody = modal.querySelector("#projectViewBody");
  }

  /* ============================================================
       VIEW PROJECT
       ============================================================ */

  async function viewProject(projectId) {
    const id = projectId;

    if (id === null || id === undefined || String(id).trim() === "") {
      return;
    }

    createViewModal();

    state.viewProjectId = id;

    state.previousViewModalFocus = document.activeElement;

    showViewLoading();

    openViewModal();

    try {
      const project = await fetchProject(id);

      if (!project) {
        throw new Error("Project not found.");
      }

      renderProjectView(project);
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }

      console.error("[Projects] View error:", error);

      showViewError(error.message || "Unable to load project.");
    }
  }

  /* ============================================================
       VIEW LOADING
       ============================================================ */

  function showViewLoading() {
    if (!dom.viewBody) {
      return;
    }

    dom.viewBody.innerHTML = `
            <div
                class="projects-view-loading"
            >

                <span
                    class="projects-spinner"
                    aria-hidden="true"
                ></span>

                <span>
                    Loading project details...
                </span>

            </div>
        `;
  }

  /* ============================================================
       VIEW ERROR
       ============================================================ */

  function showViewError(message) {
    if (!dom.viewBody) {
      return;
    }

    dom.viewBody.innerHTML = `
            <div
                class="projects-view-error"
            >

                <i
                    class="bi bi-exclamation-circle"
                    aria-hidden="true"
                ></i>

                <strong>
                    Unable to load project
                </strong>

                <span>
                    ${escapeHtml(message)}
                </span>

            </div>
        `;
  }

  /* ============================================================
       PROJECT VIEW
       ============================================================ */

  function renderProjectView(project) {
    if (!dom.viewBody) {
      return;
    }

    const progress = Math.max(
      0,
      Math.min(100, toNumber(project.progress_percentage)),
    );

    const projectName = project.project_name || "Untitled Project";

    const clientName =
      project.company_name ||
      project.client_name ||
      getClientNameById(project.client_id);

    const managerName =
      project.project_manager_name ||
      project.manager_name ||
      getStaffNameById(project.project_manager_id);

    if (dom.viewTitle) {
      dom.viewTitle.textContent = projectName;
    }

    dom.viewBody.innerHTML = `

            <!-- ==================================================
                 PROJECT OVERVIEW
                 ================================================== -->

            <div
                class="projects-view-card"
            >

                <div
                    class="projects-view-card-header"
                >

                    <div
                        class="projects-view-card-icon"
                    >

                        <i
                            class="bi bi-kanban-fill"
                            aria-hidden="true"
                        ></i>

                    </div>


                    <div>

                        <h3>
                            Project Overview
                        </h3>

                        <p>
                            Basic project information
                        </p>

                    </div>

                </div>


                <div
                    class="projects-view-details"
                >

                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Project Name
                        </span>

                        <strong>
                            ${escapeHtml(projectName)}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Client
                        </span>

                        <strong>
                            ${escapeHtml(clientName)}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Project Type
                        </span>

                        <strong>
                            ${escapeHtml(project.project_type || "—")}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Hosting Platform
                        </span>

                        <strong>
                            ${escapeHtml(project.hosting_platform || "—")}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Hosting Email
                        </span>

                        <strong>
                            ${escapeHtml(project.hosting_email || "—")}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Domain Registrar
                        </span>

                        <strong>
                            ${escapeHtml(project.domain_registrar || "—")}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Domain Expiry Date
                        </span>

                        <strong>
                            ${escapeHtml(project.domain_expiry_date || "—")}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Status
                        </span>

                        <strong>
                            ${renderStatus(project.status)}
                        </strong>

                    </div>

                </div>


                ${
                  project.description
                    ? `
                            <div
                                class="projects-view-description"
                            >

                                <span>
                                    Description
                                </span>

                                <p>
                                    ${escapeHtml(project.description).replace(
                                      /\n/g,
                                      "<br>",
                                    )}
                                </p>

                            </div>
                        `
                    : ""
                }

            </div>


            <!-- ==================================================
                 SCHEDULE & BUDGET
                 ================================================== -->

            <div
                class="projects-view-card"
            >

                <div
                    class="projects-view-card-header"
                >

                    <div
                        class="projects-view-card-icon"
                    >

                        <i
                            class="bi bi-calendar3"
                            aria-hidden="true"
                        ></i>

                    </div>


                    <div>

                        <h3>
                            Schedule & Budget
                        </h3>

                        <p>
                            Timeline and financial information
                        </p>

                    </div>

                </div>


                <div
                    class="projects-view-details"
                >

                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Start Date
                        </span>

                        <strong>
                            ${formatDate(project.start_date)}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Expected Completion
                        </span>

                        <strong>
                            ${formatDate(project.expected_completion)}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Budget
                        </span>

                        <strong
                            class="projects-view-money"
                        >
                            ${formatCurrency(project.budget)}
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Project Manager
                        </span>

                        <strong>
                            ${escapeHtml(managerName)}
                        </strong>

                    </div>

                </div>

            </div>


            <!-- ==================================================
                 PROGRESS
                 ================================================== -->

            <div
                class="projects-view-card"
            >

                <div
                    class="projects-view-card-header"
                >

                    <div
                        class="projects-view-card-icon"
                    >

                        <i
                            class="bi bi-graph-up-arrow"
                            aria-hidden="true"
                        ></i>

                    </div>


                    <div>

                        <h3>
                            Project Progress
                        </h3>

                        <p>
                            Current delivery progress
                        </p>

                    </div>

                </div>


                <div
                    class="projects-view-progress"
                >

                    <div
                        class="projects-view-progress-header"
                    >

                        <span>
                            Progress
                        </span>

                        <strong>
                            ${progress}%
                        </strong>

                    </div>


                    <div
                        class="projects-view-progress-bar"
                    >

                        <div
                            class="projects-view-progress-fill"
                            style="width:${progress}%"
                        ></div>

                    </div>

                </div>

            </div>


            <!-- ==================================================
                 WEBSITE & SEO
                 ================================================== -->

            <div
                class="projects-view-card"
            >

                <div
                    class="projects-view-card-header"
                >

                    <div
                        class="projects-view-card-icon"
                    >

                        <i
                            class="bi bi-globe2"
                            aria-hidden="true"
                        ></i>

                    </div>


                    <div>

                        <h3>
                            Website & SEO
                        </h3>

                        <p>
                            Website, domain and SEO information
                        </p>

                    </div>

                </div>


                <div
                    class="projects-view-details"
                >

                    <div
                        class="projects-view-detail projects-view-detail-full"
                    >

                        <span>
                            Live Website
                        </span>

                        ${
                          project.live_website_link
                            ? `
                                    <a
                                        href="${escapeHtml(
                                          project.live_website_link,
                                        )}"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="projects-view-link"
                                    >

                                        <i
                                            class="bi bi-box-arrow-up-right"
                                            aria-hidden="true"
                                        ></i>

                                        ${escapeHtml(project.live_website_link)}

                                    </a>
                                `
                            : `
                                    <strong>
                                        —
                                    </strong>
                                `
                        }

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            Domain Purchased Email
                        </span>

                        <strong>
                            ${
                              project.domain_purchased_email
                                ? escapeHtml(project.domain_purchased_email)
                                : "—"
                            }
                        </strong>

                    </div>


                    <div
                        class="projects-view-detail"
                    >

                        <span>
                            SEO Added Email
                        </span>

                        <strong>
                            ${
                              project.seo_added_email
                                ? escapeHtml(project.seo_added_email)
                                : "—"
                            }
                        </strong>

                    </div>

                </div>

            </div>

        `;
  }

  /* ============================================================
       OPEN VIEW MODAL
       ============================================================ */

  function openViewModal() {
    if (!dom.viewModal) {
      return;
    }

    dom.viewModal.removeAttribute("inert");

    dom.viewModal.setAttribute("aria-hidden", "false");

    dom.viewModal.classList.add("is-open");

    document.body.classList.add("projects-modal-open");

    requestAnimationFrame(function () {
      if (dom.viewClose && dom.viewModal.classList.contains("is-open")) {
        try {
          dom.viewClose.focus({
            preventScroll: true,
          });
        } catch {
          dom.viewClose.focus();
        }
      }
    });
  }

  /* ============================================================
       CLOSE VIEW MODAL
       ============================================================ */

  function closeViewModal() {
    if (!dom.viewModal) {
      return;
    }

    const active = document.activeElement;

    const containsFocus = active && dom.viewModal.contains(active);

    let restore = state.previousViewModalFocus;

    if (!restore || !document.contains(restore)) {
      restore = dom.addButton || dom.search || null;
    }

    if (containsFocus) {
      if (restore) {
        try {
          restore.focus({
            preventScroll: true,
          });
        } catch {
          restore.focus();
        }
      } else {
        active.blur();
      }
    }

    dom.viewModal.classList.remove("is-open");

    dom.viewModal.setAttribute("aria-hidden", "true");

    dom.viewModal.setAttribute("inert", "");

    state.viewProjectId = null;

    state.previousViewModalFocus = null;

    updateBodyModalState();
  }

  /* ============================================================
       ACTION MENUS
       ============================================================ */

  function closeActionMenus() {
    if (!dom.tableBody) {
      return;
    }

    dom.tableBody
      .querySelectorAll(".projects-action-menu")
      .forEach(function (menu) {
        menu.hidden = true;

        menu.classList.remove("open-up");

        menu.style.position = "";

        menu.style.top = "";

        menu.style.left = "";

        menu.style.right = "";

        menu.style.bottom = "";

        menu.style.maxHeight = "";
      });

    dom.tableBody
      .querySelectorAll('[data-project-action="menu"]')
      .forEach(function (button) {
        button.setAttribute("aria-expanded", "false");
      });
  }

  /* ============================================================
       POSITION ACTION MENU
       ============================================================ */

  function positionActionMenu(button, menu) {
    if (!button || !menu) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * The menu is positioned using viewport
     * coordinates so table overflow,
     * card overflow and SPA containers
     * cannot clip it.
     */

    menu.hidden = false;

    menu.style.position = "fixed";

    menu.style.visibility = "hidden";

    menu.style.top = "0px";

    menu.style.left = "0px";

    menu.style.right = "auto";

    menu.style.bottom = "auto";

    const buttonRect = button.getBoundingClientRect();

    const viewportWidth = window.innerWidth;

    const viewportHeight = window.innerHeight;

    const menuRect = menu.getBoundingClientRect();

    const menuWidth = Math.max(menuRect.width, 170);

    const menuHeight = menuRect.height;

    const spaceBelow = viewportHeight - buttonRect.bottom;

    const spaceAbove = buttonRect.top;

    const shouldOpenAbove =
      spaceBelow < menuHeight + MENU_GAP && spaceAbove > menuHeight + MENU_GAP;

    let top;

    if (shouldOpenAbove) {
      top = buttonRect.top - menuHeight - MENU_GAP;

      menu.classList.add("open-up");
    } else {
      top = buttonRect.bottom + MENU_GAP;

      menu.classList.remove("open-up");
    }

    /*
     * Horizontal position:
     * align right edge to action button.
     */

    let left = buttonRect.right - menuWidth;

    /*
     * Keep inside viewport.
     */

    if (left < 8) {
      left = 8;
    }

    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }

    /*
     * Keep vertically inside viewport.
     */

    if (top < 8) {
      top = 8;
    }

    if (top + menuHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - menuHeight - 8);
    }

    /*
     * Mobile:
     * slightly wider menu.
     */

    if (viewportWidth <= 600) {
      const mobileWidth = Math.min(190, viewportWidth - 16);

      menu.style.width = mobileWidth + "px";

      menu.style.maxWidth = "calc(100vw - 16px)";

      const updatedRect = menu.getBoundingClientRect();

      left = Math.min(left, viewportWidth - updatedRect.width - 8);

      left = Math.max(8, left);
    }

    /*
     * Apply coordinates.
     */

    menu.style.top = `${Math.round(top)}px`;

    menu.style.left = `${Math.round(left)}px`;

    menu.style.right = "auto";

    menu.style.bottom = "auto";

    menu.style.visibility = "visible";
  }

  /* ============================================================
       TOGGLE ACTION MENU
       ============================================================ */

  function toggleActionMenu(button) {
    if (!button) {
      return;
    }

    const wrapper = button.closest(".projects-action-wrapper");

    if (!wrapper) {
      return;
    }

    const menu = wrapper.querySelector(".projects-action-menu");

    if (!menu) {
      return;
    }

    const isOpen = !menu.hidden;

    closeActionMenus();

    if (isOpen) {
      return;
    }

    button.setAttribute("aria-expanded", "true");

    menu.hidden = false;

    requestAnimationFrame(function () {
      positionActionMenu(button, menu);
    });
  }

  /* ============================================================
       ACTION MENU REPOSITION
       ============================================================ */

  function repositionOpenMenu() {
    const button = dom.tableBody?.querySelector(
      '[data-project-action="menu"][aria-expanded="true"]',
    );

    if (!button) {
      return;
    }

    const wrapper = button.closest(".projects-action-wrapper");

    const menu = wrapper?.querySelector(".projects-action-menu");

    if (menu && !menu.hidden) {
      positionActionMenu(button, menu);
    }
  }

  /* ============================================================
       TABLE ACTION
       ============================================================ */

  function handleTableAction(action, projectId) {
    if (action === "retry") {
      loadProjects();

      return;
    }

    const id = projectId;

    if (id === null || id === undefined || String(id).trim() === "") {
      return;
    }

    closeActionMenus();

    switch (action) {
      case "view":
        viewProject(id);

        break;

      case "edit":
        openEditModal(id);

        break;

      case "delete":
        openDeleteModal(id);

        break;

      default:
        break;
    }
  }

  /* ============================================================
       SEARCH
       ============================================================ */

  function handleSearch() {
    clearTimeout(state.searchTimer);

    state.searchTimer = setTimeout(function () {
      if (state.destroyed) {
        return;
      }

      state.search = dom.search?.value.trim() || "";

      state.page = 1;

      loadProjects();
    }, SEARCH_DELAY);
  }

  /* ============================================================
       STATUS FILTER
       ============================================================ */

  function handleStatusChange() {
    state.status = dom.statusFilter?.value || "";

    state.page = 1;

    loadProjects();
  }

  /* ============================================================
       CLIENT FILTER
       ============================================================ */

  function handleClientChange() {
    state.clientId = dom.clientFilter?.value || "";

    state.page = 1;

    loadProjects();
  }

  /* ============================================================
       TYPE FILTER
       ============================================================ */

  function handleTypeChange() {
    state.projectType = dom.typeFilter?.value || "";

    state.page = 1;

    loadProjects();
  }

  /* ============================================================
       RESET FILTERS
       ============================================================ */

  function resetFilters() {
    clearTimeout(state.searchTimer);

    state.search = "";

    state.status = "";

    state.clientId = "";

    state.projectType = "";

    state.page = 1;

    if (dom.search) {
      dom.search.value = "";
    }

    if (dom.statusFilter) {
      dom.statusFilter.value = "";
    }

    if (dom.clientFilter) {
      dom.clientFilter.value = "";
    }

    if (dom.typeFilter) {
      dom.typeFilter.value = "";
    }

    loadProjects();
  }

  /* ============================================================
       PAGINATION
       ============================================================ */

  function handlePagination(event) {
    const button = event.target.closest("[data-project-page]");

    if (!button || button.disabled) {
      return;
    }

    const page = Number(button.dataset.projectPage);

    if (!Number.isFinite(page) || page < 1 || page > state.totalPages) {
      return;
    }

    if (page === state.page) {
      return;
    }

    state.page = page;

    loadProjects();
  }

  /* ============================================================
       TABLE CLICK
       ============================================================ */

  function handleTableClick(event) {
    const actionElement = event.target.closest("[data-project-action]");

    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.projectAction;

    const projectId = actionElement.dataset.projectId;

    if (action === "menu") {
      event.preventDefault();

      event.stopPropagation();

      toggleActionMenu(actionElement);

      return;
    }

    event.preventDefault();

    event.stopPropagation();

    handleTableAction(action, projectId);
  }

  /* ============================================================
       DOCUMENT CLICK
       ============================================================ */

  function handleDocumentClick(event) {
    const addBtn = event.target.closest("#projectsAddBtn, [data-project-action='add']");
    if (addBtn) {
      event.preventDefault();
      openAddModal(event);
      return;
    }

    if (!event.target.closest(".projects-action-wrapper")) {
      closeActionMenus();
    }
  }

  /* ============================================================
       KEYBOARD
       ============================================================ */

  function handleKeydown(event) {
    if (event.key !== "Escape") {
      return;
    }

    closeActionMenus();

    if (dom.viewModal?.classList.contains("is-open")) {
      closeViewModal();

      return;
    }

    if (dom.deleteModal?.classList.contains("is-open")) {
      state.deletingId = null;

      closeModal(dom.deleteModal, "delete");

      return;
    }

    if (dom.modal?.classList.contains("is-open")) {
      closeModal(dom.modal, "project");
    }
  }

  /* ============================================================
       MODAL PREPARATION
       ============================================================ */

  function prepareModal(modal) {
    if (!modal) {
      return;
    }

    if (!modal.classList.contains("is-open")) {
      modal.setAttribute("aria-hidden", "true");

      modal.setAttribute("inert", "");
    }
  }

  /* ============================================================
       OPEN MODAL
       ============================================================ */

  function openModal(modal, type) {
    if (!modal) {
      return;
    }

    modal.removeAttribute("inert");

    modal.setAttribute("aria-hidden", "false");

    modal.classList.add("is-open");

    document.body.classList.add("projects-modal-open");

    requestAnimationFrame(function () {
      if (state.destroyed || !modal.classList.contains("is-open")) {
        return;
      }

      let target = null;

      if (type === "delete") {
        target = dom.deleteCancel || dom.deleteConfirm;
      } else {
        target = dom.modalClose || dom.client || dom.name;
      }

      if (target) {
        try {
          target.focus({
            preventScroll: true,
          });
        } catch {
          target.focus();
        }
      }
    });
  }

  /* ============================================================
       CLOSE MODAL
       ============================================================ */

  function closeModal(modal, type) {
    if (!modal) {
      return;
    }

    const active = document.activeElement;

    const containsFocus = active && modal.contains(active);

    let restore = null;

    if (type === "delete") {
      restore = state.previousDeleteModalFocus;
    } else {
      restore = state.previousModalFocus;
    }

    if (!restore || !document.contains(restore)) {
      restore = dom.addButton || dom.search || null;
    }

    /*
     * Move focus outside the modal
     * BEFORE aria-hidden/inert.
     */

    if (containsFocus) {
      if (restore) {
        try {
          restore.focus({
            preventScroll: true,
          });
        } catch {
          restore.focus();
        }
      } else {
        active.blur();
      }
    }

    modal.classList.remove("is-open");

    modal.setAttribute("aria-hidden", "true");

    modal.setAttribute("inert", "");

    if (type === "delete") {
      state.previousDeleteModalFocus = null;
    } else {
      state.previousModalFocus = null;
    }

    updateBodyModalState();
  }

  /* ============================================================
       BODY MODAL STATE
       ============================================================ */

  function updateBodyModalState() {
    const anyOpen = document.querySelector(
      ".projects-modal.is-open, " +
        ".projects-confirm-modal.is-open, " +
        ".projects-view-modal.is-open",
    );

    if (anyOpen) {
      document.body.classList.add("projects-modal-open");
    } else {
      document.body.classList.remove("projects-modal-open");
    }
  }

  /* ============================================================
       EVENTS
       ============================================================ */

  function bindEvents() {
    dom.addButton?.addEventListener("click", openAddModal);

    dom.search?.addEventListener("input", handleSearch);

    dom.statusFilter?.addEventListener("change", handleStatusChange);

    dom.clientFilter?.addEventListener("change", handleClientChange);

    dom.typeFilter?.addEventListener("change", handleTypeChange);

    dom.resetFilters?.addEventListener("click", resetFilters);

    dom.tableBody?.addEventListener("click", handleTableClick);

    dom.paginationButtons?.addEventListener("click", handlePagination);

    dom.form?.addEventListener("submit", saveProject);

    dom.modalClose?.addEventListener("click", function () {
      closeModal(dom.modal, "project");
    });

    dom.cancelButton?.addEventListener("click", function () {
      closeModal(dom.modal, "project");
    });

    dom.modalOverlay?.addEventListener("click", function () {
      closeModal(dom.modal, "project");
    });

    dom.deleteCancel?.addEventListener("click", function () {
      state.deletingId = null;

      closeModal(dom.deleteModal, "delete");
    });

    dom.deleteConfirm?.addEventListener("click", confirmDelete);

    dom.deleteOverlay?.addEventListener("click", function () {
      closeModal(dom.deleteModal, "delete");
    });

    document.addEventListener("click", handleDocumentClick);

    document.addEventListener("keydown", handleKeydown);

    /*
     * Keep action popup attached
     * to the correct button while
     * scrolling/resizing.
     */

    window.addEventListener("resize", repositionOpenMenu);

    window.addEventListener("scroll", repositionOpenMenu, true);
  }

  /* ============================================================
       ALERT
       ============================================================ */

  function showAlert(message, type = "error") {
    if (typeof window.showToast === "function") {
      window.showToast(message, type);

      return;
    }

    if (typeof window.showNotification === "function") {
      window.showNotification(message, type);

      return;
    }

    console[type === "error" ? "error" : "log"]("[Projects]", message);

    /*
     * Only use native alert when
     * no global notification system
     * exists.
     */

    if (type === "error") {
      window.alert(message);
    }
  }

  /* ============================================================
       DESTROY
       ============================================================ */

  function destroy() {
    state.destroyed = true;

    clearTimeout(state.searchTimer);

    if (state.projectsAbortController) {
      state.projectsAbortController.abort();

      state.projectsAbortController = null;
    }

    if (state.clientsAbortController) {
      state.clientsAbortController.abort();

      state.clientsAbortController = null;
    }

    if (state.staffAbortController) {
      state.staffAbortController.abort();

      state.staffAbortController = null;
    }

    if (state.singleProjectAbortController) {
      state.singleProjectAbortController.abort();

      state.singleProjectAbortController = null;
    }

    closeActionMenus();

    if (dom.viewModal?.classList.contains("is-open")) {
      closeViewModal();
    }

    if (dom.modal?.classList.contains("is-open")) {
      closeModal(dom.modal, "project");
    }

    if (dom.deleteModal?.classList.contains("is-open")) {
      closeModal(dom.deleteModal, "delete");
    }

    document.removeEventListener("click", handleDocumentClick);

    document.removeEventListener("keydown", handleKeydown);

    window.removeEventListener("resize", repositionOpenMenu);

    window.removeEventListener("scroll", repositionOpenMenu, true);

    /*
     * Remove dynamically-created
     * View popup.
     */

    if (dom.viewModal && dom.viewModal.parentNode) {
      dom.viewModal.parentNode.removeChild(dom.viewModal);
    }

    state.projects = [];

    state.clients = [];

    state.staff = [];

    state.clientsLoaded = false;

    state.staffLoaded = false;

    state.clientsLoading = false;

    state.staffLoading = false;

    state.editingId = null;

    state.deletingId = null;

    state.viewProjectId = null;

    state.initialized = false;

    state.destroyed = true;
  }

  /* ============================================================
       INIT
       ============================================================ */

  async function init() {
    if (state.initialized) {
      return;
    }

    if (!cacheDom()) {
      return;
    }

    state.destroyed = false;

    state.initialized = true;

    /*
     * Convert old numeric manager
     * input to Staff select.
     */

    ensureManagerSelect();

    prepareModal(dom.modal);

    prepareModal(dom.deleteModal);

    /*
     * Create view popup only when
     * needed, not immediately.
     */

    bindEvents();

    /*
     * Load all required dropdown data.
     */

    await Promise.allSettled([loadClients(), loadStaff()]);

    /*
     * Load projects.
     */

    await loadProjects();
  }

  /* ============================================================
       PUBLIC API
       ============================================================ */

  window.TenspickProjects = {
    init,

    destroy,

    reload: loadProjects,

    openAdd: openAddModal,

    openEdit: openEditModal,

    openView: viewProject,
  };

  /* ============================================================
       AUTO INIT
       ============================================================ */

  init();
})();
