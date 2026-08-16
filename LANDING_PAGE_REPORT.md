# Clyro Landing Page — Audit Report

Repo root: `D:\crylo_code\clyro` · Frontend root: `D:\crylo_code\clyro\frontend`
Audit performed read-only against branch `feat/ui`.

---

## 1. Overview

### File/folder structure (everything comprising the actual rendered landing page)

```
frontend/src/pages/marketing/Landing.jsx                  entry point (route: "/")
frontend/src/pages/marketing/landing/
  ├─ LandingNavbar.jsx        chrome — sticky pill navbar
  ├─ HeroSection.jsx          hero + merged pain-points/solution block
  ├─ HowClyroWorks.jsx        5-step "how it works" section
  ├─ FeatureShowcase.jsx      dark feature-showcase panel
  ├─ BuiltForEngineers.jsx    checklist + mock-window section
  ├─ FinalCTA.jsx             closing CTA band
  └─ LandingFooter.jsx        chrome — footer

frontend/src/index.css                                     Tailwind v4 @theme tokens (incl. marketing-*)
frontend/src/routes/index.jsx                               mounts <Landing/> at "/"
frontend/src/assets/logos/Clyro_logo.png                    navbar logo
frontend/src/assets/logos/{github,linkedin,twitter}-fill.svg  footer social icons
```

`frontend/src/pages/marketing/landing/ParticleSwarm.jsx` also exists in this folder (WebGL particle-sphere hero backdrop) but **is not imported by `HeroSection.jsx` or any other file** — see Observations.

### Tech stack (as actually used in these files)

- **Framework**: React 19 (`react@19.1.1`), function components, hooks (`useState`, `useEffect`, `useRef`).
- **Routing**: `react-router-dom@7.15.1` (`Link` used throughout for `/signup`, `/pricing`, `/login`, `/`).
- **Styling**: Tailwind CSS v4 (`tailwindcss@4.3.0`, `@tailwindcss/vite`) via utility classes almost exclusively. `frontend/tailwind.config.js` exists but is **inert** for this app — see §3. Design tokens are defined in CSS via `@theme` in `frontend/src/index.css`.
- **Icons**: `lucide-react` (`Zap`, `Check`, `PlayCircle`, `Menu`, `X`, `ChevronDown`, `Rocket`, `BadgeCheck`, `Bot`, `Workflow`, `BellRing`, `Calculator`, `Puzzle`, `BarChart`, `BarChart3`, `Shield`, `Sparkles`, `TrendingUp`, `UploadCloud`, `Activity` — all confirmed via direct imports in the 7 rendered files).
- **Fonts**: `@fontsource/geist`, imported in `index.css` line 1; `--font-family` fallback chain set in `:root` (`'Geist', Inter, system-ui, -apple-system, sans-serif`).
- **Animation libraries**: **None of `framer-motion`, `gsap`, or `lottie-react` are used by any of the 7 rendered landing components.** `gsap` and `lottie-react` are present in `package.json` dependencies but are only consumed by the *dead* files `CTA.jsx` (gsap + ScrollTrigger) and — for lottie — not found in any landing file at all (searched, no `lottie-react` import in `landing/`). All motion in the live page is plain CSS: Tailwind `transition-*`/`hover:*`/`focus-visible:*` utility classes, inline `transform: rotate()` styles, and one raw `<style>` block-free case (no keyframes in the live sections). The only true "animation" in the live tree is `ParticleSwarm.jsx`'s `requestAnimationFrame` WebGL loop — which is currently unused/orphaned (see Observations).
- **No CSS modules or scoped CSS are used by any of the 7 live components** (CSS Modules only appear in the dead `WhyCrylo.jsx`).

### Page layout/flow (order rendered by `Landing.jsx`, lines 12–29)

1. `LandingNavbar` (sticky chrome, rendered before `<main>`)
2. `HeroSection`
3. `HowClyroWorks`
4. `FeatureShowcase`
5. `BuiltForEngineers`
6. `FinalCTA`
7. `LandingFooter` (chrome, rendered after `<main>`)

