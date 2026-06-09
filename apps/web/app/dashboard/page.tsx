"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { groupsApi } from "@/lib/api-client";

function DashboardRedirect() {
  const { getToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: adminGroupsData, isLoading } = useQuery({
    queryKey: ["my-admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getMyAdminGroups(token);
    },
  });

  useEffect(() => {
    if (isLoading || !adminGroupsData) return;

    const groups = adminGroupsData.groups;
    if (groups.length === 0) return;

    // Try to find the group matching the groupId query param
    const urlGroupId = searchParams.get("groupId");
    const match = urlGroupId ? groups.find((g) => g.group.id === urlGroupId) : groups[0];

    const group = match || groups[0];
    if (group?.group.slug) {
      router.replace(`/clubs/${group.group.slug}`);
    }
  }, [isLoading, adminGroupsData, router, searchParams]);

  return (
    <div className="flex items-center justify-center h-96">
      <div className="text-muted-foreground">Redirecting...</div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <DashboardRedirect />
    </Suspense>
  );
}
