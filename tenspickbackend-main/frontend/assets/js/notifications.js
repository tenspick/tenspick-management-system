/* Notifications Page Module - Dynamic & Persistent */
(function (window, document) {
    "use strict";

    let notifications = [];
    const NOTIF_KEY = "tenspick_notifications";
    let activeFilter = "all";

    function loadNotifications() {
        try {
            const raw = localStorage.getItem(NOTIF_KEY);
            if (raw) notifications = JSON.parse(raw) || [];
            else notifications = [];
        } catch (e) { notifications = []; }
    }

    function saveNotifications() {
        try { localStorage.setItem(NOTIF_KEY, JSON.stringify(notifications)); } catch (e) {}
    }

    function escapeHtml(v) {
        const d = document.createElement("div");
        d.textContent = String(v || "");
        return d.innerHTML;
    }

    function renderNotifications() {
        const listContainer = document.getElementById("notificationsList");
        if (!listContainer) return;

        const allChip = document.querySelector('.filter-chip[data-filter="all"]');
        const unreadChip = document.querySelector('.filter-chip[data-filter="unread"]');

        const unreadCount = notifications.filter(n => n.unread).length;
        if (allChip) allChip.textContent = `All Notifications (${notifications.length})`;
        if (unreadChip) unreadChip.textContent = `Unread (${unreadCount})`;

        let filtered = notifications;
        if (activeFilter === "unread") {
            filtered = notifications.filter(n => n.unread);
        } else if (activeFilter !== "all") {
            filtered = notifications.filter(n => n.category === activeFilter);
        }

        if (!filtered.length) {
            listContainer.innerHTML = `
                <div class="notif-empty-state" style="text-align: center; padding: 50px 20px; color: #9CA3AF; background: #fff; border-radius: 12px; border: 1px dashed #E5E7EB;">
                    <i class="bi bi-bell-slash" style="font-size: 40px; display: block; margin-bottom: 12px; color: #CBD5E1;"></i>
                    <h3 style="font-size: 16px; font-weight: 700; color: #475569; margin: 0 0 4px 0;">No Notifications</h3>
                    <p style="font-size: 13px; color: #94A3B8; margin: 0;">You have no notifications matching this category.</p>
                </div>
            `;
            return;
        }

        const iconMap = {
            leads: { icon: "bi-person-plus-fill", class: "notif-icon-blue" },
            payments: { icon: "bi-cash-stack", class: "notif-icon-green" },
            projects: { icon: "bi-flag-fill", class: "notif-icon-purple" },
            system: { icon: "bi-shield-check", class: "notif-icon-orange" }
        };

        listContainer.innerHTML = filtered.map(n => {
            const conf = iconMap[n.category] || iconMap.system;
            return `
                <article class="notification-card ${n.unread ? "unread" : ""}" data-id="${n.id}" data-category="${n.category}">
                    <div class="notif-icon ${conf.class}">
                        <i class="bi ${conf.icon}"></i>
                    </div>
                    <div class="notif-body">
                        <div class="notif-title-row">
                            <h3>${escapeHtml(n.title)}</h3>
                            <span class="notif-time">${escapeHtml(n.time || "Just now")}</span>
                        </div>
                        <p>${escapeHtml(n.message)}</p>
                        <div class="notif-footer-actions">
                            ${n.link ? `<a href="${n.link}" class="notif-link">View Details</a>` : ""}
                            ${n.unread ? `<button type="button" class="notif-mark-btn" data-action="mark-read" data-id="${n.id}">Mark as read</button>` : ""}
                            <button type="button" class="notif-delete-single-btn" data-action="delete" data-id="${n.id}" style="background:none;border:none;color:#EF4444;font-size:12px;font-weight:600;cursor:pointer;margin-left:auto;">Delete</button>
                        </div>
                    </div>
                </article>
            `;
        }).join("");

        // Bind single action handlers
        listContainer.querySelectorAll('[data-action="mark-read"]').forEach(btn => {
            btn.addEventListener("click", function () {
                const id = Number(this.getAttribute("data-id"));
                const item = notifications.find(x => x.id === id);
                if (item) {
                    item.unread = false;
                    saveNotifications();
                    renderNotifications();
                }
            });
        });

        listContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener("click", function () {
                const id = Number(this.getAttribute("data-id"));
                notifications = notifications.filter(x => x.id !== id);
                saveNotifications();
                renderNotifications();
            });
        });
    }

    function bindEvents() {
        const markAllBtn = document.getElementById("markAllReadBtn");
        const clearAllBtn = document.getElementById("clearAllBtn");
        const filterChips = document.querySelectorAll(".filter-chip");

        if (markAllBtn) {
            markAllBtn.addEventListener("click", function () {
                notifications.forEach(n => n.unread = false);
                saveNotifications();
                renderNotifications();
            });
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener("click", function () {
                // PERMANENTLY DELETE ALL READ NOTIFICATIONS
                notifications = notifications.filter(n => n.unread === true);
                saveNotifications();
                renderNotifications();
            });
        }

        filterChips.forEach(chip => {
            chip.addEventListener("click", function () {
                filterChips.forEach(c => c.classList.remove("active"));
                this.classList.add("active");
                activeFilter = this.getAttribute("data-filter") || "all";
                renderNotifications();
            });
        });
    }

    function initNotifications() {
        loadNotifications();
        bindEvents();
        renderNotifications();
    }

    window.TenspickNotifications = { init: initNotifications };
})(window, document);
