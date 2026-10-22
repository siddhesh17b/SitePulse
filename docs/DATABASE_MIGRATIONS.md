# Declarative Database Migrations Guide

This guide establishes the database migration standard for SitePulse. It transitions the project from ad-hoc schema prototyping (`prisma db push`) to production-ready, declarative database migrations (`prisma migrate dev` and `prisma migrate deploy`).

---

## 1. Why Declarative Migrations?

In early development, `prisma db push` synchronizes `schema.prisma` directly to the target database without creating migration artifacts. While convenient for rapid prototyping, it has critical drawbacks in collaborative and production environments:

| Feature | `prisma db push` (Prototyping) | `prisma migrate dev` (Declarative Standard) |
| :--- | :--- | :--- |
| **Migration History** | ❌ None (direct schema overwrite) | ✅ Version-controlled `.sql` files in `prisma/migrations/` |
| **Reproducibility** | ⚠️ Can cause environment drift | ✅ Deterministic replay across local, staging, and production |
| **Code Reviews** | ❌ Schema diffs hidden from PRs | ✅ Exact SQL migration scripts reviewed in pull requests |
| **Data Safety** | ⚠️ Risky field drops without warnings | ✅ Prompts for data loss and creates rollback paths |
| **Production Deployment** | ❌ Never recommended for production | ✅ Fast, non-interactive execution via `prisma migrate deploy` |

---

## 2. Developer Workflow

### Step 1: Update the Schema
Edit [`backend/prisma/schema.prisma`](file:///d:/Work/Learning_and_projects/Projects/5th_sem/idealab/SitePulse/backend/prisma/schema.prisma) with your required model, index, or relation changes.

### Step 2: Generate and Apply the Migration
Run the declarative migration command from the project root or backend directory:

```bash
# From project root:
npm --prefix backend run prisma:migrate -- --name descriptive_migration_name

# Or directly in backend:
cd backend
npx prisma migrate dev --name descriptive_migration_name
```

This command will:
1. Compare your `schema.prisma` against the current database state.
2. Generate a new timestamped directory under `backend/prisma/migrations/<timestamp>_descriptive_migration_name/migration.sql`.
3. Apply the SQL migration script to your local PostgreSQL database.
4. Regenerate the Prisma Client (`@prisma/client`) automatically.

### Step 3: Review the Generated SQL
Inspect the generated `migration.sql` file before committing:
```sql
-- Example: backend/prisma/migrations/20261022_add_user_role/migration.sql
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'agent';
```

Commit both `schema.prisma` and the `prisma/migrations/` directory to source control.

---

## 3. Production & Staging Deployment

In staging or production environments (including Docker entrypoints or server boots), never run `prisma migrate dev` (which expects interactive confirmation). Instead, run:

```bash
# In backend container / production server
npx prisma migrate deploy
```

`prisma migrate deploy`:
- Reads unapplied migrations from `prisma/migrations/`.
- Executes them in chronological sequence against the production database.
- Records executed migration IDs in the `_prisma_migrations` internal table.
- Exits cleanly without modifying the migration history or prompting.

---

## 4. Resetting the Database in Development

If your local database state diverges or needs a clean slate:

```bash
# Re-applies all migrations from scratch and runs seeders
npm run db:reset

# Or using Prisma directly in backend:
cd backend
npx prisma migrate reset
```
