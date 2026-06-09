import type { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  createdAt: Date;
};

type Session = {
  user: SessionUser;
  session: { id: string; expiresAt: Date };
} | null;

/**
 * Server-side session retrieval for Next.js server components.
 * Forwards session cookies to the API to validate the session.
 */
export async function getSessionFromRequest(reqHeaders: ReadonlyHeaders): Promise<Session> {
  try {
    const cookie = reqHeaders.get("cookie") || "";
    const response = await fetch(`${API_BASE_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as Session;
    return data;
  } catch {
    return null;
  }
}
