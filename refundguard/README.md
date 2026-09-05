# RefundGuard

**RefundGuard** is an explainable AI Risk Manager that detects coordinated refund-abuse rings using a combination of:

- **Identity signals** – e.g., shared account/device/payment attributes
- **Behavioral signals** – e.g., refund request patterns over time
- **Complaint text similarity** – semantic closeness of complaint narratives
- **Graph-based ring detection** – discovering clusters of linked entities

> **Note:** RefundGuard is **not** a payment gateway. It is an investigation dashboard for risk analysts to surface and explore suspected refund-abuse rings.

> **Status:** Data foundation, an explainable deterministic **Risk Signal Engine**, a deterministic **Complaint NLP & Evidence Extraction** layer, a **Graph-Based Refund Ring Detection** engine, and an **Investigation API** are in place. The engine evaluates six per-customer risk signals; the NLP layer detects similar complaint wording, reused templates, and per-customer text-based risk; the graph engine builds a heterogeneous entity graph, projects customer relationships, finds connected components, and scores refund rings — all explainable and deterministic. The Investigation Engine combines these three analyses into a single per-customer investigation exposed via the REST API. Frontend integration, interactive graph visualization, an investigation dashboard, and production polish are intentionally **not** implemented yet and will be added in later phases.

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
├── risk-engine/       # Explainable, deterministic risk signal engine
│   ├── index.js       # analyzeCustomerRisk / analyzeAllCustomers
│   ├── config.js      # All thresholds, contributions, and risk-level tiers
│   ├── run.js         # CLI runner (npm run risk:analyze)
│   ├── signals/       # One module per signal (frequency, rate, velocity, reason, IP, device)
│   ├── tests/         # Unit tests (node --test, no MongoDB required)
│   └── utils/         # dates + scoring helpers
│
├── nlp/              # Complaint NLP & evidence extraction (deterministic lexical NLP)
│   ├── index.js      # Public API (normalize / similarity / evidence / analyze)
│   ├── config.js     # Stopwords, protected tokens, thresholds, evidence vocabulary
│   ├── normalize.js  # Text normalization + tokenization
│   ├── similarity.js # Jaccard similarity + similar-pair detection
│   ├── evidence.js   # Evidence category/phrase extraction
│   ├── analyze.js    # Repeated templates + per-customer NLP contribution
│   ├── run.js        # CLI runner (npm run nlp:analyze)
│   └── tests/        # Unit tests (node --test, no MongoDB required)
│
├── graph/            # Graph-based refund ring detection (relationship intelligence)
│   ├── index.js      # analyzeRefundRings pipeline + public API
│   ├── config.js     # Node/edge/relationship types, candidate rules, score budget, bands
│   ├── buildGraph.js # Heterogeneous graph construction (nodes/edges/adjacency)
│   ├── components.js # findConnectedComponents (BFS on the customer graph)
│   ├── detectRings.js# buildCustomerGraph + detectRingCandidates
│   ├── evidence.js   # extractRingEvidence (shared resources + refund/complaint behavior)
│   ├── scoreRing.js  # scoreRing (deterministic explainable 0-100 score + signals)
│   ├── run.js        # CLI runner (npm run graph:analyze)
│   └── tests/        # Unit tests (node --test, no MongoDB required)
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
and refund behavior so the analysis layers (risk engine + complaint NLP) have
structure to find. **No risk scores are assigned.** The generator also writes Implement status: the data foundation is used by both the risk engine and the
NLP layer; the generator writes `data/raw/clusters.json` — the intended cluster
membership, used **only** for validation reporting; the analysis layers never
read it.

The app itself does **not** require MongoDB to run: the API server starts
(and `/api/v1/health` responds) even when MongoDB is unavailable. Only
`db:seed` and future database-backed features need a running MongoDB.

---

## Risk Analysis

Run the explainable risk signal engine over the generated dataset:

```bash
npm run risk:analyze
```

This analyzes all 100 customers, prints the score distribution, the top-risk
customers, a ground-truth validation comparison (suspicious clusters vs normal
customers), and a full explainability breakdown for the highest-risk customers
(severity, contribution, and evidence per signal).

Run the engine's unit tests (no MongoDB required):

```bash
npm run risk:test
```

The engine is deterministic: repeated runs over the same data produce
identical output. It is also deliberately explainable — every score is the sum
of six interpretable signals (`refund_frequency`, `refund_rate`,
`refund_velocity`, `repeated_refund_reason`, `shared_ip`, `shared_device`),
each with a severity, contribution, description, and evidence. See
[ARCHITECTURE.md](./ARCHITECTURE.md) for the signal definitions and
thresholds.

---

## Complaint NLP & Evidence Extraction

A second, independent analysis layer analyzes the free-text complaints with a
deterministic lexical NLP pipeline (no embeddings, LLMs, or ML — plain
JavaScript, fully offline):

```bash
# Analyze complaints: similar pairs, reused wording templates, evidence, per-customer risk
npm run nlp:analyze

# Run the NLP unit tests (no MongoDB required)
npm run nlp:test

# Run ALL analysis tests (risk engine + NLP)
npm test
```

What `npm run nlp:analyze` reports:

- **Similar complaint pairs** — cross-customer texts that closely match (Jaccard
  similarity over normalized tokens) with their shared tokens shown.
- **Reused wording templates** — complaint phrasings filed verbatim (or
  near-verbatim) by multiple customers, with an example text and member count.
- **Evidence-category distribution** — per-category counts (refund, delivery,
  damage, duplicate charge, quality, etc.) derived from keyword + phrase
  matching.
