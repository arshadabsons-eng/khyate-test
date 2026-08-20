import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { onImgError } from "@/lib/utils";
import { Lightbox } from "@/components/common/ImageCarousel";
import { Money } from "@/components/common/Money";
import { labelize } from "@/components/inventory/options";
import { Stars } from "@/components/common/Stars";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { BrandLockup } from "@/components/common/Logo";
import {
  IconArrowLeft,
  IconMapPin,
  IconDeviceMobile,
  IconCheck,
  IconHanger,
  IconRosetteDiscountCheckFilled,
  IconShieldCheck,
  IconRuler,
  IconTruck,
  IconMaximize,
} from "@tabler/icons-react";

export const Route = createFileRoute("/listing/$id")({ component: ListingDetailPage });

// Field names here must match what GET /api/listings/:id actually returns.
// Several didn't: `colors`/`stock`/`stitching_cost_fils`/`verified` were read
// against real columns named `colours`/`stock_qty`/`stitch_price_fils` and an
// alias named `tailor_verified`. Each silently resolved to undefined, so the
// colour picker, stock line and verified badge never rendered — and worst, a
// custom-stitch listing's total came out as base + 0, showing a WRONG PRICE on
// a public page.
type ListingDetail = {
  id: string;
  title: string;
  title_ar?: string;
  type: string;
  category?: string | null;
  base_price_fils: number;
  stitch_price_fils?: number | null;
  description?: string;
  colours?: string[];
  image_urls?: string[];
  stock_qty?: number | null;
  tailor_id: string;
  tailor_name: string;
  city: string;
  rating_avg?: number | string;
  profile_image_url?: string | null;
  tailor_verified?: boolean;
};

function ListingDetailPage() {
  const { id } = Route.useParams();
  const q = useQuery({
    queryKey: ["listing", id],
    queryFn: ({ signal }) => apiClient.get<ListingDetail>(`/listings/${id}`, { signal }),
    staleTime: 60 * 1000,
  });

  if (q.isLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <CenteredSpinner />
      </div>
    );
  if (q.isError || !q.data)
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load listing" />
      </div>
    );

  return (
    <>
      <div className="min-h-screen bg-background pb-24 lg:pb-0">
        {/* Slim top bar — brand + back + cart, full width with bounded content */}
        <div className="sticky top-0 z-20 bg-background/90 backdrop-blur border-b">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to={`/store/${q.data.tailor_id}`}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <IconArrowLeft size={16} /> <span className="hidden sm:inline">Back to store</span>
              </Link>
              <span className="h-4 w-px bg-border hidden sm:block" />
              <Link to="/" className="hidden sm:block shrink-0">
                <BrandLockup markSize={22} />
              </Link>
            </div>
            <a
              href="/get-app"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
            >
              <IconDeviceMobile size={16} /> <span className="hidden sm:inline">Get the app</span>
            </a>
          </div>
        </div>

        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-5 flex-wrap">
            <Link to="/" className="hover:text-foreground transition-colors">
              Khyate
            </Link>
            <span>/</span>
            <Link
              to={`/store/${q.data.tailor_id}`}
              className="hover:text-foreground transition-colors truncate max-w-[180px]"
            >
              {q.data.tailor_name}
            </Link>
            <span>/</span>
            <span className="text-foreground/70 truncate max-w-[200px]">{q.data.title}</span>
          </nav>

          <ProductView listing={q.data} />

          <MoreFromTailor
            tailorId={q.data.tailor_id}
            currentId={q.data.id}
            tailorName={q.data.tailor_name}
          />
        </div>
      </div>
    </>
  );
}

type RelatedListing = {
  id: string;
  title: string;
  type: string;
  base_price_fils: number;
  stitch_price_fils?: number | null;
  image_urls?: string[];
};

/** Curated "More from this tailor" — a horizontal, snap-scrolling rail of the
 *  tailor's other pieces. Editorial (Mytheresa-style), not a price-war grid. */
