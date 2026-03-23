"use client";

import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { EventType } from "@/lib/webhookApi";

const ALL_VALUE = "*";

type EventTypeSelectorProps = {
  eventTypes: EventType[];
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
};

function normalizeSelection(selection: string[]) {
  if (selection.length === 0 || selection.includes(ALL_VALUE)) {
    return [ALL_VALUE];
  }

  return selection;
}

export default function EventTypeSelector({
  eventTypes,
  value,
  onChange,
  label = "All event types",
}: EventTypeSelectorProps) {
  const normalizedValue = normalizeSelection(value);
  const isAllSelected = normalizedValue.includes(ALL_VALUE);

  function toggleAll(checked: boolean) {
    onChange(checked ? [ALL_VALUE] : []);
  }

  function toggleEventType(eventTypeName: string, checked: boolean) {
    if (checked) {
      const next = normalizedValue.filter(item => item !== ALL_VALUE);
      onChange(normalizeSelection([...next, eventTypeName]));
      return;
    }

    onChange(normalizeSelection(normalizedValue.filter(item => item !== eventTypeName)));
  }

  const selectedLabel = isAllSelected
    ? label
    : normalizedValue.map(item => eventTypes.find(eventType => eventType.name === item)?.name || item).join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{selectedLabel || label}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 rounded-none p-4">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="event-type-all"
              checked={isAllSelected}
              onCheckedChange={checked => toggleAll(Boolean(checked))}
            />
            <Label htmlFor="event-type-all" className="flex items-center gap-2 text-sm font-medium">
              {label}
              {isAllSelected && <Check className="h-3 w-3 text-green-600" />}
            </Label>
          </div>

          <div className="max-h-56 space-y-2 overflow-y-auto border-t pt-3">
            {eventTypes.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No event types have been created yet. You can still use {label.toLowerCase()} or create event types
                first.
              </div>
            ) : (
              eventTypes.map(eventType => {
                const checked = !isAllSelected && normalizedValue.includes(eventType.name);

                return (
                  <label key={eventType.id} className="flex items-start space-x-2">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={nextChecked => toggleEventType(eventType.name, Boolean(nextChecked))}
                      disabled={isAllSelected}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{eventType.name}</div>
                      {eventType.description && (
                        <div className="text-xs text-muted-foreground">{eventType.description}</div>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
