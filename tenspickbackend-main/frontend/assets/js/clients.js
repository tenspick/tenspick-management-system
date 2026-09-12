/* ============================================================
   TENSPICK CRM - CLIENTS MODULE

   Complete SPA-safe client CRUD module

   API:
   /backend/public/index.php/api/clients

   Features:
   - List clients
   - Search
   - Status filter
   - Industry filter
   - Pagination
   - Add
   - Edit
   - Delete
   - View profile
   - CSRF
   - Three-dot action menu
   - SPA safe initialization
   ============================================================ */

(function (window, document) {
    "use strict";


    /* ============================================================
       CONFIG
       ============================================================ */

    const CONFIG = {

        API_BASE:
            window.location.origin +
            "/tenspickk/backend/public/index.php/api",

        CLIENTS_ENDPOINT:
            "/clients",

        CSRF_ENDPOINT:
            "/security/csrf",

        PER_PAGE:
            20,

        DEBUG:
            true
    };


    /* ============================================================
       STATE
       ============================================================ */

    const state = {

        initialized:
            false,

        page:
            1,

        perPage:
            CONFIG.PER_PAGE,

        total:
            0,

        totalPages:
            1,

        clients:
            [],

        filteredClients:
            [],

        currentClient:
            null,

        editingId:
            null,

        csrfToken:
            null,

        requestController:
            null,

        eventController:
            null,

        searchTimer:
            null,

        industries:
            new Set(),

        openMenu:
            null
    };


    /* ============================================================
       LOGGING
       ============================================================ */

    function log() {

        if (!CONFIG.DEBUG) {
            return;
        }

        console.log(
            "[Tenspick Clients]",
            ...arguments
        );
    }


    function warn() {

        if (!CONFIG.DEBUG) {
            return;
        }

        console.warn(
            "[Tenspick Clients]",
            ...arguments
        );
    }


    function errorLog() {

        console.error(
            "[Tenspick Clients]",
            ...arguments
        );
    }


    /* ============================================================
       DOM HELPERS
       ============================================================ */

    function el(id) {

        return document.getElementById(id);
    }


    function pageExists() {

        return !!el("clientsPage");
    }


    /* ============================================================
       HTML ESCAPE
       ============================================================ */

    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value === null ||
            value === undefined
                ? ""
                : String(value);

        return div.innerHTML;
    }


    /* ============================================================
       SAFE VALUE
       ============================================================ */

    function safe(
        value,
        fallback
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return fallback || "—";
        }

        return String(value);
    }


    /* ============================================================
       INITIAL
       ============================================================ */

    function initial(name) {

        const text =
            String(
                name || "C"
            ).trim();

        if (!text) {
            return "C";
        }

        return text
            .charAt(0)
            .toUpperCase();
    }


    /* ============================================================
       CAPITALIZE
       ============================================================ */

    function capitalize(text) {

        text =
            String(
                text || ""
            );

        if (!text) {
            return "";
        }

        return (
            text.charAt(0).toUpperCase() +
            text.slice(1)
        );
    }


    /* ============================================================
       EMAIL VALIDATION
       ============================================================ */

    function validEmail(email) {

        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                String(email || "")
            );
    }


    /* ============================================================
       DATE FORMAT
       ============================================================ */

    function formatDate(value) {

        if (!value) {
            return "—";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(value);
        }

        return date.toLocaleDateString(
            undefined,
            {
                year:
                    "numeric",

                month:
                    "short",

                day:
                    "numeric"
            }
        );
    }


    /* ============================================================
       MESSAGE
       ============================================================ */

    function showMessage(
        message,
        type
    ) {

        if (
            typeof window.showToast ===
            "function"
        ) {

            window.showToast(
                message,
                type
            );

            return;
        }


        if (
            window.TenspickToast &&
            typeof window.TenspickToast.show ===
            "function"
        ) {

            window.TenspickToast.show(
                message,
                type
            );

            return;
        }


        if (type === "error") {

            console.error(
                "[Tenspick Clients]",
                message
            );

        } else {

            console.log(
                "[Tenspick Clients]",
                message
            );
        }
    }


    /* ============================================================
       CSRF TOKEN
       ============================================================ */

    async function getCsrfToken(
        forceRefresh
    ) {

        if (
            state.csrfToken &&
            !forceRefresh
        ) {

            return state.csrfToken;
        }


        log(
            "Requesting CSRF token..."
        );


        const response =
            await fetch(
                CONFIG.API_BASE +
                CONFIG.CSRF_ENDPOINT,
                {
                    method:
                        "GET",

                    credentials:
                        "same-origin",

                    headers: {
                        Accept:
                            "application/json"
                    },

                    cache:
                        "no-store"
                }
            );


        const text =
            await response.text();


        let json;


        try {

            json =
                text
                    ? JSON.parse(text)
                    : null;

        } catch (error) {

            errorLog(
                "Invalid CSRF JSON:",
                error
            );

            throw new Error(
                "Security endpoint returned invalid JSON."
            );
        }


        if (
            !response.ok ||
            !json ||
            json.success !== true ||
            !json.data ||
            !json.data.token
        ) {

            throw new Error(
                json &&
                json.message
                    ? json.message
                    : "Unable to obtain security token."
            );
        }


        state.csrfToken =
            json.data.token;


        return state.csrfToken;
    }


    /* ============================================================
       GENERIC API REQUEST
       ============================================================ */

    async function request(
        endpoint,
        options
    ) {

        options =
            options || {};


        const method =
            String(
                options.method || "GET"
            ).toUpperCase();


        const headers = {

            Accept:
                "application/json"
        };


        let body;


        if (
            options.body !==
                undefined &&
            options.body !== null
        ) {

            headers[
                "Content-Type"
            ] =
                "application/json";


            body =
                JSON.stringify(
                    options.body
                );
        }


        if (
            ![
                "GET",
                "HEAD",
                "OPTIONS"
            ].includes(method)
        ) {

            headers[
                "X-CSRF-Token"
            ] =
                await getCsrfToken();
        }


        const response =
            await fetch(
                CONFIG.API_BASE +
                endpoint,
                {
                    method:
                        method,

                    credentials:
                        "same-origin",

                    headers:
                        headers,

                    body:
                        body,

                    cache:
                        "no-store",

                    signal:
                        options.signal
                }
            );


        const text =
            await response.text();


        let json =
            null;


        try {

            json =
                text
                    ? JSON.parse(text)
                    : null;

        } catch (error) {

            const cleanText =
                text
                    .replace(
                        /<[^>]*>/g,
                        " "
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();


            throw new Error(
                cleanText ||
                "Server returned invalid JSON."
            );
        }


        if (
            !response.ok ||
            (
                json &&
                json.success === false
            )
        ) {

            const error =
                new Error(
                    json &&
                    json.message
                        ? json.message
                        : (
                            "Request failed (" +
                            response.status +
                            ")."
                        )
                );


            error.status =
                response.status;


            error.response =
                json;


            throw error;
        }


        return json;
    }


    /* ============================================================
       TABLE LOADING
       ============================================================ */

    function setTableLoading() {

        const body =
            el(
                "clientsTableBody"
            );


        if (!body) {
            return;
        }


        body.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="clients-table-message"
                >
                    <div class="clients-loading-state">

                        <div
                            class="clients-loading-spinner"
                        ></div>

                        <span>
                            Loading clients...
                        </span>

                    </div>
                </td>
            </tr>
        `;
    }


    /* ============================================================
       TABLE ERROR
       ============================================================ */

    function setTableError(
        message
    ) {

        const body =
            el(
                "clientsTableBody"
            );


        if (!body) {
            return;
        }


        body.innerHTML = `
            <tr>
                <td
                    colspan="9"
                    class="
                        clients-table-message
                        clients-table-error
                    "
                >

                    <div>

                        <strong>
                            Unable to load clients
                        </strong>

                        <p>
                            ${escapeHtml(
                                message
                            )}
                        </p>

                        <button
                            type="button"
                            class="
                                clients-btn
                                clients-btn-secondary
                            "
                            data-client-retry
                        >
                            Try Again
                        </button>

                    </div>

                </td>
            </tr>
        `;
    }


    /* ============================================================
       LOAD CLIENTS
       ============================================================ */

    async function loadClients(
        page
    ) {

        if (!pageExists()) {

            warn(
                "Clients page not found."
            );

            return;
        }


        page =
            Math.max(
                1,
                Number(page) || 1
            );


        state.page =
            page;


        closeActionMenu();


        if (
            state.requestController
        ) {

            try {

                state.requestController.abort();

            } catch (error) {

                warn(
                    "Unable to abort old request:",
                    error
                );
            }
        }


        state.requestController =
            new AbortController();


        const searchElement =
            el(
                "clientSearch"
            );


        const statusElement =
            el(
                "clientStatusFilter"
            );


        const search =
            searchElement
                ? searchElement.value.trim()
                : "";


        const status =
            statusElement
                ? statusElement.value
                : "";


        const params =
            new URLSearchParams();


        params.set(
            "page",
            String(page)
        );


        params.set(
            "per_page",
            String(
                state.perPage
            )
        );


        if (search) {

            params.set(
                "search",
                search
            );
        }


        if (status) {

            params.set(
                "status",
                status
            );
        }


        const endpoint =
            CONFIG.CLIENTS_ENDPOINT +
            "?" +
            params.toString();


        log(
            "Loading clients:",
            endpoint
        );


        setTableLoading();


        try {

            const response =
                await fetch(
                    CONFIG.API_BASE +
                    endpoint,
                    {
                        method:
                            "GET",

                        credentials:
                            "same-origin",

                        headers: {
                            Accept:
                                "application/json"
                        },

                        signal:
                            state
                                .requestController
                                .signal,

                        cache:
                            "no-store"
                    }
                );


            const text =
                await response.text();


            let list = [];

            // 1. Try Supabase if configured
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const { data, error } = await sb.from("clients").select("*").order("id", { ascending: false });
                    if (data && Array.isArray(data)) list = data;
                } catch (sbErr) {
                    console.warn("Supabase clients query note:", sbErr);
                }
            }

            // 2. Try PHP API if JSON valid
            if (!list.length) {
                try {
                    const json = text ? JSON.parse(text) : null;
                    if (response.ok && json && json.success === true) {
                        const data = json.data || {};
                        list = Array.isArray(data.items) ? data.items : (Array.isArray(data.clients) ? data.clients : []);
                    }
                } catch (jsonErr) {}
            }

            // 3. Try LocalStorage cache if list empty
            if (!list.length) {
                const cached = localStorage.getItem("tenspick_clients");
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed)) {
                            list = parsed.filter(c => {
                                const name = String(c.client_name || c.name || "").toLowerCase();
                                return name !== "sri lakshmi traders" && name !== "puttur fashion store";
                            });
                        }
                    } catch (e) {}
                }
            }

            state.clients = list;


            const pagination = {};


            state.total =
                Number(
                    pagination.total
                ) ||
                state.clients.length;


            state.page =
                Number(
                    pagination.page
                ) ||
                page;


            state.perPage =
                Number(
                    pagination.per_page
                ) ||
                state.perPage;


            state.totalPages =
                Math.max(
                    1,
                    Number(
                        pagination.total_pages
                    ) ||
                    Math.ceil(
                        state.total /
                        state.perPage
                    ) ||
                    1
                );


            collectIndustries();


            applyIndustryFilter();


            // Compute stats from the loaded list directly (no separate API dependency)
            const statsFromList = {
                total: list.length,
                active: list.filter(function (c) { return String(c.status || "").toLowerCase() === "active"; }).length,
                inactive: list.filter(function (c) { return String(c.status || "").toLowerCase() === "inactive"; }).length,
                suspended: list.filter(function (c) { return String(c.status || "").toLowerCase() === "suspended"; }).length
            };
            updateStatistics(statsFromList);


            renderClients();


            renderPagination();


            updateResultCount();


        } catch (error) {

            if (
                error &&
                error.name ===
                    "AbortError"
            ) {

                return;
            }


            errorLog(
                "loadClients failed:",
                error
            );


            setTableError(
                error.message ||
                "Unable to load clients."
            );
        }
    }


    /* ============================================================
       INDUSTRIES
       ============================================================ */

    function collectIndustries() {

        const select =
            el(
                "clientIndustryFilter"
            );


        if (!select) {
            return;
        }


        state.clients.forEach(
            function (client) {

                const industry =
                    String(
                        client.industry ||
                        ""
                    ).trim();


                if (industry) {

                    state.industries.add(
                        industry
                    );
                }
            }
        );


        const selected =
            select.value;


        select.innerHTML =
            '<option value="">All Industries</option>';


        Array.from(
            state.industries
        )
            .sort(
                function (a, b) {

                    return a.localeCompare(
                        b
                    );
                }
            )
            .forEach(
                function (industry) {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        industry;


                    option.textContent =
                        industry;


                    select.appendChild(
                        option
                    );
                }
            );


        if (
            Array.from(
                state.industries
            ).includes(
                selected
            )
        ) {

            select.value =
                selected;
        }
    }


    /* ============================================================
       INDUSTRY FILTER
       ============================================================ */

    function applyIndustryFilter() {

        const select =
            el(
                "clientIndustryFilter"
            );


        const wanted =
            select
                ? select.value
                    .trim()
                    .toLowerCase()
                : "";


        if (!wanted) {

            state.filteredClients =
                state.clients.slice();

            return;
        }


        state.filteredClients =
            state.clients.filter(
                function (client) {

                    return (
                        String(
                            client.industry ||
                            ""
                        )
                            .trim()
                            .toLowerCase() ===
                        wanted
                    );
                }
            );
    }


    /* ============================================================
       STATISTICS
       ============================================================ */

    function updateStatistics(
        statistics
    ) {

        const map = {

            totalClientsCount:
                statistics.total,

            activeClientsCount:
                statistics.active,

            inactiveClientsCount:
                statistics.inactive,

            suspendedClientsCount:
                statistics.suspended
        };


        Object.keys(map).forEach(
            function (id) {

                const element =
                    el(id);


                if (!element) {
                    return;
                }


                element.textContent =
                    Number(
                        map[id]
                    ) || 0;
            }
        );
    }


    /* ============================================================
       RENDER CLIENTS
       ============================================================ */

    function renderClients() {

        const body =
            el(
                "clientsTableBody"
            );


        if (!body) {
            return;
        }


        closeActionMenu();


        if (
            !state.filteredClients.length
        ) {

            body.innerHTML = `
                <tr>
                    <td
                        colspan="9"
                        class="clients-table-message"
                    >
                        No clients found.
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            state.filteredClients
                .map(
                    renderClientRow
                )
                .join("");
    }


    /* ============================================================
       RENDER CLIENT ROW
       ============================================================ */

    function renderClientRow(
        client
    ) {

        const id =
            Number(
                client.id
            ) || 0;


        const status =
            String(
                client.status ||
                "active"
            )
                .toLowerCase()
                .replace(
                    /[^a-z_-]/g,
                    ""
                );


        return `
            <tr
                data-client-id="${id}"
            >

                <td>

                    <div
                        class="clients-table-client"
                    >

                        <div
                            class="clients-table-avatar"
                        >
                            ${escapeHtml(
                                initial(
                                    client.client_name
                                )
                            )}
                        </div>

                        <div>

                            <strong>
                                ${escapeHtml(
                                    safe(
                                        client.client_name,
                                        "Unnamed Client"
                                    )
                                )}
                            </strong>

                        </div>

                    </div>

                </td>


                <td>
                    ${escapeHtml(
                        safe(
                            client.company_name
                        )
                    )}
                </td>


                <td>
                    ${escapeHtml(
                        safe(
                            client.mobile
                        )
                    )}
                </td>


                <td>
                    ${escapeHtml(
                        safe(
                            client.email
                        )
                    )}
                </td>


                <td>
                    ${escapeHtml(
                        safe(
                            client.industry
                        )
                    )}
                </td>


                <td>

                    <span
                        class="clients-code"
                    >
                        ${escapeHtml(
                            safe(
                                client.client_code
                            )
                        )}
                    </span>

                </td>


                <td>

                    <span
                        class="
                            clients-status
                            clients-status-${escapeHtml(
                                status
                            )}
                        "
                    >
                        ${escapeHtml(
                            capitalize(
                                status
                            )
                        )}
                    </span>

                </td>


                <td>
                    ${escapeHtml(
                        formatDate(
                            client.created_at
                        )
                    )}
                </td>


                <td
                    class="clients-actions-cell"
                >

                    <div
                        class="clients-action-menu"
                    >

                        <button
                            type="button"
                            class="
                                clients-action-trigger
                            "
                            data-client-action-menu
                            aria-label="Client actions"
                            aria-haspopup="true"
                            aria-expanded="false"
                        >
                            ⋯
                        </button>


                        <div
                            class="
                                clients-action-dropdown
                            "
                            hidden
                        >

                            <button
                                type="button"
                                class="
                                    clients-action-item
                                "
                                data-client-action="view"
                                data-client-id="${id}"
                            >

                                <span
                                    class="
                                        clients-action-icon
                                    "
                                    aria-hidden="true"
                                >
                                    👁
                                </span>

                                <span>
                                    View
                                </span>

                            </button>


                            <button
                                type="button"
                                class="
                                    clients-action-item
                                "
                                data-client-action="edit"
                                data-client-id="${id}"
                            >

                                <span
                                    class="
                                        clients-action-icon
                                    "
                                    aria-hidden="true"
                                >
                                    ✎
                                </span>

                                <span>
                                    Edit
                                </span>

                            </button>


                            ${!(window.TenspickAuth && window.TenspickAuth.isStaff()) ? `
                            <button
                                type="button"
                                class="
                                    clients-action-item
                                    clients-action-danger
                                "
                                data-client-action="delete"
                                data-client-id="${id}"
                            >

                                <span
                                    class="
                                        clients-action-icon
                                    "
                                    aria-hidden="true"
                                >
                                    🗑
                                </span>

                                <span>
                                    Delete
                                </span>

                            </button>
                            ` : ""}

                        </div>

                    </div>

                </td>

            </tr>
        `;
    }


    /* ============================================================
       POSITION ACTION MENU
       ============================================================ */

    function positionActionMenu(
        trigger,
        dropdown
    ) {

        if (
            !trigger ||
            !dropdown
        ) {
            return;
        }


        dropdown.style.position =
            "fixed";


        dropdown.style.zIndex =
            "99999";


        dropdown.style.display =
            "block";


        dropdown.style.visibility =
            "hidden";


        dropdown.style.left =
            "0px";


        dropdown.style.top =
            "0px";


        const triggerRect =
            trigger.getBoundingClientRect();


        const dropdownRect =
            dropdown.getBoundingClientRect();


        const gap =
            8;


        const edge =
            8;


        let top =
            triggerRect.bottom +
            gap;


        /*
         * If there is not enough room below,
         * open above.
         */

        if (
            top +
                dropdownRect.height >
            window.innerHeight -
                edge
        ) {

            top =
                triggerRect.top -
                dropdownRect.height -
                gap;
        }


        /*
         * Keep within viewport.
         */

        top =
            Math.max(
                edge,
                top
            );


        let left =
            triggerRect.right -
            dropdownRect.width;


        left =
            Math.max(
                edge,
                Math.min(
                    left,
                    window.innerWidth -
                    dropdownRect.width -
                    edge
                )
            );


        dropdown.style.left =
            Math.round(
                left
            ) +
            "px";


        dropdown.style.top =
            Math.round(
                top
            ) +
            "px";


        dropdown.style.visibility =
            "visible";
    }


    /* ============================================================
       CLOSE ACTION MENU
       ============================================================ */

    function closeActionMenu() {

        const open =
            state.openMenu;


        /*
         * Remove position listeners.
         */

        if (
            open &&
            open.positionHandler
        ) {

            window.removeEventListener(
                "resize",
                open.positionHandler
            );


            window.removeEventListener(
                "scroll",
                open.positionHandler,
                true
            );
        }


        /*
         * Restore currently open menu.
         */

        if (
            open &&
            open.dropdown
        ) {

            const dropdown =
                open.dropdown;


            const trigger =
                open.trigger;


            if (trigger) {

                trigger.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }


            dropdown.hidden =
                true;


            dropdown.classList.remove(
                "clients-action-dropdown-portal"
            );


            dropdown.style.position =
                "";


            dropdown.style.zIndex =
                "";


            dropdown.style.display =
                "";


            dropdown.style.visibility =
                "";


            dropdown.style.left =
                "";


            dropdown.style.top =
                "";


            /*
             * Restore to original location.
             */

            if (
                open.placeholder &&
                open.placeholder.parentNode
            ) {

                open.placeholder.parentNode.insertBefore(
                    dropdown,
                    open.placeholder
                );


                open.placeholder.remove();

            } else if (
                dropdown.parentNode ===
                document.body
            ) {

                dropdown.remove();
            }
        }


        /*
         * Close any remaining dropdown.
         */

        document
            .querySelectorAll(
                ".clients-action-dropdown"
            )
            .forEach(
                function (dropdown) {

                    dropdown.hidden =
                        true;


                    const trigger =
                        dropdown
                            .closest(
                                ".clients-action-menu"
                            )
                            ?.querySelector(
                                "[data-client-action-menu]"
                            );


                    if (trigger) {

                        trigger.setAttribute(
                            "aria-expanded",
                            "false"
                        );
                    }
                }
            );


        /*
         * Remove stale body portals.
         */

        document
            .querySelectorAll(
                "body > .clients-action-dropdown-portal"
            )
            .forEach(
                function (dropdown) {

                    dropdown.remove();
                }
            );


        state.openMenu =
            null;
    }


    /* ============================================================
       ACTION MENU CLICK
       ============================================================ */

    function handleActionMenuClick(
        event
    ) {

        /*
         * THREE DOT BUTTON
         */

        const trigger =
            event.target.closest(
                "[data-client-action-menu]"
            );


        if (trigger) {

            event.preventDefault();

            event.stopPropagation();


            const menu =
                trigger.closest(
                    ".clients-action-menu"
                );


            if (!menu) {
                return;
            }


            const dropdown =
                menu.querySelector(
                    ".clients-action-dropdown"
                );


            if (!dropdown) {

                errorLog(
                    "Client action dropdown not found."
                );

                return;
            }


            /*
             * Toggle same menu.
             */

            if (
                state.openMenu &&
                state.openMenu.dropdown ===
                    dropdown
            ) {

                closeActionMenu();

                return;
            }


            /*
             * Close previous.
             */

            closeActionMenu();


            /*
             * Placeholder lets us restore
             * dropdown after closing.
             */

            const placeholder =
                document.createComment(
                    "client-action-dropdown"
                );


            dropdown.parentNode.insertBefore(
                placeholder,
                dropdown
            );


            state.openMenu = {

                trigger:
                    trigger,

                dropdown:
                    dropdown,

                placeholder:
                    placeholder,

                positionHandler:
                    null
            };


            /*
             * MOVE DROPDOWN TO BODY
             *
             * This fixes clipping caused by:
             * overflow:hidden
             */

            document.body.appendChild(
                dropdown
            );


            dropdown.hidden =
                false;


            dropdown.classList.add(
                "clients-action-dropdown-portal"
            );


            trigger.setAttribute(
                "aria-expanded",
                "true"
            );


            /*
             * Position menu.
             */

            const reposition =
                function () {

                    if (
                        state.openMenu &&
                        state.openMenu.dropdown ===
                            dropdown &&
                        document.body.contains(
                            dropdown
                        )
                    ) {

                        positionActionMenu(
                            trigger,
                            dropdown
                        );
                    }
                };


            state.openMenu.positionHandler =
                reposition;


            window.addEventListener(
                "resize",
                reposition
            );


            window.addEventListener(
                "scroll",
                reposition,
                true
            );


            positionActionMenu(
                trigger,
                dropdown
            );


            return;
        }


        /*
         * ACTION ITEM
         */

        const actionButton =
            event.target.closest(
                "[data-client-action]"
            );


        if (!actionButton) {
            return;
        }


        event.preventDefault();

        event.stopPropagation();


        const action =
            actionButton.getAttribute(
                "data-client-action"
            );


        const id =
            Number(
                actionButton.getAttribute(
                    "data-client-id"
                )
            );


        if (
            !id ||
            ![
                "view",
                "edit",
                "delete"
            ].includes(action)
        ) {

            errorLog(
                "Invalid client action."
            );

            closeActionMenu();

            return;
        }


        closeActionMenu();


        handleExistingClientAction(
            action,
            id
        );
    }


    /* ============================================================
       TABLE ACTION HANDLER
       ============================================================ */

    function handleTableAction(
        event
    ) {

        if (
            !event ||
            !event.target
        ) {
            return;
        }


        /*
         * Menu actions are handled by
         * handleActionMenuClick().
         */

        if (
            event.target.closest(
                ".clients-action-menu"
            )
        ) {

            return;
        }


        /*
         * Retry button.
         */

        const retry =
            event.target.closest(
                "[data-client-retry]"
            );


        if (retry) {

            event.preventDefault();

            event.stopPropagation();

            loadClients(
                state.page || 1
            );

            return;
        }


        /*
         * Direct action support.
         */

        const button =
            event.target.closest(
                "[data-client-action]"
            );


        if (!button) {
            return;
        }


        const action =
            button.getAttribute(
                "data-client-action"
            );


        const id =
            Number(
                button.getAttribute(
                    "data-client-id"
                )
            );


        if (
            !id ||
            ![
                "view",
                "edit",
                "delete"
            ].includes(action)
        ) {
            return;
        }


        event.preventDefault();

        event.stopPropagation();


        handleExistingClientAction(
            action,
            id
        );
    }


    /* ============================================================
       EXISTING CLIENT ACTION
       ============================================================ */

    function handleExistingClientAction(
        action,
        id
    ) {

        const client =
            state.clients.find(
                function (item) {

                    return (
                        Number(
                            item.id
                        ) ===
                        Number(id)
                    );
                }
            );


        if (client) {

            if (
                action ===
                "view"
            ) {

                openClientProfile(
                    client
                );

                return;
            }


            if (
                action ===
                "edit"
            ) {

                openEditClientModal(
                    client
                );

                return;
            }


            if (
                action ===
                "delete"
            ) {

                deleteClient(
                    id
                );

                return;
            }
        }


        /*
         * Client isn't currently loaded.
         */

        fetchClient(
            id
        )
            .then(
                function (loadedClient) {

                    if (!loadedClient) {
                        return;
                    }


                    if (
                        action ===
                        "view"
                    ) {

                        openClientProfile(
                            loadedClient
                        );

                    } else if (
                        action ===
                        "edit"
                    ) {

                        openEditClientModal(
                            loadedClient
                        );

                    } else if (
                        action ===
                        "delete"
                    ) {

                        deleteClient(
                            id
                        );
                    }
                }
            );
    }


    /* ============================================================
       FETCH SINGLE CLIENT
       ============================================================ */

    async function fetchClient(
        id
    ) {

        try {

            const response =
                await request(
                    CONFIG.CLIENTS_ENDPOINT +
                    "/" +
                    encodeURIComponent(
                        id
                    )
                );


            return (
                response &&
                response.data
                    ? response.data
                    : null
            );

        } catch (error) {

            errorLog(
                "fetchClient failed:",
                error
            );


            showMessage(
                error.message ||
                "Unable to load client.",
                "error"
            );


            return null;
        }
    }


    /* ============================================================
       MODAL OPEN
       ============================================================ */

    function openModal(
        id
    ) {

        const modal =
            el(id);


        if (!modal) {

            warn(
                "Modal not found:",
                id
            );

            return;
        }


        modal.hidden =
            false;


        modal.removeAttribute(
            "hidden"
        );


        modal.classList.add(
            "is-open"
        );


        document.body.classList.add(
            "clients-modal-open"
        );
    }


    /* ============================================================
       MODAL CLOSE
       ============================================================ */

    function closeModal(
        id
    ) {

        const modal =
            el(id);


        if (!modal) {
            return;
        }


        modal.classList.remove(
            "is-open"
        );


        modal.hidden =
            true;


        modal.setAttribute(
            "hidden",
            ""
        );


        const clientModal =
            el(
                "clientModal"
            );


        const profileModal =
            el(
                "clientProfileModal"
            );


        const clientOpen =
            clientModal &&
            !clientModal.hidden;


        const profileOpen =
            profileModal &&
            !profileModal.hidden;


        if (
            !clientOpen &&
            !profileOpen
        ) {

            document.body.classList.remove(
                "clients-modal-open"
            );
        }
    }


    /* ============================================================
       SET FIELD
       ============================================================ */

    function setField(
        id,
        value
    ) {

        const element =
            el(id);


        if (!element) {
            return;
        }


        element.value =
            value === null ||
            value === undefined
                ? ""
                : String(value);
    }


    /* ============================================================
       CLEAR VALIDATION
       ============================================================ */

    function clearValidation() {

        const form =
            el(
                "clientForm"
            );


        if (!form) {
            return;
        }


        form
            .querySelectorAll(
                ".is-invalid"
            )
            .forEach(
                function (element) {

                    element.classList.remove(
                        "is-invalid"
                    );
                }
            );
    }


    /* ============================================================
       ADD CLIENT
       ============================================================ */

    function openAddClientModal() {

        const form =
            el(
                "clientForm"
            );


        if (!form) {

            errorLog(
                "#clientForm not found."
            );

            return;
        }


        state.editingId =
            null;


        state.currentClient =
            null;


        clearValidation();


        form.reset();


        setField(
            "clientId",
            ""
        );


        setField(
            "clientStatus",
            "active"
        );


        setField(
            "clientPassword",
            ""
        );


        setField(
            "clientConfirmPassword",
            ""
        );


        const title =
            el(
                "clientModalTitle"
            );


        if (title) {

            title.textContent =
                "Add New Client";
        }


        const button =
            el(
                "saveClientButton"
            );


        if (button) {

            button.textContent =
                "Create Client";
        }


        openModal(
            "clientModal"
        );
    }


    /* ============================================================
       EDIT CLIENT
       ============================================================ */

    function openEditClientModal(
        client
    ) {

        if (
            !client ||
            !client.id
        ) {
            return;
        }


        const form =
            el(
                "clientForm"
            );


        if (!form) {

            errorLog(
                "#clientForm not found."
            );

            return;
        }


        state.editingId =
            Number(
                client.id
            );


        clearValidation();


        form.reset();


        const fields = {

            clientId:
                client.id,

            clientName:
                client.client_name,

            clientCompanyName:
                client.company_name,

            clientMobile:
                client.mobile,

            clientWhatsapp:
                client.whatsapp,

            clientEmail:
                client.email,

            clientAlternatePhone:
                client.alternate_phone,

            clientBusinessType:
                client.business_type,

            clientIndustry:
                client.industry,

            clientWebsite:
                client.website,

            clientAddress:
                client.address,

            clientCity:
                client.city,

            clientState:
                client.state,

            clientPincode:
                client.pincode,

            clientBusinessDescription:
                client.business_description,

            clientContactPersonName:
                client.contact_person_name,

            clientContactPersonDesignation:
                client.contact_person_designation,

            clientContactPersonMobile:
                client.contact_person_mobile,

            clientContactPersonEmail:
                client.contact_person_email,

            clientBillingName:
                client.billing_name,

            clientGstNumber:
                client.gst_number,

            clientPanNumber:
                client.pan_number,

            clientBillingAddress:
                client.billing_address,

            clientLoginEmail:
                client.login_email ||
                client.email,

            clientStatus:
                client.status ||
                "active",

            clientInternalNotes:
                client.internal_notes
        };


        Object.keys(fields)
            .forEach(
                function (id) {

                    setField(
                        id,
                        fields[id]
                    );
                }
            );


        /*
         * Password must never be loaded
         * from the server.
         */

        setField(
            "clientPassword",
            ""
        );


        setField(
            "clientConfirmPassword",
            ""
        );


        const title =
            el(
                "clientModalTitle"
            );


        if (title) {

            title.textContent =
                "Edit Client";
        }


        const button =
            el(
                "saveClientButton"
            );


        if (button) {

            button.textContent =
                "Update Client";
        }


        openModal(
            "clientModal"
        );
    }


    /* ============================================================
       FORM PAYLOAD
       ============================================================ */

    function getFormPayload() {

        const form =
            el(
                "clientForm"
            );


        const payload = {};


        if (!form) {
            return payload;
        }


        const formData =
            new FormData(form);


        formData.forEach(
            function (value, key) {

                payload[key] =
                    String(
                        value
                    ).trim();
            }
        );


        return payload;
    }


    /* ============================================================
       SAVE CLIENT
       ============================================================ */

    async function saveClient() {

        const form =
            el(
                "clientForm"
            );


        if (!form) {

            errorLog(
                "#clientForm not found."
            );

            return;
        }


        clearValidation();


        const payload =
            getFormPayload();


        const id =
            Number(
                payload.id ||
                state.editingId ||
                0
            );


        const editing =
            id > 0;


        if (!editing) {

            delete payload.id;
        }


        /*
         * Required fields.
         */

        if (
            !payload.client_name &&
            !payload.name
        ) {

            showMessage(
                "Client name is required.",
                "error"
            );

            return;
        }


        if (
            !payload.company_name
        ) {

            showMessage(
                "Company name is required.",
                "error"
            );

            return;
        }


        if (
            !payload.mobile
        ) {

            showMessage(
                "Mobile number is required.",
                "error"
            );

            return;
        }


        if (
            !payload.email
        ) {

            showMessage(
                "Email is required.",
                "error"
            );

            return;
        }


        if (
            !validEmail(
                payload.email
            )
        ) {

            showMessage(
                "Please enter a valid email address.",
                "error"
            );

            return;
        }


        /*
         * Password is required only
         * for creating a client.
         */

        if (
            !editing &&
            !payload.password
        ) {

            showMessage(
                "Password is required.",
                "error"
            );

            return;
        }


        /*
         * Confirm password.
         */

        if (
            payload.password &&
            payload.password !==
                payload.confirm_password
        ) {

            showMessage(
                "Passwords do not match.",
                "error"
            );

            return;
        }


        /*
         * Backend does not need confirm_password.
         */

        delete payload.confirm_password;


        const button =
            el(
                "saveClientButton"
            );


        const oldText =
            button
                ? button.textContent
                : "Save";


        if (button) {

            button.disabled =
                true;


            button.textContent =
                "Saving...";
        }


        try {
            let savedSuccessfully = false;

            // 1. Try Supabase if configured
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const clientRecord = {
                        client_code: payload.client_code || ("CL-" + String(Date.now()).slice(-6)),
                        client_name: payload.client_name || payload.name || "New Client",
                        company_name: payload.company_name || payload.client_name || "Company",
                        mobile: payload.mobile || "0000000000",
                        whatsapp: payload.whatsapp || payload.mobile || "",
                        email: payload.email || "client@example.com",
                        login_email: payload.email || ("client_" + Date.now() + "@tenspick.org"),
                        password_hash: payload.password || "ClientPassword@123",
                        status: payload.status || "active",
                        business_type: payload.business_type || "",
                        industry: payload.industry || "",
                        website: payload.website || "",
                        address: payload.address || "",
                        city: payload.city || "",
                        state: payload.state || "",
                        pincode: payload.pincode || "",
                        contact_person_name: payload.contact_person_name || payload.client_name || "",
                        contact_person_email: payload.contact_person_email || payload.email || "",
                        contact_person_mobile: payload.contact_person_mobile || payload.mobile || "",
                        billing_name: payload.billing_name || payload.company_name || "",
                        gst_number: payload.gst_number || "",
                        pan_number: payload.pan_number || ""
                    };

                    if (editing) {
                        const { error: sbErr } = await sb.from("clients").update(clientRecord).eq("id", id);
                        if (!sbErr) savedSuccessfully = true;
                    } else {
                        const { error: sbErr } = await sb.from("clients").insert([clientRecord]);
                        if (!sbErr) savedSuccessfully = true;
                    }
                } catch (sbException) {
                    console.warn("Supabase client save warning:", sbException);
                }
            }

            // 2. Try PHP API if Supabase not used
            if (!savedSuccessfully) {
                try {
                    const endpoint = editing ? (CONFIG.CLIENTS_ENDPOINT + "/" + encodeURIComponent(id)) : CONFIG.CLIENTS_ENDPOINT;
                    await request(endpoint, { method: editing ? "PUT" : "POST", body: payload });
                    savedSuccessfully = true;
                } catch (apiErr) {
                    console.warn("PHP API client save fallback:", apiErr);
                }
            }

            // 3. Sync to LocalStorage
            let localList = [];
            try {
                const cached = localStorage.getItem("tenspick_clients");
                if (cached) localList = JSON.parse(cached) || [];
            } catch (e) {}

            if (editing) {
                const targetIdStr = String(id);
                let updated = false;
                localList = localList.map(function (item) {
                    if (String(item.id) === targetIdStr) {
                        updated = true;
                        return {
                            ...item,
                            client_name: payload.client_name || payload.name || item.client_name,
                            company_name: payload.company_name || item.company_name,
                            mobile: payload.mobile || item.mobile,
                            whatsapp: payload.whatsapp || item.whatsapp,
                            email: payload.email || item.email,
                            status: payload.status || item.status,
                            business_type: payload.business_type || item.business_type,
                            industry: payload.industry || item.industry,
                            website: payload.website || item.website,
                            address: payload.address || item.address
                        };
                    }
                    return item;
                });
                if (!updated) {
                    localList.push({
                        id: id,
                        client_code: payload.client_code || ("CL-" + String(id).slice(-4)),
                        client_name: payload.client_name || payload.name || "Client",
                        company_name: payload.company_name || "Company",
                        mobile: payload.mobile || "",
                        email: payload.email || "",
                        status: payload.status || "active",
                        created_at: new Date().toISOString()
                    });
                }
            } else {
                const newId = Date.now();
                const pwdStr = payload.password || "ClientPassword@123";
                let hashHex = "";
                try {
                    const encoder = new TextEncoder();
                    const data = encoder.encode(pwdStr);
                    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
                    hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
                } catch(e) {
                    hashHex = "hash_" + btoa(pwdStr);
                }

                const newClientObj = {
                    id: newId,
                    client_code: payload.client_code || ("CL-" + String(newId).slice(-4)),
                    client_name: payload.client_name || payload.name || "New Client",
                    company_name: payload.company_name || "Company",
                    mobile: payload.mobile || "0000000000",
                    email: payload.email || "client@example.com",
                    login_email: payload.email || "client@example.com",
                    password_hash: hashHex,
                    status: payload.status || "active",
                    created_at: new Date().toISOString()
                };
                localList.unshift(newClientObj);
            }

            localStorage.setItem("tenspick_clients", JSON.stringify(localList));
            localStorage.setItem("tenspick_clients_initialized", "true");

            closeModal("clientModal");
            state.editingId = null;

            showMessage(editing ? "Client updated successfully." : "Client created successfully.", "success");
            await loadClients(editing ? state.page : 1);


        } catch (error) {

            errorLog(
                "saveClient failed:",
                error
            );

            if (
                error.response &&
                error.response.errors
            ) {

                const errors =
                    error.response.errors;


                const fieldMap = {

                    client_name:
                        "clientName",

                    company_name:
                        "clientCompanyName",

                    mobile:
                        "clientMobile",

                    email:
                        "clientEmail",

                    login_email:
                        "clientLoginEmail",

                    password:
                        "clientPassword",

                    confirm_password:
                        "clientConfirmPassword"
                };


                Object.keys(errors)
                    .forEach(
                        function (field) {

                            const fieldId =
                                fieldMap[field] ||
                                field;


                            const input =
                                el(
                                    fieldId
                                );


                            if (input) {

                                input.classList.add(
                                    "is-invalid"
                                );
                            }
                        }
                    );
            }


            showMessage(
                error.message ||
                "Unable to save client.",
                "error"
            );


        } finally {

            if (button) {

                button.disabled =
                    false;


                button.textContent =
                    oldText;
            }
        }
    }


    /* ============================================================
       DELETE CLIENT
       ============================================================ */

    async function deleteClient(
        id
    ) {

        if (window.TenspickAuth && window.TenspickAuth.isStaff()) {
            showMessage("Permission Denied: Staff members are not permitted to delete clients.", "error");
            return;
        }

        id =
            Number(id);


        if (!id) {
            return;
        }


        const client =
            state.clients.find(
                function (item) {

                    return (
                        Number(
                            item.id
                        ) === id
                    );
                }
            );


        const name =
            client &&
            client.client_name
                ? client.client_name
                : "this client";


        const confirmed =
            window.confirm(
                "Are you sure you want to delete " +
                name +
                "?\n\nThis action cannot be undone."
            );


        if (!confirmed) {
            return;
        }


        try {
            let deletedSuccessfully = false;

            // 1. Try Supabase if configured
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    if (sb) {
                        const { error: sbErr } = await sb.from("clients").delete().eq("id", id);
                        if (!sbErr) deletedSuccessfully = true;
                    }
                } catch (sbErr) {
                    console.warn("Supabase client delete note:", sbErr);
                }
            }

            // 2. Try PHP API if Supabase didn't delete
            if (!deletedSuccessfully) {
                try {
                    await request(
                        CONFIG.CLIENTS_ENDPOINT +
                        "/" +
                        encodeURIComponent(id),
                        { method: "DELETE" }
                    );
                } catch (apiErr) {
                    console.warn("PHP API client delete fallback:", apiErr);
                }
            }

            // 3. Sync with LocalStorage
            const targetIdStr = String(id);
            let localList = [];
            try {
                const cached = localStorage.getItem("tenspick_clients");
                if (cached) localList = JSON.parse(cached) || [];
            } catch (e) {}

            localList = localList.filter(function (item) {
                return String(item.id) !== targetIdStr;
            });
            localStorage.setItem("tenspick_clients", JSON.stringify(localList));
            localStorage.setItem("tenspick_clients_initialized", "true");

            state.clients = state.clients.filter(function (item) {
                return String(item.id) !== targetIdStr;
            });

            closeModal("clientProfileModal");

            showMessage("Client deleted successfully.", "success");

            let targetPage = state.page;

            if (
                state.clients.length === 0 &&
                state.page > 1
            ) {

                targetPage =
                    state.page - 1;
            }


            await loadClients(
                targetPage
            );


        } catch (error) {

            errorLog(
                "deleteClient failed:",
                error
            );


            showMessage(
                error.message ||
                "Unable to delete client.",
                "error"
            );
        }
    }


    /* ============================================================
       OPEN PROFILE
       ============================================================ */

    function openClientProfile(
        client
    ) {

        if (!client) {
            return;
        }


        state.currentClient =
            client;


        const avatar =
            el(
                "clientProfileAvatar"
            );


        if (avatar) {

            avatar.textContent =
                initial(
                    client.client_name
                );
        }


        const title =
            el(
                "clientProfileTitle"
            );


        if (title) {

            title.textContent =
                safe(
                    client.client_name,
                    "Client"
                );
        }


        const code =
            el(
                "clientProfileCode"
            );


        if (code) {

            code.textContent =
                safe(
                    client.client_code
                );
        }


        const statusBar =
            el(
                "clientProfileStatusBar"
            );


        if (statusBar) {

            const status =
                String(
                    client.status ||
                    "active"
                )
                    .toLowerCase()
                    .replace(
                        /[^a-z_-]/g,
                        ""
                    );


            statusBar.innerHTML = `
                <span
                    class="
                        clients-status
                        clients-status-${escapeHtml(
                            status
                        )}
                    "
                >
                    ${escapeHtml(
                        capitalize(
                            status
                        )
                    )}
                </span>
            `;
        }


        const body =
            el(
                "clientProfileBody"
            );


        if (body) {

            body.innerHTML =
                buildProfileHtml(
                    client
                );
        }


        openModal(
            "clientProfileModal"
        );
    }


    /* ============================================================
       PROFILE ITEM
       ============================================================ */

    function profileItem(
        label,
        value
    ) {

        return `
            <div
                class="client-profile-item"
            >

                <span>
                    ${escapeHtml(
                        label
                    )}
                </span>

                <strong>
                    ${escapeHtml(
                        safe(value)
                    )}
                </strong>

            </div>
        `;
    }


    /* ============================================================
       PROFILE HTML
       ============================================================ */

    function buildProfileHtml(
        client
    ) {

        return `

            <div
                class="client-profile-grid"
            >

                <div
                    class="client-profile-section"
                >

                    <h4>
                        Basic Information
                    </h4>

                    ${profileItem(
                        "Client Name",
                        client.client_name
                    )}

                    ${profileItem(
                        "Company",
                        client.company_name
                    )}

                    ${profileItem(
                        "Client Code",
                        client.client_code
                    )}

                    ${profileItem(
                        "Mobile",
                        client.mobile
                    )}

                    ${profileItem(
                        "WhatsApp",
                        client.whatsapp
                    )}

                    ${profileItem(
                        "Email",
                        client.email
                    )}

                    ${profileItem(
                        "Alternate Phone",
                        client.alternate_phone
                    )}

                </div>


                <div
                    class="client-profile-section"
                >

                    <h4>
                        Business Information
                    </h4>

                    ${profileItem(
                        "Business Type",
                        client.business_type
                    )}

                    ${profileItem(
                        "Industry",
                        client.industry
                    )}

                    ${profileItem(
                        "Website",
                        client.website
                    )}

                    ${profileItem(
                        "Address",
                        client.address
                    )}

                    ${profileItem(
                        "City",
                        client.city
                    )}

                    ${profileItem(
                        "State",
                        client.state
                    )}

                    ${profileItem(
                        "Pincode",
                        client.pincode
                    )}

                </div>


                <div
                    class="client-profile-section"
                >

                    <h4>
                        Contact Person
                    </h4>

                    ${profileItem(
                        "Name",
                        client.contact_person_name
                    )}

                    ${profileItem(
                        "Designation",
                        client.contact_person_designation
                    )}

                    ${profileItem(
                        "Mobile",
                        client.contact_person_mobile
                    )}

                    ${profileItem(
                        "Email",
                        client.contact_person_email
                    )}

                </div>


                <div
                    class="client-profile-section"
                >

                    <h4>
                        Billing Information
                    </h4>

                    ${profileItem(
                        "Billing Name",
                        client.billing_name
                    )}

                    ${profileItem(
                        "GST Number",
                        client.gst_number
                    )}

                    ${profileItem(
                        "PAN Number",
                        client.pan_number
                    )}

                    ${profileItem(
                        "Billing Address",
                        client.billing_address
                    )}

                </div>


                <div
                    class="client-profile-section"
                >

                    <h4>
                        Client Portal
                    </h4>

                    ${profileItem(
                        "Login Email",
                        client.login_email
                    )}

                </div>


                <div
                    class="
                        client-profile-section
                        client-profile-section-full
                    "
                >

                    <h4>
                        Business Description
                    </h4>

                    <div
                        class="
                            client-profile-description
                        "
                    >
                        ${escapeHtml(
                            safe(
                                client.business_description,
                                "No business description."
                            )
                        )}
                    </div>

                </div>


                <div
                    class="
                        client-profile-section
                        client-profile-section-full
                    "
                >

                    <h4>
                        Internal Notes
                    </h4>

                    <div
                        class="
                            client-profile-description
                        "
                    >
                        ${escapeHtml(
                            safe(
                                client.internal_notes,
                                "No internal notes."
                            )
                        )}
                    </div>

                </div>

            </div>

        `;
    }


    /* ============================================================
       PAGINATION
       ============================================================ */

    function renderPagination() {

        const container =
            el(
                "clientsPagination"
            );


        if (!container) {
            return;
        }


        const totalPages =
            Math.max(
                1,
                state.totalPages
            );


        const current =
            Math.min(
                totalPages,
                Math.max(
                    1,
                    state.page
                )
            );


        if (
            totalPages <= 1
        ) {

            container.innerHTML =
                "";

            return;
        }


        let html = "";


        html += `
            <button
                type="button"
                class="
                    clients-pagination-button
                "
                data-page="${current - 1}"
                ${current <= 1
                    ? "disabled"
                    : ""}
            >
                Previous
            </button>
        `;


        const start =
            Math.max(
                1,
                current - 2
            );


        const end =
            Math.min(
                totalPages,
                current + 2
            );


        for (
            let page = start;
            page <= end;
            page++
        ) {

            html += `
                <button
                    type="button"
                    class="
                        clients-pagination-button
                        ${page === current
                            ? "active"
                            : ""}
                    "
                    data-page="${page}"
                >
                    ${page}
                </button>
            `;
        }


        html += `
            <button
                type="button"
                class="
                    clients-pagination-button
                "
                data-page="${current + 1}"
                ${current >= totalPages
                    ? "disabled"
                    : ""}
            >
                Next
            </button>
        `;


        container.innerHTML =
            html;
    }


    /* ============================================================
       RESULT COUNT
       ============================================================ */

    function updateResultCount() {

        const output =
            el(
                "clientResultCount"
            );


        if (!output) {
            return;
        }


        const industry =
            el(
                "clientIndustryFilter"
            );


        const hasIndustry =
            industry &&
            industry.value;


        if (!hasIndustry) {

            output.textContent =
                state.total +
                (
                    state.total === 1
                        ? " client"
                        : " clients"
                );

            return;
        }


        output.textContent =
            state.filteredClients.length +
            " shown";
    }


    /* ============================================================
       TABLE EVENTS
       ============================================================ */

    function bindEvents() {

        if (!pageExists()) {

            warn(
                "Clients page does not exist."
            );

            return false;
        }


        /*
         * Abort previous listeners.
         */

        if (
            state.eventController
        ) {

            try {

                state.eventController.abort();

            } catch (error) {

                warn(
                    "Unable to abort old events:",
                    error
                );
            }
        }


        state.eventController =
            new AbortController();


        const signal =
            state.eventController.signal;


        /* ========================================================
           ADD BUTTON
           ======================================================== */

        const addButton =
            el(
                "addClientButton"
            );


        if (addButton) {

            addButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    openAddClientModal();
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           CLOSE CLIENT MODAL
           ======================================================== */

        const closeClient =
            el(
                "closeClientModal"
            );


        if (closeClient) {

            closeClient.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeModal(
                        "clientModal"
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           CANCEL CLIENT MODAL
           ======================================================== */

        const cancelClient =
            el(
                "cancelClientModal"
            );


        if (cancelClient) {

            cancelClient.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeModal(
                        "clientModal"
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           CLIENT MODAL OVERLAY
           ======================================================== */

        const clientModal =
            el(
                "clientModal"
            );


        if (clientModal) {

            clientModal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target.closest(
                            "[data-close-client-modal]"
                        )
                    ) {

                        event.preventDefault();

                        closeModal(
                            "clientModal"
                        );
                    }
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           PROFILE CLOSE
           ======================================================== */

        const profileClose =
            el(
                "closeClientProfile"
            );


        if (profileClose) {

            profileClose.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeModal(
                        "clientProfileModal"
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           PROFILE CLOSE BUTTON
           ======================================================== */

        const profileCloseButton =
            el(
                "clientProfileCloseButton"
            );


        if (
            profileCloseButton
        ) {

            profileCloseButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    closeModal(
                        "clientProfileModal"
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           PROFILE MODAL
           ======================================================== */

        const profileModal =
            el(
                "clientProfileModal"
            );


        if (profileModal) {

            profileModal.addEventListener(
                "click",
                function (event) {

                    if (
                        event.target.closest(
                            "[data-close-client-profile]"
                        )
                    ) {

                        event.preventDefault();

                        closeModal(
                            "clientProfileModal"
                        );
                    }
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           PROFILE EDIT
           ======================================================== */

        const profileEdit =
            el(
                "clientProfileEditButton"
            );


        if (profileEdit) {

            profileEdit.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    if (
                        state.currentClient
                    ) {

                        const client =
                            state.currentClient;


                        closeModal(
                            "clientProfileModal"
                        );


                        openEditClientModal(
                            client
                        );
                    }
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           PROFILE DELETE
           ======================================================== */

        const profileDelete =
            el(
                "clientProfileDeleteButton"
            );


        if (profileDelete) {

            profileDelete.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();

                    if (
                        state.currentClient
                    ) {

                        deleteClient(
                            state.currentClient.id
                        );
                    }
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           FORM
           ======================================================== */

        const form =
            el(
                "clientForm"
            );


        if (form) {

            form.addEventListener(
                "submit",
                function (event) {

                    event.preventDefault();

                    event.stopPropagation();

                    saveClient();
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           SEARCH
           ======================================================== */

        const search =
            el(
                "clientSearch"
            );


        if (search) {

            search.addEventListener(
                "input",
                function () {

                    clearTimeout(
                        state.searchTimer
                    );


                    state.searchTimer =
                        setTimeout(
                            function () {

                                loadClients(
                                    1
                                );
                            },
                            350
                        );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           STATUS FILTER
           ======================================================== */

        const status =
            el(
                "clientStatusFilter"
            );


        if (status) {

            status.addEventListener(
                "change",
                function () {

                    loadClients(
                        1
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           INDUSTRY FILTER
           ======================================================== */

        const industry =
            el(
                "clientIndustryFilter"
            );


        if (industry) {

            industry.addEventListener(
                "change",
                function () {

                    applyIndustryFilter();

                    renderClients();

                    updateResultCount();
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           CLEAR FILTERS
           ======================================================== */

        const clear =
            el(
                "clearClientFilters"
            );


        if (clear) {

            clear.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    if (search) {

                        search.value =
                            "";
                    }


                    if (status) {

                        status.value =
                            "";
                    }


                    if (industry) {

                        industry.value =
                            "";
                    }


                    loadClients(
                        1
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           TABLE ACTIONS
           ======================================================== */

        const tableBody =
            el(
                "clientsTableBody"
            );


        if (tableBody) {

            tableBody.addEventListener(
                "click",
                handleTableAction,
                {
                    signal
                }
            );
        }


        /* ========================================================
           ACTION MENU
           ======================================================== */

        document.addEventListener(
            "click",
            handleActionMenuClick,
            {
                signal
            }
        );


        /* ========================================================
           OUTSIDE ACTION MENU
           ======================================================== */

        document.addEventListener(
            "click",
            function (event) {

                if (
                    event.target.closest(
                        "[data-client-action-menu]"
                    )
                ) {
                    return;
                }


                if (
                    event.target.closest(
                        "[data-client-action]"
                    )
                ) {
                    return;
                }


                if (
                    event.target.closest(
                        ".clients-action-dropdown-portal"
                    )
                ) {
                    return;
                }


                closeActionMenu();
            },
            {
                signal
            }
        );


        /* ========================================================
           PAGINATION
           ======================================================== */

        const pagination =
            el(
                "clientsPagination"
            );


        if (pagination) {

            pagination.addEventListener(
                "click",
                function (event) {

                    const button =
                        event.target.closest(
                            "[data-page]"
                        );


                    if (!button) {
                        return;
                    }


                    if (
                        button.disabled
                    ) {
                        return;
                    }


                    event.preventDefault();


                    const page =
                        Number(
                            button.getAttribute(
                                "data-page"
                            )
                        );


                    if (
                        !page ||
                        page < 1
                    ) {
                        return;
                    }


                    loadClients(
                        page
                    );
                },
                {
                    signal
                }
            );
        }


        /* ========================================================
           ESCAPE
           ======================================================== */

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }


                closeActionMenu();


                const clientModal =
                    el(
                        "clientModal"
                    );


                const profileModal =
                    el(
                        "clientProfileModal"
                    );


                if (
                    clientModal &&
                    !clientModal.hidden
                ) {

                    closeModal(
                        "clientModal"
                    );
                }


                if (
                    profileModal &&
                    !profileModal.hidden
                ) {

                    closeModal(
                        "clientProfileModal"
                    );
                }
            },
            {
                signal
            }
        );


        log(
            "All Clients events bound successfully."
        );


        return true;
    }


    /* ============================================================
       INIT
       ============================================================ */

    async function init() {

        log(
            "Clients init() called."
        );


        if (!pageExists()) {

            warn(
                "Clients page is not available."
            );

            return;
        }


        closeActionMenu();


        const bound =
            bindEvents();


        if (!bound) {

            errorLog(
                "Client events could not be bound."
            );

            return;
        }


        state.initialized =
            true;


        log(
            "Clients module initialized."
        );


        await loadClients(
            1
        );
    }


    /* ============================================================
       DESTROY
       ============================================================ */

    function destroy() {

        log(
            "Clients destroy() called."
        );


        closeActionMenu();


        if (
            state.requestController
        ) {

            try {

                state.requestController.abort();

            } catch (error) {

                warn(
                    "Request cleanup failed:",
                    error
                );
            }


            state.requestController =
                null;
        }


        if (
            state.eventController
        ) {

            try {

                state.eventController.abort();

            } catch (error) {

                warn(
                    "Event cleanup failed:",
                    error
                );
            }


            state.eventController =
                null;
        }


        clearTimeout(
            state.searchTimer
        );


        state.searchTimer =
            null;


        state.initialized =
            false;


        state.clients =
            [];


        state.filteredClients =
            [];


        state.currentClient =
            null;


        state.editingId =
            null;


        document.body.classList.remove(
            "clients-modal-open"
        );


        log(
            "Clients module destroyed."
        );
    }


    /* ============================================================
       REFRESH
       ============================================================ */

    function refresh() {

        if (!pageExists()) {

            return Promise.resolve();
        }


        return loadClients(
            state.page || 1
        );
    }


    /* ============================================================
       PUBLIC API
       ============================================================ */

    window.TenspickClients = {

        init:
            init,

        destroy:
            destroy,

        refresh:
            refresh,

        loadClients:
            loadClients,

        openAddClient:
            openAddClientModal,

        openEditClient:
            openEditClientModal,

        openClientProfile:
            openClientProfile,

        closeClientModal:
            function () {
                closeModal(
                    "clientModal"
                );
            },

        closeClientProfile:
            function () {
                closeModal(
                    "clientProfileModal"
                );
            }
    };


    /* ============================================================
       MODULE LOADED
       ============================================================ */

    log(
        "TenspickClients registered."
    );


    log(
        "clients.js loaded successfully."
    );


})(window, document);