"use strict";

/**
 * ============================================================
 * TENSPICK CRM - ASSIGNED DOCUMENTS MODULE (DUAL MODE)
 * ============================================================
 */

(function (window, document) {
    "use strict";

    let allDocuments = [];
    let currentFilter = { search: "", category: "" };

    const GLOBAL_DOCS_KEY = "tenspick_global_documents";

    function loadDocuments() {
        try {
            const cached = localStorage.getItem(GLOBAL_DOCS_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed)) {
                    allDocuments = parsed;
                    return;
                }
            }
        } catch (e) {}

        allDocuments = [];
        saveDocuments();
    }

    function saveDocuments() {
        try { localStorage.setItem(GLOBAL_DOCS_KEY, JSON.stringify(allDocuments)); } catch (e) {}
    }

    function getFileIcon(type) {
        const icons = { pdf: "bi-file-earmark-pdf", docx: "bi-file-earmark-word", xlsx: "bi-file-earmark-excel", zip: "bi-file-earmark-zip", png: "bi-file-earmark-image", jpg: "bi-file-earmark-image" };
        return icons[type] || "bi-file-earmark";
    }

    function getFileColor(type) {
        const colors = { pdf: "#EF4444", docx: "#2563EB", xlsx: "#10B981", zip: "#F59E0B", png: "#8B5CF6", jpg: "#8B5CF6" };
        return colors[type] || "#6B7280";
    }

    function getCategoryLabel(category) {
        const labels = { specification: "Project Spec", contract: "Contract", design: "Design Asset", template: "Template", other: "Other" };
        return labels[category] || category;
    }

    function escapeHtml(v) {
        const d = document.createElement("div");
        d.textContent = String(v || "");
        return d.innerHTML;
    }

    function getFilteredDocuments() {
        return allDocuments.filter(doc => {
            const matchSearch = !currentFilter.search ||
                doc.name.toLowerCase().includes(currentFilter.search.toLowerCase()) ||
                (doc.project || "").toLowerCase().includes(currentFilter.search.toLowerCase());
            const matchCategory = !currentFilter.category || doc.category === currentFilter.category;
            return matchSearch && matchCategory;
        });
    }

    function deleteDocument(id) {
        if (!confirm("Are you sure you want to delete this document?")) return;
        allDocuments = allDocuments.filter(d => String(d.id) !== String(id));
        saveDocuments();
        renderDocuments();
    }

    function renderDocuments() {
        const grid = document.getElementById("documentsGrid");
        const empty = document.getElementById("documentsEmptyState");
        if (!grid) return;

        const filtered = getFilteredDocuments();

        if (!filtered.length) {
            grid.innerHTML = "";
            if (empty) empty.hidden = false;
            return;
        }

        if (empty) empty.hidden = true;

        grid.innerHTML = filtered.map(doc => {
            const icon = getFileIcon(doc.type);
            const color = getFileColor(doc.type);
            const catLabel = getCategoryLabel(doc.category);
            const catColors = { specification: "#4B49AC", contract: "#10B981", design: "#8B5CF6", template: "#F59E0B", other: "#6B7280" };
            const catColor = catColors[doc.category] || "#6B7280";

            return `
                <div style="background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); border: 1px solid #E5E7EB; display: flex; flex-direction: column; gap: 14px; transition: box-shadow 0.2s; cursor: default;">
                    <div style="display: flex; align-items: flex-start; gap: 14px;">
                        <div style="width: 48px; height: 48px; border-radius: 10px; background: ${color}15; display: flex; align-items: center; justify-content: center; font-size: 22px; color: ${color}; flex-shrink: 0;">
                            <i class="bi ${icon}"></i>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <strong style="font-size: 13px; color: #1F2937; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</strong>
                            <span style="font-size: 12px; color: #9CA3AF;">${escapeHtml(doc.project || "General")}</span>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 11px; background: ${catColor}15; color: ${catColor}; font-weight: 700; padding: 3px 8px; border-radius: 20px;">${catLabel}</span>
                        <span style="font-size: 11px; color: #9CA3AF;">${doc.size || "1.5 MB"}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid #F3F4F6;">
                        <span style="font-size: 11px; color: #9CA3AF;"><i class="bi bi-calendar3" style="margin-right: 4px;"></i>${doc.date}</span>
                        <div style="display: flex; gap: 12px; align-items: center;">
                            <button type="button" class="btn-delete-doc" data-id="${doc.id}" title="Delete Document" style="background: #FEE2E2; color: #DC2626; border: none; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                <i class="bi bi-trash"></i> Delete
                            </button>
                            <a href="${escapeHtml(doc.url || "#")}" style="font-size: 12px; color: #4B49AC; font-weight: 600; text-decoration: none; display: flex; align-items: center; gap: 4px;" download>
                                <i class="bi bi-download"></i> Download
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        grid.querySelectorAll(".btn-delete-doc").forEach(btn => {
            btn.addEventListener("click", function () {
                const id = this.getAttribute("data-id");
                deleteDocument(id);
            });
        });
    }

    function bindEvents() {
        const searchInput = document.getElementById("documentSearchInput");
        const categoryFilter = document.getElementById("documentCategoryFilter");
        const addBtn = document.getElementById("addDocumentBtn");
        const formBox = document.getElementById("addDocumentFormBox");
        const form = document.getElementById("addDocumentForm");

        if (searchInput) {
            searchInput.addEventListener("input", function () {
                currentFilter.search = this.value;
                renderDocuments();
            });
        }

        if (categoryFilter) {
            categoryFilter.addEventListener("change", function () {
                currentFilter.category = this.value;
                renderDocuments();
            });
        }

        if (addBtn && formBox) {
            addBtn.addEventListener("click", function () {
                formBox.style.display = formBox.style.display === "none" ? "block" : "none";
            });
        }

        if (form) {
            form.addEventListener("submit", function (e) {
                e.preventDefault();
                const newDoc = {
                    id: Date.now(),
                    name: document.getElementById("docName")?.value || "Requested Document",
                    category: document.getElementById("docCategory")?.value || "specification",
                    project: document.getElementById("docProject")?.value || "General",
                    type: document.getElementById("docType")?.value || "pdf",
                    size: "1.2 MB",
                    date: new Date().toISOString().split("T")[0],
                    url: "#"
                };

                allDocuments.unshift(newDoc);
                saveDocuments();
                renderDocuments();
                form.reset();
                if (formBox) formBox.style.display = "none";
                alert("Document saved / requested successfully!");
            });
        }
    }

    function init() {
        currentFilter = { search: "", category: "" };
        loadDocuments();
        renderDocuments();
        bindEvents();
    }

    function destroy() {}

    window.TenspickDocuments = { init, destroy };

})(window, document);
