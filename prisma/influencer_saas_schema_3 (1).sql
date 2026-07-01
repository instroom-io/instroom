-- ============================================================================
-- INFLUENCER COLLABORATION SAAS — FULL DATABASE SCHEMA
-- ============================================================================
-- PostgreSQL | Compatible with Prisma ORM + Next.js
-- 
-- ROLE STRUCTURE:
--   1. Super Admin    → Master admin of the SaaS platform
--   2. Brand Owner    → Owns a brand/company, manages their influencer list
--   3. Collaborator   → Invited by Brand Owner, can access multiple brands
--
-- KEY CONCEPT:
--   Influencer = ONE global record (the person)
--   BrandInfluencer = PRIVATE relationship per brand (outreach, collab, content)
--   Brand A and Brand B can work with the same influencer independently
-- ============================================================================


-- ============================================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255),          -- NULL if signed up via Google
    full_name           VARCHAR(255),
    avatar_url          TEXT,
    phone               VARCHAR(50),
    
    -- Platform-level role (NOT brand role)
    -- 'super_admin' = SaaS master admin (you)
    -- 'user'        = normal user (brand owners & collaborators)
    platform_role       VARCHAR(20) NOT NULL DEFAULT 'user' 
                        CHECK (platform_role IN ('super_admin', 'user')),
    
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_platform_role ON users(platform_role);


-- ============================================================================
-- 1b. ACCOUNTS (OAuth Providers — NextAuth.js / Auth.js Compatible)
-- ============================================================================
-- Links a user to one or more auth providers (Google, credentials, etc.)
-- A user who signs up with Google gets a row here.
-- If they later add email/password login, that's a second row.
-- Schema follows NextAuth.js "database adapter" convention.
--
-- FLOW — Brand Owner signs in with Google:
--   1. Google returns: { sub: "google-id-123", email, name, picture }
--   2. Check accounts table for provider='google' + provider_account_id='google-id-123'
--   3. If NOT found → create new user + account row (first-time signup)
--   4. If found → look up linked user_id → sign them in
--   5. User creates their brand → becomes Brand Owner

CREATE TABLE accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Provider info
    provider                VARCHAR(50) NOT NULL,    -- 'google', 'credentials', 'github', etc.
    provider_account_id     VARCHAR(255) NOT NULL,   -- Google's "sub" claim (unique user ID from Google)
    
    -- OAuth tokens (stored for Google API access if needed later)
    access_token            TEXT,
    refresh_token           TEXT,
    token_type              VARCHAR(50),
    scope                   TEXT,
    expires_at              INTEGER,                 -- token expiry as unix timestamp
    id_token                TEXT,                    -- Google's JWT ID token
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One account per provider per user (can't link same Google twice)
    UNIQUE(provider, provider_account_id)
);

CREATE INDEX idx_accounts_user ON accounts(user_id);
CREATE INDEX idx_accounts_provider ON accounts(provider, provider_account_id);


-- ============================================================================
-- 1c. SESSIONS (Server-Side Sessions — Optional)
-- ============================================================================
-- Only needed if using database sessions instead of JWT.
-- NextAuth supports both — JWT is simpler, DB sessions are more secure.

CREATE TABLE sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token       VARCHAR(255) NOT NULL UNIQUE,
    expires             TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_user ON sessions(user_id);


-- ============================================================================
-- 1d. VERIFICATION TOKENS (Email Verification & Magic Links)
-- ============================================================================
-- Used for email verification, password reset, magic link sign-in.

CREATE TABLE verification_tokens (
    identifier          VARCHAR(255) NOT NULL,    -- usually the email
    token               VARCHAR(255) NOT NULL UNIQUE,
    expires             TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY(identifier, token)
);


-- ============================================================================
-- 1e. SUBSCRIPTION PLANS (Defined by Super Admin)
-- ============================================================================
-- These are the plan templates. You configure them once.
--
-- SEAT LOGIC:
--   Solo   → 0 included seats, CAN buy extra seats at additional cost
--   Team   → 10 included seats, CAN buy extra seats beyond 10
--   Agency → 30 included seats, CAN buy extra seats beyond 30
--
-- "Seat" = one collaborator slot. Brand Owner does NOT consume a seat.
-- Solo plan means the owner works alone by default, but can pay for seats.

