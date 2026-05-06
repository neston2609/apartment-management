# CLAUDE.md — Apartment Management System

This file is the **complete requirement & design specification** for a working full-stack apartment management application. It is intended to be self-contained: an LLM coding agent (e.g. Claude Cowork) should be able to read this file and reproduce the system end-to-end without needing the original codebase.

The original implementation lives at `G:\ollama\apartment-management-system` (Windows host). This document describes what to build, not how the existing files happen to be arranged.

---

## 1. Product Summary

A web application for managing rental apartments in Thailand. The UI is fully Thai (Buddhist Era dates, Thai labels). Two main user types log in:

- **Admin users** (three sub-roles) manage apartments, rooms, tenants, billing, and PDF output.
- **Tenants** see their own bills, contract, and profile.

Core capabilities the system must support:

- Manage multiple apartments, each with its own rooms, expense settings, and contract terms.
- Track each room's price, status, occupancy, and free-text notes.
- Manage tenants (create, edit, move-out) with bcrypt-hashed login passwords.
- Generate monthly bills from water + electricity meter readings, with rollover support.
- Bulk-import meter readings from an Excel sheet.
- Print Thai or English PDF invoices (A4 / A5 landscape) — single bill or many bills in one file.
- Print a Thai PDF rental contract whose **ข้อตกลงและเงื่อนไข** (terms) are configurable per apartment.
- Three-tier admin RBAC (super admin / admin / property manager).
- Forgot-password flow that emails a one-time reset link via SMTP configured in-app.
- Dashboard with selectable room-status filter for revenue aggregation.

---

## 2. Tech Stack

| Layer       | Technology                                                       |
|-------------|------------------------------------------------------------------|
| Backend     | Node.js 20 + Express 4 (port 5000)                               |
| Frontend    | React 18 + react-router 6 + TailwindCSS 3 (port 3000)            |
| Database    | PostgreSQL (external host)                                       |
| PDF         | PDFKit (with Sarabun TTF for Thai)                               |
| Auth        | JWT (`jsonwebtoken`), bcrypt (salt rounds = 10)                  |
| Validation  | `express-validator`                                              |
| Email       | `nodemailer` (SMTP from DB-stored config)                        |
| Excel       | `xlsx` (frontend-side parsing)                                   |
| HTTP client | `axios` (with token + 401 interceptors)                          |
| Icons       | `@heroicons/react`                                               |
| Toasts      | `react-hot-toast`                                                |
| Dev tools   | `concurrently`, `nodemon`, `dotenv`                              |
| Deployment  | Docker (multi-stage), `docker-compose`, GitHub Actions optional  |

Fonts: load `IBM Plex Sans Thai` and `Sarabun` from Google Fonts in the frontend; the backend ships `Sarabun-Regular.ttf` and `Sarabun-Bold.ttf` under `backend/utils/fonts/` for PDFKit. If the TTFs are missing, fall back to Helvetica.

Brand color (used widely; defined in `tailwind.config.js`):

```
brand: { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' }
```

---

## 3. Repository Layout

```
apartment-management-system/
├── CLAUDE.md
├── README.md, DEPLOY.md
├── package.json                      # root scripts via concurrently
├── docker-compose.yml
├── .env, .env.example, .env.development, .env.production.example
├── .github/workflows/deploy.yml
│
├── database/
│   ├── bootstrap.sql                 # creates apartment_db if missing
│   ├── schema.sql                    # full schema (DROP + CREATE)
│   ├── seed.sql                      # static seed (apartment + rooms + settings)
│   ├── seed.js                       # bcrypt-aware seeding for admin + tenants + bills
│   ├── migrate.js                    # runs schema.sql
│   ├── import-csv.js                 # optional CSV import helper
│   ├── diagnose.js, check-admin.js   # diagnostic CLIs
│   ├── migrate-001-add-role.sql      # add admin_users.role
│   ├── migrate-002-rooms-and-system.sql  # rooms.notes, tenants.address, system_settings, password_reset_tokens
│   └── migrations/001_add_contract_terms.sql
│
├── backend/
│   ├── package.json
│   ├── Dockerfile
│   ├── server.js                     # Express bootstrap (helmet, cors, json, routes, error handler)
│   ├── config/database.js            # pg Pool (with optional SSL)
│   ├── middleware/auth.js            # authenticate, adminOnly, tenantOnly, superAdminOnly, requireAdminRoles, signToken
│   ├── routes/
│   │   ├── auth.js                   # /api/auth/*
│   │   ├── apartments.js             # /api/apartments/*
│   │   ├── rooms.js                  # /api/rooms/*
│   │   ├── tenants.js                # /api/tenants/*
│   │   ├── bills.js                  # /api/bills/*
│   │   ├── settings.js               # /api/settings/:apt
│   │   ├── users.js                  # /api/users/*  (super-admin)
│   │   ├── system-settings.js        # /api/system-settings/* (super-admin)
│   │   └── login-logs.js             # /api/login-logs (super-admin)
│   └── utils/
│       ├── pdf.js                    # contract + invoice (Thai/English) + bulk
│       ├── contractDefaults.js       # DEFAULT_CONTRACT_TERMS
│       ├── mailer.js                 # SMTP via system_settings
│       └── fonts/                    # Sarabun-Regular.ttf, Sarabun-Bold.ttf
│
└── frontend/
    ├── package.json, Dockerfile
    ├── tailwind.config.js, postcss.config.js
    ├── public/index.html             # loads Google Fonts (Plex Thai + Sarabun)
    └── src/
        ├── index.js, index.css
        ├── App.jsx                   # Routes (admin, tenant, public)
        ├── context/AuthContext.jsx   # localStorage-backed JWT + user
        ├── utils/api.js              # axios instance + helpers (THAI_MONTHS, thaiYear, fmtMoney, fmtThaiDate, unwrap)
        ├── components/
        │   ├── Layout.jsx, Sidebar.jsx, Navbar.jsx
        │   ├── PrivateRoute.jsx, ChangePasswordModal.jsx
        │   └── common/{Modal,Table,Badge,Spinner,Alert}.jsx
        ├── utils/billStatus.js        # paymentStatus() — derives รอชำระ/เกินกำหนด/...
        └── pages/
            ├── Login.jsx, ForgotPassword.jsx, ResetPassword.jsx
            ├── admin/{Dashboard,Apartments,Rooms,Tenants,TenantForm,
            │           Billing,BillingForm,BillingImport,Invoice,
            │           Settings,Users,SystemSettings,LoginLogs}.jsx
            └── tenant/{TenantDashboard,TenantBills,TenantContract,TenantProfile}.jsx
```

---

## 4. Environment Variables

`.env` at the repo root (read by both `backend/server.js` and `database/*.js` via `dotenv` with explicit path = repo root).

```
# Database
DB_HOST=...
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=...
DB_NAME=apartment_db
DB_SSL=false                  # 'true' to enable rejectUnauthorized:false SSL

# JWT
JWT_SECRET=please_change_to_a_long_random_string_minimum_32_chars
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# Frontend (Create React App reads at build time)
REACT_APP_API_URL=http://localhost:5000/api
```

Frontend `package.json` has `"proxy": "http://localhost:5000"` so dev mode also works without `REACT_APP_API_URL`.

SMTP credentials are **NOT** in `.env`. They live in the `system_settings` table and are edited via the in-app Super-Admin UI; the change takes effect on the next mail send (no restart).

---

## 5. Root Scripts (`package.json`)

```json
{
  "scripts": {
    "install:all":   "npm install && cd backend && npm install && cd ../frontend && npm install",
    "dev":           "concurrently \"cd backend && npm run dev\" \"cd frontend && npm start\"",
    "build":         "cd frontend && npm run build",
    "start":         "cd backend && npm start",
    "db:migrate":    "node database/migrate.js",
    "db:seed":       "node database/seed.js",
    "db:diagnose":   "node database/diagnose.js",
    "db:check-admin":"node database/check-admin.js"
  }
}
```

The backend's `npm run dev` uses `nodemon server.js`. The frontend uses CRA (`react-scripts start`); on Windows the start script sets `HOST=localhost` and `BROWSER=none`.

---

## 6. Database Schema (Postgres)

`database/schema.sql` is the canonical, drop-and-recreate definition. Migration files apply additive changes for already-deployed databases (use `IF NOT EXISTS`).

### 6.1 Enum

```sql
CREATE TYPE room_status AS ENUM ('occupied','vacant','maintenance','common','caretaker');
```

### 6.2 Tables

