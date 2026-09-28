import "server-only";
import { after } from "next/server";

/**
 * Run work after the response without it being frozen on serverless.
 * Inside a request (route handler, server action, or another after()),
 * Next's after() uses Vercel's waitUntil. Outside a request scope (scripts,
 * tests) after() throws, so fall back to a plain timer.
 */
export function runInBackground(task: () => Promise<void>, delayMs = 0): void {
  const run = async () => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      await task();
    } catch (err) {
      console.error("[background] task failed:", err);
    }
  };
  try {
    after(run);
  } catch {
    setTimeout(() => void run(), 0);
  }
}
