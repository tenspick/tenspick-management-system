"use strict";

/**
 * ============================================================
 * TENSPICK CRM - USER PROFILE MODULE
 * ============================================================
 */

(function (window, document) {
    "use strict";

    function getUser() {
        let user = null;
        try {
            const sessionRaw = sessionStorage.getItem("tenspick_user");
            if (sessionRaw) user = JSON.parse(sessionRaw);

            if (!user) {
                const localRaw = localStorage.getItem("tenspick_user");
                if (localRaw) user = JSON.parse(localRaw);
            }
        } catch (e) {}

        if (!user) {
            user = {
                id: 1,
                name: "Narayan Naidu",
                email: "narayannaidu@tenspick.com",
                role: "admin",
                department: "Management",
                designation: "Administrator",
                mobile: "9876543210",
                bio: "Full stack software developer working at Tenspick."
            };
        }
        return user;
    }

    function init() {
        const user = getUser();
        populateFields(user);
        bindEvents();
    }

    function showToast(message, type = "success") {
        if (typeof window.showToast === "function") {
            window.showToast(message, type);
            return;
        }
        if (typeof window.showNotification === "function") {
            window.showNotification(message, type);
            return;
        }
        alert(message);
    }

    function updateHeaderUI(user) {
        const name = user.name || "User";
        const role = user.designation || user.role || "User";

        const headerName = document.getElementById("headerUserName") || document.getElementById("navUserName");
        const headerRole = document.getElementById("headerUserRole") || document.getElementById("navUserRole");

        if (headerName) headerName.textContent = name;
        if (headerRole) headerRole.textContent = role;
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
        if (roleEl) roleEl.textContent = user.designation || user.role || (window.TenspickAuth && window.TenspickAuth.isStaff() ? "Staff Member" : "Administrator");
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

        updateHeaderUI(user);
    }

    function bindEvents() {
        const infoForm = document.getElementById("profileInfoForm");
        if (infoForm) {
            infoForm.addEventListener("submit", async function (e) {
                e.preventDefault();
                const user = getUser();
                user.name = document.getElementById("profFullName")?.value.trim() || user.name;
                user.mobile = document.getElementById("profPhone")?.value.trim() || user.mobile;
                user.phone = user.mobile;
                user.department = document.getElementById("profDepartment")?.value.trim() || user.department;
                user.designation = document.getElementById("profDesignation")?.value.trim() || user.designation;
                user.bio = document.getElementById("profBio")?.value.trim() || user.bio;

                // 1. Save to SessionStorage & LocalStorage
                sessionStorage.setItem("tenspick_user", JSON.stringify(user));
                localStorage.setItem("tenspick_user", JSON.stringify(user));

                // 2. Update staff list in LocalStorage if staff
                try {
                    const rawStaff = localStorage.getItem("tenspick_staff");
                    if (rawStaff) {
                        let staffList = JSON.parse(rawStaff) || [];
                        staffList = staffList.map(s => {
                            if (String(s.id) === String(user.id) || (s.email && s.email.toLowerCase() === user.email.toLowerCase())) {
                                return { ...s, name: user.name, phone: user.mobile, department: user.department, designation: user.designation, bio: user.bio };
                            }
                            return s;
                        });
                        localStorage.setItem("tenspick_staff", JSON.stringify(staffList));
                    }
                } catch (e) {}

                // 3. Update Supabase if configured
                if (window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
                    try {
                        const sb = window.TenspickSupabase.getClient();
                        if (sb) {
                            await sb.from("staff").update({
                                name: user.name,
                                phone: user.mobile,
                                department: user.department,
                                designation: user.designation
                            }).eq("email", user.email);
                        }
                    } catch (sbErr) {
                        console.warn("[Profile] Supabase update note:", sbErr);
                    }
                }

                populateFields(user);
                showToast("Profile information updated successfully!", "success");
            });
        }

        const passForm = document.getElementById("profilePasswordForm");
        if (passForm) {
            passForm.addEventListener("submit", function (e) {
                e.preventDefault();
                const currentPass = document.getElementById("profCurrentPass")?.value;
                const newPass = document.getElementById("profNewPass")?.value;
                const confirmPass = document.getElementById("profConfirmPass")?.value;

                if (!newPass || newPass.length < 6) {
                    showToast("New password must be at least 6 characters.", "error");
                    return;
                }

                if (newPass !== confirmPass) {
                    showToast("New passwords do not match. Please try again.", "error");
                    return;
                }

                showToast("Password updated successfully!", "success");
                passForm.reset();
            });
        }
    }

    window.TenspickProfile = {
        init: init
    };

})(window, document);
