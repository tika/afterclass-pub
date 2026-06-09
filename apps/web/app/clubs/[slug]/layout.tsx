"use client";

import { useAuth } from "@/hooks/use-auth";
import { useUser } from "@/hooks/use-user";
import { signOut } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  DashboardIcon,
  HeartIcon,
  LogoutIcon,
  UserCircleIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupsApi } from "@/lib/api-client";

export default function ClubDashboardLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  // Fetch user's admin groups
  const { data: adminGroupsData, isLoading: adminGroupsLoading } = useQuery({
    queryKey: ["my-admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getMyAdminGroups(token);
    },
  });

  const adminGroups = adminGroupsData?.groups || [];

  // Don't show sidebar if user has no admin groups
  if (!adminGroupsLoading && adminGroups.length === 0) {
    return <div>{children}</div>;
  }

  const selectedGroup = adminGroups.find((g) => g.group.slug === slug)?.group;
  const basePath = `/clubs/${slug}`;

  const navItems = [
    { href: basePath, label: "Dashboard", icon: DashboardIcon },
    { href: `${basePath}/events`, label: "Events", icon: CalendarIcon },
    { href: `${basePath}/team`, label: "Team", icon: UsersIcon },
    { href: `${basePath}/profile`, label: "Profile", icon: UserCircleIcon },
    { href: `${basePath}/followers`, label: "Followers", icon: HeartIcon },
  ];

  const handleGroupChange = (newSlug: string) => {
    // Extract the current sub-path (e.g., /events, /team) from pathname
    const currentSubPath = pathname?.replace(`/clubs/${slug}`, "") || "";
    router.push(`/clubs/${newSlug}${currentSubPath}`);
  };

  return (
    <div className="min-h-screen [background:var(--gradient-bg-subtle)]">
      <div
        className="fixed inset-y-0 left-0 w-64 shadow-lg border-r border-border"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-bold text-foreground mb-2">Afterclass Dashboard</h1>
            {adminGroups.length > 1 && (
              <Select value={slug} onValueChange={handleGroupChange}>
                <SelectTrigger className="w-full mt-2">
                  <SelectValue placeholder="Select group" />
                </SelectTrigger>
                <SelectContent>
                  {adminGroups.map((item) => (
                    <SelectItem key={item.group.id} value={item.group.slug || item.group.id}>
                      {item.group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedGroup && adminGroups.length === 1 && (
              <p className="text-sm text-muted-foreground mt-2">{selectedGroup.name}</p>
            )}
          </div>

          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== basePath && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => void signOut()}>
                <LogoutIcon className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
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
