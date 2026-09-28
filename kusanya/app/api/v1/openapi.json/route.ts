import { env } from "@/lib/config/env";
import { buildOpenApiDocument } from "@/lib/api/v1/openapi";

/** GET /api/v1/openapi.json — public OpenAPI 3.1 document (no auth). */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(buildOpenApiDocument(env.NEXT_PUBLIC_APP_URL), {
    headers: {
      "Cache-Control": "public, max-age=300",
      // Public document: allow spec viewers and code generators to fetch it.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
