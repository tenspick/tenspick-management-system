/* PWA & Install App Handler */
(function (window, document) {
    "use strict";

    let deferredPrompt = null;

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.warn('SW registration skipped:', err);
            });
        });
    }

    // Capture install prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallButton();
    });

    function showInstallButton() {
        let installBtn = document.getElementById("pwaInstallBtn");
        if (!installBtn) {
            const topbarRight = document.querySelector(".topbar-right, .client-topbar-right");
            if (topbarRight) {
                installBtn = document.createElement("button");
                installBtn.id = "pwaInstallBtn";
                installBtn.type = "button";
                installBtn.className = "topbar-btn";
                installBtn.style.cssText = "background: #4B49AC; color: #fff; border: 0; padding: 6px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin-right: 10px;";
                installBtn.innerHTML = '<i class="bi bi-download"></i> <span>Install App</span>';
                topbarRight.insertBefore(installBtn, topbarRight.firstChild);
            }
        }

        if (installBtn) {
            installBtn.style.display = "inline-flex";
            installBtn.onclick = async () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') {
                        installBtn.style.display = "none";
                    }
                    deferredPrompt = null;
                }
            };
        }
    }

    window.addEventListener('appinstalled', () => {
        const installBtn = document.getElementById("pwaInstallBtn");
        if (installBtn) installBtn.style.display = "none";
    });
})(window, document);
