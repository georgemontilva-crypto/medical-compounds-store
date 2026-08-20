import { useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import {
  ANALYTICS_RANGES,
  ANALYTICS_RANGE_KEYS,
  DEFAULT_RANGE,
  type AnalyticsRange,
  type SalesGranularity,
} from "@shared/analytics";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  AlertCircle,
  Info,
} from "lucide-react";

/** Matches the status badge colours used on the orders list. */
const STATUS_FILL: Record<string, string> = {
  pending: "#eab308",
  confirmed: "#3b82f6",
  processing: "#d3c4ab",
  shipped: "#baac96",
  delivered: "#22c55e",
  cancelled: "#ef4444",
};

const money = (n: number) => `$${n.toFixed(2)}`;

export default function AdminAnalytics() {
  const [range, setRange] = useState<AnalyticsRange>(DEFAULT_RANGE);
  const [granularity, setGranularity] = useState<SalesGranularity | undefined>(undefined);

  const summary = trpc.analytics.summary.useQuery({ range });
  const sales = trpc.analytics.salesOverTime.useQuery({ range, granularity });
  const productsQuery = trpc.analytics.products.useQuery({ range, limit: 8 });

  // Changing the window changes which granularity makes sense, so the manual
  // override is dropped rather than carried into a range it does not suit.
  const selectRange = (next: AnalyticsRange) => {
    setRange(next);
    setGranularity(undefined);
  };

  const activeGranularity = sales.data?.granularity ?? ANALYTICS_RANGES[range].granularity;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="lab-section-title mb-1">Reporting</p>
            <h1 className="text-2xl font-bold">Analytics</h1>
          </div>
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-secondary/60">
            {ANALYTICS_RANGE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => selectRange(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  range === key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ANALYTICS_RANGES[key].label}
              </button>
            ))}
          </div>
        </div>

        <MoneyNote />

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Revenue"
            value={money(summary.data?.revenue.revenue ?? 0)}
            icon={DollarSign}
            tone="text-green-600"
            bg="bg-green-50"
            loading={summary.isLoading}
          />
          <MetricCard
            label="Average order"
            value={money(summary.data?.revenue.averageOrderValue ?? 0)}
            icon={Receipt}
            tone="text-blue-600"
            bg="bg-blue-50"
            loading={summary.isLoading}
          />
          <MetricCard
            label="Paid orders"
            value={String(summary.data?.revenue.orders ?? 0)}
            icon={ShoppingCart}
            tone="text-[#d3c4ab]"
            bg="bg-[#f2ede6]"
            loading={summary.isLoading}
          />
          <MetricCard
            label="Abandoned checkouts"
            value={String(summary.data?.abandoned.count ?? 0)}
            icon={AlertCircle}
            tone="text-amber-600"
            bg="bg-amber-50"
            loading={summary.isLoading}
          />
        </div>

        {/* Sales over time */}
        <ChartCard
          title="Sales over time"
          note="Paid orders only, dated by when payment settled."
          action={
            <div className="flex gap-1 p-1 rounded-lg bg-secondary/60">
              {(["day", "week", "month"] as SalesGranularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    activeGranularity === g
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          }
        >
          {sales.isLoading ? (
            <ChartSkeleton />
          ) : (sales.data?.points.length ?? 0) === 0 ? (
            <EmptyState message="No paid orders in this window yet." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={sales.data?.points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                  tickFormatter={(v: number) => `$${v}`}
                  width={56}
                />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === "revenue" ? [money(value), "Revenue"] : [value, "Orders"]
                  }
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#baac96"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Orders by status */}
          <ChartCard
            title="Orders by status"
            note="Every order in the window, paid or not — this is the fulfilment queue, not revenue."
          >
            {summary.isLoading ? (
              <ChartSkeleton />
            ) : (summary.data?.statuses.reduce((n, s) => n + s.count, 0) ?? 0) === 0 ? (
              <EmptyState message="No orders in this window yet." />
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={summary.data?.statuses.filter((s) => s.count > 0)}
                      dataKey="count"
                      nameKey="status"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {summary.data?.statuses
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <Cell key={s.status} fill={STATUS_FILL[s.status] ?? "#9ca3af"} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <ul className="w-full sm:w-40 space-y-1.5 flex-shrink-0">
                  {summary.data?.statuses.map((s) => (
                    <li key={s.status} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: STATUS_FILL[s.status] }}
                      />
                      <span className="capitalize flex-1 text-muted-foreground">{s.status}</span>
                      <span className="font-medium tabular-nums">{s.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ChartCard>

          {/* Customer mix */}
          <ChartCard
            title="New vs returning customers"
            note="Counted across all time by shipping email, so guest orders are included. Not limited to the selected window."
          >
            {summary.isLoading ? (
              <ChartSkeleton />
            ) : (summary.data?.customers.oneOrder ?? 0) +
                (summary.data?.customers.returning ?? 0) ===
              0 ? (
              <EmptyState message="No paid customers yet." />
            ) : (
              <div className="space-y-4 py-2">
                <SplitBar
                  oneOrder={summary.data?.customers.oneOrder ?? 0}
                  returning={summary.data?.customers.returning ?? 0}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="lab-card p-4">
                    <p className="text-2xl font-bold tabular-nums">
                      {summary.data?.customers.oneOrder ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">One order</p>
                  </div>
                  <div className="lab-card p-4">
                    <p className="text-2xl font-bold tabular-nums">
                      {summary.data?.customers.returning ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Two or more</p>
                  </div>
                </div>
              </div>
            )}
          </ChartCard>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <ProductRankCard
            title="Best sellers"
            note="By units, from paid orders in this window."
            icon={TrendingUp}
            rows={productsQuery.data?.top}
            loading={productsQuery.isLoading}
            emptyMessage="Nothing sold in this window yet."
          />
          <ProductRankCard
            title="Slowest movers"
            note="Includes products with no sales at all in this window."
            icon={TrendingDown}
            rows={productsQuery.data?.slowest}
            loading={productsQuery.isLoading}
            emptyMessage="No products yet."
          />
        </div>

        {/* Abandoned checkouts */}
        <ChartCard
          title="Abandoned checkouts"
          note={`Orders that reached the payment step and were never paid, after a ${
            summary.data?.graceHours ?? 2
          }-hour grace period. Carts abandoned before checkout leave no record and are not counted.`}
        >
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {summary.data?.abandoned.count ?? 0}
              </p>
              <p className="text-sm text-muted-foreground">Unpaid checkouts</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {money(summary.data?.abandoned.value ?? 0)}
              </p>
              <p className="text-sm text-muted-foreground">Recoverable value</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {summary.data?.conversionRate == null
                  ? "—"
                  : `${(summary.data.conversionRate * 100).toFixed(0)}%`}
              </p>
              <p className="text-sm text-muted-foreground">Checkout conversion</p>
            </div>
          </div>

          {(summary.data?.abandoned.failed ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground mb-4">
              Plus {summary.data?.abandoned.failed} order
              {summary.data?.abandoned.failed === 1 ? "" : "s"} where the card was declined —
              counted separately, since that is a payment problem rather than a change of mind.
            </p>
          )}

          {(summary.data?.recentAbandoned.length ?? 0) > 0 ? (
            <div className="border-t border-border pt-4">
              <p className="lab-section-title mb-3">Recovery queue</p>
              <ul className="space-y-2">
                {summary.data?.recentAbandoned.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`}>
                      <div className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-secondary/60 transition-colors cursor-pointer">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Order #{o.id}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {o.email ?? "no email on file"}
                          </p>
                        </div>
                        <span className="text-sm font-medium tabular-nums flex-shrink-0">
                          {money(o.total)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            !summary.isLoading && (
              <div className="border-t border-border pt-4">
                <EmptyState message="Nothing waiting to be recovered." />
              </div>
            )
          )}
        </ChartCard>
      </div>
    </AdminLayout>
  );
}

function MoneyNote() {
  return (
    <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50 text-xs text-muted-foreground">
      <Info size={14} className="flex-shrink-0 mt-0.5" />
      <p>
        Revenue figures count paid orders only — refunded and failed payments are excluded. Orders
        placed before payment timestamps were recorded are dated by when they were placed.
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
  bg,
  loading,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone: string;
  bg: string;
  loading: boolean;
}) {
  return (
    <div className="lab-card p-5">
      <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
        <Icon size={18} className={tone} />
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {loading ? (
          <span className="inline-block w-16 h-6 bg-secondary rounded animate-pulse" />
        ) : (
          value
        )}
      </p>
      <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function ChartCard({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="lab-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{note}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-[200px] rounded-xl bg-secondary/60 animate-pulse" />;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-[160px] flex items-center justify-center text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function SplitBar({ oneOrder, returning }: { oneOrder: number; returning: number }) {
  const total = oneOrder + returning;
  const returningPct = total === 0 ? 0 : (returning / total) * 100;

  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-secondary">
        <div className="bg-[#d3c4ab]" style={{ width: `${100 - returningPct}%` }} />
        <div className="bg-green-600" style={{ width: `${returningPct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {returningPct.toFixed(0)}% of paying customers have ordered more than once.
      </p>
    </div>
  );
}

function ProductRankCard({
  title,
  note,
  icon: Icon,
  rows,
  loading,
  emptyMessage,
}: {
  title: string;
  note: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  rows: Array<{ productId: number; name: string; units: number; revenue: number }> | undefined;
  loading: boolean;
  emptyMessage: string;
}) {
  const hasRows = (rows?.length ?? 0) > 0;

  return (
    <div className="lab-card p-5">
      <div className="flex items-start gap-2 mb-4">
        <Icon size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{note}</p>
        </div>
      </div>

      {loading ? (
        <ChartSkeleton />
      ) : !hasRows ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={Math.max(120, (rows?.length ?? 0) * 34)}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ left: 4, right: 44, top: 4, bottom: 4 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 11 }}
                stroke="currentColor"
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "units" ? [value, "Units"] : [money(value), "Revenue"]
                }
                contentStyle={{ borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="units" fill="#baac96" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
          <ul className="mt-3 space-y-1 border-t border-border pt-3">
            {rows?.map((r) => (
              <li key={r.productId} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{r.name}</span>
                <span className="flex-shrink-0 tabular-nums">
                  {r.units} · {money(r.revenue)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
