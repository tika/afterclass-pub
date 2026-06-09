"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { DirectionUpIcon } from "mage-icons-react/stroke";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { groupsApi } from "@/lib/api-client";

function TrendingPageContent() {
  const { getToken } = useAuth();

  // Fetch trending groups (top 10)
  const { data: trendingData, isLoading: trendingLoading } = useQuery({
    queryKey: ["trending-groups", 10],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getTrendingGroups(token, 10);
    },
  });

  const trendingGroups = trendingData?.groups || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Trending at Tufts</h1>
        <p className="text-muted-foreground mt-1">Top clubs this week by engagement</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DirectionUpIcon className="h-5 w-5" />
            Top 10 Trending Groups
          </CardTitle>
          <CardDescription>Ranked by reminders set on events this week</CardDescription>
        </CardHeader>
        <CardContent>
          {trendingLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : trendingGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No trending groups yet.
            </p>
          ) : (
            <div className="space-y-3">
              {trendingGroups.map((group, index) => {
                const rank = index + 1;
                const medalColor =
                  rank === 1
                    ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                    : rank === 2
                      ? "bg-gray-400/10 text-gray-400 border-gray-400/20"
                      : rank === 3
                        ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                        : "bg-primary/10 text-primary border-border";

                return (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex items-center justify-center w-10 h-10 rounded-full border font-bold ${medalColor}`}
                      >
                        {rank}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{group.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.engagementCount} reminders this week
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TrendingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <TrendingPageContent />
    </Suspense>
  );
}
