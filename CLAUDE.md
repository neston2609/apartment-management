# CLAUDE.md - Apartment Management System

## AI Model Configuration
- Model: qwen2.5-coder:32b (via Ollama)
- Base URL: http://localhost:11434/v1
- Base directory: /G/ollama/apartment-management-system
---

## Project Overview
A complete full-stack **Apartment Management System** supporting:
- Multiple apartment management
- Room tracking and billing
- Tenant management with PDF contracts
- Water/electricity meter billing
- PDF invoice generation (A4 & A5, Thai language)
- Admin and Tenant login roles

---

## Tech Stack
| Layer      | Technology                          |
|------------|-------------------------------------|
| Backend    | Node.js + Express.js (port 5000)    |
| Frontend   | React.js + TailwindCSS (port 3000)  |
| Database   | PostgreSQL (external host)          |
| PDF        | PDFKit (backend)                    |
| Auth       | JWT (admin & tenant roles)          |
| Dev Tools  | concurrently, nodemon, dotenv       |

---

## Database Connection
Host: neston.thddns.net
Port: 2009
User: postgres
Password: LEpooh2901#
Database: apartment_db

---

## Project Structure
apartment-management-system/
├── CLAUDE.md
├── package.json # root scripts (concurrently)
├── .env # actual env vars (gitignored)
├── .env.example # template
├── .gitignore
├── docker-compose.yml
├── database/
│ ├── schema.sql # full DB schema
│ ├── seed.sql # sample data
│ └── migrate.js # migration runner (Node)
├── backend/
│ ├── package.json
│ ├── server.js # Express entry point
│ ├── config/
│ │ └── database.js # pg Pool config
│ ├── middleware/
│ │ └── auth.js # JWT verify, role guards
│ ├── routes/
│ │ ├── auth.js # POST /auth/login, /auth/tenant/login
│ │ ├── apartments.js # CRUD apartments + rooms + settings
│ │ ├── rooms.js # GET/PUT rooms
│ │ ├── tenants.js # CRUD tenants + moveout + contract PDF
│ │ ├── bills.js # CRUD bills + meter readings + PDF
│ │ └── settings.js # expense settings
│ └── utils/
│ └── pdf.js # PDFKit: contract A4, invoice A4/A5
└── frontend/
├── package.json
├── tailwind.config.js
├── postcss.config.js
└── src/
├── index.js
├── App.jsx # routes: admin & tenant
├── context/
│ └── AuthContext.jsx # JWT storage, login/logout
├── utils/
│ └── api.js # axios instance + interceptors
├── components/
│ ├── Layout.jsx # admin shell (sidebar + navbar)
│ ├── Sidebar.jsx
│ ├── Navbar.jsx
│ ├── PrivateRoute.jsx # role-based route guard
│ └── common/
│ ├── Modal.jsx
│ ├── Table.jsx
│ ├── Badge.jsx
│ ├── Spinner.jsx
│ └── Alert.jsx
└── pages/
├── Login.jsx # shared login page
├── admin/
│ ├── Dashboard.jsx # stats cards + charts
│ ├── Apartments.jsx # list + create + edit apartments
│ ├── Rooms.jsx # room grid + status + price editor
│ ├── Tenants.jsx # tenant list + add + moveout
│ ├── TenantForm.jsx # add/edit tenant form
│ ├── Billing.jsx # billing list + create/edit bill
│ ├── BillingForm.jsx # meter readings + cost calc
│ ├── Invoice.jsx # PDF preview + download A4/A5
│ └── Settings.jsx # expense settings per apartment
└── tenant/
├── TenantDashboard.jsx # tenant home
├── TenantBills.jsx # bill history
└── TenantContract.jsx # view/download contract PDF

---

## Environment Variables (.env)
Database
DB_HOST=neston.thddns.net
DB_PORT=2009
DB_USER=postgres
DB_PASSWORD=LEpooh2901#
DB_NAME=apartment_db

JWT
JWT_SECRET=your_super_secret_jwt_key_change_in_production_min_32chars
JWT_EXPIRES_IN=7d

Server
PORT=5000
NODE_ENV=development

Frontend (used in React)
REACT_APP_API_URL=http://localhost:5000/api

---

