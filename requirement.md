# Goods Sampling Request (GSR) — requirements.md

## 1) Overview

**Product name:** Goods Sampling Request (GSR)  
**Purpose:** A web app that lets internal requestors submit goods sampling requests, and lets a Sales Manager coordinate internal staff (Production Engineer, Purchasing, Logistics) to prepare and ship sampling goods, with status tracking and email notifications.

**Primary outcomes**
- Requestors can submit a sampling request and track its status.
- Sales Manager can approve/reject and assign internal staff tasks.
- Assigned staff can acknowledge and complete their tasks independently.
- When a staff finishes, they can optionally “handoff/assign next step” to other **already-assigned** staff (for coordination).
- Logistics can mark the request as shipped and provide DHL tracking URL.
- All actions are recorded with an audit trail.

---

## 2) Roles & Permissions (RBAC)

### 2.1 Roles
1. **Requestor**
   - Create requests
   - View only their own requests
   - View status and history (comments, timestamps)
2. **Sales Manager**
   - View all requests
   - Approve/Reject requests with comments
   - Assign internal staff to a request (Production Engineer, Purchasing, Logistics)
   - Reset request status manually (with audit log)
3. **Staff (Production Engineer / Purchasing / Logistics)**
   - View requests where they are assigned
   - Acknowledge assigned tasks (with optional comment)
   - Mark tasks as Finished (with optional comment)
   - Optionally handoff/assign next step to other **assigned** staff (with optional comment)
4. **Admin (optional but recommended)**
   - Manage users and roles
   - Manage product catalog hierarchy
   - Manage email configuration (group email, sender identity, templates)
   - View system logs / audit logs

> Note: Admin can be merged into Sales Manager if you want fewer roles, but keep “admin-only” settings restricted.

### 2.2 Access rules
- Requestor **must not** access other requestors’ requests.
- Staff can see only requests where they are assigned (unless they are Sales Manager/Admin).
- Sales Manager/Admin can view and search all requests.
- All status changes must be permission-checked server-side (never rely on frontend checks).

---

## 3) Authentication & Accounts

### 3.1 Login
- Users must log in using:
  - **username:** email address
  - **password:** stored as a secure hash (e.g., Argon2 or bcrypt)
- Session handling:
  - Token-based auth (e.g., JWT) or secure cookie session (recommended).
- Account states:
  - Active / Disabled (Admin can disable accounts)

### 3.2 Password reset (required)
- “Forgot password” flow:
  - User enters email
  - System emails a **one-time reset link** with expiration (e.g., 15–60 minutes)
  - User sets new password
- Rate-limit login and reset endpoints.

### 3.3 Optional security (nice-to-have)
- MFA/2FA can be added later (out of scope for v1).

---

## 4) Product Catalog (Goods Hierarchy)

Goods are categorized with up to **3 sub-levels**, but some goods may have fewer levels.

Example full depth:
- Product category  
  - Product sub-category1  
    - Product sub-category2  
      - Product (leaf)

### 4.1 Requirements
- UI must support browsing/selecting products even when:
  - Only Category → Product
  - Category → Sub1 → Product
  - Category → Sub1 → Sub2 → Product
- Product selection must always end with choosing a **Product** (leaf item).
- Catalog must be manageable by Admin (CRUD):
  - Create/edit/disable nodes and products
  - Re-parent nodes (optional; if implemented, ensure data integrity)
  - Soft delete preferred (keep history)

### 4.2 Suggested data modeling approach
Use a **single hierarchical table** to handle variable depth:

- `product_nodes` (tree structure)
  - `id`, `name`, `parent_id`, `node_type` (CATEGORY | SUBCATEGORY | PRODUCT), `is_active`, `sort_order`
- Optional:
  - `products` table if you want product-specific attributes (SKU, description, etc.), linked to a PRODUCT node.

---

## 5) Work Request (Sampling Request) Data

### 5.1 Core fields (v1)
When Requestor selects a Product, they must fill:

- **Purpose** (text, required)
- **Volume (kg)** (number, required, > 0, allow decimals)
- **Unit (sampling units)** (integer, required, > 0)
- **Receiving address** (text, required)
- **Receiving person**
  - name (required)
  - lastname (required)
  - email (required, valid email)
  - phone number (required)
- **Target receiving by** (date, required)

### 5.2 Future fields (extensibility requirement)
- The system must support adding more fields later without breaking old data.
- Recommended: store additional fields in a JSONB column, e.g. `extra_fields JSONB`, and build the backend to accept/return it.
- Optional v2: Admin-managed “Custom Fields” configuration (label/type/required).

