/* ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL — PROJECT PROGRESS
 *
 * File:
 * assets/js/pages/progress.js
 *
 * ============================================================
 *
 * BACKEND ENDPOINTS
 *
 * GET /api/client-portal/projects
 * GET /api/client-portal/projects/{id}/progress
 *
 * IMPORTANT
 * ------------------------------------------------------------
 * 1. client_id is NEVER sent from frontend.
 * 2. Backend identifies the authenticated client from session.
 * 3. Progress is loaded from backend.
 * 4. No fake project/progress data.
 * 5. Compatible with Tenspick Client Router.
 *
 * ============================================================ */

(function () {
    "use strict";

    /* =========================================================
     * DEPENDENCY
     * ========================================================= */

    const API = window.TenspickClientAPI;

    /* =========================================================
     * STATE
     * ========================================================= */

    let root = null;

    let projects = [];

    let selectedProjectId = null;

    let selectedProject = null;

    let progressData = null;

    let initialized = false;

    let destroyed = false;

    let loadingProjects = false;

    let loadingProgress = false;

    /*
     * Request sequence prevents an old response from
     * overwriting a newer selected project.
     */
    let progressRequestId = 0;

    /* =========================================================
     * HTML HELPERS
     * ========================================================= */

    function escapeHtml(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

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

        for (const key of keys) {
            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    key
                )
            ) {
                const value = object[key];

                if (
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== ""
                ) {
                    return value;
                }
            }
        }

        return fallback;
    }

    /* =========================================================
     * PROJECT HELPERS
     * ========================================================= */

    function getProjectId(project) {
        return getValue(
            project,
            [
                "id",
                "project_id"
            ],
            ""
        );
    }

    function getProjectName(project) {
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

    function getProjectCode(project) {
        return getValue(
            project,
            [
                "project_code",
                "code"
            ],
            ""
        );
    }

    function getProjectType(project) {
        return getValue(
            project,
            [
                "project_type",
                "type"
            ],
            "Project"
        );
    }

    function getProjectStatus(project) {
        return getValue(
            project,
            [
                "status",
                "project_status"
            ],
            "Pending"
        );
    }

    function getProjectStartDate(project) {
        return getValue(
            project,
            [
                "start_date",
                "project_start_date"
            ],
            ""
        );
    }

    function getProjectEndDate(project) {
        return getValue(
            project,
            [
                "expected_completion",
                "expected_completion_date",
                "completion_date",
                "end_date",
                "project_end_date"
            ],
            ""
        );
    }

    /* =========================================================
     * STATUS
     * ========================================================= */

    function normalizeStatus(status) {
        return String(status || "")
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");
    }

    function getStatusClass(status) {
        const value =
            normalizeStatus(status);

        if (
            value.includes("complete") ||
            value.includes("completed") ||
            value.includes("delivered")
        ) {
            return "is-success";
        }

        if (
            value.includes("progress") ||
            value.includes("active") ||
            value.includes("ongoing") ||
            value.includes("working")
        ) {
            return "is-primary";
        }

        if (
            value.includes("hold") ||
            value.includes("paused")
        ) {
            return "is-warning";
        }

        if (
            value.includes("cancel") ||
            value.includes("reject")
        ) {
            return "is-danger";
        }

        return "is-neutral";
    }

    /* =========================================================
     * PROGRESS
     * ========================================================= */

    function normalizeProgress(value) {
        const number = Number(value);

        if (!Number.isFinite(number)) {
            return 0;
        }

        return Math.min(
            100,
            Math.max(0, number)
        );
    }

    function getProjectProgress(project) {
        return normalizeProgress(
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
    }

    function getSelectedProgress() {
        /*
         * First preference:
         * backend progress endpoint.
         */
        const apiProgress =
            getValue(
                progressData,
                [
                    "progress_percentage",
                    "progress",
                    "completion_percentage"
                ],
                null
            );

        if (
            apiProgress !== null
        ) {
            return normalizeProgress(
                apiProgress
            );
        }

        /*
         * Fallback to the project object returned
         * by the projects endpoint.
         */
        if (selectedProject) {
            return getProjectProgress(
                selectedProject
            );
        }

        return 0;
    }

    /* =========================================================
     * DATE FORMAT
     * ========================================================= */

    /*
     * Handles:
     *
     * 2026-09-11
     * 2026-09-30
     * 2026-09-11 00:10:11
     *
     * without timezone shifting.
     */

    function formatDate(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "—";
        }

        const raw =
            String(value).trim();

        if (!raw) {
            return "—";
        }

        /*
         * YYYY-MM-DD
         */
        const dateOnlyMatch =
            raw.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );

        if (dateOnlyMatch) {

            const year =
                Number(dateOnlyMatch[1]);

            const month =
                Number(dateOnlyMatch[2]);

            const day =
                Number(dateOnlyMatch[3]);

            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );

            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {
                return date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );
            }
        }

        /*
         * YYYY-MM-DD HH:MM:SS
         */
        const dateTimeMatch =
            raw.match(
                /^(\d{4})-(\d{2})-(\d{2})[\sT]/
            );

        if (dateTimeMatch) {

            const year =
                Number(dateTimeMatch[1]);

            const month =
                Number(dateTimeMatch[2]);

            const day =
                Number(dateTimeMatch[3]);

            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );

            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {
                return date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );
            }
        }

        /*
         * Generic fallback.
         */
        const fallbackDate =
            new Date(raw);

        if (
            !Number.isNaN(
                fallbackDate.getTime()
            )
        ) {
            return fallbackDate.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );
        }

        return escapeHtml(raw);
    }

    /* =========================================================
     * API RESPONSE EXTRACTION
     * ========================================================= */

    /*
     * TenspickClientAPI.get() returns:
     *
     * {
     *     ok: true,
     *     status: 200,
     *     data: backendResponse,
     *     response: Response
     * }
     *
     * Backend:
     *
     * {
     *     success: true,
     *     message: "...",
     *     data: {...}
     * }
     */

    function getBackendResponse(
        apiResponse
    ) {
        if (!apiResponse) {
            return null;
        }

        if (
            apiResponse.data &&
            typeof apiResponse.data === "object"
        ) {
            return apiResponse.data;
        }

        return apiResponse;
    }

    function extractProjects(
        apiResponse
    ) {
        const backend =
            getBackendResponse(
                apiResponse
            );

        if (!backend) {
            return [];
        }

        /*
         * Normal backend response:
         *
         * data.projects
         */
        if (
            backend.data &&
            typeof backend.data === "object" &&
            Array.isArray(
                backend.data.projects
            )
        ) {
            return backend.data.projects;
        }

        /*
         * Alternative:
         *
         * projects
         */
        if (
            Array.isArray(
                backend.projects
            )
        ) {
            return backend.projects;
        }

        /*
         * Direct array.
         */
        if (
            Array.isArray(backend)
        ) {
            return backend;
        }

        return [];
    }

    function extractProgress(
        apiResponse
    ) {
        const backend =
            getBackendResponse(
                apiResponse
            );

        if (!backend) {
            return null;
        }

        /*
         * data.progress
         */
        if (
            backend.data &&
            typeof backend.data === "object" &&
            backend.data.progress &&
            typeof backend.data.progress === "object"
        ) {
            return backend.data.progress;
        }

        /*
         * Sometimes the backend may return
         * progress fields directly inside data.
         */
        if (
            backend.data &&
            typeof backend.data === "object" &&
            (
                backend.data.progress_percentage !==
                    undefined ||
                backend.data.progress !==
                    undefined ||
                backend.data.completion_percentage !==
                    undefined
            )
        ) {
            return backend.data;
        }

        /*
         * Direct progress object.
         */
        if (
            backend.progress &&
            typeof backend.progress === "object"
        ) {
            return backend.progress;
        }

        /*
         * Direct fields.
         */
        if (
            backend.progress_percentage !==
                undefined ||
            backend.progress !==
                undefined ||
            backend.completion_percentage !==
                undefined
        ) {
            return backend;
        }

        return null;
    }

    /* =========================================================
     * LOADING UI
     * ========================================================= */

    function renderLoading() {
        if (!root) {
            return;
        }

        root.innerHTML = `
            <div class="client-progress-page">

                <div class="client-page-heading">

                    <div>

                        <span class="client-eyebrow">
                            PROJECT TRACKING
                        </span>

                        <h1>
                            Project Progress
                        </h1>

                        <p>
                            Track the current progress of your projects.
                        </p>

                    </div>

                </div>

                <div class="client-progress-layout">

                    <aside
                        class="client-progress-project-list"
                    >

                        <div
                            class="client-progress-panel-header"
                        >

                            <div>

                                <span
                                    class="client-eyebrow"
                                >
                                    PROJECTS
                                </span>

                                <h2>
                                    Select Project
                                </h2>

                            </div>

                        </div>

                        <div
                            class="client-progress-project-items"
                        >

                            ${Array
                                .from({
                                    length: 4
                                })
                                .map(
                                    () => `
                                        <div
                                            class="client-progress-project-skeleton"
                                        >

                                            <div
                                                class="client-skeleton"
                                                style="
                                                    width:70%;
                                                    height:14px;
                                                "
                                            ></div>

                                            <div
                                                class="client-skeleton"
                                                style="
                                                    width:45%;
                                                    height:9px;
                                                "
                                            ></div>

                                            <div
                                                class="client-skeleton"
                                                style="
                                                    width:100%;
                                                    height:6px;
                                                "
                                            ></div>

                                        </div>
                                    `
                                )
                                .join("")}

                        </div>

                    </aside>

                    <main
                        class="client-progress-main"
                    >

                        <div
                            class="client-skeleton"
                            style="
                                width:220px;
                                height:25px;
                            "
                        ></div>

                        <div
                            class="client-skeleton"
                            style="
                                width:130px;
                                height:12px;
                                margin-top:12px;
                            "
                        ></div>

                        <div
                            class="client-skeleton"
                            style="
                                width:100%;
                                height:12px;
                                margin-top:35px;
                            "
                        ></div>

                        <div
                            class="client-skeleton"
                            style="
                                width:100%;
                                height:160px;
                                margin-top:25px;
                            "
                        ></div>

                    </main>

                </div>

            </div>
        `;
    }

    /* =========================================================
     * ERROR
     * ========================================================= */

    function renderError(message) {
        if (!root) {
            return;
        }

        root.innerHTML = `
            <div class="client-progress-page">

                <div class="client-page-heading">

                    <div>

                        <span class="client-eyebrow">
                            PROJECT TRACKING
                        </span>

                        <h1>
                            Project Progress
                        </h1>

                        <p>
                            Track the current progress of your projects.
                        </p>

                    </div>

                </div>

                <div class="client-error-state">

                    <div class="client-error-icon">
                        <i class="bi bi-exclamation-triangle"></i>
                    </div>

                    <h2>
                        Unable to Load Progress
                    </h2>

                    <p>
                        ${escapeHtml(
                            message ||
                            "Project progress could not be loaded."
                        )}
                    </p>

                    <button
                        type="button"
                        class="client-btn client-btn-primary"
                        data-progress-action="retry"
                    >
                        <i class="bi bi-arrow-clockwise"></i>
                        Try Again
                    </button>

                </div>

            </div>
        `;

        bindEvents();
    }

    /* =========================================================
     * EMPTY
     * ========================================================= */

    function renderEmpty() {
        if (!root) {
            return;
        }

        root.innerHTML = `
            <div class="client-progress-page">

                <div class="client-page-heading">

                    <div>

                        <span class="client-eyebrow">
                            PROJECT TRACKING
                        </span>

                        <h1>
                            Project Progress
                        </h1>

                        <p>
                            Track the current progress of your projects.
                        </p>

                    </div>

                </div>

                <div class="client-empty-state">

                    <div class="client-empty-icon">
                        <i class="bi bi-graph-up-arrow"></i>
                    </div>

                    <h2>
                        No Projects Available
                    </h2>

                    <p>
                        There are no projects available to display progress.
                    </p>

                </div>

            </div>
        `;
    }

    /* =========================================================
     * PROJECT LIST
     * ========================================================= */

    function renderProjectList() {
        return `
            <aside
                class="client-progress-project-list"
            >

                <div
                    class="client-progress-panel-header"
                >

                    <div>

                        <span class="client-eyebrow">
                            PROJECTS
                        </span>

                        <h2>
                            Select Project
                        </h2>

                    </div>

                    <span
                        class="client-detail-count"
                    >
                        ${projects.length}
                    </span>

                </div>

                <div
                    class="client-progress-project-items"
                >

                    ${projects
                        .map(
                            (
                                project,
                                index
                            ) => {

                                const id =
                                    String(
                                        getProjectId(
                                            project
                                        )
                                    );

                                const active =
                                    String(
                                        selectedProjectId
                                    ) === id;

                                const progress =
                                    getProjectProgress(
                                        project
                                    );

                                return `
                                    <button
                                        type="button"
                                        class="
                                            client-progress-project-item
                                            ${
                                                active
                                                    ? "is-active"
                                                    : ""
                                            }
                                        "
                                        data-progress-action="select"
                                        data-project-id="${escapeHtml(
                                            id
                                        )}"
                                    >

                                        <div
                                            class="
                                                client-progress-project-top
                                            "
                                        >

                                            <div
                                                class="
                                                    client-progress-project-number
                                                "
                                            >
                                                ${index + 1}
                                            </div>

                                            <div
                                                class="
                                                    client-progress-project-info
                                                "
                                            >

                                                ${
                                                    getProjectCode(
                                                        project
                                                    )
                                                        ? `
                                                            <span>
                                                                ${escapeHtml(
                                                                    getProjectCode(
                                                                        project
                                                                    )
                                                                )}
                                                            </span>
                                                        `
                                                        : ""
                                                }

                                                <strong>
                                                    ${escapeHtml(
                                                        getProjectName(
                                                            project
                                                        )
                                                    )}
                                                </strong>

                                            </div>

                                            <i
                                                class="
                                                    bi bi-chevron-right
                                                "
                                            ></i>

                                        </div>

                                        <div
                                            class="
                                                client-progress-project-bar
                                            "
                                        >

                                            <span>
                                                ${progress}%
                                            </span>

                                            <div
                                                class="
                                                    client-progress-track
                                                "
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

                                    </button>
                                `;
                            }
                        )
                        .join("")}

                </div>

            </aside>
        `;
    }

    /* =========================================================
     * MAIN PROGRESS
     * ========================================================= */

    function renderMainProgress() {

        if (!selectedProject) {
            return `
                <main
                    class="client-progress-main"
                >

                    <div
                        class="
                            client-progress-no-selection
                        "
                    >

                        <div>
                            <i
                                class="
                                    bi bi-graph-up-arrow
                                "
                            ></i>
                        </div>

                        <h2>
                            Select a Project
                        </h2>

                        <p>
                            Select a project from the list
                            to view its progress.
                        </p>

                    </div>

                </main>
            `;
        }

        const progress =
            getSelectedProgress();

        const status =
            getValue(
                progressData,
                [
                    "status",
                    "project_status"
                ],
                getProjectStatus(
                    selectedProject
                )
            );

        const startDate =
            getProjectStartDate(
                selectedProject
            );

        const endDate =
            getProjectEndDate(
                selectedProject
            );

        const updatedAt =
            getValue(
                progressData,
                [
                    "updated_at",
                    "last_updated",
                    "progress_updated_at"
                ],
                ""
            );

        const remaining =
            Math.max(
                0,
                100 - progress
            );

        const projectIdValue =
            getProjectId(
                selectedProject
            );

        return `
            <main
                class="client-progress-main"
            >

                <!-- HEADER -->

                <div
                    class="
                        client-progress-main-header
                    "
                >

                    <div>

                        <span
                            class="client-eyebrow"
                        >
                            CURRENT PROJECT
                        </span>

                        <h2>
                            ${escapeHtml(
                                getProjectName(
                                    selectedProject
                                )
                            )}
                        </h2>

                        ${
                            getProjectCode(
                                selectedProject
                            )
                                ? `
                                    <span
                                        class="
                                            client-project-code
                                        "
                                    >
                                        ${escapeHtml(
                                            getProjectCode(
                                                selectedProject
                                            )
                                        )}
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    <span
                        class="
                            client-status-badge
                            ${getStatusClass(status)}
                        "
                    >
                        ${escapeHtml(status)}
                    </span>

                </div>

                <!-- PROGRESS HERO -->

                <div
                    class="client-progress-hero"
                >

                    <div
                        class="
                            client-progress-percentage
                        "
                    >

                        <strong>
                            ${progress}%
                        </strong>

                        <span>
                            Completed
                        </span>

                    </div>

                    <div
                        class="
                            client-progress-hero-bar
                        "
                    >

                        <div
                            class="
                                client-progress-track
                            "
                            role="progressbar"
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

                        <div
                            class="
                                client-progress-scale
                            "
                        >

                            <span>
                                Started
                            </span>

                            <strong>
                                ${progress}%
                            </strong>

                            <span>
                                Completed
                            </span>

                        </div>

                    </div>

                </div>

                <!-- STATS -->

                <div
                    class="client-progress-stats"
                >

                    <div
                        class="client-progress-stat"
                    >

                        <div
                            class="
                                client-progress-stat-icon
                            "
                        >
                            <i
                                class="
                                    bi bi-check2-circle
                                "
                            ></i>
                        </div>

                        <div>

                            <small>
                                Completed
                            </small>

                            <strong>
                                ${progress}%
                            </strong>

                        </div>

                    </div>

                    <div
                        class="client-progress-stat"
                    >

                        <div
                            class="
                                client-progress-stat-icon
                            "
                        >
                            <i
                                class="
                                    bi bi-hourglass-split
                                "
                            ></i>
                        </div>

                        <div>

                            <small>
                                Remaining
                            </small>

                            <strong>
                                ${remaining}%
                            </strong>

                        </div>

                    </div>

                    <div
                        class="client-progress-stat"
                    >

                        <div
                            class="
                                client-progress-stat-icon
                            "
                        >
                            <i
                                class="
                                    bi bi-activity
                                "
                            ></i>
                        </div>

                        <div>

                            <small>
                                Status
                            </small>

                            <strong>
                                ${escapeHtml(status)}
                            </strong>

                        </div>

                    </div>

                </div>

                <!-- PROJECT DATES -->

                <div
                    class="
                        client-progress-project-info-grid
                    "
                >

                    <div>

                        <small>
                            Project Start
                        </small>

                        <strong>
                            ${formatDate(startDate)}
                        </strong>

                    </div>

                    <div>

                        <small>
                            Expected Completion
                        </small>

                        <strong>
                            ${formatDate(endDate)}
                        </strong>

                    </div>

                    ${
                        updatedAt
                            ? `
                                <div>

                                    <small>
                                        Progress Updated
                                    </small>

                                    <strong>
                                        ${formatDate(
                                            updatedAt
                                        )}
                                    </strong>

                                </div>
                            `
                            : ""
                    }

                </div>

                <!-- ACTION -->

                <div
                    class="
                        client-progress-actions
                    "
                >

                    <button
                        type="button"
                        class="
                            client-btn
                            client-btn-outline
                        "
                        data-progress-action="details"
                        data-project-id="${escapeHtml(
                            projectIdValue
                        )}"
                    >

                        <i
                            class="bi bi-eye"
                        ></i>

                        View Project Details

                    </button>

                </div>

            </main>
        `;
    }

    /* =========================================================
     * MAIN RENDER
     * ========================================================= */

    function render() {
        if (
            !root ||
            destroyed
        ) {
            return;
        }

        if (!projects.length) {
            renderEmpty();
            return;
        }

        /*
         * Make sure selected project still exists.
         */
        const found =
            projects.find(
                project =>
                    String(
                        getProjectId(project)
                    ) ===
                    String(
                        selectedProjectId
                    )
            );

        if (!found) {
            selectedProjectId =
                getProjectId(
                    projects[0]
                );

            selectedProject =
                projects[0];

            progressData =
                null;
        }

        root.innerHTML = `
            <div
                class="client-progress-page"
            >

                <div
                    class="client-page-heading"
                >

                    <div>

                        <span
                            class="client-eyebrow"
                        >
                            PROJECT TRACKING
                        </span>

                        <h1>
                            Project Progress
                        </h1>

                        <p>
                            Track the current progress
                            of your projects.
                        </p>

                    </div>

                </div>

                <div
                    class="client-progress-layout"
                >

                    ${renderProjectList()}

                    ${renderMainProgress()}

                </div>

            </div>
        `;

        bindEvents();
    }

    /* =========================================================
     * LOAD SELECTED PROJECT PROGRESS
     * ========================================================= */

    async function loadSelectedProjectProgress() {

        if (
            destroyed ||
            !root ||
            !selectedProjectId
        ) {
            return;
        }

        if (
            !API ||
            typeof API.get !== "function"
        ) {
            renderError(
                "Client API service is not available."
            );

            return;
        }

        const requestId =
            ++progressRequestId;

        loadingProgress = true;

        try {

            const response =
                await API.get(
                    "/client-portal/projects/" +
                    encodeURIComponent(
                        selectedProjectId
                    ) +
                    "/progress"
                );

            /*
             * Ignore old response if the user selected
             * another project while this request was running.
             */
            if (
                requestId !==
                progressRequestId
            ) {
                return;
            }

            progressData =
                extractProgress(
                    response
                );

            /*
             * If backend did not return a separate progress
             * object, use the selected project object.
             */
            if (
                !progressData
            ) {
                progressData =
                    selectedProject;
            }

            if (
                !destroyed &&
                root
            ) {
                render();
            }

        } catch (error) {

            if (
                requestId !==
                progressRequestId
            ) {
                return;
            }

            console.warn(
                "[Tenspick Client Progress] Progress API failed:",
                error
            );

            /*
             * Keep the project information available.
             * The projects endpoint already contains
             * progress_percentage.
             */
            progressData =
                selectedProject;

            if (
                !destroyed &&
                root
            ) {
                render();
            }

        } finally {

            if (
                requestId ===
                progressRequestId
            ) {
                loadingProgress = false;
            }

        }
    }

    /* =========================================================
     * SELECT PROJECT
     * ========================================================= */

    async function selectProject(
        id
    ) {
        if (
            destroyed ||
            !id
        ) {
            return;
        }

        const project =
            projects.find(
                item =>
                    String(
                        getProjectId(item)
                    ) ===
                    String(id)
            );

        if (!project) {
            console.warn(
                "[Tenspick Client Progress] Project not found:",
                id
            );

            return;
        }

        /*
         * Cancel/ignore previous progress request.
         */
        progressRequestId++;

        selectedProjectId =
            String(id);

        selectedProject =
            project;

        progressData =
            project;

        /*
         * Immediately show selected project using
         * the project-list data.
         */
        render();

        /*
         * Then fetch the latest progress from backend.
         */
        await loadSelectedProjectProgress();
    }

    /* =========================================================
     * LOAD PROJECTS
     * ========================================================= */

    async function loadProjects() {

        if (
            destroyed ||
            !root
        ) {
            return;
        }

        if (loadingProjects) {
            return;
        }

        if (
            !API ||
            typeof API.get !== "function"
        ) {
            renderError(
                "Client API service is not available."
            );

            return;
        }

        loadingProjects = true;

        renderLoading();

        try {

            /*
             * Backend:
             *
             * GET /api/client-portal/projects
             *
             * NO client_id is sent.
             */
            const response =
                await API.get(
                    "/client-portal/projects"
                );

            const loadedProjects =
                extractProjects(
                    response
                );

            projects =
                Array.isArray(
                    loadedProjects
                )
                    ? loadedProjects
                    : [];

            /*
             * No projects.
             */
            if (!projects.length) {

                selectedProjectId =
                    null;

                selectedProject =
                    null;

                progressData =
                    null;

                render();

                return;
            }

            /*
             * Preserve the current selection when
             * refreshing if that project still exists.
             */
            let selected =
                projects.find(
                    project =>
                        String(
                            getProjectId(
                                project
                            )
                        ) ===
                        String(
                            selectedProjectId
                        )
                );

            /*
             * Otherwise select first project.
             */
            if (!selected) {

                selected =
                    projects[0];

                selectedProjectId =
                    getProjectId(
                        selected
                    );
            }

            selectedProject =
                selected;

            /*
             * Start with project-list progress.
             */
            progressData =
                selectedProject;

            /*
             * Render immediately.
             */
            render();

            /*
             * Fetch latest progress.
             */
            await loadSelectedProjectProgress();

        } catch (error) {

            console.error(
                "[Tenspick Client Progress] Failed to load projects:",
                error
            );

            if (
                !destroyed &&
                root
            ) {
                renderError(
                    error?.message ||
                    "Unable to load project progress."
                );
            }

        } finally {

            loadingProjects =
                false;

        }
    }

    /* =========================================================
     * EVENTS
     * ========================================================= */

    function bindEvents() {

        if (!root) {
            return;
        }

        root
            .querySelectorAll(
                "[data-progress-action]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        handleAction
                    );

                }
            );
    }

    async function handleAction(
        event
    ) {

        const button =
            event.currentTarget;

        const action =
            button.getAttribute(
                "data-progress-action"
            );

        /*
         * RETRY
         */
        if (
            action === "retry"
        ) {
            await loadProjects();
            return;
        }

        /*
         * SELECT PROJECT
         */
        if (
            action === "select"
        ) {

            const id =
                button.getAttribute(
                    "data-project-id"
                );

            if (!id) {
                return;
            }

            await selectProject(
                id
            );

            return;
        }

        /*
         * VIEW PROJECT DETAILS
         */
        if (
            action === "details"
        ) {

            const id =
                button.getAttribute(
                    "data-project-id"
                );

            if (!id) {
                return;
            }

            window.location.hash =
                "#projects/" +
                encodeURIComponent(id);

            return;
        }
    }

    /* =========================================================
     * PUBLIC MODULE
     * ========================================================= */

    window.TenspickClientProgress = {

        /*
         * Router entry point.
         */
        async init(
            container
        ) {

            root =
                container;

            initialized =
                true;

            destroyed =
                false;

            loadingProjects =
                false;

            loadingProgress =
                false;

            projects =
                [];

            selectedProjectId =
                null;

            selectedProject =
                null;

            progressData =
                null;

            progressRequestId =
                0;

            await loadProjects();

            return true;
        },

        /*
         * Router cleanup.
         */
        destroy() {

            destroyed =
                true;

            /*
             * Invalidate all pending progress requests.
             */
            progressRequestId++;

            root =
                null;

            projects =
                [];

            selectedProjectId =
                null;

            selectedProject =
                null;

            progressData =
                null;

            initialized =
                false;

            loadingProjects =
                false;

            loadingProgress =
                false;
        },

        /*
         * Manual refresh.
         */
        async refresh() {

            if (
                !initialized ||
                destroyed ||
                !root
            ) {
                return false;
            }

            await loadProjects();

            return true;
        },

        /*
         * Optional getters.
         */
        getProjects() {
            return [
                ...projects
            ];
        },

        getSelectedProject() {
            return selectedProject;
        },

        getSelectedProjectId() {
            return selectedProjectId;
        },

        getProgress() {
            return getSelectedProgress();
        }
    };

})();