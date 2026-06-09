import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionFromRequest } from "@/lib/server-auth";
import { AdminNav } from "./admin-nav";
import { SignOutButtonWrapper } from "./sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromRequest(await headers());

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-y-0 left-0 w-64 bg-card shadow-lg">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">Afterclass Admin</h1>
          </div>

          <AdminNav />

          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between flex-col gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{session.user.email}</p>
              </div>
              <SignOutButtonWrapper />
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="ml-64">
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
}
