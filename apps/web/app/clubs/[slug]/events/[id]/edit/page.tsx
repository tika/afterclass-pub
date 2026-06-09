"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ClubCreateEventForm } from "@/components/forms/event-form/club-create-event-form";

function EditEventPageContent() {
  const params = useParams();
  const eventId = params.id as string;

  return <ClubCreateEventForm eventId={eventId} />;
}

export default function EditEventPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <EditEventPageContent />
    </Suspense>
  );
}
