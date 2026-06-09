"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { AdvancedMarker, APIProvider, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { CancelIcon, MapMarkerIcon, ReloadIcon, SearchIcon } from "mage-icons-react/stroke";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { poisApi } from "@/lib/api-client";
import {
  forwardGeocode,
  type GeocodingResult,
  getStaticMapUrl,
  reverseGeocode,
  TUFTS_CENTER,
} from "@/lib/google-maps";
import { cn } from "@/lib/utils";

export interface LocationInputValue {
  locationName: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  locationDetail: string | null;
}

interface LocationInputProps {
  value: LocationInputValue;
  onChange: (value: LocationInputValue) => void;
  className?: string;
}

type Mode = "search" | "selected" | "pin-on-map";

function MapWithMarker({
  position,
  onPositionChange,
  onMapClick,
}: {
  position: { lat: number; lng: number } | null;
  onPositionChange: (lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (map && position) {
      map.panTo(position);
    }
  }, [map, position]);

  return (
    <Map
      defaultCenter={position || TUFTS_CENTER}
      defaultZoom={position ? 15 : 12}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapId="location-input-map"
      onClick={(e) => {
        if (e.detail.latLng) {
          onMapClick(e.detail.latLng.lat, e.detail.latLng.lng);
        }
      }}
      style={{ width: "100%", height: "100%" }}
    >
      {position && (
        <AdvancedMarker
          position={position}
          draggable
          onDragEnd={(e) => {
            if (e.latLng) {
              onPositionChange(e.latLng.lat(), e.latLng.lng());
            }
          }}
        >
          <Pin background="#1736e6" borderColor="#ffffff" glyphColor="#ffffff" />
        </AdvancedMarker>
      )}
    </Map>
  );
}

