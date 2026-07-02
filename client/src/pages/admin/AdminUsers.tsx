import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { Users, Shield, User } from "lucide-react";

export default function AdminUsers() {
  const { data: users, isLoading } = trpc.admin.users.useQuery({});

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
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Role</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Login Method</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Joined</th>
                    <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Last Sign In</th>
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
                      <td className="px-4 py-3">
                        <span
                          className={`lab-badge text-xs flex items-center gap-1 w-fit ${
                            user.role === "admin"
                              ? "bg-[#E8F7F6] text-[#3A9E94]"
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
