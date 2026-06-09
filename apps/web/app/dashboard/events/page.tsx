"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  CancelIcon,
  CopyIcon,
  DashboardChartIcon,
  DotsMenuIcon,
  EditIcon,
  PlusIcon,
} from "mage-icons-react/stroke";
import { useRouter, useSearchParams } from "next/navigation";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { EventsMap } from "@/components/dashboard/events-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { adminApi, eventsApi, groupsApi } from "@/lib/api-client";

type EventItem = {
  event: {
    id: string;
    title: string;
    description: string | null;
    flyerImages: string[];
    startTime: string;
    endTime: string | null;
    locationName: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
    sourceUrl: string | null;
    aiSummary: string | null;
    metadata: Record<string, unknown> | null;
    groupId: string;
    createdAt: string;
    updatedAt: string;
  };
  group: {
    id: string;
    name: string;
  } | null;
};

// Helper functions for "Add to Calendar"
function formatDateForCalendar(dateStr: string): string {
  return new Date(dateStr)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function getGoogleCalendarUrl(event: EventItem["event"]): string {
  const start = formatDateForCalendar(event.startTime);
  const end = event.endTime
    ? formatDateForCalendar(event.endTime)
    : formatDateForCalendar(new Date(new Date(event.startTime).getTime() + 3600000).toISOString());
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${start}/${end}`,
    location: event.address || event.locationName,
    details: event.description || "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function getOutlookCalendarUrl(event: EventItem["event"]): string {
  const start = event.startTime;
  const end =
    event.endTime || new Date(new Date(event.startTime).getTime() + 3600000).toISOString();
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start,
    enddt: end,
    location: event.address || event.locationName,
    body: event.description || "",
  });
  return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
}

function downloadIcsFile(event: EventItem["event"]): void {
  const start = formatDateForCalendar(event.startTime);
  const end = event.endTime
    ? formatDateForCalendar(event.endTime)
    : formatDateForCalendar(new Date(new Date(event.startTime).getTime() + 3600000).toISOString());
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.address || event.locationName}`,
    `DESCRIPTION:${(event.description || "").replace(/\n/g, "\\n")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, "_")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper function to get status badge styling
function getStatusBadgeClass(status: EventItem["event"]["status"]) {
  if (status === "PUBLISHED") {
    return "bg-chart-2/10 text-chart-2";
  }
  if (status === "DRAFT") {
    return "bg-chart-3/10 text-chart-3";
  }
  return "bg-destructive/10 text-destructive";
}

// Component for event actions dropdown menu
function EventActionsMenu({
  event,
  onEdit,
  onDuplicate,
  onCancel,
  onDelete,
  onViewStats,
  showCancel,
  showStats,
}: {
  event: EventItem["event"];
  onEdit: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onViewStats?: () => void;
  showCancel: boolean;
  showStats?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <DotsMenuIcon className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <EditIcon className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        {showStats && onViewStats && (
          <DropdownMenuItem onClick={onViewStats}>
            <DashboardChartIcon className="w-4 h-4 mr-2" />
            View Stats
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Add to Calendar
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => window.open(getGoogleCalendarUrl(event), "_blank")}>
              Google Calendar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.open(getOutlookCalendarUrl(event), "_blank")}>
              Outlook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => downloadIcsFile(event)}>
              Apple Calendar (.ics)
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={onDuplicate}>
          <CopyIcon className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        {showCancel && (
          <DropdownMenuItem onClick={onCancel}>
            <CancelIcon className="w-4 h-4 mr-2" />
            Cancel
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <CancelIcon className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Component for a single event row
function EventRow({
  item,
  selectedEventId,
  onEventClick,
  onEdit,
  onDuplicate,
  onCancel,
  onDelete,
  onViewStats,
  showPastIndicator = false,
  showCancel = false,
}: {
  item: EventItem;
  selectedEventId: string | null;
  onEventClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onViewStats?: () => void;
  showPastIndicator?: boolean;
  showCancel?: boolean;
}) {
  const event = item.event;
  const date = new Date(event.startTime);
  const isPast = showPastIndicator && date < new Date();

  return (
    <TableRow
      key={event.id}
      onClick={onEventClick}
      className={`cursor-pointer ${selectedEventId === event.id ? "bg-muted" : ""}`}
    >
      <TableCell className="font-medium">{event.title}</TableCell>
      <TableCell>
        {date.toLocaleDateString()} {date.toLocaleTimeString()}
        {isPast && <span className="ml-2 text-xs text-muted-foreground">(Past)</span>}
      </TableCell>
      <TableCell>{event.locationName}</TableCell>
      <TableCell>
        <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeClass(event.status)}`}>
          {event.status}
        </span>
      </TableCell>
      <TableCell>
        <EventEngagementCount eventId={event.id} />
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <EventActionsMenu
          event={event}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onCancel={onCancel}
          onDelete={onDelete}
          onViewStats={onViewStats}
          showCancel={showCancel}
          showStats={isPast}
        />
      </TableCell>
    </TableRow>
  );
}

