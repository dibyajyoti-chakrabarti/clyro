# Clyro Landing Page — Audit Report

Read-only audit. Entry point: `frontend/src/pages/marketing/Landing.jsx`, mounted at `/` via `frontend/src/routes/index.jsx` (outside `PublicLayout` — it owns its own chrome). `Pricing.jsx` lives at `/pricing` as a **separate route**; it is only reachable from the landing page via links, not rendered by it.

---

## 1. Overview

### File/folder structure

```
frontend/src/pages/marketing/Landing.jsx                (entry point)
frontend/src/pages/marketing/Pricing.jsx                 (separate route — linked from Landing, not part of it)
frontend/src/pages/marketing/landing/
  HeroSection.jsx        [LIVE]
  HowClyroWorks.jsx      [LIVE]
  FeatureShowcase.jsx    [LIVE]
  BuiltForEngineers.jsx  [LIVE]
  FinalCTA.jsx           [LIVE]
  LandingNavbar.jsx      [LIVE]
  LandingFooter.jsx      [LIVE]
  Hero.jsx               [DEAD — unused]
  CTA.jsx                [DEAD — unused]
  Testimonials.jsx       [DEAD — unused]
  TrustedBy.jsx          [DEAD — unused]
  HowItWorks.jsx         [DEAD — unused]
  WhyCrylo.jsx           [DEAD — unused]
  WhyCrylo.module.css    [DEAD — unused]
  WhyCrylo-global.css    [DEAD — unused]
  ParticleSwarm.jsx      [DEAD — unused]
frontend/src/index.css                                   (design tokens, Tailwind v4 @theme block)
frontend/tailwind.config.js                               (effectively inert under Tailwind v4 — see §4)
frontend/src/components/ui/Button.jsx                     (used by Pricing + dead CTA.jsx only, NOT by live landing sections)
frontend/src/components/common/GitHubLogo.jsx             (used by dead TrustedBy.jsx only)
frontend/src/components/marketing/HowItWorksCard.jsx      (used by dead HowItWorks.jsx only)
frontend/src/hooks/useHowItWorksAnimation.js              (used by dead HowItWorks.jsx only)
frontend/src/routes/index.jsx                             (mounts Landing at '/', Pricing at '/pricing')
```

Of 16 files in `landing/`, only **7 are actually rendered**. The other 9 — including a GSAP-animated CTA, a WebGL particle-shader hero backdrop, an IntersectionObserver-driven testimonials section, and a full CSS-Modules feature grid — are orphaned. See §4.

### Tech stack

- React 19.1.1 / react-dom 19.1.1, react-router-dom 7.15.1
- Tailwind CSS 4.3.0 via `@tailwindcss/vite` — **CSS-first config** (theme resolved from `@theme` in `index.css`, not from `tailwind.config.js`)
- `lucide-react` for icons (used throughout live sections)
- `gsap` — installed, but only consumed by dead `CTA.jsx`
- `lottie-react`, `@fontsource/geist`, `@monaco-editor/react`, `aws-amplify`, `react-markdown`, `yaml` — present in the app but not used by live landing sections
- **No `framer-motion`** anywhere in the project
- Vite 7.1.2, ESLint 9
- All live landing sections use plain Tailwind utility classes with no animation library — static layout, hover transitions only

### Page flow (order rendered by `Landing.jsx`)

1. `LandingNavbar` — sticky pill nav
2. `HeroSection` — hero + pain points + solution overview (merged)
3. `HowClyroWorks` (`#how-it-works`) — 5-step process
4. `FeatureShowcase` (`#features`) — 6-feature grid
5. `BuiltForEngineers` (`#company`) — checklist + illustration
6. `FinalCTA` — conversion band
7. `LandingFooter`

Root wrapper: `<div className="min-h-screen bg-marketing-bg-warm text-marketing-text-primary">`, with `<main className="-mt-20 w-full">` pulling content up under the floating navbar so Hero's gradient/dot/glow background shows through the gap around the pill nav rather than the flat root background.

---

## 2. Per-Section Breakdown

