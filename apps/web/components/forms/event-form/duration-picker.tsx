"use client";

import { ClockIcon } from "mage-icons-react/stroke";
import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface DurationPickerProps {
  value?: number; // Duration in minutes
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

const PRESET_DURATIONS = [
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1.5 hours", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
  { label: "4 hours", value: 240 },
  { label: "6 hours", value: 360 },
  { label: "6h+", value: -1 }, // Special value for custom
];

const CUSTOM_VALUE = -1;
const SIX_HOURS_MINUTES = 360;

export function DurationPicker({
  value,
  onChange,
  disabled = false,
  className,
}: DurationPickerProps) {
  const [isCustom, setIsCustom] = React.useState(false);
  const [customHours, setCustomHours] = React.useState<string>("");
  const [customMinutes, setCustomMinutes] = React.useState<string>("");

  // Determine if current value is a preset or custom
  React.useEffect(() => {
    if (value === undefined || value === 0) {
      setIsCustom(false);
      setCustomHours("");
      setCustomMinutes("");
    } else if (value > SIX_HOURS_MINUTES) {
      // Value is greater than 6 hours, show as custom
      setIsCustom(true);
      setCustomHours(Math.floor(value / 60).toString());
      setCustomMinutes((value % 60).toString());
    } else if (PRESET_DURATIONS.some((p) => p.value === value && p.value !== CUSTOM_VALUE)) {
      setIsCustom(false);
      setCustomHours("");
      setCustomMinutes("");
    } else {
      setIsCustom(true);
      setCustomHours(Math.floor(value / 60).toString());
      setCustomMinutes((value % 60).toString());
    }
  }, [value]);

  const getSelectValue = (): string => {
    if (isCustom || (value && value > SIX_HOURS_MINUTES)) {
      return CUSTOM_VALUE.toString();
    }
    if (value && PRESET_DURATIONS.some((p) => p.value === value)) {
      return value.toString();
    }
    return "";
  };

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === CUSTOM_VALUE.toString()) {
      setIsCustom(true);
      // Initialize to 6 hours if no custom value is set yet
      if (!value || value <= SIX_HOURS_MINUTES) {
        onChange(SIX_HOURS_MINUTES + 60); // 7 hours as default
        setCustomHours("7");
        setCustomMinutes("0");
      }
    } else {
      setIsCustom(false);
      const minutes = parseInt(selectedValue, 10);
      onChange(minutes);
    }
  };

  const handleCustomHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setCustomHours(val);
      updateCustomDuration(val, customMinutes);
    }
  };

  const handleCustomMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      const numVal = parseInt(val || "0", 10);
      if (numVal >= 0 && numVal < 60) {
        setCustomMinutes(val);
        updateCustomDuration(customHours, val);
      }
    }
  };

  const updateCustomDuration = (hours: string, minutes: string) => {
    const hoursNum = parseInt(hours || "0", 10);
    const minutesNum = parseInt(minutes || "0", 10);
    const totalMinutes = hoursNum * 60 + minutesNum;
    if (totalMinutes > 0) {
      onChange(totalMinutes);
    } else {
      onChange(0);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Select value={getSelectValue()} onValueChange={handleSelectChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Select duration..." />
        </SelectTrigger>
        <SelectContent>
          {PRESET_DURATIONS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value.toString()}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Custom Input - Inline when 6h+ is selected */}
      {isCustom && (
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1">
            <ClockIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="number"
              min="0"
              value={customHours}
              onChange={handleCustomHoursChange}
              placeholder="0"
              className="pl-9"
              disabled={disabled}
            />
          </div>
          <span className="text-muted-foreground text-sm whitespace-nowrap">hours</span>
          <div className="relative flex-1">
            <Input
              type="number"
              min="0"
              max="59"
              value={customMinutes}
              onChange={handleCustomMinutesChange}
              placeholder="0"
              disabled={disabled}
            />
          </div>
          <span className="text-muted-foreground text-sm whitespace-nowrap">minutes</span>
        </div>
      )}
    </div>
  );
}
