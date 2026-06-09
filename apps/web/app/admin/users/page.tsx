"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReloadIcon, SearchIcon, ShieldCrossIcon, TrashIcon } from "mage-icons-react/stroke";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/api-client";
import { type AdminUser } from "@/lib/types/admin";

type DialogState =
  | { type: "none" }
  | { type: "delete"; userId: string }
  | { type: "ban"; userId: string; isBanned: boolean };

export default function UserManagement() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", debouncedSearch],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getUsers(token, debouncedSearch || undefined);
    },
  });
  const users = (data?.users || []) as AdminUser[];

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      return adminApi.deleteUser(token, userId);
    },
    onSuccess: () => {
      toast.success("User deleted");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const banMutation = useMutation({
    mutationFn: async ({ userId, isBanned }: { userId: string; isBanned: boolean }) => {
      const token = await getToken();
      return adminApi.banUser(token, userId, !isBanned);
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.isBanned ? "User unbanned" : "User banned");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update user ban status");
    },
  });

  if (isLoading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline">User Management</h1>
          <p className="mt-2 text-muted-foreground">Manage all users on the platform</p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* User table */}
      <Card>
        <CardContent className="pt-6">
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground">
                        {user.name?.[0]?.toUpperCase() || user.email[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-semibold hover:underline"
                        >
                          {user.name || "Unknown"}
                        </Link>
                        {user.isBanned && (
                          <span className="text-xs bg-destructive/20 text-destructive px-2 py-0.5 rounded">
                            Banned
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.majors && user.majors.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {user.majors.join(", ")} {user.gradYear && `• ${user.gradYear}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDialog({ type: "ban", userId: user.id, isBanned: user.isBanned })
                      }
                    >
                      <ShieldCrossIcon className="h-4 w-4 mr-2" />
                      {user.isBanned ? "Unban" : "Ban"}
                    </Button>
                    <Link href={`/admin/users/${user.id}`}>
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDialog({ type: "delete", userId: user.id })}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={dialog.type === "delete"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the user and all associated
              data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => dialog.type === "delete" && deleteMutation.mutate(dialog.userId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ban Confirmation Dialog */}
      <AlertDialog
        open={dialog.type === "ban"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog.type === "ban" && dialog.isBanned ? "Unban User?" : "Ban User?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog.type === "ban" && dialog.isBanned
                ? "This will restore the user's access to the platform."
                : "This will prevent the user from accessing the platform."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                dialog.type === "ban" &&
                banMutation.mutate({ userId: dialog.userId, isBanned: dialog.isBanned })
              }
              disabled={banMutation.isPending}
            >
              {dialog.type === "ban" && dialog.isBanned ? "Unban" : "Ban"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
