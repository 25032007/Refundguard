# RefundGuard API Contract

Base URL: `/api/v1`

## Common Enums
- **riskLevel**: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- **decision**: `UNREVIEWED` | `MONITOR` | `ESCALATED` | `CLEARED`

## Endpoints

### 1. Summary
**GET `/summary`**

Returns dataset summary, risk distribution, decision counts, and top signals.

**Response (200 OK):**
```json
{
  "dataset": {
    "source": "online_retail",
    "seed": 1,
    "customerCount": 2000
  },
  "risk": {
    "LOW": 1500,
    "MEDIUM": 300,
    "HIGH": 150,
    "CRITICAL": 50
  },
  "decisions": {
    "UNREVIEWED": 1900,
    "MONITOR": 50,
    "ESCALATED": 30,
    "CLEARED": 20
  },
  "rings": {
    "total": 12,
    "byLifecycle": null
  },
  "topSignals": [
    { "type": "keyword", "label": "never arrived", "count": 120 }
  ]
}
```

### 2. List Investigations
**GET `/investigations`**

Returns a paginated, filterable list of customers, precomputed for fast rendering.

**Query Parameters:**
- `scope`: `flagged` | `all` (default: `flagged`)
- `risk`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- `status`: `UNREVIEWED` | `MONITOR` | `ESCALATED` | `CLEARED`
- `ring`: `any` | `<ringId>` | `none`
- `q`: Search by customerId
- `sort`: `-score` | `score` | `customerId` (default: `-score`)
- `page`: default 1
- `pageSize`: default 50 (max 100)

**Response (200 OK):**
```json
{
  "items": [
    {
      "customerId": "C001",
      "riskScore": 85,
      "riskLevel": "CRITICAL",
      "topSignal": { "type": "keyword", "label": "fraud", "contribution": 30 },
      "complaintCount": 2,
      "ring": { "ringId": "R001", "score": 90 },
      "decision": { "status": "ESCALATED", "updatedAt": "2026-10-08T12:00:00.000Z" }
    }
  ],
  "page": 1,
  "pageSize": 50,
  "total": 500,
  "facets": {
    "risk": { "LOW": 0, "MEDIUM": 100, "HIGH": 50, "CRITICAL": 10 },
    "status": { "UNREVIEWED": 150, "MONITOR": 5, "ESCALATED": 5, "CLEARED": 0 },
    "ring": { "inRing": 20, "noRing": 140 }
  }
}
```

### 3. Get Investigation Detail
**GET `/investigations/:customerId`**

Returns the full investigation detail for a single customer.

**Response (200 OK):**
```json
{
  "customer": { "customerId": "C001", "name": "Alice" },
  "risk": { "score": 85, "level": "CRITICAL", "signals": [...] },
  "nlp": { "complaintCount": 2, "repeatedTemplates": [], "similarComplaints": [], "evidence": [] },
  "graph": { "inRing": true, "ringId": "R001", "ringScore": 90, "members": ["C001", "C002"], "evidence": [] },
  "summary": { "overallRisk": "CRITICAL", "recommendation": "...", "explanation": "..." },
  "decision": { "status": "ESCALATED", "updatedAt": "2026-10-08T12:00:00.000Z" },
  "version": 2
}
```

### 4. Update Decision
**PUT `/investigations/:customerId/decision`**

Requires `X-Analyst-Id` header.

**Body:**
```json
{
  "decision": "ESCALATED",
  "reason": "Suspicious refund patterns matching known fraud ring.",
  "expectedVersion": 2
}
```

**Response (200 OK):** Returns the updated decision object.
**Error 409 Conflict:** If `expectedVersion` mismatches the current DB version.
**Error 422 Unprocessable Entity:** If `reason` is required but missing/short for ESCALATED or CLEARED.

### 5. Audit History
**GET `/investigations/:customerId/history`**

Returns the audit log for a customer, newest first.

**Response (200 OK):**
```json
[
  {
    "id": 12,
    "decision": "ESCALATED",
    "previousDecision": "MONITOR",
    "reason": "escalated after further review",
    "analystId": "analyst_1",
    "createdAt": "2026-10-08T12:05:00.000Z"
  }
]
```

### 6. Rings
**GET `/rings`**
Paginated list of detected rings.

**GET `/rings/:ringId`**
Detailed view of a single ring including members, edges, and evidence.

### 7. Health Check
**GET `/health`**
Returns system health, dataset info, and cold build time.

**Response (200 OK):**
```json
{
  "status": "ok",
  "uptimeSec": 3600,
  "datasetLoaded": true,
  "db": "sqlite",
  "dataset": { "source": "online_retail", "seed": 1, "customerCount": 2000 },
  "coldBuildMs": 1500
}
```
