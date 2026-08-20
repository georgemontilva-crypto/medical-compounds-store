import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { buildReferralShareUrl } from "@/lib/referral";
import {
  MIN_PAYOUT_AMOUNT,
  REFERRAL_COMMISSION_PERCENT,
  REFERRAL_DISCOUNT_PERCENT,
  AFFILIATE_UI_ENABLED,
} from "@shared/affiliate";
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  DollarSign,
  Loader2,
  Package,
  Share2,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-[#f2ede6] text-[#d3c4ab]",
  shipped: "bg-[#d0f0ed] text-[#baac96]",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const REFERRAL_STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting payment", className: "bg-yellow-100 text-yellow-700" },
  eligible: { label: "Eligible", className: "bg-green-100 text-green-700" },
  paid: { label: "Paid out", className: "bg-blue-100 text-blue-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-600" },
};

export default function MyAccount() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthContext();

  const { data: stats } = trpc.account.stats.useQuery(undefined, { enabled: isAuthenticated });
  const { data: orders } = trpc.orders.myOrders.useQuery(undefined, { enabled: isAuthenticated });

  if (authLoading) {
    return (
      <div className="container py-12">
        <div className="lab-card p-8 animate-pulse">
          <div className="h-5 bg-secondary rounded w-1/3 mb-4" />
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="container py-20 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to view your account</p>
        <Link href="/login">
          <button className="lab-btn-primary">Sign In</button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 hex-cream">
      <div className="container py-8 space-y-8">
        <ProfileHeader name={user.name} email={user.email} />

        <StatsGrid
          orderCount={stats?.orderCount ?? 0}
          totalSpent={stats?.totalSpent ?? 0}
          points={stats?.points ?? 0}
          referralCount={stats?.referralCount ?? 0}
        />

        {AFFILIATE_UI_ENABLED && <AffiliateSection />}

        <OrderHistorySection orders={orders} />
      </div>
    </div>
  );
}

// ─── Profile ─────────────────────────────────────────────────────────────────

function ProfileHeader({ name, email }: { name: string | null; email: string | null }) {
  const initials = (name ?? email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="lab-card p-6 flex items-center gap-5">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="text-xl font-bold text-primary">{initials || "?"}</span>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold truncate">{name || "Researcher"}</h1>
          <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold tracking-wider">
            RESEARCHER
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate">{email}</p>
      </div>
    </div>
  );
}