function MoreFromTailor({
  tailorId,
  currentId,
  tailorName,
}: {
  tailorId: string;
  currentId: string;
  tailorName: string;
}) {
  const q = useQuery({
    queryKey: ["listing", "more", tailorId],
    queryFn: ({ signal }) =>
      apiClient.get<RelatedListing[]>("/listings", {
        params: { tailor_id: tailorId, limit: 12 },
        signal,
      }),
    staleTime: 60 * 1000,
  });

  const items = (q.data ?? []).filter((l) => l.id !== currentId).slice(0, 10);
  if (items.length === 0) return null;

  return (
    <section className="mt-16 lg:mt-24">
      <div className="flex items-end justify-between gap-3 mb-5">
        <h2 className="kh-h2 font-serif">More from {tailorName}</h2>
        <Link
          to={`/store/${tailorId}`}
          className="text-sm text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          View tailor →
        </Link>
      </div>
      <div className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:thin]">
        {items.map((l) => (
          <Link
            key={l.id}
            to="/listing/$id"
            params={{ id: l.id }}
            className="group block w-[150px] sm:w-[190px] lg:w-[210px] shrink-0 snap-start kh-elevate rounded-xl"
          >
            <div className="kh-zoom aspect-[4/5] rounded-xl overflow-hidden bg-muted mb-2.5">
              {l.image_urls?.[0] ? (
                <img
                  src={l.image_urls[0]}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={onImgError}
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-muted-foreground">
                  <IconHanger size={26} />
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
    </section>
  );
}

function ProductView({ listing: l }: { listing: ListingDetail }) {
  const images = l.image_urls?.length ? l.image_urls : [];
  const colors = l.colours?.filter(Boolean) ?? [];
  const [selectedColor, setSelectedColor] = useState<string | null>(colors[0] ?? null);
  const [tab, setTab] = useState<"desc" | "specs">("desc");
  const viewerRef = useRef<HTMLDivElement>(null);

  const price = l.base_price_fils;
  const stitchCost = l.stitch_price_fils ?? 0;
  const totalPrice = l.type === "custom_stitch" ? price + stitchCost : price;
  const rating = parseFloat(String(l.rating_avg ?? 0));

  return (
    <>
      {/* Amazon-style 3-region layout:
          mobile  → single column (gallery, details, buy box)
          lg      → gallery | (details over buy box)
          xl      → gallery | details | sticky buy box */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 items-start">
        {/* ── Gallery pane ── (bounded width so the image stays premium, not huge, on ultrawide) */}
        <div className="w-full lg:w-[46%] xl:w-[520px] 2xl:w-[600px] xl:shrink-0 lg:sticky lg:top-20">
          <ProductGallery images={images} viewerRef={viewerRef} />
        </div>

        {/* ── Right pane: details + buy box ── */}
        <div className="w-full lg:flex-1 flex flex-col xl:flex-row gap-8 xl:gap-10 items-start">
          {/* Details */}
          <div className="w-full xl:flex-1 min-w-0 space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              {l.category && (
                <span className="px-2.5 py-1 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-medium">
                  {l.category}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs">
                {labelize(l.type)}
              </span>
            </div>

            {/* Title */}
            <div>
              <h1 className="kh-h1 font-serif leading-tight">{l.title}</h1>
              {l.title_ar && (
                <p dir="rtl" className="text-lg text-gold/90 font-serif mt-1">
                  {l.title_ar}
                </p>
              )}
              <Link
                to={`/store/${l.tailor_id}`}
                className="inline-flex items-center gap-2 mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {rating > 0 && <Stars rating={rating} size={14} />}
                <span className="inline-flex items-center gap-1">
                  by <span className="font-medium text-foreground/80">{l.tailor_name}</span>
                  {l.tailor_verified && (
                    <IconRosetteDiscountCheckFilled size={14} className="text-primary" />
                  )}
                </span>
              </Link>
            </div>

            <div className="h-px bg-border" />

            {/* Description / Specs tabs */}
            <div>
              <div className="flex gap-6 mb-4">
                {(["desc", "specs"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`text-sm font-medium pb-1.5 border-b-2 transition-colors ${
                      tab === t
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "desc" ? "Description" : "Details"}
                  </button>
                ))}
              </div>

              <div className="min-h-[80px]">
                {tab === "desc" ? (
                  <p className="text-sm leading-relaxed text-foreground/80 max-w-prose">
                    {l.description ||
                      "A handcrafted piece made with care and precision by a skilled tailor."}
                  </p>
                ) : (
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm max-w-md">
                    <div>
                      <dt className="text-muted-foreground">Type</dt>
                      <dd className="font-medium">{labelize(l.type)}</dd>
                    </div>
                    {l.category && (
                      <div>
                        <dt className="text-muted-foreground">Category</dt>
                        <dd className="font-medium">{l.category}</dd>
                      </div>
                    )}
                    {l.type === "readymade" && l.stock_qty != null && (
                      <div>
                        <dt className="text-muted-foreground">In stock</dt>
                        <dd className="font-medium">{l.stock_qty} pcs</dd>
                      </div>
                    )}
                    {colors.length > 0 && (
                      <div>
                        <dt className="text-muted-foreground">Colours</dt>
                        <dd className="font-medium">{colors.length} available</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>

            {/* Colour picker */}
            {colors.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-sm text-muted-foreground">
                  Colour{" "}
                  {selectedColor && (
                    <span className="font-medium text-foreground">
                      {selectedColor.toUpperCase()}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-2.5">
                  {colors.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => setSelectedColor(hex)}
                      title={hex}
                      aria-label={`Select colour ${hex}`}
                      className="relative w-9 h-9 rounded-full transition-all duration-200 focus:outline-none"
                      style={{
                        background: hex,
                        transform: selectedColor === hex ? "scale(1.18)" : "scale(1)",
                        boxShadow:
                          selectedColor === hex
                            ? `0 0 0 3px var(--background), 0 0 0 5px ${hex}`
                            : "0 0 0 1px rgba(0,0,0,0.12)",
                      }}
                    >
                      {selectedColor === hex && (
                        <span className="absolute inset-0 flex items-center justify-center">
                          <IconCheck size={15} className="text-white drop-shadow" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tailor mini-card */}
            <Link
              to={`/store/${l.tailor_id}`}
              className="flex items-center gap-3 p-4 rounded-xl border bg-card hover:bg-muted/40 transition-colors group"
            >
              {l.profile_image_url ? (
                <img
                  src={l.profile_image_url}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                  onError={onImgError}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg">
                  {l.tailor_name?.[0] ?? "T"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-sm truncate">{l.tailor_name}</span>
                  {l.tailor_verified && (
                    <IconRosetteDiscountCheckFilled size={15} className="text-primary shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {rating > 0 && <Stars rating={rating} size={12} />}
                  <span className="flex items-center gap-0.5">
                    <IconMapPin size={11} /> {l.city}
                  </span>
                </div>
              </div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
                View store →
              </span>
            </Link>
          </div>

          {/* Buy box — sticky right rail on xl, inline below details on lg/mobile */}
          <div className="w-full xl:w-[320px] xl:shrink-0">
            <div className="xl:sticky xl:top-20">
              <BuyBox l={l} price={price} stitchCost={stitchCost} totalPrice={totalPrice} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky "get the app" bar */}
      <div className="kh-sticky-cta lg:hidden fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <div className="shrink-0">
            <div className="text-base font-bold text-primary leading-none">
              <Money fils={totalPrice} />
            </div>
          </div>
          <a
            href="/get-app"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold shadow-lg bg-primary text-primary-foreground active:scale-[0.98]"
          >
            <IconDeviceMobile size={18} /> Order in the app
          </a>
        </div>
      </div>
    </>
  );
}

/** Product buy box: price, custom-stitch breakdown, "get the app" CTA, trust signals. */
function BuyBox({
  l,
  price,
  stitchCost,
  totalPrice,
}: {
  l: ListingDetail;
  price: number;
  stitchCost: number;
  totalPrice: number;
}) {
  const isCustom = l.type === "custom_stitch";
  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6 kh-elevate space-y-4">
      {/* Price */}
      <div>
        <div className="flex items-baseline gap-1.5">
          <Money fils={totalPrice} className="text-3xl font-bold text-primary" />
        </div>
        {isCustom && stitchCost > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            <Money fils={price} /> fabric + <Money fils={stitchCost} /> stitching
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">Inclusive of VAT</p>
      </div>

      {/* Ordering happens in the Khyate mobile app (hidden on mobile — sticky bar handles it). */}
      <a
        href="/get-app"
        className="hidden lg:flex w-full items-center justify-center gap-2.5 py-3.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200"
      >
        <IconDeviceMobile size={18} /> Order in the app
      </a>

      <Link
        to={`/store/${l.tailor_id}`}
        className="hidden lg:flex w-full items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium hover:bg-muted/50 transition-colors"
      >
        Visit tailor
      </Link>

      <div className="h-px bg-border" />

      {/* Trust signals */}
      <ul className="space-y-2.5 text-sm">
        <Trust
          icon={IconShieldCheck}
          title="Protected payment"
          body="Funds release to the tailor only after you confirm delivery."
        />
        <Trust
          icon={IconRuler}
          title={isCustom ? "Made to measure" : "Ready to wear"}
          body={isCustom ? "Tailored to your saved measurements." : "Crafted and ready to ship."}
        />
        <Trust
          icon={IconTruck}
          title="Delivered across the UAE"
          body="Tracked from confirmed to delivered."
        />
      </ul>
    </div>
  );
}

function Trust({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof IconShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-2.5">
      <Icon size={18} className="text-primary shrink-0 mt-0.5" />
      <div>
        <div className="font-medium text-foreground/90 leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </li>
  );
}

/** Product gallery — vertical thumbnail rail (lg+) / horizontal (mobile) + large main image.
 *  Tapping the main image (or the maximise button) opens the shared premium lightbox. */
function ProductGallery({
  images,
  viewerRef,
}: {
  images: string[];
  viewerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div
        ref={viewerRef}
        className="aspect-[4/5] rounded-2xl bg-muted flex items-center justify-center text-muted-foreground border"
      >
        <IconHanger size={64} stroke={1} />
      </div>
    );
  }

  const current = images[Math.min(active, images.length - 1)];

  return (
    <>
      <div className="flex flex-col-reverse lg:flex-row gap-3">
        {/* Thumbnail rail */}
        {images.length > 1 && (
          <div className="flex lg:flex-col gap-2.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0">
            {images.map((src, i) => (
              <button
                key={src + i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                className={`shrink-0 w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-xl overflow-hidden border-2 transition-all ${
                  i === active
                    ? "border-primary ring-1 ring-primary/30"
                    : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                  loading="lazy"
                  onError={onImgError}
                />
              </button>
            ))}
          </div>
        )}

        {/* Main image */}
        <div ref={viewerRef} className="relative flex-1 group min-w-0">
          <button
            type="button"
            onClick={() => setLightbox(active)}
            className="block w-full aspect-[4/5] rounded-2xl overflow-hidden bg-muted/40 border cursor-zoom-in"
            aria-label="View full size"
          >
            <img
              key={current}
              src={current}
              alt=""
              draggable={false}
              className="kh-zoom-blur-in w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
              onError={onImgError}
            />
          </button>
          <span className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white bg-black/35 backdrop-blur-sm border border-white/15 opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none">
            <IconMaximize size={15} />
          </span>
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox images={images} startIndex={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