## Root package.json Scripts
```json
{
  "name": "apartment-management-system",
  "version": "1.0.0",
  "scripts": {
    "install:all":  "npm install && cd backend && npm install && cd ../frontend && npm install",
    "dev":          "concurrently \"cd backend && npm run dev\" \"cd frontend && npm start\"",
    "build":        "cd frontend && npm run build",
    "start":        "cd backend && npm start",
    "db:migrate":   "node database/migrate.js",
    "db:seed":      "node database/seed.js"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
```

## Database Schema (Full Specification)
ENUM Types
CREATE TYPE room_status AS ENUM (
    'occupied',
    'vacant',
    'maintenance',
    'common',
    'caretaker'
);
Table: apartments
CREATE TABLE apartments (
    apartment_id    SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    address         TEXT NOT NULL,
    contact_number  VARCHAR(20),
    floors_count    INTEGER NOT NULL DEFAULT 1,
    rooms_per_floor INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
Table: rooms
CREATE TABLE rooms (
    room_id         SERIAL PRIMARY KEY,
    apartment_id    INTEGER NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    floor_number    INTEGER NOT NULL,
    room_sequence   INTEGER NOT NULL,
    room_number     VARCHAR(20) NOT NULL,   -- auto: floor + LPAD(seq,2,'0')
    rental_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
    status          room_status NOT NULL DEFAULT 'vacant',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id, room_number)
);
Table: tenants
CREATE TABLE tenants (
    tenant_id       SERIAL PRIMARY KEY,
    room_id         INTEGER REFERENCES rooms(room_id) ON DELETE SET NULL,
    full_name       VARCHAR(255) NOT NULL,
    phone_number    VARCHAR(20),
    national_id     VARCHAR(20) UNIQUE NOT NULL,
    move_in_date    DATE NOT NULL,
    move_out_date   DATE,
    email           VARCHAR(255),
    password_hash   VARCHAR(255) NOT NULL,  -- default: bcrypt(national_id)
    notes           TEXT,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
Table: expense_settings
CREATE TABLE expense_settings (
    setting_id                  SERIAL PRIMARY KEY,
    apartment_id                INTEGER NOT NULL REFERENCES apartments(apartment_id) ON DELETE CASCADE,
    water_price_per_unit        DECIMAL(10,2) NOT NULL DEFAULT 0,
    water_max_units             INTEGER NOT NULL DEFAULT 9999,
    electricity_price_per_unit  DECIMAL(10,2) NOT NULL DEFAULT 0,
    electricity_max_units       INTEGER NOT NULL DEFAULT 9999,
    invoice_footer_text         TEXT DEFAULT '',
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(apartment_id)
);
Table: meter_readings
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
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);
Table: bills
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
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, month, year)
);
Table: admin_users
CREATE TABLE admin_users (
    admin_id        SERIAL PRIMARY KEY,
    username        VARCHAR(100) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    email           VARCHAR(255),
    apartment_id    INTEGER REFERENCES apartments(apartment_id),
    is_super_admin  BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
Indexes
CREATE INDEX idx_rooms_apartment_id        ON rooms(apartment_id);
CREATE INDEX idx_rooms_status              ON rooms(status);
CREATE INDEX idx_tenants_room_id           ON tenants(room_id);
CREATE INDEX idx_tenants_national_id       ON tenants(national_id);
CREATE INDEX idx_tenants_is_active         ON tenants(is_active);
CREATE INDEX idx_meter_readings_room_id    ON meter_readings(room_id);
CREATE INDEX idx_meter_readings_month_year ON meter_readings(month, year);
CREATE INDEX idx_bills_room_id             ON bills(room_id);
CREATE INDEX idx_bills_month_year          ON bills(month, year);
CREATE INDEX idx_expense_settings_apt      ON expense_settings(apartment_id);

## API Endpoints (Full Specification)
Authentication
POST   /api/auth/login               # admin login → JWT
POST   /api/auth/tenant/login        # tenant login → JWT
POST   /api/auth/register-admin      # create admin (super admin only)
PUT    /api/auth/change-password     # change own password

Apartments
GET    /api/apartments               # list all (with room counts)
GET    /api/apartments/:id           # detail + settings
POST   /api/apartments               # create + auto-generate rooms
PUT    /api/apartments/:id           # update info
GET    /api/apartments/:id/rooms     # list rooms (filter by ?status=)
PUT    /api/apartments/:id/settings  # update expense settings

Rooms
GET    /api/rooms/:id                # single room detail
PUT    /api/rooms/:id                # update price/status
PUT    /api/rooms/bulk/floor-price   # set uniform price for whole floor

Tenants
GET    /api/tenants                  # list active tenants (?apartment_id=)
GET    /api/tenants/:id              # single tenant detail
POST   /api/tenants                  # create tenant (hashes national_id → password)
PUT    /api/tenants/:id              # update tenant info
POST   /api/tenants/:id/moveout      # record move-out date, set is_active=false
GET    /api/tenants/:id/contract     # generate PDF rental contract (A4, Thai)

Bills & Meter Readings
GET    /api/bills?month=&year=&apartment_id=   # list bills for month/year
GET    /api/bills/:id                           # single bill detail
POST   /api/bills                               # create bill + meter reading
PUT    /api/bills/:id                           # edit bill + meter reading
GET    /api/bills/:id/pdf?size=A4|A5           # download invoice PDF
GET    /api/bills/meter/:room_id?month=&year=  # get meter reading for room/month

Settings
GET    /api/settings/:apartment_id   # get expense settings
PUT    /api/settings/:apartment_id   # update expense settings

## Business Rules (CRITICAL - Must Follow Exactly)
1. Room Number Auto-Generation
room_number = floor_number.toString() + room_sequence.toString().padStart(2, '0')

Examples:
  floor=1,  seq=1  → "101"
  floor=1,  seq=10 → "110"
  floor=10, seq=8  → "1008"
  floor=3,  seq=5  → "305"
  
2. Meter Rollover Calculation
// Water calculation
if (rollover_water) {
    water_usage = (water_max_units - water_units_last) + water_units_current;
} else {
    water_usage = water_units_current - water_units_last;
}
water_cost = water_usage * water_price_per_unit;

// Electricity calculation (same logic)
if (rollover_electricity) {
    electricity_usage = (electricity_max_units - electricity_units_last) + electricity_units_current;
} else {
    electricity_usage = electricity_units_current - electricity_units_last;
}
electricity_cost = electricity_usage * electricity_price_per_unit;

3. Bill Total Calculation
total_cost = water_cost + electricity_cost + rent_cost + other_cost;

4. Tenant Password Rules
- Default password on creation = national_id (bcrypt hashed, salt rounds = 10)
- Tenant can change password via /api/auth/change-password
- Admin cannot see or reset to plain text

5. Room Status Rules
- New rooms default to: 'vacant'
- When tenant added → room status changes to: 'occupied'
- When tenant moves out → room status changes to: 'vacant'
- Admin can manually set: 'maintenance', 'common', 'caretaker'

6. Bill Existence Check
- Before creating a bill: check if bill exists for (room_id, month, year)
- If exists → switch to EDIT mode (PUT /api/bills/:id)
- If not exists → CREATE mode (POST /api/bills)
- Frontend must detect this automatically

7. Invoice Filter Defaults
- Default status filter for invoice generation: ['occupied', 'caretaker']
- Admin can toggle to include: 'maintenance', 'common', 'vacant'

8. Move-Out Process
1. Record move_out_date on tenant record
2. Set tenant.is_active = FALSE
3. Set room.status = 'vacant'
4. Keep all historical bills and meter readings
5. Tenant no longer appears in active tenant list

9. Room Price Flexibility
- On apartment creation: set uniform price for all rooms (optional)
- Admin can update individual room price anytime
- Admin can set uniform price per floor (bulk update)

## Frontend Pages Specification
Admin Pages
1. Login Page (/login)
	Username + password fields
	Toggle to tenant login (uses National ID)
	JWT stored in localStorage
	Redirect to dashboard on success
2. Dashboard (/admin/dashboard)
	Summary cards: total rooms, occupied, vacant, maintenance
	Revenue summary for current month
	Recent tenants table
	Quick links to billing
3. Apartments (/admin/apartments)
	List all apartments with room counts
	Create form: name, address, phone, floors, rooms/floor, starting price
	Edit apartment info
	Link to rooms view
4. Rooms (/admin/rooms/:apartmentId)
	Grid view of all rooms by floor
	Color coded by status:
	occupied → green
	vacant → gray
	maintenance → yellow
	common → blue
	caretaker → purple
	Click room → edit price/status modal
	Bulk set price by floor
	Show tenant name if occupied
5. Tenants (/admin/tenants)
	Filter by apartment
	Table: room number, name, phone, move-in date, actions
	Add tenant form (links to vacant room)
	Edit tenant info
	Move-out button → confirm dialog → records date
	Download contract PDF button
6. Billing (/admin/billing)
	Select apartment + month + year
	Table of all rooms with bill status
	Click room → open BillingForm
	BillingForm:
	Last/current readings for water & electricity
	Rollover checkboxes
	Auto-calculated costs (update on change)
	Rent (pre-filled from room price)
	Other costs field
	Grand total (read-only, auto-sum)
	Save button
7. Invoice (/admin/invoice)
	Select apartment + month + year
	Status filter checkboxes (default: occupied + caretaker)
	Preview list of rooms to print
	Download All as PDF (A4 or A5 selector)
	Download individual invoice
8. Settings (/admin/settings)
	Select apartment
	Water price per unit
	Water max meter units
	Electricity price per unit
	Electricity max meter units
	Invoice footer text (textarea)
	Save button
	
## Tenant Pages
1. Tenant Login (/tenant/login)
	National ID + password
	Link back to admin login
2. Tenant Dashboard (/tenant/dashboard)
	Welcome message with room number
	Current month bill summary
	Download contract PDF button
3. Tenant Bills (/tenant/bills)
	History table: month, year, water, electricity, rent, other, total
	Download PDF for each bill

## PDF Layout Requirements
Rental Contract (A4, Thai language)
┌─────────────────────────────────────┐
│      สัญญาเช่าห้องพัก               │
│   [ชื่ออพาร์ทเมนต์]                  │
│   [ที่อยู่]  โทร: [เบอร์]            │
├─────────────────────────────────────┤
│ ทำที่: [ที่อยู่]  วันที่: [วัน/เดือน/ปี] │
├─────────────────────────────────────┤
│ ผู้ให้เช่า: [ชื่อเจ้าของ]             │
│ ผู้เช่า:   [ชื่อผู้เช่า]              │
│ เลขบัตรประชาชน: [เลขบัตร]           │
│ โทรศัพท์: [เบอร์]                    │
├─────────────────────────────────────┤
│ ห้องเลขที่: [เลขห้อง]               │
│ ค่าเช่าต่อเดือน: [ราคา] บาท         │
│ วันเริ่มสัญญา: [วันที่]              │
├─────────────────────────────────────┤
│ ข้อตกลงและเงื่อนไข:                 │
│ 1. ผู้เช่าตกลงชำระค่าเช่า...        │
│ 2. ผู้เช่าต้องรักษาทรัพย์สิน...     │
│ 3. ห้ามนำสัตว์เลี้ยงเข้าพัก...      │
│ 4. ห้ามประกอบกิจการ...              │
│ 5. การบอกเลิกสัญญา...              │
│ [ข้อตกลง 10 ข้อ ภาษาไทย]           │
├─────────────────────────────────────┤
│ ลงชื่อผู้ให้เช่า: ............       │
│ ลงชื่อผู้เช่า:   ............       │
│ ลงชื่อพยาน:     ............       │
└─────────────────────────────────────┘

Bill Invoice (A4 & A5, Thai language)
┌─────────────────────────────────────┐
│   ใบแจ้งค่าเช่าและค่าใช้จ่าย       │
│   [ชื่ออพาร์ทเมนต์]                  │
│   [ที่อยู่]  โทร: [เบอร์]            │
├─────────────────────────────────────┤
│ ห้องเลขที่: [เลขห้อง]               │
│ ผู้เช่า:   [ชื่อ]                    │
│ ประจำเดือน: [เดือน พ.ศ.]            │
├─────────────────────────────────────┤
│ ค่าน้ำประปา                         │
│   มิเตอร์ครั้งก่อน:  [หน่วย]         │
│   มิเตอร์ครั้งนี้:   [หน่วย]         │
│   จำนวนหน่วย:       [หน่วย]         │
│   ราคาต่อหน่วย:     [ราคา] บาท      │
│   รวมค่าน้ำ:        [ราคา] บาท      │
├─────────────────────────────────────┤
│ ค่าไฟฟ้า                            │
│   มิเตอร์ครั้งก่อน:  [หน่วย]         │
│   มิเตอร์ครั้งนี้:   [หน่วย]         │
│   จำนวนหน่วย:       [หน่วย]         │
│   ราคาต่อหน่วย:     [ราคา] บาท      │
│   รวมค่าไฟ:         [ราคา] บาท      │
├─────────────────────────────────────┤
│ ค่าเช่าห้อง:        [ราคา] บาท      │
│ ค่าใช้จ่ายอื่นๆ:    [ราคา] บาท      │
├─────────────────────────────────────┤
│ รวมทั้งสิ้น:        [ราคา] บาท      │
├─────────────────────────────────────┤
│ [ข้อความท้ายใบแจ้งหนี้]             │
└─────────────────────────────────────┘

## Backend Dependencies (backend/package.json)
{
  "dependencies": {
    "bcrypt":             "^5.1.1",
    "cors":               "^2.8.5",
    "dotenv":             "^16.3.1",
    "express":            "^4.18.2",
    "express-validator":  "^7.0.1",
    "jsonwebtoken":       "^9.0.2",
    "pg":                 "^8.11.3",
    "pdfkit":             "^0.14.0"
  },
  "devDependencies": {
    "nodemon":            "^3.0.2"
  }
}

## Frontend Dependencies (frontend/package.json)
{
  "dependencies": {
    "react":              "^18.2.0",
    "react-dom":          "^18.2.0",
    "react-router-dom":   "^6.20.0",
    "axios":              "^1.6.2",
    "react-scripts":      "5.0.1",
    "@heroicons/react":   "^2.0.18",
    "react-hot-toast":    "^2.4.1",
    "date-fns":           "^2.30.0"
  },
  "devDependencies": {
    "tailwindcss":        "^3.3.6",
    "autoprefixer":       "^10.4.16",
    "postcss":            "^8.4.32"
  }
}

## Code Quality Rules (Must Follow)
General
1. Use async/await everywhere - NO callbacks
2. Always wrap DB calls in try/catch
3. Use parameterized queries ONLY - NEVER string concatenate SQL
4. Validate all request inputs before processing
5. Return consistent JSON: { data } for success, { error } for failure
6. Log errors to console with context

Security
1. Never return password_hash in any API response
2. Sanitize all inputs
3. Check user ownership before update/delete
4. Admin routes require: authenticate + adminOnly middleware
5. Tenant routes require: authenticate middleware
6. Use helmet middleware for HTTP headers

Database
1. Use transactions for multi-table operations
2. Always use connection pool (never single client)
3. Release connections in finally blocks
4. Use ON CONFLICT DO UPDATE for upsert patterns

Frontend
1. All API calls through src/utils/api.js (axios instance)
2. JWT token attached via axios interceptor
3. Handle 401 → redirect to login
4. Show loading spinners during API calls
5. Show success/error toasts for all mutations
6. Forms use controlled components
7. Thai language for ALL labels, buttons, messages

## Thai Language Reference
Month Names (Thai)
const THAI_MONTHS = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน',
  'พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม',
  'กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
];