### LandingNavbar
**File:** `frontend/src/pages/marketing/landing/LandingNavbar.jsx`

- **Purpose:** Sticky global nav with product links and auth CTAs.
- **Layout:** `sticky top-4 z-50`, rounded-2xl glass pill card — `bg-marketing-near-black/70`, `backdrop-blur-xl`, `border-white/10`. Mobile menu toggled via `useState` (hamburger `Menu`/`X` icons from lucide), collapsible panel under `md:hidden`.
- **Content/links:** Product (chevron, `#features`), How It Works (`#how-it-works`), Pricing (`/pricing`), Resources (chevron, `#resources` — dead anchor), Docs (`#` — placeholder, dead), About (`#company`). CTAs: "Log in" (`/login`, `border-white/10`), "Get Started Free →" (`/signup`, `bg-marketing-amber-2`, black text, `border-2 border-black`).
- **Styling:** gold/black/white accent system, rounded pill shape throughout.
- **State:** local `useState` for mobile menu open/close only.

### HeroSection
**File:** `frontend/src/pages/marketing/landing/HeroSection.jsx`

- **Purpose:** Combined hero, pain-point agitation, and solution overview — three sub-blocks sharing one continuous "deep space" backdrop.
- **Backdrop:** radial gradient `#1c1830 → #0d0b16`, layered dot-pattern radial gradients, two blurred glow orbs (`amber-core/10`, `bronze/10`, `blur-[110px]`), `rounded-b-[2.5rem]`.
- **Hero copy:** H1 "From Idea to Cloud Infrastructure, **Powered by AI.**" (gradient text `amber-2 → amber-light`, underline accent), rendered at `text-[2.75rem]`. Lead: "Clyro designs, reviews and deploys production-ready cloud infrastructure in minutes — so you can ship faster." CTAs: "Start Building for Free →" (`/signup`, amber pill), "View Plans" (`/pricing`, outline + `PlayCircle` icon). Illustration: `hero_section_ill_first.webp`. Layout: `lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`.
- **Pain-points strip:** 3-col (`sm:grid-cols-3`) — "Spending too much time designing AWS architecture?", "Still provisioning cloud infrastructure manually?", "Not sure your infra is secure, scalable & cost-efficient?" — each paired with a `.webp` illustration.
- **Solution block:** H2 "We build and evolve your cloud infrastructure", lead "From architecture to production — Clyro handles the complexity behind your AWS infrastructure." 6-item icon grid (Rocket/UploadCloud/Activity/Sparkles/Calculator/TrendingUp: Architecture Generation, One-Click Provisioning, Real-time Monitoring, AI-Powered Reviews, Cost Estimation, Continuous Optimization) plus `second_ill_hero_section.webp`. Layout: `lg:grid-cols-[1fr_1.15fr]`.
- **Animation:** none — static, hover-only transitions.
- **Note:** the H1's `text-[2.75rem]` does not match the `--font-size-display: 3.5rem` token that's documented (in `index.css`) as reserved for "hero H1 only" — see §4.

### HowClyroWorks
**File:** `frontend/src/pages/marketing/landing/HowClyroWorks.jsx`

- **Purpose:** 5-step process explainer.
- **Section id:** `how-it-works`. Background `bg-marketing-gold-pale`, `-mt-10` to overlap the Hero section above it.
- **Copy:** H2 "How Clyro Works" (`text-marketing-bronze-dark`), lead "Go from an idea to a fully provisioned cloud environment in minutes."
- **Layout:** `lg:grid-cols-5`, each step a `bg-marketing-cream-2` rounded-2xl card with a numbered black-circle badge, a `.webp` illustration (`step1-5-ill.webp`), title, and body copy: "Describe Your Idea" → "AI Designs Architecture" → "Review & Customize" → "One-Click Deploy" → "Monitor & Optimize".
- **Styling note:** body copy uses hardcoded `text-[#6B665C]` rather than a `marketing-*` token.

### FeatureShowcase
**File:** `frontend/src/pages/marketing/landing/FeatureShowcase.jsx`

