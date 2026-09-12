/* ============================================================
   TENSPICK
   LOGIN PAGE JAVASCRIPT
   ============================================================ */

document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  /* ========================================================
       ELEMENTS
       ======================================================== */

  const loginForm = document.getElementById("loginForm");

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const rememberInput = document.getElementById("remember");

  const passwordToggle = document.getElementById("passwordToggle");

  const forgotPassword = document.getElementById("forgotPassword");

  const loginButton = document.getElementById("loginButton");

  const loginMessage = document.getElementById("loginMessage");

  const emailError = document.getElementById("emailError");

  const passwordError = document.getElementById("passwordError");

  /* ========================================================
       API BASE URL
       ======================================================== */

  /*
   * Backend will be connected after the login UI is completed.
   *
   * IMPORTANT:
   * Do not add /api here.
   *
   * API endpoints will later be:
   *
   * ../backend/public/api/security/csrf
   * ../backend/public/api/auth/login
   */

  const API_BASE_URL =
    window.TENSPICK_API_BASE || "../backend/public/index.php";

  /* ========================================================
       MESSAGE HELPER
       ======================================================== */

  function setMessage(element, message) {
    if (!element) {
      return;
    }

    element.textContent = message || "";
  }

  /* ========================================================
       CLEAR ERRORS
       ======================================================== */

  function clearErrors() {
    setMessage(emailError, "");
    setMessage(passwordError, "");
    setMessage(loginMessage, "");
  }

  /* ========================================================
       EMAIL VALIDATION
       ======================================================== */

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /* ========================================================
       BUTTON LOADING
       ======================================================== */

  function setLoading(isLoading) {
    if (!loginButton) {
      return;
    }

    loginButton.disabled = isLoading;

    if (isLoading) {
      loginButton.classList.add("loading");

      loginButton.setAttribute("aria-busy", "true");
    } else {
      loginButton.classList.remove("loading");

      loginButton.removeAttribute("aria-busy");
    }
  }

  /* ========================================================
       PASSWORD SHOW / HIDE
       ======================================================== */

  if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener("click", function () {
      const passwordVisible = passwordInput.type === "text";

      if (passwordVisible) {
        passwordInput.type = "password";

        passwordToggle.textContent = "Show";

        passwordToggle.setAttribute("aria-label", "Show password");
      } else {
        passwordInput.type = "text";

        passwordToggle.textContent = "Hide";

        passwordToggle.setAttribute("aria-label", "Hide password");
      }
    });
  }

  /* ========================================================
       EMAIL INPUT
       ======================================================== */

  if (emailInput) {
    emailInput.addEventListener("input", function () {
      setMessage(emailError, "");
      setMessage(loginMessage, "");
    });
  }

  /* ========================================================
       PASSWORD INPUT
       ======================================================== */

  if (passwordInput) {
    passwordInput.addEventListener("input", function () {
      setMessage(passwordError, "");
      setMessage(loginMessage, "");
    });
  }

  /* ========================================================
       FORGOT PASSWORD
       ======================================================== */

  if (forgotPassword) {
    forgotPassword.addEventListener("click", function (event) {
      event.preventDefault();

      setMessage(loginMessage, "Password recovery will be available soon.");
    });
  }

  /* ========================================================
       VALIDATE FORM
       ======================================================== */

  function validateForm() {
    clearErrors();

    let valid = true;

    const email = emailInput ? emailInput.value.trim() : "";

    const password = passwordInput ? passwordInput.value : "";

    /* ----------------------------------------------------
           EMAIL
           ---------------------------------------------------- */

    if (!email) {
      setMessage(emailError, "Email address is required.");

      valid = false;
    } else if (!isValidEmail(email)) {
      setMessage(emailError, "Enter a valid email address.");

      valid = false;
    }

    /* ----------------------------------------------------
           PASSWORD
           ---------------------------------------------------- */

    if (!password) {
      setMessage(passwordError, "Password is required.");

      valid = false;
    } else if (password.length < 8) {
      setMessage(passwordError, "Password must contain at least 8 characters.");

      valid = false;
    }

    return {
      valid: valid,
      email: email,
      password: password,
    };
  }

  /* ========================================================
       LOGIN FORM
       ======================================================== */

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();

      /* --------------------------------------------
                   Validate
                   -------------------------------------------- */

      const formData = validateForm();

      if (!formData.valid) {
        return;
      }

      /* --------------------------------------------
                   Loading
                   -------------------------------------------- */

      setLoading(true);

      try {
        let authenticated = false;
        let adminUser = null;

        /* ========================================
           1. TRY LOCAL PHP BACKEND IF ACTIVE
           ======================================== */
        try {
          const csrfResponse = await fetch(API_BASE_URL + "/api/security/csrf", {
            method: "GET",
            credentials: "same-origin",
            headers: { Accept: "application/json" },
          });

          if (csrfResponse.ok) {
            const csrfData = await csrfResponse.json();
            if (csrfData.success && csrfData.data && csrfData.data.token) {
              const loginResponse = await fetch(API_BASE_URL + "/api/auth/login", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                  Accept: "application/json",
                  "Content-Type": "application/json",
                  "X-CSRF-Token": csrfData.data.token,
                },
                body: JSON.stringify({
                  email: formData.email,
                  password: formData.password,
                  remember: rememberInput ? rememberInput.checked : false,
                }),
              });

              const loginData = await loginResponse.json();
              if (loginResponse.ok && loginData.success) {
                authenticated = true;
                adminUser = (loginData.data && loginData.data.user) ? loginData.data.user : { name: "Tenspick Admin", email: formData.email };
              } else {
                throw new Error(loginData.message || "Invalid email or password.");
              }
            }
          }
        } catch (backendError) {
          if (backendError.message === "Invalid email or password.") {
            throw backendError;
          }
          // PHP backend not reachable - continue to Supabase / demo check
        }

        /* ========================================
           2. TRY SUPABASE IF CONFIGURED
           ======================================== */
        if (!authenticated && window.TenspickSupabase && window.TenspickSupabase.isConfigured()) {
          const sb = window.TenspickSupabase.getClient();
          if (sb) {
            const { data: adminData } = await sb
              .from('admins')
              .select('*')
              .eq('email', formData.email)
              .eq('status', 1)
              .maybeSingle();

            if (adminData) {
              authenticated = true;
              adminUser = adminData;
            } else {
              // Check staff table for staff login
              const { data: staffData } = await sb
                .from('staff')
                .select('*')
                .or(`email.eq.${formData.email},username.eq.${formData.email}`)
                .eq('status', 'active')
                .maybeSingle();

              if (staffData) {
                authenticated = true;
                adminUser = {
                  id: staffData.id,
                  name: staffData.name,
                  email: staffData.email || formData.email,
                  role: staffData.designation || "Staff",
                  isStaff: true
                };
              }
            }
          }
        }

        /* ========================================
           3. FALLBACK AUTHENTICATION FOR STATIC / LOCAL
           ======================================== */
        if (!authenticated) {
          const inputEmail = (formData.email || "").toLowerCase().trim();

          // A. Block Client accounts from logging in via Admin/Staff page
          let isClientAccount = false;
          try {
            const cachedClients = localStorage.getItem("tenspick_clients");
            if (cachedClients) {
              const clientsArr = JSON.parse(cachedClients);
              if (Array.isArray(clientsArr)) {
                isClientAccount = clientsArr.some(c => {
                  const cEmail = (c.email || "").toLowerCase().trim();
                  const cLoginEmail = (c.login_email || "").toLowerCase().trim();
                  return cEmail === inputEmail || cLoginEmail === inputEmail;
                });
              }
            }
          } catch (e) {}

          if (isClientAccount) {
            throw new Error("Client account detected. Please use the Client Login Portal at /client/login.html");
          }

          // B. Check local staff cache
          const cachedStaff = localStorage.getItem("tenspick_staff");
          if (cachedStaff) {
            try {
              const staffArr = JSON.parse(cachedStaff);
              if (Array.isArray(staffArr)) {
                const foundStaff = staffArr.find(function (s) {
                  const sEmail = (s.email || "").toLowerCase();
                  const sUser = (s.username || "").toLowerCase();
                  return (sEmail === inputEmail || sUser === inputEmail);
                });
                if (foundStaff && formData.password.length >= 6) {
                  authenticated = true;
                  adminUser = {
                    id: foundStaff.id,
                    name: foundStaff.name,
                    email: foundStaff.email || formData.email,
                    designation: foundStaff.designation || "Staff Member",
                    role: "staff",
                    isStaff: true
                  };
                }
              }
            } catch (e) {}
          }

          // C. Check Admin / Default Staff emails
          if (!authenticated) {
            const isAdminEmail = (inputEmail === "tenspickofficial@gmail.com" || inputEmail === "admin@tenspick.org" || inputEmail === "admin@tenspick.local" || inputEmail.startsWith("admin"));
            const isStaffEmail = inputEmail.includes("staff") || inputEmail.includes("ramesh") || inputEmail.includes("priya") || inputEmail.includes("venkat");

            if ((isAdminEmail || isStaffEmail) && formData.password.length >= 6) {
              authenticated = true;
              adminUser = {
                id: isStaffEmail ? 2 : 1,
                name: isStaffEmail ? "Staff Member" : "Tenspick Admin",
                email: formData.email,
                role: isStaffEmail ? "staff" : "admin",
                isStaff: isStaffEmail,
                status: 1
              };
            } else {
              throw new Error("Invalid email or password. Client accounts must use the Client Portal.");
            }
          }
        }

        /* ========================================
           LOGIN SUCCESSFUL
           ======================================== */
        if (authenticated) {
          sessionStorage.setItem("tenspick_user", JSON.stringify(adminUser));
          sessionStorage.setItem("tenspick_authenticated", "true");

          // Route based on role: staff -> staff portal, admin -> admin panel
          const isStaffUser = adminUser && (adminUser.isStaff === true || String(adminUser.role || "").toLowerCase() === "staff");
          window.location.href = isStaffUser ? "staff/index.html" : "index.html";

        }

      } catch (error) {
        setMessage(
          loginMessage,
          error && error.message
            ? error.message
            : "Unable to connect to the server.",
        );

        setLoading(false);
      }
    });
  }
});
