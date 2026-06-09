"use client";

import { useSession } from "@/lib/auth-client";

/**
 * Compatibility hook replacing @clerk/nextjs useUser.
 */
export function useUser() {
  const { data: session, isPending } = useSession();

  const user = session?.user
    ? {
        id: session.user.id,
        emailAddresses: [{ emailAddress: session.user.email }],
        fullName: session.user.name ?? null,
        firstName: session.user.name?.split(" ")[0] ?? null,
        lastName: session.user.name?.split(" ").slice(1).join(" ") ?? null,
        imageUrl: (session.user as { image?: string }).image ?? null,
      }
    : null;

  return {
    isSignedIn: !!session?.user,
    isLoaded: !isPending,
    user,
  };
}