```sql
CREATE TABLE apartments (
    apartment_id    SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    address         TEXT NOT NULL,
    contact_number  VARCHAR(20),
    floors_count    INTEGER NOT NULL DEFAULT 1,
    rooms_per_floor INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rooms (
    room_id         SERIAL PRIMARY KEY,
    apartment_id    INTEGER NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    floor_number    INTEGER NOT NULL,
    room_sequence   INTEGER NOT NULL,
    room_number     VARCHAR(20) NOT NULL,        -- floor + LPAD(seq,2,'0')
    rental_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
    status          room_status   NOT NULL DEFAULT 'vacant',
    notes           TEXT,                        -- admin free text per room
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(apartment_id, room_number)
);

CREATE TABLE tenants (
    tenant_id       SERIAL PRIMARY KEY,
    room_id         INTEGER REFERENCES rooms(room_id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(20),
    national_id     VARCHAR(20)  UNIQUE NOT NULL,
    move_in_date    DATE NOT NULL,
    move_out_date   DATE,
    email           VARCHAR(255),
    password_hash   VARCHAR(255) NOT NULL,        -- bcrypt(national_id) by default
    address         TEXT,                         -- separate from notes
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expense_settings (
    setting_id                  SERIAL PRIMARY KEY,
    apartment_id                INTEGER NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    water_price_per_unit        DECIMAL(10,2) NOT NULL DEFAULT 0,
    water_max_units             INTEGER       NOT NULL DEFAULT 9999,
    electricity_price_per_unit  DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_max_units       INTEGER       NOT NULL DEFAULT 9999,
    invoice_footer_text         TEXT DEFAULT '',
    contract_terms              TEXT DEFAULT '', -- per-apartment override; one rule per line
    payment_due_day             INTEGER,         -- day of month rent is due (1-31), nullable
    late_fee_per_day            DECIMAL(10,2) NOT NULL DEFAULT 0, -- THB / day late
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(apartment_id)
);

CREATE TABLE meter_readings (
    reading_id                  SERIAL PRIMARY KEY,
    room_id                     INTEGER NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    month                       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year                        INTEGER NOT NULL,
    water_units_last            DECIMAL(10,2) NOT NULL DEFAULT 0,
    water_units_current         DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_units_last      DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_units_current   DECIMAL(10,2) NOT NULL DEFAULT 0,
    rollover_water              BOOLEAN DEFAULT FALSE,
    rollover_electricity        BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

CREATE TABLE bills (
    bill_id          SERIAL PRIMARY KEY,
    room_id          INTEGER NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    month            INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year             INTEGER NOT NULL,
    water_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    rent_cost        DECIMAL(10,2) NOT NULL DEFAULT 0,
    other_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_cost       DECIMAL(10,2) NOT NULL DEFAULT 0,
    paid_at          TIMESTAMPTZ,                    -- when the bill was marked paid (NULL = unpaid)
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);

CREATE TABLE admin_users (
    admin_id        SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    email           VARCHAR(255),
    apartment_id    INTEGER REFERENCES apartments(apartment_id),
    is_super_admin  BOOLEAN DEFAULT FALSE,
    role            VARCHAR(50) NOT NULL DEFAULT 'admin',  -- super_admin | admin | property_manager
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Key/value config (SMTP, app base URL, etc.)
CREATE TABLE system_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Single-use tokens for forgot-password
CREATE TABLE password_reset_tokens (
    token_id    SERIAL PRIMARY KEY,
    token       VARCHAR(128) UNIQUE NOT NULL,
    user_kind   VARCHAR(20)  NOT NULL,            -- 'admin' | 'tenant'
    user_id     INTEGER      NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Login activity log (every attempt — success or failure)
CREATE TABLE login_logs (
    log_id        SERIAL PRIMARY KEY,
    user_kind     VARCHAR(20),                    -- 'admin' | 'tenant' | NULL when unknown user
    user_id       INTEGER,                        -- admin_id or tenant_id (NULL on unknown)
    identifier    TEXT,                           -- the username / national_id / room_number entered
    success       BOOLEAN NOT NULL,
    error_reason  TEXT,                           -- 'unknown_user' | 'wrong_password' | 'inactive'
    ip            TEXT,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 Indexes

```sql
CREATE INDEX idx_rooms_apartment_id        ON rooms(apartment_id);
CREATE INDEX idx_rooms_status              ON rooms(status);
CREATE INDEX idx_tenants_room_id           ON tenants(room_id);
CREATE INDEX idx_tenants_national_id       ON tenants(national_id);
CREATE INDEX idx_tenants_is_active         ON tenants(is_active);
CREATE INDEX idx_meter_readings_room_id    ON meter_readings(room_id);
CREATE INDEX idx_meter_readings_month_year ON meter_readings(month, year);
CREATE INDEX idx_bills_room_id             ON bills(room_id);
CREATE INDEX idx_bills_month_year          ON bills(month, year);
CREATE INDEX idx_bills_paid_at             ON bills(paid_at);
CREATE INDEX idx_expense_settings_apt      ON expense_settings(apartment_id);
CREATE INDEX idx_admin_users_role          ON admin_users(role);
CREATE INDEX idx_prt_token                 ON password_reset_tokens(token);
CREATE INDEX idx_prt_user                  ON password_reset_tokens(user_kind, user_id);
CREATE INDEX idx_login_logs_created_at     ON login_logs(created_at DESC);
CREATE INDEX idx_login_logs_user           ON login_logs(user_kind, user_id);
CREATE INDEX idx_login_logs_success        ON login_logs(success);
```

### 6.4 Seed default `system_settings` rows

```sql
INSERT INTO system_settings (key, value) VALUES
  ('smtp_host',''), ('smtp_port','587'), ('smtp_secure','false'),
  ('smtp_user',''), ('smtp_password',''), ('smtp_from',''),
  ('app_base_url','http://localhost:3000')
