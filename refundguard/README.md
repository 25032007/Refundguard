# RefundGuard

**RefundGuard** is an explainable AI Risk Manager that detects coordinated refund-abuse rings using a combination of:

- **Identity signals** – e.g., shared account/device/payment attributes
- **Behavioral signals** – e.g., refund request patterns over time
- **Complaint text similarity** – semantic closeness of complaint narratives
- **Graph-based ring detection** – discovering clusters of linked entities

> **Note:** RefundGuard is **not** a payment gateway. It is an investigation dashboard for risk analysts to surface and explore suspected refund-abuse rings.

> **Status:** Data foundation is in place: Mongoose models and a deterministic synthetic dataset generator are implemented. The risk engine, graph, ring detection, scoring, and metrics are intentionally **not** implemented yet and will be added in later phases.

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
│   ├── generate.js     # Deterministic synthetic data generator
│   ├── validate.js     # Cross-reference validation of generated data
│   ├── raw/            # Generated JSON datasets
│   └── processed/      # Processed/normalized data (to be added later)
│
├── risk-engine/        # Risk engine (to be implemented later)
│
├── backend/
│   ├── server.js       # Express entry point
│   ├── seed.js         # Mongoose database seeding script
│   ├── config/         # Connection/config modules
│   ├── routes/         # API route definitions
│   ├── controllers/    # Request handlers
│   ├── models/         # Mongoose models (Customer, Device, Transaction, Refund, Complaint, RefundRing)
│   └── services/       # Business/service logic
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/ # Sidebar, Header, Layout
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

Then set `MONGO_URI` (and optionally `PORT`) to your MongoDB connection string.

### 3. Run the whole stack

```bash
npm run dev
```

This starts both the backend (Express, default `http://localhost:5000`) and the frontend (Vite, default `http://localhost:5173`) concurrently.

### Run individually

```bash
npm run dev --prefix backend    # Express API
npm run dev --prefix frontend   # Vite dev server
```

---

## Local Development Data

RefundGuard ships a deterministic synthetic dataset generator plus a Mongoose
seed script. Use the root-level commands:

```bash
# Generate reproducible synthetic data into data/raw/
npm run data:generate

# Validate cross-references between generated entities
npm run data:validate

# Load the generated data into MongoDB (requires backend/.env with MONGO_URI)
npm run db:seed
```

The generator is seeded with a fixed value, so repeated executions produce
byte-identical output. It creates ~100 customers, ~180 devices, ~520
transactions, ~240 refunds, and ~150 complaints. Six of the generated customer
clusters deliberately share IP addresses, devices, similar complaint wording,
and refund behavior so the future risk engine has structure to find. **No risk
scores are assigned.**

The app itself does **not** require MongoDB to run: the API server starts
(and `/api/v1/health` responds) even when MongoDB is unavailable. Only
`db:seed` and future database-backed features need a running MongoDB.

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

Implemented so far:

1. Project foundation (frontend + backend + data scaffolding)
2. Backend foundation (Express API, `/api/v1/health`, error handling, nonfatal Mongo connect)
3. Frontend investigation-console UI (Layout / Sidebar / Header + placeholder pages)
4. Data foundation (Mongoose models + deterministic synthetic generator + seed script)

Planned future work (not yet implemented):

1. Risk engine (identity / behavioral signals, complaint similarity via `natural`)
2. Graph construction & ring detection (`graphlib`)
3. Risk scoring & metrics
4. Investigation dashboard features (API integration, visualization via `react-force-graph-2d`)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design.
