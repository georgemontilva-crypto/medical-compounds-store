import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

type Tab = "payouts" | "affiliates" | "rejected";

const PAYOUT_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  rejected: "bg-red-50 text-red-500",
};

export default function AdminAffiliates() {
  const [tab, setTab] = useState<Tab>("payouts");

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "payouts", label: "Payout Requests" },
    { key: "affiliates", label: "All Affiliates" },
    { key: "rejected", label: "Self-Referral Attempts" },
  ];

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Affiliates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Commission payouts, affiliate balances, and rejected self-referral attempts.
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "payouts" && <PayoutRequestsTab />}
      {tab === "affiliates" && <AffiliatesTab />}
      {tab === "rejected" && <RejectedReferralsTab />}
    </AdminLayout>
  );
}

// ─── Payout requests ─────────────────────────────────────────────────────────

function PayoutRequestsTab() {
  const utils = trpc.useUtils();
  const [notesById, setNotesById] = useState<Record<number, string>>({});

  const { data: requests = [], isLoading } = trpc.affiliate.adminPayoutRequests.useQuery({});

  const settle = trpc.affiliate.adminSettlePayout.useMutation({
    onSuccess: () => {
      toast.success("Payout request updated");
      utils.affiliate.adminPayoutRequests.invalidate();
      utils.affiliate.adminOverview.invalidate();
    },
    onError: (err) => toast.error(err.message || "Could not update the request"),
  });

  if (isLoading) return <TableSkeleton />;

  if (requests.length === 0) {
    return <EmptyState message="No payout requests yet." />;
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div key={request.id} className="lab-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold">{request.userName || "Unnamed"}</p>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    PAYOUT_BADGE[request.status] ?? "bg-secondary text-muted-foreground"
                  }`}
                >
                  {request.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{request.userEmail}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Requested {new Date(request.requestedAt).toLocaleString()}
                {request.paidAt && ` · Paid ${new Date(request.paidAt).toLocaleDateString()}`}
              </p>
              {request.adminNotes && (
                <p className="text-xs text-muted-foreground mt-2 italic">
                  Note: {request.adminNotes}
                </p>
              )}
            </div>

            <div className="text-right flex-shrink-0">
              <p className="text-2xl font-bold">
                ${Number(request.amountRequested).toFixed(2)}
              </p>
            </div>
          </div>

          {request.status === "pending" && (
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Optional note (payment reference, etc.)"
                value={notesById[request.id] ?? ""}
                onChange={(e) =>
                  setNotesById((prev) => ({ ...prev, [request.id]: e.target.value }))
                }
                className="lab-input flex-1 min-w-[200px] text-sm"
              />
              <button
                onClick={() =>
                  settle.mutate({
                    id: request.id,
                    status: "paid",
                    adminNotes: notesById[request.id],
                  })
                }
                disabled={settle.isPending}
                className="lab-btn-primary px-4 py-2 text-sm"
              >
                {settle.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Mark Paid
              </button>
              <button
                onClick={() =>
                  settle.mutate({
                    id: request.id,
                    status: "rejected",
                    adminNotes: notesById[request.id],
                  })
                }
                disabled={settle.isPending}
                className="lab-btn-secondary px-4 py-2 text-sm"
              >
                <X size={14} />
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Affiliates overview ─────────────────────────────────────────────────────

function AffiliatesTab() {
  const { data: affiliates = [], isLoading } = trpc.affiliate.adminOverview.useQuery();

  if (isLoading) return <TableSkeleton />;
  if (affiliates.length === 0) return <EmptyState message="Nobody has claimed a code yet." />;

  return (
    <div className="lab-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="p-4 font-medium">Affiliate</th>
            <th className="p-4 font-medium">Code</th>
            <th className="p-4 font-medium text-right">Referrals</th>
            <th className="p-4 font-medium text-right">Eligible</th>
            <th className="p-4 font-medium text-right">Paid out</th>
            <th className="p-4 font-medium text-right">Rejected</th>
          </tr>
        </thead>
        <tbody>
          {affiliates.map((affiliate) => (
            <tr key={affiliate.codeId} className="border-b border-border last:border-0">
              <td className="p-4">
                <p className="font-medium">{affiliate.userName || "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">{affiliate.userEmail}</p>
              </td>
              <td className="p-4 font-mono text-xs font-semibold">{affiliate.code}</td>
              <td className="p-4 text-right">{affiliate.referralCount}</td>
              <td className="p-4 text-right font-semibold">
                ${affiliate.eligibleTotal.toFixed(2)}
              </td>
              <td className="p-4 text-right text-muted-foreground">
                ${affiliate.paidTotal.toFixed(2)}
              </td>
              <td className="p-4 text-right">
                {affiliate.rejectedCount > 0 ? (
                  <span className="text-red-500 font-medium">{affiliate.rejectedCount}</span>
                ) : (
                  <span className="text-muted-foreground">0</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Rejected referrals ──────────────────────────────────────────────────────

function RejectedReferralsTab() {
  const { data: rejected = [], isLoading } = trpc.affiliate.adminRejectedReferrals.useQuery();

  if (isLoading) return <TableSkeleton />;

  if (rejected.length === 0) {
    return <EmptyState message="No self-referral attempts detected." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          These orders were placed with the buyer's own referral code. No discount was applied
          and no commission was earned — they are listed here for abuse monitoring only.
        </p>
      </div>

      <div className="lab-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-4 font-medium">Order</th>
              <th className="p-4 font-medium">Code</th>
              <th className="p-4 font-medium">Code owner</th>
              <th className="p-4 font-medium">Buyer email</th>
              <th className="p-4 font-medium text-right">Order total</th>
              <th className="p-4 font-medium">Attempted</th>
            </tr>
          </thead>
          <tbody>
            {rejected.map((referral) => (
              <tr key={referral.id} className="border-b border-border last:border-0">
                <td className="p-4 font-medium">#{referral.orderId}</td>
                <td className="p-4 font-mono text-xs">{referral.code}</td>
                <td className="p-4 text-muted-foreground">{referral.ownerEmail}</td>
                <td className="p-4 text-muted-foreground">{referral.orderEmail}</td>
                <td className="p-4 text-right">
                  ${Number(referral.orderTotal ?? 0).toFixed(2)}
                </td>
                <td className="p-4 text-xs text-muted-foreground">
                  {new Date(referral.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="lab-card p-5 animate-pulse">
          <div className="h-4 bg-secondary rounded w-1/4 mb-3" />
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="lab-card p-12 text-center">
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
