---
name: MINIROS
register: product
platform: web
status: mvp
---

# MINIROS Product Context

## Product

MINIROS is a mobile-first retail operations system for pop-up sellers, booth sellers, bazaar sellers, kiosks, and small retail teams. It connects shift setup, selling, inventory, production, closeout, and location profitability so an owner can answer two questions quickly:

- Did this selling location actually make money?
- Should I rent this location again?

The central promise is **“Track profit, not just sales.”** MINIROS is a focused operating tool, not a generic ERP, e-commerce suite, or enterprise dashboard.

## Audience and Setting

- Owners reviewing profitability on a phone, tablet, or laptop after a selling shift.
- Operators completing sales and shift tasks at bright booths, bazaars, kiosks, and temporary locations.
- Employees recording inventory, production, and closeout details while moving quickly.

The interface must remain readable in bright ambient light, support touch-first work, and make operational status and next actions immediately clear.

## Product Surfaces

- `apps/web`: authenticated Next.js product app and compact authentication gateway.
- `apps/site`: Astro marketing site that explains the real operating workflow using product screenshots.
- `apps/mobile`: Expo shell; currently aligned to shared tokens but not a full production surface.

Product UI follows the product register: familiar controls, restrained color, fixed type scale, and state-driven motion. The public site follows the brand register: stronger composition and pacing, but the same tokens and voice.

## Experience Principles

1. **Operational truth first.** Emphasize shift status, money, stock movement, closeout, and the rent-again decision.
2. **One action hierarchy.** Every screen has one clear primary action; chartreuse is rare enough to remain meaningful.
3. **Familiar under pressure.** Use standard controls, visible focus, generous touch targets, and predictable navigation.
4. **Dense when useful.** Prefer structured lists, tables, and definition groups over decorative cards.
5. **Explain empty states.** Empty, loading, and error states must teach the next step rather than merely report absence.

## Scope Guardrails

- Keep MVP features focused on shift selling, inventory, production, closeout, and location profitability.
- Do not duplicate employee and operator route trees; use roles and permissions.
- Keep business rules out of React components.
- Preserve existing workflow semantics, data contracts, and server behavior during visual work.
- Do not add a dark-mode feature, Storybook, or a public design-system route in this phase.

## Voice

Clear, practical, calm, and decisive. Use the language of shifts, costs, stock, closeouts, and locations. Avoid enterprise jargon, inflated feature claims, ironic design commentary, or generic SaaS copy.