ON CONFLICT (key) DO NOTHING;
```

---

## 7. Authentication, Roles & RBAC

### 7.1 Token shape

`signToken(payload)` issues a JWT signed with `JWT_SECRET`, expiring after `JWT_EXPIRES_IN` (default `7d`).

- **Admin token payload:** `{ id, role: 'admin', admin_role, username, is_super_admin, apartment_id }`
- **Tenant token payload:** `{ id, role: 'tenant', room_id, apartment_id }`

`admin_role` is one of `super_admin | admin | property_manager`. `is_super_admin` is kept as a legacy boolean and is mirrored from `admin_role === 'super_admin'`.

### 7.2 Middleware (`backend/middleware/auth.js`)

```
authenticate            -> verifies Bearer token, sets req.user
adminOnly               -> req.user.role === 'admin'
tenantOnly              -> req.user.role === 'tenant'
superAdminOnly          -> admin AND admin_role === 'super_admin'
requireAdminRoles(...allowed) -> admin AND admin_role in allowed
signToken(payload)
```

### 7.3 Role capabilities (UI + API)

| Capability                                  | super_admin | admin | property_manager | tenant |
|---------------------------------------------|:-----------:|:-----:|:----------------:|:------:|
| Login                                        | ✅ | ✅ | ✅ | ✅ |
| Dashboard                                    | ✅ | ✅ | ✅ | ❌ |
| Apartments — list page                       | ✅ | ✅ | ✅ (read-only; no add/edit/delete buttons) | ❌ |
| Apartments — create / edit / delete         | ✅ | ✅ | ❌ | ❌ |
| Rooms — view + edit single room (status / notes / price / number) | ✅ | ✅ | ✅ | ❌ |
| Rooms — bulk floor-price update              | ✅ | ✅ | ❌ | ❌ |
| Tenants — list page                          | ✅ | ✅ | ✅ | ❌ |
| Tenants — edit existing tenant + download contract | ✅ | ✅ | ✅ | ❌ |
| Tenants — create new / move-out              | ✅ | ✅ | ❌ | ❌ |
| Billing — list page                          | ✅ | ✅ | ✅ | ❌ |
| Billing — create / edit individual bills (BillingForm) | ✅ | ✅ | ❌ | ❌ |
| Billing — Excel import / bulk-mark-paid                | ✅ | ✅ | ❌ | ❌ |
| Billing — mark-paid / mark-unpaid (per row)            | ✅ | ✅ | ✅ | ❌ |
| Print Invoice page (single + bulk PDF)       | ✅ | ✅ | ✅ | ❌ |
| Settings (per-apartment expense + contract)  | ✅ | ✅ | ❌ | ❌ |
| User Management (`/admin/users`)             | ✅ | ❌ | ❌ | ❌ |
| System Settings — SMTP (`/admin/system-settings`) | ✅ | ❌ | ❌ | ❌ |
| Login activity log (`/admin/login-logs`)     | ✅ | ❌ | ❌ | ❌ |
| Tenant own dashboard / bills / contract / profile (incl. payment status) | ❌ | ❌ | ❌ | ✅ |

The Sidebar (`frontend/src/components/Sidebar.jsx`) is the source of truth for visibility. After login, all admin sub-roles redirect to `/admin/dashboard`; tenants redirect to `/tenant/dashboard`.

**Property manager sidebar links** (`PROPERTY_MANAGER_LINKS`):
```
/admin/dashboard   แดชบอร์ด
/admin/apartments  อพาร์ทเมนต์         (read-only list — used as a gateway to /admin/rooms/:id)
/admin/tenants     ผู้เช่า              (edit existing tenants, download contract)
/admin/billing     ใบแจ้งค่าเช่า        (mark-paid / mark-unpaid only — cannot create or edit bills)
/admin/invoice     พิมพ์ใบแจ้งหนี้
```

**Frontend guards for property_manager** (driven by `useAuth().user.admin_role`):
- `Apartments.jsx` — hide "เพิ่มอพาร์ทเมนต์" button + "แก้ไข" / "ลบ" actions per row. The "ห้องพัก / ตั้งราคา" link is always visible.
- `Rooms.jsx` — hide "ปรับราคาทั้งชั้น" button, the "+ เพิ่มห้อง" tile, and the "ลบห้อง" button in the edit modal. Single-room edit modal is otherwise fully usable (status, notes, price, room_number).
- `Tenants.jsx` — hide "เพิ่มผู้เช่า" button + "ย้ายออก" action per row. "แก้ไข" + "สัญญา" stay visible.
- `Billing.jsx` — hide header buttons "✓ ชำระแล้วทุกห้อง" + "นำเข้าจาก Excel", and the per-row "สร้าง" / "แก้ไข" link. The per-row "✓ ทำเครื่องหมายชำระแล้ว" / "ยกเลิกการชำระ" button **stays visible** — property_manager can toggle payment status on existing bills.

**Backend enforcement** (the source of truth):
- `requireAdminRoles('super_admin', 'admin')` (alias `fullAdmin`) — guards apartment create/update/delete, room bulk floor-price, tenant create / move-out, settings PUT, billing import, bulk-mark-paid, **bill create/update** (`POST /api/bills`, `PUT /api/bills/:id`).
- Bill mark-paid / mark-unpaid (`POST /api/bills/:id/mark-paid`, `/mark-unpaid`) only require `adminOnly` — property_manager passes.
- All other admin routes (any tenant edit, single-room edit, listing endpoints, contract PDF, invoice PDF) only require `adminOnly` — property_manager passes.

---

## 8. Backend API

All responses use the envelope `{ data: ... }` for success and `{ error: 'message' }` for failure. The frontend's `unwrap` helper extracts `r.data.data ?? r.data`.

### 8.1 `/api/auth`

| Method | Path                      | Auth                | Body / behaviour |
|--------|---------------------------|---------------------|------------------|
| POST   | `/login`                   | public              | `{ username, password }` → `{ token, user }` (admin) |
| POST   | `/tenant/login`            | public              | `{ national_id, password }` → `{ token, user }` (only when `is_active = TRUE`). The `national_id` field also accepts a **room number** — server first looks up by `tenants.national_id`; if no match, falls back to the active tenant in `rooms.room_number = $identifier`. |
| POST   | `/register-admin`          | super-admin         | `{ username, password (≥6), full_name?, email?, apartment_id?, role? }`. Maps `role==='super_admin'` to `is_super_admin=true`. |
| PUT    | `/change-password`         | any logged-in       | `{ old_password, new_password (≥6) }` (works for both admin and tenant — picks table by `req.user.role`) |
| POST   | `/forgot-password`         | public              | `{ identifier }` (email / username / national_id). Always responds `{sent:true}` (don't leak existence). Generates 32-byte hex token, stores in `password_reset_tokens` (1-hour expiry), sends email with link `<app_base_url>/reset-password?token=...`. |
| POST   | `/reset-password`          | public              | `{ token, new_password (≥6) }`. Marks `used_at`, updates the right user's `password_hash`. Reject expired/used tokens. |

### 8.2 `/api/apartments` (admin)

| Method | Path                          | Roles allowed |
|--------|-------------------------------|---------------|
| GET    | `/`                            | any admin |
| GET    | `/:id`                         | any admin |
| POST   | `/`                            | super_admin, admin |
| PUT    | `/:id`                         | super_admin, admin |
| GET    | `/:id/delete-preview`          | any admin |
| DELETE | `/:id?force=true`              | super_admin, admin |
| GET    | `/:id/rooms?status=`           | any admin |
| PUT    | `/:id/settings`                | super_admin, admin (legacy; prefer `/api/settings/:apt`) |

`POST /` expects `{ name, address, contact_number?, floors_count, rooms_per_floor, starting_price? }`. In one transaction: insert apartment, generate every room (`floor + LPAD(seq,2,'0')`), insert one default `expense_settings` row.

`GET /:id/delete-preview` returns `{ rooms, active_tenants, bills, meter_readings }` so the UI can confirm.

`DELETE /:id` refuses if active tenants exist unless `?force=true`. With force, it sets active tenants `is_active=false`, `move_out_date=today`, then `DELETE FROM apartments` (cascade does the rest).

`GET /` returns each apartment with `rooms_total`, `rooms_occupied`, `rooms_vacant` aggregates.

`GET /:id/rooms` returns each room joined with the active tenant (if any) — `tenant_id`, `tenant_name`, `tenant_phone`.

### 8.3 `/api/rooms` (admin)

| Method | Path                    | Roles |
|--------|-------------------------|-------|
| GET    | `/:id`                   | any admin |
| POST   | `/`                      | super_admin, admin |
| PUT    | `/:id`                   | any admin (`property_manager` allowed for misc fields) |
| DELETE | `/:id`                   | super_admin, admin |
| PUT    | `/bulk/floor-price`      | super_admin, admin |

`POST /` body: `{ apartment_id, floor_number, room_number, rental_price?, status?, notes? }`. Auto-computes `room_sequence = max(seq for that floor) + 1`. Rejects duplicate `room_number` within the same apartment (`23505 → 409`).

`PUT /:id` body: `{ rental_price?, status?, room_number?, notes? }`. Rejects duplicate `room_number` within the same apartment (`23505 → 409`).

`DELETE /:id` refuses (`409`) if there's an active tenant in the room. Bills + meter readings cascade automatically (FK `ON DELETE CASCADE`).

`PUT /bulk/floor-price` body: `{ apartment_id, floor_number, rental_price }`.

### 8.4 `/api/tenants`

| Method | Path                      | Auth |
|--------|---------------------------|------|
| GET    | `/?apartment_id=`          | any admin |
| GET    | `/:id`                     | admin OR tenant if `id === self` |
| POST   | `/`                        | super_admin, admin |
| PUT    | `/:id`                     | any admin (incl. property_manager) |
| PUT    | `/me/profile`              | tenant (self) |
| POST   | `/:id/moveout`             | super_admin, admin |
| GET    | `/:id/contract`            | admin OR tenant if `id === self` (returns PDF) |

`POST /` expects `{ room_id, full_name, national_id, move_in_date, phone_number?, email?, address?, notes? }`. In a transaction: insert tenant with `password_hash = bcrypt(national_id)`, set room status to `'occupied'`. `23505 → 409 (national_id exists)`.

`PUT /:id` admins can update everything except the password hash. If the body contains a new `national_id` AND `reset_password === true`, also update `password_hash = bcrypt(new_nid)`.

`PUT /me/profile` (tenant) body: `{ full_name?, phone_number?, email?, address?, national_id? }`. If national_id changes, do NOT auto-reset password.

`POST /:id/moveout` body: `{ move_out_date? }` (default = today). Sets `is_active=false`, `move_out_date`, and the room's status back to `'vacant'`. Historical bills/meter readings are preserved.

`GET /:id/contract` returns `application/pdf`. Joins the tenant's apartment's `expense_settings.contract_terms` so the PDF can use them. See §10 PDF spec.

### 8.5 `/api/bills`

| Method | Path                              | Auth |
|--------|-----------------------------------|------|
| GET    | `/?month=&year=&apartment_id=`    | any admin |
| GET    | `/:id`                            | admin OR tenant if same room |
| POST   | `/`                               | super_admin, admin |
| PUT    | `/:id`                            | super_admin, admin |
| POST   | `/:id/mark-paid`                  | any admin (incl. property_manager) |
| POST   | `/:id/mark-unpaid`                | any admin (incl. property_manager) |
| POST   | `/bulk-mark-paid`                 | super_admin, admin |
| GET    | `/meter/:room_id?month=&year=`    | any admin |
| GET    | `/tenant/me`                      | tenant — list own bills |
| GET    | `/:id/pdf?size=A4|A5&lang=th|en`  | admin OR tenant if same room |
| POST   | `/import`                         | super_admin, admin |
| POST   | `/bulk-pdf`                       | any admin |

`GET /` returns each bill enriched with `r.room_number, r.apartment_id, r.rental_price, r.status, t.full_name AS tenant_name, s.payment_due_day, s.late_fee_per_day`. The dashboard relies on `r.status` to filter by room status; the Billing page derives payment status from `b.paid_at` + `s.payment_due_day` + `s.late_fee_per_day`.

`POST /:id/mark-paid` body (optional): `{ paid_at }` (ISO timestamp; defaults to NOW). Sets `bills.paid_at` to that value. `POST /:id/mark-unpaid` clears `bills.paid_at` back to NULL. Both preserve all cost columns and `total_cost`.

`POST /bulk-mark-paid` body: `{ apartment_id, month, year, paid_at? }`. **Idempotent**: marks every still-unpaid bill (`paid_at IS NULL`) for that apartment+month+year as paid; bills that were already paid are not touched (their original `paid_at` is preserved). Response: `{ marked_count, bills, paid_at }`.

The bill upsert paths (`POST /` and `PUT /:id`) **do not touch `paid_at`** — editing/recalculating a bill never changes its payment state.

`POST /` and `PUT /:id` use the same `computeBill` helper in a single transaction:

```
water_usage  = rollover_water       ? (water_max - last) + current : current - last
elec_usage   = rollover_electricity ? (elec_max  - last) + current : current - last
water_cost   = water_usage * water_price_per_unit
elec_cost    = elec_usage  * electricity_price_per_unit
rent_cost    = body.rent_cost ?? rooms.rental_price
total_cost   = water_cost + elec_cost + rent_cost + other_cost
```

Both the meter reading and the bill use `INSERT ... ON CONFLICT (room_id, month, year) DO UPDATE`. The frontend's BillingForm shouldn't differentiate create vs. edit — the server handles it.

`GET /meter/:room_id` returns the current month's reading, OR if absent, falls back to the most-recent prior reading's `*_current` as the new `*_last` (so the form can pre-fill).

`POST /import` body: `{ apartment_id, month, year, rows: [{ room_no, water, electric }, ...] }`. For each row, look up the room by `room_number`, find the previous month's `_current` as `_last`, compute usage and cost, upsert the meter reading + bill (preserving any existing `other_cost`). Response:

```json
{
  "summary": { "rows_in": N, "imported": X, "updated": Y, "skipped": Z, "missing_rooms": [] },
  "items":   [ { room_no, water_last, water_current, water_usage, water_cost, ..., total, action } ]
}
```

`POST /bulk-pdf` body: `{ bill_ids: [int...], size?, lang? }`. Joins everything once (apartment, room, meter, settings, tenant) and renders one PDF page per bill in the order returned by `r.apartment_id, r.room_number`.

### 8.6 `/api/settings/:apartment_id` (admin)

| Method | Path  | Roles |
|--------|-------|-------|
| GET    | `/:apartment_id` | any admin |
| PUT    | `/:apartment_id` | super_admin, admin |

`GET` returns the row, **falling back to default `contract_terms`** when the stored value is empty. This is so the Settings page never starts blank — admins always see editable defaults.

`PUT` upserts: `water_price_per_unit, water_max_units, electricity_price_per_unit, electricity_max_units, invoice_footer_text, contract_terms, payment_due_day, late_fee_per_day`.

- `payment_due_day` — integer 1-31 (or `null` to disable due-date tracking). Server clamps invalid values to `null`.
- `late_fee_per_day` — DECIMAL(10,2) THB / day. Defaults to 0.

### 8.7 `/api/users` (super-admin)

| Method | Path                                 |
|--------|--------------------------------------|
| GET    | `/`                                   |
| POST   | `/`                                   |
| PUT    | `/:id`                                |
| DELETE | `/:id`                                |
| POST   | `/tenants/:tenant_id/reset-password`  |

Allowed roles: `super_admin | admin | property_manager`. Setting `role === 'super_admin'` also flips `is_super_admin=true`.

`DELETE /:id` rejects deleting yourself. `POST /tenants/:tenant_id/reset-password` body: `{ new_password (≥6) }`.

`GET /` returns each row with `apartment_name` (LEFT JOIN), and a `role_label` mapping:

```
super_admin → 'ผู้ดูแลระบบสูงสุด'
admin       → 'ผู้ดูแลระบบ'
property_manager → 'ผู้ดูแลหอพัก'
```

### 8.8 `/api/system-settings` (super-admin)

| Method | Path           |
|--------|----------------|
| GET    | `/`             |
| PUT    | `/`             |
| POST   | `/test-email`   |

Allowed keys (anything else is silently ignored):

```
smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, smtp_from, app_base_url
```

`GET` masks `smtp_password` as `'••••••••'` if non-empty (don't leak the value to clients).

`PUT` upserts each key/value into `system_settings`. **Skip writes when `smtp_password` arrives as the masked placeholder or empty string** — that means the user didn't change it.

`POST /test-email` body: `{ to }`. Sends a small Thai test email via the current SMTP settings.

### 8.9 `/api/login-logs` (super-admin)

| Method | Path | Query |
|--------|------|-------|
| GET    | `/`  | `limit` (default 100, max 500), `offset` (default 0), `user_kind` (`admin`/`tenant`), `success` (`true`/`false`) |

Returns `{ logs: [...], total: N }`. Each row includes the raw `login_logs` columns plus a resolved `user_name` / `user_login` / `user_room` (LEFT JOINed from `admin_users` or `tenants` based on `user_kind`).

`backend/routes/auth.js` writes a row on every admin- and tenant-login attempt — success or failure — via a `recordLoginLog(req, {...})` helper. The helper is best-effort; logging failures are caught and never break the actual login response. It captures `ip` (from `x-forwarded-for` or `socket.remoteAddress`) and `user_agent` (truncated to 500 chars).

### 8.10 Mailer (`backend/utils/mailer.js`)

Reads SMTP config at send-time (so saving in the UI takes immediate effect). Throws `'SMTP not configured...'` if `smtp_host` or `smtp_user` is empty.

```js
nodemailer.createTransport({
  host:   smtp_host,
  port:   parseInt(smtp_port || '587', 10),
  secure: smtp_secure.toLowerCase() === 'true',
  auth:   { user: smtp_user, pass: smtp_password },
});
```

`from = smtp_from || smtp_user`. `getAppBaseUrl()` reads `app_base_url`, strips trailing slashes, default `http://localhost:3000`. Used for the password-reset link.