CREATE TABLE subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(50) NOT NULL UNIQUE,       -- 'solo', 'team', 'agency'
    display_name        VARCHAR(100) NOT NULL,              -- 'Solo', 'Team', 'Agency'
    description         TEXT,
    
    -- Pricing
    price_monthly       DECIMAL(10,2) NOT NULL,             -- e.g., 29.00
    price_yearly        DECIMAL(10,2),                      -- e.g., 290.00 (discounted)
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    
    -- Seat limits
    included_seats      INTEGER NOT NULL DEFAULT 0,         -- Solo=0, Team=10, Agency=30
    max_seats           INTEGER,                            -- NULL = unlimited extra seats
    price_per_extra_seat DECIMAL(10,2) NOT NULL DEFAULT 0,  -- cost per extra seat/month
    
    -- Brand limits
    included_brands     INTEGER NOT NULL DEFAULT 1,         -- Solo=1, Team=3, Agency=10
    max_brands          INTEGER,                            -- max total brands allowed (NULL = unlimited)
    price_per_extra_brand DECIMAL(10,2) NOT NULL DEFAULT 0, -- cost per extra brand/month
    
    -- Feature limits (extend as your features grow)
    max_influencers     INTEGER,         -- max influencers per brand (NULL = unlimited)
    max_campaigns       INTEGER,         -- max active campaigns (NULL = unlimited)
    can_export          BOOLEAN NOT NULL DEFAULT TRUE,
    can_use_api         BOOLEAN NOT NULL DEFAULT FALSE,
    custom_branding     BOOLEAN NOT NULL DEFAULT FALSE,
    priority_support    BOOLEAN NOT NULL DEFAULT FALSE,
    
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order          INTEGER NOT NULL DEFAULT 0,         -- for pricing page display order
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the 3 plans
-- Solo:   1 brand (cannot add more), 0 seats (buy up to 5)
-- Team:   3 brands included (can buy more), 10 seats (buy up to 25)
-- Agency: 10 brands included (can buy more), 30 seats (unlimited extra)
INSERT INTO subscription_plans (name, display_name, price_monthly, price_yearly, included_seats, max_seats, price_per_extra_seat, included_brands, max_brands, price_per_extra_brand, max_influencers, max_campaigns, can_use_api, custom_branding, priority_support, sort_order)
VALUES
    ('solo',   'Solo',   29.00,  290.00,  0,  5,    9.00,  1,  1,    0,     100,  3,    FALSE, FALSE, FALSE, 1),
    ('team',   'Team',   79.00,  790.00,  10, 25,   7.00,  3,  10,   19.00, 500,  10,   TRUE,  FALSE, TRUE,  2),
    ('agency', 'Agency', 199.00, 1990.00, 30, NULL, 5.00,  10, NULL, 15.00, NULL, NULL, TRUE,  TRUE,  TRUE,  3);


-- ============================================================================
-- 1f. BRAND SUBSCRIPTIONS (Active Subscription Per Brand)
-- ============================================================================
-- Each brand has ONE active subscription at a time.
-- Tied to brand (not user), because the brand pays, not the individual.
--
-- EXAMPLE:
--   Flaske signs up for Team plan (10 included seats)
--   They invite 10 collaborators → all good, within included_seats
--   They want to invite 2 more → extra_seats bumps to 2 → billed extra
--   They upgrade to Agency → 30 included seats → extra_seats resets to 0

-- ============================================================================
-- 1f. USER SUBSCRIPTIONS (Active Subscription Per Owner)
-- ============================================================================
-- Subscription is tied to the OWNER (user), not the brand.
-- Why? Because brand limits are per owner — an owner on the Team plan
-- can create up to 3 brands (+ buy more). The subscription governs ALL
-- their brands collectively.
--
-- EXAMPLE:
--   Maria signs up for Team plan (3 included brands, 10 seats per brand)
--   She creates Brand A, Brand B, Brand C → all good, within included_brands
--   She wants a 4th brand → extra_brands bumps to 1 → billed $19/mo extra
--   Seats are tracked PER BRAND in brand_seat_usage (see below)

