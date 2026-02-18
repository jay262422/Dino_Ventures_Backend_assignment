# Deploy to Render (Free Tier)

Follow these steps to deploy the Wallet Service to Render and get a live URL for the assignment.

## Prerequisites

- GitHub account
- Render account (free at [render.com](https://render.com))
- Code pushed to a GitHub repository

## Option A: Blueprint (One-Click)

1. Push your code to GitHub.

2. Go to [Render Dashboard](https://dashboard.render.com/) → **New** → **Blueprint**.

3. Connect your GitHub account and select the repository.

4. Render will detect `render.yaml` and show the planned resources:
   - PostgreSQL database (wallet-db)
   - Web service (wallet-service)

5. Click **Apply** to create and deploy.

6. Wait for the build and deploy to finish (~3–5 min).

7. Copy your live URL (e.g. `https://wallet-service-xxxx.onrender.com`).

---

## Option B: Manual Setup

1. **Create PostgreSQL database**
   - Dashboard → **New** → **PostgreSQL**
   - Name: `wallet-db`
   - Plan: Free
   - Create

2. **Create Web Service**
   - Dashboard → **New** → **Web Service**
   - Connect your GitHub repo
   - Configure:
     - **Name:** wallet-service
     - **Runtime:** Node
     - **Build Command:** `npm install && npm run build`
     - **Start Command:** `npm run deploy:start`
     - **Environment:**
       - `DATABASE_URL` — Copy from your PostgreSQL instance (Connection String / Internal URL)
       - `NODE_ENV` = `production`

3. **Deploy** and wait for the build.

4. Run migration and seed manually (one time) via Render Shell:
   - Open your web service → **Shell** tab
   - Run: `node dist/db/migrate.js && node dist/db/seed.js`
   - Or: if using `deploy:start`, they run automatically on each deploy.

---

## After Deployment

- **API base:** `https://your-app.onrender.com`
- **Demo UI:** `https://your-app.onrender.com/`
- **Health check:** `https://your-app.onrender.com/health`

Add the live URL to your README for the assignment submission.

**Note:** On the free tier:
- The web service may sleep after ~15 minutes of inactivity. The first request after sleep can take 30–60 seconds to respond.
- Free PostgreSQL instances expire after 30 days. For assignment review, this is sufficient; you can upgrade to a paid plan if needed for longer use.
