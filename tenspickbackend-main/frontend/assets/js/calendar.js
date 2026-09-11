"use strict";

/**
 * ============================================================
 * TENSPICK CRM - CALENDAR & MEETINGS MODULE
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let meetings = [];

    function getUser() {
        try {
            const raw = sessionStorage.getItem("tenspick_user");
            return raw ? JSON.parse(raw) : { name: "Staff User", email: "staff@tenspick.org" };
        } catch (e) {
            return { name: "Staff User", email: "staff@tenspick.org" };
        }
    }

    function loadMeetings() {
        try {
            const cached = localStorage.getItem("tenspick_meetings");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    meetings = parsed;
                    return;
                }
            }
        } catch (e) {}

        // Default demo meetings
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfter = new Date(today);
        dayAfter.setDate(dayAfter.getDate() + 2);

        meetings = [
            {
                id: 1,
                title: "Client Project Kickoff",
                date: today.toISOString().split("T")[0],
                time: "10:00",
                type: "client",
                link: "https://meet.google.com/abc-xyz-123",
                description: "Initial client meeting to discuss project scope and timelines."
            },
            {
                id: 2,
                title: "Sprint Planning Standup",
                date: tomorrow.toISOString().split("T")[0],
                time: "09:30",
                type: "team",
                link: "Conference Room 1",
                description: "Weekly sprint planning for development team."
            },
            {
                id: 3,
                title: "UI Design Review",
                date: dayAfter.toISOString().split("T")[0],
                time: "14:00",
                type: "review",
                link: "https://meet.google.com/def-uvw-456",
                description: "Review latest design mockups with the client."
            }
        ];
        saveMeetings();
    }

    function saveMeetings() {
        try { localStorage.setItem("tenspick_meetings", JSON.stringify(meetings)); } catch (e) {}
    }

    function getTypeColor(type) {
        const map = { client: "#4B49AC", team: "#10B981", review: "#F59E0B" };
        return map[type] || "#6B7280";
    }

    function getTypLabel(type) {
        const map = { client: "Client Meeting", team: "Team Standup", review: "Project Review" };
        return map[type] || type;
    }

    function escapeHtml(v) {
        const d = document.createElement("div");
        d.textContent = String(v || "");
        return d.innerHTML;
    }

    function renderEvents() {
        const container = document.getElementById("calendarEventsList");
        if (!container) return;

        const sorted = [...meetings].sort((a, b) => {
            const da = new Date(a.date + "T" + (a.time || "00:00"));
            const db = new Date(b.date + "T" + (b.time || "00:00"));
            return da - db;
        });

        if (!sorted.length) {
            container.innerHTML = `<div style="text-align: center; padding: 40px 20px; color: #9CA3AF;">
                <i class="bi bi-calendar-x" style="font-size: 40px; display: block; margin-bottom: 12px;"></i>
                <strong style="font-size: 16px; color: #4B5563; display: block;">No meetings scheduled</strong>
                <span style="font-size: 13px;">Use the form to schedule a new meeting</span>
            </div>`;
            return;
        }

        container.innerHTML = sorted.map(m => {
            const color = getTypeColor(m.type);
            const dateStr = m.date ? new Date(m.date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" }) : "";
            const isLink = m.link && m.link.startsWith("http");
            return `
                <div style="display: flex; gap: 16px; padding: 16px; border-radius: 10px; border: 1px solid #E5E7EB; background: #F9FAFB; transition: box-shadow 0.2s;" class="calendar-meeting-item">
                    <div style="width: 52px; height: 52px; border-radius: 12px; background: ${color}20; border: 2px solid ${color}40; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0;">
                        <span style="font-size: 18px; font-weight: 800; color: ${color}; line-height: 1;">${new Date(m.date + "T12:00:00").getDate()}</span>
                        <span style="font-size: 10px; color: ${color}; font-weight: 700; text-transform: uppercase;">${new Date(m.date + "T12:00:00").toLocaleString("en-IN", { month: "short" })}</span>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                            <strong style="font-size: 14px; color: #1F2937; display: block;">${escapeHtml(m.title)}</strong>
                            <span style="font-size: 11px; background: ${color}15; color: ${color}; padding: 2px 8px; border-radius: 20px; font-weight: 700; white-space: nowrap; margin-left: 8px;">${getTypLabel(m.type)}</span>
                        </div>
                        <div style="font-size: 12px; color: #6B7280; display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 4px;">
                            <span><i class="bi bi-clock" style="margin-right: 3px;"></i>${dateStr} at ${m.time || "TBD"}</span>
                            ${m.link ? `<span><i class="bi bi-${isLink ? "camera-video" : "geo-alt"}" style="margin-right: 3px;"></i>${isLink ? `<a href="${escapeHtml(m.link)}" target="_blank" rel="noopener" style="color: #4B49AC;">Join Meeting</a>` : escapeHtml(m.link)}</span>` : ""}
                        </div>
                        ${m.description ? `<p style="font-size: 12px; color: #9CA3AF; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(m.description)}</p>` : ""}
                    </div>
                    <button type="button" data-delete-meeting="${m.id}" style="background: none; border: none; color: #EF4444; cursor: pointer; font-size: 16px; padding: 4px; flex-shrink: 0; align-self: center;" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        }).join("");

        container.querySelectorAll("[data-delete-meeting]").forEach(btn => {
            btn.addEventListener("click", function () {
                const id = Number(this.dataset.deleteMeeting);
                meetings = meetings.filter(m => m.id !== id);
                saveMeetings();
                renderEvents();
            });
        });
    }

    function bindForm() {
        const form = document.getElementById("calendarMeetingForm");
        if (!form) return;

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            const user = getUser();
            const newMeeting = {
                id: Date.now(),
                title: document.getElementById("meetTitle")?.value || "",
                date: document.getElementById("meetDate")?.value || "",
                time: document.getElementById("meetTime")?.value || "",
                type: document.getElementById("meetType")?.value || "team",
                link: document.getElementById("meetLink")?.value || "",
                description: document.getElementById("meetDesc")?.value || "",
                created_by: user.name || user.email
            };
            meetings.push(newMeeting);
            saveMeetings();
            renderEvents();
            form.reset();
        });
    }

    function init() {
        loadMeetings();
        renderEvents();
        bindForm();
    }

    function destroy() {}

    window.TenspickCalendar = { init, destroy };

})(window, document);