// Component for events table with error/loading/empty states
function EventsTable({
  events,
  eventsLoading,
  eventsError,
  selectedEventId,
  onEventClick,
  onEdit,
  onDuplicate,
  onCancel,
  onDelete,
  onViewStats,
  emptyMessage,
  showPastIndicator = false,
  showCancel = false,
}: {
  events: EventItem[];
  eventsLoading: boolean;
  eventsError: Error | null;
  selectedEventId: string | null;
  onEventClick: (item: EventItem) => void;
  onEdit: (item: EventItem) => void;
  onDuplicate: (item: EventItem) => void;
  onCancel: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onViewStats?: (item: EventItem) => void;
  emptyMessage: string;
  showPastIndicator?: boolean;
  showCancel?: boolean;
}) {
  if (eventsError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive font-medium">Error loading events</p>
        <p className="text-xs text-destructive/80 mt-1">
          {eventsError instanceof Error ? eventsError.message : "Unknown error"}
        </p>
      </div>
    );
  }

  if (eventsLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Engagement</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((item) => {
            const event = item.event;
            const canCancel = showCancel && event.status === "PUBLISHED";
            const isPast = showPastIndicator && new Date(event.startTime) < new Date();
            const shouldShowCancel = canCancel && !isPast;

            return (
              <EventRow
                key={event.id}
                item={item}
                selectedEventId={selectedEventId}
                onEventClick={() => onEventClick(item)}
                onEdit={() => onEdit(item)}
                onDuplicate={() => onDuplicate(item)}
                onCancel={() => onCancel(event.id)}
                onDelete={() => onDelete(event.id)}
                onViewStats={onViewStats ? () => onViewStats(item) : undefined}
                showPastIndicator={showPastIndicator}
                showCancel={shouldShowCancel}
              />
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function EventsPageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useQueryState(
    "tab",
    parseAsStringEnum(["upcoming", "past", "all"]).withDefault("upcoming"),
  );
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [statsDialogOpen, setStatsDialogOpen] = useState(false);
  const [selectedEventForStats, setSelectedEventForStats] = useState<EventItem | null>(null);

  // Get groupId from URL params or localStorage
  useEffect(() => {
    const urlGroupId = searchParams.get("groupId");
    const storedGroupId = localStorage.getItem("selectedGroupId");
    setGroupId(urlGroupId || storedGroupId);
  }, [searchParams]);

  // Fetch events
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["group-events", groupId, activeTab],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      try {
        // Determine upcoming parameter explicitly
        let upcoming: boolean | undefined;
        if (activeTab === "upcoming") {
          upcoming = true;
        } else if (activeTab === "past") {
          upcoming = false;
        } else {
          // activeTab === "all"
          upcoming = undefined;
        }

        const result = await groupsApi.getGroupEvents(token, groupId, {
          upcoming,
          limit: 100,
        });
        console.log("Events fetched:", result);
        console.log("GroupId:", groupId);
        console.log("Active tab:", activeTab);
        console.log("Upcoming param:", upcoming);
        console.log("Events count:", result?.events?.length || 0);
        return result;
      } catch (error) {
        console.error("Error fetching events:", error);
        throw error;
      }
    },
    enabled: !!groupId,
  });

  const events = eventsData?.events || [];

  // Convert events to EventsMap compatible format
  const mapEvents = events.map((item) => ({
    event: {
      id: item.event.id,
      title: item.event.title,
      description: item.event.description,
      startTime: item.event.startTime,
      endTime: item.event.endTime,
      locationName: item.event.locationName,
      address: item.event.address,
      lat: item.event.lat,
      lng: item.event.lng,
      status: item.event.status,
      metadata: item.event.metadata,
    },
    group: item.group,
  }));

  // Delete event mutation
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return eventsApi.deleteEvent(token, eventId);
    },
    onSuccess: () => {
      toast.success("Event deleted successfully!");
      queryClient.invalidateQueries({
        queryKey: ["group-events", groupId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete event");
    },
  });

  // Cancel event mutation
  const cancelEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return eventsApi.updateEvent(token, eventId, {
        status: "CANCELLED",
      });
    },
    onSuccess: () => {
      toast.success("Event cancelled successfully!");
      queryClient.invalidateQueries({
        queryKey: ["group-events", groupId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel event");
    },
  });

  const handleEdit = (event: (typeof events)[0]) => {
    router.push(`/dashboard/events/${event.event.id}/edit`);
  };

  const handleDuplicate = (event: (typeof events)[0]) => {
    const params = new URLSearchParams();
    params.set("groupId", groupId || "");
    params.set("title", `${event.event.title} (Copy)`);
    params.set("locationName", event.event.locationName);
    params.set("status", "DRAFT");

    if (event.event.description) {
      params.set("description", event.event.description);
    }
    if (event.event.address) {
      params.set("address", event.event.address);
    }
    if (event.event.lat) {
      params.set("lat", event.event.lat.toString());
    }
    if (event.event.lng) {
      params.set("lng", event.event.lng.toString());
    }
    if (event.event.startTime) {
      const d = new Date(event.event.startTime);
      params.set(
        "startTime",
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }
    if (event.event.endTime) {
      const d = new Date(event.event.endTime);
      params.set(
        "endTime",
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }

    router.push(`/dashboard/events/create?${params.toString()}`);
  };

  const handleEventClick = (event: (typeof events)[0]) => {
    router.push(`/dashboard/events/${event.event.id}/edit`);
  };

  const handleViewStats = (event: (typeof events)[0]) => {
    setSelectedEventForStats(event);
    setStatsDialogOpen(true);
  };

  const handleMapEventClick = (mapEvent: (typeof mapEvents)[0]) => {
    // Find the full event from the original events array
    const fullEvent = events.find((e) => e.event.id === mapEvent.event.id);
    if (fullEvent) {
      router.push(`/dashboard/events/${fullEvent.event.id}/edit`);
    }
  };

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>No Group Selected</CardTitle>
            <CardDescription>
              Please select a group from the sidebar to manage events.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Events Manager</h1>
          <p className="text-muted-foreground mt-1">Create and manage events for your group</p>
        </div>
        <Button onClick={() => router.push(`/dashboard/events/create?groupId=${groupId}`)}>
          <PlusIcon className="w-4 h-4 mr-2" />
          Create Event
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "map" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("map")}
        >
          Map
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("list")}
        >
          List
        </Button>
      </div>

      {viewMode === "map" && (
        <Card>
          <CardContent className="p-0 overflow-hidden rounded-lg">
            <EventsMap
              events={mapEvents}
              selectedEventId={selectedEventId}
              onEventClick={handleMapEventClick}
              isPast={activeTab === "past"}
              className="h-[500px]"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
          <CardDescription>Manage your group's events</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as "upcoming" | "past" | "all");
              setSelectedEventId(null);
            }}
          >
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              <div className="space-y-4">
                <EventsTable
                  events={events}
                  eventsLoading={eventsLoading}
                  eventsError={eventsError}
                  selectedEventId={selectedEventId}
                  onEventClick={handleEventClick}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onCancel={(eventId) => cancelEventMutation.mutate(eventId)}
                  onDelete={(eventId) => deleteEventMutation.mutate(eventId)}
                  onViewStats={handleViewStats}
                  emptyMessage="No upcoming events. Create your first event!"
                  showPastIndicator={false}
                  showCancel={true}
                />
              </div>
            </TabsContent>
            <TabsContent value="past" className="mt-4">
              <div className="space-y-4">
                <EventsTable
                  events={events}
                  eventsLoading={eventsLoading}
                  eventsError={eventsError}
                  selectedEventId={selectedEventId}
                  onEventClick={handleEventClick}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onCancel={(eventId) => cancelEventMutation.mutate(eventId)}
                  onDelete={(eventId) => deleteEventMutation.mutate(eventId)}
                  onViewStats={handleViewStats}
                  emptyMessage="No past events."
                  showPastIndicator={false}
                  showCancel={false}
                />
              </div>
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <div className="space-y-4">
                <EventsTable
                  events={events}
                  eventsLoading={eventsLoading}
                  eventsError={eventsError}
                  selectedEventId={selectedEventId}
                  onEventClick={handleEventClick}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onCancel={(eventId) => cancelEventMutation.mutate(eventId)}
                  onDelete={(eventId) => deleteEventMutation.mutate(eventId)}
                  onViewStats={handleViewStats}
                  emptyMessage="No events found."
                  showPastIndicator={true}
                  showCancel={true}
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Stats Dialog for Past Events */}
      <Dialog open={statsDialogOpen} onOpenChange={setStatsDialogOpen}>
        <DialogContent className="max-w-2xl">
          {selectedEventForStats && (
            <>
              <DialogHeader>
                <DialogTitle>Event Statistics</DialogTitle>
                <DialogDescription>
                  View details and statistics for this past event
                </DialogDescription>
              </DialogHeader>
              <EventStatsContent event={selectedEventForStats} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <EventsPageContent />
    </Suspense>
  );
}

