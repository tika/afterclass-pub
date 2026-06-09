"use client";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, SecurityShieldIcon, UserMinusIcon, UserPlusIcon } from "mage-icons-react/stroke";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useClubContext } from "@/hooks/use-club-context";
import { adminApi } from "@/lib/api-client";

function TeamPageContent() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { groupId } = useClubContext();
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [emailToAdd, setEmailToAdd] = useState("");

  // Fetch group members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      return adminApi.getGroupMembers(token, groupId);
    },
    enabled: !!groupId,
  });

  const members = membersData?.members || [];

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "ADMIN" | "MEMBER" }) => {
      if (!groupId) throw new Error("No group selected");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return adminApi.addGroupMember(token, groupId, email, role, true);
    },
    onSuccess: (data: { invitationSent?: boolean }) => {
      if (data.invitationSent) {
        toast.success("Invitation email sent! They'll be added once they sign up.");
      } else {
        toast.success("Member added successfully!");
        queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
      }
      setEmailToAdd("");
      setAddMemberDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add member");
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      if (!groupId) throw new Error("No group selected");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return adminApi.removeGroupMember(token, groupId, userId);
    },
    onSuccess: () => {
      toast.success("Member removed successfully!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "ADMIN" | "MEMBER" }) => {
      if (!groupId) throw new Error("No group selected");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      return adminApi.updateGroupMemberRole(token, groupId, userId, role);
    },
    onSuccess: () => {
      toast.success("Role updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["group-members", groupId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const handleAddMember = () => {
    if (!emailToAdd.trim()) {
      toast.error("Please enter an email address");
      return;
    }

    // Check if user is already a member (by email)
    if (members.some((m) => m.user.email.toLowerCase() === emailToAdd.toLowerCase())) {
      toast.error("User is already a member");
      return;
    }

    addMemberMutation.mutate({ email: emailToAdd.trim(), role: "MEMBER" });
  };

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>No Group Selected</CardTitle>
            <CardDescription>
              Please select a group from the sidebar to manage team members.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Team Management</h1>
          <p className="text-muted-foreground mt-1">Manage your executive board members</p>
        </div>
        <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusIcon className="w-4 h-4 mr-2" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
              <DialogDescription>Add a user to your group by their email address</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="email">Email Address</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={emailToAdd}
                    onChange={(e) => setEmailToAdd(e.target.value)}
                    placeholder="user@tufts.edu"
                  />
                  <FieldError>
                    {addMemberMutation.isError ? addMemberMutation.error?.message : null}
                  </FieldError>
                </Field>
              </FieldGroup>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddMemberDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={addMemberMutation.isPending || !emailToAdd}
                >
                  {addMemberMutation.isPending ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Users with access to manage this group</CardDescription>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members yet. Add your first member!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((item) => {
                  const member = item.member;
                  const user = item.user;
                  const initials =
                    user.name
                      ?.split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase() ||
                    user.email?.[0]?.toUpperCase() ||
                    "";

                  return (
                    <TableRow key={member.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{initials}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{user.name || "No name"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded text-xs flex items-center gap-1 w-fit ${
                            member.role === "ADMIN"
                              ? "bg-chart-4/10 text-chart-4"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {member.role === "ADMIN" && <SecurityShieldIcon className="w-3 h-3" />}
                          {member.role}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {member.role === "MEMBER" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    userId: member.userId,
                                    role: "ADMIN",
                                  })
                                }
                              >
                                <UserPlusIcon className="w-4 h-4 mr-2" />
                                Promote to Admin
                              </DropdownMenuItem>
                            )}
                            {member.role === "ADMIN" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    userId: member.userId,
                                    role: "MEMBER",
                                  })
                                }
                              >
                                <UserMinusIcon className="w-4 h-4 mr-2" />
                                Demote to Member
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => removeMemberMutation.mutate(member.userId)}
                              className="text-destructive"
                            >
                              <UserMinusIcon className="w-4 h-4 mr-2" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <TeamPageContent />
    </Suspense>
  );
}