---

## 9. Business Rules (must follow exactly)

1. **Room number** = `floor.toString() + sequence.toString().padStart(2,'0')`. Examples: f=1,s=1 → `"101"`; f=10,s=8 → `"1008"`; f=3,s=5 → `"305"`.

2. **Meter rollover** — see §8.5 formulas. `water_max_units` and `electricity_max_units` come from the apartment's `expense_settings` (default 9999).

3. **Bill total** = `water_cost + electricity_cost + rent_cost + other_cost`.

4. **Tenant default password** = `bcrypt(national_id, 10)`. Tenant can change it; admin (super_admin) can reset it via `/admin/users` to any ≥6-char password.

5. **Room status transitions:**
   - New rooms default to `'vacant'`.
   - Adding a tenant flips the room to `'occupied'`.
   - Move-out flips it back to `'vacant'`.
   - Admin can manually set `'maintenance' | 'common' | 'caretaker'`.

6. **Bill upsert** is server-side (same form regardless of create/edit). The frontend `BillingForm` always submits and the server resolves which (`room_id, month, year`) row to write.

7. **Invoice status filter (Print Invoice page)** defaults to `['occupied','caretaker']`. The user can toggle others.

8. **Dashboard revenue status filter** also defaults to `['occupied','caretaker']` and re-aggregates on toggle. It uses `r.status` from the bills response (NOT just "tenant exists").

9. **Move-out** keeps all historical bills/meter readings. Tenant disappears from active list (`is_active=false`). Their `room_id` is preserved (LEFT JOIN tolerates `SET NULL` when the room is later deleted).

10. **Apartment delete** requires `?force=true` if active tenants exist. With force: auto move-out all active tenants, then cascade-delete the apartment.

11. **Per-apartment uniform pricing** — `PUT /api/rooms/bulk/floor-price` updates every room on a given floor. `Apartments.create` accepts a `starting_price` to seed every room.

12. **Buddhist year (พ.ศ.)** = Gregorian + 543. All UI labels and PDFs use it.

13. **Forgot-password response** never reveals whether an account exists (always `{sent:true}`). Token TTL = 1 hour, single-use (`used_at`).

14. **Contract terms (`contract_terms`)** — stored as a single TEXT field; one rule per line. The PDF splits on `\r?\n`, trims, drops empty lines. If empty/null, fall back to `DEFAULT_CONTRACT_TERMS` (see §10).

15. **Default reporting month** (`defaultReportingMonth(now)` in `frontend/src/utils/api.js`) — used as the initial `{ month, year }` filter in **every page that has a month picker** (Dashboard, Billing, Invoice, TenantDashboard, TenantBills):
    - If `now.getDate() < 25` → previous calendar month (handle Jan 24 → Dec of previous year).
    - If `now.getDate() >= 25` → current calendar month.
    - Example: 24 Apr 2026 → `{ month: 3, year: 2026 }`; 25 Apr 2026 → `{ month: 4, year: 2026 }`.
    - The user can still change the picker manually after page load.

16. **Bill payment status** — derived client-side from `bills.paid_at` + `expense_settings.payment_due_day` + `expense_settings.late_fee_per_day`:
    - `paid_at` set                                  → **"ชำระค่าเช่าแล้ว"** (green)
    - unpaid AND `payment_due_day` is null/absent    → **"ออกบิลแล้ว"** (blue)
    - unpaid AND today ≤ due date                    → **"รอชำระ"** (amber)
    - unpaid AND today > due date                    → **"เกินกำหนด"** (red), with `late_fee = ceil((now - due) / 1day) * late_fee_per_day`

    Due date is built as `Date(bill.year, bill.month - 1, min(payment_due_day, last_day_of_month), 23:59:59)`.
    `late_fee` is shown inline next to both the status pill and the total on the Billing page; it is **not** persisted into `total_cost`.

