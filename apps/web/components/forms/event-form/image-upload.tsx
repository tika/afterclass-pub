"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CancelIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon } from "mage-icons-react/stroke";
import Image from "next/image";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { uploadEventFlyer } from "@/lib/blob";
import { ImageCropModal } from "./image-crop-modal";

interface ImageUploadProps {
  value: string[];
  onChange: (images: string[]) => void;
  eventId?: string;
  maxImages?: number;
  error?: string;
}

export function ImageUpload({ value, onChange, eventId, maxImages = 3, error }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);

  const handleFileSelect = useCallback(
    (file: File) => {
      if (value.length >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }
      // Open crop modal instead of uploading immediately
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
        onChange([...value, url]);
        toast.success("Image uploaded successfully");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to upload image");
        throw err; // Re-throw to let modal handle it
      } finally {
        setUploading(false);
        setFileToCrop(null);
      }
    },
    [value, onChange, eventId],
  );

  const handleCropModalClose = useCallback((open: boolean) => {
    setCropModalOpen(open);
    if (!open) {
      // Reset file when modal closes
      setFileToCrop(null);
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
      // Reset input so same file can be selected again
      e.target.value = "";
    },
    [handleFileSelect],
  );

  const handleDropFile = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      const newImages = value.filter((_, i) => i !== index);
      onChange(newImages);
    },
    [value, onChange],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newOrder = [...value];
      const temp = newOrder[index];
      const prev = newOrder[index - 1];
      if (temp === undefined || prev === undefined) return;
      newOrder[index] = prev;
      newOrder[index - 1] = temp;
      onChange(newOrder);
    },
    [value, onChange],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === value.length - 1) return;
      const newOrder = [...value];
      const temp = newOrder[index];
      const next = newOrder[index + 1];
      if (temp === undefined || next === undefined) return;
      newOrder[index] = next;
      newOrder[index + 1] = temp;
      onChange(newOrder);
    },
    [value, onChange],
  );

  const canAddMore = value.length < maxImages;

  return (
    <div className="space-y-2">
      <ImageCropModal
        open={cropModalOpen}
        onOpenChange={handleCropModalClose}
        imageFile={fileToCrop}
        onCropComplete={handleCropComplete}
      />
      <div className="flex flex-wrap gap-4" onDrop={handleDropFile} onDragOver={handleDragOver}>
        <AnimatePresence mode="popLayout">
          {value.map((url, index) => (
            <motion.div
              key={url}
              layout
              initial={{ opacity: 0, scale: 0.8, y: -20 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{ opacity: 0, scale: 0.8, y: -20 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                ease: "easeInOut",
              }}
              className="relative group"
            >
              <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border bg-muted">
                <Image
                  src={url}
                  alt={`Flyer ${index + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(index)}
                >
                  <CancelIcon className="h-4 w-4" />
                </Button>
                {value.length > 1 && (
                  <div className="absolute bottom-1 left-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-5 w-5 bg-black/60 hover:bg-black/80 border-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(index);
                      }}
                      disabled={index === 0}
                    >
                      <ChevronUpIcon className="h-3 w-3 text-white" />
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      className="h-5 w-5 bg-black/60 hover:bg-black/80 border-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(index);
                      }}
                      disabled={index === value.length - 1}
                    >
                      <ChevronDownIcon className="h-3 w-3 text-white" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {canAddMore && (
          <motion.label
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ ease: "easeInOut" }}
            className="relative flex items-center justify-center w-32 h-32 rounded-lg border-2 border-dashed border-border bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
          >
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              onChange={handleFileInput}
              disabled={uploading}
              className="hidden"
            />
            {uploading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            ) : (
              <PlusIcon className="h-8 w-8 text-muted-foreground" />
            )}
          </motion.label>
        )}
      </div>

      {error && <FieldError>{error}</FieldError>}
      <FieldDescription>
        Upload up to {maxImages} square flyer images. First image will be used as the event cover.
        Use arrows to reorder.
      </FieldDescription>
    </div>
  );
}
