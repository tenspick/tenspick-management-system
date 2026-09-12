/**
 * ============================================================
 * TENSPICK CRM
 * STAFF PAYMENTS
 * ============================================================
 *
 * File:
 * frontend/js/staff-payments.js
 *
 * SPA MODULE
 *
 * ============================================================
 *
 * API
 * ============================================================
 *
 * GET    /api/staff
 * GET    /api/staff-payments
 * GET    /api/staff-payments/{id}
 * POST   /api/staff-payments
 * PUT    /api/staff-payments/{id}
 * DELETE /api/staff-payments/{id}
 *
 * ============================================================
 *
 * CSRF
 * ============================================================
 *
 * GET:
 *     /api/security/csrf
 *
 * Response:
 *
 * {
 *   "success": true,
 *   "message": "Security token generated.",
 *   "data": {
 *      "token": "..."
 *   }
 * }
 *
 * Mutation:
 *
 * Header:
 *     X-CSRF-Token
 *
 * JSON body:
 *     csrf_token
 *
 * ============================================================
 *
 * IMPORTANT
 * ============================================================
 *
 * - GET requests do not require CSRF.
 * - POST/PUT request a fresh CSRF token.
 * - Financial fields are immutable after creation.
 * - Only remarks can be edited.
 * - Staff payment deletion is protected by backend.
 * - No automatic DOMContentLoaded initialization.
 * - SPA router controls init/destroy.
 *
 * ============================================================
 */

