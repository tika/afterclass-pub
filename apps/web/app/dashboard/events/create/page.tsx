"use client";

import { Suspense } from "react";
import { CreateEventForm } from "@/components/forms/event-form/dashboard-create-event-form";

export default function CreateEventPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <CreateEventForm />
    </Suspense>
  );
}
