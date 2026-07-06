import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Ticket, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

type CouponForm = {
  code: string;
  type: "percentage" | "fixed";
  value: string;
  minOrderAmount: string;
  maxUses: string;
  active: boolean;
  expiresAt: string;
};

const emptyForm: CouponForm = {
  code: "",
  type: "percentage",
  value: "",
  minOrderAmount: "",
  maxUses: "",
  active: true,
  expiresAt: "",
};

export default function AdminCoupons() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: coupons, isLoading } = trpc.coupons.list.useQuery();

  const createCoupon = trpc.coupons.create.useMutation({
    onSuccess: () => { utils.coupons.list.invalidate(); setForm(emptyForm); setShowForm(false); toast.success("Coupon created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateCoupon = trpc.coupons.update.useMutation({
    onSuccess: () => { utils.coupons.list.invalidate(); setForm(emptyForm); setEditingId(null); setShowForm(false); toast.success("Coupon updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteCoupon = trpc.coupons.delete.useMutation({
    onSuccess: () => { utils.coupons.list.invalidate(); toast.success("Coupon deleted"); },
    onError: (e) => toast.error(e.message),
  });

  const setNewCustomerOffer = trpc.coupons.setNewCustomerOffer.useMutation({
    onSuccess: (_data, variables) => {
      utils.coupons.list.invalidate();
      toast.success(
        variables.enabled ? "Set as the active new-customer signup offer" : "Removed from new-customer signup offer"
      );
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      code: form.code.toUpperCase(),
      type: form.type,
      value: form.value,
      minOrderAmount: form.minOrderAmount || undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      active: form.active,
      expiresAt: form.expiresAt || undefined,
    };
    if (editingId) {
      updateCoupon.mutate({ id: editingId, ...data });
    } else {
      createCoupon.mutate(data);
    }
  };

  const isExpired = (expiresAt: Date | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="lab-section-title mb-1">Promotions</p>
            <h1 className="text-2xl font-bold">Coupons</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}
            className="lab-btn-primary"
          >
            <Plus size={16} />
            New Coupon
          </button>
        </div>

        {showForm && (
          <div className="lab-card p-6">
            <h2 className="font-semibold text-lg mb-5">
              {editingId ? "Edit Coupon" : "Create Coupon"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Coupon Code *</label>
                  <input
                    className="lab-input uppercase"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    required
                    minLength={3}
                    maxLength={50}
                    placeholder="SUMMER20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Discount Type *</label>
                  <select
                    className="lab-input"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "percentage" | "fixed" })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Discount Value * {form.type === "percentage" ? "(%)" : "($)"}
                  </label>
                  <input
                    className="lab-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max={form.type === "percentage" ? "100" : undefined}
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    required
                    placeholder={form.type === "percentage" ? "20" : "10.00"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Minimum Order Amount ($)</label>
                  <input
                    className="lab-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    placeholder="0.00 (no minimum)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Max Uses</label>
                  <input
                    className="lab-input"
                    type="number"
                    min="1"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Expiry Date</label>
                  <input
                    className="lab-input"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="active" className="text-sm font-medium cursor-pointer">Active</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={createCoupon.isPending || updateCoupon.isPending}
                  className="lab-btn-primary"
                >
                  {(createCoupon.isPending || updateCoupon.isPending) ? (
                    <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  ) : (
                    <><Check size={14} /> {editingId ? "Update Coupon" : "Create Coupon"}</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                  className="lab-btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="lab-card p-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : !coupons || coupons.length === 0 ? (
          <div className="lab-card p-12 text-center">
            <Ticket size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No coupons yet. Create your first discount code.</p>
          </div>
        ) : (
          <div className="lab-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Uses</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Min Order</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Expires</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">New-Customer Offer</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((coupon) => {
                    const expired = isExpired(coupon.expiresAt);
                    return (
                      <tr key={coupon.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono font-semibold text-primary">{coupon.code}</span>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{coupon.type}</td>
                        <td className="px-4 py-3 font-semibold">
                          {coupon.type === "percentage"
                            ? `${Number(coupon.value)}%`
                            : `$${Number(coupon.value).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {coupon.usedCount}{coupon.maxUses !== null ? `/${coupon.maxUses}` : ""}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {coupon.minOrderAmount ? `$${Number(coupon.minOrderAmount).toFixed(2)}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {coupon.expiresAt
                            ? new Date(coupon.expiresAt).toLocaleDateString()
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          {expired ? (
                            <span className="lab-badge bg-red-100 text-red-700 text-xs">Expired</span>
                          ) : coupon.active ? (
                            <span className="lab-badge bg-green-100 text-green-700 text-xs">Active</span>
                          ) : (
                            <span className="lab-badge bg-secondary text-muted-foreground text-xs">Inactive</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <label className="flex items-center gap-2 cursor-pointer w-fit">
                            <input
                              type="checkbox"
                              checked={coupon.isNewCustomerOffer}
                              disabled={setNewCustomerOffer.isPending}
                              onChange={(e) =>
                                setNewCustomerOffer.mutate({ id: coupon.id, enabled: e.target.checked })
                              }
                              className="rounded accent-[#d3c4ab]"
                            />
                            <span className="text-xs text-muted-foreground">
                              {coupon.isNewCustomerOffer ? "Active offer" : "Use as offer"}
                            </span>
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingId(coupon.id);
                                setForm({
                                  code: coupon.code,
                                  type: coupon.type,
                                  value: String(coupon.value),
                                  minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : "",
                                  maxUses: coupon.maxUses !== null ? String(coupon.maxUses) : "",
                                  active: coupon.active,
                                  expiresAt: coupon.expiresAt
                                    ? new Date(coupon.expiresAt).toISOString().slice(0, 16)
                                    : "",
                                });
                                setShowForm(true);
                              }}
                              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                            >
                              <Pencil size={13} className="text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this coupon?")) deleteCoupon.mutate({ id: coupon.id }); }}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
