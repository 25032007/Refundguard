# RefundGuard Architecture

This document distinguishes **CURRENT IMPLEMENTATION** from **PLANNED / FUTURE V1 work**.

The current foundation is a deterministic, offline, rule-based system with no ML, LLM, embeddings, or external data dependencies. All analysis runs in-process over included synthetic datasets.

---

## CURRENT IMPLEMENTATION (Phase 0)

RefundGuard is a deterministic, explainable risk-analysis platform composed of three independent analysis engines composed by an Investigation Service, all running over included synthetic data.

### Frontend

- **Framework:** React, built with Vite.
- **Routing:** React Router (client-side routes for Dashboard, Ring List, Ring Detail, and Metrics).
- **Data access:** HTTP client (`axios`) to call the backend REST API.
- **Visualization:** `react-force-graph-2d` is a runtime dependency — interactive ring graph is functional in the dashboard.
- **Role:** The investigation dashboard for risk analysts. It surfaces rings, their members, evidence, and supporting metrics.
- **Current routes:** `/dashboard`, `/rings`, `/rings/:id`, `/metrics`.
- **Analyst decision workflow:** Local UI state (UNREVIEWED / MONITOR / ESCALATED / CLEARED), resets on refresh; not persisted.

### Backend

- **Runtime:** Node.js + Express.
- **API versioning:** Routes are namespaced under `/api/v1`.
- **Cross-origin:** CORS enabled to allow the Vite dev server to call the API during development.
- **Configuration:** Environment variables loaded via `dotenv` (e.g., MongoDB connection URI, port).
- **Layering (per directory):**
  - `routes/` – URL-to-handler mapping.
  - `controllers/` – Request handling and response shaping.
  - `services/` – Business logic and orchestration. The **Investigation Service** (`services/investigationService.js`) orchestrates the three engines.
  - `models/` – Mongoose schemas for `Customer`, `Device`, `Transaction`, `Refund`, `Complaint`, and `RefundRing`.
- **Purpose:** Expose a stable, versioned API that the frontend consumes and that wraps the investigation service and the analysis engines.

### Risk Engine

- **Location:** `risk-engine/` directory.
- **Status:** Implemented (deterministic rule-based signal scoring engine).
- **Responsibilities:**
  - Compose **behavioral signals** (refund frequency, refund rate, refund velocity, repeated refund reason, shared IP, shared device) into explainable per-customer risk scores.
  - **Remain independent**: parallel to Complaint NLP and Graph/ring engine; results composed later by the Investigation Service.
  - **Produce risk scores and explanations** for analysts.
- **Output contract** — every signal:

```text
{ type, severity: low|medium|high|critical, contribution: Number,
  description: "...", evidence: { ... } }
```

- **Signals evaluated** (max contributions):

| Signal                | What it detects                                    | Max |
| --------------------- | -------------------------------------------------- | --- |
| `refund_frequency`    | High count of refunds in the observed period       | 20  |
| `refund_rate`         | Refunds / completed transactions                   | 20  |
| `refund_velocity`     | Refunds requested inside a recent rolling window   | 15  |
| `repeated_refund_reason` | One reason dominating a customer's refunds      | 10  |
| `shared_ip`           | IP shared with other customer accounts             | 20  |
| `shared_device`       | Device reused across accounts (from transactions)  | 15  |

- Score = sum of triggered contributions, clamped to 0–100. Risk level bands: 0–24 `low`, 25–49 `medium`, 50–74 `high`, 75–100 `critical`.
- **Structure:**

```text
risk-engine/
├ index.js          # analyzeCustomerRisk / analyzeAllCustomers / summarize
├ config.js         # every threshold, contribution, and risk-level tier
├ run.js            # CLI: load data/raw/*.json, analyze, print report
├ signals/          # one file per signal
└ utils/
    ├── dates.js    # deterministic date parsing
    └── scoring.js  # classify, contribution lookups, clamp, risk levels
```

