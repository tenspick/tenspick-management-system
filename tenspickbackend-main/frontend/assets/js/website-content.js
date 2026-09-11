/* Website Content Module */
(function (window, document) {
    "use strict";

    function initWebsiteContent() {
        const tabs = document.querySelectorAll(".cms-tab");
        const saveBtn = document.getElementById("saveContentBtn");
        const statusMsg = document.getElementById("cmsStatusMessage");

        const heroTitle = document.getElementById("heroTitle");
        const heroSubtitle = document.getElementById("heroSubtitle");
        const heroCtaText = document.getElementById("heroCtaText");

        const previewTitle = document.getElementById("previewTitle");
        const previewSubtitle = document.getElementById("previewSubtitle");
        const previewCta = document.getElementById("previewCta");

        if (tabs) {
            tabs.forEach(tab => {
                tab.addEventListener("click", function () {
                    tabs.forEach(t => t.classList.remove("active"));
                    this.classList.add("active");
                    const target = this.getAttribute("data-tab");
                    document.querySelectorAll(".tab-pane").forEach(pane => {
                        pane.style.display = pane.id === "tab" + target.charAt(0).toUpperCase() + target.slice(1) ? "block" : "none";
                    });
                });
            });
        }

        if (heroTitle && previewTitle) {
            heroTitle.addEventListener("input", () => previewTitle.textContent = heroTitle.value);
        }
        if (heroSubtitle && previewSubtitle) {
            heroSubtitle.addEventListener("input", () => previewSubtitle.textContent = heroSubtitle.value);
        }
        if (heroCtaText && previewCta) {
            heroCtaText.addEventListener("input", () => previewCta.textContent = heroCtaText.value);
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", function () {
                if (statusMsg) {
                    statusMsg.style.color = "#16A34A";
                    statusMsg.textContent = "Website content updated successfully!";
                    setTimeout(() => statusMsg.textContent = "", 3000);
                }
            });
        }
    }

    document.addEventListener("DOMContentLoaded", initWebsiteContent);
    window.TenspickWebsiteContent = { init: initWebsiteContent };
})(window, document);
