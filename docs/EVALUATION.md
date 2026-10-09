# RefundGuard Evaluation Report (Phase 3)

> Published results, fully reproducible by `npm run eval:report`.
> All figures below are computed by script from generated benchmark data. No figure is hand-entered.

Generated at: 2026-10-09T06:15:25.778Z

## Seeds

| Phase | Seeds |
| --- | --- |
| Development | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 |
| Held-out (frozen config) | 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| Unseen family | subset_shared_resource (seed 30) |

## Frozen configuration

Engine configuration objects (risk/graph/nlp) are never mutated. The following decision thresholds were chosen on **development seeds only**, then frozen and applied to all held-out evaluations.

| Decision parameter | Value |
| --- | --- |
| NLP contribution threshold (per-customer F1 on dev) | 15 |
| Ring score threshold (per-customer F1 on dev) | 75 |
| Frozen config sha256 | ad1f9a3e5c85b02f8081ee0360cb8569438d00840308f458bc9d0754620ca8d4 |

Decision rules (evaluation layer, applied identically on dev and held-out):

```
{
  "risk": "predictedFraud = (riskLevel === \"HIGH\" || riskLevel === \"CRITICAL\")",
  "nlp": "predictedFraud = (nlpContribution >= thresholds.nlp)",
  "graph": "predictedFraud = (ring !== null && ring.score >= thresholds.ringScore)",
  "combined": "risk OR nlp OR graph",
  "rankingScore": "max over enabled engine contributions, normalized to 0-100"
}
```

## Customer-level metrics

PR-AUC uses the per-condition ranking score (max normalized engine contribution); the fraud prevalence (positive rate) is shown next to PR-AUC for context.

### Development (seeds 1–10)

| Condition | Precision | Recall | F1 | FPR | PR-AUC (prevalence) |
| --- | --- | --- | --- | --- | --- |
| risk_only | 0.7391 ± 0.0460 (95% CI 0.7062–0.7720) | 0.9208 ± 0.0307 (95% CI 0.8988–0.9428) | 0.8192 ± 0.0327 (95% CI 0.7958–0.8426) | 0.40% ± 0.10% (95% CI 0.33%–0.46%) | 0.9300 ± 0.0257 (95% CI 0.9116–0.9483) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| nlp_only | 0.1339 ± 0.0204 (95% CI 0.1194–0.1485) | 0.6125 ± 0.0591 (95% CI 0.5702–0.6548) | 0.2196 ± 0.0308 (95% CI 0.1976–0.2416) | 4.80% ± 0.52% (95% CI 4.44%–5.17%) | 0.3820 ± 0.0332 (95% CI 0.3583–0.4057) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| graph_only | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.9167 ± 0.0000 (95% CI 0.9167–0.9167) | 0.9565 ± 0.0000 (95% CI 0.9565–0.9565) | 0.00% ± 0.00% (95% CI 0.00%–0.00%) | 0.9197 ± 0.0001 (95% CI 0.9196–0.9197) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| risk_nlp | 0.1809 ± 0.0120 (95% CI 0.1722–0.1895) | 0.9208 ± 0.0307 (95% CI 0.8988–0.9428) | 0.3020 ± 0.0160 (95% CI 0.2906–0.3135) | 5.03% ± 0.51% (95% CI 4.67%–5.40%) | 0.3965 ± 0.0332 (95% CI 0.3728–0.4203) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| risk_graph | 0.7547 ± 0.0440 (95% CI 0.7232–0.7862) | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.8596 ± 0.0289 (95% CI 0.8389–0.8802) | 0.40% ± 0.10% (95% CI 0.33%–0.46%) | 0.9715 ± 0.0127 (95% CI 0.9624–0.9805) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| nlp_graph | 0.1997 ± 0.0163 (95% CI 0.1881–0.2114) | 0.9917 ± 0.0176 (95% CI 0.9791–1.0042) | 0.3322 ± 0.0225 (95% CI 0.3161–0.3483) | 4.80% ± 0.52% (95% CI 4.44%–5.17%) | 0.4363 ± 0.0343 (95% CI 0.4117–0.4608) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| combined | 0.1936 ± 0.0160 (95% CI 0.1822–0.2051) | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.3242 ± 0.0223 (95% CI 0.3082–0.3402) | 5.03% ± 0.51% (95% CI 4.67%–5.40%) | 0.4363 ± 0.0343 (95% CI 0.4118–0.4608) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |

### Held-out (seeds 11–30, frozen config)

