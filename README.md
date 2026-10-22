# SitePulse

SitePulse helps website teams handle three common jobs in one unified platform:

1. **Talk to visitors** through an embeddable support chat widget.
2. **Collect structured feedback and bug reports** directly from users.
3. **Track privacy-preserving, cookieless traffic** across website pages.

### System Architecture

- `/backend` – Express API, Socket.IO gateway, Prisma ORM, Pino structured logging, Helmet security & Zod validation
- `/dashboard` – Modular React + Vite admin app with custom hooks (`useAuth`, `useSites`, `useChat`)
- `/widget` – Embeddable, Shadow DOM-isolated client script (`sitepulse.js`)
- `/docs` – Engineering guides including declarative database migrations
- `/docker-compose.yml` + `/Dockerfile` – Containerized single-port production deployment

---

## What Problem This Solves

If you run a website, support requests, user feedback, bug reports, and page traffic data often end up fragmented across separate third-party tools. SitePulse unifies these into one cohesive workflow:

- **Visitors** interact with a single, lightweight widget on your site.
- **Your Team** manages incoming chats, bugs, feedback, page targeting rules, and analytics in one dashboard.
- **Data Integrity** is preserved in a single, high-performance PostgreSQL database.

---

## Main Features

- **Real-Time Live Chat**: Bidirectional Socket.IO messaging between visitors and support agents with typing indicators.
- **Conversations Inbox**: Filter by unread, open, or resolved with real-time badges.
- **Structured Feedback**: Rating stars (1–5) and user comments.
- **Bug Reporting with Diagnostics**: Automatically captures visitor browser, OS, device, and URL context.
- **Dynamic Widget Customizer**: Real-time styling (primary color, greeting, titles, feature toggles).
- **Page Rules & Display Targeting**: Enable or disable the widget on specific paths or wildcard patterns (`/products/*`, `/checkout`).
- **Web Crawler & Auto-Discovery**: Discovers internal pages via traffic logs, robots.txt, and XML sitemaps.
- **Cookieless Analytics**: Daily rotating SHA-256 session hashes tracking pageviews, unique visitors, and top pages via database-level `groupBy` aggregation.
- **Multi-Tenant Architecture**: Multi-site management per account with password-protected danger zone actions (site deletion & chat purge).
- **Security & Reliability**: Route-specific CORS policies, Helmet HTTP security headers, Pino structured JSON logging, and `X-Request-ID` request tracing.

---

## Prerequisites

- **Node.js**: 20+
- **npm**: 10+
- **PostgreSQL**: 14+ (or use Docker Compose below)

---

## Local Setup (Without Docker)

### 1. Install Dependencies

```bash
npm install
npm --prefix backend install
npm --prefix dashboard install
```

### 2. Configure Backend Environment

Copy the example environment file:

```bash
# macOS / Linux:
cp backend/.env.example backend/.env

# Windows (PowerShell):
Copy-Item backend/.env.example backend/.env
```

Update your `backend/.env` with your local credentials:

```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sitepulse?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
DAILY_SALT="your-privacy-salt-for-analytics"
```

### 3. Initialize Database Schema

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
```

*(For production-grade declarative migrations with versioned SQL files, see [Database Migrations & Schema Management](#database-migrations--schema-management) below).*

### 4. Seed Demo Site (Optional)

```bash
node backend/src/seed.js
```

### 5. Start Development Servers

Run backend (Express + Socket.IO on port `5000`):

```bash
npm run dev:backend
```

Run dashboard (Vite dev server on port `5173` in a separate terminal):

```bash
npm run dev:dashboard
```

---

## Database Migrations & Schema Management

SitePulse supports both rapid prototyping and production-grade declarative schema migrations using Prisma. For a comprehensive architectural guide, refer to [`docs/DATABASE_MIGRATIONS.md`](docs/DATABASE_MIGRATIONS.md).

### Development Migrations (`prisma migrate dev`)
Whenever you update `backend/prisma/schema.prisma`, generate an immutable, version-controlled SQL migration file:

```bash
# From repository root:
npm --prefix backend run prisma:migrate -- --name descriptive_migration_name

# Or inside /backend:
cd backend
npx prisma migrate dev --name descriptive_migration_name
```
*This updates your local database, creates a timestamped SQL migration in `backend/prisma/migrations/`, and regenerates the Prisma Client.*

### Applying Migrations in Production / CI (`prisma migrate deploy`)
In production containers or staging environments, apply pending migrations deterministically without prompting:

```bash
cd backend
npx prisma migrate deploy
```

### Rapid Prototyping (`prisma db push`)
For quick experimental schema prototyping without creating migration files:

```bash
npm --prefix backend run prisma:push
```

### Wiping / Resetting Database
To wipe all data records in foreign-key dependency order (keeping the schema):

```bash
npm run db:reset
```

To drop all tables and recreate a completely fresh database schema:

```bash
npm --prefix backend run prisma:push -- --force-reset
```

---

## Production-Style Single-Port Run

Compile the dashboard SPA and prepare backend Prisma client:

```bash
npm run build
```

Start the unified server:

```bash
npm start
```

This single process hosts:
- Dashboard SPA at `http://localhost:5000/`
- REST API at `http://localhost:5000/api/v1/`
- Socket.IO gateway on port `5000`
- Widget script at `http://localhost:5000/sitepulse.js`

