"use client";

import { CheckIcon, ChevronDownIcon, ReloadIcon } from "mage-icons-react/stroke";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

export interface AutocompleteOption<T = string> {
  value: T;
  label: string;
  description?: string;
}

export interface AutocompleteProps<T = string> {
  options: AutocompleteOption<T>[];
  value?: T;
  onValueChange?: (value: T | undefined) => void;
  onSearch?: (search: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  searchPlaceholder?: string;
  renderOption?: (option: AutocompleteOption<T>) => React.ReactNode;
}

export function Autocomplete<T = string>({
  options,
  value,
  onValueChange,
  onSearch,
  placeholder = "Select option...",
  emptyMessage = "No results found.",
  loading = false,
  disabled = false,
  className,
  searchPlaceholder = "Search...",
  renderOption,
}: AutocompleteProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);

  React.useEffect(() => {
    if (onSearch && debouncedSearch) {
      onSearch(debouncedSearch);
    }
  }, [debouncedSearch, onSearch]);

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls="autocomplete-list"
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedOption ? (
            <span className="truncate">{selectedOption.label}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList id="autocomplete-list">
            {loading && (
              <div className="flex items-center justify-center py-6">
                <ReloadIcon className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!loading && options.length === 0 && <CommandEmpty>{emptyMessage}</CommandEmpty>}
            {!loading && options.length > 0 && (
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={String(option.value)}
                    value={option.label}
                    onSelect={() => {
                      onValueChange?.(option.value === value ? undefined : option.value);
                      setOpen(false);
                      setSearch("");
                    }}
                  >
                    <CheckIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {renderOption ? renderOption(option) : option.label}
                    {option.description && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
