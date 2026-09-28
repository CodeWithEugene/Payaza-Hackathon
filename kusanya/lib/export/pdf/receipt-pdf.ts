import { pdfText } from "../text";
import type { ExportColumn, ExportRow } from "../types";
import {
  CONTENT_TOP,
  INK,
  MARGIN,
  MUTED,
  RULE,
  drawFooters,
  drawHeader,
  ensureSpace,
  newDoc,
  pageSize,
  sectionTitle,
  setColor,
  setMeta,
  toArrayBuffer,
  type StampOptions,
} from "./brand";
import { drawFacts, drawParagraph, drawParties } from "./blocks";
import { drawTable } from "./table";

/**
 * Payment receipt. Two audiences share one layout:
 *  - "merchant": includes Payaza fees and net amounts where known.
 *  - "buyer": buyer-safe fields only (no fees, nets, risk or audit data).
 * Money values arrive pre-formatted; amounts are listed per currency and
 * never summed across currencies.
 */
export interface ReceiptPayment {
  dateLabel: string;
  method: string;
  merchantReference: string;
  payazaReference?: string | null;
  amount: string;
  fee?: string | null;
  net?: string | null;
}

export interface ReceiptPdfData extends StampOptions {
  audience: "merchant" | "buyer";
  business: { name: string; country?: string | null };
  buyer: { name: string; country?: string | null } | null;
  invoiceNumber: string;
  invoiceTotalDisplay: string;
  statusLabel: string;
  /** One entry per currency, e.g. ["USD 1,150.00"]. */
  receivedTotals: string[];
  paidOnLabel: string;
  payments: ReceiptPayment[];
  balanceDisplay?: string | null;
  generatedAt?: Date;
}

function paymentColumns(audience: ReceiptPdfData["audience"]): ExportColumn[] {
  const base: ExportColumn[] = [
    { key: "dateLabel", header: "Date" },
    { key: "method", header: "Method" },
    { key: "references", header: "Reference" },
    { key: "amount", header: "Amount", align: "right" },
  ];
  if (audience === "buyer") return base;
  return [
    ...base,
    { key: "fee", header: "Payaza Fee", align: "right" },
    { key: "net", header: "Net", align: "right" },
  ];
}

function paymentRows(payments: ReceiptPayment[]): ExportRow[] {
  return payments.map((p) => ({
    dateLabel: p.dateLabel,
    method: p.method,
    references: p.payazaReference
      ? `${p.merchantReference}\nPayaza ${p.payazaReference}`
      : p.merchantReference,
    amount: p.amount,
    fee: p.fee ?? "Not reported",
    net: p.net ?? "Not reported",
  }));
}

export function receiptNumber(invoiceNumber: string): string {
  return `RCPT-${invoiceNumber}`;
}

export function buildReceiptPdf(data: ReceiptPdfData): ArrayBuffer {
  const generatedAt = data.generatedAt ?? new Date();
  const doc = newDoc("portrait");
  const number = receiptNumber(data.invoiceNumber);
  const header = { title: "Payment Receipt", subtitle: number };
  setMeta(doc, `Receipt ${number}`, `Payment receipt for invoice ${data.invoiceNumber}`);
  drawHeader(doc, header);
  const { width } = pageSize(doc);

  // Amount received hero.
  let y = CONTENT_TOP;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  setColor(doc, MUTED, "text");
  doc.text("AMOUNT RECEIVED", MARGIN, y);
  y += 9;
  doc.setFontSize(22);
  setColor(doc, INK, "text");
  const totals = data.receivedTotals.length > 0 ? data.receivedTotals : ["Nothing received yet"];
  totals.forEach((t) => {
    doc.text(pdfText(t), MARGIN, y);
    y += 9;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(doc, MUTED, "text");
  doc.text(pdfText(`Paid on ${data.paidOnLabel} · Invoice ${data.invoiceNumber}`), MARGIN, y - 3);

  // "Paid" pill on the right.
  const pill = data.balanceDisplay ? "PART PAID" : "PAID";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const pillW = doc.getTextWidth(pill) + 8;
  setColor(doc, INK, "draw");
  doc.setLineWidth(0.5);
  doc.roundedRect(width - MARGIN - pillW, CONTENT_TOP - 4, pillW, 8, 2, 2, "S");
  setColor(doc, INK, "text");
  doc.text(pill, width - MARGIN - pillW / 2, CONTENT_TOP + 1.3, { align: "center" });

  y += 4;
  setColor(doc, RULE, "draw");
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, width - MARGIN, y);
  y += 8;

  y = drawParties(
    doc,
    [
      { heading: "Received By", lines: [data.business.name, data.business.country] },
      {
        heading: "Paid By",
        lines: data.buyer ? [data.buyer.name, data.buyer.country] : ["Buyer"],
      },
    ],
    y,
  );

  y = drawFacts(
    doc,
    [
      { label: "Receipt Number", value: number },
      { label: "Invoice", value: data.invoiceNumber },
      { label: "Invoice Total", value: data.invoiceTotalDisplay },
      { label: "Status", value: data.statusLabel },
    ],
    y,
  );

  y = sectionTitle(doc, "Payment Details", y + 2);
  y = drawTable(doc, {
    columns: paymentColumns(data.audience),
    rows: paymentRows(data.payments),
    startY: y,
    header,
  });

  if (data.balanceDisplay) {
    y = ensureSpace(doc, y, 12, header);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    setColor(doc, INK, "text");
    doc.text("Balance Remaining", MARGIN, y + 2);
    doc.text(pdfText(data.balanceDisplay), width - MARGIN, y + 2, { align: "right" });
    y += 10;
  }

  y = ensureSpace(doc, y, 20, header);
  const note =
    data.audience === "merchant"
      ? "Amounts, fees and nets are shown exactly as Payaza reported them. Fees show as not reported until Payaza confirms them."
      : `This receipt confirms the payment above was received by ${data.business.name} through Payaza. Keep it for your records.`;
  drawParagraph(doc, note, y + 2, 8.5);

  drawFooters(doc, generatedAt, data);
  return toArrayBuffer(doc);
}
