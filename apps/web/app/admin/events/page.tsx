"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  CalendarIcon,
  EditIcon,
  EyeIcon,
  PlusIcon,
  ReloadIcon,
  SearchIcon,
  TrashIcon,
} from "mage-icons-react/stroke";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { adminApi, eventsApi, groupsApi } from "@/lib/api-client";
import { type AdminEvent, type AdminGroup, type EventStatus } from "@/lib/types/admin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type DialogState =
  | { type: "none" }
  | { type: "edit"; event: AdminEvent }
  | { type: "delete"; eventId: string }
  | { type: "bulk-delete" }
  | { type: "bulk-status"; status: EventStatus };

export default function EventsPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    locationName: "",
    address: "",
    lat: "",
    lng: "",
    status: "DRAFT" as EventStatus,
    sourceUrl: "",
    aiSummary: "",
    groupId: "",
  });

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const token = await getToken();
      return eventsApi.getAllEvents(token);
    },
  });
  const events = (eventsData?.events || []) as AdminEvent[];

  const { data: groupsData } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getAllGroups(token);
    },
  });
  const groups = (groupsData?.groups || []) as AdminGroup[];

  const editMutation = useMutation({
    mutationFn: async ({ eventId, data }: { eventId: string; data: Record<string, unknown> }) => {
      const token = await getToken();
      return eventsApi.updateEvent(token, eventId, data);
    },
    onSuccess: () => {
      toast.success("Event updated");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update event");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const token = await getToken();
      return eventsApi.deleteEvent(token, eventId);
    },
    onSuccess: () => {
      toast.success("Event deleted");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete event");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (eventIds: string[]) => {
      const token = await getToken();
      return adminApi.bulkDeleteEvents(token, eventIds);
    },
    onSuccess: () => {
      toast.success("Events deleted");
      setDialog({ type: "none" });
      setSelectedEvents(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete events");
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ eventIds, status }: { eventIds: string[]; status: EventStatus }) => {
      const token = await getToken();
      return adminApi.bulkUpdateEventStatus(token, eventIds, status);
    },
    onSuccess: () => {
      toast.success("Events updated");
      setDialog({ type: "none" });
      setSelectedEvents(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update events");
    },
  });

  const handleEdit = () => {
    if (dialog.type !== "edit") return;
    const startTimeISO = formData.startTime
      ? new Date(formData.startTime).toISOString()
      : dialog.event.event.startTime;
    const endTimeISO = formData.endTime
      ? new Date(formData.endTime).toISOString()
      : dialog.event.event.endTime || undefined;
    editMutation.mutate({
      eventId: dialog.event.event.id,
      data: {
        ...formData,
        startTime: startTimeISO,
        endTime: endTimeISO,
        lat: formData.lat ? Number(formData.lat) : undefined,
        lng: formData.lng ? Number(formData.lng) : undefined,
      },
    });
  };

  const handleDelete = () => {
    if (dialog.type !== "delete") return;
    deleteMutation.mutate(dialog.eventId);
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedEvents));
  };

  const handleBulkStatusUpdate = () => {
    if (dialog.type !== "bulk-status") return;
    bulkStatusMutation.mutate({ eventIds: Array.from(selectedEvents), status: dialog.status });
  };

  const openEditDialog = (event: AdminEvent) => {
    const startTime = new Date(event.event.startTime);
    const endTime = event.event.endTime ? new Date(event.event.endTime) : null;
    setFormData({
      title: event.event.title,
      description: event.event.description || "",
      startTime: startTime.toISOString().slice(0, 16),
      endTime: endTime ? endTime.toISOString().slice(0, 16) : "",
      locationName: event.event.locationName,
      address: event.event.address || "",
      lat: event.event.lat?.toString() || "",
      lng: event.event.lng?.toString() || "",
      status: event.event.status,
      sourceUrl: event.event.sourceUrl || "",
      aiSummary: event.event.aiSummary || "",
      groupId: event.event.groupId,
    });
    setDialog({ type: "edit", event });
  };

  const toggleEventSelection = (eventId: string) => {
    const newSelected = new Set(selectedEvents);
    if (newSelected.has(eventId)) {
      newSelected.delete(eventId);
    } else {
      newSelected.add(eventId);
    }
    setSelectedEvents(newSelected);
  };

  const toggleAllEvents = () => {
    if (selectedEvents.size === filteredEvents.length) {
      setSelectedEvents(new Set());
    } else {
      setSelectedEvents(new Set(filteredEvents.map((e) => e.event.id)));
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.event.title.toLowerCase().includes(search.toLowerCase()) ||
      event.event.locationName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || event.event.status === statusFilter;
    const matchesOrg = orgFilter === "all" || event.event.groupId === orgFilter;
    return matchesSearch && matchesStatus && matchesOrg;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">Event Management</h1>
          <p className="mt-2 text-muted-foreground">Manage all events on the platform</p>
        </div>
        <Button onClick={() => router.push("/admin/events/create")}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Event
        </Button>
      </div>

      {/* Filters and Bulk Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Groups</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEvents.size > 0 && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedEvents.size} event(s) selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialog({ type: "bulk-status", status: "PUBLISHED" })}
                >
                  Update Status
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDialog({ type: "bulk-delete" })}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedEvents(new Set())}>
                  Clear Selection
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Events List */}
      <Card>
        <CardHeader>
          <CardTitle>Events ({filteredEvents.length})</CardTitle>
          <CardDescription>Create, edit, and manage events</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No events found</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedEvents.size === filteredEvents.length}
                  onCheckedChange={toggleAllEvents}
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>
              {filteredEvents.map((event) => (
                <div
                  key={event.event.id}
                  className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedEvents.has(event.event.id)}
                    onCheckedChange={() => toggleEventSelection(event.event.id)}
                  />
                  {event.event.flyerImages[0] ? (
                    <Image
                      src={event.event.flyerImages[0]}
                      alt={event.event.title}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{event.event.title}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          event.event.status === "PUBLISHED"
                            ? "bg-chart-2/20 text-chart-2"
                            : event.event.status === "DRAFT"
                              ? "bg-muted/50 text-muted-foreground"
                              : event.event.status === "CANCELLED"
                                ? "bg-destructive/20 text-destructive"
                                : "bg-chart-3/20 text-chart-3"
                        }`}
                      >
                        {event.event.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {event.group?.name || "Unknown Group"} • {event.event.locationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.event.startTime).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/events/${event.event.id}`}>
                      <Button variant="outline" size="sm">
                        <EyeIcon className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                      <EditIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDialog({ type: "delete", eventId: event.event.id })}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={dialog.type === "edit"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Title *</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    title: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-groupId">Group *</Label>
              <Select
                value={formData.groupId}
                onValueChange={(value) => setFormData({ ...formData, groupId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-startTime">Start Time *</Label>
              <Input
                id="edit-startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    startTime: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-locationName">Location Name *</Label>
              <Input
                id="edit-locationName"
                value={formData.locationName}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    locationName: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: EventStatus) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ type: "none" })}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={dialog.type === "delete"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog
        open={dialog.type === "bulk-delete"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedEvents.size} events?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete {selectedEvents.size}{" "}
              selected events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Status Update Dialog */}
      <AlertDialog
        open={dialog.type === "bulk-status"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Status</AlertDialogTitle>
            <AlertDialogDescription>
              Update status for {selectedEvents.size} selected events
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select
              value={dialog.type === "bulk-status" ? dialog.status : "PUBLISHED"}
              onValueChange={(value: EventStatus) =>
                setDialog((prev) =>
                  prev.type === "bulk-status" ? { ...prev, status: value } : prev,
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="ARCHIVED">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkStatusUpdate}
              disabled={bulkStatusMutation.isPending}
            >
              {bulkStatusMutation.isPending ? "Updating..." : "Update"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
