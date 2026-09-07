# EP06 — Owner reusable business setup and lightweight shift scheduling

**Implementation prerequisites:** EP03, EP05

**Agent owner:** Owner web agent + domain/UX reviewer

**Proposed file ownership:** apps/web setup/inventory/shift routes and existing server services; shared data schema already owned by EP05. Paths are scoped by the lead after EP00; do not create duplicate modules when equivalents already exist.

## Outcome

Move recurring preparation to business settings and keep every shift schedule short.

## Execution slices

### EP06.1 — independently reviewable slice
Extend existing owner inventory/catalog pages for item categories, units/pack sizes, recipe/packaging relationships and prepared items. Reuse existing product/pricing forms and validation. Do not require rebuilding the catalog to schedule each event.

### EP06.2 — independently reviewable slice
Add an owner-maintained departure checklist in the inventory or shift-settings area: category, label, required count/presence, criticality, display order, optional linked item and exception policy. Equipment can be checklist-only.

### EP06.3 — independently reviewable slice
Implement shift creation/edit with date, planned opening/closing times, venue/address and named cashier/prep assignments only. Automatically reference the business configuration. Validate overlaps/roles and midnight spans with explicit timezone handling.

### EP06.4 — independently reviewable slice
Provide staff-facing upcoming-shift summaries and audit configuration revisions. Template/catalog edits affect future preparation or explicit pre-open refresh, never silently rewrite active shifts.

Implement and validate each slice before integrating it. Tests below apply to the appropriate slice and are rerun at plan integration. Consult the shared contract, agent rules and test strategy; do not weaken them to simplify this plan.

## Acceptance tests

| ID | Evidence tier | Setup / action / fault | Required result |
|---|---|---|---|
| EP06-T01 | W/I | Create a shift using only schedule, venue and assignments. | It saves without selecting products, recipes, opening quantities or per-shift checklist entries. |
| EP06-T02 | W/I | Configure heater/gloves once and create two shifts. | Each preparation gets the reusable template; no repeated owner work. |
| EP06-T03 | I | Change a template or pack conversion after a shift is prepared/open. | Existing version remains stable; a permitted pre-open refresh is explicit. |
| EP06-T04 | W/I | Schedule across midnight and enter an invalid interval/assignment. | Valid dates retain the correct timezone; invalid data has actionable errors, not silent conversion. |
| EP06-T05 | I | Delete/archive a referenced inventory item. | Historic versions remain readable and future catalog readiness flags unresolved dependencies. |
| EP06-T06 | I/S | Have a staff account call owner configuration/scheduling endpoints directly. | Server authorization rejects the action regardless of the UI. |

## Completion gate

Owner usability/permission tests pass, including the explicit absence of per-shift inventory/menu allocation fields.

Record code completion separately from device/staging/pilot acceptance. Attach exact commands/results and independent review to the evidence report. Missing hardware/credentials are explicit blockers; continue only unrelated safe work.

## Rollback / preservation

Keep existing owner master data and historical shift rendering intact; migrate templates additively, not by replacing inventory tables.
