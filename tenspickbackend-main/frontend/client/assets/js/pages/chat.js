"use strict";

/**
 * ============================================================
 * TENSPICK CRM - CLIENT PORTAL
 * CHAT WITH ADMIN MODULE
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let root = null;
    let initialized = false;
    let destroyed = false;
    let messages = [];

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
       LOAD MESSAGES
       ======================================================== */
    async function loadMessages() {
        const client = getClient();
        let list = [];

        // 1. Supabase check
        if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
            try {
                const sb = window.TenspickSupabase.getClient();
                const { data } = await sb
                    .from("messages")
                    .select("*")
                    .or(`sender.eq.${client.email},recipient.eq.${client.email}`)
                    .order("id", { ascending: true });
                if (data && Array.isArray(data)) list = data;
            } catch (e) {
                console.warn("[Client Chat] Supabase query note:", e);
            }
        }

        // 2. LocalStorage cache check
        if (!list.length) {
            try {
                const cached = localStorage.getItem("tenspick_client_messages");
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) list = parsed;
                }
            } catch (e) {}
        }

        // 3. Fallback default welcome messages
        if (!list.length) {
            list = [
                {
                    id: 1,
                    sender_type: "admin",
                    sender_name: "Tenspick Admin",
                    message: "Welcome to Tenspick Client Portal! How can we assist you today?",
                    created_at: new Date(Date.now() - 3600000).toISOString()
                },
                {
                    id: 2,
                    sender_type: "admin",
                    sender_name: "Project Manager",
                    message: "Feel free to leave any questions regarding your active project deliverables here.",
                    created_at: new Date(Date.now() - 1800000).toISOString()
                }
            ];
            try {
                localStorage.setItem("tenspick_client_messages", JSON.stringify(list));
            } catch (e) {}
        }

        messages = list;
    }

    /* ========================================================
       RENDER CHAT UI
       ======================================================== */
    function render() {
        if (!root || destroyed) return;

        const client = getClient();
        const clientName = client.client_name || client.name || "Client";

        root.innerHTML = `
            <div class="client-chat-container" style="max-width: 900px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); overflow: hidden; display: flex; flex-direction: column; height: calc(100vh - 180px); min-height: 500px;">
                <!-- CHAT HEADER -->
                <div style="padding: 16px 24px; background: #4B49AC; color: #fff; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 18px;">
                            <i class="bi bi-headset"></i>
                        </div>
                        <div>
                            <strong style="display: block; font-size: 16px;">Tenspick Support & Admin</strong>
                            <span style="font-size: 12px; opacity: 0.9;"><i class="bi bi-circle-fill" style="font-size: 8px; color: #22C55E; margin-right: 4px;"></i> Online | Support Team</span>
                        </div>
                    </div>
                    <div style="font-size: 13px; background: rgba(255,255,255,0.15); padding: 4px 12px; border-radius: 20px;">
                        ${escapeHtml(clientName)}
                    </div>
                </div>

                <!-- CHAT MESSAGES BODY -->
                <div id="chatMessagesList" style="flex: 1; padding: 20px; overflow-y: auto; background: #F9FAFB; display: flex; flex-direction: column; gap: 16px;">
                    ${messages.map(renderMessageItem).join("")}
                </div>

                <!-- CHAT INPUT FOOTER -->
                <form id="chatSendForm" style="padding: 16px 20px; background: #fff; border-top: 1px solid #E5E7EB; display: flex; gap: 12px; align-items: center;">
                    <input type="text" id="chatInputText" placeholder="Type your message to Admin..." required style="flex: 1; padding: 12px 16px; border: 1px solid #D1D5DB; border-radius: 8px; font-size: 14px; outline: none; transition: border 0.2s;" />
                    <button type="submit" style="background: #4B49AC; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                        <span>Send</span>
                        <i class="bi bi-send-fill"></i>
                    </button>
                </form>
            </div>
        `;

        scrollToBottom();
        bindFormEvents();
    }

    function renderMessageItem(msg) {
        const isAdmin = msg.sender_type === "admin";
        const align = isAdmin ? "flex-start" : "flex-end";
        const bg = isAdmin ? "#FFFFFF" : "#4B49AC";
        const color = isAdmin ? "#1F2937" : "#FFFFFF";
        const border = isAdmin ? "1px solid #E5E7EB" : "none";
        const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

        return `
            <div style="display: flex; flex-direction: column; align-items: ${align}; width: 100%;">
                <span style="font-size: 11px; color: #6B7280; margin-bottom: 4px; padding: 0 4px;">
                    ${escapeHtml(msg.sender_name || (isAdmin ? "Tenspick Admin" : "You"))} • ${timeStr}
                </span>
                <div style="max-width: 75%; background: ${bg}; color: ${color}; border: ${border}; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    ${escapeHtml(msg.message)}
                </div>
            </div>
        `;
    }

    function bindFormEvents() {
        const form = document.getElementById("chatSendForm");
        const input = document.getElementById("chatInputText");
        if (form && input) {
            form.addEventListener("submit", async function (e) {
                e.preventDefault();
                const text = input.value.trim();
                if (!text) return;

                const client = getClient();
                const newMsg = {
                    id: Date.now(),
                    sender_type: "client",
                    sender_name: client.client_name || client.name || "Client",
                    sender: client.email || "client",
                    recipient: "admin@tenspick.org",
                    message: text,
                    created_at: new Date().toISOString()
                };

                messages.push(newMsg);
                input.value = "";
                render();

                // Save to LocalStorage
                try {
                    localStorage.setItem("tenspick_client_messages", JSON.stringify(messages));
                } catch (err) {}

                // Save to Supabase if configured
                if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                    try {
                        const sb = window.TenspickSupabase.getClient();
                        await sb.from("messages").insert([{
                            sender_type: "client",
                            sender_name: newMsg.sender_name,
                            sender: newMsg.sender,
                            recipient: "admin@tenspick.org",
                            message: text
                        }]);
                    } catch (sbErr) {
                        console.warn("[Client Chat] Supabase save note:", sbErr);
                    }
                }

                // Simulate admin auto-reply for client assurance after 2 seconds
                setTimeout(() => {
                    if (destroyed) return;
                    messages.push({
                        id: Date.now() + 1,
                        sender_type: "admin",
                        sender_name: "Tenspick Admin",
                        message: "Thank you for reaching out! Our team has received your query and will reply shortly.",
                        created_at: new Date().toISOString()
                    });
                    try {
                        localStorage.setItem("tenspick_client_messages", JSON.stringify(messages));
                    } catch (err) {}
                    render();
                }, 2000);
            });
        }
    }

    function scrollToBottom() {
        const list = document.getElementById("chatMessagesList");
        if (list) {
            list.scrollTop = list.scrollHeight;
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

        await loadMessages();
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

    window.TenspickClientChat = {
        init: init,
        destroy: destroy,
        refresh: refresh
    };

})(window, document);
