import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/** Shared "reset password" flow for the customer and tailor detail pages —
 *  same shape as the staff-account equivalent (Admin Users page): leave the
 *  field blank to auto-generate a temp password, or set a specific one. The
 *  generated password is shown exactly once and never re-fetchable. */
export function ResetPasswordDialog({
  open,
  onOpenChange,
  personName,
  reset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName: string;
  reset: (args: { new_password?: string }) => Promise<{ temp_password: string | null }>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);

  const close = () => {
    setPassword("");
    setGenerated(null);
    onOpenChange(false);
  };

  const submit = async () => {
    if (password.trim() && password.trim().length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const res = await reset(password.trim() ? { new_password: password.trim() } : {});
      if (res.temp_password) {
        setGenerated(res.temp_password);
      } else {
        toast.success("Password updated");
        close();
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Couldn't reset password");
    } finally {
      setBusy(false);
    }
  };

  if (generated) {
    return (
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Password reset</DialogTitle>
            <DialogDescription>
              Share this temporary password with {personName} securely (e.g. read it to them on a
              call) — it won't be shown again. They should change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm text-center select-all">
            {generated}
          </div>
          <DialogFooter>
            <Button onClick={close}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset {personName}'s password</DialogTitle>
          <DialogDescription>
            Leave blank to auto-generate a temporary password, or set a specific one. This does
            not sign them out of devices already logged in.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password (optional)</Label>
          <Input
            id="new-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to auto-generate"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Resetting…" : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