---

## Deployment Guide for Website Owners

SitePulse can be deployed to the cloud in minutes. Choose the deployment method that fits your infrastructure:

### Option A: Cloud PaaS Deployment (Render, Railway, Fly.io)

Using the production [`Dockerfile`](Dockerfile):

1. **Provision a PostgreSQL Database**:
   - In your cloud provider (e.g., Render, Supabase, Neon, Railway), create a new PostgreSQL database.
   - Copy the database connection string (`DATABASE_URL`).
2. **Create a Docker Web Service**:
   - Connect your SitePulse repository.
   - Select **Docker** as the deployment runtime.
3. **Configure Environment Variables**:
   Set the following variables in your provider's settings:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"
   JWT_SECRET="generate-a-secure-random-32-char-secret"
   DAILY_SALT="generate-a-random-salt-for-cookieless-analytics"
   NODE_ENV="production"
   ```
4. **Deploy**:
   - Your provider will execute the multi-stage build, compile the dashboard SPA, push database schemas via Prisma, and bring your unified server online with automatic HTTPS.

---

### Option B: Self-Hosted VPS Deployment (Docker Compose + Nginx/Caddy)

For website owners hosting on their own Linux VPS (DigitalOcean Droplet, Hetzner, AWS EC2, Linode):

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/SitePulse.git
   cd SitePulse
   ```
2. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_strong_db_password
   POSTGRES_DB=sitepulse
   JWT_SECRET=your_super_secret_jwt_key
   DAILY_SALT=your_privacy_analytics_salt
   ```
3. **Start the Stack**:
   ```bash
   docker compose up -d --build
   ```
   *This starts PostgreSQL on port `5432` with a persistent volume (`sitepulse_pgdata`) and the unified SitePulse platform on port `5000`.*
4. **Set Up an HTTPS Reverse Proxy (Caddy or Nginx)**:
   - **Using Caddy (Automatic Free SSL)**:
     ```caddyfile
     support.yourdomain.com {
         reverse_proxy localhost:5000
     }
     ```
   - **Using Nginx**:
     ```nginx
     server {
         server_name support.yourdomain.com;

         location / {
             proxy_pass http://localhost:5000;
             proxy_http_version 1.1;
             proxy_set_header Upgrade $http_upgrade;
             proxy_set_header Connection "upgrade";
             proxy_set_header Host $host;
             proxy_set_header X-Real-IP $remote_addr;
             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
             proxy_set_header X-Forwarded-Proto $scheme;
         }
     }
     ```

---

## Embed the Widget on Your Website

Once your SitePulse instance is running, embed the support widget on any website (WordPress, Shopify, Webflow, Next.js, or custom HTML):

1. Log into your SitePulse dashboard and create a new **Website Property**.
2. Copy your site's embed snippet from the **Settings** tab.
3. Paste it directly before the closing `</body>` tag on your website:

```html
<!-- Replace with your deployed SitePulse URL and Site Key -->
<script src="https://support.yourdomain.com/sitepulse.js" data-site-key="YOUR_SITE_KEY" defer></script>
```

- **Universal Compatibility**: Works on any domain or CMS with zero CSS conflicts (powered by native Shadow DOM).
- **Zero Config**: The widget automatically detects its own origin to communicate with your backend API and Socket.IO gateway.

---

## Docker Compose Quick Start (Local Testing)

To spin up both PostgreSQL and the unified SitePulse container locally:

```bash
docker compose up --build
```

- PostgreSQL runs on port `5432`
- SitePulse App runs on port `5000` (`http://localhost:5000`)

---

## Automated Verification & Testing

## Useful Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm test` | Runs the 34-test end-to-end backend verification suite |
| `npm run dev:backend` | Starts backend server in watch mode (`nodemon`) |
| `npm run dev:dashboard` | Starts Vite dashboard dev server |
| `npm run build:dashboard` | Builds dashboard SPA with Vite |
| `npm run build` | Builds dashboard and generates Prisma Client |
| `npm start` | Runs single-port production server |
| `npm run db:reset` | Wipes all database records cleanly |
| `npm --prefix backend run prisma:migrate` | Runs declarative Prisma database migration |
| `npm --prefix backend run prisma:push` | Synchronizes Prisma schema directly to DB |

---

## Core API Groups

- **Authentication & Profiles**: `/api/v1/auth/signup`, `/api/v1/auth/login`, `/api/v1/auth/me`, `/api/v1/auth/status`
- **Sites & Settings**: `/api/v1/sites`, `/api/v1/sites/:id`, `/api/v1/widget/config`
- **Page Discovery & Rules**: `/api/v1/sites/:siteKey/pages`, `/api/v1/sites/:siteKey/scan`
- **Live Conversations**: `/api/v1/conversations`, `/api/v1/conversations/init`, `/api/v1/conversations/:id/messages`
- **Feedback Collection**: `/api/v1/feedback`
- **Bug Reporting**: `/api/v1/bugs`
- **Privacy Analytics**: `/api/v1/events`, `/api/v1/events/stats`
