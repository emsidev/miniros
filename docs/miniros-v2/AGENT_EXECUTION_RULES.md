# Agent execution rules

## Coordinator responsibilities

Use actual available Codex subagents. The lead owns dependencies, product decisions, shared interfaces, integration, evidence and the final status. Specialist roles are assignments, not permission to create a new service for each role. Reuse agents for bounded tasks; start with at most three concurrent subagents. Prefer two independent implementers plus one read-only reviewer, or parallel audit agents during EP00. OpenAI documents explicit delegation and cautions about simultaneous edits [S1].

The roles are:

| Role | Responsibility | Prohibited shortcut |
|---|---|---|
| Lead/integrator | Task graph, ADRs, path ownership, contracts, merges, final validation | Declaring success from worker summaries alone |
| Domain/data | Schemas, recipes, stock, money, state reducers, immutable events | Direct mutable stock overwrites or floating-point money |
| Mobile/connectivity | Native SQLite, enrollment, staff workflow, peer transport | Browser mock presented as native evidence |
| Owner/backend | Setup/scheduling, native API, RLS, cloud replay/dashboard | Service-role key in clients or removal of security checks |
| Independent QA/security | Adversarial tests, regression review, staged evidence | Rubber-stamp approval or modifying assertions just to pass |

A specialist may implement and test its work, but a different agent reviews the result. Security-sensitive grants, transport, journal and migration work require explicit QA/security review.

## Work ownership and context

Before delegation, give each agent: execution-plan ID, prerequisite commit/API versions, exact owned paths, read-only dependencies, required tests, forbidden changes, output format and stop condition. Do not ask every worker to rescan the entire repository. Contracts and fixture definitions are single-writer. Lockfile/dependency changes and migration-number assignment go through the integrator. If two plans need the same route/file, serialize the writes or split an agreed interface first.

Use isolated branches/worktrees when supported and useful; do not assume subagents automatically isolate filesystem writes. Preserve the user's dirty working tree. Do not reset, stash, revert or overwrite unrelated changes without explicit authorization. Merge only tested slices and rerun integration tests after merging. Never allow two native build/Metro or Next production-build tasks to corrupt the same output directory; use isolated build paths/worktrees as needed.

Every plan can be broken into its numbered implementation slices. Finish a small slice, test it, checkpoint it, then continue. Do not parallelize dependent database/API/frontend changes until their shared contract is fixed. Do not start all twenty plans simultaneously.

## Execution loop and status

Initialize `docs/miniros-v2/EXECUTION_STATUS.md`. Track implementation and validation independently:

- Implementation: not started / in progress / code complete / blocked.
- Automated validation: not run / passed / failed / blocked.
- Device/staging validation: not required / not run / passed / failed / blocked.
- Review: pending / changes requested / accepted.

A plan is accepted only when its required evidence exists. Code-complete with device checks blocked is NOT release accepted. Downstream portable work may proceed behind an interface/feature flag when only a hardware gate is pending, but no runtime or transport claim may advance past that gate.

For each slice: reproduce existing behavior where relevant; implement; run focused tests; review; integrate; run affected checks; record evidence. Continue through all unblocked plans during the active task. On real blockers, record exact missing credentials/device/action and continue independent work. Do not end merely with a new roadmap. Do not hide a blocker behind a placeholder page, a passing echo command, or “coming soon.”

At context/session boundaries, persist current commits, file ownership, tests already run, active blockers, and the exact next command/task. Resume from that record instead of repeating all discovery. No fabricated background execution, worker results or test logs.

## Safety and release boundaries

Use disposable local databases and explicitly approved staging. Do not mutate production, push remote commits, apply hosted migrations, publish mobile builds, enable paid services or deploy merely because development is complete. Prepare reviewed commands and obtain the user's specific release authorization. Respect the environment's existing approval/security rules. Do not weaken them to automate more steps.

Never reset Supabase, delete retained IndexedDB/SQLite journals, force-migrate a live open shift, rewrite applied historical migrations, or remove old client compatibility before queued operations are reconciled. Schema changes use an expand/contract plan with old-reader compatibility. A rollout flag affects new shifts, not mid-shift destructive switching.

## Required agent handoff

Return: plan/slice ID; owned and changed paths; concise implementation summary; exact command results with pass/fail/skip counts; tests not run and why; migration/protocol compatibility; security/privacy implications; remaining defects; reviewer findings; evidence artifact paths; commit ID when available. Evidence must name the source commit/build, environment and whether results are automated, simulator, physical-device or hosted-staging observations.

## Persistent instructions

Read existing root/nested `AGENTS.md` before changes. Add a short project-specific pointer to this pack, preserving existing instructions. Do not put this entire pack in `AGENTS.md`; Codex's instruction-discovery size is bounded [S2]. Do not modify global Codex settings or hard-code an assumed model name. Use the current environment's supported subagent controls; report unavailable capabilities honestly.
