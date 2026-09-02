---
name: MINIROS
description: The Profit Ledger — a decisive operating system for mobile retail teams.
colors:
  ink: "#111318"
  ink-subtle: "#272A32"
  canvas: "#F5F5F5"
  surface: "#FFFFFF"
  surface-muted: "#E9E9E7"
  border: "#D7D7D3"
  muted-foreground: "#5D626C"
  accent: "#D9FF35"
  accent-hover: "#C6EB2E"
  success-surface: "#DCFCE7"
  success-foreground: "#166534"
  warning-surface: "#FEF3C7"
  warning-foreground: "#92400E"
  danger-surface: "#FEE4E2"
  danger-foreground: "#B42318"
  info-surface: "#DBEAFE"
  info-foreground: "#1D4ED8"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
    fontSize: "32px / 42px / 52px / 60px / 80px"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
  ledger-number:
    fontFamily: "Outfit, system-ui, sans-serif"
    fontWeight: 800
    fontVariantNumeric: "tabular-nums lining-nums"
    letterSpacing: "-0.015em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  4xl: "64px"
components:
  button-primary-light:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-dark:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
---

# Design System: MINIROS

## 1. Overview

**Creative North Star: “The Profit Ledger”**

MINIROS should feel like the one operating record a seller trusts after a long market day: clear enough to use at a busy booth, exact enough to support a rent-again decision, and grounded enough that the interface never competes with the work. The product register is restrained and familiar. The marketing register is more composed and expressive, but proves every claim with real product imagery.

The physical scene is a seller using a phone in bright daylight and an owner reviewing closeout numbers later on a laptop. That scene requires a light-first neutral canvas, high-contrast ink, obvious touch targets, and terse state language. The visual system rejects generic SaaS decoration, warm paper-like backgrounds, soft nested cards, and motion that delays the task.

**Key characteristics:** decisive contrast, structured information, touch-first controls, flat surfaces, real screenshots, rare chartreuse emphasis, and clear numeric hierarchy.

### Identity System

The MINIROS mark uses the existing geometric **M** from the application icon. It represents the product name rather than a generic shop symbol and is the only approved app mark.

- **Primary mark:** Ledger Ink tile with a Decision Chartreuse M, used on light product surfaces and the PWA icon.
- **Inverse mark:** Decision Chartreuse tile with a Ledger Ink M, used on dark navigation, marketing headers, and the immersive POS bar.
- **Shape:** 10px corners at standard UI size; keep at least one quarter of the tile width as clear space.
- **Wordmark:** MINIROS is set in Outfit ExtraBold. “Mini Retail Operations System” may appear once as supporting text, never as a repeated eyebrow.
- **Promise:** “Track profit, not just sales.” is the canonical product promise. Do not substitute generic POS or all-in-one-business claims.

Do not use a store, cart, cash register, or unrelated Lucide glyph as the MINIROS logo. Functional icons remain Lucide; brand and action iconography must not be confused.

## 2. Colors

The palette is charcoal, true neutral, and chartreuse. Product screens use a restrained strategy; the public site may commit to charcoal or chartreuse for one narrative surface at a time.

### Primary

- **Ledger Ink** (`#111318`): primary text, light-surface actions, and the dark navigation shell.
- **Decision Chartreuse** (`#D9FF35`): the rent-again verdict, current selection, and the single most important action on a dark surface. It is never body text on light backgrounds.

### Neutral

- **Daylight Canvas** (`#F5F5F5`): light-first application and site background.
- **Clear Surface** (`#FFFFFF`): controls, tables, menus, and true content containers.
- **Working Neutral** (`#E9E9E7`): secondary surfaces and inactive states.
- **Ledger Rule** (`#D7D7D3`): borders and dividers.
- **Secondary Ink** (`#5D626C`): supporting copy; verified above 4.5:1 on the canvas and surface.

### Named Rules

**The Ten Percent Rule.** Chartreuse occupies no more than roughly ten percent of a product screen. Its rarity makes it useful.

**The Semantic Pair Rule.** Success, warning, danger, and info always use their documented background/foreground pairs; color never carries meaning without text or iconography.

## 3. Typography

**Display Font:** Barlow Condensed (with Arial Narrow fallback)
**Body Font:** Outfit (with system-ui fallback)

**Character:** Barlow Condensed gives the public site the directness of market signage and operating labels. Outfit remains in the product because its broad, familiar forms support dense controls and numbers.

### Hierarchy

- **Marketing display scale** (800, 32px / 42px / 52px / 60px / 80px, 0.94): Barlow Condensed only; hero and decisive profitability statements use the larger steps, while mobile headings step down at explicit breakpoints.
- **Headline** (800, 30px, 1.1): product page titles and major marketing subheads.
- **Title** (700, 20px, 1.25): sections, dialogs, and meaningful groups.
- **Body** (400, 16px, 1.55): prose capped at 70ch; compact product copy may use 14px.
- **Label** (600, 14px, 1.3): controls, metadata, and table headings. Sentence case is the default.
- **Ledger number** (800, tabular lining figures, `-0.015em`): prices, totals, cash reconciliation, and profit values. It uses Outfit—not the marketing display face—so operational numbers remain familiar and aligned.