---

## 6) Work Request Number & Status

### 6.1 Work Request number
On submit, the system assigns a unique **Work Request number**.

**Suggested format (readable):**
- `GSR-YYYYMMDD-####` (daily sequence)
  - Example: `GSR-20260220-0007`

### 6.2 Work Request statuses
Status values (exact strings recommended):

1. `submitted`  
   - After requestor submits
2. `rejected` / `approved`  
   - After Sales Manager decision
3. `preparing_goods_sampling`  
   - After **all assigned staff** click Acknowledged
4. `ready_to_ship`  
   - After **all assigned staff** click Finished
5. `shipped`  
   - After Logistics enters DHL tracking URL and clicks Shipped

### 6.3 Manual reset by Sales Manager
- Sales Manager can reset status to an earlier state.
- Must require:
  - Reason/comment (required)
  - Audit log entry (who, when, from_status, to_status, reason)
- Guardrails:
  - If resetting from `shipped`, require an extra confirmation and reason (or restrict to Admin only).

---

## 7) Workflow & Business Rules

## 7.1 Request Submission (Requestor)
1. Requestor logs in
2. Requestor creates a new request:
   - Select Product (from hierarchy)
   - Fill required fields
3. Requestor clicks **Submit**
4. System:
   - Creates Work Request + Work Request number
   - Sets status = `submitted`
   - Shows success message: “Your request has been submitted successfully.”
   - Sends emails (see section 8)

## 7.2 Sales Manager Approval / Rejection
Sales Manager logs in and opens a submitted Work Request.

### Rejection
- Sales Manager clicks **Reject**, adds required comment.
- System:
  - status → `rejected`
  - sends rejection email to Requestor including comment

### Approval + Assignment
- Sales Manager clicks **Approve**, adds optional comment.
- Sales Manager assigns staff via checkboxes:
  - Production Engineer (0..n)
  - Purchasing (0..n)
  - Logistics (0..n)
- System:
  - status → `approved`
  - creates tasks for each assigned staff
  - emails:
    - Assigned staff (To) with request link, **CC Sales Manager**
    - Requestor informing the request is approved

## 7.3 Staff Acknowledgement
Each assigned staff:
- Navigates to “My Tasks”
- Opens the request
- Clicks **Acknowledge** (optional comment)

When **all tasks are acknowledged**:
- System sets status → `preparing_goods_sampling`
- System sends an update email to:
  - Sales Manager + all assigned staff  
  - (No email to Requestor at this stage)

## 7.4 Staff Work Completion (Independent + Optional Handoff)
Each assigned staff works **independently**.

When an assigned staff completes their part:
- They click **Finished** (optional comment)
- They may optionally select **other already-assigned staff** to “proceed the next step” (handoff)

### Handoff rules
- A staff can only handoff to users who are already assigned on the same Work Request.
- Handoff does **not** change the overall assignment list; it is a coordination/notification action.
- On handoff, system sends an email notification to the selected staff:
  - To: selected staff
  - CC: Sales Manager
  - Contains Work Request link and handoff comment (if any)
- Handoff events must be recorded in:
  - comments/history timeline
  - audit logs

When **all assigned tasks are finished**:
- System sets status → `ready_to_ship`
- System sends an update email to:
  - Sales Manager + all assigned staff  
  - (No email to Requestor at this stage)

## 7.5 Shipping (Logistics)
- Logistics opens a `ready_to_ship` Work Request
- Inputs:
  - DHL tracking URL (required)
  - Optional: carrier name, tracking number
- Clicks **Shipped**
- System:
  - status → `shipped`
  - sends email to Requestor with tracking URL, and **CC**:
    - Sales Manager
    - all assigned staff

> Next step (DHL pickup appointment) is handled in a separate system and is out of scope.

---

## 8) Email Notifications (SMTP)

### 8.1 Email recipients and rules
1. **On Submit (`submitted`)**
   - Email to Requestor
   - Email to **Manufacturing Group Email** (distribution list)
2. **On Reject (`rejected`)**
   - Email to Requestor with rejection comment
3. **On Approve (`approved`)**
   - Email to Requestor (approved notice)
   - Email to each assigned staff (To) with request link, **CC Sales Manager**
4. **When all Acknowledged (`preparing_goods_sampling`)**
   - Email to Sales Manager + all assigned staff
5. **On Staff Handoff (any time after approval)**
   - Email to selected staff (To), **CC Sales Manager**
6. **When all Finished (`ready_to_ship`)**
   - Email to Sales Manager + all assigned staff
7. **On Shipped (`shipped`)**
   - Email to Requestor with tracking URL, **CC** Sales Manager + all assigned staff

