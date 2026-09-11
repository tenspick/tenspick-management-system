"use strict";

/**
 * ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL
 * SPA ROUTER
 *
 * File:
 * assets/js/client-router.js
 *
 * ============================================================
 *
 * ROUTES
 *
 * #dashboard
 * #projects
 * #projects/{id}
 * #progress
 * #progress/{id}
 * #milestones
 * #milestones/{id}
 * #payments
 * #payments/{id}
 * #chat
 * #notifications
 * #profile
 *
 * ============================================================
 *
 * IMPORTANT
 *
 * This router does NOT handle client_id.
 *
 * Authentication and client ownership are controlled
 * by the backend client session.
 *
 * ============================================================
 */

(function (window, document) {

    "use strict";


    /* ========================================================
       CONFIGURATION
       ======================================================== */

    const CONFIG = {

        contentSelector:
            "#clientPageContainer",

        defaultRoute:
            "dashboard",

        debug:
            true

    };


    /* ========================================================
       ROUTES
       ======================================================== */

    const ROUTES = {

        dashboard: {

            title:
                "Dashboard",

            subtitle:
                "Overview of your projects and account"

        },


        projects: {

            title:
                "My Projects",

            subtitle:
                "View and track all your projects"

        },


        progress: {

            title:
                "Project Progress",

            subtitle:
                "Track your project progress"

        },


        milestones: {

            title:
                "Milestones",

            subtitle:
                "Track project milestones"

        },


        payments: {

            title:
                "Payments",

            subtitle:
                "View your payment history and status"

        },


        chat: {

            title:
                "Chat with Admin",

            subtitle:
                "Communicate with the administrator"

        },


        notifications: {

            title:
                "Notifications",

            subtitle:
                "View your latest notifications"

        },


        profile: {

            title:
                "Profile",

            subtitle:
                "Manage your client profile"

        }

    };


    /* ========================================================
       STATE
       ======================================================== */

    let initialized =
        false;


    let currentRoute =
        null;


    let currentParams =
        {};


    let currentModule =
        null;


    let navigationId =
        0;


    let navigating =
        false;


    /* ========================================================
       LOGGING
       ======================================================== */

    function log() {

        if (!CONFIG.debug) {

            return;

        }


        console.log(
            "[Tenspick Client Router]",
            ...arguments
        );

    }


    function warn() {

        if (!CONFIG.debug) {

            return;

        }


        console.warn(
            "[Tenspick Client Router]",
            ...arguments
        );

    }


    function routerError() {

        console.error(
            "[Tenspick Client Router]",
            ...arguments
        );

    }


    /* ========================================================
       CONTENT
       ======================================================== */

    function getContent() {

        return document.querySelector(
            CONFIG.contentSelector
        );

    }


    /* ========================================================
       ROUTE NORMALIZATION
       ======================================================== */

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
                .replace(
                    /^#\/?/,
                    ""
                )
                .replace(
                    /^\/+/,
                    ""
                )
                .replace(
                    /\/+$/,
                    ""
                );


        if (
            !value ||
            value === "index.php" ||
            value === "index.html"
        ) {

            return CONFIG.defaultRoute;

        }


        return value;

    }


    /* ========================================================
       ROUTE EXISTS
       ======================================================== */

    function routeExists(route) {

        return Object.prototype.hasOwnProperty.call(
            ROUTES,
            route
        );

    }


    /* ========================================================
       PROJECT PARAMETER ROUTES
       ======================================================== */

    function supportsProjectId(route) {

        return (

            route === "projects" ||

            route === "progress" ||

            route === "milestones" ||

            route === "payments"

        );

    }


    /* ========================================================
       PARSE PROJECT ID
       ======================================================== */

    function parseProjectId(value) {

        if (
            value === null ||
            value === undefined
        ) {

            return null;

        }


        let decoded;


        try {

            decoded =
                decodeURIComponent(
                    String(value)
                );

        } catch (error) {

            return null;

        }


        if (
            !/^\d+$/.test(decoded)
        ) {

            return null;

        }


        const id =
            Number(decoded);


        if (
            !Number.isSafeInteger(id) ||
            id <= 0
        ) {

            return null;

        }


        return id;

    }


    /* ========================================================
       PARSE HASH
       ======================================================== */

    function parseHash() {

        return parseHashString(
            window.location.hash || ""
        );

    }


    /* ========================================================
       PARSE HASH STRING
       ======================================================== */

    function parseHashString(hashValue) {

        let hash =
            String(
                hashValue || ""
            );


        hash =
            hash.replace(
                /^#/,
                ""
            );


        hash =
            hash
                .trim()
                .replace(
                    /^\/+/,
                    ""
                );


        /*
         * Empty hash.
         */

        if (!hash) {

            return {

                route:
                    CONFIG.defaultRoute,

                params:
                    {}

            };

        }


        /*
         * Remove query string.
         */

        const hashWithoutQuery =
            hash.split("?")[0];


        /*
         * Split path.
         */

        const parts =
            hashWithoutQuery
                .split("/")
                .filter(
                    function (part) {

                        return (
                            part !== ""
                        );

                    }
                );


        if (
            parts.length === 0
        ) {

            return {

                route:
                    CONFIG.defaultRoute,

                params:
                    {}

            };

        }


        /*
         * Route.
         */

        const route =
            normalizeRoute(
                parts[0]
            );


        const params = {};


        /*
         * Project ID.
         */

        if (
            supportsProjectId(route) &&
            parts[1]
        ) {

            const projectId =
                parseProjectId(
                    parts[1]
                );


            if (
                projectId !== null
            ) {

                params.projectId =
                    projectId;

            }

        }


        return {

            route:
                route,

            params:
                params

        };

    }


    /* ========================================================
       GET MODULE
       ======================================================== */

    function getModule(
        route,
        params
    ) {

        switch (route) {


            /* ----------------------------------------------
               DASHBOARD
               ---------------------------------------------- */

            case "dashboard":

                return (
                    window.TenspickClientDashboard ||
                    null
                );


            /* ----------------------------------------------
               PROJECTS
               ---------------------------------------------- */

            case "projects":

                /*
                 * #projects
                 *
                 * → Project list
                 */

                if (
                    !params ||
                    !Number.isInteger(
                        params.projectId
                    ) ||
                    params.projectId <= 0
                ) {

                    return (
                        window.TenspickClientProjects ||
                        null
                    );

                }


                /*
                 * #projects/{id}
                 *
                 * → Project details
                 */

                return (
                    window.TenspickClientProjectDetails ||
                    null
                );


            /* ----------------------------------------------
               PROGRESS
               ---------------------------------------------- */

            case "progress":

                return (
                    window.TenspickClientProgress ||
                    null
                );


            /* ----------------------------------------------
               MILESTONES
               ---------------------------------------------- */

            case "milestones":

                return (
                    window.TenspickClientMilestones ||
                    null
                );


            /* ----------------------------------------------
               PAYMENTS
               ---------------------------------------------- */

            case "payments":

                return (
                    window.TenspickClientPayments ||
                    null
                );


            /* ----------------------------------------------
               CHAT
               ---------------------------------------------- */

            case "chat":

                return (
                    window.TenspickClientChat ||
                    window.TenspickClientComingSoon ||
                    null
                );


            /* ----------------------------------------------
               NOTIFICATIONS
               ---------------------------------------------- */

            case "notifications":

                return (
                    window.TenspickClientNotifications ||
                    window.TenspickClientComingSoon ||
                    null
                );


            /* ----------------------------------------------
               PROFILE
               ---------------------------------------------- */

            case "profile":

                return (
                    window.TenspickClientProfile ||
                    null
                );


            default:

                return null;

        }

    }


    /* ========================================================
       GET PAGE META
       ======================================================== */

    function getPageMeta(route) {

        return (

            ROUTES[route] ||

            ROUTES[
                CONFIG.defaultRoute
            ]

        );

    }


    /* ========================================================
       UPDATE TOPBAR
       ======================================================== */

    function updateTopbar(route) {

        const meta =
            getPageMeta(
                route
            );


        /*
         * Primary HTML IDs.
         */

        const titleElement =
            document.getElementById(
                "clientPageTitle"
            );


        const subtitleElement =
            document.getElementById(
                "clientPageSubtitle"
            );


        /*
         * Class fallback.
         */

        const classTitle =
            document.querySelector(
                ".client-topbar-title"
            );


        const classSubtitle =
            document.querySelector(
                ".client-topbar-subtitle"
            );


        const title =
            titleElement ||
            classTitle;


        const subtitle =
            subtitleElement ||
            classSubtitle;


        if (title) {

            title.textContent =
                meta.title;

        }


        if (subtitle) {

            subtitle.textContent =
                meta.subtitle;

        }


        /*
         * Also notify topbar component.
         */

        if (
            window.TenspickClientTopbar &&
            typeof window
                .TenspickClientTopbar
                .setPage ===
                "function"
        ) {

            try {

                window
                    .TenspickClientTopbar
                    .setPage(
                        route
                    );

            } catch (error) {

                warn(
                    "Topbar update failed:",
                    error
                );

            }

        }


        document.title =
            "Tenspick | " +
            meta.title;

    }


    /* ========================================================
       UPDATE SIDEBAR
       ======================================================== */

    function updateSidebar(route) {

        const links =
            document.querySelectorAll(
                [
                    ".client-nav-item",
                    "[data-client-route]",
                    ".client-sidebar-link",
                    ".sidebar-menu-item"
                ].join(", ")
            );


        links.forEach(
            function (link) {

                const dataRoute =
                    link.getAttribute(
                        "data-route"
                    );


                const clientRoute =
                    link.getAttribute(
                        "data-client-route"
                    );


                const href =
                    link.getAttribute(
                        "href"
                    );


                let itemRoute =
                    dataRoute ||
                    clientRoute ||
                    "";


                /*
                 * Fallback to href.
                 */

                if (
                    !itemRoute &&
                    href &&
                    href.startsWith("#")
                ) {

                    itemRoute =
                        href
                            .replace(
                                /^#/,
                                ""
                            )
                            .replace(
                                /^\/+/,
                                ""
                            )
                            .split("/")[0];

                }


                itemRoute =
                    normalizeRoute(
                        itemRoute
                    );


                const active =
                    itemRoute === route;


                link.classList.toggle(
                    "active",
                    active
                );


                link.classList.toggle(
                    "is-active",
                    active
                );

            }
        );

    }


    /* ========================================================
       GLOBAL LOADING
       ======================================================== */

    function showGlobalLoading() {

        const loading =
            document.getElementById(
                "clientGlobalLoading"
            );


        const error =
            document.getElementById(
                "clientGlobalError"
            );


        const page =
            document.getElementById(
                "clientPageContainer"
            );


        if (loading) {

            loading.hidden =
                false;

        }


        if (error) {

            error.hidden =
                true;

        }


        if (page) {

            page.hidden =
                true;

        }

    }


    /* ========================================================
       HIDE GLOBAL LOADING
       ======================================================== */

    function hideGlobalLoading() {

        const loading =
            document.getElementById(
                "clientGlobalLoading"
            );


        const page =
            document.getElementById(
                "clientPageContainer"
            );


        if (loading) {

            loading.hidden =
                true;

        }


        if (page) {

            page.hidden =
                false;

        }

    }


    /* ========================================================
       GLOBAL ERROR
       ======================================================== */

    function showGlobalError(message) {

        const loading =
            document.getElementById(
                "clientGlobalLoading"
            );


        const page =
            document.getElementById(
                "clientPageContainer"
            );


        const error =
            document.getElementById(
                "clientGlobalError"
            );


        const messageElement =
            document.getElementById(
                "clientGlobalErrorMessage"
            );


        if (loading) {

            loading.hidden =
                true;

        }


        if (page) {

            page.hidden =
                true;

        }


        if (messageElement) {

            messageElement.textContent =
                message ||
                "Unable to load this page.";

        }


        if (error) {

            error.hidden =
                false;

        }

    }


    /* ========================================================
       HIDE GLOBAL ERROR
       ======================================================== */

    function hideGlobalError() {

        const error =
            document.getElementById(
                "clientGlobalError"
            );


        if (error) {

            error.hidden =
                true;

        }

    }


    /* ========================================================
       DESTROY CURRENT MODULE
       ======================================================== */

    function destroyCurrentModule() {

        if (
            !currentModule
        ) {

            return;

        }


        if (
            typeof currentModule.destroy !==
            "function"
        ) {

            currentModule =
                null;

            return;

        }


        try {

            currentModule.destroy();


            log(
                "Current module destroyed."
            );

        } catch (error) {

            warn(
                "Module destroy failed:",
                error
            );

        }


        currentModule =
            null;

    }


    /* ========================================================
       INITIALIZE MODULE
       ======================================================== */

    async function initializeModule(
        module,
        route,
        params,
        container
    ) {

        if (!module) {

            throw new Error(
                "Client portal module is not available for route: " +
                route
            );

        }


        if (
            typeof module.init !==
            "function"
        ) {

            throw new Error(
                "Client portal module does not provide init(): " +
                route
            );

        }


        log(
            "Initializing:",
            route,
            params
        );


        /*
         * Store current module before initialization.
         *
         * This allows destroy() to be called even when
         * the module starts asynchronous work internally.
         */

        currentModule =
            module;


        const result =
            module.init(
                container,
                params || {}
            );


        /*
         * Support:
         *
         * init()
         *
         * and
         *
         * async init()
         */

        if (
            result &&
            typeof result.then ===
                "function"
        ) {

            await result;

        }

    }


    /* ========================================================
       AUTHENTICATION
       ======================================================== */

    async function ensureAuthenticated() {

        if (
            !window.TenspickClientAuth
        ) {

            throw new Error(
                "Client authentication service is not available."
            );

        }


        /*
         * Already authenticated.
         */

        if (
            typeof window
                .TenspickClientAuth
                .isAuthenticated ===
                "function"
        ) {

            if (
                window
                    .TenspickClientAuth
                    .isAuthenticated()
            ) {

                return true;

            }

        }


        /*
         * Check backend session.
         */

        if (
            typeof window
                .TenspickClientAuth
                .checkSession !==
            "function"
        ) {

            throw new Error(
                "Client session verification is not available."
            );

        }


        return Boolean(
            await window
                .TenspickClientAuth
                .checkSession()
        );

    }


    /* ========================================================
       NAVIGATE
       ======================================================== */

    async function navigate(
        requestedRoute,
        options
    ) {

        options =
            options || {};


        /*
         * Convert request into normalized structure.
         */

        const parsed =
            typeof requestedRoute ===
            "object"
                ? requestedRoute
                : parseHashString(
                    requestedRoute
                );


        let route =
            normalizeRoute(
                parsed.route
            );


        let params =
            parsed.params &&
            typeof parsed.params ===
                "object"
                ? {
                    ...parsed.params
                }
                : {};


        /*
         * Unknown route → dashboard.
         */

        if (
            !routeExists(
                route
            )
        ) {

            warn(
                "Unknown route:",
                route
            );


            route =
                CONFIG.defaultRoute;

            params = {};

        }


        /*
         * Generate unique navigation ID.
         */

        const requestId =
            ++navigationId;


        navigating =
            true;


        try {

            /* ------------------------------------------------
               AUTHENTICATION
               ------------------------------------------------ */

            const authenticated =
                await ensureAuthenticated();


            if (
                !authenticated
            ) {

                /*
                 * client-auth.js handles redirect.
                 */

                return;

            }


            /*
             * Ignore stale navigation.
             */

            if (
                requestId !==
                navigationId
            ) {

                return;

            }


            /* ------------------------------------------------
               CONTENT
               ------------------------------------------------ */

            const container =
                getContent();


            if (!container) {

                throw new Error(
                    "Client page container #clientPageContainer was not found."
                );

            }


            /* ------------------------------------------------
               MODULE
               ------------------------------------------------ */

            const module =
                getModule(
                    route,
                    params
                );


            if (!module) {

                throw new Error(
                    "Client portal page module is not loaded: " +
                    route
                );

            }


            /* ------------------------------------------------
               TOPBAR
               ------------------------------------------------ */

            updateTopbar(
                route
            );


            /* ------------------------------------------------
               SIDEBAR
               ------------------------------------------------ */

            updateSidebar(
                route
            );


            /* ------------------------------------------------
               ERROR
               ------------------------------------------------ */

            hideGlobalError();


            /* ------------------------------------------------
               LOADING
               ------------------------------------------------ */

            showGlobalLoading();


            /* ------------------------------------------------
               DESTROY OLD MODULE
               ------------------------------------------------ */

            destroyCurrentModule();


            /* ------------------------------------------------
               CLEAR CONTENT
               ------------------------------------------------ */

            container.innerHTML =
                "";


            /* ------------------------------------------------
               INITIALIZE NEW MODULE
               ------------------------------------------------ */

            await initializeModule(
                module,
                route,
                params,
                container
            );


            /*
             * Ignore stale navigation.
             */

            if (
                requestId !==
                navigationId
            ) {

                return;

            }


            /* ------------------------------------------------
               UPDATE STATE
               ------------------------------------------------ */

            currentRoute =
                route;


            currentParams =
                {
                    ...params
                };


            /* ------------------------------------------------
               SHOW PAGE
               ------------------------------------------------ */

            hideGlobalLoading();


            /* ------------------------------------------------
               UPDATE UI AGAIN
               ------------------------------------------------ */

            updateTopbar(
                route
            );


            updateSidebar(
                route
            );


            /* ------------------------------------------------
               SCROLL
               ------------------------------------------------ */

            if (
                container &&
                typeof container.scrollTo ===
                    "function"
            ) {

                container.scrollTo(
                    {
                        top:
                            0,

                        behavior:
                            "auto"
                    }
                );

            } else if (container) {

                container.scrollTop =
                    0;

            }


            /* ------------------------------------------------
               HASH
               ------------------------------------------------ */

            if (
                options.updateHash !==
                false
            ) {

                updateHash(
                    route,
                    params,
                    options.replace === true
                );

            }


            /* ------------------------------------------------
               EVENT
               ------------------------------------------------ */

            document.dispatchEvent(
                new CustomEvent(
                    "tenspick:client-page-loaded",
                    {
                        detail: {

                            route:
                                route,

                            params:
                                {
                                    ...params
                                },

                            container:
                                container

                        }
                    }
                )
            );


            log(
                "Route loaded:",
                route,
                params
            );


        } catch (error) {

            routerError(
                "Navigation failed:",
                route,
                error
            );


            if (
                requestId ===
                navigationId
            ) {

                showGlobalError(
                    error &&
                    error.message
                        ? error.message
                        : "Unable to load this page."
                );

            }

        } finally {

            if (
                requestId ===
                navigationId
            ) {

                navigating =
                    false;

            }

        }

    }


    /* ========================================================
       UPDATE HASH
       ======================================================== */

    function updateHash(
        route,
        params,
        replace
    ) {

        let hash =
            "#" +
            route;


        /*
         * Only project routes may contain
         * projectId.
         */

        if (
            supportsProjectId(route) &&
            params &&
            Number.isInteger(
                params.projectId
            ) &&
            params.projectId > 0
        ) {

            hash +=
                "/" +
                encodeURIComponent(
                    String(
                        params.projectId
                    )
                );

        }


        /*
         * Nothing to update.
         */

        if (
            window.location.hash ===
            hash
        ) {

            return;

        }


        const url =
            window.location.pathname +
            window.location.search +
            hash;


        if (replace) {

            window.history.replaceState(
                {
                    route:
                        route,

                    params:
                        {
                            ...params
                        }
                },
                "",
                url
            );

        } else {

            window.history.pushState(
                {
                    route:
                        route,

                    params:
                        {
                            ...params
                        }
                },
                "",
                url
            );

        }

    }


    /* ========================================================
       NAVIGATION CLICK
       ======================================================== */

    function handleNavigationClick(event) {

        const link =
            event.target.closest(
                "a"
            );


        if (!link) {

            return;

        }


        /*
         * Modifier click.
         */

        if (
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
        ) {

            return;

        }


        /*
         * New tab.
         */

        if (
            link.target ===
            "_blank"
        ) {

            return;

        }


        /*
         * Download.
         */

        if (
            link.hasAttribute(
                "download"
            )
        ) {

            return;

        }


        /*
         * Modal link.
         */

        if (
            link.closest(
                ".modal"
            )
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


        /*
         * Only SPA hashes.
         */

        if (
            !href.startsWith("#")
        ) {

            return;

        }


        const parsed =
            parseHashString(
                href
            );


        /*
         * Invalid route.
         */

        if (
            !routeExists(
                parsed.route
            )
        ) {

            return;

        }


        event.preventDefault();


        /*
         * Update browser URL.
         *
         * navigate() will NOT update it again.
         */

        updateHash(
            parsed.route,
            parsed.params,
            false
        );


        navigate(
            parsed,
            {
                updateHash:
                    false
            }
        );

    }


    /* ========================================================
       HASH CHANGE
       ======================================================== */

    function handleHashChange() {

        const parsed =
            parseHash();


        log(
            "Hash changed:",
            parsed
        );


        navigate(
            parsed,
            {
                updateHash:
                    false
            }
        );

    }


    /* ========================================================
       POP STATE
       ======================================================== */

    function handlePopState() {

        const parsed =
            parseHash();


        log(
            "Browser navigation:",
            parsed
        );


        navigate(
            parsed,
            {
                updateHash:
                    false
            }
        );

    }


    /* ========================================================
       RETRY
       ======================================================== */

    function handleRetry(event) {

        const button =
            event.target.closest(
                "#clientGlobalRetry, [data-client-retry]"
            );


        if (!button) {

            return;

        }


        event.preventDefault();


        const parsed =
            parseHash();


        navigate(
            parsed,
            {
                force:
                    true,

                updateHash:
                    false
            }
        );

    }


    /* ========================================================
       GLOBAL EVENTS
       ======================================================== */

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


    /* ========================================================
       INIT
       ======================================================== */

    async function init() {

        if (
            initialized
        ) {

            return;

        }


        initialized =
            true;


        bindEvents();


        const parsed =
            parseHash();


        log(
            "Router initializing:",
            parsed
        );


        await navigate(
            parsed,
            {
                updateHash:
                    false,

                replace:
                    true
            }
        );

    }


    /* ========================================================
       REFRESH
       ======================================================== */

    async function refresh() {

        const parsed =
            parseHash();


        return navigate(
            parsed,
            {
                force:
                    true,

                updateHash:
                    false
            }
        );

    }


    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.TenspickClientRouter = {

        init:
            init,


        navigate:
            navigate,


        refresh:
            refresh,


        getCurrentRoute:
            function () {

                return currentRoute;

            },


        getCurrentParams:
            function () {

                return {
                    ...currentParams
                };

            },


        getRoutes:
            function () {

                return {
                    ...ROUTES
                };

            },


        parseHash:
            parseHash,


        isNavigating:
            function () {

                return navigating;

            }

    };


    /* ========================================================
       AUTO INITIALIZATION
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init,
            {
                once:
                    true
            }
        );

    } else {

        init();

    }


})(window, document);