| Condition | Precision | Recall | F1 | FPR | PR-AUC (prevalence) |
| --- | --- | --- | --- | --- | --- |
| risk_only | 0.7523 ± 0.0721 (95% CI 0.7186–0.7861) | 0.9229 ± 0.0511 (95% CI 0.8990–0.9468) | 0.8258 ± 0.0401 (95% CI 0.8070–0.8445) | 0.38% ± 0.15% (95% CI 0.31%–0.45%) | 0.9417 ± 0.0307 (95% CI 0.9273–0.9561) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| nlp_only | 0.1368 ± 0.0172 (95% CI 0.1288–0.1449) | 0.6000 ± 0.0513 (95% CI 0.5760–0.6240) | 0.2226 ± 0.0253 (95% CI 0.2108–0.2345) | 4.58% ± 0.44% (95% CI 4.37%–4.78%) | 0.3798 ± 0.0286 (95% CI 0.3664–0.3931) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| graph_only | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.9167 ± 0.0000 (95% CI 0.9167–0.9167) | 0.9565 ± 0.0000 (95% CI 0.9565–0.9565) | 0.00% ± 0.00% (95% CI 0.00%–0.00%) | 0.9196 ± 0.0001 (95% CI 0.9196–0.9196) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| risk_nlp | 0.1874 ± 0.0186 (95% CI 0.1787–0.1961) | 0.9229 ± 0.0511 (95% CI 0.8990–0.9468) | 0.3113 ± 0.0277 (95% CI 0.2984–0.3243) | 4.84% ± 0.43% (95% CI 4.63%–5.04%) | 0.3939 ± 0.0277 (95% CI 0.3809–0.4069) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| risk_graph | 0.7660 ± 0.0733 (95% CI 0.7317–0.8003) | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.8657 ± 0.0465 (95% CI 0.8439–0.8874) | 0.38% ± 0.15% (95% CI 0.31%–0.45%) | 0.9790 ± 0.0178 (95% CI 0.9707–0.9873) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| nlp_graph | 0.2071 ± 0.0159 (95% CI 0.1997–0.2145) | 0.9896 ± 0.0185 (95% CI 0.9809–0.9982) | 0.3422 ± 0.0216 (95% CI 0.3321–0.3523) | 4.58% ± 0.44% (95% CI 4.37%–4.78%) | 0.4437 ± 0.0248 (95% CI 0.4321–0.4554) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |
| combined | 0.1998 ± 0.0148 (95% CI 0.1929–0.2068) | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.3329 ± 0.0204 (95% CI 0.3233–0.3424) | 4.84% ± 0.43% (95% CI 4.63%–5.04%) | 0.4438 ± 0.0247 (95% CI 0.4322–0.4554) (prev 1.19% ± 0.00% (95% CI 1.19%–1.19%)) |

### Scenario-family recall and hard-negative FPR (held-out)

**Per-family recall** (subset of FRAUD customers per injected family, combined condition):

| Family | Total | Detected | Recall |
| --- | --- | --- | --- |
| burst_refund | 40 | 40 | 100.00% |
| noisy_ring | 140 | 140 | 100.00% |
| obvious_ring | 120 | 120 | 100.00% |
| rotating_ip_ring | 100 | 100 | 100.00% |
| slow_burn_ring | 80 | 80 | 100.00% |

**Hard-negative FPR by legitimate group** (combined condition):

| Group | Total | False positives | FPR |
| --- | --- | --- | --- |
| LEGITIMATE_HIGH_REFUND_RATE | 3616 | 1383 | 38.25% |
| LEGITIMATE_HOSTEL | 1078 | 4 | 0.37% |
| LEGITIMATE_HOUSEHOLD | 3224 | 14 | 0.43% |
| LEGITIMATE_NORMAL | 32371 | 1905 | 5.88% |
| LEGITIMATE_OFFICE | 2087 | 8 | 0.38% |
| LEGITIMATE_WHOLESALER | 1240 | 3 | 0.24% |

## Ring-level metrics

Ring recovery is Jaccard overlap between an injected ground-truth ring and the best detected ring (score ≥ ring threshold). Overlap thresholds are a benchmark convention (0.3 / 0.5 / 0.7).

### Development

| Overlap threshold | Recovered | Total | Recovery rate |
| --- | --- | --- | --- |
| 0.3 | 40 | 40 | 100.00% |
| 0.5 | 40 | 40 | 100.00% |
| 0.7 | 40 | 40 | 100.00% |

### Held-out

| Overlap threshold | Recovered | Total | Recovery rate |
| --- | --- | --- | --- |
| 0.3 | 80 | 80 | 100.00% |
| 0.5 | 80 | 80 | 100.00% |
| 0.7 | 80 | 80 | 100.00% |

## Lead time (held-out)

| Metric | Value |
| --- | --- |
| Detection rate (mean ± sd) | 93.75% ± 11.11% |
| Number of missed rings | 5 |
| Median lead time over detected rings (mean ± sd, days) | 47.1608 ± 37.4789 |

Per-ring lead-time tables are written to `docs/results/leadtime-per-ring-<seed>.json`.

## Engine ablation (held-out)

The combined condition couples risk + NLP + graph. Ablating engines isolates each family's contribution on held-out seeds.

