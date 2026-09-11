"use strict";

/**
 * ============================================================
 * TENSPICK CRM - CLIENT PORTAL
 * NOTIFICATIONS MODULE
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let root = null;
    let initialized = false;
    let destroyed = false;
    let notifications = [];

    /* ========================================================
       GET LOGGED IN CLIENT
       ======================================================== */
    function getClient() {
        try {
            const raw = sessionStorage.getItem("tenspick_client") || sessionStorage.getItem("tenspick_client_auth");
            if (raw) {
                const parsed = JSON.parse(raw);
                return parsed.client || parsed;
            }
        } catch (e) {}
        return { client_name: "Valued Client", email: "client@tenspick.org" };
    }

    /* ========================================================
       LOAD NOTIFICATIONS
       ======================================================== */
    async function loadNotifications() {
        const client = getClient();
        let list = [];

        // 1. Supabase check
        if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
            try {
                const sb = window.TenspickSupabase.getClient();
                const { data } = await sb
                    .from("notifications")
                    .select("*")
                    .eq("recipient", client.email)
                    .order("id", { ascending: false });
                if (data && Array.isArray(data)) list = data;
            } catch (e) {
                console.warn("[Client Notifications] Supabase query note:", e);
            }
        }

        // 2. LocalStorage cache check
        if (!list.length) {
            try {
                const cached = localStorage.getItem("tenspick_client_notifications");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) list = parsed;
                }
            } catch (e) {}
        }

        // 3. Fallback default notifications
        if (!list.length) {
            list = [
                {
                    id: 1,
                    type: "project",
                    title: "Project Progress Updated",
                    message: "Your project milestone 'Frontend Design Phase 1' has been marked complete.",
                    read: false,
                    created_at: new Date(Date.now() - 7200000).toISOString()
                },
                {
                    id: 2,
                    type: "payment",
                    title: "Payment Receipt Confirmed",
                    message: "We have received your advance deposit. Thank you!",
                    read: false,
                    created_at: new Date(Date.now() - 86400000).toISOString()
                },
                {
                    id: 3,
                    type: "system",
                    title: "Welcome to Tenspick Client Portal",
                    message: "Track your active software development projects and invoices in real-time.",
                    read: true,
                    created_at: new Date(Date.now() - 172800000).toISOString()
                }
            ];
            try {
                localStorage.setItem("tenspick_client_notifications", JSON.stringify(list));
            } catch (e) {}
        }

        notifications = list;
    }

    /* ========================================================
       RENDER UI
       ======================================================== */
    function render() {
        if (!root || destroyed) return;

        const unreadCount = notifications.filter(n => !n.read).length;

        root.innerHTML = `
            <div class="client-notifications-container" style="max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); padding: 24px;">
                <!-- HEADER -->
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid #E5E7EB; margin-bottom: 20px;">
                    <div>
                        <h2 style="font-size: 20px; font-weight: 700; color: #1F2937; margin: 0;">Notifications</h2>
                        <span style="font-size: 13px; color: #6B7280;">You have ${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}</span>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button type="button" id="markAllReadBtn" style="background: #F3F4F6; color: #374151; border: 1px solid #D1D5DB; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
                            <i class="bi bi-check2-all" style="margin-right: 4px;"></i> Mark all as read
                        </button>
                        <button type="button" id="clearAllNotifsBtn" style="background: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
                            <i class="bi bi-trash" style="margin-right: 4px;"></i> Clear all
                        </button>
                    </div>
                </div>

                <!-- LIST -->
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${notifications.length ? notifications.map(renderNotificationItem).join("") : `
                        <div style="text-align: center; padding: 40px 20px; color: #9CA3AF;">
                            <i class="bi bi-bell-slash" style="font-size: 40px; display: block; margin-bottom: 12px;"></i>
                            <strong style="display: block; font-size: 16px; color: #4B5563;">No notifications found</strong>
                            <span style="font-size: 13px;">You're all caught up!</span>
                        </div>
                    `}
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderNotificationItem(n) {
        const isUnread = !n.read;
        const iconClass = n.type === "payment" ? "bi-credit-card-fill" : (n.type === "project" ? "bi-kanban-fill" : "bi-bell-fill");
        const iconBg = n.type === "payment" ? "#10B981" : (n.type === "project" ? "#4B49AC" : "#F59E0B");
        const timeStr = n.created_at ? new Date(n.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : "";

        return `
            <div style="display: flex; gap: 16px; padding: 16px; border-radius: 10px; background: ${isUnread ? '#F0F5FF' : '#F9FAFB'}; border: 1px solid ${isUnread ? '#C7D2FE' : '#E5E7EB'}; transition: all 0.2s;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${iconBg}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
                    <i class="bi ${iconClass}"></i>
                </div>
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                        <strong style="font-size: 15px; color: #1F2937;">${escapeHtml(n.title)}</strong>
                        <span style="font-size: 12px; color: #6B7280;">${timeStr}</span>
                    </div>
                    <p style="font-size: 14px; color: #4B5563; margin: 0 0 8px 0; line-height: 1.4;">${escapeHtml(n.message)}</p>
                    ${isUnread ? `
                        <button type="button" class="mark-single-read" data-id="${n.id}" style="background: none; border: none; color: #4B49AC; font-size: 12px; font-weight: 600; padding: 0; cursor: pointer;">
                            Mark as read
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    function bindEvents() {
        const markAllBtn = document.getElementById("markAllReadBtn");
        const clearBtn = document.getElementById("clearAllNotifsBtn");

        if (markAllBtn) {
            markAllBtn.addEventListener("click", function () {
                notifications.forEach(n => n.read = true);
                saveAndRender();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", function () {
                notifications = [];
                saveAndRender();
            });
        }

        if (root) {
            root.querySelectorAll(".mark-single-read").forEach(btn => {
                btn.addEventListener("click", function () {
                    const id = Number(this.dataset.id);
                    const item = notifications.find(n => n.id === id);
                    if (item) {
                        item.read = true;
                        saveAndRender();
                    }
                });
            });
        }
    }

    function saveAndRender() {
        try {
            localStorage.setItem("tenspick_client_notifications", JSON.stringify(notifications));
        } catch (e) {}
        render();

        // Update topbar badges if available
        const unreadCount = notifications.filter(n => !n.read).length;
        const sideBadge = document.getElementById("clientNotificationBadge");
        const topBadge = document.getElementById("clientTopNotificationBadge");
        if (sideBadge) {
            sideBadge.textContent = unreadCount;
            sideBadge.hidden = unreadCount === 0;
        }
        if (topBadge) {
            topBadge.textContent = unreadCount;
            topBadge.hidden = unreadCount === 0;
        }
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = String(value ?? "");
        return div.innerHTML;
    }

    /* ========================================================
       SPA ROUTER CONTRACT
       ======================================================== */
    async function init(container) {
        root = container || document.getElementById("clientPageContainer");
        destroyed = false;
        initialized = true;

        await loadNotifications();
        render();
        return true;
    }

    function destroy() {
        destroyed = true;
        initialized = false;
        if (root) root.innerHTML = "";
    }

    function refresh() {
        return init(root);
    }

    window.TenspickClientNotifications = {
        init: init,
        destroy: destroy,
        refresh: refresh
    };

})(window, document);
