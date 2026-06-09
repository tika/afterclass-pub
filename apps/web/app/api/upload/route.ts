import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server-auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/v1", "") || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const reqHeaders = await headers();
    const session = await getSessionFromRequest(reqHeaders);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const eventId = request.nextUrl.searchParams.get("eventId");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Only images are allowed." },
        { status: 400 },
      );
    }

    const MAX_SIZE = 4.5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File size exceeds 4.5MB limit" }, { status: 400 });
    }

    // Forward session cookies to the backend
    const presignedResponse = await fetch(`${API_BASE_URL}/v1/upload/presigned-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
      },
      body: JSON.stringify({
        entityType: "event",
        entityId: eventId || undefined,
        assetType: "flyer",
        contentType: file.type,
        contentLength: file.size,
      }),
    });

    if (!presignedResponse.ok) {
      const errorData = await presignedResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: (errorData as { error?: string }).error || "Failed to get presigned URL" },
        { status: presignedResponse.status },
      );
    }

    const { presignedUrl, publicUrl } = (await presignedResponse.json()) as {
      presignedUrl: string;
      publicUrl: string;
    };

    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      return NextResponse.json({ error: "Failed to upload file to S3" }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload file",
      },
      { status: 500 },
    );
  }
}
