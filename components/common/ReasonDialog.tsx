import { useEffect, useState } from "react";
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
import { ModeratedTextarea } from "@/components/common/ModeratedTextarea";
import { Label } from "@/components/ui/label";

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
  /** Reason must be non-empty before Confirm is enabled — true for every current use (a
   *  suspension/rejection/forced-override always needs a real reason on record). */
  required?: boolean;
  onConfirm: (reason: string) => void;
}

// Same in-app styling as ConfirmDialog, plus a reason field — replaces
// window.prompt()/window.confirm() for actions that need a typed reason
// (suspend, forced overrides, reject). The native browser prompt/confirm
// looks like a system error/warning box next to the rest of this app's
// styled UI, and gives no way to see the reason before submitting.
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel = "Confirm",
  destructive = false,
  required = true,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [flagged, setFlagged] = useState(false);

  // Reset between openings so a previous reason never lingers into an
  // unrelated action on a different tailor/document.
  useEffect(() => {
    if (open) {
      setReason("");
      setFlagged(false);
    }
  }, [open]);

  // A flagged reason can never be confirmed — this dialog backs suspend/
  // reject/override reasons across tailors, customers, disputes, and KYC
  // documents, all of which the backend independently re-checks with the
  // exact same filter; blocking it here just means the admin sees it happen
  // live instead of getting a 400 back after clicking Confirm.
  const canConfirm = (!required || reason.trim().length > 0) && !flagged;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="reason-dialog-input">{label}</Label>
          <ModeratedTextarea
            id="reason-dialog-input"
            autoFocus
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onFlaggedChange={setFlagged}
            placeholder={placeholder}
            className="resize-none"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={() => onConfirm(reason.trim())}
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
