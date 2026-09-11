"use strict";

/**
 * ============================================================
 * TENSPICK CRM - USER PROFILE MODULE
 * ============================================================
 */

(function (window, document) {
    "use strict";

    function getUser() {
        try {
            const raw = sessionStorage.getItem("tenspick_user");
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return {
            name: "Staff User",
            email: "staff@tenspick.org",
            role: "staff",
            department: "Development",
            designation: "Software Engineer",
            mobile: "9876543210",
            bio: "Full stack software developer working at Tenspick."
        };
    }

    function init() {
        const user = getUser();
        populateFields(user);
        bindEvents();
    }

    function populateFields(user) {
        const name = user.name || "User";
        const initial = (name.charAt(0) || "U").toUpperCase();

        const avatarEl = document.getElementById("profileHeroAvatar");
        const nameEl = document.getElementById("profileHeroName");
        const roleEl = document.getElementById("profileHeroRole");
        const emailEl = document.getElementById("profileHeroEmail");
        const badgeEl = document.getElementById("profileRoleBadge");

        if (avatarEl) avatarEl.textContent = initial;
        if (nameEl) nameEl.textContent = name;
        if (roleEl) roleEl.textContent = user.role || (window.TenspickAuth && window.TenspickAuth.isStaff() ? "Staff Member" : "Administrator");
        if (emailEl) emailEl.textContent = user.email || "";
        if (badgeEl) badgeEl.textContent = window.TenspickAuth && window.TenspickAuth.isStaff() ? "Staff Permission Active" : "Admin Permission Active";

        const inputName = document.getElementById("profFullName");
        const inputEmail = document.getElementById("profEmail");
        const inputPhone = document.getElementById("profPhone");
        const inputDept = document.getElementById("profDepartment");
        const inputDesig = document.getElementById("profDesignation");
        const inputBio = document.getElementById("profBio");

        if (inputName) inputName.value = name;
        if (inputEmail) inputEmail.value = user.email || "";
        if (inputPhone) inputPhone.value = user.mobile || user.phone || "";
        if (inputDept) inputDept.value = user.department || "";
        if (inputDesig) inputDesig.value = user.designation || "";
        if (inputBio) inputBio.value = user.bio || "";
    }

    function bindEvents() {
        const infoForm = document.getElementById("profileInfoForm");
        if (infoForm) {
            infoForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const user = getUser();
                user.name = document.getElementById("profFullName")?.value || user.name;
                user.mobile = document.getElementById("profPhone")?.value || user.mobile;
                user.department = document.getElementById("profDepartment")?.value || user.department;
                user.designation = document.getElementById("profDesignation")?.value || user.designation;
                user.bio = document.getElementById("profBio")?.value || user.bio;

                sessionStorage.setItem("tenspick_user", JSON.stringify(user));
                populateFields(user);

                // Toast notification
                alert("Profile information saved successfully!");
            });
        }

        const passForm = document.getElementById("profilePasswordForm");
        if (passForm) {
            passForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const currentPass = document.getElementById("profCurrentPass")?.value;
                const newPass = document.getElementById("profNewPass")?.value;
                const confirmPass = document.getElementById("profConfirmPass")?.value;

                if (newPass !== confirmPass) {
                    alert("New passwords do not match. Please try again.");
                    return;
                }

                alert("Password updated successfully!");
                passForm.reset();
            });
        }
    }

    window.TenspickProfile = {
        init: init
    };

})(window, document);
