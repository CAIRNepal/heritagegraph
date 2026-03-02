"use client";

import { useState } from "react";
import {
  Share2,
  Twitter,
  Facebook,
  Linkedin,
  Mail,
  Link2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSharing } from "@/hooks/use-contributions";
import { toast } from "sonner";

interface ShareButtonProps {
  entityId: string;
  entityName: string;
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "sm" | "default" | "icon";
}

export function ShareButton({
  entityId,
  entityName,
  className,
  variant = "outline",
  size = "sm",
}: ShareButtonProps) {
  const { shareToTwitter, shareToFacebook, shareToLinkedIn, shareViaEmail, copyLink } =
    useSharing();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyLink(entityId);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn("gap-1.5", className)}>
          <Share2 className="h-3.5 w-3.5" />
          {size !== "icon" && "Share"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => shareToTwitter(entityName, entityId)}>
          <Twitter className="mr-2 h-4 w-4" />
          Share on X / Twitter
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareToFacebook(entityId)}>
          <Facebook className="mr-2 h-4 w-4" />
          Share on Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareToLinkedIn(entityId)}>
          <Linkedin className="mr-2 h-4 w-4" />
          Share on LinkedIn
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => shareViaEmail(entityName, entityId)}>
          <Mail className="mr-2 h-4 w-4" />
          Share via Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopy}>
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Link2 className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
