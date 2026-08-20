// Shared option lists, label maps, and pure helpers for the inventory editors.
// Kept JSX-free so it can be imported anywhere without Fast Refresh warnings.

import type {
  Material,
  MaterialType,
  QualityTier,
  GenderTarget,
  FabricConstruction,
  Season,
  MaterialProperty,
  Category,
} from "@/lib/api/types";

export const MATERIAL_TYPES: MaterialType[] = [
  "wool",
  "cotton",
  "silk",
  "micromodal",
  "polyester",
  "linen",
  "chiffon",
  "velvet",
  "denim",
  "georgette",
  "crepe",
  "satin",
  "other",
];

export const QUALITY_TIERS: QualityTier[] = ["economy", "standard", "premium", "luxury"];

export const GENDERS: GenderTarget[] = ["men", "women", "unisex", "kids"];

export const WEAVE_TYPES: FabricConstruction[] = [
  "woven",
  "knit",
  "non_woven",
  "blended",
  "felted",
];

export const SEASONS: Season[] = ["all_season", "summer", "winter", "transitional"];

export const PROPERTY_OPTIONS: MaterialProperty[] = [
  "breathable",
  "stretchable",
  "wrinkle_resistant",
  "hypoallergenic",
  "dry_clean_only",
  "machine_washable",
  "lightweight",
  "heavyweight",
  "sheer",
  "opaque",
  "anti_pilling",
  "moisture_wicking",
];

// Common textile certifications offered as quick toggles (free text also allowed).
export const CERT_PRESETS = [
  "OEKO-TEX Standard 100",
  "GOTS",
  "GRS",
  "Woolmark",
  "European Flax",
  "FSC",
  "BCI",
  "Fair Trade",
];

// Curated Tabler icon names safe to use for category icons (all verified to exist).
export const CATEGORY_ICON_NAMES = [
  "IconShirt",
  "IconShirtSport",
  "IconJacket",
  "IconHanger",
  "IconHanger2",
  "IconTie",
  "IconShoe",
  "IconNeedleThread",
  "IconScissors",
  "IconSparkles",
  "IconStar",
  "IconCrown",
  "IconHeart",
  "IconBox",
];

// "machine_washable" → "Machine Washable", "all_season" → "All Season"
export function labelize(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Monotonic temp ids for new rows in editors (browser-only; fine to use Date.now here).
let seq = 0;
export function tempId(prefix = "tmp"): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

// Flatten a category tree into a depth-tagged list (for selects + counting).
export function flattenCategories(
  tree: Category[],
  depth = 0,
): Array<Category & { depth: number }> {
  const out: Array<Category & { depth: number }> = [];
  for (const c of tree) {
    out.push({ ...c, depth });
    if (c.children?.length) out.push(...flattenCategories(c.children, depth + 1));
  }
  return out;
}

// A blank reference material used to seed the create form.
export function emptyMaterial(): Material {
  return {
    id: "",
    sku: "",
    name: "",
    name_ar: "",
    material_type: "cotton",
    category_id: null,
    quality_tier: "standard",
    gender_target: "unisex",
    origin_country: "",
    composition: [{ fiber: "Cotton", pct: 100 }],
    weight_gsm: 0,
    weave_type: "woven",
    width_cm: 150,
    mill_brand: null,
    certifications: [],
    season: "all_season",
    care_instructions: "",
    images: [],
    is_active: true,
    colors: [],
    properties: [],
    created_at: new Date().toISOString(),
  };
}

// Count distinct colour swatches across the catalog (a reference KPI).
export function totalColorCount(items: Material[]): number {
  return items.reduce((sum, m) => sum + m.colors.length, 0);
}
