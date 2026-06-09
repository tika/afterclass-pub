"use client";

import { format } from "date-fns";
import { CalendarIcon, ClockIcon } from "mage-icons-react/stroke";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: string; // ISO datetime string or datetime-local format
  onChange: (value: string) => void; // Returns datetime-local format string
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(value ? new Date(value) : undefined);
  const [time, setTime] = React.useState<string>(() => {
    if (value) {
      const d = new Date(value);
      return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    }
    return "";
  });

  React.useEffect(() => {
    if (value && value.trim() !== "") {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        setDate(d);
        setTime(
          `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        );
      }
    } else {
      setDate(undefined);
      setTime("");
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      setDate(undefined);
      onChange("");
      return;
    }

    // If time is set, combine date and time
    if (time) {
      const [hours, minutes] = time.split(":").map(Number);
      const combined = new Date(selectedDate);
      combined.setHours(hours ?? 0, minutes ?? 0, 0, 0);
      setDate(combined);
      // Format as datetime-local: YYYY-MM-DDTHH:mm
      const formatted = format(combined, "yyyy-MM-dd'T'HH:mm");
      onChange(formatted);
    } else {
      // Just set date, time will be added when time is set
      setDate(selectedDate);
    }
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date && newTime && newTime.trim() !== "") {
      const [hours, minutes] = newTime.split(":").map(Number);
      if (hours && minutes && !Number.isNaN(hours) && !Number.isNaN(minutes)) {
        const combined = new Date(date);
        combined.setHours(hours, minutes, 0, 0);
        // Format as datetime-local: YYYY-MM-DDTHH:mm
        const formatted = format(combined, "yyyy-MM-dd'T'HH:mm");
        onChange(formatted);
      }
    } else if (date && (!newTime || newTime.trim() === "")) {
      // Time cleared but date still set - don't clear the date, just don't update
      // This allows user to set date first, then time
    }
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
        </PopoverContent>
      </Popover>
      <div className="relative flex-1">
        <ClockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="time"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="pl-9"
          disabled={disabled || !date}
          placeholder="HH:mm"
        />
      </div>
    </div>
  );
}
