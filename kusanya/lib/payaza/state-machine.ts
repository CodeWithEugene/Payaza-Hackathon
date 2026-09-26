/**
 * Unified transaction + invoice state machine (build.md §6.5).
 * Pure functions — unit-tested exhaustively incl. illegal transitions (§13).
 * Illegal transitions THROW; callers audit-log the attempt.
 */

export type TxnStatus =
  | "initialized"
  | "pending"
  | "completed"
  | "failed"
  | "reversed"
  | "escrow";

export type InvoiceStatus =
  | "draft"
  | "ready"
  | "sent"
  | "partially_paid"
  | "paid"
  | "settling"
  | "settled"
  | "paying_out"
  | "completed"
  | "failed"
  | "cancelled"
  | "review"
  | "on_hold";

const TXN_TRANSITIONS: Record<TxnStatus, TxnStatus[]> = {
  initialized: ["pending", "completed", "failed"],
  pending: ["completed", "failed", "reversed"],
  completed: ["reversed"], // refunds/chargebacks only
  failed: [],
  reversed: [],
  escrow: ["completed", "reversed", "failed"], // payout ESCROW_SUCCESS resolves
};

const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["ready", "review", "on_hold", "cancelled"],
  ready: ["sent", "review", "on_hold", "cancelled"],
  sent: ["partially_paid", "paid", "failed", "cancelled", "review", "on_hold"],
  partially_paid: ["paid", "failed"],
  paid: ["settling", "settled", "failed"],
  settling: ["settled", "failed"],
  settled: ["paying_out", "completed", "failed"],
  paying_out: ["completed", "failed", "settled"], // payout fail → back to settled (retryable)
  completed: [],
  failed: [],
  cancelled: [],
  review: ["ready", "sent", "on_hold", "cancelled"], // merchant resolved → continue
  on_hold: ["review", "cancelled", "sent"], // compliance released
};

export function assertTxnTransition(from: TxnStatus, to: TxnStatus): void {
  if (from === to) return; // idempotent re-delivery
  if (!TXN_TRANSITIONS[from].includes(to)) {
    throw new Error(`illegal transaction transition: ${from} → ${to}`);
  }
}

export function assertInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): void {
  if (from === to) return;
  if (!INVOICE_TRANSITIONS[from].includes(to)) {
    throw new Error(`illegal invoice transition: ${from} → ${to}`);
  }
}

export function isTerminalTxn(s: TxnStatus): boolean {
  return s === "completed" || s === "failed" || s === "reversed";
}

// ------------------------------------------------- Payaza raw → our statuses --

/**
 * Collection response_code → txn status (research §4.2):
 * "09"/PENDING → pending (prompt sent — the expected happy path)
 * "00" → completed · "06" → failed · everything else → failed (fail-closed).
 */
export function collectionCodeToTxnStatus(
  responseCode: string,
  responseMessage?: string,
): TxnStatus {
  if (responseCode === "09") return "pending";
  if (responseCode === "00") return "completed";
  const msg = (responseMessage ?? "").toUpperCase();
  if (msg.includes("PENDING") || msg.includes("INITIALIZED")) return "pending";
  if (msg.includes("SUCCESS") || msg.includes("COMPLETED")) return "completed";
  return "failed";
}

/**
 * Transfer/payout statuses (research §4.3):
 * TRANSACTION_INITIATED → initialized · NIP_PENDING → pending
 * NIP_SUCCESS → completed · NIP_FAILURE → failed · ESCROW_SUCCESS → escrow.
 */
export function payoutRawToTxnStatus(raw: string): TxnStatus {
  switch (raw.toUpperCase()) {
    case "TRANSACTION_INITIATED":
      return "initialized";
    case "NIP_PENDING":
      return "pending";
    case "NIP_SUCCESS":
      return "completed";
    case "NIP_FAILURE":
      return "failed";
    case "ESCROW_SUCCESS":
      return "escrow";
    default:
      return "pending"; // unknown → keep watching via polling, never fake-complete
  }
}

/** Webhook collection event → txn status. */
export function collectionWebhookToTxnStatus(
  transactionStatus: string,
): TxnStatus {
  return transactionStatus === "Funds Received" ? "completed" : "failed";
}

/** Webhook transfer event → txn status. */
export function transferWebhookToTxnStatus(transactionStatus: string): TxnStatus {
  return payoutRawToTxnStatus(transactionStatus);
}

/**
 * Invoice status derived from a COMPLETED collection + amount_validation
 * (build.md §6.5): UNDERPAYMENT → partially_paid (merchant alert, never
 * auto-complete); OVERPAYMENT → paid (surplus flagged for refund/hold).
 */
export function invoiceStatusAfterCollection(
  amountValidation: string | null | undefined,
): { status: InvoiceStatus; needsMerchantAlert: boolean } {
  switch (amountValidation) {
    case "UNDERPAYMENT":
      return { status: "partially_paid", needsMerchantAlert: true };
    case "OVERPAYMENT":
      return { status: "paid", needsMerchantAlert: true };
    default:
      return { status: "paid", needsMerchantAlert: false };
  }
}

/** After payout completion: invoice → completed; failure → back to settled. */
export function invoiceStatusAfterPayout(payoutTxn: TxnStatus): InvoiceStatus {
  if (payoutTxn === "completed") return "completed";
  if (payoutTxn === "failed") return "settled";
  return "paying_out";
}
