-- ============================================================
-- TENSPICK CRM - SUPABASE POSTGRESQL DATABASE SCHEMA
-- ============================================================
-- Execute this SQL script in your Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================

-- ------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- AUTOMATED TIMESTAMP FUNCTION
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- ENUM TYPES
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'follow_up', 'proposal_sent', 'negotiation', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE client_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('planning', 'not_started', 'in_progress', 'review', 'client_review', 'completed', 'on_hold', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE milestone_status AS ENUM ('not_started', 'in_progress', 'completed', 'on_hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM ('todo', 'assigned', 'in_progress', 'review', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE task_update_type AS ENUM ('update', 'status_change', 'completion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE payment_method_enum AS ENUM ('cash', 'upi', 'bank_transfer', 'card', 'cheque', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE staff_payment_type_enum AS ENUM ('salary', 'advance', 'bonus', 'incentive', 'reimbursement', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 1. ADMINS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status SMALLINT NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_status ON admins(status);

DROP TRIGGER IF EXISTS trg_admins_updated_at ON admins;
CREATE TRIGGER trg_admins_updated_at
BEFORE UPDATE ON admins
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 2. STAFF TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    staff_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE,
    phone VARCHAR(30),
    department VARCHAR(100),
    designation VARCHAR(100),
    joining_date DATE,
    salary NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status client_status NOT NULL DEFAULT 'active',
    profile_image VARCHAR(255),
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_status ON staff(status);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff(department);
CREATE INDEX IF NOT EXISTS idx_staff_name ON staff(name);

DROP TRIGGER IF EXISTS trg_staff_updated_at ON staff;
CREATE TRIGGER trg_staff_updated_at
BEFORE UPDATE ON staff
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL ON UPDATE CASCADE,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    record_id BIGINT,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_admin ON activity_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_activity_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at);

-- ============================================================
-- 4. LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lead_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    company VARCHAR(150),
    phone VARCHAR(30),
    email VARCHAR(150),
    service VARCHAR(150),
    source VARCHAR(100),
    status lead_status NOT NULL DEFAULT 'new',
    priority lead_priority NOT NULL DEFAULT 'medium',
    follow_up_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_name ON leads(name);
CREATE INDEX IF NOT EXISTS idx_leads_company ON leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_date);

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 5. CLIENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    client_code VARCHAR(30) NOT NULL UNIQUE,
    source_lead_code VARCHAR(30),
    client_name VARCHAR(150) NOT NULL,
    company_name VARCHAR(150) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    whatsapp VARCHAR(20),
    email VARCHAR(150) NOT NULL,
    alternate_phone VARCHAR(20),
    business_type VARCHAR(100),
    industry VARCHAR(100),
    website VARCHAR(255),
    business_description TEXT,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    contact_person_name VARCHAR(150),
    contact_person_designation VARCHAR(100),
    contact_person_mobile VARCHAR(20),
    contact_person_email VARCHAR(150),
    billing_name VARCHAR(150),
    gst_number VARCHAR(30),
    pan_number VARCHAR(20),
    billing_address TEXT,
    login_email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status client_status NOT NULL DEFAULT 'active',
    internal_notes TEXT,
    hosting_platform VARCHAR(100),
    hosting_email VARCHAR(150),
    domain_registrar VARCHAR(100),
    domain_expiry_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_company ON clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_mobile ON clients(mobile);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

DROP TRIGGER IF EXISTS trg_clients_updated_at ON clients;
CREATE TRIGGER trg_clients_updated_at
BEFORE UPDATE ON clients
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. PROJECTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_code VARCHAR(30) NOT NULL UNIQUE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    project_name VARCHAR(200) NOT NULL,
    project_type VARCHAR(100),
    description TEXT,
    start_date DATE,
    expected_completion DATE,
    budget NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status project_status NOT NULL DEFAULT 'planning',
    progress_percentage SMALLINT NOT NULL DEFAULT 0,
    live_website_link VARCHAR(500),
    domain_purchased_email VARCHAR(255),
    seo_added_email VARCHAR(255),
    hosting_platform VARCHAR(100),
    hosting_email VARCHAR(150),
    domain_registrar VARCHAR(100),
    domain_expiry_date DATE,
    project_manager_id BIGINT REFERENCES staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(project_name);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_manager ON projects(project_manager_id);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON projects;
CREATE TRIGGER trg_projects_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 7. PROJECT MILESTONES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS project_milestones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
    milestone_name VARCHAR(200) NOT NULL,
    description TEXT,
    sequence_no INT NOT NULL DEFAULT 1,
    status milestone_status NOT NULL DEFAULT 'not_started',
    progress_percentage SMALLINT NOT NULL DEFAULT 0,
    start_date DATE,
    expected_completion DATE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_project_id ON project_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON project_milestones(status);

DROP TRIGGER IF EXISTS trg_project_milestones_updated_at ON project_milestones;
CREATE TRIGGER trg_project_milestones_updated_at
BEFORE UPDATE ON project_milestones
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_code VARCHAR(30) NOT NULL UNIQUE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    assigned_staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    task_title VARCHAR(200) NOT NULL,
    priority task_priority NOT NULL DEFAULT 'medium',
    description TEXT,
    start_date DATE,
    due_date DATE,
    status task_status NOT NULL DEFAULT 'todo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_staff ON tasks(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON tasks;
CREATE TRIGGER trg_tasks_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. TASK UPDATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS task_updates (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE ON UPDATE CASCADE,
    staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
    update_text TEXT NOT NULL,
    update_type task_update_type NOT NULL DEFAULT 'update',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_staff ON task_updates(staff_id);

DROP TRIGGER IF EXISTS trg_task_updates_updated_at ON task_updates;
CREATE TRIGGER trg_task_updates_updated_at
BEFORE UPDATE ON task_updates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 10. CLIENT PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS client_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_code VARCHAR(40) NOT NULL UNIQUE,
    client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    purpose VARCHAR(255),
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    payment_method payment_method_enum NOT NULL,
    transaction_id VARCHAR(150),
    remarks TEXT,
    project_amount_snapshot NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_before NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_after NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    remaining_after NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    added_by BIGINT REFERENCES staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_client ON client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_project ON client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON client_payments(payment_date);

DROP TRIGGER IF EXISTS trg_client_payments_updated_at ON client_payments;
CREATE TRIGGER trg_client_payments_updated_at
BEFORE UPDATE ON client_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. STAFF PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_code VARCHAR(40) NOT NULL UNIQUE,
    staff_id BIGINT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    payment_type staff_payment_type_enum NOT NULL DEFAULT 'salary',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_date DATE NOT NULL,
    payment_period VARCHAR(50) NOT NULL,
    payment_method payment_method_enum NOT NULL DEFAULT 'bank_transfer',
    remarks TEXT,
    added_by BIGINT REFERENCES staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_payments_staff ON staff_payments(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_payments_date ON staff_payments(payment_date);

DROP TRIGGER IF EXISTS trg_staff_payments_updated_at ON staff_payments;
CREATE TRIGGER trg_staff_payments_updated_at
BEFORE UPDATE ON staff_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 12. EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    expense_code VARCHAR(40) UNIQUE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    expense_date DATE NOT NULL,
    expense_type VARCHAR(50) NOT NULL DEFAULT 'company_expense',
    client_id BIGINT REFERENCES clients(id) ON DELETE SET NULL ON UPDATE CASCADE,
    client_name VARCHAR(150),
    project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE,
    project_name VARCHAR(200),
    paid_by VARCHAR(50) NOT NULL DEFAULT 'company',
    staff_id BIGINT REFERENCES staff(id) ON DELETE SET NULL ON UPDATE CASCADE,
    staff_name VARCHAR(150),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'upi',
    transaction_ref VARCHAR(150),
    status VARCHAR(50) NOT NULL DEFAULT 'paid',
    notes TEXT,
    receipt_base64 TEXT,
    receipt_file_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_client ON expenses(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 13. DOCUMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS documents (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size VARCHAR(50),
    file_url TEXT,
    file_base64 TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    project_id BIGINT REFERENCES projects(id) ON DELETE SET NULL ON UPDATE CASCADE,
    project_name VARCHAR(200),
    uploaded_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 14. ANNOUNCEMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    text TEXT NOT NULL,
    author VARCHAR(150) NOT NULL DEFAULT 'Admin',
    time_str VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 15. CHAT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_type VARCHAR(50) NOT NULL DEFAULT 'admin',
    sender_id BIGINT,
    sender_name VARCHAR(150),
    receiver_type VARCHAR(50) NOT NULL DEFAULT 'all',
    receiver_id BIGINT,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. WEBSITE CONTENT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS website_content (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    section_key VARCHAR(100) NOT NULL UNIQUE,
    content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_website_content_updated_at ON website_content;
CREATE TRIGGER trg_website_content_updated_at
BEFORE UPDATE ON website_content
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) & PUBLIC ACCESS POLICIES
-- ============================================================
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running script to avoid duplicate policy errors
DROP POLICY IF EXISTS "Allow public select admins" ON admins;
DROP POLICY IF EXISTS "Allow public all staff" ON staff;
DROP POLICY IF EXISTS "Allow public all leads" ON leads;
DROP POLICY IF EXISTS "Allow public all clients" ON clients;
DROP POLICY IF EXISTS "Allow public all projects" ON projects;
DROP POLICY IF EXISTS "Allow public all project_milestones" ON project_milestones;
DROP POLICY IF EXISTS "Allow public all tasks" ON tasks;
DROP POLICY IF EXISTS "Allow public all task_updates" ON task_updates;
DROP POLICY IF EXISTS "Allow public all client_payments" ON client_payments;
DROP POLICY IF EXISTS "Allow public all staff_payments" ON staff_payments;
DROP POLICY IF EXISTS "Allow public all activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Allow public all expenses" ON expenses;
DROP POLICY IF EXISTS "Allow public all documents" ON documents;
DROP POLICY IF EXISTS "Allow public all announcements" ON announcements;
DROP POLICY IF EXISTS "Allow public all chat_messages" ON chat_messages;
DROP POLICY IF EXISTS "Allow public all website_content" ON website_content;

-- Allow anon and authenticated roles full access
CREATE POLICY "Allow public select admins" ON admins FOR SELECT USING (true);
CREATE POLICY "Allow public all staff" ON staff FOR ALL USING (true);
CREATE POLICY "Allow public all leads" ON leads FOR ALL USING (true);
CREATE POLICY "Allow public all clients" ON clients FOR ALL USING (true);
CREATE POLICY "Allow public all projects" ON projects FOR ALL USING (true);
CREATE POLICY "Allow public all project_milestones" ON project_milestones FOR ALL USING (true);
CREATE POLICY "Allow public all tasks" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow public all task_updates" ON task_updates FOR ALL USING (true);
CREATE POLICY "Allow public all client_payments" ON client_payments FOR ALL USING (true);
CREATE POLICY "Allow public all staff_payments" ON staff_payments FOR ALL USING (true);
CREATE POLICY "Allow public all activity_logs" ON activity_logs FOR ALL USING (true);
CREATE POLICY "Allow public all expenses" ON expenses FOR ALL USING (true);
CREATE POLICY "Allow public all documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow public all announcements" ON announcements FOR ALL USING (true);
CREATE POLICY "Allow public all chat_messages" ON chat_messages FOR ALL USING (true);
CREATE POLICY "Allow public all website_content" ON website_content FOR ALL USING (true);

-- ============================================================
-- SEED DEFAULT ADMIN DATA
-- ============================================================
INSERT INTO admins (name, email, password_hash, status)
VALUES ('Tenspick Admin', 'tenspickofficial@gmail.com', '$2b$12$n/PSR6avIoPUco4xMsXdFO96dcrtUIIVJjTG1G6ivikAX5eqbCjhG', 1)
ON CONFLICT (email) DO NOTHING;

-- SEED SAMPLE LEADS
INSERT INTO leads (lead_code, name, company, phone, email, service, source, status, priority, follow_up_date, notes)
VALUES
('LD-20260830-0001', 'Ravi Kumar', 'Sri Lakshmi Traders', '9876543210', 'ravi@example.com', 'Website Development', 'website', 'new', 'high', '2026-09-02', 'Interested in a business website.'),
('LD-20260830-0002', 'Priya Reddy', 'Puttur Fashion Store', '9876543211', 'priya@example.com', 'Digital Marketing', 'referral', 'contacted', 'medium', '2026-09-04', 'Discussed social media marketing.'),
('LD-20260830-0003', 'Arun Kumar', 'Tirupati Electronics', '9876543212', 'arun@example.com', 'E-commerce Website', 'whatsapp', 'follow_up', 'high', '2026-09-05', 'Follow up regarding ecommerce quotation.')
ON CONFLICT (lead_code) DO NOTHING;

