# E-Library Management System

A modern Library Management System built with a Go backend (Gin), React frontend (Vite), and a Sharded MongoDB Cluster.

## 🚀 Prerequisites

-   **Go**: v1.19 or newer
-   **Node.js**: v18 or newer
-   **Docker & Docker Compose**: For running the database cluster.

## 🛠️ Installation & Setup

### 1. Database Setup (MongoDB Sharded Cluster)

The database runs in Docker containers mimicking a real-world sharded environment (Config Servers, Shards, Router).

```bash
cd deploy
docker-compose up -d
```

> **Wait for initialization**: It may take 1-2 minutes for the replica sets and sharding to initiate completely. You can check status with `docker ps`.

### 2. Backend Setup (Go)

The backend API server runs on **Port 8081**.

```bash
cd server

# Install dependencies
go mod tidy

# Run the server
# Note: connect directly to shard if router (mongos) is unavailable
export MONGO_URI="mongodb://localhost:27017/?directConnection=true"
go run main.go
```

*Expected Output:*
```
...
MongoDB Connected Successfully
[GIN-debug] Listening and serving HTTP on :8081
```

### 3. Frontend Setup (React)

The frontend development server runs on **Port 5173**.

```bash
cd client

# Install dependencies
npm install

# Start Dev Server
npm run dev
```

OPEN [http://localhost:5173](http://localhost:5173) to view the app.

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
