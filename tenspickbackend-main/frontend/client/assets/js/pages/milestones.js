/* ============================================================
 * TENSPICK CRM
 * CLIENT PORTAL — MILESTONES
 *
 * File:
 * assets/js/pages/milestones.js
 *
 * ============================================================
 *
 * BACKEND ENDPOINTS
 *
 * GET /api/client-portal/projects
 * GET /api/client-portal/projects/{id}/milestones
 *
 * ============================================================
 *
 * RULES
 *
 * - Client is identified by backend session.
 * - Never send client_id from frontend.
 * - Load real projects from backend.
 * - Load real milestones from backend.
 * - No fake milestone data.
 * - Project selection loads that project's milestones.
 * - Compatible with Client Router.
 *
 * ============================================================ */

(function () {

    "use strict";

    /* ========================================================
     * DEPENDENCY
     * ======================================================== */

    const API =
        window.TenspickClientAPI;


    /* ========================================================
     * STATE
     * ======================================================== */

    let root = null;

    let projects = [];

    let selectedProjectId = null;

    let selectedProject = null;

    let milestones = [];

    let initialized = false;

    let destroyed = false;

    let loadingProjects = false;

    let loadingMilestones = false;

    /*
     * Used to prevent an older milestone request from
     * replacing data belonging to a newly selected project.
     */
    let milestoneRequestId = 0;


    /* ========================================================
     * HELPERS
     * ======================================================== */

    function escapeHtml(value) {

        if (
            value === null ||
            value === undefined
        ) {
            return "";
        }


        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

    }


    function getValue(
        object,
        keys,
        fallback = ""
    ) {

        if (
            !object ||
            typeof object !== "object"
        ) {
            return fallback;
        }


        for (
            const key of keys
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    object,
                    key
                )
            ) {

                const value =
                    object[key];


                if (
                    value !== null &&
                    value !== undefined &&
                    String(value).trim() !== ""
                ) {

                    return value;

                }

            }

        }


        return fallback;

    }


    /* ========================================================
     * PROJECT HELPERS
     * ======================================================== */

    function getProjectId(
        project
    ) {

        return getValue(
            project,
            [
                "id",
                "project_id"
            ],
            ""
        );

    }


    function getProjectName(
        project
    ) {

        return getValue(
            project,
            [
                "project_name",
                "name",
                "title"
            ],
            "Untitled Project"
        );

    }


    function getProjectCode(
        project
    ) {

        return getValue(
            project,
            [
                "project_code",
                "code"
            ],
            ""
        );

    }


    function getProjectStatus(
        project
    ) {

        return getValue(
            project,
            [
                "status",
                "project_status"
            ],
            "Pending"
        );

    }


    /* ========================================================
     * STATUS
     * ======================================================== */

    function normalizeStatus(
        value
    ) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ");

    }


    function getStatusClass(
        status
    ) {

        const value =
            normalizeStatus(
                status
            );


        if (
            value.includes("complete") ||
            value.includes("completed") ||
            value.includes("delivered")
        ) {

            return "is-success";

        }


        if (
            value.includes("progress") ||
            value.includes("active") ||
            value.includes("ongoing") ||
            value.includes("working")
        ) {

            return "is-primary";

        }


        if (
            value.includes("hold") ||
            value.includes("paused")
        ) {

            return "is-warning";

        }


        if (
            value.includes("cancel") ||
            value.includes("reject")
        ) {

            return "is-danger";

        }


        return "is-neutral";

    }


    /* ========================================================
     * PROGRESS
     * ======================================================== */

    function normalizeProgress(
        value
    ) {

        const number =
            Number(value);


        if (
            !Number.isFinite(
                number
            )
        ) {

            return 0;

        }


        return Math.min(
            100,
            Math.max(
                0,
                number
            )
        );

    }


    function getMilestoneProgress(
        milestone
    ) {

        return normalizeProgress(
            getValue(
                milestone,
                [
                    "progress_percentage",
                    "progress",
                    "completion_percentage"
                ],
                0
            )
        );

    }


    /* ========================================================
     * DATE
     * ======================================================== */

    /*
     * Handles backend MySQL:
     *
     * YYYY-MM-DD
     *
     * YYYY-MM-DD HH:MM:SS
     *
     * without timezone shifting.
     */

    function formatDate(
        value
    ) {

        if (
            value === null ||
            value === undefined
        ) {

            return "—";

        }


        const raw =
            String(value).trim();


        if (!raw) {

            return "—";

        }


        /*
         * YYYY-MM-DD
         */
        const dateOnlyMatch =
            raw.match(
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
                );

            const day =
                Number(
                    dateOnlyMatch[3]
                );


            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                return date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );

            }

        }


        /*
         * YYYY-MM-DD HH:MM:SS
         */
        const dateTimeMatch =
            raw.match(
                /^(\d{4})-(\d{2})-(\d{2})[\sT]/
            );


        if (dateTimeMatch) {

            const year =
                Number(
                    dateTimeMatch[1]
                );

            const month =
                Number(
                    dateTimeMatch[2]
                );

            const day =
                Number(
                    dateTimeMatch[3]
                );


            const date =
                new Date(
                    year,
                    month - 1,
                    day
                );


            if (
                !Number.isNaN(
                    date.getTime()
                )
            ) {

                return date.toLocaleDateString(
                    "en-IN",
                    {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                    }
                );

            }

        }


        /*
         * Generic fallback.
         */
        const fallbackDate =
            new Date(raw);


        if (
            !Number.isNaN(
                fallbackDate.getTime()
            )
        ) {

            return fallbackDate.toLocaleDateString(
                "en-IN",
                {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );

        }


        return escapeHtml(raw);

    }


    /* ========================================================
     * API RESPONSE
     * ======================================================== */

    /*
     * TenspickClientAPI returns:
     *
     * {
     *     ok: true,
     *     status: 200,
     *     data: BACKEND_RESPONSE,
     *     response: Response
     * }
     *
     * Backend:
     *
     * {
     *     success: true,
     *     message: "...",
     *     data: {
     *         projects: []
     *     }
     * }
     */

    function getBackendResponse(
        apiResponse
    ) {

        if (!apiResponse) {

            return null;

        }


        if (
            apiResponse.data &&
            typeof apiResponse.data === "object"
        ) {

            return apiResponse.data;

        }


        return apiResponse;

    }


    function extractProjects(
        apiResponse
    ) {

        const backend =
            getBackendResponse(
                apiResponse
            );


        if (!backend) {

            return [];

        }


        /*
         * Normal response:
         *
         * data.projects
         */
        if (
            backend.data &&
            typeof backend.data === "object" &&
            Array.isArray(
                backend.data.projects
            )
        ) {

            return backend.data.projects;

        }


        /*
         * Alternative:
         *
         * projects
         */
        if (
            Array.isArray(
                backend.projects
            )
        ) {

            return backend.projects;

        }


        /*
         * Direct array.
         */
        if (
            Array.isArray(
                backend
            )
        ) {

            return backend;

        }


        return [];

    }


    function extractMilestones(
        apiResponse
    ) {

        const backend =
            getBackendResponse(
                apiResponse
            );


        if (!backend) {

            return [];

        }


        /*
         * Normal:
         *
         * data.milestones
         */
        if (
            backend.data &&
            typeof backend.data === "object"
        ) {

            if (
                Array.isArray(
                    backend.data.milestones
                )
            ) {

                return backend.data.milestones;

            }


            /*
             * data itself may be an array.
             */
            if (
                Array.isArray(
                    backend.data
                )
            ) {

                return backend.data;

            }

        }


        /*
         * Alternative:
         *
         * milestones
         */
        if (
            Array.isArray(
                backend.milestones
            )
        ) {

            return backend.milestones;

        }


        /*
         * Direct array.
         */
        if (
            Array.isArray(
                backend
            )
        ) {

            return backend;

        }


        return [];

    }


    /* ========================================================
     * LOADING
     * ======================================================== */

    function renderLoading() {

        if (!root) {

            return;

        }


        root.innerHTML = `

            <div
                class="client-milestones-page"
            >

                <div
                    class="client-page-heading"
                >

                    <div>

                        <span
                            class="client-eyebrow"
                        >
                            PROJECT TIMELINE
                        </span>

                        <h1>
                            Milestones
                        </h1>

                        <p>
                            Track important project milestones
                            and their current status.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        client-milestones-layout
                    "
                >

                    <!-- PROJECT SKELETON -->

                    <aside
                        class="
                            client-milestones-projects
                        "
                    >

                        <div
                            class="
                                client-milestones-project-header
                            "
                        >

                            <div>

                                <div
                                    class="client-skeleton"
                                    style="
                                        width:80px;
                                        height:10px;
                                        margin-bottom:8px;
                                    "
                                ></div>

                                <div
                                    class="client-skeleton"
                                    style="
                                        width:150px;
                                        height:20px;
                                    "
                                ></div>

                            </div>

                        </div>


                        <div
                            class="
                                client-milestones-project-list
                            "
                        >

                            ${Array
                                .from({
                                    length: 4
                                })
                                .map(
                                    () => `

                                        <div
                                            class="
                                                client-milestone-project-skeleton
                                            "
                                        >

                                            <div
                                                class="client-skeleton"
                                                style="
                                                    width:42px;
                                                    height:42px;
                                                    border-radius:10px;
                                                "
                                            ></div>


                                            <div
                                                style="
                                                    flex:1;
                                                "
                                            >

                                                <div
                                                    class="client-skeleton"
                                                    style="
                                                        width:55%;
                                                        height:9px;
                                                        margin-bottom:8px;
                                                    "
                                                ></div>

                                                <div
                                                    class="client-skeleton"
                                                    style="
                                                        width:80%;
                                                        height:13px;
                                                    "
                                                ></div>

                                            </div>

                                        </div>

                                    `
                                )
                                .join("")}

                        </div>

                    </aside>


                    <!-- CONTENT SKELETON -->

                    <main
                        class="
                            client-milestones-content
                        "
                    >

                        <div
                            class="client-skeleton"
                            style="
                                width:220px;
                                height:24px;
                                margin-bottom:12px;
                            "
                        ></div>


                        <div
                            class="client-skeleton"
                            style="
                                width:150px;
                                height:10px;
                                margin-bottom:28px;
                            "
                        ></div>


                        ${Array
                            .from({
                                length: 4
                            })
                            .map(
                                () => `

                                    <div
                                        class="client-skeleton"
                                        style="
                                            width:100%;
                                            height:100px;
                                            margin-bottom:12px;
                                            border-radius:14px;
                                        "
                                    ></div>

                                `
                            )
                            .join("")}

                    </main>

                </div>

            </div>

        `;

    }


    /* ========================================================
     * ERROR
     * ======================================================== */

    function renderError(
        message
    ) {

        if (!root) {

            return;

        }


        root.innerHTML = `

            <div
                class="client-milestones-page"
            >

                <div
                    class="client-page-heading"
                >

                    <div>

                        <span
                            class="client-eyebrow"
                        >
                            PROJECT TIMELINE
                        </span>

                        <h1>
                            Milestones
                        </h1>

                        <p>
                            Track important project milestones
                            and their current status.
                        </p>

                    </div>

                </div>


                <div
                    class="client-error-state"
                >

                    <div
                        class="client-error-icon"
                    >

                        <i
                            class="
                                bi
                                bi-exclamation-triangle
                            "
                        ></i>

                    </div>


                    <h2>
                        Unable to Load Milestones
                    </h2>


                    <p>
                        ${escapeHtml(
                            message ||
                            "Milestones could not be loaded."
                        )}
                    </p>


                    <button
                        type="button"
                        class="
                            client-btn
                            client-btn-primary
                        "
                        data-milestone-action="retry"
                    >

                        <i
                            class="
                                bi
                                bi-arrow-clockwise
                            "
                        ></i>

                        Try Again

                    </button>

                </div>

            </div>

        `;


        bindEvents();

    }


    /* ========================================================
     * EMPTY PROJECTS
     * ======================================================== */

    function renderEmpty() {

        if (!root) {

            return;

        }


        root.innerHTML = `

            <div
                class="client-milestones-page"
            >

                <div
                    class="client-page-heading"
                >

                    <div>

                        <span
                            class="client-eyebrow"
                        >
                            PROJECT TIMELINE
                        </span>

                        <h1>
                            Milestones
                        </h1>

                        <p>
                            Track important project milestones
                            and their current status.
                        </p>

                    </div>

                </div>


                <div
                    class="client-empty-state"
                >

                    <div
                        class="client-empty-icon"
                    >

                        <i
                            class="
                                bi
                                bi-flag
                            "
                        ></i>

                    </div>


                    <h2>
                        No Projects Available
                    </h2>


                    <p>
                        There are no projects available
                        to display milestones.
                    </p>

                </div>

            </div>

        `;

    }


    /* ========================================================
     * PROJECT LIST
     * ======================================================== */

    function renderProjectList() {

        return `

            <aside
                class="
                    client-milestones-projects
                "
            >

                <div
                    class="
                        client-milestones-project-header
                    "
                >

                    <div>

                        <span
                            class="
                                client-eyebrow
                            "
                        >
                            PROJECTS
                        </span>


                        <h2>
                            Select Project
                        </h2>

                    </div>


                    <span
                        class="
                            client-detail-count
                        "
                    >
                        ${projects.length}
                    </span>

                </div>


                <div
                    class="
                        client-milestones-project-list
                    "
                >

                    ${projects
                        .map(
                            function (
                                project
                            ) {

                                const id =
                                    String(
                                        getProjectId(
                                            project
                                        )
                                    );


                                const active =
                                    String(
                                        selectedProjectId
                                    ) === id;


                                return `

                                    <button
                                        type="button"
                                        class="
                                            client-milestone-project-item
                                            ${
                                                active
                                                    ? "is-active"
                                                    : ""
                                            }
                                        "
                                        data-milestone-action="select"
                                        data-project-id="${escapeHtml(
                                            id
                                        )}"
                                    >

                                        <span
                                            class="
                                                client-milestone-project-icon
                                            "
                                        >

                                            <i
                                                class="
                                                    bi
                                                    bi-folder2
                                                "
                                            ></i>

                                        </span>


                                        <span
                                            class="
                                                client-milestone-project-info
                                            "
                                        >

                                            ${
                                                getProjectCode(
                                                    project
                                                )
                                                    ? `
                                                        <small>
                                                            ${escapeHtml(
                                                                getProjectCode(
                                                                    project
                                                                )
                                                            )}
                                                        </small>
                                                    `
                                                    : ""
                                            }


                                            <strong>
                                                ${escapeHtml(
                                                    getProjectName(
                                                        project
                                                    )
                                                )}
                                            </strong>

                                        </span>


                                        <i
                                            class="
                                                bi
                                                bi-chevron-right
                                            "
                                        ></i>

                                    </button>

                                `;

                            }
                        )
                        .join("")}

                </div>

            </aside>

        `;

    }


    /* ========================================================
     * MILESTONE ITEM
     * ======================================================== */

    function renderMilestone(
        milestone,
        index
    ) {

        const title =
            getValue(
                milestone,
                [
                    "milestone_name",
                    "name",
                    "title"
                ],
                "Milestone " +
                (index + 1)
            );


        const description =
            getValue(
                milestone,
                [
                    "description",
                    "milestone_description"
                ],
                ""
            );


        const status =
            getValue(
                milestone,
                [
                    "status",
                    "milestone_status"
                ],
                "Pending"
            );


        const progress =
            getMilestoneProgress(
                milestone
            );


        /*
         * Actual backend milestone fields:
         *
         * start_date
         * expected_completion
         */
        const startDate =
            getValue(
                milestone,
                [
                    "start_date",
                    "milestone_start_date"
                ],
                ""
            );


        const endDate =
            getValue(
                milestone,
                [
                    "expected_completion",
                    "expected_completion_date",
                    "due_date",
                    "expected_date",
                    "completion_date",
                    "end_date"
                ],
                ""
            );


        const completedAt =
            getValue(
                milestone,
                [
                    "completed_at"
                ],
                ""
            );


        return `

            <article
                class="
                    client-milestone-card
                "
            >

                <!-- MARKER -->

                <div
                    class="
                        client-milestone-card-marker
                    "
                >

                    <span>

                        ${
                            progress >= 100
                                ? `
                                    <i
                                        class="
                                            bi
                                            bi-check-lg
                                        "
                                    ></i>
                                `
                                : index + 1
                        }

                    </span>

                </div>


                <!-- BODY -->

                <div
                    class="
                        client-milestone-card-body
                    "
                >

                    <div
                        class="
                            client-milestone-card-heading
                        "
                    >

                        <div>

                            <span
                                class="
                                    client-milestone-number
                                "
                            >
                                Milestone ${index + 1}
                            </span>


                            <h3>
                                ${escapeHtml(
                                    title
                                )}
                            </h3>

                        </div>


                        <span
                            class="
                                client-status-badge
                                ${getStatusClass(status)}
                            "
                        >
                            ${escapeHtml(status)}
                        </span>

                    </div>


                    ${
                        description
                            ? `
                                <p
                                    class="
                                        client-milestone-card-description
                                    "
                                >
                                    ${escapeHtml(
                                        description
                                    )}
                                </p>
                            `
                            : ""
                    }


                    <!-- PROGRESS -->

                    <div
                        class="
                            client-milestone-card-progress
                        "
                    >

                        <div
                            class="
                                client-milestone-progress-top
                            "
                        >

                            <span>
                                Progress
                            </span>


                            <strong>
                                ${progress}%
                            </strong>

                        </div>


                        <div
                            class="
                                client-progress-track
                            "
                        >

                            <span
                                class="
                                    client-progress-value
                                "
                                style="
                                    width:${progress}%;
                                "
                            ></span>

                        </div>

                    </div>


                    <!-- DATES -->

                    ${
                        startDate ||
                        endDate
                            ? `
                                <div
                                    class="
                                        client-milestone-card-dates
                                    "
                                >

                                    ${
                                        startDate
                                            ? `
                                                <span>

                                                    <i
                                                        class="
                                                            bi
                                                            bi-calendar-event
                                                        "
                                                    ></i>

                                                    <small>
                                                        Start
                                                    </small>

                                                    <strong>
                                                        ${formatDate(
                                                            startDate
                                                        )}
                                                    </strong>

                                                </span>
                                            `
                                            : ""
                                    }


                                    ${
                                        endDate
                                            ? `
                                                <span>

                                                    <i
                                                        class="
                                                            bi
                                                            bi-calendar-check
                                                        "
                                                    ></i>

                                                    <small>
                                                        End
                                                    </small>

                                                    <strong>
                                                        ${formatDate(
                                                            endDate
                                                        )}
                                                    </strong>

                                                </span>
                                            `
                                            : ""
                                    }

                                </div>
                            `
                            : ""
                    }


                    <!-- FOOTER -->

                    <div
                        class="
                            client-milestone-card-footer
                        "
                    >

                        ${
                            completedAt
                                ? `
                                    <span>

                                        <i
                                            class="
                                                bi
                                                bi-check-circle
                                            "
                                        ></i>

                                        Completed
                                        ${formatDate(
                                            completedAt
                                        )}

                                    </span>
                                `
                                : `
                                    <span>

                                        <i
                                            class="
                                                bi
                                                bi-clock
                                            "
                                        ></i>

                                        ${
                                            progress >= 100
                                                ? "Completed"
                                                : "In Progress"
                                        }

                                    </span>
                                `
                        }

                    </div>

                </div>

            </article>

        `;

    }


    /* ========================================================
     * MILESTONE CONTENT
     * ======================================================== */

    function renderContent() {

        if (
            !selectedProject
        ) {

            return `

                <main
                    class="
                        client-milestones-content
                    "
                >

                    <div
                        class="
                            client-progress-no-selection
                        "
                    >

                        <div>

                            <i
                                class="
                                    bi
                                    bi-flag
                                "
                            ></i>

                        </div>


                        <h2>
                            Select a Project
                        </h2>


                        <p>
                            Select a project to view
                            its milestones.
                        </p>

                    </div>

                </main>

            `;

        }


        return `

            <main
                class="
                    client-milestones-content
                "
            >

                <div
                    class="
                        client-milestones-content-header
                    "
                >

                    <div>

                        <span
                            class="
                                client-eyebrow
                            "
                        >
                            PROJECT MILESTONES
                        </span>


                        <h2>
                            ${escapeHtml(
                                getProjectName(
                                    selectedProject
                                )
                            )}
                        </h2>


                        ${
                            getProjectCode(
                                selectedProject
                            )
                                ? `
                                    <span
                                        class="
                                            client-project-code
                                        "
                                    >
                                        ${escapeHtml(
                                            getProjectCode(
                                                selectedProject
                                            )
                                        )}
                                    </span>
                                `
                                : ""
                        }

                    </div>


                    <span
                        class="
                            client-detail-count
                        "
                    >
                        ${milestones.length}
                    </span>

                </div>


                ${
                    loadingMilestones
                        ? `
                            <div
                                class="
                                    client-milestones-loading-inline
                                "
                            >

                                ${Array
                                    .from({
                                        length: 3
                                    })
                                    .map(
                                        () => `

                                            <div
                                                class="client-skeleton"
                                                style="
                                                    width:100%;
                                                    height:100px;
                                                    margin-bottom:12px;
                                                    border-radius:14px;
                                                "
                                            ></div>

                                        `
                                    )
                                    .join("")}

                            </div>
                        `
                        : milestones.length
                            ? `
                                <div
                                    class="
                                        client-milestone-list
                                    "
                                >

                                    ${milestones
                                        .map(
                                            (
                                                milestone,
                                                index
                                            ) =>
                                                renderMilestone(
                                                    milestone,
                                                    index
                                                )
                                        )
                                        .join("")}

                                </div>
                            `
                            : `
                                <div
                                    class="
                                        client-detail-empty
                                    "
                                >

                                    <div>

                                        <i
                                            class="
                                                bi
                                                bi-flag
                                            "
                                        ></i>

                                    </div>


                                    <h4>
                                        No Milestones Available
                                    </h4>


                                    <p>
                                        Milestones for this
                                        project will appear here.
                                    </p>

                                </div>
                            `
                }

            </main>

        `;

    }


    /* ========================================================
     * MAIN RENDER
     * ======================================================== */

    function render() {

        if (
            !root ||
            destroyed
        ) {

            return;

        }


        if (!projects.length) {

            renderEmpty();

            return;

        }


        /*
         * Ensure selected project exists.
         */
        const found =
            projects.find(
                function (
                    project
                ) {

                    return String(
                        getProjectId(
                            project
                        )
                    ) === String(
                        selectedProjectId
                    );

                }
            );


        if (!found) {

            selectedProjectId =
                getProjectId(
                    projects[0]
                );

            selectedProject =
                projects[0];

        }


        root.innerHTML = `

            <div
                class="
                    client-milestones-page
                "
            >

                <div
                    class="
                        client-page-heading
                    "
                >

                    <div>

                        <span
                            class="
                                client-eyebrow
                            "
                        >
                            PROJECT TIMELINE
                        </span>


                        <h1>
                            Milestones
                        </h1>


                        <p>
                            Track important project milestones
                            and their current status.
                        </p>

                    </div>

                </div>


                <div
                    class="
                        client-milestones-layout
                    "
                >

                    ${renderProjectList()}

                    ${renderContent()}

                </div>

            </div>

        `;


        bindEvents();

    }


    /* ========================================================
     * LOAD MILESTONES
     * ======================================================== */

    async function loadMilestones() {

        if (
            destroyed ||
            !root ||
            !selectedProjectId
        ) {

            return;

        }


        if (
            !API ||
            typeof API.get !== "function"
        ) {

            renderError(
                "Client API service is not available."
            );

            return;

        }


        const requestId =
            ++milestoneRequestId;


        loadingMilestones =
            true;


        /*
         * Show selected project immediately with
         * loading skeleton in the milestone area.
         */
        render();


        try {

            const response =
                await API.get(
                    "/client-portal/projects/" +
                    encodeURIComponent(
                        selectedProjectId
                    ) +
                    "/milestones"
                );


            /*
             * Ignore an old response.
             */
            if (
                requestId !==
                milestoneRequestId
            ) {

                return;

            }


            milestones =
                extractMilestones(
                    response
                );


            console.log(
                "[Tenspick Client Milestones] Loaded:",
                milestones
            );


            if (
                !destroyed &&
                root
            ) {

                render();

            }

        } catch (error) {

            if (
                requestId !==
                milestoneRequestId
            ) {

                return;

            }


            console.error(
                "[Tenspick Client Milestones] " +
                "Failed to load milestones:",
                error
            );


            milestones = [];


            if (
                !destroyed &&
                root
            ) {

                render();


                const content =
                    root.querySelector(
                        ".client-milestones-content"
                    );


                if (content) {

                    const errorElement =
                        document.createElement(
                            "div"
                        );


                    errorElement.className =
                        "client-inline-error";


                    errorElement.innerHTML = `
                        <i
                            class="
                                bi
                                bi-exclamation-circle
                            "
                        ></i>

                        Unable to load milestone
                        information.
                    `;


                    content.prepend(
                        errorElement
                    );

                }

            }

        } finally {

            if (
                requestId ===
                milestoneRequestId
            ) {

                loadingMilestones =
                    false;

            }

        }

    }


    /* ========================================================
     * SELECT PROJECT
     * ======================================================== */

    async function selectProject(
        id
    ) {

        if (
            destroyed ||
            !id
        ) {

            return;

        }


        const project =
            projects.find(
                function (
                    item
                ) {

                    return String(
                        getProjectId(
                            item
                        )
                    ) === String(id);

                }
            );


        if (!project) {

            console.warn(
                "[Tenspick Client Milestones] " +
                "Project not found:",
                id
            );

            return;

        }


        /*
         * Invalidate old milestone request.
         */
        milestoneRequestId++;


        selectedProjectId =
            String(id);


        selectedProject =
            project;


        milestones = [];


        /*
         * Render selected project immediately.
         */
        render();


        /*
         * Load real milestone data.
         */
        await loadMilestones();

    }


    /* ========================================================
     * LOAD PROJECTS
     * ======================================================== */

    async function loadProjects() {

        if (
            destroyed ||
            !root ||
            loadingProjects
        ) {

            return;

        }


        if (
            !API ||
            typeof API.get !== "function"
        ) {

            renderError(
                "Client API service is not available."
            );

            return;

        }


        loadingProjects =
            true;


        renderLoading();


        try {

            /*
             * Existing client portal endpoint.
             *
             * client_id is NOT sent.
             */
            const response =
                await API.get(
                    "/client-portal/projects"
                );


            projects =
                extractProjects(
                    response
                );


            /*
             * No projects.
             */
            if (!projects.length) {

                selectedProjectId =
                    null;

                selectedProject =
                    null;

                milestones = [];

                render();

                return;

            }


            /*
             * Preserve selected project during refresh
             * if it still exists.
             */
            let selected =
                projects.find(
                    function (
                        project
                    ) {

                        return String(
                            getProjectId(
                                project
                            )
                        ) === String(
                            selectedProjectId
                        );

                    }
                );


            /*
             * Otherwise select first project.
             */
            if (!selected) {

                selected =
                    projects[0];

                selectedProjectId =
                    getProjectId(
                        selected
                    );

            }


            selectedProject =
                selected;


            milestones = [];


            /*
             * Render project list.
             */
            render();


            /*
             * Load selected project's milestones.
             */
            await loadMilestones();

        } catch (error) {

            console.error(
                "[Tenspick Client Milestones] " +
                "Failed to load projects:",
                error
            );


            if (
                !destroyed &&
                root
            ) {

                renderError(
                    error?.message ||
                    "Unable to load projects."
                );

            }

        } finally {

            loadingProjects =
                false;

        }

    }


    /* ========================================================
     * EVENTS
     * ======================================================== */

    function bindEvents() {

        if (!root) {

            return;

        }


        root
            .querySelectorAll(
                "[data-milestone-action]"
            )
            .forEach(
                function (
                    button
                ) {

                    button.addEventListener(
                        "click",
                        handleAction
                    );

                }
            );

    }


    async function handleAction(
        event
    ) {

        const button =
            event.currentTarget;


        const action =
            button.getAttribute(
                "data-milestone-action"
            );


        /*
         * RETRY
         */
        if (
            action === "retry"
        ) {

            await loadProjects();

            return;

        }


        /*
         * PROJECT SELECT
         */
        if (
            action === "select"
        ) {

            const id =
                button.getAttribute(
                    "data-project-id"
                );


            if (!id) {

                return;

            }


            await selectProject(
                id
            );

        }

    }


    /* ========================================================
     * PUBLIC MODULE
     * ======================================================== */

    window.TenspickClientMilestones = {

        /*
         * Router entry.
         */
        async init(
            container
        ) {

            root =
                container;

            initialized =
                true;

            destroyed =
                false;

            loadingProjects =
                false;

            loadingMilestones =
                false;

            projects = [];

            selectedProjectId =
                null;

            selectedProject =
                null;

            milestones = [];

            milestoneRequestId =
                0;


            await loadProjects();


            return true;

        },


        /*
         * Router cleanup.
         */
        destroy() {

            destroyed =
                true;


            /*
             * Invalidate pending requests.
             */
            milestoneRequestId++;


            root =
                null;

            projects = [];

            selectedProjectId =
                null;

            selectedProject =
                null;

            milestones = [];


            initialized =
                false;

            loadingProjects =
                false;

            loadingMilestones =
                false;

        },


        /*
         * Manual refresh.
         */
        async refresh() {

            if (
                !initialized ||
                destroyed ||
                !root
            ) {

                return false;

            }


            await loadProjects();


            return true;

        },


        /*
         * Optional getters.
         */
        getProjects() {

            return [
                ...projects
            ];

        },


        getSelectedProject() {

            return selectedProject;

        },


        getSelectedProjectId() {

            return selectedProjectId;

        },


        getMilestones() {

            return [
                ...milestones
            ];

        }

    };


})();