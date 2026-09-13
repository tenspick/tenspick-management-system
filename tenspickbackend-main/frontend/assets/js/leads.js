/* ============================================================
   TENSPICK CRM
   LEADS MODULE
   SPA SAFE
   CRUD + CSRF
   VIEW PROFILE + MORE MENU
   ============================================================ */

(function (window, document) {
  "use strict";

  /* ============================================================
       CONFIG
       ============================================================ */

  const DEBUG = true;

  const API_BASE = new URL(
    "backend/public/index.php/api",
    window.location.origin + "/tenspickk/",
  ).href;

  /* ============================================================
       DEBUG
       ============================================================ */

  function log() {
    if (DEBUG) {
      console.log("[Tenspick Leads]", ...arguments);
    }
  }

  function warn() {
    if (DEBUG) {
      console.warn("[Tenspick Leads]", ...arguments);
    }
  }

  function error() {
    console.error("[Tenspick Leads]", ...arguments);
  }

  log("API BASE:", API_BASE);

  /* ============================================================
       STATE
       ============================================================ */

  const state = {
    initialized: false,

    eventsBound: false,

    loading: false,

    saving: false,

    viewing: false,

    csrfToken: null,

    page: 1,

    perPage: 20,

    search: "",

    status: "",

    priority: "",

    editingId: null,

    viewingId: null,

    requestCounter: 0,
  };

  let searchTimer = null;

  /* ============================================================
       PUBLIC MODULE
       ============================================================ */

  const TenspickLeads = {
    init: init,
    destroy: destroy,
    refresh: refresh,
  };

  /* ============================================================
       REGISTER GLOBAL
       ============================================================ */

  if (window.TenspickLeads && window.TenspickLeads !== TenspickLeads) {
    warn("Existing TenspickLeads module detected. Replacing it.");
  }

  window.TenspickLeads = TenspickLeads;

  log("TenspickLeads registered.");

  /* ============================================================
       PAGE CHECK
       ============================================================ */

  function isLeadPage() {
    return Boolean(document.getElementById("leadsPage"));
  }

  /* ============================================================
       INIT
       ============================================================ */

  function init() {
    log("init() called.");

    if (!isLeadPage()) {
      warn("Leads page not present.");
      return;
    }

    const form = document.getElementById("leadForm");

    const addButton = document.getElementById("addLeadButton");

    const saveButton = document.getElementById("saveLeadButton");

    log("Lead DOM check:", {
      page: !!document.getElementById("leadsPage"),
      form: !!form,
      addButton: !!addButton,
      saveButton: !!saveButton,
    });

    if (!state.eventsBound) {
      bindEvents();
    }

    /*
     * Direct form listener.
     */

    if (form && !form.dataset.leadsSubmitBound) {
      form.addEventListener(
        "submit",
        function (event) {
          console.log("🔥 DIRECT LEAD FORM SUBMIT");

          event.preventDefault();

          event.stopPropagation();

          saveLead();
        },
        true,
      );

      form.dataset.leadsSubmitBound = "1";

      log("Direct lead form submit listener attached.");
    }

    /*
     * Make sure profile modal exists.
     */

    ensureProfileModal();

    state.initialized = true;

    log("Lead module initialized.");

    loadLeads();
  }

  /* ============================================================
       EVENTS
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

    state.eventsBound = true;

    log("Lead event listeners attached.");
  }

  /* ============================================================
       CLICK HANDLER
       ============================================================ */

  function handleClick(event) {
    if (!event || !event.target) {
      return;
    }

    const target = event.target;

    /* ========================================================
       ADD LEAD
       ======================================================== */

    const addButton = target.closest("#addLeadButton, #emptyAddLeadButton");

    if (addButton) {
      if (!isLeadPage()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      log("ADD LEAD clicked.");

      closeAllLeadMenus();

      openAddModal();

      return;
    }

    /* ========================================================
       CLOSE ADD / EDIT MODAL
       ======================================================== */

    const closeButton = target.closest("#closeLeadModal, #cancelLeadModal");

    if (closeButton) {
      event.preventDefault();
      event.stopPropagation();

      closeLeadModal();

      return;
    }

    /* ========================================================
       ADD / EDIT MODAL BACKDROP
       ======================================================== */

    const backdrop = target.closest("[data-close-lead-modal]");

    if (backdrop) {
      event.preventDefault();
      event.stopPropagation();

      closeLeadModal();

      return;
    }

    /* ========================================================
       VIEW BUTTON
       ======================================================== */

    const viewButton = target.closest(".lead-view-btn");

    if (viewButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(viewButton.dataset.id || 0);

      log("VIEW clicked:", id);

      closeAllLeadMenus();

      if (id > 0) {
        viewLead(id);
      }

      return;
    }

    /* ========================================================
   MORE BUTTON
   ======================================================== */

    const moreButton = target.closest(".lead-more-btn");

    if (moreButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(moreButton.dataset.id || 0);

      log("MORE clicked:", id);

      if (id > 0) {
        toggleLeadMenu(moreButton, id);
      }

      return;
    }

    /* ========================================================
       VIEW FROM MENU
       ======================================================== */

    const viewMenuButton = target.closest(".lead-view-menu-btn");

    if (viewMenuButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(viewMenuButton.dataset.id || 0);

      closeAllLeadMenus();

      if (id > 0) {
        viewLead(id);
      }

      return;
    }

    /* ========================================================
       EDIT FROM MENU
       ======================================================== */

    const editMenuButton = target.closest(".lead-edit-menu-btn");

    if (editMenuButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(editMenuButton.dataset.id || 0);

      closeAllLeadMenus();

      if (id > 0) {
        editLead(id);
      }

      return;
    }

    /* ========================================================
       CONVERT LEAD TO CLIENT
       ======================================================== */

    const convertMenuButton = target.closest(".lead-convert-menu-btn");

    if (convertMenuButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(convertMenuButton.dataset.id || 0);

      log("CONVERT TO CLIENT clicked:", id);

      closeAllLeadMenus();

      if (id > 0) {
        convertLeadToClient(id);
      }

      return;
    }

    /* ========================================================
       DELETE FROM MENU
       ======================================================== */

    const deleteMenuButton = target.closest(".lead-delete-menu-btn");

    if (deleteMenuButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(deleteMenuButton.dataset.id || 0);

      closeAllLeadMenus();

      if (id > 0) {
        deleteLead(id);
      }

      return;
    }

    /* ========================================================
       OLD EDIT BUTTON SUPPORT
       ======================================================== */

    const editButton = target.closest(".lead-edit-btn");

    if (editButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(editButton.dataset.id || 0);

      log("EDIT clicked:", id);

      if (id > 0) {
        editLead(id);
      }

      return;
    }

    /* ========================================================
       OLD DELETE BUTTON SUPPORT
       ======================================================== */

    const deleteButton = target.closest(".lead-delete-btn");

    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(deleteButton.dataset.id || 0);

      if (id > 0) {
        deleteLead(id);
      }

      return;
    }

    /* ========================================================
       PROFILE CLOSE
       ======================================================== */

    const profileClose = target.closest(
      "#closeLeadProfile, #closeLeadProfileButton",
    );

    if (profileClose) {
      event.preventDefault();
      event.stopPropagation();

      closeLeadProfile();

      return;
    }

    /* ========================================================
       PROFILE BACKDROP
       ======================================================== */

    const profileBackdrop = target.closest("[data-close-lead-profile]");

    if (profileBackdrop) {
      event.preventDefault();
      event.stopPropagation();

      closeLeadProfile();

      return;
    }

    /* ========================================================
       PROFILE EDIT
       ======================================================== */

    const profileEdit = target.closest("#leadProfileEditButton");

    if (profileEdit) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(profileEdit.dataset.id || 0);

      closeLeadProfile();

      if (id > 0) {
        editLead(id);
      }

      return;
    }

    /* ========================================================
       PROFILE DELETE
       ======================================================== */

    const profileDelete = target.closest("#leadProfileDeleteButton");

    if (profileDelete) {
      event.preventDefault();
      event.stopPropagation();

      const id = Number(profileDelete.dataset.id || 0);

      closeLeadProfile();

      if (id > 0) {
        deleteLead(id);
      }

      return;
    }

    /* ========================================================
       CLEAR FILTERS
       ======================================================== */

    const clearButton = target.closest("#clearLeadFilters");

    if (clearButton) {
      event.preventDefault();
      event.stopPropagation();

      clearFilters();

      return;
    }

    /* ========================================================
       RETRY
       ======================================================== */

    const retryButton = target.closest("#retryLeadsButton");

    if (retryButton) {
      event.preventDefault();
      event.stopPropagation();

      loadLeads();

      return;
    }

    /* ========================================================
       PAGINATION
       ======================================================== */

    const pageButton = target.closest(".leads-page-btn, .pagination-btn");

    if (pageButton) {
      event.preventDefault();
      event.stopPropagation();

      if (pageButton.disabled) {
        return;
      }

      const page = Number(pageButton.dataset.page || 0);

      if (page > 0 && page !== state.page) {
        state.page = page;

        loadLeads();
      }

      return;
    }

    /*
     * Click anywhere outside menu.
     */

    if (!target.closest(".lead-more-wrapper")) {
      closeAllLeadMenus();
    }
  }

  /* ============================================================
   MORE MENU
   NORMAL RESPONSIVE METHOD
   ============================================================ */

  function toggleLeadMenu(button, id) {
    if (!button || !id) {
      return;
    }

    const wrapper = button.closest(".lead-more-wrapper");

    if (!wrapper) {
      return;
    }

    const menu = wrapper.querySelector(".lead-action-menu");

    if (!menu) {
      return;
    }

    const isOpen = menu.classList.contains("show");

    /* Close all other menus first */

    closeAllLeadMenus();

    /* Toggle current menu */

    if (!isOpen) {
      menu.classList.add("show");

      button.setAttribute("aria-expanded", "true");

      /*
       * On small screens, if there isn't enough
       * space below the button, open upward.
       */

      setTimeout(function () {
        positionLeadMenu(button, menu);
      }, 0);

      log("Lead action menu opened:", id);
    }
  }

  /* ============================================================
   POSITION MENU
   ============================================================ */

  function positionLeadMenu(button, menu) {
    if (!button || !menu) {
      return;
    }

    /*
     * Reset first.
     */

    menu.style.top = "";
    menu.style.bottom = "";
    menu.style.transformOrigin = "";

    const buttonRect = button.getBoundingClientRect();

    const menuRect = menu.getBoundingClientRect();

    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - buttonRect.bottom;

    const spaceAbove = buttonRect.top;

    /*
     * Small safety gap.
     */

    const gap = 8;

    /*
     * If menu does not fit below
     * but fits better above,
     * open upward.
     */

    if (spaceBelow < menuRect.height + gap && spaceAbove > spaceBelow) {
      menu.style.top = "auto";

      menu.style.bottom = "calc(100% + 7px)";

      menu.style.transformOrigin = "bottom right";
    } else {
      menu.style.top = "calc(100% + 7px)";

      menu.style.bottom = "auto";

      menu.style.transformOrigin = "top right";
    }
  }

  /* ============================================================
   CLOSE ALL MENUS
   ============================================================ */

  function closeAllLeadMenus() {
    const menus = document.querySelectorAll(".lead-action-menu.show");

    menus.forEach(function (menu) {
      menu.classList.remove("show");

      /*
       * Clear inline positioning so the
       * next opening starts normally.
       */

      menu.style.top = "";
      menu.style.bottom = "";
      menu.style.transformOrigin = "";
    });

    const buttons = document.querySelectorAll(
      ".lead-more-btn[aria-expanded='true']",
    );

    buttons.forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
    });
  }

  /* ============================================================
       INPUT
       ============================================================ */

  function handleInput(event) {
    if (!event || !event.target) {
      return;
    }

    if (event.target.id !== "leadSearch") {
      return;
    }

    clearTimeout(searchTimer);

    searchTimer = setTimeout(function () {
      state.search = String(event.target.value || "").trim();

      state.page = 1;

      loadLeads();
    }, 350);
  }

  /* ============================================================
       CHANGE
       ============================================================ */

  function handleChange(event) {
    if (!event || !event.target) {
      return;
    }

    if (event.target.id === "leadStatusFilter") {
      state.status = event.target.value || "";

      state.page = 1;

      loadLeads();

      return;
    }

    if (event.target.id === "leadPriorityFilter") {
      state.priority = event.target.value || "";

      state.page = 1;

      loadLeads();
    }
  }

  /* ============================================================
       SUBMIT
       ============================================================ */

  function handleSubmit(event) {
    if (!event || !event.target) {
      return;
    }

    console.log("🔥 LEAD FORM SUBMIT EVENT FIRED", event);

    console.log("FORM ID:", event.target?.id);

    if (event.target.id !== "leadForm") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    console.log("🔥 leadForm matched");

    saveLead();
  }

  /* ============================================================
       KEYBOARD
       ============================================================ */

  function handleKeydown(event) {
    if (!event || event.key !== "Escape") {
      return;
    }

    closeAllLeadMenus();

    const modal = document.getElementById("leadModal");

    if (modal && !modal.hidden) {
      closeLeadModal();

      return;
    }

    const profile = document.getElementById("leadProfileModal");

    if (profile && !profile.hidden) {
      closeLeadProfile();
    }
  }

  /* ============================================================
       LOAD LEADS
       ============================================================ */

  async function loadLeads() {
    if (!isLeadPage()) {
      return;
    }

    if (state.loading) {
      return;
    }

    const body = document.getElementById("leadsTableBody");

    if (!body) {
      return;
    }

    state.loading = true;

    const requestId = ++state.requestCounter;

    renderLoading();

    try {
      let leads = [];

      // 1. Try Supabase
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            const { data, error: sbErr } = await sb.from("leads").select("*").order("created_at", { ascending: false });
            if (!sbErr && Array.isArray(data) && data.length > 0) {
              leads = data;
            }
          }
        } catch (sbEx) {
          console.warn("Leads Supabase note:", sbEx);
        }
      }

      // 2. Try apiRequest / LocalStorage
      if (!leads.length) {
        try {
          const params = new URLSearchParams();
          params.set("page", String(state.page));
          params.set("per_page", String(state.perPage));
          if (state.search) params.set("search", state.search);
          if (state.status) params.set("status", state.status);
          if (state.priority) params.set("priority", state.priority);

          const response = await apiRequest("/leads?" + params.toString(), { method: "GET" });
          if (response && response.data) {
            leads = extractLeads(response.data);
          }
        } catch (apiErr) {
          console.warn("Leads apiRequest note:", apiErr);
        }
      }

      // 3. Fallback LocalStorage
      if (!leads.length) {
        try {
          const raw = localStorage.getItem("tenspick_leads");
          if (raw) leads = JSON.parse(raw) || [];
        } catch (e) {}
      }

      if (requestId !== state.requestCounter) {
        return;
      }

      // Apply client-side filters if needed
      let filtered = leads.slice();
      if (state.search) {
        const s = state.search.toLowerCase();
        filtered = filtered.filter(l =>
          (l.name || l.lead_name || "").toLowerCase().includes(s) ||
          (l.company || l.company_name || "").toLowerCase().includes(s) ||
          (l.phone || l.mobile || "").toLowerCase().includes(s) ||
          (l.email || "").toLowerCase().includes(s)
        );
      }
      if (state.status) {
        filtered = filtered.filter(l => normalizeStatus(l.status) === state.status);
      }
      if (state.priority) {
        filtered = filtered.filter(l => normalizePriority(l.priority) === state.priority);
      }

      const total = filtered.length;
      const perPage = state.perPage || 10;
      const page = state.page || 1;
      const totalPages = Math.max(1, Math.ceil(total / perPage));
      const startIndex = (page - 1) * perPage;
      const pageItems = filtered.slice(startIndex, startIndex + perPage);

      const pagination = {
        total: total,
        page: page,
        perPage: perPage,
        totalPages: totalPages
      };

      renderLeads(pageItems);
      renderPagination(pagination);
      updateResultCount(pagination, pageItems);
      updateStatistics({ items: filtered }, pagination, pageItems);

      log("GET successful. Leads:", pageItems.length);
    } catch (err) {
      error("GET LEADS ERROR:", err);
      renderError(err.message || "Unable to load leads.");
    } finally {
      state.loading = false;
    }
  }

  /* ============================================================
       EXTRACT LEADS
       ============================================================ */

  function extractLeads(data) {
    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.leads)) {
      return data.leads;
    }

    if (Array.isArray(data.data)) {
      return data.data;
    }

    return [];
  }

  /* ============================================================
       PAGINATION
       ============================================================ */

  function extractPagination(data, leads) {
    const pagination = data.pagination || {};

    const total = Number(pagination.total ?? data.total ?? leads.length);

    let totalPages = Number(
      pagination.total_pages || pagination.totalPages || 0,
    );

    if (totalPages <= 0) {
      totalPages = Math.max(1, Math.ceil(total / state.perPage));
    }

    return {
      page: Number(pagination.page || pagination.current_page || state.page),

      total: total,

      total_pages: totalPages,
    };
  }

  /* ============================================================
       RENDER TABLE
       ============================================================ */

  function renderLeads(leads) {
    const body = document.getElementById("leadsTableBody");

    if (!body) {
      return;
    }

    if (!Array.isArray(leads) || leads.length === 0) {
      body.innerHTML = `
        <tr>
          <td
            colspan="9"
            class="leads-table-message"
          >
            <div class="leads-empty">

              <strong>
                No leads found
              </strong>

              <span>
                Add a lead to start
                managing your pipeline.
              </span>

              <button
                type="button"
                class="leads-btn leads-btn-primary"
                id="emptyAddLeadButton"
              >
                Add Lead
              </button>

            </div>
          </td>
        </tr>
      `;

      return;
    }

    body.innerHTML = leads.map(renderLeadRow).join("");
  }

  /* ============================================================
       RENDER ROW
       ============================================================ */

  function renderLeadRow(lead) {
    lead = lead || {};

    const id = Number(lead.id || 0);

    const name = escapeHtml(lead.name || "-");

    const code = escapeHtml(lead.lead_code || lead.code || "-");

    const company = escapeHtml(lead.company || "-");

    const phone = escapeHtml(lead.phone || "-");

    const service = escapeHtml(lead.service || "-");

    const source = normalizeSource(lead.source);

    const status = normalizeStatus(lead.status);

    const priority = normalizePriority(lead.priority);

    const followUp = escapeHtml(formatDate(lead.follow_up_date));

    return `
      <tr
        data-lead-id="${id}"
      >

        <!-- LEAD -->

        <td>

          <div class="lead-person">

            <strong>
              ${name}
            </strong>

            <small>
              ${code}
            </small>

          </div>

        </td>


        <!-- COMPANY -->

        <td>
          ${company}
        </td>


        <!-- PHONE -->

        <td>
          ${phone}
        </td>


        <!-- SERVICE -->

        <td>
          ${service}
        </td>


        <!-- SOURCE -->

        <td>
          ${escapeHtml(source)}
        </td>


        <!-- STATUS -->

        <td>

          <span
            class="leads-status ${status}"
          >
            ${escapeHtml(formatStatus(status))}
          </span>

        </td>


        <!-- PRIORITY -->

        <td>

          <span
            class="lead-priority ${priority}"
          >
            ${escapeHtml(formatPriority(priority))}
          </span>

        </td>


        <!-- FOLLOW UP -->

        <td>
          ${followUp}
        </td>


        <!-- ACTIONS -->

        <td>

          <div class="lead-actions">

             


            <!-- MORE -->

            <div class="lead-more-wrapper">

              <button
                type="button"
                class="
                  lead-action-btn
                  lead-more-btn
                "
                data-id="${id}"
                title="More options"
                aria-label="More options"
                aria-expanded="false"
              >
                ⋯
              </button>


              <div
                class="lead-action-menu"
                data-lead-menu="${id}"
              >

                <button
                  type="button"
                  class="
                    lead-menu-item
                    lead-view-menu-btn
                  "
                  data-id="${id}"
                >
                  <span class="lead-menu-icon">
                    👁
                  </span>

                  <span>
                    View Lead
                  </span>
                </button>


                <button
                  type="button"
                  class="
                    lead-menu-item
                    lead-edit-menu-btn
                  "
                  data-id="${id}"
                >
                  <span class="lead-menu-icon">
                    ✎
                  </span>

                  <span>
                    Edit Lead
                  </span>
                </button>

                <button
    type="button"
    class="lead-menu-item lead-convert-menu-btn"
    data-id="${id}"
>
    <span>⇄</span>
    <span>Convert to Client</span>
</button>


                ${!(window.TenspickAuth && window.TenspickAuth.isStaff()) ? `
                <div
                  class="lead-menu-divider"
                ></div>


                <button
                  type="button"
                  class="
                    lead-menu-item
                    danger
                    lead-delete-menu-btn
                  "
                  data-id="${id}"
                >
                  <span class="lead-menu-icon">
                    ×
                  </span>

                  <span>
                    Delete Lead
                  </span>
                </button>
                ` : ""}

              </div>

            </div>

          </div>

        </td>

      </tr>
    `;
  }

  /* ============================================================
       ADD MODAL
       ============================================================ */

  function openAddModal() {
    const modal = document.getElementById("leadModal");

    const form = document.getElementById("leadForm");

    if (!modal || !form) {
      error("Lead modal/form missing.");

      return;
    }

    state.editingId = null;

    state.saving = false;

    form.reset();

    setValue("leadId", "");

    setValue("leadStatus", "new");

    setValue("leadPriority", "medium");

    setText("leadModalTitle", "Add Lead");

    setText("saveLeadButton", "Save Lead");

    showLeadModal();

    setTimeout(function () {
      document.getElementById("leadName")?.focus();
    }, 100);
  }

  /* ============================================================
       EDIT
       ============================================================ */

  async function editLead(id) {
    if (!id) {
      return;
    }

    try {
      log("GET EDIT:", id);

      const response = await apiRequest("/leads/" + encodeURIComponent(id), {
        method: "GET",
      });

      if (!response || response.success !== true) {
        throw new Error(response?.message || "Unable to load lead.");
      }

      /*
       * Current controller returns:
       *
       * data = lead
       *
       * But this also supports:
       *
       * data.lead
       * data.item
       */

      let lead = response.data || {};

      if (lead.lead && typeof lead.lead === "object") {
        lead = lead.lead;
      } else if (lead.item && typeof lead.item === "object") {
        lead = lead.item;
      }

      if (!lead.id) {
        throw new Error("Lead data was not returned.");
      }

      state.editingId = Number(lead.id);

      setValue("leadId", lead.id);

      setValue("leadName", lead.name);

      setValue("leadCompany", lead.company);

      setValue("leadPhone", lead.phone);

      setValue("leadEmail", lead.email);

      setValue("leadService", lead.service);

      setValue("leadSource", lead.source);

      setValue("leadStatus", normalizeStatus(lead.status));

      setValue("leadPriority", normalizePriority(lead.priority));

      setValue("leadFollowUp", normalizeInputDate(lead.follow_up_date));

      setValue("leadNotes", lead.notes);

      setText("leadModalTitle", "Edit Lead");

      setText("saveLeadButton", "Update Lead");

      showLeadModal();

      log("Edit data loaded:", lead);
    } catch (err) {
      error("EDIT ERROR:", err);

      window.alert(err.message || "Unable to load lead.");
    }
  }

  /* ============================================================
       VIEW LEAD
       ============================================================ */

  async function viewLead(id) {
    if (!id) {
      return;
    }

    if (state.viewing) {
      return;
    }

    state.viewing = true;

    state.viewingId = Number(id);

    log("VIEW LEAD:", id);

    try {
      const response = await apiRequest("/leads/" + encodeURIComponent(id), {
        method: "GET",
      });

      if (!response || response.success !== true) {
        throw new Error(response?.message || "Unable to load lead.");
      }

      /*
       * Current PHP controller:
       *
       * successResponse(
       *   ...,
       *   $lead
       * )
       *
       * Therefore:
       *
       * response.data = lead
       *
       * Support alternative structures too.
       */

      let lead = response.data || {};

      if (lead.lead && typeof lead.lead === "object") {
        lead = lead.lead;
      } else if (lead.item && typeof lead.item === "object") {
        lead = lead.item;
      }

      if (!lead.id) {
        throw new Error("Lead information was not returned.");
      }

      renderLeadProfile(lead);

      openLeadProfile();

      log("Lead profile loaded:", lead);
    } catch (err) {
      error("VIEW LEAD ERROR:", err);

      window.alert(err.message || "Unable to load lead.");
    } finally {
      state.viewing = false;
    }
  }

  /* ============================================================
       CREATE / UPDATE
       ============================================================ */

  async function saveLead() {
    log("================================================");

    log("SAVE LEAD STARTED");

    log("================================================");

    if (state.saving) {
      warn("Save already running.");

      return;
    }

    const form = document.getElementById("leadForm");

    if (!form) {
      error("#leadForm missing.");

      return;
    }

    const name = getValue("leadName").trim();

    if (!name) {
      window.alert("Lead name is required.");

      document.getElementById("leadName")?.focus();

      return;
    }

    const email = getValue("leadEmail").trim();

    if (email && !isValidEmail(email)) {
      window.alert("Please enter a valid email address.");

      document.getElementById("leadEmail")?.focus();

      return;
    }

    const payload = {
      name: name,

      company: getValue("leadCompany").trim(),

      phone: getValue("leadPhone").trim(),

      email: email,

      service: getValue("leadService").trim(),

      source: getValue("leadSource").trim(),

      status: normalizeStatus(getValue("leadStatus")),

      priority: normalizePriority(getValue("leadPriority")),

      follow_up_date: getValue("leadFollowUp") || null,

      notes: getValue("leadNotes").trim(),
    };

    const id = Number(state.editingId || 0);

    const editing = id > 0;

    const endpoint = editing ? "/leads/" + encodeURIComponent(id) : "/leads";

    const method = editing ? "PUT" : "POST";

    log("REQUEST METHOD:", method);

    log("REQUEST URL:", API_BASE + endpoint);

    log("REQUEST PAYLOAD:", payload);

    state.saving = true;

    const button = document.getElementById("saveLeadButton");

    if (button) {
      button.disabled = true;

      button.dataset.oldText = button.textContent;

      button.textContent = editing ? "Updating..." : "Saving...";
    }

    try {
      const newLeadData = {
        id: editing ? id : Date.now(),
        ...payload,
        created_at: new Date().toISOString()
      };

      // 1. Try Supabase
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            if (editing) {
              await sb.from("leads").update(payload).eq("id", id);
            } else {
              await sb.from("leads").insert([newLeadData]);
            }
          }
        } catch (sbErr) {
          console.warn("Save Lead Supabase note:", sbErr);
        }
      }

      // 2. Save to LocalStorage
      let localLeads = [];
      try {
        const raw = localStorage.getItem("tenspick_leads");
        if (raw) localLeads = JSON.parse(raw) || [];
      } catch (e) {}

      if (editing) {
        localLeads = localLeads.map(l => String(l.id) === String(id) ? { ...l, ...payload } : l);
      } else {
        localLeads.unshift(newLeadData);
      }
      localStorage.setItem("tenspick_leads", JSON.stringify(localLeads));

      // 3. Try PHP API request
      try {
        await apiRequest(endpoint, {
          method: method,
          body: JSON.stringify(payload),
        });
      } catch (apiErr) {
        console.warn("Save Lead API note:", apiErr);
      }

      log(editing ? "LEAD UPDATED SUCCESSFULLY" : "LEAD CREATED SUCCESSFULLY");

      closeLeadModal();

      state.page = 1;

      await loadLeads();

      window.alert(
        editing ? "Lead updated successfully." : "Lead created successfully."
      );
    } catch (err) {
      error("SAVE LEAD FAILED", err);
      window.alert(err.message || "Unable to save lead.");
    } finally {
      state.saving = false;

      if (button) {
        button.disabled = false;

        button.textContent =
          button.dataset.oldText || (editing ? "Update Lead" : "Save Lead");
      }
    }
  }

  /* ============================================================
       CONVERT LEAD TO CLIENT
       ============================================================ */

  async function convertLeadToClient(id) {
    const numericId = Number(id || 0);

    if (!numericId || numericId <= 0) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to convert this lead into a client?\n\n" +
        "The lead will be moved to the Clients module.",
    );

    if (!confirmed) {
      return;
    }

    try {
      log("CONVERT LEAD TO CLIENT:", numericId);

      // 1. Get lead item
      let localLeads = [];
      try {
        const raw = localStorage.getItem("tenspick_leads");
        if (raw) localLeads = JSON.parse(raw) || [];
      } catch (e) {}

      const leadItem = localLeads.find(l => String(l.id) === String(numericId));
      const clientName = leadItem ? (leadItem.name || leadItem.lead_name || "Client") : "Client";
      const companyName = leadItem ? (leadItem.company || leadItem.company_name || clientName) : "Company";
      const email = leadItem ? leadItem.email : `client_${numericId}@tenspick.org`;
      const mobile = leadItem ? (leadItem.phone || leadItem.mobile || "0000000000") : "0000000000";

      const newClient = {
        id: Date.now(),
        client_code: "CL-" + String(Date.now()).slice(-4),
        client_name: clientName,
        company_name: companyName,
        email: email,
        mobile: mobile,
        status: "active",
        created_at: new Date().toISOString()
      };

      // Save client to LocalStorage
      let localClients = [];
      try {
        const cRaw = localStorage.getItem("tenspick_clients");
        if (cRaw) localClients = JSON.parse(cRaw) || [];
      } catch (e) {}
      localClients.unshift(newClient);
      localStorage.setItem("tenspick_clients", JSON.stringify(localClients));

      // Remove lead from LocalStorage
      localLeads = localLeads.filter(l => String(l.id) !== String(numericId));
      localStorage.setItem("tenspick_leads", JSON.stringify(localLeads));

      // Try Supabase conversion
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            await sb.from("clients").insert([newClient]);
            await sb.from("leads").delete().eq("id", numericId);
          }
        } catch (sbErr) {
          console.warn("Convert Lead Supabase note:", sbErr);
        }
      }

      // Try PHP API conversion
      try {
        await apiRequest(
          "/leads/" + encodeURIComponent(numericId) + "/convert",
          { method: "POST" }
        );
      } catch (apiErr) {
        console.warn("Convert Lead API note:", apiErr);
      }

      state.page = 1;
      await loadLeads();

      window.alert("Lead converted to client successfully.");
    } catch (err) {
      error("CONVERT LEAD ERROR:", err);
      window.alert(err.message || "Unable to convert lead into client.");
    }
  }

  /* ============================================================
       DELETE
       ============================================================ */

  async function deleteLead(id) {
    if (window.TenspickAuth && window.TenspickAuth.isStaff()) {
      window.alert("Permission Denied: Staff members are not permitted to delete leads.");
      return;
    }

    const numericId = Number(id || 0);

    if (!numericId || numericId <= 0) {
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this lead?",
    );

    if (!confirmed) {
      return;
    }

    try {
      log("DELETE:", numericId);

      // 1. Remove from Supabase
      if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
        try {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            await sb.from("leads").delete().eq("id", numericId);
          }
        } catch (sbErr) {
          console.warn("Delete lead Supabase note:", sbErr);
        }
      }

      // 2. Remove from LocalStorage
      let localLeads = [];
      try {
        const raw = localStorage.getItem("tenspick_leads");
        if (raw) localLeads = JSON.parse(raw) || [];
      } catch (e) {}
      localLeads = localLeads.filter(l => String(l.id) !== String(numericId));
      localStorage.setItem("tenspick_leads", JSON.stringify(localLeads));

      // 3. Try PHP API
      try {
        await apiRequest("/leads/" + encodeURIComponent(numericId), { method: "DELETE" });
      } catch (apiErr) {
        console.warn("Delete lead API note:", apiErr);
      }

      await loadLeads();
      window.alert("Lead deleted successfully.");
    } catch (err) {
      error("DELETE ERROR:", err);
      window.alert(err.message || "Unable to delete lead.");
    }
  }

  /* ============================================================
       API REQUEST
       ============================================================ */

  async function apiRequest(endpoint, options = {}) {
    const method = String(options.method || "GET").toUpperCase();

    const url = API_BASE + endpoint;

    const hasBody = !["GET", "HEAD"].includes(method);

    log("API REQUEST:", {
      method: method,
      url: url,
      hasBody: hasBody,
      body: options.body || null,
    });

    /*
     * CSRF
     */

    if (hasBody && !options._csrfRetry) {
      await getCsrfToken();
    }

    const headers = {
      Accept: "application/json",
    };

    if (hasBody) {
      headers["Content-Type"] = "application/json";

      if (state.csrfToken) {
        headers["X-CSRF-Token"] = state.csrfToken;
      }
    }

    let response;

    try {
      response = await fetch(url, {
        method: method,

        credentials: "include",

        headers: headers,

        body: hasBody ? options.body : undefined,

        cache: "no-store",
      });
    } catch (networkError) {
      error("FETCH FAILED:", networkError);

      throw new Error("Unable to connect to Tenspick API.");
    }

    log("HTTP STATUS:", response.status);

    /*
     * CSRF retry
     */

    if (
      (response.status === 419 || response.status === 403) &&
      hasBody &&
      !options._csrfRetry
    ) {
      warn("CSRF rejected. Getting new token.");

      state.csrfToken = null;

      return apiRequest(endpoint, {
        ...options,
        _csrfRetry: true,
      });
    }

    /*
     * Unauthorized
     */

    if (response.status === 401) {
      error("Authentication required.");

      throw new Error("Admin authentication required. Please login again.");
    }

    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (jsonError) {
        data = { success: true, data: [] };
      }
    } else {
      data = { success: true, data: [] };
    }

    if (!response.ok && (!data || data.success === false)) {
      return { success: true, data: [] };
    }

    return data || { success: true, data: [] };
  }

  /* ============================================================
       CSRF
       ============================================================ */

  async function getCsrfToken() {
    if (state.csrfToken) {
      log("Using existing CSRF token.");

      return state.csrfToken;
    }

    const url = API_BASE + "/security/csrf";

    log("GET CSRF:", url);

    let response;

    try {
      response = await fetch(url, {
        method: "GET",

        credentials: "include",

        headers: {
          Accept: "application/json",
        },

        cache: "no-store",
      });
    } catch (err) {
      error("CSRF FETCH ERROR:", err);

      throw new Error("Unable to connect to security API.");
    }

    log("CSRF HTTP:", response.status);

    let data;

    try {
      data = await response.json();
    } catch (err) {
      error("CSRF RESPONSE:", err);

      throw new Error("Security API did not return valid JSON.");
    }

    log("CSRF RESPONSE DATA:", data);

    if (
      !response.ok ||
      !data ||
      data.success !== true ||
      !data.data ||
      !data.data.token
    ) {
      throw new Error(data?.message || "Unable to obtain CSRF token.");
    }

    state.csrfToken = String(data.data.token);

    log("CSRF TOKEN RECEIVED.");

    return state.csrfToken;
  }

  /* ============================================================
       ADD / EDIT MODAL
       ============================================================ */

  function showLeadModal() {
    const modal = document.getElementById("leadModal");

    if (!modal) {
      return;
    }

    modal.hidden = false;

    modal.removeAttribute("hidden");

    document.body.classList.add("modal-open");

    document.body.classList.add("leads-modal-open");

    requestAnimationFrame(function () {
      modal.classList.add("show");
    });
  }

  function closeLeadModal() {
    const modal = document.getElementById("leadModal");

    if (!modal) {
      return;
    }

    modal.classList.remove("show");

    document.body.classList.remove("modal-open");

    document.body.classList.remove("leads-modal-open");

    setTimeout(function () {
      modal.hidden = true;

      modal.setAttribute("hidden", "");
    }, 200);

    state.editingId = null;
  }

  /* ============================================================
       PROFILE MODAL
       ============================================================ */

  function ensureProfileModal() {
    if (document.getElementById("leadProfileModal")) {
      return;
    }

    const modal = document.createElement("div");

    modal.id = "leadProfileModal";

    modal.className = "lead-profile-modal";

    modal.hidden = true;

    modal.innerHTML = `

      <div
        class="lead-profile-backdrop"
        data-close-lead-profile
      ></div>


      <div
        class="lead-profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="leadProfileTitle"
      >

        <!-- HEADER -->

        <div
          class="lead-profile-header"
        >

          <div
            class="lead-profile-heading"
          >

            <div
              class="lead-profile-avatar"
              id="leadProfileAvatar"
            >
              -
            </div>

            <div>

              <span
                class="lead-profile-eyebrow"
              >
                LEAD PROFILE
              </span>

              <h3
                id="leadProfileTitle"
              >
                Lead Profile
              </h3>

              <span
                id="leadProfileCode"
                class="lead-profile-code"
              >
                -
              </span>

            </div>

          </div>


          <button
            type="button"
            class="lead-profile-close"
            id="closeLeadProfile"
            aria-label="Close"
          >
            ×
          </button>

        </div>


        <!-- STATUS AREA -->

        <div
          class="lead-profile-status-bar"
        >

          <div
            id="leadProfileStatus"
          ></div>

          <div
            id="leadProfilePriority"
          ></div>

        </div>


        <!-- BODY -->

        <div
          class="lead-profile-body"
        >

          <!-- CONTACT -->

          <section
            class="lead-profile-section"
          >

            <div
              class="lead-profile-section-title"
            >
              Contact Information
            </div>


            <div
              class="lead-profile-grid"
            >

              <div
                class="lead-profile-field"
              >

                <span>
                  Lead Name
                </span>

                <strong
                  id="leadProfileName"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Company
                </span>

                <strong
                  id="leadProfileCompany"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Phone
                </span>

                <strong
                  id="leadProfilePhone"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Email
                </span>

                <strong
                  id="leadProfileEmail"
                >
                  -
                </strong>

              </div>

            </div>

          </section>


          <!-- LEAD DETAILS -->

          <section
            class="lead-profile-section"
          >

            <div
              class="lead-profile-section-title"
            >
              Lead Details
            </div>


            <div
              class="lead-profile-grid"
            >

              <div
                class="lead-profile-field"
              >

                <span>
                  Service
                </span>

                <strong
                  id="leadProfileService"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Source
                </span>

                <strong
                  id="leadProfileSource"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Follow-up Date
                </span>

                <strong
                  id="leadProfileFollowUp"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Created
                </span>

                <strong
                  id="leadProfileCreated"
                >
                  -
                </strong>

              </div>


              <div
                class="lead-profile-field"
              >

                <span>
                  Updated
                </span>

                <strong
                  id="leadProfileUpdated"
                >
                  -
                </strong>

              </div>

            </div>

          </section>


          <!-- NOTES -->

          <section
            class="lead-profile-section"
          >

            <div
              class="lead-profile-section-title"
            >
              Notes
            </div>

            <div
              class="lead-profile-notes"
              id="leadProfileNotes"
            >
              No notes available.
            </div>

          </section>

        </div>


        <!-- FOOTER -->

        <div
          class="lead-profile-footer"
        >

          <button
            type="button"
            class="
              leads-btn
              leads-btn-secondary
            "
            id="closeLeadProfileButton"
          >
            Close
          </button>


          <button
            type="button"
            class="
              leads-btn
              leads-btn-secondary
              lead-profile-delete-button
            "
            id="leadProfileDeleteButton"
          >
            Delete
          </button>


          <button
            type="button"
            class="
              leads-btn
              leads-btn-primary
            "
            id="leadProfileEditButton"
          >
            Edit Lead
          </button>

        </div>

      </div>

    `;

    document.body.appendChild(modal);

    log("Lead profile modal created.");
  }

  /* ============================================================
       RENDER PROFILE
       ============================================================ */

  function renderLeadProfile(lead) {
    ensureProfileModal();

    const id = Number(lead.id || 0);

    const name = String(lead.name || "-");

    const code = String(lead.lead_code || lead.code || "-");

    const company = String(lead.company || "-");

    const phone = String(lead.phone || "-");

    const email = String(lead.email || "-");

    const service = String(lead.service || "-");

    const source = String(lead.source || "-");

    const status = normalizeStatus(lead.status);

    const priority = normalizePriority(lead.priority);

    const followUp = formatDate(lead.follow_up_date);

    const created = formatDateTime(lead.created_at);

    const updated = formatDateTime(lead.updated_at);

    setText("leadProfileTitle", name);

    setText("leadProfileCode", code);

    setText("leadProfileAvatar", getInitials(name));

    setText("leadProfileName", name);

    setText("leadProfileCompany", company);

    setText("leadProfilePhone", phone);

    setText("leadProfileEmail", email);

    setText("leadProfileService", service);

    setText("leadProfileSource", normalizeSource(source));

    setText("leadProfileFollowUp", followUp);

    setText("leadProfileCreated", created);

    setText("leadProfileUpdated", updated);

    const notes = String(lead.notes || "").trim();

    setText("leadProfileNotes", notes || "No notes available.");

    const statusElement = document.getElementById("leadProfileStatus");

    if (statusElement) {
      statusElement.innerHTML = `
        <span
          class="
            leads-status
            ${escapeHtml(status)}
          "
        >
          ${escapeHtml(formatStatus(status))}
        </span>
      `;
    }

    const priorityElement = document.getElementById("leadProfilePriority");

    if (priorityElement) {
      priorityElement.innerHTML = `
        <span
          class="
            lead-priority
            ${escapeHtml(priority)}
          "
        >
          ${escapeHtml(formatPriority(priority))}
        </span>
      `;
    }

    const editButton = document.getElementById("leadProfileEditButton");

    if (editButton) {
      editButton.dataset.id = String(id);
    }

    const deleteButton = document.getElementById("leadProfileDeleteButton");

    if (deleteButton) {
      deleteButton.dataset.id = String(id);
    }
  }

  /* ============================================================
       OPEN PROFILE
       ============================================================ */

  function openLeadProfile() {
    ensureProfileModal();

    const modal = document.getElementById("leadProfileModal");

    if (!modal) {
      return;
    }

    modal.hidden = false;

    modal.removeAttribute("hidden");

    document.body.classList.add("leads-profile-open");

    requestAnimationFrame(function () {
      modal.classList.add("show");
    });
  }

  /* ============================================================
       CLOSE PROFILE
       ============================================================ */

  function closeLeadProfile() {
    const modal = document.getElementById("leadProfileModal");

    if (!modal) {
      return;
    }

    modal.classList.remove("show");

    document.body.classList.remove("leads-profile-open");

    setTimeout(function () {
      if (!modal.classList.contains("show")) {
        modal.hidden = true;

        modal.setAttribute("hidden", "");
      }
    }, 200);

    state.viewingId = null;
  }

  /* ============================================================
       PAGINATION
       ============================================================ */

  function renderPagination(data) {
    const container = document.getElementById("leadsPagination");

    if (!container) {
      return;
    }

    const current = Number(data.page || state.page);

    const totalPages = Number(data.total_pages || 0);

    if (totalPages <= 1) {
      container.innerHTML = "";

      return;
    }

    let html = "";

    html += `
      <button
        type="button"
        class="
          leads-page-btn
          pagination-btn
        "
        data-page="${current - 1}"
        ${current <= 1 ? "disabled" : ""}
      >
        Previous
      </button>
    `;

    const start = Math.max(1, current - 2);

    const end = Math.min(totalPages, current + 2);

    for (let page = start; page <= end; page++) {
      html += `
        <button
          type="button"
          class="
            leads-page-btn
            pagination-btn
            ${page === current ? "active" : ""}
          "
          data-page="${page}"
          ${page === current ? 'aria-current="page"' : ""}
        >
          ${page}
        </button>
      `;
    }

    html += `
      <button
        type="button"
        class="
          leads-page-btn
          pagination-btn
        "
        data-page="${current + 1}"
        ${current >= totalPages ? "disabled" : ""}
      >
        Next
      </button>
    `;

    container.innerHTML = html;
  }

  /* ============================================================
       STATISTICS
       ============================================================ */

  function updateStatistics(data, pagination, leads) {
    const stats = data.statistics || data.stats || {};

    setText(
      "totalLeadsCount",
      stats.total ?? stats.total_leads ?? pagination.total ?? leads.length,
    );

    setText(
      "newLeadsCount",
      stats.new ?? stats.new_leads ?? countStatus(leads, "new"),
    );

    setText(
      "followUpLeadsCount",
      stats.follow_up ??
        stats.followUp ??
        stats.follow_up_leads ??
        countStatus(leads, "follow_up"),
    );

    setText(
      "wonLeadsCount",
      stats.won ?? stats.won_leads ?? countStatus(leads, "won"),
    );
  }

  /* ============================================================
       RESULT COUNT
       ============================================================ */

  function updateResultCount(pagination, leads) {
    const element = document.getElementById("leadResultCount");

    if (!element) {
      return;
    }

    const total = Number(pagination.total ?? leads.length);

    element.textContent = total + (total === 1 ? " lead" : " leads");
  }

  /* ============================================================
       CLEAR FILTERS
       ============================================================ */

  function clearFilters() {
    clearTimeout(searchTimer);

    state.search = "";

    state.status = "";

    state.priority = "";

    state.page = 1;

    setValue("leadSearch", "");

    setValue("leadStatusFilter", "");

    setValue("leadPriorityFilter", "");

    loadLeads();
  }

  /* ============================================================
       LOADING
       ============================================================ */

  function renderLoading() {
    const body = document.getElementById("leadsTableBody");

    if (!body) {
      return;
    }

    body.innerHTML = `
      <tr>

        <td
          colspan="9"
          class="leads-table-message"
        >

          <div
            class="leads-loading"
          >

            <span
              class="leads-loading-spinner"
            ></span>

            <span>
              Loading leads...
            </span>

          </div>

        </td>

      </tr>
    `;
  }

  /* ============================================================
       ERROR
       ============================================================ */

  function renderError(message) {
    const body = document.getElementById("leadsTableBody");

    if (!body) {
      return;
    }

    body.innerHTML = `
      <tr>

        <td
          colspan="9"
          class="leads-table-message"
        >

          <strong>
            Unable to load leads
          </strong>

          <br>

          ${escapeHtml(message)}

          <br>
          <br>

          <button
            type="button"
            class="
              leads-btn
              leads-btn-secondary
            "
            id="retryLeadsButton"
          >
            Retry
          </button>

        </td>

      </tr>
    `;
  }

  /* ============================================================
       REFRESH
       ============================================================ */

  function refresh() {
    state.page = 1;

    loadLeads();
  }

  /* ============================================================
       DESTROY
       ============================================================ */

  function destroy() {
    log("destroy() called.");

    clearTimeout(searchTimer);

    closeAllLeadMenus();

    state.loading = false;

    state.saving = false;

    state.viewing = false;

    state.editingId = null;

    state.viewingId = null;

    state.initialized = false;
  }

  /* ============================================================
       STATUS
       ============================================================ */

  function normalizeStatus(value) {
    const allowed = [
      "new",
      "contacted",
      "follow_up",
      "proposal_sent",
      "negotiation",
      "won",
      "lost",
    ];

    value = String(value || "new")
      .trim()
      .toLowerCase();

    return allowed.includes(value) ? value : "new";
  }

  function formatStatus(value) {
    const labels = {
      new: "New",

      contacted: "Contacted",

      follow_up: "Follow-up",

      proposal_sent: "Proposal Sent",

      negotiation: "Negotiation",

      won: "Won",

      lost: "Lost",
    };

    return labels[normalizeStatus(value)] || "New";
  }

  /* ============================================================
       PRIORITY
       ============================================================ */

  function normalizePriority(value) {
    const allowed = ["low", "medium", "high"];

    value = String(value || "medium")
      .trim()
      .toLowerCase();

    return allowed.includes(value) ? value : "medium";
  }

  function formatPriority(value) {
    const labels = {
      low: "Low",

      medium: "Medium",

      high: "High",
    };

    return labels[normalizePriority(value)] || "Medium";
  }

  /* ============================================================
       SOURCE
       ============================================================ */

  function normalizeSource(value) {
    if (!value) {
      return "-";
    }

    return String(value)
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, function (letter) {
        return letter.toUpperCase();
      });
  }

  /* ============================================================
       DATE
       ============================================================ */

  function normalizeInputDate(value) {
    if (!value) {
      return "";
    }

    const date = String(value).substring(0, 10);

    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const date = normalizeInputDate(value);

    if (!date) {
      return "-";
    }

    const parts = date.split("-");

    if (parts.length !== 3) {
      return date;
    }

    return parts[2] + "-" + parts[1] + "-" + parts[0];
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",

      month: "short",

      year: "numeric",

      hour: "2-digit",

      minute: "2-digit",
    }).format(date);
  }

  /* ============================================================
       INITIALS
       ============================================================ */

  function getInitials(name) {
    const value = String(name || "").trim();

    if (!value) {
      return "?";
    }

    const words = value.split(/\s+/);

    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    }

    return (
      words[0].charAt(0) + words[words.length - 1].charAt(0)
    ).toUpperCase();
  }

  /* ============================================================
       STATUS COUNT
       ============================================================ */

  function countStatus(leads, status) {
    if (!Array.isArray(leads)) {
      return 0;
    }

    return leads.filter(function (lead) {
      return normalizeStatus(lead.status) === status;
    }).length;
  }

  /* ============================================================
       EMAIL
       ============================================================ */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ============================================================
       GET VALUE
       ============================================================ */

  function getValue(id) {
    const element = document.getElementById(id);

    return element ? String(element.value ?? "") : "";
  }

  /* ============================================================
       SET VALUE
       ============================================================ */

  function setValue(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.value = value ?? "";
    }
  }

  /* ============================================================
       SET TEXT
       ============================================================ */

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = String(value ?? "");
    }
  }

  /* ============================================================
       ESCAPE HTML
       ============================================================ */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /* ============================================================
       SPA PAGE LOADED
       ============================================================ */

  document.addEventListener("tenspick:page-loaded", function (event) {
    const route = event?.detail?.route;

    if (route !== "leads") {
      return;
    }

    log("SPA leads route loaded.");

    setTimeout(function () {
      init();
    }, 0);
  });

  /* ============================================================
       AUTO INIT
       ============================================================ */

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        if (isLeadPage()) {
          init();
        }
      },
      {
        once: true,
      },
    );
  } else {
    if (isLeadPage()) {
      init();
    }
  }

  /* ============================================================
       FINAL
       ============================================================ */

  log("leads.js loaded.");

  log("Module:", window.TenspickLeads);
})(window, document);
