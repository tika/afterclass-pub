"use client";

import {
  BuildingAIcon,
  NotificationBellIcon,
  CalendarIcon,
  ClipboardIcon,
  DashboardIcon,
  EditIcon,
  MapMarkerIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: DashboardIcon },
  { href: "/admin/organizations", label: "Groups", icon: BuildingAIcon },
  { href: "/admin/events", label: "Events", icon: CalendarIcon },
  { href: "/admin/drafts", label: "Drafts", icon: EditIcon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/pois", label: "POIs", icon: MapMarkerIcon },
  { href: "/admin/push", label: "Push", icon: NotificationBellIcon },
  { href: "/admin/waitlist", label: "Waitlist", icon: ClipboardIcon },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href || (item.href !== "/admin" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
