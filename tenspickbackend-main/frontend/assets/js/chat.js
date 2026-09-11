/* Chat Page Module - Dynamic Clients & Team Members */
(function (window, document) {
    "use strict";

    async function initChat() {
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
            try {
                const raw = localStorage.getItem("tenspick_clients");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        clientsList = parsed;
                    }
                }
            } catch (e) {}

            try {
                const raw = localStorage.getItem("tenspick_staff");
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        staffList = parsed;
                    }
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

        /* ======================================================
           GET MESSAGES FOR PARTICIPANT
           ====================================================== */
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

        /* ======================================================
           GET UNREAD COUNT FOR A PARTICIPANT
           ====================================================== */
        function getUnreadCount(storageKey) {
            const msgs = getMessages(storageKey);
            return msgs.filter(function (m) {
                const sender = m.sender_type || m.sender;
                return sender === "client" || sender === "staff";
            }).length;
        }

        function getTotalUnread() {
            let total = 0;
            clientsList.forEach(function (c) {
                const key = clientChatKey(c.id || c.client_id);
                const msgs = getMessages(key);
                total += msgs.filter(function (m) {
                    const sender = m.sender_type || m.sender;
                    return sender === "client";
                }).length;
            });
            staffList.forEach(function (s) {
                const key = staffChatKey(s.id);
                const msgs = getMessages(key);
                total += msgs.filter(function (m) {
                    return m.sender === "staff";
                }).length;
            });
            return total;
        }

        /* ======================================================
           HELPERS
           ====================================================== */
        function getInitials(name) {
            if (!name) return "TP";
            const parts = name.trim().split(" ");
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
                                <strong class="chat-name">${escapeHtml(cName)} <span class="chat-role-badge client">Client</span></strong>
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
                                <strong class="chat-name">${escapeHtml(sName)} <span class="chat-role-badge staff">Team</span></strong>
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
                chatList.innerHTML = `<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">No conversations found. Add clients and staff to start chatting.</div>`;
            }

            // Update badge
            const badge = document.getElementById("unreadChatCount");
            if (badge) {
                const total = getTotalUnread();
                badge.textContent = total > 0 ? total + " New" : "0 New";
            }

            // Re-select active participant if still present
            if (activeParticipant) {
                const found = chatList.querySelector(`[data-type="${activeParticipant.type}"][data-id="${activeParticipant.id}"]`);
                if (found) found.classList.add("active");
            } else {
                const firstItem = chatList.querySelector(".chat-item");
                if (firstItem) firstItem.click();
            }
        }

        /* ======================================================
           RENDER MESSAGES FOR ACTIVE PARTICIPANT
           ====================================================== */
        function renderConversation() {
            if (!chatMessages || !activeParticipant) return;

            const msgs = getMessages(activeParticipant.storageKey);
            if (!msgs.length) {
                chatMessages.innerHTML = `
                    <div class="chat-date-divider"><span>No Messages Yet</span></div>
                    <div style="text-align:center;color:#94a3b8;padding:30px 20px;font-size:13px;">
                        No messages yet. Send a message to start the conversation.
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
                        <div class="message-bubble sent">
                            <div class="message-content">${escapeHtml(text)}</div>
                            <span class="message-time">${escapeHtml(msgTime)}</span>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="message-bubble received">
                            <div class="message-content">
                                <small style="display:block;font-size:10px;color:#94a3b8;margin-bottom:2px;">${escapeHtml(senderName)}</small>
                                ${escapeHtml(text)}
                            </div>
                            <span class="message-time">${escapeHtml(msgTime)}</span>
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
        }

        /* ======================================================
           POPULATE TARGET DROPDOWN
           ====================================================== */
        function populateTargetDropdown() {
            if (!targetAudienceSelect) return;
            targetAudienceSelect.innerHTML = `
                <optgroup label="📢 Broadcast Messages">
                    <option value="all_clients">📢 All Clients (Broadcast)</option>
                    <option value="all_staff">📢 All Team Members (Broadcast)</option>
                </optgroup>
                <optgroup label="👥 Clients">
                    ${clientsList.map(function (c) {
                        return `<option value="client_${c.id || c.client_id}">Client: ${escapeHtml(c.client_name || c.name)}</option>`;
                    }).join("")}
                </optgroup>
                <optgroup label="💼 Team / Staff">
                    ${staffList.map(function (s) {
                        return `<option value="staff_${s.id}">Team: ${escapeHtml(s.name)}</option>`;
                    }).join("")}
                </optgroup>
            `;

            // Pre-select active participant if set
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

            // Save as announcement too
            const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            try {
                const announcementsRaw = localStorage.getItem("tenspick_announcements");
                const announcements = announcementsRaw ? JSON.parse(announcementsRaw) : [];
                announcements.unshift({ id: Date.now(), text: text, target: audience, time: timeStr, date: new Date().toLocaleDateString() });
                localStorage.setItem("tenspick_announcements", JSON.stringify(announcements));
            } catch (e) {}

            window.dispatchEvent(new CustomEvent("tenspick:announcement-posted", { detail: { text, audience, timeStr } }));

            renderConversation();
            renderSidebar(chatSearchInput ? chatSearchInput.value.trim() : "");
        }

        /* ======================================================
           EVENTS
           ====================================================== */
        if (chatSearchInput) {
            chatSearchInput.addEventListener("input", function () {
                renderSidebar(this.value.trim());
            });
        }

        if (chatForm && chatInput && chatMessages) {
            chatForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text) return;
                const audience = targetAudienceSelect ? targetAudienceSelect.value : (activeParticipant ? activeParticipant.type + "_" + activeParticipant.id : "all_clients");
                sendAdminMessage(text, audience);
                chatInput.value = "";
            });
        }

        // Auto-refresh every 3 seconds to pick up new messages from client/staff
        refreshInterval = setInterval(function () {
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


        const chatForm = document.getElementById("chatForm");
        const chatInput = document.getElementById("chatMessageInput");
        const chatMessages = document.getElementById("chatMessages");
        const chatList = document.getElementById("chatList");
        const chatSearchInput = document.getElementById("chatSearchInput");
        const targetAudienceSelect = document.getElementById("chatTargetAudience");

        let clientsList = [];
        let staffList = [];
        let activeParticipant = null;

        // Fetch Clients and Staff from Supabase / API
        try {
            const clientsRes = await apiRequest("clients");
            if (clientsRes && Array.isArray(clientsRes.data) && clientsRes.data.length > 0) {
                clientsList = clientsRes.data;
            } else {
                clientsList = [
                    { id: 1, client_name: "Kiran Varma", company_name: "Varma Tech", type: "client" },
                    { id: 2, client_name: "Mahesh Babu", company_name: "MB Enterprises", type: "client" },
                    { id: 3, client_name: "Suresh Tech Corp", company_name: "Suresh Corp", type: "client" }
                ];
            }

            const staffRes = await apiRequest("staff");
            if (staffRes && Array.isArray(staffRes.data) && staffRes.data.length > 0) {
                staffList = staffRes.data;
            } else {
                staffList = [
                    { id: 101, name: "Rajesh Kumar", designation: "Project Manager", type: "staff" },
                    { id: 102, name: "Anitha Rao", designation: "Lead Developer", type: "staff" },
                    { id: 103, name: "Praveen Reddy", designation: "UI/UX Designer", type: "staff" }
                ];
            }
        } catch (e) {
            console.warn("Using fallback Chat participants:", e);
        }

        function getInitials(name) {
            if (!name) return "TP";
            const parts = name.trim().split(" ");
            if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
            return parts[0].substring(0, 2).toUpperCase();
        }

        function renderSidebar(filterText = "") {
            if (!chatList) return;
            chatList.innerHTML = "";

            const searchLower = filterText.toLowerCase();

            const filteredClients = clientsList.filter(c => 
                (c.client_name || c.name || "").toLowerCase().includes(searchLower) ||
                (c.company_name || "").toLowerCase().includes(searchLower)
            );

            const filteredStaff = staffList.filter(s => 
                (s.name || "").toLowerCase().includes(searchLower) ||
                (s.designation || s.department || "").toLowerCase().includes(searchLower)
            );

            // 1. CLIENTS SECTION
            if (filteredClients.length > 0) {
                const clientGroupHeader = document.createElement("div");
                clientGroupHeader.className = "chat-group-title";
                clientGroupHeader.innerHTML = `<i class="bi bi-people"></i> CLIENTS (${filteredClients.length})`;
                chatList.appendChild(clientGroupHeader);

                filteredClients.forEach(c => {
                    const cName = c.client_name || c.name || "Client";
                    const item = document.createElement("div");
                    item.className = "chat-item";
                    item.dataset.type = "client";
                    item.dataset.id = c.id;
                    item.dataset.name = cName;
                    item.innerHTML = `
                        <div class="chat-avatar">
                            <span>${getInitials(cName)}</span>
                            <span class="online-status online"></span>
                        </div>
                        <div class="chat-info">
                            <div class="chat-item-top">
                                <strong class="chat-name">${escapeHtml(cName)} <span class="chat-role-badge client">Client</span></strong>
                                <span class="chat-time">Active</span>
                            </div>
                            <p class="chat-preview">${escapeHtml(c.company_name || 'Client Account')}</p>
                        </div>
                    `;
                    item.addEventListener("click", () => selectParticipant(cName, "Client", getInitials(cName), item));
                    chatList.appendChild(item);
                });
            }

            // 2. TEAM / STAFF SECTION
            if (filteredStaff.length > 0) {
                const staffGroupHeader = document.createElement("div");
                staffGroupHeader.className = "chat-group-title";
                staffGroupHeader.innerHTML = `<i class="bi bi-person-badge"></i> TEAM MEMBERS (${filteredStaff.length})`;
                chatList.appendChild(staffGroupHeader);

                filteredStaff.forEach(s => {
                    const sName = s.name || "Staff Member";
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
                                <strong class="chat-name">${escapeHtml(sName)} <span class="chat-role-badge staff">Team</span></strong>
                                <span class="chat-time">Active</span>
                            </div>
                            <p class="chat-preview">${escapeHtml(s.designation || s.department || 'Team Member')}</p>
                        </div>
                    `;
                    item.addEventListener("click", () => selectParticipant(sName, "Team Member", getInitials(sName), item));
                    chatList.appendChild(item);
                });
            }

            // Select first by default if available
            const firstItem = chatList.querySelector(".chat-item");
            if (firstItem && !activeParticipant) {
                firstItem.click();
            }
        }

        function populateTargetDropdown() {
            if (!targetAudienceSelect) return;
            targetAudienceSelect.innerHTML = `
                <optgroup label="📢 Broadcast Messages">
                    <option value="all_clients">📢 All Clients (Broadcast)</option>
                    <option value="all_staff">📢 All Team Members (Broadcast)</option>
                </optgroup>
                <optgroup label="👥 Clients">
                    ${clientsList.map(c => `<option value="client_${c.id}">Client: ${escapeHtml(c.client_name || c.name)}</option>`).join('')}
                </optgroup>
                <optgroup label="💼 Team / Staff">
                    ${staffList.map(s => `<option value="staff_${s.id}">Team: ${escapeHtml(s.name)}</option>`).join('')}
                </optgroup>
            `;
        }

        function selectParticipant(name, role, initials, element) {
            const allItems = chatList.querySelectorAll(".chat-item");
            allItems.forEach(i => i.classList.remove("active"));
            if (element) element.classList.add("active");

            activeParticipant = { name, role, initials };

            const nameEl = document.getElementById("activeChatName");
            const initEl = document.getElementById("activeChatInitials");
            const statusEl = document.querySelector(".chat-status-text");

            if (nameEl) nameEl.textContent = name;
            if (initEl) initEl.textContent = initials;
            if (statusEl) statusEl.textContent = `Active Now • ${role}`;
        }

        if (chatSearchInput) {
            chatSearchInput.addEventListener("input", function () {
                renderSidebar(this.value.trim());
            });
        }

        if (chatForm && chatInput && chatMessages) {
            chatForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const text = chatInput.value.trim();
                if (!text) return;

                const audience = targetAudienceSelect ? targetAudienceSelect.value : "all_clients";
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                const msgBubble = document.createElement("div");
                msgBubble.className = "message-bubble sent";
                msgBubble.innerHTML = `
                    <div class="message-content">
                        ${audience.includes("all") ? '<span style="display:inline-block; background:#4B49AC; color:#fff; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; margin-bottom:4px;">BROADCAST</span><br>' : ''}
                        ${escapeHtml(text)}
                    </div>
                    <span class="message-time">${timeStr}</span>
                `;

                chatMessages.appendChild(msgBubble);
                chatInput.value = "";
                chatMessages.scrollTop = chatMessages.scrollHeight;

                // Save Announcement for Dashboard display
                const announcementsRaw = localStorage.getItem("tenspick_announcements");
                const announcements = announcementsRaw ? JSON.parse(announcementsRaw) : [];
                announcements.unshift({
                    id: Date.now(),
                    text: text,
                    target: audience,
                    time: timeStr,
                    date: new Date().toLocaleDateString()
                });
                localStorage.setItem("tenspick_announcements", JSON.stringify(announcements));
                window.dispatchEvent(new CustomEvent("tenspick:announcement-posted", { detail: { text, audience, timeStr } }));
            });
        }

        renderSidebar();
        populateTargetDropdown();
    }

    function escapeHtml(str) {
        return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initChat);
    } else {
        initChat();
    }

    window.TenspickChat = { init: initChat };
})(window, document);