CREATE TABLE user_subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id             UUID NOT NULL REFERENCES subscription_plans(id),
    
    -- Billing
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trialing', 'active', 'past_due', 
                                          'canceled', 'paused', 'expired')),
    billing_cycle       VARCHAR(10) NOT NULL DEFAULT 'monthly'
                        CHECK (billing_cycle IN ('monthly', 'yearly')),
    
    -- Extra brands purchased beyond the plan's included_brands
    extra_brands        INTEGER NOT NULL DEFAULT 0,
    
    -- Stripe / Payment integration
    stripe_customer_id      VARCHAR(255),
    stripe_subscription_id  VARCHAR(255),
    stripe_price_id         VARCHAR(255),
    
    -- Dates
    trial_start         TIMESTAMPTZ,
    trial_end           TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end  TIMESTAMPTZ NOT NULL,
    canceled_at         TIMESTAMPTZ,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON user_subscriptions(status);
CREATE INDEX idx_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);


-- ============================================================================
-- 1f-ii. BRAND SEAT OVERRIDES (Extra Seats Per Brand)
-- ============================================================================
-- Each brand under an owner can independently purchase extra seats.
-- The plan defines how many seats each brand gets by default (included_seats).
-- If Brand A needs 3 extra collaborators, only Brand A pays for those seats.
--
-- EXAMPLE (Maria on Team plan):
--   Brand A: 10 included + 2 extra = 12 seats (pays $14/mo extra)
--   Brand B: 10 included + 0 extra = 10 seats (no extra cost)
--   Brand C: 10 included + 5 extra = 15 seats (pays $35/mo extra)