| Condition | Precision | Recall | F1 | FPR | PR-AUC |
| --- | --- | --- | --- | --- | --- |
| risk_only | 0.7523 ± 0.0721 (95% CI 0.7186–0.7861) | 0.9229 ± 0.0511 (95% CI 0.8990–0.9468) | 0.8258 ± 0.0401 (95% CI 0.8070–0.8445) | 0.38% ± 0.15% (95% CI 0.31%–0.45%) | 0.9417 ± 0.0307 (95% CI 0.9273–0.9561) |
| nlp_only | 0.1368 ± 0.0172 (95% CI 0.1288–0.1449) | 0.6000 ± 0.0513 (95% CI 0.5760–0.6240) | 0.2226 ± 0.0253 (95% CI 0.2108–0.2345) | 4.58% ± 0.44% (95% CI 4.37%–4.78%) | 0.3798 ± 0.0286 (95% CI 0.3664–0.3931) |
| graph_only | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.9167 ± 0.0000 (95% CI 0.9167–0.9167) | 0.9565 ± 0.0000 (95% CI 0.9565–0.9565) | 0.00% ± 0.00% (95% CI 0.00%–0.00%) | 0.9196 ± 0.0001 (95% CI 0.9196–0.9196) |
| risk_nlp | 0.1874 ± 0.0186 (95% CI 0.1787–0.1961) | 0.9229 ± 0.0511 (95% CI 0.8990–0.9468) | 0.3113 ± 0.0277 (95% CI 0.2984–0.3243) | 4.84% ± 0.43% (95% CI 4.63%–5.04%) | 0.3939 ± 0.0277 (95% CI 0.3809–0.4069) |
| risk_graph | 0.7660 ± 0.0733 (95% CI 0.7317–0.8003) | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.8657 ± 0.0465 (95% CI 0.8439–0.8874) | 0.38% ± 0.15% (95% CI 0.31%–0.45%) | 0.9790 ± 0.0178 (95% CI 0.9707–0.9873) |
| nlp_graph | 0.2071 ± 0.0159 (95% CI 0.1997–0.2145) | 0.9896 ± 0.0185 (95% CI 0.9809–0.9982) | 0.3422 ± 0.0216 (95% CI 0.3321–0.3523) | 4.58% ± 0.44% (95% CI 4.37%–4.78%) | 0.4437 ± 0.0248 (95% CI 0.4321–0.4554) |
| combined | 0.1998 ± 0.0148 (95% CI 0.1929–0.2068) | 1.0000 ± 0.0000 (95% CI 1.0000–1.0000) | 0.3329 ± 0.0204 (95% CI 0.3233–0.3424) | 4.84% ± 0.43% (95% CI 4.63%–5.04%) | 0.4438 ± 0.0247 (95% CI 0.4322–0.4554) |

## Ring-escalation experiment

Compares the backend `computeOverallRisk` rule ("critical ring member ⇒ CRITICAL") against variants on held-out seeds. Default behavior is not modified.

| Mode | Recall | FPR | High-refund FPR |
| --- | --- | --- | --- |
| critical_bootstrap | 100.00% ± 0.00% | 1.04% ± 0.40% | 38.20% ± 3.19% |
| no_critical_bootstrap | 100.00% ± 0.00% | 1.04% ± 0.40% | 38.20% ± 3.19% |
| no_ring_escalation | 92.29% ± 5.11% | 0.38% ± 0.15% | 38.20% ± 3.19% |

## Unseen scenario family

Family: **subset_shared_resource** (8 members; only 4 share an IP; unique devices; varied refund reasons). Evaluated once with the frozen config.

| Condition | Precision | Recall | F1 | FPR |
| --- | --- | --- | --- | --- |
| risk_only | 0.0000 | 0.0000 | 0.0000 | 0.55% |
| nlp_only | 0.0417 | 0.5000 | 0.0769 | 4.60% |
| graph_only | 0.0000 | 0.0000 | 0.0000 | 0.00% |
| risk_nlp | 0.0388 | 0.5000 | 0.0721 | 4.95% |
| risk_graph | 0.0000 | 0.0000 | 0.0000 | 0.55% |
| nlp_graph | 0.0417 | 0.5000 | 0.0769 | 4.60% |
| combined | 0.0388 | 0.5000 | 0.0721 | 4.95% |

Member-level recall for the unseen family under the combined condition: 50.00% (4/8).

## Limitations

- Synthetic, seeded injection into UCI background data; generalization to real-world fraud posture is not measured.
- Held-out seeds share the same scenario families as development; performance on a genuinely novel family is reported separately (unseen experiment above).
- PR-AUC ranking score is a heuristic monotone score, not a calibrated probability.
- Ring confidence thresholds are evaluation-layer choices, not detector configuration changes.
- The set of legitimate-hard-negative groups is defined by the generator distribution (household/office/hostel/wholesaler/normal/high-refund).

## Reproducibility

1. `npm run eval:report` regenerates every dataset deterministically.
2. Engine configuration and thresholds are frozen via a sha256 recorded in `docs/results/config.json`.
3. Per-seed driver data and feature caches live under `data/generated/eval/` (gitignored).
4. All aggregates in this document come from `docs/results/*.json` produced by the orchestrator.
