import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { groupsApi } from "@/lib/api-client";

/**
 * Hook to resolve a club slug from URL params to a groupId.
 * Returns the groupId and group data from the slug lookup.
 */
export function useClubContext() {
  const { getToken } = useAuth();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const { data, isLoading } = useQuery({
    queryKey: ["group-by-slug", slug],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getGroupBySlug(token, slug);
    },
    enabled: !!slug,
  });

  return {
    slug,
    groupId: data?.group?.id ?? null,
    group: data?.group ?? null,
    isLoading,
  };
}
