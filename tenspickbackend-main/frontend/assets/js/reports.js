"use strict";

/**
 * ============================================================
 * TENSPICK CRM - WORK REPORTS MODULE (REAL DATA ONLY)
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let workReports = [];
    const GLOBAL_REPORTS_KEY = "tenspick_global_work_reports";

    function escapeHtml(v) {
        const d = document.createElement("div");
        d.textContent = String(v || "");
        return d.innerHTML;
    }

    function getUserInfo() {
        try {
            const raw = sessionStorage.getItem("tenspick_user");
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        const isStaff = window.TenspickAuth && window.TenspickAuth.isStaff();
        return { id: isStaff ? 2 : 1, name: isStaff ? "Staff Member" : "Admin User", role: isStaff ? "staff" : "admin" };
    }

    function isStaffRole() {
        return window.TenspickAuth && window.TenspickAuth.isStaff();
    }

    function loadReportsData() {
        try {
            const raw = localStorage.getItem(GLOBAL_REPORTS_KEY);
            if (raw) workReports = JSON.parse(raw) || [];
            else workReports = [];
        } catch (e) { workReports = []; }
    }

    function saveReports() {
        try { localStorage.setItem(GLOBAL_REPORTS_KEY, JSON.stringify(workReports)); } catch (e) {}
    }

    function getStats() {
        const isStaff = isStaffRole();
        const user = getUserInfo();
        let userReports = workReports;
        if (isStaff) {
            userReports = workReports.filter(r => String(r.staffId) === String(user.id) || r.staffName === user.name);
        }

        const totalHours = userReports.reduce((acc, r) => acc + (parseFloat(r.hours) || 0), 0);
        const pendingCount = userReports.filter(r => r.status === "Pending").length;
        const approvedCount = userReports.filter(r => r.status === "Approved" || r.status === "Reviewed").length;

        return {
            hoursLogged: totalHours.toFixed(1) + "h",
            reportsSubmitted: userReports.length,
            pendingReports: pendingCount,
            approvedReports: approvedCount
        };
    }

    function renderStatCards(stats) {
        const container = document.getElementById("reportsStatCards");
        if (!container) return;

        const isStaff = isStaffRole();

        const cards = [
            { label: isStaff ? "My Submitted Reports" : "Total Work Reports", value: stats.reportsSubmitted, icon: "bi-file-earmark-text-fill", color: "#4B49AC", bg: "#EEF2FF" },
            { label: "Pending Review", value: stats.pendingReports, icon: "bi-hourglass-split", color: "#F59E0B", bg: "#FFFBEB" },
            { label: "Approved Reports", value: stats.approvedReports, icon: "bi-check-circle-fill", color: "#10B981", bg: "#F0FDF4" },
            { label: "Total Hours Logged", value: stats.hoursLogged, icon: "bi-clock-fill", color: "#8B5CF6", bg: "#F5F3FF" }
        ];

        container.innerHTML = cards.map(c => `
            <div style="background: #fff; border-radius: 12px; padding: 18px 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.04); border: 1px solid #E5E7EB; display: flex; align-items: center; gap: 14px;">
                <div style="width: 48px; height: 48px; border-radius: 12px; background: ${c.bg}; display: flex; align-items: center; justify-content: center; font-size: 22px; color: ${c.color}; flex-shrink: 0;">
                    <i class="bi ${c.icon}"></i>
                </div>
                <div>
                    <div style="font-size: 24px; font-weight: 800; color: #1F2937;">${escapeHtml(String(c.value))}</div>
                    <div style="font-size: 12px; color: #6B7280; font-weight: 500; margin-top: 2px;">${escapeHtml(c.label)}</div>
                </div>
            </div>
        `).join("");
    }

    function renderAdminPendingAlert() {
        const alertBox = document.getElementById("adminWorkReportsAlert");
        const tbody = document.getElementById("adminWorkReportsList");
        const badge = document.getElementById("adminPendingReportBadge");

        if (isStaffRole()) {
            if (alertBox) alertBox.style.display = "none";
            return;
        }

        if (alertBox) alertBox.style.display = "block";

        const pending = workReports.filter(r => r.status === "Pending");
        if (badge) badge.textContent = pending.length + " New";

        if (!tbody) return;

        if (!pending.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #059669; font-weight: 600;">No pending staff work reports.</td></tr>`;
            return;
        }

        tbody.innerHTML = pending.map(r => `
            <tr style="border-bottom: 1px dashed #C7D2FE;">
                <td style="padding: 10px 8px; font-weight: 700; color: #1F2937;">${escapeHtml(r.staffName)}</td>
                <td style="padding: 10px 8px; font-weight: 600; color: #4338CA;">${escapeHtml(r.project)}</td>
                <td style="padding: 10px 8px; color: #4B5563; font-weight: 700;">${r.hours}h</td>
                <td style="padding: 10px 8px; color: #475569; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(r.summary)}</td>
                <td style="padding: 10px 8px; color: #6B7280; font-size: 12px;">${r.date}</td>
                <td style="padding: 10px 8px; text-align: right;">
                    <button type="button" class="btn-approve-report" data-id="${r.id}" style="background: #4B49AC; color: #fff; border: none; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✓ Mark Reviewed
                    </button>
                </td>
            </tr>
        `).join("");

        tbody.querySelectorAll(".btn-approve-report").forEach(btn => {
            btn.addEventListener("click", function () {
                const id = Number(this.getAttribute("data-id"));
                const item = workReports.find(x => x.id === id);
                if (item) {
                    item.status = "Approved";
                    saveReports();
                    renderAdminPendingAlert();
                    renderReportsHistory();
                    renderStatCards(getStats());
                    alert(`Work report from ${item.staffName} marked as Reviewed!`);
                }
            });
        });
    }

    function renderReportsHistory() {
        const container = document.getElementById("workReportsHistoryTable");
        if (!container) return;

        const isStaff = isStaffRole();
        const user = getUserInfo();

        let list = [...workReports];
        if (isStaff) {
            list = list.filter(r => String(r.staffId) === String(user.id) || r.staffName === user.name);
        }

        if (!list.length) {
            container.innerHTML = `<div style="text-align:center;color:#9CA3AF;padding:30px 0;">No work reports submitted yet. Use the form above to submit your first report!</div>`;
            return;
        }

        list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        container.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:2px solid #E5E7EB;">
                        <th style="text-align:left;padding:10px 8px;color:#6B7280;font-size:12px;font-weight:600;">DATE</th>
                        <th style="text-align:left;padding:10px 8px;color:#6B7280;font-size:12px;font-weight:600;">STAFF</th>
                        <th style="text-align:left;padding:10px 8px;color:#6B7280;font-size:12px;font-weight:600;">PROJECT</th>
                        <th style="text-align:left;padding:10px 8px;color:#6B7280;font-size:12px;font-weight:600;">HOURS</th>
                        <th style="text-align:left;padding:10px 8px;color:#6B7280;font-size:12px;font-weight:600;">SUMMARY</th>
                        <th style="text-align:left;padding:10px 8px;color:#6B7280;font-size:12px;font-weight:600;">STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(r => {
                        const statusColors = { Approved: "#10B981", Pending: "#F59E0B" };
                        const sc = statusColors[r.status] || "#6B7280";
                        return `
                            <tr style="border-bottom:1px solid #F3F4F6;">
                                <td style="padding:10px 8px;font-weight:600;color:#1F2937;">${r.date}</td>
                                <td style="padding:10px 8px;font-weight:700;color:#4B49AC;">${escapeHtml(r.staffName)}</td>
                                <td style="padding:10px 8px;color:#374151;font-weight:600;">${escapeHtml(r.project)}</td>
                                <td style="padding:10px 8px;color:#374151;font-weight:700;">${r.hours}h</td>
                                <td style="padding:10px 8px;color:#4B5563;max-width:300px;">${escapeHtml(r.summary)}</td>
                                <td style="padding:10px 8px;"><span style="background:${sc}15;color:${sc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${r.status}</span></td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }

    function renderTaskList() {
        const container = document.getElementById("reportsTaskList");
        if (!container) return;

        let tasks = [];
        try {
            const raw = localStorage.getItem("tenspick_tasks");
            if (raw) tasks = JSON.parse(raw) || [];
        } catch (e) { tasks = []; }

        if (!tasks.length) {
            container.innerHTML = `<div style="text-align:center;color:#9CA3AF;padding:20px 0;font-size:13px;">No tasks created yet.</div>`;
            return;
        }

        container.innerHTML = tasks.slice(0, 5).map(t => {
            const statusColors = { completed: "#10B981", in_progress: "#F59E0B", todo: "#6B7280" };
            const sc = statusColors[t.status] || "#6B7280";
            const progress = t.status === "completed" ? 100 : (t.status === "in_progress" ? 50 : 0);

            return `
                <div style="padding: 12px 14px; background: #F9FAFB; border-radius: 10px; border: 1px solid #E5E7EB;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                        <div style="flex: 1; min-width: 0;">
                            <strong style="font-size: 13px; color: #1F2937; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.task_name || t.title || "Task")}</strong>
                            <span style="font-size: 11px; color: #9CA3AF;">${escapeHtml(t.project_name || "Project")}</span>
                        </div>
                        <span style="font-size: 11px; background: ${sc}15; color: ${sc}; padding: 2px 8px; border-radius: 20px; font-weight: 700; margin-left: 10px; text-transform: uppercase;">${escapeHtml(t.status || "todo")}</span>
                    </div>
                    <div style="background: #E5E7EB; border-radius: 100px; height: 5px; overflow: hidden; margin-bottom: 4px;">
                        <div style="height: 100%; border-radius: 100px; background: ${sc}; width: ${progress}%;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 11px; color: #9CA3AF;">${progress}%</span>
                        <span style="font-size: 11px; color: #9CA3AF;">Due: ${t.due_date || "—"}</span>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderHoursChart() {
        const container = document.getElementById("reportsHoursChart");
        if (!container) return;

        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const dayHours = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

        // Aggregate real hours logged per day from workReports
        workReports.forEach(r => {
            if (r.date) {
                const dayName = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
                if (dayHours[dayName] !== undefined) {
                    dayHours[dayName] += parseFloat(r.hours) || 0;
                }
            }
        });

        const data = days.map(d => ({ day: d, hours: dayHours[d] }));
        const maxHours = Math.max(...data.map(d => d.hours), 8);

        container.innerHTML = data.map(d => {
            const pct = (d.hours / maxHours) * 100;
            return `
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 12px; color: #6B7280; font-weight: 600; width: 28px; flex-shrink: 0;">${escapeHtml(d.day)}</span>
                    <div style="flex: 1; background: #F3F4F6; border-radius: 100px; height: 16px; overflow: hidden;">
                        <div style="height: 100%; border-radius: 100px; background: linear-gradient(90deg, #4B49AC, #7C79D4); width: ${pct}%; transition: width 0.5s;"></div>
                    </div>
                    <span style="font-size: 12px; color: #374151; font-weight: 700; width: 36px; text-align: right; flex-shrink: 0;">${d.hours}h</span>
                </div>
            `;
        }).join("");
    }

    function renderDeadlines() {
        const container = document.getElementById("reportsDeadlines");
        if (!container) return;

        let tasks = [];
        try {
            const raw = localStorage.getItem("tenspick_tasks");
            if (raw) tasks = JSON.parse(raw) || [];
        } catch (e) { tasks = []; }

        const today = new Date().toISOString().substring(0, 10);
        const upcoming = tasks.filter(t => t.due_date && t.status !== "completed");

        if (!upcoming.length) {
            container.innerHTML = `<p style="color:#9CA3AF;font-size:13px;text-align:center;">No upcoming task deadlines.</p>`;
            return;
        }

        container.innerHTML = upcoming.slice(0, 5).map(t => `
            <div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: #F9FAFB; border-radius: 8px; border: 1px solid #E5E7EB;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444; flex-shrink: 0;"></div>
                <div style="flex: 1; min-width: 0;">
                    <strong style="font-size: 12px; color: #1F2937; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(t.task_name || t.title)}</strong>
                    <span style="font-size: 11px; color: #9CA3AF;">${escapeHtml(t.project_name || "Project")}</span>
                </div>
                <div style="font-size: 11px; color: #EF4444; font-weight: 700; white-space: nowrap;">${escapeHtml(t.due_date)}</div>
            </div>
        `).join("");
    }

    function bindEvents() {
        const form = document.getElementById("submitWorkReportForm");
        if (form) {
            form.addEventListener("submit", function (e) {
                e.preventDefault();
                const user = getUserInfo();
                const newReport = {
                    id: Date.now(),
                    staffId: user.id || "staff_1",
                    staffName: user.name || "Staff Member",
                    project: document.getElementById("reportProjectName")?.value || "General Work",
                    hours: parseFloat(document.getElementById("reportHoursSpent")?.value || "8"),
                    summary: document.getElementById("reportSummary")?.value || "",
                    date: new Date().toISOString().split("T")[0],
                    status: "Pending"
                };

                workReports.unshift(newReport);
                saveReports();
                form.reset();

                renderAdminPendingAlert();
                renderReportsHistory();
                renderStatCards(getStats());
                renderHoursChart();
                alert("Work report submitted successfully to Admin!");
            });
        }
    }

    function updateHeaderUI() {
        const isStaff = isStaffRole();
        const badge = document.getElementById("reportsRoleBadge");
        const title = document.getElementById("reportsTitle");
        const subtitle = document.getElementById("reportsSubtitle");

        if (badge) {
            badge.textContent = isStaff ? "Staff Portal" : "Admin Dashboard";
            badge.style.background = isStaff ? "#EEF2FF" : "#FEF3C7";
            badge.style.color = isStaff ? "#4B49AC" : "#D97706";
            badge.style.borderColor = isStaff ? "#C7D2FE" : "#FDE68A";
        }

        if (isStaff) {
            if (title) title.textContent = "My Work Reports";
            if (subtitle) subtitle.textContent = "Submit your daily work progress and view performance stats";
        } else {
            if (title) title.textContent = "Staff Work Reports Overview";
            if (subtitle) subtitle.textContent = "Review work reports submitted by staff members and track progress";
        }
    }

    function init() {
        loadReportsData();
        updateHeaderUI();
        renderStatCards(getStats());
        renderAdminPendingAlert();
        renderTaskList();
        renderHoursChart();
        renderDeadlines();
        renderReportsHistory();
        bindEvents();
    }

    function destroy() {}

    window.TenspickReports = { init, destroy };

})(window, document);
