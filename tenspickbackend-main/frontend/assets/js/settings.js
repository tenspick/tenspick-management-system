/* Settings Module */
(function (window, document) {
    "use strict";

    function initSettings() {
        const saveBtn = document.getElementById("saveSettingsBtn");
        const msgEl = document.getElementById("settingsMessage");
        const urlInput = document.getElementById("setSupabaseUrl");
        const keyInput = document.getElementById("setSupabaseKey");

        // Load existing stored keys if present
        if (urlInput) urlInput.value = localStorage.getItem("TENSPICK_SUPABASE_URL") || "";
        if (keyInput) keyInput.value = localStorage.getItem("TENSPICK_SUPABASE_ANON_KEY") || "";

        if (saveBtn) {
            saveBtn.addEventListener("click", function () {
                const url = urlInput ? urlInput.value.trim() : "";
                const key = keyInput ? keyInput.value.trim() : "";

                if (window.TenspickSupabase && url && key) {
                    window.TenspickSupabase.configure(url, key);
                }

                if (msgEl) {
                    msgEl.style.color = "#16A34A";
                    msgEl.textContent = "Settings saved successfully!";
                    setTimeout(() => msgEl.textContent = "", 3000);
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", initSettings);
    window.TenspickSettings = { init: initSettings };
})(window, document);
