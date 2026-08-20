import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  IconRosetteDiscountCheckFilled,
  IconMapPin,
  IconHanger,
  IconScissors,
  IconMan,
  IconWoman,
  IconMoodKid,
  IconArrowLeft,
  IconPlus,
  IconLock,
} from "@tabler/icons-react";
import { GlassCoverflow } from "@/components/common/GlassCoverflow";
import { apiClient } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { onImgError } from "@/lib/utils";
import { Stars } from "@/components/common/Stars";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { BlurImage } from "@/components/common/BlurImage";
import { Money } from "@/components/common/Money";

export const Route = createFileRoute("/store/$tailorId")({ component: StorefrontPage });

// Null-safe image src — URLs are stored fully-qualified, no rewriting needed.
const srcOf = (u?: string) => u ?? "";

type PublicTailor = {
  id: string;
  business_name: string;
  business_name_ar?: string;
  city: string;
  profile_image_url?: string;
  banner_image_url?: string;
  gallery_urls?: string[];
  featured_urls?: string[];
  specializations?: string[];
  rating_avg?: number | string;
  rating_count?: number;
  verified?: boolean;
  tagline?: string;
  tagline_ar?: string;
  bio?: string;
  bio_en?: string;
  bio_ar?: string;
  tailor_gender?: string;
  does_readymade?: boolean;
  does_stitching?: boolean;
  serves_men?: boolean;
  serves_women?: boolean;
  serves_kids?: boolean;
};
type PublicListing = {
  id: string;
  title: string;
  type: string;
  base_price_fils: number;
  stitch_price_fils?: number | null;
  image_urls?: string[];
};
type PublicReview = {
  id: string;
  rating: number;
  body?: string;
  customer_name?: string;
  created_at: string;
  tailor_reply?: string;
};
type PublicMaterial = {
  id: string;
  name: string;
  composition?: { fiber: string; pct: number }[];
  weight_gsm?: number;
  price_per_meter_fils?: number | null;
  minimum_order_meters?: number;
  images?: string[];
  colours?: { name?: string; hex: string }[];
};

function formatComposition(c?: { fiber: string; pct: number }[]): string {
  if (!Array.isArray(c) || c.length === 0) return "";
  return c
    .filter((row) => row.fiber?.trim())
    .map((row) => (row.pct != null ? `${row.pct}% ${row.fiber}` : row.fiber))
    .join(", ");
}

