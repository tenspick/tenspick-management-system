"use strict";

/**
 * ============================================================
 * TENSPICK CLIENT PORTAL
 * TOPBAR COMPONENT
 * ============================================================
 *
 * File:
 * assets/js/components/topbar.js
 *
 * Responsibilities:
 * ------------------------------------------------------------
 * - Dynamic page title
 * - Dynamic page subtitle
 * - Dynamic client information
 * - Dynamic client avatar / initials
 * - Dynamic notification badge
 * - Dynamic navigation active state
 * - Dynamic project page title support
 *
 * SPA navigation is handled by:
 * client-router.js
 *
 * ============================================================
 */

(function (window, document) {

    "use strict";


    /* ========================================================
       STATE
       ======================================================== */

    let initialized = false;

    let currentRoute = "";

    let currentParams = {};

    let clientData = null;

    let notificationCount = 0;


    /* ========================================================
       STATIC PAGE CONFIG
       ======================================================== */

    const pageConfig = {

        dashboard: {
            title: "Dashboard",
            subtitle: "Overview of your projects and account"
        },

        projects: {
            title: "My Projects",
            subtitle: "View and track all your projects"
        },

        progress: {
            title: "Project Progress",
            subtitle: "Track your project progress"
        },

        milestones: {
            title: "Milestones",
            subtitle: "Track project milestones"
        },

        payments: {
            title: "Payments",
            subtitle: "View your payment history and status"
        },

        chat: {
            title: "Chat with Admin",
            subtitle: "Communicate with the administrator"
        },

        notifications: {
            title: "Notifications",
            subtitle: "View your latest notifications"
        },

        profile: {
            title: "Profile",
            subtitle: "Manage your client profile"
        }

    };


    /* ========================================================
       INIT
       ======================================================== */

    function init() {

        if (initialized) {

            /*
             * Even if already initialized,
             * refresh client information.
             */

            loadClientInformation();

            return;
        }


        initialized = true;


        /*
         * Load client information.
         */

        loadClientInformation();


        /*
         * Set default navigation state.
         */

        updateNavigation(
            currentRoute
        );


        /*
         * Initial notification state.
         */

        setNotificationCount(
            notificationCount
        );
    }


    /* ========================================================
       LOAD CLIENT INFORMATION
       ======================================================== */

    function loadClientInformation() {

        /*
         * First use the existing auth module.
         */

        if (
            window.TenspickClientAuth &&
            typeof window.TenspickClientAuth.getClient ===
                "function"
        ) {

            try {

                const client =
                    window.TenspickClientAuth.getClient();


                if (client) {

                    clientData = client;

                    updateClientInformation();
                }

            } catch (error) {

                console.warn(
                    "[Tenspick Client Topbar] " +
                    "Unable to read client information:",
                    error
                );
            }
        }


        /*
         * Listen for authentication state if the
         * auth module exposes the client later.
         */

        setTimeout(
            function () {

                if (
                    !clientData &&
                    window.TenspickClientAuth &&
                    typeof window.TenspickClientAuth.getClient ===
                        "function"
                ) {

                    try {

                        const client =
                            window.TenspickClientAuth.getClient();


                        if (client) {

                            clientData =
                                client;

                            updateClientInformation();
                        }

                    } catch (error) {

                        console.warn(
                            "[Tenspick Client Topbar] " +
                            "Delayed client loading failed:",
                            error
                        );
                    }
                }

            },
            250
        );
    }


    /* ========================================================
       UPDATE CLIENT INFORMATION
       ======================================================== */

    function updateClientInformation() {

        if (!clientData) {

            return;
        }


        const clientName =
            getClientName();


        const avatar =
            getClientAvatar();


        /*
         * Common topbar client name IDs.
         */

        updateText(
            "clientTopClientName",
            clientName
        );


        updateText(
            "clientTopbarClientName",
            clientName
        );


        updateText(
            "clientTopName",
            clientName
        );


        /*
         * Client email if available.
         */

        updateText(
            "clientTopClientEmail",
            getClientEmail()
        );


        updateText(
            "clientTopbarClientEmail",
            getClientEmail()
        );


        /*
         * Avatar / initials.
         */

        updateAvatar(
            "clientTopAvatar",
            avatar
        );


        updateAvatar(
            "clientTopbarAvatar",
            avatar
        );


        updateAvatar(
            "clientTopClientAvatar",
            avatar
        );


        /*
         * Data attributes can also be used
         * by existing CSS/components.
         */

        const topbar =
            document.querySelector(
                ".client-topbar"
            );


        if (topbar) {

            topbar.dataset.clientId =
                clientData.id ??
                clientData.client_id ??
                "";

            topbar.dataset.clientName =
                clientName;

        }
    }


    /* ========================================================
       GET CLIENT NAME
       ======================================================== */

    function getClientName() {

        if (!clientData) {

            return "Client";
        }


        return (
            clientData.client_name ??
            clientData.name ??
            clientData.full_name ??
            clientData.contact_person ??
            "Client"
        );
    }


    /* ========================================================
       GET CLIENT EMAIL
       ======================================================== */

    function getClientEmail() {

        if (!clientData) {

            return "";
        }


        return (
            clientData.email ??
            clientData.login_email ??
            clientData.contact_person_email ??
            ""
        );
    }


    /* ========================================================
       GET CLIENT AVATAR
       ======================================================== */

    function getClientAvatar() {

        if (!clientData) {

            return {
                type: "initials",
                value: "C"
            };
        }


        /*
         * Support common image field names.
         */

        const image =
            clientData.profile_image ??
            clientData.profile_photo ??
            clientData.photo ??
            clientData.avatar ??
            clientData.image ??
            clientData.image_url ??
            "";


        if (
            image &&
            typeof image === "string"
        ) {

            return {
                type: "image",
                value: image
            };
        }


        /*
         * Fall back to initials.
         */

        const name =
            getClientName()
                .trim();


        const words =
            name
                .split(/\s+/)
                .filter(Boolean);


        let initials = "C";


        if (words.length >= 2) {

            initials =
                (
                    words[0].charAt(0) +
                    words[1].charAt(0)
                ).toUpperCase();

        } else if (words.length === 1) {

            initials =
                words[0]
                    .substring(0, 2)
                    .toUpperCase();
        }


        return {
            type: "initials",
            value: initials
        };
    }


    /* ========================================================
       UPDATE TEXT
       ======================================================== */

    function updateText(
        id,
        value
    ) {

        const element =
            document.getElementById(id);


        if (!element) {

            return;
        }


        element.textContent =
            value || "";
    }


    /* ========================================================
       UPDATE AVATAR
       ======================================================== */

    function updateAvatar(
        id,
        avatar
    ) {

        const element =
            document.getElementById(id);


        if (!element) {

            return;
        }


        if (
            avatar &&
            avatar.type === "image" &&
            avatar.value
        ) {

            /*
             * If the target itself is an IMG.
             */

            if (
                element.tagName ===
                "IMG"
            ) {

                element.src =
                    avatar.value;

                element.alt =
                    getClientName();

                element.classList.add(
                    "has-client-image"
                );

                element.textContent =
                    "";

                return;
            }


            /*
             * Otherwise use background image.
             */

            element.style.backgroundImage =
                `url("${escapeAttribute(
                    avatar.value
                )}")`;

            element.style.backgroundSize =
                "cover";

            element.style.backgroundPosition =
                "center";

            element.style.backgroundRepeat =
                "no-repeat";

            element.textContent =
                "";

            element.classList.add(
                "has-client-image"
            );

            return;
        }


        /*
         * Initials fallback.
         */

        element.style.backgroundImage =
            "";

        element.textContent =
            avatar?.value ||
            "C";

        element.classList.remove(
            "has-client-image"
        );

        element.setAttribute(
            "aria-label",
            getClientName()
        );
    }


    /* ========================================================
       ESCAPE ATTRIBUTE
       ======================================================== */

    function escapeAttribute(
        value
    ) {

        return String(
            value || ""
        )
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"');
    }


    /* ========================================================
       SET PAGE
       ======================================================== */

    function setPage(
        route,
        params
    ) {

        const normalizedRoute =
            normalizeRoute(
                route
            );


        currentRoute =
            normalizedRoute;


        currentParams =
            params || {};


        const config =
            getPageConfig(
                normalizedRoute,
                currentParams
            );


        /*
         * ID-based title.
         */

        const titleElement =
            document.getElementById(
                "clientPageTitle"
            );


        const subtitleElement =
            document.getElementById(
                "clientPageSubtitle"
            );


        if (titleElement) {

            titleElement.textContent =
                config.title;
        }


        if (subtitleElement) {

            subtitleElement.textContent =
                config.subtitle;
        }


        /*
         * Class-based structure.
         */

        const classTitle =
            document.querySelector(
                ".client-topbar-title"
            );


        const classSubtitle =
            document.querySelector(
                ".client-topbar-subtitle"
            );


        if (
            classTitle &&
            classTitle !== titleElement
        ) {

            classTitle.textContent =
                config.title;
        }


        if (
            classSubtitle &&
            classSubtitle !== subtitleElement
        ) {

            classSubtitle.textContent =
                config.subtitle;
        }


        /*
         * Browser accessibility.
         */

        document.title =
            "TENSPICK - " +
            config.title;


        /*
         * Navigation.

         */

        updateNavigation(
            normalizedRoute
        );


        /*
         * Refresh client information because
         * topbar can be updated after auth boot.
         */

        if (!clientData) {

            loadClientInformation();

        } else {

            updateClientInformation();
        }
    }


    /* ========================================================
       GET PAGE CONFIG
       ======================================================== */

    function getPageConfig(
        route,
        params
    ) {

        const config =
            pageConfig[route];


        if (!config) {

            return {

                title:
                    "Client Portal",

                subtitle:
                    ""

            };
        }


        /*
         * Dynamic project detail pages.
         *
         * Example:
         *
         * #projects/12
         *
         * The router may still identify the route
         * as "projects".
         *
         * Keep the standard title unless a project
         * name is available.
         */

        if (
            route === "projects" &&
            params &&
            (
                params.id ||
                params.projectId
            )
        ) {

            const projectName =
                params.projectName ||
                params.name;


            if (projectName) {

                return {

                    title:
                        projectName,

                    subtitle:
                        "Project details and progress"

                };
            }
        }


        return {

            title:
                config.title,

            subtitle:
                config.subtitle

        };
    }


    /* ========================================================
       NORMALIZE ROUTE
       ======================================================== */

    function normalizeRoute(
        route
    ) {

        if (
            route === null ||
            route === undefined
        ) {

            return "";
        }


        let value =
            String(route)
                .trim()
                .toLowerCase();


        /*
         * Remove hash.
         */

        value =
            value.replace(
                /^#/,
                ""
            );


        /*
         * Remove leading slash.
         */

        value =
            value.replace(
                /^\/+/,
                ""
            );


        /*
         * Convert:
         *
         * projects/12
         *
         * to:
         *
         * projects
         */

        if (
            value.includes("/")
        ) {

            value =
                value.split("/")[0];
        }


        return value;
    }


    /* ========================================================
       UPDATE NAVIGATION
       ======================================================== */

    function updateNavigation(
        route
    ) {

        const normalizedRoute =
            normalizeRoute(
                route
            );


        const links =
            document.querySelectorAll(
                ".client-nav-item, " +
                "[data-client-route], " +
                ".client-sidebar-link, " +
                ".sidebar-menu-item"
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


                let linkRoute =
                    dataRoute ||
                    clientRoute ||
                    "";


                /*
                 * Read hash route if no
                 * data attribute exists.
                 */

                if (
                    !linkRoute &&
                    href &&
                    href.startsWith("#")
                ) {

                    linkRoute =
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


                linkRoute =
                    normalizeRoute(
                        linkRoute
                    );


                const isActive =
                    linkRoute !== "" &&
                    linkRoute ===
                    normalizedRoute;


                link.classList.toggle(
                    "active",
                    isActive
                );


                link.classList.toggle(
                    "is-active",
                    isActive
                );


                /*
                 * Accessibility.

                 */

                if (
                    isActive
                ) {

                    link.setAttribute(
                        "aria-current",
                        "page"
                    );

                } else {

                    link.removeAttribute(
                        "aria-current"
                    );
                }

            }
        );
    }


    /* ========================================================
       SET NOTIFICATION COUNT
       ======================================================== */

    function setNotificationCount(
        count
    ) {

        notificationCount =
            normalizeCount(
                count
            );


        updateBadge(
            "clientNotificationBadge",
            notificationCount
        );


        updateBadge(
            "clientTopNotificationBadge",
            notificationCount
        );


        /*
         * Support generic notification badges.
         */

        const badges =
            document.querySelectorAll(
                "[data-client-notification-badge]"
            );


        badges.forEach(
            function (badge) {

                updateBadgeElement(
                    badge,
                    notificationCount
                );

            }
        );
    }


    /* ========================================================
       NORMALIZE COUNT
       ======================================================== */

    function normalizeCount(
        count
    ) {

        const value =
            Number(count);


        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return 0;
        }


        return Math.floor(
            value
        );
    }


    /* ========================================================
       UPDATE BADGE
       ======================================================== */

    function updateBadge(
        id,
        count
    ) {

        const element =
            document.getElementById(
                id
            );


        if (!element) {

            return;
        }


        updateBadgeElement(
            element,
            count
        );
    }


    /* ========================================================
       UPDATE BADGE ELEMENT
       ======================================================== */

    function updateBadgeElement(
        element,
        count
    ) {

        if (!element) {

            return;
        }


        const value =
            normalizeCount(
                count
            );


        element.textContent =
            value > 99
                ? "99+"
                : String(value);


        element.hidden =
            value <= 0;


        if (
            value > 0
        ) {

            element.setAttribute(
                "aria-label",
                value +
                " unread notifications"
            );

        } else {

            element.removeAttribute(
                "aria-label"
            );
        }
    }


    /* ========================================================
       GET PAGE TITLE
       ======================================================== */

    function getPageTitle(
        route
    ) {

        const normalizedRoute =
            normalizeRoute(
                route
            );


        return (
            pageConfig[
                normalizedRoute
            ]?.title ||
            "Client Portal"
        );
    }


    /* ========================================================
       GET PAGE SUBTITLE
       ======================================================== */

    function getPageSubtitle(
        route
    ) {

        const normalizedRoute =
            normalizeRoute(
                route
            );


        return (
            pageConfig[
                normalizedRoute
            ]?.subtitle ||
            ""
        );
    }


    /* ========================================================
       GET CURRENT ROUTE
       ======================================================== */

    function getCurrentRoute() {

        return currentRoute;
    }


    /* ========================================================
       GET CURRENT PARAMS
       ======================================================== */

    function getCurrentParams() {

        return {
            ...currentParams
        };
    }


    /* ========================================================
       GET CLIENT
       ======================================================== */

    function getClient() {

        return clientData
            ? {
                ...clientData
            }
            : null;
    }


    /* ========================================================
       SET CLIENT
       ======================================================== */

    function setClient(
        client
    ) {

        if (
            !client ||
            typeof client !== "object"
        ) {

            return;
        }


        clientData =
            client;


        updateClientInformation();
    }


    /* ========================================================
       REFRESH
       ======================================================== */

    function refresh() {

        /*
         * Get newest client information
         * from authentication state.
         */

        if (
            window.TenspickClientAuth &&
            typeof window.TenspickClientAuth.getClient ===
                "function"
        ) {

            try {

                const client =
                    window.TenspickClientAuth.getClient();


                if (client) {

                    clientData =
                        client;
                }

            } catch (error) {

                console.warn(
                    "[Tenspick Client Topbar] " +
                    "Refresh failed:",
                    error
                );
            }
        }


        updateClientInformation();


        setPage(
            currentRoute,
            currentParams
        );


        setNotificationCount(
            notificationCount
        );
    }


    /* ========================================================
       DESTROY
       ======================================================== */

    function destroy() {

        initialized =
            false;

        currentRoute =
            "";

        currentParams =
            {};

        clientData =
            null;

        notificationCount =
            0;
    }


    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.TenspickClientTopbar = {

        init:
            init,

        setPage:
            setPage,

        setNotificationCount:
            setNotificationCount,

        getPageTitle:
            getPageTitle,

        getPageSubtitle:
            getPageSubtitle,

        getCurrentRoute:
            getCurrentRoute,

        getCurrentParams:
            getCurrentParams,

        getClient:
            getClient,

        setClient:
            setClient,

        refresh:
            refresh,

        destroy:
            destroy

    };


})(window, document);