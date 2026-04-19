'use client';

import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';
import type { VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];

export type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
};

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Continue',
  cancelLabel = 'Cancel',
  confirmVariant = 'default',
  onConfirm,
  isPending = false,
}: ConfirmActionDialogProps) {
  const [internalPending, setInternalPending] = React.useState(false);
  const busy = isPending || internalPending;

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (busy) return;
    setInternalPending(true);
    try {
      await Promise.resolve(onConfirm());
    } finally {
      setInternalPending(false);
    }
  };

  const descriptionNode =
    description != null && description !== '' ? (
      typeof description === 'string' ? (
        <AlertDialogDescription>{description}</AlertDialogDescription>
      ) : (
        <AlertDialogDescription asChild>
          <div className="text-muted-foreground text-sm text-left">{description}</div>
        </AlertDialogDescription>
      )
    ) : null;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {descriptionNode}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: confirmVariant }))}
            disabled={busy}
            onClick={handleConfirm}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
