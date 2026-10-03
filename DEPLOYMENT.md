# 🚀 Deployment Guide: Team Reward Tracker (Free Tier, Single Service)

This guide walks you through deploying the **Team Reward Tracker** as a single, unified web service on Render's free tier from a GitHub repository, and setting up **UptimeRobot** to keep it active 24/7.

---

## 🏗️ Architecture Summary

- **Single Service, Single URL**: FastAPI serves both the REST API / Server-Sent Events (under `/api`) and the pre-built React (Vite) production bundle.
- **Zero CORS Issues**: Because the frontend and backend share the exact same origin, no cross-origin configurations or preflight requests are required.
- **Wiped-Disk Ephemeral Resilience**: Render free tier containers feature ephemeral filesystems. On startup:
  1. Missing SQLite tables are automatically created.
  2. If the database is empty, initial team members are seeded (via `INITIAL_MEMBERS` or default team list).
  3. A full background sync immediately queries the live Gradio space, rebuilding all snapshot and subject data within 60 seconds.
- **Uptime Monitoring**: A dedicated `GET /health` endpoint returns `200 OK` instantly, allowing external heartbeat pingers to prevent the container from sleeping.

---

## 📋 Prerequisites

1. A [GitHub](https://github.com) account with this repository pushed.
2. A free [Render.com](https://render.com) account.
3. A free [UptimeRobot.com](https://uptimerobot.com) account.

---

## 🐳 Step 1: Push Code to GitHub

Ensure all changes including the `Dockerfile`, `.dockerignore`, and backend static routing are committed and pushed:

```bash
git add .
git commit -m "Configure single-service deployment with Dockerfile, health check, and SPA serving"
git push origin main
```

---

## 🌐 Step 2: Deploy to Render (Free Web Service)

1. **Log in to Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) and log in.

2. **Create New Web Service**:
   - Click the blue **"New +"** button in the top right.
   - Select **"Web Service"**.

3. **Connect Your GitHub Repository**:
   - Select **"Build and deploy from a Git repository"** and click **Next**.
   - Under **Connect a repository**, find your repository and click **Connect**.
   *(If your repo isn't visible, click "Configure access" on GitHub to grant Render permissions).*

4. **Configure Service Settings**:
   - **Name**: `team-reward-tracker` *(or any unique name you prefer)*
   - **Region**: Choose the closest region to you (e.g. *Singapore*, *Frankfurt*, *Oregon*)
   - **Branch**: `main`
   - **Root Directory**: Leave blank *(project root contains Dockerfile)*
   - **Language / Runtime**: Select **`Docker`**
     *(Render will automatically detect the root `Dockerfile` and use multi-stage builds)*
   - **Instance Type**: Select **`Free`** (0.1 CPU, 512 MB RAM)

5. **Set Environment Variables**:
   Scroll down to the **Environment Variables** section and add the following keys:

   | Key | Example Value | Description |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` | **Recommended**: Free PostgreSQL connection string (from Neon or Supabase) for **100% permanent data storage** |
   | `CAPTAIN_PASSWORD` | `captain2026` | Password required for captain login |
   | `SECRET_KEY` | `team-reward-tracker-super-secret-key-3.14` | Secret key used for JWT session tokens |
   | `GRADIO_SPACE` | `PraneshJs/RewardPointsSite` | *(Optional)* Upstream Gradio space name |
   | `POLL_INTERVAL_MINUTES` | `5` | *(Optional)* Background polling interval |
   | `INITIAL_MEMBERS` | `7376231CS101:AAMINA A, 7376241CS106:ABINANDHAN K` | *(Optional)* Custom team members to seed if database is empty |

   > **Note on Port**: Render automatically injects the `PORT` environment variable (typically `10000`). The Dockerfile dynamically binds Uvicorn to `0.0.0.0:${PORT:-8000}`, so no manual port configuration is needed.

6. **Deploy**:
   - Click **"Create Web Service"** at the bottom.
   - Render will build the Vite frontend, build the Python backend runtime image, and start the container.
   - Watch the deployment logs:
     - `✓ built in ~2s` (Vite frontend build)
     - `Application startup complete`
     - `Uvicorn running on http://0.0.0.0:10000`
     - `Startup sync: Immediately fetching full data for all members...`
   - Once finished, you will see a green checkmark with **"Live"**.
   - Your public URL will look like:
     **`https://team-reward-tracker.onrender.com`**

---

## ⏰ Step 3: Set Up UptimeRobot (Keep Service Awake)

Render's free tier spins down Web Services after **15 minutes of inactivity**. When a new visitor arrives, it can take 30–50 seconds for the free instance to spin back up. 

By having **UptimeRobot** ping `/health` every 5–10 minutes, your service stays awake and ready.

1. **Log in to UptimeRobot**:
   - Go to [uptimerobot.com](https://uptimerobot.com/) and log in (or sign up for free).

2. **Add New Monitor**:
   - Click **"+ Add New Monitor"** on the dashboard.

3. **Fill in Monitor Details**:
   - **Monitor Type**: Select **`HTTP(s)`**
   - **Friendly Name**: `Team Reward Tracker Health`
   - **URL (or IP)**: Enter your Render URL with `/health`:
     ```
     https://team-reward-tracker.onrender.com/health
     ```
     *(Replace `team-reward-tracker` with your actual Render service name)*
   - **Monitoring Interval**: Set to **`Every 5 minutes`** (or 10 minutes)
   - **Monitor Timeout**: `30 seconds`
   - **Alert Contacts To Notify**: Check your email box to receive alerts if downstream issues arise.

4. **Save Monitor**:
   - Click **"Create Monitor"**.
   - Within 1–2 minutes, UptimeRobot will make its first request to `/health`, receive `200 OK`, and show a green **Up** badge!

---

## 💻 Optional: Local Docker Verification

To build and run the production container locally on your machine before deploying:

```bash
# 1. Build the Docker image
docker build -t reward-tracker .

# 2. Run the container
docker run -p 8000:8000 \
  -e CAPTAIN_PASSWORD=captain2026 \
  -e DB_PATH=/app/backend/tracker.db \
  reward-tracker

# 3. Access in browser
# App UI & API: http://localhost:8000
# Health Check: http://localhost:8000/health
```

---

## 🔍 Verification Checklist

- [x] Visiting `https://<your-app>.onrender.com/` loads the React dashboard.
- [x] Visiting `https://<your-app>.onrender.com/health` returns `{"status":"ok"}` with HTTP 200.
- [x] Logging in with `CAPTAIN_PASSWORD` succeeds without any CORS errors.
- [x] SSE live updates stream over `https://<your-app>.onrender.com/api/events`.
- [x] Container restart automatically creates tables, seeds team members, and completes full data sync within 1 minute.
