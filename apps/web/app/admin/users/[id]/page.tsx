"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  BuildingAIcon,
  CalendarIcon,
  CancelIcon,
  ReloadIcon,
  ShieldCrossIcon,
  TrashIcon,
  UserPlusIcon,
  UsersIcon,
} from "mage-icons-react/stroke";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminApi, groupsApi } from "@/lib/api-client";
import { type AdminGroup, type AdminUserDetail, type MemberRole } from "@/lib/types/admin";

type DialogState = { type: "none" } | { type: "ban" } | { type: "delete" } | { type: "assign" };

export default function UserDetailPage() {
  const { getToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params.id as string;

  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<MemberRole>("MEMBER");

  const { data: userDetail, isLoading } = useQuery({
    queryKey: ["admin-user-detail", userId],
    queryFn: async () => {
      const token = await getToken();
      return adminApi.getUserDetails(token, userId) as Promise<AdminUserDetail>;
    },
    enabled: !!userId,
  });

  const { data: groupsData } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getAllGroups(token);
    },
  });

  const groups = (groupsData?.groups || []) as AdminGroup[];

  const banMutation = useMutation({
    mutationFn: async () => {
      if (!userDetail) throw new Error("No user data");
      const token = await getToken();
      return adminApi.banUser(token, userId, !userDetail.user.isBanned);
    },
    onSuccess: () => {
      toast.success(userDetail?.user.isBanned ? "User unbanned" : "User banned");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const token = await getToken();
      return adminApi.deleteUser(token, userId);
    },
    onSuccess: () => {
      toast.success("User deleted");
      router.push("/admin/users");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ groupId, role }: { groupId: string; role: MemberRole }) => {
      const token = await getToken();
      return adminApi.addGroupMember(token, groupId, userId, role);
    },
    onSuccess: () => {
      toast.success("User assigned to group");
      setDialog({ type: "none" });
      setSelectedGroupId("");
      setSelectedRole("MEMBER");
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to assign user to group");
    },
  });

  const removeMembershipMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const token = await getToken();
      return adminApi.removeGroupMember(token, groupId, userId);
    },
    onSuccess: () => {
      toast.success("Membership removed");
      queryClient.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove membership");
    },
  });

  const handleBanToggle = () => banMutation.mutate();
  const handleDelete = () => deleteMutation.mutate();
  const handleAssignToGroup = () => {
    if (!selectedGroupId) {
      toast.error("Please select a group");
      return;
    }
    assignMutation.mutate({ groupId: selectedGroupId, role: selectedRole });
  };
  const handleRemoveMembership = (groupId: string) => {
    removeMembershipMutation.mutate(groupId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ReloadIcon className="animate-spin" />
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold font-headline">
              {userDetail.user.name || "Unknown User"}
            </h1>
            <p className="text-muted-foreground">{userDetail.user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={userDetail.user.isBanned ? "default" : "destructive"}
            onClick={() => setDialog({ type: "ban" })}
          >
            <ShieldCrossIcon className="h-4 w-4 mr-2" />
            {userDetail.user.isBanned ? "Unban User" : "Ban User"}
          </Button>
          <Button variant="destructive" onClick={() => setDialog({ type: "delete" })}>
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete User
          </Button>
        </div>
      </div>

      {/* User Details */}
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-semibold">{userDetail.user.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-semibold">{userDetail.user.name || "Not set"}</p>
            </div>
            {userDetail.user.majors && userDetail.user.majors.length > 0 && (
              <div>
                <Label className="text-muted-foreground">Majors</Label>
                <p>{userDetail.user.majors.join(", ")}</p>
              </div>
            )}
            {userDetail.user.gradYear && (
              <div>
                <Label className="text-muted-foreground">Graduation Year</Label>
                <p>{userDetail.user.gradYear}</p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <p>
                {userDetail.user.isBanned ? (
                  <span className="text-destructive font-semibold">Banned</span>
                ) : (
                  <span className="text-chart-2 font-semibold">Active</span>
                )}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Created</Label>
              <p>{new Date(userDetail.user.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Groups User Follows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BuildingAIcon className="h-5 w-5" />
            Following ({userDetail.follows.length})
          </CardTitle>
          <CardDescription>Groups this user follows</CardDescription>
        </CardHeader>
        <CardContent>
          {userDetail.follows.length === 0 ? (
            <p className="text-muted-foreground">User is not following any groups</p>
          ) : (
            <div className="space-y-2">
              {userDetail.follows.map((follow) => (
                <div
                  key={follow.groupId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <Link
                      href={`/admin/organizations/${follow.groupId}`}
                      className="font-semibold hover:underline"
                    >
                      {follow.group.name}
                    </Link>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(follow.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Groups User is Member Of */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UsersIcon className="h-5 w-5" />
                Memberships ({userDetail.memberships.length})
              </CardTitle>
              <CardDescription>Groups this user is a member of</CardDescription>
            </div>
            <Dialog
              open={dialog.type === "assign"}
              onOpenChange={(open) => !open && setDialog({ type: "none" })}
            >
              <DialogTrigger asChild>
                <Button size="sm" onClick={() => setDialog({ type: "assign" })}>
                  <UserPlusIcon className="h-4 w-4 mr-2" />
                  Assign to Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign User to Group</DialogTitle>
                  <DialogDescription>
                    Add this user as a member or admin of a group
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="group">Group</FieldLabel>
                      <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a group" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FieldError>{!selectedGroupId ? "Group is required" : null}</FieldError>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="role">Role</FieldLabel>
                      <Select
                        value={selectedRole}
                        onValueChange={(value) => setSelectedRole(value as MemberRole)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEMBER">Member</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </FieldGroup>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setDialog({ type: "none" })}>
                      Cancel
                    </Button>
                    <Button onClick={handleAssignToGroup} disabled={assignMutation.isPending}>
                      Assign
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {userDetail.memberships.length === 0 ? (
            <p className="text-muted-foreground">User is not a member of any groups</p>
          ) : (
            <div className="space-y-2">
              {userDetail.memberships.map((membership) => (
                <div
                  key={membership.groupId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <Link
                      href={`/admin/organizations/${membership.groupId}`}
                      className="font-semibold hover:underline"
                    >
                      {membership.group.name}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          membership.role === "ADMIN"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {membership.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {new Date(membership.createdAt).toLocaleDateString()}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMembership(membership.groupId)}
                    >
                      <CancelIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events User is Attending */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Events ({userDetail.events.length})
          </CardTitle>
          <CardDescription>Events this user has reminders for</CardDescription>
        </CardHeader>
        <CardContent>
          {userDetail.events.length === 0 ? (
            <p className="text-muted-foreground">User is not attending any events</p>
          ) : (
            <div className="space-y-2">
              {userDetail.events.map((eventReminder) => (
                <div
                  key={eventReminder.eventId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{eventReminder.event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(eventReminder.event.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(eventReminder.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ban Dialog */}
      <AlertDialog
        open={dialog.type === "ban"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {userDetail.user.isBanned ? "Unban User?" : "Ban User?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userDetail.user.isBanned
                ? "This will restore the user's access to the platform."
                : "This will prevent the user from accessing the platform."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBanToggle} disabled={banMutation.isPending}>
              {userDetail.user.isBanned ? "Unban" : "Ban"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
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
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
