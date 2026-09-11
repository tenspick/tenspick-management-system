"use strict";

/**
 * ============================================================
 * TENSPICK CRM - STAFF MY PAYMENTS MODULE
 * Staff can only VIEW their own salary/payment records.
 * ============================================================
 */

(function (window, document) {
    "use strict";

    function getUser() {
        try {
            const raw = sessionStorage.getItem("tenspick_user");
            return raw ? JSON.parse(raw) : { name: "Staff User", id: 0 };
        } catch (e) {
            return { name: "Staff User", id: 0 };
        }
    }

    function formatINR(amount) {
        return "₹" + Number(amount || 0).toLocaleString("en-IN");
    }

    function getPayments(user) {
        // Try to pull from localStorage (admin sets these via staff-payments module)
        let all = [];
        try {
            const raw = localStorage.getItem("tenspick_staff_payments");
            if (raw) all = JSON.parse(raw) || [];
        } catch (e) {}

        // Filter to this staff member
        const staffId = String(user.id || user.email || "").toLowerCase();
        const staffName = (user.name || "").toLowerCase();

        let mine = all.filter(function (p) {
            const pId = String(p.staff_id || p.staffId || "").toLowerCase();
            const pName = String(p.staff_name || p.name || "").toLowerCase();
            return pId === staffId || pName === staffName;
        });

        return mine;

    }

    function renderSummary(payments) {
        const paid = payments.filter(function (p) { return (p.status || "").toLowerCase() === "paid"; });
        const pending = payments.filter(function (p) { return (p.status || "").toLowerCase() !== "paid"; });

        const totalPaid = paid.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
        const totalPending = pending.reduce(function (s, p) { return s + Number(p.amount || 0); }, 0);
        const lastPaid = paid.sort(function (a, b) { return b.date_paid > a.date_paid ? 1 : -1; })[0];

        const totalEl = document.getElementById("staffTotalPaid");
        const countEl = document.getElementById("staffPaymentsCount");
        const pendingEl = document.getElementById("staffPendingAmount");
        const lastEl = document.getElementById("staffLastPayment");

        if (totalEl) totalEl.textContent = formatINR(totalPaid);
        if (countEl) countEl.textContent = paid.length;
        if (pendingEl) pendingEl.textContent = formatINR(totalPending);
        if (lastEl) {
            lastEl.textContent = lastPaid
                ? new Date(lastPaid.date_paid + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                : "--";
        }
    }

    function renderTable(payments) {
        const tbody = document.getElementById("staffPaymentsTableBody");
        if (!tbody) return;

        if (!payments.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:#9CA3AF;">
                <i class="bi bi-wallet" style="font-size:32px;display:block;margin-bottom:8px;"></i>
                No payment records found yet.
            </td></tr>`;
            return;
        }

        const sorted = [...payments].sort(function (a, b) {
            return (b.date_paid || "") > (a.date_paid || "") ? 1 : -1;
        });

        tbody.innerHTML = sorted.map(function (p) {
            const statusColor = (p.status || "").toLowerCase() === "paid" ? "#10B981" : "#F59E0B";
            const typeColor = (p.type || "").toLowerCase() === "bonus" ? "#8B5CF6" : "#4B49AC";
            const dateStr = p.date_paid
                ? new Date(p.date_paid + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                : "--";

            return `
                <tr style="border-bottom: 1px solid #F3F4F6; transition: background 0.15s;">
                    <td style="padding: 12px 12px; font-weight: 600; color: #1F2937;">${p.month || "--"} ${p.year || ""}</td>
                    <td style="padding: 12px 12px;">
                        <span style="background:${typeColor}15;color:${typeColor};padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700;">${p.type || "Salary"}</span>
                    </td>
                    <td style="padding: 12px 12px; font-weight: 700; color: #1F2937; font-size: 14px;">${formatINR(p.amount)}</td>
                    <td style="padding: 12px 12px; color: #6B7280;">${dateStr}</td>
                    <td style="padding: 12px 12px; color: #6B7280;">
                        <span style="display:flex;align-items:center;gap:5px;">
                            <i class="bi bi-${(p.mode || "").toLowerCase().includes("upi") ? "phone" : "bank"}" style="font-size:13px;"></i>
                            ${p.mode || "Bank Transfer"}
                        </span>
                    </td>
                    <td style="padding: 12px 12px;">
                        <span style="background:${statusColor}15;color:${statusColor};padding:3px 9px;border-radius:20px;font-size:12px;font-weight:700;">${p.status || "Pending"}</span>
                    </td>
                </tr>
            `;
        }).join("");
    }

    function init() {
        const user = getUser();
        const payments = getPayments(user);
        renderSummary(payments);
        renderTable(payments);

        const yearFilter = document.getElementById("staffPaymentYearFilter");
        if (yearFilter) {
            yearFilter.addEventListener("change", function () {
                const yr = Number(this.value);
                const filtered = payments.filter(function (p) { return Number(p.year || 2026) === yr; });
                renderTable(filtered);
                renderSummary(filtered);
            });
        }
    }

    function destroy() {}

    window.TenspickMyPayments = { init, destroy };

})(window, document);
