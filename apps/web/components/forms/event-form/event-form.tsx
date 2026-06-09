"use client";

import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { eventsApi, groupsApi } from "@/lib/api-client";
import { ImageUpload } from "./image-upload";
import { LocationPicker } from "./location-picker";

// Form schema - accepts datetime-local format, converts to ISO in mutation
// Note: lat/lng are strings in the form (empty string or number string), converted to numbers in mutation
const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  flyerImages: z.array(z.string().url()).min(1, "At least one flyer image is required").max(3),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.union([z.string(), z.literal("")]).optional(),
  locationName: z.string().min(1, "Location name is required"),
  address: z.string().optional(),
  lat: z
    .string()
    .refine(
      (val) =>
        val === "" || (!Number.isNaN(Number(val)) && Number(val) >= -90 && Number(val) <= 90),
      {
        message: "Latitude must be between -90 and 90",
      },
    )
    .optional(),
  lng: z
    .string()
    .refine(
      (val) =>
        val === "" || (!Number.isNaN(Number(val)) && Number(val) >= -180 && Number(val) <= 180),
      {
        message: "Longitude must be between -180 and 180",
      },
    )
    .optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]).optional(),
  sourceUrl: z.union([z.string().url("Invalid source URL"), z.literal("")]).optional(),
  aiSummary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  orgId: z.string().uuid("Invalid organization ID"),
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