// Component to fetch and display engagement count for an event
function EventEngagementCount({ eventId }: { eventId: string }) {
  const { getToken } = useAuth();
  const { data } = useQuery({
    queryKey: ["event-attendees", eventId],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getEventAttendees(token, eventId);
    },
  });

  return <span>{data?.attendeeCount || 0}</span>;
}

// Component to display event statistics in dialog
function EventStatsContent({ event }: { event: EventItem }) {
  const { getToken } = useAuth();
  const { data: attendeesData, isLoading: attendeesLoading } = useQuery({
    queryKey: ["event-attendees", event.event.id],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getEventAttendees(token, event.event.id);
    },
  });

  const date = new Date(event.event.startTime);
  const endDate = event.event.endTime ? new Date(event.event.endTime) : null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{event.event.title}</h3>
        {event.event.description && (
          <p className="text-sm text-muted-foreground mb-4">{event.event.description}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Date</p>
          <p className="text-sm">
            {date.toLocaleDateString()} {date.toLocaleTimeString()}
          </p>
          {endDate && (
            <p className="text-sm text-muted-foreground mt-1">
              Ends: {endDate.toLocaleDateString()} {endDate.toLocaleTimeString()}
            </p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">Location</p>
          <p className="text-sm">{event.event.locationName}</p>
          {event.event.address && (
            <p className="text-sm text-muted-foreground mt-1">{event.event.address}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">Status</p>
          <span
            className={`inline-block px-2 py-1 rounded text-xs ${getStatusBadgeClass(event.event.status)}`}
          >
            {event.event.status}
          </span>
        </div>

        <div>
          <p className="text-sm font-medium text-muted-foreground">Group</p>
          <p className="text-sm">{event.group?.name || "Unknown"}</p>
        </div>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium text-muted-foreground mb-2">Statistics</p>
        <div>
          <p className="text-sm">
            Reminder Count:{" "}
            {attendeesLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : (
              <span className="font-semibold">{attendeesData?.attendeeCount || 0}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
