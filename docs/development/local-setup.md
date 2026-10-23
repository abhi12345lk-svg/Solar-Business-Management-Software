# INS Solar Business Management Software — Local Developer Setup Guide

**Document Reference:** `INS-DEV-LOC-001`  
**Version:** `1.0.0`  
**Target Environment:** Node.js 24 LTS / npm 11+ / Windows, macOS & Linux  

---

## 1. Prerequisites

Before setting up the project locally, verify that your workstation has the required long-term support (LTS) runtimes installed:

*   **Node.js:** Supported LTS release: `v24.11.1+` (minimum `v20.18.0+`)
*   **npm:** `v11.0.0+`
*   **Git:** `v2.40.0+`
*   **Terminal:** PowerShell (Windows), zsh (macOS), or bash (Linux)

Verify versions in your terminal:
```bash
node -v
npm -v
git --version
```

---

## 2. Repository Cloning & Dependency Installation

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url> "Solar Business Management Software"
    cd "Solar Business Management Software"
    ```

2.  **Install Workspace Dependencies:**  
    The project utilizes standard **npm workspaces** managing `packages/shared`, `apps/api`, and `apps/web` concurrently:
    ```bash
    npm install
    ```
    This single command automatically resolves, links, and builds symlinks between packages.

---

## 3. Environment Configuration

1.  **Copy Environment Template:**  
    At the root of the repository, copy the provided `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```

2.  **Inspect Environment Variables:**
    ```dotenv
    # Application Environment
    NODE_ENV=development

    # API Server Configuration
    PORT=4000
    API_PREFIX=/api/v1
    CORS_ORIGIN=http://localhost:5173

    # Logging Level ('fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace')
    LOG_LEVEL=debug

    # MongoDB Atlas Connection String
    # Optional in local dev: if omitted or unreachable, API operates in degraded offline mode.
    MONGODB_URI=mongodb://localhost:27017/ins_solar_dev

    # Session Secret (min 16 chars in dev, min 32 chars in production)
    SESSION_SECRET=development-session-secret-min-16-characters

    # Web Client Configuration (Vite)
    VITE_API_BASE_URL=http://localhost:4000/api/v1
    ```

> [!WARNING]
> **Security Reminder:** Never commit `.env` or files containing real secrets, database passwords, or storage keys to source control. Only `.env.example` with safe placeholder tokens is committed.

---

## 4. Development Workflow & Commands

All development commands are executed from the **repository root**:

| Command | Action | Description |
| :--- | :--- | :--- |
| `npm run dev` | Run All Apps | Starts both `@ins-solar/api` and `@ins-solar/web` concurrently in development mode. |
| `npm run dev:api` | Run Backend Only | Starts Express 5 API server on `http://localhost:4000` with `tsx` hot-reloading. |
| `npm run dev:web` | Run Frontend Only | Starts Vite React dev server on `http://localhost:5173` with instant HMR. |

Once launched:
*   **Frontend UI:** Open [http://localhost:5173](http://localhost:5173) in your browser.
*   **Backend API Gateway:** Access endpoints under [http://localhost:4000/api/v1](http://localhost:4000/api/v1).

---

## 5. Testing & Quality Verification

Run automated test suites and static checks from the root:

| Command | Target | Scope |
| :--- | :--- | :--- |
| `npm run test` | All Workspaces | Runs unit and API tests across `@ins-solar/shared`, `@ins-solar/api`, and `@ins-solar/web`. |
| `npm run test:api` | Backend API | Runs Supertest integration tests for health checks, error envelopes, and correlation IDs. |
| `npm run test:unit` | Shared & Web | Runs schema validations and React shell render tests with Vitest. |
| `npm run typecheck` | Strict TypeScript | Executes `tsc --noEmit` across all workspaces to guarantee type safety. |
| `npm run build` | Production Build | Builds `@ins-solar/shared`, compiles `@ins-solar/api`, and creates Vite production bundle for `@ins-solar/web`. |
| `npm run ci` | Full Pipeline | Executes type checking, testing, and production build sequentially. |

---

## 6. Health & Telemetry Probes

The backend exposes two standardized monitoring endpoints under `/api/v1/health`:

### 6.1 Process Liveness Probe
```bash
curl -i http://localhost:4000/api/v1/health/live
```
**Expected HTTP 200 Response:**
```json
{
  "success": true,
  "data": {
    "status": "alive",
    "uptimeSeconds": 42,
    "timestamp": "2026-10-23T07:15:00.000Z"
  },
  "meta": {
    "timestamp": "2026-10-23T07:15:00.000Z",
    "correlationId": "4c21-4f9e-bc3d-5e8a"
  }
}
```

### 6.2 System Readiness Probe
```bash
curl -i http://localhost:4000/api/v1/health/ready
```
*   **Database Connected:** Returns `HTTP 200 OK` with `status: "ready"`, `database: "connected"`.
*   **Database Unconfigured (Local Dev):** Returns `HTTP 200 OK` with `status: "degraded"`, `database: "unconfigured"`.
*   **Database Unreachable:** Returns `HTTP 503 Service Unavailable` with `status: "unhealthy"`, `database: "disconnected"`.

> [!NOTE]
> Health endpoints never leak environment variables, connection credentials, or internal stack traces.

---

## 7. MongoDB Atlas Configuration (Optional for Local Dev)

For developers connecting to a real MongoDB Atlas cloud cluster:

1.  Log in to [MongoDB Atlas Console](https://cloud.mongodb.com).
2.  Create a Free Shared Cluster (`M0 Sandbox` tier).
3.  Under **Security $\rightarrow$ Database Access**, add a database user with `readWriteAnyDatabase` privileges.
4.  Under **Security $\rightarrow$ Network Access**, whitelist your IP address or add `0.0.0.0/0` (for testing only).
5.  Click **Connect $\rightarrow$ Drivers (Node.js)** and copy your connection string:
    ```
    mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/ins_solar_dev?retryWrites=true&w=majority
    ```
6.  Paste into your local `.env` file as `MONGODB_URI`.
7.  Restart the API server via `npm run dev:api`. The readiness probe will report `database: "connected"`.

---

## 8. Troubleshooting & Common Issues

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `EADDRINUSE: address already in use :::4000` | Another process is occupying port 4000. | Change `PORT=4001` in `.env` or terminate the lingering Node process. |
| `Invalid environment configuration` on startup | Required env variables failed Zod schema parsing. | Check console error output; verify `PORT` is between 1024–65535 and `SESSION_SECRET` $\ge$ 16 characters. |
| `Status: degraded, database: unconfigured` | `MONGODB_URI` is commented out or empty in `.env`. | This is expected behavior during offline development. Provide a valid MongoDB URI to connect. |
| TypeScript errors on shared package import | Shared package types have not been linked. | Run `npm install` from the repository root to ensure npm workspace symlinks are active. |
