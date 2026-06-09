"use client";

import { AdvancedMarker, APIProvider, InfoWindow, Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect, useMemo, useState } from "react";
import { TUFTS_CENTER } from "@/lib/google-maps";
import { cn } from "@/lib/utils";

interface EventItem {
  event: {
    id: string;
    title: string;
    description: string | null;
    startTime: string;
    endTime: string | null;
    locationName: string;
    address: string | null;
    lat: number | null;
    lng: number | null;
    status: "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
    metadata: Record<string, unknown> | null;
  };
  group: {
    id: string;
    name: string;
  } | null;
}

interface EventCluster {
  events: EventItem[];
  centerLat: number;
  centerLng: number;
  address: string | null;
}

// Calculate distance between two coordinates in meters using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Group events by location (same address or within 50m)
function clusterEvents(
  events: (EventItem & { event: { lat: number; lng: number } })[],
): EventCluster[] {
  const clusters: EventCluster[] = [];
  const processed = new Set<string>();

  for (const item of events) {
    if (processed.has(item.event.id)) continue;

    const cluster: EventCluster = {
      events: [item],
      centerLat: item.event.lat,
      centerLng: item.event.lng,
      address: item.event.address,
    };

    // Find all events that should be grouped with this one
    for (const otherItem of events) {
      if (processed.has(otherItem.event.id) || otherItem.event.id === item.event.id) continue;

      const sameAddress =
        item.event.address &&
        otherItem.event.address &&
        item.event.address.toLowerCase().trim() === otherItem.event.address.toLowerCase().trim();

      const distance = calculateDistance(
        item.event.lat,
        item.event.lng,
        otherItem.event.lat,
        otherItem.event.lng,
      );

      if (sameAddress || distance < 50) {
        cluster.events.push(otherItem);
        processed.add(otherItem.event.id);
      }
    }

    // Calculate center point for cluster
    if (cluster.events.length > 1) {
      const avgLat =
        cluster.events.reduce((sum, e) => sum + (e.event.lat || 0), 0) / cluster.events.length;
      const avgLng =
        cluster.events.reduce((sum, e) => sum + (e.event.lng || 0), 0) / cluster.events.length;
      cluster.centerLat = avgLat;
      cluster.centerLng = avgLng;
    }

    clusters.push(cluster);
    processed.add(item.event.id);
  }

  return clusters;
}

interface ClusterMarkerProps {
  cluster: EventCluster;
  isPast: boolean;
  onEventClick: (event: EventItem) => void;
  isSelected: boolean;
}