### Named Rules

**The No-Crush Rule.** Display tracking never goes tighter than `-0.04em`; headings use balanced wrapping and body copy uses pretty wrapping.

## 4. Elevation

MINIROS is flat by default. Depth comes from tonal separation and borders. Shadows are reserved for content that physically overlays another layer: dropdowns, popovers, dialogs, toasts, and product screenshots on the public site. A bordered card never receives a wide decorative shadow.

### Shadow Vocabulary

- **Overlay** (`0 4px 8px rgba(17, 19, 24, 0.12)`): menus, popovers, and dialogs without an additional decorative border.
- **Screenshot** (`0 18px 40px rgba(17, 19, 24, 0.18)`): real product imagery only; use as `filter: drop-shadow` when the screenshot has transparent edges.

### Named Rules

**The Flat-at-Rest Rule.** Content surfaces are flat at rest. Hover changes border or tone, not elevation.

## 5. Components

### Buttons

- **Shape:** 10px radius, 44px default touch height; compact desktop controls may use 36px.
- **Primary:** Ledger Ink with white text on light surfaces; Decision Chartreuse with Ledger Ink on dark surfaces.
- **Hover / Focus:** 160ms tone change, 2px visible focus ring with separation from the control, and no decorative scale animation.
- **Secondary / Ghost:** border or tonal treatment, never border plus wide shadow.

### Chips

- **Style:** full-pill shape only because chips are compact metadata. Status chips use semantic color pairs.
- **State:** selection includes label and/or icon; inactive chips never use saturated color.

### Cards / Containers

- **Corner Style:** 14px for cards, 16px for dialogs and major marketing surfaces.
- **Background:** white or a deliberate dark signature surface.
- **Shadow Strategy:** flat by default.
- **Border:** one Ledger Rule border when containment is necessary.
- **Internal Padding:** 16–24px; nested cards are prohibited.

### Inputs / Fields

- **Style:** 44px height, 10px radius, white background, visible label, and full-contrast placeholder text.
- **Focus:** dark border plus separated focus ring.
- **Error / Disabled:** semantic foreground and message for errors; disabled state reduces contrast without hiding the label.

### Navigation

Navigation uses Outfit labels, one active treatment, and standard sidebar or bottom-navigation behavior. The admin sidebar is the persistent dark brand surface; the mobile bottom navigation remains light and touch-first. Dropdowns and dialogs use portals so they cannot be clipped by shell overflow.

### Profit Verdict

The profitability verdict is the signature component. It combines the location name, money result, and explicit rent-again recommendation without a decorative hero-metric scaffold. The verdict must remain understandable without color.

### Point of Sale

POS is an immersive operational surface with its own dark shift-context bar. The location, active status, completed sale count, units sold, and shift sales remain visible without competing with checkout. An explicit exit returns to the shift; mobile bottom navigation remains available.

- **Catalog:** two columns on phones, three on tablets, and up to four in the desktop catalog pane. Category chips scroll horizontally. Search expands on mobile and stays visible on desktop.
- **Stock state:** selected products show a quantity badge. Tracked products show whole sellable availability; zero availability reads “Sold out” and disables the control. Color never carries this state alone.
- **Order surface:** below 1024px, the order is a bottom sheet above navigation. At 1024px and wider it becomes a sticky 390px pane. Both render the same order and tender model.
- **Payment:** Cash, GCash, and Card are the fast choices; Maya, bank transfer, and Other remain under More. A single tender follows the exact total until the operator explicitly enters another amount. Split tender always uses explicit amounts.
- **Progressive detail:** promo/manual discount, cash received, non-cash reference, and optional proof appear only when relevant. The primary action always names the amount: “Charge ₱…”.
- **Completion:** a successful sale becomes a receipt in the same order surface. Proof upload failure never reverses the sale and provides an explicit retry action.

## 6. Do's and Don'ts

### Do:

- **Do** use lists, tables, and definition groups for operational records.
- **Do** keep product color restrained and reserve chartreuse for decisions and current state.
- **Do** show real product screenshots on marketing surfaces.
- **Do** provide default, hover, focus, active, disabled, loading, empty, and error states.
- **Do** test at 360, 768, 1024, and 1440px with long names and large currency values.
- **Do** use the canonical M mark variants consistently across the product, marketing site, PWA, and mobile shell.
- **Do** keep exact tender, stock limits, loading, and proof status explicit in POS.

### Don't:

- **Don't** use warm cream, sand, paper, parchment, or beige as the canvas.
- **Don't** use gradient text, decorative grid or stripe backgrounds, ambient blobs, or glassmorphism.
- **Don't** repeat tiny uppercase tracked eyebrows above sections.
- **Don't** use identical icon-heading-text card grids or nested cards.
- **Don't** use a colored side stripe, a border plus a wide shadow, or non-pill radii above 16px.
- **Don't** animate every section on scroll or use bounce and elastic easing.
- **Don't** turn MINIROS into a generic ERP, e-commerce suite, or enterprise dashboard.
- **Don't** use a generic store icon as the MINIROS identity or introduce a third font for money.
- **Don't** place advanced tender fields in the default checkout path when they are not relevant.