- **Purpose:** Core feature grid.
- **Section id:** `features`. Outer `bg-marketing-gold-pale`, inner `bg-marketing-near-black` rounded card at `w-[99%]`.
- **Copy:** H2 "Feature Showcase" (amber-2 highlight), lead "Everything you need to design, validate, and deploy cloud architectures."
- **Layout:** `lg:grid-cols-[0.9fr_1.1fr]` — `featureShowcaseIllustration.webp` on the left, 2-col feature grid on the right. 6 features, each with an identical `bg-marketing-amber-core` / black icon badge (Bot/BadgeCheck/Workflow/Rocket/Calculator/BellRing): AI Guidance, Best Practice Check, Visual Architecture, One-Click Deployment, Cost Estimation, Monitoring & Alerts.

### BuiltForEngineers
**File:** `frontend/src/pages/marketing/landing/BuiltForEngineers.jsx`

- **Purpose:** Trust/credibility checklist aimed at engineers.
- **Section id:** `company`. Background flat `bg-[#0C0E17]` — hardcoded hex, not a `marketing-*` token (inconsistency).
- **Copy:** rotated badge "Built for Developers" (`bg-marketing-bronze`, inline `rotate(-2deg)`, `border-2 border-black`). H2 "Everything you need to build and run in the cloud." Checklist (5 items, amber-core check-circle icons): AI-generated architecture diagrams, Automatic AWS provisioning, Cost/performance/security insights, Real-time monitoring & alerts, Built-in best practices. CTA "Explore All Features →" (`#features`, outline style).
- **Layout:** `lg:grid-cols-2`, illustration `everything_needed_ill.webp`.

### FinalCTA
**File:** `frontend/src/pages/marketing/landing/FinalCTA.jsx`

- **Purpose:** Final conversion band before the footer.
- **Styling:** flat full-bleed `bg-marketing-amber-2`, dark text (`text-marketing-bg-deep`).
- **Copy:** H2 "Ready to move from idea to cloud?" Lead "Start building your infrastructure now. No credit card required." CTAs: "Start Building Free →" (`/signup`, inverted dark pill), "View Plans" (`/pricing`, outline). Fine print: "Free 14-day trial • No credit card • Cancel anytime".

### LandingFooter
**File:** `frontend/src/pages/marketing/landing/LandingFooter.jsx`

- **Styling:** `bg-marketing-bg-deep`.
- **Layout:** `lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))]`.
- **Content:** brand blurb ("AI-powered cloud infrastructure platform that helps engineers build, deploy, and optimize on AWS."); columns — Product (Features `#features`, Pricing `/pricing`, How It Works `#how-it-works`), Resources (Documentation `#docs`, Blog `#blog` — dead anchors), Company (About Us `#about`, Contact `#contact`, Privacy Policy `#privacy`, Terms of Service `#terms` — all dead anchors, no real pages exist). Bottom bar: "© 2026 Clyro. All rights reserved." + 3 social icons (Twitter/LinkedIn/GitHub, `invert` CSS filter applied to SVGs) — **all three hardcode `href="/"`** instead of real profile URLs (bug).

---

## 3. Global Styling

### Design tokens — `frontend/src/index.css`

`@import '@fontsource/geist'; @import 'tailwindcss';` then a Tailwind v4 `@theme { ... }` block.

