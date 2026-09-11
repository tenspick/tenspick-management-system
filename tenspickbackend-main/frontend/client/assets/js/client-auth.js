/**
 * ============================================================
 * TENSPICK CRM
 * CLIENT AUTHENTICATION
 * ============================================================
 *
 * Handles:
 * - Client session
 * - Client authentication state
 * - Client login state
 * - Client logout
 * - Unauthorized handling
 *
 * Security:
 * - Authentication is controlled by the backend session.
 * - client_id is NEVER sent from the frontend.
 * - Backend derives client_id from the authenticated session.
 *
 * ============================================================
 */

(function (window) {
    "use strict";

    const API = window.TenspickClientAPI;

    if (!API) {
        console.error(
            "[ClientAuth] TenspickClientAPI is not available."
        );
        return;
    }

    const STORAGE_KEY = "tenspick_client_auth";
    const LOGOUT_MARKER = "tenspick_client_logged_out";

    let state = {
        authenticated: false,
        client: null,
        loading: false,
        redirecting: false
    };

    /* =========================================================
       APP ROOT / URL HELPERS
       ========================================================= */

    function getAppRoot() {
        if (typeof API.getAppRoot === "function") {
            return API.getAppRoot();
        }

        const path = window.location.pathname;

        const backendIndex = path.indexOf("/backend/");
        if (backendIndex !== -1) {
            return path.substring(0, backendIndex);
        }

        const frontendIndex = path.indexOf("/frontend/");
        if (frontendIndex !== -1) {
            return path.substring(0, frontendIndex);
        }

        return "";
    }

    function getLoginUrl() {
        return (
            getAppRoot() +
            "/frontend/client/login.html"
        );
    }

    function getDashboardUrl() {
        return (
            getAppRoot() +
            "/frontend/client/index.html"
        );
    }

    /* =========================================================
       LOCAL STATE
       ========================================================= */

    function saveState() {
        try {
            sessionStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    authenticated: state.authenticated,
                    client: state.client
                })
            );
        } catch (error) {
            console.warn(
                "[ClientAuth] Unable to save session state.",
                error
            );
        }
    }

    function loadState() {
        try {
            const raw = sessionStorage.getItem(
                STORAGE_KEY
            );

            if (!raw) {
                return;
            }

            const parsed = JSON.parse(raw);

            if (parsed && typeof parsed === "object") {
                state.authenticated =
                    parsed.authenticated === true;

                state.client =
                    parsed.client || null;
            }
        } catch (error) {
            console.warn(
                "[ClientAuth] Unable to load local state.",
                error
            );

            clearState();
        }
    }

    function clearState() {
        state.authenticated = false;
        state.client = null;

        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn(
                "[ClientAuth] Unable to clear local state.",
                error
            );
        }
    }

    /* =========================================================
       LOGOUT MARKER
       ========================================================= */

    function markLoggedOut() {
        try {
            /*
             * IMPORTANT:
             * client-login.js checks for the value "1".
             *
             * Keep this value consistent between:
             * client-auth.js
             * client-login.js
             */
            sessionStorage.setItem(
                LOGOUT_MARKER,
                "1"
            );
        } catch (error) {
            console.warn(
                "[ClientAuth] Unable to set logout marker.",
                error
            );
        }
    }

    function clearLogoutMarker() {
        try {
            sessionStorage.removeItem(
                LOGOUT_MARKER
            );
        } catch (error) {
            console.warn(
                "[ClientAuth] Unable to clear logout marker.",
                error
            );
        }
    }

    function wasRecentlyLoggedOut() {
        try {
            return (
                sessionStorage.getItem(
                    LOGOUT_MARKER
                ) === "1"
            );
        } catch (error) {
            return false;
        }
    }

    /* =========================================================
       REDIRECT HELPERS
       ========================================================= */

    function redirectToLogin(fromLogout = false) {
        if (state.redirecting) {
            return;
        }

        state.redirecting = true;

        let loginUrl = getLoginUrl();

        /*
         * After logout explicitly tell login.php that this
         * navigation came from logout.
         *
         * This prevents client-login.js from immediately
         * checking /client-auth/me and redirecting back to
         * dashboard.
         */
        if (fromLogout) {
            loginUrl +=
                "?logged_out=1";
        }

        window.location.replace(loginUrl);
    }

    function redirectToDashboard() {
        if (state.redirecting) {
            return;
        }

        state.redirecting = true;

        window.location.replace(
            getDashboardUrl()
        );
    }

    /* =========================================================
       SET AUTHENTICATED STATE
       ========================================================= */

    function setAuthenticated(client) {
        state.authenticated = true;
        state.client = client || null;
        state.loading = false;

        /*
         * A successful login/session check means the previous
         * logout marker is no longer required.
         */
        clearLogoutMarker();

        saveState();
    }

    function setUnauthenticated() {
        state.authenticated = false;
        state.client = null;
        state.loading = false;

        clearState();
    }

    /* =========================================================
       GET CURRENT CLIENT SESSION
       ========================================================= */

    async function checkSession(options = {}) {
        const {
            redirect = false
        } = options;

        /*
         * Do not check the server session immediately after
         * logout.
         *
         * login.php already handles the ?logged_out=1 flag.
         */
        if (
            !redirect &&
            wasRecentlyLoggedOut()
        ) {
            return {
                authenticated: false,
                client: null,
                loggedOut: true
            };
        }

        state.loading = true;

        try {
            const response =
                await API.get(
                    "/client-auth/me"
                );

            const result =
                response?.data ?? response;

            /*
             * Expected API format:
             *
             * {
             *   success: true,
             *   data: {
             *      authenticated: true,
             *      client: {...}
             *   }
             * }
             */

            const data =
                result?.data || {};

            if (
                result?.success === true &&
                data?.authenticated === true
            ) {
                setAuthenticated(
                    data.client || null
                );

                return {
                    authenticated: true,
                    client: data.client || null
                };
            }

            setUnauthenticated();

            if (redirect) {
                redirectToLogin();
            }

            return {
                authenticated: false,
                client: null
            };
        } catch (error) {
            setUnauthenticated();

            /*
             * A failed session check means the client should
             * not be treated as authenticated.
             */
            if (redirect) {
                redirectToLogin();
            }

            return {
                authenticated: false,
                client: null,
                error
            };
        } finally {
            state.loading = false;
        }
    }

    /* =========================================================
       LOGIN
       ========================================================= */

    async function login(email, password) {
        state.loading = true;

        try {
            /*
             * Clear any previous logout marker before login.
             */
            clearLogoutMarker();

            const response =
                await API.post(
                    "/client-auth/login",
                    {
                        email: email,
                        password: password
                    }
                );

            const result =
                response?.data ?? response;

            const data =
                result?.data || {};

            if (
                result?.success !== true
            ) {
                throw new Error(
                    result?.message ||
                    "Client login failed."
                );
            }

            /*
             * Backend session is the source of truth.
             */
            setAuthenticated(
                data.client || null
            );

            return {
                success: true,
                client: data.client || null,
                data: data
            };
        } catch (error) {
            setUnauthenticated();

            throw error;
        } finally {
            state.loading = false;
        }
    }

    /* =========================================================
       LOGOUT
       ========================================================= */

    async function logout() {
        /*
         * Prevent duplicate logout requests.
         */
        if (state.loading) {
            return;
        }

        state.loading = true;

        try {
            /*
             * IMPORTANT:
             *
             * Do NOT send client_id.
             *
             * The backend gets the authenticated client ID
             * directly from the PHP session.
             */
            await API.post(
                "/client-auth/logout",
                {}
            );
        } catch (error) {
            /*
             * Even if the backend request fails, clear the
             * frontend authentication state and redirect.
             *
             * This prevents the UI from remaining on a
             * protected client page.
             */
            console.error(
                "[ClientAuth] Logout request failed.",
                error
            );
        } finally {
            /*
             * Always clear frontend state.
             */
            setUnauthenticated();

            /*
             * Tell the login page that this navigation is
             * specifically coming from logout.
             */
            markLoggedOut();

            state.loading = false;

            /*
             * Redirect with explicit logout marker.
             *
             * login.php?logged_out=1
             */
            redirectToLogin(true);
        }
    }

    /* =========================================================
       UNAUTHORIZED HANDLER
       ========================================================= */

    function handleUnauthorized(status) {
        /*
         * Only handle authentication-related responses.
         */
        if (
            status !== 401 &&
            status !== 403
        ) {
            return;
        }

        setUnauthenticated();

        /*
         * Avoid redirect loops.
         */
        if (state.redirecting) {
            return;
        }

        /*
         * If the backend says the client session is no longer
         * valid, redirect to login.
         */
        redirectToLogin(false);
    }

    /* =========================================================
       AUTH REQUIREMENT
       ========================================================= */

    async function requireAuth() {
        /*
         * If we already have a valid local state, still verify
         * the backend session so the server remains authoritative.
         */
        const result =
            await checkSession({
                redirect: true
            });

        return result;
    }

    /* =========================================================
       GETTERS
       ========================================================= */

    function isAuthenticated() {
        return state.authenticated === true;
    }

    function getClient() {
        return state.client;
    }

    function isLoading() {
        return state.loading === true;
    }

    /* =========================================================
       INITIAL STATE
       ========================================================= */

    loadState();

    /* =========================================================
       PUBLIC API
       ========================================================= */

    window.TenspickClientAuth = {
        login,
        logout,
        checkSession,
        requireAuth,

        isAuthenticated,
        getClient,
        isLoading,

        handleUnauthorized,

        redirectToLogin,
        redirectToDashboard,

        markLoggedOut,
        clearLogoutMarker,
        wasRecentlyLoggedOut,

        getLoginUrl,
        getDashboardUrl,
        // New: initialize authentication state and expose admin check
        init: async function () {
            // Perform a session check and redirect if unauthenticated
            const res = await checkSession({ redirect: true });
            return res && res.authenticated === true;
        },
        isAdmin: function () {
            const client = state.client;
            if (!client) return false;
            // Accept various admin flag conventions
            return client.role === "admin" || client.isAdmin === true || client.admin === true;
        }
    };

})(window);