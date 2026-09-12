"use strict";

/**
 * ============================================================
 * TENSPICK CRM - LEAVE & ATTENDANCE MODULE (DUAL MODE: ADMIN & STAFF)
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let clockInterval = null;
    let attendanceRecords = [];
    let leaveRequests = [];
    let holidayList = [];
    let checkedInTime = null;

    const GLOBAL_LEAVE_KEY = "tenspick_global_leave_requests";
    const GLOBAL_HOLIDAY_KEY = "tenspick_global_holidays";
    const GLOBAL_ATTENDANCE_KEY = "tenspick_global_attendance";

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

    function loadData() {
        const user = getUserInfo();
        const staffId = String(user.id || user.email || "staff");

        // Attendance
        try {
            const raw = localStorage.getItem(GLOBAL_ATTENDANCE_KEY);
            if (raw) attendanceRecords = JSON.parse(raw) || [];
        } catch (e) { attendanceRecords = []; }

        // Leave Requests
        try {
            const raw = localStorage.getItem(GLOBAL_LEAVE_KEY);
            if (raw) leaveRequests = JSON.parse(raw) || [];
        } catch (e) { leaveRequests = []; }

        // Holidays
        try {
            const raw = localStorage.getItem(GLOBAL_HOLIDAY_KEY);
            if (raw) holidayList = JSON.parse(raw) || [];
        } catch (e) { holidayList = []; }

        if (!holidayList.length) {
            holidayList = [
                { id: 1, name: "Republic Day", date: "2026-01-26", day: "Monday", type: "National" },
                { id: 2, name: "Independence Day", date: "2026-08-15", day: "Saturday", type: "National" },
                { id: 3, name: "Gandhi Jayanti", date: "2026-10-02", day: "Friday", type: "National" },
                { id: 4, name: "Diwali Festival", date: "2026-11-01", day: "Sunday", type: "Festival" },
                { id: 5, name: "Christmas Day", date: "2026-12-25", day: "Friday", type: "Festival" }
            ];
            saveHolidays();
        }

        // Check active checkin state
        try {
            const ci = localStorage.getItem("tenspick_checkin_" + staffId);
            if (ci) checkedInTime = new Date(ci);
        } catch (e) { checkedInTime = null; }
    }

    function saveAttendance() {
        try { localStorage.setItem(GLOBAL_ATTENDANCE_KEY, JSON.stringify(attendanceRecords)); } catch (e) {}
    }

    function saveLeaves() {
        try { localStorage.setItem(GLOBAL_LEAVE_KEY, JSON.stringify(leaveRequests)); } catch (e) {}
    }

    function saveHolidays() {
        try { localStorage.setItem(GLOBAL_HOLIDAY_KEY, JSON.stringify(holidayList)); } catch (e) {}
    }

    function startClock() {
        const timeEl = document.getElementById("attendanceLiveTime");
        const dateEl = document.getElementById("attendanceTodayDate");

        function tick() {
            const now = new Date();
            if (timeEl) timeEl.textContent = now.toLocaleTimeString("en-IN", { hour12: false });
            if (dateEl) dateEl.textContent = now.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

            if (checkedInTime) {
                const diff = Math.max(0, Math.floor((now - checkedInTime) / 1000 / 60));
                const hrs = (diff / 60).toFixed(1);
                const hoursEl = document.getElementById("attendanceHours");
                if (hoursEl) hoursEl.textContent = hrs + "h";
            }
        }

        tick();
        clockInterval = setInterval(tick, 1000);
    }

    function updateRoleUI() {
        const isStaff = isStaffRole();
        const badge = document.getElementById("attendanceRoleBadge");
        const title = document.getElementById("attendancePageTitle");
        const subtitle = document.getElementById("attendancePageSubtitle");
        const adminLeaveCard = document.getElementById("adminLeaveRequestsCard");
        const addHolidayBtn = document.getElementById("addHolidayBtn");
        const staffFilterContainer = document.getElementById("adminStaffFilterContainer");

        if (badge) {
            badge.textContent = isStaff ? "Staff View" : "Admin Panel";
            badge.style.background = isStaff ? "#EEF2FF" : "#FEF3C7";
            badge.style.color = isStaff ? "#4B49AC" : "#D97706";
            badge.style.borderColor = isStaff ? "#C7D2FE" : "#FDE68A";
        }

        if (isStaff) {
            if (title) title.textContent = "My Leave & Attendance";
            if (subtitle) subtitle.textContent = "Check in daily, apply for leaves and view company holidays";
            if (adminLeaveCard) adminLeaveCard.style.display = "none";
            if (addHolidayBtn) addHolidayBtn.style.display = "none";
            if (staffFilterContainer) staffFilterContainer.style.display = "none";
            document.querySelectorAll(".adminHolidayCol").forEach(el => el.style.display = "none");
        } else {
            if (title) title.textContent = "Staff Leave & Attendance Management";
            if (subtitle) subtitle.textContent = "Approve staff leave requests, update holiday schedule & monitor attendance";
            if (adminLeaveCard) adminLeaveCard.style.display = "block";
            if (addHolidayBtn) addHolidayBtn.style.display = "inline-block";
            if (staffFilterContainer) staffFilterContainer.style.display = "block";
            document.querySelectorAll(".adminHolidayCol").forEach(el => el.style.display = "table-cell");
        }
    }

    function renderAdminPendingLeaves() {
        const container = document.getElementById("adminPendingLeaveList");
        const badge = document.getElementById("adminPendingLeaveBadge");
        if (!container) return;

        const pending = leaveRequests.filter(r => r.status === "Pending");
        if (badge) badge.textContent = pending.length + " Pending";

        if (!pending.length) {
            container.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px; color: #059669; font-weight: 600;">All leave requests processed! No pending items.</td></tr>`;
            return;
        }

        container.innerHTML = pending.map(lr => `
            <tr style="border-bottom: 1px dashed #FDE68A;">
                <td style="padding: 10px 8px; font-weight: 700; color: #1F2937;">${lr.staffName || "Staff Member"}</td>
                <td style="padding: 10px 8px;"><span style="background: #EEF2FF; color: #4B49AC; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${lr.type}</span></td>
                <td style="padding: 10px 8px; color: #475569; font-size: 12px;">${lr.from} to ${lr.to}</td>
                <td style="padding: 10px 8px; color: #475569;">${lr.reason || "--"}</td>
                <td style="padding: 10px 8px; text-align: right;">
                    <button type="button" class="btn-approve-leave" data-id="${lr.id}" style="background: #10B981; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; margin-right: 6px;">
                        ✓ Approve
                    </button>
                    <button type="button" class="btn-reject-leave" data-id="${lr.id}" style="background: #EF4444; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
                        ✗ Reject
                    </button>
                </td>
            </tr>
        `).join("");

        // Attach action handlers
        container.querySelectorAll(".btn-approve-leave").forEach(btn => {
            btn.addEventListener("click", function () {
                const id = Number(this.getAttribute("data-id"));
                updateLeaveStatus(id, "Approved");
            });
        });

        container.querySelectorAll(".btn-reject-leave").forEach(btn => {
            btn.addEventListener("click", function () {
                const id = Number(this.getAttribute("data-id"));
                updateLeaveStatus(id, "Rejected");
            });
        });
    }

    function updateLeaveStatus(id, status) {
        const item = leaveRequests.find(r => r.id === id);
        if (item) {
            item.status = status;
            saveLeaves();
            renderAdminPendingLeaves();
            renderLeaveRequests();
            alert(`Leave request for ${item.staffName} has been ${status}!`);
        }
    }

    function renderAttendanceTable() {
        const tbody = document.getElementById("attendanceHistoryBody");
        if (!tbody) return;

        const isStaff = isStaffRole();
        const user = getUserInfo();
        const selectedStaff = document.getElementById("attendanceStaffFilter")?.value || "all";

        let filtered = [...attendanceRecords];

        if (isStaff) {
            filtered = filtered.filter(r => String(r.staffId) === String(user.id) || r.staffName === user.name);
        } else if (selectedStaff !== "all") {
            filtered = filtered.filter(r => String(r.staffId) === selectedStaff);
        }

        filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

        if (!filtered.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px 0;color:#9CA3AF;">No attendance records found</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.slice(0, 25).map(r => {
            const dateStr = r.date ? new Date(r.date + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "--";
            const statusColor = r.status === "Present" ? "#10B981" : (r.status === "Half Day" ? "#F59E0B" : "#EF4444");

            return `
                <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px 8px; font-weight: 600; color: #1F2937;">${dateStr}</td>
                    <td style="padding: 10px 8px; font-weight: 600; color: #4B49AC;">${r.staffName || "Staff"}</td>
                    <td style="padding: 10px 8px; color: #374151;">${r.checkin || "--"}</td>
                    <td style="padding: 10px 8px; color: #374151;">${r.checkout || "--"}</td>
                    <td style="padding: 10px 8px; color: #374151;">8.0h</td>
                    <td style="padding: 10px 8px;"><span style="background: ${statusColor}15; color: ${statusColor}; padding: 3px 8px; border-radius: 20px; font-size: 12px; font-weight: 700;">${r.status}</span></td>
                </tr>
            `;
        }).join("");
    }

    function renderHolidays() {
        const tbody = document.getElementById("holidayListBody");
        if (!tbody) return;

        const isStaff = isStaffRole();

        if (!holidayList.length) {
            tbody.innerHTML = `<tr><td colspan="${isStaff ? 4 : 5}" style="text-align:center;padding:20px;color:#9CA3AF;">No holidays scheduled.</td></tr>`;
            return;
        }

        tbody.innerHTML = holidayList.map(h => {
            const typeColor = h.type === "National" ? "#EF4444" : (h.type === "Festival" ? "#EC4899" : "#8B5CF6");
            return `
                <tr style="border-bottom: 1px solid #F3F4F6;">
                    <td style="padding: 10px 8px; font-weight: 700; color: #1F2937;">${h.name}</td>
                    <td style="padding: 10px 8px; color: #4B5563; font-weight: 600;">${h.date}</td>
                    <td style="padding: 10px 8px; color: #6B7280;">${h.day || "--"}</td>
                    <td style="padding: 10px 8px;"><span style="background: ${typeColor}15; color: ${typeColor}; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">${h.type}</span></td>
                    ${!isStaff ? `
                        <td style="padding: 10px 8px; text-align: right;" class="adminHolidayCol">
                            <button type="button" class="btn-delete-holiday" data-id="${h.id}" style="background: #FEE2E2; color: #EF4444; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;">
                                Delete
                            </button>
                        </td>
                    ` : ""}
                </tr>
            `;
        }).join("");

        if (!isStaff) {
            tbody.querySelectorAll(".btn-delete-holiday").forEach(btn => {
                btn.addEventListener("click", function () {
                    const id = Number(this.getAttribute("data-id"));
                    holidayList = holidayList.filter(h => h.id !== id);
                    saveHolidays();
                    renderHolidays();
                });
            });
        }
    }

    function renderLeaveRequests() {
        const container = document.getElementById("leaveRequestsList");
        if (!container) return;

        const isStaff = isStaffRole();
        const user = getUserInfo();

        let list = [...leaveRequests];
        if (isStaff) {
            list = list.filter(r => String(r.staffId) === String(user.id) || r.staffName === user.name);
        }

        if (!list.length) {
            container.innerHTML = `<p style="text-align:center;color:#9CA3AF;padding:20px 0;">No leave applications found.</p>`;
            return;
        }

        list.sort((a, b) => (b.from || "").localeCompare(a.from || ""));

        container.innerHTML = `
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="border-bottom:2px solid #E5E7EB;">
                        <th style="text-align:left;padding:8px;color:#6B7280;font-size:12px;font-weight:600;">STAFF</th>
                        <th style="text-align:left;padding:8px;color:#6B7280;font-size:12px;font-weight:600;">TYPE</th>
                        <th style="text-align:left;padding:8px;color:#6B7280;font-size:12px;font-weight:600;">FROM</th>
                        <th style="text-align:left;padding:8px;color:#6B7280;font-size:12px;font-weight:600;">TO</th>
                        <th style="text-align:left;padding:8px;color:#6B7280;font-size:12px;font-weight:600;">REASON</th>
                        <th style="text-align:left;padding:8px;color:#6B7280;font-size:12px;font-weight:600;">STATUS</th>
                    </tr>
                </thead>
                <tbody>
                    ${list.map(lr => {
                        const statusColors = { Approved: "#10B981", Pending: "#F59E0B", Rejected: "#EF4444" };
                        const sc = statusColors[lr.status] || "#6B7280";
                        const typeLabel = { casual: "Casual", sick: "Sick", earned: "Earned", unpaid: "Unpaid" }[lr.type] || lr.type;
                        return `
                            <tr style="border-bottom:1px solid #F3F4F6;">
                                <td style="padding:10px 8px;font-weight:600;color:#1F2937;">${lr.staffName || "Staff"}</td>
                                <td style="padding:10px 8px;font-weight:600;color:#374151;text-transform:capitalize;">${typeLabel}</td>
                                <td style="padding:10px 8px;color:#6B7280;">${lr.from}</td>
                                <td style="padding:10px 8px;color:#6B7280;">${lr.to}</td>
                                <td style="padding:10px 8px;color:#4B5563;">${lr.reason || "--"}</td>
                                <td style="padding:10px 8px;"><span style="background:${sc}15;color:${sc};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${lr.status}</span></td>
                            </tr>
                        `;
                    }).join("")}
                </tbody>
            </table>
        `;
    }

    function bindEvents() {
        const user = getUserInfo();

        // Check In / Check Out Buttons
        const checkInBtn = document.getElementById("checkInBtn");
        const checkOutBtn = document.getElementById("checkOutBtn");

        if (checkInBtn) {
            checkInBtn.addEventListener("click", function () {
                const now = new Date();
                const todayStr = now.toISOString().split("T")[0];
                const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

                checkedInTime = now;
                localStorage.setItem("tenspick_checkin_" + user.id, now.toISOString());

                attendanceRecords.unshift({
                    id: Date.now(),
                    staffId: user.id,
                    staffName: user.name,
                    date: todayStr,
                    checkin: timeStr,
                    checkout: null,
                    status: "Present"
                });
                saveAttendance();

                const checkInEl = document.getElementById("attendanceCheckIn");
                if (checkInEl) checkInEl.textContent = timeStr;
                checkInBtn.disabled = true;
                checkInBtn.style.opacity = "0.5";
                if (checkOutBtn) { checkOutBtn.disabled = false; checkOutBtn.style.opacity = "1"; }
                renderAttendanceTable();
            });
        }

        if (checkOutBtn) {
            checkOutBtn.addEventListener("click", function () {
                const now = new Date();
                const todayStr = now.toISOString().split("T")[0];
                const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });

                const item = attendanceRecords.find(r => r.date === todayStr && (r.staffId === user.id || r.staffName === user.name));
                if (item) item.checkout = timeStr;

                saveAttendance();
                checkedInTime = null;
                localStorage.removeItem("tenspick_checkin_" + user.id);

                const checkOutEl = document.getElementById("attendanceCheckOut");
                if (checkOutEl) checkOutEl.textContent = timeStr;
                checkOutBtn.disabled = true;
                checkOutBtn.style.opacity = "0.5";
                renderAttendanceTable();
            });
        }

        // Leave Apply Form
        const leaveForm = document.getElementById("leaveApplyForm");
        if (leaveForm) {
            leaveForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const request = {
                    id: Date.now(),
                    staffId: user.id || "staff_1",
                    staffName: user.name || "Staff Member",
                    type: document.getElementById("leaveType")?.value || "casual",
                    from: document.getElementById("leaveFrom")?.value || "",
                    to: document.getElementById("leaveTo")?.value || "",
                    reason: document.getElementById("leaveReason")?.value || "",
                    status: "Pending",
                    createdAt: new Date().toISOString().split("T")[0]
                };
                leaveRequests.unshift(request);
                saveLeaves();
                renderAdminPendingLeaves();
                renderLeaveRequests();
                leaveForm.reset();
                alert("Leave request submitted successfully! Admin has been notified.");
            });
        }

        // Admin Add Holiday Button & Form
        const addHolidayBtn = document.getElementById("addHolidayBtn");
        const holidayFormBox = document.getElementById("addHolidayFormBox");
        if (addHolidayBtn && holidayFormBox) {
            addHolidayBtn.addEventListener("click", function () {
                holidayFormBox.style.display = holidayFormBox.style.display === "none" ? "block" : "none";
            });
        }

        const addHolidayForm = document.getElementById("addHolidayForm");
        if (addHolidayForm) {
            addHolidayForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const name = document.getElementById("holidayName")?.value || "";
                const date = document.getElementById("holidayDate")?.value || "";
                const type = document.getElementById("holidayType")?.value || "National";
                const dObj = new Date(date + "T12:00:00");
                const dayStr = dObj.toLocaleDateString("en-US", { weekday: "long" });

                holidayList.push({ id: Date.now(), name, date, day: dayStr, type });
                saveHolidays();
                renderHolidays();
                addHolidayForm.reset();
                if (holidayFormBox) holidayFormBox.style.display = "none";
                alert("New holiday added to schedule!");
            });
        }
    }

    function init() {
        loadData();
        startClock();
        updateRoleUI();
        renderAdminPendingLeaves();
        renderAttendanceTable();
        renderHolidays();
        renderLeaveRequests();
        bindEvents();
    }

    function destroy() {
        if (clockInterval) { clearInterval(clockInterval); clockInterval = null; }
    }

    window.TenspickAttendance = { init, destroy };

})(window, document);
