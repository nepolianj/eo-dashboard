# Program Operations Dashboard — Educational Outreach, IIT Bombay

A web-based dashboard for Admins, Program Managers and Operations staff to manage programs, track learner registrations and payments, and monitor operational metrics.

**Assignment 1 — Senior Full Stack Developer Technical Assignment**

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Single codebase for UI + API route handlers |
| Database | MySQL 8 | As required |
| ORM | Prisma | Type-safe queries, migrations, relation handling |
| Auth | NextAuth (Credentials + JWT) | Stateless sessions, role claim carried in the JWT |
| Validation | Zod | Same schema validates on the server for every write |
| UI | Tailwind CSS + Recharts | Clean, professional dashboard UI |

## Quick Start

### 1. Prerequisites
- Node.js 18.17+
- MySQL 8 running locally (or Docker: see below)

```bash
# Optional: run MySQL via Docker
docker run --name eo-mysql -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=eo_dashboard -p 3306:3306 -d mysql:8
```

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | `mysql://root:root@localhost:3306/eo_dashboard` |
| `NEXTAUTH_SECRET` | Secret for signing session JWTs. Generate: `openssl rand -base64 32` | *(random string)* |
| `NEXTAUTH_URL` | Base URL of the app | `http://localhost:3000` |

No credentials are hardcoded anywhere in the codebase.

### 3. Install, migrate, seed, run

```bash
npm install
npx prisma migrate dev --name init   # creates schema
npm run db:seed                      # demo users + sample data
npm run dev                          # http://localhost:3000
```

### 4. Demo logins (password for all: `Password@123`)

| Email | Role |
|---|---|
| admin@eo.iitb.ac.in | ADMIN |
| manager@eo.iitb.ac.in | PROGRAM_MANAGER |
| ops@eo.iitb.ac.in | OPERATIONS |

## Dynamic Roles & Permissions (Role Master / User Master)

Access control is **database-driven**, not hardcoded: `roles` ⇄ `permissions` through a `role_permissions` pivot, and each user references a `role_id`. Every API route handler calls `requirePermission("<module>.<action>")` (`src/lib/api.ts`), which reads the user's role and permission set from the database **on every request** — so:

- Editing a role in **Role Master** changes what its users can do immediately (no re-login needed for the backend; the UI buttons refresh on next login since the JWT snapshot is only used to hide buttons).
- Deactivating a user in **User Master** locks them out instantly, even with a valid session token.

Seeded system roles (rename/delete blocked; permission sets editable):

| Permission | Administrator | Program Manager | Operations |
|---|---|---|---|
| dashboard.view | ✅ | ✅ | ✅ |
| programs.view | ✅ | ✅ | ✅ |
| programs.create / edit | ✅ | ✅ | ❌ |
| programs.delete | ✅ | ❌ | ❌ |
| registrations.view / create / edit | ✅ | ✅ | ✅ |
| registrations.delete | ✅ | ✅ | ❌ |
| payments.record | ✅ | ✅ | ✅ |
| users.manage / roles.manage | ✅ | ❌ | ❌ |

Custom roles can be created in Role Master with any permission combination. Guardrails: you cannot deactivate your own account or change your own role; system roles can't be renamed or deleted; roles with assigned users can't be deleted.

You can verify backend enforcement directly, e.g. logged in as `ops@…`:
`curl -X DELETE http://localhost:3000/api/programs/1 -H "Cookie: <session>"` → `403 Forbidden`.

## API Overview

All endpoints return a consistent envelope: `{ success, data }` or `{ success: false, message, errors }`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/programs?status=&mode=&q=&from=&to=` | List + filter programs |
| POST / PUT / DELETE | `/api/programs`, `/api/programs/:id` | Program CRUD |
| GET | `/api/registrations?registration_status=&payment_status=&program_id=&q=&from=&to=` | List + filter registrations |
| POST / PUT / DELETE | `/api/registrations`, `/api/registrations/:id` | Registration CRUD |
| POST | `/api/payments` | Record a payment (derives payment status) |
| GET | `/api/dashboard` | Aggregated metrics |
| GET / POST | `/api/users`, PUT `/api/users/:id` | User Master (admin) |
| GET / POST / PUT / DELETE | `/api/roles`, `/api/roles/:id` | Role Master (admin) |
| GET | `/api/permissions` | Permission catalog for the role editor |

## Design Decisions

- **Normalised payments table** (the optional entity) is implemented. `registrations.payment_status` is *derived on the backend* inside a DB transaction whenever a payment is recorded: sum of successful payments vs. registration amount → `PENDING` / `PARTIAL` / `PAID`. Overpayment and duplicate reference numbers are rejected.
- **Referential safety over cascade deletes**: a program with registrations can't be deleted (409 with a clear message — cancel it instead); a registration with successful payments can't be deleted. Destructive actions require typed confirmation dialogs in the UI.
- **Validation happens server-side with Zod** on every write; field-level errors are surfaced back into the forms. Duplicate program codes and duplicate active registrations (same learner + program) are rejected with 409s.
- **Money is stored as `DECIMAL(10,2)`**, never floats.
- **Login hygiene**: bcrypt-hashed passwords, identical failure responses for "no such user" and "wrong password" (no user enumeration), inactive users blocked, 8-hour JWT sessions.
- **Filtering is done in SQL** (Prisma `where` built from query params), not in the browser, so it scales past toy data sizes.

## What I'd improve with more time

- Pagination + column sorting on the tables (API is structured to accept `page`/`limit` easily)
- Audit log table for create/update/delete actions
- Unit tests for the payment-status derivation logic and RBAC guards
