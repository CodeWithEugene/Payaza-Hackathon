import { pdfText } from "../text";
import {
  CONTENT_TOP,
  INK,
  MARGIN,
  MUTED,
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
import { drawFacts, drawParagraph, drawParties, drawTotals, type Fact } from "./blocks";
import { drawTable } from "./table";

/**
 * Invoice PDF. Every money value arrives pre-formatted (lib/money/format on
 * the server), so this builder never touches amounts numerically.
 */
export interface InvoicePdfData extends StampOptions {
  business: { name: string; country?: string | null };
  buyer: {
    name: string;
    country?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  number: string;
  statusLabel: string;
  issuedLabel: string;
  dueLabel: string;
  currency: string;
  items: { description: string; qty: string; unitPrice: string; lineTotal: string }[];
  totalDisplay: string;
  paidDisplay?: string | null;
  balanceDisplay?: string | null;
  notes?: string | null;
  paymentUrl?: string | null;
  feeNote?: string | null;
  generatedAt?: Date;
}

const ITEM_COLUMNS = [
  { key: "description", header: "Description" },
  { key: "qty", header: "Qty", align: "right" as const },
  { key: "unitPrice", header: "Unit Price", align: "right" as const },
  { key: "lineTotal", header: "Amount", align: "right" as const },
];

export function buildInvoicePdf(data: InvoicePdfData): ArrayBuffer {
  const generatedAt = data.generatedAt ?? new Date();
  const doc = newDoc("portrait");
  const header = { title: "Invoice", subtitle: data.number };
  setMeta(doc, `Invoice ${data.number}`, `Invoice from ${data.business.name}`);
  drawHeader(doc, header);

  let y = CONTENT_TOP;
  y = drawParties(
    doc,
    [
      { heading: "From", lines: [data.business.name, data.business.country] },
      {
        heading: "Billed To",
        lines: data.buyer
          ? [data.buyer.name, data.buyer.country, data.buyer.email, data.buyer.phone]
          : ["Buyer details unavailable"],
      },
    ],
    y,
  );

  const facts: Fact[] = [
    { label: "Invoice Number", value: data.number },
    { label: "Status", value: data.statusLabel },
    { label: "Issued", value: data.issuedLabel },
    { label: "Due", value: data.dueLabel },
  ];
  y = drawFacts(doc, facts, y);

  y = sectionTitle(doc, "Items", y + 2);
  const rows =
    data.items.length > 0
      ? data.items
      : [{ description: "Invoice total", qty: "1", unitPrice: data.totalDisplay, lineTotal: data.totalDisplay }];
  y = drawTable(doc, { columns: ITEM_COLUMNS, rows, startY: y, header });

  // Last line is emphasised: the balance when payments exist, else the total.
  const totals: Fact[] = data.paidDisplay
    ? [
        { label: `Invoice Total (${data.currency})`, value: data.totalDisplay },
        { label: "Paid So Far", value: data.paidDisplay },
        ...(data.balanceDisplay ? [{ label: "Balance Due", value: data.balanceDisplay }] : []),
      ]
    : [{ label: `Total (${data.currency})`, value: data.totalDisplay }];
  y = ensureSpace(doc, y, 30, header);
  y = drawTotals(doc, totals, y + 4);

  if (data.paymentUrl) {
    y = ensureSpace(doc, y, 24, header);
    y = sectionTitle(doc, "Pay Online", y + 2);
    y = drawParagraph(
      doc,
      "Pay securely by card or mobile money through Payaza at the link below.",
      y,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    setColor(doc, INK, "text");
    const url = pdfText(data.paymentUrl);
    const { width } = pageSize(doc);
    const lines = doc.splitTextToSize(url, width - MARGIN * 2) as string[];
    doc.textWithLink(lines[0] ?? url, MARGIN, y, { url: data.paymentUrl });
    y += 8;
  }

  if (data.feeNote) {
    y = ensureSpace(doc, y, 12, header);
    y = drawParagraph(doc, data.feeNote, y, 8.5);
  }

  if (data.notes) {
    y = ensureSpace(doc, y, 20, header);
    y = sectionTitle(doc, "Notes", y + 2);
    y = drawParagraph(doc, data.notes, y);
  }

  y = ensureSpace(doc, y, 12, header);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setColor(doc, MUTED, "text");
  doc.text(
    pdfText(`Questions about this invoice? Contact ${data.business.name} directly.`),
    MARGIN,
    y + 4,
  );

  drawFooters(doc, generatedAt, data);
  return toArrayBuffer(doc);
}
