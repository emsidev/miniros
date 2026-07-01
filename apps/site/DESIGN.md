# MINIROS Site Design

## Source Language

This design system is derived from:

- the six MINIROS product screenshots in `apps/site/public`
- the product objective documented in `docs/mvp-documentation.md`
- the requested landing-page rhythm inspired by `kwentado.vercel.app`

The page should borrow section pacing from the reference site, but the visual language must come from MINIROS itself.

## Visual Direction

- Atmosphere: warm, premium, grounded, operational
- Mood: clean mobile utility with editorial spacing
- Tone: decisive, calm, practical
- Avoid: generic startup gradients, heavy dashboards, noisy icon rows, or enterprise-blue defaults

## Core Palette

- Background: warm off-white / oat
- Primary text: deep charcoal
- Utility surfaces: near-black
- Accent: acid lime / chartreuse
- Supporting tints: soft gray, muted green, muted red only when tied to status

These colors come directly from the screenshots:

- off-white app canvas
- dark summary and POS surfaces
- lime CTA and status emphasis
- subtle neutral cards and separators

## Typography

- Use one modern geometric sans family with a strong editorial scale
- Headlines should feel large, tight, and confident
- Body copy should remain highly readable on mobile and laptop widths
- Avoid overly compressed headings or multi-line hero walls

## Shape Language

- Large rounded containers
- Soft nested cards
- Rounded pill CTAs and filters
- No harsh borders or sharp corners
- Device screenshots should retain their existing phone framing and shadow

## Component Guidance

### Header

- Floating detached navigation
- Clean wordmark
- One decisive CTA

### Hero

- Large statement headline
- Supporting copy that explains the product outcome
- Stacked phone screenshots as proof
- Avoid fake metrics or hero badge clutter

### Workflow

- Step-based storytelling
- Each step paired with a real UI screenshot
- The screenshots should demonstrate the actual product progression

### Feature Area

- Use a restrained bento layout
- Keep copy concise
- Let screenshots carry credibility

### Profitability Section

- Use a dark high-contrast surface
- Make the "rent again" decision feel like the payoff
- Combine the location list and detailed verdict view

### FAQ

- Native, quiet, readable accordions
- No ornamental complexity

## Motion

- Motion should support hierarchy, not compete with it
- Use GSAP for reveal timing and scroll-driven polish
- Keep motion heavier and smoother on large sections
- Keep interaction feedback quick and subtle
- Respect `prefers-reduced-motion`

## Responsive Rules

- Desktop can use asymmetry and layered screenshot compositions
- Mobile should collapse into a single column with clean spacing
- Screenshot clarity is more important than preserving decorative overlap
- Full-height sections should use `min-height: 100dvh` behavior only where helpful; avoid brittle viewport traps

## Content Styling Rules

- Focus on operational outcomes
- Avoid feature-list inflation
- Keep copy grounded in selling shifts, costs, stock, and location profitability
- Use the tagline "Track profit, not just sales." as the central verbal anchor
