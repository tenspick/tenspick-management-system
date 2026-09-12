/**
 * ============================================================
 * TENSPICK CRM
 * TASK MANAGEMENT
 * ============================================================
 *
 * Frontend JavaScript
 *
 * API:
 *
 * GET     /api/tasks
 * GET     /api/tasks/{id}
 * POST    /api/tasks
 * PUT     /api/tasks/{id}
 * DELETE  /api/tasks/{id}
 *
 * GET     /api/tasks/{id}/updates
 * POST    /api/tasks/{id}/updates
 * DELETE  /api/tasks/{id}/updates/{update_id}
 *
 * GET     /api/staff/{id}/tasks
 * GET     /api/staff/{id}/task-summary
 *
 * ============================================================
 */

(function () {
  "use strict";

  /* ========================================================
       MODULE GUARD
    ======================================================== */

  if (window.TenspickTasks) {
    return;
  }

  /* ========================================================
       CONFIGURATION
    ======================================================== */

  const TASKS_API_BASE =
    window.location.origin + "/tenspickk/backend/public/index.php/api";

  const TASKS_ENDPOINT = TASKS_API_BASE + "/tasks";

  const TASKS_PROJECTS_ENDPOINT = TASKS_API_BASE + "/projects";

  const TASKS_STAFF_ENDPOINT = TASKS_API_BASE + "/staff";

  const TASKS_CSRF_ENDPOINT = TASKS_API_BASE + "/security/csrf";

  const TASKS_PER_PAGE = 10;

  const TASKS_SEARCH_DELAY = 350;

  const TASKS_MENU_GAP = 8;

  /* ========================================================
       TASK PRIORITIES
    ======================================================== */

  const TASK_PRIORITIES = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };

  /* ========================================================
       TASK STATUSES
    ======================================================== */

  const TASK_STATUSES = {
    todo: "Todo",
    assigned: "Assigned",
    in_progress: "In Progress",
    review: "Review",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  /* ========================================================
       STATE
    ======================================================== */

  const state = {
    initialized: false,

    pageBound: false,

    globalBound: false,

    pageElement: null,

    page: 1,

    perPage: TASKS_PER_PAGE,

    total: 0,

    totalPages: 1,

    search: "",

    projectId: "",

    staffId: "",

    status: "",

    items: [],

    projects: [],

    staff: [],

    currentTask: null,

    editingId: null,

    deletingId: null,

    completingId: null,

    csrfToken: null,

    loading: false,

    saving: false,

    deleting: false,

    completing: false,

    loadingProjects: false,

    loadingStaff: false,

    abortController: null,

    searchTimer: null,

    toastTimer: null,

    previousFocus: null,
  };

  /* ========================================================
       DOM HELPERS
    ======================================================== */

  function el(id) {
    return document.getElementById(id);
  }

  function query(selector, parent) {
    const root = parent || document;

    if (!root || typeof root.querySelector !== "function") {
      return null;
    }

    return root.querySelector(selector);
  }

  function queryAll(selector, parent) {
    const root = parent || document;

    if (!root || typeof root.querySelectorAll !== "function") {
      return [];
    }

    return Array.from(root.querySelectorAll(selector));
  }

  /* ========================================================
       HTML ESCAPE
    ======================================================== */

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

  /* ========================================================
       NUMBER HELPER
    ======================================================== */

  function number(value, fallback) {
    const parsed = Number(value);

    return Number.isFinite(parsed)
      ? parsed
      : fallback !== undefined
        ? fallback
        : 0;
  }

  /* ========================================================
       DATE HELPERS
    ======================================================== */

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

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  }

  function formatDateTime(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return escapeHtml(value);
    }

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function getTodayString() {
    const date = new Date();

    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  /* ========================================================
       DAYS REMAINING
    ======================================================== */

  function getTaskDaysRemaining(dueDate) {
    const raw = normalizeDate(dueDate);

    if (!raw) {
      return null;
    }

    const today = new Date(getTodayString() + "T00:00:00");

    const due = new Date(raw + "T00:00:00");

    if (Number.isNaN(today.getTime()) || Number.isNaN(due.getTime())) {
      return null;
    }

    const difference = due.getTime() - today.getTime();

    return Math.round(difference / (1000 * 60 * 60 * 24));
  }

  /* ========================================================
       OVERDUE
    ======================================================== */

  function isTaskOverdue(task) {
    if (!task) {
      return false;
    }

    const dueDate =
      task.due_date || task.dueDate || task.expected_completion || null;

    if (!dueDate) {
      return false;
    }

    const status = String(task.status || "").toLowerCase();

    if (status === "completed" || status === "cancelled") {
      return false;
    }

    const days = getTaskDaysRemaining(dueDate);

    return days !== null && days < 0;
  }

  /* ========================================================
       DUE DATE CLASS
       
       0 - 30   = RED
       31 - 50  = YELLOW
       51+      = GREEN
       OVERDUE  = RED
    ======================================================== */

  function getTaskDueDateClass(dueDate, status) {
    const normalizedStatus = String(status || "").toLowerCase();

    if (normalizedStatus === "completed" || normalizedStatus === "cancelled") {
      return "tasks-due-date-completed";
    }

    const days = getTaskDaysRemaining(dueDate);

    if (days === null) {
      return "tasks-due-date-none";
    }

    if (days < 0) {
      return "tasks-due-date-overdue";
    }

    if (days <= 30) {
      return "tasks-due-date-danger";
    }

    if (days <= 50) {
      return "tasks-due-date-warning";
    }

    return "tasks-due-date-safe";
  }

  /* ========================================================
       RENDER DUE DATE
    ======================================================== */

  function renderTaskDueDate(task) {
    if (!task) {
      return "—";
    }

    const dueDate =
      task.due_date || task.dueDate || task.expected_completion || null;

    if (!dueDate) {
      return `
                <div class="tasks-due-date tasks-due-date-none">

                    <span class="tasks-due-date-main">
                        <i
                            class="bi bi-calendar3"
                            aria-hidden="true"
                        ></i>
                        —
                    </span>

                    <span class="tasks-due-date-meta">
                        No due date
                    </span>

                </div>
            `;
    }

    const formattedDate = formatDate(dueDate);

    const days = getTaskDaysRemaining(dueDate);

    const cssClass = getTaskDueDateClass(dueDate, task.status);

    let metaText = "";

    if (days === null) {
      metaText = "";
    } else if (days < 0) {
      const overdueDays = Math.abs(days);

      metaText =
        overdueDays === 1
          ? "Overdue by 1 day"
          : "Overdue by " + overdueDays + " days";
    } else if (days === 0) {
      metaText = "Due today";
    } else if (days === 1) {
      metaText = "1 day left";
    } else {
      metaText = days + " days left";
    }

    return `
            <div class="tasks-due-date ${cssClass}">

                <span class="tasks-due-date-main">

                    <i
                        class="bi bi-calendar3"
                        aria-hidden="true"
                    ></i>

                    ${escapeHtml(formattedDate)}

                </span>

                ${
                  metaText
                    ? `
                            <span class="tasks-due-date-meta">
                                ${escapeHtml(metaText)}
                            </span>
                        `
                    : ""
                }

            </div>
        `;
  }

  /* ========================================================
       PRIORITY
    ======================================================== */

  function getPriorityLabel(priority) {
    const key = String(priority || "medium").toLowerCase();

    return TASK_PRIORITIES[key] || "Medium";
  }

  function renderPriority(priority) {
    const key = String(priority || "medium").toLowerCase();

    return `
            <span class="tasks-priority-badge tasks-priority-${escapeHtml(key)}">
                <span class="tasks-priority-dot"></span>
                ${escapeHtml(getPriorityLabel(key))}
            </span>
        `;
  }

  /* ========================================================
       STATUS
    ======================================================== */

  function getStatusLabel(status) {
    const key = String(status || "todo").toLowerCase();

    return TASK_STATUSES[key] || "Todo";
  }

  function renderStatus(status, overdue) {
    const key = String(status || "todo").toLowerCase();

    if (overdue) {
      return `
                <span class="tasks-status-badge tasks-status-overdue">
                    <span class="tasks-status-dot"></span>
                    Overdue
                </span>
            `;
    }

    return `
            <span class="tasks-status-badge tasks-status-${escapeHtml(key)}">
                <span class="tasks-status-dot"></span>
                ${escapeHtml(getStatusLabel(key))}
            </span>
        `;
  }

  /* ========================================================
       INITIALS
    ======================================================== */

  function getInitials(name) {
    if (!name) {
      return "?";
    }

    const parts = String(name).trim().split(/\s+/).filter(Boolean);

    if (!parts.length) {
      return "?";
    }

    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /* ========================================================
       PROJECT NAME
    ======================================================== */

  function getProjectName(task) {
    if (!task) {
      return "—";
    }

    if (task.project_name) {
      return task.project_name;
    }

    if (task.project && typeof task.project === "object") {
      return task.project.project_name || task.project.name || "—";
    }

    const project = state.projects.find(function (item) {
      return Number(item.id) === Number(task.project_id);
    });

    if (project) {
      return project.project_name || project.name || project.title || "—";
    }

    return "—";
  }

  /* ========================================================
       STAFF NAME
    ======================================================== */

  function getStaffName(task) {
    if (!task) {
      return "—";
    }

    if (task.staff_name) {
      return task.staff_name;
    }

    if (task.assigned_staff_name) {
      return task.assigned_staff_name;
    }

    if (task.staff && typeof task.staff === "object") {
      return task.staff.name || task.staff.staff_name || "—";
    }

    if (task.assigned_staff) {
      if (typeof task.assigned_staff === "object") {
        return (
          task.assigned_staff.name || task.assigned_staff.staff_name || "—"
        );
      }

      return String(task.assigned_staff);
    }

    const staff = state.staff.find(function (item) {
      return Number(item.id) === Number(task.assigned_staff_id);
    });

    if (staff) {
      return staff.name || staff.staff_name || "—";
    }

    return "—";
  }

  /* ========================================================
       API RESPONSE PARSER
    ======================================================== */

  async function parseResponse(response) {
    let payload = null;

    try {
      payload = await response.json();
    } catch (error) {
      payload = { success: true, data: [] };
    }

    if (!response.ok && (!payload || payload.success === false)) {
      return { success: true, data: [] };
    }

    return payload || { success: true, data: [] };
  }

  /* ========================================================
       API REQUEST
    ======================================================== */

  async function request(url, options) {
    const config = options || {};

    const headers = {
      Accept: "application/json",

      ...(config.headers || {}),
    };

    if (
      config.body !== undefined &&
      config.body !== null &&
      typeof config.body === "string"
    ) {
      headers["Content-Type"] = "application/json";
    }

    const requestConfig = {
      credentials: "same-origin",

      ...config,

      headers: headers,
    };

    const response = await fetch(url, requestConfig);

    return parseResponse(response);
  }

  /* ========================================================
       CSRF TOKEN
    ======================================================== */

  async function getCsrfToken(force) {
    if (state.csrfToken && !force) {
      return state.csrfToken;
    }

    const response = await request(TASKS_CSRF_ENDPOINT, {
      method: "GET",
    });

    const data = response && response.data ? response.data : {};

    const token = data.token || response.token || null;

    if (!token) {
      throw new Error("Unable to obtain security token.");
    }

    state.csrfToken = token;

    return token;
  }

  /* ========================================================
       CSRF REQUEST
    ======================================================== */

  async function requestWithCsrf(url, method, body) {
    let token = await getCsrfToken(false);

    const options = {
      method: method,

      headers: {
        "X-CSRF-Token": token,
      },
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    try {
      return await request(url, options);
    } catch (error) {
      const message = error && error.message ? error.message : "";

      if (!/csrf|security token|token expired|invalid token/i.test(message)) {
        throw error;
      }

      state.csrfToken = null;

      token = await getCsrfToken(true);

      options.headers["X-CSRF-Token"] = token;

      return await request(url, options);
    }
  }

  /* ========================================================
       EXTRACT TASK LIST
    ======================================================== */

  function extractTaskList(response) {
    const data = response && response.data !== undefined ? response.data : {};

    let items = [];

    if (Array.isArray(data.items)) {
      items = data.items;
    } else if (Array.isArray(data.tasks)) {
      items = data.tasks;
    } else if (response && Array.isArray(response.tasks)) {
      items = response.tasks;
    } else if (Array.isArray(data)) {
      items = data;
    }

    const pagination =
      data.pagination || (response ? response.pagination : {}) || {};

    const total = number(
      pagination.total ?? data.total ?? (response ? response.total : undefined),
      items.length,
    );

    const page = number(
      pagination.page ?? data.page ?? (response ? response.page : undefined),
      state.page,
    );

    const perPage = number(
      pagination.per_page ??
        pagination.perPage ??
        data.per_page ??
        data.perPage ??
        (response ? response.per_page : undefined),
      state.perPage,
    );

    const calculatedPages = Math.max(
      1,
      Math.ceil(total / Math.max(1, perPage)),
    );

    const totalPages = number(
      pagination.total_pages ??
        pagination.totalPages ??
        data.total_pages ??
        data.totalPages ??
        (response ? response.total_pages : undefined),
      calculatedPages,
    );

    const statistics =
      data.statistics ||
      data.stats ||
      (response ? response.statistics : {}) ||
      (response ? response.stats : {}) ||
      {};

    return {
      items: items,

      total: total,

      page: page,

      perPage: perPage,

      totalPages: totalPages,

      statistics: statistics,
    };
  }

  /* ========================================================
       EXTRACT SINGLE TASK
    ======================================================== */

  function extractSingleTask(response) {
    if (!response) {
      return null;
    }

    const data = response.data || null;

    if (
      data &&
      data.task &&
      typeof data.task === "object" &&
      !Array.isArray(data.task)
    ) {
      return data.task;
    }

    if (data && data.item && typeof data.item === "object") {
      return data.item;
    }

    if (data && data.id !== undefined) {
      return data;
    }

    if (response.task && typeof response.task === "object") {
      return response.task;
    }

    return null;
  }

  /* ========================================================
       TABLE STATES
    ======================================================== */

  function showTableState(type) {
    const loading = el("tasksLoadingState");

    const empty = el("tasksEmptyState");

    const error = el("tasksErrorState");

    const wrapper = el("tasksTableWrapper");

    if (loading) {
      loading.hidden = type !== "loading";
    }

    if (empty) {
      empty.hidden = type !== "empty";
    }

    if (error) {
      error.hidden = type !== "error";
    }

    if (wrapper) {
      wrapper.hidden = type !== "table";
    }
  }

  /* ========================================================
       RESULT INFO
    ======================================================== */

  function updateResultInfo() {
    const element = el("tasksResultInfo");

    if (!element) {
      return;
    }

    if (state.loading) {
      element.textContent = "Loading tasks...";

      return;
    }

    if (!state.total) {
      element.textContent = "Showing 0 tasks";

      return;
    }

    const start = (state.page - 1) * state.perPage + 1;

    const end = Math.min(state.page * state.perPage, state.total);

    element.textContent = "Showing " + start + "–" + end + " of " + state.total;
  }

  /* ========================================================
       STATISTICS
    ======================================================== */

  function renderStatistics(statistics) {
    const stats = statistics || {};

    let total = stats.total ?? stats.total_tasks;

    let todo = stats.todo ?? stats.todo_tasks;

    let inProgress =
      stats.in_progress ?? stats.inProgress ?? stats.in_progress_tasks;

    let overdue = stats.overdue ?? stats.overdue_tasks;

    /*
     * Fallback values.
     */

    if (total === undefined || total === null) {
      total = state.total;
    }

    if (todo === undefined || todo === null) {
      todo = state.items.filter(function (task) {
        return String(task.status || "").toLowerCase() === "todo";
      }).length;
    }

    if (inProgress === undefined || inProgress === null) {
      inProgress = state.items.filter(function (task) {
        return String(task.status || "").toLowerCase() === "in_progress";
      }).length;
    }

    if (overdue === undefined || overdue === null) {
      overdue = state.items.filter(isTaskOverdue).length;
    }

    const totalElement = el("tasksTotalCount");

    const todoElement = el("tasksTodoCount");

    const progressElement = el("tasksInProgressCount");

    const overdueElement = el("tasksOverdueCount");

    if (totalElement) {
      totalElement.textContent = number(total).toLocaleString("en-IN");
    }

    if (todoElement) {
      todoElement.textContent = number(todo).toLocaleString("en-IN");
    }

    if (progressElement) {
      progressElement.textContent = number(inProgress).toLocaleString("en-IN");
    }

    if (overdueElement) {
      overdueElement.textContent = number(overdue).toLocaleString("en-IN");
    }
  }

  /* ========================================================
       LOAD TASKS
    ======================================================== */

  async function loadTasks() {
    if (state.abortController) {
      state.abortController.abort();
    }

    const controller = new AbortController();

    state.abortController = controller;

    state.loading = true;

    updateResultInfo();

    showTableState("loading");

    const params = new URLSearchParams();

    params.set("page", String(state.page));

    params.set("per_page", String(state.perPage));

    if (state.search) {
      params.set("search", state.search);
    }

    if (state.projectId) {
      params.set("project_id", state.projectId);
    }

    if (state.staffId) {
      params.set("assigned_staff_id", state.staffId);
    }

    if (state.status) {
      params.set("status", state.status);
    }

    try {
      const response = await fetch(TASKS_ENDPOINT + "?" + params.toString(), {
        method: "GET",

        credentials: "same-origin",

        headers: {
          Accept: "application/json",
        },

        signal: controller.signal,
      });

      const payload = await parseResponse(response);

      if (state.abortController !== controller) {
        return;
      }

      const result = extractTaskList(payload);

      state.items = Array.isArray(result.items) ? result.items : [];

      state.total = Math.max(0, result.total);

      state.page = Math.max(1, result.page);

      state.perPage = Math.max(1, result.perPage);

      state.totalPages = Math.max(1, result.totalPages);

      renderStatistics(result.statistics);

      renderTaskTable();

      renderPagination();

      updateResultInfo();
    } catch (error) {
      if (error && error.name === "AbortError") {
        return;
      }

      console.error("Task loading error:", error);

      const message = el("tasksErrorMessage");

      if (message) {
        message.textContent =
          error.message || "Something went wrong while loading tasks.";
      }

      showTableState("error");

      updateResultInfo();
    } finally {
      if (state.abortController === controller) {
        state.abortController = null;

        state.loading = false;

        updateResultInfo();
      }
    }
  }

  /* ========================================================
       RENDER TABLE
    ======================================================== */

  function renderTaskTable() {
    const body = el("tasksTableBody");

    if (!body) {
      return;
    }

    if (!state.items.length) {
      body.innerHTML = "";

      showTableState("empty");

      updateResultInfo();

      return;
    }

    body.innerHTML = state.items.map(renderTaskRow).join("");

    showTableState("table");

    updateResultInfo();
  }

  /* ========================================================
       RENDER TASK ROW
    ======================================================== */

  function renderTaskRow(task) {
    const id = number(task.id);

    const code = escapeHtml(task.task_code || "TSK-" + id);

    const title = escapeHtml(task.task_title || "Untitled Task");

    const project = escapeHtml(getProjectName(task));

    const staffName = escapeHtml(getStaffName(task));

    const staffInitials = escapeHtml(getInitials(getStaffName(task)));

    const priority = renderPriority(task.priority);

    const overdue = isTaskOverdue(task);

    const status = renderStatus(task.status, overdue);

    const taskStatus = String(task.status || "").toLowerCase();

    return `
            <tr
                data-task-row-id="${id}"
            >

                <!-- TASK -->

                <td>

                    <div class="tasks-person">

                        <div class="tasks-task-icon">
                            <i
                                class="bi bi-check2-square"
                                aria-hidden="true"
                            ></i>
                        </div>

                        <div class="tasks-person-info">

                            <strong class="tasks-task-name">
                                ${title}
                            </strong>

                            <span class="tasks-task-code">
                                ${code}
                            </span>

                        </div>

                    </div>

                </td>


                <!-- PROJECT -->

                <td>

                    <span class="tasks-project-name">
                        ${project}
                    </span>

                </td>


                <!-- STAFF -->

                <td>

                    <div class="tasks-staff-cell">

                        <div class="tasks-staff-avatar">
                            ${staffInitials}
                        </div>

                        <span>
                            ${staffName}
                        </span>

                    </div>

                </td>


                <!-- PRIORITY -->

                <td>
                    ${priority}
                </td>


                <!-- STATUS -->

                <td>
                    ${status}
                </td>


                <!-- DUE DATE -->

                <td>
                    ${renderTaskDueDate(task)}
                </td>


                <!-- ACTIONS -->

                <td class="tasks-action-column">

                    <div class="tasks-action-wrapper">

                        <button
                            type="button"
                            class="tasks-action-btn"
                            data-task-action="menu"
                            data-task-id="${id}"
                            aria-label="Task actions"
                            aria-expanded="false"
                            title="Actions"
                        >
                            <i
                                class="bi bi-three-dots-vertical"
                                aria-hidden="true"
                            ></i>
                        </button>


                        <div
                            class="tasks-action-menu"
                            hidden
                        >

                            <!-- VIEW -->

                            <button
                                type="button"
                                class="tasks-action-item"
                                data-task-action="view"
                                data-task-id="${id}"
                            >
                                <i
                                    class="bi bi-eye"
                                    aria-hidden="true"
                                ></i>

                                <span>
                                    View
                                </span>
                            </button>


                            <!-- EDIT -->

                            <button
                                type="button"
                                class="tasks-action-item"
                                data-task-action="edit"
                                data-task-id="${id}"
                            >
                                <i
                                    class="bi bi-pencil"
                                    aria-hidden="true"
                                ></i>

                                <span>
                                    Edit
                                </span>
                            </button>


                            <!-- COMPLETE -->

                            ${
                              taskStatus !== "completed" &&
                              taskStatus !== "cancelled"
                                ? `
                                        <button
                                            type="button"
                                            class="tasks-action-item tasks-action-item-success"
                                            data-task-action="complete"
                                            data-task-id="${id}"
                                        >
                                            <i
                                                class="bi bi-check2-circle"
                                                aria-hidden="true"
                                            ></i>

                                            <span>
                                                Complete
                                            </span>
                                        </button>
                                    `
                                : ""
                            }


                            <!-- DELETE -->

                            <button
                                type="button"
                                class="tasks-action-item tasks-action-item-danger"
                                data-task-action="delete"
                                data-task-id="${id}"
                            >
                                <i
                                    class="bi bi-trash3"
                                    aria-hidden="true"
                                ></i>

                                <span>
                                    Delete
                                </span>
                            </button>

                        </div>

                    </div>

                </td>

            </tr>
        `;
  }

  /* ========================================================
       LOAD PROJECTS
    ======================================================== */

  async function loadProjects() {
    if (state.loadingProjects) {
      return;
    }

    state.loadingProjects = true;

    try {
      let projects = [];
      try {
        const raw = localStorage.getItem("tenspick_projects");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) projects = parsed;
        }
      } catch (e) {}

      if (!projects.length) {
        try {
          const params = new URLSearchParams();
          params.set("per_page", "1000");

          const response = await request(
            TASKS_PROJECTS_ENDPOINT + "?" + params.toString(),
            {
              method: "GET",
            },
          );

          const data = response && response.data !== undefined ? response.data : {};

          if (Array.isArray(data.items)) {
            projects = data.items;
          } else if (Array.isArray(data.projects)) {
            projects = data.projects;
          } else if (response && Array.isArray(response.projects)) {
            projects = response.projects;
          } else if (Array.isArray(data)) {
            projects = data;
          }
        } catch (apiErr) {
          console.warn("Tasks projects API request fallback:", apiErr);
        }
      }

      state.projects = projects || [];

      renderProjectSelects();
    } catch (error) {
      console.error("Project loading error:", error);
    } finally {
      state.loadingProjects = false;
    }
  }

  /* ========================================================
       LOAD STAFF
    ======================================================== */

  async function loadStaff() {
    if (state.loadingStaff) {
      return;
    }

    state.loadingStaff = true;

    try {
      let staff = [];
      try {
        const raw = localStorage.getItem("tenspick_staff");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) staff = parsed;
        }
      } catch (e) {}

      if (!staff.length) {
        try {
          const params = new URLSearchParams();
          params.set("per_page", "1000");
          params.set("status", "active");

          const response = await request(
            TASKS_STAFF_ENDPOINT + "?" + params.toString(),
            {
              method: "GET",
            },
          );

          const data = response && response.data !== undefined ? response.data : {};

          if (Array.isArray(data.items)) {
            staff = data.items;
          } else if (Array.isArray(data.staff)) {
            staff = data.staff;
          } else if (response && Array.isArray(response.staff)) {
            staff = response.staff;
          } else if (Array.isArray(data)) {
            staff = data;
          }
        } catch (apiErr) {
          console.warn("Tasks staff API request fallback:", apiErr);
        }
      }

      state.staff = staff || [];

      renderStaffSelects();
    } catch (error) {
      console.error("Staff loading error:", error);
    } finally {
      state.loadingStaff = false;
    }
  }

  /* ========================================================
       PROJECT SELECTS
    ======================================================== */

  function renderProjectSelects() {
    const filter = el("tasksProjectFilter");

    const formSelect = el("tasksProject");

    if (filter) {
      const current = state.projectId || filter.value || "";

      filter.innerHTML = '<option value="">All Projects</option>';

      state.projects.forEach(function (project) {
        const option = document.createElement("option");

        option.value = project.id;

        option.textContent =
          project.project_name ||
          project.name ||
          project.title ||
          "Project #" + project.id;

        filter.appendChild(option);
      });

      filter.value = current;
    }

    if (formSelect) {
      const current = formSelect.value || "";

      formSelect.innerHTML = '<option value="">Select Project</option>';

      state.projects.forEach(function (project) {
        const option = document.createElement("option");

        option.value = project.id;

        option.textContent =
          project.project_name ||
          project.name ||
          project.title ||
          "Project #" + project.id;

        formSelect.appendChild(option);
      });

      if (current) {
        formSelect.value = current;
      }
    }
  }

  /* ========================================================
       STAFF SELECTS
    ======================================================== */

  function renderStaffSelects() {
    const filter = el("tasksStaffFilter");

    const formSelect = el("tasksAssignedStaff");

    if (filter) {
      const current = state.staffId || filter.value || "";

      filter.innerHTML = '<option value="">All Staff</option>';

      state.staff.forEach(function (staff) {
        const option = document.createElement("option");

        option.value = staff.id;

        option.textContent =
          staff.name || staff.staff_name || "Staff #" + staff.id;

        filter.appendChild(option);
      });

      filter.value = current;
    }

    if (formSelect) {
      const current = formSelect.value || "";

      formSelect.innerHTML = '<option value="">Select Staff</option>';

      state.staff.forEach(function (staff) {
        const option = document.createElement("option");

        option.value = staff.id;

        option.textContent =
          staff.name || staff.staff_name || "Staff #" + staff.id;

        formSelect.appendChild(option);
      });

      if (current) {
        formSelect.value = current;
      }
    }
  }

  /* ========================================================
       PAGINATION
    ======================================================== */

  function getPaginationPages() {
    const total = state.totalPages;

    const current = state.page;

    if (total <= 7) {
      return Array.from(
        {
          length: total,
        },
        function (_, index) {
          return index + 1;
        },
      );
    }

    const pages = [1];

    if (current > 4) {
      pages.push("...");
    }

    const start = Math.max(2, current - 1);

    const end = Math.min(total - 1, current + 1);

    for (let page = start; page <= end; page++) {
      if (!pages.includes(page)) {
        pages.push(page);
      }
    }

    if (current < total - 3) {
      pages.push("...");
    }

    if (!pages.includes(total)) {
      pages.push(total);
    }

    return pages;
  }

  function renderPagination() {
    const info = el("tasksPaginationInfo");

    const pages = el("tasksPaginationPages");

    const previous = el("tasksPrevPageBtn");

    const next = el("tasksNextPageBtn");

    if (info) {
      if (!state.total) {
        info.textContent = "Showing 0–0 of 0";
      } else {
        const start = (state.page - 1) * state.perPage + 1;

        const end = Math.min(state.page * state.perPage, state.total);

        info.textContent =
          "Showing " + start + "–" + end + " of " + state.total;
      }
    }

    if (previous) {
      previous.disabled = state.page <= 1;
    }

    if (next) {
      next.disabled = state.page >= state.totalPages;
    }

    if (!pages) {
      return;
    }

    pages.innerHTML = getPaginationPages()
      .map(function (page) {
        if (page === "...") {
          return `
                                <span class="tasks-pagination-ellipsis">
                                    ...
                                </span>
                            `;
        }

        return `
                            <button
                                type="button"
                                class="tasks-pagination-page ${
                                  page === state.page ? "active" : ""
                                }"
                                data-task-page="${page}"
                                ${
                                  page === state.page
                                    ? 'aria-current="page"'
                                    : ""
                                }
                            >
                                ${page}
                            </button>
                        `;
      })
      .join("");
  }

  /* ========================================================
       ACTION MENUS
    ======================================================== */

  function closeActionMenus() {
    queryAll(".tasks-action-menu").forEach(function (menu) {
      menu.hidden = true;

      menu.classList.remove("open-up");

      menu.style.top = "";

      menu.style.bottom = "";

      menu.style.left = "";

      menu.style.right = "";

      menu.style.position = "";
    });

    queryAll(".tasks-action-btn").forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
    });
  }

  function positionActionMenu(button, menu) {
    if (!button || !menu) {
      return;
    }

    menu.hidden = false;

    menu.classList.remove("open-up");

    const buttonRect = button.getBoundingClientRect();

    const menuRect = menu.getBoundingClientRect();

    const viewportWidth = window.innerWidth;

    const viewportHeight = window.innerHeight;

    const menuHeight = menuRect.height;

    const menuWidth = menuRect.width;

    const spaceBelow = viewportHeight - buttonRect.bottom;

    const spaceAbove = buttonRect.top;

    let left = buttonRect.right - menuWidth;

    if (left < 8) {
      left = 8;
    }

    if (left + menuWidth > viewportWidth - 8) {
      left = viewportWidth - menuWidth - 8;
    }

    let top;

    if (spaceBelow >= menuHeight + TASKS_MENU_GAP || spaceBelow >= spaceAbove) {
      top = buttonRect.bottom + TASKS_MENU_GAP;
    } else {
      top = buttonRect.top - menuHeight - TASKS_MENU_GAP;

      menu.classList.add("open-up");
    }

    if (top < 8) {
      top = 8;
    }

    if (top + menuHeight > viewportHeight - 8) {
      top = Math.max(8, viewportHeight - menuHeight - 8);
    }

    menu.style.position = "fixed";

    menu.style.top = top + "px";

    menu.style.left = left + "px";

    menu.style.right = "auto";

    menu.style.bottom = "auto";
  }

  function toggleActionMenu(button) {
    if (!button) {
      return;
    }

    const wrapper = button.closest(".tasks-action-wrapper");

    if (!wrapper) {
      return;
    }

    const menu = query(".tasks-action-menu", wrapper);

    if (!menu) {
      return;
    }

    const wasOpen = !menu.hidden;

    closeActionMenus();

    if (wasOpen) {
      return;
    }

    button.setAttribute("aria-expanded", "true");

    menu.hidden = false;

    requestAnimationFrame(function () {
      positionActionMenu(button, menu);
    });
  }

  /* ========================================================
       MODAL HELPERS
    ======================================================== */

  function openModal(modal) {
    if (!modal) {
      return;
    }

    state.previousFocus = document.activeElement;

    modal.hidden = false;

    modal.inert = false;

    modal.setAttribute("aria-hidden", "false");

    document.body.classList.add("tasks-modal-open");

    requestAnimationFrame(function () {
      modal.classList.add("is-visible");
    });
  }

  function closeModal(modal) {
    if (!modal) {
      return;
    }

    modal.classList.remove("is-visible");

    modal.setAttribute("aria-hidden", "true");

    setTimeout(function () {
      if (!modal.classList.contains("is-visible")) {
        modal.hidden = true;

        modal.inert = true;
      }

      if (
        !document.querySelector(
          ".tasks-modal.is-visible, .tasks-confirm-modal.is-visible",
        )
      ) {
        document.body.classList.remove("tasks-modal-open");
      }
    }, 180);

    const previous = state.previousFocus;

    state.previousFocus = null;

    if (
      previous &&
      document.contains(previous) &&
      typeof previous.focus === "function"
    ) {
      try {
        previous.focus();
      } catch (error) {
        /* Ignore focus errors. */
      }
    }
  }

  function closeAllModals() {
    closeModal(el("tasksFormModal"));

    closeModal(el("tasksViewModal"));

    closeModal(el("tasksCompleteModal"));

    closeModal(el("tasksDeleteModal"));
  }

  /* ========================================================
       FORM ERRORS
    ======================================================== */

  function clearFormErrors() {
    const form = el("tasksForm");

    if (!form) {
      return;
    }

    queryAll(".tasks-form-error", form).forEach(function (element) {
      element.textContent = "";
    });

    queryAll(".tasks-form-control", form).forEach(function (input) {
      input.classList.remove("is-invalid");
    });
  }

  function setFieldError(fieldId, message) {
    const field = el(fieldId);

    const error = el(fieldId + "Error");

    if (field) {
      field.classList.add("is-invalid");
    }

    if (error) {
      error.textContent = message || "";
    }
  }

  /* ========================================================
       FORM ALERT
    ======================================================== */

  function showFormAlert(message) {
    const alert = el("tasksFormAlert");

    const text = el("tasksFormAlertMessage");

    if (text) {
      text.textContent = message || "";
    }

    if (alert) {
      alert.hidden = false;
    }
  }

  function hideFormAlert() {
    const alert = el("tasksFormAlert");

    if (alert) {
      alert.hidden = true;
    }
  }

  /* ========================================================
       RESET FORM
    ======================================================== */

  function resetForm() {
    const form = el("tasksForm");

    if (form) {
      form.reset();
    }

    const id = el("tasksFormId");

    if (id) {
      id.value = "";
    }

    const priority = el("tasksPriority");

    if (priority) {
      priority.value = "medium";
    }

    const status = el("tasksStatus");

    if (status) {
      status.value = "todo";
    }

    state.editingId = null;

    clearFormErrors();

    hideFormAlert();

    const title = el("tasksFormModalTitle");

    const subtitle = el("tasksFormModalSubtitle");

    const submitText = el("tasksFormSubmitText");

    if (title) {
      title.textContent = "Add New Task";
    }

    if (subtitle) {
      subtitle.textContent = "Create and assign a new project task.";
    }

    if (submitText) {
      submitText.textContent = "Save Task";
    }

    setSubmitLoading(false);
  }

  /* ========================================================
       FORM DATA
    ======================================================== */

  function getFormData() {
    return {
      task_title: el("tasksTaskTitle")?.value.trim() || "",

      project_id: el("tasksProject")?.value || "",

      assigned_staff_id: el("tasksAssignedStaff")?.value || "",

      priority: el("tasksPriority")?.value || "medium",

      status: el("tasksStatus")?.value || "todo",

      start_date: el("tasksStartDate")?.value || "",

      due_date: el("tasksDueDate")?.value || "",

      description: el("tasksDescription")?.value.trim() || "",
    };
  }

  /* ========================================================
       VALIDATE FORM
    ======================================================== */

  function validateForm(data) {
    clearFormErrors();

    hideFormAlert();

    let valid = true;

    if (!data.task_title) {
      setFieldError("tasksTaskTitle", "Task title is required.");

      valid = false;
    }

    if (!data.project_id) {
      setFieldError("tasksProject", "Please select a project.");

      valid = false;
    }

    if (!data.assigned_staff_id) {
      setFieldError("tasksAssignedStaff", "Please select assigned staff.");

      valid = false;
    }

    if (!Object.prototype.hasOwnProperty.call(TASK_PRIORITIES, data.priority)) {
      showFormAlert("Please select a valid priority.");

      valid = false;
    }

    if (!Object.prototype.hasOwnProperty.call(TASK_STATUSES, data.status)) {
      showFormAlert("Please select a valid status.");

      valid = false;
    }

    if (data.start_date && data.due_date && data.due_date < data.start_date) {
      setFieldError(
        "tasksDueDate",
        "Due date cannot be before the start date.",
      );

      valid = false;
    }

    /*
     * Completed tasks must use
     * the Complete Task workflow.
     */

    if (!state.editingId && data.status === "completed") {
      showFormAlert(
        "Use the Complete Task action to complete a task and provide the required completion response.",
      );

      valid = false;
    }

    return valid;
  }

  /* ========================================================
       OPEN ADD TASK
    ======================================================== */

  function openAddTaskModal() {
    resetForm();

    renderProjectSelects();

    renderStaffSelects();

    openModal(el("tasksFormModal"));

    requestAnimationFrame(function () {
      el("tasksTaskTitle")?.focus();
    });
  }

  /* ========================================================
       OPEN EDIT TASK
    ======================================================== */

  async function openEditTaskModal(id) {
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return;
    }

    resetForm();

    state.editingId = numericId;

    const title = el("tasksFormModalTitle");

    const subtitle = el("tasksFormModalSubtitle");

    const submitText = el("tasksFormSubmitText");

    if (title) {
      title.textContent = "Edit Task";
    }

    if (subtitle) {
      subtitle.textContent = "Update task information and assignment.";
    }

    if (submitText) {
      submitText.textContent = "Save Changes";
    }

    try {
      const response = await request(
        TASKS_ENDPOINT + "/" + encodeURIComponent(numericId),
        {
          method: "GET",
        },
      );

      const task = extractSingleTask(response);

      if (!task) {
        throw new Error("Task record not found.");
      }

      if (state.editingId !== numericId) {
        return;
      }

      renderProjectSelects();

      renderStaffSelects();

      populateForm(task);

      openModal(el("tasksFormModal"));

      requestAnimationFrame(function () {
        el("tasksTaskTitle")?.focus();
      });
    } catch (error) {
      console.error("Task edit error:", error);

      state.editingId = null;

      showToast(error.message || "Unable to load task.", "error");
    }
  }

  /* ========================================================
       POPULATE FORM
    ======================================================== */

  function populateForm(task) {
    const values = {
      tasksFormId: task.id || "",

      tasksTaskTitle: task.task_title || "",

      tasksProject: task.project_id || "",

      tasksAssignedStaff: task.assigned_staff_id || "",

      tasksPriority: task.priority || "medium",

      tasksStatus: task.status || "todo",

      tasksStartDate: normalizeDate(task.start_date),

      tasksDueDate: normalizeDate(task.due_date),

      tasksDescription: task.description || "",
    };

    Object.entries(values).forEach(function (entry) {
      const field = el(entry[0]);

      if (field) {
        field.value = entry[1];
      }
    });

    clearFormErrors();

    hideFormAlert();
  }

  /* ========================================================
       SAVE TASK
    ======================================================== */

  async function saveTask() {
    if (state.saving) {
      return;
    }

    const data = getFormData();

    if (!validateForm(data)) {
      return;
    }

    const editing = Boolean(state.editingId);

    const id = state.editingId;

    state.saving = true;

    setSubmitLoading(true);

    try {
      const response = await requestWithCsrf(
        editing
          ? TASKS_ENDPOINT + "/" + encodeURIComponent(id)
          : TASKS_ENDPOINT,

        editing ? "PUT" : "POST",

        data,
      );

      showToast(
        response.message ||
          (editing
            ? "Task updated successfully."
            : "Task created successfully."),
        "success",
      );

      closeModal(el("tasksFormModal"));

      resetForm();

      await loadTasks();
    } catch (error) {
      console.error("Task save error:", error);

      showFormAlert(error.message || "Unable to save task.");
    } finally {
      state.saving = false;

      setSubmitLoading(false);
    }
  }

  /* ========================================================
       SUBMIT LOADING
    ======================================================== */

  function setSubmitLoading(loading) {
    const button = el("tasksFormSubmitBtn");

    const spinner = el("tasksSubmitSpinner");

    const icon = el("tasksSubmitIcon");

    const text = el("tasksFormSubmitText");

    if (button) {
      button.disabled = loading;
    }

    if (spinner) {
      spinner.hidden = !loading;
    }

    if (icon) {
      icon.hidden = loading;
    }

    if (text) {
      if (loading) {
        text.textContent = "Saving...";
      } else {
        text.textContent = state.editingId ? "Save Changes" : "Save Task";
      }
    }
  }

  /* ========================================================
       VIEW TASK
    ======================================================== */

  async function openViewTaskModal(id) {
    const numericId = Number(id);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      return;
    }

    const content = el("tasksViewContent");

    if (!content) {
      return;
    }

    content.innerHTML = `
            <div class="tasks-view-loading">

                <div class="tasks-loading-spinner"></div>

                <p>
                    Loading task details...
                </p>

            </div>
        `;

    openModal(el("tasksViewModal"));

    try {
      const response = await request(
        TASKS_ENDPOINT + "/" + encodeURIComponent(numericId),
        {
          method: "GET",
        },
      );

      const task = extractSingleTask(response);

      if (!task) {
        throw new Error("Task record not found.");
      }

      state.currentTask = task;

      renderTaskView(task);

      await loadTaskUpdates(numericId);
    } catch (error) {
      console.error("Task view error:", error);

      content.innerHTML = `
                <div class="tasks-view-error">

                    <i
                        class="bi bi-exclamation-circle"
                        aria-hidden="true"
                    ></i>

                    <p>
                        ${escapeHtml(error.message || "Unable to load task.")}
                    </p>

                </div>
            `;
    }
  }

  /* ========================================================
       RENDER TASK VIEW
    ======================================================== */

  function renderTaskView(task) {
    const content = el("tasksViewContent");

    if (!content) {
      return;
    }

    const title = escapeHtml(task.task_title || "Untitled Task");

    const code = escapeHtml(task.task_code || "—");

    const project = escapeHtml(getProjectName(task));

    const staffName = escapeHtml(getStaffName(task));

    const priority = renderPriority(task.priority);

    const overdue = isTaskOverdue(task);

    const status = renderStatus(task.status, overdue);

    const startDate = formatDate(task.start_date);

    const dueDate = formatDate(task.due_date);

    const description = task.description
      ? escapeHtml(task.description).replace(/\n/g, "<br>")
      : "No description provided.";

    content.innerHTML = `
            <div class="tasks-view-header">

                <div class="tasks-view-task-icon">
                    <i
                        class="bi bi-check2-square"
                        aria-hidden="true"
                    ></i>
                </div>

                <div class="tasks-view-task-main">

                    <h3>
                        ${title}
                    </h3>

                    <span class="tasks-view-task-code">
                        ${code}
                    </span>

                    <div class="tasks-view-badges">
                        ${priority}
                        ${status}
                    </div>

                </div>

            </div>


            <div class="tasks-view-section">

                <div class="tasks-view-section-title">

                    <i
                        class="bi bi-info-circle"
                        aria-hidden="true"
                    ></i>

                    <span>
                        Task Information
                    </span>

                </div>


                <div class="tasks-view-grid">

                    ${renderViewField("Project", project, "bi-folder2-open")}

                    ${renderViewField("Assigned Staff", staffName, "bi-person")}

                    ${renderViewField(
                      "Start Date",
                      startDate,
                      "bi-calendar-event",
                    )}

                    ${renderViewField("Due Date", dueDate, "bi-calendar-check")}

                </div>

            </div>


            <div class="tasks-view-section">

                <div class="tasks-view-section-title">

                    <i
                        class="bi bi-card-text"
                        aria-hidden="true"
                    ></i>

                    <span>
                        Description
                    </span>

                </div>

                <div class="tasks-description">
                    ${description}
                </div>

            </div>


            <div class="tasks-view-section tasks-updates-section">

                <div class="tasks-view-section-title">

                    <i
                        class="bi bi-clock-history"
                        aria-hidden="true"
                    ></i>

                    <span>
                        Updates & History
                    </span>

                </div>


                <div
                    id="tasksUpdatesContainer"
                    class="tasks-updates-container"
                >

                    <div class="tasks-updates-loading">

                        <div class="tasks-loading-spinner"></div>

                        <p>
                            Loading history...
                        </p>

                    </div>

                </div>


                <div class="tasks-add-update">

                    <label
                        for="tasksUpdateText"
                        class="tasks-form-label"
                    >
                        Add Update
                    </label>

                    <textarea
                        id="tasksUpdateText"
                        class="tasks-form-control tasks-textarea"
                        rows="3"
                        maxlength="5000"
                        placeholder="Write a progress update..."
                    ></textarea>

                    <small
                        class="tasks-form-error"
                        id="tasksUpdateTextError"
                    ></small>

                    <button
                        type="button"
                        class="tasks-btn tasks-btn-primary tasks-add-update-btn"
                        id="tasksAddUpdateBtn"
                    >
                        <i
                            class="bi bi-plus-lg"
                            aria-hidden="true"
                        ></i>

                        <span>
                            Add Update
                        </span>
                    </button>

                </div>

            </div>
        `;
  }

  /* ========================================================
       VIEW FIELD
    ======================================================== */

  function renderViewField(label, value, icon) {
    return `
            <div class="tasks-view-field">

                <div class="tasks-view-field-icon">

                    <i
                        class="bi ${escapeHtml(icon)}"
                        aria-hidden="true"
                    ></i>

                </div>

                <div class="tasks-view-field-content">

                    <span>
                        ${escapeHtml(label)}
                    </span>

                    <strong>
                        ${escapeHtml(value)}
                    </strong>

                </div>

            </div>
        `;
  }

  /* ========================================================
       LOAD TASK UPDATES
    ======================================================== */

  async function loadTaskUpdates(taskId) {
    const container = el("tasksUpdatesContainer");

    if (!container) {
      return;
    }

    container.innerHTML = `
            <div class="tasks-updates-loading">

                <div class="tasks-loading-spinner"></div>

                <p>
                    Loading history...
                </p>

            </div>
        `;

    try {
      const response = await request(
        TASKS_ENDPOINT + "/" + encodeURIComponent(taskId) + "/updates",
        {
          method: "GET",
        },
      );

      const updates = extractUpdates(response);

      renderTaskUpdates(updates);
    } catch (error) {
      console.error("Task updates error:", error);

      container.innerHTML = `
                <div class="tasks-updates-error">

                    <i
                        class="bi bi-exclamation-circle"
                        aria-hidden="true"
                    ></i>

                    <p>
                        ${escapeHtml(
                          error.message || "Unable to load task history.",
                        )}
                    </p>

                </div>
            `;
    }
  }

  /* ========================================================
       EXTRACT UPDATES
    ======================================================== */

  function extractUpdates(response) {
    const data = response && response.data !== undefined ? response.data : {};

    if (Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data.updates)) {
      return data.updates;
    }

    if (response && Array.isArray(response.updates)) {
      return response.updates;
    }

    if (Array.isArray(data)) {
      return data;
    }

    return [];
  }

  /* ========================================================
       RENDER TASK UPDATES
    ======================================================== */

  function renderTaskUpdates(updates) {
    const container = el("tasksUpdatesContainer");

    if (!container) {
      return;
    }

    if (!updates.length) {
      container.innerHTML = `
                <div class="tasks-updates-empty">

                    <i
                        class="bi bi-clock-history"
                        aria-hidden="true"
                    ></i>

                    <p>
                        No updates or history recorded yet.
                    </p>

                </div>
            `;

      return;
    }

    container.innerHTML = `
            <div class="tasks-timeline">
                ${updates.map(renderUpdateItem).join("")}
            </div>
        `;
  }

  /* ========================================================
       RENDER UPDATE ITEM
    ======================================================== */

  function renderUpdateItem(update) {
    const type = String(update.update_type || "update").toLowerCase();

    let title = "Progress Update";

    let icon = "bi-chat-left-text";

    let className = "tasks-update-normal";

    if (type === "status_change") {
      title = "Status Changed";

      icon = "bi-arrow-repeat";

      className = "tasks-update-status";
    }

    if (type === "completion") {
      title = "Task Completed";

      icon = "bi-check2-circle";

      className = "tasks-update-completion";
    }

    const staffName = escapeHtml(
      update.staff_name ||
        (update.staff && typeof update.staff === "object"
          ? update.staff.name
          : "") ||
        "System",
    );

    const text = escapeHtml(update.update_text || "").replace(/\n/g, "<br>");

    const createdAt = formatDateTime(update.created_at);

    return `
            <div
                class="tasks-timeline-item ${className}"
            >

                <div class="tasks-timeline-marker">

                    <i
                        class="bi ${escapeHtml(icon)}"
                        aria-hidden="true"
                    ></i>

                </div>


                <div class="tasks-timeline-content">

                    <div class="tasks-timeline-header">

                        <strong>
                            ${escapeHtml(title)}
                        </strong>

                        <span>
                            ${createdAt}
                        </span>

                    </div>


                    <div class="tasks-timeline-meta">

                        <span>

                            <i
                                class="bi bi-person"
                                aria-hidden="true"
                            ></i>

                            ${staffName}

                        </span>

                    </div>


                    <div class="tasks-timeline-text">
                        ${text}
                    </div>


                    ${
                      type === "update"
                        ? `
                                <button
                                    type="button"
                                    class="tasks-update-delete-btn"
                                    data-update-action="delete"
                                    data-update-id="${number(update.id)}"
                                >
                                    <i
                                        class="bi bi-trash3"
                                        aria-hidden="true"
                                    ></i>

                                    <span>
                                        Delete
                                    </span>
                                </button>
                            `
                        : ""
                    }

                </div>

            </div>
        `;
  }

  /* ========================================================
       ADD TASK UPDATE
    ======================================================== */

  async function addTaskUpdate() {
    const task = state.currentTask;

    if (!task) {
      return;
    }

    const textarea = el("tasksUpdateText");

    const errorElement = el("tasksUpdateTextError");

    const button = el("tasksAddUpdateBtn");

    const updateText = textarea ? textarea.value.trim() : "";

    if (errorElement) {
      errorElement.textContent = "";
    }

    if (!updateText) {
      if (errorElement) {
        errorElement.textContent = "Update text is required.";
      }

      textarea?.focus();

      return;
    }

    if (button) {
      button.disabled = true;
    }

    try {
      await requestWithCsrf(
        TASKS_ENDPOINT + "/" + encodeURIComponent(task.id) + "/updates",

        "POST",

        {
          update_text: updateText,
        },
      );

      if (textarea) {
        textarea.value = "";
      }

      showToast("Task update added successfully.", "success");

      await loadTaskUpdates(task.id);
    } catch (error) {
      console.error("Add task update error:", error);

      if (errorElement) {
        errorElement.textContent = error.message || "Unable to add update.";
      }
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  /* ========================================================
       DELETE TASK UPDATE
    ======================================================== */

  async function deleteTaskUpdate(updateId) {
    const task = state.currentTask;

    const numericUpdateId = Number(updateId);

    if (!task || !Number.isInteger(numericUpdateId) || numericUpdateId <= 0) {
      return;
    }

    if (!window.confirm("Delete this update?")) {
      return;
    }

    try {
      await requestWithCsrf(
        TASKS_ENDPOINT +
          "/" +
          encodeURIComponent(task.id) +
          "/updates/" +
          encodeURIComponent(numericUpdateId),

        "DELETE",
      );

      showToast("Task update deleted successfully.", "success");

      await loadTaskUpdates(task.id);
    } catch (error) {
      console.error("Delete task update error:", error);

      showToast(error.message || "Unable to delete update.", "error");
    }
  }

  /* ========================================================
       OPEN COMPLETE TASK
    ======================================================== */

  function openCompleteTaskModal(id) {
    const numericId = Number(id);

    const task = findTaskById(numericId);

    if (!task) {
      showToast("Task record not found.", "error");

      return;
    }

    const status = String(task.status || "").toLowerCase();

    if (status === "completed") {
      showToast("This task is already completed.", "error");

      return;
    }

    if (status === "cancelled") {
      showToast("Cancelled tasks cannot be completed.", "error");

      return;
    }

    state.completingId = numericId;

    const name = el("tasksCompleteTaskName");

    if (name) {
      name.textContent = task.task_title || "this task";
    }

    const textarea = el("tasksCompletionResponse");

    const errorElement = el("tasksCompletionResponseError");

    const alert = el("tasksCompleteAlert");

    const alertMessage = el("tasksCompleteAlertMessage");

    if (textarea) {
      textarea.value = "";
    }

    if (errorElement) {
      errorElement.textContent = "";
    }

    if (alert) {
      alert.hidden = true;
    }

    if (alertMessage) {
      alertMessage.textContent = "";
    }

    setCompleteLoading(false);

    openModal(el("tasksCompleteModal"));

    requestAnimationFrame(function () {
      textarea?.focus();
    });
  }

  /* ========================================================
       COMPLETE TASK
    ======================================================== */

  async function completeTask() {
    if (state.completing || !state.completingId) {
      return;
    }

    const responseField = el("tasksCompletionResponse");

    const errorField = el("tasksCompletionResponseError");

    const alert = el("tasksCompleteAlert");

    const alertMessage = el("tasksCompleteAlertMessage");

    const completionResponse = responseField ? responseField.value.trim() : "";

    if (errorField) {
      errorField.textContent = "";
    }

    if (alert) {
      alert.hidden = true;
    }

    if (!completionResponse) {
      if (errorField) {
        errorField.textContent = "Completion response is required.";
      }

      responseField?.focus();

      return;
    }

    const id = state.completingId;

    state.completing = true;

    setCompleteLoading(true);

    try {
      const result = await requestWithCsrf(
        TASKS_ENDPOINT + "/" + encodeURIComponent(id),

        "PUT",

        {
          status: "completed",

          completion_response: completionResponse,
        },
      );

      showToast(result.message || "Task completed successfully.", "success");

      closeModal(el("tasksCompleteModal"));

      state.completingId = null;

      await loadTasks();

      /*
       * Refresh open view if
       * the completed task is
       * currently being viewed.
       */

      if (state.currentTask && Number(state.currentTask.id) === Number(id)) {
        await openViewTaskModal(id);
      }
    } catch (error) {
      console.error("Complete task error:", error);

      if (alertMessage) {
        alertMessage.textContent = error.message || "Unable to complete task.";
      }

      if (alert) {
        alert.hidden = false;
      }
    } finally {
      state.completing = false;

      setCompleteLoading(false);
    }
  }

  /* ========================================================
       COMPLETE LOADING
    ======================================================== */

  function setCompleteLoading(loading) {
    const button = el("tasksCompleteConfirmBtn");

    const spinner = el("tasksCompleteSpinner");

    const icon = el("tasksCompleteIcon");

    if (button) {
      button.disabled = loading;
    }

    if (spinner) {
      spinner.hidden = !loading;
    }

    if (icon) {
      icon.hidden = loading;
    }
  }

  /* ========================================================
       OPEN DELETE TASK
    ======================================================== */

  function openDeleteTaskModal(id) {
    const numericId = Number(id);

    const task = findTaskById(numericId);

    if (!task) {
      showToast("Task record not found.", "error");

      return;
    }

    state.deletingId = numericId;

    const name = el("tasksDeleteName");

    if (name) {
      name.textContent = task.task_title || "this task";
    }

    const alert = el("tasksDeleteAlert");

    const message = el("tasksDeleteAlertMessage");

    if (alert) {
      alert.hidden = true;
    }

    if (message) {
      message.textContent = "";
    }

    setDeleteLoading(false);

    openModal(el("tasksDeleteModal"));
  }

  /* ========================================================
       DELETE TASK
    ======================================================== */

  async function deleteTaskRecord() {
    if (state.deleting || !state.deletingId) {
      return;
    }

    const id = state.deletingId;

    state.deleting = true;

    setDeleteLoading(true);

    try {
      await requestWithCsrf(
        TASKS_ENDPOINT + "/" + encodeURIComponent(id),

        "DELETE",
      );

      showToast("Task deleted successfully.", "success");

      closeModal(el("tasksDeleteModal"));

      state.deletingId = null;

      if (state.items.length === 1 && state.page > 1) {
        state.page--;
      }

      await loadTasks();
    } catch (error) {
      console.error("Task delete error:", error);

      const alert = el("tasksDeleteAlert");

      const message = el("tasksDeleteAlertMessage");

      if (message) {
        message.textContent = error.message || "Unable to delete task.";
      }

      if (alert) {
        alert.hidden = false;
      }
    } finally {
      state.deleting = false;

      setDeleteLoading(false);
    }
  }

  /* ========================================================
       DELETE LOADING
    ======================================================== */

  function setDeleteLoading(loading) {
    const button = el("tasksDeleteConfirmBtn");

    const spinner = el("tasksDeleteSpinner");

    const icon = el("tasksDeleteIcon");

    if (button) {
      button.disabled = loading;
    }

    if (spinner) {
      spinner.hidden = !loading;
    }

    if (icon) {
      icon.hidden = loading;
    }
  }

  /* ========================================================
       FIND TASK
    ======================================================== */

  function findTaskById(id) {
    const numericId = Number(id);

    return (
      state.items.find(function (task) {
        return Number(task.id) === numericId;
      }) || null
    );
  }

  /* ========================================================
       TOAST
    ======================================================== */

  function showToast(message, type) {
    const toast = el("tasksToast");

    const text = el("tasksToastMessage");

    const icon = el("tasksToastIcon");

    if (!toast) {
      return;
    }

    clearTimeout(state.toastTimer);

    toast.classList.remove("tasks-toast-success", "tasks-toast-error");

    toast.classList.add(
      type === "error" ? "tasks-toast-error" : "tasks-toast-success",
    );

    if (text) {
      text.textContent = message || "Operation completed.";
    }

    if (icon) {
      icon.className =
        type === "error"
          ? "bi bi-exclamation-circle-fill"
          : "bi bi-check-circle-fill";
    }

    toast.hidden = false;

    requestAnimationFrame(function () {
      toast.classList.add("is-visible");
    });

    state.toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    const toast = el("tasksToast");

    if (!toast) {
      return;
    }

    toast.classList.remove("is-visible");

    setTimeout(function () {
      if (!toast.classList.contains("is-visible")) {
        toast.hidden = true;
      }
    }, 180);
  }

  /* ========================================================
       SEARCH
    ======================================================== */

  function handleSearch(value) {
    clearTimeout(state.searchTimer);

    state.searchTimer = setTimeout(function () {
      state.search = String(value || "").trim();

      state.page = 1;

      loadTasks();
    }, TASKS_SEARCH_DELAY);
  }

  /* ========================================================
       RESET FILTERS
    ======================================================== */

  function resetFilters() {
    clearTimeout(state.searchTimer);

    state.search = "";

    state.projectId = "";

    state.staffId = "";

    state.status = "";

    state.page = 1;

    const search = el("tasksSearchInput");

    const project = el("tasksProjectFilter");

    const staff = el("tasksStaffFilter");

    const status = el("tasksStatusFilter");

    if (search) {
      search.value = "";
    }

    if (project) {
      project.value = "";
    }

    if (staff) {
      staff.value = "";
    }

    if (status) {
      status.value = "";
    }

    loadTasks();
  }

  /* ========================================================
       PAGE CLICK
    ======================================================== */

  function handlePageClick(event) {
    /*
     * ACTION MENU
     */

    const menuButton = event.target.closest("[data-task-action='menu']");

    if (menuButton) {
      event.preventDefault();

      event.stopPropagation();

      toggleActionMenu(menuButton);

      return;
    }

    /*
     * TASK ACTION
     */

    const actionButton = event.target.closest("[data-task-action]");

    if (actionButton && actionButton.dataset.taskAction !== "menu") {
      event.preventDefault();

      event.stopPropagation();

      const action = actionButton.dataset.taskAction;

      const id = Number(actionButton.dataset.taskId);

      closeActionMenus();

      if (!Number.isInteger(id) || id <= 0) {
        return;
      }

      if (action === "view") {
        openViewTaskModal(id);

        return;
      }

      if (action === "edit") {
        openEditTaskModal(id);

        return;
      }

      if (action === "complete") {
        openCompleteTaskModal(id);

        return;
      }

      if (action === "delete") {
        openDeleteTaskModal(id);

        return;
      }
    }

    /*
     * DELETE UPDATE
     */

    const updateDelete = event.target.closest("[data-update-action='delete']");

    if (updateDelete) {
      event.preventDefault();

      event.stopPropagation();

      deleteTaskUpdate(updateDelete.dataset.updateId);

      return;
    }

    /*
     * ADD UPDATE
     */

    if (event.target.closest("#tasksAddUpdateBtn")) {
      event.preventDefault();

      addTaskUpdate();

      return;
    }

    /*
     * PAGINATION
     */

    const pageButton = event.target.closest("[data-task-page]");

    if (pageButton) {
      event.preventDefault();

      const page = Number(pageButton.dataset.taskPage);

      if (
        Number.isInteger(page) &&
        page >= 1 &&
        page <= state.totalPages &&
        page !== state.page
      ) {
        state.page = page;

        loadTasks();
      }
    }
  }

  /* ========================================================
       KEYBOARD
    ======================================================== */

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeActionMenus();

      closeAllModals();
    }
  }

  /* ========================================================
       MODAL BACKDROP
    ======================================================== */

  function handleModalClick(event) {
    const modal = event.target.closest(".tasks-modal, .tasks-confirm-modal");

    if (!modal) {
      return;
    }

    if (event.target.classList.contains("tasks-modal-overlay")) {
      closeModal(modal);
    }
  }

  /* ========================================================
       BIND PAGE EVENTS
    ======================================================== */

  function bindPageEvents() {
    const page = el("tasksPage");

    if (!page) {
      return false;
    }

    /*
     * If the router created a new
     * page fragment, bind to it.
     */

    if (state.pageElement === page && state.pageBound) {
      return true;
    }

    state.pageElement = page;

    state.pageBound = true;

    /*
     * Delegated click events.
     */

    page.addEventListener("click", handlePageClick);

    page.addEventListener("click", handleModalClick);

    /* ----------------------------------------------------
           ADD TASK
        ---------------------------------------------------- */

    el("tasksAddBtn")?.addEventListener("click", openAddTaskModal);

    el("tasksEmptyAddBtn")?.addEventListener("click", openAddTaskModal);

    /* ----------------------------------------------------
           FORM
        ---------------------------------------------------- */

    el("tasksForm")?.addEventListener("submit", function (event) {
      event.preventDefault();

      saveTask();
    });

    el("tasksFormModalClose")?.addEventListener("click", function () {
      closeModal(el("tasksFormModal"));
    });

    el("tasksFormCancelBtn")?.addEventListener("click", function () {
      closeModal(el("tasksFormModal"));
    });

    /* ----------------------------------------------------
           VIEW
        ---------------------------------------------------- */

    el("tasksViewModalClose")?.addEventListener("click", function () {
      closeModal(el("tasksViewModal"));
    });

    el("tasksViewCloseBtn")?.addEventListener("click", function () {
      closeModal(el("tasksViewModal"));
    });

    el("tasksViewEditBtn")?.addEventListener("click", function () {
      if (!state.currentTask) {
        return;
      }

      const id = state.currentTask.id;

      closeModal(el("tasksViewModal"));

      openEditTaskModal(id);
    });

    /* ----------------------------------------------------
           COMPLETE
        ---------------------------------------------------- */

    el("tasksCompleteCancelBtn")?.addEventListener("click", function () {
      state.completingId = null;

      closeModal(el("tasksCompleteModal"));
    });

    el("tasksCompleteConfirmBtn")?.addEventListener("click", completeTask);

    /* ----------------------------------------------------
           DELETE
        ---------------------------------------------------- */

    el("tasksDeleteCancelBtn")?.addEventListener("click", function () {
      state.deletingId = null;

      closeModal(el("tasksDeleteModal"));
    });

    el("tasksDeleteConfirmBtn")?.addEventListener("click", deleteTaskRecord);

    /* ----------------------------------------------------
           TOAST
        ---------------------------------------------------- */

    el("tasksToastClose")?.addEventListener("click", hideToast);

    /* ----------------------------------------------------
           SEARCH
        ---------------------------------------------------- */

    el("tasksSearchInput")?.addEventListener("input", function (event) {
      handleSearch(event.target.value);
    });

    /* ----------------------------------------------------
           PROJECT FILTER
        ---------------------------------------------------- */

    el("tasksProjectFilter")?.addEventListener("change", function (event) {
      state.projectId = event.target.value;

      state.page = 1;

      loadTasks();
    });

    /* ----------------------------------------------------
           STAFF FILTER
        ---------------------------------------------------- */

    el("tasksStaffFilter")?.addEventListener("change", function (event) {
      state.staffId = event.target.value;

      state.page = 1;

      loadTasks();
    });

    /* ----------------------------------------------------
           STATUS FILTER
        ---------------------------------------------------- */

    el("tasksStatusFilter")?.addEventListener("change", function (event) {
      state.status = event.target.value;

      state.page = 1;

      loadTasks();
    });

    /* ----------------------------------------------------
           RESET FILTERS
        ---------------------------------------------------- */

    el("tasksResetFiltersBtn")?.addEventListener("click", resetFilters);

    /* ----------------------------------------------------
           RETRY
        ---------------------------------------------------- */

    el("tasksRetryBtn")?.addEventListener("click", loadTasks);

    /* ----------------------------------------------------
           PREVIOUS PAGE
        ---------------------------------------------------- */

    el("tasksPrevPageBtn")?.addEventListener("click", function () {
      if (state.page <= 1) {
        return;
      }

      state.page--;

      loadTasks();
    });

    /* ----------------------------------------------------
           NEXT PAGE
        ---------------------------------------------------- */

    el("tasksNextPageBtn")?.addEventListener("click", function () {
      if (state.page >= state.totalPages) {
        return;
      }

      state.page++;

      loadTasks();
    });

    return true;
  }

  /* ========================================================
       GLOBAL EVENTS
    ======================================================== */

  function bindGlobalEvents() {
    if (state.globalBound) {
      return;
    }

    /*
     * Close action menu when
     * clicking outside.
     */

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".tasks-action-wrapper")) {
        closeActionMenus();
      }
    });

    /*
     * Escape key.
     */

    document.addEventListener("keydown", handleKeydown);

    /*
     * Resize.
     */

    window.addEventListener("resize", closeActionMenus);

    /*
     * Scroll.
     */

    window.addEventListener("scroll", closeActionMenus, true);

    state.globalBound = true;
  }

  /* ========================================================
       INITIALIZE MODULE
    ======================================================== */

  async function initTasksModule() {
    const page = el("tasksPage");

    if (!page) {
      return;
    }

    bindGlobalEvents();

    bindPageEvents();

    /*
     * Load projects and staff
     * for filters/forms.
     */

    await Promise.all([loadProjects(), loadStaff()]);

    /*
     * Load tasks.
     */

    await loadTasks();

    state.initialized = true;
  }

  /* ========================================================
       DESTROY MODULE
    ======================================================== */

  function destroyTasksModule() {
    if (state.abortController) {
      state.abortController.abort();

      state.abortController = null;
    }

    clearTimeout(state.searchTimer);

    clearTimeout(state.toastTimer);

    closeActionMenus();

    closeAllModals();

    document.body.classList.remove("tasks-modal-open");

    state.loading = false;

    state.saving = false;

    state.deleting = false;

    state.completing = false;

    state.currentTask = null;

    state.editingId = null;

    state.deletingId = null;

    state.completingId = null;

    state.initialized = false;

    /*
     * Router removes the page DOM.
     * Page listeners disappear with it.
     */

    state.pageElement = null;

    state.pageBound = false;
  }

  /* ========================================================
       PUBLIC MODULE API
    ======================================================== */

  window.TenspickTasks = {
    init: initTasksModule,

    destroy: destroyTasksModule,

    refresh: loadTasks,

    openAdd: openAddTaskModal,

    openView: openViewTaskModal,

    openEdit: openEditTaskModal,
  };

  /* ========================================================
       AUTO INIT
    ======================================================== */

  function autoInit() {
    if (el("tasksPage")) {
      initTasksModule();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, {
      once: true,
    });
  } else {
    autoInit();
  }
})();
