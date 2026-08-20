// Shared entity types for the Khyate admin API.
// Monetary values are integer fils. Dates are ISO strings.

export type UUID = string;
export type Fils = number;
export type ISODate = string;

export type AdminRole = "super_admin" | "operations_admin" | "support_agent" | "platform_owner";

// Read-only owner/investor dashboard payload (GET /admin/owner-metrics).
export type OwnerMetrics = {
  gmv_fils: { total: Fils; mtd: Fils; today: Fils };
  revenue_fils: { total: Fils; mtd: Fils; today: Fils };
  orders: { total: number; mtd: number; today: number };
  customer_count: number;
  tailor_count_active: number;
  tailor_count_total: number;
  trend: Array<{ week: string; gmv_fils: Fils; revenue_fils: Fils }>;
};

export type AdminProfile = {
  id: UUID;
  full_name: string;
  email: string;
  role: AdminRole;
  avatar_url: string | null;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
};

// ── Overview ────────────────────────────────────────────────────────────────

export type OverviewKPIs = {
  tailors: {
    active: number;
    inactive: number;
    pending_verification: number;
    delta_vs_yesterday: number;
  };
  customers: { total: number; new_today: number; delta_vs_yesterday: number };
  orders: {
    today_count: number;
    today_gmv_fils: Fils;
    today_revenue_fils: Fils;
    delta_gmv_vs_yesterday: number;
    delta_revenue_vs_yesterday: number;
  };
  disputes: {
    open_count: number;
    escalated_count: number;
    breached_count: number;
    delta_vs_yesterday: number;
  };
  pending_verifications: number;
  pending_listing_reviews: number;
};

export type RevenuePoint = {
  date: ISODate;
  gmv_fils: Fils;
  commission_fils: Fils;
  readymade_fils: Fils;
  custom_stitch_fils: Fils;
  material_fils: Fils;
  forecast?: boolean;
};

export type TopTailor = {
  tailor_id: UUID;
  name: string;
  avatar_url: string | null;
  city: string;
  gmv_fils: Fils;
  order_count: number;
  rating_avg: number;
  tier: TailorTier;
};

export type OrderTypeBreakdown = {
  readymade: { count: number; fils: Fils };
  custom_stitch: { count: number; fils: Fils };
  alteration: { count: number; fils: Fils };
  material: { count: number; fils: Fils };
};

export type ActivityEvent = {
  id: UUID;
  type: "tailor_registered" | "order_placed" | "dispute_opened" | "dispute_resolved";
  actor_name: string;
  description: string;
  created_at: ISODate;
};

export type ForecastPoint = {
  date: ISODate;
  projected_gmv_fils: Fils;
  projected_revenue_fils: Fils;
  confidence: "high" | "medium" | "low";
};

// ── Tailors ─────────────────────────────────────────────────────────────────

export type TailorTier = "Basic" | "Professional" | "Premium";
export type VerificationStatus = "pending" | "under_review" | "verified" | "rejected" | "suspended";
export type AccountStatus = "active" | "inactive" | "blocked" | "suspended";

export type TailorRow = {
  id: UUID;
  full_name: string;
  business_name: string;
  avatar_url: string | null;
  phone: string;
  city: string;
  tier: TailorTier;
  total_orders: number;
  gmv_fils: Fils;
  rating_avg: number;
  rating_count: number;
  verification_status: VerificationStatus;
  status: AccountStatus;
  joined_at: ISODate;
};

export type TailorListResponse = Paginated<TailorRow> & {
  kpi: { active: number; inactive: number; pending_verification: number; blocked: number };
};

// Home-visit fee outlier review — there's no automatic cap on what a tailor charges
// for a home visit, so unusually high fees (> outlier_threshold_fils) are surfaced
// here for a human to review, rather than being auto-blocked.
export type FeeOutlierRow = {
  id: UUID;
  business_name: string;
  city: string;
  home_visit_fee_fils: Fils;
  email: string;
  phone: string;
  ratio_to_median: number | null;
  is_outlier: boolean;
};

export type FeeOutlierResponse = {
  median_home_visit_fee_fils: Fils;
  outlier_threshold_fils: Fils;
  data: FeeOutlierRow[];
};

export type TailorDetail = {
  profile: TailorRow & {
    email: string;
    bio_en: string | null;
    bio_ar: string | null;
    specializations: string[];
    portfolio_images: string[];
    email_verified: boolean;
    phone_verified: boolean;
    // Helpdesk-requested deletion, pending a super_admin's execution (or
    // cancellation) — see tailors.js POST /:id/request-deletion.
    deletion_requested_at: ISODate | null;
    deletion_request_reason: string | null;
    deletion_requested_by_name: string | null;
  };
  subscription: {
    tier_id: UUID;
    tier: TailorTier;
    billing_cycle: "monthly" | "annual";
    current_period_end: ISODate;
  } | null;
  balance: {
    available_fils: Fils;
    pending_fils: Fils;
    last_payout_at: ISODate | null;
  };
  current_commission_rate_pct: number;
  listing_counts: { active: number; draft: number; inactive: number; rejected: number };
  order_counts: { in_progress: number; completed: number; cancelled: number };
  review_summary: {
    avg: number;
    count: number;
    distribution: [number, number, number, number, number];
  };
};

