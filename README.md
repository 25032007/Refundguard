# RefundGuard

RefundGuard is an **explainable AI-assisted refund fraud investigation platform** for payment and fraud analysts. It helps analysts detect suspicious refund behavior, identify coordinated refund rings, review complaint evidence, and make investigation decisions.

RefundGuard is a **decision-support system for investigations** — not a generic metrics dashboard. Every score it produces is decomposable into visible, explainable signals and supporting evidence, and the workflow is built around a human analyst reviewing a case and deciding what to do next.

All analysis is **deterministic and offline** — the engines use rule-based, weighted signal scoring, lexical text analysis, and graph traversal over the input data. There are no LLMs, no embeddings, and no trained models in the analysis pipeline. Claims in this document describe only what is currently implemented.

---

## What RefundGuard Does

RefundGuard takes refund, transaction, and complaint records and runs them through an analysis pipeline that ends in a per-customer investigation for an analyst:

```text
Refund / Transaction / Complaint Data
              ↓
      Risk Signal Engine
              ↓
        Complaint NLP
              ↓
      Graph Ring Detection
              ↓
     Investigation API
              ↓
      Analyst Dashboard
              ↓
     Analyst Decision
```

Each stage:

- **Risk Signal Engine** — scores every customer's refund behavior using six explicit, weighted signals (frequency, rate, velocity, repeated reason, shared IP, shared device) and produces a 0–100 score with a risk level.
- **Complaint NLP** — deterministically normalizes complaint text, finds similar complaint wording between customers, detects reused wording templates, and extracts text-based evidence.
- **Graph Ring Detection** — builds an entity graph of customers, devices, and IPs, finds connected customer groups, and scores which groups form coordinated refund rings.
- **Investigation API** — merges the three engine results into a single explainable per-customer investigation: risk, signals, complaint evidence, ring membership, ring score, recommendation, and plain-language explanation.
- **Analyst Dashboard** — surfaces high-risk customers, their scores, ring status, and recommended action.
- **Analyst Decision** — the analyst reviews the case and marks it **UNREVIEWED**, **MONITOR**, **ESCALATED**, or **CLEARED**.

---

## Key Features

- Explainable customer risk scoring
- Six risk signals:
  - Refund frequency
  - Refund rate
  - Refund velocity
  - Repeated refund reason
  - Shared IP detection
  - Shared device detection
- Complaint normalization and lexical similarity
- Reused complaint wording detection
- Complaint evidence extraction
- Refund ring detection using customer / device / IP relationships
- Ring scoring and ring evidence
- Investigation API
- Live analyst dashboard
- Interactive refund-ring graph
- Customer / device / IP node exploration in the graph
- Key evidence prioritization per investigation
- Recommended analyst action
- Local analyst decision workflow:
  - UNREVIEWED
  - MONITOR
  - ESCALATED
  - CLEARED
- Responsive investigation console

Analyst decisions are **local UI state**: they exist for the current browser session and are not persisted to a backend. Any set state resets when the page is refreshed.

---

## Why It Is Explainable

The system does **not** output a single black-box "fraud/not fraud" label. An investigation surfaces exactly why a customer was flagged:

- **score** — the overall risk score (0–100)
- **risk level** — the corresponding severity band (LOW / MEDIUM / HIGH / CRITICAL)
- **individual signal contributions** — how much each signal contributed to the score
- **evidence** — the concrete records behind each signal
- **complaint evidence** — similar wording, reused templates, and extracted complaint facts
- **graph relationships** — which shared devices/IPs link the customer to others
- **ring score** — how strongly the customer's ring qualifies as a refund ring
- **recommendation** — a suggested analyst action with a plain-language explanation

Every score is the sum of explicit, weighted components, and every component is backed by traceable evidence from the dataset.

---

## Detection Layers

### Risk Engine

Customer-level behavioral risk scoring. Compares each customer's refund behavior (frequency, rate, velocity, reuse of the same refund reason) and their footprint (shared IPs and shared devices with other customers) against deterministic thresholds. Each of the six signals contributes a bounded amount to a 0–100 score with a severity, description, and evidence list.

### Complaint NLP

Deterministic, offline lexical analysis of complaint narratives. Normalizes text, computes Jaccard similarity over normalized tokens, detects repeatedly reused wording across customers, extracts evidence phrases by category, and produces a bounded, explained text-based risk contribution. No semantic embeddings and no LLM analysis.

### Graph Analysis

