"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  BuildingAIcon,
  CalendarIcon,
  ExclamationCircleIcon,
  ReloadIcon,
  UserPlusIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { adminApi } from "@/lib/api-client";

interface Stats {
  totalUsers: number;
  newUsers24h: number;
  newUsers7d: number;
  totalGroups: number;
  totalEvents: number;
  eventsToday: number;
  eventsThisWeek: number;
  activeUsers7d: number;
  eventsByStatus: {
    DRAFT: number;
    PUBLISHED: number;
    CANCELLED: number;
    ARCHIVED: number;
  };
  topGroupsByFollowers: Array<{
    id: string;
    name: string;
    followerCount: number;
    [key: string]: unknown;
  }>;
  topGroupsByEvents: Array<{
    id: string;
    name: string;
    eventCount: number;
    [key: string]: unknown;
  }>;
  userGrowthTrend: Array<{ date: string; count: number }>;
  eventCreationTrend: Array<{ date: string; count: number }>;
  newGroups7d: number;
  eventsHappeningToday: Array<unknown>;
  recentlyCreatedAccounts: Array<unknown>;
  recentlyCreatedGroups: Array<unknown>;
}

const chartConfig = {
  users: {
    label: "Users",
    color: "var(--chart-1)",
  },
  events: {
    label: "Events",
    color: "var(--chart-2)",
  },
  groups: {
    label: "Groups",
    color: "var(--chart-3)",
  },
};

export default function AdminDashboard() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        const statsData = await adminApi.getStats(token);
        setStats(statsData);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Failed to load stats</p>
      </div>
    );
  }

  // Prepare chart data
  const userGrowthData = stats.userGrowthTrend.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    users: item.count,
  }));

  const eventGrowthData = stats.eventCreationTrend.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    events: item.count,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-headline">Admin Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Overview of your Afterclass platform</p>
      </div>

      {/* Core Health Metrics */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">+{stats.newUsers24h} in last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <BuildingAIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalGroups}</div>
            <p className="text-xs text-muted-foreground mt-1">+{stats.newGroups7d} in last 7d</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.eventsToday} today, {stats.eventsThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Users (7d)</CardTitle>
            <UserPlusIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newUsers7d}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Active users: {stats.activeUsers7d}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Growth Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <AreaChart data={userGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Creation Trend</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig}>
              <AreaChart data={eventGrowthData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="events"
                  stroke="var(--chart-2)"
                  fill="var(--chart-2)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Content Metrics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Events by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Published</span>
                <span className="font-semibold">{stats.eventsByStatus.PUBLISHED}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Draft</span>
                <span className="font-semibold">{stats.eventsByStatus.DRAFT}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cancelled</span>
                <span className="font-semibold">{stats.eventsByStatus.CANCELLED}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Archived</span>
                <span className="font-semibold">{stats.eventsByStatus.ARCHIVED}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Groups by Followers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topGroupsByFollowers.slice(0, 5).map((group) => (
                <div key={group.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground truncate">{group.name}</span>
                  <span className="font-semibold">{group.followerCount}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExclamationCircleIcon className="h-5 w-5" />
            Quick Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Events Happening Today ({stats.eventsHappeningToday.length})
              </h3>
              {stats.eventsHappeningToday.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {stats.eventsHappeningToday.length} events scheduled for today
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No events scheduled for today</p>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Recently Created Accounts ({stats.recentlyCreatedAccounts.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                {stats.recentlyCreatedAccounts.length} new accounts in the last 24 hours
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Recently Created Groups ({stats.recentlyCreatedGroups.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                {stats.recentlyCreatedGroups.length} new groups in the last 24 hours
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