CREATE TABLE brand_seat_overrides (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE UNIQUE,
    extra_seats         INTEGER NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_seat_overrides_brand ON brand_seat_overrides(brand_id);


-- ============================================================================
-- 1g. SEAT USAGE TRACKING (Per Brand)
-- ============================================================================
-- LOGIC:
--   total_seats_allowed = plan.included_seats + brand_seat_overrides.extra_seats
--   seats_used = COUNT of brand_members WHERE role != 'owner'
--   can_invite = seats_used < total_seats_allowed

CREATE VIEW vw_brand_seat_usage AS
SELECT 
    b.id AS brand_id,
    b.name AS brand_name,
    b.owner_id,
    sp.name AS plan_name,
    sp.included_seats,
    COALESCE(bso.extra_seats, 0) AS extra_seats,
    sp.included_seats + COALESCE(bso.extra_seats, 0) AS total_seats_allowed,
    COUNT(bm.id) FILTER (WHERE bm.role != 'owner' AND bm.is_active = TRUE) AS seats_used,
    (sp.included_seats + COALESCE(bso.extra_seats, 0)) 
        - COUNT(bm.id) FILTER (WHERE bm.role != 'owner' AND bm.is_active = TRUE) AS seats_remaining,
    sp.price_per_extra_seat
FROM brands b
JOIN users u ON u.id = b.owner_id
LEFT JOIN user_subscriptions us ON us.user_id = b.owner_id AND us.status IN ('active', 'trialing')
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
LEFT JOIN brand_seat_overrides bso ON bso.brand_id = b.id
LEFT JOIN brand_members bm ON bm.brand_id = b.id
GROUP BY b.id, b.name, b.owner_id, sp.name, sp.included_seats, bso.extra_seats, sp.price_per_extra_seat;


-- ============================================================================
-- 1g-ii. BRAND USAGE TRACKING (Per Owner)
-- ============================================================================
-- Used when owner tries to create a new brand: "do they have brand slots left?"
--
-- LOGIC:
--   total_brands_allowed = plan.included_brands + subscription.extra_brands
--   brands_used = COUNT of brands WHERE owner_id = user
--   can_create_brand = brands_used < total_brands_allowed
--
-- EXAMPLE — Maria on Team plan:
--   included_brands = 3, extra_brands = 0 → total_brands_allowed = 3
--   She owns 3 brands → brands_remaining = 0
--   She wants a 4th → must buy extra brand ($19/mo)
--
-- EXAMPLE — Carlos on Solo plan:
--   included_brands = 1, max_brands = 1 → total_brands_allowed = 1
--   He owns 1 brand → cannot create more (Solo is capped at 1, no extras)

CREATE VIEW vw_owner_brand_usage AS
SELECT 
    u.id AS user_id,
    u.full_name,
    sp.name AS plan_name,
    sp.included_brands,
    COALESCE(us.extra_brands, 0) AS extra_brands,
    COALESCE(sp.max_brands, 999) AS max_brands_cap,
    LEAST(
        sp.included_brands + COALESCE(us.extra_brands, 0),
        COALESCE(sp.max_brands, 999)
    ) AS total_brands_allowed,
    COUNT(b.id) AS brands_used,
    LEAST(
        sp.included_brands + COALESCE(us.extra_brands, 0),
        COALESCE(sp.max_brands, 999)
    ) - COUNT(b.id) AS brands_remaining,
    sp.price_per_extra_brand,
    -- Can this plan even buy extra brands?
    CASE 
        WHEN sp.max_brands IS NOT NULL AND sp.max_brands <= sp.included_brands THEN FALSE
        ELSE TRUE
    END AS can_buy_extra_brands
FROM users u
LEFT JOIN user_subscriptions us ON us.user_id = u.id AND us.status IN ('active', 'trialing')
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
LEFT JOIN brands b ON b.owner_id = u.id AND b.is_active = TRUE
WHERE u.platform_role = 'user'
GROUP BY u.id, u.full_name, sp.name, sp.included_brands, us.extra_brands, sp.max_brands, sp.price_per_extra_brand;


-- ============================================================================
-- 1h. PAYMENT HISTORY
-- ============================================================================

CREATE TABLE payment_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id     UUID REFERENCES user_subscriptions(id),
    brand_id            UUID REFERENCES brands(id) ON DELETE SET NULL, -- for brand-specific charges (extra seats)
    
    amount              DECIMAL(10,2) NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
    description         VARCHAR(500),           -- "Team plan - Monthly", "2 extra seats"
    
    -- Stripe
    stripe_invoice_id       VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    stripe_receipt_url      TEXT,
    
    status              VARCHAR(20) NOT NULL DEFAULT 'succeeded'
                        CHECK (status IN ('succeeded', 'pending', 'failed', 'refunded')),
    
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payment_history(user_id);
CREATE INDEX idx_payments_brand ON payment_history(brand_id);
CREATE INDEX idx_payments_subscription ON payment_history(subscription_id);


-- ============================================================================
-- 2. BRANDS / COMPANIES
-- ============================================================================

CREATE TABLE brands (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    slug                VARCHAR(255) NOT NULL UNIQUE,  -- URL-friendly: "flaske", "skinglow"
    logo_url            TEXT,
    website             VARCHAR(500),
    industry            VARCHAR(100),
    description         TEXT,
    
    -- The user who created/owns this brand
    owner_id            UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_brands_owner ON brands(owner_id);
CREATE INDEX idx_brands_slug ON brands(slug);


-- ============================================================================
-- 3. BRAND MEMBERS (Role-Based Access Per Brand)
-- ============================================================================
-- This is how collaborators get access to a brand.
-- A Brand Owner adds a collaborator here.
-- Same user can appear in MULTIPLE brands with different roles.
--
-- EXAMPLE:
--   Maria (Brand Owner of Flaske) invites Juan as 'collaborator'
--   Maria also owns SkinGlow but does NOT add Juan there
--   Juan can ONLY see Flaske data, NOT SkinGlow
--   Later, SkinGlow owner invites Juan too → Juan now sees both

CREATE TABLE brand_members (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Role within THIS brand
    -- 'owner'        = full control, can invite/remove members, delete brand
    -- 'admin'        = can manage influencers, campaigns, settings (not delete brand)
    -- 'collaborator' = can view and manage influencers & campaigns (no settings)
    -- 'viewer'       = read-only access
    role                VARCHAR(20) NOT NULL DEFAULT 'collaborator'
                        CHECK (role IN ('owner', 'admin', 'collaborator', 'viewer')),
    
    invited_by          UUID REFERENCES users(id),
    invited_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(brand_id, user_id)  -- one membership per user per brand
);

CREATE INDEX idx_brand_members_user ON brand_members(user_id);
CREATE INDEX idx_brand_members_brand ON brand_members(brand_id);


-- ============================================================================
-- 4. BRAND INVITATIONS (Pending Invites)
-- ============================================================================
-- When a Brand Owner invites a collaborator who hasn't accepted yet

CREATE TABLE brand_invitations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    email               VARCHAR(255) NOT NULL,  -- invited email (may not have account yet)
    role                VARCHAR(20) NOT NULL DEFAULT 'collaborator'
                        CHECK (role IN ('admin', 'collaborator', 'viewer')),
    invited_by          UUID NOT NULL REFERENCES users(id),
    token               VARCHAR(255) NOT NULL UNIQUE,  -- unique invite link token
    
    status              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    
    expires_at          TIMESTAMPTZ NOT NULL,
    accepted_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(brand_id, email)  -- one active invite per email per brand
);

CREATE INDEX idx_invitations_token ON brand_invitations(token);
CREATE INDEX idx_invitations_email ON brand_invitations(email);


-- ============================================================================
-- 5. INFLUENCERS (Global — Shared Across All Brands)
-- ============================================================================
-- Ms. Aliyah exists ONCE here, regardless of how many brands work with her.
-- No brand-specific data lives here — only her public profile info.

CREATE TABLE influencers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle              VARCHAR(255) NOT NULL,        -- @aliyah
    platform            VARCHAR(50) NOT NULL           -- instagram, tiktok, youtube
                        CHECK (platform IN ('instagram', 'tiktok', 'youtube', 'twitter', 'other')),
    full_name           VARCHAR(255),
    email               VARCHAR(255),
    gender              VARCHAR(20),
    niche               VARCHAR(100),
    location            VARCHAR(255),
    country             VARCHAR(100),
    bio                 TEXT,
    profile_image_url   TEXT,
    social_link         TEXT,
    
    -- These are public stats (can be refreshed periodically)
    followers_count     INTEGER,
    engagement_rate     DECIMAL(5,2),
    avg_likes           INTEGER,
    avg_comments        INTEGER,
    avg_views           INTEGER,
    
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Same handle on different platforms = different person/record
    UNIQUE(handle, platform)
);

