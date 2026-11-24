"use client";

import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UploadGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinuePasting: () => void;
}

export function UploadGateModal({
  open,
  onOpenChange,
  onContinuePasting,
}: UploadGateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save your work — sign in to upload files</DialogTitle>
          <DialogDescription>
            Uploads are stored so you can revisit them anytime. Guests can still
            paste text for one free generation.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Link href="/login?next=/studio&pendingUpload=1" className="w-full">
            <Button className="w-full">Continue with Google</Button>
          </Link>
          <Link href="/signup?next=/studio" className="w-full">
            <Button variant="outline" className="w-full">
              Sign up with email
            </Button>
          </Link>
          <button
            type="button"
            className="mt-1 text-center text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
            onClick={() => {
              onOpenChange(false);
              onContinuePasting();
            }}
          >
            Just pasting text for now
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
