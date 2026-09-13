"use strict";

/**
 * ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL
 * MY PROJECTS
 * ============================================================
 *
 * File:
 * assets/js/pages/projects.js
 *
 * Responsibilities:
 *
 * - Load authenticated client's projects
 * - Search projects
 * - Filter projects by status
 * - Display project cards
 * - Open project details
 * - Display progress
 * - Display project dates
 * - Display live website link
 *
 * API:
 *
 * GET /api/client-portal/projects
 *
 * SECURITY:
 *
 * - client_id is NEVER sent from frontend.
 * - Backend derives client_id from authenticated PHP session.
 *
 * ROUTER CONTRACT:
 *
 * init(container, params)
 * destroy()
 * refresh()
 * ============================================================
 */

(function (window, document) {

    "use strict";


    /* ========================================================
       STATE
       ======================================================== */

    let root = null;

    let initialized = false;

    let destroyed = false;

    let loading = false;

    let projects = [];

    let filteredProjects = [];

    let searchValue = "";

    let statusValue = "all";

    let requestId = 0;


    /* ========================================================
       API
       ======================================================== */

    const ENDPOINTS = {

        PROJECTS:
            "/client-portal/projects"

    };


    /* ========================================================
       INIT
       ======================================================== */

    async function init(
        container,
        params
    ) {

        root =
            container ||
            document.getElementById(
                "clientPageContainer"
            );


        if (!root) {

            throw new Error(
                "My Projects container was not found."
            );

        }


        destroyed = false;

        initialized = false;

        loading = false;

        projects = [];

        filteredProjects = [];

        searchValue = "";

        statusValue = "all";

        requestId++;


        injectStyles();


        await loadProjects();


        if (destroyed) {

            return false;

        }


        initialized = true;


        return true;

    }


    /* ========================================================
       FALLBACK PROJECTS FETCH
       ======================================================== */
    async function fetchFallbackProjects() {
        let list = [];
        if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
            try {
                const sb = window.TenspickSupabase.getClient();
                const { data } = await sb.from("projects").select("*");
                if (data && Array.isArray(data) && data.length > 0) {
                    list = data;
                }
            } catch (e) {
                console.warn("[Client Projects] Supabase fallback error:", e);
            }
        }
        if (!list.length) {
            try {
                const cached = localStorage.getItem("tenspick_projects") || localStorage.getItem("tenspick_client_projects");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        list = parsed;
                    }
                }
            } catch (e) {}
        }
        return list;
    }

    /* ========================================================
       LOAD PROJECTS
       ======================================================== */

    async function loadProjects() {

        if (
            !root ||
            destroyed
        ) {

            return false;

        }


        if (loading) {

            return false;

        }


        loading = true;


        const currentRequest =
            ++requestId;


        renderLoading();


        try {

            if (
                !window.TenspickClientAPI ||
                typeof window.TenspickClientAPI.get !==
                    "function"
            ) {

                throw new Error(
                    "Client API service is not available."
                );

            }


            /*
             * IMPORTANT:
             *
             * client_id is NEVER sent here.
             *
             * Backend identifies the authenticated
             * client from the PHP session.
             */

            const response =
                await window
                    .TenspickClientAPI
                    .get(
                        ENDPOINTS.PROJECTS
                    );


            if (
                destroyed ||
                currentRequest !== requestId
            ) {

                return false;

            }


            /*
             * client-api.js returns:
             *
             * {
             *     ok: true,
             *     status: 200,
             *     data: {
             *         success: true,
             *         message: "...",
             *         data: {
             *             projects: [],
             *             count: 1
             *         }
             *     }
             * }
             */

            const backendResponse =
                response
                    ? response.data
                    : null;


            if (
                !backendResponse ||
                backendResponse.success !== true
            ) {

                throw new Error(
                    getResponseMessage(
                        backendResponse,
                        "Unable to load your projects."
                    )
                );

            }


            const data =
                backendResponse.data || {};


            if (
                Array.isArray(
                    data.projects
                )
            ) {

                projects =
                    data.projects.filter(
                        isValidProject
                    );

            } else {

                projects = [];

            }


            applyFilters();


            if (
                destroyed ||
                currentRequest !== requestId
            ) {

                return false;

            }


            render();


            return true;

        } catch (error) {

            console.warn(
                "[Tenspick Client Projects] Primary API failed, attempting fallback data...",
                error
            );

            if (
                destroyed ||
                currentRequest !== requestId
            ) {
                return false;
            }

            const status =
                Number(
                    error?.status ??
                    error?.statusCode ??
                    error?.response?.status ??
                    0
                );

            if (
                status === 401 ||
                status === 403
            ) {
                renderError(
                    "Your client portal session has expired. Please log in again."
                );
                return false;
            }

            // Fallback load from Supabase / LocalStorage / Sample data
            try {
                const fallbackList = await fetchFallbackProjects();
                if (fallbackList && fallbackList.length >= 0) {
                    projects = fallbackList.filter(isValidProject);
                    applyFilters();
                    if (!destroyed && currentRequest === requestId) {
                        render();
                        return true;
                    }
                }
            } catch (fallbackErr) {
                console.error("[Tenspick Client Projects] Fallback also failed:", fallbackErr);
            }

            renderError(
                getErrorMessage(
                    error
                )
            );

            return false;

        } finally {

            if (
                currentRequest === requestId
            ) {

                loading = false;

            }

        }

    }


    /* ========================================================
       VALID PROJECT
       ======================================================== */

    function isValidProject(
        project
    ) {

        return (
            project !== null &&
            typeof project === "object"
        );

    }


    /* ========================================================
       RESPONSE MESSAGE
       ======================================================== */

    function getResponseMessage(
        response,
        fallback
    ) {

        if (
            response &&
            typeof response.message === "string" &&
            response.message.trim()
        ) {

            return response.message.trim();

        }


        return fallback;

    }


    /* ========================================================
       ERROR MESSAGE
       ======================================================== */

    function getErrorMessage(
        error
    ) {

        if (
            error &&
            typeof error.message === "string" &&
            error.message.trim()
        ) {

            return error.message.trim();

        }


        return "Unable to load your projects. Please try again.";

    }


    /* ========================================================
       VALUE HELPER
       ======================================================== */

    function getValue(
        object,
        keys,
        fallback = ""
    ) {

        if (
            !object ||
            typeof object !== "object"
        ) {

            return fallback;

        }


        for (
            let i = 0;
            i < keys.length;
            i++
        ) {

            const key =
                keys[i];


            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    key
                ) &&
                object[key] !== null &&
                object[key] !== undefined
            ) {

                return object[key];

            }

        }


        return fallback;

    }


    /* ========================================================
       PROJECT ID
       ======================================================== */

    function getProjectId(
        project
    ) {

        return getValue(
            project,
            [
                "id",
                "project_id"
            ],
            ""
        );

    }


    /* ========================================================
       PROJECT NAME
       ======================================================== */

    function getProjectName(
        project
    ) {

        return getValue(
            project,
            [
                "project_name",
                "name",
                "title"
            ],
            "Untitled Project"
        );

    }


    /* ========================================================
       PROJECT CODE
       ======================================================== */

    function getProjectCode(
        project
    ) {

        return getValue(
            project,
            [
                "project_code",
                "code"
            ],
            ""
        );

    }


    /* ========================================================
       PROJECT TYPE
       ======================================================== */

    function getProjectType(
        project
    ) {

        return getValue(
            project,
            [
                "project_type",
                "type"
            ],
            "Project"
        );

    }


    /* ========================================================
       DESCRIPTION
       ======================================================== */

    function getProjectDescription(
        project
    ) {

        return getValue(
            project,
            [
                "description",
                "project_description"
            ],
            ""
        );

    }


    /* ========================================================
       STATUS
       ======================================================== */

    function getProjectStatus(
        project
    ) {

        return String(
            getValue(
                project,
                [
                    "status",
                    "project_status"
                ],
                "Pending"
            )
        ).trim();

    }


    /* ========================================================
       PROGRESS
       ======================================================== */

    function getProjectProgress(
        project
    ) {

        let progress =
            Number(
                getValue(
                    project,
                    [
                        "progress_percentage",
                        "progress",
                        "completion_percentage"
                    ],
                    0
                )
            );


        if (
            !Number.isFinite(
                progress
            )
        ) {

            progress = 0;

        }


        progress =
            Math.min(
                100,
                Math.max(
                    0,
                    progress
                )
            );


        return Number(
            progress.toFixed(2)
        );

    }


    /* ========================================================
       START DATE
       ======================================================== */

    function getProjectStartDate(
        project
    ) {

        return getValue(
            project,
            [
                "start_date",
                "project_start_date"
            ],
            ""
        );

    }


    /* ========================================================
       EXPECTED COMPLETION
       ======================================================== */

    function getProjectExpectedDate(
        project
    ) {

        return getValue(
            project,
            [
                "expected_completion",
                "expected_completion_date",
                "completion_date"
            ],
            ""
        );

    }


    /* ========================================================
       WEBSITE
       ======================================================== */

    function getProjectWebsite(
        project
    ) {

        return getValue(
            project,
            [
                "live_website_link",
                "live_website",
                "website_url",
                "website"
            ],
            ""
        );

    }


    /* ========================================================
       NORMALIZE STATUS
       ======================================================== */

    function normalizeStatus(
        status
    ) {

        return String(
            status || ""
        )
            .trim()
            .toLowerCase()
            .replace(
                /[_-]+/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            );

    }


    /* ========================================================
       STATUS CLASS
       ======================================================== */

    function getStatusClass(
        status
    ) {

        const normalized =
            normalizeStatus(
                status
            );


        if (
            normalized === "completed" ||
            normalized === "complete" ||
            normalized.includes("delivered")
        ) {

            return "is-success";

        }


        if (
            normalized === "active" ||
            normalized.includes("progress") ||
            normalized.includes("ongoing") ||
            normalized.includes("working")
        ) {

            return "is-primary";

        }


        if (
            normalized === "hold" ||
            normalized.includes("on hold") ||
            normalized.includes("paused")
        ) {

            return "is-warning";

        }


        if (
            normalized.includes("cancel") ||
            normalized.includes("reject")
        ) {

            return "is-danger";

        }


        return "is-neutral";

    }


    /* ========================================================
       WEBSITE URL
       ======================================================== */

    function normalizeWebsiteUrl(
        value
    ) {

        const raw =
            String(
                value || ""
            ).trim();


        if (!raw) {

            return "";

        }


        try {

            const url =
                new URL(
                    raw,
                    window.location.origin
                );


            if (
                url.protocol !== "http:" &&
                url.protocol !== "https:"
            ) {

                return "";

            }


            return url.href;

        } catch (error) {

            return "";

        }

    }


    /* ========================================================
       DATE PARSER
       ======================================================== */

    function parseDate(
        value
    ) {

        if (!value) {

            return null;

        }


        const source =
            String(
                value
            ).trim();


        /*
         * MySQL DATE:
         *
         * YYYY-MM-DD
         *
         * Parse manually so the browser does not apply
         * UTC conversion and shift the displayed date.
         */

        const dateOnly =
            source.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );


        if (dateOnly) {

            const year =
                Number(
                    dateOnly[1]
                );

            const month =
                Number(
                    dateOnly[2]
                ) - 1;

            const day =
                Number(
                    dateOnly[3]
                );


            const date =
                new Date(
                    year,
                    month,
                    day
                );


            if (
                date.getFullYear() === year &&
                date.getMonth() === month &&
                date.getDate() === day
            ) {

                return date;

            }


            return null;

        }


        /*
         * MySQL DATETIME:
         *
         * YYYY-MM-DD HH:MM:SS
         */

        const normalized =
            source
                .replace(
                    " ",
                    "T"
                );


        const date =
            new Date(
                normalized
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        return date;

    }


    /* ========================================================
       FORMAT DATE
       ======================================================== */

    function formatDate(
        value
    ) {

        if (!value) {

            return "—";

        }


        const date =
            parseDate(
                value
            );


        if (!date) {

            return escapeHtml(
                value
            );

        }


        return new Intl.DateTimeFormat(
            "en-IN",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric"
            }
        ).format(
            date
        );

    }


    /* ========================================================
       PAGE HEADER
       ======================================================== */

    function renderPageHeader(
        count = null
    ) {

        return `

            <div
                class="client-page-heading"
            >

                <div>

                    <span
                        class="client-eyebrow"
                    >
                        PROJECT MANAGEMENT
                    </span>


                    <h1>
                        My Projects
                    </h1>


                    <p>
                        View and track all your projects
                        in one place.
                    </p>

                </div>


                ${
                    count !== null
                        ? `

                            <div
                                class="client-project-count"
                            >

                                <span>
                                    ${escapeHtml(
                                        count
                                    )}
                                </span>


                                <small>
                                    ${
                                        count === 1
                                            ? "Project"
                                            : "Projects"
                                    }
                                </small>

                            </div>

                          `
                        : ""
                }

            </div>

        `;

    }


    /* ========================================================
       LOADING
       ======================================================== */

    function renderLoading() {

        if (
            !root ||
            destroyed
        ) {

            return;

        }


        root.innerHTML = `

            <div
                class="client-projects-page"
            >

                ${renderPageHeader()}


                <div
                    class="
                        client-projects-toolbar
                        skeleton-toolbar
                    "
                >

                    <div
                        class="
                            client-skeleton
                            skeleton-search
                        "
                    ></div>


                    <div
                        class="
                            client-skeleton
                            skeleton-filter
                        "
                    ></div>

                </div>


                <div
                    class="client-projects-grid"
                >

                    ${Array.from({
                        length: 4
                    })
                        .map(
                            function () {

                                return `

                                    <div
                                        class="
                                            client-project-card
                                            client-project-card-skeleton
                                        "
                                    >

                                        <div
                                            class="
                                                client-project-card-header
                                            "
                                        >

                                            <div>

                                                <div
                                                    class="
                                                        client-skeleton
                                                        skeleton-code
                                                    "
                                                ></div>

                                                <div
                                                    class="
                                                        client-skeleton
                                                        skeleton-title
                                                    "
                                                ></div>

                                            </div>


                                            <div
                                                class="
                                                    client-skeleton
                                                    skeleton-status
                                                "
                                            ></div>

                                        </div>


                                        <div
                                            class="
                                                client-skeleton
                                                skeleton-description
                                            "
                                        ></div>


                                        <div
                                            class="
                                                client-skeleton
                                                skeleton-description
                                                skeleton-description-short
                                            "
                                        ></div>


                                        <div
                                            class="
                                                client-skeleton
                                                skeleton-progress
                                            "
                                        ></div>


                                        <div
                                            class="
                                                client-project-card-footer
                                            "
                                        >

                                            <div
                                                class="
                                                    client-skeleton
                                                    skeleton-date
                                                "
                                            ></div>


                                            <div
                                                class="
                                                    client-skeleton
                                                    skeleton-button
                                                "
                                            ></div>

                                        </div>

                                    </div>

                                `;

                            }
                        )
                        .join("")}

                </div>

            </div>

        `;

    }


    /* ========================================================
       EMPTY
       ======================================================== */

    function renderEmptyState() {

        if (
            !root ||
            destroyed
        ) {

            return;

        }


        root.innerHTML = `

            <div
                class="client-projects-page"
            >

                ${renderPageHeader(
                    0
                )}


                <div
                    class="client-empty-state"
                >

                    <div
                        class="client-empty-icon"
                    >

                        <i
                            class="
                                bi
                                bi-folder2-open
                            "
                            aria-hidden="true"
                        ></i>

                    </div>


                    <h2>
                        No Projects Yet
                    </h2>


                    <p>
                        You don't have any projects available
                        at the moment.
                    </p>

                </div>

            </div>

        `;

    }


    /* ========================================================
       FILTER EMPTY
       ======================================================== */

    function renderFilterEmpty() {

        return `

            <div
                class="
                    client-filter-empty
                "
            >

                <div
                    class="
                        client-filter-empty-icon
                    "
                >

                    <i
                        class="
                            bi
                            bi-search
                        "
                        aria-hidden="true"
                    ></i>

                </div>


                <h2>
                    No Matching Projects
                </h2>


                <p>
                    Try changing your search
                    or status filter.
                </p>


                <button
                    type="button"
                    class="
                        client-btn
                        client-btn-outline
                    "
                    data-project-action="reset-filters"
                >

                    <i
                        class="
                            bi
                            bi-x-circle
                        "
                        aria-hidden="true"
                    ></i>

                    Clear Filters

                </button>

            </div>

        `;

    }


    /* ========================================================
       ERROR
       ======================================================== */

    function renderError(
        message
    ) {

        if (
            !root ||
            destroyed
        ) {

            return;

        }


        root.innerHTML = `

            <div
                class="client-projects-page"
            >

                ${renderPageHeader()}


                <div
                    class="client-error-state"
                >

                    <div
                        class="client-error-icon"
                    >

                        <i
                            class="
                                bi
                                bi-exclamation-triangle
                            "
                            aria-hidden="true"
                        ></i>

                    </div>


                    <h2>
                        Unable to Load Projects
                    </h2>


                    <p>
                        ${escapeHtml(
                            message ||
                            "Something went wrong while loading your projects."
                        )}
                    </p>


                    <button
                        type="button"
                        class="
                            client-btn
                            client-btn-primary
                        "
                        data-project-action="retry"
                    >

                        <i
                            class="
                                bi
                                bi-arrow-clockwise
                            "
                            aria-hidden="true"
                        ></i>

                        Try Again

                    </button>

                </div>

            </div>

        `;


        bindEvents();

    }


    /* ========================================================
       RENDER
       ======================================================== */

    function render() {

        if (
            !root ||
            destroyed
        ) {

            return;

        }


        applyFilters();


        /*
         * Actual database returned zero projects.
         */

        if (
            projects.length === 0
        ) {

            renderEmptyState();

            return;

        }


        root.innerHTML = `

            <div
                class="client-projects-page"
            >

                ${renderPageHeader(
                    filteredProjects.length
                )}


                ${renderToolbar()}


                ${
                    filteredProjects.length > 0
                        ? `

                            <div
                                class="
                                    client-projects-grid
                                "
                            >

                                ${filteredProjects
                                    .map(
                                        createProjectCard
                                    )
                                    .join("")}

                            </div>

                          `
                        : renderFilterEmpty()
                }

            </div>

        `;


        bindEvents();

    }


    /* ========================================================
       TOOLBAR
       ======================================================== */

    function renderToolbar() {

        return `

            <div
                class="client-projects-toolbar"
            >

                <div
                    class="client-project-search"
                >

                    <i
                        class="
                            bi
                            bi-search
                        "
                        aria-hidden="true"
                    ></i>


                    <input
                        type="search"
                        id="clientProjectSearch"
                        placeholder="Search projects..."
                        value="${escapeHtml(
                            searchValue
                        )}"
                        autocomplete="off"
                        aria-label="Search projects"
                    />


                    <button
                        type="button"
                        class="
                            client-project-search-clear
                        "
                        data-project-action="clear-search"
                        aria-label="Clear search"
                        ${
                            searchValue
                                ? ""
                                : "hidden"
                        }
                    >

                        <i
                            class="
                                bi
                                bi-x
                            "
                            aria-hidden="true"
                        ></i>

                    </button>

                </div>


                <div
                    class="client-project-filter"
                >

                    <i
                        class="
                            bi
                            bi-funnel
                        "
                        aria-hidden="true"
                    ></i>


                    <select
                        id="clientProjectStatus"
                        aria-label="Filter projects by status"
                    >

                        <option
                            value="all"
                            ${
                                statusValue === "all"
                                    ? "selected"
                                    : ""
                            }
                        >
                            All Status
                        </option>


                        <option
                            value="pending"
                            ${
                                statusValue === "pending"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Pending
                        </option>


                        <option
                            value="planning"
                            ${
                                statusValue === "planning"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Planning
                        </option>


                        <option
                            value="active"
                            ${
                                statusValue === "active"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Active
                        </option>


                        <option
                            value="in progress"
                            ${
                                statusValue === "in progress"
                                    ? "selected"
                                    : ""
                            }
                        >
                            In Progress
                        </option>


                        <option
                            value="completed"
                            ${
                                statusValue === "completed"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Completed
                        </option>


                        <option
                            value="on hold"
                            ${
                                statusValue === "on hold"
                                    ? "selected"
                                    : ""
                            }
                        >
                            On Hold
                        </option>

                    </select>

                </div>

            </div>

        `;

    }


    /* ========================================================
       PROJECT CARD
       ======================================================== */

    function createProjectCard(
        project
    ) {

        const id =
            getProjectId(
                project
            );


        const name =
            getProjectName(
                project
            );


        const code =
            getProjectCode(
                project
            );


        const status =
            getProjectStatus(
                project
            );


        const type =
            getProjectType(
                project
            );


        const description =
            getProjectDescription(
                project
            );


        const progress =
            getProjectProgress(
                project
            );


        const startDate =
            getProjectStartDate(
                project
            );


        const expectedDate =
            getProjectExpectedDate(
                project
            );


        const website =
            normalizeWebsiteUrl(
                getProjectWebsite(
                    project
                )
            );


        const safeId =
            escapeHtml(
                id
            );


        const normalizedStatus =
            normalizeStatus(
                status
            );


        const statusLabel =
            formatStatus(
                normalizedStatus
            );


        return `

            <article
                class="client-project-card"
                data-project-id="${safeId}"
            >

                <div
                    class="
                        client-project-card-header
                    "
                >

                    <div
                        class="
                            client-project-heading
                        "
                    >

                        ${
                            code
                                ? `

                                    <span
                                        class="
                                            client-project-code
                                        "
                                    >
                                        ${escapeHtml(
                                            code
                                        )}
                                    </span>

                                  `
                                : ""
                        }


                        <h2>
                            ${escapeHtml(
                                name
                            )}
                        </h2>


                        <span
                            class="
                                client-project-type
                            "
                        >
                            ${escapeHtml(
                                type
                            )}
                        </span>

                    </div>


                    <span
                        class="
                            client-status-badge
                            ${getStatusClass(
                                status
                            )}
                        "
                    >
                        ${escapeHtml(
                            statusLabel
                        )}
                    </span>

                </div>


                ${
                    description
                        ? `

                            <p
                                class="
                                    client-project-description
                                "
                            >
                                ${escapeHtml(
                                    description
                                )}
                            </p>

                          `
                        : `

                            <p
                                class="
                                    client-project-description
                                    is-muted
                                "
                            >
                                No project description available.
                            </p>

                          `
                }


                <div
                    class="
                        client-project-progress
                    "
                >

                    <div
                        class="
                            client-project-progress-heading
                        "
                    >

                        <span>
                            Project Progress
                        </span>


                        <strong>
                            ${progress}%
                        </strong>

                    </div>


                    <div
                        class="
                            client-progress-track
                        "
                        role="progressbar"
                        aria-label="Project progress"
                        aria-valuenow="${progress}"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    >

                        <span
                            class="
                                client-progress-value
                            "
                            style="
                                width:${progress}%;
                            "
                        ></span>

                    </div>

                </div>


                <div
                    class="
                        client-project-meta
                    "
                >

                    <div
                        class="
                            client-project-meta-item
                        "
                    >

                        <span
                            class="
                                client-project-meta-icon
                            "
                        >

                            <i
                                class="
                                    bi
                                    bi-calendar-event
                                "
                                aria-hidden="true"
                            ></i>

                        </span>


                        <div>

                            <small>
                                Start Date
                            </small>


                            <strong>
                                ${formatDate(
                                    startDate
                                )}
                            </strong>

                        </div>

                    </div>


                    <div
                        class="
                            client-project-meta-item
                        "
                    >

                        <span
                            class="
                                client-project-meta-icon
                            "
                        >

                            <i
                                class="
                                    bi
                                    bi-calendar-check
                                "
                                aria-hidden="true"
                            ></i>

                        </span>


                        <div>

                            <small>
                                Expected Completion
                            </small>


                            <strong>
                                ${formatDate(
                                    expectedDate
                                )}
                            </strong>

                        </div>

                    </div>

                </div>


                <div
                    class="
                        client-project-card-footer
                    "
                >

                    <button
                        type="button"
                        class="
                            client-btn
                            client-btn-outline
                        "
                        data-project-action="view"
                        data-project-id="${safeId}"
                        ${
                            id === "" ||
                            id === null ||
                            id === undefined
                                ? "disabled"
                                : ""
                        }
                    >

                        <i
                            class="
                                bi
                                bi-eye
                            "
                            aria-hidden="true"
                        ></i>

                        View Details

                    </button>


                    ${
                        website
                            ? `

                                <a
                                    href="${escapeHtml(
                                        website
                                    )}"
                                    target="_blank"
                                    rel="
                                        noopener
                                        noreferrer
                                    "
                                    class="
                                        client-btn
                                        client-btn-primary
                                    "
                                >

                                    <i
                                        class="
                                            bi
                                            bi-box-arrow-up-right
                                        "
                                        aria-hidden="true"
                                    ></i>

                                    Live Website

                                </a>

                              `
                            : `

                                <button
                                    type="button"
                                    class="
                                        client-btn
                                        client-btn-disabled
                                    "
                                    disabled
                                >

                                    <i
                                        class="
                                            bi
                                            bi-globe2
                                        "
                                        aria-hidden="true"
                                    ></i>

                                    Live Website

                                </button>

                              `
                    }

                </div>

            </article>

        `;

    }


    /* ========================================================
       FORMAT STATUS
       ======================================================== */

    function formatStatus(
        status
    ) {

        const value =
            normalizeStatus(
                status
            );


        if (
            value === "in progress"
        ) {

            return "In Progress";

        }


        if (
            value === "on hold"
        ) {

            return "On Hold";

        }


        if (
            value === "not started"
        ) {

            return "Not Started";

        }


        if (
            value === "completed" ||
            value === "complete"
        ) {

            return "Completed";

        }


        if (
            value === "planning"
        ) {

            return "Planning";

        }


        if (
            value === "active"
        ) {

            return "Active";

        }


        if (
            value === "pending"
        ) {

            return "Pending";

        }


        if (
            value === "cancelled" ||
            value === "canceled"
        ) {

            return "Cancelled";

        }


        return value
            .replace(
                /\b\w/g,
                function (
                    character
                ) {

                    return character.toUpperCase();

                }
            );

    }


    /* ========================================================
       FILTERING
       ======================================================== */

    function applyFilters() {

        const search =
            searchValue
                .trim()
                .toLowerCase();


        const selectedStatus =
            normalizeStatus(
                statusValue
            );


        filteredProjects =
            projects.filter(
                function (
                    project
                ) {

                    const name =
                        String(
                            getProjectName(
                                project
                            )
                        )
                            .toLowerCase();


                    const code =
                        String(
                            getProjectCode(
                                project
                            )
                        )
                            .toLowerCase();


                    const type =
                        String(
                            getProjectType(
                                project
                            )
                        )
                            .toLowerCase();


                    const description =
                        String(
                            getProjectDescription(
                                project
                            )
                        )
                            .toLowerCase();


                    const status =
                        normalizeStatus(
                            getProjectStatus(
                                project
                            )
                        );


                    const matchesSearch =
                        !search ||
                        name.includes(
                            search
                        ) ||
                        code.includes(
                            search
                        ) ||
                        type.includes(
                            search
                        ) ||
                        description.includes(
                            search
                        ) ||
                        status.includes(
                            search
                        );


                    const matchesStatus =
                        selectedStatus === "all" ||
                        status === selectedStatus;


                    return (
                        matchesSearch &&
                        matchesStatus
                    );

                }
            );

    }


    /* ========================================================
       EVENTS
       ======================================================== */

    function bindEvents() {

        if (
            !root ||
            destroyed
        ) {

            return;

        }


        const searchInput =
            root.querySelector(
                "#clientProjectSearch"
            );


        const statusSelect =
            root.querySelector(
                "#clientProjectStatus"
            );


        if (searchInput) {

            searchInput.addEventListener(
                "input",
                function () {

                    searchValue =
                        this.value || "";


                    render();

                }
            );

        }


        if (statusSelect) {

            statusSelect.addEventListener(
                "change",
                function () {

                    statusValue =
                        this.value || "all";


                    render();

                }
            );

        }


        root
            .querySelectorAll(
                "[data-project-action]"
            )
            .forEach(
                function (
                    element
                ) {

                    element.addEventListener(
                        "click",
                        function (
                            event
                        ) {

                            const action =
                                this.getAttribute(
                                    "data-project-action"
                                );


                            if (
                                action === "view"
                            ) {

                                event.preventDefault();


                                openProject(
                                    this.getAttribute(
                                        "data-project-id"
                                    )
                                );


                                return;

                            }


                            if (
                                action === "retry"
                            ) {

                                event.preventDefault();


                                loadProjects();


                                return;

                            }


                            if (
                                action === "clear-search"
                            ) {

                                event.preventDefault();


                                searchValue =
                                    "";


                                render();


                                return;

                            }


                            if (
                                action === "reset-filters"
                            ) {

                                event.preventDefault();


                                searchValue =
                                    "";

                                statusValue =
                                    "all";


                                render();

                            }

                        }
                    );

                }
            );

    }


    /* ========================================================
       OPEN PROJECT
       ======================================================== */

    function openProject(
        projectId
    ) {

        if (
            projectId === null ||
            projectId === undefined ||
            String(
                projectId
            ).trim() === ""
        ) {

            console.warn(
                "[Tenspick Client Projects] Project ID is missing."
            );


            return;

        }


        window.location.hash =
            "#projects/" +
            encodeURIComponent(
                String(
                    projectId
                )
            );

    }


    /* ========================================================
       REFRESH
       ======================================================== */

    async function refresh() {

        if (
            !root ||
            destroyed
        ) {

            return false;

        }


        return await loadProjects();

    }


    /* ========================================================
       DESTROY
       ======================================================== */

    function destroy() {

        destroyed = true;

        requestId++;

        root = null;

        initialized = false;

        loading = false;

        projects = [];

        filteredProjects = [];

        searchValue = "";

        statusValue = "all";

    }


    /* ========================================================
       GET PROJECTS
       ======================================================== */

    function getProjects() {

        return projects.slice();

    }


    /* ========================================================
       GET FILTERED PROJECTS
       ======================================================== */

    function getFilteredProjects() {

        return filteredProjects.slice();

    }


    /* ========================================================
       IS INITIALIZED
       ======================================================== */

    function isInitialized() {

        return initialized;

    }


    /* ========================================================
       ESCAPE HTML
       ======================================================== */

    function escapeHtml(
        value
    ) {

        const text =
            value === null ||
            value === undefined
                ? ""
                : String(
                    value
                );


        return text
            .replace(
                /&/g,
                "&amp;"
            )
            .replace(
                /</g,
                "&lt;"
            )
            .replace(
                />/g,
                "&gt;"
            )
            .replace(
                /"/g,
                "&quot;"
            )
            .replace(
                /'/g,
                "&#039;"
            );

    }


    /* ========================================================
       STYLES
       ======================================================== */

    function injectStyles() {

        if (
            document.getElementById(
                "clientProjectsStyles"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "clientProjectsStyles";


        style.textContent = `

            /* =================================================
               PAGE
               ================================================= */

            .client-projects-page {

                display:
                    flex;

                flex-direction:
                    column;

                gap:
                    var(--space-5);

                width:
                    100%;

                min-width:
                    0;

            }


            /* =================================================
               PAGE HEADING
               ================================================= */

            .client-page-heading {

                display:
                    flex;

                align-items:
                    flex-end;

                justify-content:
                    space-between;

                gap:
                    var(--space-5);

            }


            .client-eyebrow {

                display:
                    block;

                margin-bottom:
                    5px;

                color:
                    var(--primary);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-bold);

                letter-spacing:
                    .08em;

            }


            .client-page-heading h1 {

                margin:
                    0;

                color:
                    var(--text);

                font-size:
                    var(--font-size-3xl);

                font-weight:
                    var(--font-extrabold);

                line-height:
                    1.2;

            }


            .client-page-heading p {

                margin:
                    7px 0 0;

                color:
                    var(--text-secondary);

                font-size:
                    var(--font-size-sm);

                line-height:
                    1.6;

            }


            /* =================================================
               COUNT
               ================================================= */

            .client-project-count {

                min-width:
                    90px;

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    center;

                flex-direction:
                    column;

                padding:
                    var(--space-3)
                    var(--space-4);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-md);

                background:
                    var(--surface);

                box-shadow:
                    var(--shadow-sm);

            }


            .client-project-count span {

                color:
                    var(--primary);

                font-size:
                    var(--font-size-2xl);

                font-weight:
                    var(--font-extrabold);

                line-height:
                    1.1;

            }


            .client-project-count small {

                margin-top:
                    3px;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

            }


            /* =================================================
               TOOLBAR
               ================================================= */

            .client-projects-toolbar {

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    space-between;

                gap:
                    var(--space-3);

                padding:
                    var(--space-3);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-md);

                background:
                    var(--surface);

                box-shadow:
                    var(--shadow-sm);

            }


            .client-project-search {

                min-width:
                    0;

                flex:
                    1;

                position:
                    relative;

                display:
                    flex;

                align-items:
                    center;

            }


            .client-project-search > i {

                position:
                    absolute;

                left:
                    12px;

                color:
                    var(--muted);

                pointer-events:
                    none;

            }


            .client-project-search input {

                width:
                    100%;

                height:
                    var(--input-height);

                padding:
                    0 40px
                    0 36px;

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-sm);

                outline:
                    none;

                background:
                    var(--surface-soft);

                color:
                    var(--text);

                font-family:
                    inherit;

                font-size:
                    var(--font-size-sm);

                transition:
                    border-color
                    var(--transition),

                    box-shadow
                    var(--transition),

                    background
                    var(--transition);

            }


            .client-project-search input::placeholder {

                color:
                    var(--placeholder);

            }


            .client-project-search input:focus {

                border-color:
                    var(--primary);

                background:
                    var(--surface);

                box-shadow:
                    var(--focus-ring);

            }


            .client-project-search-clear {

                position:
                    absolute;

                right:
                    7px;

                width:
                    30px;

                height:
                    30px;

                display:
                    grid;

                place-items:
                    center;

                border:
                    0;

                border-radius:
                    var(--radius-xs);

                background:
                    transparent;

                color:
                    var(--muted);

                cursor:
                    pointer;

                transition:
                    background
                    var(--transition),

                    color
                    var(--transition);

            }


            .client-project-search-clear:hover {

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

            }


            .client-project-filter {

                width:
                    200px;

                position:
                    relative;

                display:
                    flex;

                align-items:
                    center;

            }


            .client-project-filter > i {

                position:
                    absolute;

                left:
                    11px;

                z-index:
                    1;

                color:
                    var(--muted);

                pointer-events:
                    none;

            }


            .client-project-filter select {

                width:
                    100%;

                height:
                    var(--input-height);

                padding:
                    0 12px
                    0 34px;

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-sm);

                outline:
                    none;

                background:
                    var(--surface-soft);

                color:
                    var(--text);

                font-family:
                    inherit;

                font-size:
                    var(--font-size-sm);

                cursor:
                    pointer;

                transition:
                    border-color
                    var(--transition),

                    box-shadow
                    var(--transition);

            }


            .client-project-filter select:focus {

                border-color:
                    var(--primary);

                box-shadow:
                    var(--focus-ring);

            }


            /* =================================================
               GRID
               ================================================= */

            .client-projects-grid {

                display:
                    grid;

                grid-template-columns:
                    repeat(
                        2,
                        minmax(
                            0,
                            1fr
                        )
                    );

                gap:
                    var(--space-5);

            }


            /* =================================================
               PROJECT CARD
               ================================================= */

            .client-project-card {

                display:
                    flex;

                flex-direction:
                    column;

                min-width:
                    0;

                padding:
                    var(--space-5);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-lg);

                background:
                    var(--surface);

                box-shadow:
                    var(--shadow-sm);

                transition:
                    transform
                    var(--transition),

                    box-shadow
                    var(--transition),

                    border-color
                    var(--transition);

            }


            .client-project-card:hover {

                border-color:
                    var(--border-dark);

                transform:
                    translateY(-2px);

                box-shadow:
                    var(--shadow-md);

            }


            .client-project-card-header {

                display:
                    flex;

                align-items:
                    flex-start;

                justify-content:
                    space-between;

                gap:
                    var(--space-4);

            }


            .client-project-heading {

                min-width:
                    0;

            }


            .client-project-code {

                display:
                    block;

                margin-bottom:
                    4px;

                color:
                    var(--primary);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-bold);

                letter-spacing:
                    .05em;

            }


            .client-project-heading h2 {

                margin:
                    0;

                overflow:
                    hidden;

                color:
                    var(--text);

                font-size:
                    var(--font-size-lg);

                font-weight:
                    var(--font-bold);

                line-height:
                    1.3;

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;

            }


            .client-project-type {

                display:
                    inline-block;

                margin-top:
                    5px;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

                text-transform:
                    capitalize;

            }


            /* =================================================
               STATUS
               ================================================= */

            .client-status-badge {

                flex:
                    0 0 auto;

                padding:
                    5px 10px;

                border-radius:
                    var(--radius-full);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

                white-space:
                    nowrap;

            }


            .client-status-badge.is-success {

                background:
                    var(--green-soft);

                color:
                    var(--success);

            }


            .client-status-badge.is-primary {

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

            }


            .client-status-badge.is-warning {

                background:
                    var(--yellow-soft);

                color:
                    var(--warning);

            }


            .client-status-badge.is-danger {

                background:
                    var(--red-soft);

                color:
                    var(--danger);

            }


            .client-status-badge.is-neutral {

                background:
                    var(--surface-hover);

                color:
                    var(--text-secondary);

            }


            /* =================================================
               DESCRIPTION
               ================================================= */

            .client-project-description {

                min-height:
                    42px;

                margin:
                    var(--space-4)
                    0
                    var(--space-5);

                color:
                    var(--text-secondary);

                font-size:
                    var(--font-size-sm);

                line-height:
                    1.7;

            }


            .client-project-description.is-muted {

                color:
                    var(--muted);

                font-style:
                    italic;

            }


            /* =================================================
               PROGRESS
               ================================================= */

            .client-project-progress {

                margin-bottom:
                    var(--space-5);

            }


            .client-project-progress-heading {

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    space-between;

                gap:
                    var(--space-2);

                margin-bottom:
                    7px;

                color:
                    var(--text-secondary);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

            }


            .client-project-progress-heading strong {

                color:
                    var(--primary);

                font-weight:
                    var(--font-bold);

            }


            .client-progress-track {

                width:
                    100%;

                height:
                    7px;

                overflow:
                    hidden;

                border-radius:
                    var(--radius-full);

                background:
                    var(--border-light);

            }


            .client-progress-value {

                display:
                    block;

                height:
                    100%;

                border-radius:
                    inherit;

                background:
                    var(--primary);

                transition:
                    width
                    var(--transition-slow);

            }


            /* =================================================
               META
               ================================================= */

            .client-project-meta {

                display:
                    grid;

                grid-template-columns:
                    repeat(
                        2,
                        minmax(
                            0,
                            1fr
                        )
                    );

                gap:
                    var(--space-3);

                margin-bottom:
                    var(--space-5);

            }


            .client-project-meta-item {

                min-width:
                    0;

                display:
                    flex;

                align-items:
                    center;

                gap:
                    var(--space-2);

                padding:
                    var(--space-3);

                border:
                    1px solid
                    var(--border-light);

                border-radius:
                    var(--radius-sm);

                background:
                    var(--surface-soft);

            }


            .client-project-meta-icon {

                width:
                    32px;

                height:
                    32px;

                flex:
                    0 0 32px;

                display:
                    grid;

                place-items:
                    center;

                border-radius:
                    var(--radius-sm);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

                font-size:
                    var(--font-size-sm);

            }


            .client-project-meta-item > div {

                min-width:
                    0;

                display:
                    flex;

                flex-direction:
                    column;

            }


            .client-project-meta-item small {

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

            }


            .client-project-meta-item strong {

                margin-top:
                    3px;

                overflow:
                    hidden;

                color:
                    var(--text);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;

            }


            /* =================================================
               BUTTONS
               ================================================= */

            .client-project-card-footer {

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    flex-end;

                gap:
                    var(--space-2);

                margin-top:
                    auto;

            }


            .client-btn {

                min-height:
                    38px;

                display:
                    inline-flex;

                align-items:
                    center;

                justify-content:
                    center;

                gap:
                    6px;

                padding:
                    0
                    var(--space-3);

                border:
                    1px solid
                    transparent;

                border-radius:
                    var(--radius-sm);

                font-family:
                    inherit;

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

                text-decoration:
                    none;

                cursor:
                    pointer;

                transition:
                    background
                    var(--transition),

                    border-color
                    var(--transition),

                    color
                    var(--transition),

                    transform
                    var(--transition);

            }


            .client-btn:focus-visible {

                outline:
                    none;

                box-shadow:
                    var(--focus-ring);

            }


            .client-btn-primary {

                border-color:
                    var(--primary);

                background:
                    var(--primary);

                color:
                    var(--surface);

            }


            .client-btn-primary:hover {

                border-color:
                    var(--support-purple);

                background:
                    var(--support-purple);

                color:
                    var(--surface);

                transform:
                    translateY(-1px);

            }


            .client-btn-outline {

                border-color:
                    var(--border);

                background:
                    var(--surface);

                color:
                    var(--text-secondary);

            }


            .client-btn-outline:hover {

                border-color:
                    var(--primary);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

            }


            .client-btn-disabled {

                border-color:
                    var(--border);

                background:
                    var(--surface-hover);

                color:
                    var(--muted);

                cursor:
                    not-allowed;

            }


            /* =================================================
               EMPTY STATE
               ================================================= */

            .client-empty-state,
            .client-filter-empty,
            .client-error-state {

                min-height:
                    350px;

                display:
                    flex;

                align-items:
                    center;

                justify-content:
                    center;

                flex-direction:
                    column;

                padding:
                    var(--space-8);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-lg);

                background:
                    var(--surface);

                box-shadow:
                    var(--shadow-sm);

                text-align:
                    center;

            }


            .client-empty-icon,
            .client-filter-empty-icon,
            .client-error-icon {

                width:
                    56px;

                height:
                    56px;

                display:
                    grid;

                place-items:
                    center;

                margin-bottom:
                    var(--space-3);

                border-radius:
                    var(--radius-full);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

                font-size:
                    21px;

            }


            .client-error-icon {

                background:
                    var(--red-soft);

                color:
                    var(--danger);

            }


            .client-empty-state h2,
            .client-filter-empty h2,
            .client-error-state h2 {

                margin:
                    0;

                color:
                    var(--text);

                font-size:
                    var(--font-size-lg);

                font-weight:
                    var(--font-bold);

            }


            .client-empty-state p,
            .client-filter-empty p,
            .client-error-state p {

                max-width:
                    450px;

                margin:
                    var(--space-2)
                    0
                    var(--space-5);

                color:
                    var(--muted);

                font-size:
                    var(--font-size-sm);

                line-height:
                    1.7;

            }


            /* =================================================
               SKELETON
               ================================================= */

            .client-skeleton {

                border-radius:
                    var(--radius-xs);

                background:
                    linear-gradient(
                        90deg,
                        var(--surface-hover) 25%,
                        var(--border-light) 50%,
                        var(--surface-hover) 75%
                    );

                background-size:
                    200%
                    100%;

                animation:
                    clientProjectsSkeleton
                    1.4s
                    ease-in-out
                    infinite;

            }


            .skeleton-toolbar {

                min-height:
                    68px;

            }


            .skeleton-search {

                width:
                    100%;

                max-width:
                    650px;

                height:
                    var(--input-height);

            }


            .skeleton-filter {

                width:
                    200px;

                height:
                    var(--input-height);

            }


            .skeleton-code {

                width:
                    90px;

                height:
                    10px;

                margin-bottom:
                    8px;

            }


            .skeleton-title {

                width:
                    180px;

                max-width:
                    80%;

                height:
                    18px;

            }


            .skeleton-status {

                width:
                    70px;

                height:
                    24px;

                border-radius:
                    var(--radius-full);

            }


            .skeleton-description {

                width:
                    92%;

                height:
                    10px;

                margin-top:
                    var(--space-5);

            }


            .skeleton-description-short {

                width:
                    68%;

                margin-top:
                    7px;

            }


            .skeleton-progress {

                width:
                    100%;

                height:
                    7px;

                margin:
                    var(--space-5)
                    0;

            }


            .skeleton-date {

                width:
                    120px;

                height:
                    30px;

            }


            .skeleton-button {

                width:
                    105px;

                height:
                    38px;

            }


            @keyframes clientProjectsSkeleton {

                0% {

                    background-position:
                        200%
                        0;

                }

                100% {

                    background-position:
                        -200%
                        0;

                }

            }


            /* =================================================
               RESPONSIVE
               ================================================= */

            @media (max-width: 1100px) {

                .client-projects-grid {

                    grid-template-columns:
                        1fr;

                }

            }


            @media (max-width: 700px) {

                .client-page-heading {

                    align-items:
                        flex-start;

                    flex-direction:
                        column;

                }


                .client-project-count {

                    min-width:
                        80px;

                }


                .client-projects-toolbar {

                    align-items:
                        stretch;

                    flex-direction:
                        column;

                }


                .client-project-filter {

                    width:
                        100%;

                }


                .client-project-card {

                    padding:
                        var(--space-4);

                }

            }


            @media (max-width: 520px) {

                .client-page-heading h1 {

                    font-size:
                        var(--font-size-2xl);

                }


                .client-project-card-header {

                    flex-direction:
                        column;

                }


                .client-status-badge {

                    align-self:
                        flex-start;

                }


                .client-project-meta {

                    grid-template-columns:
                        1fr;

                }


                .client-project-card-footer {

                    align-items:
                        stretch;

                    flex-direction:
                        column;

                }


                .client-btn {

                    width:
                        100%;

                }


                .client-empty-state,
                .client-filter-empty,
                .client-error-state {

                    padding:
                        var(--space-6);

                }

            }


            @media (max-width: 360px) {

                .client-page-heading p {

                    font-size:
                        var(--font-size-xs);

                }


                .client-projects-toolbar {

                    padding:
                        var(--space-2);

                }


                .client-project-card {

                    padding:
                        var(--space-3);

                }

            }


            /* =================================================
               REDUCED MOTION
               ================================================= */

            @media (prefers-reduced-motion: reduce) {

                .client-projects-page *,
                .client-projects-page::before,
                .client-projects-page::after {

                    animation:
                        none !important;

                    transition:
                        none !important;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* ========================================================
       PUBLIC MODULE
       ======================================================== */

    window.TenspickClientProjects = {

        init:
            init,

        destroy:
            destroy,

        refresh:
            refresh,

        getProjects:
            getProjects,

        getFilteredProjects:
            getFilteredProjects,

        isInitialized:
            isInitialized

    };


})(window, document);