"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatAmountMinor } from "@/components/money/amount";

/**
 * Chart islands for /app/analytics. Recharts is client-only (hooks + DOM
 * measurement), so the Server Component page computes honest data and passes
 * serializable rows + chartConfig (colors via var(--chart-1..5) only).
 */

const compactFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export interface DailyPoint {
  /** Axis label, e.g. "12 Mar". */
  day: string;
  /** Integer MINOR units — exact money, used for the tooltip. */
  minor: number;
  /** major units (minor / 10^decimals) — display-only chart coordinate. */
  total: number;
}

export interface ChannelPoint {
  channel: string;
  count: number;
}

export interface StatusPoint {
  status: string;
  label: string;
  count: number;
}

export function CollectionsAreaChart({
  data,
  config,
  currency,
}: {
  data: DailyPoint[];
  config: ChartConfig;
  currency: string;
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-64 w-full">
      <AreaChart accessibilityLayer data={data} margin={{ left: -8, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="collectionsAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-total)" stopOpacity={0.7} />
            <stop offset="95%" stopColor="var(--color-total)" stopOpacity={0.08} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(value) => compactFormatter.format(Number(value))}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              formatter={(_value, _name, item) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">Collected</span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {formatAmountMinor(
                      Number((item?.payload as DailyPoint | undefined)?.minor ?? 0),
                      currency,
                    )}
                  </span>
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="total"
          type="monotone"
          stroke="var(--color-total)"
          strokeWidth={2}
          fill="url(#collectionsAreaFill)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function ChannelPieChart({
  data,
  config,
}: {
  data: ChannelPoint[];
  config: ChartConfig;
}) {
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent nameKey="channel" hideLabel indicator="dot" />}
        />
        <Pie
          data={data}
          dataKey="count"
          nameKey="channel"
          cx="50%"
          cy="44%"
          innerRadius={52}
          outerRadius={80}
          paddingAngle={2}
          strokeWidth={2}
        >
          {data.map((d) => (
            <Cell key={d.channel} fill={`var(--color-${d.channel})`} />
          ))}
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="channel" />} />
      </PieChart>
    </ChartContainer>
  );
}

export function StatusBarChart({
  data,
  config,
}: {
  data: StatusPoint[];
  config: ChartConfig;
}) {
  const height = Math.max(180, data.length * 34 + 24);
  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={112}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel indicator="line" />}
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ChartContainer>
  );
}
