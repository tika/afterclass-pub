import { PostHog } from "posthog-node";

export default function PostHogClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    throw new Error("NEXT_PUBLIC_POSTHOG_KEY is required");
  }
  return new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
}
