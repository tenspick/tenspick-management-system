/* ============================================================
   TENSPICK CRM
   EXPENSES MODULE JS
   ============================================================ */

(function (window, document) {
    "use strict";

    const Expenses = {
        initialized: false,

        state: {
            expenses: [],
            filteredExpenses: [],
            clients: [],
            projects: [],
            staff: [],
            editingId: null,
            viewingId: null,
            receiptBase64: null,
            receiptFileName: null,
            page: 1,
            perPage: 15
        },

        init: function () {
            if (this.initialized && document.getElementById("expensesPage")) {
                this.loadAllData();
                return;
            }

            this.bindEvents();
            this.loadAllData();
            this.initialized = true;
        },

        /* ============================================================
           DATA LOADERS (REAL DATABASE ONLY - NO DUMMY DATA)
           ============================================================ */
        loadAllData: async function () {
            await Promise.all([
                this.loadClients(),
                this.loadProjects(),
                this.loadStaff(),
                this.loadExpenses()
            ]);
        },

        loadClients: async function () {
            let list = [];
            // 1. Supabase
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const { data } = await sb.from("clients").select("*").order("client_name", { ascending: true });
                    if (data && Array.isArray(data)) list = data;
                } catch (e) {
                    console.warn("[Expenses] Supabase clients load note:", e);
                }
            }
            // 2. LocalStorage
            if (!list.length) {
                try {
                    const cached = localStorage.getItem("tenspick_clients");
                    if (cached) list = JSON.parse(cached) || [];
                } catch (e) {}
            }

            this.state.clients = list;
            this.populateClientDropdowns();
        },

        loadProjects: async function () {
            let list = [];
            // 1. Supabase
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const { data } = await sb.from("projects").select("*").order("project_name", { ascending: true });
                    if (data && Array.isArray(data)) list = data;
                } catch (e) {
                    console.warn("[Expenses] Supabase projects load note:", e);
                }
            }
            // 2. LocalStorage
            if (!list.length) {
                try {
                    const cached = localStorage.getItem("tenspick_projects");
                    if (cached) list = JSON.parse(cached) || [];
                } catch (e) {}
            }

            this.state.projects = list;
            this.populateFilterProjects();
            this.populateProfitabilityProjects();
        },

        loadStaff: async function () {
            let list = [];
            // 1. Supabase
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const { data } = await sb.from("staff").select("*").order("full_name", { ascending: true });
                    if (data && Array.isArray(data)) list = data;
                } catch (e) {
                    console.warn("[Expenses] Supabase staff load note:", e);
                }
            }
            // 2. LocalStorage
            if (!list.length) {
                try {
                    const cached = localStorage.getItem("tenspick_staff");
                    if (cached) list = JSON.parse(cached) || [];
                } catch (e) {}
            }

            this.state.staff = list;
            this.populateStaffDropdown();
        },

        loadExpenses: async function () {
            let list = [];
            // 1. Supabase
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    const { data } = await sb.from("expenses").select("*").order("created_at", { ascending: false });
                    if (data && Array.isArray(data)) list = data;
                } catch (e) {
                    console.warn("[Expenses] Supabase expenses load note:", e);
                }
            }
            // 2. LocalStorage
            if (!list.length) {
                try {
                    const cached = localStorage.getItem("tenspick_expenses");
                    if (cached) list = JSON.parse(cached) || [];
                } catch (e) {}
            }

            this.state.expenses = list;
            this.applyFilters();
        },

        /* ============================================================
           POPULATE DROPDOWNS
           ============================================================ */
        populateClientDropdowns: function () {
            const formClientSelect = document.getElementById("expenseClient");
            const filterClientSelect = document.getElementById("expensesClientFilter");

            const optionsHtml = this.state.clients.map(c => `
                <option value="${c.id}">${this.escapeHtml(c.client_name || c.company_name || c.name || 'Client #' + c.id)}</option>
            `).join("");

            if (formClientSelect) {
                formClientSelect.innerHTML = `<option value="">Select Client...</option>` + optionsHtml;
            }
            if (filterClientSelect) {
                filterClientSelect.innerHTML = `<option value="">All Clients</option>` + optionsHtml;
            }
        },

        populateFilterProjects: function () {
            const filterProjectSelect = document.getElementById("expensesProjectFilter");
            if (!filterProjectSelect) return;

            const optionsHtml = this.state.projects.map(p => `
                <option value="${p.id}">${this.escapeHtml(p.project_name || p.name || 'Project #' + p.id)}</option>
            `).join("");

            filterProjectSelect.innerHTML = `<option value="">All Projects</option>` + optionsHtml;
        },

        populateProfitabilityProjects: function () {
            const profitSelect = document.getElementById("profitabilityProjectSelect");
            if (!profitSelect) return;

            const optionsHtml = this.state.projects.map(p => `
                <option value="${p.id}">${this.escapeHtml(p.project_name || p.name || 'Project #' + p.id)}</option>
            `).join("");

            profitSelect.innerHTML = `<option value="">Select a Project...</option>` + optionsHtml;
        },

        populateStaffDropdown: function () {
            const staffSelect = document.getElementById("expenseStaff");
            if (!staffSelect) return;

            const optionsHtml = this.state.staff.map(s => `
                <option value="${s.id}">${this.escapeHtml(s.full_name || s.name || s.email)} (${this.escapeHtml(s.designation || 'Staff')})</option>
            `).join("");

            staffSelect.innerHTML = `<option value="">Select Staff Member...</option>` + optionsHtml;
        },

        /* ============================================================
           CASCADING DROPDOWNS & CONDITIONAL FORM LOGIC
           ============================================================ */
        onClientChange: function (clientId) {
            const projectSelect = document.getElementById("expenseProject");
            if (!projectSelect) return;

            if (!clientId) {
                projectSelect.innerHTML = `<option value="">Select Client First...</option>`;
                return;
            }

            const targetIdStr = String(clientId);
            const targetClient = this.state.clients.find(c => String(c.id) === targetIdStr);
            const clientName = targetClient ? (targetClient.client_name || targetClient.company_name || targetClient.name) : "";

            const filteredProjects = this.state.projects.filter(p => {
                return String(p.client_id) === targetIdStr || (clientName && p.client_name === clientName);
            });

            if (!filteredProjects.length) {
                projectSelect.innerHTML = `<option value="">No projects found for this client</option>`;
            } else {
                projectSelect.innerHTML = `<option value="">Select Project...</option>` + filteredProjects.map(p => `
                    <option value="${p.id}">${this.escapeHtml(p.project_name || p.name || 'Project #' + p.id)}</option>
                `).join("");
            }
        },

        onExpenseTypeChange: function (type) {
            const clientContainer = document.getElementById("expenseClientContainer");
            const projectContainer = document.getElementById("expenseProjectContainer");

            if (type === "company_expense") {
                if (clientContainer) clientContainer.style.display = "none";
                if (projectContainer) projectContainer.style.display = "none";
            } else {
                if (clientContainer) clientContainer.style.display = "block";
                if (projectContainer) projectContainer.style.display = "block";
            }
        },

        onPaidByChange: function (paidBy) {
            const staffContainer = document.getElementById("expenseStaffContainer");
            if (staffContainer) {
                staffContainer.style.display = (paidBy === "staff") ? "block" : "none";
            }
        },

        /* ============================================================
           CALCULATIONS ENGINE & STATS
           ============================================================ */
        calculateStats: function () {
            const totalAmountEl = document.getElementById("expensesTotalAmount");
            const monthAmountEl = document.getElementById("expensesMonthAmount");
            const projectAmountEl = document.getElementById("expensesProjectAmount");
            const operationalAmountEl = document.getElementById("expensesOperationalAmount");
            const reimbursementsAmountEl = document.getElementById("expensesReimbursementsAmount");
            const topCategoryEl = document.getElementById("expensesTopCategory");
            const topCategorySubEl = document.getElementById("expensesTopCategoryAmount");

            const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM

            let total = 0;
            let monthTotal = 0;
            let projectTotal = 0;
            let operationalTotal = 0;
            let reimbursementsTotal = 0;

            const categoryTotals = {};

            this.state.expenses.forEach(x => {
                const amt = Number(x.amount) || 0;
                total += amt;

                const expDate = String(x.expense_date || x.created_at || "");
                if (expDate.substring(0, 7) === currentMonthStr) {
                    monthTotal += amt;
                }

                if (x.expense_type === "project_expense" || x.project_id) {
                    projectTotal += amt;
                } else {
                    operationalTotal += amt;
                }

                if (x.status === "reimbursable") {
                    reimbursementsTotal += amt;
                }

                const cat = x.category || "other";
                categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
            });

            // Find Top Category
            let topCat = "—";
            let topCatAmt = 0;
            Object.keys(categoryTotals).forEach(cat => {
                if (categoryTotals[cat] > topCatAmt) {
                    topCatAmt = categoryTotals[cat];
                    topCat = cat.replace(/_/g, ' ').toUpperCase();
                }
            });

            if (totalAmountEl) totalAmountEl.textContent = '₹' + total.toLocaleString('en-IN');
            if (monthAmountEl) monthAmountEl.textContent = '₹' + monthTotal.toLocaleString('en-IN');
            if (projectAmountEl) projectAmountEl.textContent = '₹' + projectTotal.toLocaleString('en-IN');
            if (operationalAmountEl) operationalAmountEl.textContent = '₹' + operationalTotal.toLocaleString('en-IN');
            if (reimbursementsAmountEl) reimbursementsAmountEl.textContent = '₹' + reimbursementsTotal.toLocaleString('en-IN');
            if (topCategoryEl) topCategoryEl.textContent = topCat;
            if (topCategorySubEl) topCategorySubEl.textContent = '₹' + topCatAmt.toLocaleString('en-IN') + ' spend';

            this.renderCategoryBreakdown(categoryTotals, total);
        },

        renderCategoryBreakdown: function (categoryTotals, grandTotal) {
            const listEl = document.getElementById("expensesCategoryBreakdownList");
            if (!listEl) return;

            const categories = Object.keys(categoryTotals);
            if (!categories.length) {
                listEl.innerHTML = `<p style="color:#9CA3AF; text-align:center; padding:15px;">No expense records logged yet.</p>`;
                return;
            }

            const calcTotal = Math.max(1, grandTotal);

            listEl.innerHTML = categories.map(cat => {
                const amt = categoryTotals[cat];
                const pct = ((amt / calcTotal) * 100).toFixed(1);
                const title = cat.replace(/_/g, ' ').toUpperCase();
                return `
                    <div class="expenses-category-item">
                        <div class="expenses-category-label">
                            <span>${this.escapeHtml(title)}</span>
                            <span>₹${amt.toLocaleString('en-IN')} (${pct}%)</span>
                        </div>
                        <div class="expenses-category-bar">
                            <div class="expenses-category-progress" style="width: ${pct}%;"></div>
                        </div>
                    </div>
                `;
            }).join("");
        },

        calculateProjectProfitability: function (projectId) {
            const revEl = document.getElementById("profitRevenue");
            const expEl = document.getElementById("profitExpenses");
            const grossEl = document.getElementById("profitGross");

            if (!projectId) {
                if (revEl) revEl.textContent = "₹0";
                if (expEl) expEl.textContent = "₹0";
                if (grossEl) grossEl.textContent = "₹0";
                return;
            }

            const targetIdStr = String(projectId);
            const project = this.state.projects.find(p => String(p.id) === targetIdStr);
            const revenue = project ? Number(project.budget || project.amount_quoted || 0) : 0;

            const projectExpTotal = this.state.expenses
                .filter(x => String(x.project_id) === targetIdStr)
                .reduce((sum, x) => sum + (Number(x.amount) || 0), 0);

            const grossProfit = revenue - projectExpTotal;

            if (revEl) revEl.textContent = '₹' + revenue.toLocaleString('en-IN');
            if (expEl) expEl.textContent = '₹' + projectExpTotal.toLocaleString('en-IN');
            if (grossEl) {
                grossEl.textContent = '₹' + grossProfit.toLocaleString('en-IN');
                grossEl.style.color = grossProfit >= 0 ? "#10B981" : "#EF4444";
            }
        },

        /* ============================================================
           FILTERING ENGINE
           ============================================================ */
        applyFilters: function () {
            const search = (document.getElementById("expensesSearch")?.value || "").trim().toLowerCase();
            const dateFilter = document.getElementById("expensesDateFilter")?.value || "";
            const startDate = document.getElementById("expensesStartDate")?.value || "";
            const endDate = document.getElementById("expensesEndDate")?.value || "";
            const category = document.getElementById("expensesCategoryFilter")?.value || "";
            const type = document.getElementById("expensesTypeFilter")?.value || "";
            const client = document.getElementById("expensesClientFilter")?.value || "";
            const project = document.getElementById("expensesProjectFilter")?.value || "";
            const paidBy = document.getElementById("expensesPaidByFilter")?.value || "";
            const status = document.getElementById("expensesStatusFilter")?.value || "";

            const now = new Date();
            const todayStr = now.toISOString().substring(0, 10);

            this.state.filteredExpenses = this.state.expenses.filter(x => {
                // Search filter
                if (search) {
                    const haystack = (
                        (x.title || "") + " " +
                        (x.client_name || "") + " " +
                        (x.project_name || "") + " " +
                        (x.transaction_ref || "") + " " +
                        (x.payee || "") + " " +
                        (x.notes || "")
                    ).toLowerCase();
                    if (!haystack.includes(search)) return false;
                }

                // Category
                if (category && x.category !== category) return false;

                // Type
                if (type && x.expense_type !== type) return false;

                // Client
                if (client && String(x.client_id) !== String(client)) return false;

                // Project
                if (project && String(x.project_id) !== String(project)) return false;

                // Paid By
                if (paidBy && x.paid_by !== paidBy) return false;

                // Status
                if (status && x.status !== status) return false;

                // Date Filter
                if (dateFilter) {
                    const expDate = String(x.expense_date || x.created_at || "").substring(0, 10);
                    if (dateFilter === "today" && expDate !== todayStr) return false;
                    if (dateFilter === "this_month" && expDate.substring(0, 7) !== todayStr.substring(0, 7)) return false;
                    if (dateFilter === "custom") {
                        if (startDate && expDate < startDate) return false;
                        if (endDate && expDate > endDate) return false;
                    }
                }

                return true;
            });

            this.calculateStats();
            this.renderTable();
        },

        /* ============================================================
           RENDER TABLE & PAGINATION
           ============================================================ */
        renderTable: function () {
            const tableBody = document.getElementById("expensesTableBody");
            const resultInfo = document.getElementById("expensesResultInfo");
            if (!tableBody) return;

            const list = this.state.filteredExpenses;
            if (resultInfo) resultInfo.textContent = `${list.length} records`;

            if (!list.length) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="9" class="expenses-empty-cell" style="text-align:center; padding:30px; color:#9CA3AF;">
                            <i class="bi bi-receipt" style="font-size:32px; display:block; margin-bottom:8px;"></i>
                            No expenses found matching your filter criteria.
                        </td>
                    </tr>
                `;
                return;
            }

            tableBody.innerHTML = list.map(x => {
                const dateStr = x.expense_date || (x.created_at ? x.created_at.substring(0, 10) : '—');
                const catStr = (x.category || 'other').replace(/_/g, ' ').toUpperCase();
                const clientName = x.client_name || (x.client_id ? 'Client #' + x.client_id : '—');
                const projectName = x.project_name || (x.project_id ? 'Project #' + x.project_id : '—');
                const paidByStr = (x.paid_by || 'company').toUpperCase();
                const statusStr = (x.status || 'paid').toLowerCase();

                let statusBadgeClass = "exp-badge-paid";
                if (statusStr === "pending") statusBadgeClass = "exp-badge-pending";
                if (statusStr === "reimbursable") statusBadgeClass = "exp-badge-reimbursable";
                if (statusStr === "reimbursed") statusBadgeClass = "exp-badge-reimbursed";
                if (statusStr === "cancelled") statusBadgeClass = "exp-badge-cancelled";

                return `
                    <tr>
                        <td><strong>${this.escapeHtml(dateStr)}</strong></td>
                        <td>
                            <strong style="color:#111827; font-size:14px;">${this.escapeHtml(x.title || 'Untitled Expense')}</strong>
                            ${x.transaction_ref ? `<div style="font-size:11px; color:#6B7280;">Ref: ${this.escapeHtml(x.transaction_ref)}</div>` : ''}
                        </td>
                        <td><span style="font-size:11px; font-weight:700; background:#F3F4F6; padding:3px 8px; border-radius:4px; color:#4B5563;">${this.escapeHtml(catStr)}</span></td>
                        <td>${this.escapeHtml(clientName)}</td>
                        <td>${this.escapeHtml(projectName)}</td>
                        <td><strong style="color:#10B981; font-size:15px;">₹${(Number(x.amount) || 0).toLocaleString('en-IN')}</strong></td>
                        <td><span style="font-size:11px; font-weight:600; color:#374151;">${this.escapeHtml(paidByStr)}</span></td>
                        <td><span class="exp-badge ${statusBadgeClass}">${this.escapeHtml(statusStr)}</span></td>
                        <td>
                            <div class="expenses-actions-cell">
                                <button type="button" class="expenses-icon-btn" title="View Details" onclick="window.TenspickExpenses.openViewModal(${x.id})">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <button type="button" class="expenses-icon-btn" title="Edit" onclick="window.TenspickExpenses.openEditModal(${x.id})">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button type="button" class="expenses-icon-btn danger" title="Delete" onclick="window.TenspickExpenses.deleteExpense(${x.id})">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join("");
        },

        /* ============================================================
           MODAL OPEN / CLOSE / SAVE
           ============================================================ */
        openAddModal: function () {
            this.state.editingId = null;
            this.state.receiptBase64 = null;
            this.state.receiptFileName = null;

            const form = document.getElementById("expenseForm");
            if (form) form.reset();

            const formId = document.getElementById("expenseFormId");
            if (formId) formId.value = "";

            const modalTitle = document.getElementById("expenseModalTitle");
            if (modalTitle) modalTitle.textContent = "Add Expense";

            const dateInput = document.getElementById("expenseDate");
            if (dateInput) dateInput.value = new Date().toISOString().substring(0, 10);

            const preview = document.getElementById("expenseReceiptPreview");
            if (preview) { preview.style.display = "none"; preview.innerHTML = ""; }

            this.onExpenseTypeChange("project_expense");
            this.onPaidByChange("company");

            this.showModal("expenseModal");
        },

        openEditModal: function (id) {
            const expense = this.state.expenses.find(x => Number(x.id) === Number(id));
            if (!expense) return;

            this.state.editingId = id;
            this.state.receiptBase64 = expense.receipt_base64 || null;
            this.state.receiptFileName = expense.receipt_file_name || null;

            document.getElementById("expenseFormId").value = id;
            document.getElementById("expenseTitle").value = expense.title || "";
            document.getElementById("expenseCategory").value = expense.category || "";
            document.getElementById("expenseAmount").value = expense.amount || "";
            document.getElementById("expenseDate").value = expense.expense_date || "";

            const isProjectExp = expense.expense_type === "project_expense" || expense.client_id;
            document.getElementById("expenseTypeProject").checked = isProjectExp;
            document.getElementById("expenseTypeCompany").checked = !isProjectExp;
            this.onExpenseTypeChange(isProjectExp ? "project_expense" : "company_expense");

            if (isProjectExp) {
                document.getElementById("expenseClient").value = expense.client_id || "";
                this.onClientChange(expense.client_id);
                document.getElementById("expenseProject").value = expense.project_id || "";
            }

            document.getElementById("expensePaidBy").value = expense.paid_by || "company";
            this.onPaidByChange(expense.paid_by || "company");
            if (expense.paid_by === "staff") {
                document.getElementById("expenseStaff").value = expense.staff_id || "";
            }

            document.getElementById("expensePaymentMethod").value = expense.payment_method || "upi";
            document.getElementById("expenseTransactionRef").value = expense.transaction_ref || "";
            document.getElementById("expenseStatus").value = expense.status || "paid";
            document.getElementById("expenseNotes").value = expense.notes || "";

            const modalTitle = document.getElementById("expenseModalTitle");
            if (modalTitle) modalTitle.textContent = "Edit Expense";

            const preview = document.getElementById("expenseReceiptPreview");
            if (preview) {
                if (expense.receipt_base64) {
                    preview.style.display = "block";
                    preview.innerHTML = `<span style="font-size:12px; color:#10B981; font-weight:600;"><i class="bi bi-paperclip"></i> Attached: ${this.escapeHtml(expense.receipt_file_name || 'Receipt')}</span>`;
                } else {
                    preview.style.display = "none";
                    preview.innerHTML = "";
                }
            }

            this.showModal("expenseModal");
        },

        saveExpense: async function (e) {
            e.preventDefault();

            const title = document.getElementById("expenseTitle").value.trim();
            const category = document.getElementById("expenseCategory").value;
            const amount = Number(document.getElementById("expenseAmount").value);
            const expense_date = document.getElementById("expenseDate").value;

            if (!title || !category || !amount || !expense_date) {
                if (window.showToast) window.showToast("Please fill in all required fields marked with *", "error");
                return;
            }

            const isProjectExp = document.getElementById("expenseTypeProject").checked;
            const expense_type = isProjectExp ? "project_expense" : "company_expense";

            let client_id = null;
            let client_name = null;
            let project_id = null;
            let project_name = null;

            if (isProjectExp) {
                client_id = document.getElementById("expenseClient").value;
                project_id = document.getElementById("expenseProject").value;

                const clientObj = this.state.clients.find(c => String(c.id) === String(client_id));
                client_name = clientObj ? (clientObj.client_name || clientObj.company_name || clientObj.name) : null;

                const projectObj = this.state.projects.find(p => String(p.id) === String(project_id));
                project_name = projectObj ? (projectObj.project_name || projectObj.name) : null;
            }

            const paid_by = document.getElementById("expensePaidBy").value;
            let staff_id = null;
            let staff_name = null;

            if (paid_by === "staff") {
                staff_id = document.getElementById("expenseStaff").value;
                const staffObj = this.state.staff.find(s => String(s.id) === String(staff_id));
                staff_name = staffObj ? (staffObj.full_name || staffObj.name) : null;
            }

            const payment_method = document.getElementById("expensePaymentMethod").value;
            const transaction_ref = document.getElementById("expenseTransactionRef").value.trim();
            const status = document.getElementById("expenseStatus").value;
            const notes = document.getElementById("expenseNotes").value.trim();

            const payload = {
                title,
                category,
                amount,
                expense_date,
                expense_type,
                client_id,
                client_name,
                project_id,
                project_name,
                paid_by,
                staff_id,
                staff_name,
                payment_method,
                transaction_ref,
                status,
                notes,
                receipt_base64: this.state.receiptBase64,
                receipt_file_name: this.state.receiptFileName
            };

            try {
                let savedId = this.state.editingId || Date.now();
                payload.id = savedId;
                payload.created_at = new Date().toISOString();

                // 1. Supabase sync
                if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                    try {
                        const sb = window.TenspickSupabase.getClient();
                        if (this.state.editingId) {
                            await sb.from("expenses").update(payload).eq("id", this.state.editingId);
                        } else {
                            await sb.from("expenses").insert([payload]);
                        }
                    } catch (sbErr) {
                        console.warn("[Expenses] Supabase save note:", sbErr);
                    }
                }

                // 2. LocalStorage sync
                let localList = [];
                try {
                    const cached = localStorage.getItem("tenspick_expenses");
                    if (cached) localList = JSON.parse(cached) || [];
                } catch (e) {}

                if (this.state.editingId) {
                    const idx = localList.findIndex(x => Number(x.id) === Number(this.state.editingId));
                    if (idx >= 0) localList[idx] = { ...localList[idx], ...payload };
                    else localList.unshift(payload);
                } else {
                    localList.unshift(payload);
                }

                localStorage.setItem("tenspick_expenses", JSON.stringify(localList));

                this.hideModal("expenseModal");
                if (window.showToast) window.showToast(this.state.editingId ? "Expense updated successfully!" : "Expense logged successfully!", "success");

                await this.loadExpenses();
            } catch (err) {
                console.error("[Expenses] Save error:", err);
                if (window.showToast) window.showToast("Failed to save expense.", "error");
            }
        },

        /* ============================================================
           VIEW DETAILS DRAWER
           ============================================================ */
        openViewModal: function (id) {
            const expense = this.state.expenses.find(x => Number(x.id) === Number(id));
            if (!expense) return;

            this.state.viewingId = id;

            const titleEl = document.getElementById("expenseViewTitle");
            const bodyEl = document.getElementById("expenseViewBody");

            if (titleEl) titleEl.textContent = expense.title || "Expense Details";

            const catStr = (expense.category || 'other').replace(/_/g, ' ').toUpperCase();
            const clientName = expense.client_name || (expense.client_id ? 'Client #' + expense.client_id : '—');
            const projectName = expense.project_name || (expense.project_id ? 'Project #' + expense.project_id : '—');
            const paidByStr = (expense.paid_by || 'company').toUpperCase();
            const staffName = expense.staff_name || '—';

            if (bodyEl) {
                bodyEl.innerHTML = `
                    <div style="background: #F9FAFB; border-radius: 12px; padding: 18px; margin-bottom: 20px; border: 1px solid #E5E7EB; text-align: center;">
                        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6B7280; letter-spacing: 0.5px;">Expense Amount</span>
                        <div style="font-size: 32px; font-weight: 800; color: #10B981; margin: 4px 0;">₹${(Number(expense.amount) || 0).toLocaleString('en-IN')}</div>
                        <span class="exp-badge exp-badge-${expense.status}">${expense.status}</span>
                    </div>

                    <table class="expenses-table" style="margin-bottom: 20px;">
                        <tbody>
                            <tr><th>CATEGORY</th><td><strong>${this.escapeHtml(catStr)}</strong></td></tr>
                            <tr><th>EXPENSE DATE</th><td>${this.escapeHtml(expense.expense_date || '—')}</td></tr>
                            <tr><th>EXPENSE TYPE</th><td>${expense.expense_type === 'project_expense' ? 'Project Expense' : 'Company Expense'}</td></tr>
                            <tr><th>CLIENT</th><td>${this.escapeHtml(clientName)}</td></tr>
                            <tr><th>PROJECT</th><td>${this.escapeHtml(projectName)}</td></tr>
                            <tr><th>PAID BY</th><td>${this.escapeHtml(paidByStr)} ${expense.paid_by === 'staff' ? `(${this.escapeHtml(staffName)})` : ''}</td></tr>
                            <tr><th>PAYMENT METHOD</th><td>${this.escapeHtml((expense.payment_method || '').toUpperCase())}</td></tr>
                            <tr><th>TRANSACTION REF</th><td>${this.escapeHtml(expense.transaction_ref || '—')}</td></tr>
                        </tbody>
                    </table>

                    ${expense.notes ? `
                        <div style="margin-bottom: 20px;">
                            <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #374151;">Notes & Remarks</h4>
                            <div style="background: #F9FAFB; padding: 12px; border-radius: 8px; font-size: 13px; border: 1px solid #E5E7EB; color: #4B5563;">
                                ${this.escapeHtml(expense.notes)}
                            </div>
                        </div>
                    ` : ''}

                    ${expense.receipt_base64 ? `
                        <div style="margin-bottom: 10px;">
                            <h4 style="font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #374151;">Attached Receipt</h4>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                <a href="${expense.receipt_base64}" target="_blank" download="${expense.receipt_file_name || 'receipt'}" class="expenses-btn expenses-btn-outline" style="font-size: 12px; padding: 6px 12px;">
                                    <i class="bi bi-download"></i> Download Receipt
                                </a>
                                <a href="${expense.receipt_base64}" target="_blank" class="expenses-btn expenses-btn-outline" style="font-size: 12px; padding: 6px 12px;">
                                    <i class="bi bi-eye"></i> View Attachment
                                </a>
                            </div>
                        </div>
                    ` : ''}
                `;
            }

            this.showModal("expenseViewModal");
        },

        deleteExpense: async function (id) {
            const confirmed = window.confirm("Are you sure you want to delete this expense record?\nThis action cannot be undone.");
            if (!confirmed) return;

            try {
                // 1. Supabase
                if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                    try {
                        const sb = window.TenspickSupabase.getClient();
                        await sb.from("expenses").delete().eq("id", id);
                    } catch (e) {}
                }

                // 2. LocalStorage
                let localList = [];
                try {
                    const cached = localStorage.getItem("tenspick_expenses");
                    if (cached) localList = JSON.parse(cached) || [];
                } catch (e) {}

                localList = localList.filter(x => Number(x.id) !== Number(id));
                localStorage.setItem("tenspick_expenses", JSON.stringify(localList));

                this.hideModal("expenseViewModal");
                if (window.showToast) window.showToast("Expense record deleted.", "success");

                await this.loadExpenses();
            } catch (err) {
                console.error("[Expenses] Delete error:", err);
            }
        },

        /* ============================================================
           EXPORT CSV
           ============================================================ */
        exportCSV: function () {
            const list = this.state.filteredExpenses;
            if (!list.length) {
                if (window.showToast) window.showToast("No expenses to export.", "error");
                return;
            }

            const headers = ["ID", "Title", "Category", "Amount", "Date", "Expense Type", "Client", "Project", "Paid By", "Status", "Transaction Ref", "Notes"];
            const rows = list.map(x => [
                x.id,
                `"${(x.title || '').replace(/"/g, '""')}"`,
                x.category || '',
                x.amount || 0,
                x.expense_date || '',
                x.expense_type || '',
                `"${(x.client_name || '').replace(/"/g, '""')}"`,
                `"${(x.project_name || '').replace(/"/g, '""')}"`,
                x.paid_by || '',
                x.status || '',
                `"${(x.transaction_ref || '').replace(/"/g, '""')}"`,
                `"${(x.notes || '').replace(/"/g, '""')}"`
            ]);

            const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `tenspick_expenses_${new Date().toISOString().substring(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },

        /* ============================================================
           MODAL HELPERS & EVENT BINDINGS
           ============================================================ */
        showModal: function (id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.add("is-open");
                modal.removeAttribute("hidden");
                modal.removeAttribute("inert");
            }
        },

        hideModal: function (id) {
            const modal = document.getElementById(id);
            if (modal) {
                modal.classList.remove("is-open");
                modal.setAttribute("hidden", "");
                modal.setAttribute("inert", "");
            }
        },

        bindEvents: function () {
            const self = this;

            // Add Expense button
            document.addEventListener("click", function (e) {
                if (e.target.closest("#expensesAddBtn")) {
                    self.openAddModal();
                }
                if (e.target.closest("#expensesExportBtn")) {
                    self.exportCSV();
                }
                if (e.target.closest("#expenseModalClose") || e.target.closest("#expenseCancelBtn") || e.target.closest("[data-close-expense-modal]")) {
                    self.hideModal("expenseModal");
                }
                if (e.target.closest("#expenseViewClose") || e.target.closest("#expenseViewCloseBtn") || e.target.closest("[data-close-expense-view]")) {
                    self.hideModal("expenseViewModal");
                }
                if (e.target.closest("#expenseViewEditBtn")) {
                    const id = self.state.viewingId;
                    self.hideModal("expenseViewModal");
                    self.openEditModal(id);
                }
                if (e.target.closest("#expenseViewDeleteBtn")) {
                    const id = self.state.viewingId;
                    self.deleteExpense(id);
                }
                if (e.target.closest("#expensesResetFilters")) {
                    document.getElementById("expensesSearch").value = "";
                    document.getElementById("expensesDateFilter").value = "";
                    document.getElementById("expensesCategoryFilter").value = "";
                    document.getElementById("expensesTypeFilter").value = "";
                    document.getElementById("expensesClientFilter").value = "";
                    document.getElementById("expensesProjectFilter").value = "";
                    document.getElementById("expensesPaidByFilter").value = "";
                    document.getElementById("expensesStatusFilter").value = "";
                    self.applyFilters();
                }
            });

            // Form Save submit
            const form = document.getElementById("expenseForm");
            if (form) {
                form.addEventListener("submit", function (e) { self.saveExpense(e); });
            }

            // Radio Expense Type change
            document.addEventListener("change", function (e) {
                if (e.target.name === "expense_type") {
                    self.onExpenseTypeChange(e.target.value);
                }
                if (e.target.id === "expenseClient") {
                    self.onClientChange(e.target.value);
                }
                if (e.target.id === "expensePaidBy") {
                    self.onPaidByChange(e.target.value);
                }
                if (e.target.id === "profitabilityProjectSelect") {
                    self.calculateProjectProfitability(e.target.value);
                }
            });

            // Filter Inputs Change / Input
            const filterIds = ["expensesSearch", "expensesDateFilter", "expensesStartDate", "expensesEndDate", "expensesCategoryFilter", "expensesTypeFilter", "expensesClientFilter", "expensesProjectFilter", "expensesPaidByFilter", "expensesStatusFilter"];
            filterIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    el.addEventListener("input", function () { self.applyFilters(); });
                    el.addEventListener("change", function () {
                        if (id === "expensesDateFilter") {
                            const customContainer = document.getElementById("expensesCustomDateContainer");
                            if (customContainer) customContainer.style.display = (el.value === "custom") ? "flex" : "none";
                        }
                        self.applyFilters();
                    });
                }
            });

            // Receipt file upload reader
            const receiptFileEl = document.getElementById("expenseReceiptFile");
            if (receiptFileEl) {
                receiptFileEl.addEventListener("change", function (e) {
                    const file = e.target.files[0];
                    if (!file) return;

                    self.state.receiptFileName = file.name;
                    const reader = new FileReader();
                    reader.onload = function (evt) {
                        self.state.receiptBase64 = evt.target.result;
                        const preview = document.getElementById("expenseReceiptPreview");
                        if (preview) {
                            preview.style.display = "block";
                            preview.innerHTML = `<span style="font-size:12px; color:#10B981; font-weight:600;"><i class="bi bi-check-circle"></i> File selected: ${self.escapeHtml(file.name)}</span>`;
                        }
                    };
                    reader.readAsDataURL(file);
                });
            }
        },

        escapeHtml: function (str) {
            if (str === null || str === undefined) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }
    };

    function initializeExpenses() {
        if (!document.getElementById("expensesPage")) return;
        Expenses.init();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeExpenses, { once: true });
    } else {
        initializeExpenses();
    }

    document.addEventListener("tenspick:page-loaded", function (e) {
        if (e.detail && e.detail.route && e.detail.route !== "expenses") return;
        initializeExpenses();
    });

    window.TenspickExpenses = Expenses;

})(window, document);
