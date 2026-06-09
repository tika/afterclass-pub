import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// just incase we're stupid
const API_BASE_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  // Ensure /v1 suffix if not already present
  return url.endsWith("/v1") ? url : `${url}/v1`;
})();

interface EventData {
  event: {
    id: string;
    title: string;
    description: string | null;
    flyerImages: string[];
    startTime: string;
    endTime: string | null;
    locationName: string;
    locationDetail: string | null;
    address: string | null;
    status: string;
  };
  group: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
}

async function getEvent(id: string): Promise<EventData | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/events/public/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getEvent(id);

  if (!data) {
    return { title: "Event Not Found | Afterclass" };
  }

  const { event, group } = data;
  const description = `${formatDate(event.startTime)} · ${event.locationName}${group ? ` · ${group.name}` : ""}`;

  return {
    title: `${event.title} | Afterclass`,
    description,
    openGraph: {
      title: event.title,
      description,
      images: event.flyerImages.length > 0 && event.flyerImages[0] ? [event.flyerImages[0]] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: event.flyerImages.length > 0 && event.flyerImages[0] ? [event.flyerImages[0]] : [],
    },
  };
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getEvent(id);

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF8] px-6">
        <h1 className="mb-4 text-2xl font-bold">Event not found</h1>
        <p className="mb-8 text-gray-500">
          This event may have been removed or is no longer available.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-[#6c5ce7] px-6 py-3 text-sm font-semibold text-white no-underline"
        >
          Go to Afterclass
        </Link>
      </div>
    );
  }

  const { event, group } = data;

  return (
    <div className="flex min-h-screen flex-col items-center bg-[#FAFAF8]">
      {/* Hero flyer */}
      {event.flyerImages[0] && (
        <div className="relative w-full max-w-lg">
          <Image
            src={event.flyerImages[0]}
            alt={event.title}
            width={600}
            height={800}
            className="w-full object-cover"
            priority
          />
        </div>
      )}

      {/* Event info */}
      <div className="w-full max-w-lg px-6 py-8">
        {/* Club */}
        {group && (
          <div className="mb-4 flex items-center gap-2">
            {group.logoUrl && (
              <Image
                src={group.logoUrl}
                alt={group.name}
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span className="text-sm font-medium text-gray-500">{group.name}</span>
          </div>
        )}

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-gray-900">{event.title}</h1>

        <div className="mb-2 flex items-center gap-2 text-base text-gray-700">
          <span>📅</span>
          <span>{formatDate(event.startTime)}</span>
        </div>

        <div className="mb-2 flex items-center gap-2 text-base text-gray-700">
          <span>📍</span>
          <span>{event.locationName}</span>
        </div>

        {event.description && (
          <p className="mt-4 text-base leading-relaxed text-gray-600">{event.description}</p>
        )}

        {/* CTA */}
        <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <p className="mb-1 text-lg font-bold text-gray-900">Get Afterclass</p>
          <p className="mb-5 text-sm text-gray-500">See this and hundreds more events at Tufts</p>
          <a
            href="https://apps.apple.com/app/afterclass/id6744076894"
            className="inline-block rounded-xl bg-[#6c5ce7] px-8 py-3.5 text-base font-semibold text-white no-underline transition-all hover:-translate-y-0.5 hover:bg-[#5a4bd6]"
          >
            Download on the App Store
          </a>
        </div>
      </div>

      {/* Minimal footer */}
      <div className="mt-auto w-full border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Afterclass · Your campus, one app
      </div>
    </div>
  );
}
