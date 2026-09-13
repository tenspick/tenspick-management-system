/* ============================================================
   TENSPICK CRM
   SPA ROUTER
   FINAL VERSION
   ============================================================ */

(function (window, document) {

    "use strict";


    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const CONFIG = {

        contentSelector: "#app-content",

        defaultRoute: "dashboard",

        debug: true

    };


    /* ============================================================
       ROUTES
       ============================================================ */

    const ROUTES = {

        dashboard:
            "pages/dashboard/dashboard.html",

        leads:
            "pages/leads/leads.html",

        clients:
            "pages/clients/clients.html",

        projects:
            "pages/projects/projects.html",

        tasks:
            "pages/tasks/tasks.html",

        staff:
            "pages/staff/staff.html",

        "client-payments":
            "pages/client-payments/client-payments.html",

        "staff-payments":
            "pages/staff-payments/staff-payments.html",

        expenses:
            "pages/expenses/expenses.html",

        chat:
            "pages/chat/chat.html",

        notifications:
            "pages/notifications/notifications.html",

        "website-content":
            "pages/website-content/website-content.html",

        settings:
            "pages/settings/settings.html",

        "activity-logs":
            "pages/activity-logs/activity-logs.html",

        profile:
            "pages/profile/profile.html",

        calendar:
            "pages/calendar/calendar.html",

        attendance:
            "pages/attendance/attendance.html",

        documents:
            "pages/documents/documents.html",

        reports:
            "pages/reports/reports.html"

    };


    /* ============================================================
       PAGE CSS
       ============================================================ */

    const PAGE_CSS = {

        dashboard:
            "assets/css/dashboard.css",

        leads:
            "assets/css/leads.css",

        clients:
            "assets/css/clients.css",

        projects:
            "assets/css/projects.css",

        tasks:
            "assets/css/tasks.css",

        staff:
            "assets/css/staff.css",

        "client-payments":
            "assets/css/payments.css",

        "staff-payments":
            "assets/css/staff-payments.css",

        expenses:
            "assets/css/expenses.css",

        chat:
            "assets/css/chat.css",

        notifications:
            "assets/css/notifications.css",

        "website-content":
            "assets/css/website-content.css",

        settings:
            "assets/css/settings.css",

        "activity-logs":
            "assets/css/activity-logs.css",

        profile:
            "assets/css/profile.css",

        calendar:
            "assets/css/calendar.css",

        attendance:
            "assets/css/attendance.css",

        documents:
            "assets/css/documents.css",

        reports:
            "assets/css/reports.css"

    };


    /* ============================================================
       PAGE META
       ============================================================ */

    const PAGE_META = {

        dashboard: {
            title: "Dashboard",
            subtitle:
                "Overview of your company operations"
        },

        leads: {
            title: "Leads",
            subtitle:
                "Manage your business leads and follow-ups"
        },

        clients: {
            title: "Clients",
            subtitle:
                "Manage your company clients"
        },

        projects: {
            title: "Projects",
            subtitle:
                "Manage and track client projects"
        },

        tasks: {
            title: "Tasks",
            subtitle:
                "Assign and manage staff tasks"
        },

        staff: {
            title: "Staff",
            subtitle:
                "Manage your company staff"
        },

        "client-payments": {
            title: "Client Payments",
            subtitle:
                "Record and manage client payments"
        },

        "staff-payments": {
            title: "Staff Payments",
            subtitle:
                "Record and manage staff payments"
        },

        expenses: {
            title: "Expenses Management",
            subtitle:
                "Track, manage, and audit operating & project expenses"
        },

        chat: {
            title: "Chat",
            subtitle:
                "Communicate with clients"
        },

        notifications: {
            title: "Notifications",
            subtitle:
                "Manage company notifications"
        },

        "website-content": {
            title: "Website Content",
            subtitle:
                "Manage your website content"
        },

        settings: {
            title: "Settings",
            subtitle:
                "Manage application settings"
        },

        "activity-logs": {
            title: "Activity Logs",
            subtitle:
                "View administrative activity"
        },

        profile: {
            title: "My Profile",
            subtitle:
                "View & edit your user account details"
        },

        calendar: {
            title: "Calendar & Meetings",
            subtitle:
                "View schedule and manage team meetings"
        },

        attendance: {
            title: "Leave & Attendance",
            subtitle:
                "Clock daily attendance and apply for leaves"
        },

        documents: {
            title: "Assigned Documents",
            subtitle:
                "View and manage project documents and files"
        },

        reports: {
            title: "Work Reports",
            subtitle:
                "View performance metrics and project progress"
        }

    };


    /* ============================================================
       STATE
       ============================================================ */

    let currentRoute = null;

    let loading = false;

    let initialized = false;

    let navigationId = 0;


    /* ============================================================
       LOGGING
       ============================================================ */

    function log() {

        if (!CONFIG.debug) {
            return;
        }

        console.log(
            "[Tenspick Router]",
            ...arguments
        );

    }


    function warn() {

        if (!CONFIG.debug) {
            return;
        }

        console.warn(
            "[Tenspick Router]",
            ...arguments
        );

    }


    function routerError() {

        console.error(
            "[Tenspick Router]",
            ...arguments
        );

    }


    /* ============================================================
       CONTENT
       ============================================================ */

    function getContent() {

        return document.querySelector(
            CONFIG.contentSelector
        );

    }


    /* ============================================================
       ROUTE NORMALIZATION
       ============================================================ */

    function normalizeRoute(route) {

        if (
            route === null ||
            route === undefined
        ) {

            return CONFIG.defaultRoute;

        }


        let value =
            String(route)
                .trim()
                .toLowerCase();


        value =
            value
                .replace(/^#\/?/, "")
                .replace(/^\/+/, "")
                .split("?")[0]
                .replace(/\/+$/, "");


        if (
            !value ||
            value === "index.php" ||
            value === "index.html"
        ) {

            return CONFIG.defaultRoute;

        }


        return value;

    }


    /* ============================================================
       ROUTE EXISTS
       ============================================================ */

    function routeExists(route) {

        return Object.prototype.hasOwnProperty.call(
            ROUTES,
            route
        );

    }


    /* ============================================================
       URL ROUTE
       ============================================================ */

    function getRouteFromUrl() {

        const hash =
            window.location.hash;


        if (!hash) {

            return CONFIG.defaultRoute;

        }


        return normalizeRoute(hash);

    }


    /* ============================================================
       UPDATE URL
       ============================================================ */

    function updateUrl(
        route,
        replace
    ) {

        const hash =
            "#" + route;


        if (
            window.location.hash === hash
        ) {

            return;

        }


        if (replace) {

            window.history.replaceState(
                {
                    route: route
                },
                "",
                window.location.pathname +
                window.location.search +
                hash
            );

        } else {

            window.history.pushState(
                {
                    route: route
                },
                "",
                window.location.pathname +
                window.location.search +
                hash
            );

        }

    }


    /* ============================================================
       HTML ESCAPE
       ============================================================ */

    function escapeHtml(value) {

        const div =
            document.createElement("div");


        div.textContent =
            String(value ?? "");


        return div.innerHTML;

    }


    /* ============================================================
       LOADING UI
       ============================================================ */

    function showLoading() {

        const content =
            getContent();


        if (!content) {
            return;
        }


        content.innerHTML = `

            <div class="spa-loading">

                <div class="spa-loading-spinner"></div>

                <span>
                    Loading...
                </span>

            </div>

        `;

    }


    /* ============================================================
       ERROR UI
       ============================================================ */

    function showError(message) {

        const content =
            getContent();


        if (!content) {
            return;
        }


        content.innerHTML = `

            <div class="spa-error">

                <div class="spa-error-icon">
                    !
                </div>

                <h2>
                    Unable to load page
                </h2>

                <p>
                    ${escapeHtml(message)}
                </p>

                <button
                    type="button"
                    class="spa-error-retry"
                    data-spa-retry
                >
                    Try Again
                </button>

            </div>

        `;

    }


    /* ============================================================
       FETCH PAGE
       ============================================================ */

    async function fetchPage(route) {

        const url =
            ROUTES[route];


        if (!url) {

            throw new Error(
                "Unknown route."
            );

        }


        log(
            "Fetching page:",
            url
        );


        const response =
            await fetch(
                url,
                {

                    method: "GET",

                    credentials:
                        "same-origin",

                    headers: {

                        "Accept":
                            "text/html",

                        "X-SPA-Request":
                            "1"

                    },

                    cache:
                        "no-store"

                }
            );


        if (!response.ok) {

            throw new Error(
                "Page request failed (" +
                response.status +
                ")."
            );

        }


        const html =
            await response.text();


        if (!html.trim()) {

            throw new Error(
                "The requested page returned empty content."
            );

        }


        return html;

    }


    /* ============================================================
       LOAD PAGE CSS
       ============================================================ */

    function loadPageCss(route) {

        document
            .querySelectorAll(
                "link[data-tenspick-page-css]"
            )
            .forEach(
                function (link) {

                    link.remove();

                }
            );


        const cssFile =
            PAGE_CSS[route];


        if (!cssFile) {
            return;
        }


        const link =
            document.createElement("link");


        link.rel =
            "stylesheet";


        link.href =
            cssFile;


        link.dataset.tenspickPageCss =
            route;


        document.head.appendChild(
            link
        );


        log(
            "Loaded CSS:",
            cssFile
        );

    }


    /* ============================================================
       UPDATE META
       ============================================================ */

    function updateMeta(route) {

        const meta =
            PAGE_META[route] ||
            PAGE_META.dashboard;


        const title =
            document.querySelector(
                ".topbar-heading h1"
            );


        const subtitle =
            document.querySelector(
                ".topbar-heading p"
            );


        if (title) {

            title.textContent =
                meta.title;

        }


        if (subtitle) {

            subtitle.textContent =
                meta.subtitle;

        }


        document.title =
            "Tenspick | " +
            meta.title;

    }


    /* ============================================================
       UPDATE SIDEBAR
       ============================================================ */

    function updateSidebar(route) {

        document
            .querySelectorAll(
                ".sidebar-menu-item"
            )
            .forEach(
                function (item) {

                    item.classList.remove(
                        "active"
                    );


                    const href =
                        item.getAttribute(
                            "href"
                        );


                    if (!href) {
                        return;
                    }


                    const itemRoute =
                        normalizeRoute(
                            href
                        );


                    if (
                        itemRoute === route
                    ) {

                        item.classList.add(
                            "active"
                        );

                    }

                }
            );

    }


    /* ============================================================
       GET MODULE
       ============================================================ */

    function getModule(route) {

        switch (route) {

            case "dashboard":
                return window.TenspickDashboard;

            case "leads":
                return window.TenspickLeads;

            case "clients":
                return window.TenspickClients;

            case "projects":
                return window.TenspickProjects;

            case "tasks":
                return window.TenspickTasks;

            case "staff":
                return window.TenspickStaff;

            case "client-payments":
                return window.TenspickClientPayments;

            case "staff-payments":
                return window.TenspickStaffPayments;

            case "expenses":
                return window.TenspickExpenses;

            case "chat":
                return window.TenspickChat;

            case "notifications":
                return window.TenspickNotifications;

            case "website-content":
                return window.TenspickWebsiteContent;

            case "settings":
                return window.TenspickSettings;

            case "activity-logs":
                return window.TenspickActivityLogs;

            case "profile":
                return window.TenspickProfile;

            case "calendar":
                return window.TenspickCalendar;

            case "attendance":
                return window.TenspickAttendance;

            case "documents":
                return window.TenspickDocuments;

            case "reports":
                return window.TenspickReports;

            default:
                return null;

        }

    }


    /* ============================================================
       DESTROY MODULE
       ============================================================ */

    function destroyModule(route) {

        if (!route) {
            return;
        }


        const module =
            getModule(route);


        if (
            module &&
            typeof module.destroy === "function"
        ) {

            try {

                module.destroy();


                log(
                    "Module destroyed:",
                    route
                );

            } catch (error) {

                warn(
                    "Module destroy failed:",
                    route,
                    error
                );

            }

        }

    }


    /* ============================================================
       INITIALIZE MODULE
       ============================================================ */

    function initializeModule(route) {

        const module =
            getModule(route);


        if (!module) {

            warn(
                "No module registered for:",
                route
            );

            return;

        }


        if (
            typeof module.init !== "function"
        ) {

            warn(
                "Module has no init():",
                route
            );

            return;

        }


        try {

            module.init();


            log(
                "Module initialized:",
                route
            );

        } catch (error) {

            routerError(
                "Module initialization failed:",
                route,
                error
            );

        }

    }


    /* ============================================================
       LOAD ROUTE
       ============================================================ */

    async function loadRoute(
        requestedRoute,
        options
    ) {

        options =
            options || {};


        let route =
            normalizeRoute(
                requestedRoute
            );


        if (!routeExists(route)) {

            warn(
                "Unknown route:",
                route
            );


            route =
                CONFIG.defaultRoute;

        }

        // RBAC Route Guard: Block Staff from accessing restricted pages
        if (window.TenspickAuth && window.TenspickAuth.isStaff()) {
            const adminOnlyRoutes = ["client-payments", "staff-payments", "settings", "activity-logs", "staff", "projects", "website-content"];
            if (adminOnlyRoutes.includes(route)) {
                warn("Access denied for staff user to route:", route);
                route = CONFIG.defaultRoute;
                updateUrl(route, true);
            }
        }


        const requestId =
            ++navigationId;


        loading =
            true;


        try {

            const content =
                getContent();


            if (!content) {

                throw new Error(
                    "SPA container #app-content was not found."
                );

            }


            /*
             * Stop the previous module before
             * replacing its DOM.
             */

            if (
                currentRoute &&
                currentRoute !== route
            ) {

                destroyModule(
                    currentRoute
                );

            }


            showLoading();


            const html =
                await fetchPage(
                    route
                );


            /*
             * A newer navigation has started.
             * Ignore this old request.
             */

            if (
                requestId !== navigationId
            ) {

                return;

            }


            loadPageCss(
                route
            );


            content.innerHTML =
                html;


            currentRoute =
                route;


            updateMeta(
                route
            );


            updateSidebar(
                route
            );


            initializeModule(
                route
            );


            content.scrollTop =
                0;


            window.scrollTo(
                {
                    top: 0,
                    behavior: "auto"
                }
            );


            if (
                options.updateUrl !== false
            ) {

                updateUrl(
                    route,
                    options.replace === true
                );

            }


            document.dispatchEvent(
                new CustomEvent(
                    "tenspick:page-loaded",
                    {
                        detail: {

                            route:
                                route,

                            container:
                                content

                        }
                    }
                )
            );


            log(
                "Route loaded successfully:",
                route
            );

        } catch (error) {

            routerError(
                "Route loading failed:",
                route,
                error
            );


            if (
                requestId === navigationId
            ) {

                showError(
                    error.message ||
                    "Unable to load page."
                );

            }

        } finally {

            if (
                requestId === navigationId
            ) {

                loading =
                    false;

            }

        }

    }


    /* ============================================================
       NAVIGATION
       ============================================================ */

    function navigate(
        route,
        options
    ) {

        const normalizedRoute =
            normalizeRoute(
                route
            );


        if (
            !routeExists(
                normalizedRoute
            )
        ) {

            warn(
                "Navigation ignored. Unknown route:",
                normalizedRoute
            );


            return Promise.resolve();

        }


        return loadRoute(
            normalizedRoute,
            options
        );

    }


    /* ============================================================
       NAVIGATION CLICK
       ============================================================ */

    function handleNavigationClick(event) {

        const link =
            event.target.closest(
                "a"
            );


        if (!link) {
            return;
        }


        if (
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {

            return;

        }


        if (
            link.target === "_blank" ||
            link.hasAttribute("download")
        ) {

            return;

        }


        const href =
            link.getAttribute(
                "href"
            );


        if (!href) {
            return;
        }


        if (
            !href.startsWith("#")
        ) {

            return;

        }


        /*
         * Do not intercept links inside
         * application modals.
         */

        if (
            link.closest(".modal") ||
            link.closest(
                ".lead-profile-modal"
            ) ||
            link.closest(
                ".client-profile-modal"
            )
        ) {

            return;

        }


        const route =
            normalizeRoute(
                href
            );


        if (
            !routeExists(route)
        ) {

            return;

        }


        event.preventDefault();


        navigate(
            route
        );

    }


    /* ============================================================
       RETRY
       ============================================================ */

    function handleRetry(event) {

        const button =
            event.target.closest(
                "[data-spa-retry]"
            );


        if (!button) {
            return;
        }


        event.preventDefault();


        navigate(
            currentRoute ||
            CONFIG.defaultRoute,
            {
                force: true
            }
        );

    }


    /* ============================================================
       HASH CHANGE
       ============================================================ */

    function handleHashChange() {

        const route =
            getRouteFromUrl();


        if (
            route !== currentRoute
        ) {

            loadRoute(
                route,
                {
                    updateUrl: false
                }
            );

        }

    }


    /* ============================================================
       POP STATE
       ============================================================ */

    function handlePopState() {

        const route =
            getRouteFromUrl();


        if (
            route !== currentRoute
        ) {

            loadRoute(
                route,
                {
                    updateUrl: false
                }
            );

        }

    }


    /* ============================================================
       GLOBAL EVENTS
       ============================================================ */

    function bindEvents() {

        document.addEventListener(
            "click",
            handleNavigationClick
        );


        document.addEventListener(
            "click",
            handleRetry
        );


        window.addEventListener(
            "hashchange",
            handleHashChange
        );


        window.addEventListener(
            "popstate",
            handlePopState
        );

    }


    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.TenspickRouter = {

        navigate:
            navigate,

        loadRoute:
            loadRoute,

        getCurrentRoute:
            function () {

                return currentRoute;

            },

        getRoutes:
            function () {

                return {
                    ...ROUTES
                };

            },

        isLoading:
            function () {

                return loading;

            },

        refresh:
            function () {

                if (!currentRoute) {
                    return;
                }


                return loadRoute(
                    currentRoute,
                    {
                        force: true,
                        updateUrl: false
                    }
                );

            }

    };


    /* ============================================================
       INITIALIZE
       ============================================================ */

    function initialize() {

        if (initialized) {
            return;
        }


        initialized =
            true;


        log(
            "Router initializing..."
        );


        bindEvents();


        const route =
            getRouteFromUrl();


        loadRoute(
            route,
            {
                replace: true
            }
        );

    }


    /* ============================================================
       DOM READY
       ============================================================ */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );

    } else {

        initialize();

    }


})(window, document);