CREATE INDEX idx_influencers_handle ON influencers(handle);
CREATE INDEX idx_influencers_platform ON influencers(platform);
CREATE INDEX idx_influencers_email ON influencers(email);
CREATE INDEX idx_influencers_niche ON influencers(niche);


-- ============================================================================
-- 6. CAMPAIGNS (Optional grouping within a brand)
-- ============================================================================
-- A brand can organize collaborations into campaigns
-- e.g., "Summer 2025 Launch", "Holiday Gift Guide"

CREATE TABLE campaigns (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    description         TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    start_date          DATE,
    end_date            DATE,
    budget              DECIMAL(12,2),
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_brand ON campaigns(brand_id);


-- ============================================================================
-- 7. BRAND_INFLUENCERS (THE CORE JOIN TABLE)
-- ============================================================================
-- This is where ALL brand-specific data lives.
-- Brand A's relationship with Ms. Aliyah is 100% separate from Brand B's.
--
-- EXAMPLE:
--   Row 1: Flaske + Ms. Aliyah → Stage 3, Delivered, Posted ✅, 217 likes
--   Row 2: SkinGlow + Ms. Aliyah → Stage 2, Contacted, no product sent yet
--   Flaske CANNOT see Row 2. SkinGlow CANNOT see Row 1.

CREATE TABLE brand_influencers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    influencer_id       UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
    campaign_id         UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    
    -- ── PIPELINE STAGE ──
    -- 1 = Discovery (found, not yet contacted)
    -- 2 = Qualified (vetted, outreach started)
    -- 3 = Confirmed (agreed, product being sent)
    -- 4 = Completed (content posted, campaign done)
    stage               INTEGER NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 4),
    
    -- ── OUTREACH (Stage 2) ──
    contact_status      VARCHAR(30) DEFAULT 'pending'
                        CHECK (contact_status IN (
                            'pending', 'contacted', 'responded', 'replied',
                            'agreed', 'not_interested', 'email_error', 
                            'no_response', 'paid_collab', 'negotiating'
                        )),
    contact_date        TIMESTAMPTZ,
    follow_up_date      TIMESTAMPTZ,
    outreach_notes      TEXT,
    
    -- ── PRODUCT & SHIPPING (Stage 3) ──
    product             VARCHAR(500),
    product_cost        DECIMAL(10,2),
    engraving           VARCHAR(255),
    engraving_font      VARCHAR(100),
    shipping_address    TEXT,
    phone_number        VARCHAR(50),
    tracking_link       TEXT,
    order_status        VARCHAR(30) DEFAULT 'not_sent'
                        CHECK (order_status IN (
                            'not_sent', 'sent_to_email', 'in_transit', 
                            'delivered', 'delivery_problem', 'returned'
                        )),
    sent_date           TIMESTAMPTZ,
    delivered_date      TIMESTAMPTZ,
    
    -- ── CONTENT TRACKING (Stage 3-4) ──
    content_follow_up_1 BOOLEAN DEFAULT FALSE,
    content_follow_up_2 BOOLEAN DEFAULT FALSE,
    content_follow_up_3 BOOLEAN DEFAULT FALSE,
    content_notes       TEXT,
    posted              BOOLEAN NOT NULL DEFAULT FALSE,
    post_link           TEXT,
    date_posted         TIMESTAMPTZ,
    raw_file_url        TEXT,
    posted_content_url  TEXT,
    ad_code             VARCHAR(255),
    usage_rights        BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- ── ENGAGEMENT METRICS (Stage 4) ──
    likes               INTEGER,
    comments            INTEGER,
    views               INTEGER,
    
    -- ── CONVERSION TRACKING ──
    traffic             INTEGER,
    sales_orders        INTEGER,
    sales_amount        DECIMAL(12,2),
    
    -- ── AFFILIATE PROGRAM ──
    affiliate_invited   BOOLEAN NOT NULL DEFAULT FALSE,
    affiliate_signed_up BOOLEAN NOT NULL DEFAULT FALSE,
    affiliate_date      TIMESTAMPTZ,
    affiliate_link      TEXT,
    discount_code       VARCHAR(100),
    
    -- ── INTERNAL ──
    internal_notes      TEXT,
    added_by            UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One record per influencer per brand (the golden rule)
    UNIQUE(brand_id, influencer_id)
);

