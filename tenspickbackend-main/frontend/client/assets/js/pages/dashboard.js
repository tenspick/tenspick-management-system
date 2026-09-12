"use strict";

/**
 * ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL
 * DASHBOARD PAGE
 * ============================================================
 *
 * File:
 * assets/js/pages/dashboard.js
 *
 * Responsibilities:
 * - Display authenticated client information
 * - Load client projects
 * - Load client payment summary
 * - Load project milestones
 * - Display project statistics
 * - Display project overview
 * - Display payment overview
 * - Display upcoming milestones
 *
 * API:
 *
 * GET /api/client-portal/projects
 * GET /api/client-portal/payments
 * GET /api/client-portal/projects/{id}/milestones
 *
 * Security:
 * - No client_id is sent from frontend.
 * - Backend identifies the client from the authenticated session.
 *
 * Router contract:
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

    let container = null;

    let initialized = false;

    let destroyed = false;

    let loading = false;

    let requestSequence = 0;

    let projects = [];

    let payments = [];

    let paymentSummary = null;


    /* ========================================================
       API ENDPOINTS
       ======================================================== */

    const ENDPOINTS = {

        PROJECTS:
            "/client-portal/projects",

        PAYMENTS:
            "/client-portal/payments",

        PROJECT_MILESTONES:
            function (projectId) {

                return (
                    "/client-portal/projects/" +
                    encodeURIComponent(projectId) +
                    "/milestones"
                );

            },

    };


    /* ========================================================
       INIT
       ======================================================== */

    async function init(
        targetContainer,
        params
    ) {

        container =
            targetContainer ||
            document.getElementById(
                "clientPageContainer"
            );


        if (!container) {

            throw new Error(
                "Client dashboard container was not found."
            );

        }


        destroyed = false;

        initialized = false;

        requestSequence++;


        injectDashboardStyles();

        renderLoading();


        try {

            await loadDashboardData();


            if (destroyed) {

                return false;

            }


            render();

            initialized = true;


            return true;

        } catch (error) {

            console.error(
                "[Tenspick Client Dashboard] Initialization failed:",
                error
            );


            if (!destroyed) {

                renderError(
                    getErrorMessage(
                        error
                    )
                );

            }


            return false;

        }

    }


    /* ========================================================
       LOAD DASHBOARD DATA
       ======================================================== */

    async function loadDashboardData() {

        if (loading) {

            return;

        }


        loading = true;


        const currentRequest =
            ++requestSequence;


        projects = [];

        payments = [];

        paymentSummary = null;


        try {

            /*
             * Projects and payments can safely load in
             * parallel because both are independent APIs.
             */

            const results =
                await Promise.allSettled([

                    loadProjects(),

                    loadPayments(),

                ]);


            if (
                destroyed ||
                currentRequest !== requestSequence
            ) {

                return;

            }


            results.forEach(
                function (
                    result,
                    index
                ) {

                    if (
                        result.status ===
                        "rejected"
                    ) {

                        console.error(
                            "[Tenspick Client Dashboard] Request failed:",
                            index === 0
                                ? "Projects"
                                : "Payments",
                            result.reason
                        );

                    }

                }
            );


            /*
             * The backend normally provides the financial
             * summary. If it does not, calculate it only
             * AFTER both requests have completed.
             *
             * This avoids a race condition where payments
             * could calculate before projects were loaded.
             */

            if (!paymentSummary) {

                paymentSummary =
                    calculatePaymentSummary();

            }


            /*
             * Load milestones after projects are known.
             *
             * The projects endpoint does not necessarily
             * include milestones, therefore the dashboard
             * explicitly loads them from the existing
             * client-portal milestone endpoint.
             */

            if (projects.length) {

                await loadProjectMilestones(
                    currentRequest
                );

            }


            /*
             * Re-check after milestone requests.
             */

            if (
                destroyed ||
                currentRequest !== requestSequence
            ) {

                return;

            }

        } finally {

            if (
                currentRequest === requestSequence
            ) {

                loading = false;

            }

        }

    }


    /* ========================================================
       LOAD PROJECTS
       ======================================================== */

    /* ========================================================
       FALLBACK DATA FETCH
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
                console.warn("[Tenspick Client Dashboard] Supabase projects error:", e);
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
                console.warn("[Tenspick Client Dashboard] Supabase payments error:", e);
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
        return list;
    }

    /* ========================================================
       LOAD PROJECTS
       ======================================================== */

    async function loadProjects() {
        try {
            if (
                window.TenspickClientAPI &&
                typeof window.TenspickClientAPI.get === "function"
            ) {
                const response = await window.TenspickClientAPI.get(ENDPOINTS.PROJECTS);
                const result = response ? response.data : null;

                if (result && result.success === true && Array.isArray(result.data?.projects)) {
                    projects = result.data.projects;
                    return projects;
                }
            }
        } catch (error) {
            console.warn("[Tenspick Client Dashboard] Projects API note:", error);
        }

        projects = await fetchFallbackProjects();
        return projects;
    }

    /* ========================================================
       LOAD PAYMENTS
       ======================================================== */

    async function loadPayments() {
        try {
            if (
                window.TenspickClientAPI &&
                typeof window.TenspickClientAPI.get === "function"
            ) {
                const response = await window.TenspickClientAPI.get(ENDPOINTS.PAYMENTS);
                const result = response ? response.data : null;

                if (result && result.success === true) {
                    const data = result.data || {};
                    payments = Array.isArray(data.payments) ? data.payments : [];
                    paymentSummary = data.summary || data.financial_summary || null;
                    return payments;
                }
            }
        } catch (error) {
            console.warn("[Tenspick Client Dashboard] Payments API note:", error);
        }

        payments = await fetchFallbackPayments();
        return payments;
    }


    /* ========================================================
       LOAD PROJECT MILESTONES
       ======================================================== */

    async function loadProjectMilestones(
        currentRequest
    ) {

        if (
            !window.TenspickClientAPI ||
            typeof window.TenspickClientAPI.get !==
                "function"
        ) {

            return;

        }


        /*
         * Only load milestones for the projects that
         * actually have valid IDs.
         */

        const validProjects =
            projects.filter(
                function (project) {

                    return (
                        project &&
                        project.id !== null &&
                        project.id !== undefined &&
                        String(project.id).trim() !== ""
                    );

                }
            );


        if (!validProjects.length) {

            return;

        }


        const milestoneResults =
            await Promise.allSettled(

                validProjects.map(
                    function (project) {

                        return loadMilestonesForProject(
                            project
                        );

                    }
                )

            );


        if (
            destroyed ||
            currentRequest !== requestSequence
        ) {

            return;

        }


        milestoneResults.forEach(
            function (
                result,
                index
            ) {

                if (
                    result.status ===
                    "rejected"
                ) {

                    console.warn(
                        "[Tenspick Client Dashboard] Milestone request failed:",
                        validProjects[index]
                            ? validProjects[index].id
                            : null,
                        result.reason
                    );

                }

            }
        );

    }


    /* ========================================================
       LOAD MILESTONES FOR PROJECT
       ======================================================== */

    async function loadMilestonesForProject(
        project
    ) {

        const response =
            await window
                .TenspickClientAPI
                .get(
                    ENDPOINTS.PROJECT_MILESTONES(
                        project.id
                    )
                );


        const result =
            response
                ? response.data
                : null;


        if (
            !result ||
            result.success !== true
        ) {

            throw new Error(
                getApiMessage(
                    result,
                    "Unable to load project milestones."
                )
            );

        }


        const data =
            result.data || {};


        let milestoneList = [];


        if (
            Array.isArray(
                data.milestones
            )
        ) {

            milestoneList =
                data.milestones;

        } else if (
            Array.isArray(
                data.items
            )
        ) {

            milestoneList =
                data.items;

        } else if (
            Array.isArray(
                data.records
            )
        ) {

            milestoneList =
                data.records;

        }


        /*
         * Attach milestones directly to the project object.
         * This does not alter the backend data.
         */

        project.milestones =
            milestoneList;


        return milestoneList;

    }


    /* ========================================================
       CALCULATE PAYMENT SUMMARY
       ======================================================== */

    function calculatePaymentSummary() {

        let totalProjectAmount = 0;

        let totalPaid = 0;


        projects.forEach(
            function (
                project
            ) {

                totalProjectAmount +=
                    toNumber(
                        project.budget
                    );

            }
        );


        payments.forEach(
            function (
                payment
            ) {

                totalPaid +=
                    toNumber(
                        payment.amount
                    );

            }
        );


        const remaining =
            Math.max(
                0,
                totalProjectAmount -
                totalPaid
            );


        let percentage = 0;


        if (
            totalProjectAmount > 0
        ) {

            percentage =
                (
                    totalPaid /
                    totalProjectAmount
                ) *
                100;

        }


        return {

            project_count:
                projects.length,

            total_project_amount:
                totalProjectAmount,

            total_paid:
                totalPaid,

            remaining:
                remaining,

            balance:
                remaining,

            payment_progress:
                clamp(
                    percentage,
                    0,
                    100
                ),

        };

    }


    /* ========================================================
       RENDER LOADING
       ======================================================== */

    function renderLoading() {

        if (
            !container ||
            destroyed
        ) {

            return;

        }


        container.innerHTML = `

            <section class="client-dashboard">

                <div class="client-dashboard-loading">

                    <div class="client-dashboard-loading-spinner">
                        <span></span>
                    </div>

                    <strong>
                        Loading dashboard...
                    </strong>

                    <span>
                        Please wait while we load your
                        project information.
                    </span>

                </div>

            </section>

        `;

    }


    /* ========================================================
       RENDER ERROR
       ======================================================== */

    function renderError(
        message
    ) {

        if (
            !container ||
            destroyed
        ) {

            return;

        }


        container.innerHTML = `

            <section class="client-dashboard">

                <div class="client-dashboard-error">

                    <div class="client-dashboard-error-icon">

                        <i class="bi bi-exclamation-triangle"></i>

                    </div>

                    <h3>
                        Unable to load dashboard
                    </h3>

                    <p>
                        ${escapeHtml(
                            message ||
                            "Something went wrong while loading your dashboard."
                        )}
                    </p>

                    <button
                        type="button"
                        class="client-dashboard-retry"
                        id="clientDashboardRetry"
                    >
                        <i class="bi bi-arrow-clockwise"></i>
                        Try Again
                    </button>

                </div>

            </section>

        `;


        const retryButton =
            document.getElementById(
                "clientDashboardRetry"
            );


        if (retryButton) {

            retryButton.addEventListener(
                "click",
                function () {

                    refresh();

                }
            );

        }

    }


    /* ========================================================
       RENDER DASHBOARD
       ======================================================== */

    function render() {

        if (
            !container ||
            destroyed
        ) {

            return;

        }


        const auth =
            window.TenspickClientAuth;


        const client =
            auth &&
            typeof auth.getClient ===
                "function"
                ? auth.getClient()
                : null;


        const clientName =
            getClientName(
                client
            );


        const statistics =
            getProjectStatistics();


        const financial =
            getFinancialSummary();


        const upcomingMilestones =
            getUpcomingMilestones();


        container.innerHTML = `

            <section class="client-dashboard">

                <!-- ========================================
                     WELCOME
                     ======================================== -->

                <div class="client-dashboard-welcome">

                    <div>

                        <span class="client-dashboard-label">
                            Client Portal
                        </span>

                        <h2>
                            Welcome back,
                            ${escapeHtml(clientName)}
                        </h2>

                        <p>
                            Manage your projects,
                            track progress,
                            view milestones and
                            monitor payments from one place.
                        </p>

                    </div>

                    <div class="client-dashboard-welcome-icon">

                        <i class="bi bi-grid-1x2-fill"></i>

                    </div>

                </div>


                <!-- ========================================
                     STATISTICS
                     ======================================== -->

                <div class="client-dashboard-grid">

                    ${createStatCard(
                        "My Projects",
                        formatNumber(
                            statistics.total
                        ),
                        "bi-folder2-open",
                        "projects"
                    )}

                    ${createStatCard(
                        "Active Projects",
                        formatNumber(
                            statistics.active
                        ),
                        "bi-arrow-repeat",
                        "projects"
                    )}

                    ${createStatCard(
                        "Completed",
                        formatNumber(
                            statistics.completed
                        ),
                        "bi-check-circle",
                        "projects"
                    )}

                    ${createStatCard(
                        "Pending Payments",
                        formatCurrency(
                            financial.remaining
                        ),
                        "bi-credit-card",
                        "payments"
                    )}

                </div>


                <!-- ========================================
                     TWO COLUMN AREA
                     ======================================== -->

                <div class="client-dashboard-columns">


                    <!-- ====================================
                         PROJECT OVERVIEW
                         ==================================== -->

                    <section class="client-dashboard-card">

                        <div class="client-dashboard-card-header">

                            <div>

                                <span>
                                    Project Overview
                                </span>

                                <h3>
                                    My Projects
                                </h3>

                            </div>

                            <a
                                href="#projects"
                                class="client-dashboard-link"
                            >
                                View All
                            </a>

                        </div>


                        <div
                            id="clientDashboardProjects"
                            class="client-dashboard-project-list"
                        >

                            ${renderProjectList()}

                        </div>

                    </section>


                    <!-- ====================================
                         PAYMENT OVERVIEW
                         ==================================== -->

                    <section class="client-dashboard-card">

                        <div class="client-dashboard-card-header">

                            <div>

                                <span>
                                    Payment Overview
                                </span>

                                <h3>
                                    Payment Status
                                </h3>

                            </div>

                            <a
                                href="#payments"
                                class="client-dashboard-link"
                            >
                                View Payments
                            </a>

                        </div>


                        <div class="client-dashboard-payment">

                            <div class="client-dashboard-payment-icon">

                                <i class="bi bi-credit-card"></i>

                            </div>

                            <div>

                                <strong>
                                    ${formatCurrency(
                                        financial.remaining
                                    )}
                                </strong>

                                <span>
                                    Outstanding Balance
                                </span>

                            </div>

                        </div>


                        <div class="client-dashboard-payment-summary">

                            <div>

                                <span>
                                    Total Project Amount
                                </span>

                                <strong>
                                    ${formatCurrency(
                                        financial.totalProjectAmount
                                    )}
                                </strong>

                            </div>


                            <div>

                                <span>
                                    Total Paid
                                </span>

                                <strong>
                                    ${formatCurrency(
                                        financial.totalPaid
                                    )}
                                </strong>

                            </div>

                        </div>


                        <div class="client-dashboard-progress">

                            <div class="client-dashboard-progress-head">

                                <span>
                                    Payment Progress
                                </span>

                                <strong>
                                    ${formatPercent(
                                        financial.progress
                                    )}
                                </strong>

                            </div>

                            <div class="client-progress-track">

                                <div
                                    class="client-progress-fill"
                                    style="width:${financial.progress}%"
                                ></div>

                            </div>

                        </div>

                    </section>

                </div>


                <!-- ========================================
                     MILESTONES
                     ======================================== -->

                <section class="client-dashboard-card">

                    <div class="client-dashboard-card-header">

                        <div>

                            <span>
                                Project Timeline
                            </span>

                            <h3>
                                Upcoming Milestones
                            </h3>

                        </div>

                        <a
                            href="#milestones"
                            class="client-dashboard-link"
                        >
                            View Milestones
                        </a>

                    </div>


                    <div class="client-dashboard-timeline">

                        ${renderMilestones(
                            upcomingMilestones
                        )}

                    </div>

                </section>

            </section>

        `;

    }


    /* ========================================================
       PROJECT STATISTICS
       ======================================================== */

    function getProjectStatistics() {

        let active = 0;

        let completed = 0;


        projects.forEach(
            function (
                project
            ) {

                const status =
                    normalizeStatus(
                        project.status
                    );


                if (
                    status === "completed" ||
                    status === "complete"
                ) {

                    completed++;

                    return;

                }


                active++;

            }
        );


        return {

            total:
                projects.length,

            active:
                active,

            completed:
                completed,

        };

    }


    /* ========================================================
       FINANCIAL SUMMARY
       ======================================================== */

    function getFinancialSummary() {

        const summary =
            paymentSummary ||
            {};


        const totalProjectAmount =
            firstNumber(
                summary.total_project_amount,
                summary.total_project_amounts,
                summary.total_amount,
                summary.project_amount,
                null
            );


        const totalPaid =
            firstNumber(
                summary.total_paid,
                summary.paid_amount,
                summary.total_payment,
                summary.total_payments,
                null
            );


        /*
         * If the backend explicitly provides the values,
         * use them. Otherwise calculate from local data.
         */

        const resolvedProjectAmount =
            hasNumericValue(
                summary.total_project_amount
            )
                ? totalProjectAmount
                : sumProjectBudgets();


        const resolvedPaid =
            hasNumericValue(
                summary.total_paid
            )
                ? totalPaid
                : sumPaymentAmounts();


        const calculatedRemaining =
            Math.max(
                0,
                resolvedProjectAmount -
                resolvedPaid
            );


        const remaining =
            firstNumber(
                summary.remaining,
                summary.balance,
                summary.remaining_balance,
                summary.pending_amount,
                calculatedRemaining
            );


        let progress =
            firstNumber(
                summary.payment_progress,
                summary.paid_percentage,
                summary.payment_percentage,
                null
            );


        if (
            !hasNumericValue(
                summary.payment_progress
            ) &&
            !hasNumericValue(
                summary.paid_percentage
            ) &&
            !hasNumericValue(
                summary.payment_percentage
            )
        ) {

            if (
                resolvedProjectAmount > 0
            ) {

                progress =
                    (
                        resolvedPaid /
                        resolvedProjectAmount
                    ) *
                    100;

            } else {

                progress = 0;

            }

        }


        return {

            totalProjectAmount:
                Math.max(
                    0,
                    resolvedProjectAmount
                ),

            totalPaid:
                Math.max(
                    0,
                    resolvedPaid
                ),

            remaining:
                Math.max(
                    0,
                    remaining
                ),

            progress:
                clamp(
                    progress,
                    0,
                    100
                ),

        };

    }


    /* ========================================================
       PROJECT LIST
       ======================================================== */

    function renderProjectList() {

        if (!projects.length) {

            return `

                <div class="client-dashboard-empty">

                    <div class="client-dashboard-empty-icon">

                        <i class="bi bi-folder2-open"></i>

                    </div>

                    <h4>
                        No projects found
                    </h4>

                    <p>
                        Your projects will appear here
                        once they are assigned to your
                        client account.
                    </p>

                </div>

            `;

        }


        const visibleProjects =
            projects.slice(
                0,
                4
            );


        return visibleProjects
            .map(
                function (
                    project
                ) {

                    return createProjectItem(
                        project
                    );

                }
            )
            .join("");

    }


    /* ========================================================
       PROJECT ITEM
       ======================================================== */

    function createProjectItem(
        project
    ) {

        const id =
            project.id;


        const name =
            project.project_name ||
            project.name ||
            "Unnamed Project";


        const code =
            project.project_code ||
            "";


        const status =
            normalizeStatus(
                project.status
            );


        const progress =
            clamp(
                toNumber(
                    project.progress_percentage
                ),
                0,
                100
            );


        const statusLabel =
            formatStatus(
                status
            );


        return `

            <a
                href="#projects/${encodeURIComponent(id)}"
                class="client-dashboard-project-item"
            >

                <div class="client-dashboard-project-icon">

                    <i class="bi bi-folder"></i>

                </div>


                <div class="client-dashboard-project-content">

                    <div class="client-dashboard-project-top">

                        <strong>
                            ${escapeHtml(name)}
                        </strong>

                        <span
                            class="client-dashboard-status client-dashboard-status-${escapeHtml(status)}"
                        >
                            ${escapeHtml(statusLabel)}
                        </span>

                    </div>


                    <div class="client-dashboard-project-meta">

                        ${
                            code
                                ? `
                                    <span>
                                        ${escapeHtml(code)}
                                    </span>
                                  `
                                : ""
                        }

                        ${
                            project.expected_completion
                                ? `
                                    <span>
                                        Due:
                                        ${escapeHtml(
                                            formatDate(
                                                project.expected_completion
                                            )
                                        )}
                                    </span>
                                  `
                                : ""
                        }

                    </div>


                    <div class="client-dashboard-project-progress">

                        <div class="client-dashboard-project-progress-track">

                            <div
                                class="client-dashboard-project-progress-fill"
                                style="width:${progress}%"
                            ></div>

                        </div>

                        <strong>
                            ${formatPercent(progress)}
                        </strong>

                    </div>

                </div>


                <div class="client-dashboard-project-arrow">

                    <i class="bi bi-chevron-right"></i>

                </div>

            </a>

        `;

    }


    /* ========================================================
       UPCOMING MILESTONES
       ======================================================== */

    function getUpcomingMilestones() {

        const milestones = [];


        projects.forEach(
            function (
                project
            ) {

                if (
                    !Array.isArray(
                        project.milestones
                    )
                ) {

                    return;

                }


                project.milestones.forEach(
                    function (
                        milestone
                    ) {

                        if (!milestone) {

                            return;

                        }


                        const status =
                            normalizeStatus(
                                milestone.status
                            );


                        if (
                            status === "completed" ||
                            status === "complete"
                        ) {

                            return;

                        }


                        milestones.push({

                            ...milestone,

                            project_id:
                                milestone.project_id ||
                                project.id,

                            project_name:
                                project.project_name ||
                                project.name ||
                                "Project",

                        });

                    }
                );

            }
        );


        milestones.sort(
            function (
                a,
                b
            ) {

                const dateA =
                    parseDate(
                        a.expected_completion ||
                        a.due_date ||
                        a.end_date
                    );


                const dateB =
                    parseDate(
                        b.expected_completion ||
                        b.due_date ||
                        b.end_date
                    );


                if (
                    !dateA &&
                    !dateB
                ) {

                    return 0;

                }


                if (!dateA) {

                    return 1;

                }


                if (!dateB) {

                    return -1;

                }


                return (
                    dateA.getTime() -
                    dateB.getTime()
                );

            }
        );


        return milestones.slice(
            0,
            5
        );

    }


    /* ========================================================
       RENDER MILESTONES
       ======================================================== */

    function renderMilestones(
        milestones
    ) {

        if (!milestones.length) {

            return `

                <div class="client-dashboard-empty">

                    <div class="client-dashboard-empty-icon">

                        <i class="bi bi-signpost-2"></i>

                    </div>

                    <h4>
                        No upcoming milestones
                    </h4>

                    <p>
                        Your upcoming project milestones
                        will appear here.
                    </p>

                </div>

            `;

        }


        return `

            <div class="client-dashboard-milestone-list">

                ${milestones
                    .map(
                        function (
                            milestone
                        ) {

                            return createMilestoneItem(
                                milestone
                            );

                        }
                    )
                    .join("")}

            </div>

        `;

    }


    /* ========================================================
       MILESTONE ITEM
       ======================================================== */

    function createMilestoneItem(
        milestone
    ) {

        const name =
            milestone.milestone_name ||
            milestone.name ||
            "Milestone";


        const projectName =
            milestone.project_name ||
            "Project";


        const status =
            normalizeStatus(
                milestone.status
            );


        const progress =
            clamp(
                toNumber(
                    milestone.progress_percentage
                ),
                0,
                100
            );


        const expectedDate =
            milestone.expected_completion ||
            milestone.due_date ||
            milestone.end_date ||
            null;


        return `

            <div class="client-dashboard-milestone-item">

                <div class="client-dashboard-milestone-icon">

                    <i class="bi bi-signpost-2"></i>

                </div>


                <div class="client-dashboard-milestone-content">

                    <strong>
                        ${escapeHtml(name)}
                    </strong>

                    <span>
                        ${escapeHtml(projectName)}
                    </span>


                    <div class="client-dashboard-milestone-progress">

                        <div
                            class="client-dashboard-milestone-progress-track"
                        >

                            <div
                                class="client-dashboard-milestone-progress-fill"
                                style="width:${progress}%"
                            ></div>

                        </div>

                        <small>
                            ${formatPercent(progress)}
                        </small>

                    </div>

                </div>


                <div class="client-dashboard-milestone-date">

                    <span>
                        ${expectedDate
                            ? "Due"
                            : "Status"}
                    </span>

                    <strong>
                        ${
                            expectedDate
                                ? escapeHtml(
                                    formatDate(
                                        expectedDate
                                    )
                                )
                                : escapeHtml(
                                    formatStatus(
                                        status
                                    )
                                )
                        }
                    </strong>

                </div>

            </div>

        `;

    }


    /* ========================================================
       CREATE STAT CARD
       ======================================================== */

    function createStatCard(
        title,
        value,
        icon,
        route
    ) {

        return `

            <a
                href="#${escapeHtml(route)}"
                class="client-dashboard-stat"
            >

                <div class="client-dashboard-stat-icon">

                    <i class="bi ${escapeHtml(icon)}"></i>

                </div>


                <div class="client-dashboard-stat-content">

                    <span>
                        ${escapeHtml(title)}
                    </span>

                    <strong>
                        ${escapeHtml(value)}
                    </strong>

                </div>

            </a>

        `;

    }


    /* ========================================================
       SUM PROJECT BUDGETS
       ======================================================== */

    function sumProjectBudgets() {

        let total = 0;


        projects.forEach(
            function (
                project
            ) {

                total +=
                    toNumber(
                        project.budget
                    );

            }
        );


        return total;

    }


    /* ========================================================
       SUM PAYMENTS
       ======================================================== */

    function sumPaymentAmounts() {

        let total = 0;


        payments.forEach(
            function (
                payment
            ) {

                total +=
                    toNumber(
                        payment.amount
                    );

            }
        );


        return total;

    }


    /* ========================================================
       NUMBER HELPERS
       ======================================================== */

    function toNumber(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return 0;

        }


        if (
            typeof value === "number"
        ) {

            return Number.isFinite(
                value
            )
                ? value
                : 0;

        }


        const cleaned =
            String(value)
                .replace(
                    /,/g,
                    ""
                )
                .replace(
                    /₹/g,
                    ""
                )
                .trim();


        const number =
            Number(
                cleaned
            );


        return Number.isFinite(
            number
        )
            ? number
            : 0;

    }


    /* ========================================================
       NUMERIC VALUE CHECK
       ======================================================== */

    function hasNumericValue(
        value
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            return false;

        }


        const number =
            Number(
                String(value)
                    .replace(
                        /,/g,
                        ""
                    )
                    .replace(
                        /₹/g,
                        ""
                    )
                    .trim()
            );


        return Number.isFinite(
            number
        );

    }


    /* ========================================================
       FIRST NUMBER
       ======================================================== */

    function firstNumber() {

        const values =
            Array.prototype.slice.call(
                arguments
            );


        for (
            let i = 0;
            i < values.length;
            i++
        ) {

            const value =
                values[i];


            if (
                value === null ||
                value === undefined ||
                value === ""
            ) {

                continue;

            }


            const number =
                toNumber(
                    value
                );


            return number;

        }


        return 0;

    }


    /* ========================================================
       STATUS
       ======================================================== */

    function normalizeStatus(
        status
    ) {

        return String(
            status || "unknown"
        )
            .trim()
            .toLowerCase()
            .replace(
                /\s+/g,
                "-"
            );

    }


    function formatStatus(
        status
    ) {

        const normalized =
            normalizeStatus(
                status
            );


        if (
            normalized === "in-progress" ||
            normalized === "inprogress"
        ) {

            return "In Progress";

        }


        if (
            normalized === "on-hold" ||
            normalized === "onhold"
        ) {

            return "On Hold";

        }


        if (
            normalized === "not-started" ||
            normalized === "notstarted"
        ) {

            return "Not Started";

        }


        if (
            normalized === "completed" ||
            normalized === "complete"
        ) {

            return "Completed";

        }


        if (
            normalized === "planning"
        ) {

            return "Planning";

        }


        if (
            normalized === "active"
        ) {

            return "Active";

        }


        if (
            normalized === "cancelled" ||
            normalized === "canceled"
        ) {

            return "Cancelled";

        }


        return normalized
            .replace(
                /-/g,
                " "
            )
            .replace(
                /\b\w/g,
                function (
                    character
                ) {

                    return character
                        .toUpperCase();

                }
            );

    }


    /* ========================================================
       DATE
       ======================================================== */

    function parseDate(
        value
    ) {

        if (!value) {

            return null;

        }


        const stringValue =
            String(value).trim();


        /*
         * Explicit YYYY-MM-DD parsing prevents timezone
         * shifts for MySQL DATE values.
         */

        const dateOnlyMatch =
            stringValue.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
            );


        if (dateOnlyMatch) {

            const year =
                Number(
                    dateOnlyMatch[1]
                );

            const month =
                Number(
                    dateOnlyMatch[2]
                ) - 1;

            const day =
                Number(
                    dateOnlyMatch[3]
                );


            const localDate =
                new Date(
                    year,
                    month,
                    day
                );


            if (
                localDate.getFullYear() === year &&
                localDate.getMonth() === month &&
                localDate.getDate() === day
            ) {

                return localDate;

            }


            return null;

        }


        const normalized =
            stringValue
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


    function formatDate(
        value
    ) {

        const date =
            parseDate(
                value
            );


        if (!date) {

            return "—";

        }


        return new Intl.DateTimeFormat(
            "en-IN",
            {
                day:
                    "2-digit",

                month:
                    "short",

                year:
                    "numeric",
            }
        ).format(
            date
        );

    }


    /* ========================================================
       CURRENCY
       ======================================================== */

    function formatCurrency(
        value
    ) {

        const amount =
            toNumber(
                value
            );


        return new Intl.NumberFormat(
            "en-IN",
            {
                style:
                    "currency",

                currency:
                    "INR",

                maximumFractionDigits:
                    2,
            }
        ).format(
            amount
        );

    }


    /* ========================================================
       NUMBER FORMAT
       ======================================================== */

    function formatNumber(
        value
    ) {

        return new Intl.NumberFormat(
            "en-IN"
        ).format(
            toNumber(
                value
            )
        );

    }


    /* ========================================================
       PERCENT
       ======================================================== */

    function formatPercent(
        value
    ) {

        const number =
            clamp(
                value,
                0,
                100
            );


        return (
            Math.round(
                number
            ) +
            "%"
        );

    }


    /* ========================================================
       CLAMP
       ======================================================== */

    function clamp(
        value,
        min,
        max
    ) {

        const number =
            toNumber(
                value
            );


        return Math.min(
            max,
            Math.max(
                min,
                number
            )
        );

    }


    /* ========================================================
       CLIENT NAME
       ======================================================== */

    function getClientName(
        client
    ) {

        if (!client) {

            return "Client";

        }


        const values = [

            client.client_name,

            client.name,

            client.company_name,

            client.business_name,

            client.contact_person,

            client.client_code,

        ];


        for (
            let i = 0;
            i < values.length;
            i++
        ) {

            if (
                typeof values[i] ===
                    "string" &&
                values[i].trim()
            ) {

                return values[i].trim();

            }

        }


        return "Client";

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
                : String(value);


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
       API MESSAGE
       ======================================================== */

    function getApiMessage(
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
            typeof error.message ===
                "string" &&
            error.message.trim()
        ) {

            return error.message.trim();

        }


        return "Unable to load dashboard data.";

    }


    /* ========================================================
       INJECT DASHBOARD STYLES
       ======================================================== */

    function injectDashboardStyles() {

        if (
            document.getElementById(
                "clientDashboardStyles"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "clientDashboardStyles";


        style.textContent = `

            /* =================================================
               DASHBOARD ROOT
               ================================================= */

            .client-dashboard {

                display: flex;

                flex-direction: column;

                gap: var(--space-6);

                width: 100%;

                min-width: 0;

            }


            /* =================================================
               WELCOME
               ================================================= */

            .client-dashboard-welcome {

                min-height: 190px;

                display: flex;

                align-items: center;

                justify-content: space-between;

                gap: var(--space-8);

                padding: var(--space-8);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-xl);

                background:
                    linear-gradient(
                        135deg,
                        var(--text),
                        var(--text-secondary)
                    );

                color:
                    var(--surface);

                box-shadow:
                    var(--shadow-md);

                overflow: hidden;

            }


            .client-dashboard-label {

                display: block;

                margin-bottom: 7px;

                color:
                    var(--primary-light);

                font-size:
                    var(--font-size-sm);

                font-weight:
                    var(--font-bold);

                text-transform:
                    uppercase;

                letter-spacing:
                    .08em;

            }


            .client-dashboard-welcome h2 {

                margin: 0;

                color:
                    var(--surface);

                font-size:
                    var(--font-size-3xl);

                font-weight:
                    var(--font-extrabold);

                line-height:
                    1.2;

            }


            .client-dashboard-welcome p {

                max-width: 650px;

                margin: 10px 0 0;

                color:
                    rgba(
                        255,
                        255,
                        255,
                        .70
                    );

                font-size:
                    var(--font-size-md);

                line-height:
                    1.7;

            }


            .client-dashboard-welcome-icon {

                width: 78px;

                height: 78px;

                flex: 0 0 78px;

                display: grid;

                place-items: center;

                border:
                    1px solid
                    rgba(
                        255,
                        255,
                        255,
                        .12
                    );

                border-radius:
                    var(--radius-xl);

                background:
                    rgba(
                        255,
                        255,
                        255,
                        .07
                    );

                color:
                    var(--primary-light);

                font-size: 32px;

            }


            /* =================================================
               STATISTICS
               ================================================= */

            .client-dashboard-grid {

                display: grid;

                grid-template-columns:
                    repeat(
                        4,
                        minmax(
                            0,
                            1fr
                        )
                    );

                gap:
                    var(--space-4);

            }


            .client-dashboard-stat {

                min-height: 116px;

                display: flex;

                align-items: center;

                gap: 14px;

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

                text-decoration:
                    none;

                transition:
                    transform
                    var(--transition),

                    box-shadow
                    var(--transition),

                    border-color
                    var(--transition);

            }


            .client-dashboard-stat:hover {

                border-color:
                    var(--border-dark);

                transform:
                    translateY(-2px);

                box-shadow:
                    var(--shadow-md);

            }


            .client-dashboard-stat-icon {

                width: 45px;

                height: 45px;

                flex: 0 0 45px;

                display: grid;

                place-items: center;

                border-radius:
                    var(--radius-md);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

                font-size: 19px;

            }


            .client-dashboard-stat-content {

                min-width: 0;

                display: flex;

                flex-direction: column;

            }


            .client-dashboard-stat-content span {

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

            }


            .client-dashboard-stat-content strong {

                margin-top: 5px;

                color:
                    var(--text);

                font-size:
                    var(--font-size-2xl);

                font-weight:
                    var(--font-extrabold);

                line-height:
                    1.25;

                word-break:
                    break-word;

            }


            /* =================================================
               COLUMNS
               ================================================= */

            .client-dashboard-columns {

                display: grid;

                grid-template-columns:
                    minmax(
                        0,
                        1.5fr
                    )
                    minmax(
                        320px,
                        1fr
                    );

                gap:
                    var(--space-5);

            }


            /* =================================================
               CARD
               ================================================= */

            .client-dashboard-card {

                min-width: 0;

                padding:
                    var(--space-6);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-lg);

                background:
                    var(--surface);

                box-shadow:
                    var(--shadow-sm);

            }


            .client-dashboard-card-header {

                display: flex;

                align-items: flex-start;

                justify-content: space-between;

                gap:
                    var(--space-5);

                margin-bottom:
                    var(--space-5);

            }


            .client-dashboard-card-header span {

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-bold);

                text-transform:
                    uppercase;

                letter-spacing:
                    .06em;

            }


            .client-dashboard-card-header h3 {

                margin: 4px 0 0;

                color:
                    var(--text);

                font-size:
                    var(--font-size-lg);

                font-weight:
                    var(--font-bold);

            }


            .client-dashboard-link {

                color:
                    var(--primary);

                font-size:
                    var(--font-size-sm);

                font-weight:
                    var(--font-semibold);

                white-space:
                    nowrap;

                text-decoration:
                    none;

            }


            .client-dashboard-link:hover {

                color:
                    var(--support-purple);

            }


            /* =================================================
               PROJECT LIST
               ================================================= */

            .client-dashboard-project-list {

                display: flex;

                flex-direction: column;

                gap:
                    var(--space-3);

            }


            .client-dashboard-project-item {

                display: flex;

                align-items: center;

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
                    var(--surface-soft);

                text-decoration:
                    none;

                transition:
                    transform
                    var(--transition),

                    border-color
                    var(--transition),

                    background
                    var(--transition),

                    box-shadow
                    var(--transition);

            }


            .client-dashboard-project-item:hover {

                border-color:
                    var(--primary-light);

                background:
                    var(--surface);

                transform:
                    translateY(-1px);

                box-shadow:
                    var(--shadow-sm);

            }


            .client-dashboard-project-icon {

                width: 42px;

                height: 42px;

                flex: 0 0 42px;

                display: grid;

                place-items: center;

                border-radius:
                    var(--radius-md);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

            }


            .client-dashboard-project-content {

                min-width: 0;

                flex: 1;

            }


            .client-dashboard-project-top {

                display: flex;

                align-items: center;

                justify-content: space-between;

                gap:
                    var(--space-2);

            }


            .client-dashboard-project-top strong {

                overflow: hidden;

                color:
                    var(--text);

                font-size:
                    var(--font-size-sm);

                font-weight:
                    var(--font-semibold);

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;

            }


            .client-dashboard-status {

                flex: 0 0 auto;

                padding:
                    4px 8px;

                border-radius:
                    var(--radius-full);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-bold);

            }


            .client-dashboard-status-completed,
            .client-dashboard-status-complete {

                background:
                    var(--green-soft);

                color:
                    var(--success);

            }


            .client-dashboard-status-cancelled,
            .client-dashboard-status-canceled {

                background:
                    var(--red-soft);

                color:
                    var(--danger);

            }


            .client-dashboard-status-on-hold,
            .client-dashboard-status-onhold {

                background:
                    var(--yellow-soft);

                color:
                    var(--warning);

            }


            .client-dashboard-project-meta {

                display: flex;

                gap:
                    var(--space-3);

                margin-top: 5px;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

                flex-wrap:
                    wrap;

            }


            .client-dashboard-project-progress {

                display: flex;

                align-items: center;

                gap:
                    var(--space-2);

                margin-top: 9px;

            }


            .client-dashboard-project-progress-track {

                height: 5px;

                flex: 1;

                overflow: hidden;

                border-radius:
                    var(--radius-full);

                background:
                    var(--border-light);

            }


            .client-dashboard-project-progress-fill {

                height: 100%;

                border-radius:
                    inherit;

                background:
                    var(--primary);

                transition:
                    width
                    var(--transition-slow);

            }


            .client-dashboard-project-progress strong {

                min-width: 31px;

                color:
                    var(--primary);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-bold);

                text-align:
                    right;

            }


            .client-dashboard-project-arrow {

                flex: 0 0 auto;

                color:
                    var(--muted);

            }


            /* =================================================
               EMPTY
               ================================================= */

            .client-dashboard-empty {

                min-height: 190px;

                display: flex;

                align-items: center;

                justify-content: center;

                flex-direction: column;

                text-align:
                    center;

            }


            .client-dashboard-empty-icon {

                width: 48px;

                height: 48px;

                display: grid;

                place-items: center;

                margin-bottom: 10px;

                border-radius:
                    var(--radius-full);

                background:
                    var(--primary-soft);

                color:
                    var(--primary);

            }


            .client-dashboard-empty h4 {

                margin: 0;

                color:
                    var(--text);

                font-size:
                    var(--font-size-md);

                font-weight:
                    var(--font-semibold);

            }


            .client-dashboard-empty p {

                max-width: 350px;

                margin: 7px 0 0;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-sm);

                line-height:
                    1.6;

            }


            /* =================================================
               PAYMENT
               ================================================= */

            .client-dashboard-payment {

                display: flex;

                align-items: center;

                gap:
                    var(--space-3);

                padding:
                    var(--space-4);

                border:
                    1px solid
                    var(--border-light);

                border-radius:
                    var(--radius-md);

                background:
                    var(--surface-soft);

            }


            .client-dashboard-payment-icon {

                width: 46px;

                height: 46px;

                flex: 0 0 46px;

                display: grid;

                place-items: center;

                border-radius:
                    var(--radius-md);

                background:
                    var(--green-soft);

                color:
                    var(--success);

                font-size: 19px;

            }


            .client-dashboard-payment div:last-child {

                display: flex;

                flex-direction: column;

                min-width: 0;

            }


            .client-dashboard-payment strong {

                color:
                    var(--text);

                font-size:
                    var(--font-size-2xl);

                font-weight:
                    var(--font-extrabold);

            }


            .client-dashboard-payment span {

                margin-top: 3px;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

            }


            .client-dashboard-payment-summary {

                display: grid;

                grid-template-columns:
                    repeat(
                        2,
                        minmax(
                            0,
                            1fr
                        )
                    );

                gap:
                    var(--space-2);

                margin-top:
                    var(--space-3);

            }


            .client-dashboard-payment-summary > div {

                display: flex;

                flex-direction: column;

                gap: 4px;

                padding:
                    var(--space-3);

                border:
                    1px solid
                    var(--border);

                border-radius:
                    var(--radius-sm);

                background:
                    var(--surface);

            }


            .client-dashboard-payment-summary span {

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

            }


            .client-dashboard-payment-summary strong {

                color:
                    var(--text);

                font-size:
                    var(--font-size-sm);

                font-weight:
                    var(--font-bold);

            }


            /* =================================================
               PAYMENT PROGRESS
               ================================================= */

            .client-dashboard-progress {

                margin-top:
                    var(--space-5);

            }


            .client-dashboard-progress-head {

                display: flex;

                justify-content: space-between;

                gap:
                    var(--space-2);

                margin-bottom: 8px;

                color:
                    var(--text-secondary);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

            }


            .client-dashboard-progress-head strong {

                color:
                    var(--primary);

            }


            .client-progress-track {

                height: 8px;

                overflow: hidden;

                border-radius:
                    var(--radius-full);

                background:
                    var(--border-light);

            }


            .client-progress-fill {

                height: 100%;

                border-radius:
                    inherit;

                background:
                    var(--primary);

                transition:
                    width
                    var(--transition-slow);

            }


            /* =================================================
               MILESTONES
               ================================================= */

            .client-dashboard-milestone-list {

                display: flex;

                flex-direction: column;

                gap:
                    var(--space-3);

            }


            .client-dashboard-milestone-item {

                display: flex;

                align-items: center;

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
                    var(--surface-soft);

                transition:
                    border-color
                    var(--transition),

                    background
                    var(--transition);

            }


            .client-dashboard-milestone-item:hover {

                border-color:
                    var(--border-dark);

                background:
                    var(--surface);

            }


            .client-dashboard-milestone-icon {

                width: 42px;

                height: 42px;

                flex: 0 0 42px;

                display: grid;

                place-items: center;

                border-radius:
                    var(--radius-md);

                background:
                    var(--purple-soft);

                color:
                    var(--support-purple);

            }


            .client-dashboard-milestone-content {

                min-width: 0;

                flex: 1;

            }


            .client-dashboard-milestone-content > strong {

                display: block;

                overflow: hidden;

                color:
                    var(--text);

                font-size:
                    var(--font-size-sm);

                font-weight:
                    var(--font-semibold);

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;

            }


            .client-dashboard-milestone-content > span {

                display: block;

                margin-top: 3px;

                overflow: hidden;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

                text-overflow:
                    ellipsis;

                white-space:
                    nowrap;

            }


            .client-dashboard-milestone-progress {

                display: flex;

                align-items: center;

                gap:
                    7px;

                margin-top: 8px;

            }


            .client-dashboard-milestone-progress-track {

                height: 4px;

                flex: 1;

                overflow: hidden;

                border-radius:
                    var(--radius-full);

                background:
                    var(--border-light);

            }


            .client-dashboard-milestone-progress-fill {

                height: 100%;

                border-radius:
                    inherit;

                background:
                    var(--primary);

            }


            .client-dashboard-milestone-progress small {

                min-width: 27px;

                color:
                    var(--primary);

                font-size:
                    var(--font-size-xs);

                text-align:
                    right;

            }


            .client-dashboard-milestone-date {

                flex: 0 0 auto;

                display: flex;

                align-items: flex-end;

                flex-direction: column;

                gap: 4px;

            }


            .client-dashboard-milestone-date span {

                color:
                    var(--muted);

                font-size:
                    var(--font-size-xs);

            }


            .client-dashboard-milestone-date strong {

                color:
                    var(--text);

                font-size:
                    var(--font-size-xs);

                font-weight:
                    var(--font-semibold);

            }


            /* =================================================
               LOADING
               ================================================= */

            .client-dashboard-loading {

                min-height: 400px;

                display: flex;

                align-items: center;

                justify-content: center;

                flex-direction: column;

                gap: 8px;

                color:
                    var(--muted);

                text-align:
                    center;

            }


            .client-dashboard-loading strong {

                color:
                    var(--text);

                font-size:
                    var(--font-size-md);

            }


            .client-dashboard-loading > span {

                font-size:
                    var(--font-size-sm);

            }


            .client-dashboard-loading-spinner {

                width: 42px;

                height: 42px;

                display: grid;

                place-items: center;

                margin-bottom: 6px;

                border:
                    3px solid
                    var(--primary-soft);

                border-top-color:
                    var(--primary);

                border-radius:
                    var(--radius-full);

                animation:
                    clientDashboardSpin
                    .8s linear infinite;

            }


            @keyframes clientDashboardSpin {

                to {

                    transform:
                        rotate(360deg);

                }

            }


            /* =================================================
               ERROR
               ================================================= */

            .client-dashboard-error {

                min-height: 400px;

                display: flex;

                align-items: center;

                justify-content: center;

                flex-direction: column;

                padding:
                    var(--space-8);

                text-align:
                    center;

            }


            .client-dashboard-error-icon {

                width: 54px;

                height: 54px;

                display: grid;

                place-items: center;

                margin-bottom: 12px;

                border-radius:
                    var(--radius-full);

                background:
                    var(--red-soft);

                color:
                    var(--danger);

                font-size: 21px;

            }


            .client-dashboard-error h3 {

                margin: 0;

                color:
                    var(--text);

                font-size:
                    var(--font-size-lg);

                font-weight:
                    var(--font-bold);

            }


            .client-dashboard-error p {

                max-width: 450px;

                margin: 8px 0 18px;

                color:
                    var(--muted);

                font-size:
                    var(--font-size-sm);

                line-height:
                    1.6;

            }


            .client-dashboard-retry {

                display: inline-flex;

                align-items: center;

                justify-content: center;

                gap: 7px;

                min-height:
                    var(--button-height);

                padding:
                    0 var(--space-4);

                border:
                    0;

                border-radius:
                    var(--radius-sm);

                background:
                    var(--primary);

                color:
                    var(--surface);

                font-family:
                    inherit;

                font-size:
                    var(--font-size-sm);

                font-weight:
                    var(--font-semibold);

                cursor:
                    pointer;

                transition:
                    background
                    var(--transition),

                    transform
                    var(--transition);

            }


            .client-dashboard-retry:hover {

                background:
                    var(--support-purple);

                transform:
                    translateY(-1px);

            }


            .client-dashboard-retry:focus-visible {

                outline:
                    none;

                box-shadow:
                    var(--focus-ring);

            }


            /* =================================================
               RESPONSIVE
               ================================================= */

            @media (max-width: 1100px) {

                .client-dashboard-grid {

                    grid-template-columns:
                        repeat(
                            2,
                            minmax(
                                0,
                                1fr
                            )
                        );

                }


                .client-dashboard-columns {

                    grid-template-columns:
                        1fr;

                }

            }


            @media (max-width: 700px) {

                .client-dashboard {

                    gap:
                        var(--space-4);

                }


                .client-dashboard-welcome {

                    min-height:
                        170px;

                    padding:
                        var(--space-6);

                }


                .client-dashboard-welcome h2 {

                    font-size:
                        var(--font-size-2xl);

                }


                .client-dashboard-welcome p {

                    font-size:
                        var(--font-size-sm);

                }


                .client-dashboard-welcome-icon {

                    display:
                        none;

                }


                .client-dashboard-grid {

                    grid-template-columns:
                        1fr;

                }


                .client-dashboard-card {

                    padding:
                        var(--space-5);

                }


                .client-dashboard-project-top {

                    align-items:
                        flex-start;

                    flex-direction:
                        column;

                    gap:
                        5px;

                }


                .client-dashboard-project-meta {

                    flex-wrap:
                        wrap;

                }


                .client-dashboard-milestone-item {

                    align-items:
                        flex-start;

                }


                .client-dashboard-milestone-date {

                    display:
                        none;

                }


                .client-dashboard-payment-summary {

                    grid-template-columns:
                        1fr;

                }

            }


            @media (max-width: 480px) {

                .client-dashboard-welcome {

                    padding:
                        var(--space-5);

                    border-radius:
                        var(--radius-lg);

                }


                .client-dashboard-welcome h2 {

                    font-size:
                        var(--font-size-xl);

                }


                .client-dashboard-card {

                    padding:
                        var(--space-4);

                }


                .client-dashboard-card-header {

                    gap:
                        var(--space-3);

                }


                .client-dashboard-card-header h3 {

                    font-size:
                        var(--font-size-md);

                }


                .client-dashboard-link {

                    font-size:
                        var(--font-size-xs);

                }


                .client-dashboard-project-item {

                    padding:
                        var(--space-3);

                }

            }


            /* =================================================
               REDUCED MOTION
               ================================================= */

            @media (prefers-reduced-motion: reduce) {

                .client-dashboard *,
                .client-dashboard::before,
                .client-dashboard::after {

                    scroll-behavior:
                        auto !important;

                    transition:
                        none !important;

                    animation:
                        none !important;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* ========================================================
       REFRESH
       ======================================================== */

    async function refresh() {

        if (
            destroyed ||
            !container
        ) {

            return false;

        }


        initialized = false;

        renderLoading();


        try {

            await loadDashboardData();


            if (
                destroyed
            ) {

                return false;

            }


            render();

            initialized = true;


            return true;

        } catch (error) {

            console.error(
                "[Tenspick Client Dashboard] Refresh failed:",
                error
            );


            if (!destroyed) {

                renderError(
                    getErrorMessage(
                        error
                    )
                );

            }


            return false;

        }

    }


    /* ========================================================
       DESTROY
       ======================================================== */

    function destroy() {

        destroyed = true;

        requestSequence++;

        container = null;

        initialized = false;

        loading = false;

        projects = [];

        payments = [];

        paymentSummary = null;

    }


    /* ========================================================
       GETTERS
       ======================================================== */

    function getProjects() {

        return projects.slice();

    }


    function getPayments() {

        return payments.slice();

    }


    function getPaymentSummary() {

        return paymentSummary
            ? {
                ...paymentSummary
            }
            : null;

    }


    function isInitialized() {

        return initialized;

    }


    /* ========================================================
       PUBLIC MODULE
       ======================================================== */

    window.TenspickClientDashboard = {

        init:
            init,

        render:
            render,

        refresh:
            refresh,

        destroy:
            destroy,

        getProjects:
            getProjects,

        getPayments:
            getPayments,

        getPaymentSummary:
            getPaymentSummary,

        isInitialized:
            isInitialized,

    };


})(window, document);