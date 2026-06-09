"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, MapMarkerIcon, NotificationBellIcon } from "mage-icons-react/stroke";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useClubContext } from "@/hooks/use-club-context";
import { groupsApi } from "@/lib/api-client";

function EngagementPageContent() {
  const { getToken } = useAuth();
  const { groupId } = useClubContext();

  // Fetch engagement details
  const { data: engagementData, isLoading: engagementLoading } = useQuery({
    queryKey: ["group-engagement", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      return groupsApi.getGroupEngagementDetails(token, groupId);
    },
    enabled: !!groupId,
  });

  const engagement = engagementData || {
    totalReminders: 0,
    events: [],
  };

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>No Group Selected</CardTitle>
            <CardDescription>
              Please select a group from the sidebar to view engagement details.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Engagement</h1>
        <p className="text-muted-foreground mt-1">Detailed engagement breakdown for your club</p>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NotificationBellIcon className="h-5 w-5" />
            Total Engagement
          </CardTitle>
          <CardDescription>Reminders set on upcoming events</CardDescription>
        </CardHeader>
        <CardContent>
          {engagementLoading ? (
            <Skeleton className="h-12 w-32" />
          ) : (
            <div className="text-3xl font-bold">{engagement.totalReminders}</div>
          )}
        </CardContent>
      </Card>

      {/* Events with Engagement */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>Events with reminder counts</CardDescription>
        </CardHeader>
        <CardContent>
          {engagementLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : engagement.events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No upcoming events with engagement yet.
            </p>
          ) : (
            <div className="space-y-4">
              {engagement.events.map((event) => {
                const eventDate = new Date(event.startTime);
                return (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{event.title}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {eventDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          at{" "}
                          {eventDate.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                        {event.locationName && (
                          <div className="flex items-center gap-1">
                            <MapMarkerIcon className="h-3 w-3" />
                            {event.locationName}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <NotificationBellIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm">{event.reminderCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function EngagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <EngagementPageContent />
    </Suspense>
  );
}
