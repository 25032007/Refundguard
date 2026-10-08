# Design Decisions

## 1. SQLite with better-sqlite3
SQLite was chosen over MongoDB to ensure the application works out-of-the-box with zero external service dependencies (`npm run dev` works immediately). `better-sqlite3` was selected because it's synchronous and extremely fast, perfectly matching Node.js workloads where we do localized, fast I/O operations without the overhead of connection pooling or async context switching in the standard event loop.

## 2. In-Memory Analysis Cache
The investigations (risk, nlp, and graph engines) run in-memory and heavily depend on cross-analyzing the dataset. Because the dataset size is currently bounded (around 2,000 customers), we decided to eagerly build an analysis cache (`buildAnalysisCache`) and precompute lightweight list rows and facet indexes on startup. This allows `/investigations` list endpoints to respond almost instantly and avoids redundant recomputation on every request.

## 3. Optimistic Concurrency Control (Version Checks)
To prevent lost updates from concurrent analysts making decisions simultaneously, we implemented an `expectedVersion` check on the `PUT /decision` endpoint. When providing an `expectedVersion`, the backend asserts it against the current version. If there's a mismatch, it throws a `409 Conflict`, allowing the client to show the updated state and prevent overwriting another analyst's work without reviewing the latest state.

## 4. Default Scope `flagged`
The default `scope=flagged` (meaning overallRisk is `MEDIUM` or higher) was implemented to immediately highlight actionable investigations to the analysts. This reduces noise by filtering out the bulk of benign (`LOW` risk) customers, aligning with the primary goal of the investigation dashboard.

## 5. UPPERCASE Enums
The API contract uses strictly UPPERCASE string enums (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL` for risk, and `UNREVIEWED`, `MONITOR`, `ESCALATED`, `CLEARED` for decisions). This aligns the API strictly with typical backend constants conventions, removes ambiguity between uppercase UI labels and lowercase API strings, and avoids case-insensitivity bugs across different database layers.

## 6. Separating Decisions by Dataset ID
To prevent analyst decisions from bleeding across different dataset permutations (e.g., when switching seeds or datasets), decisions and audit logs are tied to a composite `datasetId` derived from the source dataset's metadata (e.g., `online_retail_1`). Changing the dataset effectively scopes the UI to a fresh set of investigations and decisions, preserving the integrity of previous work.

## 7. Accepted `npm audit` Findings
`npm audit --omit=dev` from the repository root reports **0 vulnerabilities**. The remaining findings live in the workspace packages and are accepted risks for this release:

- **`natural` → `uuid` (backend, production, 2 moderate).** `natural@7` pins `uuid@<11.1.1` (GHSA-w5hq-g745-h8pq: a missing buffer bounds check that only applies to the `v3`/`v5`/`v6` APIs when a caller passes a buffer). RefundGuard only uses `natural`'s tokenizer/similarity features on analyst-submitted complaint text — the vulnerable code paths are never called. The only fix is `npm audit fix --force`, which installs `natural@8` (breaking major bump to the NLP layer). Accepted until the NLP layer can be re-validated against `natural@8`.
- **`react-router` / `react-router-dom` 6 (frontend, production, 2 moderate).** Open-redirect and SSR-hydration advisories; the fix requires `react-router-dom@7`, a breaking major bump across routing, loaders and the test suite. The console is an internal, non-SSR analyst tool served on a trusted origin, which removes the exploitation surface. Accepted until a dedicated router-upgrade pass.
- **Dev-only tooling.** `@faker-js/faker` (high, only used to seed synthetic test data), `shell-quote` (critical, transitive via `concurrently`) and `xlsx` (high, no fix available; only used by the one-off data preprocessing script) at the root, `braces` (via `nodemon`) in the backend, and `esbuild`/`tinypool` (via `vite`/`vitest`) in the frontend. None of these ship in the runtime artifacts, so they are not reachable in production. Accepted and revisited on every dependency upgrade.

## 8. Why `test:ci` and `test:full` Are Split
The suites are split by dataset dependency, not by importance:

- **`npm run test:ci`** runs `risk`, `nlp`, `graph`, `data-ci`, `backend` and `frontend`. It must work on a fresh clone with no generated data, so the data coverage comes from `data/fixtures/mini` — a committed, deterministic benchmark (< 300 customers) with `ground-truth.json` and `metadata.json`. `data/tests/fixture.test.js` regenerates that fixture twice and asserts byte-identical output plus ground-truth isolation (no labels/categories/scenario ids in engine inputs or engine output). These are the properties that protect determinism and evaluation integrity, and they are cheap enough to run on every push.
- **`npm run test:full`** additionally runs the `data` and `eval` suites, which read `data/generated/uci` — a ~2,000-customer benchmark produced by `npm run data:uci` from the ~100 MB UCI Online Retail II CSV (`data/processed/online-retail-ii.csv`, gitignored). The scenario-integrity, evaluation-harness, ablation, guard, stability and final held-out tests all need those files; regenerating them is minutes of I/O per run and the source CSV is not committed. Those suites therefore stay opt-in: run `npm run data:uci` once, then `npm run test:full`. When the dataset is absent they skip with an explicit `run npm run data:uci` message rather than failing.
