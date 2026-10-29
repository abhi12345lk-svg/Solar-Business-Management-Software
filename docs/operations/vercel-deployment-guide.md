# INS Solar ERP — Vercel Production Deployment Guide

**Document Reference:** `INS-OPS-VERCEL-001`  
**Target Platform:** [Vercel](https://vercel.com) (Frontend CDN & Serverless API Monorepo)  
**Status:** Ready for One-Click Deployment  

---

## 1. Architecture on Vercel

The INS Solar Business Management Software is optimized for Vercel's global Edge Network:
* **Frontend (`apps/web`):** React 18, Vite, and Tailwind CSS SPA deployed to Vercel's Global CDN with automated asset hashing, gzip/brotli compression, and seamless Single-Page Application (SPA) client-side routing.
* **API Handler (`api/index.ts`):** Express 5 modular backend running as an auto-scaling Vercel Serverless Function with cached MongoDB Atlas connection pooling.
* **Routing (`vercel.json`):** Directs `/api/*` traffic to the serverless backend and rewrites all frontend routes (`/leads`, `/projects`, `/quotations`, etc.) to `/index.html` to eliminate 404 errors on page reload.

---

## 2. Step-by-Step Vercel Deployment

### Step 1: Push latest changes to GitHub
Ensure your repository is up-to-date on GitHub:
```bash
git push origin main
```

### Step 2: Connect GitHub Repository to Vercel
1. Open [vercel.com](https://vercel.com) and sign in.
2. Click **"Add New..."** > **"Project"**.
3. Select your GitHub repository: `Solar-Business-Management-Software`.

### Step 3: Configure Build & Output Settings
Vercel will detect the repository settings automatically from `vercel.json`. Verify the following fields:
* **Framework Preset:** `Vite`
* **Root Directory:** `./` (Leave as default monorepo root)
* **Build Command:** `npm run build`
* **Output Directory:** `apps/web/dist`
* **Install Command:** `npm install`

### Step 4: Configure Environment Variables
In the Vercel project setup screen, expand the **Environment Variables** section and add the following:

| Variable Name | Example / Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `MONGODB_URI` | `mongodb+srv://<user>:<password>@cluster0.mongodb.net/ins_solar_prod?retryWrites=true&w=majority` | MongoDB Atlas cluster connection string |
| `SESSION_SECRET` | *(Random 32+ character string)* | Secret for HttpOnly session cookie encryption |
| `MFA_ENCRYPTION_KEY` | *(Random 32-byte / 64 hex character string)* | Encryption key for TOTP secrets |
| `CSRF_SECRET` | *(Random 32+ character string)* | Anti-CSRF double-submit token secret |
| `CORS_ORIGIN` | `https://your-project-name.vercel.app` | Allowed CORS origin (can also include comma-separated custom domains) |
| `STORAGE_PROVIDER` | `simulated` or `s3` | Set `s3` if AWS S3 bucket is configured; otherwise `simulated` for dev/demo |
| `TRUST_PROXY` | `1` | Reverse proxy trust level |

*(Optional AWS S3 credentials if using `STORAGE_PROVIDER=s3`:)*
* `AWS_REGION=ap-south-1`
* `AWS_S3_BUCKET=your-bucket-name`
* `AWS_ACCESS_KEY_ID=AKIA...`
* `AWS_SECRET_ACCESS_KEY=...`

*(Optional External API URL if hosting backend separately on Render/Railway/VPS:)*
* `VITE_API_BASE_URL=https://api.yourdomain.com/api/v1`

### Step 5: Click "Deploy"
1. Click the **"Deploy"** button.
2. Vercel will install dependencies, compile the shared packages, build the Vite frontend, and package the serverless API.
3. Once the build completes (typically 60-90 seconds), you will receive your live URL: `https://<your-project>.vercel.app`.

---

## 3. Creating the First Superadmin on Live Database

Once deployed, create the first superadministrator user on your MongoDB Atlas database:
1. In your local terminal, point `MONGODB_URI` to your live Atlas database:
   ```bash
   npm run bootstrap:admin
   ```
2. Or use the demo seed script to initialize demo solar records:
   ```bash
   npm run seed:demo
   ```
3. Log into your live Vercel URL using `admin@inssolar.com` / `SolarAdmin2026!`.

---

## 4. Background Queue Worker Daemon Note

Vercel Serverless Functions execute ephemerally per HTTP request. For long-running asynchronous background daemons (such as the persistent MongoDB Job Queue in `apps/api/src/worker.ts` for reminder dispatches):
* **Option A (Recommended for production):** Deploy `apps/api/src/worker.ts` as a persistent background worker on Render, Railway, Fly.io, or any inexpensive Linux VPS using `npm run worker`.
* **Option B (Vercel Cron):** Use Vercel Cron Jobs to trigger periodic maintenance endpoints.
