"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type ReactCropperElement } from "react-cropper";
import { toast } from "sonner";
import "cropperjs/dist/cropper.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";

interface ImageCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageFile?: File | null;
  imageUrl?: string | null;
  onCropComplete: (croppedFile: File) => void;
}

export function ImageCropModal({
  open,
  onOpenChange,
  imageFile = null,
  imageUrl = null,
  onCropComplete,
}: ImageCropModalProps) {
  const cropperRef = useRef<ReactCropperElement>(null);
  const [zoom, setZoom] = useState(1);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);

  // Load image from file or URL
  useEffect(() => {
    if (imageFile) {
      setImageLoading(true);
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result as string);
        setImageLoading(false);
      });
      reader.addEventListener("error", () => {
        toast.error("Failed to load image");
        setImageSrc(null);
        setImageLoading(false);
      });
      reader.readAsDataURL(imageFile);
    } else if (imageUrl) {
      setImageLoading(true);
      fetch(imageUrl)
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            setImageSrc(reader.result as string);
            setImageLoading(false);
          });
          reader.addEventListener("error", () => {
            toast.error("Failed to load image");
            setImageSrc(null);
            setImageLoading(false);
          });
          reader.readAsDataURL(blob);
        })
        .catch(() => {
          toast.error("Failed to load image");
          setImageSrc(null);
          setImageLoading(false);
        });
    } else {
      setImageSrc(null);
      setImageLoading(false);
    }
  }, [imageFile, imageUrl]);

  const handleZoomChange = useCallback((value: number[]) => {
    const newZoom = value[0] ?? 1;
    setZoom(newZoom);
    const cropper = cropperRef.current?.cropper;
    if (cropper) {
      cropper.zoomTo(newZoom);
    }
  }, []);

  const handleCropAndUpload = useCallback(async () => {
    const cropper = cropperRef.current?.cropper;
    if (!cropper) {
      toast.error("Cropper not ready");
      return;
    }

    setProcessing(true);
    try {
      const canvas = cropper.getCroppedCanvas();
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (!b) {
              reject(new Error("Canvas is empty"));
              return;
            }
            resolve(b);
          },
          "image/jpeg",
          0.95,
        );
      });

      const file = new File([blob], imageFile?.name || "cropped-image.jpg", {
        type: "image/jpeg",
      });
      onCropComplete(file);
      onOpenChange(false);
      setZoom(1);
    } catch (error) {
      console.error("Error cropping image:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to crop image. Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  }, [imageFile, onCropComplete, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
    setZoom(1);
    setImageSrc(null);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Adjust the crop area to create a square image (1:1 aspect ratio)
          </DialogDescription>
        </DialogHeader>

        {imageLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-muted-foreground">Loading image...</div>
          </div>
        ) : imageSrc ? (
          <div className="space-y-4">
            {/* Crop Area */}
            <div className="relative h-[400px] w-full bg-muted rounded-lg overflow-hidden">
              <Cropper
                ref={cropperRef}
                src={imageSrc}
                style={{ height: "100%", width: "100%" }}
                aspectRatio={1}
                viewMode={1}
                guides
                background={false}
                responsive
                autoCropArea={1}
                checkOrientation={false}
                zoom={(e: Cropper.ZoomEvent<HTMLImageElement>) => {
                  setZoom(e.detail.ratio);
                }}
              />
            </div>

            {/* Zoom Slider */}
            <div className="space-y-2">
              <label htmlFor="zoom-slider" className="text-sm font-medium">
                Zoom
              </label>
              <Slider
                id="zoom-slider"
                value={[zoom]}
                min={0.1}
                max={3}
                step={0.1}
                onValueChange={handleZoomChange}
                className="w-full"
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={processing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCropAndUpload} disabled={processing || !imageSrc}>
            {processing ? "Processing..." : "Crop & Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
