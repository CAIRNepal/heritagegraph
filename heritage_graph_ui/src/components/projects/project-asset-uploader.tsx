"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { uploadProjectAsset, type ProjectAssetRow } from "@/lib/projects-api";

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
  const [uploading, setUploading] = useState(false);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length || disabled) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const asset = await uploadProjectAsset(slug, accessToken, {
          file,
          role,
          caption,
          runOcr: false,
        });
        onUploaded(asset);
        toast.success(`${file.name} uploaded.`);
      }
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Upload failed."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-blue-200 dark:border-blue-900 p-4 bg-blue-50/30 dark:bg-blue-950/20">
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
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled || uploading}
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
      <p className="text-xs text-muted-foreground">
        Files are stored without automatic text extraction. Use Extract text on each document when
        you are ready (server OCR; limited vision fallback per file).
      </p>
    </div>
  );
}
