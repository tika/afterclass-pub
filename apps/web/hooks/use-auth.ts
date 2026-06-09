"use client";

import { useSession } from "@/lib/auth-client";

/**
 * Compatibility hook replacing @clerk/nextjs useAuth.
 * Sessions are now managed via cookies by Better Auth.
 * getToken() returns null since the API client uses credentials: "include".
 */
export function useAuth() {
  const { data: session, isPending } = useSession();

  return {
    isSignedIn: !!session?.user,
    isLoaded: !isPending,
    userId: session?.user?.id ?? null,
    getToken: async () => null as string | null,
  };
}
