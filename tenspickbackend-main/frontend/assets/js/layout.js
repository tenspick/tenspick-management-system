/* ============================================================
   TENSPICK CRM
   ADMIN LAYOUT.JS
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       CONFIG
       ======================================================== */

    const MOBILE_BREAKPOINT = 900;


    /* ========================================================
       SIDEBAR HELPERS
       ======================================================== */

    function getSidebar() {

        return document.getElementById(
            "appSidebar"
        );

    }


    function getToggle() {

        return document.getElementById(
            "sidebarToggle"
        );

    }


    function getOverlay() {

        return document.getElementById(
            "sidebarOverlay"
        );

    }


    /* ========================================================
       OPEN SIDEBAR
       ======================================================== */

    function openSidebar() {

        const sidebar = getSidebar();
        const toggle = getToggle();
        const overlay = getOverlay();


        if (!sidebar) {
            return;
        }


        sidebar.classList.add(
            "open"
        );


        if (overlay) {

            overlay.classList.add(
                "active"
            );

        }


        if (toggle) {

            toggle.setAttribute(
                "aria-expanded",
                "true"
            );

        }


        /*
         * Prevent background scrolling
         * only on mobile/tablet.
         */

        if (
            window.innerWidth <=
            MOBILE_BREAKPOINT
        ) {

            document.body.style.overflow =
                "hidden";

        }

    }


    /* ========================================================
       CLOSE SIDEBAR
       ======================================================== */

    function closeSidebar() {

        const sidebar = getSidebar();
        const toggle = getToggle();
        const overlay = getOverlay();


        if (sidebar) {

            sidebar.classList.remove(
                "open"
            );

        }


        if (overlay) {

            overlay.classList.remove(
                "active"
            );

        }


        if (toggle) {

            toggle.setAttribute(
                "aria-expanded",
                "false"
            );

        }


        document.body.style.overflow =
            "";

    }


    /* ========================================================
       TOGGLE SIDEBAR
       ======================================================== */

    function toggleSidebar() {

        const sidebar = getSidebar();


        if (!sidebar) {

            console.warn(
                "Tenspick CRM: #appSidebar not found."
            );

            return;

        }


        if (
            sidebar.classList.contains(
                "open"
            )
        ) {

            closeSidebar();

        } else {

            openSidebar();

        }

    }


    /* ========================================================
       SIDEBAR EVENTS
       ========================================================
       
       Event delegation is used because the topbar/sidebar
       can be rendered dynamically by the PHP SPA.
       ======================================================== */

    function initializeSidebarEvents() {

        if (
            document.body.dataset
                .tenspickSidebarEvents ===
            "true"
        ) {

            return;

        }


        document.body.dataset
            .tenspickSidebarEvents =
            "true";


        document.addEventListener(
            "click",
            function (event) {


                /* ============================================
                   TOGGLE BUTTON
                   ============================================ */

                const toggle =
                    event.target.closest(
                        "#sidebarToggle"
                    );


                if (toggle) {

                    event.preventDefault();

                    event.stopPropagation();

                    toggleSidebar();

                    return;

                }


                /* ============================================
                   OVERLAY
                   ============================================ */

                const overlay =
                    event.target.closest(
                        "#sidebarOverlay"
                    );


                if (overlay) {

                    event.preventDefault();

                    closeSidebar();

                    return;

                }


                /* ============================================
                   MOBILE SIDEBAR LINKS
                   ============================================ */

                const sidebar =
                    getSidebar();


                if (
                    sidebar &&
                    window.innerWidth <=
                    MOBILE_BREAKPOINT
                ) {

                    const link =
                        event.target.closest(
                            "a"
                        );


                    if (
                        link &&
                        sidebar.contains(
                            link
                        )
                    ) {

                        closeSidebar();

                    }

                }

            }
        );

    }


    /* ========================================================
       PROFILE DROPDOWN
       ======================================================== */

    function openProfile() {

        const profile =
            document.getElementById(
                "topbarProfile"
            );

        const toggle =
            document.getElementById(
                "profileToggle"
            );

        const dropdown =
            document.getElementById(
                "profileDropdown"
            );


        if (
            !profile ||
            !toggle ||
            !dropdown
        ) {

            return;

        }


        profile.classList.add(
            "is-open"
        );


        dropdown.hidden = false;


        toggle.setAttribute(
            "aria-expanded",
            "true"
        );

    }


    function closeProfile() {

        const profile =
            document.getElementById(
                "topbarProfile"
            );

        const toggle =
            document.getElementById(
                "profileToggle"
            );

        const dropdown =
            document.getElementById(
                "profileDropdown"
            );


        if (
            !profile ||
            !toggle ||
            !dropdown
        ) {

            return;

        }


        profile.classList.remove(
            "is-open"
        );


        dropdown.hidden = true;


        toggle.setAttribute(
            "aria-expanded",
            "false"
        );

    }


    function toggleProfile() {

        const profile =
            document.getElementById(
                "topbarProfile"
            );


        if (!profile) {

            return;

        }


        if (
            profile.classList.contains(
                "is-open"
            )
        ) {

            closeProfile();

        } else {

            openProfile();

        }

    }


    /* ========================================================
       PROFILE EVENTS
       ======================================================== */

    function initializeProfileEvents() {

        if (
            document.body.dataset
                .tenspickProfileEvents ===
            "true"
        ) {

            return;

        }


        document.body.dataset
            .tenspickProfileEvents =
            "true";


        document.addEventListener(
            "click",
            function (event) {

                const profileToggle =
                    event.target.closest(
                        "#profileToggle"
                    );


                if (profileToggle) {

                    event.preventDefault();

                    event.stopPropagation();

                    toggleProfile();

                    return;

                }


                const profile =
                    document.getElementById(
                        "topbarProfile"
                    );


                if (
                    profile &&
                    profile.classList.contains(
                        "is-open"
                    ) &&
                    !profile.contains(
                        event.target
                    )
                ) {

                    closeProfile();

                }

            }
        );

    }


    /* ========================================================
       CLOCK
       ======================================================== */

    function updateClock() {

        const dateElement =
            document.getElementById(
                "topbarDate"
            );

        const timeElement =
            document.getElementById(
                "topbarTime"
            );


        const now = new Date();


        /* ----------------------------------------------------
           DATE
           ---------------------------------------------------- */

        if (dateElement) {

            dateElement.textContent =
                new Intl.DateTimeFormat(
                    "en-IN",
                    {
                        weekday: "short",
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                ).format(now);

        }


        /* ----------------------------------------------------
           TIME
           ---------------------------------------------------- */

        if (timeElement) {

            timeElement.textContent =
                new Intl.DateTimeFormat(
                    "en-IN",
                    {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    }
                ).format(now);

        }

    }


    function initializeClock() {

        updateClock();


        /*
         * Only one clock timer.
         */

        if (
            window.TenspickClockTimer
        ) {

            clearInterval(
                window.TenspickClockTimer
            );

        }


        window.TenspickClockTimer =
            setInterval(
                updateClock,
                1000
            );

    }


    /* ========================================================
       LOGOUT
       ======================================================== */

    async function logout() {

        const confirmed =
            window.confirm(
                "Are you sure you want to logout?"
            );


        if (!confirmed) {

            return;

        }


        try {
            sessionStorage.removeItem("tenspick_user");
            sessionStorage.removeItem("tenspick_authenticated");

            /* Try PHP backend logout if available */
            fetch("../backend/public/index.php/api/security/csrf", { method: "GET", credentials: "same-origin" })
                .then(res => res.json())
                .then(csrf => {
                    if (csrf && csrf.data && csrf.data.token) {
                        fetch("../backend/public/index.php/api/auth/logout", {
                            method: "POST",
                            credentials: "same-origin",
                            headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf.data.token },
                            body: JSON.stringify({})
                        });
                    }
                })
                .catch(() => {});

            window.location.href = "login.html";
        } catch (error) {
            sessionStorage.clear();
            window.location.href = "login.html";
        }

    }


    /* ========================================================
       LOGOUT EVENTS
       ======================================================== */

    function initializeLogout() {

        if (
            document.body.dataset
                .tenspickLogoutEvents ===
            "true"
        ) {

            return;

        }


        document.body.dataset
            .tenspickLogoutEvents =
            "true";


        /*
         * Event delegation allows both:
         *
         * #sidebarLogout
         * #topbarLogout
         *
         * to work even when dynamically rendered.
         */

        document.addEventListener(
            "click",
            function (event) {

                const logoutButton =
                    event.target.closest(
                        "#sidebarLogout, #topbarLogout"
                    );


                if (!logoutButton) {

                    return;

                }


                event.preventDefault();


                logout();

            }
        );

    }


    /* ========================================================
       ESC KEY
       ======================================================== */

    function initializeKeyboard() {

        if (
            document.body.dataset
                .tenspickKeyboardEvents ===
            "true"
        ) {

            return;

        }


        document.body.dataset
            .tenspickKeyboardEvents =
            "true";


        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !==
                    "Escape"
                ) {

                    return;

                }


                closeSidebar();

                closeProfile();

            }
        );

    }


    /* ========================================================
       RESIZE
       ======================================================== */

    function initializeResize() {

        if (
            document.body.dataset
                .tenspickResizeEvents ===
            "true"
        ) {

            return;

        }


        document.body.dataset
            .tenspickResizeEvents =
            "true";


        window.addEventListener(
            "resize",
            function () {

                /*
                 * When returning to desktop,
                 * remove mobile state.
                 */

                if (
                    window.innerWidth >
                    MOBILE_BREAKPOINT
                ) {

                    closeSidebar();

                }

            }
        );

    }


    /* ========================================================
       SPA PAGE LOADED
       ======================================================== */

    function initializeSPAEvents() {

        if (
            document.body.dataset
                .tenspickSPAEvents ===
            "true"
        ) {

            return;

        }


        document.body.dataset
            .tenspickSPAEvents =
            "true";


        document.addEventListener(
            "tenspick:page-loaded",
            function () {

                /*
                 * Close mobile sidebar
                 * after changing page.
                 */

                if (
                    window.innerWidth <=
                    MOBILE_BREAKPOINT
                ) {

                    closeSidebar();

                }


                closeProfile();


                /*
                 * Update clock in case
                 * topbar was recreated.
                 */

                updateClock();

            }
        );

    }


    /* ========================================================
       TENSPICK AUTH & RBAC HELPER
       ======================================================== */

    window.TenspickAuth = {
        getUser: function () {
            try {
                const raw = sessionStorage.getItem("tenspick_user");
                return raw ? JSON.parse(raw) : null;
            } catch (e) {
                return null;
            }
        },
        isStaff: function () {
            const u = this.getUser();
            return u ? (u.isStaff === true || String(u.role).toLowerCase() === "staff") : false;
        },
        isAdmin: function () {
            return !this.isStaff();
        }
    };


    async function checkAuth() {
        try {
            const storedAuth = sessionStorage.getItem("tenspick_authenticated");
            const storedUserRaw = sessionStorage.getItem("tenspick_user");
            let user = null;

            if (storedUserRaw) {
                try {
                    user = JSON.parse(storedUserRaw);
                } catch (e) {}
            }

            // Populate UI if user session exists
            if (user) {
                const name = user.name || (window.TenspickAuth.isStaff() ? "Staff User" : "Tenspick Admin");
                const email = user.email || (window.TenspickAuth.isStaff() ? "staff@tenspick.org" : "admin@tenspick.org");
                const initial = (name.trim().charAt(0) || "A").toUpperCase();

                const sidebarNameEl = document.getElementById("sidebarAdminName");
                const sidebarAvatarEl = document.getElementById("sidebarAdminAvatar");
                const topbarNameEl = document.getElementById("topbarAdminName");
                const topbarInitialEl = document.getElementById("topbarAdminInitial");
                const dropdownNameEl = document.getElementById("dropdownAdminName");
                const dropdownInitialEl = document.getElementById("dropdownAdminInitial");
                const dropdownEmailEl = document.getElementById("dropdownAdminEmail");

                if (sidebarNameEl) sidebarNameEl.textContent = name;
                if (sidebarAvatarEl) sidebarAvatarEl.textContent = initial;
                if (topbarNameEl) topbarNameEl.textContent = name;
                if (topbarInitialEl) topbarInitialEl.textContent = initial;
                if (dropdownNameEl) dropdownNameEl.textContent = name;
                if (dropdownInitialEl) dropdownInitialEl.textContent = initial;
                if (dropdownEmailEl) dropdownEmailEl.textContent = email;
            }

            // If a staff user is on the admin panel (/index.html), redirect to staff portal
            if (window.TenspickAuth.isStaff() && !window.location.pathname.includes("/staff/")) {
                window.location.replace("staff/index.html");
                return;
            }

            // Hide restricted sidebar links if Staff
            if (window.TenspickAuth.isStaff()) {
                const restrictedRoutes = ["client-payments", "staff-payments", "settings", "activity-logs", "staff", "projects", "website-content"];
                restrictedRoutes.forEach(function (route) {
                    const links = document.querySelectorAll('[data-route="' + route + '"]');
                    links.forEach(function (link) {
                        link.style.display = "none";
                    });
                });

                document.querySelectorAll(".sidebar-group").forEach(function (group) {
                    const menuItems = Array.from(group.querySelectorAll(".sidebar-menu-item"));
                    if (menuItems.length > 0) {
                        const visibleItems = menuItems.filter(function (item) {
                            return item.style.display !== "none";
                        });
                        if (visibleItems.length === 0) {
                            group.style.display = "none";
                        }
                    }
                });
            }


            // Optional: try backend check if apiRequest function is available
            if (typeof apiRequest === "function") {
                try {
                    const res = await apiRequest("/auth/me");
                    if (res && res.success && res.data && res.data.admin) {
                        const admin = res.data.admin;
                        sessionStorage.setItem("tenspick_user", JSON.stringify(admin));
                        sessionStorage.setItem("tenspick_authenticated", "true");
                    }
                } catch (apiErr) {
                    // Backend unavailable - if session exists in sessionStorage, maintain login!
                    if (!storedAuth && !user) {
                        window.location.href = "login.html";
                    }
                }
            } else if (!storedAuth && !user) {
                window.location.href = "login.html";
            }
        } catch (err) {
            console.warn("[Tenspick Layout] Auth check note:", err);
        }
    }


    /* ========================================================
       INITIALIZE
       ======================================================== */

    function initialize() {

        checkAuth();

        initializeSidebarEvents();

        initializeProfileEvents();

        initializeClock();

        initializeLogout();

        initializeAdminChangePassword();

        initializeKeyboard();

        initializeResize();

        initializeSPAEvents();

    }


    function initializeAdminChangePassword() {
        const openBtn = document.getElementById("openAdminChangePasswordBtn");
        const closeBtn = document.getElementById("closeAdminChangePasswordBtn");
        const modal = document.getElementById("adminChangePasswordModal");
        const form = document.getElementById("adminChangePasswordForm");
        const msgEl = document.getElementById("adminPasswordMessage");

        if (openBtn && modal) {
            openBtn.addEventListener("click", function (e) {
                e.preventDefault();
                closeProfile();
                modal.style.display = "flex";
                if (msgEl) msgEl.textContent = "";
                if (form) form.reset();
            });
        }

        if (closeBtn && modal) {
            closeBtn.addEventListener("click", function () {
                modal.style.display = "none";
            });
        }

        if (modal) {
            modal.addEventListener("click", function (e) {
                if (e.target === modal) modal.style.display = "none";
            });
        }

        if (form) {
            form.addEventListener("submit", async function (e) {
                e.preventDefault();
                const cur = document.getElementById("adminCurrentPassword").value;
                const newP = document.getElementById("adminNewPassword").value;
                const conP = document.getElementById("adminConfirmPassword").value;

                if (newP !== conP) {
                    if (msgEl) {
                        msgEl.style.color = "#DC2626";
                        msgEl.textContent = "New passwords do not match!";
                    }
                    return;
                }

                if (msgEl) {
                    msgEl.style.color = "#4B49AC";
                    msgEl.textContent = "Updating password...";
                }

                try {
                    if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                        const sb = window.TenspickSupabase.getClient();
                        const userRaw = sessionStorage.getItem("tenspick_user");
                        const user = userRaw ? JSON.parse(userRaw) : null;
                        if (sb && user && user.email) {
                            await sb.from("admins").update({ password_hash: newP }).eq("email", user.email);
                        }
                    }

                    if (msgEl) {
                        msgEl.style.color = "#16A34A";
                        msgEl.textContent = "Password updated successfully!";
                    }
                    setTimeout(() => {
                        if (modal) modal.style.display = "none";
                    }, 1200);
                } catch (err) {
                    if (msgEl) {
                        msgEl.style.color = "#DC2626";
                        msgEl.textContent = err.message || "Failed to update password.";
                    }
                }
            });
        }
    }

    /* ========================================================
       START
       ======================================================== */

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


    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.TenspickLayout = {

        openSidebar:
            openSidebar,

        closeSidebar:
            closeSidebar,

        toggleSidebar:
            toggleSidebar,

        openProfile:
            openProfile,

        closeProfile:
            closeProfile,

        toggleProfile:
            toggleProfile,

        updateClock:
            updateClock

    };


})();