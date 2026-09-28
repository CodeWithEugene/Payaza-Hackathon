import "server-only";
import { safeFilename } from "@/lib/export/text";

/**
 * application/pdf download response. The filename is slugged to
 * [a-z0-9._-] so it can never break out of the quoted header value.
 * Documents carry buyer/business data: never cache them in shared caches.
 */
export function pdfResponse(pdf: ArrayBuffer, baseName: string): Response {
  const filename = safeFilename(baseName, "pdf");
  return new Response(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.byteLength),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** True for the IDOR guard's "not in this business" error. */
export function isNotFound(e: unknown): boolean {
  return e instanceof Error && /not found/i.test(e.message);
}
