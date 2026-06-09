"use client";

import { useAuth } from "@/hooks/use-auth";
import { EventForm } from "@/components/forms/event-form/event-form";

export default function CreateEventPage() {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Create Event</h1>
        <p className="text-muted-foreground mt-2">Fill out the form below to create a new event</p>
      </div>
      <EventForm />
    </div>
  );
}
