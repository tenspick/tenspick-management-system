/* Activity Logs Module */
(function (window, document) {
    "use strict";

    function initActivityLogs() {
        const refreshBtn = document.getElementById("refreshLogsBtn");
        const searchInput = document.getElementById("logSearch");
        const filterSelect = document.getElementById("logActionFilter");
        const tableBody = document.getElementById("logsTableBody");

        if (refreshBtn) {
            refreshBtn.addEventListener("click", function () {
                const icon = this.querySelector("i");
                if (icon) icon.classList.add("spin");
                setTimeout(() => {
                    if (icon) icon.classList.remove("spin");
                }, 600);
            });
        }

        function filterLogs() {
            if (!tableBody) return;
            const searchVal = searchInput ? searchInput.value.toLowerCase() : "";
            const selectVal = filterSelect ? filterSelect.value.toLowerCase() : "";
            const rows = tableBody.querySelectorAll("tr");

            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                const matchesSearch = !searchVal || text.includes(searchVal);
                const matchesSelect = !selectVal || text.includes(selectVal);
                row.style.display = matchesSearch && matchesSelect ? "" : "none";
            });
        }

        if (searchInput) searchInput.addEventListener("input", filterLogs);
        if (filterSelect) filterSelect.addEventListener("change", filterLogs);
    }

    document.addEventListener("DOMContentLoaded", initActivityLogs);
    window.TenspickActivityLogs = { init: initActivityLogs };
})(window, document);
