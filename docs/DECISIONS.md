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