function ClusterMarker({ cluster, isPast, onEventClick, isSelected }: ClusterMarkerProps) {
  const [showInfo, setShowInfo] = useState(false);
  const markerColor = isPast ? "#94a3b8" : "#1736e6";
  const isCluster = cluster.events.length > 1;

  return (
    <>
      <AdvancedMarker
        position={{ lat: cluster.centerLat, lng: cluster.centerLng }}
        onClick={() => {
          setShowInfo(true);
          if (cluster.events.length === 1 && cluster.events[0]) {
            onEventClick(cluster.events[0]);
          }
        }}
        onMouseEnter={() => setShowInfo(true)}
        onMouseLeave={() => setShowInfo(false)}
      >
        <div
          style={{
            width: isCluster ? "40px" : "30px",
            height: isCluster ? "40px" : "30px",
            backgroundColor: markerColor,
            borderRadius: "50%",
            border: "3px solid white",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            fontSize: "14px",
            color: "white",
            cursor: "pointer",
            transform: isSelected ? "scale(1.2)" : "scale(1)",
            transition: "transform 0.2s ease",
            zIndex: isSelected ? 1000 : 1,
          }}
        >
          {isCluster ? cluster.events.length : ""}
        </div>
      </AdvancedMarker>

      {showInfo && (
        <InfoWindow
          position={{ lat: cluster.centerLat, lng: cluster.centerLng }}
          onCloseClick={() => setShowInfo(false)}
          pixelOffset={[0, -25]}
        >
          <div className="p-2 min-w-[250px] max-w-[300px]">
            {isCluster ? (
              <>
                <div className="font-semibold text-base mb-2 text-gray-900">
                  {cluster.events.length} Event
                  {cluster.events.length > 1 ? "s" : ""} at {cluster.events[0]?.event?.locationName}
                </div>
                {cluster.events[0]?.event?.address && (
                  <div className="text-xs text-gray-600 mb-2">
                    {cluster.events[0]?.event?.address}
                  </div>
                )}
                <div className="max-h-[300px] overflow-y-auto space-y-2">
                  {cluster.events.map((item) => {
                    const date = new Date(item.event.startTime);
                    return (
                      <button
                        key={item.event.id}
                        className="border-b border-gray-200 pb-2 last:border-0 last:pb-0 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                        onClick={() => onEventClick(item)}
                        type="button"
                      >
                        <div className="font-semibold text-sm mb-1 text-gray-900">
                          {item.event.title}
                        </div>
                        <div className="text-xs text-gray-600 mb-1">
                          {date.toLocaleDateString()} {date.toLocaleTimeString()}
                        </div>
                        <div className="text-xs text-gray-600">
                          {item.event.locationName}
                          {item.event.metadata?.roomNumber
                            ? `, ${item.event.metadata.roomNumber}`
                            : ""}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              cluster.events[0] && (
                <>
                  <div className="font-semibold text-sm mb-1 text-gray-900">
                    {cluster.events[0].event.title}
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    {new Date(cluster.events[0].event.startTime).toLocaleDateString()}{" "}
                    {new Date(cluster.events[0].event.startTime).toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    {cluster.events[0].event.locationName}
                    {cluster.events[0].event.metadata?.roomNumber
                      ? `, ${cluster.events[0].event.metadata.roomNumber}`
                      : ""}
                  </div>
                  {isPast && cluster.events[0] && (
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        const event = cluster.events[0];
                        if (event) onEventClick(event);
                      }}
                      type="button"
                    >
                      View Details
                    </button>
                  )}
                </>
              )
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function MapContent({
  clusters,
  selectedEventId,
  onEventClick,
  isPast,
}: {
  clusters: EventCluster[];
  selectedEventId?: string | null;
  onEventClick: (event: EventItem) => void;
  isPast: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || clusters.length === 0) return;

    if (clusters.length === 1) {
      const singleCluster = clusters[0];
      if (singleCluster) {
        map.panTo({
          lat: singleCluster.centerLat,
          lng: singleCluster.centerLng,
        });
        map.setZoom(15);
      }
    } else {
      // Fit bounds to show all clusters
      const bounds = new google.maps.LatLngBounds();
      clusters.forEach((cluster) => {
        bounds.extend({ lat: cluster.centerLat, lng: cluster.centerLng });
      });
      map.fitBounds(bounds, 50);
    }
  }, [map, clusters]);

  // Pan to selected event
  useEffect(() => {
    if (!map || !selectedEventId) return;

    const selectedCluster = clusters.find((cluster) =>
      cluster.events.some((item) => item.event.id === selectedEventId),
    );

    if (selectedCluster) {
      map.panTo({
        lat: selectedCluster.centerLat,
        lng: selectedCluster.centerLng,
      });
      map.setZoom(15);
    }
  }, [map, selectedEventId, clusters]);

  return (
    <>
      {clusters.map((cluster, index) => {
        const clusterId =
          cluster.events.length > 1
            ? `cluster-${cluster.events.map((e) => e.event.id).join("-")}`
            : (cluster.events[0]?.event?.id ?? `cluster-${index}`);

        const isSelected =
          selectedEventId &&
          (clusterId === selectedEventId ||
            (clusterId.startsWith("cluster-") && clusterId.includes(selectedEventId)));

        return (
          <ClusterMarker
            key={clusterId}
            cluster={cluster}
            isPast={isPast}
            onEventClick={onEventClick}
            isSelected={!!isSelected}
          />
        );
      })}
    </>
  );
}

interface EventsMapProps {
  events: EventItem[];
  selectedEventId?: string | null;
  onEventClick: (event: EventItem) => void;
  isPast: boolean;
  className?: string;
}

export function EventsMap({
  events,
  selectedEventId,
  onEventClick,
  isPast,
  className,
}: EventsMapProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Filter events that have coordinates
  const eventsWithCoords = useMemo(
    () =>
      events.filter(
        (item): item is EventItem & { event: { lat: number; lng: number } } =>
          item.event.lat !== null && item.event.lng !== null,
      ),
    [events],
  );

  // Cluster events
  const clusters = useMemo(() => clusterEvents(eventsWithCoords), [eventsWithCoords]);

  if (!googleMapsApiKey) {
    return (
      <div className={cn("rounded-md border p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          Google Maps API key not configured. Please set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        </p>
      </div>
    );
  }

  if (eventsWithCoords.length === 0) {
    return (
      <div className={cn("rounded-md border p-8 text-center", className)}>
        <p className="text-sm text-muted-foreground">
          No events with location coordinates to display on the map.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={googleMapsApiKey}>
      <div
        className={cn("h-full min-h-[400px] w-full rounded-md border overflow-hidden", className)}
      >
        <Map
          defaultCenter={TUFTS_CENTER}
          defaultZoom={12}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapId="events-map"
          style={{ width: "100%", height: "100%" }}
        >
          <MapContent
            clusters={clusters}
            selectedEventId={selectedEventId}
            onEventClick={onEventClick}
            isPast={isPast}
          />
        </Map>
      </div>
    </APIProvider>
  );
}