export type VerificationDocument = {
  id: UUID;
  document_type: string;
  file_url: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason?: string;
  reviewed_by?: { id: UUID; name: string };
  reviewed_at?: ISODate;
  uploaded_at: ISODate;
  // Partner/owner association — null for business-level documents.
  partner_id?: UUID | null;
  partner_name?: string | null;
  partner_role?: string | null;
  partner_is_primary?: boolean | null;
};

export type VerificationQueueItem = {
  tailor_id: UUID;
  full_name: string;
  business_name: string;
  avatar_url: string | null;
  city: string;
  submitted_at: ISODate;
  days_in_queue: number;
  document_count: number;
  assigned_to: { id: UUID; name: string } | null;
  has_red_flags: boolean;
  needs_reapproval?: boolean; // active tailor with a replaced (pending) document
};

// ── Orders ──────────────────────────────────────────────────────────────────

// "material" retained only so legacy listings/orders still render; new listings
// are readymade | custom_stitch | alteration.
export type OrderType = "readymade" | "custom_stitch" | "alteration" | "material";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "shipped"
  | "delivered"
  | "completed"
  | "cancelled"
  | "disputed"
  | "refunded";
export type PaymentStatus =
  | "unpaid"
  | "deposit_paid"
  | "fully_paid"
  | "refunded"
  | "partially_refunded";

export type OrderRow = {
  id: UUID;
  order_number: string;
  customer_name: string;
  customer_id: UUID;
  tailor_name: string;
  tailor_id: UUID;
  order_type: OrderType;
  total_fils: Fils;
  commission_fils: Fils | null; // null when caller is not super_admin/operations_admin
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: ISODate;
  days_in_status: number;
};

export type OrderListResponse = Paginated<OrderRow> & {
  kpi_by_status: Record<OrderStatus, number>;
};

export type OrderItem = {
  id: UUID;
  title: string;
  variant: string | null;
  qty: number;
  unit_fils: Fils;
  total_fils: Fils;
  // Not yet populated by the backend (order_items has no such column) — kept
  // optional so the "Custom specifications" block below stays dormant rather
  // than reading undefined fields, until design notes/measurements are wired.
  custom_specifications?: {
    measurements: Record<string, number>;
    fabric: { name: string; color: string; meters: number };
    reference_image_urls: string[];
    design_notes: string;
  };
};

export type OrderStatusHistoryEntry = {
  id: UUID;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_name: string;
  actor_role: "customer" | "tailor" | "admin" | "system";
  note: string | null;
  created_at: ISODate;
};

export type OrderDetail = {
  order: OrderRow;
  items: OrderItem[];
  status_history: OrderStatusHistoryEntry[];
  payment: {
    subtotal_fils: Fils;
    discount_fils: Fils;
    measurement_fee_fils: Fils;
    measurement_mode: string | null;
    platform_fee_fils: Fils;
    delivery_fee_fils: Fils;
    total_fils: Fils;
    stripe_payment_intent_id: string | null;
  };
  refunds: Array<{
    id: UUID;
    amount_fils: Fils;
    reason: string;
    initiated_by: string;
    stripe_refund_id: string;
    created_at: ISODate;
  }>;
  related_dispute_id: UUID | null;
  admin_notes: string | null;
};

// ── Disputes ────────────────────────────────────────────────────────────────

export type DisputeStatus =
  | "open"
  | "peer_resolution"
  | "closed"
  // The two below are never a real status value on a dispute row — they're
  // only valid as a ?status= tab-filter query param, which the backend
  // translates (awaiting_tailor_response/awaiting_response → peer_resolution,
  // under_review → escalated). Kept here since STATUS_TABS reuses this same
  // type for its filter keys, not because a dispute's actual `status` field
  // can ever equal either literally.
  | "awaiting_tailor_response"
  | "under_review"
  | "resolved"
  | "escalated";
export type DisputeType =
  | "item_not_received"
  | "item_damaged"
  | "wrong_item"
  | "late_delivery"
  | "quality_issue"
  | "refund_request"
  | "other";

export type DisputeRow = {
  id: UUID;
  dispute_number: string;
  order_id: UUID;
  order_number: string;
  customer_name: string;
  tailor_name: string;
  tailor_id: UUID;
  dispute_type: DisputeType;
  status: DisputeStatus;
  assigned_to: { id: UUID; name: string } | null;
  sla_deadline: ISODate;
  time_remaining_seconds: number;
  raised_at: ISODate;
};

export type DisputeListResponse = Paginated<DisputeRow> & {
  kpi: {
    open: number;
    awaiting_response: number;
    under_review: number;
    resolved_today: number;
    escalated: number;
    breached: number;
  };
};

// Matches the actual flat shape GET /api/disputes/:id returns
// (backend/src/routes/disputes.js) — this type previously claimed a nested
// `sender: {id,name,role}` + `content` shape the backend never sent, which
// crashed the whole dispute detail page (including the refund/resolve UI)
// the instant any dispute had a message, since nothing here is
// runtime-checked against the actual response.
export type DisputeMessage = {
  id: UUID;
  body: string;
  sender_name: string;
  sender_role: "customer" | "tailor" | "admin" | "support_agent" | "operations_admin" | "super_admin";
  is_internal: boolean;
  created_at: ISODate;
};

