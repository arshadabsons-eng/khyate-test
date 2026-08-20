import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconBuildingStore,
  IconUsers,
  IconCircleCheck,
  IconClockHour4,
  IconAlertTriangle,
  IconPlus,
  IconTrash,
  IconShieldLock,
  IconArrowRight,
  IconSignature,
  IconRubberStamp,
  IconPhoto,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SecureUpload } from "@/components/tailor/SecureUpload";
import {
  useOnboarding,
  useUpdateTailorProfile,
  useAddPartner,
  useUpdatePartner,
  useDeletePartner,
  useSubmitForReview,
  useSetLogoColorChoice,
} from "@/lib/api/queries/tailor";
import { apiClient } from "@/lib/api/client";
import type {
  OnboardingStatus,
  TailorDocument,
  TailorPartner,
  LogoColorMode,
} from "@/lib/api/types";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/documents")({ component: OnboardingPage });

// VAT certificate is required, not optional — every tailor on Khyate must be
// VAT-registered (matches the now-mandatory VAT TRN field in Business details).
const REQUIRED_BUSINESS = ["trade_license", "ejari", "bank_iban_proof", "vat_certificate"] as const;
const OPTIONAL_BUSINESS = [] as const;
const REQUIRED_PARTNER = ["emirates_id"] as const;

// The add/edit partner forms used to validate only that a name was typed —
// unlike Business details, which validates phone/TRN with instant feedback.
// A malformed EID number or email only surfaced once an admin reviewer
// noticed during KYC review, several days later.
const EID_RE = /^784-?\d{4}-?\d{7}-?\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validatePartnerFields(f: {
  email: string;
  emirates_id_number: string;
  emirates_id_expiry: string;
  ownership_pct?: string;
}): string | null {
  if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) return "Enter a valid email address.";
  if (f.emirates_id_number.trim() && !EID_RE.test(f.emirates_id_number.trim())) {
    return "Emirates ID number should look like 784-XXXX-XXXXXXX-X.";
  }
  if (f.emirates_id_expiry && new Date(f.emirates_id_expiry) <= new Date()) {
    return "Emirates ID expiry must be a future date.";
  }
  if (f.ownership_pct?.trim()) {
    const n = Number(f.ownership_pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) return "Ownership % must be a number between 0 and 100.";
  }
  return null;
}
const OPTIONAL_PARTNER = ["passport", "residence_visa"] as const;

function OnboardingPage() {
  const ob = useOnboarding();
  if (ob.isLoading) return <CenteredSpinner />;
  if (ob.isError || !ob.data)
    return (
      <ErrorState error={ob.error} onRetry={() => ob.refetch()} title="Couldn't load onboarding" />
    );
  return <Onboarding data={ob.data} />;
}

