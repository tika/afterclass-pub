"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { RibbonIcon } from "mage-icons-react/stroke";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { groupsApi } from "@/lib/api-client";

function RankingsPageContent() {
  const { getToken } = useAuth();

  // Fetch campus rankings
  const { data: rankingsData, isLoading: rankingsLoading } = useQuery({
    queryKey: ["campus-rankings"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getCampusRankings(token, 10);
    },
  });

  const rankings = rankingsData?.groups || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Campus Rankings</h1>
        <p className="text-muted-foreground mt-1">Top clubs ranked by engagement</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RibbonIcon className="h-5 w-5" />
            Top 10 Groups
          </CardTitle>
          <CardDescription>Ranked by total reminders set on upcoming events</CardDescription>
        </CardHeader>
        <CardContent>
          {rankingsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : rankings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No rankings available yet.
            </p>
          ) : (
            <div className="space-y-3">
              {rankings.map((group) => {
                const medalColor =
                  group.rank === 1
                    ? "bg-chart-3/10 text-chart-3 border-chart-3/20"
                    : group.rank === 2
                      ? "bg-muted/50 text-muted-foreground border-border"
                      : group.rank === 3
                        ? "bg-chart-4/10 text-chart-4 border-chart-4/20"
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
                        {group.rank}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{group.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.engagementCount} reminders
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

export default function RankingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <RankingsPageContent />
    </Suspense>
  );
}