export type DisputeDetail = {
  dispute: DisputeRow;
  customer: { name: string; claim_text: string; evidence_urls: string[] };
  tailor: { name: string; response_text: string | null; evidence_urls: string[] };
  messages: DisputeMessage[];
  status_history: Array<{
    from_status: DisputeStatus | null;
    to_status: DisputeStatus;
    actor_name: string;
    note: string | null;
    created_at: ISODate;
  }>;
  flagged_genuine?: boolean;
  resolution: {
    action: ResolutionAction;
    refund_amount_fils: Fils | null;
    note: string;
    resolved_by_name: string;
    resolved_at: ISODate;
  } | null;
};

export type ResolutionAction =
  | "full_refund_to_customer"
  | "partial_refund"
  | "reject_claim"
  | "require_redo"
  | "issue_warning_to_tailor"
  | "suspend_tailor";

// ── Inventory ───────────────────────────────────────────────────────────────

export type MaterialType =
  | "wool"
  | "cotton"
  | "silk"
  | "micromodal"
  | "polyester"
  | "linen"
  | "chiffon"
  | "velvet"
  | "denim"
  | "georgette"
  | "crepe"
  | "satin"
  | "other";

export type QualityTier = "economy" | "standard" | "premium" | "luxury";
export type GenderTarget = "men" | "women" | "unisex" | "kids";

export type MaterialColor = {
  id: UUID;
  color_name: string;
  hex_code: string;
  is_available: boolean;
};

export type MaterialProperty =
  | "breathable"
  | "stretchable"
  | "wrinkle_resistant"
  | "hypoallergenic"
  | "dry_clean_only"
  | "machine_washable"
  | "lightweight"
  | "heavyweight"
  | "sheer"
  | "opaque"
  | "anti_pilling"
  | "moisture_wicking";

// How the fabric is constructed.
export type FabricConstruction = "woven" | "knit" | "non_woven" | "blended" | "felted";

// Best-suited season for the fabric.
export type Season = "all_season" | "summer" | "winter" | "transitional";

// A single fibre in a composition blend, e.g. { fiber: "Cotton", pct: 80 }.
// pct values across a material's composition are expected to sum to ~100.
export type FiberComponent = { fiber: string; pct: number };

// Platform-managed REFERENCE catalog of fabrics ("global blends"). Admins curate
// the spec — quality, composition, colours, origin, care — but NOT price or stock.
// Pricing, available stock, the colour subset offered, and discounts live on the
// per-tailor offering (TailorMaterialOffering), not here. See Docs/Platform-Domain.md.
export type Material = {
  id: UUID;
  sku: string;
  name: string;
  name_ar: string;
  material_type: MaterialType;
  category_id: UUID | null;
  quality_tier: QualityTier;
  gender_target: GenderTarget;
  origin_country: string;
  // ── Fabric specification ──
  composition: FiberComponent[];
  weight_gsm: number; // grams per square metre
  weave_type: FabricConstruction;
  width_cm: number; // bolt width
  mill_brand: string | null; // originating mill / brand
  certifications: string[]; // e.g. "OEKO-TEX Standard 100", "GOTS"
  season: Season;
  care_instructions: string;
  images: string[];
  is_active: boolean;
  colors: MaterialColor[]; // canonical colours offered as hex swatches
  properties: MaterialProperty[];
  created_at: ISODate;
};

// A tailor's commercial offering of a catalog Material. Lives in the Tailor app
// (documented in ../../TailorDocs); included here so the shape is shared.
// `sell_directly` requires admin approval when the marketplace policy
// `tailor_material_sale_requires_approval` is enabled.
export type TailorMaterialOffering = {
  id: UUID;
  tailor_id: UUID;
  material_id: UUID; // → Material (reference)
  price_per_meter_fils: Fils;
  minimum_order_meters: number;
  stock_meters: number;
  low_stock_threshold_meters: number;
  offered_color_ids: UUID[]; // subset of Material.colors
  discount_type: "percentage" | "fixed_fils" | null;
  discount_value: number | null;
  sell_directly: boolean; // sell the fabric by the metre, not only stitch with it
  approval_status: "not_required" | "pending" | "approved" | "rejected";
  is_active: boolean;
};

export type Category = {
  id: UUID;
  name: string;
  name_ar: string;
  slug: string;
  gender: GenderTarget | "unisex";
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  material_count: number;
  children: Category[];
};

// Payload for creating/updating a category (parent_id links into the tree).
export type CategoryInput = {
  id?: UUID;
  name: string;
  name_ar: string;
  slug: string;
  gender: GenderTarget | "unisex";
  icon: string | null;
  parent_id?: UUID | null;
  is_active: boolean;
  sort_order?: number;
};

export type SubscriptionTier = {
  id: UUID;
  name: string;
  name_ar: string;
  monthly_price_fils: Fils;
  annual_price_fils: Fils;
  commission_rate_pct: number;
  max_active_listings: number | null;
  max_promotions?: number | null;
  max_portfolio_images: number;
  max_images_per_listing?: number;
  max_orders_per_month?: number | null;
  duration_months?: number;
  description?: string;
  can_feature_listings: boolean;
  max_featured_slots: number;
  priority_dispute_handling: boolean;
  verified_badge: boolean;
  female_customer_eligible: boolean;
  active_tailor_count: number;
  is_active: boolean;
};