Root wrapper: `<div className='min-h-screen bg-marketing-bg-warm text-marketing-text-primary'>` (`Landing.jsx:14`). `<main>` carries `className='-mt-20 w-full'` (`Landing.jsx:19`) — a deliberate negative margin so `HeroSection`'s dark atmosphere bleeds up behind the floating navbar pill (documented in the comment at `Landing.jsx:16-18`).

---

## 2. Per-Section Breakdown

### LandingNavbar — `frontend/src/pages/marketing/landing/LandingNavbar.jsx`

- **Purpose**: sticky floating pill navbar, landing-only (comment at lines 6-7: "Deliberately a copy of `components/layout/Navbar` rather than a change to it — that one is still rendered for `/pricing`, `/login` and `/signup`").
- **Copy**: nav items (`navItems`, lines 9-16): `Product` (→`#features`), `How It Works` (→`#how-it-works`), `Pricing` (→`/pricing`), `Resources` (→`#resources`), `Docs` (→`#`), `About` (→`#company`). CTA buttons: `Log in`, `Get Started Free →`.
- **Layout**: `header` is `sticky top-4 z-50`. Inner bar: `flex items-center justify-between gap-6 rounded-2xl ... px-5 py-3.5` (line 23). Desktop nav `hidden ... lg:flex` (line 33); auth buttons `hidden ... md:flex` (line 46); mobile hamburger `md:hidden` (line 64, wait — button has no `md:hidden`, it toggles at all sizes below `lg`/`md` via the surrounding hidden classes). Mobile dropdown panel `md:hidden` (line 74).
- **Styling**: `bg-marketing-near-black/70`, `backdrop-blur-xl`, `border border-white/10`, `shadow-lg shadow-black/20`. Primary CTA: `border-2 border-black bg-marketing-amber-2 ... hover:bg-black hover:text-marketing-amber-2` (color-invert hover, line 55).
- **Sub-components**: none (only `lucide-react` icons `Menu`, `X`, `ChevronDown`).
- **State/interactivity**: `const [isMenuOpen, setIsMenuOpen] = useState(false)` (line 19) toggles the mobile nav panel; no animation library, panel is conditionally rendered (`{isMenuOpen ? ... : null}`, line 73), no transition classes on open/close.
- **Assets**: imports `clyroLogo` from `../../../assets/logos/Clyro_logo.png` (line 4).

### HeroSection — `frontend/src/pages/marketing/landing/HeroSection.jsx`

- **Purpose**: primary above-the-fold hero + a merged "pain points → solution" block underneath, sharing one atmosphere layer (comment lines 95-97: "Single atmosphere layer shared by both Hero's own content and the merged pain-points/solution/feature-card content below — do not duplicate this per block").
- **Copy** (verbatim):
  - Eyebrow badge: `AI-Powered Cloud Infrastructure` (line 114)
  - H1: `From Idea to Cloud Infrastructure, Powered by AI.` (lines 118-120, "Powered by AI." is gradient-clipped text)
  - Lead: `Clyro designs, reviews and deploys production-ready cloud infrastructure in minutes — so you can ship faster.` (lines 129-131)
  - Primary CTA: `Start Building for Free →` → `/signup`; Secondary CTA: `Book a Demo` (with `PlayCircle` icon) → `/pricing`
  - Assurance list (`assurances`, line 18): `No credit card required`, `AI-Powered`, `Supports AWS`
  - Callout badges (`calloutBadges`, lines 20-57): `Scalable`, `Secure`, `Intelligent`, `Optimized` — decorative, `hidden lg:block` only (line 176)
  - Pain-points heading: `Is your cloud infrastructure becoming harder to build, manage, and scale?` (lines 192-195)
  - Pain points (`painPoints`, lines 59-81): "Spending too much time **designing AWS architecture**?", "Still **provisioning cloud infrastructure** manually?", "Not sure your infra is **secure, scalable & cost-efficient**?"
  - Solution heading: `We build and evolve your cloud infrastructure` (lines 215-219)
  - Solution lead: `From architecture to production — Clyro handles the complexity behind your AWS infrastructure.` (lines 220-224)
  - Bottom feature icons (`bottomFeatures`, lines 83-90): `Architecture Generation`, `One-Click Provisioning`, `Real-time Monitoring`, `AI-Powered Reviews`, `Cost Estimation`, `Continuous Optimization`
