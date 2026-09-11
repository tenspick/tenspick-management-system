"use strict";

(function (window, document) {

    function init(container, params) {

        if (!container) {
            return;
        }

        const title =
            params?.title ||
            "Coming Soon";

        const description =
            params?.description ||
            "This feature is currently under development.";

        const icon =
            params?.icon ||
            "bi-hourglass-split";

        container.innerHTML = `

            <section class="client-coming-soon-page">

                <div class="client-coming-soon-card">

                    <div class="client-coming-soon-icon">

                        <i
                            class="bi ${icon}"
                            aria-hidden="true"
                        ></i>

                    </div>

                    <span class="client-coming-soon-badge">
                        Coming Soon
                    </span>

                    <h2>
                        ${escapeHtml(title)}
                    </h2>

                    <p>
                        ${escapeHtml(description)}
                    </p>

                    <div class="client-coming-soon-line"></div>

                    <small>
                        This feature will be available soon.
                    </small>

                </div>

            </section>

        `;
    }


    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value || "";

        return div.innerHTML;
    }


    function destroy() {
        // Nothing to clean up.
    }


    window.TenspickClientComingSoon = {
        init,
        destroy
    };

})(window, document);