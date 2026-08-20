import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  IconPhoto,
  IconPlus,
  IconExternalLink,
  IconShieldCheck,
  IconTrash,
  IconUpload,
  IconStar,
  IconStarFilled,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useTailorProfile,
  useUpdateTailorProfile,
  type TailorProfile,
} from "@/lib/api/queries/tailor";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/portfolio")({ component: PortfolioPage });

// Resolve a stored path (/uploads/..) or absolute URL to a displayable src.
const srcOf = (u: string) => (u.startsWith("http") ? u : u);

function PortfolioPage() {
  const q = useTailorProfile();
  const update = useUpdateTailorProfile();
  const [bioEn, setBioEn] = useState("");
  const [bioAr, setBioAr] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [specInput, setSpecInput] = useState("");
  const [gallery, setGallery] = useState<string[]>([]);
  const [featured, setFeatured] = useState<string[]>([]);
  const [profileImg, setProfileImg] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const galleryInput = useRef<HTMLInputElement>(null);
  const profileInput = useRef<HTMLInputElement>(null);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  useEffect(() => {
    if (q.data) {
      setBioEn(q.data.bio_en || "");
      setBioAr(q.data.bio_ar || "");
      setSpecs(q.data.specializations || []);
      setGallery(q.data.portfolio_images || []);
      setFeatured(q.data.featured_images || []);
      setProfileImg(q.data.profile_image_url || "");
    }
  }, [q.data]);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;

  const save = () =>
    update.mutate(
      {
        bio_en: bioEn,
        bio_ar: bioAr,
        specializations: specs,
        portfolio_images: gallery,
        featured_images: featured,
        profile_image_url: profileImg,
      },
      {
        onSuccess: () => toast.success("Portfolio saved"),
        onError: mutationErrorToast("Couldn't save your portfolio"),
      },
    );

  const photoLimit = q.data?.portfolio_image_limit ?? 5;
  const featuredLimit = q.data?.featured_image_limit ?? 5;

  async function uploadGallery(files: FileList | null) {
    if (!files?.length) return;
    const room = photoLimit - gallery.length;
    if (room <= 0) {
      toast.error(`Your plan allows up to ${photoLimit} photos. Upgrade to add more.`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length)
      toast.message(`Only ${room} more photo(s) allowed on your plan.`);
    setUploading(true);
    try {
      const uploaded = await Promise.all(picked.map((f) => apiClient.uploadFile(f)));
      const prevGallery = gallery;
      const next = [...gallery, ...uploaded.map((u) => u.url)];
      setGallery(next);
      update.mutate(
        { portfolio_images: next },
        {
          onSuccess: () => toast.success("Images added"),
          onError: (e: unknown) => {
            setGallery(prevGallery);
            mutationErrorToast("Couldn't save the new images")(e);
          },
        },
      );
    } catch (e: unknown) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function uploadProfile(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { url } = await apiClient.uploadFile(files[0]);
      const prevProfileImg = profileImg;
      setProfileImg(url);
      update.mutate(
        { profile_image_url: url },
        {
          onSuccess: () => toast.success("Profile photo updated"),
          onError: (e: unknown) => {
            setProfileImg(prevProfileImg);
            mutationErrorToast("Couldn't update your profile photo")(e);
          },
        },
      );
    } catch (e: unknown) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(i: number) {
    const url = gallery[i];
    const prevGallery = gallery;
    const prevFeatured = featured;
    const next = gallery.filter((_, j) => j !== i);
    const nextFeatured = featured.filter((u) => u !== url);
    setGallery(next);
    setFeatured(nextFeatured);
    update.mutate(
      { portfolio_images: next, featured_images: nextFeatured },
      {
        onError: (e: unknown) => {
          setGallery(prevGallery);
          setFeatured(prevFeatured);
          mutationErrorToast("Couldn't remove that image")(e);
        },
      },
    );
  }

  // Tailors curate up to `featuredLimit` "best" photos shown in their public
  // storefront slideshow — sourced from the tailor's plan (featured_slots),
  // not a fixed number, since plans can configure this higher or lower.
  function toggleFeatured(url: string) {
    setFeatured((prev) => {
      let next: string[];
      if (prev.includes(url)) next = prev.filter((u) => u !== url);
      else if (prev.length >= featuredLimit) {
        toast.message(
          `You can feature up to ${featuredLimit} photos in your storefront slideshow.`,
        );
        return prev;
      } else next = [...prev, url];
      update.mutate(
        { featured_images: next },
        {
          onError: (e: unknown) => {
            setFeatured(prev);
            mutationErrorToast("Couldn't update featured photos")(e);
          },
        },
      );
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => profileInput.current?.click()}
            className="relative group shrink-0"
            title="Change photo"
            aria-label="Change profile photo"
          >
            {profileImg ? (
              <img src={srcOf(profileImg)} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary grid place-items-center text-xl font-semibold">
                {(p.full_name || p.business_name || "")
                  .split(" ")
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join("")}
              </div>
            )}
            <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 grid place-items-center text-white transition-opacity">
              <IconUpload size={18} />
            </span>
          </button>
          <input
            ref={profileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => uploadProfile(e.target.files)}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="kh-h3 font-serif truncate">{p.business_name}</h2>
              {p.verification_status === "verified" && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <IconShieldCheck size={14} /> Verified
                </span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              {p.full_name} · {p.city} · {p.tier} · {p.rating_avg}★ ({p.rating_count})
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={`/store/${p.id}`} target="_blank" rel="noreferrer">
              <IconExternalLink size={15} className="mr-1" /> Preview storefront
            </a>
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <StorefrontCard p={p} onSaved={() => q.refetch()} />

        <div className="space-y-6">
          <Card title="About">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Bio (English)</Label>
                <Textarea
                  rows={3}
                  maxLength={240}
                  value={bioEn}
                  onChange={(e) => setBioEn(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground text-right">
                  {bioEn.length}/240
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bio (Arabic)</Label>
                <Textarea
                  rows={3}
                  dir="rtl"
                  maxLength={240}
                  value={bioAr}
                  onChange={(e) => setBioAr(e.target.value)}
                />
                <div className="text-[11px] text-muted-foreground text-right">
                  {bioAr.length}/240
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Specializations</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {specs.map((sp, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs"
                    >
                      {sp}
                      <button
                        type="button"
                        onClick={() => setSpecs(specs.filter((_, j) => j !== i))}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      value={specInput}
                      onChange={(e) => setSpecInput(e.target.value)}
                      placeholder="Add…"
                      className="h-8 w-28"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (specInput.trim()) {
                            setSpecs([...specs, specInput.trim()]);
                            setSpecInput("");
                          }
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              <Button onClick={save} disabled={update.isPending}>
                {update.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </Card>

          <Card
            title="Portfolio gallery"
            action={
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {gallery.length} / {photoLimit}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={uploading || gallery.length >= photoLimit}
                  onClick={() => galleryInput.current?.click()}
                >
                  <IconPlus size={15} className="mr-1" /> {uploading ? "Uploading…" : "Add images"}
                </Button>
              </div>
            }
          >
            <input
              ref={galleryInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => uploadGallery(e.target.files)}
            />
            {gallery.length === 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => galleryInput.current?.click()}
                    title="Add image"
                    aria-label="Add image"
                    className="aspect-square rounded-lg bg-muted grid place-items-center text-muted-foreground hover:bg-muted/70"
                  >
                    <IconPhoto size={24} />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {gallery.map((url, i) => {
                  const isFeat = featured.includes(url);
                  return (
                    <div
                      key={i}
                      className={`relative aspect-square rounded-lg overflow-hidden group ring-2 transition-all ${isFeat ? "ring-gold" : "ring-transparent"}`}
                    >
                      <img src={srcOf(url)} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => toggleFeatured(url)}
                        title={
                          isFeat
                            ? "Featured in your storefront slideshow"
                            : "Feature in your storefront slideshow"
                        }
                        aria-label="Toggle featured"
                        className={`absolute top-1.5 left-1.5 p-1.5 rounded-md transition-colors ${isFeat ? "bg-gold text-white" : "bg-black/50 text-white opacity-0 group-hover:opacity-100"}`}
                      >
                        {isFeat ? <IconStarFilled size={14} /> : <IconStar size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        title="Remove image"
                        aria-label="Remove image"
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <IconTrash size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {gallery.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 inline-flex items-center gap-1.5">
                <IconStarFilled size={12} className="text-gold shrink-0" /> Star up to{" "}
                {featuredLimit} photos to feature them in your storefront slideshow —{" "}
                {featured.length}/{featuredLimit} selected.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Showcase your best work — these appear on your public profile and in the customer app.
              {gallery.length >= photoLimit ? (
                <>
                  {" "}
                  You've reached your {photoLimit}-photo limit —{" "}
                  <a href="/tailor/subscription" className="text-primary hover:underline">
                    upgrade for more storage
                  </a>
                  .
                </>
              ) : (
                ` Your plan includes up to ${photoLimit} photos.`
              )}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StorefrontCard({ p, onSaved }: { p: TailorProfile; onSaved: () => void }) {
  const update = useUpdateTailorProfile();
  const bannerInput = useRef<HTMLInputElement>(null);
  const [nameAr, setNameAr] = useState(p.business_name_ar || "");
  const [tagline, setTagline] = useState(p.tagline || "");
  const [taglineAr, setTaglineAr] = useState(p.tagline_ar || "");
  const [banner, setBanner] = useState(p.banner_image_url || "");
  const [gender, setGender] = useState(p.tailor_gender || "team");
  const [svc, setSvc] = useState({
    does_readymade: p.does_readymade ?? true,
    does_stitching: p.does_stitching ?? true,
    serves_men: p.serves_men ?? true,
    serves_women: p.serves_women ?? true,
    serves_kids: p.serves_kids ?? false,
  });
  const [busy, setBusy] = useState(false);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  async function uploadBanner(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { url } = await apiClient.uploadFile(files[0]);
      const prevBanner = banner;
      setBanner(url);
      update.mutate(
        { banner_image_url: url },
        {
          onSuccess: onSaved,
          onError: (e: unknown) => {
            setBanner(prevBanner);
            mutationErrorToast("Couldn't save the banner image")(e);
          },
        },
      );
    } catch (e: unknown) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    update.mutate(
      {
        business_name_ar: nameAr,
        tagline,
        tagline_ar: taglineAr,
        banner_image_url: banner,
        tailor_gender: gender,
        ...svc,
      },
      {
        onSuccess: () => {
          toast.success("Storefront saved");
          onSaved();
        },
        onError: mutationErrorToast("Couldn't save storefront"),
      },
    );

  const Toggle = ({ k, label }: { k: keyof typeof svc; label: string }) => (
    <button
      type="button"
      onClick={() => setSvc((s) => ({ ...s, [k]: !s[k] }))}
      className={`px-3 h-9 rounded-md border text-sm transition-colors ${svc[k] ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <Card
      title="Storefront"
      action={<span className="text-xs text-muted-foreground">Your public mini-site</span>}
    >
      <div className="space-y-4">
        {/* Banner */}
        <div>
          <Label className="text-xs">Banner image</Label>
          <div className="mt-1.5 relative h-40 rounded-lg overflow-hidden bg-muted">
            {banner ? (
              <img src={srcOf(banner)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground">
                <IconPhoto size={28} />
              </div>
            )}
            <input
              ref={bannerInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => uploadBanner(e.target.files)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => bannerInput.current?.click()}
              className="absolute bottom-2 right-2 bg-white/90"
            >
              <IconUpload size={14} className="mr-1" /> {busy ? "…" : "Change banner"}
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Business name (Arabic)</Label>
          <Input
            dir="rtl"
            maxLength={60}
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            placeholder="مثال: إيلا للملابس"
          />
          <div className="text-[11px] text-muted-foreground text-right">{nameAr.length}/60</div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tagline (English)</Label>
            <Input
              maxLength={80}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Bespoke Emirati elegance"
            />
            <div className="text-[11px] text-muted-foreground text-right">{tagline.length}/80</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tagline (Arabic)</Label>
            <Input
              dir="rtl"
              maxLength={80}
              value={taglineAr}
              onChange={(e) => setTaglineAr(e.target.value)}
            />
            <div className="text-[11px] text-muted-foreground text-right">
              {taglineAr.length}/80
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Services offered</Label>
          <div className="flex flex-wrap gap-2">
            <Toggle k="does_readymade" label="Readymade" />
            <Toggle k="does_stitching" label="Stitching" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Who you serve</Label>
          <div className="flex flex-wrap gap-2">
            <Toggle k="serves_men" label="Men" />
            <Toggle k="serves_women" label="Women" />
            <Toggle k="serves_kids" label="Kids" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Tailor type</Label>
          <div className="flex flex-wrap gap-2">
            {(["male", "female", "team"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`px-3 h-9 rounded-md border text-sm capitalize transition-colors ${gender === g ? "border-primary bg-primary/10 text-primary font-medium" : "border-border text-muted-foreground hover:bg-muted"}`}
              >
                {g === "team" ? "Team / Mixed" : g}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving…" : "Save storefront"}
        </Button>
      </div>
    </Card>
  );
}