// Thai Buddhist year = Gregorian year + 543
const thaiYear = year + 543;

## Common UI Labels
Dashboard         → แดชบอร์ด
Apartments        → อพาร์ทเมนต์
Rooms             → ห้องพัก
Tenants           → ผู้เช่า
Billing           → ใบแจ้งค่าเช่า
Settings          → ตั้งค่า
Logout            → ออกจากระบบ
Save              → บันทึก
Cancel            → ยกเลิก
Delete            → ลบ
Edit              → แก้ไข
Add               → เพิ่ม
Search            → ค้นหา
Floor             → ชั้น
Room Number       → เลขห้อง
Rental Price      → ราคาเช่า
Status            → สถานะ
occupied          → มีผู้เช่า
vacant            → ว่าง
maintenance       → ซ่อมบำรุง
common            → พื้นที่ส่วนกลาง
caretaker         → ผู้ดูแล
Full Name         → ชื่อ-นามสกุล
Phone             → เบอร์โทรศัพท์
National ID       → เลขบัตรประชาชน
Move-in Date      → วันที่เข้าพัก
Move-out Date     → วันที่ออก
Water             → ค่าน้ำ
Electricity       → ค่าไฟ
Rent              → ค่าเช่า
Other             → ค่าใช้จ่ายอื่นๆ
Total             → รวมทั้งสิ้น
Download PDF      → ดาวน์โหลด PDF
Generate Invoice  → สร้างใบแจ้งหนี้