CREATE INDEX idx_brand_inf_brand ON brand_influencers(brand_id);
CREATE INDEX idx_brand_inf_influencer ON brand_influencers(influencer_id);
CREATE INDEX idx_brand_inf_stage ON brand_influencers(brand_id, stage);
CREATE INDEX idx_brand_inf_status ON brand_influencers(brand_id, contact_status);
CREATE INDEX idx_brand_inf_campaign ON brand_influencers(campaign_id);
CREATE INDEX idx_brand_inf_order ON brand_influencers(brand_id, order_status);


-- ============================================================================
-- 8. OUTREACH HISTORY (Email/Message Log)
-- ============================================================================
-- Track every outreach attempt, not just the latest status

CREATE TABLE outreach_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_influencer_id UUID NOT NULL REFERENCES brand_influencers(id) ON DELETE CASCADE,
    type                VARCHAR(30) NOT NULL
                        CHECK (type IN ('email', 'dm', 'phone', 'other')),
    subject             VARCHAR(500),
    message             TEXT,
    status              VARCHAR(20) NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('draft', 'sent', 'delivered', 'opened', 'replied', 'bounced')),
    sent_by             UUID REFERENCES users(id),
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outreach_brand_inf ON outreach_logs(brand_influencer_id);


-- ============================================================================
-- 9. CONTENT SUBMISSIONS
-- ============================================================================
-- If an influencer posts multiple pieces of content for one collaboration

CREATE TABLE content_posts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_influencer_id UUID NOT NULL REFERENCES brand_influencers(id) ON DELETE CASCADE,
    post_link           TEXT NOT NULL,
    platform            VARCHAR(50),
    post_type           VARCHAR(30) DEFAULT 'post'
                        CHECK (post_type IN ('post', 'story', 'reel', 'video', 'short', 'live')),
    date_posted         TIMESTAMPTZ,
    
    -- Metrics per post
    likes               INTEGER,
    comments            INTEGER,
    views               INTEGER,
    shares              INTEGER,
    saves               INTEGER,
    
    raw_file_url        TEXT,
    approved            BOOLEAN DEFAULT FALSE,
    usage_rights        BOOLEAN DEFAULT FALSE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_content_brand_inf ON content_posts(brand_influencer_id);


-- ============================================================================
-- 10. ACTIVITY LOG (Audit Trail)
-- ============================================================================
-- Track who did what — important for multi-user brands

