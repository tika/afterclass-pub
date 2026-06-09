"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  BuildingAIcon,
  EditIcon,
  EyeIcon,
  PlusIcon,
  ReloadIcon,
  SearchIcon,
  TrashIcon,
} from "mage-icons-react/stroke";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { groupsApi } from "@/lib/api-client";
import { type AdminGroup } from "@/lib/types/admin";
import { uploadImageClient } from "@/lib/blob";

type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; group: AdminGroup }
  | { type: "delete"; groupId: string };

export default function GroupsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [search, setSearch] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    logoUrl: "",
    bannerUrl: "",
    instagram: "",
    website: "",
    isVerified: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-groups"],
    queryFn: async () => {
      const token = await getToken();
      return groupsApi.getAllGroups(token);
    },
  });
  const groups = (data?.groups || []) as AdminGroup[];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = await getToken();
      return groupsApi.createGroup(token, data);
    },
    onSuccess: () => {
      toast.success("Group created");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create group");
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ groupId, data }: { groupId: string; data: typeof formData }) => {
      const token = await getToken();
      return groupsApi.updateGroup(token, groupId, data);
    },
    onSuccess: () => {
      toast.success("Group updated");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update group");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const token = await getToken();
      return groupsApi.deleteGroup(token, groupId);
    },
    onSuccess: () => {
      toast.success("Group deleted");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-groups"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete group");
    },
  });

  const openCreateDialog = () => {
    setFormData({
      name: "",
      bio: "",
      logoUrl: "",
      bannerUrl: "",
      instagram: "",
      website: "",
      isVerified: false,
    });
    setDialog({ type: "create" });
  };

  const openEditDialog = (group: AdminGroup) => {
    setFormData({
      name: group.name,
      bio: group.bio || "",
      logoUrl: group.logoUrl || "",
      bannerUrl: group.bannerUrl || "",
      instagram: group.instagram || "",
      website: group.website || "",
      isVerified: group.isVerified ?? false,
    });
    setDialog({ type: "edit", group });
  };

  const handleCreate = () => createMutation.mutate(formData);
  const handleEdit = () => {
    if (dialog.type !== "edit") return;
    editMutation.mutate({ groupId: dialog.group.id, data: formData });
  };
  const handleDelete = () => {
    if (dialog.type !== "delete") return;
    deleteMutation.mutate(dialog.groupId);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const url = await uploadImageClient(file);
      setFormData((prev) => ({ ...prev, logoUrl: url }));
      toast.success("Logo uploaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const filteredGroups = groups.filter((group) => {
    if (!search.trim()) return true;
    const searchLower = search.toLowerCase();
    const name = group.name?.toLowerCase() || "";
    return name.includes(searchLower);
  });

  if (isLoading) {
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
          <h1 className="text-3xl font-bold font-headline">Group Management</h1>
          <p className="mt-2 text-muted-foreground">Manage all groups on the platform</p>
        </div>
        <Dialog
          open={dialog.type === "create"}
          onOpenChange={(open) => !open && setDialog({ type: "none" })}
        >
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Group
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Group</DialogTitle>
              <DialogDescription>Add a new group to the platform</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      name: e.target.value,
                    })
                  }
                  placeholder="Group name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bio: e.target.value,
                    })
                  }
                  placeholder="Group description"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="logoUrl">Logo</Label>
                <div className="flex items-center gap-4">
                  {formData.logoUrl ? (
                    <div className="relative h-16 w-16 rounded-lg overflow-hidden border">
                      <Image
                        src={formData.logoUrl}
                        alt="Logo preview"
                        fill
                        className="object-cover"
                      />
                      <button
                        onClick={() =>
                          setFormData({
                            ...formData,
                            logoUrl: "",
                          })
                        }
                        className="absolute top-0 right-0 p-1 bg-black/50 hover:bg-black/70 text-white rounded-bl-lg"
                        type="button"
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center bg-muted/50">
                      {uploadingLogo ? (
                        <ReloadIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <BuildingAIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  <div className="flex-1">
                    <Input
                      id="logoUrl"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      upload a square image for best results.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      website: e.target.value,
                    })
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isVerified">Verified</Label>
                <Switch
                  id="isVerified"
                  checked={formData.isVerified}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      isVerified: checked,
                    })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog({ type: "none" })}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Groups List */}
      <Card>
        <CardHeader>
          <CardTitle>Groups ({filteredGroups.length})</CardTitle>
          <CardDescription>Create, edit, and manage groups</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGroups.length === 0 ? (
            <div className="text-center py-12">
              <BuildingAIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No groups found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {group.logoUrl ? (
                      <Image
                        src={group.logoUrl}
                        alt={group.name}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                        <BuildingAIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{group.name}</h3>
                        {group.isVerified && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created {new Date(group.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/organizations/${group.id}`}>
                      <Button variant="outline" size="sm">
                        <EyeIcon className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(group)}>
                      <EditIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDialog({ type: "delete", groupId: group.id })}
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

      {/* Edit Dialog */}
      <Dialog
        open={dialog.type === "edit"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>Update group details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Input
                id="edit-bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bio: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-logoUrl">Logo</Label>
              <div className="flex items-center gap-4">
                {formData.logoUrl ? (
                  <div className="relative h-16 w-16 rounded-lg overflow-hidden border">
                    <Image
                      src={formData.logoUrl}
                      alt="Logo preview"
                      fill
                      className="object-cover"
                    />
                    <button
                      onClick={() =>
                        setFormData({
                          ...formData,
                          logoUrl: "",
                        })
                      }
                      className="absolute top-0 right-0 p-1 bg-black/50 hover:bg-black/70 text-white rounded-bl-lg"
                      type="button"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="h-16 w-16 rounded-lg border border-dashed flex items-center justify-center bg-muted/50">
                    {uploadingLogo ? (
                      <ReloadIcon className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <BuildingAIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    id="edit-logoUrl"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    upload a square image for best results.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={formData.website}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    website: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-isVerified">Verified</Label>
              <Switch
                id="edit-isVerified"
                checked={formData.isVerified}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    isVerified: checked,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ type: "none" })}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editMutation.isPending}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={dialog.type === "delete"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group and all
              associated data.
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