function StorefrontPage() {
  const { tailorId } = useParams({ from: "/store/$tailorId" });

  const tailor = useQuery({
    queryKey: ["store", "tailor", tailorId],
    queryFn: ({ signal }) => apiClient.get<PublicTailor>(`/tailors-public/${tailorId}`, { signal }),
  });
  const listings = useQuery({
    queryKey: ["store", "listings", tailorId],
    queryFn: ({ signal }) =>
      apiClient.get<PublicListing[]>("/listings", {
        params: { tailor_id: tailorId, limit: 50 },
        signal,
      }),
  });
  const reviews = useQuery({
    queryKey: ["store", "reviews", tailorId],
    queryFn: ({ signal }) =>
      apiClient.get<PublicReview[]>(`/tailors-public/${tailorId}/reviews`, { signal }),
  });
  const materials = useQuery({
    queryKey: ["store", "materials", tailorId],
    queryFn: ({ signal }) =>
      apiClient.get<PublicMaterial[]>(`/tailors-public/${tailorId}/materials`, { signal }),
  });

  // Owner detection — only a logged-in tailor fetches /tailors/me; everyone else just views.
  const isTailorViewer = auth.isAuthed() && auth.isTailor();
  const me = useQuery({
    queryKey: ["store", "owner-check"],
    queryFn: ({ signal }) =>
      apiClient.get<{ id: string; portfolio_image_limit?: number }>("/tailors/me", { signal }),
    enabled: isTailorViewer,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const isOwner = isTailorViewer && me.data?.id === tailorId;
  const photoLimit = me.data?.portfolio_image_limit ?? 5;

  const [gallery, setGallery] = useState<string[]>([]);
  useEffect(() => {
    setGallery((tailor.data?.gallery_urls as string[]) || []);
  }, [tailor.data]);

  if (tailor.isLoading) return <CenteredSpinner />;
  if (tailor.isError || !tailor.data)
    return (
      <ErrorState
        error={tailor.error}
        onRetry={() => tailor.refetch()}
        title="Storefront not found"
      />
    );

  const t = tailor.data;
  const rating = Number(t.rating_avg ?? 0);
  const gender =
    t.tailor_gender === "female"
      ? "Ladies tailor"
      : t.tailor_gender === "male"
        ? "Gents tailor"
        : "Tailor";
  const bio = t.bio || t.bio_en || "";
  const bioAr = t.bio_ar || "";
  const businessNameAr = t.business_name_ar || "";
  const taglineAr = t.tagline_ar || "";
  // Customer slideshow shows the tailor's curated "best" set when set, else the full gallery.
  const slides = t.featured_urls && t.featured_urls.length > 0 ? t.featured_urls : gallery;

  const services = [
    t.does_readymade && { label: "Readymade", icon: IconHanger },
    t.does_stitching && { label: "Stitching", icon: IconScissors },
    t.serves_men && { label: "Men", icon: IconMan },
    t.serves_women && { label: "Women", icon: IconWoman },
    t.serves_kids && { label: "Kids", icon: IconMoodKid },
  ].filter(Boolean) as { label: string; icon: typeof IconMan }[];

  return (
    <>
      <div className="min-h-screen bg-white pb-24 lg:pb-0">
        {/* Hero banner */}
        <div className="relative h-64 sm:h-80 lg:h-[22rem] bg-primary/10 overflow-hidden">
          {t.banner_image_url && (
            <img
              src={srcOf(t.banner_image_url)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              onError={onImgError}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <a
            href="/"
            className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm bg-black/30 rounded-md px-2.5 py-1.5 backdrop-blur"
          >
            <IconArrowLeft size={16} /> Khyate
          </a>
        </div>

        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
          {/* Profile header — avatar overlaps the cover; the name sits clearly below it with breathing room */}
          <div className="relative -mt-14 sm:-mt-16">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white shadow-md overflow-hidden grid place-items-center ring-4 ring-white">
              {t.profile_image_url ? (
                <img
                  src={srcOf(t.profile_image_url)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={onImgError}
                />
              ) : (
                <span className="text-3xl font-serif text-primary">
                  {t.business_name?.[0] ?? "K"}
                </span>
              )}
            </div>
            <div className="pt-5 sm:pt-6 min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-semibold flex items-center gap-2">
                <span className="truncate">{t.business_name}</span>
                {t.verified && (
                  <IconRosetteDiscountCheckFilled className="text-primary shrink-0" size={24} />
                )}
              </h1>
              {businessNameAr && (
                <p dir="rtl" className="text-lg sm:text-xl font-serif text-foreground/80 truncate">
                  {businessNameAr}
                </p>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5">
                <Stars rating={rating} size={15} />
                <span>
                  {rating.toFixed(1)} · {t.rating_count ?? 0} reviews
                </span>
              </div>
            </div>
          </div>

          {t.tagline && <p className="mt-4 text-lg font-serif italic text-gold">{t.tagline}</p>}
          {taglineAr && (
            <p dir="rtl" className="mt-1 text-lg font-serif italic text-gold">
              {taglineAr}
            </p>
          )}

          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <IconMapPin size={15} /> {t.city} · {gender}
          </div>

          {/* Service badges */}
          {services.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {services.map((s) => (
                <span
                  key={s.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-medium"
                >
                  <s.icon size={15} /> {s.label}
                </span>
              ))}
            </div>
          )}

          {bio && (
            <p className="mt-6 text-[15px] leading-relaxed text-foreground/80 max-w-prose lg:max-w-4xl">
              {bio}
            </p>
          )}
          {bioAr && (
            <p
              dir="rtl"
              className="mt-3 text-[15px] leading-relaxed text-foreground/80 max-w-prose lg:max-w-4xl font-serif"
            >
              {bioAr}
            </p>
          )}

          {(t.specializations?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {t.specializations!.map((sp, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground"
                >
                  {sp}
                </span>
              ))}
            </div>
          )}

          {/* Gallery — customer preview for everyone; photo management lives in the portfolio editor. */}
          {(gallery.length > 0 || isOwner) && (
            <section className="mt-10">
              <div className="flex items-center justify-between mb-4 gap-3">
                <h2 className="kh-h2 font-serif">Gallery</h2>
                {isOwner && (
                  <Link
                    to="/tailor/portfolio"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <span className="tabular-nums">
                      {gallery.length} / {photoLimit} photos
                    </span>
                    <span aria-hidden>·</span> Manage gallery
                  </Link>
                )}
              </div>
              {gallery.length === 0 ? (
                <Link
                  to="/tailor/portfolio"
                  className="w-full rounded-lg border border-dashed bg-muted/40 py-10 grid place-items-center text-muted-foreground hover:bg-muted"
                >
                  <span className="inline-flex items-center gap-2 text-sm">
                    <IconPlus size={16} /> Add your first photo
                  </span>
                </Link>
              ) : (
                <GlassCoverflow images={slides.map(srcOf)} />
              )}
              {isOwner && gallery.length >= photoLimit && (
                <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <IconLock size={13} /> You've reached your plan's {photoLimit}-photo limit.{" "}
                  <a href="/tailor/subscription" className="text-primary hover:underline">
                    Upgrade for more storage
                  </a>
                  .
                </p>
              )}
            </section>
          )}

          {/* Listings */}
          <section className="mt-10">
            <h2 className="kh-h2 font-serif mb-4">Collection</h2>
            {listings.isError ? (
              <ErrorState
                error={listings.error}
                onRetry={() => listings.refetch()}
                title="Couldn't load this tailor's pieces"
              />
            ) : listings.isLoading ? (
              <CenteredSpinner />
            ) : (listings.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No pieces published yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 xl:gap-6">
                {listings.data!.map((l) => (
                  <Link
                    key={l.id}
                    to="/listing/$id"
                    params={{ id: l.id }}
                    className="group block kh-elevate rounded-xl"
                  >
                    <div className="aspect-[4/5] rounded-xl overflow-hidden bg-muted mb-2.5">
                      {l.image_urls?.[0] ? (
                        <BlurImage
                          src={srcOf(l.image_urls[0])}
                          imgClassName="transition-transform duration-500 group-hover:scale-[1.05]"
                        />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground">
                          <IconHanger size={28} />
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {l.title}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {l.type.replace("_", " ")}
                    </div>
                    <div className="text-sm font-semibold text-primary mt-0.5">
                      <Money fils={l.base_price_fils} />
                      {l.stitch_price_fils ? (
                        <span className="text-xs text-muted-foreground font-normal">
                          {" "}
                          + <Money fils={l.stitch_price_fils} /> stitch
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Fabrics — the tailor's own priced/stocked offerings from the platform catalogue */}
          <section className="mt-10">
            <h2 className="kh-h2 font-serif mb-4">Fabrics</h2>
            {materials.isError ? (
              <ErrorState
                error={materials.error}
                onRetry={() => materials.refetch()}
                title="Couldn't load this tailor's fabrics"
              />
            ) : materials.isLoading ? (
              <CenteredSpinner />
            ) : (materials.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No fabrics offered yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5 xl:gap-6">
                {materials.data!.map((m) => (
                  <div key={m.id} className="rounded-xl border bg-card overflow-hidden">
                    <div className="aspect-[4/3] bg-muted">
                      {m.images?.[0] ? (
                        <BlurImage src={srcOf(m.images[0])} />
                      ) : (
                        <div className="w-full h-full grid place-items-center text-muted-foreground">
                          <IconHanger size={26} />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-medium truncate">{m.name}</div>
                      {(formatComposition(m.composition) || m.weight_gsm) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[
                            formatComposition(m.composition),
                            m.weight_gsm ? `${m.weight_gsm} gsm` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                      {m.price_per_meter_fils != null && (
                        <div className="text-sm font-semibold text-primary mt-1">
                          <Money fils={m.price_per_meter_fils} />
                          <span className="text-xs text-muted-foreground font-normal">
                            {" "}
                            / m · min {m.minimum_order_meters ?? 4} m
                          </span>
                        </div>
                      )}
                      {(m.colours?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {m.colours!.map((c, i) => (
                            <span
                              key={i}
                              title={c.name || c.hex}
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Reviews */}
          <section className="mt-10">
            <h2 className="kh-h2 font-serif mb-4">Reviews</h2>
            {reviews.isError ? (
              <ErrorState
                error={reviews.error}
                onRetry={() => reviews.refetch()}
                title="Couldn't load reviews"
              />
            ) : reviews.isLoading ? (
              <CenteredSpinner />
            ) : (reviews.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {reviews.data!.map((r) => (
                  <div key={r.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{r.customer_name ?? "Customer"}</span>
                      <Stars rating={r.rating} size={14} />
                    </div>
                    {r.body && <p className="mt-1.5 text-sm text-foreground/80">{r.body}</p>}
                    {r.tailor_reply && (
                      <div className="mt-2 pl-3 border-l-2 border-primary/30 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground/70">{t.business_name}:</span>{" "}
                        {r.tailor_reply}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* CTA */}
          <div className="mt-16 mb-10 rounded-2xl bg-primary/5 border border-primary/10 p-8 sm:p-10 text-center">
            <h3 className="kh-h3 font-serif">Order from {t.business_name}</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
              Download the Khyate app to order, book a measurement, and track every stitch.
            </p>
            <Button asChild className="mt-4">
              <a href="/get-app">Get the app</a>
            </Button>
          </div>
        </div>
      </div>
      {!isOwner && (
        <div className="kh-sticky-cta lg:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-background/85 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <a
            href="/get-app"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold shadow-lg"
          >
            Order from {t.business_name} in the app
          </a>
        </div>
      )}
    </>
  );
}
