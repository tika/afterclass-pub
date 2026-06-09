"use client";

import { useAuth } from "@/hooks/use-auth";
import {
  EditIcon,
  MapMarkerIcon,
  PlusIcon,
  ReloadIcon,
  SearchIcon,
  TrashIcon,
} from "mage-icons-react/stroke";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { POIForm } from "@/components/admin/poi-form";
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
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminPoisApi } from "@/lib/api-client";
import { type AdminPOI } from "@/lib/types/admin";

type DialogState =
  | { type: "none" }
  | { type: "create" }
  | { type: "edit"; poi: AdminPOI }
  | { type: "delete"; poiId: string };

export default function POIsPage() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pois"],
    queryFn: async () => {
      const token = await getToken();
      return adminPoisApi.getAllPOIs(token);
    },
  });
  const pois = (data?.pois || []) as AdminPOI[];

  const deleteMutation = useMutation({
    mutationFn: async (poiId: string) => {
      const token = await getToken();
      return adminPoisApi.deletePOI(token, poiId);
    },
    onSuccess: () => {
      toast.success("POI deleted");
      setDialog({ type: "none" });
      queryClient.invalidateQueries({ queryKey: ["admin-pois"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete POI");
    },
  });

  const handleFormSuccess = () => {
    setDialog({ type: "none" });
    queryClient.invalidateQueries({ queryKey: ["admin-pois"] });
  };

  const filteredPOIs = pois.filter((poi) => {
    const q = search.toLowerCase();
    return (
      poi.name.toLowerCase().includes(q) ||
      poi.aliases?.some((a) => a.toLowerCase().includes(q)) ||
      poi.address?.toLowerCase().includes(q)
    );
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
          <h1 className="text-3xl font-bold font-headline">POI Management</h1>
          <p className="mt-2 text-muted-foreground">Manage points of interest on the platform</p>
        </div>
        <Button onClick={() => setDialog({ type: "create" })}>
          <PlusIcon className="h-4 w-4 mr-2" />
          Create POI
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search POIs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* POIs List */}
      <Card>
        <CardHeader>
          <CardTitle>Points of Interest ({filteredPOIs.length})</CardTitle>
          <CardDescription>Create, edit, and manage points of interest</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredPOIs.length === 0 ? (
            <div className="text-center py-12">
              <MapMarkerIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No POIs found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPOIs.map((poi) => (
                <div
                  key={poi.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{poi.name}</h3>
                    </div>
                    {poi.aliases && poi.aliases.length > 0 && (
                      <p className="text-sm text-muted-foreground mb-2">
                        aka {poi.aliases.join(", ")}
                      </p>
                    )}
                    <div className="text-sm text-muted-foreground space-y-1">
                      {poi.address && (
                        <p>
                          <strong>Address:</strong> {poi.address}
                        </p>
                      )}
                      <p>
                        <strong>Coordinates:</strong> {poi.lat.toFixed(6)}, {poi.lng.toFixed(6)}
                      </p>
                      <p className="text-xs">
                        Created: {new Date(poi.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDialog({ type: "edit", poi })}
                    >
                      <EditIcon className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDialog({ type: "delete", poiId: poi.id })}
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

      {/* Create Dialog */}
      <Dialog
        open={dialog.type === "create"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create POI</DialogTitle>
            <DialogDescription>Add a new point of interest</DialogDescription>
          </DialogHeader>
          <POIForm
            key="create"
            onSuccess={handleFormSuccess}
            onCancel={() => setDialog({ type: "none" })}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={dialog.type === "edit"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit POI</DialogTitle>
            <DialogDescription>Update point of interest details</DialogDescription>
          </DialogHeader>
          <POIForm
            key={dialog.type === "edit" ? dialog.poi.id : "create"}
            poiId={dialog.type === "edit" ? dialog.poi.id : undefined}
            initialData={
              dialog.type === "edit"
                ? {
                    name: dialog.poi.name,
                    aliases: dialog.poi.aliases,
                    lat: dialog.poi.lat,
                    lng: dialog.poi.lng,
                    address: dialog.poi.address,
                  }
                : undefined
            }
            onSuccess={handleFormSuccess}
            onCancel={() => setDialog({ type: "none" })}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog
        open={dialog.type === "delete"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the POI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(dialog.type === "delete" ? dialog.poiId : "")}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
