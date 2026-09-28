"use client";

/** Save a Blob as a file via a temporary object URL (browser only). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function pdfBlob(buf: ArrayBuffer): Blob {
  return new Blob([buf], { type: "application/pdf" });
}