export type SizeRow = {
  id: UUID;
  label: string;
  gender: GenderTarget;
  chest_min_cm: number | null;
  chest_max_cm: number | null;
  waist_min_cm: number | null;
  waist_max_cm: number | null;
  hips_min_cm: number | null;
  hips_max_cm: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

// ── Reviews ─────────────────────────────────────────────────────────────────

export type ReviewType = "customer_to_tailor" | "tailor_to_customer";

export type ReviewRow = {
  id: UUID;
  reviewer: { id: UUID; name: string; avatar_url: string | null };
  reviewee: { id: UUID; name: string; avatar_url: string | null };
  order_id: UUID;
  rating: 1 | 2 | 3 | 4 | 5;
  title: string;
  body: string;
  tailor_reply?: string | null;
  images: string[];
  review_type: ReviewType;
  is_visible: boolean;
  is_flagged: boolean;
  flag_count: number;
  hidden_reason: string | null;
  created_at: ISODate;
};

export type ReviewListResponse = Paginated<ReviewRow> & {
  kpi: { total: number; visible: number; hidden: number; flagged: number; avg_rating: number };
};

export type ReviewAnalytics = {
  platform_avg_rating: number;
  distribution: [number, number, number, number, number];
  volume_this_month: number;
  volume_prior_month: number;
  tailors_below_threshold: Array<{
    id: UUID;
    business_name: string;
    rating_avg: number;
    rating_count: number;
  }>;
};

// ── Notifications ───────────────────────────────────────────────────────────

export type Notification = {
  id: UUID;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: ISODate;
  link?: string;
};

// ── Customers ────────────────────────────────────────────────────────────────

export type CustomerRow = {
  id: UUID;
  full_name: string;
  phone: string;
  email: string | null;
  city: string;
  total_orders: number;
  total_spent_fils: Fils;
  active_disputes: number;
  status: "active" | "suspended" | "flagged";
  // Independent of `status` above: status collapses these two into one of
  // three mutually-exclusive labels (is_active wins over is_flagged), so a
  // suspended customer who is also flagged reads only as "suspended". Both
  // raw booleans come back from the backend regardless (users.is_active /
  // users.is_flagged) — needed wherever suspend/flag state must be handled
  // independently, e.g. customer detail action buttons.
  is_active: boolean;
  is_flagged: boolean;
  joined_at: ISODate;
  last_active_at: ISODate;
};

export type CustomerListResponse = Paginated<CustomerRow> & {
  kpi: {
    total: number;
    active: number;
    suspended: number;
    flagged: number;
    new_this_month: number;
  };
};

export type CustomerDetail = {
  profile: CustomerRow & {
    avatar_url: string | null;
    preferred_language: "en" | "ar";
    is_phone_verified: boolean;
    is_email_verified: boolean;
    flag_reason: string | null;
    flagged_at: ISODate | null;
    flagged_by_name: string | null;
    // Helpdesk-requested deletion, pending a super_admin's execution (or
    // cancellation) — see customers.js POST /:id/request-deletion.
    deletion_requested_at: ISODate | null;
    deletion_request_reason: string | null;
    deletion_requested_by_name: string | null;
  };
  stats: {
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    total_spent_fils: Fils;
    avg_order_value_fils: Fils;
    total_disputes: number;
    open_disputes: number;
    total_reviews: number;
  };
  addresses: Array<{
    id: UUID;
    label: string;
    full_address: string;
    city: string;
    is_default: boolean;
  }>;
};

export type CustomerOrderRow = OrderRow;

export type CustomerDisputeRow = DisputeRow;

export type CustomerReviewRow = ReviewRow;

export type CustomerActivityEvent = {
  id: UUID;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: ISODate;
};

// ── Revenue ──────────────────────────────────────────────────────────────────

export type RevenueKPI = {
  gmv_fils: Fils;
  commission_fils: Fils;
  refunds_fils: Fils;
  net_revenue_fils: Fils;
  gmv_delta_pct: number;
  commission_delta_pct: number;
  refund_rate_pct: number;
  avg_order_value_fils: Fils;
};

export type RevenueBreakdownRow = {
  period: string;
  readymade_fils: Fils;
  custom_stitch_fils: Fils;
  material_fils: Fils;
  commission_fils: Fils;
  refunds_fils: Fils;
};

export type CommissionConfig = {
  global_default_rate_pct: number;
  tier_rates: Array<{
    tier_id: UUID;
    tier_name: string;
    rate_pct: number;
    tailor_count: number;
  }>;
  custom_overrides: Array<{
    tailor_id: UUID;
    tailor_name: string;
    rate_pct: number;
    note: string | null;
    updated_at: ISODate;
  }>;
};

// ── Payouts ──────────────────────────────────────────────────────────────────

export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "cancelled";

export type PayoutRow = {
  id: UUID;
  tailor_id: UUID;
  tailor_name: string;
  amount_fils: Fils;
  stripe_transfer_id: string | null;
  status: PayoutStatus;
  // No `failure_reason` field — tailor_payouts has no such column, and
  // nothing anywhere ever set it. The Retry button's tooltip that read it
  // was permanently empty; removed rather than left declaring a field the
  // backend can never actually populate.
  requested_at: ISODate;
  processed_at: ISODate | null;
  bank_name?: string | null;
  iban?: string | null;
  // Already selected by the backend but never rendered until now — the bank's
  // own confirmation/transaction number for reconciliation.
  reference?: string | null;
};

export type PayoutListResponse = Paginated<PayoutRow> & {
  kpi: {
    pending_count: number;
    pending_amount_fils: Fils;
    failed_count: number;
    paid_today_fils: Fils;
  };
};

export type PayoutSchedule = {
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  day_of_week: number | null;
  day_of_month: number | null;
  minimum_amount_fils: Fils;
  auto_process: boolean;
  next_run_at: ISODate;
};

// ── Admin Users ───────────────────────────────────────────────────────────────

export type AdminUserRow = {
  id: UUID;
  full_name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  totp_enabled: boolean;
  last_login_at: ISODate | null;
  created_at: ISODate;
  created_by_name: string | null;
  /** Only present on the create-admin response, when no password was supplied. */
  temp_password?: string | null;
  /** Gets delivery fee waived when shopping as a customer — also requires the
   *  platform-wide Settings → Platform → "Waive delivery fee for staff" switch. */
  staff_perk_enabled: boolean;
};

export type AdminUserListResponse = Paginated<AdminUserRow> & {
  kpi: { total: number; active: number; inactive: number };
};

export type AdminAuditEntry = {
  id: UUID;
  action: string;
  entity_type: string;
  entity_id: UUID | null;
  summary: string;
  description?: string; // alias kept for backward compat
  ip_address: string | null;
  ip?: string | null; // alias returned by backend
  actor_name: string | null;
  actor_role: string | null;
  created_at: ISODate;
};

// ── Promotions ────────────────────────────────────────────────────────────────

export type FeaturedListingRow = {
  id: UUID;
  listing_id: UUID;
  listing_title: string;
  tailor_name: string;
  tailor_id: UUID;
  slot_position: number;
  price_fils: Fils;
  impressions: number;
  clicks: number;
  conversions: number;
  starts_at: ISODate;
  ends_at: ISODate;
  is_active: boolean;
};

export type DiscountCode = {
  id: UUID;
  code: string;
  discount_type: "percentage" | "fixed_fils";
  discount_value: number;
  min_order_fils: Fils | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  valid_from: ISODate;
  valid_until: ISODate | null;
  created_at: ISODate;
  gmv_attributed_fils: Fils;
};

export type DiscountCodeListResponse = Paginated<DiscountCode> & {
  kpi: { total_active: number; total_uses: number; total_gmv_attributed_fils: Fils };
};

// ── Notifications (broadcast) ─────────────────────────────────────────────────

export type BroadcastRow = {
  id: UUID;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  target_audience: "all" | "tailors" | "customers" | "specific_tier";
  target_tier: string | null;
  sent_count: number;
  sent_at: ISODate;
  sent_by_name: string;
};

// Matches GET /admin/messages/threads (flat fields from the SQL).
export type MessageThread = {
  id: UUID;
  order_id: UUID | null;
  order_number: string | null;
  subject: string;
  status: string;
  created_at: ISODate;
  customer_name: string | null;
  tailor_name: string | null;
  last_message: string | null;
  last_at: ISODate | null;
  unread_count: number;
};

// Matches GET /admin/messages/threads/:id (flat fields from the SQL).
export type ThreadMessage = {
  id: UUID;
  body: string;
  created_at: ISODate;
  sender_id: UUID | null;
  sender_name: string | null;
  sender_role: "admin" | "tailor" | "customer" | string | null;
  /** Only present on the party-aware /me/threads/:id endpoint. */
  mine?: boolean;
};

// ── Settings ──────────────────────────────────────────────────────────────────

export type MaintenanceScope = "customers" | "tailors" | "both";

export type PlatformSettings = {
  platform_name: string;
  support_email: string;
  support_phone: string;
  default_currency: string;
  default_language: "en" | "ar";
  /** Instant, indefinite shutdown. For planned downtime use the scheduled
   *  window below instead — it warns users in advance. */
  maintenance_mode: boolean;
  /** ISO datetime; empty string = no window scheduled. */
  maintenance_scheduled_start: string;
  maintenance_scheduled_end: string;
  /** Who the window (or the manual switch) actually blocks. Staff are never blocked. */
  maintenance_scope: MaintenanceScope;
  /** How many hours before the window starts to show users the countdown banner. */
  maintenance_notice_hours: number;
  /** Shown to blocked users and in the countdown banner. */
  maintenance_message: string;
  /** Platform-wide kill switch for the staff-customer perk (delivery fee
   *  waived at checkout). Individual staff are opted in from the Admins
   *  page; this toggle instantly disables the perk for everyone regardless. */
  staff_discount_enabled: boolean;
  /** Mobile app update gate — the app calls GET /app-version on launch.
   *  A device build below app_min_build is force-blocked; below
   *  app_latest_build it's nudged but can dismiss. See backend/src/index.js. */
  app_min_build: number;
  app_latest_build: number;
  app_update_url: string;
  app_update_message: string;
};

export type OnboardingSettings = {
  require_trade_license: boolean;
  require_national_id: boolean;
  require_portfolio_certificate: boolean;
  require_phone_verification: boolean;
  require_email_verification: boolean;
  require_customer_email_verification: boolean;
  auto_approve_verified_tailors: boolean;
  min_portfolio_images: number;
  welcome_message_en: string;
  welcome_message_ar: string;
};

export type PolicySettings = {
  commission_dispute_window_days: number;
  return_window_days: number;
  review_edit_window_hours: number;
  dispute_sla_hours: number;
  payout_hold_days: number;
  // Days after delivery an unconfirmed order auto-completes (releasing the
  // tailor's earnings) — see backend autoCompleteDeliveredOrders.
  auto_complete_delivered_days: number;
  max_active_disputes_per_customer: number;
  // Where a new customer dispute goes: 'tailor_first' (tailor responds, then
  // escalate) or 'helpdesk_direct' (straight to the platform helpdesk).
  dispute_routing: "tailor_first" | "helpdesk_direct";
};

// Platform-level governance of what tailors are allowed to do. The platform owns
// these caps/toggles; tailors operate within them (promotions, material sales,
// measurement appointments, delivery). See Docs/Platform-Domain.md.
export type MarketplaceSettings = {
  // Promotions & discounts are created by tailors, but capped here.
  max_promotion_duration_days: number;
  max_discount_percentage: number;
  // Material sales by tailors.
  tailor_material_sale_requires_approval: boolean;
  // Measurement appointments.
  measurement_appointments_enabled: boolean;
  home_visit_measurement_enabled: boolean;
  home_service_platform_cut_pct: number; // Khyate's % of the tailor's home-visit fee (0 = none)
  // Delivery (3rd-party partner) between tailor and customer.
  delivery_enabled: boolean;
  delivery_customer_pays_surcharge: boolean;
  max_delivery_surcharge_fils: Fils;
  subscriptions_enabled: boolean;
};

export type SecuritySettings = {
  admin_ip_allowlist: string[];
  session_timeout_minutes: number;
  require_totp_for_all_admins: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
};

// Every field here is LIVE status, computed server-side from whether real
// credentials are actually configured (env vars) — not saved settings, so
// none of these can drift from reality the way a plain editable toggle
// could. There used to also be stripe_mode/stripe_publishable_key/
// cloudflare_r2_bucket/sendgrid_from_email editable fields here — all four
// were saved but never read by anything (Cloudflare R2 and SendGrid aren't
// even used anywhere in the backend; uploads are local-disk, email is SMTP),
// so they were removed rather than left to mislead an admin into thinking
// they'd configured something real.
export type IntegrationSettings = {
  stripe_connected: boolean;
  firebase_connected: boolean;
  sms_provider: boolean;
  email_provider: boolean;
  sentry_connected: boolean;
  posthog_connected: boolean;
  kyc_encryption_connected: boolean;
};

// ── Subscriptions ────────────────────────────────────────────────────────────

export type SubscriptionPlan = {
  id: UUID;
  name: string;
  name_ar: string;
  tagline: string;
  tagline_ar: string;
  price_fils_monthly: Fils;
  price_fils_yearly: Fils;
  benefits: string[];
  is_active: boolean;
  sort_order: number;
  created_at: ISODate;
  updated_at: ISODate;
};

export type CustomerSubscription = {
  id: UUID;
  customer_id: UUID;
  plan_id: UUID;
  status: "active" | "cancelled" | "expired" | "paused";
  billing_cycle: "monthly" | "yearly";
  started_at: ISODate;
  expires_at: ISODate;
  cancelled_at: ISODate | null;
  payment_ref: string | null;
  created_at: ISODate;
  // Joined from plan:
  name: string;
  name_ar: string;
  tagline: string;
  benefits: string[];
  price_fils_monthly: Fils;
  price_fils_yearly: Fils;
};

export type SubscriptionStats = {
  active_count: number;
  cancelled_count: number;
  expired_count: number;
  mrr_fils: Fils;
  new_this_month: number;
};

// ── Tailor app (the tailor's own view) ──────────────────────────────────────────

export type TailorSummary = {
  open_orders: number;
  in_progress: number;
  month_gmv_fils: Fils;
  available_fils: Fils;
  pending_fils: Fils;
  rating_avg: number;
  rating_count: number;
  pending_appointments: number;
  active_listings: number;
};

// Mirrors the DB listing_status enum exactly. ("rejected" = removed by Khyate.)
export type ListingStatus = "draft" | "pending_review" | "active" | "inactive" | "rejected";

export type TailorListingRow = {
  id: UUID;
  title: string;
  title_ar: string;
  listing_type: OrderType; // readymade | custom_stitch (alteration retired as a type — see alteration_available)
  garment_slug: string | null;
  garment_name: string | null;
  style_category_id: string | null;
  style_category_name: string | null;
  base_price_fils: Fils;
  stitching_cost_fils: Fils | null; // made-to-measure only
  stock: number | null; // readymade only
  order_count: number;
  status: ListingStatus;
  rejection_reason: string | null;
  colors: string[]; // hex swatches
  sizes?: string[]; // readymade size labels the tailor stocks (e.g. S, M, L)
  material_id: UUID | null;
  created_at: ISODate;
  image_urls?: string[]; // product photos
  description?: string;
  description_ar?: string;
  gender?: string; // men | women | unisex | kids
  alteration_available: boolean;
  alteration_price_fils: number | null;
};

export type PromoScope = "all" | "category" | "service";
// Aligned to the listing service modes.
export type PromoService = "readymade" | "custom_stitch" | "alteration";

export type TailorPromotion = {
  id: UUID;
  code: string;
  discount_type: "percentage" | "fixed_fils";
  discount_value: number;
  scope_type: PromoScope;
  target_category: string | null; // garment, e.g. "Kandura"
  target_service: PromoService | null;
  valid_from: ISODate | null;
  valid_until: ISODate | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
};

export type AppointmentType = "in_shop" | "home_visit";
export type AppointmentStatus =
  | "open"
  | "pending"
  | "booked"
  | "confirmed"
  | "en_route"
  | "arrived"
  | "measured"
  | "completed"
  | "cancelled";

export type Appointment = {
  id: UUID;
  customer_name: string;
  type: AppointmentType;
  slot_start: ISODate;
  slot_end: ISODate;
  status: AppointmentStatus;
  address: string | null;
  measurements_uploaded: boolean;
  // Home-visit flow (20260608_home_visit migration) — all optional/nullable.
  address_text?: string | null;
  required_tailor_gender?: "men" | "women" | "any" | null;
  in_zone?: boolean | null;
  arrival_distance_m?: number | null;
  // Dashboard-declutter only — hides this row from the tailor's own
  // "Already measured" list. The customer's measurement data is untouched.
  tailor_dismissed_at?: string | null;
};

export type AvailabilityRule = {
  id?: UUID;
  weekday: number; // 0 = Sun … 6 = Sat
  start_hm: string; // "16:00" (stored 24h)
  end_hm: string; // "19:00"
  in_shop: boolean;
  home_visit: boolean;
  is_active?: boolean; // false = day off (kept so the editor can toggle days)
};

export type EarningsPoint = { date: ISODate; earnings_fils: Fils; gmv_fils?: Fils };
export type OrdersPoint = { date: ISODate; orders: number; gmv_fils: Fils };

export type TailorEarnings = {
  available_fils: Fils;
  pending_fils: Fils;
  lifetime_fils: Fils;
  debt_fils?: Fils;
  last_payout_at: ISODate | null;
  series: EarningsPoint[];
  orders_series?: OrdersPoint[];
  // Admin-configured minimum from marketplace_settings ('payout_minimum_amount_fils'),
  // same value the payout-request endpoint validates against server-side.
  payout_minimum_fils?: Fils;
};

export type TailorSubscription = {
  tier: TailorTier;
  tier_id: UUID;
  billing_cycle: "monthly" | "annual";
  current_period_end: ISODate;
  usage: {
    active_listings: number;
    max_active_listings: number | null;
    portfolio_images: number;
    max_portfolio_images: number;
    featured_used: number;
    max_featured_slots: number;
  };
};

// ── Booster packs ──
export type BoosterProduct = {
  id: UUID;
  name: string;
  name_ar?: string | null;
  price_fils: Fils;
  duration_days: number;
  boost_weight: number;
  is_active: boolean;
};
export type TailorBoost = {
  id: UUID;
  tailor_id?: UUID;
  product_id?: UUID | null;
  name?: string | null;
  name_ar?: string | null;
  boost_weight: number;
  price_fils: Fils;
  starts_at: ISODate;
  ends_at: ISODate;
  status: "active" | "expired" | "cancelled";
  tailor_name?: string;
  product_name?: string | null;
};

// ── KYC onboarding (tailor) ──
// 'superseded' = a document that was replaced by a newer upload; archived
// (bytes kept, not purged) rather than deleted, so the review/audit trail
// survives — never shown with Approve/Reject actions.
export type DocStatus = "pending" | "approved" | "rejected" | "expired" | "superseded";
export type DocTypeMeta = { level: "business" | "partner"; required: boolean; label: string; requires_expiry: boolean };
export type TailorPartner = {
  id: UUID;
  full_name: string;
  role: "owner" | "partner";
  email?: string | null;
  nationality?: string | null;
  emirates_id_expiry?: string | null; // YYYY-MM-DD
  is_primary: boolean;
  created_at: ISODate;
  emirates_id_number?: string | null; // admin-only (decrypted); never sent to the tailor
  // Self-declared beneficial-ownership percentage (0-100) — not externally
  // verified against any UAE UBO registry (no public API exists for that).
  ownership_pct?: number | null;
  // Advisory-only: a possible match against the free OFAC SDN / UN
  // Consolidated sanctions lists. Never an auto-block — a human must verify.
  sanctions_flag?: string | null;
};
export type TailorDocument = {
  id: UUID;
  doc_type: string;
  partner_id: UUID | null;
  status: DocStatus;
  rejection_reason?: string | null;
  original_name?: string | null;
  doc_expires_at?: string | null;
  id_number?: string | null;
  ocr_status?: "pending" | "done" | "error" | "unavailable" | null;
  ocr_fields?: {
    eid_number?: string | null;
    expiry?: string | null;
    declared_expiry?: string | null;
  } | null;
  ocr_flags?: string[] | null;
  ocr_confidence?: number | null;
  declared_expiry_mismatch?: boolean;
  created_at: ISODate;
  label?: string;
  required?: boolean;
  stream_url?: string;
};
// Invoice-logo brand-color detection (backend/src/lib/logo-color.js): 'single'
// = one flat color, 'auto_two' = algorithm picked the 2 most dominant colors
// of a small palette, 'manual_two' = tailor picked 2 from logo_color_candidates
// because the logo had too many distinct colors to auto-pick confidently.
// null/absent = no logo, not yet analyzed, or genuinely no color detected.
export type LogoColorMode = "single" | "auto_two" | "manual_two" | null;
export type OnboardingStatus = {
  profile_status: string;
  verified: boolean;
  // Account verification state + whether each half gates final approval
  // (admin onboarding toggles; both default on). Lets the Documents page
  // surface the approval gate up front instead of at a stalled review.
  email_verified: boolean;
  phone_verified: boolean;
  email_verification_required: boolean;
  phone_verification_required: boolean;
  // Only set (non-null) when profile_status === "rejected" — a whole-application
  // reject via POST /verification/:id/reject, distinct from a per-document reject.
  rejection_reason?: string | null;
  portfolio_image_count: number;
  min_portfolio_images: number;
  business_name: string;
  business_name_ar?: string | null;
  address?: string | null;
  phone?: string | null;
  trn?: string | null;
  signature_url?: string | null;
  stamp_url?: string | null;
  invoice_note?: string | null;
  logo_url?: string | null;
  logo_color_mode?: LogoColorMode;
  logo_color_1?: string | null;
  logo_color_2?: string | null;
  logo_color_candidates?: string[] | null;
  city: string;
  doc_types: Record<string, DocTypeMeta>;
  partners: TailorPartner[];
  documents: TailorDocument[];
  // Past versions superseded by a later renewal upload — view-only log, never
  // deletable (see secure-docs.js DELETE). Newest first.
  document_history: TailorDocument[];
  is_complete: boolean;
};

// ── KYC validator teams ──────────────────────────────────────────────────────
export type ValidatorTeamMember = {
  id: UUID;
  full_name: string;
  email: string;
  role: string;
};
export type ValidatorTeam = {
  id: UUID;
  name: string;
  created_at: ISODate;
  members: ValidatorTeamMember[];
  pending_count: number;
};
export type ValidatorTeamsResponse = {
  teams: ValidatorTeam[];
  reviewers_required: number;
  unassigned_pending_count: number;
};
export type ValidatorCandidate = {
  id: UUID;
  full_name: string;
  email: string;
  role: string;
  validator_team_id: UUID | null;
};

export type DisputeThreadMessage = {
  id: UUID;
  sender_id: UUID;
  sender_name: string;
  body: string;
  created_at: ISODate;
  read_at: ISODate | null;
  delivered_at: ISODate | null;
};

export type TailorOrderItem = {
  id: UUID;
  listing_title: string;
  variant_label: string | null;
  quantity: number;
  unit_price_fils: Fils;
  total_price_fils: Fils;
  // Not yet populated by the backend (order_items has no such column) - tracked
  // as a known gap in fix/tasks.md, not a type error.
  custom_specifications?: {
    fabric: { name: string; color: string; meters: number };
    measurements: Record<string, number>;
    design_notes?: string;
  } | null;
};

export type TailorOrderTimelineEntry = {
  id: UUID;
  status: string;
  to_status: string;
  note: string | null;
  created_at: ISODate;
  actor_name: string;
};

export type TailorOrderDispute = {
  id: UUID;
  status: string;
  reason: string;
  tailor_response: string | null;
  tailor_resolved_at: ISODate | null;
  escalated_at: ISODate | null;
  created_at: ISODate;
};

// The courier job the platform booked once this order was marked 'ready' —
// null until requires_delivery is true and a delivery row exists (mirrors
// GET /me/orders/:id/delivery, the customer-facing equivalent).
export type TailorOrderDelivery = {
  status: string;
  partner: string | null;
  courier_name: string | null;
  tracking_url: string | null;
  pickup_notes: string | null;
  pickup_scheduled_date: string | null;
};

export type TailorOrderDetail = {
  id: UUID;
  order_number: string;
  order_type: string;
  status: string;
  customer_name: string;
  customer_phone: string | null;
  total_fils: Fils;
  subtotal_fils: Fils;
  discount_fils: Fils;
  measurement_fee_fils: Fils;
  measurement_mode: string | null;
  delivery_fee_fils: Fils;
  requires_delivery: boolean;
  refund_fils: Fils;
  refund_reason: string | null;
  tracking_number: string | null;
  items: TailorOrderItem[];
  timeline: TailorOrderTimelineEntry[];
  dispute: TailorOrderDispute | null;
  delivery: TailorOrderDelivery | null;
};

export type TailorDisputeRow = {
  id: UUID;
  order_number: string;
  customer_name: string;
  reason: string;
  status: string;
  created_at: ISODate;
  unread_count: number;
};

// ── Admin: tailor detail sub-tabs ──
export type AdminTailorOrderRow = {
  id: UUID;
  order_number: string;
  customer_name: string;
  order_type: string;
  total_fils: Fils;
  status: string;
  created_at: ISODate;
};

export type AdminTailorListingRow = {
  id: UUID;
  title: string;
  listing_type: string;
  base_price_fils: Fils;
  order_count?: number;
  status: string;
  created_at: ISODate;
};

export type AdminTailorReviewRow = {
  id: UUID;
  customer_name?: string;
  reviewer?: { name: string };
  rating: number;
  title: string;
  is_visible: boolean;
  created_at: ISODate;
};

export type AdminTailorLedgerRow = {
  id: UUID;
  order_number: string;
  gross_fils: Fils;
  commission_fils: Fils;
  net_fils: Fils;
  payout_status: string;
  created_at: ISODate;
};

export type AdminTailorActivityEvent = {
  id: UUID;
  type?: string;
  description?: string;
  created_at: ISODate;
};

export type DisputeThread = {
  messages: DisputeThreadMessage[];
  me: UUID;
  status: string;
  customer_name: string;
  order_number: string;
};