Relationship intelligence over customers, devices, and IPs. Builds a heterogeneous entity graph, projects it onto connected customer pairs, finds connected components, and detects candidate refund rings from shared-resource relationships. Rings are scored deterministically (0–100) with per-signal explanations and evidence for every shared device, shared IP, and refund/complaint pattern. Fraud analysts use described claims like "seven customers connected through one shared IP and two shared devices" to understand the ring at a glance.

---

## Investigation Workflow

An analyst moves through the investigation console as follows:

```text
Dashboard
→ Select high-risk customer
→ Review risk signals
→ Review key evidence
→ Inspect complaint evidence
→ Investigate refund-ring graph
→ Review recommended action
→ Mark case
```

The final "Mark case" step sets a local analyst decision (UNREVIEWED / MONITOR / ESCALATED / CLEARED). As noted above, these decisions are currently **local UI state** and reset on refresh; they are not persisted.

---

## Tech Stack

| Layer       | Technology                                            |
| ----------- | ----------------------------------------------------- |
| Frontend    | React, Vite, React Router, Axios, react-force-graph-2d |
| Backend     | Node.js, Express                                      |
| Database    | MongoDB / Mongoose integration (optional)             |
| Language    | JavaScript                                            |
| Engines     | Deterministic, offline JavaScript risk / NLP / graph engines |
| Supporting  | cors, dotenv, nodemon, concurrently                   |

---

## Project Structure

```text
RefundGuard/
├── backend/
├── frontend/
├── risk-engine/
├── nlp/
├── graph/
├── data/
├── docs/
├── README.md
├── ARCHITECTURE.md
├── package.json
└── package-lock.json
```

- **`backend/`** — Express API (health + investigation endpoints), Mongoose models, routing, controllers, and the investigation orchestration service.
- **`frontend/`** — React + Vite investigation console: dashboard, ring list, per-customer investigation detail, interactive refund-ring graph, risk metrics, and the analyst decision workflow.
- **`risk-engine/`** — explainable, deterministic per-customer risk scoring (six signals, 0–100).
- **`nlp/`** — deterministic complaint NLP: normalization, similarity, reused templates, evidence extraction.
- **`graph/`** — graph-based refund ring detection: graph construction, connected components, ring detection, evidence, and ring scoring.
- **`data/`** — deterministic synthetic dataset generator and cross-reference validator (`generate.js`, `validate.js`) plus generated `raw/` and `processed/` data.
- **`docs/`** — additional documentation.
- **`ARCHITECTURE.md`** — system design and engine internals.

---

## Getting Started

### Prerequisites

- Node.js (v18 or later)

MongoDB is **optional** for the deterministic investigation/demo flow (see below).

### Install

From the repository root:

```bash
npm install
```

To install the root, `backend/`, and `frontend/` dependencies in one step:

```bash
npm run setup      # equivalent to: npm run install-all
```

### Validate data and run tests

```bash
npm run data:validate   # checks cross-references in the deterministic dataset
npm test                # runs the risk-engine, NLP, and graph test suites
```

### Build the frontend

```bash
npm run build --prefix frontend
# or from the frontend/ directory:
# npm run build
```

### Run the stack

Start both API and dev UI together:

```bash
npm run dev        # backend on http://localhost:5000, frontend on http://localhost:5173
```

or individually:

```bash
npm run dev --prefix backend
npm run dev --prefix frontend
```

Health check:

```bash
curl http://localhost:5000/api/v1/health
# {"status":"ok","project":"RefundGuard"}
```

### MongoDB note

The backend starts and `/api/v1/health` responds even when MongoDB is unavailable — all investigation analysis runs deterministically in memory over the included dataset. MongoDB is only needed for `db:seed`. To seed, copy `backend/.env.example` to `backend/.env`, set `MONGO_URI`, then run `npm run db:seed`.

---

## Validation

The following is verified in the current state of the repository:

- deterministic dataset validation passes
- risk / NLP / graph test suite passes
- frontend production build passes
- backend health endpoint works
- interactive refund-ring graph verified (click, hover, zoom, pan, drag)
- responsive layouts verified at desktop, tablet, and mobile widths
- no fabricated investigation values in the frontend (all UI data comes from the live API)
- no nested `refundguard/` directory — the project sits directly in the repository root

This describes the current checked-in state; it is not a production certification.

---

## Future Enhancements

The following are **not currently implemented** and are listed only as possible future work:

- persistent analyst decisions (backend-backed case state)
- production authentication and authorization
- real-time event ingestion
- model-assisted semantic complaint analysis
- production monitoring and observability
- larger-scale distributed graph processing

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the system design.