"use client";

import { useAuth } from "@/hooks/use-auth";
import { ReloadIcon } from "mage-icons-react/stroke";
import { useState } from "react";
import { LocationPicker } from "@/components/forms/event-form/location-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminPoisApi } from "@/lib/api-client";

interface POIFormProps {
  poiId?: string;
  initialData?: {
    name: string;
    aliases?: string[] | null;
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
  };
  onSuccess: () => void;
  onCancel: () => void;
}

export function POIForm({ poiId, initialData, onSuccess, onCancel }: POIFormProps) {
  const { getToken } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    aliases: initialData?.aliases?.join(", ") || "",
    lat: initialData?.lat || (null as number | null),
    lng: initialData?.lng || (null as number | null),
    address: initialData?.address || "",
  });

  const handleLocationChange = (lat: number, lng: number, address?: string) => {
    setFormData((prev) => ({
      ...prev,
      lat,
      lng,
      address: address || "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    if (formData.lat === null || formData.lng === null) {
      setError("Please select a location on the map");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getToken();
      const aliases = formData.aliases
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const submitData = {
        name: formData.name.trim(),
        aliases: aliases.length > 0 ? aliases : undefined,
        lat: formData.lat,
        lng: formData.lng,
        address: formData.address.trim() || undefined,
      };

      if (poiId) {
        await adminPoisApi.updatePOI(token, poiId, submitData);
      } else {
        await adminPoisApi.createPOI(token, submitData);
      }

      onSuccess();
    } catch (err) {
      console.error("Failed to save POI:", err);
      setError(err instanceof Error ? err.message : "Failed to save POI");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="poi-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="poi-name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Student Center"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="poi-aliases">Aliases</Label>
          <Input
            id="poi-aliases"
            value={formData.aliases}
            onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
            placeholder="Comma-separated, e.g. GSU, George Sherman Union"
          />
          <p className="text-xs text-muted-foreground">
            Alternative names for this location, separated by commas.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>
            Location <span className="text-destructive">*</span>
          </Label>
          <LocationPicker
            lat={formData.lat}
            lng={formData.lng}
            address={formData.address}
            onLocationChange={handleLocationChange}
            hidePoiTab={true}
            showCoordinates={false}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          {poiId ? "Update POI" : "Create POI"}
        </Button>
      </div>
    </form>
  );
}
