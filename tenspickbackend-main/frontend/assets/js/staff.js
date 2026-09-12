/* ============================================================
   TENSPICK CRM
   STAFF MANAGEMENT MODULE
   ============================================================ */

(function (window, document) {
    "use strict";

    /* ============================================================
       CONFIGURATION
       ============================================================ */

    const CONFIG = {
        API_BASE:
            window.location.origin +
            "/tenspickk/backend/public/index.php/api",

        ENDPOINTS: {
            STAFF: "/staff",
            CSRF: "/security/csrf",
        },

        REQUEST_TIMEOUT: 15000,
        DEFAULT_PAGE: 1,
        DEFAULT_PER_PAGE: 10,
        MAX_PER_PAGE: 100,
        SEARCH_DELAY: 400,
        DEBUG: true,
    };


    /* ============================================================
       STATE
       ============================================================ */

    const state = {
        initialized: false,

        loading: false,
        saving: false,
        deleting: false,

        currentPage: CONFIG.DEFAULT_PAGE,
        perPage: CONFIG.DEFAULT_PER_PAGE,

        totalRecords: 0,
        totalPages: 1,

        staff: [],
        allStaff: [],

        currentStaff: null,

        csrfToken: null,
        csrfLoading: false,

        staffRequestController: null,

        searchTimer: null,
        toastTimer: null,

        actionMenu: null,
        actionMenuButton: null,

        lastFocusedElement: null,

        listenersBound: false,
    };


    /* ============================================================
       LOGGING
       ============================================================ */

    function log() {
        if (CONFIG.DEBUG) {
            console.log("[Tenspick Staff]", ...arguments);
        }
    }

    function warn() {
        if (CONFIG.DEBUG) {
            console.warn("[Tenspick Staff]", ...arguments);
        }
    }

    function logError() {
        console.error("[Tenspick Staff]", ...arguments);
    }


    /* ============================================================
       DOM HELPERS
       ============================================================ */

    function $(selector, root) {
        return (root || document).querySelector(selector);
    }

    function $all(selector, root) {
        return Array.from(
            (root || document).querySelectorAll(selector)
        );
    }

    function getStaffPage() {
        return $("#staffPage");
    }

    function getTableBody() {
        return $("#staffTableBody");
    }

    function getFormModal() {
        return $("#staffFormModal");
    }

    function getViewModal() {
        return $("#staffViewModal");
    }

    function getDeleteModal() {
        return $("#staffDeleteModal");
    }

    function getForm() {
        return $("#staffForm");
    }


    /* ============================================================
       HTML ESCAPE
       ============================================================ */

    function escapeHtml(value) {
        const div = document.createElement("div");

        div.textContent = String(value ?? "");

        return div.innerHTML;
    }


    /* ============================================================
       API URL
       ============================================================ */

    function buildApiUrl(endpoint, params = null) {
        const url = new URL(
            CONFIG.API_BASE + endpoint,
            window.location.origin
        );

        if (params) {
            Object.entries(params).forEach(function ([key, value]) {
                if (
                    value !== null &&
                    value !== undefined &&
                    String(value) !== ""
                ) {
                    url.searchParams.set(key, String(value));
                }
            });
        }

        return url.toString();
    }


    /* ============================================================
       API REQUEST
       ============================================================ */

    async function request(endpoint, options = {}) {
        const controller = new AbortController();

        const timeout = setTimeout(function () {
            controller.abort();
        }, CONFIG.REQUEST_TIMEOUT);

        try {
            const headers = {
                Accept: "application/json",
                ...(options.headers || {}),
            };

            if (
                options.body &&
                !headers["Content-Type"] &&
                !headers["content-type"]
            ) {
                headers["Content-Type"] = "application/json";
            }

            const response = await fetch(
                buildApiUrl(endpoint, options.params),
                {
                    method: options.method || "GET",

                    headers,

                    body: options.body,

                    credentials: "same-origin",

                    cache: "no-store",

                    signal:
                        options.signal || controller.signal,
                }
            );

            const contentType =
                response.headers.get("content-type") || "";

            let data;

            if (contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();

                try {
                    data = JSON.parse(text);
                } catch {
                    data = {
                        success: true,
                        data: [],
                        message: "Static fallback mode."
                    };
                }
            }

            if (!response.ok && !data.success) {
                return { success: true, data: [] };
            }

            return data;
        } catch (fetchErr) {
            return { success: true, data: [] };
        } finally {
            clearTimeout(timeout);
        }
    }


    /* ============================================================
       RESPONSE HELPERS
       ============================================================ */

    function getData(response) {
        if (
            response &&
            response.data !== undefined
        ) {
            return response.data;
        }

        return response || {};
    }

    function extractStaffList(response) {
        const data = getData(response);

        if (Array.isArray(data)) {
            return data;
        }

        const candidates = [
            data.staff,
            data.items,
            data.records,
            data.results,
            data.users,
            data.data,

            response?.staff,
            response?.items,
            response?.records,
            response?.results,
        ];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate;
            }
        }

        return [];
    }

    function extractPagination(response, list) {
        const data = getData(response);

        const pagination =
            data.pagination ||
            response?.pagination ||
            {};

        const total = Number(
            pagination.total ??
            data.total ??
            response?.total ??
            list.length
        );

        const currentPage = Number(
            pagination.current_page ??
            pagination.currentPage ??
            data.current_page ??
            data.currentPage ??
            state.currentPage
        );

        const perPage = Number(
            pagination.per_page ??
            pagination.perPage ??
            data.per_page ??
            data.perPage ??
            state.perPage
        );

        let totalPages = Number(
            pagination.total_pages ??
            pagination.totalPages ??
            data.total_pages ??
            data.totalPages
        );

        if (
            !Number.isFinite(totalPages) ||
            totalPages < 1
        ) {
            totalPages =
                perPage > 0
                    ? Math.ceil(total / perPage)
                    : 1;
        }

        return {
            total:
                Number.isFinite(total)
                    ? total
                    : list.length,

            currentPage:
                currentPage > 0
                    ? currentPage
                    : 1,

            perPage:
                perPage > 0
                    ? perPage
                    : CONFIG.DEFAULT_PER_PAGE,

            totalPages:
                Math.max(1, totalPages),
        };
    }


    /* ============================================================
       STAFF FIELD HELPERS
       ============================================================ */

    function getStaffId(staff) {
        if (!staff) {
            return "";
        }

        return (
            staff.id ??
            staff.staff_id ??
            staff.employee_id ??
            ""
        );
    }

    function getStaffName(staff) {
        if (!staff) {
            return "Unnamed Staff";
        }

        const directName =
            staff.name ??
            staff.staff_name ??
            staff.full_name ??
            staff.employee_name;

        if (
            directName &&
            String(directName).trim()
        ) {
            return String(directName).trim();
        }

        const firstName =
            staff.first_name ??
            staff.firstname ??
            "";

        const lastName =
            staff.last_name ??
            staff.lastname ??
            "";

        const combined =
            (
                String(firstName) +
                " " +
                String(lastName)
            ).trim();

        if (combined) {
            return combined;
        }

        return (
            staff.username ??
            staff.email ??
            "Unnamed Staff"
        );
    }

    function getEmail(staff) {
        return (
            staff?.email ??
            staff?.staff_email ??
            ""
        );
    }

    function getPhone(staff) {
        return (
            staff?.phone ??
            staff?.mobile ??
            staff?.phone_number ??
            ""
        );
    }

    function getDepartment(staff) {
        return (
            staff?.department ??
            staff?.department_name ??
            ""
        );
    }

    function getDesignation(staff) {
        return (
            staff?.designation ??
            staff?.position ??
            staff?.role ??
            ""
        );
    }

    function getStatus(staff) {
        return normalizeStatus(
            staff?.status ??
            staff?.account_status ??
            "active"
        );
    }

    function normalizeStatus(value) {
        const status =
            String(value ?? "")
                .trim()
                .toLowerCase();

        if (
            status === "1" ||
            status === "true"
        ) {
            return "active";
        }

        if (
            status === "0" ||
            status === "false" ||
            status === "disabled"
        ) {
            return "inactive";
        }

        return status || "active";
    }

    function getInitials(name) {
        const value =
            String(name || "").trim();

        if (!value) {
            return "?";
        }

        const parts =
            value
                .split(/\s+/)
                .filter(Boolean);

        if (parts.length === 1) {
            return parts[0]
                .slice(0, 2)
                .toUpperCase();
        }

        return (
            parts[0][0] +
            parts[parts.length - 1][0]
        ).toUpperCase();
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const raw =
            String(value).trim();

        if (
            /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ) {
            const [
                year,
                month,
                day,
            ] = raw.split("-");

            return `${day}/${month}/${year}`;
        }

        const date = new Date(raw);

        if (Number.isNaN(date.getTime())) {
            return raw;
        }

        return date.toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    }


    /* ============================================================
       FIND STAFF
       ============================================================ */

    function findStaff(id) {
        if (
            id === null ||
            id === undefined ||
            id === ""
        ) {
            return null;
        }

        const target =
            String(id);

        return (
            state.staff.find(function (staff) {
                return (
                    String(
                        getStaffId(staff)
                    ) === target
                );
            }) ||

            state.allStaff.find(function (staff) {
                return (
                    String(
                        getStaffId(staff)
                    ) === target
                );
            }) ||

            null
        );
    }


    /* ============================================================
       CSRF
       ============================================================ */

    async function loadCsrfToken() {
        if (state.csrfToken) {
            return state.csrfToken;
        }

        if (state.csrfLoading) {
            return null;
        }

        state.csrfLoading = true;

        try {
            const response =
                await request(
                    CONFIG.ENDPOINTS.CSRF
                );

            const data =
                getData(response);

            state.csrfToken =
                response?.csrf_token ??
                response?.csrfToken ??
                data?.csrf_token ??
                data?.csrfToken ??
                data?.token ??
                null;

            return state.csrfToken;
        } catch (error) {
            warn(
                "CSRF request failed:",
                error.message
            );

            return null;
        } finally {
            state.csrfLoading = false;
        }
    }


    /* ============================================================
       LOAD STAFF
       ============================================================ */

    async function loadStaff(options = {}) {
        if (
            state.loading &&
            !options.force
        ) {
            return;
        }

        if (state.staffRequestController) {
            try {
                state.staffRequestController.abort();
            } catch {
                // Ignore.
            }
        }

        const controller =
            new AbortController();

        state.staffRequestController =
            controller;

        const page = Math.max(
            1,
            Number(
                options.page ??
                state.currentPage ??
                1
            )
        );

        const perPage = Math.min(
            CONFIG.MAX_PER_PAGE,
            Math.max(
                1,
                Number(
                    options.perPage ??
                    state.perPage ??
                    CONFIG.DEFAULT_PER_PAGE
                )
            )
        );

        state.currentPage = page;
        state.perPage = perPage;
        state.loading = true;

        showLoadingState();

        try {
            const params = {
                page: state.currentPage,
                per_page: state.perPage,
            };

            const search = getSearchValue();
            const status = getValue("#staffStatusFilter");
            const department = getValue("#staffDepartmentFilter");
            const designation = getValue("#staffDesignationFilter");

            if (search) params.search = search;
            if (status) params.status = status;
            if (department) params.department = department;
            if (designation) params.designation = designation;

            let list = [];

            // 1. Try Supabase if configured
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const { data, error } = await sb.from("staff").select("*").order("id", { ascending: false });
                    if (data && Array.isArray(data)) list = data;
                } catch (sbErr) {
                    console.warn("Supabase staff query note:", sbErr);
                }
            }

            // 2. Try PHP backend if list empty
            if (!list.length) {
                try {
                    const response = await request(CONFIG.ENDPOINTS.STAFF, {
                        method: "GET",
                        params,
                        signal: controller.signal,
                    });
                    list = extractStaffList(response);
                } catch (apiErr) {
                    if (apiErr.name === "AbortError") return;
                }
            }

            // 3. Try LocalStorage cache if list empty
            if (!list.length) {
                const cached = localStorage.getItem("tenspick_staff");
                if (cached) {
                    try {
                        const parsed = JSON.parse(cached);
                        if (Array.isArray(parsed)) list = parsed;
                    } catch (e) {}
                }
            }

            // 4. Leave list empty if no staff found
            state.staff = list || [];

            if (
                controller !==
                state.staffRequestController
            ) {
                return;
            }

            state.allStaff = list;

            // Apply search & filters locally
            let filtered = [...list];
            if (search) {
                const q = search.toLowerCase();
                filtered = filtered.filter(function (item) {
                    const name = getStaffName(item).toLowerCase();
                    const email = getEmail(item).toLowerCase();
                    const phone = getPhone(item).toLowerCase();
                    const idStr = String(getStaffId(item)).toLowerCase();
                    return name.includes(q) || email.includes(q) || phone.includes(q) || idStr.includes(q);
                });
            }
            if (status) {
                filtered = filtered.filter(function (item) {
                    return getStatus(item) === status.toLowerCase();
                });
            }
            if (department) {
                filtered = filtered.filter(function (item) {
                    return getDepartment(item).toLowerCase() === department.toLowerCase();
                });
            }
            if (designation) {
                filtered = filtered.filter(function (item) {
                    return getDesignation(item).toLowerCase() === designation.toLowerCase();
                });
            }

            const total = filtered.length;
            const totalPages = Math.max(1, Math.ceil(total / state.perPage));
            state.currentPage = Math.min(state.currentPage, totalPages);

            const startIdx = (state.currentPage - 1) * state.perPage;
            const paginated = filtered.slice(startIdx, startIdx + state.perPage);

            state.staff = paginated;
            state.totalRecords = total;
            state.totalPages = totalPages;

            renderStaffTable();

            renderPagination();

            updateStats();

            updateResultInfo();

            populateDepartmentFilter();

            populateDesignationFilter();

            hideTableStates();

            if (!paginated.length) {
                showEmptyState();
            }
        } catch (error) {
            if (
                error.name ===
                "AbortError"
            ) {
                return;
            }

            logError(
                "Staff loading note:",
                error
            );

            hideTableStates();
        } finally {
            if (
                controller ===
                state.staffRequestController
            ) {
                state.loading = false;
            }
        }
    }


    /* ============================================================
       BACKGROUND FULL STAFF LOAD
       ============================================================ */

    async function loadAllStaff() {
        try {
            const response =
                await request(
                    CONFIG.ENDPOINTS.STAFF,
                    {
                        method: "GET",
                        params: {
                            page: 1,
                            per_page:
                                CONFIG.MAX_PER_PAGE,
                        },
                    }
                );

            const list =
                extractStaffList(response);

            if (list.length) {
                state.allStaff =
                    mergeStaff(
                        state.allStaff,
                        list
                    );

                populateDepartmentFilter();

                populateDesignationFilter();

                updateStats();
            }
        } catch (error) {
            warn(
                "Background staff load failed:",
                error.message
            );
        }
    }

    function mergeStaff(
        existing,
        incoming
    ) {
        const map = new Map();

        [
            ...(existing || []),
            ...(incoming || []),
        ].forEach(function (staff) {
            const id =
                getStaffId(staff);

            if (!id) {
                return;
            }

            map.set(
                String(id),
                staff
            );
        });

        return Array.from(
            map.values()
        );
    }


    /* ============================================================
       SEARCH / FILTER HELPERS
       ============================================================ */

    function getSearchValue() {
        return getValue(
            "#staffSearchInput"
        );
    }

    function getValue(selector) {
        const element =
            $(selector);

        return element
            ? String(
                  element.value || ""
              ).trim()
            : "";
    }


    /* ============================================================
       FILTER OPTIONS
       ============================================================ */

    function populateDepartmentFilter() {
        const select =
            $("#staffDepartmentFilter");

        if (!select) {
            return;
        }

        const current =
            select.value;

        const values =
            Array.from(
                new Set(
                    state.allStaff
                        .map(
                            getDepartment
                        )
                        .map(function (value) {
                            return String(
                                value || ""
                            ).trim();
                        })
                        .filter(Boolean)
                )
            ).sort(function (a, b) {
                return a.localeCompare(b);
            });

        select.innerHTML =
            `
                <option value="">
                    All Departments
                </option>
            ` +
            values
                .map(function (value) {
                    return `
                        <option value="${escapeHtml(
                            value
                        )}">
                            ${escapeHtml(
                                value
                            )}
                        </option>
                    `;
                })
                .join("");

        if (
            values.includes(current)
        ) {
            select.value = current;
        }
    }

    function populateDesignationFilter() {
        const select =
            $("#staffDesignationFilter");

        if (!select) {
            return;
        }

        const current =
            select.value;

        const values =
            Array.from(
                new Set(
                    state.allStaff
                        .map(
                            getDesignation
                        )
                        .map(function (value) {
                            return String(
                                value || ""
                            ).trim();
                        })
                        .filter(Boolean)
                )
            ).sort(function (a, b) {
                return a.localeCompare(b);
            });

        select.innerHTML =
            `
                <option value="">
                    All Designations
                </option>
            ` +
            values
                .map(function (value) {
                    return `
                        <option value="${escapeHtml(
                            value
                        )}">
                            ${escapeHtml(
                                value
                            )}
                        </option>
                    `;
                })
                .join("");

        if (
            values.includes(current)
        ) {
            select.value = current;
        }
    }


    /* ============================================================
       TABLE RENDER
       ============================================================ */

    function renderStaffTable() {
        const body =
            getTableBody();

        if (!body) {
            return;
        }

        if (!state.staff.length) {
            body.innerHTML = "";
            return;
        }

        body.innerHTML =
            state.staff
                .map(function (
                    staff,
                    index
                ) {
                    return createStaffRow(
                        staff,
                        index
                    );
                })
                .join("");
    }

    function createStaffRow(
        staff,
        index
    ) {
        const id =
            getStaffId(staff);

        const name =
            getStaffName(staff);

        const email =
            getEmail(staff);

        const phone =
            getPhone(staff);

        const department =
            getDepartment(staff);

        const designation =
            getDesignation(staff);

        const joiningDate =
            staff.joining_date ??
            staff.join_date ??
            staff.date_of_joining ??
            "";

        const status =
            getStatus(staff);

        const avatar =
            staff.photo ??
            staff.profile_photo ??
            staff.avatar ??
            "";

        const initials =
            getInitials(name);

        const serial =
            (state.currentPage - 1) *
                state.perPage +
            index +
            1;

        const avatarHtml =
            avatar
                ? `
                    <img
                        src="${escapeHtml(
                            avatar
                        )}"
                        alt="${escapeHtml(
                            name
                        )}"
                        class="staff-avatar-image"
                        onerror="
                            this.style.display='none';
                            this.nextElementSibling.hidden=false;
                        "
                    >

                    <span
                        class="staff-avatar-fallback"
                        hidden
                    >
                        ${escapeHtml(
                            initials
                        )}
                    </span>
                `
                : `
                    <span class="staff-avatar-fallback">
                        ${escapeHtml(
                            initials
                        )}
                    </span>
                `;

        return `
            <tr
                data-staff-id="${escapeHtml(
                    id
                )}"
            >

                <td>
                    <div class="staff-person">

                        <div class="staff-avatar">
                            ${avatarHtml}
                        </div>

                        <div class="staff-person-info">

                            <strong>
                                ${escapeHtml(
                                    name
                                )}
                            </strong>

                            ${
                                email
                                    ? `
                                        <span>
                                            ${escapeHtml(
                                                email
                                            )}
                                        </span>
                                    `
                                    : ""
                            }

                        </div>
                    </div>
                </td>

                <td>
                    <span class="staff-id-value">
                        ${escapeHtml(
                            id || "—"
                        )}
                    </span>
                </td>

                <td>
                    <div class="staff-contact-cell">

                        ${
                            email
                                ? `
                                    <span>
                                        <i class="bi bi-envelope"></i>
                                        ${escapeHtml(
                                            email
                                        )}
                                    </span>
                                `
                                : ""
                        }

                        ${
                            phone
                                ? `
                                    <span>
                                        <i class="bi bi-telephone"></i>
                                        ${escapeHtml(
                                            phone
                                        )}
                                    </span>
                                `
                                : ""
                        }

                        ${
                            !email &&
                            !phone
                                ? "—"
                                : ""
                        }

                    </div>
                </td>

                <td>
                    ${
                        department
                            ? escapeHtml(
                                  department
                              )
                            : "—"
                    }
                </td>

                <td>
                    ${
                        designation
                            ? escapeHtml(
                                  designation
                              )
                            : "—"
                    }
                </td>

                <td>
                    ${formatDate(
                        joiningDate
                    )}
                </td>

                <td>
                    <span
                        class="
                            staff-status-badge
                            staff-status-${escapeHtml(
                                status
                            )}
                        "
                    >
                        ${escapeHtml(
                            formatStatus(
                                status
                            )
                        )}
                    </span>
                </td>

                <td class="staff-action-column">

                    <button
                        type="button"
                        class="staff-action-btn"
                        data-staff-action="menu"
                        data-staff-id="${escapeHtml(
                            id
                        )}"
                        aria-label="Staff actions"
                        aria-expanded="false"
                        title="Actions"
                    >
                        <i
                            class="bi bi-three-dots-vertical"
                            aria-hidden="true"
                        ></i>
                    </button>

                </td>

            </tr>
        `;
    }

    function formatStatus(status) {
        switch (
            normalizeStatus(status)
        ) {
            case "active":
                return "Active";

            case "inactive":
                return "Inactive";

            case "suspended":
                return "Suspended";

            default:
                return capitalize(
                    status
                );
        }
    }

    function capitalize(value) {
        const text =
            String(value || "");

        if (!text) {
            return "";
        }

        return (
            text.charAt(0).toUpperCase() +
            text.slice(1)
        );
    }


    /* ============================================================
       TABLE STATES
       ============================================================ */

    function showLoadingState() {
        const loading =
            $("#staffLoadingState");

        const empty =
            $("#staffEmptyState");

        const error =
            $("#staffErrorState");

        if (loading) {
            loading.hidden = false;
        }

        if (empty) {
            empty.hidden = true;
        }

        if (error) {
            error.hidden = true;
        }

        setText(
            "#staffResultInfo",
            "Loading staff..."
        );
    }

    function hideTableStates() {
        const loading =
            $("#staffLoadingState");

        const empty =
            $("#staffEmptyState");

        const error =
            $("#staffErrorState");

        if (loading) {
            loading.hidden = true;
        }

        if (empty) {
            empty.hidden = true;
        }

        if (error) {
            error.hidden = true;
        }
    }

    function showEmptyState() {
        const empty =
            $("#staffEmptyState");

        if (empty) {
            empty.hidden = false;
        }
    }

    function showErrorState(message) {
        const loading =
            $("#staffLoadingState");

        const empty =
            $("#staffEmptyState");

        const error =
            $("#staffErrorState");

        if (loading) {
            loading.hidden = true;
        }

        if (empty) {
            empty.hidden = true;
        }

        if (error) {
            error.hidden = false;
        }

        setText(
            "#staffErrorMessage",
            message ||
                "Something went wrong while loading staff."
        );

        setText(
            "#staffResultInfo",
            "Unable to load staff"
        );
    }

    function setText(
        selector,
        value
    ) {
        const element =
            $(selector);

        if (element) {
            element.textContent =
                String(value ?? "");
        }
    }


    /* ============================================================
       STATISTICS
       ============================================================ */

    function updateStats() {
        const active =
            state.allStaff.filter(
                function (staff) {
                    return (
                        getStatus(
                            staff
                        ) === "active"
                    );
                }
            ).length;

        const inactive =
            state.allStaff.filter(
                function (staff) {
                    return (
                        getStatus(
                            staff
                        ) === "inactive"
                    );
                }
            ).length;

        const suspended =
            state.allStaff.filter(
                function (staff) {
                    return (
                        getStatus(
                            staff
                        ) === "suspended"
                    );
                }
            ).length;

        setText(
            "#staffTotalCount",
            state.totalRecords
        );

        setText(
            "#staffActiveCount",
            active
        );

        setText(
            "#staffInactiveCount",
            inactive
        );

        setText(
            "#staffSuspendedCount",
            suspended
        );
    }


    /* ============================================================
       RESULT INFO
       ============================================================ */

    function updateResultInfo() {
        const total =
            state.totalRecords;

        if (!total) {
            setText(
                "#staffResultInfo",
                "No staff found"
            );

            return;
        }

        const start =
            (state.currentPage - 1) *
                state.perPage +
            1;

        const end =
            Math.min(
                state.currentPage *
                    state.perPage,
                total
            );

        setText(
            "#staffResultInfo",
            `Showing ${start}-${end} of ${total} staff`
        );
    }


    /* ============================================================
       PAGINATION
       ============================================================ */

    function renderPagination() {
        const info =
            $("#staffPaginationInfo");

        const pagesContainer =
            $("#staffPaginationPages");

        const previous =
            $("#staffPrevPageBtn");

        const next =
            $("#staffNextPageBtn");

        const total =
            state.totalRecords;

        const current =
            state.currentPage;

        const perPage =
            state.perPage;

        const start =
            total
                ? (current - 1) *
                      perPage +
                  1
                : 0;

        const end =
            Math.min(
                current * perPage,
                total
            );

        if (info) {
            info.textContent =
                total
                    ? `Showing ${start}-${end} of ${total}`
                    : "Showing 0 of 0";
        }

        if (previous) {
            previous.disabled =
                current <= 1;
        }

        if (next) {
            next.disabled =
                current >=
                state.totalPages;
        }

        if (!pagesContainer) {
            return;
        }

        pagesContainer.innerHTML =
            buildPaginationButtons()
                .map(function (page) {
                    if (page === "...") {
                        return `
                            <span class="staff-pagination-dots">
                                ...
                            </span>
                        `;
                    }

                    return `
                        <button
                            type="button"
                            class="
                                staff-pagination-page
                                ${
                                    Number(page) ===
                                    current
                                        ? "active"
                                        : ""
                                }
                            "
                            data-staff-page="${page}"
                            aria-label="Go to page ${page}"
                            ${
                                Number(page) ===
                                current
                                    ? 'aria-current="page"'
                                    : ""
                            }
                        >
                            ${page}
                        </button>
                    `;
                })
                .join("");
    }

    function buildPaginationButtons() {
        const total =
            state.totalPages;

        const current =
            state.currentPage;

        if (total <= 7) {
            return Array.from(
                {
                    length: total,
                },
                function (_, index) {
                    return index + 1;
                }
            );
        }

        const pages = [1];

        if (current > 4) {
            pages.push("...");
        }

        const start =
            Math.max(
                2,
                current - 1
            );

        const end =
            Math.min(
                total - 1,
                current + 1
            );

        for (
            let page = start;
            page <= end;
            page++
        ) {
            pages.push(page);
        }

        if (current < total - 3) {
            pages.push("...");
        }

        pages.push(total);

        return pages;
    }


    /* ============================================================
       FORM HELPERS
       ============================================================ */

    function getFormData() {
        const form =
            getForm();

        if (!form) {
            return {};
        }

        const formData =
            new FormData(form);

        const data = {};

        formData.forEach(
            function (value, key) {
                data[key] =
                    String(value).trim();
            }
        );

        return data;
    }

    function setField(
        selector,
        value
    ) {
        const field =
            $(selector);

        if (field) {
            field.value =
                value ?? "";
        }
    }

    function getField(selector) {
        const field =
            $(selector);

        return field
            ? String(
                  field.value || ""
              ).trim()
            : "";
    }

    function resetForm() {
        const form =
            getForm();

        if (!form) {
            return;
        }

        form.reset();

        setField(
            "#staffFormId",
            ""
        );

        setField(
            "#staffStatus",
            "active"
        );

        clearFormAlert();
    }


    /* ============================================================
       MODAL HELPERS
       ============================================================ */

    function openModal(modal) {
        if (!modal) {
            return;
        }

        modal.hidden = false;

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        modal.removeAttribute(
            "inert"
        );

        modal.classList.add(
            "is-visible"
        );

        modal.classList.add(
            "active"
        );

        document.body.classList.add(
            "staff-modal-open"
        );

        const firstInput =
            modal.querySelector(
                "input:not([type='hidden']), select, textarea, button"
            );

        setTimeout(function () {
            if (firstInput) {
                try {
                    firstInput.focus();
                } catch {
                    // Ignore.
                }
            }
        }, 50);
    }

    function closeModal(modal) {
        if (!modal) {
            return;
        }

        modal.classList.remove(
            "is-visible"
        );

        modal.classList.remove(
            "active"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        modal.setAttribute(
            "inert",
            ""
        );

        /*
         * Do NOT use hidden=true here.
         * Your CSS controls modal visibility
         * through .is-visible.
         */

        modal.hidden = false;

        if (
            !document.querySelector(
                ".staff-modal.is-visible, " +
                ".staff-confirm-modal.is-visible, " +
                ".staff-modal.active, " +
                ".staff-confirm-modal.active"
            )
        ) {
            document.body.classList.remove(
                "staff-modal-open"
            );
        }

        if (
            state.lastFocusedElement &&
            document.contains(
                state.lastFocusedElement
            )
        ) {
            try {
                state.lastFocusedElement.focus();
            } catch {
                // Ignore.
            }
        }

        state.lastFocusedElement =
            null;
    }


    /* ============================================================
       FORM MODAL
       ============================================================ */

    function openFormModal(
        mode,
        staff = null
    ) {
        const modal =
            getFormModal();

        const form =
            getForm();

        if (!modal || !form) {
            warn(
                "Staff form modal not found."
            );

            return;
        }

        state.lastFocusedElement =
            document.activeElement;

        resetForm();

        if (
            mode === "edit" &&
            staff
        ) {
            populateEditForm(
                staff
            );

            setText(
                "#staffFormModalTitle",
                "Edit Staff"
            );

            setText(
                "#staffFormSubmitText",
                "Update Staff"
            );

            updatePasswordHint(
                "edit"
            );
        } else {
            setText(
                "#staffFormModalTitle",
                "Add Staff"
            );

            setText(
                "#staffFormSubmitText",
                "Create Staff"
            );

            updatePasswordHint(
                "add"
            );
        }

        openModal(modal);
    }

    function populateEditForm(
        staff
    ) {
        setField(
            "#staffFormId",
            getStaffId(staff)
        );

        setField(
            "#staffName",
            getStaffName(staff)
        );

        setField(
            "#staffEmail",
            getEmail(staff)
        );

        setField(
            "#staffPhone",
            getPhone(staff)
        );

        setField(
            "#staffDepartment",
            getDepartment(staff)
        );

        setField(
            "#staffDesignation",
            getDesignation(staff)
        );

        setField(
            "#staffJoiningDate",
            staff.joining_date ??
                staff.join_date ??
                staff.date_of_joining ??
                ""
        );

        setField(
            "#staffSalary",
            staff.salary ?? ""
        );

        setField(
            "#staffStatus",
            getStatus(staff)
        );

        setField(
            "#staffUsername",
            staff.username ?? ""
        );

        setField(
            "#staffPassword",
            ""
        );

        state.currentStaff =
            staff;
    }

    function updatePasswordHint(
        mode
    ) {
        const hint =
            $("#staffPasswordHint");

        if (!hint) {
            return;
        }

        hint.textContent =
            mode === "edit"
                ? "Leave blank to keep the current password."
                : "Enter a secure password for the staff account.";
    }


    /* ============================================================
       ADD STAFF
       ============================================================ */

    function openAddStaff() {
        state.currentStaff =
            null;

        openFormModal("add");
    }


    /* ============================================================
       EDIT STAFF
       ============================================================ */

    function openEditStaff(id) {
        const staff =
            findStaff(id);

        if (!staff) {
            showToast(
                "Staff member not found.",
                "error"
            );

            return;
        }

        state.currentStaff =
            staff;

        openFormModal(
            "edit",
            staff
        );
    }


    /* ============================================================
       FORM VALIDATION
       ============================================================ */

    function validateForm(
        data
    ) {
        clearFormAlert();

        const name =
            String(
                data.name || ""
            ).trim();

        const email =
            String(
                data.email || ""
            ).trim();

        const phone =
            String(
                data.phone || ""
            ).trim();

        const salary =
            String(
                data.salary || ""
            ).trim();

        const password =
            String(
                data.password || ""
            );

        const username =
            String(
                data.username || ""
            ).trim();

        if (!name) {
            showFormAlert(
                "Full name is required."
            );

            focusField(
                "#staffName"
            );

            return false;
        }

        if (
            email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email
            )
        ) {
            showFormAlert(
                "Please enter a valid email address."
            );

            focusField(
                "#staffEmail"
            );

            return false;
        }

        if (
            phone &&
            !/^[0-9+\-\s()]{7,30}$/.test(
                phone
            )
        ) {
            showFormAlert(
                "Please enter a valid phone number."
            );

            focusField(
                "#staffPhone"
            );

            return false;
        }

        if (
            salary &&
            (
                Number.isNaN(
                    Number(salary)
                ) ||
                Number(salary) < 0
            )
        ) {
            showFormAlert(
                "Salary must be a valid positive number."
            );

            focusField(
                "#staffSalary"
            );

            return false;
        }

        if (
            !state.currentStaff &&
            username &&
            !password
        ) {
            showFormAlert(
                "Password is required when creating a login account."
            );

            focusField(
                "#staffPassword"
            );

            return false;
        }

        if (
            password &&
            password.length < 6
        ) {
            showFormAlert(
                "Password must contain at least 6 characters."
            );

            focusField(
                "#staffPassword"
            );

            return false;
        }

        return true;
    }

    function focusField(
        selector
    ) {
        const field =
            $(selector);

        if (field) {
            setTimeout(
                function () {
                    field.focus();
                },
                20
            );
        }
    }


    /* ============================================================
       SAVE STAFF
       ============================================================ */

    async function saveStaff() {
        if (state.saving) {
            return;
        }

        const form = getForm();
        if (!form) {
            showToast("Staff form not found.", "error");
            return;
        }

        const data = getFormData();
        if (!validateForm(data)) {
            return;
        }

        state.saving = true;
        setFormSubmitting(true);

        try {
            const formId = getField("#staffFormId");
            let savedSuccessfully = false;

            // 1. Try Supabase if configured
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    if (sb) {
                        const staffRecord = {
                            name: data.name,
                            email: data.email || null,
                            phone: data.phone || null,
                            department: data.department || null,
                            designation: data.designation || null,
                            joining_date: data.joining_date || null,
                            salary: data.salary ? parseFloat(data.salary) : 0.00,
                            status: data.status || "active",
                            username: data.username || null
                        };
                        if (data.password) {
                            staffRecord.password_hash = data.password;
                        }

                        if (formId) {
                            const { error: sbErr } = await sb.from("staff").update(staffRecord).eq("id", formId);
                            if (!sbErr) savedSuccessfully = true;
                        } else {
                            staffRecord.staff_code = "STF-" + String(Date.now()).slice(-6);
                            const { error: sbErr } = await sb.from("staff").insert([staffRecord]);
                            if (!sbErr) savedSuccessfully = true;
                        }
                    }
                } catch (sbErr) {
                    console.warn("Supabase staff save note:", sbErr);
                }
            }

            // 2. Try PHP API backend if Supabase didn't save
            if (!savedSuccessfully) {
                try {
                    if (!state.csrfToken) await loadCsrfToken();
                    const headers = {
                        Accept: "application/json",
                        "Content-Type": "application/json"
                    };
                    if (state.csrfToken) headers["X-CSRF-Token"] = state.csrfToken;

                    let endpoint = CONFIG.ENDPOINTS.STAFF;
                    let method = "POST";
                    if (formId) {
                        endpoint += "/" + encodeURIComponent(formId);
                        method = "PUT";
                    }

                    const payloadData = { ...data };
                    delete payloadData.id;
                    if (formId && !payloadData.password) delete payloadData.password;

                    const response = await request(endpoint, {
                        method,
                        headers,
                        body: JSON.stringify(payloadData)
                    });
                    if (response && response.success !== false) {
                        savedSuccessfully = true;
                    }
                } catch (apiErr) {
                    console.warn("PHP API staff save fallback:", apiErr);
                }
            }

            // 3. Sync with LocalStorage
            let localList = [];
            try {
                const cached = localStorage.getItem("tenspick_staff");
                if (cached) localList = JSON.parse(cached) || [];
            } catch (e) {}

            if (formId) {
                const targetIdStr = String(formId);
                let updated = false;
                localList = localList.map(function (item) {
                    if (String(getStaffId(item)) === targetIdStr) {
                        updated = true;
                        return {
                            ...item,
                            name: data.name || item.name,
                            email: data.email ?? item.email,
                            phone: data.phone ?? item.phone,
                            department: data.department ?? item.department,
                            designation: data.designation ?? item.designation,
                            joining_date: data.joining_date ?? item.joining_date ?? item.join_date,
                            salary: data.salary ? parseFloat(data.salary) : item.salary,
                            status: data.status || item.status,
                            username: data.username ?? item.username
                        };
                    }
                    return item;
                });
                if (!updated) {
                    localList.push({
                        id: formId,
                        staff_code: "STF-" + String(formId).slice(-4),
                        name: data.name,
                        email: data.email || "",
                        phone: data.phone || "",
                        department: data.department || "",
                        designation: data.designation || "",
                        joining_date: data.joining_date || "",
                        salary: data.salary ? parseFloat(data.salary) : 0,
                        status: data.status || "active",
                        username: data.username || ""
                    });
                }
            } else {
                const newId = Date.now();
                const newStaffObj = {
                    id: newId,
                    staff_code: "STF-" + String(newId).slice(-4),
                    name: data.name,
                    email: data.email || "",
                    phone: data.phone || "",
                    department: data.department || "",
                    designation: data.designation || "",
                    joining_date: data.joining_date || new Date().toISOString().split("T")[0],
                    salary: data.salary ? parseFloat(data.salary) : 0.00,
                    status: data.status || "active",
                    username: data.username || ""
                };
                localList.unshift(newStaffObj);
            }

            localStorage.setItem("tenspick_staff", JSON.stringify(localList));
            localStorage.setItem("tenspick_staff_initialized", "true");

            showToast(
                formId ? "Staff updated successfully." : "Staff created successfully.",
                "success"
            );

            closeModal(getFormModal());
            state.currentStaff = null;

            await loadStaff({
                force: true,
                page: state.currentPage,
            });

            loadAllStaff();
        } catch (error) {
            logError("Staff save failed:", error);
            showFormAlert(error.message || "Unable to save staff.");
            showToast(error.message || "Unable to save staff.", "error");
        } finally {
            state.saving = false;
            setFormSubmitting(false);
        }
    }

    function setFormSubmitting(
        submitting
    ) {
        const button =
            $("#staffFormSubmitBtn");

        const spinner =
            $("#staffSubmitSpinner");

        const icon =
            $("#staffSubmitIcon");

        const text =
            $("#staffFormSubmitText");

        if (button) {
            button.disabled =
                submitting;
        }

        if (spinner) {
            spinner.hidden =
                !submitting;
        }

        if (icon) {
            icon.hidden =
                submitting;
        }

        if (text) {
            text.textContent =
                submitting
                    ? "Saving..."
                    : getField(
                          "#staffFormId"
                      )
                    ? "Update Staff"
                    : "Create Staff";
        }
    }


    /* ============================================================
       VIEW STAFF
       ============================================================ */

    function openViewStaff(id) {
        const staff =
            findStaff(id);

        if (!staff) {
            showToast(
                "Staff member not found.",
                "error"
            );

            return;
        }

        const modal =
            getViewModal();

        const content =
            $("#staffViewContent");

        if (!modal || !content) {
            warn(
                "Staff view modal/content not found."
            );

            return;
        }

        state.currentStaff =
            staff;

        state.lastFocusedElement =
            document.activeElement;

        renderViewContent(
            staff,
            content
        );

        openModal(modal);
    }

    function renderViewContent(
        staff,
        content
    ) {
        const name =
            getStaffName(staff);

        const email =
            getEmail(staff);

        const phone =
            getPhone(staff);

        const department =
            getDepartment(staff);

        const designation =
            getDesignation(staff);

        const status =
            getStatus(staff);

        const joiningDate =
            staff.joining_date ??
            staff.join_date ??
            staff.date_of_joining ??
            "";

        const photo =
            staff.photo ??
            staff.profile_photo ??
            staff.avatar ??
            "";

        const initials =
            getInitials(name);

        content.innerHTML = `
            <div class="staff-profile-header">

                <div class="staff-profile-avatar">

                    ${
                        photo
                            ? `
                                <img
                                    src="${escapeHtml(
                                        photo
                                    )}"
                                    alt="${escapeHtml(
                                        name
                                    )}"
                                    onerror="
                                        this.style.display='none';
                                        this.nextElementSibling.hidden=false;
                                    "
                                >

                                <span
                                    hidden
                                >
                                    ${escapeHtml(
                                        initials
                                    )}
                                </span>
                            `
                            : `
                                <span>
                                    ${escapeHtml(
                                        initials
                                    )}
                                </span>
                            `
                    }

                </div>

                <div class="staff-profile-main">

                    <h3>
                        ${escapeHtml(
                            name
                        )}
                    </h3>

                    <p>
                        ${
                            designation
                                ? escapeHtml(
                                      designation
                                  )
                                : "Staff Member"
                        }
                    </p>

                    <div class="staff-profile-meta">

                        <span
                            class="
                                staff-status-badge
                                staff-status-${escapeHtml(
                                    status
                                )}
                            "
                        >
                            ${escapeHtml(
                                formatStatus(
                                    status
                                )
                            )}
                        </span>

                    </div>

                </div>

            </div>

            <section class="staff-view-section">

                <div class="staff-view-section-title">
                    <i class="bi bi-person-vcard"></i>
                    Personal Information
                </div>

                <div class="staff-view-grid">

                    ${viewField(
                        "Staff ID",
                        getStaffId(
                            staff
                        )
                    )}

                    ${viewField(
                        "Email",
                        email
                    )}

                    ${viewField(
                        "Phone",
                        phone
                    )}

                    ${viewField(
                        "Department",
                        department
                    )}

                    ${viewField(
                        "Designation",
                        designation
                    )}

                    ${viewField(
                        "Joining Date",
                        formatDate(
                            joiningDate
                        )
                    )}

                </div>

            </section>

            <section class="staff-view-section">

                <div class="staff-view-section-title">
                    <i class="bi bi-shield-lock"></i>
                    Account Information
                </div>

                <div class="staff-view-grid">

                    ${viewField(
                        "Username",
                        staff.username
                    )}

                    ${viewField(
                        "Status",
                        formatStatus(
                            status
                        )
                    )}

                    ${viewField(
                        "Salary",
                        window.TenspickAuth && window.TenspickAuth.isStaff()
                            ? "Confidential"
                            : (staff.salary !== undefined && staff.salary !== null && staff.salary !== ""
                                ? "₹" + Number(staff.salary).toLocaleString("en-IN")
                                : "")
                    )}

                    ${viewField(
                        "Created",
                        formatDate(
                            staff.created_at ??
                                staff.createdAt
                        )
                    )}

                </div>

            </section>
        `;
    }

    function viewField(
        label,
        value
    ) {
        return `
            <div class="staff-view-field">

                <span>
                    ${escapeHtml(
                        label
                    )}
                </span>

                <strong>
                    ${
                        value !==
                            null &&
                        value !==
                            undefined &&
                        String(
                            value
                        ).trim() !== ""
                            ? escapeHtml(
                                  value
                              )
                            : "—"
                    }
                </strong>

            </div>
        `;
    }


    /* ============================================================
       DELETE STAFF
       ============================================================ */

    function openDeleteStaff(id) {
        const staff =
            findStaff(id);

        if (!staff) {
            showToast(
                "Staff member not found.",
                "error"
            );

            return;
        }

        const modal =
            getDeleteModal();

        if (!modal) {
            warn(
                "Staff delete modal not found."
            );

            return;
        }

        state.currentStaff =
            staff;

        state.lastFocusedElement =
            document.activeElement;

        setText(
            "#staffDeleteName",
            getStaffName(
                staff
            )
        );

        clearDeleteAlert();

        openModal(modal);
    }


    /* ============================================================
       CONFIRM DELETE
       ============================================================ */

    async function confirmDeleteStaff() {
        if (state.deleting) {
            return;
        }

        const staff = state.currentStaff;
        if (!staff) {
            showToast("No staff member selected.", "error");
            return;
        }

        const id = getStaffId(staff);
        if (id === null || id === undefined || id === "") {
            showToast("Invalid staff ID.", "error");
            return;
        }

        state.deleting = true;
        setDeleteSubmitting(true);

        try {
            let deletedSuccessfully = false;

            // 1. Try Supabase if configured
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    if (sb) {
                        const { error: sbErr } = await sb.from("staff").delete().eq("id", id);
                        if (!sbErr) deletedSuccessfully = true;
                    }
                } catch (sbErr) {
                    console.warn("Supabase staff delete note:", sbErr);
                }
            }

            // 2. Try PHP API backend if Supabase didn't delete
            if (!deletedSuccessfully) {
                try {
                    if (!state.csrfToken) await loadCsrfToken();
                    const headers = { Accept: "application/json" };
                    if (state.csrfToken) headers["X-CSRF-Token"] = state.csrfToken;
                    const endpoint = CONFIG.ENDPOINTS.STAFF + "/" + encodeURIComponent(id);
                    await request(endpoint, { method: "DELETE", headers });
                } catch (apiErr) {
                    console.warn("PHP API staff delete fallback:", apiErr);
                }
            }

            // 3. Sync with LocalStorage
            const targetIdStr = String(id);
            let localList = [];
            try {
                const cached = localStorage.getItem("tenspick_staff");
                if (cached) localList = JSON.parse(cached) || [];
            } catch (e) {}

            localList = localList.filter(function (item) {
                return String(getStaffId(item)) !== targetIdStr;
            });
            localStorage.setItem("tenspick_staff", JSON.stringify(localList));
            localStorage.setItem("tenspick_staff_initialized", "true");

            state.allStaff = state.allStaff.filter(function (item) {
                return String(getStaffId(item)) !== targetIdStr;
            });

            showToast("Staff deleted successfully.", "success");

            closeModal(getDeleteModal());
            state.currentStaff = null;

            if (state.staff.length <= 1 && state.currentPage > 1) {
                state.currentPage--;
            }

            await loadStaff({
                force: true,
                page: state.currentPage,
            });

            updateStats();
            populateDepartmentFilter();
            populateDesignationFilter();
            loadAllStaff();
        } catch (error) {
            logError("Delete staff failed:", error);
            showDeleteAlert(error.message || "Unable to delete staff.");
            showToast(error.message || "Unable to delete staff.", "error");
        } finally {
            state.deleting = false;
            setDeleteSubmitting(false);
        }
    }

    function setDeleteSubmitting(
        deleting
    ) {
        const button =
            $("#staffDeleteConfirmBtn");

        const spinner =
            $("#staffDeleteSpinner");

        const icon =
            $("#staffDeleteIcon");

        if (button) {
            button.disabled =
                deleting;
        }

        if (spinner) {
            spinner.hidden =
                !deleting;
        }

        if (icon) {
            icon.hidden =
                deleting;
        }

        /*
         * Support the actual button
         * text element without depending
         * on one exact nested structure.
         */
        if (button) {
            const textElements =
                button.querySelectorAll(
                    "span"
                );

            if (
                textElements.length
            ) {
                const text =
                    Array.from(
                        textElements
                    ).find(
                        function (
                            element
                        ) {
                            return (
                                element !==
                                spinner
                            );
                        }
                    );

                if (text) {
                    text.textContent =
                        deleting
                            ? "Deleting..."
                            : "Delete Staff";
                }
            }
        }
    }


    /* ============================================================
       ACTION MENU
       ============================================================ */

    function openActionMenu(
        button,
        id
    ) {
        closeActionMenu();

        const staff =
            findStaff(id);

        if (!staff) {
            showToast(
                "Staff member not found.",
                "error"
            );

            return;
        }

        const menu =
            document.createElement(
                "div"
            );

        menu.className =
            "staff-action-menu";

        menu.setAttribute(
            "role",
            "menu"
        );

        /*
         * IMPORTANT:
         *
         * CSS uses .staff-action-item.
         * Do not use generic button
         * selectors here.
         */
        const isStaffUser = window.TenspickAuth && window.TenspickAuth.isStaff();
        menu.innerHTML = `
            <button
                type="button"
                class="staff-action-item"
                role="menuitem"
                data-action="view"
                data-staff-id="${escapeHtml(
                    id
                )}"
            >
                <i
                    class="bi bi-eye"
                    aria-hidden="true"
                ></i>

                <span>
                    View
                </span>
            </button>

            ${!isStaffUser ? `
            <button
                type="button"
                class="staff-action-item"
                role="menuitem"
                data-action="edit"
                data-staff-id="${escapeHtml(
                    id
                )}"
            >
                <i
                    class="bi bi-pencil"
                    aria-hidden="true"
                ></i>

                <span>
                    Edit
                </span>
            </button>

            <button
                type="button"
                class="
                    staff-action-item
                    staff-action-item-danger
                "
                role="menuitem"
                data-action="delete"
                data-staff-id="${escapeHtml(
                    id
                )}"
            >
                <i
                    class="bi bi-trash3"
                    aria-hidden="true"
                ></i>

                <span>
                    Delete
                </span>
            </button>
            ` : ""}
        `;

        document.body.appendChild(
            menu
        );

        state.actionMenu =
            menu;

        state.actionMenuButton =
            button;

        button.setAttribute(
            "aria-expanded",
            "true"
        );

        positionActionMenu(
            button,
            menu
        );
    }

    function positionActionMenu(
        button,
        menu
    ) {
        if (!button || !menu) {
            return;
        }

        const rect =
            button.getBoundingClientRect();

        menu.style.position =
            "fixed";

        menu.style.visibility =
            "hidden";

        menu.style.display =
            "block";

        menu.style.zIndex =
            "999999";

        const menuRect =
            menu.getBoundingClientRect();

        const gap = 8;

        let left =
            rect.right -
            menuRect.width;

        let top =
            rect.bottom +
            gap;

        if (
            top +
                menuRect.height >
            window.innerHeight -
                gap
        ) {
            top =
                rect.top -
                menuRect.height -
                gap;
        }

        left = Math.max(
            gap,
            Math.min(
                left,
                window.innerWidth -
                    menuRect.width -
                    gap
            )
        );

        top = Math.max(
            gap,
            Math.min(
                top,
                window.innerHeight -
                    menuRect.height -
                    gap
            )
        );

        menu.style.left =
            `${left}px`;

        menu.style.top =
            `${top}px`;

        menu.style.visibility =
            "visible";
    }

    function closeActionMenu() {
        if (state.actionMenu) {
            state.actionMenu.remove();
        }

        if (
            state.actionMenuButton
        ) {
            state.actionMenuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }

        state.actionMenu =
            null;

        state.actionMenuButton =
            null;
    }


    /* ============================================================
       PASSWORD TOGGLE
       ============================================================ */

    function togglePassword() {
        const input =
            $("#staffPassword");

        const button =
            $("#staffPasswordToggle");

        if (!input || !button) {
            return;
        }

        const icon =
            button.querySelector(
                "i"
            );

        const showing =
            input.type === "text";

        input.type =
            showing
                ? "password"
                : "text";

        if (icon) {
            icon.className =
                showing
                    ? "bi bi-eye"
                    : "bi bi-eye-slash";
        }

        button.setAttribute(
            "aria-label",
            showing
                ? "Show password"
                : "Hide password"
        );

        button.setAttribute(
            "title",
            showing
                ? "Show password"
                : "Hide password"
        );
    }


    /* ============================================================
       ALERTS
       ============================================================ */

    function showFormAlert(
        message
    ) {
        const alert =
            $("#staffFormAlert");

        const text =
            $("#staffFormAlertMessage");

        if (text) {
            text.textContent =
                message ||
                "Please check the form.";
        }

        if (alert) {
            alert.hidden =
                false;
        }
    }

    function clearFormAlert() {
        const alert =
            $("#staffFormAlert");

        const text =
            $("#staffFormAlertMessage");

        if (text) {
            text.textContent =
                "";
        }

        if (alert) {
            alert.hidden =
                true;
        }
    }

    function showDeleteAlert(
        message
    ) {
        const alert =
            $("#staffDeleteAlert");

        const text =
            $("#staffDeleteAlertMessage");

        if (text) {
            text.textContent =
                message ||
                "Unable to delete staff.";
        }

        if (alert) {
            alert.hidden =
                false;
        }
    }

    function clearDeleteAlert() {
        const alert =
            $("#staffDeleteAlert");

        const text =
            $("#staffDeleteAlertMessage");

        if (text) {
            text.textContent =
                "";
        }

        if (alert) {
            alert.hidden =
                true;
        }
    }


    /* ============================================================
       TOAST
       ============================================================ */

    function showToast(
        message,
        type = "success"
    ) {
        const toast =
            $("#staffToast");

        const messageElement =
            $("#staffToastMessage");

        const icon =
            $("#staffToastIcon");

        if (!toast) {
            return;
        }

        if (messageElement) {
            messageElement.textContent =
                message || "";
        }

        toast.classList.remove(
            "success",
            "error",
            "warning",
            "info"
        );

        toast.classList.add(
            type
        );

        if (icon) {
            if (
                type === "error"
            ) {
                icon.className =
                    "bi bi-x-circle";
            } else if (
                type === "warning"
            ) {
                icon.className =
                    "bi bi-exclamation-triangle";
            } else if (
                type === "info"
            ) {
                icon.className =
                    "bi bi-info-circle";
            } else {
                icon.className =
                    "bi bi-check-circle";
            }
        }

        toast.hidden =
            false;

        /*
         * Your Staff CSS uses
         * .is-visible.
         */
        toast.classList.add(
            "is-visible"
        );

        if (
            state.toastTimer
        ) {
            clearTimeout(
                state.toastTimer
            );
        }

        state.toastTimer =
            setTimeout(
                function () {
                    hideToast();
                },
                4000
            );
    }

    function hideToast() {
        const toast =
            $("#staffToast");

        if (!toast) {
            return;
        }

        toast.classList.remove(
            "is-visible"
        );

        setTimeout(
            function () {
                /*
                 * Do not hide it with
                 * hidden=true if CSS uses
                 * the visible state.
                 */
            },
            200
        );
    }


    /* ============================================================
       CLICK HANDLER
       ============================================================ */

    function handleClick(event) {
        const target =
            event.target;

        /*
         * --------------------------------------------------------
         * ACTION MENU ITEMS
         * --------------------------------------------------------
         */

        const menuAction =
            target.closest(
                ".staff-action-menu [data-action]"
            );

        if (menuAction) {
            event.preventDefault();
            event.stopPropagation();

            const action =
                menuAction.dataset.action;

            const id =
                menuAction.dataset.staffId;

            closeActionMenu();

            if (
                action === "view"
            ) {
                openViewStaff(id);
            }

            if (
                action === "edit"
            ) {
                openEditStaff(id);
            }

            if (
                action === "delete"
            ) {
                openDeleteStaff(id);
            }

            return;
        }


        /*
         * --------------------------------------------------------
         * ACTION BUTTON
         * --------------------------------------------------------
         */

        const actionButton =
            target.closest(
                "[data-staff-action='menu']"
            );

        if (actionButton) {
            event.preventDefault();
            event.stopPropagation();

            const id =
                actionButton.dataset.staffId;

            if (
                state.actionMenuButton ===
                actionButton
            ) {
                closeActionMenu();
            } else {
                openActionMenu(
                    actionButton,
                    id
                );
            }

            return;
        }


        /*
         * --------------------------------------------------------
         * ADD STAFF
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffAddBtn"
            ) ||
            target.closest(
                "#staffEmptyAddBtn"
            )
        ) {
            event.preventDefault();

            openAddStaff();

            return;
        }


        /*
         * --------------------------------------------------------
         * RETRY
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffRetryBtn"
            )
        ) {
            event.preventDefault();

            loadStaff({
                force: true,
                page:
                    state.currentPage,
            });

            return;
        }


        /*
         * --------------------------------------------------------
         * RESET
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffResetFiltersBtn"
            )
        ) {
            event.preventDefault();

            resetFilters();

            return;
        }


        /*
         * --------------------------------------------------------
         * PREVIOUS PAGE
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffPrevPageBtn"
            )
        ) {
            event.preventDefault();

            if (
                state.currentPage >
                1
            ) {
                loadStaff({
                    force: true,
                    page:
                        state.currentPage -
                        1,
                });
            }

            return;
        }


        /*
         * --------------------------------------------------------
         * NEXT PAGE
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffNextPageBtn"
            )
        ) {
            event.preventDefault();

            if (
                state.currentPage <
                state.totalPages
            ) {
                loadStaff({
                    force: true,
                    page:
                        state.currentPage +
                        1,
                });
            }

            return;
        }


        /*
         * --------------------------------------------------------
         * PAGE NUMBER
         * --------------------------------------------------------
         */

        const pageButton =
            target.closest(
                "[data-staff-page]"
            );

        if (pageButton) {
            event.preventDefault();

            const page =
                Number(
                    pageButton.dataset
                        .staffPage
                );

            if (
                Number.isInteger(page) &&
                page >= 1 &&
                page <=
                    state.totalPages &&
                page !==
                    state.currentPage
            ) {
                loadStaff({
                    force: true,
                    page,
                });
            }

            return;
        }


        /*
         * --------------------------------------------------------
         * FORM MODAL CLOSE
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffFormModalClose"
            ) ||
            target.closest(
                "#staffFormCancelBtn"
            )
        ) {
            event.preventDefault();

            closeModal(
                getFormModal()
            );

            return;
        }


        /*
         * --------------------------------------------------------
         * VIEW MODAL CLOSE
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffViewModalClose"
            ) ||
            target.closest(
                "#staffViewCloseBtn"
            )
        ) {
            event.preventDefault();

            closeModal(
                getViewModal()
            );

            return;
        }


        /*
         * --------------------------------------------------------
         * VIEW -> EDIT
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffViewEditBtn"
            )
        ) {
            event.preventDefault();

            const staff =
                state.currentStaff;

            closeModal(
                getViewModal()
            );

            if (staff) {
                setTimeout(
                    function () {
                        openEditStaff(
                            getStaffId(
                                staff
                            )
                        );
                    },
                    50
                );
            }

            return;
        }


        /*
         * --------------------------------------------------------
         * DELETE CANCEL
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffDeleteCancelBtn"
            )
        ) {
            event.preventDefault();

            closeModal(
                getDeleteModal()
            );

            return;
        }


        /*
         * --------------------------------------------------------
         * DELETE CONFIRM
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffDeleteConfirmBtn"
            )
        ) {
            event.preventDefault();

            confirmDeleteStaff();

            return;
        }


        /*
         * --------------------------------------------------------
         * TOAST CLOSE
         * --------------------------------------------------------
         */

        if (
            target.closest(
                "#staffToastClose"
            )
        ) {
            event.preventDefault();

            hideToast();

            return;
        }


        /*
         * --------------------------------------------------------
         * CLICK OUTSIDE ACTION MENU
         * --------------------------------------------------------
         */

        if (
            state.actionMenu &&
            !target.closest(
                ".staff-action-menu"
            )
        ) {
            closeActionMenu();
        }
    }


    /* ============================================================
       SUBMIT HANDLER
       ============================================================ */

    function handleSubmit(event) {
        const form =
            event.target.closest(
                "#staffForm"
            );

        if (!form) {
            return;
        }

        event.preventDefault();

        saveStaff();
    }


    /* ============================================================
       INPUT HANDLER
       ============================================================ */

    function handleInput(event) {
        const target =
            event.target;

        if (
            !target.matches(
                "#staffSearchInput"
            )
        ) {
            return;
        }

        if (
            state.searchTimer
        ) {
            clearTimeout(
                state.searchTimer
            );
        }

        state.searchTimer =
            setTimeout(
                function () {
                    state.currentPage =
                        1;

                    loadStaff({
                        force: true,
                        page: 1,
                    });
                },
                CONFIG.SEARCH_DELAY
            );
    }


    /* ============================================================
       CHANGE HANDLER
       ============================================================ */

    function handleChange(event) {
        const target =
            event.target;

        if (
            target.matches(
                "#staffStatusFilter, " +
                "#staffDepartmentFilter, " +
                "#staffDesignationFilter"
            )
        ) {
            state.currentPage =
                1;

            loadStaff({
                force: true,
                page: 1,
            });
        }
    }


    /* ============================================================
       KEYBOARD HANDLER
       ============================================================ */

    function handleKeyDown(event) {
        if (
            event.key !==
            "Escape"
        ) {
            return;
        }

        if (
            state.actionMenu
        ) {
            closeActionMenu();
            return;
        }

        const activeModal =
            document.querySelector(
                "#staffFormModal.is-visible, " +
                "#staffViewModal.is-visible, " +
                "#staffDeleteModal.is-visible, " +
                "#staffFormModal.active, " +
                "#staffViewModal.active, " +
                "#staffDeleteModal.active"
            );

        if (activeModal) {
            closeModal(
                activeModal
            );
        }
    }


    /* ============================================================
       RESIZE / SCROLL
       ============================================================ */

    function handleResize() {
        if (
            state.actionMenu &&
            state.actionMenuButton
        ) {
            positionActionMenu(
                state.actionMenuButton,
                state.actionMenu
            );
        }
    }

    function handleScroll() {
        if (
            state.actionMenu
        ) {
            closeActionMenu();
        }
    }


    /* ============================================================
       RESET FILTERS
       ============================================================ */

    function resetFilters() {
        const search =
            $("#staffSearchInput");

        const status =
            $("#staffStatusFilter");

        const department =
            $("#staffDepartmentFilter");

        const designation =
            $("#staffDesignationFilter");

        if (search) {
            search.value = "";
        }

        if (status) {
            status.value = "";
        }

        if (department) {
            department.value = "";
        }

        if (designation) {
            designation.value = "";
        }

        state.currentPage =
            1;

        loadStaff({
            force: true,
            page: 1,
        });
    }


    /* ============================================================
       BIND EVENTS
       ============================================================ */

    function bindEvents() {
        if (
            state.listenersBound
        ) {
            return;
        }

        /*
         * Delegated events are intentional.
         *
         * Staff HTML is loaded dynamically
         * by router.js.
         */

        document.addEventListener(
            "click",
            handleClick
        );

        document.addEventListener(
            "submit",
            handleSubmit
        );

        document.addEventListener(
            "input",
            handleInput
        );

        document.addEventListener(
            "change",
            handleChange
        );

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        window.addEventListener(
            "resize",
            handleResize
        );

        window.addEventListener(
            "scroll",
            handleScroll,
            true
        );

        state.listenersBound =
            true;
    }


    /* ============================================================
       UNBIND EVENTS
       ============================================================ */

    function unbindEvents() {
        if (
            !state.listenersBound
        ) {
            return;
        }

        document.removeEventListener(
            "click",
            handleClick
        );

        document.removeEventListener(
            "submit",
            handleSubmit
        );

        document.removeEventListener(
            "input",
            handleInput
        );

        document.removeEventListener(
            "change",
            handleChange
        );

        document.removeEventListener(
            "keydown",
            handleKeyDown
        );

        window.removeEventListener(
            "resize",
            handleResize
        );

        window.removeEventListener(
            "scroll",
            handleScroll,
            true
        );

        state.listenersBound =
            false;
    }


    /* ============================================================
       INIT
       ============================================================ */

    async function init() {
        const page =
            getStaffPage();

        if (!page) {
            warn(
                "#staffPage not found."
            );

            return;
        }

        if (
            state.initialized
        ) {
            return refresh();
        }

        state.initialized =
            true;

        state.currentPage =
            CONFIG.DEFAULT_PAGE;

        state.perPage =
            CONFIG.DEFAULT_PER_PAGE;

        state.staff = [];

        state.allStaff = [];

        state.currentStaff =
            null;

        bindEvents();

        log(
            "Staff module initializing..."
        );

        if (window.TenspickAuth && window.TenspickAuth.isStaff()) {
            const addBtn = $("#staffAddBtn");
            if (addBtn) addBtn.style.display = "none";
        }

        /*
         * These are background operations.
         * They must not block the table.
         */
        loadCsrfToken();

        loadAllStaff();

        /*
         * Main Staff request.
         */
        await loadStaff({
            force: true,
            page: 1,
        });

        log(
            "Staff module initialized."
        );
    }


    /* ============================================================
       DESTROY
       ============================================================ */

    function destroy() {
        log(
            "Destroying Staff module..."
        );

        closeActionMenu();

        unbindEvents();

        if (
            state.staffRequestController
        ) {
            try {
                state.staffRequestController.abort();
            } catch {
                // Ignore.
            }

            state.staffRequestController =
                null;
        }

        if (
            state.searchTimer
        ) {
            clearTimeout(
                state.searchTimer
            );

            state.searchTimer =
                null;
        }

        if (
            state.toastTimer
        ) {
            clearTimeout(
                state.toastTimer
            );

            state.toastTimer =
                null;
        }

        state.initialized =
            false;

        state.loading =
            false;

        state.saving =
            false;

        state.deleting =
            false;

        state.currentPage =
            CONFIG.DEFAULT_PAGE;

        state.perPage =
            CONFIG.DEFAULT_PER_PAGE;

        state.totalRecords =
            0;

        state.totalPages =
            1;

        state.staff = [];

        state.allStaff = [];

        state.currentStaff =
            null;

        state.lastFocusedElement =
            null;

        document.body.classList.remove(
            "staff-modal-open"
        );
    }


    /* ============================================================
       REFRESH
       ============================================================ */

    function refresh() {
        return loadStaff({
            force: true,
            page:
                state.currentPage,
        });
    }


    /* ============================================================
       PUBLIC MODULE
       ============================================================ */

    /*
     * IMPORTANT:
     *
     * router.js expects:
     *
     * window.TenspickStaff
     *
     * Do not rename this.
     */

    window.TenspickStaff = {
        init: init,

        destroy: destroy,

        refresh: refresh,

        loadStaff: loadStaff,

        openAdd: openAddStaff,

        openView: openViewStaff,

        openEdit: openEditStaff,

        openDelete: openDeleteStaff,
    };

})(window, document);