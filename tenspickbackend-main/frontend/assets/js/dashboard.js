/* ============================================================
   TENSPICK CRM
   DASHBOARD JS
   ============================================================ */

(function (window, document) {

    "use strict";


    const Dashboard = {

        initialized: false,

        quickButton: null,

        quickPanel: null,


        /* ====================================================
           INITIALIZE
           ==================================================== */

        init: function () {

            /*
             * Dashboard pages are loaded through the SPA router.
             *
             * Therefore this function can safely be called
             * every time the Dashboard page is loaded.
             */

            this.quickButton =
                document.getElementById(
                    "dashboardQuickAction"
                );


            this.quickPanel =
                document.getElementById(
                    "dashboardQuickPanel"
                );


            this.bindQuickAction();

            this.bindActionButtons();

            this.loadAnnouncements();

            this.loadLiveStats();

            this.initialized = true;

        },

        loadLiveStats: async function () {
            const leadsEl = document.getElementById("dashTotalLeadsCount");
            const clientsEl = document.getElementById("dashTotalClientsCount");
            const projectsEl = document.getElementById("dashTotalProjectsCount");
            const pendingEl = document.getElementById("dashPendingPaymentsCount");

            let totalLeads = 0;
            let totalClients = 0;
            let totalProjects = 0;
            let pendingAmount = 0;

            let projectList = [];
            let taskList = [];
            let leadList = [];
            let clientList = [];

            // 1. Load from Supabase if configured
            let clientPaymentsList = [];
            let staffPaymentsList = [];
            let expensesList = [];

            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const [leadsRes, clientsRes, projectsRes, clientPaymentsRes, staffPaymentsRes, expensesRes, tasksRes] = await Promise.all([
                        sb.from('leads').select('*').order('created_at', { ascending: false }),
                        sb.from('clients').select('*'),
                        sb.from('projects').select('*'),
                        sb.from('client_payments').select('*'),
                        sb.from('staff_payments').select('*'),
                        sb.from('expenses').select('*'),
                        sb.from('tasks').select('*')
                    ]);

                    if (leadsRes.data && Array.isArray(leadsRes.data)) leadList = leadsRes.data;
                    if (clientsRes.data && Array.isArray(clientsRes.data)) clientList = clientsRes.data;
                    if (projectsRes.data && Array.isArray(projectsRes.data)) projectList = projectsRes.data;
                    if (clientPaymentsRes.data && Array.isArray(clientPaymentsRes.data)) clientPaymentsList = clientPaymentsRes.data;
                    if (staffPaymentsRes.data && Array.isArray(staffPaymentsRes.data)) staffPaymentsList = staffPaymentsRes.data;
                    if (expensesRes.data && Array.isArray(expensesRes.data)) expensesList = expensesRes.data;
                    if (tasksRes.data && Array.isArray(tasksRes.data)) taskList = tasksRes.data;
                } catch (e) {
                    console.warn("Supabase live stats note:", e);
                }
            }

            // 2. Merge with LocalStorage to avoid missing offline/local additions
            try {
                const lsLeads = JSON.parse(localStorage.getItem("tenspick_leads") || "[]");
                if (Array.isArray(lsLeads)) {
                    const existingIds = new Set(leadList.map(l => String(l.id)));
                    lsLeads.forEach(l => { if (!existingIds.has(String(l.id))) leadList.push(l); });
                }
            } catch (e) {}

            try {
                const lsClients = JSON.parse(localStorage.getItem("tenspick_clients") || "[]");
                if (Array.isArray(lsClients)) {
                    const existingIds = new Set(clientList.map(c => String(c.id)));
                    lsClients.forEach(c => { if (!existingIds.has(String(c.id))) clientList.push(c); });
                }
            } catch (e) {}

            try {
                const lsProjects = JSON.parse(localStorage.getItem("tenspick_projects") || "[]");
                if (Array.isArray(lsProjects)) {
                    const existingIds = new Set(projectList.map(p => String(p.id)));
                    lsProjects.forEach(p => { if (!existingIds.has(String(p.id))) projectList.push(p); });
                }
            } catch (e) {}

            try {
                const lsClientPay = JSON.parse(localStorage.getItem("tenspick_client_payments") || "[]");
                if (Array.isArray(lsClientPay)) {
                    const existingIds = new Set(clientPaymentsList.map(p => String(p.id)));
                    lsClientPay.forEach(p => { if (!existingIds.has(String(p.id))) clientPaymentsList.push(p); });
                }
            } catch (e) {}

            try {
                const lsStaffPay = JSON.parse(localStorage.getItem("tenspick_staff_payments") || "[]");
                if (Array.isArray(lsStaffPay)) {
                    const existingIds = new Set(staffPaymentsList.map(p => String(p.id)));
                    lsStaffPay.forEach(p => { if (!existingIds.has(String(p.id))) staffPaymentsList.push(p); });
                }
            } catch (e) {}

            try {
                const lsExp = JSON.parse(localStorage.getItem("tenspick_expenses") || "[]");
                if (Array.isArray(lsExp)) {
                    const existingIds = new Set(expensesList.map(x => String(x.id)));
                    lsExp.forEach(x => { if (!existingIds.has(String(x.id))) expensesList.push(x); });
                }
            } catch (e) {}

            try {
                const lsTasks = JSON.parse(localStorage.getItem("tenspick_tasks") || "[]");
                if (Array.isArray(lsTasks)) {
                    const existingIds = new Set(taskList.map(t => String(t.id)));
                    lsTasks.forEach(t => { if (!existingIds.has(String(t.id))) taskList.push(t); });
                }
            } catch (e) {}

            totalLeads = leadList.length;
            totalClients = clientList.length;
            totalProjects = projectList.length;

            // Calculate pending payments dynamically across projects
            pendingAmount = projectList.reduce((sum, p) => {
                const total = Number(p.budget || p.amount_quoted || 0);
                const discount = Number(p.discount_amount || 0);
                const paid = Number(p.amount_received || 0) + ((p.payments || []).reduce((s, x) => s + (Number(x.amount) || 0), 0));
                const remaining = Math.max(0, total - discount - paid);
                return sum + remaining;
            }, 0);

            // Calculate Financial Totals
            const totalRevenue = clientPaymentsList.reduce((sum, cp) => sum + (Number(cp.amount) || 0), 0);
            const totalStaffSalaries = staffPaymentsList.reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
            const totalExpenses = expensesList.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
            const netProfit = totalRevenue - totalStaffSalaries - totalExpenses;

            if (leadsEl) leadsEl.textContent = totalLeads;
            if (clientsEl) clientsEl.textContent = totalClients;
            if (projectsEl) projectsEl.textContent = totalProjects;
            if (pendingEl) pendingEl.textContent = '₹' + pendingAmount.toLocaleString('en-IN');

            // Finance Dashboard Summary Update
            const finRevEl = document.getElementById("dashFinTotalRevenue");
            const finPenEl = document.getElementById("dashFinPendingRevenue");
            const finSalEl = document.getElementById("dashFinStaffSalaries");
            const finExpEl = document.getElementById("dashFinExpenses");
            const finProfEl = document.getElementById("dashFinNetProfit");

            if (finRevEl) finRevEl.textContent = '₹' + totalRevenue.toLocaleString('en-IN');
            if (finPenEl) finPenEl.textContent = '₹' + pendingAmount.toLocaleString('en-IN');
            if (finSalEl) finSalEl.textContent = '₹' + totalStaffSalaries.toLocaleString('en-IN');
            if (finExpEl) finExpEl.textContent = '₹' + totalExpenses.toLocaleString('en-IN');
            if (finProfEl) finProfEl.textContent = '₹' + netProfit.toLocaleString('en-IN');

            // Render Clients Dashboard Summary Table
            const clientsTableBody = document.getElementById("dashClientsSummaryTableBody");
            if (clientsTableBody) {
                const displayClients = clientList.slice(0, 5);
                if (!displayClients.length) {
                    clientsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#9CA3AF;">No clients registered yet.</td></tr>`;
                } else {
                    clientsTableBody.innerHTML = displayClients.map(c => {
                        const clientProjects = projectList.filter(p => String(p.client_id) === String(c.id) || p.client_name === c.name || p.client_name === c.client_name);
                        const clientTotalBilled = clientProjects.reduce((sum, p) => sum + (Number(p.budget || p.amount_quoted || 0)), 0);
                        return `
                            <tr>
                                <td><strong>${c.name || c.client_name || 'Unnamed Client'}</strong></td>
                                <td>${c.company || c.company_name || '—'}</td>
                                <td>
                                    <div>${c.email || '—'}</div>
                                    <small style="color:#6B7280;">${c.phone || c.phone_number || ''}</small>
                                </td>
                                <td><span class="dashboard-status blue">${clientProjects.length} Projects</span></td>
                                <td><strong>₹${clientTotalBilled.toLocaleString('en-IN')}</strong></td>
                                <td><a href="#/clients" class="dashboard-more-btn">Manage</a></td>
                            </tr>
                        `;
                    }).join('');
                }
            }

            /* ====================================================
               PROJECT OVERVIEW BREAKDOWN
               ==================================================== */
            const projDonutEl = document.getElementById("dashTotalProjectsDonutCount");
            const projNotStartedCountEl = document.getElementById("dashProjNotStartedCount");
            const projNotStartedPctEl = document.getElementById("dashProjNotStartedPct");
            const projInProgressCountEl = document.getElementById("dashProjInProgressCount");
            const projInProgressPctEl = document.getElementById("dashProjInProgressPct");
            const projOnHoldCountEl = document.getElementById("dashProjOnHoldCount");
            const projOnHoldPctEl = document.getElementById("dashProjOnHoldPct");
            const projCompletedCountEl = document.getElementById("dashProjCompletedCount");
            const projCompletedPctEl = document.getElementById("dashProjCompletedPct");

            let pNotStarted = projectList.filter(p => p.status === 'not_started' || p.status === 'planning').length;
            let pInProgress = projectList.filter(p => p.status === 'in_progress' || p.status === 'review' || p.status === 'client_review').length;
            let pOnHold = projectList.filter(p => p.status === 'on_hold').length;
            let pCompleted = projectList.filter(p => p.status === 'completed').length;

            const pTotal = projectList.length > 0 ? projectList.length : (pNotStarted + pInProgress + pOnHold + pCompleted);
            const calcTotal = Math.max(1, pTotal);

            if (projDonutEl) projDonutEl.textContent = pTotal;
            if (projNotStartedCountEl) projNotStartedCountEl.textContent = pNotStarted;
            if (projNotStartedPctEl) projNotStartedPctEl.textContent = ((pNotStarted / calcTotal) * 100).toFixed(2) + "%";
            if (projInProgressCountEl) projInProgressCountEl.textContent = pInProgress;
            if (projInProgressPctEl) projInProgressPctEl.textContent = ((pInProgress / calcTotal) * 100).toFixed(2) + "%";
            if (projOnHoldCountEl) projOnHoldCountEl.textContent = pOnHold;
            if (projOnHoldPctEl) projOnHoldPctEl.textContent = ((pOnHold / calcTotal) * 100).toFixed(2) + "%";
            if (projCompletedCountEl) projCompletedCountEl.textContent = pCompleted;
            if (projCompletedPctEl) projCompletedPctEl.textContent = ((pCompleted / calcTotal) * 100).toFixed(2) + "%";

            /* ====================================================
               TASKS OVERVIEW BREAKDOWN
               ==================================================== */
            const taskDonutEl = document.getElementById("dashTotalTasksDonutCount");
            const taskOverdueCountEl = document.getElementById("dashTaskOverdueCount");
            const taskOverduePctEl = document.getElementById("dashTaskOverduePct");
            const taskInProgressCountEl = document.getElementById("dashTaskInProgressCount");
            const taskInProgressPctEl = document.getElementById("dashTaskInProgressPct");
            const taskToDoCountEl = document.getElementById("dashTaskToDoCount");
            const taskToDoPctEl = document.getElementById("dashTaskToDoPct");
            const taskCompletedCountEl = document.getElementById("dashTaskCompletedCount");
            const taskCompletedPctEl = document.getElementById("dashTaskCompletedPct");

            const todayStr = new Date().toISOString().substring(0, 10);
            let tOverdue = taskList.filter(t => t.due_date && t.due_date < todayStr && t.status !== 'completed' && t.status !== 'cancelled').length;
            let tInProgress = taskList.filter(t => t.status === 'in_progress' || t.status === 'assigned').length;
            let tToDo = taskList.filter(t => t.status === 'todo' || t.status === 'pending').length;
            let tCompleted = taskList.filter(t => t.status === 'completed').length;

            const tTotal = taskList.length > 0 ? taskList.length : (tOverdue + tInProgress + tToDo + tCompleted);
            const calcTaskTotal = Math.max(1, tTotal);

            if (taskDonutEl) taskDonutEl.textContent = tTotal;
            if (taskOverdueCountEl) taskOverdueCountEl.textContent = tOverdue;
            if (taskOverduePctEl) taskOverduePctEl.textContent = ((tOverdue / calcTaskTotal) * 100).toFixed(2) + "%";
            if (taskInProgressCountEl) taskInProgressCountEl.textContent = tInProgress;
            if (taskInProgressPctEl) taskInProgressPctEl.textContent = ((tInProgress / calcTaskTotal) * 100).toFixed(2) + "%";
            if (taskToDoCountEl) taskToDoCountEl.textContent = tToDo;
            if (taskToDoPctEl) taskToDoPctEl.textContent = ((tToDo / calcTaskTotal) * 100).toFixed(2) + "%";
            if (taskCompletedCountEl) taskCompletedCountEl.textContent = tCompleted;
            if (taskCompletedPctEl) taskCompletedPctEl.textContent = ((tCompleted / calcTaskTotal) * 100).toFixed(2) + "%";

            /* ====================================================
               RECENT LEADS TABLE
               ==================================================== */
            const leadsTableBody = document.getElementById("dashRecentLeadsTableBody");
            if (leadsTableBody) {
                const displayLeads = leadList.slice(0, 5);
                if (!displayLeads.length) {
                    leadsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:#9CA3AF;">No leads available.</td></tr>`;
                } else {
                    leadsTableBody.innerHTML = displayLeads.map(l => `
                        <tr>
                            <td><strong>${l.name || l.lead_name || 'Unnamed Lead'}</strong></td>
                            <td>${l.company || l.company_name || '—'}</td>
                            <td>${l.service || 'Website'}</td>
                            <td><span class="dashboard-status blue">${(l.status || 'new').toUpperCase()}</span></td>
                            <td>${l.follow_up_date || '—'}</td>
                            <td><a href="#/leads" class="dashboard-more-btn">View</a></td>
                        </tr>
                    `).join('');
                }
            }

            /* ====================================================
               RECENT PROJECTS TABLE
               ==================================================== */
            const projectsTableBody = document.getElementById("dashRecentProjectsTableBody");
            if (projectsTableBody) {
                const displayProjects = projectList.slice(0, 5);
                if (!displayProjects.length) {
                    projectsTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;color:#9CA3AF;">No projects available.</td></tr>`;
                } else {
                    projectsTableBody.innerHTML = displayProjects.map(p => {
                        const progress = Math.max(0, Math.min(100, Number(p.progress_percentage || p.progress || 0)));
                        const statusStr = (p.status || 'in_progress').replace(/_/g, ' ');
                        return `
                            <tr>
                                <td><strong>${p.project_name || p.name || 'Unnamed Project'}</strong></td>
                                <td>${p.client_name || p.company_name || '—'}</td>
                                <td>
                                    <div class="dashboard-progress-cell">
                                        <span>${progress}%</span>
                                        <div class="dashboard-progress">
                                            <div class="dashboard-progress-bar" style="width: ${progress}%;"></div>
                                        </div>
                                    </div>
                                </td>
                                <td><span class="dashboard-status purple">${statusStr.toUpperCase()}</span></td>
                                <td><a href="#/projects" class="dashboard-more-btn">View</a></td>
                            </tr>
                        `;
                    }).join('');
                }
            }
        },

        loadAnnouncements: function () {
            const textEl = document.getElementById("dashAnnounceText");
            const timeEl = document.getElementById("dashAnnounceTime");
            const announcementsRaw = localStorage.getItem("tenspick_announcements");
            if (announcementsRaw) {
                try {
                    const list = JSON.parse(announcementsRaw);
                    if (list && list.length > 0) {
                        const latest = list[0];
                        if (textEl) textEl.textContent = latest.text;
                        if (timeEl) timeEl.textContent = latest.time || latest.date;
                    }
                } catch (e) {}
            }

            window.addEventListener("tenspick:announcement-posted", function (e) {
                if (e.detail && textEl) {
                    textEl.textContent = e.detail.text;
                    if (timeEl) timeEl.textContent = e.detail.timeStr || "Just now";
                }
            });
        },


        /* ====================================================
           QUICK ACTION
           ==================================================== */

        bindQuickAction: function () {

            if (
                !this.quickButton ||
                !this.quickPanel
            ) {

                return;

            }


            /*
             * Prevent duplicate listeners if the dashboard
             * initialization is accidentally called again.
             */

            if (
                this.quickButton.dataset
                    .dashboardBound === "true"
            ) {

                return;

            }


            this.quickButton.dataset
                .dashboardBound = "true";


            this.quickButton.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    const panel =
                        document.getElementById(
                            "dashboardQuickPanel"
                        );


                    if (!panel) {

                        return;

                    }


                    const isHidden =
                        panel.hidden;


                    panel.hidden =
                        !isHidden;


                    const button =
                        document.getElementById(
                            "dashboardQuickAction"
                        );


                    if (button) {

                        button.setAttribute(
                            "aria-expanded",
                            String(isHidden)
                        );

                    }

                }
            );

        },


        /* ====================================================
           TABLE ACTION BUTTONS
           ==================================================== */

        bindActionButtons: function () {

            const buttons =
                document.querySelectorAll(
                    ".dashboard-more-btn"
                );


            buttons.forEach(
                function (button) {

                    if (
                        button.dataset
                            .dashboardActionBound
                            === "true"
                    ) {

                        return;

                    }


                    button.dataset
                        .dashboardActionBound =
                        "true";


                    button.addEventListener(
                        "click",
                        function (event) {

                            event.preventDefault();

                            event.stopPropagation();


                            /*
                             * These buttons are intentionally
                             * static for now.
                             *
                             * Later they will open the relevant
                             * View/Edit/Delete actions.
                             */

                            console.log(
                                "Dashboard action selected."
                            );

                        }
                    );

                }
            );

        }

    };


    /* ========================================================
       SPA PAGE INITIALIZATION
       ======================================================== */

    function initializeDashboard() {

        /*
         * Dashboard elements only exist after the router
         * inserts dashboard.php into #app-content.
         */

        if (
            !document.querySelector(
                ".dashboard-page"
            )
        ) {

            return;

        }


        Dashboard.init();

    }


    /* ========================================================
       INITIAL LOAD
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeDashboard,
            {
                once: true
            }
        );

    } else {

        initializeDashboard();

    }


    /* ========================================================
       SPA PAGE LOADED EVENT
       ======================================================== */

    document.addEventListener(
        "tenspick:page-loaded",
        function (event) {

            if (
                event.detail &&
                event.detail.route &&
                event.detail.route !== "dashboard"
            ) {

                return;

            }


            initializeDashboard();

        }
    );


    /* ========================================================
       PUBLIC OBJECT
       ======================================================== */

    window.TenspickDashboard =
        Dashboard;


})(window, document);