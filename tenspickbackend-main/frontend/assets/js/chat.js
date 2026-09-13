/* Chat Page Module - Dynamic Clients & Team Members */
(function (window, document) {
    "use strict";

    function initChat() {
        const chatForm = document.getElementById("chatForm");
        const chatInput = document.getElementById("chatMessageInput");
        const chatMessages = document.getElementById("chatMessages");
        const chatList = document.getElementById("chatList");
        const chatSearchInput = document.getElementById("chatSearchInput");
        const targetAudienceSelect = document.getElementById("chatTargetAudience");

        let clientsList = [];
        let staffList = [];
        let activeParticipant = null;  // { id, name, role, initials, type, storageKey }
        let refreshInterval = null;

        /* ======================================================
           LOAD PARTICIPANTS (Real from localStorage)
           ====================================================== */
        function loadParticipants() {
            clientsList = [];
            staffList = [];

            try {
                const raw = localStorage.getItem("tenspick_clients");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) clientsList = parsed;
                }
            } catch (e) {}

            try {
                const raw = localStorage.getItem("tenspick_staff");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) staffList = parsed;
                }
            } catch (e) {}
        }

        /* ======================================================
           STORAGE KEY HELPERS
           ====================================================== */
        function clientChatKey(clientId) {
            return "tenspick_client_messages_" + String(clientId || "default");
        }

        function staffChatKey(staffId) {
            return "tenspick_staff_admin_chat_" + String(staffId || "default");
        }

        function getMessages(storageKey) {
            try {
                const raw = localStorage.getItem(storageKey);
                if (raw) return JSON.parse(raw) || [];
            } catch (e) {}
            return [];
        }

        function saveMessages(storageKey, msgs) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(msgs));
            } catch (e) {}
        }

        async function syncSupabaseMessage(msgObj, audience) {
            if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                try {
                    const sb = window.TenspickSupabase.getClient();
                    if (sb) {
                        let recType = "all";
                        let recId = null;
                        if (audience && audience.startsWith("client_")) {
                            recType = "client";
                            recId = audience.replace("client_", "");
                        } else if (audience && audience.startsWith("staff_")) {
                            recType = "staff";
                            recId = audience.replace("staff_", "");
                        } else if (audience === "all_clients") {
                            recType = "all_clients";
                        } else if (audience === "all_staff") {
                            recType = "all_staff";
                        }

                        await sb.from("chat_messages").insert([{
                            sender_type: "admin",
                            sender_name: "Tenspick Admin",
                            receiver_type: recType,
                            receiver_id: recId ? parseInt(recId, 10) : null,
                            message: msgObj.message || msgObj.text || ""
                        }]);

                        if (audience === "all_clients" || audience === "all_staff") {
                            await sb.from("announcements").insert([{
                                text: msgObj.message || msgObj.text || "",
                                author: "Tenspick Admin",
                                time_str: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            }]);
                        }
                    }
                } catch (err) {
                    console.warn("[Chat] Supabase sync note:", err);
                }
            }
        }

        function getUnreadCount(storageKey, participantType) {
            const msgs = getMessages(storageKey);
            return msgs.filter(function (m) {
                const sender = m.sender_type || m.sender;
                return sender === participantType;
            }).length;
        }

        function getTotalUnread() {
            let total = 0;
            clientsList.forEach(function (c) {
                const key = clientChatKey(c.id || c.client_id);
                total += getUnreadCount(key, "client");
            });
            staffList.forEach(function (s) {
                const key = staffChatKey(s.id);
                total += getUnreadCount(key, "staff");
            });
            return total;
        }

        function getInitials(name) {
            if (!name) return "TP";
            const parts = String(name).trim().split(/\s+/);
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return parts[0].substring(0, 2).toUpperCase();
        }

        function getLastMessage(storageKey) {
            const msgs = getMessages(storageKey);
            if (!msgs.length) return "";
            const last = msgs[msgs.length - 1];
            return last.message || last.text || "";
        }

        function getLastTime(storageKey) {
            const msgs = getMessages(storageKey);
            if (!msgs.length) return "";
            const last = msgs[msgs.length - 1];
            const ts = last.created_at || last.timestamp;
            if (!ts) return "";
            try {
                return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            } catch (e) { return ""; }
        }

        /* ======================================================
           RENDER SIDEBAR
           ====================================================== */
        function renderSidebar(filterText) {
            if (!chatList) return;
            chatList.innerHTML = "";
            const searchLower = (filterText || "").toLowerCase();

            const filteredClients = clientsList.filter(function (c) {
                return (
                    (c.client_name || c.name || "").toLowerCase().includes(searchLower) ||
                    (c.company_name || "").toLowerCase().includes(searchLower)
                );
            });

            const filteredStaff = staffList.filter(function (s) {
                return (
                    (s.name || "").toLowerCase().includes(searchLower) ||
                    (s.designation || s.department || "").toLowerCase().includes(searchLower)
                );
            });

            if (filteredClients.length > 0) {
                const hdr = document.createElement("div");
                hdr.className = "chat-group-title";
                hdr.style.cssText = "padding: 8px 12px; font-size: 11px; font-weight: 800; color: #64748B; letter-spacing: 1px;";
                hdr.innerHTML = `<i class="bi bi-people"></i> CLIENTS (${filteredClients.length})`;
                chatList.appendChild(hdr);

                filteredClients.forEach(function (c) {
                    const cId = c.id || c.client_id;
                    const cName = c.client_name || c.name || "Client";
                    const key = clientChatKey(cId);
                    const lastMsg = getLastMessage(key);
                    const lastTime = getLastTime(key);
                    const item = document.createElement("div");
                    item.className = "chat-item";
                    item.dataset.type = "client";
                    item.dataset.id = cId;
                    item.dataset.name = cName;
                    item.innerHTML = `
                        <div class="chat-avatar">
                            <span>${getInitials(cName)}</span>
                            <span class="online-status online"></span>
                        </div>
                        <div class="chat-info">
                            <div class="chat-item-top">
                                <strong class="chat-name">${escapeHtml(cName)} <span class="chat-role-badge client" style="background:#EEF2FF; color:#4B49AC; font-size:10px; padding:2px 6px; border-radius:4px;">Client</span></strong>
                                <span class="chat-time">${escapeHtml(lastTime)}</span>
                            </div>
                            <p class="chat-preview">${escapeHtml(lastMsg || c.company_name || "No messages yet")}</p>
                        </div>
                    `;
                    item.addEventListener("click", function () {
                        selectParticipant({
                            id: cId,
                            name: cName,
                            role: "Client",
                            type: "client",
                            initials: getInitials(cName),
                            storageKey: key
                        }, item);
                    });
                    chatList.appendChild(item);
                });
            }

            if (filteredStaff.length > 0) {
                const hdr = document.createElement("div");
                hdr.className = "chat-group-title";
                hdr.style.cssText = "padding: 8px 12px; font-size: 11px; font-weight: 800; color: #64748B; letter-spacing: 1px; margin-top: 12px;";
                hdr.innerHTML = `<i class="bi bi-person-badge"></i> TEAM MEMBERS (${filteredStaff.length})`;
                chatList.appendChild(hdr);

                filteredStaff.forEach(function (s) {
                    const sName = s.name || "Staff Member";
                    const key = staffChatKey(s.id);
                    const lastMsg = getLastMessage(key);
                    const lastTime = getLastTime(key);
                    const item = document.createElement("div");
                    item.className = "chat-item";
                    item.dataset.type = "staff";
                    item.dataset.id = s.id;
                    item.dataset.name = sName;
                    item.innerHTML = `
                        <div class="chat-avatar" style="background:#7C3AED;">
                            <span>${getInitials(sName)}</span>
                            <span class="online-status online"></span>
                        </div>
                        <div class="chat-info">
                            <div class="chat-item-top">
                                <strong class="chat-name">${escapeHtml(sName)} <span class="chat-role-badge staff" style="background:#F3E8FF; color:#7C3AED; font-size:10px; padding:2px 6px; border-radius:4px;">Team</span></strong>
                                <span class="chat-time">${escapeHtml(lastTime)}</span>
                            </div>
                            <p class="chat-preview">${escapeHtml(lastMsg || s.designation || "Team Member")}</p>
                        </div>
                    `;
                    item.addEventListener("click", function () {
                        selectParticipant({
                            id: s.id,
                            name: sName,
                            role: "Team Member",
                            type: "staff",
                            initials: getInitials(sName),
                            storageKey: key
                        }, item);
                    });
                    chatList.appendChild(item);
                });
            }

            if (!filteredClients.length && !filteredStaff.length) {
                chatList.innerHTML = `<div style="padding:30px 20px;text-align:center;color:#94a3b8;font-size:13px;"><i class="bi bi-chat-left-dots" style="font-size:24px;display:block;margin-bottom:8px;"></i>No conversations found. Add clients or staff members to start chatting.</div>`;
            }

            const badge = document.getElementById("unreadChatCount");
            if (badge) {
                const total = getTotalUnread();
                badge.textContent = total > 0 ? total + " New" : "0 New";
            }

            if (activeParticipant) {
                const found = chatList.querySelector(`[data-type="${activeParticipant.type}"][data-id="${activeParticipant.id}"]`);
                if (found) found.classList.add("active");
            } else {
                const firstItem = chatList.querySelector(".chat-item");
                if (firstItem) firstItem.click();
            }
        }

        /* ======================================================
           RENDER MESSAGES
           ====================================================== */
        function renderConversation() {
            if (!chatMessages) return;

            if (!activeParticipant) {
                chatMessages.innerHTML = `
                    <div style="text-align:center;color:#94a3b8;padding:60px 20px;font-size:14px;">
                        <i class="bi bi-chat-square-text" style="font-size:36px;display:block;margin-bottom:12px;color:#CBD5E1;"></i>
                        Select a conversation from the sidebar to view messages
                    </div>
                `;
                return;
            }

            const msgs = getMessages(activeParticipant.storageKey);
            if (!msgs.length) {
                chatMessages.innerHTML = `
                    <div class="chat-date-divider"><span>No Messages Yet</span></div>
                    <div style="text-align:center;color:#94a3b8;padding:40px 20px;font-size:13px;">
                        No messages yet with ${escapeHtml(activeParticipant.name)}. Send a message below to start chatting.
                    </div>
                `;
                return;
            }

            let html = "";
            let lastDate = "";

            msgs.forEach(function (msg) {
                const senderType = msg.sender_type || msg.sender;
                const isAdmin = senderType === "admin";
                const ts = msg.created_at || msg.timestamp || "";
                let msgDate = "";
                let msgTime = "";
                try {
                    if (ts) {
                        const d = new Date(ts);
                        msgDate = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
                        msgTime = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                    }
                } catch (e) {}

                if (msgDate && msgDate !== lastDate) {
                    html += `<div class="chat-date-divider"><span>${escapeHtml(msgDate)}</span></div>`;
                    lastDate = msgDate;
                }

                const text = msg.message || msg.text || "";
                const senderName = msg.sender_name || msg.senderName || (isAdmin ? "Admin" : activeParticipant.name);

                if (isAdmin) {
                    html += `
                        <div class="message-bubble sent" style="margin-left: auto; background: #4B49AC; color: #fff; border-radius: 12px 12px 2px 12px; padding: 10px 14px; max-width: 75%; margin-bottom: 10px;">
                            <div class="message-content">${escapeHtml(text)}</div>
                            <span class="message-time" style="font-size: 10px; opacity: 0.75; display: block; text-align: right; margin-top: 4px;">${escapeHtml(msgTime)}</span>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="message-bubble received" style="margin-right: auto; background: #F1F5F9; color: #1E293B; border-radius: 12px 12px 12px 2px; padding: 10px 14px; max-width: 75%; margin-bottom: 10px;">
                            <div class="message-content">
                                <small style="display:block;font-size:10px;font-weight:700;color:#4B49AC;margin-bottom:2px;">${escapeHtml(senderName)}</small>
                                ${escapeHtml(text)}
                            </div>
                            <span class="message-time" style="font-size: 10px; color: #64748B; display: block; text-align: right; margin-top: 4px;">${escapeHtml(msgTime)}</span>
                        </div>
                    `;
                }
            });

            chatMessages.innerHTML = html;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        /* ======================================================
           SELECT PARTICIPANT
           ====================================================== */
        function selectParticipant(participant, element) {
            const allItems = chatList ? chatList.querySelectorAll(".chat-item") : [];
            allItems.forEach(function (i) { i.classList.remove("active"); });
            if (element) element.classList.add("active");

            activeParticipant = participant;

            const nameEl = document.getElementById("activeChatName");
            const initEl = document.getElementById("activeChatInitials");
            const statusEl = document.querySelector(".chat-status-text");

            if (nameEl) nameEl.textContent = participant.name;
            if (initEl) initEl.textContent = participant.initials;
            if (statusEl) statusEl.textContent = `Active Now • ${participant.role}`;

            renderConversation();
            populateTargetDropdown();
        }

        /* ======================================================
           POPULATE TARGET DROPDOWN
           ====================================================== */
        function populateTargetDropdown() {
            if (!targetAudienceSelect) return;
            let options = `
                <optgroup label="📢 Broadcast Messages">
                    <option value="all_clients">📢 All Clients (Broadcast)</option>
                    <option value="all_staff">📢 All Team Members (Broadcast)</option>
                </optgroup>
            `;

            if (clientsList.length > 0) {
                options += `<optgroup label="👥 Clients">`;
                clientsList.forEach(function (c) {
                    options += `<option value="client_${c.id || c.client_id}">Client: ${escapeHtml(c.client_name || c.name)}</option>`;
                });
                options += `</optgroup>`;
            }

            if (staffList.length > 0) {
                options += `<optgroup label="💼 Team / Staff">`;
                staffList.forEach(function (s) {
                    options += `<option value="staff_${s.id}">Team: ${escapeHtml(s.name)}</option>`;
                });
                options += `</optgroup>`;
            }

            targetAudienceSelect.innerHTML = options;

            if (activeParticipant) {
                const val = activeParticipant.type + "_" + activeParticipant.id;
                const opt = targetAudienceSelect.querySelector(`[value="${val}"]`);
                if (opt) targetAudienceSelect.value = opt.value;
            }
        }

        /* ======================================================
           SEND MESSAGE
           ====================================================== */
        function sendAdminMessage(text, audience) {
            const newMsg = {
                id: Date.now(),
                sender_type: "admin",
                sender: "admin",
                sender_name: "Tenspick Admin",
                senderName: "Tenspick Admin",
                message: text,
                text: text,
                created_at: new Date().toISOString(),
                timestamp: new Date().toISOString()
            };

            if (audience === "all_clients") {
                clientsList.forEach(function (c) {
                    const key = clientChatKey(c.id || c.client_id);
                    const msgs = getMessages(key);
                    msgs.push(newMsg);
                    saveMessages(key, msgs);
                });
            } else if (audience === "all_staff") {
                staffList.forEach(function (s) {
                    const key = staffChatKey(s.id);
                    const msgs = getMessages(key);
                    msgs.push(newMsg);
                    saveMessages(key, msgs);
                });
            } else if (audience && audience.startsWith("client_")) {
                const cId = audience.replace("client_", "");
                const key = clientChatKey(cId);
                const msgs = getMessages(key);
                msgs.push(newMsg);
                saveMessages(key, msgs);
            } else if (audience && audience.startsWith("staff_")) {
                const sId = audience.replace("staff_", "");
                const key = staffChatKey(sId);
                const msgs = getMessages(key);
                msgs.push(newMsg);
                saveMessages(key, msgs);
            } else if (activeParticipant) {
                const msgs = getMessages(activeParticipant.storageKey);
                msgs.push(newMsg);
                saveMessages(activeParticipant.storageKey, msgs);
            }

            syncSupabaseMessage(newMsg, audience);

            renderConversation();
            renderSidebar(chatSearchInput ? chatSearchInput.value.trim() : "");
        }

        /* ======================================================
           EVENTS & TIMERS
           ====================================================== */
        if (chatSearchInput) {
            chatSearchInput.addEventListener("input", function () {
                renderSidebar(this.value.trim());
            });
        }

        if (chatForm && chatInput) {
            chatForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text) return;
                const audience = targetAudienceSelect ? targetAudienceSelect.value : (activeParticipant ? activeParticipant.type + "_" + activeParticipant.id : "all_clients");
                sendAdminMessage(text, audience);
                chatInput.value = "";
            });
        }

        refreshInterval = setInterval(function () {
            loadParticipants();
            if (activeParticipant) {
                renderConversation();
            }
            renderSidebar(chatSearchInput ? chatSearchInput.value.trim() : "");
        }, 3000);

        /* ======================================================
           INITIALIZE
           ====================================================== */
        loadParticipants();
        renderSidebar();
        populateTargetDropdown();
    }

    function escapeHtml(str) {
        const d = document.createElement("div");
        d.textContent = String(str || "");
        return d.innerHTML;
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChat);
    } else {
        initChat();
    }

    window.TenspickChat = { init: initChat };
})(window, document);
