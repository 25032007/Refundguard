# RefundGuard Risk Engine

Deterministic, rule-based risk-signal engine that evaluates per-customer refund
behavior into explainable scores.

**Status:** Implemented (6 signals, 0–100 score, risk-level bands).

**Responsibilities:**

- **Compose behavioral signals** (refund frequency, refund rate, refund velocity,
  repeated refund reason, shared IP, shared device) into explainable per-customer
  risk scores.
- **Remain independent**: parallel to Complaint NLP and Graph/ring engine; results
  composed later by the Investigation Service.
- **Produce risk scores and explanations** for analysts.

**Output contract** — every signal:

```text
{ type, severity: low|medium|high|critical, contribution: Number,
  description: "...", evidence: { ... } }
```

**Signals evaluated** (max contributions):

| Signal                | What it detects                                    | Max |
| --------------------- | -------------------------------------------------- | --- |
| `refund_frequency`    | High count of refunds in the observed period       | 20  |
| `refund_rate`         | Refunds / completed transactions                   | 20  |
| `refund_velocity`     | Refunds requested inside a recent rolling window   | 15  |
| `repeated_refund_reason` | One reason dominating a customer's refunds      | 10  |
| `shared_ip`           | IP shared with other customer accounts             | 20  |
| `shared_device`       | Device reused across accounts (from transactions)  | 15  |

Score = sum of triggered contributions, clamped to 0–100. Risk level bands:
0–24 `low`, 25–49 `medium`, 50–74 `high`, 75–100 `critical`.

**Structure:**

```text
risk-engine/
├ index.js          # analyzeCustomerRisk / analyzeAllCustomers / summarize
├ config.js         # every threshold, contribution, and risk-level tier
├ run.js            # CLI: load data/raw/*.json, analyze, print report
├ signals/          # one file per signal
└ utils/
    ├── dates.js    # deterministic date parsing
    └ scoring.js    # classify, contribution lookups, clamp, risk levels
```

**Shared IP / shared device lookup** is built from the full transaction dataset
(`ipAddress → customers`, `deviceId → customers`). Shared-device detection
deliberately uses transaction `deviceId` references rather than the Device
collection's single-owner `customerId`.

**Ground truth is validation-only.** `data/raw/clusters.json` records the intended
cluster membership. The engine itself never reads it — suspicious behavior must
be discovered from the actual records.

**Run it:** `npm run risk:analyze` · Test it: `npm run risk:test`
  (Node's built-in test runner, no MongoDB required).