---

## 10. PDF Generation

`backend/utils/pdf.js` exports four generators:

```
generateContractPDF(t, stream)
generateInvoicePDF(b, size, stream)          // Thai
generateInvoicePDFEnglish(b, size, stream)
generateInvoicePDFBulk(bills, size, lang, stream)
```

### 10.1 Fonts

```
FONT_REGULAR = backend/utils/fonts/Sarabun-Regular.ttf
FONT_BOLD    = backend/utils/fonts/Sarabun-Bold.ttf
```

`applyFonts(doc)` registers `'thai'` and `'thai-bold'` if the files exist, otherwise falls back to Helvetica. It also registers `'reg'`/`'bold'` (always Helvetica) for English output.

### 10.2 Rental Contract (A4 portrait, Thai)

```
สัญญาเช่าห้องพัก                       (centered, bold 20)
[ชื่ออพาร์ทเมนต์]                      (centered, bold 14)
[ที่อยู่]                              (centered, regular 10)
โทร: [contact_number]                  (if present)

ทำที่: [apartment_address]
วันที่: [today in Buddhist DD/MM/YYYY]

คู่สัญญา                               (bold)
ผู้ให้เช่า: [apartment_name]
ผู้เช่า:   [tenant.full_name]
เลขบัตรประชาชน: [national_id]
โทรศัพท์: [phone_number] (if present)

รายละเอียดห้องพัก                       (bold)
ห้องเลขที่: [room_number]
ค่าเช่าต่อเดือน: [rental_price] บาท
วันเริ่มสัญญา: [move_in_date in Buddhist DD/MM/YYYY]

ข้อตกลงและเงื่อนไข                      (bold, then list at fontSize 10)
[lines from expense_settings.contract_terms split by \n,
 OR DEFAULT_CONTRACT_TERMS if empty]

ลงชื่อ ............................................. ผู้ให้เช่า
ลงชื่อ ............................................. ผู้เช่า
ลงชื่อ ............................................. พยาน
```

`DEFAULT_CONTRACT_TERMS` (in `backend/utils/contractDefaults.js`, mirrored as a constant in `frontend/src/pages/admin/Settings.jsx` to seed the textarea):

```
1. ผู้เช่าตกลงชำระค่าเช่าภายในวันที่ 5 ของทุกเดือน
2. ผู้เช่าต้องรักษาทรัพย์สินภายในห้องพักให้อยู่ในสภาพดี
3. ห้ามนำสัตว์เลี้ยงทุกชนิดเข้าพักโดยไม่ได้รับอนุญาต
4. ห้ามประกอบกิจการที่ผิดกฎหมาย
5. การบอกเลิกสัญญาต้องแจ้งล่วงหน้าอย่างน้อย 30 วัน
6. ผู้เช่าต้องชำระค่าน้ำประปาและค่าไฟฟ้าตามมิเตอร์
7. ห้ามดัดแปลงต่อเติมห้องพักโดยไม่ได้รับอนุญาต
8. ผู้เช่าต้องส่งคืนห้องพักในสภาพเรียบร้อยเมื่อสิ้นสุดสัญญา
9. การกระทำใด ๆ ที่ขัดต่อสัญญาฉบับนี้ ผู้ให้เช่ามีสิทธิ์บอกเลิกสัญญาได้ทันที
10. คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อตกลงทั้งหมดแล้ว
```

### 10.3 Bill Invoice (A4 / A5, **landscape**, Thai or English)

Layout (landscape, 28pt margin on all sides). Defaults: `size='A5'`, `lang='th'`.

Header rows (right-aligned bill number top-right, then centered apartment header, then centered period subtitle, then right-aligned `ห้อง : XXX`):

```
                                                            บิลเลขที่      YYYYMMRoomNumber

                          [ชื่ออพาร์ทเมนต์]   [ที่อยู่]       (bold 15)
              บิลเรียกเก็บเงินค่าเช่าห้อง ประจำเดือน MM YYYY   (regular 11)
                                                                ห้อง :     XXX
```

`billNo = `${b.year}${String(b.month).padStart(2,'0')}${room_number || ''}``.

Then a 6-column table. Header row has a solid blue background `#0000ff` with white text. Column widths are fractional of usable width:

| col # | key     | title (Thai)        | title (English) | width | align  |
|-------|---------|---------------------|-----------------|-------|--------|
| 1     | label   | (empty)             | (empty)         | 0.20  | center |
| 2     | last    | จดเดือนที่แล้ว      | Prev meter      | 0.13  | center |
| 3     | cur     | จดเดือนนี้           | Current         | 0.13  | center |
| 4     | units   | จำนวนหน่วย          | Units           | 0.13  | center |
| 5     | rate    | ราคาต่อหน่วย        | Rate            | 0.13  | center |
| 6     | amount  | รวม (บาท)            | Amount (THB)    | 0.28  | center |

Header height = 22pt. Each data row = 26pt with a thin `#cccccc` rule under it. Four data rows in this order:

1. `ค่าน้ำ / Water` — last/current/units = integers via `intStr(...)`, rate = `water_price_per_unit`, amount = `water_cost`.
2. `ค่าไฟ / Electricity` — analogous for electricity.
3. `ค่าเช่าห้อง / Room rent` — only `amount = rent_cost`.
4. `ค่าโทรศัพท์ และอื่นๆ / Other` — only `amount = other_cost`.

A 26pt blue total row follows: label `รวมค่าเช่า` / `TOTAL` right-aligned across cols 1–5, value `total_cost` centered in col 6, white bold 13pt.

If `b.invoice_footer_text` is non-empty, render it under the table at fontSize 10, color `#475569`.

`intStr(n)` returns `Math.trunc(n)` as a string, or `''` for null/empty/NaN.

### 10.4 Bulk PDF

`generateInvoicePDFBulk(bills, size, lang, stream)` opens one PDFKit doc, calls `drawInvoiceThai` (or English) for the first bill, then `doc.addPage(opts)` + draw for each remaining bill. Same page options used (size + landscape + 28pt margin).

---

## 11. Frontend Routes

`frontend/src/App.jsx`:

```
PUBLIC
  /login              Login.jsx
  /forgot-password    ForgotPassword.jsx
  /reset-password     ResetPassword.jsx       (reads ?token=)

ADMIN  (PrivateRoute role="admin", inside <Layout/>)
  /admin                            redirect → /admin/dashboard
  /admin/dashboard                  Dashboard.jsx
  /admin/apartments                 Apartments.jsx
  /admin/rooms/:apartmentId         Rooms.jsx
  /admin/tenants                    Tenants.jsx
  /admin/tenants/new                TenantForm.jsx
  /admin/tenants/:id/edit           TenantForm.jsx
  /admin/billing                    Billing.jsx
  /admin/billing/:roomId/:month/:year  BillingForm.jsx
  /admin/invoice                    Invoice.jsx
  /admin/settings                   Settings.jsx
  /admin/users                      Users.jsx              (super-admin only — guarded by sidebar AND server)
  /admin/system-settings            SystemSettings.jsx     (super-admin only)

TENANT (PrivateRoute role="tenant", inside <Layout tenantMode/>)
  /tenant                           redirect → /tenant/dashboard
  /tenant/dashboard                 TenantDashboard.jsx
  /tenant/bills                     TenantBills.jsx
  /tenant/contract                  TenantContract.jsx
  /tenant/profile                   TenantProfile.jsx

CATCH-ALL
  *                                 redirect → /login
```

`PrivateRoute` checks `useAuth()`: if not ready, show spinner; if no user, redirect to `/login`; if a `role` prop is provided and doesn't match, redirect to `/admin` or `/tenant`.

---

## 12. Frontend Page Specs

### 12.1 Login (`pages/Login.jsx`)

- Tab switcher between `'admin' | 'tenant'`. **Selected tab uses dark brand color** (`bg-brand-700 text-white font-semibold`); unselected is muted.
- Admin: username + password.
- Tenant: **national_id OR room_number** + password. The label reads "เลขบัตรประชาชน หรือ เลขห้อง" with helper text "ระบบจะตรวจเลขบัตรก่อน หากไม่พบจะใช้เลขห้องค้นหาแทน". The body field name on the wire is still `national_id` for backward compatibility.
- After login, redirect by role (see §7.3).
- "ลืมรหัสผ่าน?" link → `/forgot-password`.

### 12.2 Forgot / Reset Password

- `ForgotPassword`: one input `identifier`, posts to `/auth/forgot-password`, shows a green confirmation regardless of result.
- `ResetPassword`: reads `?token=` from URL, posts new password (≥6, double-entry confirm), redirects to `/login`.

### 12.3 Layout / Sidebar / Navbar

