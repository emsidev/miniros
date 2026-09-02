export const meta = {
  title: "MINIROS | Track profit, not just sales.",
  description:
    "MINIROS helps pop-up sellers and small retail teams connect sales, stock, costs, closeout, and location profit so they can decide where to sell again.",
};

export const screens = {
  startShiftStock: "/Employee%20_%20Start%20Shift%201.png",
  startShiftFloat: "/Employee%20_%20Start%20Shift%202.png",
  shifts: "/Employee%20_%20Shifts.png",
  sell: "/Employee%20_%20Sell.png",
  locations: "/Admin%20_%20Location%20Profitability%201.png",
  locationAnalysis: "/Admin%20_%20Location%20Profitability%202.png",
};

export const navItems = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Profitability", href: "#profitability" },
  { label: "FAQ", href: "#faq" },
];

export const audiences = [
  "Pop-up sellers",
  "Bazaar teams",
  "Booth operators",
  "Kiosk owners",
];

export const hiddenCosts = [
  ["Location", "Rent and event fees"],
  ["Movement", "Transport and delivery"],
  ["People", "Staffing and shift pay"],
  ["Stock", "Product cost, waste, and adjustments"],
  ["Closeout", "Cash differences and deductions"],
] as const;

export const workflowSteps = [
  {
    number: "1",
    title: "Start shift",
    headline: "Set the opening record before the booth gets busy.",
    body: "Record starting stock, cash float, staff, and location costs from one clean baseline.",
    image: screens.startShiftStock,
    alt: "MINIROS start shift screen for recording opening stock",
  },
  {
    number: "2",
    title: "Sell",
    headline: "Keep the checkout focused on the next customer.",
    body: "Build the order from live sellable stock, then take cash, digital, or split payments without separating the sale from its proof and stock movement.",
    image: screens.sell,
    alt: "Implemented MINIROS mobile point-of-sale showing an order and payment method",
  },
  {
    number: "3",
    title: "Track operations",
    headline: "Keep production and inventory tied to the live shift.",
    body: "Stock, recipes, and production records move with the selling day instead of becoming end-of-day guesswork.",
    image: screens.startShiftFloat,
    alt: "MINIROS shift setup screen for recording the cash float",
  },
  {
    number: "4",
    title: "Close shift",
    headline: "Reconcile while the details are still fresh.",
    body: "Bring cash, non-cash payments, leftovers, deductions, and closeout notes into one guided record.",
    image: screens.shifts,
    alt: "MINIROS employee shifts and closeout screen",
  },
] as const;

export const capabilityGroups = [
  {
    title: "Run the selling shift",
    description: "The operator tools needed from opening through checkout.",
    items: ["Shift start and assignments", "Mobile POS", "Payments and proofs"],
  },
  {
    title: "Account for stock",
    description:
      "A continuous record of what came in, moved, sold, or changed.",
    items: ["Inventory items", "Recipes and deductions", "Production logs"],
  },
  {
    title: "Close with real costs",
    description:
      "The expenses and reconciliation details a sales total misses.",
    items: [
      "Rent and transport",
      "Staff and cash deductions",
      "Shift closeout",
    ],
  },
  {
    title: "Decide where to return",
    description:
      "Reporting shaped around location profitability, not vanity totals.",
    items: ["Profit and loss", "Location comparison", "Rent-again verdict"],
  },
] as const;

export const faqs = [
  {
    question: "Will MINIROS work offline?",
    answer:
      "The operator workflow is designed for unreliable booth internet. Core selling actions are queued locally and synchronized when a connection returns.",
  },
  {
    question: "Can the team use it on a phone?",
    answer:
      "Yes. Employee and operator workflows are mobile-first. Owners and admins also get a wider workspace for setup, reporting, and profitability review.",
  },
  {
    question: "What does MINIROS replace?",
    answer:
      "It brings the operating record now split across a POS, spreadsheets, chat, photos, and paper notes into one shift-centered system.",
  },
  {
    question: "What is the main business answer?",
    answer:
      "MINIROS shows whether a selling location made money after recorded product, staff, rent, transport, and shift costs—and whether it is worth renting again.",
  },
] as const;