function StatsGrid({
  orderCount,
  totalSpent,
  points,
  referralCount,
}: {
  orderCount: number;
  totalSpent: number;
  points: number;
  referralCount: number;
}) {
  const tiles = [
    { label: "Orders", value: String(orderCount), icon: ShoppingBag },
    { label: "Spent", value: `$${totalSpent.toFixed(2)}`, icon: DollarSign },
    { label: "Points", value: String(points), icon: Star },
    // Hidden with the rest of the program: a permanent zero would read as a
    // broken counter rather than a feature that is switched off.
    ...(AFFILIATE_UI_ENABLED
      ? [{ label: "Referrals", value: String(referralCount), icon: Users }]
      : []),
  ];

  return (
    <div className={`grid grid-cols-2 gap-4 ${AFFILIATE_UI_ENABLED ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
      {tiles.map(({ label, value, icon: Icon }) => (
        <div key={label} className="lab-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Icon size={15} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
          </div>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Affiliate ───────────────────────────────────────────────────────────────

function AffiliateSection() {
  const utils = trpc.useUtils();
  const { data: dashboard, isLoading } = trpc.affiliate.myDashboard.useQuery();

  // Enrolment is implicit: opening this section is what creates the code.
  const claimCode = trpc.affiliate.myCode.useMutation({
    onSuccess: () => utils.affiliate.myDashboard.invalidate(),
    onError: (err) => toast.error(err.message || "Could not create your referral code"),
  });

  const requestPayout = trpc.affiliate.requestPayout.useMutation({
    onSuccess: ({ amountRequested }) => {
      toast.success(`Payout requested for $${amountRequested.toFixed(2)}`);
      utils.affiliate.myDashboard.invalidate();
    },
    onError: (err) => toast.error(err.message || "Could not request a payout"),
  });

  const claimed = claimCode.isPending || claimCode.isSuccess;
  useEffect(() => {
    if (!isLoading && dashboard && dashboard.code === null && !claimed) {
      claimCode.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, dashboard?.code, claimed]);

  if (isLoading || !dashboard) {
    return (
      <div className="lab-card p-6 animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/4 mb-4" />
        <div className="h-10 bg-secondary rounded" />
      </div>
    );
  }

  if (!dashboard.code) {
    return (
      <div className="lab-card p-6 flex items-center gap-3">
        <Loader2 size={16} className="animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Setting up your referral code…</p>
      </div>
    );
  }

  const shareUrl = buildReferralShareUrl(dashboard.code);
  const shortfall = Math.max(0, dashboard.minPayout - dashboard.balance);

  return (
    <div className="space-y-4">
      <div className="lab-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Share2 size={16} className="text-primary" />
          <h2 className="font-semibold text-lg">Affiliate Program</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">
          Share your code. Your referral gets {REFERRAL_DISCOUNT_PERCENT}% off their order, and
          you earn {REFERRAL_COMMISSION_PERCENT}% commission on it.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          <CopyField label="Your code" value={dashboard.code} mono />
          <CopyField label="Your share link" value={shareUrl} />
        </div>
      </div>

      <div className="lab-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-medium mb-1">Available balance</p>
            <p className="text-3xl font-bold">${dashboard.balance.toFixed(2)}</p>
            {!dashboard.canRequestPayout && (
              <p className="text-xs text-muted-foreground mt-2">
                {dashboard.payoutBlockedReason === "request_pending"
                  ? "You have a payout request awaiting review."
                  : `$${shortfall.toFixed(2)} more to reach the $${dashboard.minPayout.toFixed(2)} minimum.`}
              </p>
            )}
          </div>
          <button
            onClick={() => requestPayout.mutate()}
            disabled={!dashboard.canRequestPayout || requestPayout.isPending}
            className="lab-btn-primary px-6 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {requestPayout.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Requesting…
              </>
            ) : (
              "Request Payout"
            )}
          </button>
        </div>
      </div>

      <ReferralHistory referrals={dashboard.referrals} />
      <AffiliateFaq minPayout={dashboard.minPayout} />
    </div>
  );
}

function CopyField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text and copy manually");
    }
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground font-medium mb-1.5">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={`lab-input flex-1 min-w-0 ${mono ? "font-mono font-semibold tracking-wider" : "text-sm"}`}
        />
        <button
          onClick={copy}
          className="lab-btn-secondary px-3 flex-shrink-0"
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

function ReferralHistory({
  referrals,
}: {
  referrals: Array<{
    id: number;
    orderId: number;
    commissionAmount: string;
    status: string;
    createdAt: string | Date;
  }>;
}) {
  if (referrals.length === 0) {
    return (
      <div className="lab-card p-8 text-center">
        <Users size={32} className="text-muted-foreground/30 mx-auto mb-3" />
        <p className="font-medium text-sm">No referrals yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Orders placed with your code will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="lab-card p-6">
      <h3 className="font-semibold mb-4">Referral history</h3>
      <div className="space-y-2">
        {referrals.map((referral) => {
          const style = REFERRAL_STATUS_STYLE[referral.status] ?? {
            label: referral.status,
            className: "bg-secondary text-muted-foreground",
          };
          return (
            <div
              key={referral.id}
              className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">Order #{referral.orderId}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(referral.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className={`px-2 py-1 rounded-full text-[11px] font-medium ${style.className}`}>
                  {style.label}
                </span>
                <span className="text-sm font-semibold w-16 text-right">
                  ${Number(referral.commissionAmount).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AffiliateFaq({ minPayout }: { minPayout: number }) {
  const faqs = [
    {
      q: "How do I earn commission?",
      a: `Share your code or link. When someone orders with it, they get ${REFERRAL_DISCOUNT_PERCENT}% off and you earn ${REFERRAL_COMMISSION_PERCENT}% of that order's subtotal.`,
    },
    {
      q: "When does a commission become payable?",
      a: "As soon as the order is paid for. Until then it stays as 'Awaiting payment', because an unpaid order can still be cancelled.",
    },
    {
      q: "When can I request a payout?",
      a: `Once your eligible balance reaches $${minPayout.toFixed(2)}. Our team reviews the request and marks it paid once the transfer goes out.`,
    },
    {
      q: "How long does my link stay attributed?",
      a: "30 days from the click. If someone visits through your link and orders three weeks later, it still counts as your referral.",
    },
    {
      q: "Can I use my own code?",
      a: "No. Orders placed on your own account with your own code are rejected — no discount is applied and no commission is earned.",
    },
  ];

  return (
    <div className="lab-card p-6">
      <h3 className="font-semibold mb-4">Program details</h3>
      <div className="space-y-4">
        {faqs.map(({ q, a }) => (
          <div key={q}>
            <p className="text-sm font-medium mb-1">{q}</p>
            <p className="text-sm text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Orders ──────────────────────────────────────────────────────────────────

function OrderHistorySection({
  orders,
}: {
  orders:
    | Array<{
        id: number;
        status: string;
        total: string;
        createdAt: string | Date;
      }>
    | undefined;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Order History</h2>
        <Link href="/my-orders">
          <span className="text-sm text-primary hover:underline cursor-pointer">View all</span>
        </Link>
      </div>

      {!orders || orders.length === 0 ? (
        <div className="lab-card p-10 text-center">
          <Package size={36} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="font-medium">No orders yet</p>
          <Link href="/compounds">
            <button className="lab-btn-primary mt-4">Browse Compounds</button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <Link key={order.id} href={`/my-orders/${order.id}`}>
              <div className="lab-card p-5 cursor-pointer hover:border-primary/30 transition-all group">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold">Order #{order.id}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Clock size={12} />
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                        ORDER_STATUS_COLORS[order.status] ?? "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
                    <ChevronRight
                      size={16}
                      className="text-muted-foreground group-hover:translate-x-0.5 transition-transform"
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
