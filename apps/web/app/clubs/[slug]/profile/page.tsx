"use client";

import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardIcon, SaveFloppyIcon } from "mage-icons-react/stroke";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useClubContext } from "@/hooks/use-club-context";
import { adminApi, groupsApi } from "@/lib/api-client";
import { uploadImageClient } from "@/lib/blob";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  bio: z.string().optional(),
  logoUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

function ProfilePageContent() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const { groupId, slug } = useClubContext();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  // Fetch group data
  const { data: groupData, isLoading: groupLoading } = useQuery<{
    group: {
      id: string;
      name: string;
      bio?: string | null;
      logoUrl?: string | null;
      bannerUrl?: string | null;
      instagram?: string | null;
      website?: string | null;
      createdAt: string;
      updatedAt: string;
    };
    upcomingEvents: Array<unknown>;
    isFollowing?: boolean;
  } | null>({
    queryKey: ["group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const token = await getToken();
      return adminApi.getGroup(token, groupId);
    },
    enabled: !!groupId,
  });

  const group = groupData?.group;

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      website: "",
      bio: "",
      logoUrl: "",
      bannerUrl: "",
    },
  });

  useEffect(() => {
    if (!group) return;

    form.reset({
      name: group.name ?? "",
      website: group.website ?? "",
      bio: group.bio ?? "",
      logoUrl: group.logoUrl ?? "",
      bannerUrl: group.bannerUrl ?? "",
    });
  }, [group?.id]);

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      if (!groupId) throw new Error("No group selected");
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      // Upload images if files are selected
      let logoUrl = data.logoUrl;
      let bannerUrl = data.bannerUrl;

      if (logoFile) {
        logoUrl = await uploadImageClient(logoFile);
      }

      if (bannerFile) {
        bannerUrl = await uploadImageClient(bannerFile);
      }

      return groupsApi.updateGroup(token, groupId, {
        name: data.name,
        website: data.website || undefined,
        bio: data.bio || undefined,
        logoUrl: logoUrl || undefined,
        bannerUrl: bannerUrl || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      setLogoFile(null);
      setBannerFile(null);
      queryClient.invalidateQueries({ queryKey: ["group", groupId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update profile");
    },
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("logoUrl", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const _handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        form.setValue("bannerUrl", reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    updateGroupMutation.mutate(data);
  };

  if (!groupId) {
    return (
      <div className="flex items-center justify-center h-96">
        <Card>
          <CardHeader>
            <CardTitle>No Group Selected</CardTitle>
            <CardDescription>
              Please select a group from the sidebar to manage profile.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (groupLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const logoUrl = form.watch("logoUrl") || group?.logoUrl;
  const _bannerUrl = form.watch("bannerUrl") || group?.bannerUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Profile Management</h1>
          <p className="text-muted-foreground mt-1">
            How your club appears on the Organizations tab
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/clubs/${slug}`}>
            <DashboardIcon className="w-4 h-4 mr-2" />
            Dashboard
          </Link>
        </Button>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Identity Section */}
        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <CardDescription>Basic information about your club</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>Club Information</FieldLegend>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Logo</FieldLabel>
                    <div className="flex items-center gap-4">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-muted">
                        {logoUrl ? (
                          <Image src={logoUrl} alt="Logo" fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No logo
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <Input type="file" accept="image/*" onChange={handleLogoUpload} />
                        <p className="text-xs text-muted-foreground mt-1">Circular crop preview</p>
                      </div>
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="name">Club Name *</FieldLabel>
                    <Input id="name" {...form.register("name")} placeholder="Tufts Mountain Club" />
                    <FieldError>{form.formState.errors.name?.message}</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="website">Website</FieldLabel>
                    <Input
                      id="website"
                      type="url"
                      {...form.register("website")}
                      placeholder="https://example.com"
                    />
                    <FieldError>{form.formState.errors.website?.message}</FieldError>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="bio">Bio</FieldLabel>
                    <Textarea
                      id="bio"
                      {...form.register("bio")}
                      placeholder="A brief description of your club"
                      rows={4}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateGroupMutation.isPending} size="lg">
            <SaveFloppyIcon className="w-4 h-4 mr-2" />
            {updateGroupMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
