"use strict";

/**
 * ============================================================
 * TENSPICK CRM - ADMIN CHAT MODULE (Staff Side)
 * Staff can only chat with admin — messages stored in
 * localStorage keyed by staff ID for demo purposes.
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let messages = [];
    let storageKey = "tenspick_staff_admin_chat_default";

    function getUser() {
        try {
            const raw = sessionStorage.getItem("tenspick_user");
            return raw ? JSON.parse(raw) : { name: "Staff User", id: 0 };
        } catch (e) {
            return { name: "Staff User", id: 0 };
        }
    }

    function escapeHtml(v) {
        const d = document.createElement("div");
        d.textContent = String(v || "");
        return d.innerHTML;
    }

    function formatTime(iso) {
        try {
            return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
        } catch (e) {
            return "";
        }
    }

    function formatDate(iso) {
        try {
            return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
        } catch (e) {
            return "";
        }
    }

    function loadMessages() {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) messages = JSON.parse(raw) || [];
        } catch (e) {
            messages = [];
        }

        // Demo welcome message if empty
        if (!messages.length) {
            messages = [
                {
                    id: 1,
                    sender: "admin",
                    senderName: "Tenspick Admin",
                    text: "Welcome to the staff messaging portal! Feel free to reach out with any questions or updates. We typically respond within a few hours. 👋",
                    timestamp: new Date(Date.now() - 3600000).toISOString()
                }
            ];
            saveMessages();
        }
    }

    function saveMessages() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(messages));
        } catch (e) {}
    }

    function scrollToBottom() {
        const container = document.getElementById("adminChatMessages");
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function renderMessages(user) {
        const container = document.getElementById("adminChatMessages");
        if (!container) return;

        if (!messages.length) {
            container.innerHTML = `<div style="text-align:center;color:#9CA3AF;padding:40px 20px;font-size:13px;">No messages yet. Say hello to the admin! 👋</div>`;
            return;
        }

        // Group messages by date
        let lastDate = "";
        const html = messages.map(function (msg) {
            const isMe = msg.sender === "staff";
            const msgDate = formatDate(msg.timestamp);
            let dateDivider = "";

            if (msgDate !== lastDate) {
                lastDate = msgDate;
                dateDivider = `<div style="text-align:center;margin:10px 0 6px;"><span style="background:#F3F4F6;color:#9CA3AF;font-size:11px;font-weight:600;padding:3px 12px;border-radius:20px;">${escapeHtml(msgDate)}</span></div>`;
            }

            const bubbleStyle = isMe
                ? "background: linear-gradient(135deg, #4B49AC, #6665C8); color: #fff; border-radius: 16px 16px 4px 16px; margin-left: auto;"
                : "background: #F3F4F6; color: #1F2937; border-radius: 16px 16px 16px 4px;";

            const avatarContent = isMe
                ? `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#4B49AC,#7C79D4);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">${escapeHtml((user.name || "S").charAt(0).toUpperCase())}</div>`
                : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#1E1B4B,#4B49AC);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;">A</div>`;

            return `
                ${dateDivider}
                <div style="display:flex;gap:8px;align-items:flex-end;${isMe ? "flex-direction:row-reverse;" : ""}">
                    ${avatarContent}
                    <div style="max-width: 70%;">
                        ${!isMe ? `<div style="font-size:11px;color:#9CA3AF;font-weight:600;margin-bottom:2px;padding-left:4px;">${escapeHtml(msg.senderName || "Admin")}</div>` : ""}
                        <div style="${bubbleStyle} padding: 10px 14px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
                            <p style="margin:0;font-size:13px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(msg.text)}</p>
                        </div>
                        <div style="font-size:10px;color:#9CA3AF;margin-top:3px;${isMe ? "text-align:right;padding-right:4px;" : "padding-left:4px;"}">${formatTime(msg.timestamp)}</div>
                    </div>
                </div>
            `;
        }).join("");

        container.innerHTML = html;
        scrollToBottom();
    }

    function sendMessage(user) {
        const input = document.getElementById("adminChatInput");
        const text = (input ? input.value : "").trim();
        if (!text) return;

        const newMsg = {
            id: Date.now(),
            sender: "staff",
            senderName: user.name || "Staff",
            text: text,
            timestamp: new Date().toISOString()
        };

        messages.push(newMsg);
        saveMessages();

        if (input) input.value = "";
        renderMessages(user);
        scrollToBottom();

        // Simulate admin auto-reply after 2-5 seconds (for demo)
        const delay = 2000 + Math.random() * 3000;
        setTimeout(function () {
            const replies = [
                "Got it! I'll look into this and get back to you shortly. 👍",
                "Thanks for reaching out! I'll respond as soon as possible.",
                "Noted. Please give me a few minutes to check on this.",
                "Received your message. I'll update you soon!",
                "Okay, let me check that for you right away."
            ];
            const reply = {
                id: Date.now() + 1,
                sender: "admin",
                senderName: "Tenspick Admin",
                text: replies[Math.floor(Math.random() * replies.length)],
                timestamp: new Date().toISOString()
            };
            messages.push(reply);
            saveMessages();
            // Only re-render if page still active
            if (document.getElementById("adminChatPage")) {
                renderMessages(user);
            }
        }, delay);
    }

    function bindEvents(user) {
        const sendBtn = document.getElementById("adminChatSendBtn");
        const input = document.getElementById("adminChatInput");

        if (sendBtn) {
            sendBtn.addEventListener("click", function () { sendMessage(user); });
        }

        if (input) {
            input.addEventListener("keydown", function (e) {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(user);
                }
            });
            // Focus input when page loads
            setTimeout(function () { input.focus(); }, 100);
        }
    }

    function init() {
        const user = getUser();
        const uid = String(user.id || user.email || "default").replace(/\W/g, "_");
        storageKey = "tenspick_staff_admin_chat_" + uid;

        loadMessages();
        renderMessages(user);
        bindEvents(user);
    }

    function destroy() {
        messages = [];
    }

    window.TenspickAdminChat = { init, destroy };

})(window, document);
