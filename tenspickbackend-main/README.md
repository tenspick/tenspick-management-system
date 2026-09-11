# Tenspick Software Company Management System
## Phase 1 — Foundation + Secure Admin Authentication

### Stack
PHP + HTML + CSS + JavaScript + MySQL.

### Locked UI palette
--primary: #4B49AC
--primary-light: #98BDFF
--support-blue: #7DA0FA
--support-purple: #7978E9
--support-red: #F3797E

### Install
1. Copy this folder to `C:/xampp/htdocs/tenspickk/`.
2. Start Apache and MySQL in XAMPP.
3. Confirm the project root contains `.env`.
4. Open phpMyAdmin and import `database/schema.sql`.
5. Open `http://localhost/tenspickk/frontend/login.php`.
6. Use the administrator credentials shown at the end of `database/schema.sql`.
7. After first login, change the password from the database/user management workflow before production.

### API
Base URL:
`http://localhost/tenspickk/backend/public`

Health:
`http://localhost/tenspickk/backend/public/api/health`

The frontend uses one API base URL and appends each endpoint only once.

### Production
- Set APP_DEBUG=false.
- Use HTTPS and SESSION_SECURE=true.
- Use a non-root MySQL account with least privileges.
- Never commit `.env`.

## If login appears blank
Open:
`http://localhost/tenspickk/frontend/setup-check.php`

It checks PHP, `.env`, and MySQL. The project is written to work on PHP 7.4+.

