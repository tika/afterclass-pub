"use client";

import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftIcon } from "mage-icons-react/stroke";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DateTimePicker } from "@/components/forms/event-form/datetime-picker";
import { DurationPicker } from "@/components/forms/event-form/duration-picker";
import { ImageUpload } from "@/components/forms/event-form/image-upload";
import { LocationInput } from "@/components/forms/event-form/location-input";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Autocomplete, type AutocompleteOption } from "@/components/ui/autocomplete";
import { adminApi, eventsApi, groupsApi } from "@/lib/api-client";

const createEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  flyerImages: z.array(z.string().url()).min(1, "At least one flyer image is required").max(3),
  startTime: z.string().min(1, "Start time is required"),
  duration: z.number().min(1, "Duration is required").optional(),
  locationName: z.string().min(1, "Location name is required"),
  address: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
  locationDetail: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"]),
  groupId: z.string().min(1, "Group is required"),
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

function CreateEventPageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [_groupId, setGroupId] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");

  const form = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      title: "",
      description: "",
      flyerImages: [],
      startTime: "",
      duration: undefined,
      locationName: "",
      address: "",
      lat: "",
      lng: "",
      locationDetail: "",
      status: "DRAFT",
      groupId: "",
    },
  });

  const selectedGroupId = form.watch("groupId");

  // Fetch selected group details if we have a groupId (from URL params)
  const { data: selectedGroupData } = useQuery({
    queryKey: ["group", selectedGroupId],
    queryFn: async () => {
      if (!selectedGroupId) return null;
      const token = await getToken();
      return adminApi.getGroup(token, selectedGroupId);
    },
    enabled: !!selectedGroupId,
  });

  // Search groups or get popular groups
  const { data: groupsData, isLoading: groupsLoading } = useQuery({
    queryKey: ["search-groups", groupSearch],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.searchGroups(token, groupSearch, 5);
    },
  });

  const groups = groupsData?.groups || [];

  // Build group options, including selected group if not in search results
  const groupOptions: AutocompleteOption<string>[] = (() => {
    const options = groups.map((group) => ({
      value: group.id,
      label: group.name,
    }));

    // Add selected group to options if it exists and isn't already in the list
    if (selectedGroupData?.group && !options.some((o) => o.value === selectedGroupData.group.id)) {
      options.unshift({
        value: selectedGroupData.group.id,
        label: selectedGroupData.group.name,
      });
    }

    return options;
  })();

  // Get groupId from URL params
  useEffect(() => {
    const urlGroupId = searchParams.get("groupId");
    if (urlGroupId) {
      setGroupId(urlGroupId);
      form.setValue("groupId", urlGroupId);
    }

    // Prefill form if duplicate parameters are present
    const title = searchParams.get("title");
    const description = searchParams.get("description");
    const locationName = searchParams.get("locationName");
    const address = searchParams.get("address");
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const status = searchParams.get("status");

    if (title) {
      form.setValue("title", title);
    }
    if (description) {
      form.setValue("description", description);
    }
    if (locationName) {
      form.setValue("locationName", locationName);
    }
    if (address) {
      form.setValue("address", address);
    }
    if (lat) {
      form.setValue("lat", lat);
    }
    if (lng) {
      form.setValue("lng", lng);
    }
    if (status && ["DRAFT", "PUBLISHED", "CANCELLED", "ARCHIVED"].includes(status)) {
      form.setValue("status", status as "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED");
    }
  }, [searchParams, form]);

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async (data: CreateEventFormData) => {
      if (!data.groupId) throw new Error("No group selected");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const formatDateTime = (dateTimeLocal: string): string => {
        if (!dateTimeLocal) return "";
        return new Date(dateTimeLocal).toISOString();
      };

      // Calculate endTime from startTime + duration
      let endTime: string | undefined;
      if (data.duration && data.duration > 0) {
        const startDate = new Date(data.startTime);
        const endDate = new Date(startDate.getTime() + data.duration * 60 * 1000);
        endTime = endDate.toISOString();
      }

      const payload = {
        title: data.title,
        startTime: formatDateTime(data.startTime),
        locationName: data.locationName,
        groupId: data.groupId,
        status: data.status,
        flyerImages: data.flyerImages,
        ...(data.description && { description: data.description }),
        ...(endTime && { endTime }),
        ...(data.address && { address: data.address }),
        ...(data.lat && { lat: Number(data.lat) }),
        ...(data.lng && { lng: Number(data.lng) }),
        ...(data.locationDetail && { locationDetail: data.locationDetail }),
      };

      return eventsApi.createEvent(token, payload);
    },
    onSuccess: () => {
      toast.success("Event created successfully!");
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      router.push("/admin/events");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create event");
    },
  });

  const onSubmit = async (data: CreateEventFormData) => {
    createEventMutation.mutate(data);
  };

  const handleBack = () => {
    router.push("/admin/events");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Events
        </Button>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Create New Event</h1>
        <p className="text-muted-foreground">Fill in the details for your event</p>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="groupId">Group *</FieldLabel>
              <Autocomplete
                options={groupOptions}
                value={form.watch("groupId")}
                onValueChange={(value) => {
                  form.setValue("groupId", value || "");
                  setGroupId(value || null);
                }}
                onSearch={setGroupSearch}
                placeholder="Select group"
                searchPlaceholder="Search groups..."
                emptyMessage="No groups found"
                loading={groupsLoading}
              />
              <FieldError>{form.formState.errors.groupId?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="title">Title *</FieldLabel>
              <Input id="title" {...form.register("title")} placeholder="Event title" />
              <FieldError>{form.formState.errors.title?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Textarea
                id="description"
                {...form.register("description")}
                placeholder="Event description"
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="startTime">Start Time *</FieldLabel>
              <DateTimePicker
                value={form.watch("startTime")}
                onChange={(value) => form.setValue("startTime", value)}
                placeholder="Select start date and time"
              />
              <FieldError>{form.formState.errors.startTime?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Duration</FieldLabel>
              <DurationPicker
                value={form.watch("duration")}
                onChange={(value) => form.setValue("duration", value)}
              />
              <FieldDescription>How long will this event last?</FieldDescription>
              <FieldError>{form.formState.errors.duration?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Location *</FieldLabel>
              <LocationInput
                value={{
                  locationName: form.watch("locationName"),
                  address: form.watch("address") || null,
                  lat:
                    form.watch("lat") && form.watch("lat") !== ""
                      ? Number(form.watch("lat"))
                      : null,
                  lng:
                    form.watch("lng") && form.watch("lng") !== ""
                      ? Number(form.watch("lng"))
                      : null,
                  locationDetail: form.watch("locationDetail") || null,
                }}
                onChange={(loc) => {
                  form.setValue("locationName", loc.locationName);
                  form.setValue("address", loc.address ?? "");
                  form.setValue("lat", loc.lat?.toString() ?? "");
                  form.setValue("lng", loc.lng?.toString() ?? "");
                  form.setValue("locationDetail", loc.locationDetail ?? "");
                }}
              />
              <FieldError>{form.formState.errors.locationName?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel>Flyer Images *</FieldLabel>
              <ImageUpload
                value={form.watch("flyerImages")}
                onChange={(images) => form.setValue("flyerImages", images)}
                maxImages={3}
              />
              <FieldError>{form.formState.errors.flyerImages?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select
                value={form.watch("status")}
                onValueChange={(value) =>
                  form.setValue("status", value as "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED")
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
            </Field>
          </FieldGroup>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleBack}>
              Cancel
            </Button>
            <Button type="submit" disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateEventPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <CreateEventPageContent />
    </Suspense>
  );
}
