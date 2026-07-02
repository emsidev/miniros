export const meta = {
  title: "MINIROS | Track profit, not just sales.",
  description:
    "MINIROS helps pop-up sellers and small retail teams track sales, payments, inventory, costs, closeout, and location profit so they can know if a booth is worth renting again.",
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
  { label: "Features", href: "#features" },
  { label: "Admin", href: "#admin" },
  { label: "FAQ", href: "#faq" },
];

export const trustMarks = [
  "Bazaar Collective",
  "Kain&Kita",
  "Sari-Suki",
  "Weekend Market",
  "Pop-Up Hustlers",
];

export const problemCards = [
  {
    icon: "✦",
    title: "No true profit per location",
    body: "Rent, transport, staff, and deductions are usually outside the POS.",
  },
  {
    icon: "〰",
    title: "Manual logs and receipts",
    body: "Closeout data lives in photos, paper notes, and separate spreadsheets.",
  },
  {
    icon: "◌",
    title: "Inventory usage is hard to trace",
    body: "Opening stock, production, sold items, and leftover counts drift apart.",
  },
  {
    icon: "◎",
    title: "Staff and transport costs get overlooked",
    body: "The booth looks busy but margin can disappear after real expenses.",
  },
  {
    icon: "□",
    title: "No clear rent-again answer",
    body: "Owners need a verdict, not another exported report to interpret.",
  },
];

export const workflowSteps = [
  {
    number: "1",
    title: "Start shift",
    headline: "Set stock and cash before the booth opens.",
    body: "Lock in opening stock and float first so the shift starts from a clean baseline.",
    image: screens.startShiftStock,
    alt: "MINIROS employee start shift stock screen",
  },
  {
    number: "2",
    title: "Sell",
    headline: "Take orders fast, even when the payment mix changes.",
    body: "Use one selling flow for cash, digital payments, split payments, and proof capture.",
    image: screens.sell,
    alt: "MINIROS employee sell screen",
  },
  {
    number: "3",
    title: "Track",
    headline: "Let inventory move while the shift is still active.",
    body: "Sales and production records update stock in real time instead of waiting for end-of-day cleanup.",
    image: screens.startShiftFloat,
    alt: "MINIROS start shift cash float screen",
  },
  {
    number: "4",
    title: "Manage costs",
    headline: "Keep rent, transport, and labor on the same shift record.",
    body: "Attach deductions to the live booth day so profit is not calculated from partial numbers later.",
    image: screens.locations,
    alt: "MINIROS admin locations screen",
  },
  {
    number: "5",
    title: "Close shift",
    headline: "Reconcile the booth before the details go missing.",
    body: "Close out cash, non-cash payments, leftovers, and totals from one workflow before the team leaves.",
    image: screens.shifts,
    alt: "MINIROS employee shifts screen",
  },
  {
    number: "6",
    title: "See profit",
    headline: "Finish with a real rent-again verdict.",
    body: "See whether the location actually made money after sales, stock movement, and booth costs are all counted.",
    image: screens.locationAnalysis,
    alt: "MINIROS admin location analysis screen",
  },
];

export const modules = [
  {
    icon: "⚡",
    title: "Start Shift",
    body: "Fast, simple, and works offline.",
  },
  {
    icon: "📦",
    title: "Inventory & Recipes",
    body: "Track items, recipes, and auto-deductions.",
  },
  {
    icon: "🧑‍🤝‍🧑",
    title: "Shift Management",
    body: "Assign staff and track every shift.",
  },
  {
    icon: "🧾",
    title: "Payments & Proofs",
    body: "Cash, non-cash, split, and proof uploads.",
  },
  {
    icon: "🥐",
    title: "Production",
    body: "Log production and manage supplies.",
  },
  {
    icon: "🧮",
    title: "Costs & Deductions",
    body: "Rent, transport, staff, and other expenses.",
  },
  {
    icon: "✅",
    title: "Closeout & Reconcile",
    body: "Cash reconciliation and closeout workflow.",
  },
  {
    icon: "📈",
    title: "Reports & Profitability",
    body: "Real profit per shift and per location.",
  },
];

export const adminScreens = [
  {
    title: "Admin Dashboard",
    label: "Today",
    metric: "₱18,420",
    body: "Sales, gross profit, closeout status, and active shifts in one view.",
  },
  {
    title: "Locations / Booth Profitability",
    label: "Verdict",
    metric: "Rent again",
    body: "Compare locations by margin, rent, shift cost, and repeat potential.",
  },
  {
    title: "Inventory & Recipes",
    label: "Stock",
    metric: "94% synced",
    body: "Manage products, recipes, supplies, and inventory movement.",
  },
  {
    title: "Shifts & Staff",
    label: "Coverage",
    metric: "6 shifts",
    body: "Plan assignments, operators, payroll inputs, and attendance signals.",
  },
  {
    title: "Costs / Deductions",
    label: "Expenses",
    metric: "₱3,250",
    body: "Track rent, transport, staff costs, damaged items, and other deductions.",
  },
  {
    title: "Reports & Closeout",
    label: "Status",
    metric: "5 closed",
    body: "Review shift closeout, payment proof, and profit/loss reports.",
  },
];

export const metrics = [
  {
    value: "42%",
    label: "average profit margin improvement target",
  },
  {
    value: "2.1x",
    label: "faster closeout workflow target",
  },
  {
    value: "-67%",
    label: "fewer inventory discrepancy target",
  },
];

export const faqs = [
  {
    question: "Will MINIROS work offline?",
    answer:
      "The core direction is offline-first shift selling. Operators should be able to keep selling during weak booth internet, then sync when the connection returns.",
  },
  {
    question: "Can I use it on my phone?",
    answer:
      "Yes. The operator flow is mobile-first for phones and tablets. Admin users get a cleaner web workspace for setup, reporting, and location profitability.",
  },
  {
    question: "Is there a product available now?",
    answer:
      "Not yet. MINIROS is preparing early access, so the current call to action is to join the early access list instead of installing or starting a trial.",
  },
  {
    question: "What is the main business question it answers?",
    answer:
      "MINIROS answers whether a selling location actually made money and whether it is worth renting again.",
  },
];
