"use client";

import { FileIcon, MapMarkerIcon } from "mage-icons-react/stroke";
import { Controller, useFormContext, useWatch } from "react-hook-form";
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
import { FlyerUploadHero } from "./flyer-upload-hero";
import type { LocationInputValue } from "./location-input";
import { LocationInput } from "./location-input";
import { StartEndTimePicker } from "./start-end-time-picker";

// --- Types ---

interface Group {
  id: string;
  name: string;
}

export interface EventFormData {
  title: string;
  description?: string;
  flyerImages: string[];
  startTime: string;
  endTime?: string;
  locationName: string;
  address?: string;
  lat: number | null;
  lng: number | null;
  locationDetail?: string;
  status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
  groupId?: string;
}

const EVENT_STATUSES = [
  { value: "DRAFT", label: "Draft" },
  { value: "PUBLISHED", label: "Published" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

// --- Reusable Form Field Components ---

interface FormInputFieldProps {
  name: keyof EventFormData;
  label: string;
  placeholder?: string;
  description?: string;
  icon?: React.ReactNode;
  inputClassName?: string;
}

function FormInputField({
  name,
  label,
  placeholder,
  description,
  icon,
  inputClassName,
}: FormInputFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<EventFormData>();

  return (
    <Field>
      <FieldLabel htmlFor={name} className={icon ? "flex items-center gap-2" : undefined}>
        {icon}
        {label}
      </FieldLabel>
      <Input id={name} {...register(name)} placeholder={placeholder} className={inputClassName} />
      {description && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{errors[name]?.message}</FieldError>
    </Field>
  );
}

interface FormTextareaFieldProps {
  name: keyof EventFormData;
  label: string;
  placeholder?: string;
  rows?: number;
  icon?: React.ReactNode;
}

function FormTextareaField({ name, label, placeholder, rows = 3, icon }: FormTextareaFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<EventFormData>();

  return (
    <Field>
      <FieldLabel htmlFor={name} className={icon ? "flex items-center gap-2" : undefined}>
        {icon}
        {label}
      </FieldLabel>
      <Textarea id={name} {...register(name)} placeholder={placeholder} rows={rows} />
      <FieldError>{errors[name]?.message}</FieldError>
    </Field>
  );
}

// --- Main Component ---

interface EventFormFieldsProps {
  groupId: string | null;
  showGroupSelect?: boolean;
  groups?: Group[];
  allowAllStatuses?: boolean;
}

export function EventFormFields({
  groupId,
  showGroupSelect = false,
  groups = [],
  allowAllStatuses = false,
}: EventFormFieldsProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext<EventFormData>();

  const availableStatuses = allowAllStatuses
    ? EVENT_STATUSES
    : EVENT_STATUSES.filter((s) => s.value === "DRAFT" || s.value === "PUBLISHED");

  return (
    <FieldGroup>
      {/* Flyer Images */}
      <Field>
        <FieldLabel htmlFor="flyerImages">Flyer Images *</FieldLabel>
        <Controller
          name="flyerImages"
          control={control}
          render={({ field }) => (
            <FlyerUploadHero
              value={field.value}
              onChange={field.onChange}
              maxImages={3}
              error={errors.flyerImages?.message}
            />
          )}
        />
      </Field>

      <FieldGroup className="space-y-5">
        {/* Title */}
        <FormInputField
          name="title"
          label="Title"
          placeholder="Event title"
          inputClassName="text-lg font-medium bg-input/20 border-input focus-visible:bg-input/30"
        />

        {/* Start & End Time */}
        <Field>
          <FieldLabel htmlFor="startTime">Start & End</FieldLabel>
          <Controller
            name="startTime"
            control={control}
            render={({ field: startField }) => (
              <Controller
                name="endTime"
                control={control}
                render={({ field: endField }) => (
                  <StartEndTimePicker
                    startTime={startField.value}
                    endTime={endField.value || ""}
                    onStartChange={startField.onChange}
                    onEndChange={endField.onChange}
                  />
                )}
              />
            )}
          />
          <FieldError>{errors.startTime?.message || errors.endTime?.message}</FieldError>
        </Field>

        {/* Location */}
        <Field>
          <FieldLabel htmlFor="locationName" className="flex items-center gap-2">
            <MapMarkerIcon className="h-4 w-4" />
            Add Event Location
          </FieldLabel>
          <LocationController control={control} />
          <FieldDescription>Offline location or virtual link</FieldDescription>
          <FieldError>{errors.locationName?.message || errors.lat?.message}</FieldError>
        </Field>

        {/* Description */}
        <FormTextareaField
          name="description"
          label="Add Description"
          placeholder="Event description"
          icon={<FileIcon className="h-4 w-4" />}
        />

        {/* Group Select */}
        {showGroupSelect && (
          <Field>
            <FieldLabel htmlFor="groupId">Group</FieldLabel>
            <Controller
              name="groupId"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <SelectTrigger id="groupId">
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
              )}
            />
            <FieldError>{errors.groupId?.message}</FieldError>
          </Field>
        )}

        {/* Status */}
        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableStatuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </FieldGroup>
    </FieldGroup>
  );
}

// --- Location Controller (complex multi-field) ---

function LocationController({
  control,
}: {
  control: ReturnType<typeof useFormContext<EventFormData>>["control"];
}) {
  const { setValue } = useFormContext<EventFormData>();

  const locationName = useWatch({ control, name: "locationName" });
  const address = useWatch({ control, name: "address" });
  const lat = useWatch({ control, name: "lat" });
  const lng = useWatch({ control, name: "lng" });
  const locationDetail = useWatch({ control, name: "locationDetail" });

  const handleLocationChange = (loc: LocationInputValue) => {
    setValue("locationName", loc.locationName, { shouldValidate: true });
    setValue("address", loc.address ?? "", { shouldValidate: true });
    setValue("lat", loc.lat, { shouldValidate: true });
    setValue("lng", loc.lng, { shouldValidate: true });
    setValue("locationDetail", loc.locationDetail ?? "", { shouldValidate: true });
  };

  return (
    <LocationInput
      value={{
        locationName: locationName || "",
        address: address || null,
        lat: lat,
        lng: lng,
        locationDetail: locationDetail || null,
      }}
      onChange={handleLocationChange}
    />
  );
}
