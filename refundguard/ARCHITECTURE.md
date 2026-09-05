# RefundGuard Architecture

This document describes the high-level architecture of RefundGuard. It focuses on the *layers* and *system boundaries* and intentionally does **not** invent implementation details. The exact algorithms, schemas, and data pipelines will be defined in later phases.

---

## Overview

RefundGuard is a web application that helps risk analysts investigate **coordinated refund-abuse rings**. It is composed of three primary runtime components plus a database:

![Component overview]

```
┌────────────────────────────┐
│        Frontend            │   React + Vite (investigation dashboard)
└────────────┬───────────────┘
             │  HTTP / JSON
┌────────────▼───────────────┐
│        Backend             │   Node.js + Express (REST API, /api/v1)
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│      Risk Engine           │   Detection & scoring logic (future)
└────────────┬───────────────┘
             │
┌────────────▼───────────────┐
│        Database            │   MongoDB (Mongoose) - raw & processed data
└────────────────────────────┘
```

---

## Frontend

- **Framework:** React, built with Vite.
- **Routing:** React Router (client-side routes for Dashboard, Ring List, Ring Detail, and Metrics).
- **Data access:** HTTP client (`axios`) to call the backend REST API.
- **Visualization:** `react-force-graph-2d` is a dependency intended for graph/ring visualization in later phases.
- **Role:** The investigation dashboard for risk analysts. It surfaces rings, their members, evidence, and supporting metrics.

---

## Backend

- **Runtime:** Node.js + Express.
- **API versioning:** Routes are namespaced under `/api/v1`.
- **Cross-origin:** CORS enabled to allow the Vite dev server to call the API during development.
- **Configuration:** Environment variables loaded via `dotenv` (e.g., MongoDB connection URI, port).
- **Layering (per directory):**
  - `routes/` – URL-to-handler mapping.
  - `controllers/` – Request handling and response shaping.
  - `services/` – Business logic and orchestration.
  - `models/` – Mongoose schemas (to be added later).
- **Purpose:** Expose a stable, versioned API that the frontend consumes and that wraps the risk engine and database.

---

## Risk Engine

- **Location:** `risk-engine/` directory.
- **Status:** Not yet implemented.
- **Intended responsibilities (future):**
  - Compose **identity signal**, **behavioral signal**, and **complaint text similarity** features.
  - Build graphs of related entities and run **ring detection**.
  - Produce **risk scores** and **explanations** for analysts.
- **Relation to backend:** The backend is expected to invoke the risk engine to obtain detection/scoring results; the exact interface (in-process module vs. wrapped service) is to be decided.

---

## Database

- **Engine:** MongoDB.
- **ODM:** Mongoose for schema definition and querying.
- **Storage areas:**
  - Raw input data (ingested into `data/raw`).
  - Processed / normalized data (written to `data/processed`).
- **Status:** Mongoose models are implemented for `Customer`, `Device`, `Transaction`, `Refund`, `Complaint`, and `RefundRing`. The `RefundRing` model exists as the future investigation container (risk fields present, not yet computed).

### Data Layer

The data foundation models the core entities the risk engine will analyze. Relationships use string IDs/references rather than embedded duplicate objects, so the future graph layer can link across entities by shared identifiers.

```text
Customers
   │
   ├── Transactions ──┐
   │                  ├── Refunds
   │                  │
   ├── Devices        │
   ├── Complaints ────┘  (refundId → Refund; orderId → Order)
   │
   └── Order metadata (orders.json)
```

- **Customer** — identity anchor (`customerId`, name, email, phone, status). Can own many transactions, refunds, devices, and complaints.
- **Device** — device profile (`deviceId`, primary owning `customerId`, type/os/browser, seen timestamps). A device may be referenced from transactions across customers, enabling shared-device signals.
- **Transaction** — payment event (`transactionId`, `customerId`, `orderId`, amount, currency, payment method, `deviceId`, `ipAddress`, status). IP addresses and device IDs are deliberately repeated across records so shared-`ipAddress`/`deviceId` signals are discoverable.
- **Refund** — refund case (`refundId`, `transactionId`, `customerId`, `orderId`, amount, reason, status, request/process times).
- **Complaint** — free-text complaint (`complaintId`, `customerId`, `orderId`, optional `refundId`, text, category, status). Text serves the future NLP similarity layer.
- **RefundRing** — future investigation container (`ringId`, member ID arrays, `riskScore`, `riskLevel`, `status`). Fields exist but are **not** populated by the data foundation.

Synthetic development data (`data/generate.js`) produces ~100 normal customers plus 6 coordinated clusters that share IPs, devices, similar complaint wording, and refund behavior — giving the future risk engine realistic structure to discover. No risk values are assigned.

---

## Data Flow

1. **Ingest:** Raw refund/transaction/complaint data is collected into `data/raw`.
2. **Process:** Data is normalized and written to `data/processed`.
3. **Store:** Processed data is persisted to MongoDB via Mongoose models.
4. **Analyze:** The risk engine computes features, builds graphs, and detects rings.
5. **Serve:** The backend exposes results via the versioned REST API (`/api/v1`).
6. **Investigate:** The frontend dashboard fetches and visualizes rings, members, evidence, and metrics.

---

## API Versioning

All endpoints are prefixed with `/api/v1` to allow future breaking changes without disrupting clients.

| Method | Endpoint            | Purpose                |
| ------ | ------------------- | ---------------------- |
| GET    | `/api/v1/health`    | Service health check   |

---

## Non-Goals (current foundation)

- No payment processing.
- No risk engine implementation yet.
- No graph / ring detection / scoring / metrics yet.
- No risk values assigned to synthetic data (by design).

Risk scoring, graph construction, ring detection, similarity scoring, and metrics are intentionally deferred and will be built on top of this data foundation.
