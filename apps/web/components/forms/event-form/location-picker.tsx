"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { AdvancedMarker, APIProvider, Map, Pin, useMap } from "@vis.gl/react-google-maps";
import { CheckIcon, ChevronDownIcon, MapMarkerIcon, ReloadIcon } from "mage-icons-react/stroke";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { poisApi } from "@/lib/api-client";
import {
  forwardGeocode,
  type GeocodingResult,
  reverseGeocode,
  TUFTS_CENTER,
} from "@/lib/google-maps";
import { cn } from "@/lib/utils";

interface LocationPickerProps {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
  onLocationChange: (lat: number, lng: number, address?: string, locationName?: string) => void;
  onAddressChange?: (address: string) => void;
  onMetadataChange?: (metadata: { poiId?: string; roomNumber?: string }) => void;
  className?: string;
  showCoordinates?: boolean;
  groupId?: string | null;
  hidePoiTab?: boolean;
}

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
      map.setZoom(15);
    }
  }, [map, position]);

  return (
    <Map
      defaultCenter={position || TUFTS_CENTER}
      defaultZoom={position ? 15 : 12}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapId="location-picker-map"
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

export function LocationPicker({
  lat,
  lng,
  address,
  onLocationChange,
  onAddressChange,
  onMetadataChange,
  className,
  showCoordinates = false,
  hidePoiTab = false,
}: LocationPickerProps) {
  const { getToken } = useAuth();

  // Map search state
  const [searchQuery, setSearchQuery] = useState(address || "");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // POI Selection state
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [poiComboboxOpen, setPoiComboboxOpen] = useState(false);

  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Fetch all POIs
  const { data: poisData } = useQuery({
    queryKey: ["pois"],
    queryFn: async () => {
      const token = await getToken();
      return poisApi.getPOIs(token);
    },
  });

  const pois = poisData?.pois || [];

  // Update search query when address prop changes
  useEffect(() => {
    if (address) {
      setSearchQuery(address);
    }
  }, [address]);

  // Reverse geocoding function
  const handleReverseGeocode = async (
    latitude: number,
    longitude: number,
  ): Promise<string | null> => {
    if (!googleMapsApiKey) return null;
    return reverseGeocode(latitude, longitude, googleMapsApiKey);
  };

  // Forward geocoding function
  const searchAddresses = async (query: string) => {
    if (!query.trim() || !googleMapsApiKey) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await forwardGeocode(query, googleMapsApiKey);
      setSearchResults(results);
    } catch (error) {
      console.error("Geocoding error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (newSearch: string) => {
    setSearchQuery(newSearch);
    setIsSearchOpen(true);

    // Debounce search
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      searchAddresses(newSearch);
    }, 300);
  };

  const handleAddressSelect = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    setSearchQuery(result.place_name);
    setIsSearchOpen(false);
    setSearchResults([]);

    onLocationChange(lat, lng, result.place_name, result.place_name.split(",")[0]);
    if (onAddressChange) {
      onAddressChange(result.place_name);
    }
    if (onMetadataChange) {
      onMetadataChange({ poiId: undefined, roomNumber: undefined });
    }
    setSelectedPoiId(null);
    setRoomNumber("");
  };

  const handleLocationChange = async (newLat: number, newLng: number) => {
    const resolvedAddress = await handleReverseGeocode(newLat, newLng);
    setSearchQuery(resolvedAddress || "");
    onLocationChange(newLat, newLng, resolvedAddress || undefined, undefined);
    if (resolvedAddress && onAddressChange) {
      onAddressChange(resolvedAddress);
    }
    if (onMetadataChange) {
      onMetadataChange({ poiId: undefined, roomNumber: undefined });
    }
    setSelectedPoiId(null);
    setRoomNumber("");
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await handleLocationChange(latitude, longitude);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to get your location");
      },
    );
  };

  // POI Handlers
  const handlePoiSelect = (poiId: string) => {
    const poi = pois.find((p) => p.id === poiId);
    if (!poi) return;

    setSelectedPoiId(poiId);
    setPoiComboboxOpen(false);

    onLocationChange(poi.lat, poi.lng, poi.address || undefined, poi.name);

    if (onAddressChange) {
      onAddressChange(poi.address || "");
    }

    if (onMetadataChange) {
      onMetadataChange({ poiId, roomNumber });
    }
  };

  const handleRoomNumberChange = (value: string) => {
    setRoomNumber(value);
    if (onMetadataChange) {
      onMetadataChange({
        poiId: selectedPoiId || undefined,
        roomNumber: value,
      });
    }
  };

  if (!googleMapsApiKey) {
    return (
      <div className={cn("rounded-md border p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
      </div>
    );
  }

  const mapContent = (
    <APIProvider apiKey={googleMapsApiKey}>
      <div className="space-y-4 pt-2">
        {/* Address Search */}
        <div className="space-y-2">
          <Label>Search Address</Label>
          <Popover open={isSearchOpen && searchResults.length > 0} onOpenChange={setIsSearchOpen}>
            <PopoverTrigger asChild>
              <div className="relative">
                <MapMarkerIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  placeholder="Search for an address..."
                  className="pl-9"
                />
                {isSearching && (
                  <ReloadIcon className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] p-0"
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <div className="max-h-[300px] overflow-y-auto">
                {searchResults.map((result) => (
                  <Button
                    key={result.id}
                    variant="ghost"
                    className="w-full justify-start text-left font-normal h-auto py-2 px-3"
                    onClick={() => handleAddressSelect(result)}
                  >
                    <MapMarkerIcon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-sm">{result.place_name}</span>
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Map */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Map View</Label>
            <Button type="button" variant="outline" size="sm" onClick={handleUseCurrentLocation}>
              <MapMarkerIcon className="size-4 mr-2" />
              Use Current Location
            </Button>
          </div>
          <div className="h-[400px] w-full rounded-md border overflow-hidden">
            <MapWithMarker
              position={lat && lng ? { lat, lng } : null}
              onPositionChange={handleLocationChange}
              onMapClick={handleLocationChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Click on the map to set location manually.
          </p>
        </div>
      </div>
    </APIProvider>
  );

  const poiContent = (
    <div className="space-y-4 pt-2">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Building / Location</Label>
          <Popover open={poiComboboxOpen} onOpenChange={setPoiComboboxOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={poiComboboxOpen}
                aria-controls="poi-list"
                className="w-full justify-between"
              >
                {selectedPoiId
                  ? pois.find((poi) => poi.id === selectedPoiId)?.name
                  : "Select building..."}
                <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
              <Command>
                <CommandInput placeholder="Search locations..." />
                <CommandList id="poi-list">
                  <CommandEmpty>No location found.</CommandEmpty>
                  <CommandGroup>
                    {pois.map((poi) => (
                      <CommandItem
                        key={poi.id}
                        value={poi.name}
                        onSelect={() => handlePoiSelect(poi.id)}
                      >
                        <CheckIcon
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPoiId === poi.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {poi.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Room Number</Label>
          <Input
            placeholder="e.g. 101, Auditorium B"
            value={roomNumber}
            onChange={(e) => handleRoomNumberChange(e.target.value)}
          />
        </div>

        {selectedPoiId && (
          <div className="rounded-md bg-muted p-4 text-sm">
            <p className="font-medium">Selected Location Details:</p>
            <p className="mt-1 text-muted-foreground">
              {pois.find((p) => p.id === selectedPoiId)?.address || "No address available"}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">
              Coordinates: {pois.find((p) => p.id === selectedPoiId)?.lat.toFixed(6)},{" "}
              {pois.find((p) => p.id === selectedPoiId)?.lng.toFixed(6)}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {hidePoiTab ? (
        mapContent
      ) : (
        <Tabs defaultValue="map" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="map">Map Selection</TabsTrigger>
            <TabsTrigger value="poi">Campus Building</TabsTrigger>
          </TabsList>
          <TabsContent value="map">{mapContent}</TabsContent>
          <TabsContent value="poi">{poiContent}</TabsContent>
        </Tabs>
      )}

      {/* Coordinates Display (Always visible if enabled) */}
      {showCoordinates && (
        <div className="grid grid-cols-2 gap-4 pt-2 border-t mt-4">
          <div className="space-y-2">
            <Label htmlFor="lat" className="text-xs text-muted-foreground">
              Latitude
            </Label>
            <Input
              id="lat"
              type="number"
              step="any"
              value={lat?.toString() || ""}
              readOnly
              className="bg-muted h-8 text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lng" className="text-xs text-muted-foreground">
              Longitude
            </Label>
            <Input
              id="lng"
              type="number"
              step="any"
              value={lng?.toString() || ""}
              readOnly
              className="bg-muted h-8 text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