- **Desktop layout (`md:` and up)** — fixed left Sidebar (dark `slate-900`, 256px wide). Brand link active state `bg-brand-600 text-white`. Logo block + nav + small footer "v1.0 © Apartment MS".
- **Mobile layout (`< md`)** — Sidebar is hidden by default. The Navbar shows a hamburger button (`Bars3Icon`) on the left; pressing it opens a slide-in **drawer** rendered as a fixed full-screen overlay (`md:hidden`). The drawer is a 72-width dark panel on the left + a tap-through black-40 backdrop on the right. The drawer uses the **same** link list as the desktop sidebar; clicking a link auto-closes the drawer (NavLink `onClick={onClose}`). An `XMarkIcon` close button sits in the drawer header.
- `Layout.jsx` owns the `mobileOpen` state and passes it down: `<Sidebar mobileOpen onClose />` for the drawer, `<Navbar onMenuClick />` for the hamburger.
- Navbar shows current role label, user name (hidden on `< sm`), two buttons: "เปลี่ยนรหัสผ่าน" (opens `ChangePasswordModal`) and "ออกจากระบบ". On narrow screens the buttons collapse to icon-only with a `title` tooltip.
- `ChangePasswordModal` validates ≥6 chars + match-confirm, calls `PUT /auth/change-password`.

### 12.4 Dashboard (`pages/admin/Dashboard.jsx`)

- Header title "แดชบอร์ด", subtitle with current Thai month + พ.ศ.
- Month + year selector (year list = `[currentYear-3 .. currentYear+1]`).
- 4 KPI cards: `rooms_total`, `rooms_occupied`, `rooms_vacant`, `rooms_misc`.
- Revenue card with:
  - Heading "รายได้รวม (ตามสถานะห้องที่เลือก)".
  - Big total `฿ NN,NNN.NN`, subtitle "จาก N ห้อง · ประจำเดือน ...".
  - **Status filter row** with 5 checkboxes (`occupied, caretaker, maintenance, common, vacant`); default checked = `['occupied','caretaker']`.
  - Breakdown sub-cards for water / electricity / rent / other with progress bars (each `value / total * 100`%).
- Apartments list at the bottom, link to `/admin/apartments`.

Filter logic: `bills.filter(b => statuses.includes(b.status))` then sum `water_cost / electricity_cost / rent_cost / other_cost / total_cost`.

### 12.5 Apartments (`pages/admin/Apartments.jsx`)

- Table columns: name, address, contact_number, "ห้องทั้งหมด (มีผู้เช่า X)", actions (`ห้องพัก/ตั้งราคา`, `แก้ไข`, `ลบ`).
- Create/edit modal with name, address, phone, floors_count, rooms_per_floor, plus `starting_price` only on create.
- Delete modal first hits `GET /:id/delete-preview`, shows the counts in red-themed alert, then `DELETE /:id?force=true`.

### 12.6 Rooms (`pages/admin/Rooms.jsx`)

- Grouped by floor, color-coded grid. Within each floor, rooms are sorted by `room_number` (numeric when both numeric, else lexicographic — so 101 < 102 < 1010 reads correctly):
  ```
  occupied    → green
  vacant      → slate
  maintenance → yellow
  common      → blue
  caretaker   → purple
  ```
- Click a room to edit price, status, room_number, and free-text notes.
- The edit modal includes a red **"ลบห้อง"** button (left side of footer) that calls `DELETE /rooms/:id`. Confirms via `window.confirm` first. Hidden for property_manager. Server rejects if the room still has an active tenant.
- A dashed **"+ เพิ่มห้อง"** tile is rendered as the last cell on every floor. Clicking it opens an add-room modal pre-filled with: `room_number = max(existing numeric room numbers on that floor) + 1` (or `floor + "01"` if none), `rental_price = first existing room's price` (or 0), `status = vacant`. Submits to `POST /rooms`. Hidden for property_manager.
- "ปรับราคาทั้งชั้น" button → `PUT /rooms/bulk/floor-price`. Hidden for property_manager.

### 12.7 Tenants (`pages/admin/Tenants.jsx`)

- Apartment filter dropdown.
- Table: room_number, full_name, phone_number, national_id, move_in_date (Thai), actions (`แก้ไข`, `สัญญา`, `ย้ายออก`).
- "เพิ่มผู้เช่า" → `/admin/tenants/new`.

### 12.8 Tenant Form (`TenantForm.jsx`)

- Create mode: pick apartment, then room from `GET /apartments/:id/rooms?status=vacant`. Name, phone, national_id (required), move_in_date (default today), email, notes, address, notes textarea.
- Edit mode: skips apartment+room pickers. If admin edits `national_id`, show a checkbox "รีเซ็ตรหัสผ่านผู้เช่าให้เท่ากับเลขบัตรใหม่" — when checked, server sets password_hash to `bcrypt(new_nid)`.

### 12.9 Billing (`pages/admin/Billing.jsx` + `BillingForm.jsx`)

Listing page:
- Apartment + month + year selector.
- Per-room row: room_number, tenant_name, **status cell**, total, action column.
- **Status cell rule:**
   - **Only rooms with `status === 'occupied'`** show the payment-status pill (ออกบิลแล้ว / รอชำระ / ชำระค่าเช่าแล้ว / เกินกำหนด — see §16).
   - All other room statuses (`vacant`, `maintenance`, `common`, `caretaker`) always show the room-type badge instead, regardless of whether a bill exists. Late-fee inline text (เลย N วัน · ค่าปรับ ฿X.XX) is only rendered when the room is occupied AND overdue.
- When the bill is overdue, the total cell adds a small red sub-line: "+ ฿X.XX ค่าปรับ → ฿Y.YY" — `total_cost` is not modified, this is computed view-only.
- Action column shows `สร้าง` / `แก้ไข` link, plus an inline button:
   - Bill exists, unpaid → `✓ ทำเครื่องหมายชำระแล้ว` (green) → `POST /bills/:id/mark-paid`.
   - Bill exists, paid → `ยกเลิกการชำระ` (slate) → `POST /bills/:id/mark-unpaid`.
- Header has two top-level buttons:
   - **"✓ ชำระแล้วทุกห้อง (N)"** (green) — calls `POST /bills/bulk-mark-paid` for the current `apartment_id, month, year`. The trailing `(N)` shows how many bills are still unpaid in the current view; the button is disabled when `N === 0`. Confirms via `window.confirm` that includes the apartment + period before sending.
   - **"นำเข้าจาก Excel"** opens `BillingImport.jsx`.

`BillingForm` (route `/admin/billing/:roomId/:month/:year`):
- Pre-loads room (`GET /rooms/:id`), settings (`GET /settings/:apt`), prior meter (`GET /bills/meter/:roomId?month=&year=`), and any existing bill (`GET /bills?...`).
- Three sections: ค่าน้ำประปา / ค่าไฟฟ้า / ค่าใช้จ่ายอื่น.
- Each meter section shows last/current inputs, rollover checkbox, computed usage + cost preview.
- ค่าเช่าห้อง pre-filled from room.rental_price, with "ใช้ราคาห้องล่าสุด" reset link if user changed it.
- Footer "รวมทั้งสิ้น" recomputes live.
- Submit: if existing bill, `PUT /bills/:id`, else `POST /bills`.

### 12.10 BillingImport (`BillingImport.jsx`)

- Modal with month/year (defaults from parent), column-mapping (defaults `room=2, water=3, electric=4, header_row=2, data_start=3`), file picker (`.xlsx`/`.xls`).
- Uses `xlsx` to parse the first sheet to a 2D array, slices from `data_start - 1`, for each row pulls `room_no, water (truncated int), electric (truncated int)`.
- Preview list (first 100), then `POST /bills/import`. After success show summary (`imported, updated, skipped, missing_rooms`) plus a collapsible per-row report.

### 12.11 Invoice (Print) (`pages/admin/Invoice.jsx`)

- Apartment + month + year + size (A5 default, A4 option), language is fixed to Thai for now ("ภาษาไทย · แนวตั้ง" label).
- Status filter checkboxes (default `['occupied','caretaker']`).
- For each visible room show total (or "ยังไม่ได้สร้าง"), with "ดาวน์โหลด PDF" per row (`GET /bills/:id/pdf?size=&lang=th`).
- "ดาวน์โหลดทั้งหมด" → `POST /bills/bulk-pdf` with all `bill_id`s currently visible.

### 12.12 Settings (`pages/admin/Settings.jsx`)

- Apartment dropdown, then a card with grid of 4 numeric fields (water/elec price + max units), then `invoice_footer_text` textarea, then `contract_terms` textarea (12 rows, monospace).
- A separate "การชำระเงิน & ค่าปรับ" section under a divider with 2 fields:
   - `payment_due_day` — number input min=1 max=31, optional (blank → "ออกบิลแล้ว" status only).
   - `late_fee_per_day` — number input min=0 step=0.01, defaults to 0.
- The contract terms field **pre-fills with the default 10 rules** if the API returned an empty value (server already handles this; the frontend mirrors the constant for safety).
- A "คืนค่าเริ่มต้น" link near the textarea label resets the field to the defaults.
- Save → `PUT /settings/:apartment_id` with the entire form object.

### 12.13 Users (super-admin) (`pages/admin/Users.jsx`)

