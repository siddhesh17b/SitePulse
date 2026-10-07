# SitePulse

SitePulse helps website teams handle three common jobs in one place:

1. Talk to visitors through a support chat widget.
2. Collect structured feedback and bug reports from visitors.
3. Track basic page traffic without cookies.

It includes:

- a backend API + Socket.IO server (`/backend`)
- an admin dashboard (`/dashboard`)
- an embeddable script you place on your site (`/widget/sitepulse.js`)

## What problem this solves

If you run a website, support requests, user feedback, bug reports, and page traffic data often end up in separate tools. SitePulse combines these into one workflow:

- visitors use one widget on your site
- your team uses one dashboard
- all records are stored in one PostgreSQL database

## Main features

- Real-time visitor chat with operator replies
- Conversation inbox with open/resolved status
- Feedback collection (rating + comment)
- Bug reports with optional browser/device/url context
- Widget customization (title, greeting, colors, feature toggles)
- Page rules to show/hide widget by path or wildcard pattern
- Page discovery via traffic + optional site scan
- Cookie-free analytics summary (pageviews, unique daily visitors, top pages)
- Multi-site support per account

## Repository structure

- `/backend` – Express API, Socket.IO gateway, Prisma schema
- `/dashboard` – React + Vite admin app
- `/widget` – embeddable client script
- `/docker-compose.yml` + `/Dockerfile` – containerized deployment

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 14+ (or use Docker Compose below)

## Local setup (without Docker)

1. Install dependencies:

```bash
npm install
npm --prefix backend install
npm --prefix dashboard install
```

2. Configure backend environment:

```bash
cp backend/.env.example backend/.env
```

Then update at least:

- `DATABASE_URL`
- `JWT_SECRET`
- `DAILY_SALT`

3. Prepare database schema:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
```

4. (Optional) seed demo site:

```bash
node backend/src/seed.js
```

5. Start services:

Backend:

```bash
npm run dev:backend
```

Dashboard (separate terminal):

```bash
npm run dev:dashboard
```

In dev mode the dashboard runs on Vite and calls backend at `http://localhost:5000`.

## Production-style single-port run

Build dashboard and prepare backend:

```bash
npm run build
```

Start unified server:

```bash
npm start
```

This serves:

- dashboard UI
- REST API
- Socket.IO
- widget script at `/sitepulse.js`

from the same port (default `5000`).

## Docker Compose quick start

From repository root:

```bash
docker compose up --build
```

This starts:

- PostgreSQL (`sitepulse_db`)
- SitePulse app (`sitepulse_app`)

Default app URL: `http://localhost:5000`

## Embed the widget on your website

Add this before `</body>`:

```html
<script src="http://localhost:5000/sitepulse.js" data-site-key="YOUR_SITE_KEY"></script>
```

You can copy the exact snippet for each site from the dashboard.

## How the basic flow works

1. Admin signs up/logs in through the dashboard.
2. Admin creates a site entry (name + domain).
3. Admin embeds widget script on that site.
4. Visitors can:
   - start a chat
   - submit feedback
   - submit bug reports
5. Dashboard shows:
   - conversations and real-time messages
   - feedback and bug report lists
   - analytics summary
   - widget and page-rule settings

## Useful scripts

From repository root:

- `npm run dev:backend` – backend in watch mode
- `npm run dev:dashboard` – dashboard in dev mode
- `npm run build` – build dashboard + prepare backend Prisma
- `npm start` – run unified production server
- `npm run db:reset` – clear all SitePulse data

From `/backend`:

- `npm run prisma:generate`
- `npm run prisma:push`
- `npm run prisma:migrate`

## Core API groups

- Auth: `/api/v1/auth/*`
- Sites + widget settings: `/api/v1/sites/*`, `/api/v1/widget/config`
- Conversations: `/api/v1/conversations/*`
- Feedback: `/api/v1/feedback`
- Bug reports: `/api/v1/bugs`
- Analytics events + stats: `/api/v1/events`, `/api/v1/events/stats`

## Notes

- Tokens are session-scoped in the dashboard (stored in `sessionStorage`).
- Visitor analytics uses hashed daily identifiers instead of raw persistent visitor IDs.
- First account created is admin; later signups become agent role.
