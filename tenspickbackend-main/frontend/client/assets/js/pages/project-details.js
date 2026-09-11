/* ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL — PROJECT DETAILS
 *
 * File:
 * assets/js/pages/project-details.js
 *
 * Purpose:
 * Load and display one project from the authenticated
 * client's backend data.
 *
 * Backend endpoints:
 *
 * GET /api/client-portal/projects/{id}
 * GET /api/client-portal/projects/{id}/progress
 * GET /api/client-portal/projects/{id}/milestones
 *
 * IMPORTANT:
 * - client_id is NEVER sent from frontend.
 * - Backend identifies the client from the authenticated session.
 * - Project ownership is verified by backend.
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
    let projectId = null;

    let project = null;
    let progressData = null;
    let milestones = [];

    let initialized = false;
    let loading = false;
    let destroyed = false;

    /* =========================================================
     * HTML HELPERS
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

    function getValue(object, keys, fallback = "") {
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
     * DATE
     * ========================================================= */

    /*
     * Backend normally returns:
     *
     * 2026-09-11
     *
     * or:
     *
     * 2026-09-11 00:10:11
     *
     * We intentionally parse the date ourselves.
     *
     * This avoids timezone problems caused by:
     *
     * new Date("2026-09-11")
     *
     * =========================================================
     */

    function formatDate(value) {
        if (
            value === null ||
            value === undefined
        ) {
            return "—";
        }

        const raw = String(value).trim();

        if (!raw) {
            return "—";
        }

        /*
         * YYYY-MM-DD
         */
        const dateOnlyMatch = raw.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

        if (dateOnlyMatch) {
            const year = Number(
                dateOnlyMatch[1]
            );

            const month = Number(
                dateOnlyMatch[2]
            );

            const day = Number(
                dateOnlyMatch[3]
            );

            const date = new Date(
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
        const dateTimeMatch = raw.match(
            /^(\d{4})-(\d{2})-(\d{2})[\sT]/
        );

        if (dateTimeMatch) {
            const year = Number(
                dateTimeMatch[1]
            );

            const month = Number(
                dateTimeMatch[2]
            );

            const day = Number(
                dateTimeMatch[3]
            );

            const date = new Date(
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
        const fallbackDate = new Date(raw);

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
     * STATUS
     * ========================================================= */

    function normalizeStatus(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");
    }

    function statusClass(status) {
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

    function getProjectProgress() {
        const progressFromProgressApi =
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
            progressFromProgressApi !== null
        ) {
            return normalizeProgress(
                progressFromProgressApi
            );
        }

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

    /* =========================================================
     * API RESPONSE HELPERS
     * ========================================================= */

    /*
     * TenspickClientAPI.get() returns:
     *
     * {
     *     ok: true,
     *     status: 200,
     *     data: BACKEND_RESPONSE,
     *     response: Response
     * }
     *
     * Backend response:
     *
     * {
     *     success: true,
     *     message: "...",
     *     data: {
     *         project: {...}
     *     }
     * }
     *
     * Therefore we need to safely unwrap both levels.
     */

    function getBackendData(apiResponse) {
        if (!apiResponse) {
            return null;
        }

        /*
         * API wrapper.
         */
        if (
            apiResponse.data &&
            typeof apiResponse.data === "object"
        ) {
            return apiResponse.data;
        }

        return apiResponse;
    }

    function extractProject(apiResponse) {
        const backend =
            getBackendData(apiResponse);

        if (!backend) {
            return null;
        }

        /*
         * Expected:
         *
         * backend.data.project
         */
        if (
            backend.data &&
            typeof backend.data === "object" &&
            backend.data.project &&
            typeof backend.data.project === "object"
        ) {
            return backend.data.project;
        }

        /*
         * Alternative:
         *
         * backend.project
         */
        if (
            backend.project &&
            typeof backend.project === "object"
        ) {
            return backend.project;
        }

        /*
         * Some APIs may return the object directly.
         */
        if (
            backend.id !== undefined &&
            typeof backend === "object"
        ) {
            return backend;
        }

        return null;
    }

    function extractProgress(apiResponse) {
        const backend =
            getBackendData(apiResponse);

        if (!backend) {
            return null;
        }

        /*
         * Expected:
         *
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
         * Alternative:
         *
         * progress
         */
        if (
            backend.progress &&
            typeof backend.progress === "object"
        ) {
            return backend.progress;
        }

        /*
         * Sometimes progress endpoint may directly
         * return project progress fields.
         */
        if (
            backend.progress_percentage !== undefined ||
            backend.progress !== undefined ||
            backend.completion_percentage !== undefined
        ) {
            return backend;
        }

        return null;
    }

    function extractMilestones(apiResponse) {
        const backend =
            getBackendData(apiResponse);

        if (!backend) {
            return [];
        }

        /*
         * Expected:
         *
         * data.milestones
         */
        if (
            backend.data &&
            typeof backend.data === "object"
        ) {
            if (
                Array.isArray(
                    backend.data.milestones
                )
            ) {
                return backend.data.milestones;
            }

            /*
             * In case data itself is an array.
             */
            if (
                Array.isArray(
                    backend.data
                )
            ) {
                return backend.data;
            }
        }

        /*
         * Alternative:
         *
         * milestones
         */
        if (
            Array.isArray(
                backend.milestones
            )
        ) {
            return backend.milestones;
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

    /* =========================================================
     * LOADING UI
     * ========================================================= */

    function renderLoading() {
        if (!root) {
            return;
        }

        root.innerHTML = `
            <div class="client-project-details-page">

                <div class="client-details-back">

                    <button
                        type="button"
                        class="client-btn client-btn-ghost"
                        data-project-detail-action="back"
                    >
                        <i class="bi bi-arrow-left"></i>
                        Back to Projects
                    </button>

                </div>

                <div class="client-details-loading">

                    <div class="client-skeleton detail-title"></div>

                    <div class="client-skeleton detail-subtitle"></div>

                    <div class="client-details-loading-grid">

                        <div class="client-skeleton detail-large"></div>

                        <div class="client-skeleton detail-large"></div>

                    </div>

                </div>

            </div>
        `;

        bindEvents();
    }

    /* =========================================================
     * ERROR UI
     * ========================================================= */

    function renderError(message) {
        if (!root) {
            return;
        }

        root.innerHTML = `
            <div class="client-project-details-page">

                <div class="client-details-back">

                    <button
                        type="button"
                        class="client-btn client-btn-ghost"
                        data-project-detail-action="back"
                    >
                        <i class="bi bi-arrow-left"></i>
                        Back to Projects
                    </button>

                </div>

                <div class="client-error-state">

                    <div class="client-error-icon">
                        <i class="bi bi-exclamation-triangle"></i>
                    </div>

                    <h2>
                        Unable to Load Project
                    </h2>

                    <p>
                        ${escapeHtml(
                            message ||
                            "Unable to load project details."
                        )}
                    </p>

                    <button
                        type="button"
                        class="client-btn client-btn-primary"
                        data-project-detail-action="retry"
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
     * PROJECT OVERVIEW
     * ========================================================= */

    function renderProjectOverview() {
        const name =
            getValue(
                project,
                [
                    "project_name",
                    "name",
                    "title"
                ],
                "Untitled Project"
            );

        const code =
            getValue(
                project,
                [
                    "project_code",
                    "code"
                ],
                ""
            );

        const type =
            getValue(
                project,
                [
                    "project_type",
                    "type"
                ],
                "Project"
            );

        const status =
            getValue(
                project,
                [
                    "status",
                    "project_status"
                ],
                "Pending"
            );

        const description =
            getValue(
                project,
                [
                    "description",
                    "project_description"
                ],
                ""
            );

        /*
         * ======================================================
         * IMPORTANT BACKEND FIELDS
         * ======================================================
         *
         * Existing backend response:
         *
         * start_date
         * expected_completion
         *
         * These are the values displayed below.
         */

        const startDate =
            getValue(
                project,
                [
                    "start_date",
                    "project_start_date"
                ],
                ""
            );

        const endDate =
            getValue(
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

        const progress =
            getProjectProgress();

        const website =
            getValue(
                project,
                [
                    "live_website_link",
                    "live_website",
                    "website_url",
                    "website"
                ],
                ""
            );

        return `
            <section
                class="client-detail-card client-project-overview"
            >

                <div class="client-detail-card-header">

                    <div>

                        <span class="client-eyebrow">
                            PROJECT OVERVIEW
                        </span>

                        <h2>
                            ${escapeHtml(name)}
                        </h2>

                        ${
                            code
                                ? `
                                    <span class="client-project-code">
                                        ${escapeHtml(code)}
                                    </span>
                                `
                                : ""
                        }

                    </div>

                    <span
                        class="client-status-badge ${statusClass(status)}"
                    >
                        ${escapeHtml(status)}
                    </span>

                </div>

                ${
                    description
                        ? `
                            <div class="client-project-detail-description">
                                ${escapeHtml(description)}
                            </div>
                        `
                        : `
                            <div class="client-project-detail-description is-muted">
                                No project description available.
                            </div>
                        `
                }

                <div class="client-detail-info-grid">

                    <!-- PROJECT TYPE -->

                    <div class="client-detail-info-item">

                        <span>
                            <i class="bi bi-layers"></i>
                        </span>

                        <div>

                            <small>
                                Project Type
                            </small>

                            <strong>
                                ${escapeHtml(type)}
                            </strong>

                        </div>

                    </div>

                    <!-- START DATE -->

                    <div class="client-detail-info-item">

                        <span>
                            <i class="bi bi-calendar-event"></i>
                        </span>

                        <div>

                            <small>
                                Start Date
                            </small>

                            <strong>
                                ${formatDate(startDate)}
                            </strong>

                        </div>

                    </div>

                    <!-- END DATE -->

                    <div class="client-detail-info-item">

                        <span>
                            <i class="bi bi-calendar-check"></i>
                        </span>

                        <div>

                            <small>
                                End Date
                            </small>

                            <strong>
                                ${formatDate(endDate)}
                            </strong>

                        </div>

                    </div>

                    <!-- PROGRESS -->

                    <div class="client-detail-info-item">

                        <span>
                            <i class="bi bi-graph-up-arrow"></i>
                        </span>

                        <div>

                            <small>
                                Current Progress
                            </small>

                            <strong>
                                ${progress}%
                            </strong>

                        </div>

                    </div>

                </div>

                <!-- OVERALL PROGRESS -->

                <div class="client-detail-progress">

                    <div
                        class="client-project-progress-heading"
                    >

                        <span>
                            Overall Project Progress
                        </span>

                        <strong>
                            ${progress}%
                        </strong>

                    </div>

                    <div
                        class="client-progress-track"
                        role="progressbar"
                        aria-valuenow="${progress}"
                        aria-valuemin="0"
                        aria-valuemax="100"
                    >

                        <span
                            class="client-progress-value"
                            style="width:${progress}%"
                        ></span>

                    </div>

                </div>

                <!-- LIVE WEBSITE -->

                ${
                    website
                        ? `
                            <div class="client-detail-website">

                                <div>

                                    <span
                                        class="client-detail-website-icon"
                                    >
                                        <i class="bi bi-globe2"></i>
                                    </span>

                                    <div>

                                        <small>
                                            Live Website
                                        </small>

                                        <strong>
                                            Your website is available online.
                                        </strong>

                                    </div>

                                </div>

                                <a
                                    href="${escapeHtml(website)}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="client-btn client-btn-primary"
                                >
                                    Open Website

                                    <i class="bi bi-box-arrow-up-right"></i>

                                </a>

                            </div>
                        `
                        : ""
                }

            </section>
        `;
    }

    /* =========================================================
     * PROGRESS CARD
     * ========================================================= */

    function renderProgressCard() {
        const progress =
            getProjectProgress();

        const currentStatus =
            getValue(
                progressData,
                [
                    "status",
                    "project_status"
                ],
                getValue(
                    project,
                    ["status"],
                    "Pending"
                )
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

        return `
            <section
                class="client-detail-card client-progress-summary"
            >

                <div class="client-detail-card-header">

                    <div>

                        <span class="client-eyebrow">
                            PROGRESS
                        </span>

                        <h3>
                            Project Progress
                        </h3>

                    </div>

                    <div class="client-progress-circle">

                        <strong>
                            ${progress}%
                        </strong>

                    </div>

                </div>

                <div class="client-detail-progress-large">

                    <div class="client-progress-track">

                        <span
                            class="client-progress-value"
                            style="width:${progress}%"
                        ></span>

                    </div>

                    <div class="client-progress-scale">

                        <span>
                            0%
                        </span>

                        <span>
                            100%
                        </span>

                    </div>

                </div>

                <div class="client-progress-summary-row">

                    <div>

                        <small>
                            Status
                        </small>

                        <strong>
                            ${escapeHtml(currentStatus)}
                        </strong>

                    </div>

                    ${
                        updatedAt
                            ? `
                                <div>

                                    <small>
                                        Last Updated
                                    </small>

                                    <strong>
                                        ${formatDate(updatedAt)}
                                    </strong>

                                </div>
                            `
                            : ""
                    }

                </div>

            </section>
        `;
    }

    /* =========================================================
     * MILESTONE HELPERS
     * ========================================================= */

    function getMilestoneStatus(
        milestone
    ) {
        return getValue(
            milestone,
            [
                "status",
                "milestone_status"
            ],
            "Pending"
        );
    }

    function getMilestoneProgress(
        milestone
    ) {
        return normalizeProgress(
            getValue(
                milestone,
                [
                    "progress_percentage",
                    "progress",
                    "completion_percentage"
                ],
                0
            )
        );
    }

    /* =========================================================
     * MILESTONE ITEM
     * ========================================================= */

    function renderMilestone(
        milestone,
        index
    ) {
        const title =
            getValue(
                milestone,
                [
                    "milestone_name",
                    "name",
                    "title"
                ],
                `Milestone ${index + 1}`
            );

        const description =
            getValue(
                milestone,
                [
                    "description",
                    "milestone_description"
                ],
                ""
            );

        const status =
            getMilestoneStatus(
                milestone
            );

        const progress =
            getMilestoneProgress(
                milestone
            );

        const startDate =
            getValue(
                milestone,
                [
                    "start_date",
                    "milestone_start_date"
                ],
                ""
            );

        const endDate =
            getValue(
                milestone,
                [
                    "expected_completion",
                    "expected_completion_date",
                    "due_date",
                    "expected_date",
                    "completion_date",
                    "end_date"
                ],
                ""
            );

        return `
            <div class="client-milestone-item">

                <div class="client-milestone-marker">

                    <span>
                        ${index + 1}
                    </span>

                </div>

                <div class="client-milestone-content">

                    <div class="client-milestone-heading">

                        <div>

                            <h4>
                                ${escapeHtml(title)}
                            </h4>

                            ${
                                description
                                    ? `
                                        <p>
                                            ${escapeHtml(description)}
                                        </p>
                                    `
                                    : ""
                            }

                        </div>

                        <span
                            class="client-status-badge ${statusClass(status)}"
                        >
                            ${escapeHtml(status)}
                        </span>

                    </div>

                    <div class="client-milestone-progress">

                        <div
                            class="client-milestone-progress-top"
                        >

                            <span>
                                Progress
                            </span>

                            <strong>
                                ${progress}%
                            </strong>

                        </div>

                        <div class="client-progress-track">

                            <span
                                class="client-progress-value"
                                style="width:${progress}%"
                            ></span>

                        </div>

                    </div>

                    ${
                        startDate || endDate
                            ? `
                                <div
                                    class="client-milestone-date"
                                >

                                    <i
                                        class="bi bi-calendar3"
                                    ></i>

                                    ${
                                        startDate
                                            ? `
                                                <span>
                                                    ${formatDate(startDate)}
                                                </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        startDate && endDate
                                            ? `
                                                <span>
                                                    →
                                                </span>
                                            `
                                            : ""
                                    }

                                    ${
                                        endDate
                                            ? `
                                                <span>
                                                    ${formatDate(endDate)}
                                                </span>
                                            `
                                            : ""
                                    }

                                </div>
                            `
                            : ""
                    }

                </div>

            </div>
        `;
    }

    /* =========================================================
     * MILESTONES
     * ========================================================= */

    function renderMilestones() {
        return `
            <section
                class="client-detail-card client-milestones-card"
            >

                <div class="client-detail-card-header">

                    <div>

                        <span class="client-eyebrow">
                            PROJECT TIMELINE
                        </span>

                        <h3>
                            Milestones
                        </h3>

                    </div>

                    <span class="client-detail-count">
                        ${milestones.length}
                    </span>

                </div>

                ${
                    milestones.length > 0
                        ? `
                            <div class="client-milestones-list">

                                ${milestones
                                    .map(
                                        (
                                            milestone,
                                            index
                                        ) =>
                                            renderMilestone(
                                                milestone,
                                                index
                                            )
                                    )
                                    .join("")}

                            </div>
                        `
                        : `
                            <div class="client-detail-empty">

                                <div>
                                    <i class="bi bi-flag"></i>
                                </div>

                                <h4>
                                    No Milestones Available
                                </h4>

                                <p>
                                    Milestones for this project
                                    will appear here.
                                </p>

                            </div>
                        `
                }

            </section>
        `;
    }

    /* =========================================================
     * MAIN PAGE
     * ========================================================= */

    function render() {
        if (
            !root ||
            !project ||
            destroyed
        ) {
            return;
        }

        const name =
            getValue(
                project,
                [
                    "project_name",
                    "name",
                    "title"
                ],
                "Project Details"
            );

        root.innerHTML = `
            <div class="client-project-details-page">

                <!-- BACK -->

                <div class="client-details-back">

                    <button
                        type="button"
                        class="client-btn client-btn-ghost"
                        data-project-detail-action="back"
                    >
                        <i class="bi bi-arrow-left"></i>
                        Back to Projects
                    </button>

                </div>

                <!-- PAGE HEADER -->

                <div
                    class="client-details-page-heading"
                >

                    <div>

                        <span class="client-eyebrow">
                            PROJECT DETAILS
                        </span>

                        <h1>
                            ${escapeHtml(name)}
                        </h1>

                        <p>
                            Track your project progress
                            and milestones.
                        </p>

                    </div>

                </div>

                <!-- MAIN GRID -->

                <div
                    class="client-details-main-grid"
                >

                    <div
                        class="client-details-primary"
                    >
                        ${renderProjectOverview()}
                    </div>

                    <div
                        class="client-details-secondary"
                    >
                        ${renderProgressCard()}
                    </div>

                </div>

                <!-- MILESTONES -->

                ${renderMilestones()}

            </div>
        `;

        bindEvents();
    }

    /* =========================================================
     * EVENTS
     * ========================================================= */

    function bindEvents() {
        if (!root) {
            return;
        }

        const buttons =
            root.querySelectorAll(
                "[data-project-detail-action]"
            );

        buttons.forEach(button => {

            button.addEventListener(
                "click",
                handleAction
            );

        });
    }

    function handleAction(event) {
        const button =
            event.currentTarget;

        const action =
            button.getAttribute(
                "data-project-detail-action"
            );

        if (action === "back") {
            window.location.hash =
                "#projects";
            return;
        }

        if (action === "retry") {
            loadProject();
        }
    }

    /* =========================================================
     * LOAD PROJECT
     * ========================================================= */

    async function loadProject() {
        if (
            destroyed ||
            !root
        ) {
            return;
        }

        if (!projectId) {
            renderError(
                "Project ID is missing."
            );
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

        if (loading) {
            return;
        }

        loading = true;

        renderLoading();

        try {

            /* =================================================
             * 1. LOAD PROJECT
             * =================================================
             */

            const projectResponse =
                await API.get(
                    "/client-portal/projects/" +
                    encodeURIComponent(
                        projectId
                    )
                );

            if (
                projectResponse &&
                projectResponse.ok === false
            ) {
                throw new Error(
                    "Unable to load project."
                );
            }

            const loadedProject =
                extractProject(
                    projectResponse
                );

            if (
                !loadedProject ||
                typeof loadedProject !==
                    "object"
            ) {
                throw new Error(
                    "Project data was not returned by the server."
                );
            }

            project =
                loadedProject;

            /* =================================================
             * 2. LOAD PROGRESS + MILESTONES
             * =================================================
             *
             * These are independent endpoints.
             *
             * If one fails, the project overview still
             * remains available.
             * =================================================
             */

            const progressRequest =
                API.get(
                    "/client-portal/projects/" +
                    encodeURIComponent(
                        projectId
                    ) +
                    "/progress"
                );

            const milestonesRequest =
                API.get(
                    "/client-portal/projects/" +
                    encodeURIComponent(
                        projectId
                    ) +
                    "/milestones"
                );

            const results =
                await Promise.allSettled([
                    progressRequest,
                    milestonesRequest
                ]);

            /* =================================================
             * PROGRESS RESULT
             * =================================================
             */

            if (
                results[0].status ===
                "fulfilled"
            ) {
                progressData =
                    extractProgress(
                        results[0].value
                    );

                if (
                    !progressData
                ) {
                    progressData =
                        project;
                }
            } else {

                console.warn(
                    "[Tenspick Client Project Details] Progress request failed:",
                    results[0].reason
                );

                progressData =
                    project;
            }

            /* =================================================
             * MILESTONES RESULT
             * =================================================
             */

            if (
                results[1].status ===
                "fulfilled"
            ) {
                milestones =
                    extractMilestones(
                        results[1].value
                    );
            } else {

                console.warn(
                    "[Tenspick Client Project Details] Milestones request failed:",
                    results[1].reason
                );

                milestones = [];
            }

            /* =================================================
             * DEBUG
             * =================================================
             *
             * These logs show exactly what the backend sent.
             * =================================================
             */

            console.log(
                "[Tenspick Client Project Details] Project:",
                project
            );

            console.log(
                "[Tenspick Client Project Details] Start Date:",
                project.start_date
            );

            console.log(
                "[Tenspick Client Project Details] End Date:",
                project.expected_completion
            );

            console.log(
                "[Tenspick Client Project Details] Progress:",
                progressData
            );

            console.log(
                "[Tenspick Client Project Details] Milestones:",
                milestones
            );

            /* =================================================
             * RENDER
             * =================================================
             */

            if (
                !destroyed &&
                root
            ) {
                render();
            }

        } catch (error) {

            console.error(
                "[Tenspick Client Project Details] Load failed:",
                error
            );

            if (
                !destroyed &&
                root
            ) {
                renderError(
                    error?.message ||
                    "Unable to load project details."
                );
            }

        } finally {

            loading = false;

        }
    }

    /* =========================================================
     * PUBLIC MODULE
     * ========================================================= */

    window.TenspickClientProjectDetails = {

        /*
         * Router calls this.
         */
        async init(
            container,
            params = {}
        ) {
            root = container;

            destroyed = false;
            initialized = true;
            loading = false;

            project = null;
            progressData = null;
            milestones = [];

            projectId =
                params?.id ??
                params?.projectId ??
                null;

            /*
             * Convert project ID to string-safe value.
             */
            if (
                projectId !== null &&
                projectId !== undefined
            ) {
                projectId =
                    String(projectId).trim();
            }

            if (!projectId) {
                renderError(
                    "Project ID is missing."
                );

                return false;
            }

            await loadProject();

            return true;
        },

        /*
         * Router calls this when changing page.
         */
        destroy() {
            destroyed = true;

            root = null;
            projectId = null;

            project = null;
            progressData = null;
            milestones = [];

            initialized = false;
            loading = false;
        },

        /*
         * Optional refresh.
         */
        async refresh() {
            if (
                !initialized ||
                destroyed ||
                !root ||
                !projectId
            ) {
                return false;
            }

            await loadProject();

            return true;
        },

        /*
         * Optional getters.
         */
        getProject() {
            return project;
        },

        getProjectId() {
            return projectId;
        },

        getProgress() {
            return getProjectProgress();
        },

        getMilestones() {
            return Array.isArray(
                milestones
            )
                ? [...milestones]
                : [];
        }
    };

})();