- Two sections in one page:
  1. **Admin users list** — table, with create / edit / delete modals. Cannot delete yourself (button disabled).
  2. **รีเซ็ตรหัสผ่านผู้เช่า** — search box (matches name / national_id / room_number) + table of tenants with a "รีเซ็ตรหัสผ่าน" action that opens a modal asking for new password (≥6).
- Role select offers all three options with Thai labels.

### 12.14 System Settings (super-admin) (`pages/admin/SystemSettings.jsx`)

- 7 SMTP keys + `app_base_url`. SMTP password is `type='password'`. The Gmail App Password instructions sit in an `<details>` info box.
- Below: a "ทดสอบส่งอีเมล" card with one email input + "ส่งทดสอบ" → `POST /system-settings/test-email`.

### 12.14.5 Login Logs (super-admin) (`pages/admin/LoginLogs.jsx`)

- Table of recent login attempts (newest first). Columns: เวลา (Buddhist DD/MM/YYYY HH:MM), ผลลัพธ์ (สำเร็จ/ไม่สำเร็จ pill), ประเภท (admin/tenant pill), ชื่อผู้ใช้/เลขบัตร (with resolved full_name + room number sub-line for tenants), รายละเอียด (`error_reason` translated to Thai), IP.
- Filters: ประเภท (admin/tenant/ทั้งหมด), ผลลัพธ์ (สำเร็จ/ไม่สำเร็จ/ทั้งหมด).
- Pagination: 100 per page, "ก่อนหน้า / ถัดไป" buttons. Total + range shown in the filter bar.
- Calls `GET /api/login-logs?limit=&offset=&user_kind=&success=`.

### 12.15 Tenant pages

Tenant pages use the same `paymentStatus()` helper as admin (`frontend/src/utils/billStatus.js`) so tenants see the **same 4 statuses** for their own bills (ออกบิลแล้ว / รอชำระ / ชำระค่าเช่าแล้ว / เกินกำหนด with late fee). The `GET /api/bills/tenant/me` endpoint is JOINed with `expense_settings` so the tenant pages get `payment_due_day` + `late_fee_per_day` for free.

- **TenantDashboard** — greeting with full_name + room_number, current-month bill total card. If a bill exists, render the payment-status pill below the total; if overdue, show "เลย N วัน · ค่าปรับ ฿X.XX → ยอดที่ต้องชำระ ฿Y.YY". Plus quick links to bills + contract.
- **TenantBills** — fetches `GET /bills/tenant/me`, year selector (only years that exist + current), table with **status column** (payment-status pill + late-fee inline for overdue), 4 cost columns + total (with "+ค่าปรับ → ฿Y.YY" sub-line if overdue). Current-month row highlighted blue, per-row "ดาวน์โหลด PDF".
- **TenantContract** — info card with full_name / room / national_id, button → `GET /tenants/:id/contract` (where `:id` = self).
- **TenantProfile** — fetches `GET /tenants/:id`, allows updating full_name, phone_number, national_id, email, address. Saves via `PUT /tenants/me/profile`. After save, refresh local AuthContext user (so navbar updates).

---

## 13. Frontend Helpers (`utils/api.js`)

```js
const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api', timeout: 30000 });

api.interceptors.request.use(cfg => {
    const token = localStorage.getItem('apt_token');
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    return cfg;
});

api.interceptors.response.use(r => r, err => {
    if (err.response?.status === 401) {
        localStorage.removeItem('apt_token');
        localStorage.removeItem('apt_user');
        if (!location.pathname.startsWith('/login')) location.assign('/login');
    }
    return Promise.reject(err);
});

export const unwrap   = (p) => p.then(r => r.data?.data ?? r.data);
export const fmtMoney = (n) => Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2, maximumFractionDigits:2});
export const thaiYear = (g) => Number(g) + 543;
export const fmtThaiDate = (input) => /* DD/MM/YYYY in พ.ศ. or '-' */;
export const THAI_MONTHS = ['มกราคม', ..., 'ธันวาคม'];
```

`AuthContext` keeps `user`, `token`, `ready`, exposes `login(token,user)` and `logout()`. Both values are persisted in `localStorage` under keys `apt_token` and `apt_user`.

---

## 14. Code Quality Rules

### General

1. `async/await` everywhere; no callbacks.
2. Wrap every DB call in `try/catch` and log with a tagged prefix `[route/action]`.
3. **Always** parameterize SQL — never string-concat.
4. Validate inputs with `express-validator` for endpoints with required body fields.
5. Success responses are `{ data }`, errors are `{ error: 'message' }`. Status codes: 200/201/400/401/403/404/409/500.

### Security

1. Never return `password_hash` in any API response.
2. `helmet()` middleware.
3. Sanitize `req.body` (`.trim()` strings before insert).
4. Admin routes: `authenticate` + `adminOnly` (and `requireAdminRoles` where finer control is needed).
5. Tenant routes: `authenticate` + check `req.user.role === 'tenant'` and ownership (`req.user.id === param.id`).
6. `password_reset_tokens` use 32-byte hex (`crypto.randomBytes`), 1h TTL, single-use.
7. `system-settings` masks SMTP password (`'••••••••'`) on read, ignores writes that match the placeholder.

### Database

1. Use a connection pool (`pg.Pool`, `max=20`, `idleTimeoutMillis=30000`, `connectionTimeoutMillis=10000`).
2. Multi-table writes go through `db.getClient()` + `BEGIN/COMMIT/ROLLBACK` + `client.release()` in a `finally`.
3. Prefer `INSERT ... ON CONFLICT (...) DO UPDATE` for upserts.

### Frontend

1. All API calls go through the shared `api` axios instance.
2. JWT attached automatically; 401 redirects to `/login`.
3. Show spinners while loading; show `react-hot-toast` for success/error.
4. Forms are controlled components; validate before submit.
5. **All** UI text is Thai. Buddhist year for any visible date.
6. Use `Modal` / `Table` / `Badge` / `Spinner` / `Alert` from `components/common/` for consistency.

---

## 15. Thai Language Reference

```js
const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน',
  'พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม',
  'กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
];
const thaiYear = g => Number(g) + 543;
```

UI labels:

```
Dashboard          แดชบอร์ด
Apartments         อพาร์ทเมนต์
Rooms              ห้องพัก
Tenants            ผู้เช่า
Billing            ใบแจ้งค่าเช่า
Print invoices     พิมพ์ใบแจ้งหนี้
Settings           ตั้งค่า
User Management    จัดการผู้ใช้
System Settings    ตั้งค่าระบบ
Logout             ออกจากระบบ
Save / Cancel      บันทึก / ยกเลิก
Delete / Edit      ลบ / แก้ไข
Add / Search       เพิ่ม / ค้นหา
Floor              ชั้น
Room Number        เลขห้อง
Rental Price       ราคาเช่า
Status             สถานะ
  occupied         มีผู้เช่า
  vacant           ว่าง
  maintenance      ซ่อมบำรุง
  common           พื้นที่ส่วนกลาง
  caretaker        ผู้ดูแล
Full Name          ชื่อ-นามสกุล
Phone              เบอร์โทรศัพท์
National ID        เลขบัตรประชาชน
Move-in / Move-out วันที่เข้าพัก / วันที่ออก
Water              ค่าน้ำ
Electricity        ค่าไฟ
Rent               ค่าเช่า
Other              ค่าใช้จ่ายอื่นๆ
Total              รวมทั้งสิ้น
Download PDF       ดาวน์โหลด PDF
Generate Invoice   สร้างใบแจ้งหนี้
Forgot password?   ลืมรหัสผ่าน?
Change password    เปลี่ยนรหัสผ่าน

Admin role labels:
  super_admin      ผู้ดูแลระบบสูงสุด
  admin            ผู้ดูแลระบบ
  property_manager ผู้ดูแลหอพัก
```

---

## 16. Seed Data (`database/seed.sql` + `seed.js`)

`seed.sql` is static (apartments, rooms, expense_settings). `seed.js` runs it then inserts admin + tenants + meter readings + bills with real bcrypt hashes.

### Sample apartment

```
name             อพาร์ทเมนต์สุขสันต์
address          123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110
contact_number   02-123-4567
floors_count     5
rooms_per_floor  8                       (40 rooms total)
```

Mark these rooms specially:

```
occupied:    101, 103, 205, 307, 410
maintenance: 208
common:      108
caretaker:   501
```

### Sample expense_settings

```
water_price_per_unit:        18.00
water_max_units:             9999
electricity_price_per_unit:  7.50
electricity_max_units:       9999
invoice_footer_text:         'กรุณาชำระค่าเช่าภายในวันที่ 15 ของทุกเดือน
                              หากชำระล่าช้าจะมีค่าปรับ 100 บาท/วัน'
contract_terms:              ''  (empty — server returns DEFAULT_CONTRACT_TERMS)
```

### Admin account (created in `seed.js`)

```
username: admin
password: admin1234     (bcrypt hashed; salt rounds 10)
is_super_admin: true, role: 'super_admin'
```

### Sample tenants