function Onboarding({ data }: { data: OnboardingStatus }) {
  const labelOf = (t: string) => data.doc_types[t]?.label || t;
  const docFor = (type: string, partnerId?: string | null): TailorDocument | undefined =>
    data.documents.find(
      (d) => d.doc_type === type && (d.partner_id ?? null) === (partnerId ?? null),
    );
  const historyFor = (type: string, partnerId?: string | null): TailorDocument[] =>
    data.document_history.filter(
      (d) => d.doc_type === type && (d.partner_id ?? null) === (partnerId ?? null),
    );

  // Completeness (uploaded — admin still approves each). A rejected doc doesn't
  // count as present — it needs a fresh upload before the tailor can resubmit —
  // and a partner verified under the old two-file Emirates ID scheme (front +
  // back) still counts as covered, matching the backend's isComplete() and
  // submit-for-review gate.
  const present = (t: string, partnerId?: string) => {
    const d = docFor(t, partnerId);
    return !!d && d.status !== "rejected";
  };
  const missing: string[] = [];
  for (const t of REQUIRED_BUSINESS) if (!present(t)) missing.push(labelOf(t));
  if (data.partners.length === 0) missing.push("at least one partner");
  for (const p of data.partners) {
    const hasEid =
      present("emirates_id", p.id) ||
      (present("emirates_id_front", p.id) && present("emirates_id_back", p.id));
    if (!hasEid) missing.push(`${p.full_name}: ${labelOf("emirates_id")}`);
  }
  // Server-enforced (POST /submit-for-review 400s below this count) but was
  // never checked here, so the Submit button looked ready right up until the
  // tailor got rejected by the request itself with no earlier warning.
  if (data.min_portfolio_images > 0 && data.portfolio_image_count < data.min_portfolio_images) {
    // gallery_urls (the backend column this counts) is managed on the
    // separate Portfolio page, not here — point the tailor there directly.
    missing.push(
      `${data.min_portfolio_images - data.portfolio_image_count} more portfolio photo(s) — add them on the Portfolio page`,
    );
  }
  const hasRejected = data.documents.some((d) => d.status === "rejected");
  const isRejectedProfile = data.profile_status === "rejected";
  const allUploaded = missing.length === 0;
  const isActive = data.profile_status === "active";

  return (
    <div className="w-full space-y-6">
      <header className="kh-section">
        <h1 className="kh-h1 font-serif">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your verification documents live here. A few documents let us verify your business so you
          can take orders — your files are encrypted and only seen by our verification team.
        </p>
      </header>

      {/* Status banner */}
      {isActive ? (
        <Banner
          tone="ok"
          icon={IconCircleCheck}
          title="You're verified"
          body="Your tailor is approved and live."
        />
      ) : isRejectedProfile ? (
        // Whole-application reject (POST /verification/:id/reject) is distinct
        // from a per-document reject below — the backend has always recorded
        // and returned a reason for this, but the page never showed it, so a
        // tailor rejected outright saw the same generic "Let's get you
        // verified" banner as someone who'd never even started.
        <Banner
          tone="warn"
          icon={IconAlertTriangle}
          title="Your application was rejected"
          body={data.rejection_reason || "Contact support for details, then resubmit below."}
        />
      ) : hasRejected ? (
        <Banner
          tone="warn"
          icon={IconAlertTriangle}
          title="Some documents need attention"
          body="Re-upload the documents marked below, then resubmit."
        />
      ) : allUploaded && data.profile_status === "pending" ? (
        <Banner
          tone="info"
          icon={IconClockHour4}
          title="Under review"
          body="Thanks! Our team is reviewing your documents — we'll notify you once you're approved."
        />
      ) : allUploaded ? (
        // Everything's uploaded but the tailor hasn't pressed Submit yet — this
        // used to show the same "Under review" message as the line above, which
        // directly contradicted the Submit card still asking them to submit.
        // Some tailors never noticed the mismatch and never actually submitted.
        <Banner
          tone="info"
          icon={IconShieldLock}
          title="Ready to submit"
          body="Everything's uploaded — submit for review below to complete verification."
        />
      ) : (
        <Banner
          tone="info"
          icon={IconShieldLock}
          title="Let's get you verified"
          body="Complete the steps below, then submit for review."
        />
      )}

      <BusinessInfoCard data={data} />

      <Card title="2 · Business documents">
        <p className="text-sm text-muted-foreground mb-4">Documents about the business itself.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REQUIRED_BUSINESS.map((t) => (
            <SecureUpload
              key={t}
              docType={t}
              label={labelOf(t)}
              required
              doc={docFor(t)}
              requiresExpiry={data.doc_types[t]?.requires_expiry}
              history={historyFor(t)}
            />
          ))}
          {OPTIONAL_BUSINESS.map((t) => (
            <SecureUpload key={t} docType={t} label={labelOf(t)} doc={docFor(t)} />
          ))}
        </div>
      </Card>

      <PartnersCard data={data} docFor={docFor} labelOf={labelOf} historyFor={historyFor} />

      <SubmitCard
        canSubmit={allUploaded && !isActive}
        missing={missing}
        isActive={isActive}
        needsEmailVerify={data.email_verification_required && !data.email_verified}
        needsPhoneVerify={data.phone_verification_required && !data.phone_verified}
      />

      {/* Not a verification document — plain business assets (signature/stamp)
          shown on customer invoices. Was previously nested inside the encrypted-
          KYC "Business documents" card, contradicting that card's own privacy
          copy ("only seen by our verification team") for half its contents, and
          it isn't part of the completeness gate above, so it doesn't belong in
          the numbered verification steps at all. */}
      <Card title="Invoice branding">
        <p className="text-xs text-muted-foreground mb-4">
          Your invoice logo, authorised signature, company stamp, and a standing note appear on
          every invoice you issue to customers. Not part of verification — these never get reviewed.
        </p>
        <InvoiceBrandingCard data={data} />
      </Card>
    </div>
  );
}

