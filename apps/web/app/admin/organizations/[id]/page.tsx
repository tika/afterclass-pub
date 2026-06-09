"use client";

import {
  type AdminFollower,
  type AdminGroup,
  type AdminMember,
  type MemberRole,
} from "@/lib/types/admin";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowLeftIcon,
  ReloadIcon,
  TrashIcon,
  UserPlusIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
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
import { Autocomplete } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, groupsApi } from "@/lib/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type DialogState =
  | { type: "none" }
  | { type: "add-member" }
  | { type: "delete-member"; userId: string };

export default function GroupDetailPage() {
  const params = useParams();
  const { getToken } = useAuth();
  const groupId = params.id as string;
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [newMemberData, setNewMemberData] = useState({
    userId: "",
    role: "MEMBER" as MemberRole,
  });
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const { data: groupData, isLoading: groupLoading } = useQuery({
    queryKey: ["admin-group", groupId],
    queryFn: async () => {
      const token = await getToken();
      const groupsData = await groupsApi.getAllGroups(token);
      return (groupsData.groups.find((g: AdminGroup) => g.id === groupId) as AdminGroup) || null;
    },
    enabled: !!groupId,
  });

  const { data: followersData, isLoading: followersLoading } = useQuery({
    queryKey: ["admin-group-followers", groupId],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getGroupFollowers(token, groupId);
    },
    enabled: !!groupId,
  });
  const followers = (followersData?.followers || []) as AdminFollower[];

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["admin-group-members", groupId],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getGroupMembers(token, groupId);
    },
    enabled: !!groupId,
  });
  const members = (membersData?.members || []) as AdminMember[];

  const isLoading = groupLoading || followersLoading || membersLoading;

  const { data: userSearchData, isLoading: searchingUsers } = useQuery({
    queryKey: ["admin-user-search", userSearchQuery],
    queryFn: async () => {
      const token = await getToken();
      const data = await adminApi.getUsers(token, userSearchQuery || undefined, 5);
      return (data.users || []).map((user) => ({
        value: user.id,
        label: user.name || user.email,
        description: user.email,
      }));
    },
  });
  const userOptions = userSearchData || [];

  const addMemberMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: MemberRole }) => {
      const token = await getToken();
      return adminApi.addGroupMember(token, groupId, userId, role);
    },
    onSuccess: () => {
      toast.success("Member added");
      setDialog({ type: "none" });
      setNewMemberData({ userId: "", role: "MEMBER" });
      setUserSearchQuery("");
      queryClient.invalidateQueries({ queryKey: ["admin-group-members", groupId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add member");
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = await getToken();
      return adminApi.removeGroupMember(token, groupId, userId);
    },
    onSuccess: () => {
      toast.success("Member removed");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-group-members", groupId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: MemberRole }) => {
      const token = await getToken();
      return adminApi.updateGroupMemberRole(token, groupId, userId, role);
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["admin-group-members", groupId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const handleAddMember = () => {
    if (!newMemberData.userId) {
      toast.error("Please select a user");
      return;
    }
    addMemberMutation.mutate(newMemberData);
  };

  const handleDeleteMember = () => {
    if (dialog.type !== "delete-member") return;
    deleteMemberMutation.mutate(dialog.userId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="animate-spin" />
      </div>
    );
  }

  if (!groupData) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Group not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/organizations">
          <Button variant="outline" size="sm">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold font-headline">{groupData.name}</h1>
        </div>
      </div>

      {/* Group Info */}
      <Card>
        <CardHeader>
          <CardTitle>Group Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Type</Label>
            </div>
            {groupData.bio && (
              <div>
                <Label className="text-muted-foreground">Bio</Label>
                <p>{groupData.bio}</p>
              </div>
            )}
            {groupData.website && (
              <div>
                <Label className="text-muted-foreground">Website</Label>
                <a
                  href={groupData.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {groupData.website}
                </a>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p>{new Date(groupData.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Followers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            Followers ({followers.length})
          </CardTitle>
          <CardDescription>Users following this group</CardDescription>
        </CardHeader>
        <CardContent>
          {followers.length === 0 ? (
            <p className="text-muted-foreground">No followers yet</p>
          ) : (
            <div className="space-y-2">
              {followers.map((follower) => (
                <div
                  key={follower.follow.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground font-medium">
                        {follower.user.name?.[0]?.toUpperCase() ||
                          follower.user.email[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{follower.user.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{follower.user.email}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(follower.follow.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members & Admins */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserPlusIcon className="h-5 w-5" />
                Members & Admins ({members.length})
              </CardTitle>
              <CardDescription>Manage group members</CardDescription>
            </div>
            <Dialog
              open={dialog.type === "add-member"}
              onOpenChange={(open) => !open && setDialog({ type: "none" })}
            >
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setDialog({ type: "add-member" })}>
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Member</DialogTitle>
                  <DialogDescription>
                    Add a user as a member or admin of this group
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="userId">User *</Label>
                    <Autocomplete
                      options={userOptions}
                      value={newMemberData.userId}
                      onValueChange={(value) =>
                        setNewMemberData({
                          ...newMemberData,
                          userId: value || "",
                        })
                      }
                      onSearch={setUserSearchQuery}
                      loading={searchingUsers}
                      placeholder="Search by name or email..."
                      searchPlaceholder="Type to search users..."
                      emptyMessage="No users found"
                      renderOption={(option) => (
                        <div className="flex flex-col">
                          <span>{option.label}</span>
                          {option.description && (
                            <span className="text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          )}
                        </div>
                      )}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role *</Label>
                    <Select
                      value={newMemberData.role}
                      onValueChange={(value: MemberRole) =>
                        setNewMemberData({
                          ...newMemberData,
                          role: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialog({ type: "none" })}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddMember} disabled={addMemberMutation.isPending}>
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-muted-foreground">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.member.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground font-medium">
                        {member.user.name?.[0]?.toUpperCase() ||
                          member.user.email[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium">{member.user.name || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.member.role}
                      onValueChange={(value: MemberRole) =>
                        updateRoleMutation.mutate({ userId: member.member.userId, role: value })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MEMBER">Member</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setDialog({ type: "delete-member", userId: member.member.userId });
                      }}
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

      {/* Delete Member Dialog */}
      <AlertDialog
        open={dialog.type === "delete-member"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the member from the group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground"
              disabled={deleteMemberMutation.isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
