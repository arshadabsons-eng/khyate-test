import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, FormLayout, FormSection } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTailorProfile, useUpdateTailorProfile } from "@/lib/api/queries/tailor";
import {
  useVerifyStatus,
  useRequestEmailCode,
  useConfirmEmailCode,
  useRequestPhoneCode,
  useConfirmPhoneCode,
} from "@/lib/api/queries/verify";
import { apiClient } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IconCheck, IconMail, IconDeviceMobile } from "@tabler/icons-react";

export const Route = createFileRoute("/tailor/settings")({ component: SettingsPage });

function SettingsPage() {
  const q = useTailorProfile();
  const update = useUpdateTailorProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [biz, setBiz] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);
  // Measurement fees (stored in fils). Shop is free by default (0); home is the
  // tailor's own price for visiting the customer.
  const [shopFeeFils, setShopFeeFils] = useState(0);
  const [homeFeeFils, setHomeFeeFils] = useState(0);
  const [acceptsHomeVisits, setAcceptsHomeVisits] = useState(false);

  async function sendSupport() {
    if (!supportMsg.trim()) return;
    setSendingSupport(true);
    try {
      await apiClient.post("/me/support", {
        subject: supportSubject.trim() || "Support request",
        message: supportMsg.trim(),
      });
      setSupportSubject("");
      setSupportMsg("");
      toast.success("Sent — our team will get back to you.");
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Couldn't send. Try again.");
    } finally {
      setSendingSupport(false);
    }
  }

  useEffect(() => {
    if (q.data) {
      setBiz(q.data.business_name);
      setPhone(q.data.phone);
      setCity(q.data.city);
      if (q.data.preferred_lang === "ar" || q.data.preferred_lang === "en")
        setLang(q.data.preferred_lang);
      setShopFeeFils(q.data.shop_measure_fee_fils ?? 0);
      setHomeFeeFils(q.data.home_visit_fee_fils ?? 0);
      setAcceptsHomeVisits(q.data.accepts_home_visits ?? false);
    }
  }, [q.data]);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const save = () =>
    update.mutate(
      { business_name: biz, phone, city, preferred_lang: lang },
      {
        onSuccess: () => toast.success("Settings saved"),
        onError: mutationErrorToast("Couldn't save settings"),
      },
    );

  const saveFees = () =>
    update.mutate(
      {
        shop_measure_fee_fils: shopFeeFils,
        home_visit_fee_fils: homeFeeFils,
        accepts_home_visits: acceptsHomeVisits,
      },
      {
        onSuccess: () => toast.success("Measurement fees saved"),
        onError: mutationErrorToast("Couldn't save measurement fees"),
      },
    );

  async function deleteAccount() {
    const ok = window.confirm(
      "Delete your account? This deactivates your storefront and removes your personal data. " +
        "Order and tax records are kept in anonymised form as required by law. This cannot be undone.",
    );
    if (!ok) return;
    try {
      await apiClient.delete("/me/account");
      toast.success("Account deleted");
      auth.logout();
      qc.clear();
      navigate({ to: "/login" });
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Couldn't delete account");
    }
  }

  return (
    <div className="space-y-6">
      <header className="kh-section">
        <h1 className="kh-h1 font-serif">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your storefront identity, notifications and account.
        </p>
      </header>

      <FormLayout>
        <FormSection>
          <AccountVerificationCard />
        </FormSection>

        <FormSection>
          <Card title="Business profile">
            <div className="space-y-4">
              <Field label="Business name">
                <Input maxLength={60} value={biz} onChange={(e) => setBiz(e.target.value)} />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="City">
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="Language">
                <div className="flex gap-2">
                  {(["en", "ar"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLang(l)}
                      className={`px-4 py-1.5 rounded-full text-sm ${lang === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >
                      {l === "en" ? "English" : "العربية"}
                    </button>
                  ))}
                </div>
              </Field>
              <Button onClick={save} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </Card>
        </FormSection>

        <FormSection>
          <Card title="Measurement & fitting">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                When a customer orders a made-to-measure garment, they choose how they'll be
                measured. An in-shop visit is always free; set your fee for home visits below.
              </p>
              <Toggle
                label="Accept home visits"
                desc="Let customers book you for an at-home measurement appointment."
                checked={acceptsHomeVisits}
                onChange={setAcceptsHomeVisits}
              />
              <Field label="In-shop measurement fee">
                <p className="text-sm font-medium py-2">Always free</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Customers are never charged for visiting your shop — this can't be changed.
                </p>
              </Field>
              <Field label="Home-visit measurement fee (AED)">
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={homeFeeFils / 100 || 0}
                  onChange={(e) =>
                    setHomeFeeFils(Math.max(0, Math.round(Number(e.target.value) * 100)))
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your charge for travelling to the customer's home. The customer pays this in full
                  at checkout.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  This fee is non-refundable once an order is placed — it compensates you for
                  travelling to the customer.
                </p>
              </Field>
              <Button onClick={saveFees} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save fees"}
              </Button>
            </div>
          </Card>
        </FormSection>

        {/* The old "Notifications" card here was a placebo — its two toggles
            wrote localStorage keys nothing anywhere read, so they controlled
            nothing while looking like real preferences. Removed; real per-user
            notification preferences are one platform-wide product feature
            (shared with the customer app's identical gap) and belong to that
            build, not a fake switch. */}

        <FormSection>
          <Card title="Contact Khyate support">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Need help with payouts, verification or anything else? Send us a message and our
                team will reply in your inbox.
              </p>
              <Field label="Subject">
                <Input
                  value={supportSubject}
                  onChange={(e) => setSupportSubject(e.target.value)}
                  placeholder="e.g. Payout not received"
                />
              </Field>
              <Field label="Message">
                <Textarea
                  rows={4}
                  value={supportMsg}
                  onChange={(e) => setSupportMsg(e.target.value)}
                  placeholder="How can we help?"
                  className="resize-none"
                />
              </Field>
              <Button onClick={sendSupport} disabled={!supportMsg.trim() || sendingSupport}>
                {sendingSupport ? "Sending…" : "Send to support"}
              </Button>
            </div>
          </Card>
        </FormSection>

        <FormSection>
          <Card title="Legal">
            <div className="flex flex-wrap gap-4 text-sm">
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Terms of Service
              </a>
            </div>
          </Card>
        </FormSection>

        <FormSection>
          <Card title="Account">
            <div className="flex flex-col gap-3 items-start">
              <Button
                variant="outline"
                onClick={() => {
                  auth.logout();
                  qc.clear();
                  navigate({ to: "/login" });
                }}
              >
                Sign out
              </Button>
              <div className="pt-2 border-t w-full">
                <p className="text-xs text-muted-foreground mb-2">
                  Deleting your account deactivates your storefront and removes your personal data.
                  Order and tax records are kept in anonymised form as required by UAE law.
                </p>
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/5"
                  onClick={deleteAccount}
                >
                  Delete account
                </Button>
              </div>
            </div>
          </Card>
        </FormSection>
      </FormLayout>
    </div>
  );
}

// Email + mobile verification, done from Settings whenever the tailor gets to
// it — not a login gate (see tailor.tsx's non-blocking banner). BOTH can gate
// final KYC approval: lib/kyc.js isComplete() requires email_verified and
// phone_verified whenever the matching admin onboarding toggles are on (both
// default on). The phone half previously had complete backend endpoints but no
// UI anywhere — with the default settings that hard-blocked every tailor's
// approval at the completeness gate.
function AccountVerificationCard() {
  const status = useVerifyStatus();

  if (status.isLoading)
    return (
      <Card title="Account verification">
        <CenteredSpinner />
      </Card>
    );
  if (!status.data) return null; // request failed — not critical enough to block the rest of Settings

  return (
    <Card title="Account verification">
      <div className="space-y-5">
        <EmailVerifySection
          email={status.data.email}
          verified={status.data.email_verified}
        />
        <div className="border-t" />
        <PhoneVerifySection
          initialPhone={status.data.phone}
          verified={status.data.phone_verified}
        />
      </div>
    </Card>
  );
}

function EmailVerifySection({ email, verified }: { email: string; verified: boolean }) {
  const requestCode = useRequestEmailCode();
  const confirmCode = useConfirmEmailCode();
  const [sent, setSent] = useState(false);
  const [demo, setDemo] = useState(false);
  const [code, setCode] = useState("");

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <IconCheck size={16} /> Email verified — {email}
      </div>
    );
  }

  const send = () => {
    requestCode.mutate(undefined, {
      onSuccess: (r) => {
        setSent(true);
        setDemo(!!r.demo);
      },
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't send the code."),
    });
  };
  const confirm = () => {
    confirmCode.mutate(code, {
      onSuccess: () => toast.success("Email verified — you can now receive orders."),
      onError: (e: unknown) => toast.error((e as Error)?.message || "That code is incorrect."),
    });
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconMail size={16} className="text-muted-foreground shrink-0" />
        <span className="shrink-0">Email</span>
        <span className="text-muted-foreground font-normal truncate min-w-0 flex-1">
          — {email}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Verify your email to start receiving orders.
      </p>
      {!sent ? (
        <Button onClick={send} disabled={requestCode.isPending} variant="outline">
          {requestCode.isPending ? "Sending…" : "Send code to email"}
        </Button>
      ) : (
        <>
          {demo && (
            <p className="text-[11px] text-muted-foreground">
              Demo mode — enter any 6 digits (no email sent yet).
            </p>
          )}
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="text-center tracking-[0.4em] max-w-[160px]"
          />
          <Button onClick={confirm} disabled={confirmCode.isPending || code.length < 6}>
            {confirmCode.isPending ? "Verifying…" : "Verify email"}
          </Button>
        </>
      )}
    </div>
  );
}

const UAE_MOBILE = /^\+9715\d{8}$|^05\d{8}$/;

function PhoneVerifySection({
  initialPhone,
  verified,
}: {
  initialPhone: string | null;
  verified: boolean;
}) {
  const requestCode = useRequestPhoneCode();
  const confirmCode = useConfirmPhoneCode();
  const [phone, setPhone] = useState(initialPhone || "");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [code, setCode] = useState("");

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <IconCheck size={16} /> Mobile verified{initialPhone ? ` — ${initialPhone}` : ""}
      </div>
    );
  }

  const send = () => {
    const trimmed = phone.trim().replace(/[\s-]/g, "");
    if (!UAE_MOBILE.test(trimmed)) {
      toast.error("Enter a valid UAE mobile number, e.g. +9715XXXXXXXX or 05XXXXXXXX.");
      return;
    }
    requestCode.mutate(trimmed, {
      onSuccess: (r) => {
        setSentTo(trimmed);
        setDemo(!!r.demo);
        setCode("");
      },
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't send the code."),
    });
  };
  const confirm = () => {
    if (!sentTo) return;
    confirmCode.mutate(
      { phone: sentTo, code },
      {
        onSuccess: () => toast.success("Mobile number verified."),
        onError: (e: unknown) => toast.error((e as Error)?.message || "That code is incorrect."),
      },
    );
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <IconDeviceMobile size={16} className="text-muted-foreground shrink-0" />
        <span className="shrink-0">Mobile number</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Verify a UAE mobile number — required before your account can be approved.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+9715XXXXXXXX"
          className="max-w-[220px]"
        />
        <Button onClick={send} disabled={requestCode.isPending} variant="outline">
          {requestCode.isPending ? "Sending…" : sentTo ? "Resend code" : "Send code by SMS"}
        </Button>
      </div>
      {sentTo && (
        <>
          {demo && (
            <p className="text-[11px] text-muted-foreground">
              Demo mode — enter any 6 digits (no SMS sent yet).
            </p>
          )}
          <Input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="text-center tracking-[0.4em] max-w-[160px]"
          />
          <Button onClick={confirm} disabled={confirmCode.isPending || code.length < 6}>
            {confirmCode.isPending ? "Verifying…" : "Verify mobile"}
          </Button>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
