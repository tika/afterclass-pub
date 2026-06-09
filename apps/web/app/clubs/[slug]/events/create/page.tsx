"use client";

import { Suspense } from "react";
import { ClubCreateEventForm } from "@/components/forms/event-form/club-create-event-form";

export default function CreateEventPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ClubCreateEventForm />
    </Suspense>
  );
}
