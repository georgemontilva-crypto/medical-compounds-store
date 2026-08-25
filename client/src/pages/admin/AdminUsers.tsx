import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Users, Shield, User, Pencil, X, Loader2, AlertCircle } from "lucide-react";

/** The row shape the edit modal needs, kept narrow so the table can pass a row straight in. */
interface EditableUser {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export default function AdminUsers() {
  const { data: users, isLoading } = trpc.admin.users.useQuery({});
  const [editing, setEditing] = useState<EditableUser | null>(null);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <p className="lab-section-title mb-1">Management</p>
          <h1 className="text-2xl font-bold">Users</h1>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="lab-card p-4 animate-pulse">
                <div className="h-4 bg-secondary rounded w-1/3 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : !users || users.length === 0 ? (
          <div className="lab-card p-12 text-center">
            <Users size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No users registered yet</p>
          </div>
        ) : (
          <div className="lab-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Login Method</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Joined</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Last Sign In</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Welcome Coupon</th>
                    <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <User size={12} className="text-primary" />
                          </div>
                          <span className="font-medium">{user.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{user.phone ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`lab-badge text-xs flex items-center gap-1 w-fit ${
                            user.role === "admin"
                              ? "bg-[#f2ede6] text-[#d3c4ab]"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {user.role === "admin" && <Shield size={10} />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">
                        {user.loginMethod ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(user.lastSignedIn).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        {user.welcomeCouponUsedAt ? (
                          <span className="lab-badge bg-green-100 text-green-700 text-xs">
                            Used {user.welcomeCouponCode ? `(${user.welcomeCouponCode})` : ""}
                          </span>
                        ) : user.welcomeCouponRedeemedAt ? (
                          <span className="lab-badge bg-[#f2ede6] text-[#8a7a5c] text-xs">
                            Assigned {user.welcomeCouponCode ? `(${user.welcomeCouponCode})` : ""}
                          </span>
                        ) : (
                          <span className="lab-badge bg-secondary text-muted-foreground text-xs">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setEditing({
                              id: user.id,
                              name: user.name,
                              email: user.email,
                              phone: user.phone,
                            })
                          }
                          aria-label={`Edit ${user.name ?? user.email ?? `user ${user.id}`}`}
                          className="w-8 h-8 rounded-xl bg-secondary hover:bg-secondary/70 inline-flex items-center justify-center transition-colors"
                        >
                          <Pencil size={14} className="text-muted-foreground" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editing && <EditUserModal user={editing} onClose={() => setEditing(null)} />}
      </div>
    </AdminLayout>
  );
}

function EditUserModal({ user, onClose }: { user: EditableUser; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(user.name ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const update = trpc.admin.updateUser.useMutation({
    onSuccess: () => {
      utils.admin.users.invalidate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  // Compared case-insensitively so that merely re-casing an address does not
  // raise the sign-in warning, while a genuine change still does.
  const emailChanged =
    email.trim().toLowerCase() !== (user.email ?? "").trim().toLowerCase();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate({ id: user.id, name: name.trim(), email: email.trim(), phone: phone.trim() });
  };

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
    placeholder?: string,
    required = true
  ) => (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label} {required && "*"}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="lab-input w-full"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Edit User</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {field("Name", name, setName)}
          {field("Email", email, setEmail, "email")}
          {field("Phone", phone, setPhone, "tel", "+1 555 000 0000", false)}

          {/* The email is what auth.login looks the account up by, so changing it
              changes how this person signs in. They are not notified. */}
          {emailChanged && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                This email is the account's sign-in address. Changing it changes how this
                user logs in, and they won't be told automatically.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
              <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Passwords can't be changed here — send the user through a password reset instead.
          </p>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="lab-btn-secondary flex-1 py-2.5"
              disabled={update.isPending}
            >
              Cancel
            </button>
            <button type="submit" className="lab-btn-primary flex-1 py-2.5" disabled={update.isPending}>
              {update.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
