# Sampling Goods Request

## Apps
- `apps/api` - Node.js + Express + Prisma backend
- `apps/web` - React + Vite frontend

## Quick start
1. Ensure `.env` exists at repo root and includes `DATABASE_URL`.
2. Install dependencies:
   - `npm install`
3. Run database migration:
   - `npm --workspace apps/api run prisma:migrate -- --name init`
4. Seed sample users/catalog:
   - `npm --workspace apps/api run seed`
5. Run backend:
   - `npm --workspace apps/api run dev`
6. Run frontend:
   - `npm --workspace apps/web run dev`

## Seeded users
- `admin@gsr.local` / `ChangeMe123!`
- `manager@gsr.local` / `ChangeMe123!`
- `requestor@gsr.local` / `ChangeMe123!`
- `production@gsr.local` / `ChangeMe123!`
- `purchasing@gsr.local` / `ChangeMe123!`
- `logistics@gsr.local` / `ChangeMe123!`

## Notes
- SMTP failures are logged and do not block workflow actions.
- Configure real SMTP values in `.env` for email delivery.

## CI
- Run API tests:
  - `npm run test:api`
- Build frontend:
  - `npm run build:web`
- Run both (CI-style):
  - `npm run ci`

GitHub Actions workflow:
- `.github/workflows/ci.yml`
- Runs on push/PR with PostgreSQL service, Prisma migrate deploy, API tests, and frontend build.