- **Layout**: outer `<section>` `relative z-10 overflow-hidden rounded-b-[2.5rem]`. Top block: `grid ... lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1.18fr)] lg:gap-6` (line 107) — text column + illustration column. Pain-points list: `grid grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6` (line 197). Solution block: `grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-16` (line 213). Bottom feature icon grid: `grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3` (line 226).
- **Styling**: backdrop is 3 stacked absolutely-positioned divs (lines 98-105): radial gradient base (`#1c1830` → `#0d0b16`), a dual radial-gradient dot pattern (star field, `background-size: 140px_140px,220px_220px`), and two blurred glow orbs (`blur-[110px]`) in `marketing-amber-core/[0.1]` and `marketing-bronze/[0.1]`. Illustration container: `rounded-2xl border-2 border-marketing-gold-light bg-white/[0.03] shadow-[0_30px_60px_rgba(0,0,0,0.45)]` — **contains only a text placeholder `<span>Illustration placeholder</span>` (line 170-172), no actual image**. Second illustration slot (line 238) is likewise just a bordered box with `Illustration placeholder` text — no image.
- **Sub-components**: none (icons only). `ParticleSwarm` is **not imported/rendered here** despite being colocated and hero-shaped.
- **Animation/interactivity**: none beyond Tailwind `hover:-translate-y-0.5 hover:brightness-110` and `transition-all`/`transition-colors` on the two CTA buttons (lines 136, 143). No `useState`/`useEffect`, no scroll-triggered reveal.
- **Notable**: `<h1>` uses `bg-gradient-to-r from-marketing-amber-2 to-marketing-amber-light bg-clip-text text-transparent` for "Powered by AI." plus a decorative underline `<span>` with the same gradient at 50% opacity (lines 121-124).

### HowClyroWorks — `frontend/src/pages/marketing/landing/HowClyroWorks.jsx`

- **Purpose**: 5-step process explainer, `id='how-it-works'` (anchor target for navbar link).
- **Copy**: Heading `How Clyro Works`; sub `Go from an idea to a fully provisioned cloud environment in minutes.` `steps` array (lines 1-22): `Describe Your Idea` / `AI Designs Architecture` / `Review & Customize` / `One-Click Deploy` / `Monitor & Optimize`, each with a one-line body.
- **Layout**: `<ol className='mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4'>` (line 38) — 1 col mobile → 2 cols `sm` → 5 cols `lg`.
- **Styling**: section bg `bg-marketing-gold-pale`, `-mt-10` to overlap the hero's rounded bottom. Cards: `rounded-2xl bg-marketing-cream-2 p-5 shadow-md`. Numbered badge: `absolute -left-2 -top-2 ... rounded-full bg-black text-white` (line 42). Illustration placeholder uses inline `repeating-linear-gradient(45deg, ...)` diagonal-hatch pattern with literal hex `#E5E5E5` (lines 46-53) rather than a token — no actual step illustrations rendered despite `step1-ill.webp`…`step5-ill.webp` existing in `assets/landing_page/` (see Observations/§5).
- **Sub-components/animations**: none; static.

### FeatureShowcase — `frontend/src/pages/marketing/landing/FeatureShowcase.jsx`

- **Purpose**: dark contained panel showcasing 6 features, `id='features'`.
- **Copy**: `Feature Showcase` (amber-highlighted second word); lead `Everything you need to design, validate, and deploy cloud architectures.` `features` array (lines 10-53): `AI Guidance`, `Best Practice Check`, `Visual Architecture`, `One-Click Deployment`, `Cost Estimation`, `Monitoring & Alerts`, each with a one-line body.
- **Layout**: outer section `bg-marketing-gold-pale`; inner panel `w-[99%] rounded-2xl bg-marketing-near-black p-6 lg:rounded-3xl lg:p-10`; content `grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12` (line 59); feature list `grid gap-x-6 gap-y-5 sm:grid-cols-2` (line 83).
- **Styling**: mock browser-window mockup — 3 dot "traffic lights" (`size-2.5 rounded-full bg-marketing-text-muted-2`, lines 62-66) over a `placeholder`-labeled `aspect-[3/2]` box (`bg-marketing-bg-elevated`) — again no real image/screenshot, purely a placeholder.
- **Sub-components/animations**: none; static, all 6 feature icon chips use identical `bg-marketing-amber-core`/`text-black` styling (no color variation despite `FinalCTA`/`Hero` using multi-accent tokens elsewhere).

