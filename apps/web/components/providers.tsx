"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { Toaster } from "sonner";
import { queryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <NuqsAdapter>
      <PostHogProvider client={posthog}>
        <QueryClientProvider client={queryClient}>
          <Toaster position="top-center" theme="dark" richColors />
          {children}
        </QueryClientProvider>
      </PostHogProvider>
    </NuqsAdapter>
  );
}
