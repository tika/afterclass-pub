"use client";

import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "mage-icons-react/stroke";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { Suspense, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { adminApi } from "@/lib/api-client";

function FollowersPageContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useQueryState("search", parseAsString.withDefault(""));

  // Get groupId from URL params or localStorage
  useEffect(() => {
    const urlGroupId = searchParams.get("groupId");
    const storedGroupId = localStorage.getItem("selectedGroupId");
    setGroupId(urlGroupId || storedGroupId);
  }, [searchParams]);

  // Fetch followers
  const { data: followersData, isLoading: followersLoading } = useQuery({
    queryKey: ["group-followers", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      return adminApi.getGroupFollowers(token, groupId);
    },
    enabled: !!groupId,
  });

  const followers = followersData?.followers || [];

  // Filter followers by search query
  const filteredFollowers = followers.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.user.name?.toLowerCase().includes(query) || item.user.email.toLowerCase().includes(query)
    );
  });

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>No Group Selected</CardTitle>
            <CardDescription>
              Please select a group from the sidebar to view followers.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Followers</h1>
        <p className="text-muted-foreground mt-1">Users who follow your club</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Followers List</CardTitle>
          <CardDescription>
            {followers.length} total follower{followers.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {followersLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : filteredFollowers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {searchQuery ? "No followers match your search." : "No followers yet."}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredFollowers.map((item) => {
                const user = item.user;
                const followDate = new Date(item.follow.createdAt);
                const initials =
                  user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase() ||
                  user.email?.[0]?.toUpperCase() ||
                  "";

                return (
                  <div
                    key={item.follow.userId}
                    className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <Avatar>
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{user.name || "No name"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Followed{" "}
                        {followDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
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

export default function FollowersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <FollowersPageContent />
    </Suspense>
  );
}
