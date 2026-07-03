import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";

type StatusFilter = "all" | "pending" | "approved" | "rejected" | "contacted";

const STATUS_OPTIONS: Array<{ value: "pending" | "approved" | "rejected" | "contacted"; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "contacted", label: "Contacted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  contacted: "bg-blue-50 text-blue-600",
  approved: "bg-[#E8F7F6] text-[#3A9E94]",
  rejected: "bg-red-50 text-red-500",
};

export default function AdminWholesaleApplications() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { data: applications = [], isLoading } = trpc.wholesaleApplications.adminList.useQuery(
    filter === "all" ? {} : { status: filter }
  );

  const updateStatusMutation = trpc.wholesaleApplications.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Status updated");
      utils.wholesaleApplications.adminList.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">Wholesale Applications</h1>
          <p className="text-sm text-gray-500 mt-1">Review and manage incoming wholesale access requests.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {(["all", "pending", "contacted", "approved", "rejected"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full capitalize transition-colors ${
                filter === f ? "bg-[#3A9E94] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : applications.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">No applications found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Organization</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Expected Volume</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 font-semibold text-gray-900 whitespace-nowrap">{app.fullName}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{app.organization}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">{app.workEmail}</td>
                      <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                        {app.expectedMonthlyVolume.replace(/_/g, " ")}
                      </td>
                      <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[app.status]}`}>
                          {app.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.filter((s) => s.value !== app.status).map((s) => (
                            <button
                              key={s.value}
                              onClick={() => updateStatusMutation.mutate({ id: app.id, status: s.value })}
                              disabled={updateStatusMutation.isPending}
                              className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