- **Shared IP / shared device lookup** is built from the full transaction dataset (`ipAddress → customers`, `deviceId → customers`). Shared-device detection deliberately uses transaction `deviceId` references rather than the Device collection's single-owner `customerId`.
- **Ground truth is validation-only.** `data/raw/clusters.json` records the intended cluster membership. The engine itself never reads it — suspicious behavior must be discovered from the actual records.
- **Run it:** `npm run risk:analyze` · **Test it:** `npm run risk:test` (Node's built-in test runner, no MongoDB required).

### Investigation Service

- **Orchestrates** the three independent analysis engines (Risk Engine, Complaint NLP, Graph Engine) into a single, explainable per-customer investigation.
- **Contains no fraud-detection logic itself**; all detection and scoring lives inside the engines, which are consumed through their public APIs and never modified.
- **Flow:**

```text
Request
   ↓
Investigation Service       (orchestrates engines)
   ↓
Risk Engine ── Complaint NLP ── Graph Engine
   ↓
Merged Investigation
   ↓
API Response
```

- **Responsibility of the service:**
  - **Orchestrates engines** — runs the risk, NLP, and graph analyses over the same dataset (computed lazily and reused in-memory, so results are deterministic per process).
  - **Merges results** — combines each engine's output into one per-customer investigation (`risk`, `nlp`, `graph` sections).
  - **Computes overallRisk** — the customer's overall risk tier, derived by combining the engine results.
  - **Generates recommendation** — the action an analyst should take for the customer's risk tier.
  - **Generates explanation** — a concise, human-readable summary of why the customer was flagged.
- **Exposed via the API:**

| Method | Endpoint                              | Purpose                                     |
| ------ | ------------------------------------- | ------------------------------------------- |
| GET    | `/api/v1/health`                      | Service health check                        |
| GET    | `/api/v1/investigations`              | All customer investigations, sorted by overall risk |
| GET    | `/api/v1/investigations/:customerId`  | Merged investigation for one customer (404 if unknown) |

- **Analysis is in-memory**; results are not persisted to the database and no ground-truth data is read during analysis.

### Complaint NLP & Evidence Extraction

- **Second intelligence layer**: deterministic, explainable lexical NLP module that analyzes free-text complaints.
- **Deterministic given the same input**; no embeddings, no LLMs, no ML, no external calls — plain JavaScript over `data/raw/complaints.json`, fully offline.
- **Explainable**: every finding is a concrete, human-readable fact: *which complaint matches which*, *which wording templates are reused across customers*, and *which evidence categories/phrases appear in a text*.
- **Independent of the risk engine and the database**: the NLP layer never reads risk-engine score files, never persists results, and never touches the ground-truth dataset during analysis.

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
├ index.js      # public API (normalize, similarity, evidence, analyze, config)
├ config.js     # stopwords, protected tokens, thresholds, evidence vocabulary
├ normalize.js  # normalizeComplaintText / tokenize / tokensOf
├ similarity.js # calculateSimilarity / findSimilarComplaints
├ evidence.js   # extractComplaintEvidence
├ analyze.js    # findRepeatedTemplates / analyzeCustomerComplaints / analyzeComplaints
├ run.js        # CLI: load data/raw/complaints.json, analyze, print report
└── tests/      # normalize / similarity / evidence / analyze suites (node:test)
```

- **Ground truth is validation-only.** `run.js` reads `data/raw/clusters.json` solely to compare suspicious-cluster vs normal-customer NLP contributions in its report; the analysis modules never load it. The NLP source is guarded by tests against referencing `clusters.json` or any nondeterministic primitive.
- **Run it:** `npm run nlp:analyze` · **Test everything:** `npm test` (risk-engine + NLP suites).

### Graph-Based Refund Ring Detection

- **Third intelligence layer**: detects coordinated refund rings from *relationships*, not per-customer scores. `graph/` uses plain-JavaScript in-memory structures (no external graph libraries, no graph database).

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

- **Heterogeneous graph.** Nodes carry a stable, explicit type and prefixed ID (`customer:cust_00001`, `device:dev_001`, `ip:192.168.1.10`, `transaction:txn_001`, `refund:ref_001`, `complaint:cmp_001`). Edges are typed (`customer→transaction`, `transaction→refund`, `customer→complaint`, `transaction→device`, `customer→ip`, `customer→device`, `complaint→refund`) and sorted so output never depends on input array order.
- **Customer projection.** `buildCustomerGraph` derives shared-resource relationships using indexes (`ip → customers`, `device → customers`) built once from the full graph — no O(n²) entity-pair scan. Each resource group with ≥2 customers yields one typed relationship edge per customer pair, e.g. `{ customerA, customerB, relationship: "shared_ip", sharedValue, weight: 1 }`. When a pair shares several things, every relationship type is preserved as its own edge (evidence is never collapsed); density, however, counts *unique customer pairs* (this choice is documented in `graph/config.js`). `shared_transaction_context` (same-order reuse) is implemented but **disabled by default** because order IDs are drawn from a shared pool in the synthetic dataset, making same-order reuse coincidental among normal customers (120 accidental groups).
- **Connected components.** `findConnectedComponents` runs BFS over the customer adjacency map and returns components with sorted member IDs, ordered by size desc then first member asc. Single-customer components are handled (and later excluded by candidate rules).
- **Ring candidates.** `detectRingCandidates` requires `minimumMembers` (3) and `minimumRelationshipEdges` (2) from `graph/config.js`. Ring IDs are deterministic (`ring_<first-sorted-customer-id>`).
- **Density.** `density = unique connected member pairs / (n·(n−1)/2)`, counting each customer pair once regardless of how many relationship types connect it.
- **Evidence.** `extractRingEvidence` emits only what is observed: shared IPs and devices (with their customer lists), per-member refund/complaint/transaction counts, ring totals, refund rate, and member participation counts.
- **Score.** `scoreRing` budgets are configurable maxima that must be *earned*: shared IP 25, shared device 25, graph density 15, refund concentration 15, multi-member refund activity 10, complaint concentration 10. IP/device contributions scale with pair coverage and ring size; refund concentration is measured against a 30% baseline rate. The total is clamped to 100 and mapped to `low` 0–24 / `medium` 25–49 / `high` 50–74 / `critical` 75–100. Every signal carries `{ type, severity, contribution, description, evidence }`, so no point is unexplained.
- **Ground truth is validation-only.** `graph/run.js` reads `data/raw/clusters.json` solely to report suspicious-member coverage and false positives. Core modules never read it — a source-guard test enforces this (along with a ban on `Math.random`/`Date.now`/`crypto.randomUUID`).
- **Run it:** `npm run graph:analyze` · **Test it:** `npm run graph:test` · **Test everything:** `npm test`.

---

## PLANNED / FUTURE V1 WORK

The following are explicitly **future V1 phases**. They are NOT implemented and must not be claimed as existing:

- **Hybrid data pipeline** — combining synthetic generation with real-world ingestion
- **Multi-seed evaluation** — running multiple generator seeds to assess robustness
- **Held-out adversarial scenarios** — evaluating against adversarially constructed data
- **Abatement testing** — systematic removal of signals to measure impact
- **`analyzeAsOf()`** — time-windowed analysis over historical data
- **Ring lifecycle** — ring creation, evolution, and dissolution over time
- **Anomaly detection** — statistical deviation from expected behavior patterns
- **Persistent analyst decisions** — backend-backed case state persistence

These features may be explored in later phases beyond V1 but are not part of the current foundation.

---

## Non-Goals (current foundation)

- No payment processing.
- No metrics beyond the per-ring explainable score (ring cross-metrics deferred).
- No risk values assigned to synthetic data (by design; risk values are only *computed at analysis time* by the engine, never stored).
- No persistence of investigation results — the Investigation Service runs in-memory.
- No production authentication and authorization.
- No real-time event ingestion.
- No model-assisted semantic complaint analysis (LLM/embedding/ML of any kind).
- No external graph databases (Neo4j), no production streaming detection.
- No hybrid data pipeline, multi-seed evaluation, held-out adversarial scenarios, or ablation testing.

Frontend integration, interactive graph visualization, the investigation dashboard, and production polish are intentionally deferred and will be built on top of the Investigation Service.

---

## Engine Sign Summary

| Engine | Signals | Score range | Key behavior |
| ------ | ------- | ----------- | ------------ |
| Risk Engine | 6 signals (frequency, rate, velocity, repeated reason, shared IP, shared device) | 0–100, risk levels low/medium/high/critical | Deterministic rule-based; CLI: `npm run risk:analyze` |
| Complaint NLP | Jaccard similarity, repeated templates, evidence categories | 0–15 per-customer contribution | Deterministic lexical analysis; CLI: `npm run nlp:analyze` |
| Graph Engine | shared IP, shared device, density, refund concentration, multi-member activity, complaint concentration | 0–100, ring severity low/medium/high/critical | Deterministic graph + BFS; CLI: `npm run graph:analyze` |