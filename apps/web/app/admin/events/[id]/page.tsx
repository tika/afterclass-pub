"use client";

import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeftIcon,
  CalendarIcon,
  EditIcon,
  MapMarkerIcon,
  ReloadIcon,
  TrashIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EventFormFields } from "@/components/forms/event-form/event-form-fields";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { adminApi, eventsApi, groupsApi } from "@/lib/api-client";

interface Event {
  event: {
    id: string;
    title: string;
    description: string | null;
    flyerImages: string[] | null;
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
}

interface Group {
  id: string;
  name: string;
}

const editEventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    flyerImages: z.array(z.string().url()).min(1, "At least one flyer image is required").max(3),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().optional(),
    locationName: z.string().min(1, "Location name is required"),
    address: z.string().optional(),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    locationDetail: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]),
    groupId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      return new Date(data.endTime) > new Date(data.startTime);
    },
    { message: "End time must be after start time", path: ["endTime"] },
  );

type EditEventFormData = z.infer<typeof editEventSchema>;

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const form = useForm<EditEventFormData>({
    resolver: zodResolver(editEventSchema),
    defaultValues: {
      title: "",
      description: "",
      flyerImages: [],
      startTime: "",
      endTime: "",
      locationName: "",
      address: "",
      lat: null,
      lng: null,
      locationDetail: "",
      status: "DRAFT",
      groupId: "",
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = await getToken();

        // Fetch event details
        const eventsData = await eventsApi.getAllEvents(token);
        const foundEvent = eventsData.events.find((e) => e.event.id === eventId);
        if (foundEvent) {
          setEvent(foundEvent);

          const formatLocalDateTime = (isoString: string): string => {
            const date = new Date(isoString);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          };

          form.reset({
            title: foundEvent.event.title || "",
            description: foundEvent.event.description || "",
            flyerImages: foundEvent.event.flyerImages,
            startTime: foundEvent.event.startTime
              ? formatLocalDateTime(foundEvent.event.startTime)
              : "",
            endTime: foundEvent.event.endTime ? formatLocalDateTime(foundEvent.event.endTime) : "",
            locationName: foundEvent.event.locationName || "",
            address: foundEvent.event.address || "",
            lat: foundEvent.event.lat ?? null,
            lng: foundEvent.event.lng ?? null,
            locationDetail: "",
            status: foundEvent.event.status,
            groupId: foundEvent.event.groupId,
          });
        }

        // Fetch attendee count
        const attendeesData = await adminApi.getEventAttendees(token, eventId);
        setAttendeeCount(attendeesData.attendeeCount || 0);

        // Fetch groups
        const groupsData = await groupsApi.getAllGroups(token);
        setGroups(groupsData.groups || []);
      } catch (error) {
        console.error("Failed to fetch event data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchData();
    }
  }, [eventId, getToken]);

  // Reset form when dialog opens to ensure latest data
  useEffect(() => {
    if (editDialogOpen && event) {
      const formatLocalDateTime = (isoString: string): string => {
        const date = new Date(isoString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      form.reset({
        title: event.event.title || "",
        description: event.event.description || "",
        flyerImages: event.event.flyerImages || [],
        startTime: event.event.startTime ? formatLocalDateTime(event.event.startTime) : "",
        endTime: event.event.endTime ? formatLocalDateTime(event.event.endTime) : "",
        locationName: event.event.locationName || "",
        address: event.event.address || "",
        lat: event.event.lat ?? null,
        lng: event.event.lng ?? null,
        locationDetail: "",
        status: event.event.status,
        groupId: event.event.groupId,
      });
    }
  }, [editDialogOpen, event, form]);

  const formatDateTime = (dateTimeLocal: string): string => {
    if (!dateTimeLocal) return "";
    return new Date(dateTimeLocal).toISOString();
  };

  const buildEventPayload = (data: EditEventFormData) => {
    const payload: Record<string, unknown> = {
      title: data.title,
      startTime: formatDateTime(data.startTime),
      locationName: data.locationName,
      status: data.status,
      ...(data.groupId && { groupId: data.groupId }),
      ...(data.description && { description: data.description }),
      flyerImages: data.flyerImages,
      ...(data.endTime && { endTime: formatDateTime(data.endTime) }),
      ...(data.address && { address: data.address }),
      ...(data.lat != null && { lat: data.lat }),
      ...(data.lng != null && { lng: data.lng }),
    };

    return payload;
  };

  const handleEdit = async (data: EditEventFormData) => {
    if (!event) return;
    try {
      const token = await getToken();
      const payload = buildEventPayload(data);
      await eventsApi.updateEvent(token, event.event.id, payload);
      toast.success("Event updated successfully!");
      setEditDialogOpen(false);
      // Refresh data
      const eventsData = await eventsApi.getAllEvents(token);
      const foundEvent = eventsData.events.find((e) => e.event.id === eventId);
      if (foundEvent) {
        setEvent(foundEvent);

        const formatLocalDateTime = (isoString: string): string => {
          const date = new Date(isoString);
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        };

        form.reset({
          title: foundEvent.event.title || "",
          description: foundEvent.event.description || "",
          flyerImages: foundEvent.event.flyerImages || [],
          startTime: foundEvent.event.startTime
            ? formatLocalDateTime(foundEvent.event.startTime)
            : "",
          endTime: foundEvent.event.endTime ? formatLocalDateTime(foundEvent.event.endTime) : "",
          locationName: foundEvent.event.locationName || "",
          address: foundEvent.event.address || "",
          lat: foundEvent.event.lat ?? null,
          lng: foundEvent.event.lng ?? null,
          locationDetail: "",
          status: foundEvent.event.status,
          groupId: foundEvent.event.groupId,
        });
      }
    } catch (error) {
      console.error("Failed to update event:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update event");
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      const token = await getToken();
      await eventsApi.deleteEvent(token, event.event.id);
      router.push("/admin/events");
    } catch (error) {
      console.error("Failed to delete event:", error);
      alert("Failed to delete event");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Event not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/events">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-headline">{event.event.title}</h1>
            <p className="text-muted-foreground">{event.group?.name || "Unknown Group"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <EditIcon className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Event Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <p>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
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
                </p>
              </div>
              {event.event.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{event.event.description}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Start Time
                </Label>
                <p className="font-semibold">{new Date(event.event.startTime).toLocaleString()}</p>
              </div>
              {event.event.endTime && (
                <div>
                  <Label className="text-muted-foreground">End Time</Label>
                  <p className="font-semibold">{new Date(event.event.endTime).toLocaleString()}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground flex items-center gap-2">
                  <MapMarkerIcon className="h-4 w-4" />
                  Location
                </Label>
                <p className="font-semibold">{event.event.locationName}</p>
                {event.event.address && (
                  <p className="text-sm text-muted-foreground">{event.event.address}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p>{new Date(event.event.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="h-5 w-5" />
              Attendees
            </CardTitle>
            <CardDescription>Users with reminders for this event</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-4xl font-bold mb-2">{attendeeCount}</div>
              <p className="text-muted-foreground">users have reminders</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event details</DialogDescription>
          </DialogHeader>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(handleEdit)}>
              <div className="grid gap-4 py-4">
                <EventFormFields
                  groupId={event?.event.groupId || null}
                  showGroupSelect={true}
                  groups={groups}
                  allowAllStatuses={true}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
