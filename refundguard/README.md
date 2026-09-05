# RefundGuard

**RefundGuard** is an explainable AI Risk Manager that detects coordinated refund-abuse rings using a combination of:

- **Identity signals** – e.g., shared account/device/payment attributes
- **Behavioral signals** – e.g., refund request patterns over time
- **Complaint text similarity** – semantic closeness of complaint narratives
- **Graph-based ring detection** – discovering clusters of linked entities

> **Note:** RefundGuard is **not** a payment gateway. It is an investigation dashboard for risk analysts to surface and explore suspected refund-abuse rings.

> **Status:** Foundation only. The risk engine, synthetic data, graph, ring detection, scoring, and metrics are intentionally **not** implemented yet and will be added in later phases.

---

## Folder Structure

```
refundguard/
│
├── README.md
├── ARCHITECTURE.md
├── package.json
├── .gitignore
│
├── data/
│   ├── raw/            # Raw input data (to be added later)
│   └── processed/      # Processed/normalized data (to be added later)
│
├── risk-engine/        # Risk engine (to be implemented later)
│
├── backend/
│   ├── server.js       # Express entry point
│   ├── package.json
│   ├── routes/         # API route definitions
│   ├── controllers/    # Request handlers
│   ├── models/         # Mongoose models (to be added later)
│   └── services/       # Business/service logic
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       └── pages/      # Dashboard, RingList, RingDetail, Metrics
│
└── docs/               # Additional documentation
```

---

## Installation

### Prerequisites

- **Node.js** (v18 or later recommended)
- **MongoDB** (local instance or Atlas connection string)

### 1. Install all dependencies

From the repository root:

```bash
npm run setup
```

This installs dependencies for the root, `backend/`, and `frontend/` workspaces.

> Alternatively, run `npm run install-all` for the same effect.

### 2. Configure environment variables

Backend expects a `.env` file in `backend/`. Create one:

```bash
cp backend/.env.example backend/.env
```

Then set `MONGODB_URI` (and optionally `PORT`) to your MongoDB connection string.

### 3. Run the whole stack

```bash
npm run dev
```

This starts both the backend (Express, default `http://localhost:4000`) and the frontend (Vite, default `http://localhost:5173`) concurrently.

### Run individually

```bash
npm run dev --prefix backend    # Express API
npm run dev --prefix frontend   # Vite dev server
```

---

## Tech Stack

| Layer     | Technology                                   |
| --------- | -------------------------------------------- |
| Frontend  | React, Vite, React Router                    |
| Backend   | Node.js, Express                             |
| Database  | MongoDB, Mongoose                            |
| Language  | JavaScript                                   |
| Supporting| cors, dotenv, nodemon, natural, graphlib, axios, react-force-graph-2d |

---

## Backend API

Base path: **`/api/v1`**

| Method | Endpoint              | Description                          |
| ------ | --------------------- | ------------------------------------ |
| GET    | `/api/v1/health`      | Health check, returns service status |

Example:

```json
{
  "status": "ok",
  "project": "RefundGuard"
}
```

---

## Contributing / Next Steps

Planned future work (not yet implemented):

1. Synthetic data generation (`@faker-js/faker`)
2. Database models (Mongoose)
3. Graph construction & ring detection (`graphlib`)
4. Complaint text similarity scoring (`natural`)
5. Risk scoring & metrics
6. Investigation dashboard features

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design.