### BuiltForEngineers — `frontend/src/pages/marketing/landing/BuiltForEngineers.jsx`

- **Purpose**: checklist + mock-window section, `id='company'` (anchor target for navbar "About").
- **Copy**: eyebrow `Built for Developers`; H2 `Everything you need to build and run in the cloud.`; checklist (lines 3-9): `AI-generated architecture diagrams`, `Automatic AWS provisioning`, `Cost, performance & security insights`, `Real-time monitoring & alerts`, `Built-in best practices`; link `Explore All Features →` (`href='#features'`, an anchor not a route `Link`).
- **Layout**: `grid ... lg:grid-cols-2 lg:gap-14` (line 14), text column left, mock-window column right.
- **Styling**: section bg is a **one-off literal hex** `bg-[#0C0E17]` (line 13) rather than a `marketing-*` token — inconsistent with every other section, which uses named tokens (see Observations). Checklist bullets use `bg-marketing-amber-core` circular check icons. Mock window again is icon-less placeholder (`bg-marketing-bg-elevated` + `placeholder` text label), traffic-light dots here use `bg-white/20` instead of `bg-marketing-text-muted-2` used in `FeatureShowcase`'s equivalent dots (inconsistency).
- **Sub-components/animations**: none beyond `hover:border-white/35 hover:bg-white/[0.06] transition-colors` on the CTA link.

### FinalCTA — `frontend/src/pages/marketing/landing/FinalCTA.jsx`

