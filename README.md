# Tabinda Fayaz Lone — Portfolio & Analytics System

Personal portfolio website built with plain HTML, CSS, and JavaScript, fully integrated with a **private analytics dashboard** at `/admin` and real-time **Gmail email notifications** powered by Supabase and Vercel Serverless Functions.

**Full Stack Developer · AI Enthusiast · Problem Solver**

---

## Key Features

1. **Minimalist Responsive Header**: Serves a horizontal navigation bar in the center on desktop, alongside a custom hamburger toggle button on the left that slides down a glassmorphic vertical dropdown menu. On mobile, the horizontal list is hidden, leaving a clean mobile layout.
2. **Automatic Visitor Tracking**: Logs browser type, version, operating system, screen resolution, timezone, language, landing page, exit page, and active session duration (via 15s heartbeats) in a Supabase database.
3. **Robust Geolocation**: Resolves the visitor's country and city automatically using Vercel edge headers (with `ipapi.co` fallback for local dev).
4. **Action Interceptors**:
   - **CV / Resume Downloads**: Automatically tracks download events when clicking "Download CV".
   - **Project Clicks**: Tallies card clicks for each project in your portfolio.
   - **Contact Form**: Intercepts Web3Forms submission callback success and failure statuses without logging user message contents.
5. **Real-time Gmail Alerts**: Delivers HTML-formatted alert messages to your Gmail address instantly when a new visitor arrives, downloads your CV, or submits a contact inquiry. Protects your inbox by rate-limiting visitor alerts to once per 15 minutes.
6. **Private Admin Dashboard (`/admin`)**:
   - Protected by **Supabase Authentication**.
   - Overview statistic cards (Daily/Weekly/Monthly traffic, CV downloads, Form submissions, avg session length, returning rate).
   - Dynamic charts using **Chart.js** (traffic lines, device breakdowns, OS, browser distributions, top clicked projects, countries, and cities).
   - Paginated, sortable, and filterable visitor log list.
   - Chronological timelines mapping a visitor's exact path (page views, projects, downloads, contact submits).
   - Hot updates via **Supabase Realtime WebSockets**!

---

## Project Structure

```
├── admin/
│   ├── index.html        # Admin dashboard structure
│   ├── admin.css         # Styling for the dark dashboard UI
│   └── admin.js          # Chart.js renders, Supabase Auth & Realtime logic
├── api/
│   ├── config.js         # Safe serverless config exposure route
│   └── track.js          # Geolocation resolver, session logger, Nodemailer alert dispatcher
├── index.html            # Main portfolio layout with double-synced navigation and trackers
├── styles.css            # Portfolio styles & mobile media query overrides
├── script.js             # Projects dynamic render, theme toggle, and click interceptors
├── analytics.js          # Session creator, heartbeat loops, and Clarity dynamic loader
├── package.json          # Serverless package dependencies (Supabase, UAParser, Nodemailer)
├── resume.pdf            # CV download placeholder file (overwrite with your real PDF)
└── supabase_schema.sql   # Database setup commands
```

---

## Environment Variables Required (Vercel)

Add these variables under your Vercel project Settings:

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Public anon API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Private database bypass key (keep secret) |
| `SMTP_USER` | Your Gmail address (to send alerts) |
| `SMTP_PASS` | Google 16-character App Password (not your main password) |
| `SMTP_HOST` | Defaults to `smtp.gmail.com` |
| `SMTP_PORT` | Defaults to `587` |
| `NOTIFICATION_EMAIL` | Destination address for alerts (usually same as SMTP_USER) |
| `CLARITY_PROJECT_ID` | (Optional) Microsoft Clarity Project ID |

---

## Setup & Deployment Guide

### 1. Database Configuration
- Create a free project at [supabase.com](https://supabase.com).
- Go to the **SQL Editor** tab, paste the contents of `supabase_schema.sql`, and click **Run**.
- Go to **Authentication** -> **Users** -> **Add User** -> **Create User**. Enter your admin email/password, check the **Auto-confirm user** box, and click Save.

### 2. Gmail App Password Configuration
- Open your Google Account settings -> Security -> Turn ON **2-Step Verification**.
- Click **App passwords** (at the bottom of 2-Step Verification options).
- Create an app (e.g. `Portfolio Analytics`) and copy the 16-letter code. Add it as `SMTP_PASS` in Vercel.

### 3. Deploy to Vercel
- Import your repository to Vercel.
- Configure all environment variables listed above.
- Deploy the project. Note: If you set the environment variables *after* the initial automatic deployment, go to the **Deployments** tab and click **Redeploy** to apply them.

### 4. Running Locally
Because this project utilizes Serverless APIs, you can test the frontend static files locally by starting a local HTTP server:
```bash
# Python
python -m http.server 8000
```
Then visit `http://localhost:8000`. To test APIs locally, you can use the Vercel CLI (`vercel dev`).

---

## Testing Features
- **Visitor logs**: Load your page in an incognito window, check the `visitors` table in Supabase, and check your email inbox.
- **Timeline tracking**: Click some projects and download the CV. Open `/admin`, log in, select the session row, and verify that the timeline accurately traces your actions.