```
101  นายสมชาย ใจดี       1100100100011  081-111-1111
103  นางสาวสมหญิง รักดี   1100100100022  081-222-2222
205  นายวิชัย พากเพียร    1100100100033  081-333-3333
307  นางนภา สุขใจ         1100100100044  081-444-4444
410  นายธนา มั่งมี       1100100100055  081-555-5555

password_hash = bcrypt(national_id, 10)
move_in_date  = 2024-01-01
is_active     = TRUE
```

### Sample meter readings + bills

For each tenant's room, current month/year:

```
101: water 100→112,  elec 500→580
103: water  90→ 98,  elec 420→470
205: water 200→215,  elec 800→875
307: water 150→162,  elec 600→660
410: water  80→ 90,  elec 300→360
```

For each: compute `water_cost = (curr-last) * water_price`, `elec_cost = (curr-last) * elec_price`, `rent_cost = rooms.rental_price`, `total = water + elec + rent`, upsert into `bills`.

---

## 17. Deployment

### 17.1 `docker-compose.yml`

Two services:

- `backend` — built from `backend/Dockerfile`, exposes 5000, env vars include DB connection, JWT, NODE_ENV, PORT.
- `frontend` — multi-stage Dockerfile: build with CRA (passing `REACT_APP_API_URL` as a build arg), serve with `nginx:alpine`. The nginx config has a SPA fallback (`try_files $uri /index.html`) so router refreshes work.

Both restart `unless-stopped`. Frontend depends on backend.

### 17.2 GitHub Actions (`.github/workflows/deploy.yml`)

Optional — kept simple. Build images, push, redeploy via SSH or registry. Provide secrets for `JWT_SECRET`, DB credentials, etc.

### 17.3 Bringing up a fresh DB

```bash
# 1. Create the database (one time, as superuser)
psql -U postgres -f database/bootstrap.sql

# 2. Apply schema
node database/migrate.js          # runs schema.sql (DROP + CREATE)

# 3. Apply additive migrations (run in order on top of an existing DB)
psql ... -f database/migrate-001-add-role.sql
psql ... -f database/migrate-002-rooms-and-system.sql
psql ... -f database/migrations/001_add_contract_terms.sql
psql ... -f database/migrations/002_add_payment_status.sql
psql ... -f database/migrations/003_add_login_logs.sql

# 4. Seed sample data + admin account
node database/seed.js
```

### 17.4 Local dev

```bash
npm run install:all
npm run dev      # concurrent: backend nodemon (5000) + frontend CRA (3000)
```

---

## 18. Implementation Checklist (build order)

Build in this order; each row should be working before moving to the next.

```
PHASE 1 — DATABASE
  database/schema.sql
  database/migrate.js
  database/seed.sql
  database/seed.js
  database/migrations/*.sql + migrate-001/-002 (additive)

PHASE 2 — ROOT CONFIG
  .gitignore, .env.example, .env, package.json, README.md

PHASE 3 — BACKEND
  backend/package.json
  backend/server.js
  backend/config/database.js
  backend/middleware/auth.js
  backend/utils/contractDefaults.js
  backend/utils/mailer.js
  backend/utils/pdf.js  (+ fonts/Sarabun-*.ttf)
  backend/routes/auth.js
  backend/routes/users.js
  backend/routes/system-settings.js
  backend/routes/apartments.js
  backend/routes/rooms.js
  backend/routes/tenants.js
  backend/routes/bills.js
  backend/routes/settings.js

PHASE 4 — FRONTEND PRIMITIVES
  frontend/package.json, tailwind.config.js, postcss.config.js
  public/index.html (Google Fonts), src/index.{js,css}
  src/utils/api.js
  src/context/AuthContext.jsx
  src/components/PrivateRoute.jsx
  src/components/Layout.jsx, Sidebar.jsx, Navbar.jsx, ChangePasswordModal.jsx
  src/components/common/{Modal,Table,Badge,Spinner,Alert}.jsx
  src/App.jsx

PHASE 5 — FRONTEND PUBLIC
  pages/Login.jsx, ForgotPassword.jsx, ResetPassword.jsx

PHASE 6 — FRONTEND ADMIN
  pages/admin/Dashboard.jsx
  pages/admin/Apartments.jsx
  pages/admin/Rooms.jsx
  pages/admin/Tenants.jsx, TenantForm.jsx
  pages/admin/Billing.jsx, BillingForm.jsx, BillingImport.jsx
  pages/admin/Invoice.jsx
  pages/admin/Settings.jsx
  pages/admin/Users.jsx
  pages/admin/SystemSettings.jsx

PHASE 7 — FRONTEND TENANT
  pages/tenant/TenantDashboard.jsx
  pages/tenant/TenantBills.jsx
  pages/tenant/TenantContract.jsx
  pages/tenant/TenantProfile.jsx

PHASE 8 — DEPLOYMENT
  backend/Dockerfile
  frontend/Dockerfile  (multi-stage with nginx + SPA fallback)
  docker-compose.yml
  .github/workflows/deploy.yml (optional)
```

---

## 19. Final Acceptance Checklist

Before considering an implementation complete, verify:

```
□ schema.sql + all migrations apply cleanly to a fresh DB.
□ All passwords (admin + tenant) are bcrypt hashed; never returned in any response.
□ All SQL uses parameterized queries.
□ All UI text and toasts are Thai. Dates render in Buddhist year.
□ Room number = floor + LPAD(seq,2,'0') everywhere.
□ Meter rollover formula matches §8.5 / §9.2.
□ Bill upsert (room_id, month, year) works for both create and edit (server-side).
□ Tenant default password = bcrypt(national_id). Admin can change a tenant nid AND opt-in
  to reset the password to the new nid.
□ Adding a tenant flips the room to 'occupied'; move-out flips it back to 'vacant'.
□ Apartment delete preview returns counts; force-delete cascades and auto-moves-out actives.
□ PDFs use Sarabun fonts (or Helvetica fallback).
□ Bill invoice supports A4 + A5, Thai + English, single + bulk.
□ Contract PDF uses expense_settings.contract_terms when present, else DEFAULT_CONTRACT_TERMS.
□ Bill payment status displays correctly on the Billing page:
     paid → "ชำระค่าเช่าแล้ว"; unpaid + no due_day → "ออกบิลแล้ว";
     unpaid + before due → "รอชำระ"; unpaid + after due → "เกินกำหนด" with late fee.
□ Payment-status pill only renders for occupied rooms; vacant / maintenance /
  common / caretaker rooms show their room-type Badge in the Status column instead.
□ POST /bills/:id/mark-paid and /mark-unpaid update bills.paid_at without
  touching cost columns or total_cost.
□ POST /bills/bulk-mark-paid is idempotent: marks all WHERE paid_at IS NULL
  for the apartment+month+year; rows already paid keep their original paid_at.
□ Billing page shows "✓ ชำระแล้วทุกห้อง (N)" header button that calls bulk-mark-paid.
□ Default reporting month: defaultReportingMonth() in utils/api.js — before the 25th
  shows previous month, on/after the 25th shows current month. Used in Dashboard,
  Billing, Invoice, TenantDashboard, TenantBills.
□ Tenants see their own payment status (ออกบิลแล้ว / รอชำระ / ชำระแล้ว / เกินกำหนด)
  on TenantDashboard + TenantBills using shared paymentStatus() helper.
□ Tenant login accepts national_id OR room_number — server tries national_id
  first, falls back to active tenant by room_number.
□ Every login attempt (admin + tenant, success and failure) is recorded in
  login_logs with ip, user_agent, error_reason. Best-effort — logging errors
  must not break the login response.
□ Super-admin can browse login_logs at /admin/login-logs with filters by user
  kind and success/failure.
□ Layout is responsive: at md and up the left Sidebar is shown; below md the
  Sidebar is hidden and a hamburger button in the Navbar opens a slide-in
  drawer with the same links. Tapping a link or the backdrop closes the drawer.
□ Settings page exposes payment_due_day (1-31, optional) and late_fee_per_day.
□ Settings page pre-fills contract_terms textarea with defaults when empty; "คืนค่าเริ่มต้น"
  resets it.
□ Dashboard revenue card has 5 status checkboxes (default = occupied + caretaker) and
  re-aggregates breakdown live; "รายได้รวม (ตามสถานะห้องที่เลือก)".
□ Login tab switcher highlights the selected tab in dark brand color.
□ Three admin roles function correctly:
     property_manager sees Dashboard, Apartments (read-only), Tenants (edit existing only),
       Billing (mark-paid / mark-unpaid only — cannot create/edit bills, no import,
       no bulk-mark-paid), and Print Invoice — but no Settings/Users/System Settings,
       no add/delete actions, no bulk floor-price, no move-out;
     admin sees everything except Users + System Settings;
     super_admin sees everything.
□ Forgot-password emails a single-use 1-hour token; reset-password updates the right user.
□ SMTP settings (system_settings) take effect on next send; password masked in GET.
□ JWT auth attached on every request; 401 redirects to /login.
□ Frontend uses controlled forms, spinners, toasts.
□ docker-compose up brings the system up end-to-end.
```
