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
             │  in-process modules
┌────────────▼───────────────┐
│      Risk Engine           │   Detection & scoring logic (rule-based)
│   ┌────────────────────┐   │
│   │  Complaint NLP     │   │   Lexical similarity & evidence extraction
│   └────────────────────┘   │
│   ┌────────────────────┐   │
│   │  Graph / Ring      │   │   Relationship graph, components, ring scoring
│   └────────────────────┘   │
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
- **Status:** Implemented (signal scoring engine); ring detection lives in the separate `graph/` engine.
- **Responsibilities:**
  - Compose **behavioral signals** (refund frequency/rate/velocity, repeated reasons, shared IP/device) into explainable per-customer risk scores.
  - Remain independent: risk-engine, complaint NLP, and the graph/ring engine are three parallel analyses composed later by an integration layer.
  - Produce **risk scores** and **explanations** for analysts.
- **Relation to backend:** The backend is expected to invoke the analysis engines to obtain detection/scoring results; the exact interface (in-process module vs. wrapped service) is to be decided.

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

Synthetic development data (`data/generate.js`) produces ~100 normal customers plus 6 coordinated clusters that share IPs, devices, similar complaint wording, and refund behavior — giving the analysis layers realistic structure to discover. No risk values are assigned.

---

## Data Flow

1. **Ingest:** Raw refund/transaction/complaint data is collected into `data/raw`.
2. **Process:** Data is normalized and written to `data/processed`.
3. **Store:** Processed data is persisted to MongoDB via Mongoose models.
4. **Analyze:** The risk signal engine evaluates individual customer refund behavior (frequency, rate, velocity, repeated reasons, shared IP/device) into explainable scores. In parallel, the complaint NLP layer analyzes free-text complaints into similarity pairs, repeated wording templates, and per-customer evidence, while the graph engine builds the entity graph, projects customer relationships, and detects/scored refund rings.
5. **Serve:** The backend exposes results via the versioned REST API (`/api/v1`).
6. **Investigate:** The frontend dashboard fetches and visualizes rings, members, evidence, and metrics.

---

## API Versioning

All endpoints are prefixed with `/api/v1` to allow future breaking changes without disrupting clients.

| Method | Endpoint            | Purpose                |
| ------ | ------------------- | ---------------------- |
| GET    | `/api/v1/health`    | Service health check   |

---

## Risk Signal Engine

The first intelligence layer is a deterministic, rule-based risk signal engine.

**Principles:**

- **Explainable, never a black box.** Every risk score ships with its reasons: each signal carries a type, severity, numerical contribution, human-readable description, and supporting evidence, so an analyst can always understand *why* a customer was flagged.
- **Deterministic.** No random values, no ML, no LLM calls. Given the same input records, the engine always produces the same scores, levels, and ordering.
- **Rule-based at this stage.** Signals use configurable thresholds from `risk-engine/config.js` (no magic numbers).
- **Independent of the frontend.** The engine consumes plain structured data and exposes plain functions.
- **Independent of MongoDB persistence.** The engine runs on JSON data (`data/raw/*.json`); risk results are not yet written to the database.

**Output contract — every signal:**

```text
{ type, severity: low|medium|high|critical, contribution: Number, description: "...", evidence: { ... } }
```

**Signals evaluated (max contributions):**

| # | Signal                | What it detects                                    | Max |
| - | --------------------- | -------------------------------------------------- | --- |
| 1 | `refund_frequency`    | High count of refunds in the observed period       | 20  |
| 2 | `refund_rate`         | Refunds / completed transactions                   | 20  |
| 3 | `refund_velocity`     | Refunds requested inside a recent rolling window   | 15  |
| 4 | `repeated_refund_reason` | One reason dominating a customer's refunds      | 10  |
| 5 | `shared_ip`           | IP shared with other customer accounts             | 20  |
| 6 | `shared_device`       | Device reused across accounts (from transactions)  | 15  |

Score = sum of triggered contributions, clamped to 0–100. Risk level bands: 0–24 `low`, 25–49 `medium`, 50–74 `high`, 75–100 `critical`.

**Structure:**

```text
risk-engine/
├── index.js          # analyzeCustomerRisk / analyzeAllCustomers / summarize
├── config.js         # every threshold, contribution, and risk-level tier
├── run.js            # CLI: load data/raw/*.json, analyze, print report
├── signals/          # one file per signal
└── utils/
    ├── dates.js      # deterministic date parsing
    └── scoring.js    # classify, contribution lookups, clamp, risk levels
```