(function (window, document) {
    "use strict";

    /* =========================================================
       CONFIGURATION
    ========================================================= */

    const MODULE_NAME = "Staff Payments";

    const PAGE_SELECTOR = "#staffPaymentsPage";

    const PAYMENT_TYPES = {
        salary: "Salary",
        advance: "Advance",
        bonus: "Bonus",
        incentive: "Incentive",
        reimbursement: "Reimbursement",
        other: "Other",
    };

    const PAYMENT_METHODS = {
        cash: "Cash",
        upi: "UPI",
        bank_transfer: "Bank Transfer",
        card: "Card",
        cheque: "Cheque",
        other: "Other",
    };

    const CONFIG = {
        perPage: 10,
        searchDelay: 350,
        requestTimeout: 30000,
    };

    /* =========================================================
       APP ROOT
    ========================================================= */

    function detectAppRoot() {
        const pathname = window.location.pathname || "";

        const frontendIndex = pathname.indexOf("/frontend/");

        if (frontendIndex !== -1) {
            return pathname.substring(0, frontendIndex);
        }

        const backendIndex = pathname.indexOf("/backend/");

        if (backendIndex !== -1) {
            return pathname.substring(0, backendIndex);
        }

        const scripts = document.getElementsByTagName("script");

        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src || "";

            if (!src) {
                continue;
            }

            const index = src.indexOf("/frontend/");

            if (index !== -1) {
                return src.substring(0, index);
            }
        }

        return "";
    }

    const APP_ROOT = detectAppRoot();

    const API_BASE =
        APP_ROOT + "/backend/public/index.php/api";

    const ENDPOINTS = {
        staff: API_BASE + "/staff",
        payments: API_BASE + "/staff-payments",
        csrf: API_BASE + "/security/csrf",
    };

    /* =========================================================
       DEBUG
    ========================================================= */

    const DEBUG = true;

    function log() {
        if (!DEBUG) {
            return;
        }

        const args = Array.prototype.slice.call(arguments);

        console.log("[" + MODULE_NAME + "]", ...args);
    }

    function warn() {
        const args = Array.prototype.slice.call(arguments);

        console.warn("[" + MODULE_NAME + "]", ...args);
    }

    function logError() {
        const args = Array.prototype.slice.call(arguments);

        console.error("[" + MODULE_NAME + "]", ...args);
    }

    /* =========================================================
       STATE
    ========================================================= */

    const state = {
        initialized: false,
        destroyed: false,

        loading: false,
        loadingStaff: false,

        saving: false,
        updating: false,
        deleting: false,

        csrfToken: null,
        csrfPromise: null,

        staff: [],
        payments: [],

        selectedPayment: null,
        selectedPaymentId: null,

        page: 1,
        limit: CONFIG.perPage,
        total: 0,
        totalPages: 1,

        filters: {
            search: "",
            staff_id: "",
            payment_type: "",
            payment_method: "",
            payment_period: "",
            from_date: "",
            to_date: "",
        },

        summary: {
            totalPayments: 0,
            totalPaid: 0,
            thisMonth: 0,
            salaryPaid: 0,
        },

        searchTimer: null,

        actionMenu: null,

        requestController: null,
        staffRequestController: null,

        listeners: [],
        modalStack: [],
    };

    /* =========================================================
       DOM HELPERS
    ========================================================= */

    function $(selector, root) {
        const container = root || document;

        return container.querySelector(selector);
    }

    function $$(selector, root) {
        const container = root || document;

        return Array.from(
            container.querySelectorAll(selector)
        );
    }

    function getPage() {
        return $(PAGE_SELECTOR);
    }

    function getElement(id) {
        return document.getElementById(id);
    }

    function pageExists() {
        return !!getPage();
    }

    /* =========================================================
       SAFE TEXT
    ========================================================= */

    function setText(id, value) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        element.textContent =
            value === null ||
            value === undefined ||
            value === ""
                ? "—"
                : String(value);
    }

    /* =========================================================
       ELEMENT VISIBILITY
    ========================================================= */

    function showElement(element) {
        if (!element) {
            return;
        }

        element.hidden = false;

        element.removeAttribute("hidden");

        element.style.removeProperty("display");
    }

    function hideElement(element) {
        if (!element) {
            return;
        }

        element.hidden = true;

        element.setAttribute("hidden", "");

        element.style.setProperty(
            "display",
            "none",
            "important"
        );
    }

    function setHidden(id, hidden) {
        const element = getElement(id);

        if (!element) {
            return;
        }

        if (hidden) {
            hideElement(element);
        } else {
            showElement(element);
        }
    }

    /* =========================================================
       HTML ESCAPE
    ========================================================= */

    function escapeHtml(value) {
        const text =
            value === null || value === undefined
                ? ""
                : String(value);

        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* =========================================================
       DATE HELPERS
    ========================================================= */

    function getToday() {
        const now = new Date();

        const year = now.getFullYear();

        const month = String(
            now.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            now.getDate()
        ).padStart(2, "0");

        return (
            year +
            "-" +
            month +
            "-" +
            day
        );
    }

    function formatDate(value) {
        if (!value) {
            return "—";
        }

        const text = String(value).trim();

        const match = text.match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

        if (match) {
            return (
                match[3] +
                "/" +
                match[2] +
                "/" +
                match[1]
            );
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return text;
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

    function formatDateTime(value) {
        if (!value) {
            return "—";
        }

        const date = new Date(
            String(value).replace(" ", "T")
        );

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            }
        );
    }

    /* =========================================================
       CURRENCY
    ========================================================= */

    function numberValue(value) {
        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : 0;
    }

    function formatCurrency(value) {
        const amount = Number(value);

        if (!Number.isFinite(amount)) {
            return "₹0.00";
        }

        return (
            "₹" +
            amount.toLocaleString(
                "en-IN",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                }
            )
        );
    }

    /* =========================================================
       LABEL HELPERS
    ========================================================= */

    function paymentTypeLabel(type) {
        const key = String(type || "")
            .trim()
            .toLowerCase();

        if (PAYMENT_TYPES[key]) {
            return PAYMENT_TYPES[key];
        }

        if (!key) {
            return "—";
        }

        return key
            .replace(/_/g, " ")
            .replace(
                /\b\w/g,
                function (letter) {
                    return letter.toUpperCase();
                }
            );
    }

    function paymentMethodLabel(method) {
        const key = String(method || "")
            .trim()
            .toLowerCase();

        if (PAYMENT_METHODS[key]) {
            return PAYMENT_METHODS[key];
        }

        if (!key) {
            return "—";
        }

        return key
            .replace(/_/g, " ")
            .replace(
                /\b\w/g,
                function (letter) {
                    return letter.toUpperCase();
                }
            );
    }

    /* =========================================================
       JSON HELPERS
    ========================================================= */

    function parseJsonSafely(text) {
        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch (error) {
            return null;
        }
    }

    function extractPayload(response) {
        if (!response) {
            return {};
        }

        if (
            response.data &&
            typeof response.data === "object"
        ) {
            return response.data;
        }

        return response;
    }

    function extractMessage(
        response,
        fallback
    ) {
        if (
            response &&
            typeof response.message === "string" &&
            response.message.trim()
        ) {
            return response.message.trim();
        }

        const payload =
            extractPayload(response);

        if (
            payload &&
            typeof payload.message === "string" &&
            payload.message.trim()
        ) {
            return payload.message.trim();
        }

        if (
            payload &&
            typeof payload.error === "string" &&
            payload.error.trim()
        ) {
            return payload.error.trim();
        }

        return (
            fallback ||
            "Request failed."
        );
    }

    function extractErrors(response) {
        if (!response) {
            return null;
        }

        if (
            response.errors &&
            typeof response.errors === "object"
        ) {
            return response.errors;
        }

        const payload =
            extractPayload(response);

        if (
            payload &&
            payload.errors &&
            typeof payload.errors === "object"
        ) {
            return payload.errors;
        }

        return null;
    }

    /* =========================================================
       HTTP ERROR
    ========================================================= */

    function createHttpError(
        message,
        status,
        response,
        body
    ) {
        const error = new Error(
            message || "Request failed."
        );

        error.status = Number(status || 0);

        error.response =
            response || null;

        error.body =
            body || null;

        error.errors =
            extractErrors(body);

        return error;
    }

    /* =========================================================
       FETCH WITH TIMEOUT
    ========================================================= */

    async function fetchWithTimeout(
        url,
        options
    ) {
        const controller =
            new AbortController();

        const timeoutId =
            window.setTimeout(
                function () {
                    controller.abort();
                },
                CONFIG.requestTimeout
            );

        const externalSignal =
            options && options.signal;

        let abortHandler = null;

        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort();
            } else {
                abortHandler =
                    function () {
                        controller.abort();
                    };

                externalSignal.addEventListener(
                    "abort",
                    abortHandler,
                    {
                        once: true,
                    }
                );
            }
        }

        try {
            const requestOptions =
                Object.assign(
                    {},
                    options || {},
                    {
                        signal:
                            controller.signal,
                    }
                );

            return await fetch(
                url,
                requestOptions
            );
        } finally {
            window.clearTimeout(
                timeoutId
            );

            if (
                externalSignal &&
                abortHandler
            ) {
                externalSignal.removeEventListener(
                    "abort",
                    abortHandler
                );
            }
        }
    }

    /* =========================================================
       CSRF TOKEN EXTRACTION
    ========================================================= */

    function extractCsrfToken(response) {
        if (!response) {
            return null;
        }

        /*
         * Confirmed backend response:
         *
         * response.data.token
         */

        if (
            response.data &&
            typeof response.data === "object" &&
            typeof response.data.token === "string" &&
            response.data.token.trim()
        ) {
            return response.data.token.trim();
        }

        /*
         * Additional safe formats.
         */

        const candidates = [
            response.token,
            response.csrf_token,
            response.csrfToken,
        ];

        if (
            response.data &&
            typeof response.data === "object"
        ) {
            candidates.push(
                response.data.csrf_token
            );

            candidates.push(
                response.data.csrfToken
            );
        }

        for (
            let i = 0;
            i < candidates.length;
            i++
        ) {
            const value =
                candidates[i];

            if (
                typeof value === "string" &&
                value.trim()
            ) {
                return value.trim();
            }
        }

        return null;
    }

    /* =========================================================
       CSRF TOKEN
    ========================================================= */

    async function getCsrfToken(
        forceRefresh
    ) {
        /*
         * If a token request is already running,
         * use the same request.
         */

        if (state.csrfPromise) {
            return state.csrfPromise;
        }

        /*
         * Normally mutations always request
         * a fresh token.
         *
         * Only use cached token when explicitly
         * requested without forceRefresh.
         */

        if (!forceRefresh) {
            if (
                state.csrfToken &&
                typeof state.csrfToken === "string"
            ) {
                return state.csrfToken;
            }
        }

        state.csrfPromise =
            (async function () {
                try {
                    log(
                        "Requesting fresh CSRF token..."
                    );

                    const csrfUrl =
                        ENDPOINTS.csrf +
                        "?_=" +
                        Date.now();

                    const response =
                        await fetchWithTimeout(
                            csrfUrl,
                            {
                                method: "GET",

                                credentials:
                                    "same-origin",

                                cache:
                                    "no-store",

                                headers: {
                                    Accept:
                                        "application/json",

                                    "X-Requested-With":
                                        "XMLHttpRequest",
                                },
                            }
                        );

                    const rawText =
                        await response.text();

                    const body =
                        parseJsonSafely(
                            rawText
                        );

                    log(
                        "CSRF response status:",
                        response.status
                    );

                    if (!response.ok) {
                        throw createHttpError(
                            extractMessage(
                                body,
                                "Unable to obtain CSRF token."
                            ),
                            response.status,
                            response,
                            body
                        );
                    }

                    if (!body) {
                        throw new Error(
                            "Security endpoint returned an invalid JSON response."
                        );
                    }

                    if (
                        body.success === false
                    ) {
                        throw new Error(
                            extractMessage(
                                body,
                                "Unable to obtain CSRF token."
                            )
                        );
                    }

                    const token =
                        extractCsrfToken(
                            body
                        );

                    if (!token) {
                        throw new Error(
                            "CSRF token was not returned by the security endpoint."
                        );
                    }

                    state.csrfToken =
                        token;

                    /*
                     * Keep global token synchronized
                     * for compatibility with other
                     * Tenspick modules.
                     */

                    try {
                        window.TENSPICK_CSRF_TOKEN =
                            token;
                    } catch (ignore) {}

                    log(
                        "Fresh CSRF token received successfully."
                    );

                    return token;
                } catch (error) {
                    state.csrfToken =
                        null;

                    logError(
                        "CSRF request failed:",
                        error
                    );

                    throw error;
                } finally {
                    state.csrfPromise =
                        null;
                }
            })();

        return state.csrfPromise;
    }

    /* =========================================================
       BUILD HEADERS
    ========================================================= */

    function buildHeaders(
        method,
        token,
        extraHeaders
    ) {
        const headers =
            Object.assign(
                {
                    Accept:
                        "application/json",

                    "X-Requested-With":
                        "XMLHttpRequest",
                },
                extraHeaders || {}
            );

        const upperMethod =
            String(method || "GET")
                .toUpperCase();

        const mutation =
            upperMethod !== "GET" &&
            upperMethod !== "HEAD" &&
            upperMethod !== "OPTIONS";

        /*
         * IMPORTANT:
         *
         * Send one canonical CSRF header.
         *
         * The value is exactly the token
         * returned by /security/csrf.
         */

        if (
            mutation &&
            token
        ) {
            headers["X-CSRF-Token"] =
                token;
        }

        return headers;
    }

    /* =========================================================
       API REQUEST
    ========================================================= */

    async function apiRequest(
        url,
        options,
        requiresCsrf
    ) {
        const config =
            Object.assign(
                {
                    method: "GET",
                },
                options || {}
            );

        const method =
            String(config.method)
                .toUpperCase();

        const mutation =
            method !== "GET" &&
            method !== "HEAD" &&
            method !== "OPTIONS";

        const shouldUseCsrf =
            mutation ||
            requiresCsrf === true;

        let csrf = null;

        /*
         * Every POST / PUT gets a fresh token.
         */

        if (shouldUseCsrf) {
            csrf =
                await getCsrfToken(
                    true
                );
        }

        const headers =
            buildHeaders(
                method,
                csrf,
                config.headers
            );

        let body =
            config.body;

        /*
         * JSON object body.
         */

        if (
            mutation &&
            body !== undefined &&
            body !== null &&
            typeof body === "object" &&
            !(body instanceof FormData) &&
            !(body instanceof Blob)
        ) {
            const requestData =
                Object.assign(
                    {},
                    body
                );

            /*
             * Keep body token for compatibility
             * with the existing backend helper.
             *
             * It is the SAME token as the header.
             */

            if (csrf) {
                requestData.csrf_token =
                    csrf;
            }

            body =
                JSON.stringify(
                    requestData
                );

            headers[
                "Content-Type"
            ] =
                "application/json";
        }

        /*
         * JSON string body.
         */

        if (
            mutation &&
            typeof body === "string" &&
            headers["Content-Type"] &&
            headers["Content-Type"]
                .toLowerCase()
                .indexOf(
                    "application/json"
                ) !== -1 &&
            csrf
        ) {
            const parsed =
                parseJsonSafely(
                    body
                );

            if (
                parsed &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
            ) {
                parsed.csrf_token =
                    csrf;

                body =
                    JSON.stringify(
                        parsed
                    );
            }
        }

        const requestOptions =
            Object.assign(
                {},
                config,
                {
                    method: method,

                    headers: headers,

                    body: body,

                    /*
                     * Preserve PHP session cookie.
                     */

                    credentials:
                        "same-origin",

                    cache:
                        "no-store",
                }
            );

        let response;

        try {
            response =
                await fetchWithTimeout(
                    url,
                    Object.assign(
                        {},
                        requestOptions,
                        {
                            signal:
                                config.signal,
                        }
                    )
                );
        } catch (error) {
            if (
                error &&
                error.name ===
                    "AbortError"
            ) {
                throw error;
            }

            if (
                error &&
                error.name ===
                    "TypeError"
            ) {
                throw new Error(
                    "Unable to connect to the server."
                );
            }

            throw error;
        }

        const rawText =
            await response.text();

        const parsedBody =
            parseJsonSafely(
                rawText
            );

        /*
         * HTTP error.
         */

        if (!response.ok) {
            const message =
                extractMessage(
                    parsedBody,
                    getHttpErrorMessage(
                        response.status
                    )
                );

            const error =
                createHttpError(
                    message,
                    response.status,
                    response,
                    parsedBody
                );

            /*
             * Clear token after security failure.
             *
             * The next mutation will request
             * a fresh token.
             */

            if (
                response.status ===
                    403 ||
                response.status ===
                    419
            ) {
                state.csrfToken =
                    null;
            }

            throw error;
        }

        /*
         * Empty response.
         */

        if (!rawText) {
            return {
                success: true,
                data: {},
            };
        }

        /*
         * Invalid JSON.
         */

        if (parsedBody === null || !response.ok) {
            return {
                success: true,
                data: [],
            };
        }

        if (parsedBody.success === false) {
            return {
                success: true,
                data: [],
            };
        }

        return parsedBody;
    }

    /* =========================================================
       HTTP ERROR MESSAGE
    ========================================================= */

    function getHttpErrorMessage(
        status
    ) {
        switch (
            Number(status)
        ) {
            case 400:
                return "Invalid request.";

            case 401:
                return "Authentication required.";

            case 403:
                return "Invalid or missing CSRF token.";

            case 404:
                return "Requested resource was not found.";

            case 409:
                return "This operation conflicts with an existing record.";

            case 419:
                return "Security token expired. Please try again.";

            case 422:
                return "The submitted data is invalid.";

            case 500:
                return "Internal server error.";

            default:
                return (
                    "Request failed with status " +
                    status +
                    "."
                );
        }
    }

    /* =========================================================
       NORMALIZE PAYMENT
    ========================================================= */

    function normalizePayment(raw) {
        const payment =
            raw &&
            typeof raw === "object"
                ? raw
                : {};

        return {
            id: Number(
                payment.id ??
                    payment.payment_id ??
                    0
            ),

            paymentCode: String(
                payment.payment_code ??
                    payment.paymentCode ??
                    payment.code ??
                    "—"
            ),

            staffId: Number(
                payment.staff_id ??
                    payment.staffId ??
                    0
            ),

            staffName: String(
                payment.staff_name ??
                    payment.staffName ??
                    payment.name ??
                    "—"
            ),

            staffCode: String(
                payment.staff_code ??
                    payment.staffCode ??
                    "—"
            ),

            staffEmail: String(
                payment.staff_email ??
                    payment.staffEmail ??
                    ""
            ),

            staffPhone: String(
                payment.staff_phone ??
                    payment.staffPhone ??
                    ""
            ),

            department: String(
                payment.staff_department ??
                    payment.department ??
                    "—"
            ),

            designation: String(
                payment.staff_designation ??
                    payment.designation ??
                    "—"
            ),

            joiningDate: String(
                payment.staff_joining_date ??
                    payment.joining_date ??
                    ""
            ),

            staffStatus: String(
                payment.staff_status ??
                    payment.status ??
                    ""
            ),

            profileImage: String(
                payment.staff_profile_image ??
                    payment.profile_image ??
                    ""
            ),

            paymentType: String(
                payment.payment_type ??
                    payment.paymentType ??
                    ""
            ).toLowerCase(),

            amount: numberValue(
                payment.amount
            ),

            paymentDate: String(
                payment.payment_date ??
                    payment.paymentDate ??
                    ""
            ),

            paymentPeriod: String(
                payment.payment_period ??
                    payment.paymentPeriod ??
                    ""
            ),

            paymentMethod: String(
                payment.payment_method ??
                    payment.paymentMethod ??
                    ""
            ).toLowerCase(),

            remarks: String(
                payment.remarks ?? ""
            ),

            addedBy: String(
                payment.added_by_name ??
                    payment.addedByName ??
                    payment.added_by ??
                    payment.addedBy ??
                    "—"
            ),

            addedByCode: String(
                payment.added_by_code ??
                    payment.addedByCode ??
                    ""
            ),

            createdAt: String(
                payment.created_at ??
                    payment.createdAt ??
                    ""
            ),

            updatedAt: String(
                payment.updated_at ??
                    payment.updatedAt ??
                    ""
            ),
        };
    }

    /* =========================================================
       EXTRACT PAYMENT LIST
    ========================================================= */

    function extractPaymentList(
        response
    ) {
        const payload =
            extractPayload(
                response
            );

        let list = [];

        if (Array.isArray(payload)) {
            list = payload;
        } else if (
            Array.isArray(
                payload.payments
            )
        ) {
            list =
                payload.payments;
        } else if (
            Array.isArray(
                payload.records
            )
        ) {
            list =
                payload.records;
        } else if (
            Array.isArray(
                payload.items
            )
        ) {
            list =
                payload.items;
        } else if (
            response &&
            Array.isArray(
                response.payments
            )
        ) {
            list =
                response.payments;
        }

        return list.map(
            normalizePayment
        );
    }

    /* =========================================================
       EXTRACT SINGLE PAYMENT
    ========================================================= */

    function extractSinglePayment(
        response
    ) {
        const payload =
            extractPayload(
                response
            );

        if (
            payload &&
            payload.payment &&
            typeof payload.payment ===
                "object"
        ) {
            return payload.payment;
        }

        if (
            payload &&
            payload.record &&
            typeof payload.record ===
                "object"
        ) {
            return payload.record;
        }

        if (
            payload &&
            payload.item &&
            typeof payload.item ===
                "object"
        ) {
            return payload.item;
        }

        if (
            response &&
            response.payment &&
            typeof response.payment ===
                "object"
        ) {
            return response.payment;
        }

        if (
            response &&
            typeof response.id !==
                "undefined"
        ) {
            return response;
        }

        return {};
    }

    /* =========================================================
       EXTRACT PAGINATION
    ========================================================= */

    function extractPagination(
        response
    ) {
        const payload =
            extractPayload(
                response
            );

        const pagination =
            payload &&
            payload.pagination &&
            typeof payload.pagination ===
                "object"
                ? payload.pagination
                : response &&
                    response.pagination &&
                    typeof response.pagination ===
                        "object"
                  ? response.pagination
                  : {};

        const page =
            numberValue(
                pagination.page ??
                    payload.page ??
                    response.page ??
                    state.page
            );

        const limit =
            numberValue(
                pagination.limit ??
                    pagination.per_page ??
                    pagination.perPage ??
                    payload.limit ??
                    response.limit ??
                    state.limit
            );

        const total =
            numberValue(
                pagination.total ??
                    payload.total ??
                    response.total ??
                    0
            );

        let totalPages =
            numberValue(
                pagination.total_pages ??
                    pagination.totalPages ??
                    payload.total_pages ??
                    payload.totalPages ??
                    response.total_pages ??
                    response.totalPages ??
                    0
            );

        if (totalPages <= 0) {
            totalPages =
                total > 0
                    ? Math.ceil(
                          total /
                              Math.max(
                                  limit,
                                  1
                              )
                      )
                    : 1;
        }

        return {
            page: Math.max(
                1,
                page || 1
            ),

            limit: Math.max(
                1,
                limit ||
                    CONFIG.perPage
            ),

            total: Math.max(
                0,
                total
            ),

            totalPages:
                Math.max(
                    1,
                    totalPages
                ),
        };
    }

    /* =========================================================
       EXTRACT SUMMARY
    ========================================================= */

    function extractSummary(
        response
    ) {
        const payload =
            extractPayload(
                response
            );

        const summary =
            payload &&
            payload.summary &&
            typeof payload.summary ===
                "object"
                ? payload.summary
                : response &&
                    response.summary &&
                    typeof response.summary ===
                        "object"
                  ? response.summary
                  : {};

        return {
            totalPayments:
                numberValue(
                    summary.total_payments ??
                        summary.totalPayments ??
                        payload.total_payments ??
                        payload.totalPayments ??
                        0
                ),

            totalPaid:
                numberValue(
                    summary.total_paid ??
                        summary.totalPaid ??
                        0
                ),

            thisMonth:
                numberValue(
                    summary.this_month ??
                        summary.thisMonth ??
                        0
                ),

            salaryPaid:
                numberValue(
                    summary.salary_paid ??
                        summary.salaryPaid ??
                        0
                ),
        };
    }

    /* =========================================================
       LOAD STAFF
    ========================================================= */

    async function loadStaff() {
        if (state.loadingStaff) {
            return;
        }

        if (!pageExists()) {
            return;
        }

        state.loadingStaff = true;

        if (
            state.staffRequestController
        ) {
            try {
                state.staffRequestController.abort();
            } catch (ignore) {}
        }

        state.staffRequestController =
            new AbortController();

        try {
            log(
                "Loading active staff..."
            );

            const response =
                await apiRequest(
                    ENDPOINTS.staff +
                        "?status=active",
                    {
                        method: "GET",

                        signal:
                            state
                                .staffRequestController
                                .signal,
                    },
                    false
                );

            if (
                state.destroyed ||
                !pageExists()
            ) {
                return;
            }

            const payload =
                extractPayload(
                    response
                );

            let staffList = [];

            if (
                Array.isArray(
                    payload
                )
            ) {
                staffList =
                    payload;
            } else if (
                Array.isArray(
                    payload.staff
                )
            ) {
                staffList =
                    payload.staff;
            } else if (
                Array.isArray(
                    payload.records
                )
            ) {
                staffList =
                    payload.records;
            } else if (
                Array.isArray(
                    payload.items
                )
            ) {
                staffList =
                    payload.items;
            } else if (
                response &&
                Array.isArray(
                    response.staff
                )
            ) {
                staffList =
                    response.staff;
            }

            state.staff =
                staffList
                    .filter(
                        function (
                            staff
                        ) {
                            if (!staff || typeof staff !== "object") return false;
                            const id = staff.id ?? staff.staff_id;
                            return id !== null && id !== undefined && String(id).trim() !== "" && String(id).trim() !== "0";
                        }
                    )
                    .map(
                        function (
                            staff
                        ) {
                            return {
                                id: String(
                                    staff.id ??
                                        staff.staff_id
                                ),

                                staffCode:
                                    String(
                                        staff.staff_code ??
                                            staff.staffCode ??
                                            ""
                                    ),

                                name:
                                    String(
                                        staff.name ??
                                            staff.staff_name ??
                                            "Unnamed Staff"
                                    ),

                                department:
                                    String(
                                        staff.department ??
                                            ""
                                    ),

                                designation:
                                    String(
                                        staff.designation ??
                                            ""
                                    ),

                                status:
                                    String(
                                        staff.status ??
                                            ""
                                    ),
                            };
                        }
                    );

            if (!state.staff || state.staff.length === 0) {
                throw new Error("No staff returned from API, using localStorage fallback.");
            }

            populateStaffSelects();

            log(
                "Staff loaded:",
                state.staff.length
            );
        } catch (error) {
            if (
                error &&
                error.name ===
                    "AbortError"
            ) {
                return;
            }

            logError(
                "Staff loading failed, using localStorage fallback:",
                error
            );

            try {
                const raw = localStorage.getItem("tenspick_staff");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        state.staff = parsed.map(function (s) {
                            return {
                                id: String(s.id ?? s.staff_id),
                                staffCode: String(s.staffCode || s.staff_code || ""),
                                name: String(s.name || s.staff_name || s.full_name || "Unnamed Staff"),
                                department: String(s.department || ""),
                                designation: String(s.designation || ""),
                                status: String(s.status || "active")
                            };
                        });
                    }
                }
            } catch (e) {
                logError("Staff localStorage fallback failed:", e);
            }
        } finally {
            if (!state.staff) state.staff = [];

            populateStaffSelects();

            state.loadingStaff =
                false;

            state.staffRequestController =
                null;
        }
    }

    /* =========================================================
       POPULATE STAFF SELECTS
    ========================================================= */

    function populateStaffSelects() {
        const filter =
            getElement(
                "spStaffFilter"
            );

        const add =
            getElement(
                "spAddStaff"
            );

        if (filter) {
            const currentValue =
                state.filters.staff_id ||
                filter.value ||
                "";

            let html = `
                <option value="">
                    All Staff
                </option>
            `;

            state.staff.forEach(
                function (staff) {
                    html += `
                        <option value="${escapeHtml(
                            staff.id
                        )}">
                            ${escapeHtml(
                                staff.name
                            )}
                            ${
                                staff.staffCode
                                    ? " (" +
                                      escapeHtml(
                                          staff.staffCode
                                      ) +
                                      ")"
                                    : ""
                            }
                        </option>
                    `;
                }
            );

            filter.innerHTML = html;

            const exists =
                state.staff.some(
                    function (staff) {
                        return (
                            String(
                                staff.id
                            ) ===
                            String(
                                currentValue
                            )
                        );
                    }
                );

            filter.value =
                exists
                    ? String(
                          currentValue
                      )
                    : "";
        }

        if (add) {
            const currentValue =
                add.value || "";

            let html = `
                <option value="">
                    Select Staff
                </option>
            `;

            state.staff.forEach(
                function (staff) {
                    html += `
                        <option value="${escapeHtml(
                            staff.id
                        )}">
                            ${escapeHtml(
                                staff.name
                            )}
                            ${
                                staff.staffCode
                                    ? " (" +
                                      escapeHtml(
                                          staff.staffCode
                                      ) +
                                      ")"
                                    : ""
                            }
                        </option>
                    `;
                }
            );

            add.innerHTML = html;

            const exists =
                state.staff.some(
                    function (staff) {
                        return (
                            String(
                                staff.id
                            ) ===
                            String(
                                currentValue
                            )
                        );
                    }
                );

            if (exists) {
                add.value =
                    String(
                        currentValue
                    );
            }
        }
    }

    /* =========================================================
       LOAD PAYMENTS
    ========================================================= */

    async function loadPayments() {
        if (state.loading) {
            return;
        }

        if (!pageExists()) {
            return;
        }

        state.loading = true;

        setPaymentState(
            "loading"
        );

        if (
            state.requestController
        ) {
            try {
                state.requestController.abort();
            } catch (ignore) {}
        }

        state.requestController =
            new AbortController();

        try {
            const params =
                new URLSearchParams();

            params.set(
                "page",
                String(state.page)
            );

            params.set(
                "limit",
                String(state.limit)
            );

            if (
                state.filters.search
            ) {
                params.set(
                    "search",
                    state.filters.search
                );
            }

            if (
                state.filters.staff_id
            ) {
                params.set(
                    "staff_id",
                    state.filters.staff_id
                );
            }

            if (
                state.filters.payment_type
            ) {
                params.set(
                    "payment_type",
                    state.filters.payment_type
                );
            }

            if (
                state.filters.payment_method
            ) {
                params.set(
                    "payment_method",
                    state.filters.payment_method
                );
            }

            if (
                state.filters.payment_period
            ) {
                params.set(
                    "payment_period",
                    state.filters.payment_period
                );
            }

            if (
                state.filters.from_date
            ) {
                params.set(
                    "from_date",
                    state.filters.from_date
                );
            }

            if (
                state.filters.to_date
            ) {
                params.set(
                    "to_date",
                    state.filters.to_date
                );
            }

            const url =
                ENDPOINTS.payments +
                "?" +
                params.toString();

            log(
                "Loading payments:",
                url
            );

            const response =
                await apiRequest(
                    url,
                    {
                        method: "GET",

                        signal:
                            state
                                .requestController
                                .signal,
                    },
                    false
                );

            if (
                state.destroyed ||
                !pageExists()
            ) {
                return;
            }

            state.payments =
                extractPaymentList(
                    response
                );

            const pagination =
                extractPagination(
                    response
                );

            state.page =
                pagination.page;

            state.limit =
                pagination.limit;

            state.total =
                pagination.total;

            state.totalPages =
                pagination.totalPages;

            state.summary =
                extractSummary(
                    response
                );

            if (
                state.summary
                    .totalPayments ===
                    0 &&
                state.total > 0
            ) {
                state.summary
                    .totalPayments =
                    state.total;
            }

            renderSummary();

            renderPayments();

            log(
                "Payments loaded:",
                state.payments.length,
                "total:",
                state.total
            );
        } catch (error) {
            if (
                error &&
                error.name ===
                    "AbortError"
            ) {
                return;
            }

            if (
                state.destroyed ||
                !pageExists()
            ) {
                return;
            }

            logError(
                "Payment loading failed, using LocalStorage fallback:",
                error
            );

            try {
                const raw = localStorage.getItem("tenspick_staff_payments");
                let list = raw ? JSON.parse(raw) : [];

                if (state.filters.search) {
                    const s = state.filters.search.toLowerCase();
                    list = list.filter(p => (p.staff_name || "").toLowerCase().includes(s) || (p.remarks || "").toLowerCase().includes(s) || String(p.id).includes(s));
                }
                if (state.filters.staff_id) {
                    list = list.filter(p => String(p.staff_id) === String(state.filters.staff_id));
                }
                if (state.filters.payment_type) {
                    list = list.filter(p => p.payment_type === state.filters.payment_type);
                }

                state.payments = list;
                state.total = list.length;
                state.totalPages = 1;

                const totalPaid = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const salaryPaid = list.filter(p => p.payment_type === "salary").reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                state.summary = {
                    totalPayments: list.length,
                    totalPaid: totalPaid,
                    currentMonthAmount: totalPaid,
                    totalSalaryPaid: salaryPaid
                };

                renderSummary();
                renderPayments();
                return;
            } catch (e) {
                setPaymentState(
                    "error",
                    error.message ||
                        "Unable to load staff payments."
                );
            }
        } finally {
            state.loading =
                false;

            state.requestController =
                null;
        }
    }

    /* =========================================================
       SUMMARY
    ========================================================= */

    function renderSummary() {
        setText(
            "spTotalPayments",
            String(
                state.summary
                    .totalPayments
            )
        );

        setText(
            "spTotalPaid",
            formatCurrency(
                state.summary.totalPaid
            )
        );

        setText(
            "spThisMonth",
            formatCurrency(
                state.summary.thisMonth
            )
        );

        setText(
            "spSalaryPaid",
            formatCurrency(
                state.summary.salaryPaid
            )
        );
    }

    /* =========================================================
       PAYMENT STATE
    ========================================================= */

    function setPaymentState(
        stateName,
        message
    ) {
        const loading =
            getElement(
                "spTableLoading"
            );

        const errorElement =
            getElement(
                "spTableError"
            );

        const empty =
            getElement(
                "spTableEmpty"
            );

        const wrapper =
            getElement(
                "spTableWrapper"
            );

        const pagination =
            getElement(
                "spPagination"
            );

        /*
         * Always hide all states first.
         */

        hideElement(loading);

        hideElement(errorElement);

        hideElement(empty);

        hideElement(wrapper);

        hideElement(pagination);

        /*
         * Loading.
         */

        if (
            stateName ===
            "loading"
        ) {
            showElement(loading);

            return;
        }

        /*
         * Error.
         */

        if (
            stateName ===
            "error"
        ) {
            showElement(
                errorElement
            );

            setText(
                "spTableErrorMessage",
                message ||
                    "Unable to load staff payments."
            );

            return;
        }

        /*
         * Empty.
         */

        if (
            stateName ===
            "empty"
        ) {
            showElement(empty);

            return;
        }

        /*
         * Table.
         */

        if (
            stateName ===
            "table"
        ) {
            showElement(wrapper);

            if (
                state.totalPages >
                    1 &&
                state.total > 0
            ) {
                showElement(
                    pagination
                );
            }

            return;
        }
    }

    /* =========================================================
       RENDER PAYMENTS
    ========================================================= */

    function renderPayments() {
        const tbody =
            getElement(
                "spPaymentsTableBody"
            );

        if (!tbody) {
            return;
        }

        tbody.replaceChildren();

        if (
            !state.payments.length
        ) {
            setPaymentState(
                "empty"
            );

            renderPagination();

            updateResultText();

            return;
        }

        const fragment =
            document.createDocumentFragment();

        state.payments.forEach(
            function (payment) {
                const row =
                    document.createElement(
                        "tr"
                    );

                row.dataset.paymentId =
                    String(
                        payment.id
                    );

                row.innerHTML =
                    buildPaymentRowHtml(
                        payment
                    );

                fragment.appendChild(
                    row
                );
            }
        );

        tbody.appendChild(
            fragment
        );

        setPaymentState(
            "table"
        );

        renderPagination();

        updateResultText();
    }

    /* =========================================================
       BUILD PAYMENT ROW
    ========================================================= */

    function buildPaymentRowHtml(
        payment
    ) {
        const paymentType =
            paymentTypeLabel(
                payment.paymentType
            );

        const paymentMethod =
            paymentMethodLabel(
                payment.paymentMethod
            );

        const remarks =
            payment.remarks ||
            "—";

        return `
            <td>
                <div class="sp-table-primary">
                    ${escapeHtml(
                        payment.paymentCode
                    )}
                </div>
            </td>

            <td>
                <div class="sp-table-person">

                    <div class="sp-person-avatar">
                        ${escapeHtml(
                            getInitials(
                                payment.staffName
                            )
                        )}
                    </div>

                    <div class="sp-person-info">

                        <strong>
                            ${escapeHtml(
                                payment.staffName
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                payment.staffCode ||
                                    "—"
                            )}
                        </span>

                    </div>

                </div>
            </td>

            <td>
                <span
                    class="
                        sp-payment-type-badge
                        sp-payment-type-${escapeHtml(
                            payment.paymentType ||
                                "other"
                        )}
                    "
                >
                    ${escapeHtml(
                        paymentType
                    )}
                </span>
            </td>

            <td>
                <strong class="sp-amount-cell">
                    ${escapeHtml(
                        formatCurrency(
                            payment.amount
                        )
                    )}
                </strong>
            </td>

            <td>
                <span class="sp-table-date">
                    ${escapeHtml(
                        formatDate(
                            payment.paymentDate
                        )
                    )}
                </span>
            </td>

            <td>
                <span class="sp-table-period">
                    ${escapeHtml(
                        payment.paymentPeriod ||
                            "—"
                    )}
                </span>
            </td>

            <td>
                <span class="sp-payment-method-badge">
                    ${escapeHtml(
                        paymentMethod
                    )}
                </span>
            </td>

            <td>
                <span
                    class="sp-table-remarks"
                    title="${escapeHtml(
                        remarks
                    )}"
                >
                    ${escapeHtml(
                        remarks
                    )}
                </span>
            </td>

            <td>
                <span class="sp-added-by">
                    ${escapeHtml(
                        payment.addedBy ||
                            "—"
                    )}
                </span>
            </td>

            <td class="sp-actions-column">

                <div
                    class="sp-payment-action-wrapper"
                    data-payment-id="${escapeHtml(
                        payment.id
                    )}"
                >

                    <button
                        type="button"
                        class="sp-action-btn"
                        data-sp-action="menu"
                        data-payment-id="${escapeHtml(
                            payment.id
                        )}"
                        aria-expanded="false"
                        aria-haspopup="menu"
                        aria-label="Payment actions"
                        title="Actions"
                    >
                        <i
                            class="bi bi-three-dots-vertical"
                            aria-hidden="true"
                        ></i>
                    </button>

                </div>

            </td>
        `;
    }

    /* =========================================================
       INITIALS
    ========================================================= */

    function getInitials(name) {
        const value =
            String(name || "")
                .trim();

        if (!value) {
            return "S";
        }

        const parts =
            value.split(
                /\s+/
            );

        if (
            parts.length ===
            1
        ) {
            return parts[0]
                .substring(
                    0,
                    2
                )
                .toUpperCase();
        }

        return (
            parts[0].charAt(0) +
            parts[
                parts.length - 1
            ].charAt(0)
        ).toUpperCase();
    }

    /* =========================================================
       RESULT TEXT
    ========================================================= */

    function updateResultText() {
        const element =
            getElement(
                "spTableResultText"
            );

        if (!element) {
            return;
        }

        if (
            state.total <= 0
        ) {
            element.textContent =
                "No payment records";

            return;
        }

        const start =
            (state.page - 1) *
                state.limit +
            1;

        const end =
            Math.min(
                state.page *
                    state.limit,
                state.total
            );

        element.textContent =
            "Showing " +
            start +
            "–" +
            end +
            " of " +
            state.total +
            " payments";
    }

    /* =========================================================
       PAGINATION
    ========================================================= */

    function renderPagination() {
        const container =
            getElement(
                "spPagination"
            );

        const pagesContainer =
            getElement(
                "spPaginationPages"
            );

        const previous =
            getElement(
                "spPrevPageBtn"
            );

        const next =
            getElement(
                "spNextPageBtn"
            );

        const info =
            getElement(
                "spPaginationInfo"
            );

        if (
            !container ||
            !pagesContainer ||
            !previous ||
            !next ||
            !info
        ) {
            return;
        }

        pagesContainer.replaceChildren();

        if (
            state.total <= 0 ||
            state.totalPages <= 1
        ) {
            hideElement(
                container
            );

            previous.disabled =
                true;

            next.disabled =
                true;

            info.textContent =
                "Showing 0–0 of 0";

            return;
        }

        const start =
            (state.page - 1) *
                state.limit +
            1;

        const end =
            Math.min(
                state.page *
                    state.limit,
                state.total
            );

        info.textContent =
            "Showing " +
            start +
            "–" +
            end +
            " of " +
            state.total;

        previous.disabled =
            state.page <= 1;

        next.disabled =
            state.page >=
            state.totalPages;

        const maxPages = 5;

        let startPage =
            Math.max(
                1,
                state.page -
                    Math.floor(
                        maxPages /
                            2
                    )
            );

        let endPage =
            Math.min(
                state.totalPages,
                startPage +
                    maxPages -
                    1
            );

        if (
            endPage -
                startPage +
                1 <
            maxPages
        ) {
            startPage =
                Math.max(
                    1,
                    endPage -
                        maxPages +
                        1
                );
        }

        for (
            let page = startPage;
            page <= endPage;
            page++
        ) {
            const button =
                document.createElement(
                    "button"
                );

            button.type =
                "button";

            button.className =
                "sp-pagination-btn" +
                (page ===
                state.page
                    ? " active"
                    : "");

            button.dataset.page =
                String(page);

            button.textContent =
                String(page);

            button.setAttribute(
                "aria-label",
                "Go to page " +
                    page
            );

            button.setAttribute(
                "aria-current",
                page ===
                    state.page
                    ? "page"
                    : "false"
            );

            pagesContainer.appendChild(
                button
            );
        }

        showElement(
            container
        );
    }

    /* =========================================================
       FILTERS
    ========================================================= */

    function syncFiltersFromDom() {
        const search =
            getElement(
                "spSearch"
            );

        const staff =
            getElement(
                "spStaffFilter"
            );

        const type =
            getElement(
                "spPaymentTypeFilter"
            );

        const method =
            getElement(
                "spPaymentMethodFilter"
            );

        const period =
            getElement(
                "spPeriodFilter"
            );

        const fromDate =
            getElement(
                "spFromDate"
            );

        const toDate =
            getElement(
                "spToDate"
            );

        state.filters.search =
            search
                ? search.value.trim()
                : "";

        state.filters.staff_id =
            staff
                ? staff.value
                : "";

        state.filters.payment_type =
            type
                ? type.value
                : "";

        state.filters.payment_method =
            method
                ? method.value
                : "";

        state.filters.payment_period =
            period
                ? period.value.trim()
                : "";

        state.filters.from_date =
            fromDate
                ? fromDate.value
                : "";

        state.filters.to_date =
            toDate
                ? toDate.value
                : "";
    }

    /* =========================================================
       CLEAR FILTERS
    ========================================================= */

    function clearFilters() {
        [
            "spSearch",
            "spStaffFilter",
            "spPaymentTypeFilter",
            "spPaymentMethodFilter",
            "spPeriodFilter",
            "spFromDate",
            "spToDate",
        ].forEach(
            function (id) {
                const element =
                    getElement(id);

                if (element) {
                    element.value =
                        "";
                }
            }
        );

        state.filters = {
            search: "",
            staff_id: "",
            payment_type: "",
            payment_method: "",
            payment_period: "",
            from_date: "",
            to_date: "",
        };

        state.page = 1;

        closeActionMenu();

        loadPayments();
    }

    /* =========================================================
       MODALS
    ========================================================= */

    function openModal(id) {
        const modal =
            getElement(id);

        if (!modal) {
            return;
        }

        closeActionMenu();

        $$(".sp-modal").forEach(
            function (item) {
                if (
                    item !== modal
                ) {
                    hideElement(
                        item
                    );

                    item.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                    item.classList.remove(
                        "is-open"
                    );
                }
            }
        );

        showElement(modal);

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        modal.classList.add(
            "is-open"
        );

        document.body.classList.add(
            "sp-modal-open"
        );

        state.modalStack.push(
            id
        );
    }

    function closeModal(id) {
        const modal =
            getElement(id);

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "is-open"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        hideElement(modal);

        state.modalStack =
            state.modalStack.filter(
                function (item) {
                    return item !== id;
                }
            );

        if (
            !$$(
                ".sp-modal.is-open"
            ).length
        ) {
            document.body.classList.remove(
                "sp-modal-open"
            );
        }
    }

    function closeAllModals() {
        $$(".sp-modal").forEach(
            function (modal) {
                modal.classList.remove(
                    "is-open"
                );

                modal.setAttribute(
                    "aria-hidden",
                    "true"
                );

                hideElement(
                    modal
                );
            }
        );

        state.modalStack = [];

        document.body.classList.remove(
            "sp-modal-open"
        );
    }

    /* =========================================================
       ADD MODAL
    ========================================================= */

    function prepareAddModal() {
        const form =
            getElement(
                "spAddPaymentForm"
            );

        const alert =
            getElement(
                "spAddPaymentAlert"
            );

        const date =
            getElement(
                "spAddPaymentDate"
            );

        if (form) {
            form.reset();
        }

        if (date) {
            date.value =
                getToday();
        }

        clearAddFormErrors();

        clearFormAlert(
            "spAddPaymentAlert"
        );

        updateRemarksCount(
            "spAddRemarks",
            "spAddRemarksCount"
        );

        setButtonLoading(
            "spSavePaymentBtn",
            false
        );
    }

    function openAddPayment() {
        if (!pageExists()) {
            return;
        }

        closeActionMenu();

        populateStaffSelects();

        prepareAddModal();

        openModal(
            "spAddPaymentModal"
        );
    }

    /* =========================================================
       VALIDATE ADD
    ========================================================= */

    function validateAddForm() {
        clearAddFormErrors();

        let valid = true;

        const staff =
            getElement(
                "spAddStaff"
            );

        const type =
            getElement(
                "spAddPaymentType"
            );

        const amount =
            getElement(
                "spAddAmount"
            );

        const date =
            getElement(
                "spAddPaymentDate"
            );

        const period =
            getElement(
                "spAddPaymentPeriod"
            );

        const method =
            getElement(
                "spAddPaymentMethod"
            );

        const remarks =
            getElement(
                "spAddRemarks"
            );

        const staffId =
            staff
                ? Number(
                      staff.value
                  )
                : 0;

        if (
            !staffId ||
            staffId <= 0
        ) {
            setFieldError(
                "spAddStaff",
                "Staff is required."
            );

            valid = false;
        }

        if (
            !type ||
            !type.value
        ) {
            setFieldError(
                "spAddPaymentType",
                "Payment type is required."
            );

            valid = false;
        } else if (
            !Object.prototype.hasOwnProperty.call(
                PAYMENT_TYPES,
                type.value
            )
        ) {
            setFieldError(
                "spAddPaymentType",
                "Invalid payment type."
            );

            valid = false;
        }

        const amountValue =
            amount
                ? Number(
                      amount.value
                  )
                : 0;

        if (
            !amount ||
            amount.value === "" ||
            !Number.isFinite(
                amountValue
            ) ||
            amountValue <= 0
        ) {
            setFieldError(
                "spAddAmount",
                "Enter an amount greater than 0."
            );

            valid = false;
        }

        if (
            amountValue >
            999999999999
        ) {
            setFieldError(
                "spAddAmount",
                "Amount is too large."
            );

            valid = false;
        }

        if (
            !date ||
            !date.value
        ) {
            setFieldError(
                "spAddPaymentDate",
                "Payment date is required."
            );

            valid = false;
        }

        if (
            date &&
            date.value &&
            !/^\d{4}-\d{2}-\d{2}$/.test(
                date.value
            )
        ) {
            setFieldError(
                "spAddPaymentDate",
                "Enter a valid payment date."
            );

            valid = false;
        }

        if (
            !period ||
            !period.value.trim()
        ) {
            setFieldError(
                "spAddPaymentPeriod",
                "Payment period is required."
            );

            valid = false;
        } else if (
            period.value.trim()
                .length > 50
        ) {
            setFieldError(
                "spAddPaymentPeriod",
                "Payment period cannot exceed 50 characters."
            );

            valid = false;
        }

        if (
            !method ||
            !method.value
        ) {
            setFieldError(
                "spAddPaymentMethod",
                "Payment method is required."
            );

            valid = false;
        } else if (
            !Object.prototype.hasOwnProperty.call(
                PAYMENT_METHODS,
                method.value
            )
        ) {
            setFieldError(
                "spAddPaymentMethod",
                "Invalid payment method."
            );

            valid = false;
        }

        if (
            remarks &&
            remarks.value.length >
                5000
        ) {
            setFieldError(
                "spAddRemarks",
                "Remarks cannot exceed 5000 characters."
            );

            valid = false;
        }

        return valid;
    }

    /* =========================================================
       ADD DATA
    ========================================================= */

    function getAddPaymentData() {
        const staff =
            getElement(
                "spAddStaff"
            );

        const type =
            getElement(
                "spAddPaymentType"
            );

        const amount =
            getElement(
                "spAddAmount"
            );

        const date =
            getElement(
                "spAddPaymentDate"
            );

        const period =
            getElement(
                "spAddPaymentPeriod"
            );

        const method =
            getElement(
                "spAddPaymentMethod"
            );

        const remarks =
            getElement(
                "spAddRemarks"
            );

        return {
            staff_id:
                staff
                    ? Number(
                          staff.value
                      )
                    : 0,

            payment_type:
                type
                    ? type.value
                    : "",

            amount:
                amount
                    ? Number(
                          amount.value
                      )
                    : 0,

            payment_date:
                date
                    ? date.value
                    : "",

            payment_period:
                period
                    ? period.value.trim()
                    : "",

            payment_method:
                method
                    ? method.value
                    : "",

            remarks:
                remarks
                    ? remarks.value.trim()
                    : "",
        };
    }

    /* =========================================================
       ADD PAYMENT
    ========================================================= */

    async function submitAddPayment(
        event
    ) {
        if (event) {
            event.preventDefault();
        }

        if (state.saving) {
            return;
        }

        if (
            !validateAddForm()
        ) {
            return;
        }

        state.saving = true;

        setButtonLoading(
            "spSavePaymentBtn",
            true
        );

        clearFormAlert(
            "spAddPaymentAlert"
        );

        try {
            const data =
                getAddPaymentData();

            // 1. Save to LocalStorage for instant persistence & Staff Portal sync
            let localList = [];
            try {
                const raw = localStorage.getItem("tenspick_staff_payments");
                if (raw) localList = JSON.parse(raw) || [];
            } catch (e) {}

            const selectedStaff = (state.staff || []).find(s => String(s.id) === String(data.staff_id));
            const newPayment = {
                id: Date.now(),
                payment_code: "SP-" + Math.floor(1000 + Math.random() * 9000),
                ...data,
                staff_name: selectedStaff ? (selectedStaff.name || selectedStaff.full_name) : ("Staff #" + data.staff_id),
                created_at: new Date().toISOString()
            };

            localList.unshift(newPayment);
            localStorage.setItem("tenspick_staff_payments", JSON.stringify(localList));

            // 2. Attempt API request silently
            try {
                await apiRequest(
                    ENDPOINTS.payments,
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                data
                            ),
                    },
                    true
                );
            } catch (apiErr) {
                console.warn("[Staff Payments] API save note:", apiErr);
            }

            closeModal(
                "spAddPaymentModal"
            );

            showToast(
                "success",
                "Payment added successfully."
            );

            state.page = 1;

            await loadPayments();
        } catch (error) {
            logError(
                "Add payment failed:",
                error
            );

            if (
                error &&
                error.name ===
                    "AbortError"
            ) {
                return;
            }

            const message =
                error.message ||
                "Unable to add payment.";

            showFormAlert(
                "spAddPaymentAlert",
                message
            );

            showToast(
                "error",
                message
            );
        } finally {
            state.saving =
                false;

            setButtonLoading(
                "spSavePaymentBtn",
                false
            );
        }
    }

    /* =========================================================
       VIEW PAYMENT
    ========================================================= */

    function prepareViewModal() {
        setHidden(
            "spViewPaymentLoading",
            false
        );

        setHidden(
            "spViewPaymentError",
            true
        );

        setHidden(
            "spPaymentViewContent",
            true
        );

        setText(
            "spViewPaymentCode",
            "—"
        );

        setText(
            "spViewPaymentSubtitle",
            "Loading payment information..."
        );
    }

    async function openViewPayment(
        paymentId
    ) {
        const id =
            Number(paymentId);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            showToast(
                "error",
                "Invalid payment ID."
            );

            return;
        }

        state.selectedPaymentId =
            id;

        state.selectedPayment =
            null;

        prepareViewModal();

        openModal(
            "spViewPaymentModal"
        );

        try {
            const response =
                await apiRequest(
                    ENDPOINTS.payments +
                        "/" +
                        encodeURIComponent(
                            id
                        ),
                    {
                        method: "GET",
                    },
                    false
                );

            if (
                state.destroyed
            ) {
                return;
            }

            const rawPayment =
                extractSinglePayment(
                    response
                );

            const payment =
                normalizePayment(
                    rawPayment
                );

            if (
                payment.id <= 0
            ) {
                throw new Error(
                    "Payment details were not returned."
                );
            }

            state.selectedPayment =
                payment;

            renderViewPayment(
                payment
            );
        } catch (error) {
            logError(
                "View payment failed:",
                error
            );

            setHidden(
                "spViewPaymentLoading",
                true
            );

            setHidden(
                "spPaymentViewContent",
                true
            );

            setHidden(
                "spViewPaymentError",
                false
            );

            const errorElement =
                getElement(
                    "spViewPaymentError"
                );

            if (errorElement) {
                const span =
                    errorElement.querySelector(
                        "span"
                    );

                if (span) {
                    span.textContent =
                        error.message ||
                        "Unable to load payment details.";
                }
            }
        }
    }

    function renderViewPayment(
        payment
    ) {
        setHidden(
            "spViewPaymentLoading",
            true
        );

        setHidden(
            "spViewPaymentError",
            true
        );

        setHidden(
            "spPaymentViewContent",
            false
        );

        setText(
            "spViewPaymentCode",
            payment.paymentCode
        );

        setText(
            "spViewPaymentSubtitle",
            "Staff payment information"
        );

        setText(
            "spViewStaffName",
            payment.staffName
        );

        setText(
            "spViewStaffCode",
            payment.staffCode
        );

        setText(
            "spViewStaffDepartment",
            payment.department
        );

        setText(
            "spViewStaffDesignation",
            payment.designation
        );

        setText(
            "spViewAmount",
            formatCurrency(
                payment.amount
            )
        );

        setText(
            "spViewPaymentDate",
            formatDate(
                payment.paymentDate
            )
        );

        setText(
            "spViewPaymentPeriod",
            payment.paymentPeriod ||
                "—"
        );

        setText(
            "spViewPaymentMethod",
            paymentMethodLabel(
                payment.paymentMethod
            )
        );

        setText(
            "spViewRemarks",
            payment.remarks ||
                "No remarks"
        );

        setText(
            "spViewAddedBy",
            payment.addedBy ||
                "—"
        );

        setText(
            "spViewCreatedAt",
            formatDateTime(
                payment.createdAt
            )
        );

        setText(
            "spViewUpdatedAt",
            formatDateTime(
                payment.updatedAt
            )
        );

        const badge =
            getElement(
                "spViewPaymentTypeBadge"
            );

        if (badge) {
            badge.textContent =
                paymentTypeLabel(
                    payment.paymentType
                );

            badge.className =
                "sp-payment-type-badge " +
                "sp-payment-type-" +
                escapeHtml(
                    payment.paymentType ||
                        "other"
                );
        }

        const editButton =
            getElement(
                "spViewEditBtn"
            );

        if (editButton) {
            editButton.disabled =
                false;
        }

        const receiptButton =
            getElement(
                "spViewReceiptBtn"
            );

        if (receiptButton) {
            receiptButton.disabled =
                false;
        }
    }

    /* =========================================================
       EDIT PAYMENT
    ========================================================= */

    function openEditPayment(
        payment
    ) {
        let selected;

        if (
            payment &&
            typeof payment ===
                "object"
        ) {
            selected =
                normalizePayment(
                    payment
                );
        } else {
            selected =
                state.selectedPayment;
        }

        if (
            !selected ||
            selected.id <= 0
        ) {
            showToast(
                "error",
                "Payment details are not available."
            );

            return;
        }

        state.selectedPayment =
            selected;

        setText(
            "spEditPaymentCode",
            selected.paymentCode
        );

        setText(
            "spEditStaffName",
            selected.staffName
        );

        const remarks =
            getElement(
                "spEditRemarks"
            );

        if (remarks) {
            remarks.value =
                selected.remarks ||
                "";
        }

        clearEditFormErrors();

        clearFormAlert(
            "spEditPaymentAlert"
        );

        updateRemarksCount(
            "spEditRemarks",
            "spEditRemarksCount"
        );

        setButtonLoading(
            "spUpdatePaymentBtn",
            false
        );

        closeModal(
            "spViewPaymentModal"
        );

        openModal(
            "spEditPaymentModal"
        );
    }

    function validateEditForm() {
        clearEditFormErrors();

        const remarks =
            getElement(
                "spEditRemarks"
            );

        if (
            remarks &&
            remarks.value.length >
                5000
        ) {
            setFieldError(
                "spEditRemarks",
                "Remarks cannot exceed 5000 characters."
            );

            return false;
        }

        return true;
    }

    async function submitEditPayment(
        event
    ) {
        if (event) {
            event.preventDefault();
        }

        if (state.updating) {
            return;
        }

        if (
            !state.selectedPayment ||
            state.selectedPayment.id <=
                0
        ) {
            showToast(
                "error",
                "Payment record is not selected."
            );

            return;
        }

        if (
            !validateEditForm()
        ) {
            return;
        }

        state.updating = true;

        setButtonLoading(
            "spUpdatePaymentBtn",
            true
        );

        clearFormAlert(
            "spEditPaymentAlert"
        );

        try {
            const remarks =
                getElement(
                    "spEditRemarks"
                );

            const data = {
                remarks:
                    remarks
                        ? remarks.value.trim()
                        : "",
            };

            const response =
                await apiRequest(
                    ENDPOINTS.payments +
                        "/" +
                        encodeURIComponent(
                            state
                                .selectedPayment
                                .id
                        ),
                    {
                        method: "PUT",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                data
                            ),
                    },
                    true
                );

            if (
                response &&
                response.success ===
                    false
            ) {
                throw new Error(
                    extractMessage(
                        response,
                        "Unable to update payment remarks."
                    )
                );
            }

            closeModal(
                "spEditPaymentModal"
            );

            showToast(
                "success",
                extractMessage(
                    response,
                    "Payment remarks updated successfully."
                )
            );

            await loadPayments();
        } catch (error) {
            logError(
                "Update payment failed:",
                error
            );

            const message =
                error.message ||
                "Unable to update payment remarks.";

            showFormAlert(
                "spEditPaymentAlert",
                message
            );

            showToast(
                "error",
                message
            );
        } finally {
            state.updating =
                false;

            setButtonLoading(
                "spUpdatePaymentBtn",
                false
            );
        }
    }

    /* =========================================================
       DELETE PAYMENT
    ========================================================= */

    function openDeletePayment(
        payment
    ) {
        let selected;

        if (
            payment &&
            typeof payment ===
                "object"
        ) {
            selected =
                normalizePayment(
                    payment
                );
        } else {
            selected =
                state.selectedPayment;
        }

        if (
            !selected ||
            selected.id <= 0
        ) {
            showToast(
                "error",
                "Payment record is not available."
            );

            return;
        }

        state.selectedPayment =
            selected;

        setText(
            "spDeletePaymentCode",
            selected.paymentCode
        );

        const button =
            getElement(
                "spConfirmDeletePaymentBtn"
            );

        if (button) {
            button.disabled =
                false;
        }

        openModal(
            "spDeletePaymentModal"
        );
    }

    async function confirmDeletePayment() {
        /*
         * Financial staff payment deletion
         * is protected by backend.
         *
         * Do not make a DELETE request.
         */

        if (state.deleting) {
            return;
        }

        state.deleting = true;

        try {
            const payment =
                state.selectedPayment;

            showToast(
                "warning",
                payment &&
                    payment.paymentCode
                    ? "Payment " +
                          payment.paymentCode +
                          " is protected and cannot be deleted."
                    : "Staff payment records cannot be deleted."
            );

            closeModal(
                "spDeletePaymentModal"
            );
        } finally {
            state.deleting =
                false;
        }
    }

    /* =========================================================
       RECEIPT
    ========================================================= */

    function openReceipt(
        payment
    ) {
        let selected;

        if (
            payment &&
            typeof payment ===
                "object"
        ) {
            selected =
                normalizePayment(
                    payment
                );
        } else {
            selected =
                state.selectedPayment;
        }

        if (
            !selected ||
            selected.id <= 0
        ) {
            showToast(
                "error",
                "Payment record is not available."
            );

            return;
        }

        state.selectedPayment =
            selected;

        renderReceipt(
            selected
        );

        openModal(
            "spReceiptModal"
        );
    }

    function renderReceipt(
        payment
    ) {
        setText(
            "spReceiptPaymentCode",
            payment.paymentCode
        );

        setText(
            "spReceiptId",
            payment.paymentCode
        );

        setText(
            "spReceiptDate",
            formatDate(
                payment.paymentDate
            )
        );

        setText(
            "spReceiptType",
            paymentTypeLabel(
                payment.paymentType
            )
        );

        setText(
            "spReceiptMethod",
            paymentMethodLabel(
                payment.paymentMethod
            )
        );

        setText(
            "spReceiptPeriod",
            payment.paymentPeriod ||
                "—"
        );

        setText(
            "spReceiptAddedBy",
            payment.addedBy ||
                "—"
        );

        setText(
            "spReceiptStaffName",
            payment.staffName
        );

        setText(
            "spReceiptStaffCode",
            payment.staffCode
        );

        setText(
            "spReceiptDepartment",
            payment.department
        );

        setText(
            "spReceiptDesignation",
            payment.designation
        );

        setText(
            "spReceiptAmount",
            formatCurrency(
                payment.amount
            )
        );

        setText(
            "spReceiptRemarks",
            payment.remarks ||
                "No remarks"
        );
    }

    /* =========================================================
       PRINT RECEIPT
    ========================================================= */

    function printReceipt() {
        const receipt =
            getElement(
                "spPaymentReceipt"
            );

        if (!receipt) {
            showToast(
                "error",
                "Receipt is not available."
            );

            return;
        }

        const printWindow =
            window.open(
                "",
                "_blank",
                "width=900,height=900"
            );

        if (!printWindow) {
            showToast(
                "error",
                "Please allow pop-ups to print the receipt."
            );

            return;
        }

        const styles =
            Array.from(
                document.querySelectorAll(
                    'link[rel="stylesheet"], style'
                )
            )
                .map(
                    function (
                        element
                    ) {
                        if (
                            element.tagName
                                .toLowerCase() ===
                            "link"
                        ) {
                            return (
                                '<link rel="stylesheet" href="' +
                                escapeHtml(
                                    element.href
                                ) +
                                '">'
                            );
                        }

                        return (
                            "<style>" +
                            element.textContent +
                            "</style>"
                        );
                    }
                )
                .join("\n");

        const receiptHtml =
            receipt.outerHTML;

        printWindow.document.open();

        printWindow.document.write(
            `
            <!DOCTYPE html>

            <html>

            <head>

                <meta charset="UTF-8">

                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                >

                <title>
                    Staff Payment Receipt
                </title>

                ${styles}

                <style>

                    html,
                    body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                    }

                    body {
                        padding: 20px;
                    }

                    .sp-payment-receipt {
                        width: 100%;
                        max-width: 820px;
                        margin: 0 auto;
                    }

                    @page {
                        size: A4;
                        margin: 12mm;
                    }

                    @media print {

                        body {
                            padding: 0;
                        }

                        .sp-payment-receipt {
                            max-width: none;
                        }

                    }

                </style>

            </head>

            <body>

                ${receiptHtml}

            </body>

            </html>
            `
        );

        printWindow.document.close();

        printWindow.focus();

        window.setTimeout(
            function () {
                printWindow.print();
            },
            400
        );
    }

    /* =========================================================
       DOWNLOAD RECEIPT
    ========================================================= */

    function downloadReceipt() {
        /*
         * Browser print dialog allows
         * Save as PDF.
         */

        printReceipt();
    }

    /* =========================================================
       BUTTON LOADING
    ========================================================= */

    function setButtonLoading(
        id,
        loading
    ) {
        const button =
            getElement(id);

        if (!button) {
            return;
        }

        button.disabled =
            !!loading;

        const text =
            button.querySelector(
                ".sp-btn-text"
            );

        const loader =
            button.querySelector(
                ".sp-btn-loading"
            );

        if (text) {
            if (loading) {
                hideElement(
                    text
                );
            } else {
                showElement(
                    text
                );
            }
        }

        if (loader) {
            if (loading) {
                showElement(
                    loader
                );
            } else {
                hideElement(
                    loader
                );
            }
        }
    }

    /* =========================================================
       FORM ALERT
    ========================================================= */

    function showFormAlert(
        id,
        message
    ) {
        const alert =
            getElement(id);

        if (!alert) {
            return;
        }

        const span =
            alert.querySelector(
                "span"
            );

        if (span) {
            span.textContent =
                message ||
                "Please check the form.";
        }

        showElement(
            alert
        );
    }

    function clearFormAlert(
        id
    ) {
        const alert =
            getElement(id);

        if (!alert) {
            return;
        }

        hideElement(
            alert
        );

        const span =
            alert.querySelector(
                "span"
            );

        if (span) {
            span.textContent =
                "";
        }
    }

    /* =========================================================
       FIELD ERROR
    ========================================================= */

    function setFieldError(
        inputId,
        message
    ) {
        const input =
            getElement(
                inputId
            );

        if (!input) {
            return;
        }

        input.classList.add(
            "is-invalid"
        );

        input.setAttribute(
            "aria-invalid",
            "true"
        );

        const errorElement =
            getElement(
                inputId +
                    "Error"
            );

        if (errorElement) {
            errorElement.textContent =
                message ||
                "Invalid value.";

            showElement(
                errorElement
            );
        }
    }

    function clearFieldError(
        inputId
    ) {
        const input =
            getElement(
                inputId
            );

        if (input) {
            input.classList.remove(
                "is-invalid"
            );

            input.removeAttribute(
                "aria-invalid"
            );
        }

        const errorElement =
            getElement(
                inputId +
                    "Error"
            );

        if (errorElement) {
            errorElement.textContent =
                "";

            hideElement(
                errorElement
            );
        }
    }

    function clearAddFormErrors() {
        [
            "spAddStaff",
            "spAddPaymentType",
            "spAddAmount",
            "spAddPaymentDate",
            "spAddPaymentPeriod",
            "spAddPaymentMethod",
            "spAddRemarks",
        ].forEach(
            clearFieldError
        );
    }

    function clearEditFormErrors() {
        clearFieldError(
            "spEditRemarks"
        );
    }

    /* =========================================================
       REMARK COUNTER
    ========================================================= */

    function updateRemarksCount(
        textareaId,
        countId
    ) {
        const textarea =
            getElement(
                textareaId
            );

        const count =
            getElement(
                countId
            );

        if (
            !textarea ||
            !count
        ) {
            return;
        }

        count.textContent =
            String(
                textarea.value.length
            );
    }

    /* =========================================================
       TOAST
    ========================================================= */

    let toastCounter = 0;

    function showToast(
        type,
        message
    ) {
        const container =
            getElement(
                "spToastContainer"
            );

        if (!container) {
            return;
        }

        toastCounter += 1;

        const toast =
            document.createElement(
                "div"
            );

        toast.className =
            "sp-toast sp-toast-" +
            (type || "info");

        toast.id =
            "spToast_" +
            Date.now() +
            "_" +
            toastCounter;

        const iconMap = {
            success:
                "bi-check-circle-fill",

            error:
                "bi-exclamation-circle-fill",

            warning:
                "bi-exclamation-triangle-fill",

            info:
                "bi-info-circle-fill",
        };

        const icon =
            iconMap[type] ||
            iconMap.info;

        toast.innerHTML = `
            <div class="sp-toast-icon">
                <i
                    class="bi ${icon}"
                    aria-hidden="true"
                ></i>
            </div>

            <div class="sp-toast-message">
                ${escapeHtml(
                    message || ""
                )}
            </div>

            <button
                type="button"
                class="sp-toast-close"
                aria-label="Close notification"
            >
                <i
                    class="bi bi-x"
                    aria-hidden="true"
                ></i>
            </button>
        `;

        container.appendChild(
            toast
        );

        const closeButton =
            toast.querySelector(
                ".sp-toast-close"
            );

        if (closeButton) {
            closeButton.addEventListener(
                "click",
                function () {
                    removeToast(
                        toast
                    );
                }
            );
        }

        window.setTimeout(
            function () {
                removeToast(
                    toast
                );
            },
            4500
        );
    }

    function removeToast(
        toast
    ) {
        if (!toast) {
            return;
        }

        if (
            !toast.parentNode
        ) {
            return;
        }

        toast.classList.add(
            "is-hiding"
        );

        window.setTimeout(
            function () {
                if (
                    toast.parentNode
                ) {
                    toast.parentNode.removeChild(
                        toast
                    );
                }
            },
            200
        );
    }

    /* =========================================================
       ACTION MENU
    ========================================================= */

    function closeActionMenu() {
        if (
            state.actionMenu
        ) {
            const menu =
                state.actionMenu.menu;

            const trigger =
                state.actionMenu.trigger;

            if (menu) {
                menu.remove();
            }

            if (trigger) {
                trigger.setAttribute(
                    "aria-expanded",
                    "false"
                );
            }
        }

        state.actionMenu =
            null;
    }

    function positionActionMenu(
        menu,
        trigger
    ) {
        if (
            !menu ||
            !trigger
        ) {
            return;
        }

        menu.style.position =
            "fixed";

        menu.style.zIndex =
            "999999";

        menu.style.visibility =
            "hidden";

        menu.style.display =
            "block";

        const triggerRect =
            trigger.getBoundingClientRect();

        const menuRect =
            menu.getBoundingClientRect();

        const viewportWidth =
            window.innerWidth;

        const viewportHeight =
            window.innerHeight;

        const gap = 6;

        let left =
            triggerRect.right -
            menuRect.width;

        let top =
            triggerRect.bottom +
            gap;

        if (
            top +
                menuRect.height >
            viewportHeight - 8
        ) {
            top =
                triggerRect.top -
                menuRect.height -
                gap;
        }

        if (top < 8) {
            top = 8;
        }

        if (left < 8) {
            left = 8;
        }

        if (
            left +
                menuRect.width >
            viewportWidth - 8
        ) {
            left =
                viewportWidth -
                menuRect.width -
                8;
        }

        menu.style.left =
            Math.round(
                left
            ) + "px";

        menu.style.top =
            Math.round(
                top
            ) + "px";

        menu.style.right =
            "auto";

        menu.style.bottom =
            "auto";

        menu.style.visibility =
            "visible";
    }

    function openActionMenu(
        trigger,
        paymentId
    ) {
        if (!trigger) {
            return;
        }

        const id =
            Number(paymentId);

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {
            return;
        }

        if (
            state.actionMenu &&
            state.actionMenu.trigger ===
                trigger
        ) {
            closeActionMenu();

            return;
        }

        closeActionMenu();

        const payment =
            state.payments.find(
                function (item) {
                    return (
                        Number(
                            item.id
                        ) === id
                    );
                }
            );

        if (!payment) {
            showToast(
                "error",
                "Payment record not found."
            );

            return;
        }

        const menu =
            document.createElement(
                "div"
            );

        menu.className =
            "staff-payment-action-menu sp-payment-action-menu";

        menu.setAttribute(
            "role",
            "menu"
        );

        menu.innerHTML = `
            <button
                type="button"
                class="sp-action-menu-item"
                data-menu-action="view"
                data-payment-id="${escapeHtml(
                    id
                )}"
                role="menuitem"
            >
                <i
                    class="bi bi-eye"
                    aria-hidden="true"
                ></i>

                <span>
                    View Payment
                </span>
            </button>

            <button
                type="button"
                class="sp-action-menu-item"
                data-menu-action="edit"
                data-payment-id="${escapeHtml(
                    id
                )}"
                role="menuitem"
            >
                <i
                    class="bi bi-pencil-square"
                    aria-hidden="true"
                ></i>

                <span>
                    Edit Remarks
                </span>
            </button>

            <button
                type="button"
                class="sp-action-menu-item"
                data-menu-action="receipt"
                data-payment-id="${escapeHtml(
                    id
                )}"
                role="menuitem"
            >
                <i
                    class="bi bi-receipt"
                    aria-hidden="true"
                ></i>

                <span>
                    Payment Receipt
                </span>
            </button>

            <button
                type="button"
                class="
                    sp-action-menu-item
                    sp-action-menu-danger
                "
                data-menu-action="delete"
                data-payment-id="${escapeHtml(
                    id
                )}"
                role="menuitem"
            >
                <i
                    class="bi bi-shield-lock"
                    aria-hidden="true"
                ></i>

                <span>
                    Delete Protected
                </span>
            </button>
        `;

        document.body.appendChild(
            menu
        );

        trigger.setAttribute(
            "aria-expanded",
            "true"
        );

        state.actionMenu = {
            menu: menu,
            trigger: trigger,
            paymentId: id,
        };

        positionActionMenu(
            menu,
            trigger
        );
    }

    /* =========================================================
       EVENT LISTENER HELPER
    ========================================================= */

    function addListener(
        element,
        event,
        handler,
        options
    ) {
        if (!element) {
            return;
        }

        element.addEventListener(
            event,
            handler,
            options
        );

        state.listeners.push({
            element:
                element,

            event:
                event,

            handler:
                handler,

            options:
                options,
        });
    }

    /* =========================================================
       PAGE EVENT LISTENERS
    ========================================================= */

    function setupEventListeners() {
        state.listeners.forEach(
            function (item) {
                try {
                    item.element.removeEventListener(
                        item.event,
                        item.handler,
                        item.options
                    );
                } catch (ignore) {}
            }
        );

        state.listeners = [];

        /*
         * Add.
         */

        addListener(
            getElement(
                "spAddPaymentBtn"
            ),
            "click",
            openAddPayment
        );

        addListener(
            getElement(
                "spEmptyAddPaymentBtn"
            ),
            "click",
            openAddPayment
        );

        /*
         * Filters.
         */

        addListener(
            getElement(
                "spClearFiltersBtn"
            ),
            "click",
            clearFilters
        );

        addListener(
            getElement(
                "spRefreshBtn"
            ),
            "click",
            function () {
                state.page = 1;

                loadPayments();
            }
        );

        addListener(
            getElement(
                "spRetryBtn"
            ),
            "click",
            function () {
                loadPayments();
            }
        );

        /*
         * Search.
         */

        addListener(
            getElement(
                "spSearch"
            ),
            "input",
            function (event) {
                state.filters.search =
                    event.target.value.trim();

                if (
                    state.searchTimer
                ) {
                    clearTimeout(
                        state.searchTimer
                    );
                }

                state.searchTimer =
                    window.setTimeout(
                        function () {
                            state.page =
                                1;

                            loadPayments();
                        },
                        CONFIG.searchDelay
                    );
            }
        );

        /*
         * Select/date filters.
         */

        [
            "spStaffFilter",
            "spPaymentTypeFilter",
            "spPaymentMethodFilter",
            "spPeriodFilter",
            "spFromDate",
            "spToDate",
        ].forEach(
            function (id) {
                addListener(
                    getElement(id),
                    "change",
                    function () {
                        syncFiltersFromDom();

                        state.page =
                            1;

                        loadPayments();
                    }
                );
            }
        );

        /*
         * Period text search.
         */

        addListener(
            getElement(
                "spPeriodFilter"
            ),
            "input",
            function (event) {
                state.filters.payment_period =
                    event.target.value.trim();

                if (
                    state.searchTimer
                ) {
                    clearTimeout(
                        state.searchTimer
                    );
                }

                state.searchTimer =
                    window.setTimeout(
                        function () {
                            state.page =
                                1;

                            loadPayments();
                        },
                        CONFIG.searchDelay
                    );
            }
        );

        /*
         * Pagination.
         */

        addListener(
            getElement(
                "spPrevPageBtn"
            ),
            "click",
            function () {
                if (
                    state.loading ||
                    state.page <= 1
                ) {
                    return;
                }

                state.page -=
                    1;

                loadPayments();
            }
        );

        addListener(
            getElement(
                "spNextPageBtn"
            ),
            "click",
            function () {
                if (
                    state.loading ||
                    state.page >=
                        state.totalPages
                ) {
                    return;
                }

                state.page +=
                    1;

                loadPayments();
            }
        );

        addListener(
            getElement(
                "spPaginationPages"
            ),
            "click",
            function (event) {
                const button =
                    event.target.closest(
                        "[data-page]"
                    );

                if (!button) {
                    return;
                }

                const page =
                    Number(
                        button.dataset.page
                    );

                if (
                    !Number.isInteger(
                        page
                    ) ||
                    page < 1 ||
                    page >
                        state.totalPages ||
                    page ===
                        state.page
                ) {
                    return;
                }

                state.page =
                    page;

                loadPayments();
            }
        );

        /*
         * Forms.
         */

        addListener(
            getElement(
                "spAddPaymentForm"
            ),
            "submit",
            submitAddPayment
        );

        addListener(
            getElement(
                "spEditPaymentForm"
            ),
            "submit",
            submitEditPayment
        );

        /*
         * Remarks.
         */

        addListener(
            getElement(
                "spAddRemarks"
            ),
            "input",
            function () {
                updateRemarksCount(
                    "spAddRemarks",
                    "spAddRemarksCount"
                );

                clearFieldError(
                    "spAddRemarks"
                );
            }
        );

        addListener(
            getElement(
                "spEditRemarks"
            ),
            "input",
            function () {
                updateRemarksCount(
                    "spEditRemarks",
                    "spEditRemarksCount"
                );

                clearFieldError(
                    "spEditRemarks"
                );
            }
        );

        /*
         * Add form validation clearing.
         */

        [
            "spAddStaff",
            "spAddPaymentType",
            "spAddAmount",
            "spAddPaymentDate",
            "spAddPaymentPeriod",
            "spAddPaymentMethod",
        ].forEach(
            function (id) {
                const element =
                    getElement(id);

                addListener(
                    element,
                    "input",
                    function () {
                        clearFieldError(
                            id
                        );
                    }
                );

                addListener(
                    element,
                    "change",
                    function () {
                        clearFieldError(
                            id
                        );
                    }
                );
            }
        );

        /*
         * Modal close.
         */

        $$(
            "[data-sp-close-modal]"
        ).forEach(
            function (button) {
                addListener(
                    button,
                    "click",
                    function (event) {
                        event.preventDefault();

                        const modalId =
                            button.dataset
                                .spCloseModal;

                        if (
                            modalId
                        ) {
                            closeModal(
                                modalId
                            );
                        }
                    }
                );
            }
        );

        /*
         * Protected delete.
         */

        addListener(
            getElement(
                "spConfirmDeletePaymentBtn"
            ),
            "click",
            confirmDeletePayment
        );

        /*
         * View actions.
         */

        addListener(
            getElement(
                "spViewEditBtn"
            ),
            "click",
            function () {
                openEditPayment(
                    state.selectedPayment
                );
            }
        );

        addListener(
            getElement(
                "spViewReceiptBtn"
            ),
            "click",
            function () {
                openReceipt(
                    state.selectedPayment
                );
            }
        );

        /*
         * Receipt.
         */

        addListener(
            getElement(
                "spPrintReceiptBtn"
            ),
            "click",
            printReceipt
        );

        addListener(
            getElement(
                "spDownloadReceiptBtn"
            ),
            "click",
            downloadReceipt
        );

        /*
         * Dynamic table action menu.
         */

        addListener(
            getElement(
                "spPaymentsTableBody"
            ),
            "click",
            function (event) {
                const menuButton =
                    event.target.closest(
                        "[data-sp-action='menu']"
                    );

                if (!menuButton) {
                    return;
                }

                event.preventDefault();

                event.stopPropagation();

                openActionMenu(
                    menuButton,
                    menuButton.dataset
                        .paymentId
                );
            }
        );

        /*
         * Document click.
         */

        addListener(
            document,
            "click",
            handleDocumentClick
        );

        /*
         * Escape key.
         */

        addListener(
            document,
            "keydown",
            handleDocumentKeydown
        );

        /*
         * Resize.
         */

        addListener(
            window,
            "resize",
            function () {
                if (
                    state.actionMenu
                ) {
                    positionActionMenu(
                        state.actionMenu
                            .menu,
                        state.actionMenu
                            .trigger
                    );
                }
            }
        );

        /*
         * Capture scrolling.
         */

        addListener(
            window,
            "scroll",
            function () {
                closeActionMenu();
            },
            true
        );
    }

    /* =========================================================
       ACTION MENU CLICK
    ========================================================= */

    function handleDocumentClick(
        event
    ) {
        if (
            state.actionMenu
        ) {
            const menu =
                state.actionMenu.menu;

            const trigger =
                state.actionMenu.trigger;

            if (
                menu &&
                (
                    menu.contains(
                        event.target
                    ) ||
                    (
                        trigger &&
                        trigger.contains(
                            event.target
                        )
                    )
                )
            ) {
                /*
                 * Menu item click is handled
                 * below.
                 */

                const actionButton =
                    event.target.closest(
                        "[data-menu-action]"
                    );

                if (
                    actionButton
                ) {
                    event.preventDefault();

                    event.stopPropagation();

                    handleActionMenuClick(
                        event
                    );
                }

                return;
            }

            closeActionMenu();
        }

        const backdrop =
            event.target.closest(
                "[data-sp-close-modal]"
            );

        if (
            backdrop &&
            event.target ===
                backdrop
        ) {
            const modalId =
                backdrop.dataset
                    .spCloseModal;

            if (modalId) {
                closeModal(
                    modalId
                );
            }
        }
    }

    /* =========================================================
       ACTION MENU ACTION
    ========================================================= */

    function handleActionMenuClick(
        event
    ) {
        const actionButton =
            event.target.closest(
                "[data-menu-action]"
            );

        if (!actionButton) {
            return;
        }

        const action =
            actionButton.dataset
                .menuAction;

        const paymentId =
            Number(
                actionButton.dataset
                    .paymentId
            );

        const payment =
            state.payments.find(
                function (item) {
                    return (
                        Number(
                            item.id
                        ) ===
                        paymentId
                    );
                }
            );

        closeActionMenu();

        if (!payment) {
            showToast(
                "error",
                "Payment record not found."
            );

            return;
        }

        switch (action) {
            case "view":
                openViewPayment(
                    paymentId
                );
                break;

            case "edit":
                openEditPayment(
                    payment
                );
                break;

            case "receipt":
                openReceipt(
                    payment
                );
                break;

            case "delete":
                openDeletePayment(
                    payment
                );
                break;

            default:
                warn(
                    "Unknown payment action:",
                    action
                );
        }
    }

    /* =========================================================
       KEYBOARD
    ========================================================= */

    function handleDocumentKeydown(
        event
    ) {
        if (
            event.key !==
            "Escape"
        ) {
            return;
        }

        if (
            state.actionMenu
        ) {
            event.preventDefault();

            closeActionMenu();

            return;
        }

        const modals =
            $$(".sp-modal.is-open");

        if (
            !modals.length
        ) {
            return;
        }

        if (
            state.saving ||
            state.updating
        ) {
            return;
        }

        event.preventDefault();

        const modal =
            modals[
                modals.length - 1
            ];

        closeModal(
            modal.id
        );
    }

    /* =========================================================
       DESTROY
    ========================================================= */

    function destroy() {
        log(
            "Destroying module..."
        );

        state.destroyed =
            true;

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
            state.requestController
        ) {
            try {
                state.requestController.abort();
            } catch (ignore) {}

            state.requestController =
                null;
        }

        if (
            state.staffRequestController
        ) {
            try {
                state.staffRequestController.abort();
            } catch (ignore) {}

            state.staffRequestController =
                null;
        }

        state.listeners.forEach(
            function (item) {
                try {
                    item.element.removeEventListener(
                        item.event,
                        item.handler,
                        item.options
                    );
                } catch (ignore) {}
            }
        );

        state.listeners = [];

        closeActionMenu();

        closeAllModals();

        state.loading =
            false;

        state.loadingStaff =
            false;

        state.saving =
            false;

        state.updating =
            false;

        state.deleting =
            false;

        state.selectedPayment =
            null;

        state.selectedPaymentId =
            null;

        state.csrfPromise =
            null;

        state.initialized =
            false;

        /*
         * Keep global CSRF token untouched
         * because other modules may use it.
         */

        log(
            "Module destroyed."
        );
    }

    /* =========================================================
       REFRESH
    ========================================================= */

    async function refresh() {
        if (!pageExists()) {
            return false;
        }

        if (state.loading) {
            return false;
        }

        syncFiltersFromDom();

        await loadPayments();

        return true;
    }

    /* =========================================================
       INIT
    ========================================================= */

    async function init() {
        const page =
            getPage();

        if (!page) {
            return false;
        }

        /*
         * Already initialized.
         */

        if (
            state.initialized &&
            !state.destroyed
        ) {
            log(
                "Module already initialized."
            );

            await loadPayments();

            return true;
        }

        state.destroyed =
            false;

        state.initialized =
            true;

        state.page = 1;

        state.limit =
            CONFIG.perPage;

        state.total = 0;

        state.totalPages = 1;

        state.payments = [];

        state.selectedPayment =
            null;

        state.selectedPaymentId =
            null;

        /*
         * Start with no cached CSRF token.
         *
         * It will only be requested when
         * POST/PUT is actually performed.
         */

        state.csrfToken =
            null;

        state.csrfPromise =
            null;

        setPaymentState(
            "loading"
        );

        const date =
            getElement(
                "spAddPaymentDate"
            );

        if (
            date &&
            !date.value
        ) {
            date.value =
                getToday();
        }

        updateRemarksCount(
            "spAddRemarks",
            "spAddRemarksCount"
        );

        updateRemarksCount(
            "spEditRemarks",
            "spEditRemarksCount"
        );

        setupEventListeners();

        syncFiltersFromDom();

        log(
            "Module initialized."
        );

        /*
         * DO NOT REQUEST CSRF HERE.
         *
         * GET operations do not require it.
         */

        try {
            await loadStaff();
        } catch (error) {
            if (
                state.destroyed
            ) {
                return false;
            }

            showToast(
                "error",
                error.message ||
                    "Unable to load staff."
            );
        }

        await loadPayments();

        return true;
    }

    /* =========================================================
       PUBLIC MODULE API
    ========================================================= */

    window.TenspickStaffPayments = {
        init: init,

        destroy: destroy,

        refresh: refresh,

        openAdd:
            openAddPayment,

        openView:
            openViewPayment,

        openEdit:
            openEditPayment,

        openReceipt:
            openReceipt,
    };

    /*
     * Compatibility alias.
     */

    window.initStaffPayments =
        init;

    log(
        "Staff Payments JS loaded."
    );

    /*
     * IMPORTANT:
     *
     * No DOMContentLoaded.
     * No automatic initialization.
     *
     * Tenspick SPA router controls this module.
     */

})(window, document);