- **Purpose**: closing conversion band.
- **Copy**: H2 `Ready to move from idea to cloud?`; lead `Start building your infrastructure now. No credit card required.`; buttons `Start Building Free →` (`/signup`) and `Book a Demo` (`/pricing`); fine print `Free 14-day trial • No credit card • Cancel anytime` (rendered via `&bull;` HTML entities, line 31).
- **Layout**: `flex flex-col items-center text-center`; buttons `flex flex-col ... sm:flex-row sm:justify-center` (line 14).
- **Styling**: section bg `bg-marketing-amber-2` (the only fully-amber-background section); text uses `text-marketing-bg-deep` and `/80`, `/70` opacity variants for contrast on the amber field; primary button inverts to `bg-marketing-bg-deep text-marketing-amber-2` with a colored shadow `shadow-[0_10px_28px_rgba(11,11,11,0.18)]`.
- **Sub-components/animations**: none beyond `hover:-translate-y-0.5 hover:brightness-110 transition-all` on the primary button (same hover idiom as Hero's primary CTA).

### LandingFooter — `frontend/src/pages/marketing/landing/LandingFooter.jsx`

- **Purpose**: landing-only footer chrome (comment lines 5-6: "`components/layout/Footer` stays untouched for `/pricing` and the auth pages that share `PublicLayout`").
- **Copy**: tagline `AI-powered cloud infrastructure platform that helps engineers build, deploy, and optimize on AWS.`; status pill `All Systems Operational`; columns (`columns`, lines 8-33): **Product** (Features, Pricing, How It Works), **Resources** (Documentation, Blog), **Company** (About Us, Contact, Privacy Policy, Terms of Service); copyright `© 2026 Clyro. All rights reserved.` (line 86, hardcoded, not computed from `Date`).
- **Layout**: `grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.7fr))]` (line 45); bottom bar `flex flex-col items-center gap-6 ... sm:flex-row sm:justify-between` (line 85).
- **Styling**: `bg-marketing-bg-deep`; first link column gets `lg:border-l lg:border-marketing-border-hairline` (line 66) as a visual divider from the brand block; social icons use `invert` filter class (line 100) to force dark SVG logos to render white — a workaround rather than sourcing pre-colored assets.
- **Sub-components/assets**: imports `githubLogo`, `linkedinLogo`, `twitterLogo` from `../../../assets/logos/*.svg` (lines 1-3). All three social `<a>` tags have `href='/'` (line 92) — **not wired to real social URLs**, they just link back to the site root.
- **Animations**: `transition-colors` on link/icon hovers only.

---

## 3. Global Styling

### Design tokens — `frontend/src/index.css` (`@theme` block, lines 18-99)

Tailwind v4 resolves theme from CSS `@theme`, not `tailwind.config.js`. Confirmed by the comment at `index.css:4-17`: *"Tailwind v4 resolves its theme from CSS, not `tailwind.config.js` — that file is only read when a stylesheet asks for it with `@config`. Nothing did, so every custom colour in it ... compiled to nothing."* This means **`frontend/tailwind.config.js` is dead configuration** for the whole app, not just the landing page (its `colors.background/surface/border/accent/...` are unused; the real tokens are `--c-*`-indirected CSS vars for the app, and a separate static `marketing-*` set for the landing page).

Marketing/landing token values actually used by the 7 live components (`index.css:48-98`):
- Backgrounds: `--color-marketing-bg-base: #0b0b12`, `--color-marketing-bg-warm: #0d0d14` (root bg), `--color-marketing-bg-cool: #0a0e1a`, `--color-marketing-bg-deep: #08080d` (footer/CTA-text), `--color-marketing-bg-card: #14141d`, `--color-marketing-bg-elevated: #1e1e29`
- Text: `--color-marketing-text-primary: #f5f5f7`, `--color-marketing-text-secondary: #a6a6b3`, `--color-marketing-text-muted-2: #7a7a87`
- Borders: `--color-marketing-border-hairline: #22222e`
- Accent/gold system (comment at lines 70-76 documents a "5-step cycle" — gold-light+black, amber-core+black, bronze+cream-2, near-black+amber-core (inverted), white+black — but in practice `FeatureShowcase.jsx` and `BuiltForEngineers.jsx` only use step 2 (`amber-core`+black) for every icon chip, not the full rotation): `--color-marketing-cream-2: #fdf6e3`, `--color-marketing-gold-pale: #f5dfa0`, `--color-marketing-gold-light: #f2cb6b`, `--color-marketing-amber-core: #f2b705`, `--color-marketing-amber-deep: #d89a05`, `--color-marketing-bronze: #b8860b`, `--color-marketing-bronze-dark: #5c4510`, `--color-marketing-near-black: #0b0b0a`
- Legacy multi-accent set (`--color-marketing-amber-2: #f2b705` [reused across Hero H1 gradient, FinalCTA bg, navbar CTA], `--color-marketing-amber-light: #ffd874`, plus unused-by-landing `teal`/`violet`/`blue` tokens at lines 62-68, explicitly kept "in case anything outside the landing page still references them")
- Type scale (`--font-size-*`, lines 92-98): `display: 3.5rem` (hero H1 only), `h2: 2.75rem`, `h3: 1.7rem`, `lead: 1.375rem`, `body: 1rem`, `small: 0.85rem`, `micro: 0.75rem` — comment states this is a "shared golden-ratio (Fibonacci, ~1.618) type scale," applied via Tailwind **arbitrary values** (e.g. `text-[2.75rem]`) rather than named classes, so it's a convention, not enforced by Tailwind's type system.

### App-wide (non-marketing) tokens, for contrast
`--color-background/surface/border/accent/accent-soft/text-primary/text-muted/success/danger` all indirect through `--c-*` vars that swap between `:root` (dark) and `:root[data-theme='light']` (`index.css:101-128`) — this light/dark system is **not used by the marketing tokens**, which are fixed/static per the comment at lines 29-33 ("these sections always render dark regardless of the app's light/dark preference").

### Reusable UI components shared across sections
None of the 7 landing components import a shared `Button`/`Card`/etc. component — every button, badge, and card is hand-rolled per-file with inline Tailwind classes (no `components/ui/Button` usage anywhere in `landing/`, unlike `Pricing.jsx` which does import `../../components/ui/Button`). This is a notable divergence from the rest of the app.

### Responsive/breakpoint strategy
Tailwind default breakpoints used consistently: `sm:` (640px) for padding/columns bump, `md:` (768px) only in `LandingNavbar` (auth buttons/hamburger swap), `lg:` (1024px) as the dominant desktop breakpoint for grid-column changes (`lg:grid-cols-2`, `lg:grid-cols-5`, `lg:grid-cols-[...]` custom fractions) and type-size steps (`lg:text-[2.75rem]` etc.). No `xl:`/`2xl:` usage found anywhere in the 7 files. Max content width is a repeated literal `max-w-[1240px]` (appears in `HeroSection`, `HowClyroWorks`, `FeatureShowcase`... actually `FeatureShowcase` uses `w-[99%]` instead, `BuiltForEngineers`, `FinalCTA`, `LandingNavbar`, `LandingFooter`) — not tokenized, just repeated as a magic number in 6 files.

---

## 4. Observations

### Dead code
1. **`frontend/src/pages/marketing/landing/ParticleSwarm.jsx`** — a fully-built WebGL particle-sphere hero background (24,000 particles, custom GLSL vertex/fragment shaders, pointer parallax, `prefers-reduced-motion` handling, full cleanup on unmount) that is **not imported anywhere** in the codebase (confirmed via grep for `ParticleSwarm` — only its own `export default` matches). `HeroSection.jsx` currently uses a static CSS radial-gradient/dot-pattern backdrop instead. This looks like an in-progress or abandoned enhancement sitting unused next to the section it was clearly built for.
2. **Six additional files in `frontend/src/pages/marketing/landing/` are entirely dead code, not referenced by `Landing.jsx`, `Pricing.jsx`, `routes/index.jsx`, or anything else** (verified by grepping for each import name across `frontend/src`):
   - `Hero.jsx` — an older/alternate hero (different visual language: `bg-[#040812]`, imports `../../../assets/hero_background.png` which was not found among currently-listed landing assets, CSS `@keyframes fadeUp` via inline `<style>`).
   - `CTA.jsx` — an alternate CTA using **gsap + ScrollTrigger** (`gsap.context`, `gsap.fromTo`, scroll-triggered card/text stagger, JS-driven hover animations) — this is the only place `gsap` is actually used in the whole `landing/` folder, and it's dead.
   - `HowItWorks.jsx` — an alternate 5-step section using `../../../components/marketing/HowItWorksCard`, `../../../hooks/useHowItWorksAnimation`, and image assets `../../../assets/howItWorks/card1.webp`…`card5.webp` (a different asset path than `assets/landing_page/step1-ill.webp` etc.).
   - `Testimonials.jsx` — a full testimonials/stats section (not rendered anywhere in the live page — the live page has **no testimonials section at all**), uses `IntersectionObserver` + CSS transitions for scroll-reveal, hardcoded copy ("Clyro helped us go from idea to production in a single afternoon...", author "Anish Agrawal, Founder, IndieShop").
   - `TrustedBy.jsx` — a "BUILT WITH" logo strip (AWS/GitHub/Terraform/CloudFront), imports `../../../assets/logos/AWS_Logo.svg`, `terraform_logo.svg`, `cloudfront_logo.svg`, and `../../../components/common/GitHubLogo`. Not rendered anywhere live.
   - `WhyCrylo.jsx` + `WhyCrylo.module.css` + `WhyCrylo-global.css` — an expandable-card feature grid with a shatter/dot-particle hover effect (CSS-module-driven), completely unused.
   
   These six files (plus 2 CSS files) represent a materially different, more elaborate design direction (gsap animations, scroll-reveal, testimonials, trust logos, expandable cards) that has been fully superseded by the current flatter, static 5-section page but never deleted.

3. **Orphaned/placeholder assets in `frontend/src/assets/landing_page/`**: none of the 9 files there are imported by any of the 7 live components — every "illustration" slot in the live page (`HeroSection` ×2, `HowClyroWorks` step icons, `FeatureShowcase`, `BuiltForEngineers`) renders a plain text placeholder (`"Illustration placeholder"` / `"placeholder"`) instead of an image. Specifically unreferenced anywhere in `frontend/src` (confirmed via grep across `.jsx`/`.js`):
   - `hero_section_ill_first.webp`, `second_ill_hero_section.webp` (the two files added per `git status`, replacing the deleted `hero_section_ill.webp`) — both orphaned; the git status change did not update any component to actually use them.
   - `feature_showcase_ill.webp`, `cta_ill.webp` — orphaned.
   - `step1-ill.webp` through `step5-ill.webp` — orphaned (would naturally map to `HowClyroWorks.jsx`'s 5 steps, which currently render only a hatched-gray placeholder box instead).
4. **`frontend/tailwind.config.js`** is dead configuration (see §3) — it defines an entirely different, unused color palette (`background`, `surface`, `accent: #F97316`, etc.) that has no effect under Tailwind v4's CSS-first theme resolution, since nothing in the codebase uses `@config` to opt back into it.
5. **`gsap` and `lottie-react`** are listed as direct dependencies in `frontend/package.json` but, aside from the dead `CTA.jsx` using `gsap`, neither is imported by any live landing component. `lottie-react` has no importers found anywhere under `frontend/src/pages/marketing/`.

### Inconsistencies in styling/structure across sections
- **Background color source inconsistency**: `BuiltForEngineers.jsx` uses a literal `bg-[#0C0E17]` (line 13) while every sibling section uses a named `marketing-*` token (`bg-marketing-bg-warm`, `bg-marketing-gold-pale`, `bg-marketing-amber-2`, `bg-marketing-bg-deep`). This hex isn't defined anywhere in `@theme`, so it can't be reused/renamed centrally.
- **Traffic-light dot color inconsistency**: `FeatureShowcase.jsx`'s mock-window dots use `bg-marketing-text-muted-2` (line 63-65) while `BuiltForEngineers.jsx`'s equivalent dots use `bg-white/20` (lines 52-54) — same UI pattern, two different color approaches.
- **Max-width magic number repeated 6×**: `max-w-[1240px]` is hand-typed in `HeroSection.jsx`, `HowClyroWorks.jsx`, `BuiltForEngineers.jsx`, `FinalCTA.jsx`, `LandingNavbar.jsx`, `LandingFooter.jsx` instead of being a token/constant; `FeatureShowcase.jsx` instead uses `w-[99%]` with no max-width cap at all, an outlier.
- **Icon-chip color rotation not actually rotating**: the `index.css` comment (lines 70-76) documents a deliberate 5-step gold/black/white color-rotation system for icon chips across sections, but `FeatureShowcase.jsx`'s 6 feature icons and `BuiltForEngineers.jsx`'s checklist icons all use the *same* single step (`bg-marketing-amber-core` + `text-black`) — the documented rotation isn't visible in the live markup, only `HeroSection.jsx`'s `calloutBadges` array actually cycles through multiple accent classes.
- **Footer social links non-functional**: all three social icons in `LandingFooter.jsx` point to `href='/'` rather than real profile URLs (line 92).
- **Hardcoded copyright year**: `LandingFooter.jsx` line 86 hardcodes `© 2026 Clyro.` rather than deriving from `new Date().getFullYear()`.

### Reusable patterns worth extracting
- The "mock browser window" pattern (3 dot traffic-lights + `aspect-[3/2]` placeholder body) is duplicated near-verbatim in `FeatureShowcase.jsx` (lines 61-72) and `BuiltForEngineers.jsx` (lines 50-61) with only the dot color differing — a good extraction candidate.
- The primary-CTA button style (`h-[52px]/h-12 rounded-xl ... hover:-translate-y-0.5 hover:brightness-110 transition-all focus-visible:outline...`) is repeated independently in `HeroSection.jsx` (line 136), `FinalCTA.jsx` (line 17), and (differently) `LandingNavbar.jsx` (line 55) — no shared `Button` component backs any of it, unlike `Pricing.jsx` which does use `components/ui/Button`.
- `max-w-[1240px]` container pattern (see above) could be a single `Container` component/class.

### Incomplete/unfinished work
- Every illustration slot across the live page (`HeroSection` ×2, `FeatureShowcase`, `BuiltForEngineers`, and all 5 `HowClyroWorks` step cards) is an explicit "placeholder" — no real product screenshots/illustrations are wired in despite matching-purpose `.webp` assets sitting unused in `assets/landing_page/`.
- `ParticleSwarm.jsx` is a complete, production-quality WebGL component (reduced-motion support, resize handling, full teardown) that is simply not wired into `HeroSection`, suggesting either an intended-but-unfinished hero upgrade or a component that was extracted from an earlier version and never reconnected.