### 8.2 Email content requirements (minimum)
Each email must include:
- Work Request number
- Current status
- Key request summary:
  - Product path + Product name
  - Purpose
  - Volume, Unit
  - Target receiving by
  - Receiving address
  - Receiving person details
- A direct URL link to the Work Request page in the app
- For reject: rejection comment
- For shipped: DHL tracking URL
- For handoff: handoff note + who handed off to whom

### 8.3 SMTP configuration
- Set via environment variables:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TLS`
- Support TLS/STARTTLS.
- Email sending must be retried on transient failures; failures must be logged.

---

## 9) UI / Pages (Frontend)

### 9.1 General UI requirements
- Style: **Modern, light, bright orange tone**
- Responsive design for desktop first; tablet support recommended.
- Consistent status badges and timeline.

### 9.2 Pages
1. **Login**
   - Email + Password
   - Forgot password
2. **Requestor Dashboard**
   - “Create New Request” button
   - List of own requests (search by Work Request number, filter by status)
3. **Create Request Form**
   - Product selector (hierarchy)
   - Required fields + validation
   - Submit
4. **Work Request Details (common)**
   - Header: Work Request number + status badge
   - Product info + request form details
   - Status timeline (who/when)
   - Comments history (Sales Manager + staff actions + handoffs)
5. **Sales Manager Dashboard**
   - Queue views: submitted / approved / preparing / ready_to_ship / shipped / rejected
   - Approve/Reject actions
   - Assign staff (checkbox list grouped by role)
   - Manual status reset action (requires reason)
6. **Staff Dashboard (“My Tasks”)**
   - Requests assigned to me
   - Filters: active / acknowledged / finished (and/or by request status)
   - Acknowledge + Finished actions with comments
   - On Finished: optional multi-select “Handoff to assigned staff”
7. **Logistics Shipping Update**
   - Input DHL tracking URL
   - Shipped button
8. **Admin (optional)**
   - User management (create/edit/disable, roles)
   - Product catalog management
   - Settings (manufacturing group email, app base URL)

---

## 10) Backend (NodeJS) Requirements

### 10.1 API style
- REST API (JSON) is sufficient for v1.
- All endpoints must enforce authorization.
- Use input validation (e.g., zod / joi) on every write endpoint.

### 10.2 Suggested endpoints (example)
Auth
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

Products
- `GET /api/catalog/tree`
- `GET /api/products/:id`

Work Requests
- `POST /api/work-requests` (create)
- `GET /api/work-requests` (list; scoped by role)
- `GET /api/work-requests/:id`
- `PATCH /api/work-requests/:id` (edit allowed fields; role-restricted)
- `POST /api/work-requests/:id/approve`
- `POST /api/work-requests/:id/reject`
- `POST /api/work-requests/:id/reset-status`
- `POST /api/work-requests/:id/ship`

Tasks / Staff actions
- `GET /api/tasks/my`
- `POST /api/tasks/:id/acknowledge`
- `POST /api/tasks/:id/finish`  
  - payload may include: `handoff_to_user_ids: string[]` + `handoff_comment?: string`

Admin
- `GET/POST/PATCH /api/admin/users...`
- `GET/POST/PATCH /api/admin/catalog...`
- `GET/POST/PATCH /api/admin/settings...`

---

## 11) Database (PostgreSQL) — Suggested Schema

> Exact schema can be adjusted, but must support auditability and future extensibility.

### 11.1 Tables
**users**
- id (uuid)
- email (unique)
- password_hash
- display_name
- phone (optional)
- role (enum: REQUESTOR | SALES_MANAGER | STAFF | ADMIN)
- staff_type (enum: PRODUCTION_ENGINEER | PURCHASING | LOGISTICS | NULL)
- is_active
- created_at, updated_at

**product_nodes**
- id (uuid)
- name
- parent_id (uuid, nullable)
- node_type (enum: CATEGORY | SUBCATEGORY | PRODUCT)
- is_active
- sort_order
- created_at, updated_at

**work_requests**
- id (uuid)
- work_request_no (unique)
- requestor_user_id (fk users)
- product_node_id (fk product_nodes, must be PRODUCT)
- status (enum per section 6.2)
- purpose (text)
- volume_kg (numeric)
- unit_count (int)
- receiving_address (text)
- receiving_person_firstname
- receiving_person_lastname
- receiving_person_email
- receiving_person_phone
- target_receiving_by (date)
- dhl_tracking_url (text, nullable)
- extra_fields (jsonb, nullable)
- created_at, updated_at

**work_request_assignments** (who is assigned)
- id (uuid)
- work_request_id (fk)
- user_id (fk)
- assigned_by (fk users)
- assigned_role (enum: PRODUCTION_ENGINEER | PURCHASING | LOGISTICS)
- created_at

**tasks**
- id (uuid)
- work_request_id (fk)
- assignee_user_id (fk users)
- task_role (enum: PRODUCTION_ENGINEER | PURCHASING | LOGISTICS)
- state (enum: active | acknowledged | finished)
- acknowledged_at, finished_at
- created_at, updated_at

**task_handoffs** (coordination / “assign next step”)
- id (uuid)
- work_request_id (fk)
- from_user_id (fk users)
- to_user_id (fk users)
- note (text, nullable)
- created_at

**comments**
- id (uuid)
- work_request_id (fk)
- author_user_id (fk)
- comment_type (enum: requestor_note | manager_decision | staff_ack | staff_finish | handoff | system | status_reset)
- body (text)
- created_at

**audit_logs**
- id (uuid)
- actor_user_id (fk users, nullable for system)
- entity_type (work_request | task | user | product_node | settings | task_handoff)
- entity_id (uuid)
- action (string)
- before (jsonb, nullable)
- after (jsonb, nullable)
- created_at

**settings**
- key (text, pk)
- value (jsonb)
- updated_at

### 11.2 Data integrity rules
- `work_requests.product_node_id` must reference a PRODUCT node.
- Only Sales Manager/Admin can approve/reject/reset status.
- Only assignee can acknowledge/finish their task.
- Handoff can only target users who are assigned to that Work Request.
- Status transitions must be validated server-side (state machine).

---

## 12) Status Transition Rules (State Machine)

Allowed transitions (recommended):
- submitted → approved
- submitted → rejected
- approved → preparing_goods_sampling (when all tasks acknowledged)
- preparing_goods_sampling → ready_to_ship (when all tasks finished)
- ready_to_ship → shipped
- Manual reset: Sales Manager can set any status, but must log reason.

---

## 13) Logging, Audit, and Monitoring

### 13.1 Audit log (required)
Log every action:
- Create request
- Approve / Reject
- Assign staff
- Acknowledge / Finish tasks
- Task handoffs
- Manual status reset
- Shipping update
- Product catalog changes
- User/role changes

### 13.2 Application logs
- Error logs (API errors, email failures)
- Security logs (failed logins, suspicious activity)

---

## 14) Non-Functional Requirements

### 14.1 Security
- Password hashing (Argon2/bcrypt), never store plaintext.
- HTTPS required in production.
- Validate and sanitize all inputs.
- Rate limiting on auth endpoints.
- Prevent IDOR (Insecure Direct Object Reference) with strict authorization checks.
- CSRF protection if using cookie sessions.

### 14.2 Performance
- Typical users: small-to-medium manufacturing org (tens to low hundreds).
- Pages should load quickly; list endpoints must support pagination and filtering.

### 14.3 Reliability
- Database migrations (e.g., Prisma Migrate / Knex / TypeORM migrations).
- Backups for PostgreSQL (daily) and ability to restore.

### 14.4 Usability
- Clear status badges and a timeline to show progress.
- Search by Work Request number.

---

## 15) Deployment & Configuration

### 15.1 Environment variables (minimum)
- `APP_BASE_URL`
- `DATABASE_URL`
- `JWT_SECRET` (if JWT)
- SMTP variables (section 8.3)

### 15.2 Suggested deployment
- Dockerized services:
  - frontend
  - backend
  - postgres
- Reverse proxy (nginx / Caddy) + TLS in production.

---

## 16) Out of Scope (v1)
- DHL appointment scheduling (handled by another system)
- Inventory deduction / ERP integration
- Chat/real-time notifications (email only)

---

## 17) Acceptance Criteria (Checklist)

### Requestor
- Can log in and submit a request
- Receives confirmation email with Work Request number and link
- Can see request status and history in the app

### Sales Manager
- Receives email on new submissions (via manufacturing group email)
- Can approve/reject with comments
- Can assign staff and trigger staff notification emails
- Can reset status with reason and audit log

### Staff
- Receives assignment email with link
- Can acknowledge with comment
- Can mark finished with comment
- Can optionally handoff to other assigned staff (email sent; logged)
- Status updates to preparing/ready-to-ship only when all tasks reach required states

### Logistics
- Can add DHL tracking URL and mark shipped
- Requestor gets shipped email with tracking URL and link

### System
- Every action produces an audit log entry
- Role-based access is enforced
- Emails are sent via SMTP and failures are logged

---
