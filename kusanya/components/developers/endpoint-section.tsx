import { Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EndpointDoc, ParamDoc } from "@/lib/developers/endpoints";
import { buildSnippets } from "@/lib/developers/snippets";
import { ERROR_CODES } from "@/lib/api/v1/envelope";
import { cn } from "@/lib/utils";
import { CodeBlock } from "./code-block";
import { CodeTabs } from "./code-tabs";
import { RichText } from "./rich-text";

export function MethodBadge({ method, className }: { method: "GET" | "POST"; className?: string }) {
  return (
    <Badge
      variant={method === "GET" ? "secondary" : "default"}
      className={cn("rounded-md font-mono text-[0.7rem] font-semibold", className)}
    >
      {method}
    </Badge>
  );
}

export function EndpointPath({ method, path }: { method: "GET" | "POST"; path: string }) {
  return (
    <div className="bg-muted/60 border-border flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2">
      <MethodBadge method={method} />
      <code className="truncate font-mono text-sm">/api/v1{path}</code>
    </div>
  );
}

export function ParamTable({ title, params }: { title: string; params: ParamDoc[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="border-border overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Name</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {params.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="align-top">
                  <div className="flex flex-col gap-1">
                    <code className="font-mono text-xs font-semibold">{p.name}</code>
                    <span className="text-muted-foreground font-mono text-[0.7rem]">{p.type}</span>
                    {p.required ? (
                      <Badge variant="outline" className="text-[0.65rem]">
                        Required
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top text-sm whitespace-normal">
                  <p className="text-pretty">
                    <RichText text={p.description} />
                  </p>
                  {p.enum ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.enum.map((v) => (
                        <code key={v} className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.7rem]">
                          {v}
                        </code>
                      ))}
                    </div>
                  ) : null}
                  {p.default !== undefined ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Default: <code className="font-mono">{String(p.default)}</code>
                    </p>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function EndpointSection({ endpoint, baseUrl }: { endpoint: EndpointDoc; baseUrl: string }) {
  const snippets = buildSnippets({
    method: endpoint.method,
    url: `${baseUrl}${endpoint.path.replace("{id}", endpoint.exampleId ?? "inv_01k6c3v9r8x2m4n6p8q0s2t4v6")}${endpoint.exampleQuery ?? ""}`,
    body: endpoint.requestExample,
    auth: endpoint.auth,
  });

  return (
    <section id={endpoint.id} className="flex scroll-mt-24 flex-col gap-5">
      <Separator />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-heading text-xl font-semibold tracking-tight">{endpoint.title}</h3>
          <Badge variant="outline" className="gap-1">
            {endpoint.auth ? <Lock data-icon="inline-start" /> : <Unlock data-icon="inline-start" />}
            {endpoint.auth ? "API Key" : "Public"}
          </Badge>
        </div>
        <EndpointPath method={endpoint.method} path={endpoint.path} />
        <p className="text-foreground text-pretty">{endpoint.summary}</p>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="text-muted-foreground flex flex-col gap-2 text-sm leading-relaxed">
            {endpoint.description.map((para) => (
              <p key={para} className="text-pretty">
                <RichText text={para} />
              </p>
            ))}
          </div>
          {endpoint.pathParams?.length ? <ParamTable title="Path Parameters" params={endpoint.pathParams} /> : null}
          {endpoint.queryParams?.length ? <ParamTable title="Query Parameters" params={endpoint.queryParams} /> : null}
          {endpoint.bodyParams?.length ? <ParamTable title="Body Parameters" params={endpoint.bodyParams} /> : null}
          {endpoint.errors.length ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold">Errors</h4>
              <div className="flex flex-wrap gap-1.5">
                {endpoint.errors.map((code) => (
                  <Badge key={code} variant="outline" className="font-mono text-[0.7rem]">
                    {ERROR_CODES[code]} {code}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Request</h4>
            <CodeTabs snippets={snippets} />
          </div>
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Response</h4>
            <CodeBlock
              caption={`${endpoint.responseStatus} ${endpoint.responseStatus === 201 ? "Created" : "OK"}`}
              code={JSON.stringify(endpoint.responseExample, null, 2)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
