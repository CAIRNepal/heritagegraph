"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage, isApiError } from "@/lib/api-client";
import { uploadProjectAsset, type ProjectAssetRow } from "@/lib/projects-api";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "video/mp4",
];

function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return "File exceeds 50 MB limit.";
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}`;
  }
  return null;
}

export function ProjectAssetUploader({
  slug,
  accessToken,
  disabled,
  onUploaded,
}: {
  slug: string;
  accessToken: string;
  disabled?: boolean;
  onUploaded: (asset: ProjectAssetRow) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [role, setRole] = useState("evidence");
  const [caption, setCaption] = useState("");
  const [versionLabel, setVersionLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setUploading(true);
    setProgress(0);
    try {
      for (const file of Array.from(files)) {
        const err = validateFile(file);
        if (err) {
          toast.error(err);
          continue;
        }
        const asset = await uploadProjectAsset(slug, accessToken, {
          file,
          role,
          caption,
          versionLabel: versionLabel.trim() || undefined,
          runOcr: false,
          onProgress: (pct) => setProgress(pct),
        });
        onUploaded(asset);
        toast.success(`${file.name} uploaded.`);
      }
      setCaption("");
      setVersionLabel("");
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      const msg = isApiError(e) ? e.message : getApiErrorMessage(e, "Upload failed.");
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-primary/30 dark:border-primary/30 p-4 bg-primary/10 dark:bg-primary/10">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole} disabled={disabled || uploading}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="evidence">Evidence</SelectItem>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="reference">Reference</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Caption</Label>
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional description"
            disabled={disabled || uploading}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Version label</Label>
          <Input
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value.slice(0, 120))}
            placeholder='e.g. "v2" or revised-2026-05 — optional'
            disabled={disabled || uploading}
          />
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled || uploading}
        accept={ALLOWED_TYPES.join(",")}
        onChange={(e) => void onFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Choose files"}
      </Button>
      {uploading && progress > 0 && (
        <Progress value={progress} className="h-2" aria-label="Upload progress" />
      )}
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP, PDF, MP3, or MP4 (max 50 MB). Automatic text extraction stays off until
        you choose Extract text on an asset.
      </p>
    </div>
  );
}