## Sample Data Requirements (seed.sql)
Admin Account
username: admin
password: admin1234  (bcrypt hashed)
is_super_admin: true

Sample Apartment
name:            อพาร์ทเมนต์สุขสันต์
address:         123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110
contact_number:  02-123-4567
floors_count:    5
rooms_per_floor: 8

Sample Rooms
- Add tenants for all occupied rooms
- full_name pattern: นายสมชาย ใจดี (room 103), etc.
- national_id: unique 13-digit numbers
- move_in_date: 2024-01-01
- password_hash: bcrypt(national_id)

Sample Tenants
- Add tenants for all occupied rooms
- full_name pattern: นายสมชาย ใจดี (room 103), etc.
- national_id: unique 13-digit numbers
- move_in_date: 2024-01-01
- password_hash: bcrypt(national_id)

Sample Expense Settings
water_price_per_unit:       18.00
water_max_units:            9999
electricity_price_per_unit: 7.50
electricity_max_units:      9999
invoice_footer_text:        กรุณาชำระค่าเช่าภายในวันที่ 15 ของทุกเดือน
                            หากชำระล่าช้าจะมีค่าปรับ 100 บาท/วัน

Sample Meter Readings & Bills (current month)							
- Add meter readings for 5 occupied rooms
- Add corresponding bills					