function Banner({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "ok" | "warn" | "info";
  icon: typeof IconCircleCheck;
  title: string;
  body: string;
}) {
  const cls =
    tone === "ok"
      ? "border-green-200 bg-green-50 text-green-800"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-primary/20 bg-primary/5 text-foreground";
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${cls}`}>
      <Icon size={20} className="shrink-0 mt-0.5" />
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-sm opacity-90">{body}</div>
      </div>
    </div>
  );
}

function BusinessInfoCard({ data }: { data: OnboardingStatus }) {
  const update = useUpdateTailorProfile();
  const qc = useQueryClient();
  const [f, setF] = useState({
    business_name: data.business_name || "",
    business_name_ar: data.business_name_ar || "",
    address: data.address || "",
    city: data.city || "",
    phone: data.phone || "",
    trn: data.trn || "",
  });
  useEffect(() => {
    setF({
      business_name: data.business_name || "",
      business_name_ar: data.business_name_ar || "",
      address: data.address || "",
      city: data.city || "",
      phone: data.phone || "",
      trn: data.trn || "",
    });
  }, [data.business_name, data.business_name_ar, data.address, data.city, data.phone, data.trn]);

  const field = (
    key: keyof typeof f,
    label: string,
    placeholder = "",
    dir?: "rtl",
    required?: boolean,
  ) => (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        value={f[key]}
        dir={dir}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  // Real server-independent validation so obviously-malformed data never even
  // reaches the save call — the backend re-validates the same rules itself
  // (never trust client-side checks alone), but this gives instant feedback.
  const UAE_PHONE = /^\+9715\d{8}$|^05\d{8}$/;
  const UAE_TRN = /^\d{15}$/;
  function validate(): string | null {
    if (!f.business_name.trim()) return "Business name is required.";
    if (!f.address.trim()) return "Business address is required.";
    if (!f.city.trim()) return "Emirate / City is required.";
    if (f.phone.trim() && !UAE_PHONE.test(f.phone.trim().replace(/[\s-]/g, ""))) {
      return "Enter a valid UAE phone number, e.g. +9715XXXXXXXX or 05XXXXXXXX.";
    }
    if (!f.trn.trim())
      return "VAT TRN is required — every tailor must be VAT-registered on Khyate.";
    if (!UAE_TRN.test(f.trn.trim())) return "VAT TRN must be exactly 15 digits.";
    return null;
  }

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const save = () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    update.mutate(f, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["tailor", "onboarding"] });
        toast.success("Saved");
      },
      onError: mutationErrorToast("Couldn't save business details"),
    });
  };

  return (
    <Card
      title="1 · Business details"
      action={<IconBuildingStore size={18} className="text-muted-foreground" />}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field("business_name", "Business name (English)", "Al Jazeera Tailors", undefined, true)}
        {field("business_name_ar", "Business name (Arabic)", "خياطو الجزيرة", "rtl")}
        {field("address", "Business address", "Shop 12, Al Quoz, Dubai", undefined, true)}
        {field("city", "Emirate / City", "Dubai", undefined, true)}
        {field("phone", "Business phone", "+9715XXXXXXXX")}
        {field("trn", "VAT TRN", "100XXXXXXXXXXXX", undefined, true)}
      </div>
      <Button className="mt-4" disabled={update.isPending} onClick={save}>
        {update.isPending ? "Saving…" : "Save details"}
      </Button>
    </Card>
  );
}

// Authorized signature, company stamp, and a standing invoice note — plain
// business assets (not KYC identity documents) that render on every invoice
// this tailor issues. Uses the general upload endpoint, same as the logo/
// gallery images, not the encrypted secure-docs pipeline.
function InvoiceBrandingCard({ data }: { data: OnboardingStatus }) {
  const update = useUpdateTailorProfile();
  const qc = useQueryClient();
  const [note, setNote] = useState(data.invoice_note || "");
  const [uploading, setUploading] = useState<"signature" | "stamp" | "logo" | null>(null);
  const sigInput = useRef<HTMLInputElement>(null);
  const stampInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  useEffect(() => setNote(data.invoice_note || ""), [data.invoice_note]);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  async function uploadAsset(
    file: File,
    field: "signature_url" | "stamp_url" | "logo_url",
    kind: "signature" | "stamp" | "logo",
  ) {
    setUploading(kind);
    try {
      const { url } = await apiClient.uploadFile(file);
      await update.mutateAsync({ [field]: url } as Record<string, unknown>);
      qc.invalidateQueries({ queryKey: ["tailor", "onboarding"] });
      toast.success(
        kind === "signature" ? "Signature saved" : kind === "stamp" ? "Stamp saved" : "Logo saved",
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Upload failed");
    } finally {
      setUploading(null);
    }
  }

  function saveNote() {
    update.mutate({ invoice_note: note.trim() } as Record<string, unknown>, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["tailor", "onboarding"] });
        toast.success("Invoice note saved");
      },
      onError: mutationErrorToast("Couldn't save invoice note"),
    });
  }

  const AssetSlot = ({
    label,
    helper,
    icon: Icon,
    url,
    kind,
    inputRef,
    field,
    logoColorMode,
    logoColor1,
    logoColor2,
  }: {
    label: string;
    helper?: string;
    icon: typeof IconSignature;
    url: string | null | undefined;
    kind: "signature" | "stamp" | "logo";
    inputRef: React.RefObject<HTMLInputElement | null>;
    field: "signature_url" | "stamp_url" | "logo_url";
    // Logo-only: a background color/gradient derived from the logo image itself
    // (backend/src/lib/logo-color.js), so the square reads as a brand mark
    // instead of a generic gray placeholder. Signature/stamp never pass these —
    // plain gray stays correct for those, they're not brand marks.
    logoColorMode?: LogoColorMode;
    logoColor1?: string | null;
    logoColor2?: string | null;
  }) => {
    const logoBgStyle: React.CSSProperties | undefined =
      kind === "logo" && logoColorMode === "single" && logoColor1
        ? { backgroundColor: logoColor1 }
        : kind === "logo" &&
            (logoColorMode === "auto_two" || logoColorMode === "manual_two") &&
            logoColor1 &&
            logoColor2
          ? { background: `linear-gradient(135deg, ${logoColor1}, ${logoColor2})` }
          : undefined;
    return (
      <div className="rounded-xl border p-4 flex items-center gap-3">
        <div
          className="w-16 h-16 rounded-md border bg-muted/40 grid place-items-center overflow-hidden shrink-0"
          style={logoBgStyle}
        >
          {url ? (
            <img src={url} alt={label} className="w-full h-full object-contain" />
          ) : (
            <Icon size={22} className="text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">
            {url ? "Uploaded" : "Not uploaded yet"}
          </div>
          {helper && <div className="text-xs text-muted-foreground mt-0.5">{helper}</div>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAsset(file, field, kind);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading === kind}
          onClick={() => inputRef.current?.click()}
        >
          {uploading === kind ? "Uploading…" : url ? "Replace" : "Upload"}
        </Button>
      </div>
    );
  };

  // "More than 5 distinct colours" signal from the backend: logo_color_mode is
  // still null/absent (the algorithm deliberately didn't guess) but candidates
  // were surfaced — awaiting the tailor's manual 2-colour pick.
  const needsLogoColorChoice =
    !data.logo_color_mode && (data.logo_color_candidates?.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-2">
          <AssetSlot
            label="Invoice logo"
            helper="Shown on every invoice you issue — use a proper business logo, not a personal photo. Square or landscape works best."
            icon={IconPhoto}
            url={data.logo_url}
            kind="logo"
            inputRef={logoInput}
            field="logo_url"
            logoColorMode={data.logo_color_mode}
            logoColor1={data.logo_color_1}
            logoColor2={data.logo_color_2}
          />
          {needsLogoColorChoice && (
            <LogoColorChoicePrompt candidates={data.logo_color_candidates || []} />
          )}
        </div>
        <AssetSlot
          label="Authorized signature"
          icon={IconSignature}
          url={data.signature_url}
          kind="signature"
          inputRef={sigInput}
          field="signature_url"
        />
        <AssetSlot
          label="Company stamp"
          icon={IconRubberStamp}
          url={data.stamp_url}
          kind="stamp"
          inputRef={stampInput}
          field="stamp_url"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Standing invoice note (optional)</Label>
        <Textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Alterations within 14 days of delivery are free of charge. Thank you for your order!"
        />
        <Button size="sm" variant="outline" onClick={saveNote} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </div>
  );
}

// Shown right below the logo slot only when the backend couldn't confidently
// auto-pick a 2-colour accent for the logo (more than 5 distinct colours
// detected) — up to 8 candidate swatches, tailor picks exactly 2. First click
// = colour 1, second click = colour 2, a third click resets the pick to just
// that newest swatch. Compact and inline on purpose — this is a small accent
// decision, not a big flow.
function LogoColorChoicePrompt({ candidates }: { candidates: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const setChoice = useSetLogoColorChoice();

  function toggle(hex: string) {
    setSelected((prev) => {
      if (prev.includes(hex)) return prev;
      if (prev.length >= 2) return [hex];
      return [...prev, hex];
    });
  }

  function apply() {
    if (selected.length !== 2) return;
    setChoice.mutate(
      { color1: selected[0], color2: selected[1] },
      {
        onSuccess: () => {
          toast.success("Logo accent colours saved");
          setSelected([]);
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't save"),
      },
    );
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2 bg-muted/20">
      <p className="text-xs text-muted-foreground">
        This logo has a lot of colours — pick 2 to use as its accent.
      </p>
      <div className="flex flex-wrap gap-2">
        {candidates.slice(0, 8).map((hex) => {
          const order = selected.indexOf(hex);
          return (
            <button
              key={hex}
              type="button"
              onClick={() => toggle(hex)}
              title={hex}
              className={`relative w-7 h-7 rounded-full border-2 ${order >= 0 ? "border-primary" : "border-transparent"}`}
              style={{ backgroundColor: hex }}
            >
              {order >= 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] leading-none grid place-items-center">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={selected.length !== 2 || setChoice.isPending}
        onClick={apply}
      >
        {setChoice.isPending ? "Saving…" : "Use these colours"}
      </Button>
    </div>
  );
}

function PartnersCard({
  data,
  docFor,
  labelOf,
  historyFor,
}: {
  data: OnboardingStatus;
  docFor: (t: string, p?: string | null) => TailorDocument | undefined;
  labelOf: (t: string) => string;
  historyFor: (t: string, p?: string | null) => TailorDocument[];
}) {
  const add = useAddPartner();
  const del = useDeletePartner();
  const [open, setOpen] = useState(data.partners.length === 0);
  const blank = {
    full_name: "",
    email: "",
    emirates_id_number: "",
    nationality: "",
    emirates_id_expiry: "",
    ownership_pct: "",
  };
  const [form, setForm] = useState(blank);
  // Step 2 of the add-partner wizard: once a partner is saved, this same card
  // morphs to show their Emirates ID upload inline instead of closing and
  // pointing the tailor at a different card further down the page — person and
  // document capture now happen in one place, one flow.
  const [wizardPartner, setWizardPartner] = useState<TailorPartner | null>(null);
  // Role is never asked for — it's implicit: the first person added on this
  // form is the owner, everyone added after via "Add partner" is a partner.
  const isFirstEntry = data.partners.length === 0;
  // The wizard partner is already saved (and already in data.partners) — filter
  // it out of the plain list below so it isn't shown twice while step 2 is open.
  const listedPartners = data.partners.filter((p) => p.id !== wizardPartner?.id);
  const wizardDoc = wizardPartner ? docFor("emirates_id", wizardPartner.id) : undefined;

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const submit = () => {
    if (!form.full_name.trim()) {
      toast.error("Enter the owner/partner's name");
      return;
    }
    const err = validatePartnerFields(form);
    if (err) {
      toast.error(err);
      return;
    }
    add.mutate(
      {
        full_name: form.full_name.trim(),
        role: isFirstEntry ? "owner" : "partner",
        email: form.email.trim() || undefined,
        emirates_id_number: form.emirates_id_number.trim() || undefined,
        nationality: form.nationality.trim() || undefined,
        emirates_id_expiry: form.emirates_id_expiry || undefined,
        is_primary: isFirstEntry,
        ownership_pct: form.ownership_pct.trim() ? Number(form.ownership_pct) : undefined,
      },
      {
        onSuccess: (newPartner) => {
          setForm(blank);
          setOpen(false);
          setWizardPartner(newPartner);
        },
        onError: mutationErrorToast("Couldn't add partner"),
      },
    );
  };

  return (
    <Card
      title="3 · Owners & partners"
      action={<IconUsers size={18} className="text-muted-foreground" />}
    >
      <p className="text-sm text-muted-foreground mb-4">
        List the owner and every partner of the business (per UAE law). Each provides their email,
        Emirates ID number, nationality, expiry date and a copy of their Emirates ID.
      </p>

      <div className="space-y-4">
        {(() => {
          // "Partner N" numbers the non-owner partners only, in display order —
          // was the raw array index before, so the first partner (right after
          // the owner) read as "Partner 0", and it drifted from actual position
          // whenever an owner appeared anywhere but first in the list.
          let partnerNumber = 0;
          return listedPartners.map((p) => {
            const isOwnerRow = p.is_primary || p.role === "owner";
            if (!isOwnerRow) partnerNumber += 1;
            return (
              <PartnerRow
                key={p.id}
                partner={p}
                index={partnerNumber}
                docFor={docFor}
                labelOf={labelOf}
                historyFor={historyFor}
                onDelete={() =>
                  // Deleting a partner permanently purges their Emirates ID —
                  // a failure here (403, FK conflict, network) previously
                  // resolved silently, so the row stayed on screen with no
                  // message and the tailor had no way to tell whether the
                  // delete had actually happened.
                  del.mutate(p.id, {
                    onSuccess: () => toast.success("Partner removed"),
                    onError: (e: unknown) =>
                      toast.error((e as Error)?.message || "Couldn't remove this partner"),
                  })
                }
                deleting={del.isPending}
              />
            );
          });
        })()}
      </div>

      {wizardPartner ? (
        <div className="mt-4 rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary-soft px-2 py-0.5 rounded-full">
              Step 2 of 2
            </span>
            <p className="text-sm font-medium">Upload {wizardPartner.full_name}'s Emirates ID</p>
          </div>
          <SecureUpload
            docType="emirates_id"
            label="Emirates ID"
            required
            partnerId={wizardPartner.id}
            doc={wizardDoc}
            expiryDate={wizardPartner.emirates_id_expiry}
            history={historyFor("emirates_id", wizardPartner.id)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setWizardPartner(null)} disabled={!wizardDoc}>
              Done
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setWizardPartner(null)}>
              I'll upload this later
            </Button>
          </div>
        </div>
      ) : open ? (
        <div className="mt-4 rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Step 1 of 2
            </span>
            <p className="text-xs text-muted-foreground">
              Their Emirates ID upload comes right after, on this same card.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emirates ID number</Label>
              <Input
                value={form.emirates_id_number}
                onChange={(e) => setForm({ ...form, emirates_id_number: e.target.value })}
                placeholder="784-XXXX-XXXXXXX-X"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Emirates ID expiry</Label>
              <Input
                type="date"
                value={form.emirates_id_expiry}
                onChange={(e) => setForm({ ...form, emirates_id_expiry: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ownership % (optional)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.ownership_pct}
                onChange={(e) => setForm({ ...form, ownership_pct: e.target.value })}
                placeholder="e.g. 50"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submit} disabled={add.isPending}>
              {add.isPending ? "Adding…" : isFirstEntry ? "Add owner" : "Add partner"}
            </Button>
            {data.partners.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
          <IconPlus size={15} className="mr-1.5" /> Add another partner
        </Button>
      )}
    </Card>
  );
}

function PartnerRow({
  partner,
  index,
  docFor,
  labelOf,
  historyFor,
  onDelete,
  deleting,
}: {
  partner: TailorPartner;
  index: number;
  docFor: (t: string, p?: string | null) => TailorDocument | undefined;
  labelOf: (t: string) => string;
  historyFor: (t: string, p?: string | null) => TailorDocument[];
  onDelete: () => void;
  deleting: boolean;
}) {
  const upd = useUpdatePartner();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [f, setF] = useState({
    full_name: partner.full_name || "",
    role: partner.role || "partner",
    email: partner.email || "",
    nationality: partner.nationality || "",
    emirates_id_expiry: (partner.emirates_id_expiry || "").slice(0, 10),
    emirates_id_number: "",
    ownership_pct: partner.ownership_pct != null ? String(partner.ownership_pct) : "",
  });
  useEffect(() => {
    setF({
      full_name: partner.full_name || "",
      role: partner.role || "partner",
      email: partner.email || "",
      nationality: partner.nationality || "",
      emirates_id_expiry: (partner.emirates_id_expiry || "").slice(0, 10),
      emirates_id_number: "",
      ownership_pct: partner.ownership_pct != null ? String(partner.ownership_pct) : "",
    });
  }, [partner]);

  const title = partner.is_primary || partner.role === "owner" ? "Owner" : `Partner ${index}`;
  const save = () => {
    const err = validatePartnerFields(f);
    if (err) {
      toast.error(err);
      return;
    }
    upd.mutate(
      {
        id: partner.id,
        full_name: f.full_name.trim() || undefined,
        role: f.role,
        email: f.email.trim() || undefined,
        nationality: f.nationality.trim() || undefined,
        emirates_id_expiry: f.emirates_id_expiry || undefined,
        emirates_id_number: f.emirates_id_number.trim() || undefined,
        ownership_pct: f.ownership_pct.trim() ? Number(f.ownership_pct) : undefined,
      },
      {
        onSuccess: () => toast.success("Saved"),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't save"),
      },
    );
  };

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          disabled={deleting}
          className="p-1.5 rounded hover:bg-muted text-destructive"
          title="Remove"
        >
          <IconTrash size={15} />
        </button>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Remove ${title}?`}
          description="This permanently deletes this partner and purges their uploaded Emirates ID. This can't be undone."
          confirmLabel="Remove"
          destructive
          onConfirm={onDelete}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <div className="flex gap-2">
            {(["owner", "partner"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setF({ ...f, role: r })}
                className={`px-4 py-1.5 rounded-full text-sm capitalize ${f.role === r ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={f.email}
            onChange={(e) => setF({ ...f, email: e.target.value })}
            placeholder="name@example.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nationality</Label>
          <Input
            value={f.nationality}
            onChange={(e) => setF({ ...f, nationality: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Emirates ID number</Label>
          <Input
            value={f.emirates_id_number}
            onChange={(e) => setF({ ...f, emirates_id_number: e.target.value })}
            placeholder="Leave blank to keep current"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Emirates ID expiry</Label>
          <Input
            type="date"
            value={f.emirates_id_expiry}
            onChange={(e) => setF({ ...f, emirates_id_expiry: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ownership % (optional)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={f.ownership_pct}
            onChange={(e) => setF({ ...f, ownership_pct: e.target.value })}
            placeholder="e.g. 50"
          />
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={save} disabled={upd.isPending}>
        {upd.isPending ? "Saving…" : "Save details"}
      </Button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {REQUIRED_PARTNER.map((t) => (
          <SecureUpload
            key={t}
            docType={t}
            label={labelOf(t)}
            required
            partnerId={partner.id}
            doc={docFor(t, partner.id)}
            expiryDate={t === "emirates_id" ? f.emirates_id_expiry : undefined}
            history={historyFor(t, partner.id)}
          />
        ))}
        {OPTIONAL_PARTNER.map((t) => (
          <SecureUpload
            key={t}
            docType={t}
            label={labelOf(t)}
            partnerId={partner.id}
            doc={docFor(t, partner.id)}
            requiresExpiry={true}
            history={historyFor(t, partner.id)}
          />
        ))}
      </div>
    </div>
  );
}

function SubmitCard({
  canSubmit,
  missing,
  isActive,
  needsEmailVerify,
  needsPhoneVerify,
}: {
  canSubmit: boolean;
  missing: string[];
  isActive: boolean;
  needsEmailVerify: boolean;
  needsPhoneVerify: boolean;
}) {
  const submit = useSubmitForReview();
  if (isActive) return null;
  // Account verification doesn't block SUBMITTING (the review team can start
  // on the documents), but it does block final APPROVAL (lib/kyc.js
  // isComplete) — say so here instead of letting it surface as a mysteriously
  // stalled review.
  const verifyItems = [
    needsEmailVerify ? "verify your email" : null,
    needsPhoneVerify ? "verify your mobile number" : null,
  ].filter(Boolean);
  return (
    <Card title="4 · Submit for review">
      {missing.length > 0 ? (
        <div className="text-sm text-muted-foreground">
          <p className="mb-2">Still needed before you can submit:</p>
          <ul className="list-disc pl-5 space-y-0.5">
            {missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Everything's uploaded. Submit and our team will review your documents.
        </p>
      )}
      {verifyItems.length > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          Also required before final approval: {verifyItems.join(" and ")} — both live in{" "}
          <Link to="/tailor/settings" className="underline font-medium">
            Settings → Account verification
          </Link>
          .
        </p>
      )}
      <Button
        className="mt-4"
        disabled={!canSubmit || submit.isPending}
        onClick={() =>
          submit.mutate(undefined, {
            onSuccess: () => toast.success("Submitted for review"),
            onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't submit"),
          })
        }
      >
        {submit.isPending ? (
          "Submitting…"
        ) : (
          <>
            Submit for review <IconArrowRight size={16} className="ml-1.5" />
          </>
        )}
      </Button>
    </Card>
  );
}
