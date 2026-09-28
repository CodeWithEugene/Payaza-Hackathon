import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildOpenApiDocument, routeDirForPath } from "@/lib/api/v1/openapi";
import { ENDPOINTS } from "@/lib/developers/endpoints";

const V1_DIR = path.resolve(process.cwd(), "app/api/v1");
const doc = buildOpenApiDocument("https://kusanya.example") as {
  openapi: string;
  info: unknown;
  servers: { url: string }[];
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};

/** All route.ts files under app/api/v1 → OpenAPI style paths. */
function routeFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full, `${prefix}/${entry}`));
    else if (entry === "route.ts") out.push(prefix.replace(/\[(\w+)\]/g, "{$1}"));
  }
  return out;
}

describe("OpenAPI document", () => {
  it("is OpenAPI 3.1 with the deployment server url", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.servers[0]?.url).toBe("https://kusanya.example/api/v1");
  });

  it("documents a route file (with the right HTTP method export) for every path", () => {
    for (const [p, ops] of Object.entries(doc.paths)) {
      const file = path.join(V1_DIR, routeDirForPath(p), "route.ts");
      expect(existsSync(file), `missing route file for ${p}`).toBe(true);
      const source = readFileSync(file, "utf8");
      for (const method of Object.keys(ops)) {
        expect(source, `${p} must export ${method.toUpperCase()}`).toMatch(
          new RegExp(`export (const|async function|function) ${method.toUpperCase()}\\b`),
        );
      }
    }
  });

  it("documents every route file that exists under app/api/v1", () => {
    const documented = new Set(Object.keys(doc.paths));
    for (const route of routeFiles(V1_DIR)) expect(documented.has(route), `undocumented route ${route}`).toBe(true);
  });

  it("has one operation per endpoint in the docs reference", () => {
    const count = Object.values(doc.paths).reduce((n, ops) => n + Object.keys(ops).length, 0);
    expect(count).toBe(ENDPOINTS.length);
    expect(new Set(ENDPOINTS.map((e) => e.operationId)).size).toBe(ENDPOINTS.length);
  });

  it("resolves every $ref to a component schema", () => {
    const refs = JSON.stringify(doc).match(/#\/components\/schemas\/\w+/g) ?? [];
    for (const ref of refs) {
      const name = ref.split("/").pop()!;
      expect(doc.components.schemas[name], `unresolved ${ref}`).toBeDefined();
    }
  });

  it("keeps money fields as integer strings in every example", () => {
    const examples = JSON.stringify(ENDPOINTS.map((e) => [e.requestExample, e.responseExample]));
    const moneyValues = [...examples.matchAll(/"(\w+_minor)":(\S+?)[,}]/g)].map((m) => m[2]);
    expect(moneyValues.length).toBeGreaterThan(0);
    for (const v of moneyValues) expect(v === "null" || /^"\d+"$/.test(v!), `bad money example ${v}`).toBe(true);
  });

  it("uses no em or en dashes in documentation copy", () => {
    const copy = JSON.stringify(ENDPOINTS) + JSON.stringify(doc.info);
    expect(copy).not.toMatch(/[–—]/);
  });
});
