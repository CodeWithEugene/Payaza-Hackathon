/**
 * Code sample generation for the API reference: cURL, JavaScript fetch and
 * Python requests, all reading the key from the KUSANYA_API_KEY env var.
 */

export interface SnippetRequest {
  method: "GET" | "POST";
  /** Absolute URL including any example query string. */
  url: string;
  body?: unknown;
  auth?: boolean;
}

export interface Snippets {
  curl: string;
  javascript: string;
  python: string;
}

function toPython(value: unknown, indent = 0): string {
  const pad = "    ".repeat(indent + 1);
  const close = "    ".repeat(indent);
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((v) => `${pad}${toPython(v, indent + 1)}`).join(",\n")},\n${close}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  return `{\n${entries.map(([k, v]) => `${pad}${JSON.stringify(k)}: ${toPython(v, indent + 1)}`).join(",\n")},\n${close}}`;
}

function indentJson(value: unknown, spaces: number): string {
  return JSON.stringify(value, null, 2).replace(/\n/g, `\n${" ".repeat(spaces)}`);
}

export function buildSnippets(req: SnippetRequest): Snippets {
  const auth = req.auth !== false;
  const hasBody = req.body !== undefined;

  const curlLines = [`curl${req.method === "GET" ? "" : ` -X ${req.method}`} "${req.url}"`];
  if (auth) curlLines.push(`  -H "Authorization: Bearer $KUSANYA_API_KEY"`);
  if (hasBody) {
    curlLines.push(`  -H "Content-Type: application/json"`);
    curlLines.push(`  -d '${JSON.stringify(req.body, null, 2).replace(/'/g, "'\\''")}'`);
  }
  const curl = curlLines.join(" \\\n");

  const jsHeaders: string[] = [];
  if (auth) jsHeaders.push("    Authorization: `Bearer ${process.env.KUSANYA_API_KEY}`,");
  if (hasBody) jsHeaders.push(`    "Content-Type": "application/json",`);
  const jsOptions = [`  method: "${req.method}",`];
  if (jsHeaders.length) jsOptions.push(`  headers: {\n${jsHeaders.join("\n")}\n  },`);
  if (hasBody) jsOptions.push(`  body: JSON.stringify(${indentJson(req.body, 2)}),`);
  const javascript = [
    `const res = await fetch("${req.url}", {`,
    ...jsOptions,
    "});",
    ...(auth
      ? [
          "const { data, error } = await res.json();",
          "if (error) throw new Error(`${error.code}: ${error.message}`);",
          "console.log(data);",
        ]
      : ["const spec = await res.json();", "console.log(spec.info.title, spec.info.version);"]),
  ].join("\n");

  const pyArgs = [`    "${req.url}",`];
  if (auth) pyArgs.push(`    headers={"Authorization": f"Bearer {os.environ['KUSANYA_API_KEY']}"},`);
  if (hasBody) pyArgs.push(`    json=${toPython(req.body, 1)},`);
  pyArgs.push("    timeout=30,");
  const python = [
    ...(auth ? ["import os"] : []),
    "import requests",
    "",
    `res = requests.${req.method.toLowerCase()}(`,
    ...pyArgs,
    ")",
    "body = res.json()",
    ...(auth
      ? [
          'if body["error"]:',
          '    raise RuntimeError(f"{body[\'error\'][\'code\']}: {body[\'error\'][\'message\']}")',
          'print(body["data"])',
        ]
      : ['print(body["info"]["title"], body["info"]["version"])']),
  ].join("\n");

  return { curl, javascript, python };
}
