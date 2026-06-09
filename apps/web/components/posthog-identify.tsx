"use client";

import { usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";

export function PostHogIdentify() {
  const { data: session } = useSession();
  const posthog = usePostHog();

  useEffect(() => {
    if (session?.user) {
      posthog.identify(session.user.id, {
        email: session.user.email,
        name: session.user.name,
      });
    } else if (!session) {
      posthog.reset();
    }
  }, [session, posthog]);

  return null;
}
