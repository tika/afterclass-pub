"use client";

import { format } from "date-fns";
import { CalendarIcon, GlobeIcon } from "mage-icons-react/stroke";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Generate 30-min time slots: 00:00 through 23:30
const TIME_SLOTS = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hours = String(h).padStart(2, "0");
      const minutes = String(m).padStart(2, "0");
      const value = `${hours}:${minutes}`;
      const date = new Date(2000, 0, 1, h, m);
      const label = format(date, "hh:mm a");
      slots.push({ value, label });
    }
  }
  return slots;
})();

function parseToDatetimeLocal(date: Date, timeValue: string): string {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const d = new Date(date);
  d.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function getTimeValueFromDatetime(dt: string): string {
  if (!dt) return "";
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getTimezoneLabel(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const hours = Math.floor(Math.abs(offset) / 60);
    const mins = Math.abs(offset) % 60;
    const offsetStr = `GMT${sign}${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    // Try to get city name from timezone (e.g. "America/New_York" -> "New York")
    const parts = tz.split("/");
    const city = parts[parts.length - 1]?.replace(/_/g, " ") ?? tz;
    return `${offsetStr} ${city}`;
  } catch {
    return "Local time";
  }
}

interface StartEndTimePickerProps {
  startTime: string;
  endTime: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function StartEndTimePicker({
  startTime,
  endTime,
  onStartChange,
  onEndChange,
  disabled = false,
  className,
}: StartEndTimePickerProps) {
  const startDate = startTime ? new Date(startTime) : undefined;
  const endDate = endTime ? new Date(endTime) : undefined;
  const startTimeValue = getTimeValueFromDatetime(startTime);
  const endTimeValue = getTimeValueFromDatetime(endTime);

  const handleStartDateSelect = (date: Date | undefined) => {
    if (!date) {
      onStartChange("");
      onEndChange("");
      return;
    }
    const timeVal = startTimeValue || "12:00";
    onStartChange(parseToDatetimeLocal(date, timeVal));
    // If end not set or invalid, default to start + 1 hour
    if (!endTimeValue) {
      const defaultEndDate = new Date(date);
      const [h, m] = timeVal.split(":").map(Number);
      defaultEndDate.setHours((h ?? 0) + 1, m ?? 0, 0, 0);
      onEndChange(format(defaultEndDate, "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (!date) {
      onEndChange("");
      return;
    }
    const timeVal = endTimeValue || "13:00";
    onEndChange(parseToDatetimeLocal(date, timeVal));
  };

  const handleStartTimeSelect = (value: string) => {
    if (startDate) {
      onStartChange(parseToDatetimeLocal(startDate, value));
      // Update end if it would become invalid
      if (endDate && new Date(parseToDatetimeLocal(startDate, value)) >= endDate) {
        const endD = new Date(startDate);
        const [h, m] = value.split(":").map(Number);
        endD.setHours((h ?? 0) + 1, m ?? 0, 0, 0);
        onEndChange(format(endD, "yyyy-MM-dd'T'HH:mm"));
      }
    }
  };

  const handleEndTimeSelect = (value: string) => {
    if (endDate) {
      onEndChange(parseToDatetimeLocal(endDate, value));
    } else if (startDate) {
      const d = new Date(startDate);
      const [h, m] = value.split(":").map(Number);
      d.setHours(h ?? 0, m ?? 0, 0, 0);
      onEndChange(format(d, "yyyy-MM-dd'T'HH:mm"));
    }
  };

  const invalidRange = startTime && endTime && new Date(startTime) >= new Date(endTime);

  return (
    <div className={cn("space-y-0", className)}>
      <div className="flex gap-3">
        {/* Dotted line connector */}
        <div className="flex flex-col items-center pt-1 pb-1">
          <div className="w-px flex-1 min-h-[8px] border-l-2 border-dotted border-border" />
          <div className="w-px flex-1 min-h-[8px] border-l-2 border-dotted border-border" />
        </div>

        <div className="flex-1 space-y-2">
          {/* Start row: date + time grouped */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium w-12 shrink-0">Start</span>
            <div className="flex items-center gap-1.5 rounded-md border border-input bg-background p-0.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 min-w-[110px] justify-start font-normal gap-1.5",
                      !startDate && "text-muted-foreground",
                    )}
                    disabled={disabled}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {startDate ? format(startDate, "MMM d") : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={handleStartDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <div className="h-4 w-px bg-border shrink-0" />
              <Select
                value={startTimeValue || undefined}
                onValueChange={handleStartTimeSelect}
                disabled={disabled || !startDate}
              >
                <SelectTrigger className="h-8 w-[90px] border-0 bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* End row: date + time grouped */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium w-12 shrink-0">End</span>
            <div className="flex items-center gap-1.5 rounded-md border border-input bg-background p-0.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 min-w-[110px] justify-start font-normal gap-1.5",
                      !endDate && "text-muted-foreground",
                    )}
                    disabled={disabled}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    {endDate ? format(endDate, "MMM d") : "Date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={handleEndDateSelect}
                    initialFocus
                    disabled={(date) => (startDate ? date < startDate : false)}
                  />
                </PopoverContent>
              </Popover>
              <div className="h-4 w-px bg-border shrink-0" />
              <Select
                value={endTimeValue || undefined}
                onValueChange={handleEndTimeSelect}
                disabled={disabled || !endDate}
              >
                <SelectTrigger className="h-8 w-[90px] border-0 bg-transparent shadow-none focus:ring-0">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
        <GlobeIcon className="h-3.5 w-3.5" />
        <span>{getTimezoneLabel()}</span>
      </div>

      {invalidRange && (
        <p className="text-sm text-destructive mt-2">End time must be after start time</p>
      )}
    </div>
  );
}