- **Top customers by text-based risk** — a bounded, explained 0–15 contribution
  built from template reuse and matching complaints (e.g. "3 of the customer's
  complaints closely match complaint(s) from other customers").
- **Ground-truth comparison** — like the risk engine, `data/raw/clusters.json`
  is read **only** for validation reporting; the analysis modules never use it.

The similarity threshold and every other tunable live in `nlp/config.js`.

---

## Graph-Based Refund Ring Detection

The relationship-intelligence layer builds a heterogeneous in-memory graph
(customer, device, ip, transaction, refund, complaint nodes), projects it onto
connected customers, and detects explainable refund rings:

```bash
# Build the graph, detect rings, score them, print a report
npm run graph:analyze

# Run the graph engine unit tests (no MongoDB required)
npm run graph:test

# Run ALL analysis tests (risk engine + NLP + graph)
npm test
```

Pipeline: raw records → `buildGraph` (typed nodes/edges) →
`buildCustomerGraph` (shared-IP / shared-device relationship edges, indexed
per resource so there is no O(n²) entity-pair scan) → `findConnectedComponents`
(BFS) → `detectRingCandidates` (configurable minimums) → `extractRingEvidence`
→ `scoreRing` (0-100, every point traceable to evidence).

What `npm run graph:analyze` reports:

- **Graph statistics** — node counts per type and edge counts. On the synthetic
  dataset: 2,608 edges = 1,054 primary edges (`customer_transaction` 518,
  `transaction_refund` 243, `customer_complaint` 151, `complaint_refund` 142)
  + 1,554 derived edges (`customer_ip` 518, `customer_device` 518,
  `transaction_device` 518).
- **Connected components** — 70 on the synthetic dataset (6 multi-member
  components; the rest are isolated normal customers).
- **Ring candidates** — 6 on the synthetic dataset, each scored **80-90**,
  all **CRITICAL**.
- **Evidence** — every shared IP and shared device with its customer lists,
  plus per-ring refund/complaint/transaction behavior.
- **Score breakdown** — six explained signals (`shared_ip`, `shared_device`,
  `graph_density`, `refund_concentration`, `multi_member_refund_activity`,
  `complaint_concentration`) with per-signal severity and description.
- **Ground-truth comparison** — `data/raw/clusters.json` is read **only** for
  this final evaluation line, never during analysis.

Design notes:

- **No external graph libraries** — plain JavaScript Maps and arrays only.
- **Density** counts unique customer pairs connected under any relationship
  (not each relationship type as a separate edge).
- **`shared_transaction_context`** is implemented but disabled by default:
  in the synthetic dataset order IDs are drawn from a shared pool, so same-order
  reuse between unrelated customers is coincidental (120 accidental groups).
- Ground truth (`clusters.json`) is never read by any core graph module — a
  source-guard test enforces this.

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

| Method | Endpoint                            | Description                                |
| ------ | ----------------------------------- | ------------------------------------------ |
| GET    | `/api/v1/health`                    | Health check, returns service status       |
| GET    | `/api/v1/investigations`            | All customer investigations, by overall risk |
| GET    | `/api/v1/investigations/:customerId`| Merged investigation for one customer      |

Example:

```json
{
  "status": "ok",
  "project": "RefundGuard"
}
```

---

## Investigation Engine

RefundGuard now exposes investigation APIs that combine the three analysis
layers into a single, explainable per-customer view:

- **Risk Engine** — per-customer refund-behavior risk scores & signals
- **Complaint NLP** — similar complaint wording, reused templates, and text evidence
- **Graph Detection** — refund-ring membership, ring score, and shared-resource evidence

The Investigation Engine is an **orchestration layer** — it does **not** contain
fraud-detection logic itself. It runs the three engines against the same dataset,
merges their results, and computes the investigation's overall risk,
recommendation, and explanation. All analysis is deterministic and performed
in-memory; no results are persisted at this stage and no ground-truth data is
read during analysis.

Available endpoints:

| Method | Endpoint                              | Description                                            |
| ------ | ------------------------------------- | ------------------------------------------------------ |
| GET    | `/api/v1/investigations`              | All customers as investigations, sorted by overall risk |
| GET    | `/api/v1/investigations/:customerId`  | Merged investigation for a single customer (404 if unknown) |

Example single investigation response:

```json
{
  "customer": { "customerId": "cust_00064" },
  "risk": { "score": 83, "level": "critical", "signals": [] },
  "nlp": { "complaintCount": 2, "repeatedTemplates": [], "similarComplaints": [], "evidence": [] },
  "graph": { "inRing": true, "ringId": "ring_cust_00064", "ringScore": 89.1, "members": [], "evidence": [] },
  "summary": {
    "overallRisk": "critical",
    "recommendation": "Escalate to fraud analyst.",
    "explanation": "Overall risk CRITICAL: ..."
  }
}
```

---

## Contributing / Next Steps

Implemented so far:

1. Project foundation (frontend + backend + data scaffolding)
2. Backend foundation (Express API, `/api/v1/health`, error handling, nonfatal Mongo connect)
3. Frontend investigation-console UI (Layout / Sidebar / Header + placeholder pages)
4. Data foundation (Mongoose models + deterministic synthetic generator + seed script)
5. Risk Signal Engine (explainable, deterministic per-customer risk scoring)
6. Complaint NLP & Evidence Extraction (deterministic lexical normalization, similarity, reused-template detection, evidence extraction, per-customer contribution)
7. Graph-Based Refund Ring Detection (heterogeneous graph, customer projection, connected components, ring detection, evidence, explainable scoring)
8. Investigation API (orchestration of risk-engine + NLP + graph into per-customer investigations)

Planned future work (not yet implemented):

1. Frontend integration
2. Interactive graph visualization
3. Investigation dashboard
4. Production polish

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design.