export function LocationInput({ value, onChange, className }: LocationInputProps) {
  const { getToken } = useAuth();
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [mode, setMode] = useState<Mode>(
    value.lat && value.lng && value.locationName ? "selected" : "search",
  );
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFullMap, setShowFullMap] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [pinLocationName, setPinLocationName] = useState("");

  // Fetch POIs
  const { data: poisData } = useQuery({
    queryKey: ["pois"],
    queryFn: async () => {
      const token = await getToken();
      return poisApi.getPOIs(token);
    },
  });
  const pois = poisData?.pois || [];

  // Filter POIs by query (name, aliases, and address)
  const filteredPois = query.trim()
    ? pois.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) || p.aliases?.some((a) => a.toLowerCase().includes(q))
        );
      })
    : [];

  // Forward geocode
  const handleForwardGeocode = useCallback(
    async (q: string) => {
      if (!q.trim() || !googleMapsApiKey) {
        setGeocodeResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const results = await forwardGeocode(q, googleMapsApiKey);
        setGeocodeResults(results);
      } catch {
        setGeocodeResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [googleMapsApiKey],
  );

  // Reverse geocode
  const handleReverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<string | null> => {
      if (!googleMapsApiKey) return null;
      return reverseGeocode(lat, lng, googleMapsApiKey);
    },
    [googleMapsApiKey],
  );

  // Debounced search
  const handleQueryChange = (q: string) => {
    setQuery(q);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleForwardGeocode(q), 300);
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Select a POI
  const handlePoiSelect = (poi: (typeof pois)[0]) => {
    setShowDropdown(false);
    setQuery("");
    onChange({
      locationName: poi.name,
      address: poi.address,
      lat: poi.lat,
      lng: poi.lng,
      locationDetail: value.locationDetail,
    });
    setMode("selected");
  };

  // Select a geocoded result
  const handleGeocodeSelect = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    setShowDropdown(false);
    setQuery("");
    onChange({
      locationName: result.place_name.split(",")[0] || result.place_name,
      address: result.place_name,
      lat,
      lng,
      locationDetail: value.locationDetail,
    });
    setMode("selected");
  };

  // Clear selection
  const handleClear = () => {
    onChange({
      locationName: "",
      address: null,
      lat: null,
      lng: null,
      locationDetail: null,
    });
    setMode("search");
    setShowFullMap(false);
  };

  // Handle map click or marker drag
  const handleMapPositionChange = async (lat: number, lng: number) => {
    const addr = await handleReverseGeocode(lat, lng);
    if (mode === "pin-on-map") {
      onChange({
        ...value,
        lat,
        lng,
        address: addr,
        locationName: pinLocationName || value.locationName,
      });
    } else {
      onChange({ ...value, lat, lng, address: addr });
    }
  };

  // Static map preview URL
  const staticMapUrl =
    value.lat && value.lng && googleMapsApiKey
      ? getStaticMapUrl(value.lat, value.lng, googleMapsApiKey)
      : null;

  if (!googleMapsApiKey) {
    return (
      <div className={cn("rounded-md border p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
      </div>
    );
  }

  // --- PIN ON MAP MODE ---
  if (mode === "pin-on-map") {
    return (
      <APIProvider apiKey={googleMapsApiKey}>
        <div className={cn("space-y-3", className)}>
          <div className="space-y-2">
            <Input
              placeholder="Name this location"
              value={pinLocationName}
              onChange={(e) => {
                setPinLocationName(e.target.value);
                onChange({
                  ...value,
                  locationName: e.target.value,
                });
              }}
            />
            <div className="h-[350px] w-full rounded-md border overflow-hidden">
              <MapWithMarker
                position={value.lat && value.lng ? { lat: value.lat, lng: value.lng } : null}
                onPositionChange={handleMapPositionChange}
                onMapClick={handleMapPositionChange}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Click on the map to drop a pin, or drag to adjust.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!value.lat || !value.lng || !value.locationName}
              onClick={() => {
                setMode("selected");
                setPinLocationName("");
              }}
            >
              Confirm Location
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!value.lat) handleClear();
                else setMode(value.locationName ? "selected" : "search");
                setPinLocationName("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </APIProvider>
    );
  }

  // --- SELECTED MODE ---
  if (mode === "selected" && value.locationName) {
    return (
      <APIProvider apiKey={googleMapsApiKey}>
        <div className={cn("space-y-3", className)}>
          {/* Selected location header */}
          <div className="flex items-start justify-between gap-2 rounded-md border p-3">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{value.locationName}</p>
              {value.address && value.address !== value.locationName && (
                <p className="text-xs text-muted-foreground truncate">{value.address}</p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleClear}
            >
              <CancelIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Static map preview */}
          {staticMapUrl && !showFullMap && (
            <div className="space-y-1">
              <img
                src={staticMapUrl}
                alt="Location preview"
                className="w-full h-[200px] object-cover rounded-md border"
              />
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowFullMap(true)}
              >
                Adjust pin
              </button>
            </div>
          )}

          {/* Full interactive map for adjusting */}
          {showFullMap && (
            <div className="space-y-1">
              <div className="h-[350px] w-full rounded-md border overflow-hidden">
                <MapWithMarker
                  position={value.lat && value.lng ? { lat: value.lat, lng: value.lng } : null}
                  onPositionChange={handleMapPositionChange}
                  onMapClick={handleMapPositionChange}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Click or drag the pin to adjust location.
              </p>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowFullMap(false)}
              >
                Done adjusting
              </button>
            </div>
          )}

          {/* Location detail input */}
          <Input
            placeholder="e.g. Room 501, Left side, 2nd floor"
            value={value.locationDetail || ""}
            onChange={(e) =>
              onChange({
                ...value,
                locationDetail: e.target.value || null,
              })
            }
          />
        </div>
      </APIProvider>
    );
  }

  // --- SEARCH MODE (default) ---
  return (
    <div className={cn("relative", className)} ref={searchRef}>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => query.trim() && setShowDropdown(true)}
          placeholder="Search a building, address, or place..."
          className="pl-9"
        />
        {isSearching && (
          <ReloadIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (query.trim() || true) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg max-h-[300px] overflow-y-auto">
          {/* Campus POIs */}
          {filteredPois.length > 0 && (
            <div className="p-1">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
                Campus Buildings
              </p>
              {filteredPois.map((poi) => (
                <button
                  key={poi.id}
                  type="button"
                  className="w-full text-left px-2 py-2 rounded-sm hover:bg-accent text-sm flex items-start gap-2"
                  onClick={() => handlePoiSelect(poi)}
                >
                  <MapMarkerIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{poi.name}</p>
                    {poi.address && (
                      <p className="text-xs text-muted-foreground truncate">{poi.address}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Geocoded results */}
          {geocodeResults.length > 0 && (
            <div className="p-1 border-t">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Addresses</p>
              {geocodeResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="w-full text-left px-2 py-2 rounded-sm hover:bg-accent text-sm flex items-start gap-2"
                  onClick={() => handleGeocodeSelect(result)}
                >
                  <MapMarkerIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{result.place_name}</span>
                </button>
              ))}
            </div>
          )}

          {/* Pin on map option */}
          <div className="p-1 border-t">
            <button
              type="button"
              className="w-full text-left px-2 py-2 rounded-sm hover:bg-accent text-sm flex items-center gap-2"
              onClick={() => {
                setShowDropdown(false);
                setQuery("");
                setMode("pin-on-map");
              }}
            >
              <MapMarkerIcon className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-primary font-medium">Pin on map</span>
            </button>
          </div>

          {/* Empty state */}
          {query.trim() &&
            filteredPois.length === 0 &&
            geocodeResults.length === 0 &&
            !isSearching && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
            )}
        </div>
      )}
    </div>
  );
}
