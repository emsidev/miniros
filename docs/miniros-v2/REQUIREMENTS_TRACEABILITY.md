# Requirements traceability

These IDs identify the agreed product requirements, not source citations. All mapped tests must be implemented or explicitly recorded blocked.

| Requirement | Contract | Plans | Key acceptance tests |
|---|---|---|---|
| R-01 | Owner schedules only date/time, venue/address and assigned staff | EP01, EP06 | EP06-T01, EP17-T03, EP19-T05 |
| R-02 | Reusable checklist configured once; equipment presence is not stock consumption | EP06, EP08 | EP06-T02, EP08-T01, EP08-T02 |
| R-03 | Staff enters actual opening quantities with categories/search/Uncounted | EP09, EP17 | EP09-T01, EP09-T02, EP09-T07, EP17-T04 |
| R-04 | Opening observation is not a purchase or duplicate central inventory | EP03, EP09 | EP09-T05 |
| R-05 | Automatic offline catalog/checklist/schedule snapshots, no owner-built package | EP06, EP07 | EP07-T01, EP07-T03, EP07-T05 |
| R-06 | Cashier and prep on Android/iOS communicate with no internet | EP02, EP11, EP19 | EP02-T01, EP11-T01, EP19-T02 |
| R-07 | Durable atomic local sales/drafts with restart recovery | EP04, EP10 | EP04-T01, EP04-T02, EP10-T03, EP10-T04 |
| R-08 | Local save, peer delivery, cloud delivery and media are independent | EP10, EP11, EP13 | EP10-T02, EP11-T01, EP13-T01, EP13-T03 |
| R-09 | Expected stock, refunds, remakes and prepared batches reconcile | EP03, EP12 | EP03-T01, EP03-T05, EP12-T01, EP12-T02, EP12-T06 |
| R-10 | Owner visibility is live when reachable and honest when stale | EP14 | EP14-T01, EP14-T02, EP14-T04, EP14-T07 |
| R-11 | Offline closing; actual and expected counts remain distinct | EP15 | EP15-T01, EP15-T02, EP15-T04 |
| R-12 | QR fallback transfers the same data once with truthful receipts | EP16 | EP16-T01, EP16-T02, EP16-T03, EP16-T05 |
| R-13 | Tenant/role/device security and offline-auth boundaries | EP05, EP07, EP13, EP18 | EP05-T03, EP05-T04, EP07-T04, EP13-T04, EP13-T05, EP18-T04 |
| R-14 | No unproven auto-failover or invented lost records | EP02, EP11, EP19 | EP11-T07, EP19-T06 |
| R-15 | Existing Miniros data/code preserved through staged migration | EP00, EP18 | EP00-T04, EP18-T01, EP18-T02, EP18-T05 |
| R-16 | Real agents, tests and independent evidence—not mock completion | EP00, EP18, EP19 | EP00-T01, EP18-T03, EP19-T06 |
| R-17 | Staff simplicity/accessibility rather than generic admin screens | EP01, EP17 | EP01-T02, EP17-T01, EP17-T02, EP17-T07 |
| R-18 | Planned times do not silently lock active work; timezone/version semantics | EP01, EP06, EP07 | EP01-T01, EP06-T04, EP07-T05 |