**App theme** (routed through `--c-*`-style CSS vars so `PreferencesProvider`'s `data-theme` attribute can re-skin light/dark):
- Dark baseline (`:root`): background `#111318`, surface `#1c1e26`, border `#2c2e38`, accent `#f97316`, accent-soft `#431407`, text-primary `#eeeef0`, text-muted `#6b7080`, success `#22c55e`, danger `#ef4444`, body `#040404`.
- Light override (`:root[data-theme='light']`): background `#f6f7f9`, surface `#ffffff`, border `#e3e5ec`, accent `#f97316` (unchanged), accent-soft `#ffedd5`, text-primary `#1a1c22`, text-muted `#5b6070`, success `#16a34a`, danger `#dc2626`, body `#eceef2`.

**Marketing-only fixed-dark tokens** (never adapt to app light/dark, per code comment): `marketing-dark #0d0b16`, `marketing-dark-surface #161421`, `marketing-amber #f4c430`, `marketing-amber-soft rgba(244,196,48,.14)`, `marketing-amber-border rgba(244,196,48,.4)`, `marketing-ink #f7f6f3`, `marketing-muted #a6a3b5`.

**Legacy "background ladder" system** (amber/teal/violet/blue rotation — comment says kept "in case anything still references them", superseded by the system below): `marketing-bg-base #0b0b12`, `marketing-bg-warm #0d0d14` (Landing root bg), `marketing-bg-cool #0a0e1a`, `marketing-bg-deep #08080d` (FinalCTA/footer), `marketing-bg-card #14141d`, `marketing-bg-elevated #1e1e29`, `marketing-border-hairline #22222e`, `marketing-text-primary #f5f5f7`, `marketing-text-secondary #a6a6b3`, `marketing-text-muted-2 #7a7a87`, `marketing-amber-2 #f2b705`, `marketing-amber-light #ffd874`, `marketing-teal #2dd4bf`, `marketing-violet #a78bfa`, `marketing-blue #60a5fa` (plus 12%-alpha soft variants).

**Current gold/black/white accent system** (comment: "replaces the teal/violet/blue rotation above for all landing-page usage going forward" — a 5-step badge cycle): `marketing-cream-2 #fdf6e3`, `marketing-gold-pale #f5dfa0`, `marketing-gold-light #f2cb6b`, `marketing-amber-core #f2b705` (**identical value to `amber-2`** — duplicate token from two design-system generations), `marketing-amber-deep #d89a05`, `marketing-bronze #b8860b`, `marketing-bronze-dark #5c4510`, `marketing-near-black #0b0b0a`, `marketing-true-black #000000`, `marketing-warm-gray #a6a29a`.

**Golden-ratio type scale** (comment: shared ~1.618 scale, applied via arbitrary Tailwind values, e.g. `text-[2.75rem]`, not default Tailwind size classes): `--font-size-display: 3.5rem` (documented as hero H1 — **actually unused**, Hero uses `text-[2.75rem]`), `--font-size-display-lg: 4.5rem` (documented desktop hero — also unused in code), `--font-size-h2: 2.75rem` (matches actual H2 usage), `--font-size-h3: 1.7rem`, `--font-size-lead: 1.375rem` (matches lead paragraph usage), `--font-size-body: 1rem`, `--font-size-small: 0.85rem`, `--font-size-micro: 0.75rem`.

**Base styles:** `font-family: 'Geist', Inter, system-ui, -apple-system, sans-serif`; `scroll-behavior: smooth`; custom scrollbar (`#2c2e38` thumb, transparent track); `::selection` uses `rgba(249,115,22,.22)` — the **app's orange accent**, not any marketing gold token (a cross-theme leak, since Landing otherwise never touches `--c-accent`).

### Reusable UI components

- `frontend/src/components/ui/Button.jsx` — variants `primary/secondary/ghost/danger/link`, sizes `sm/md/lg`, built on **app tokens** (`amber-300/400/500`, `text-primary`, `accent`, `danger`), not marketing tokens. **Not used by any live landing section** — only consumed by `Pricing.jsx` and the dead `CTA.jsx`. All 7 live landing sections hand-roll their own `<Link>`/`<a>` buttons with bespoke Tailwind classes instead.
- No shared Card component exists; `HowClyroWorks`, `FeatureShowcase`, and `BuiltForEngineers` each build card markup inline, independently.

### Responsive/breakpoint strategy

Standard Tailwind breakpoints (`sm`/`md`/`lg`) used ad hoc per section — no shared layout primitive. Typical pattern: single column on mobile, `lg:grid-cols-N` (or arbitrary fractional templates like `lg:grid-cols-[1fr_1.15fr]`) at desktop. Nav collapses to a hamburger below `md`.

---

## 4. Observations

### Dead code — 9 of 16 files in `landing/` are unused
Verified by tracing the import graph from `Landing.jsx` and grepping the rest of `frontend/src` for references. None of the following are imported anywhere:

| File | What it is |
|---|---|
| `Hero.jsx` | Alternate hero ("Deploy to AWS. Without the complexity."), plain CSS `<style>` keyframe animation, uses `hero_background.png` |
| `CTA.jsx` | GSAP/ScrollTrigger-animated CTA card, imports `Button` and `gsap` |
| `Testimonials.jsx` | "Loved by Builders" section, inline-style heavy, IntersectionObserver fade-ins, single testimonial (Anish Agrawal / IndieShop) |
| `TrustedBy.jsx` | "BUILT WITH" logo strip (AWS/GitHub/Terraform/CloudFront), imports `GitHubLogo` |
| `HowItWorks.jsx` | A *different*, full-viewport pinned/scroll-driven 5-step card stack; imports `HowItWorksCard` + `useHowItWorksAnimation` hook + `.webp` assets — duplicate concept vs. the live `HowClyroWorks.jsx` |
| `WhyCrylo.jsx` + `.module.css` + `-global.css` | "Why Clyro?" 4-card expand/collapse grid with shatter/dot-particle hover effects, CSS Houdini `@property` animated gradients |
| `ParticleSwarm.jsx` | WebGL/GLSL 24,000-particle Fibonacci-sphere shader backdrop, `ResizeObserver` + `prefers-reduced-motion` handling — sophisticated, entirely orphaned |

This represents significant unshipped design/animation investment (GSAP timelines, WebGL shaders, CSS Houdini) sitting alongside a much simpler, fully static live page.

### `tailwind.config.js` is effectively inert
Tailwind v4 resolves theme from `@theme` in CSS, not the JS config, and `index.css` never opts back in via `@config`. So `tailwind.config.js`'s color definitions (`background`, `accent`, etc.) don't apply anywhere in the live app — it's a stale leftover from a pre-v4 setup.

### Duplicate/conflicting tokens
- `marketing-amber-2` and `marketing-amber-core` are both `#f2b705` — same color, two names, artifacts of two different design-system generations (both still in active use across different sections).
- `--font-size-display` (3.5rem) and `--font-size-display-lg` (4.5rem) are documented for the hero but the hero actually renders at `text-[2.75rem]` (the H2 size) — token and usage disagree.

### Hardcoded values bypassing the token system
- `BuiltForEngineers.jsx`: `bg-[#0C0E17]` instead of a `marketing-bg-*` token.
- `HowClyroWorks.jsx`: `text-[#6B665C]` instead of a `marketing-*` text token.

### Styling approach is inconsistent between live and dead code
Live sections are 100% Tailwind utility classes — clean and uniform. The dead sections mix Tailwind + CSS Modules (`WhyCrylo.module.css`) + a scoped global stylesheet (`WhyCrylo-global.css`) + heavy inline `style={}` objects (`Testimonials.jsx`, `WhyCrylo.jsx`, `CTA.jsx`). If any were resurrected, they'd clash with the live page's approach.

### Broken/placeholder links
- Nav: "Docs" → `#`, "Resources" → `#resources`.
- Footer: "Documentation" → `#docs`, "Blog" → `#blog`, "About Us" → `#about`, "Contact" → `#contact`, "Privacy Policy" → `#privacy`, "Terms of Service" → `#terms` — none of these anchors/pages exist.
- Footer social icons (Twitter/LinkedIn/GitHub) all hardcode `href="/"` instead of real profile URLs.

### Reusable patterns worth extracting
- The numbered-badge card pattern (`HowClyroWorks`) and the icon-badge feature-item pattern (`FeatureShowcase`, `HeroSection`'s solution grid) are visually identical across sections but implemented independently each time — a shared `<FeatureCard>`/`<StepCard>` component would remove duplication.
- CTA buttons ("Start Building Free →", "View Plans", etc.) are hand-rolled per section rather than using the existing `components/ui/Button.jsx`, despite that component already supporting the needed variants.

### No TODOs or commented-out code
No `TODO`/`FIXME` markers or dead commented-out code blocks were found in any live or dead landing file — only explanatory prose comments (e.g. the token-system comments in `index.css`, the `-mt-20` layout-intent comment in `Landing.jsx`).
