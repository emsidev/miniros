# OWPOS flow review and MINIROS response

Reviewed 5 September 2026. This is an observation record, not a claim about OWPOS’s internal architecture or complete product capabilities.

## Scope and evidence

Reviewed public home, features, pricing, signup/sign-in, staff sign-in, recovery, contact, terms and privacy pages, including a 390 × 844 mobile viewport. In the signed-in Free account, inspected POS, product creation, orders and receipt preview, reports, staff, branding/business receipt details, subscription, installation, incoming/QR ordering gates, profile, feedback and help.

An unsaved checkout was tested through tender/change: product “Test” at ₱1, cash tender ₱20, displayed change ₱19. Checkout was cancelled and the empty cart restored. Existing orders were inspected; no new sale was finalized. No account settings, subscription or payment were changed. No free trial appeared in the inspected account. Pro required ₱349/month through manual GCash payment and verification, so paid capabilities were not activated.

Physical installation, real offline transaction recovery, final checkout effects and paid-feature behavior were not tested. Runtime framework, infrastructure and reliability under other conditions are unknown.

## Findings

| Observed behavior                                                                                                 | Strength or gap                                                      | MINIROS response                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Short product → cart → tender flow; Exact and denomination choices                                                | Fast routine checkout                                                | Reuse MINIROS POS; add ₱20/50/100/200/500/1000 shortcuts and Exact without removing split tender, references or proofs.                         |
| Optional stock controls appear progressively in the product form                                                  | Basic setup stays approachable                                       | Business checklist links existing forms; recipes and central production stay optional.                                                          |
| Existing order opens a receipt                                                                                    | Useful transaction recovery                                          | Shift server sale history plus immutable local sale receipts and pending proof status.                                                          |
| Install guidance is available in device settings                                                                  | Clear acquisition into an app-like experience                        | Dedicated Install page, Android prompt, iOS instructions and a durable offline-file readiness check.                                            |
| “Connected” appeared with a previous sync failure; a fresh tab recovered from stale navigation                    | Connectivity alone did not explain saved work status in this session | Display internet availability, pending action count, last successful synchronization and specific blocking errors separately.                   |
| Public acquisition CTAs led to sign-in; mobile navigation omitted destinations                                    | Acquisition intent and discoverability gaps                          | Keep separate registration/login/recovery, connect early-access CTA to registration, add owner mobile tools and shared Help/Install/Sync links. |
| Public pricing described automated payment methods; the signed-in upgrade flow required manual GCash verification | Inconsistent payment expectations                                    | Subscription billing remains deferred; no advertised billing flow in this MVP.                                                                  |
| Help was behind the account menu; help documents Pro profit reports                                               | Help exists, and profit reporting is not absent                      | Task-focused help is visible. Differentiate through location rent, staff/transport costs, shift closeout, inventory and cash reconciliation.    |
| The inspected public viewport disabled zoom; route titles could remain stale                                      | Accessibility and orientation gaps                                   | Preserve browser zoom and meaningful titles on the new destinations.                                                                            |

A transient error observed in one session does not establish OWPOS’s general reliability. The review also does not establish that OWPOS lacks profitability, help, staff, offline support or other paid capabilities.

## Direction adopted

MINIROS retains its typography, colors, shared employee/operator routes and central question: **did this location make money, and should I rent it again?** Customer/QR ordering, SaaS billing and offline central production remain deferred. The implementation uses independently written flows and code; no OWPOS branding, assets or source code were copied.

Sources: [OWPOS pricing](https://owpos.com/pricing), [account plans](https://owpos.com/subscription), [POS](https://owpos.com/pos), [products](https://owpos.com/products), [device installation](https://owpos.com/settings/device), [help](https://owpos.com/help).