## Docker Configuration
docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DB_HOST=neston.thddns.net
      - DB_PORT=2009
      - DB_USER=postgres
      - DB_PASSWORD=LEpooh2901#
      - DB_NAME=apartment_db
      - JWT_SECRET=${JWT_SECRET}
    depends_on: []
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped

## Build Order for AI Agent
Execute in this exact order:
PHASE 1 - DATABASE (do first)
  1.  database/schema.sql
  2.  database/seed.sql
  3.  database/migrate.js

PHASE 2 - ROOT CONFIG
  4.  .gitignore
  5.  .env.example
  6.  .env
  7.  package.json (root)

PHASE 3 - BACKEND
  8.  backend/package.json
  9.  backend/server.js
  10. backend/config/database.js
  11. backend/middleware/auth.js
  12. backend/routes/auth.js
  13. backend/routes/apartments.js
  14. backend/routes/rooms.js
  15. backend/routes/tenants.js
  16. backend/routes/bills.js
  17. backend/routes/settings.js
  18. backend/utils/pdf.js

PHASE 4 - FRONTEND
  19. frontend/package.json
  20. frontend/tailwind.config.js
  21. frontend/postcss.config.js
  22. frontend/public/index.html
  23. frontend/src/index.js
  24. frontend/src/App.jsx
  25. frontend/src/context/AuthContext.jsx
  26. frontend/src/utils/api.js
  27. frontend/src/components/Layout.jsx
  28. frontend/src/components/Sidebar.jsx
  29. frontend/src/components/Navbar.jsx
  30. frontend/src/components/PrivateRoute.jsx
  31. frontend/src/components/common/Modal.jsx
  32. frontend/src/components/common/Table.jsx
  33. frontend/src/components/common/Badge.jsx
  34. frontend/src/components/common/Spinner.jsx
  35. frontend/src/components/common/Alert.jsx
  36. frontend/src/pages/Login.jsx
  37. frontend/src/pages/admin/Dashboard.jsx
  38. frontend/src/pages/admin/Apartments.jsx
  39. frontend/src/pages/admin/Rooms.jsx
  40. frontend/src/pages/admin/Tenants.jsx
  41. frontend/src/pages/admin/TenantForm.jsx
  42. frontend/src/pages/admin/Billing.jsx
  43. frontend/src/pages/admin/BillingForm.jsx
  44. frontend/src/pages/admin/Invoice.jsx
  45. frontend/src/pages/admin/Settings.jsx
  46. frontend/src/pages/tenant/TenantDashboard.jsx
  47. frontend/src/pages/tenant/TenantBills.jsx
  48. frontend/src/pages/tenant/TenantContract.jsx

PHASE 5 - DEPLOYMENT
  49. backend/Dockerfile
  50. frontend/Dockerfile
  51. docker-compose.yml

## Final Checklist Before Submitting Code
□ All 51 files generated
□ No hardcoded credentials (use process.env)
□ All SQL uses parameterized queries
□ Thai language used in all UI text
□ Buddhist year (Gregorian + 543) used in PDFs
□ Meter rollover logic implemented correctly
□ Room number format correct (floor + LPAD seq)
□ Bill upsert logic (create or edit) works
□ Tenant default password = bcrypt(national_id)
□ Room status updates on tenant add/moveout
□ PDF generates for both A4 and A5
□ JWT auth working for both admin and tenant
□ All API error responses use { error: message }
□ All API success responses use { data } or array
□ Frontend shows loading states
□ Frontend shows Thai error/success messages
□ docker-compose.yml complete and working