export function EventForm() {
  const { getToken } = useAuth();
  const router = useRouter();

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
      lat: "",
      lng: "",
      status: "DRAFT",
      sourceUrl: "",
      aiSummary: "",
      metadata: {},
      orgId: "",
    },
  });

  // Fetch groups for dropdown
  const { data: groupsData, isLoading: loadingGroups } = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getAllGroups(token);
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData) => {
      const token = await getToken();
      if (!token) {
        throw new Error("Not authenticated");
      }

      // Convert datetime-local format to ISO datetime string
      const formatDateTime = (dateTimeLocal: string): string => {
        if (!dateTimeLocal) return "";
        // datetime-local format is "YYYY-MM-DDTHH:mm", convert to ISO string
        return new Date(dateTimeLocal).toISOString();
      };

      // Prepare payload - remove empty strings and convert to proper types
      // Note: form uses orgId but API expects groupId
      const payload = {
        title: data.title,
        startTime: formatDateTime(data.startTime),
        locationName: data.locationName,
        groupId: data.orgId, // Map orgId to groupId for API
        flyerImages: data.flyerImages,
        ...(data.description && { description: data.description }),
        ...(data.endTime && { endTime: formatDateTime(data.endTime) }),
        ...(data.address && { address: data.address }),
        ...(data.lat !== "" && data.lat !== undefined && { lat: Number(data.lat) }),
        ...(data.lng !== "" && data.lng !== undefined && { lng: Number(data.lng) }),
        ...(data.status && { status: data.status }),
        ...(data.sourceUrl && { sourceUrl: data.sourceUrl }),
        ...(data.aiSummary && { aiSummary: data.aiSummary }),
        ...(data.metadata && { metadata: data.metadata }),
      };

      return eventsApi.createEvent(token, payload);
    },
    onSuccess: () => {
      toast.success("Event created successfully!");
      router.push("/admin/events");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create event");
    },
  });

  const onSubmit = async (data: CreateEventFormData) => {
    createEventMutation.mutate(data);
  };

  const groups = groupsData?.groups || [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full max-w-2xl">
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Event Details</FieldLegend>
          <FieldDescription>Create a new event for your group</FieldDescription>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                id="title"
                {...form.register("title")}
                aria-invalid={!!form.formState.errors.title}
              />
              <FieldError errors={[form.formState.errors.title]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                {...form.register("description")}
                rows={4}
                placeholder="Enter event description..."
              />
              <FieldDescription>Optional: Provide details about the event</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="orgId">Group</FieldLabel>
              <Select
                value={form.watch("orgId")}
                onValueChange={(value) => form.setValue("orgId", value)}
                disabled={loadingGroups}
              >
                <SelectTrigger id="orgId" aria-invalid={!!form.formState.errors.orgId}>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.orgId]} />
            </Field>

            <Field>
              <FieldLabel>Flyer Images *</FieldLabel>
              <ImageUpload
                value={form.watch("flyerImages")}
                onChange={(images) => form.setValue("flyerImages", images)}
                maxImages={3}
              />
              <FieldError errors={[form.formState.errors.flyerImages]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Date & Time</FieldLegend>
          <FieldDescription>When will this event take place?</FieldDescription>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="startTime">Start Time</FieldLabel>
              <Input
                id="startTime"
                type="datetime-local"
                {...form.register("startTime")}
                aria-invalid={!!form.formState.errors.startTime}
              />
              <FieldError errors={[form.formState.errors.startTime]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="endTime">End Time</FieldLabel>
              <Input
                id="endTime"
                type="datetime-local"
                {...form.register("endTime")}
                aria-invalid={!!form.formState.errors.endTime}
              />
              <FieldDescription>Optional: When the event ends</FieldDescription>
              <FieldError errors={[form.formState.errors.endTime]} />
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Location</FieldLegend>
          <FieldDescription>Where will this event be held?</FieldDescription>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="locationName">Location Name</FieldLabel>
              <Input
                id="locationName"
                {...form.register("locationName")}
                placeholder="e.g., Student Center, Room 101"
                aria-invalid={!!form.formState.errors.locationName}
              />
              <FieldError errors={[form.formState.errors.locationName]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="address">Address</FieldLabel>
              <Input id="address" {...form.register("address")} placeholder="Full street address" />
              <FieldDescription>Optional: Full address of the event location</FieldDescription>
            </Field>

            <Field>
              <FieldLabel>Location Coordinates</FieldLabel>
              <LocationPicker
                lat={
                  form.watch("lat") && form.watch("lat") !== "" ? Number(form.watch("lat")) : null
                }
                lng={
                  form.watch("lng") && form.watch("lng") !== "" ? Number(form.watch("lng")) : null
                }
                onLocationChange={(lat, lng, address, locationName) => {
                  form.setValue("lat", lat.toString());
                  form.setValue("lng", lng.toString());
                  if (address) {
                    form.setValue("address", address);
                  }
                  if (locationName) {
                    form.setValue("locationName", locationName);
                  }
                }}
                onMetadataChange={(meta) => {
                  const currentMeta = form.getValues("metadata") || {};
                  form.setValue("metadata", { ...currentMeta, ...meta });
                }}
              />
              <FieldDescription>
                Click on the map to set coordinates, or use the button to get your current location
              </FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>

        <FieldSet>
          <FieldLegend>Additional Information</FieldLegend>
          <FieldDescription>Optional details and metadata</FieldDescription>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select
                value={form.watch("status") || "DRAFT"}
                onValueChange={(value) =>
                  form.setValue("status", value as "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED")
                }
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="PUBLISHED">Published</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>Set the initial status of the event</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="sourceUrl">Source URL</FieldLabel>
              <Input
                id="sourceUrl"
                type="url"
                {...form.register("sourceUrl")}
                placeholder="https://..."
              />
              <FieldDescription>Optional: Link to original event source</FieldDescription>
              <FieldError errors={[form.formState.errors.sourceUrl]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="aiSummary">AI Summary</FieldLabel>
              <Textarea
                id="aiSummary"
                {...form.register("aiSummary")}
                rows={2}
                placeholder="Short summary for notifications..."
              />
              <FieldDescription>Optional: Brief summary for push notifications</FieldDescription>
            </Field>
          </FieldGroup>
        </FieldSet>

        <Field orientation="horizontal">
          <Button type="submit" disabled={createEventMutation.isPending}>
            {createEventMutation.isPending ? "Creating..." : "Create Event"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
