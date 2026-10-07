# RefundGuard Benchmark Dataset - Phase 1C Methodology

## Overview
The RefundGuard benchmark dataset is generated via a deterministic synthetic generator. Phase 1C introduces **deterministic fraud scenario injection** layered on top of the Phase 1B legitimate background dataset (UCI Online Retail II).

## Synthetic vs Real Ground Truth
**Explicit Disclaimer**: The fraud scenarios are completely synthetic and injected. The UCI dataset provides a realistic legitimate background, but it does NOT provide real fraud ground truth. Scenario behavior is specifically designed for controlled benchmark evaluation of the future detection engines, rather than representing real-world fraud prevalence.

## Ground Truth Isolation
Ground truth is fundamentally separate from engine input.
- `ground-truth.json` contains scenario IDs, category labels, and specific memberships.
- Engine input files (`customers.json`, `transactions.json`, `refunds.json`, etc.) do **NOT** contain any ground-truth labels, scenario names, or indicators. 

## Scenario Calibration
Amounts for injected fraud are calibrated deterministically from the legitimate UCI refund distribution (median ~£17, p90 ~£119, p95 ~£299). No obviously fake or massive amounts are used unless they fit the legitimate distribution profile.

## Scenario Families
The framework injects exactly five scenario families:
1. **Obvious Ring**: A coordinated group sharing IP and device resources with identical, synchronized refund behavior.
2. **Noisy Ring**: A fraud ring mixed with legitimate-looking individual activity to mask the coordination.
3. **Rotating-IP Ring**: A coordinated ring where IP sharing changes over time, avoiding single-static-IP rules.
4. **Slow-Burn Ring**: Fraud that develops gradually; starts with legitimate history before escalating into resource sharing and refunds.
5. **Burst Refund**: A concentrated attack utilizing a tight temporal window for refunds.

## Legitimate Hard Negatives
Legitimate hard negatives derived in Phase 1B (households, offices, hostels, wholesalers, legitimate high-refund-rate) are intentionally preserved and completely isolated from fraud scenarios to accurately measure false positive rates during Phase 2.
