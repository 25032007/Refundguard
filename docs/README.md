# RefundGuard Documentation

Additional design and development documentation lives here in Phase 0.

**Current documentation:**

- `ARCHITECTURE.md` — system design and engine internals
- `risk-engine/README.md` — risk-signal engine details
- `README.md` — getting-started guide, install, validate, build, and troubleshooting

**Frontend:** React + Vite dashboard with ring-list, ring-detail, metrics pages,
API client, and interactive refund-ring graph. Routes: `/dashboard`, `/rings`,
`/rings/:id`, `/metrics`.

**Backend:** Express API (`/api/v1/health`, `/api/v1/investigations`,
`/api/v1/investigations/:customerId`) that orchestrates the three analysis engines
(Risk Engine, Complaint NLP, Graph Ring Detection) into a single per-customer
investigation.

**Risk Engine:** Deterministic, rule-based per-customer risk scoring (six signals,
0–100 score, risk-level bands). CLI: `npm run risk:analyze`. Tests: `npm run
risk:test`.

**Complaint NLP:** Deterministic lexical analysis — normalization, Jaccard
similarity, repeated template detection, evidence extraction. CLI: `npm run
nlp:analyze`. Tests: `npm run nlp:test`.

**Graph Ring Detection:** Graph-based refund ring detection — entity graph
construction, connected components, ring detection, explainable ring scoring
0–100. CLI: `npm run graph:analyze`. Tests: `npm run graph:test`.

See individual `README.md` files in each engine directory for detailed design.

**Phase 0 does NOT include:**

- Persistent analyst decisions (backend-backed case state)
- Production authentication and authorization
- Real-time event ingestion
- Model-assisted semantic complaint analysis
- Production monitoring and observability
- LLM/embedding/ML analysis of any kind
- Hybrid data pipeline or multi-seed evaluation
- Held-out adversarial scenarios
- Ablation testing
- `analyzeAsOf()` or ring lifecycle
- Neo4j, Kafka, or any external graph database
- Microservices architecture
