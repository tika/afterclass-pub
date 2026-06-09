"use client";

import { Reorder } from "framer-motion";
import { CancelIcon, EditIcon, UploadIcon } from "mage-icons-react/stroke";
import Image from "next/image";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_FILE_SIZE, uploadEventFlyer } from "@/lib/blob";
import { cn } from "@/lib/utils";
import { ImageCropModal } from "./image-crop-modal";

interface FlyerUploadHeroProps {
  value: string[];
  onChange: (images: string[]) => void;
  eventId?: string;
  maxImages?: number;
  error?: string;
  className?: string;
}

function FlyerItem({
  url,
  index,
  uploading,
  onEdit,
  onRemove,
}: {
  url: string;
  index: number;
  uploading: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <Reorder.Item
      value={url}
      className="relative group list-none shrink-0 cursor-grab active:cursor-grabbing"
    >
      <div className="relative h-[180px] w-[180px] rounded-lg overflow-hidden border border-border bg-muted">
        <Image
          src={url}
          alt={`Flyer ${index + 1}`}
          fill
          className="object-cover pointer-events-none"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            disabled={uploading}
            title="Adjust crop"
          >
            <EditIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <CancelIcon className="h-4 w-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

export function FlyerUploadHero({
  value,
  onChange,
  eventId,
  maxImages = 3,
  error,
  className,
}: FlyerUploadHeroProps) {
  const [uploading, setUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (value.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }
      setFileToCrop(file);
      setCropModalOpen(true);
    },
    [value.length, maxImages],
  );

  const handleCropComplete = useCallback(
    async (croppedFile: File) => {
      setUploading(true);
      try {
        const url = await uploadEventFlyer(croppedFile, eventId);
        if (editingIndex !== null) {
          const next = [...value];
          next[editingIndex] = url;
          onChange(next);
          toast.success("Image updated");
        } else {
          onChange([...value, url]);
          toast.success("Image uploaded successfully");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload image");
        throw err;
      } finally {
        setUploading(false);
        setFileToCrop(null);
        setEditingIndex(null);
      }
    },
    [value, onChange, eventId, editingIndex],
  );

  const handleCropModalClose = useCallback((open: boolean) => {
    setCropModalOpen(open);
    if (!open) {
      setFileToCrop(null);
      setEditingIndex(null);
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const handleDropFile = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  const handleEditClick = useCallback((index: number) => {
    setEditingIndex(index);
    setCropModalOpen(true);
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange],
  );

  const handleReorder = useCallback(
    (newOrder: string[]) => {
      onChange(newOrder);
    },
    [onChange],
  );

  const canAddMore = value.length < maxImages;
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);

  return (
    <div className={cn("space-y-2", className)}>
      <ImageCropModal
        open={cropModalOpen}
        onOpenChange={handleCropModalClose}
        imageFile={editingIndex === null ? fileToCrop : null}
        imageUrl={editingIndex !== null ? (value[editingIndex] ?? null) : null}
        onCropComplete={handleCropComplete}
      />

      {/* Flyer gallery: reorderable + adjustable */}
      {value.length === 0 ? (
        <section
          aria-label="Flyer upload area"
          className={cn(
            "relative w-full h-[200px] rounded-lg overflow-hidden border-2 border-dashed transition-all duration-200",
            isDragOver
              ? "border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20"
              : "border-border bg-muted/50 hover:border-muted-foreground/40 hover:bg-muted/70",
          )}
          onDrop={handleDropFile}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer gap-2 p-4">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileInput}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? (
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
            ) : (
              <>
                <UploadIcon
                  className={cn(
                    "h-10 w-10 text-muted-foreground transition-transform duration-200",
                    isDragOver && "scale-110 text-primary",
                  )}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Drag and drop or click to upload
                </span>
                <span className="text-xs text-muted-foreground/90">
                  PNG, JPG, WebP up to {maxSizeMB}MB · Up to {maxImages} images
                </span>
              </>
            )}
          </label>
        </section>
      ) : (
        <section
          aria-label="Flyer gallery"
          className={cn(
            "space-y-2 rounded-lg transition-all duration-200",
            isDragOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}
          onDrop={handleDropFile}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-wrap gap-3 items-start">
            <Reorder.Group
              axis="x"
              values={value}
              onReorder={handleReorder}
              className="flex flex-wrap gap-3"
            >
              {value.map((url, index) => (
                <FlyerItem
                  key={url}
                  url={url}
                  index={index}
                  uploading={uploading}
                  onEdit={() => handleEditClick(index)}
                  onRemove={() => handleRemove(index)}
                />
              ))}
            </Reorder.Group>
            {canAddMore && (
              <label
                className={cn(
                  "flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/50 hover:border-muted-foreground/40 hover:bg-muted",
                )}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleFileInput}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="text-2xl text-muted-foreground">+</span>
              </label>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Drag images left or right to reorder. Hover to adjust or remove.
          </p>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
