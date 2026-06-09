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
  PlusIcon,
  UserCircleIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { groupsApi } from "@/lib/api-client";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Fetch user's admin groups
  const { data: adminGroupsData, isLoading: adminGroupsLoading } = useQuery({
    queryKey: ["my-admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getMyAdminGroups(token);
    },
  });

  const adminGroups = adminGroupsData?.groups || [];

  // Set default group on mount
  useEffect(() => {
    if (adminGroups.length > 0 && !selectedGroupId) {
      const firstGroup = adminGroups[0];
      if (firstGroup?.group?.id) {
        setSelectedGroupId(firstGroup.group.id);
        // Store in localStorage for persistence
        localStorage.setItem("selectedGroupId", firstGroup.group.id);
      }
    }
  }, [adminGroups, selectedGroupId]);

  // Load selected group from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("selectedGroupId");
    if (stored && adminGroups.some((g) => g.group.id === stored)) {
      setSelectedGroupId(stored);
    }
  }, [adminGroups]);

  // Don't show sidebar if user has no admin groups
  if (!adminGroupsLoading && adminGroups.length === 0) {
    return <div>{children}</div>;
  }

  const selectedGroup = adminGroups.find((g) => g.group.id === selectedGroupId)?.group;

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
    { href: "/dashboard/events", label: "Events", icon: CalendarIcon },
    { href: "/dashboard/team", label: "Team", icon: UsersIcon },
    { href: "/dashboard/profile", label: "Profile", icon: UserCircleIcon },
    { href: "/dashboard/followers", label: "Followers", icon: HeartIcon },
  ];

  const handleGroupChange = (groupId: string) => {
    setSelectedGroupId(groupId);
    localStorage.setItem("selectedGroupId", groupId);
    // Refresh the page to reload data for new group
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-60 bg-card border-r border-border flex flex-col">
        {/* Club Identity Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-lg">
              {selectedGroup?.logoUrl ? (
                <AvatarImage src={selectedGroup.logoUrl} alt={selectedGroup.name} />
              ) : null}
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-semibold text-sm">
                {selectedGroup ? getInitials(selectedGroup.name) : "AC"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              {adminGroups.length > 1 ? (
                <Select value={selectedGroupId || undefined} onValueChange={handleGroupChange}>
                  <SelectTrigger className="h-auto p-0 border-0 bg-transparent shadow-none font-semibold text-foreground text-sm hover:bg-transparent focus:ring-0">
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {adminGroups.map((item) => (
                      <SelectItem key={item.group.id} value={item.group.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5 rounded">
                            {item.group.logoUrl ? (
                              <AvatarImage src={item.group.logoUrl} alt={item.group.name} />
                            ) : null}
                            <AvatarFallback className="rounded text-[10px] bg-primary/10 text-primary">
                              {getInitials(item.group.name)}
                            </AvatarFallback>
                          </Avatar>
                          {item.group.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-semibold text-foreground text-sm truncate">
                  {selectedGroup?.name || "Loading..."}
                </p>
              )}
              <p className="text-xs text-muted-foreground">Organizer Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={selectedGroupId ? `${item.href}?groupId=${selectedGroupId}` : item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Quick Actions */}
        <div className="p-2 border-t border-border">
          <Link
            href={
              selectedGroupId
                ? `/dashboard/events/new?groupId=${selectedGroupId}`
                : "/dashboard/events/new"
            }
            className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/15 rounded-md transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Create Event
          </Link>
        </div>

        {/* User Section */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              {user?.imageUrl ? (
                <AvatarImage src={user.imageUrl} alt={user.fullName || ""} />
              ) : null}
              <AvatarFallback className="text-xs bg-muted">
                {user?.fullName ? getInitials(user.fullName) : "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.fullName || user?.emailAddresses[0]?.emailAddress}
              </p>
            </div>
            <button
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              title="Sign out"
              onClick={() => void signOut()}
            >
              <LogoutIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
