"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, EyeIcon, ReloadIcon } from "mage-icons-react/stroke";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { eventsApi } from "@/lib/api-client";
import type { AdminEvent } from "@/lib/types/admin";

export default function DraftsPage() {
  const { getToken } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-drafts"],
    queryFn: async () => {
      const token = await getToken();
      return eventsApi.getAllEvents(token, { status: "DRAFT" });
    },
  });
  const events: AdminEvent[] = data?.events || [];

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <ReloadIcon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline">Draft Events</h1>
        <p className="mt-2 text-muted-foreground">
          All draft events in chronological order (newest first)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Drafts ({events.length})</CardTitle>
          <CardDescription>Events that have not been published yet</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="py-12 text-center">
              <CalendarIcon className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No draft events found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <div
                  key={event.event.id}
                  className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  {event.event.flyerImages[0] ? (
                    <Image
                      src={event.event.flyerImages[0]}
                      alt={event.event.title}
                      width={64}
                      height={64}
                      className="h-16 w-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                      No image
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold">{event.event.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {event.group?.name ?? "Unknown Group"} • {event.event.locationName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(event.event.createdAt).toLocaleString()}
                      {" • "}
                      Starts {new Date(event.event.startTime).toLocaleString()}
                    </p>
                  </div>
                  <Link href={`/admin/events/${event.event.id}`}>
                    <Button variant="outline" size="sm">
                      <EyeIcon className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
