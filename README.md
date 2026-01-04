# E-Library Management System

A modern Library Management System built with a Go backend (Gin), React frontend (Vite), and a Sharded MongoDB Cluster.

## 🚀 Prerequisites

-   **Go**: v1.19 or newer
-   **Node.js**: v18 or newer
-   **Docker & Docker Compose**: For running the database cluster.

## 🛠️ Installation & Setup (Docker Recommended)

The project now uses a **Unified Docker Compose** setup. You can start the entire system (Database + Backend + Frontend) with a single command.

### 🚀 One-Click Start

Run the following command in the project root:

```bash
docker-compose up -d
```

> **Note**: The first run will take a few minutes to:
> 1. Initialize the MongoDB Sharded Cluster (Config servers, Shards).
> 2. Build the Backend (Go) and Frontend (React) images.
> 3. Wait for `mongos1` (Router) to become healthy before starting the backend.

### Verify Running Services

-   **Frontend**: [http://localhost:5173](http://localhost:5173)
-   **Backend API**: [http://localhost:8081](http://localhost:8081)
-   **Database Cluster**: 
    -   Router (mongos): `localhost:27020`
    -   Shard 1 (City): `localhost:27017`

No manual configuration needed. The unified network ensures backend can resolve `mongos1` automatically.

---

## 🛠️ Manual Setup (Alternative)

If you prefer running services locally (e.g. for debugging):

### 1. Database (Required)
You still need the database running via Docker.
```bash
cd deploy && docker-compose up -d
```

### 2. Backend (Go)
```bash
cd server
go mod tidy
# Connect to local shard if router is not exposed/ready
export MONGO_URI="mongodb://localhost:27017/?directConnection=true"
go run main.go
```
(Server typically runs on **:8081** in manual mode to avoid conflicts)

### 3. Frontend (React)
```bash
cd client
npm install
npm run dev
```

## 🧪 Testing

There are Python test scripts available in the `tests/` directory to verify API functionality.

```bash
# Example: Test Analytics API
python3 tests/test_stats_api.py
```

## ⚠️ Troubleshooting

1.  **Backend Port Conflict**:
    -   The server is configured to run on port `8081` to avoid conflicts with common services on `8080`.
    -   If you need to change this, update `server/main.go` AND `client/src/api/axios.js`.

2.  **Database Connection Failed**:
    -   Ensure Docker containers are running: `docker ps`.
    -   If `mongos` (router) at port `27020` is down, use the direct connection to Shard 1 as shown in the Backend Setup commands (`mongodb://localhost:27017/?directConnection=true`).

3.  **Frontend Charts Not Loading**:
    -   Ensure `npm install recharts` was successful.
    -   Reload the page if you see "Failed to resolve import".

## 📚 Project Structure

-   `/server`: Go Backend (Controllers, Models, Middleware).
-   `/client`: React Frontend (Pages, Components, Context).
-   `/deploy`: Docker Compose for MongoDB Infrastructure.
-   `/tests`: Python API verification scripts.

---

# 🌍 Production Deployment Guide

This guide explains how to deploy the E-Library system to a production server (Linux/VPS).

## 1. Preparation

Ensure your server has **Docker** and **Docker Compose** installed.

## 2. Infrastructure (Database)

We keep the database infrastructure separate to manage its lifecycle independently (data persistence is critical).

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd elib

# 2. Start the Database Cluster
cd deploy
docker-compose up -d

# 3. Verify it's healthy
docker ps
# Ensure mongos1, config servers, and shards are "healthy"
```

## 3. Application Deployment

For production, we should proper Docker images (not hot-reload dev versions).

### Option A: Quick & Simple (Using existing Dev setup)

If you just want to run it quickly:
```bash
# Return to root
cd ..

# Start the App
docker-compose -f docker-compose.app.yml up -d --build
```
*Note: This runs the "Dev" versions (Air watcher, Vite dev server). Not optimized for performance but works.*

### Option B: Professional Production Setup (Recommended)

Create a `docker-compose.prod.yml` that builds optimized images.

1.  **Frontend**: Build React to static HTML/CSS/JS and serve with Nginx.
2.  **Backend**: Compile Go binary and run in a minimal Alpine container.

**Example `docker-compose.prod.yml`:**
```yaml
version: '3.8'

services:
  server:
    build:
      context: ./server
      dockerfile: Dockerfile  # Create a multi-stage Dockerfile
    ports:
      - "8080:8080"
    environment:
      - MONGO_URI=mongodb://mongos1:27020
      - GIN_MODE=release
    networks:
      - elib

  client:
    build:
      context: ./client
      dockerfile: Dockerfile # Nginx build
    ports:
      - "80:80"
    networks:
      - elib

networks:
  elib:
    external: true
    name: elibrary-mongo_elib-net
```

## 4. Troubleshooting Connection

If the application cannot connect to the database (`dial tcp: lookup mongos1...`), ensure:

1.  **Network Name**: The `external: name:` in your compose file must match the actual network name created by the database stack.
    -   Check with: `docker network ls`
    -   If it's named `deploy_default`, update your app compose file.

2.  **Startup Order**: Start the Database stack *minutes* before the App stack to allow the Sharded Cluster to elect primaries.
