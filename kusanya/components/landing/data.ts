/**
 * Landing page copy and figures. Kept in one place so marketing never drifts
 * from the seeded demo (lib/demo/seed.ts): FreshLeaf Exports Ltd invoices
 * Dubai Fresh FZE for 500 kg of French beans at USD 2.30, KSN-2026-0001,
 * with a 2.5% agent split to Mwalimu Logistics Ltd.
 *
 * Copy rules: headings and button labels in Title Case, body in sentence
 * case, and never an em or en dash in anything a person reads.
 */

/** The buyer message the seeded demo extraction starts from. */
export const DEMO_BUYER_MESSAGE =
  "Hi Wanjiru, please send us 500kg of French beans at USD 2.30 per kg, total USD 1,150. Ship to Dubai Fresh FZE, payment by card within 5 days."

// Static illustrative figures: these EXACTLY match the seeded demo's USD
// 1,150 French-beans order (the one judges open on the invoice detail page),
// computed by the real waterfall engine (buildWaterfall + invoiceWaterfall):
// gross 115000 −Payaza 2185 −Kusanya(1.5% of running) 1692 = 111123 USD minor;
// ×128.90 = 14323755 KES minor; −agent split(2.5%) 358094; −payout fee(1%) 139657
// → 13826004 KES minor = KES 138,260.04. Marketing must not drift from the demo.
export const WATERFALL_ROWS = [
  { label: "Gross invoice", note: "card checkout", value: "USD 1,150.00" },
  {
    label: "Card processing fee",
    note: "Payaza 1.9%, at cost",
    value: "−USD 21.85",
  },
  { label: "Kusanya fee", note: "1.5%", value: "−USD 16.92" },
  { label: "FX conversion", note: "@ 128.90 KES/USD", value: "KES 143,237.55" },
  { label: "Agent split", note: "2.5%", value: "−KES 3,580.94" },
  { label: "Payout fee", note: "M-Pesa 1%", value: "−KES 1,396.57" },
] as const

export const NET_PAYOUT = "KES 138,260.04"
export const AGENT_SPLIT = "KES 3,580.94"

export const EXTRACTED_FIELDS = [
  { label: "Buyer", value: "Dubai Fresh FZE" },
  { label: "Item", value: "French beans (kg)" },
  { label: "Quantity", value: "500" },
  { label: "Unit price", value: "USD 2.30" },
  { label: "Total", value: "USD 1,150.00" },
  { label: "Due", value: "In 5 days" },
] as const

export const RISK_SIGNALS = [
  "First-time buyer",
  "Sanctions lists",
  "Amount anomaly",
  "Payment history",
  "Jurisdiction",
] as const

export const A11Y_OPTIONS = [
  "Larger text",
  "High contrast",
  "Reduce motion",
  "Underline links",
  "Readable spacing",
] as const

export const TRUST_WORDMARKS = [
  { name: "Payaza", className: "font-semibold tracking-tight" },
  { name: "TypeSafe Jev", className: "font-mono font-medium tracking-tight" },
  { name: "M-PESA", className: "font-black tracking-wider" },
  { name: "VISA", className: "font-black italic tracking-widest" },
  { name: "mastercard", className: "font-semibold lowercase tracking-tight" },
  { name: "Apple Pay", className: "font-medium tracking-tight" },
  { name: "Google Pay", className: "font-medium" },
] as const

export const STATS = [
  {
    value: "1.5%",
    label: "Kusanya platform fee",
    detail: "One flat rate, shown on every invoice before it is sent.",
    tone: "text-hero-sun",
  },
  {
    value: "At cost",
    label: "Payaza fees passed through",
    detail: "The card or mobile money fee Payaza charges, with no markup.",
    tone: "text-hero-cyan",
  },
  {
    value: "T+1",
    label: "Local mobile money settlement",
    detail: "KES, UGX and TZS collections settle the next business day.",
    tone: "text-hero-coral",
  },
  {
    value: "T+3 to 5",
    label: "USD card settlement",
    detail: "Business days for international card and wallet payments.",
    tone: "text-hero-violet",
  },
] as const
