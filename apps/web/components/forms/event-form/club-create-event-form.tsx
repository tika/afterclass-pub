"use client";

import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "mage-icons-react/stroke";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EventFormFields } from "@/components/forms/event-form/event-form-fields";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClubContext } from "@/hooks/use-club-context";
import { eventsApi } from "@/lib/api-client";

const createEventSchema = z
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
  })
  .refine(
    (data) => {
      if (!data.startTime || !data.endTime) return true;
      return new Date(data.endTime) > new Date(data.startTime);
    },
    { message: "End time must be after start time", path: ["endTime"] },
  );

type CreateEventFormData = z.infer<typeof createEventSchema>;

export function ClubCreateEventForm({ eventId }: { eventId?: string }) {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { groupId, slug } = useClubContext();
  const isEditMode = !!eventId;

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
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
    },
  });

  // Fetch event data if in edit mode
  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return eventsApi.getEvent(token, eventId);
    },
    enabled: isEditMode && !!eventId,
  });

  // Prefill form with event data when in edit mode
  useEffect(() => {
    if (isEditMode && eventData) {
      const event = eventData.event;

      // Convert ISO datetime to local datetime format
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
        title: event.title || "",
        description: event.description || "",
        flyerImages: event.flyerImages,
        startTime: event.startTime ? formatLocalDateTime(event.startTime) : "",
        endTime: event.endTime ? formatLocalDateTime(event.endTime) : "",
        locationName: event.locationName || "",
        address: event.address || "",
        lat: event.lat ?? null,
        lng: event.lng ?? null,
        locationDetail: "",
        status: event.status === "DRAFT" || event.status === "PUBLISHED" ? event.status : "DRAFT",
      });
    } else {
      // Prefill form if duplicate parameters are present (create mode)
      const title = searchParams.get("title");
      const description = searchParams.get("description");
      const locationName = searchParams.get("locationName");
      const address = searchParams.get("address");
      const lat = searchParams.get("lat");
      const lng = searchParams.get("lng");
      const status = searchParams.get("status");
      const startTime = searchParams.get("startTime");
      const endTime = searchParams.get("endTime");

      if (title) form.setValue("title", title);
      if (description) form.setValue("description", description);
      if (locationName) form.setValue("locationName", locationName);
      if (address) form.setValue("address", address);
      if (lat) form.setValue("lat", parseFloat(lat) || null);
      if (lng) form.setValue("lng", parseFloat(lng) || null);
      if (status && (status === "DRAFT" || status === "PUBLISHED")) {
        form.setValue("status", status);
      }
      if (startTime) form.setValue("startTime", startTime);
      if (endTime) form.setValue("endTime", endTime);
    }
  }, [isEditMode, eventData, searchParams, form]);

  const formatDateTime = (dateTimeLocal: string): string => {
    if (!dateTimeLocal) return "";
    return new Date(dateTimeLocal).toISOString();
  };

  const buildEventPayload = (data: CreateEventFormData) => {
    const payload: Record<string, unknown> = {
      title: data.title,
      startTime: formatDateTime(data.startTime),
      locationName: data.locationName,
      ...(data.description && { description: data.description }),
      flyerImages: data.flyerImages,
      ...(data.endTime && { endTime: formatDateTime(data.endTime) }),
      ...(data.address && { address: data.address }),
      ...(data.lat != null && { lat: data.lat }),
      ...(data.lng != null && { lng: data.lng }),
    };

    if (!isEditMode) {
      if (!groupId) throw new Error("No group selected");
      payload.groupId = groupId;
      payload.status = data.status;
    } else if (data.status) {
      payload.status = data.status;
    }

    return payload;
  };

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData) => {
      if (!groupId) throw new Error("No group selected");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const payload = buildEventPayload(data);
      return eventsApi.createEvent(token, payload as Parameters<typeof eventsApi.createEvent>[1]);
    },
    onSuccess: () => {
      toast.success("Event created successfully!");
      form.reset();
      queryClient.invalidateQueries({
        queryKey: ["group-events", groupId],
      });
      router.push(`/clubs/${slug}/events`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create event");
    },
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData) => {
      if (!eventId) throw new Error("No event ID provided");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const payload = buildEventPayload(data);
      return eventsApi.updateEvent(token, eventId, payload);
    },
    onSuccess: () => {
      toast.success("Event updated successfully!");
      queryClient.invalidateQueries({
        queryKey: ["group-events", groupId],
      });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      router.push(`/clubs/${slug}/events`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update event");
    },
  });

  const onSubmit = async (data: CreateEventFormData) => {
    if (isEditMode) {
      updateEventMutation.mutate(data);
    } else {
      createEventMutation.mutate(data);
    }
  };

  const handleBack = () => {
    router.push(`/clubs/${slug}/events`);
  };

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>No Group Selected</CardTitle>
            <CardDescription>
              Please select a group from the sidebar to create events.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Events
        </Button>
      </div>

      {eventLoading && isEditMode ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading event...</div>
        </div>
      ) : (
        <div className="w-full max-w-5xl">
          <h1 className="text-2xl font-bold">{isEditMode ? "Edit Event" : "Create New Event"}</h1>
          <p className="text-muted-foreground mt-1">
            {isEditMode
              ? "Update the details for your event"
              : "Fill in the details for your event"}
          </p>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
              <EventFormFields groupId={groupId} showGroupSelect={false} allowAllStatuses={false} />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleBack}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    isEditMode ? updateEventMutation.isPending : createEventMutation.isPending
                  }
                >
                  {isEditMode
                    ? updateEventMutation.isPending
                      ? "Updating..."
                      : "Update Event"
                    : createEventMutation.isPending
                      ? "Creating..."
                      : "Create Event"}
                </Button>
              </div>
            </form>
          </FormProvider>
        </div>
      )}
    </div>
  );
}