**Shared IP / shared device lookup** is built from the full transaction dataset (`ipAddress -> customers`, `deviceId -> customers`). Shared-device detection deliberately uses transaction `deviceId` references rather than the Device collection's single-owner `customerId`, because the synthetic dataset represents shared devices through transaction references.

**Ground truth is validation-only.** `data/raw/clusters.json` (persisted by the generator) records the intended cluster membership. `run.js` reads it solely to compare suspicious-cluster vs normal-customer scores in its report. The engine itself never reads it — suspicious behavior must be discovered from the actual records.

**Run it:** `npm run risk:analyze` · Test it: `npm run risk:test` (Node's built-in runner, no MongoDB required).

---

## Complaint NLP & Evidence Extraction

The second intelligence layer is a deterministic, explainable lexical NLP module that analyzes free-text complaints.

**Principles:**

- **Same contract as the risk engine.** Deterministic given the same input; no embeddings, no LLMs, no ML, no external calls — plain JavaScript over `data/raw/complaints.json`, fully offline.
- **Explainable.** Every finding is a concrete, human-readable fact: *which complaint matches which*, *which wording templates are reused across customers*, and *which evidence categories/phrases appear in a text*.
- **Independent of the risk engine and the database.** The NLP layer never reads risk-engine score files, never persists results, and never touches the ground-truth dataset during analysis.

**Pipeline (each stage deterministic):**

```text
Raw complaint text
   │  1. normalize()  — lowercase, strip non-alphanumerics, collapse whitespace
   ▼
Normalized text + token list (stopwords dropped; negation + refund words kept)
   ├── 2. similarity() — Jaccard score over unique tokens; binary compare complaints
   ├── 3. evidence()   — category detection (keywords + word-boundary phrases + text length)
   └── 4. analyze()    — repeated wording templates (canonical token key) + per-customer
                         contribution, bounded 0–15 and explained line-by-line
```

- **Similarity:** `calculateSimilarity` compares two texts via Jaccard over unique token sets and returns `{ score, sharedTokens, sharedTokenCount, tokenCountA, tokenCountB }`. `findSimilarComplaints` scans all cross-customers pairs, keeps those at/above the configurable threshold, and canonicalizes each pair so output does not depend on input order.
- **Evidence:** `extractComplaintEvidence` detects category keywords plus multi-word *phrases* (contiguous, word-boundary matched over the normalized text, so stopwords inside a phrase such as "refund the full amount" survive) and records `textLength`. Categories cover refund, delivery, damage, wrong-item, duplicate-charge, quality, product, payment, and service issues.
- **Repeated templates:** `findRepeatedTemplates` groups complaints whose normalized token sets are identical (count ≥ `minCount`, default 2), reporting `templateKey` (sorted tokens), `representativeText`, member complaint/customer IDs, and count. Reuse is only scored **across different customers**.
- **Per-customer contribution:** `analyzeCustomerComplaints` combines `min(reusedTemplates × 3, 9)` + `min(similarComplaints × 2, 6)`, clamped to `nlp.maxContribution` (15). Deterministic ordering: contribution desc, then `customerId` asc.
- **Thresholds and vocabulary** all live in `nlp/config.js` (no magic numbers). The similarity threshold is 0.5, tuned so that every reported pair is same-theme (identical texts score 1.0; unrelated texts score 0).

**Structure:**

```text
nlp/
├── index.js      # public API (normalize, similarity, evidence, analyze, config)
├── config.js     # stopwords, protected tokens, thresholds, evidence vocabulary
├── normalize.js  # normalizeComplaintText / tokenize / tokensOf
├── similarity.js # calculateSimilarity / findSimilarComplaints
├── evidence.js   # extractComplaintEvidence
├── analyze.js    # findRepeatedTemplates / analyzeCustomerComplaints / analyzeComplaints
├── run.js        # CLI: load data/raw/complaints.json, analyze, print report
└── tests/        # normalize / similarity / evidence / analyze suites (node:test)
```

**Ground truth is validation-only.** `run.js` reads `data/raw/clusters.json` solely to compare suspicious-cluster vs normal-customer NLP contributions in its report; the analysis modules never load it. The NLP source is guarded by tests against referencing `clusters.json` or any nondeterministic primitive.

**Run it:** `npm run nlp:analyze` · Test everything: `npm test` (risk-engine + NLP suites).

---

## Graph-Based Refund Ring Detection

The third intelligence layer detects coordinated refund rings from *relationships*, not per-customer scores. `graph/` uses plain-JavaScript in-memory structures (no external graph libraries, no graph database).

**Pipeline (each stage deterministic):**

```text
Raw Data
   ↓
Risk Signal Engine   (independent: per-customer refund-behavior scores)
   ↓
Complaint NLP        (independent: text similarity & evidence)
   ↓
Graph Builder        (heterogeneous nodes: customer, device, ip, transaction, refund, complaint)
   ↓
Customer Relationship Graph  (shared_ip / shared_device edges between customers)
   ↓
Connected Components (BFS)
   ↓
Refund Ring Detection (configurable minimum members / relationship edges)
   ↓
Explainable Ring Scoring (0-100, six traceable signals)
```

**Heterogeneous graph.** Nodes carry a stable, explicit type and prefixed ID (`customer:cust_00001`, `device:dev_001`, `ip:192.168.1.10`, `transaction:txn_001`, `refund:ref_001`, `complaint:cmp_001`). Edges are typed (`customer→transaction`, `transaction→refund`, `customer→complaint`, `transaction→device`, `customer→ip`, `customer→device`, `complaint→refund`) and sorted so output never depends on input array order.

**Customer projection.** `buildCustomerGraph` derives shared-resource relationships using indexes (`ip → customers`, `device → customers`) built once from the full graph — no O(n²) entity-pair scan. Each resource group with ≥2 customers yields one typed relationship edge per customer pair, e.g. `{ customerA, customerB, relationship: "shared_ip", sharedValue, weight: 1 }`. When a pair shares several things, every relationship type is preserved as its own edge (evidence is never collapsed); density, however, counts *unique customer pairs* (this choice is documented in `graph/config.js`). `shared_transaction_context` (same-order reuse) is implemented but **disabled by default** because order IDs are drawn from a shared pool in the synthetic dataset, making same-order reuse coincidental among normal customers (120 accidental groups).

**Connected components.** `findConnectedComponents` runs BFS over the customer adjacency map and returns components with sorted member IDs, ordered by size desc then first member asc. Single-customer components are handled (and later excluded by candidate rules).

**Ring candidates.** `detectRingCandidates` requires `minimumMembers` (3) and `minimumRelationshipEdges` (2) from `graph/config.js`. Ring IDs are deterministic (`ring_<first-sorted-customer-id>`).

**Density.** `density = unique connected member pairs / (n·(n−1)/2)`, counting each customer pair once regardless of how many relationship types connect it.

**Evidence.** `extractRingEvidence` emits only what is observed: shared IPs and devices (with their customer lists), per-member refund/complaint/transaction counts, ring totals, refund rate, and member participation counts.

**Score.** `scoreRing` budgets are configurable maxima that must be *earned*: shared IP 25, shared device 25, graph density 15, refund concentration 15, multi-member refund activity 10, complaint concentration 10. IP/device contributions scale with pair coverage and ring size; refund concentration is measured against a 30% baseline rate. The total is clamped to 100 and mapped to `low` 0–24 / `medium` 25–49 / `high` 50–74 / `critical` 75–100. Every signal carries `{ type, severity, contribution, description, evidence }`, so no point is unexplained.

**Ground truth is validation-only.** `graph/run.js` reads `data/raw/clusters.json` solely to report suspicious-member coverage and false positives. Core modules never read it — a source-guard test enforces this (along with a ban on `Math.random`/`Date.now`/`crypto.randomUUID`).

**Run it:** `npm run graph:analyze` · Test it: `npm run graph:test` · Test everything: `npm test`.

---

## Non-Goals (current foundation)

- No payment processing.
- No metrics beyond the per-ring explainable score (ring cross-metrics deferred).
- No risk values assigned to synthetic data (by design; risk values are only *computed at analysis time* by the engine, never stored).
- No API exposure of risk-engine, NLP, or graph results yet.
- No composition of the three analyses (risk-engine + NLP + graph) into a combined investigation experience yet — they run as independent engines by design.
- No LLM/embedding/ML analysis anywhere — all intelligence layers are deterministic lexical/rule-based by design.
- No MongoDB persistence of analysis results, no external graph databases (Neo4j), no production streaming detection.

API exposure of analysis results, dashboard/graph visualization, and the composition layer are intentionally deferred and will be built on top of the three engines.
