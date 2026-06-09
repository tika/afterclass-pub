"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarIcon,
  DirectionUpIcon,
  NotificationBellIcon,
  PlusIcon,
  RibbonIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubContext } from "@/hooks/use-club-context";
import { groupsApi } from "@/lib/api-client";

// Trend indicator component
function TrendIndicator({ value, label }: { value: number; label: string }) {
  if (value === 0) return null;
  const isPositive = value > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        isPositive ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      <span>
        {isPositive ? "+" : ""}
        {value}
      </span>
      <span className="text-muted-foreground font-normal">{label}</span>
    </span>
  );
}

// Format date to relative string
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffDays === 0) {
    if (diffHours < 0) return "Past";
    if (diffHours === 0) return "Starting now";
    if (diffHours < 2) return "In 1 hour";
    return `In ${diffHours} hours`;
  }
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  if (diffDays < 14) return "Next week";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Format time
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ClubDashboardContent() {
  const { getToken } = useAuth();
  const { groupId, slug, isLoading: contextLoading } = useClubContext();

  // Fetch group stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["group-stats", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      return groupsApi.getGroupStats(token, groupId);
    },
    enabled: !!groupId,
  });

  // Fetch trending groups
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getTrendingGroups(token, 5);
    },
  });

  // Fetch recent events for the group
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["group-events", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      return groupsApi.getGroupEvents(token, groupId, {
        upcoming: true,
        limit: 5,
      });
    },
    enabled: !!groupId,
  });

  // Fetch user's admin groups to check if they have access
  const { data: adminGroupsData, isLoading: adminGroupsLoading } = useQuery({
    queryKey: ["my-admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getMyAdminGroups(token);
    },
  });

  const adminGroups = adminGroupsData?.groups || [];

  const stats = statsData || {
    followers: 0,
    followersChange: 0,
    engagement: 0,
    engagementChange: 0,
    campusRank: 0,
    category: "All Groups",
  };
  const trendingGroups = trendingData?.groups || [];
  const recentEvents = eventsData?.events || [];

  // Check if current group is in trending
  const currentGroupRank = trendingGroups.findIndex((g) => g.id === groupId) + 1;

  // Show message if user is not part of any organization
  if (!adminGroupsLoading && adminGroups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>You're not part of any organisation</CardTitle>
            <CardDescription>
              This dashboard is reserved for organization administrators.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (contextLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your club's performance at a glance
          </p>
        </div>
      </div>

      {/* Compact KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Followers Card */}
        <Link href={`/clubs/${slug}/followers`} className="block group">
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/20 hover:shadow-sm transition-all">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500/10">
              <UsersIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {statsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span className="text-2xl font-bold text-foreground">{stats.followers}</span>
                )}
                {!statsLoading && (
                  <TrendIndicator value={stats.followersChange} label="this week" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
          </div>
        </Link>

        {/* Engagement Card */}
        <Link href={`/clubs/${slug}/engagement`} className="block group">
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/20 hover:shadow-sm transition-all">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-violet-500/10">
              <NotificationBellIcon className="w-5 h-5 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {statsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span className="text-2xl font-bold text-foreground">{stats.engagement}</span>
                )}
                {!statsLoading && (
                  <TrendIndicator value={stats.engagementChange} label="this week" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Event reminders</p>
            </div>
          </div>
        </Link>

        {/* Campus Rank Card */}
        <Link href={`/clubs/${slug}/rankings`} className="block group">
          <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/20 hover:shadow-sm transition-all">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-500/10">
              <RibbonIcon className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                {statsLoading ? (
                  <Skeleton className="h-7 w-12" />
                ) : (
                  <span className="text-2xl font-bold text-foreground">#{stats.campusRank}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Campus rank</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Upcoming Events - Takes 3/5 */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="font-semibold text-foreground">Upcoming Events</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {recentEvents.length} event{recentEvents.length !== 1 ? "s" : ""} scheduled
                </p>
              </div>
              <Link href={`/clubs/${slug}/events/new`}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <PlusIcon className="w-3.5 h-3.5" />
                  New Event
                </Button>
              </Link>
            </div>
            <div className="p-4">
              {eventsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Skeleton className="w-12 h-12 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
                    <CalendarIcon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium text-foreground mb-1">No upcoming events</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-[240px]">
                    Create your first event to start engaging with your followers
                  </p>
                  <Link href={`/clubs/${slug}/events/new`}>
                    <Button size="sm" className="gap-1.5">
                      <PlusIcon className="w-3.5 h-3.5" />
                      Create Event
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentEvents.map((item) => {
                    const event = item.event;
                    const date = new Date(event.startTime);
                    const relativeDate = formatRelativeDate(date);
                    const time = formatTime(date);
                    const hasImage = event.flyerImages && event.flyerImages.length > 0;

                    return (
                      <Link
                        key={event.id}
                        href={`/clubs/${slug}/events/${event.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        {/* Event thumbnail or date box */}
                        {hasImage ? (
                          <img
                            src={event.flyerImages[0]}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-muted text-center">
                            <span className="text-xs font-medium text-muted-foreground uppercase">
                              {date.toLocaleDateString("en-US", { month: "short" })}
                            </span>
                            <span className="text-lg font-bold text-foreground leading-none">
                              {date.getDate()}
                            </span>
                          </div>
                        )}

                        {/* Event details */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate group-hover:text-primary transition-colors">
                            {event.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {relativeDate} at {time} · {event.locationName}
                          </p>
                        </div>

                        {/* Status badge */}
                        {event.status === "DRAFT" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                            Draft
                          </span>
                        )}
                        {event.status === "PUBLISHED" && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                            Live
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trending Section - Takes 2/5 */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <DirectionUpIcon className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">Campus Leaderboard</h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Top clubs by engagement</p>
            </div>
            <div className="p-2">
              {trendingLoading ? (
                <div className="space-y-1 p-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="w-6 h-6 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-2.5 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : trendingGroups.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No trending data yet</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {trendingGroups.map((group, index) => {
                    const rank = index + 1;
                    const isCurrentGroup = group.id === groupId;

                    // Rank badge styling
                    const rankStyles =
                      rank === 1
                        ? "bg-amber-500 text-white"
                        : rank === 2
                          ? "bg-slate-400 text-white"
                          : rank === 3
                            ? "bg-orange-400 text-white"
                            : "bg-muted text-muted-foreground";

                    return (
                      <div
                        key={group.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                          isCurrentGroup
                            ? "bg-primary/5 border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        {/* Rank badge */}
                        <div
                          className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${rankStyles}`}
                        >
                          {rank}
                        </div>

                        {/* Group info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              isCurrentGroup ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {group.name}
                            {isCurrentGroup && (
                              <span className="ml-1.5 text-xs font-normal text-primary">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {group.engagementCount} reminder{group.engagementCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {currentGroupRank === 0 && !trendingLoading && trendingGroups.length > 0 && (
              <div className="px-4 pb-4">
                <div className="p-3 rounded-lg bg-muted/50 border border-dashed border-border">
                  <p className="text-xs text-muted-foreground text-center">
                    Your club isn't in the top 5 yet. Create events to boost engagement!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClubDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ClubDashboardContent />
    </Suspense>
  );
}
