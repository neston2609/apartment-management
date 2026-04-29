# Apartment Management System

Full-stack apartment management system built per `CLAUDE.md` spec.
Node.js + Express + PostgreSQL backend, React + Tailwind frontend, PDFKit for Thai-language contracts and invoices.

## Quick start

```bash
# 1. Install everything
npm run install:all

# 2. Initialise the database (one time)
npm run db:migrate
npm run db:seed

# 3. Start dev (backend on :5000, frontend on :3000)
npm run dev
```

Default admin login: `admin` / `admin1234`
Tenant login: use any seeded national ID (password = same national ID).

## Thai PDF font

PDFKit's bundled fonts do not include Thai glyphs. To produce real Thai PDFs,
download `Sarabun-Regular.ttf` (and optionally `Sarabun-Bold.ttf`) from
[Google Fonts: Sarabun](https://fonts.google.com/specimen/Sarabun) and place
them in `backend/utils/fonts/`. The PDF generator falls back to Helvetica if
the files are missing so the API still works.

## Docker

```bash
docker-compose up --build
```

Frontend: http://localhost:3000
Backend:  http://localhost:5000/api
