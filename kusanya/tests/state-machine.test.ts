import { describe, it, expect } from "vitest";
import {
  assertTxnTransition,
  assertInvoiceTransition,
  isTerminalTxn,
  collectionCodeToTxnStatus,
  payoutRawToTxnStatus,
  collectionWebhookToTxnStatus,
  transferWebhookToTxnStatus,
  invoiceStatusAfterCollection,
  invoiceStatusAfterPayout,
  type TxnStatus,
  type InvoiceStatus,
} from "@/lib/payaza/state-machine";

describe("transaction state machine", () => {
  it("legal transitions do not throw", () => {
    const legal: [TxnStatus, TxnStatus][] = [
      ["initialized", "pending"],
      ["initialized", "completed"],
      ["initialized", "failed"],
      ["pending", "completed"],
      ["pending", "failed"],
      ["pending", "reversed"],
      ["completed", "reversed"], // refunds/chargebacks
      ["escrow", "completed"],
      ["escrow", "reversed"],
      ["escrow", "failed"],
    ];
    for (const [from, to] of legal) expect(() => assertTxnTransition(from, to)).not.toThrow();
  });

  it("same-status re-delivery is an idempotent no-op", () => {
    expect(() => assertTxnTransition("completed", "completed")).not.toThrow();
    expect(() => assertTxnTransition("failed", "failed")).not.toThrow();
  });

  it("ILLEGAL transitions throw", () => {
    const illegal: [TxnStatus, TxnStatus][] = [
      ["failed", "completed"], // never resurrect a failure
      ["completed", "pending"],
      ["completed", "failed"],
      ["reversed", "completed"],
      ["pending", "initialized"],
    ];
    for (const [from, to] of illegal) expect(() => assertTxnTransition(from, to)).toThrow(/illegal transaction transition/);
  });

  it("terminal statuses", () => {
    expect(isTerminalTxn("completed")).toBe(true);
    expect(isTerminalTxn("failed")).toBe(true);
    expect(isTerminalTxn("reversed")).toBe(true);
    expect(isTerminalTxn("pending")).toBe(false);
    expect(isTerminalTxn("escrow")).toBe(false);
  });
});

describe("invoice state machine", () => {
  it("the golden path is legal end-to-end", () => {
    const path: InvoiceStatus[] = [
      "draft", "ready", "sent", "partially_paid", "paid",
      "settling", "settled", "paying_out", "completed",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(() => assertInvoiceTransition(path[i]!, path[i + 1]!)).not.toThrow();
    }
  });

  it("review/hold branches resolve back into the flow", () => {
    expect(() => assertInvoiceTransition("draft", "review")).not.toThrow();
    expect(() => assertInvoiceTransition("review", "ready")).not.toThrow();
    expect(() => assertInvoiceTransition("review", "on_hold")).not.toThrow();
    expect(() => assertInvoiceTransition("on_hold", "review")).not.toThrow();
    expect(() => assertInvoiceTransition("on_hold", "sent")).not.toThrow();
    expect(() => assertInvoiceTransition("paying_out", "settled")).not.toThrow(); // payout fail → retryable
  });

  it("ILLEGAL transitions throw", () => {
    const illegal: [InvoiceStatus, InvoiceStatus][] = [
      ["sent", "completed"], // no shortcuts — money must actually move
      ["draft", "paid"],
      ["completed", "paid"],
      ["cancelled", "ready"],
      ["failed", "sent"],
      ["settled", "sent"],
      ["partially_paid", "settled"],
    ];
    for (const [from, to] of illegal) expect(() => assertInvoiceTransition(from, to)).toThrow(/illegal invoice transition/);
  });

  it("same status is idempotent (duplicate webhooks)", () => {
    expect(() => assertInvoiceTransition("paid", "paid")).not.toThrow();
    expect(() => assertInvoiceTransition("sent", "sent")).not.toThrow();
  });
});

describe("Payaza raw statuses → ours", () => {
  it("collection response codes", () => {
    expect(collectionCodeToTxnStatus("09")).toBe("pending"); // prompt sent — happy path
    expect(collectionCodeToTxnStatus("00")).toBe("completed");
    expect(collectionCodeToTxnStatus("06")).toBe("failed");
    expect(collectionCodeToTxnStatus("99")).toBe("failed"); // unknown → fail-closed
  });

  it("collection message fallbacks for odd codes", () => {
    expect(collectionCodeToTxnStatus("XX", "Transaction is PENDING")).toBe("pending");
    expect(collectionCodeToTxnStatus("XX", "SUCCESS")).toBe("completed");
    expect(collectionCodeToTxnStatus("XX", "Weird")).toBe("failed");
  });

  it("payout/transfer raw statuses", () => {
    expect(payoutRawToTxnStatus("TRANSACTION_INITIATED")).toBe("initialized");
    expect(payoutRawToTxnStatus("NIP_PENDING")).toBe("pending");
    expect(payoutRawToTxnStatus("NIP_SUCCESS")).toBe("completed");
    expect(payoutRawToTxnStatus("NIP_FAILURE")).toBe("failed");
    expect(payoutRawToTxnStatus("ESCROW_SUCCESS")).toBe("escrow");
    // unknown → pending: keep polling, NEVER fake-complete
    expect(payoutRawToTxnStatus("SOMETHING_NEW")).toBe("pending");
  });

  it("webhook event statuses", () => {
    expect(collectionWebhookToTxnStatus("Funds Received")).toBe("completed");
    expect(collectionWebhookToTxnStatus("Transaction Failed")).toBe("failed");
    expect(transferWebhookToTxnStatus("NIP_SUCCESS")).toBe("completed");
  });
});

describe("collection/payout → invoice status derivation", () => {
  it("EXACT payment → paid, no alert", () => {
    expect(invoiceStatusAfterCollection("EXACT")).toEqual({ status: "paid", needsMerchantAlert: false });
    expect(invoiceStatusAfterCollection(null)).toEqual({ status: "paid", needsMerchantAlert: false });
  });
  it("UNDERPAYMENT → partially_paid + merchant alert (never auto-complete)", () => {
    expect(invoiceStatusAfterCollection("UNDERPAYMENT")).toEqual({ status: "partially_paid", needsMerchantAlert: true });
  });
  it("OVERPAYMENT → paid + merchant alert (surplus flagged)", () => {
    expect(invoiceStatusAfterCollection("OVERPAYMENT")).toEqual({ status: "paid", needsMerchantAlert: true });
  });
  it("payout outcomes", () => {
    expect(invoiceStatusAfterPayout("completed")).toBe("completed");
    expect(invoiceStatusAfterPayout("failed")).toBe("settled"); // retryable
    expect(invoiceStatusAfterPayout("pending")).toBe("paying_out");
  });
});