CREATE TABLE activity_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
    user_id             UUID REFERENCES users(id),
    action              VARCHAR(100) NOT NULL,   -- 'influencer.added', 'status.changed', etc.
    entity_type         VARCHAR(50),             -- 'brand_influencer', 'campaign', etc.
    entity_id           UUID,
    details             JSONB,                   -- { "from": "contacted", "to": "agreed" }
    ip_address          INET,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_brand ON activity_logs(brand_id);
CREATE INDEX idx_activity_user ON activity_logs(user_id);
CREATE INDEX idx_activity_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at);


-- ============================================================================
-- 11. NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand_id            UUID REFERENCES brands(id) ON DELETE CASCADE,
    type                VARCHAR(50) NOT NULL,    -- 'invite', 'status_change', 'content_posted'
    title               VARCHAR(255) NOT NULL,
    message             TEXT,
    link                TEXT,
    is_read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);


-- ============================================================================
-- 12. PLATFORM SETTINGS (Super Admin Only)
-- ============================================================================

CREATE TABLE platform_settings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key                 VARCHAR(100) NOT NULL UNIQUE,
    value               JSONB NOT NULL,
    updated_by          UUID REFERENCES users(id),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- HELPER VIEWS
-- ============================================================================

-- Quick view: Brand's influencer pipeline with influencer details
CREATE VIEW vw_brand_pipeline AS
SELECT 
    bi.id AS brand_influencer_id,
    bi.brand_id,
    b.name AS brand_name,
    bi.influencer_id,
    i.handle,
    i.platform,
    i.full_name,
    i.followers_count,
    i.engagement_rate,
    i.niche,
    bi.stage,
    bi.contact_status,
    bi.order_status,
    bi.posted,
    bi.likes,
    bi.comments,
    bi.views,
    bi.created_at
FROM brand_influencers bi
JOIN influencers i ON i.id = bi.influencer_id
JOIN brands b ON b.id = bi.brand_id;


-- Quick view: Brand outreach stats (like your Google Sheet summary)
CREATE VIEW vw_brand_outreach_stats AS
SELECT 
    bi.brand_id,
    b.name AS brand_name,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE bi.contact_status = 'contacted') AS contacted,
    COUNT(*) FILTER (WHERE bi.contact_status = 'responded') AS responded,
    COUNT(*) FILTER (WHERE bi.contact_status = 'not_interested') AS not_interested,
    COUNT(*) FILTER (WHERE bi.contact_status = 'email_error') AS email_error,
    COUNT(*) FILTER (WHERE bi.contact_status = 'agreed') AS agreed,
    COUNT(*) FILTER (WHERE bi.contact_status = 'no_response') AS no_response,
    ROUND(
        COUNT(*) FILTER (WHERE bi.contact_status = 'responded')::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 2
    ) AS response_rate
FROM brand_influencers bi
JOIN brands b ON b.id = bi.brand_id
GROUP BY bi.brand_id, b.name;


-- ============================================================================
-- EXAMPLE: How the data looks for Ms. Aliyah
-- ============================================================================
--
-- influencers table (ONE ROW):
-- ┌──────────┬─────────┬───────────┬────────────┬────────┐
-- │ id       │ handle  │ platform  │ full_name  │ 45000  │
-- │ uuid-001 │ aliyah  │ instagram │ Ms. Aliyah │ 45000  │
-- └──────────┴─────────┴───────────┴────────────┴────────┘
--
-- brand_influencers table (TWO ROWS, same influencer_id):
-- ┌──────────┬───────────┬───────────────┬───────┬───────────┬────────┐
-- │ id       │ brand_id  │ influencer_id │ stage │ status    │ posted │
-- │ uuid-101 │ Flaske    │ uuid-001      │ 3     │ agreed    │ true   │
-- │ uuid-102 │ SkinGlow  │ uuid-001      │ 2     │ contacted │ false  │
-- └──────────┴───────────┴───────────────┴───────┴───────────┴────────┘
--
-- Flaske queries WHERE brand_id = 'Flaske'   → sees row uuid-101 only
-- SkinGlow queries WHERE brand_id = 'SkinGlow' → sees row uuid-102 only
-- Ms. Aliyah is NEVER duplicated in the influencers table
-- ============================================================================
