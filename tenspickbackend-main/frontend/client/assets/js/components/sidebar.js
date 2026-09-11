"use strict";

/**
 * ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL
 * SIDEBAR COMPONENT
 * ============================================================
 *
 * File:
 * assets/js/components/sidebar.js
 *
 * Responsibilities:
 * - Desktop sidebar
 * - Mobile sidebar drawer
 * - Mobile overlay
 * - Navigation closing
 * - Escape key
 * - Responsive resize handling
 * - Client logout
 *
 * ============================================================
 *
 * LOGOUT FLOW
 * ------------------------------------------------------------
 *
 * Sidebar
 *    ↓
 * TenspickClientAuth.logout()
 *    ↓
 * POST /api/client-auth/logout
 *    ↓
 * Backend clears client PHP session
 *    ↓
 * Auth state cleared
 *    ↓
 * login.php?logged_out=1
 *
 * IMPORTANT:
 * - Sidebar does NOT send client_id.
 * - Sidebar does NOT handle passwords.
 * - Sidebar does NOT create authentication state.
 * - Authentication module remains the single logout authority.
 * ============================================================
 */

(function (window, document) {

    "use strict";


    /* ========================================================
       STATE
       ======================================================== */

    let initialized = false;

    let sidebar = null;

    let overlay = null;

    let mobileMenuButton = null;

    let logoutButton = null;

    let boundHandlers = [];


    /* ========================================================
       ELEMENT HELPERS
       ======================================================== */

    function getElements() {

        sidebar =
            document.getElementById(
                "clientSidebar"
            );


        overlay =
            document.getElementById(
                "clientSidebarOverlay"
            );


        mobileMenuButton =
            document.getElementById(
                "clientMobileMenuButton"
            );


        logoutButton =
            document.getElementById(
                "clientSidebarLogout"
            );

    }


    /* ========================================================
       MOBILE CHECK
       ======================================================== */

    function isMobile() {

        return window.matchMedia(
            "(max-width: 900px)"
        ).matches;

    }


    /* ========================================================
       SIDEBAR OPEN
       ======================================================== */

    function isOpen() {

        return Boolean(
            sidebar &&
            sidebar.classList.contains(
                "is-open"
            )
        );

    }


    /* ========================================================
       OPEN SIDEBAR
       ======================================================== */

    function openSidebar() {

        if (!sidebar) {

            return;

        }


        /*
         * Sidebar should only behave as a drawer on mobile.
         */

        if (!isMobile()) {

            return;

        }


        sidebar.classList.add(
            "is-open"
        );


        if (overlay) {

            overlay.hidden =
                false;

        }


        if (mobileMenuButton) {

            mobileMenuButton.setAttribute(
                "aria-expanded",
                "true"
            );


            mobileMenuButton.setAttribute(
                "aria-label",
                "Close navigation"
            );

        }


        document.body.classList.add(
            "client-sidebar-open"
        );

    }


    /* ========================================================
       CLOSE SIDEBAR
       ======================================================== */

    function closeSidebar() {

        if (!sidebar) {

            return;

        }


        sidebar.classList.remove(
            "is-open"
        );


        if (overlay) {

            overlay.hidden =
                true;

        }


        if (mobileMenuButton) {

            mobileMenuButton.setAttribute(
                "aria-expanded",
                "false"
            );


            mobileMenuButton.setAttribute(
                "aria-label",
                "Open navigation"
            );

        }


        document.body.classList.remove(
            "client-sidebar-open"
        );

    }


    /* ========================================================
       TOGGLE SIDEBAR
       ======================================================== */

    function toggleSidebar() {

        if (!isMobile()) {

            return;

        }


        if (isOpen()) {

            closeSidebar();

        } else {

            openSidebar();

        }

    }


    /* ========================================================
       EVENT BIND
       ======================================================== */

    function bind(
        element,
        event,
        handler
    ) {

        if (!element) {

            return;

        }


        element.addEventListener(
            event,
            handler
        );


        boundHandlers.push({

            element:
                element,

            event:
                event,

            handler:
                handler

        });

    }


    /* ========================================================
       BIND EVENTS
       ======================================================== */

    function bindEvents() {

        /* ----------------------------------------------------
           MOBILE MENU
           ---------------------------------------------------- */

        bind(
            mobileMenuButton,
            "click",
            function (event) {

                event.preventDefault();

                event.stopPropagation();

                toggleSidebar();

            }
        );


        /* ----------------------------------------------------
           OVERLAY
           ---------------------------------------------------- */

        bind(
            overlay,
            "click",
            function (event) {

                event.preventDefault();

                closeSidebar();

            }
        );


        /* ----------------------------------------------------
           NAVIGATION
           ---------------------------------------------------- */

        if (sidebar) {

            const navigationItems =
                sidebar.querySelectorAll(
                    ".client-nav-item"
                );


            navigationItems.forEach(
                function (item) {

                    bind(
                        item,
                        "click",
                        function () {

                            /*
                             * Close drawer immediately on
                             * mobile navigation.
                             */

                            if (isMobile()) {

                                closeSidebar();

                            }

                        }
                    );

                }
            );

        }


        /* ----------------------------------------------------
           LOGOUT
           ---------------------------------------------------- */

        bind(
            logoutButton,
            "click",
            handleLogout
        );


        /* ----------------------------------------------------
           ESCAPE
           ---------------------------------------------------- */

        bind(
            document,
            "keydown",
            function (event) {

                if (
                    event.key === "Escape" &&
                    isOpen()
                ) {

                    closeSidebar();

                }

            }
        );


        /* ----------------------------------------------------
           RESIZE
           ---------------------------------------------------- */

        bind(
            window,
            "resize",
            handleResize
        );

    }


    /* ========================================================
       RESIZE
       ======================================================== */

    function handleResize() {

        /*
         * Desktop mode must never leave the mobile drawer
         * open or body scroll locked.
         */

        if (!isMobile()) {

            closeSidebar();

        }

    }


    /* ========================================================
       LOGOUT
       ======================================================== */

    async function handleLogout(event) {

        if (event) {

            event.preventDefault();

            event.stopPropagation();

        }


        if (!logoutButton) {

            return;

        }


        /*
         * Prevent double click.
         */

        if (
            logoutButton.dataset.loggingOut === "true"
        ) {

            return;

        }


        logoutButton.dataset.loggingOut =
            "true";


        const originalHTML =
            logoutButton.innerHTML;


        logoutButton.disabled =
            true;


        logoutButton.setAttribute(
            "aria-busy",
            "true"
        );


        logoutButton.innerHTML = `
            <span class="client-nav-icon" aria-hidden="true">
                <i class="bi bi-arrow-repeat"></i>
            </span>
            <span>Logging out...</span>
        `;


        /*
         * Close mobile drawer immediately.
         */

        closeSidebar();


        try {

            /*
             * Authentication module is the ONLY authority
             * responsible for logout.
             */

            if (
                !window.TenspickClientAuth ||
                typeof window
                    .TenspickClientAuth
                    .logout !== "function"
            ) {

                throw new Error(
                    "Client authentication service is not available."
                );

            }


            /*
             * IMPORTANT:
             *
             * No client_id is supplied.
             *
             * Backend determines the client from the
             * authenticated PHP session.
             */

            const result =
                await window
                    .TenspickClientAuth
                    .logout();


            /*
             * logout() normally redirects using
             * window.location.replace().
             *
             * If the page is still active, inspect the
             * result for logging purposes.
             */

            console.log(
                "[Tenspick Client Sidebar] Logout completed:",
                result
            );

        } catch (error) {

            console.error(
                "[Tenspick Client Sidebar] Logout failed:",
                error
            );


            /*
             * IMPORTANT:
             *
             * Do NOT call handleUnauthorized() here.
             *
             * The updated authentication module intentionally
             * requires an actual 401/403 status for that method.
             *
             * Instead, use the same login destination directly
             * as a final UI fallback.
             *
             * The backend logout has already been attempted.
             */

            try {

                /*
                 * Mark the browser as being in the post-logout
                 * state when the authentication module exposes
                 * its helper.
                 */

                if (
                    window.TenspickClientAuth &&
                    typeof window
                        .TenspickClientAuth
                        .isRecentlyLoggedOut === "function"
                ) {

                    /*
                     * Nothing else is required here.
                     *
                     * The auth module owns the actual marker.
                     */

                }

            } catch (fallbackError) {

                console.error(
                    "[Tenspick Client Sidebar] Logout fallback error:",
                    fallbackError
                );

            }


            /*
             * Final navigation fallback.
             *
             * Prefer the application-relative login page.
             */

            navigateToLogin();

        } finally {

            /*
             * Normally the page has already navigated.
             *
             * Restore the button safely if the page remains.
             */

            if (
                logoutButton &&
                document.body.contains(
                    logoutButton
                )
            ) {

                logoutButton.dataset.loggingOut =
                    "false";


                logoutButton.disabled =
                    false;


                logoutButton.removeAttribute(
                    "aria-busy"
                );


                logoutButton.innerHTML =
                    originalHTML;

            }

        }

    }


    /* ========================================================
       LOGIN FALLBACK
       ======================================================== */

    function navigateToLogin() {

        /*
         * login.php is in the same directory as
         * client/index.php.
         */

        const loginPath =
            "login.html?logged_out=1";


        try {

            window.location.replace(
                loginPath
            );

        } catch (error) {

            console.error(
                "[Tenspick Client Sidebar] Login redirect failed:",
                error
            );


            /*
             * Last browser fallback.
             */

            window.location.href =
                loginPath;

        }

    }


    /* ========================================================
       INITIALIZE
       ======================================================== */

    function init() {

        if (initialized) {

            return;

        }


        getElements();


        bindEvents();


        /*
         * Always start closed.
         */

        closeSidebar();


        /*
         * Correct desktop/mobile state.
         */

        handleResize();


        initialized =
            true;


        console.log(
            "[Tenspick Client Sidebar] Initialized."
        );

    }


    /* ========================================================
       DESTROY
       ======================================================== */

    function destroy() {

        boundHandlers.forEach(
            function (item) {

                item.element.removeEventListener(
                    item.event,
                    item.handler
                );

            }
        );


        boundHandlers =
            [];


        closeSidebar();


        initialized =
            false;


        sidebar =
            null;

        overlay =
            null;

        mobileMenuButton =
            null;

        logoutButton =
            null;

    }


    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.TenspickClientSidebar = {

        init:
            init,

        destroy:
            destroy,

        open:
            openSidebar,

        close:
            closeSidebar,

        toggle:
            toggleSidebar,

        isOpen:
            isOpen

    };


})(window, document);