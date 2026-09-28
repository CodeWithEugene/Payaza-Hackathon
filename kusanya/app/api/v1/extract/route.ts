import { apiRoute, parseJsonBody } from "@/lib/api/v1/handler";
import { extractBodySchema } from "@/lib/api/v1/schemas";
import { ok } from "@/lib/api/v1/envelope";
import { apiExtract } from "@/lib/services/api-v1";

/** POST /api/v1/extract — chat order text → structured invoice fields. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = apiRoute(
  async (ctx) => {
    const { text } = await parseJsonBody(ctx.req, extractBodySchema);
    return ok(await apiExtract(ctx, text));
  },
  { limiter: "extract" },
);
