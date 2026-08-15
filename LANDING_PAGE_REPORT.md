# Clyro Frontend — Visual Design System Audit

Scope: `frontend/src/**`. Read-only analysis; no files were modified. Every claim below is backed by an actual file/line reference. Where something could not be determined from the code, that is stated explicitly rather than assumed.

Stack: React 19 + React Router 7 + Tailwind CSS v4 (`@tailwindcss/vite`, CSS-first config via `@theme` in `index.css`, `tailwind.config.js` is present but **not loaded** — see §13), lucide-react icons, `@fontsource/geist`, Monaco editor, GSAP (present in package.json but not seen wired into any file read), no component library (Radix/shadcn/MUI) — everything is hand-built.

---

## 1. Overall Visual Theme

Clyro's frontend is **two distinct visual products stitched together**, not one design system:

1. **The app shell** (`/app/*`, `/login`, `/signup`, `/pricing`) — a near-black, amber/orange-accented "developer tool" dark theme, token-driven via CSS variables, with an in-progress light-theme toggle.
2. **The marketing landing page** (`/`) — a separate, hand-authored aesthetic that itself is inconsistent: the outer shell (`Landing.jsx`, `LandingNavbar`, `LandingFooter`) is a warm cream/paper light theme (`#FDF6ED` background, `#0B0B0B` ink), but every content section between navbar and footer (Hero, ToolsStrip, FeatureHighlights, HowClyroWorks, FeatureShowcase, WhyEngineers/testimonials, BuiltForEngineers, FinalCTA) renders on a **fixed dark purple-black** (`--color-marketing-dark: #0d0b16`) background with amber-gold accents. So a user scrolling the landing page sees: cream navbar → dark hero → dark strip → dark cards → ... → dark footer, with only the sticky navbar staying cream (see §14 for detail).

- **Primary accent**: warm amber/orange. Two different amber hues are in play depending on surface — see §8.
- **Backgrounds**: near-black app shell (`#111318`/`#1c1e26`), true-black overlays (`#030609`, `#040404`, `#0B0B0B`), a separate near-black marketing palette (`#0d0b16`/`#161421`), and a cream marketing-chrome color (`#FDF6ED`).
- **Gradients**: used liberally for glow/depth (radial amber glows behind hero art, `bg-gradient-to-b`/`to-br` on buttons and cards) and for text (gradient-clipped headline words in `HowItWorksCard.jsx`, `ServerDown.jsx`).
- **Borders**: almost universally low-opacity white borders (`border-white/[0.07]` to `border-white/[0.12]`) rather than a solid gray token — the `--color-border: #2c2e38` token exists but most components bypass it with arbitrary white-alpha values.
- **Shadows**: soft, large-blur black shadows (`shadow-[0_24px_80px_rgba(0,0,0,0.45)]`) for elevated panels (modals, sidebar, wizard navbar), plus colored glow shadows keyed to the amber accent (`shadow-[0_0_20px_rgba(249,115,22,0.3)]` on primary buttons).
- **Opacity/transparency**: pervasive — nearly every surface color is expressed as `white/[0.0N]` or `black/NN` rather than a flat hex, giving a "glass over black" look throughout.
- **Glassmorphism**: explicit and heavy in a subset of components — `GlassSelect.jsx` (`backdropFilter: blur(20–24px)`), `ProjectsToolbar.jsx` dropdown (`backdrop-blur-[20px]`), `Navbar.jsx`/`LandingNavbar.jsx` (`backdrop-blur-md`), `ConfirmDialog`/`InfraManageModal` overlays (`backdrop-blur-sm`), `WizardNavbar.jsx` (`backdrop-blur-[20px]`). Not present in flatter components like `Card.jsx` or `Badge.jsx`.
- **Dark/light**: the app shell has a real light-theme override (`:root[data-theme='light']` in `index.css`) driven by `PreferencesContext`/`theme.js`, defaulting to dark. Per the code comment in `index.css` (lines 4-17), this light theme is **incomplete** — most components hardcode `bg-white/[0.0x]`, `bg-black`, `amber-*` etc. that do not repaint for light mode. The marketing landing page has no theme toggle at all; it is permanently split cream/dark as described above.

---

## 2. Typography

- **Font family**: Geist (`@fontsource/geist`, imported in `index.css` line 1), set as the global font via `:root { font-family: 'Geist', Inter, system-ui, -apple-system, sans-serif }` (`index.css:73`). No component overrides this for body text.
- **Monospace**: JetBrains Mono is loaded via Google Fonts `<link>` in `index.html:10` (not self-hosted like Geist) and used explicitly in `CfnEditor.jsx` (`fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace"`) and implicitly via Tailwind's `font-mono` utility in `ProcessingLoader.jsx`'s terminal panel and `ServerDown.jsx`'s status rows/labels.
- **Weights used**: `font-normal` (body/helper text), `font-medium` (labels, nav links, most UI), `font-semibold` (headings, card titles, buttons), `font-bold`/`font-extrabold`(800, via inline `fontWeight: 800`) for marketing display type (`HowItWorksCard.jsx`).
- **Heading sizes** (Tailwind scale unless noted):
  - App shell page titles: `text-2xl`/`text-3xl` (Dashboard `h1`, ProjectsHeader `h1`), but **Profile.jsx uses `text-4xl`** and **Settings.jsx uses `text-5xl`** for the equivalent page `<h1>` — no shared heading component, so page-title size is inconsistent across `/app` pages (see §14).
  - Auth pages: `text-4xl sm:text-5xl` (`Login.jsx` "Welcome back").
  - Marketing landing: mostly `text-[1.75rem] sm:text-[2.1rem]` (section H2s) up to `text-[2.35rem] sm:text-[3rem] lg:text-[3.35rem]` for the hero H1 — arbitrary rem values, not Tailwind's default scale.
  - `HowItWorksCard.jsx` headings use `clamp(44px, 5vw, 68px)` desktop / `clamp(28px, 9vw, 38px)` mobile — fully fluid, outside both the Tailwind scale and the rem-based marketing convention used elsewhere on the same page.
- **Body text**: `text-sm` (14px) is the dominant body/label size across the app shell; `text-xs` for meta/caption text; marketing sections favor `text-[0.8rem]`–`text-[0.95rem]` arbitrary values.
- **Line height**: mostly Tailwind defaults, but marketing copy explicitly sets `leading-[1.7]`/`leading-[1.6]` for paragraph body text, and hero H1s use tight `leading-[1.1]`/`leading-[1.15]`.
- **Letter spacing**: `tracking-tight` on numeric/stat values and page H1s; `tracking-[-0.02em]`/`tracking-[-0.035em]` on marketing headings; wide positive tracking (`tracking-[0.18em]`–`tracking-[0.22em]`, uppercase) on eyebrow labels/badges (`ProjectsHeader`, `Profile` uppercase captions, `HowItWorksCard` feature pills at `letter-spacing: 0.04em`/`0.1em`).
- **Gradient/text effects**: `bg-clip-text text-transparent` used for accent words — `ServerDown.jsx` ("sleeping"/"starting up"), `HowItWorksCard.jsx` (heading accent word + tagline accent word, via inline `WebkitBackgroundClip`).
- **Responsive typography**: handled ad hoc per component with `sm:`/`lg:` size steps (e.g. `text-2xl sm:text-3xl`) or CSS `clamp()` (only in `HowItWorksCard.jsx`). No shared type-scale utility or heading component exists (confirmed — no `Heading.jsx`/`Typography.jsx` in `components/ui/`).

---

## 3. Layout System

- **Page shells** are route-driven via three layout components (`src/layouts/`):
  - `PublicLayout.jsx` — flex column, `Navbar` + `<main>` + `Footer`, background `bg-background`. Used for `/pricing`, `/login`, `/signup`.
  - `AppLayout.jsx` — CSS grid `auto 1fr` with a `4px` gap and `4px` padding around the whole viewport, `Sidebar` in the fixed column, main content in a rounded (`rounded-2xl`) bordered panel (`border-white/[0.07]`) that itself looks like a floating card. This "app-in-a-frame" treatment (thin outer gutter + rounded inner panel) is distinctive and applied only here.
  - `FullscreenLayout.jsx` — no chrome at all; used for the project wizard and architecture canvas, which draw their own navbar (`WizardNavbar.jsx`).
- Landing (`/`) renders **no shared layout** — it owns `LandingNavbar`/`LandingFooter` directly inside `Landing.jsx`, bypassing `PublicLayout` entirely (explicit comment in `routes/index.jsx:43-44`).
- **Max widths**: inconsistent across the app —
  - Marketing landing sections: `max-w-[1240px]`.
  - `Navbar.jsx`/`Footer.jsx` (shared, non-landing): `max-w-7xl` (1280px).
  - `Footer.jsx` specifically: `max-w-[1700px]` — wider than its own sibling `Navbar.jsx`.
  - `Pricing.jsx`: `max-w-5xl` (1024px).
  - `StepSevenPanel` monitoring grid: `max-w-7xl`.
  - No single "container" constant/component is reused (see §9, §14).
- **Section vertical rhythm** (marketing): `py-16` mobile → `lg:py-24` desktop is the repeated pattern across `FeatureShowcase`, `HowClyroWorks`, `WhyEngineers`, `BuiltForEngineers`, `FinalCTA`. `ToolsStrip`/`FeatureHighlights` use `pb-16` only (no top padding, since they sit directly under the hero).
- **Horizontal padding**: `px-5 sm:px-6 lg:px-8` is the standard responsive gutter on marketing sections and the shared `Navbar`; `AppLayout`'s inner panel uses `p-6`.
- **Grid/flex usage**: grid is used for card rows (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` in `FeatureHighlights`), stat rows (`grid gap-3 sm:grid-cols-3` in `Dashboard`), pricing tiers (`grid gap-5 pt-4 md:grid-cols-3`), monitoring dashboard (12-column grid in `StepSeven`). Flex is used everywhere else (navbars, toolbars, cards' internal layout).
- **Breakpoints**: standard Tailwind (`sm` 640, `md` 768, `lg` 1024, `xl`/`2xl` mostly unused). One custom breakpoint constant exists — `CARD_DESKTOP_BREAKPOINT = 1024` in `useCardBreakpoint.js`, deliberately mirroring Tailwind's `lg`, shared across `HowItWorksCard`/`HowItWorks`/its animation hook (per that file's own comment) — but note `HowItWorksCard.jsx` and `FeatureHighlights.jsx` are not currently both wired into the live `Landing.jsx` tree at once (see §14, dead-file note).
- **Full-bleed vs constrained**: sections are full-width color blocks with a constrained inner content wrapper (`mx-auto w-full max-w-[…]`) — a consistent pattern across all marketing sections and the app pages.

---

## 4. Navigation & Header

Three separate navbar implementations exist, all visually similar in structure but each hand-coded:

- **`components/layout/Navbar.jsx`** (dark app-shell navbar, used on `/pricing`, `/login`, `/signup` via `PublicLayout`): `border-b border-white/[0.08] bg-background/95 backdrop-blur-md`, height driven by `py-4` (not a fixed px height), logo + wordmark left, pill-shaped nav (`rounded-full border border-white/[0.08] bg-white/[0.02] p-1`) center, "Sign in" text link + primary `Button` right, animated hamburger (3 spans, CSS transforms) on mobile, full mobile panel slide via `hidden`/`block` toggle (no transition on the panel itself, only on the hamburger icon).
- **`pages/marketing/landing/LandingNavbar.jsx`** (cream landing navbar): structurally identical (logo, center nav, right-side auth CTAs, mobile hamburger) but recolored entirely for the light theme (`bg-[#FDF6ED]/90`, `text-[#0B0B0B]`), `sticky top-0 z-50`, 6 nav items (2 with chevrons for implied dropdowns that aren't implemented), CTA button style differs from the app navbar's `Button` component — it's a hand-rolled `bg-[#0B0B0B] text-white` pill, not the shared component.
- **`components/wizard/WizardNavbar.jsx`** (fullscreen wizard header): a floating glass bar — `rounded-[24px] border border-[rgba(255,196,0,0.35)] bg-[rgba(10,15,25,0.55)] backdrop-blur-[20px]`, fixed `h-[72px]`, centered truncated project name, "Back to Dashboard" pill button. This is the only navbar with true glassmorphism + a fixed pixel height.
- **`components/layout/Sidebar.jsx`** (app-shell primary nav, not a header but functions as the app's nav backbone): floating rounded panel (`rounded-3xl border border-white/[0.08] bg-[#050912]`) inset by 4px via `AppLayout`'s grid gap, collapsible 260px↔80px with a 420ms cubic-bezier width transition, active-link state uses a distinct gold (`#FFC400`) rather than the `--color-accent` orange (`#F97316`) token — see §8 for the two-amber inconsistency.
- **Hover/active states**: consistently amber-tinted focus rings (`focus-visible:ring-amber-300`/`ring-amber-400`) across the dark navbars; landing navbar uses `hover:text-[#E8A33D]` (its own amber) without focus-ring styling on nav links (only on the logo).
- **Sticky behavior**: only `LandingNavbar` is `sticky top-0`; `Navbar.jsx` (app-shell) is not sticky; `WizardNavbar` is a normal in-flow element (not fixed/sticky) despite looking like a floating bar.

---

## 5. Hero Section

Only the marketing landing page has a "hero" in the traditional sense (`HeroSection.jsx`).

- **Layout**: two-column grid (`lg:grid-cols-[minmax(0,1.02fr)_minmax(0,1.18fr)]`), text left / visual right, single column stacked on mobile.
- **Background**: layered — a radial gradient base (`radial-gradient(ellipse_120%_80%_at_50%_-10%,#1c1830_0%,#0d0b16_55%,#0d0b16_100%)`), a repeating two-layer dot-grid "starfield" texture (`background-image: radial-gradient(...), radial-gradient(...)` at two different sizes/positions to fake depth), and a large soft amber blur circle (`h-[560px] w-[560px] rounded-full bg-marketing-amber/20 blur-[110px]`) top-right. This is the most visually elaborate background treatment in the codebase.
- **Heading hierarchy**: eyebrow pill badge (icon + uppercase label) → H1 (`text-[2.35rem]…lg:text-[3.35rem]`) with one word/phrase in amber with a custom underline accent (`absolute` amber bar under "Powered by AI.") → supporting paragraph (`max-w-[30rem]`) → CTA row → trust-checklist row (3 items with small check-circle icons).
- **CTAs**: two side-by-side buttons — solid amber primary ("Start Building for Free →") and outlined ghost secondary ("Book a Demo", with a `PlayCircle` icon). Neither reuses `components/ui/Button.jsx`; both are hand-styled anchors specific to the landing page's own color system.
- **Visual/illustration placement**: right column is currently a **placeholder** — a bordered glass panel (`border-white/10 bg-white/[0.03]`) with a centered amber glow and literal text "Illustration placeholder", plus four small floating "callout badges" (Scalable/Secure/Intelligent/Optimized) connected to the panel by dashed vertical lines, positioned at the four corners and hidden below `lg`.
- **`ParticleSwarm.jsx`**: a WebGL component (custom GLSL vertex/fragment shaders, 24,000-particle Fibonacci-sphere point cloud with pointer parallax and `prefers-reduced-motion` handling) exists in `pages/marketing/landing/` but **is not imported or rendered anywhere** in the current component tree (confirmed via grep — only self-referenced). It appears to be either a work-in-progress hero replacement or an abandoned experiment; the hero currently ships the static placeholder panel instead.
- **Animation**: no scroll-triggered or entrance animation on the hero itself in the current file (no GSAP/Framer Motion imports in `HeroSection.jsx`); only the unused `ParticleSwarm` would have supplied motion.
- **Responsive**: badges hidden below `lg`; CTA row stacks vertically on mobile (`flex-col sm:flex-row`).

---

## 6. Major Sections (page/section-by-section)

### Landing page (`/`)
1. **LandingNavbar** — cream, sticky, see §4.
2. **HeroSection** — dark, see §5.
3. **ToolsStrip** (`ToolsStrip.jsx`) — dark, "Trusted by engineers at" logo row; mixed rendering strategy per logo (raster AWS logo forced monochrome via `brightness-0 invert`, two hand-drawn inline SVG marks for Microsoft/Docker, two lucide icons standing in for Airbnb/Datadog since no brand asset exists). Flex-wrap on desktop, 2–3 col grid on mobile/tablet.
4. **FeatureHighlights** (`FeatureHighlights.jsx`, new/untracked file) — dark, 4-card grid, each card: icon in a soft-amber circle badge (`bg-marketing-amber-soft`), bold title, muted body. Cards are flat (`rounded-2xl border border-white/10 bg-marketing-dark-surface p-6`), no hover state defined.
5. **HowClyroWorks** (`HowClyroWorks.jsx`) — dark, 5-step numbered process, cards with a floating numbered badge overlapping the top-left corner (`absolute -left-2 -top-2`), an empty placeholder illustration box per card, chevron connectors between cards on desktop only.
6. **FeatureShowcase** (`FeatureShowcase.jsx`) — dark, 2-column (image-placeholder panel + 2×3 feature list with icon chips), mirror-image layout of `BuiltForEngineers` below it.
7. **WhyEngineers** (`WhyEngineers.jsx`) — dark, testimonials, 3-card grid on desktop (all visible) collapsing to a single active-card carousel with dot pagination on mobile (`useState` index, no swipe gesture, click-to-select dots only).
8. **BuiltForEngineers** (`BuiltForEngineers.jsx`) — dark, checklist + image-placeholder panel (same "browser chrome dots" placeholder pattern as `FeatureShowcase`).
9. **FinalCTA** (`FinalCTA.jsx`) — dark, horizontal band: heading+subhead, 4 inline assurance icons, one primary CTA button (visually identical styling to the hero's primary CTA).
10. **LandingFooter** (`LandingFooter.jsx`) — dark (back to `bg-marketing-dark`, breaking the cream chrome established by the navbar), 5-column grid (brand+blurb, 3 link columns, newsletter form), social icon row, custom inline YouTube SVG mark (no lucide equivalent).

Legacy/orphaned files also present in `pages/marketing/landing/` but **not imported by the current `Landing.jsx`**: `Hero.jsx`, `CTA.jsx`, `HowItWorks.jsx`, `Testimonials.jsx`, `TrustedBy.jsx`, `WhyCrylo.jsx` + `WhyCrylo.module.css` + `WhyCrylo-global.css`, and `ParticleSwarm.jsx`. These represent a prior design iteration and are dead code from the current tree's perspective (not verified whether referenced by tests or other unlisted entry points).

### App shell (`/app/*`)
- **Dashboard** (`Dashboard.jsx`) — greeting header + primary CTA, 3-stat row (`StatCard`, gradient-top cards with an optional amber "glow" state when count > 0), "Recent Projects" list (`RecentProjectRow` — full-row link, status badge, contextual CTA pill, manage/delete icon buttons), empty state with dashed border + centered icon.
- **Projects** (`Projects.jsx`) — `ProjectsHeader` (eyebrow + H1 + count pill + primary CTA) → `ProjectsToolbar` (search input + filter/sort custom dropdowns, heavy glass styling with `#FFC400` gold hover accents distinct from the app's `--color-accent` orange) → `ProjectCard` list (icon badge colored by status, name/description/status badge left, updated-date + manage/delete/open actions right, hover lift + amber glow shadow).
- **Profile** (`Profile.jsx`) — avatar card (gradient-fallback avatar `from-fuchsia-500 via-violet-500 to-amber-400` — the only multi-hue gradient outside marketing), tier/project-count/joined-date pill row, `SectionCard` pattern reused for General Info / GitHub Connections / Subscription, a red-tinted Danger Zone card (`border-red-500/30 bg-red-500/[0.03]`) for account deletion.
- **Settings** (`Settings.jsx`) — region selector (`GlassSelect`) + segmented light/dark/system `ThemeSwitch`, cards use a distinct decorative treatment not seen elsewhere: `bg-gradient-to-br from-surface/90 to-surface/40` plus a `before:` pseudo-element radial blue glow (`rgba(59,130,246,0.08)`) — the only place a *blue* accent appears in the entire app shell.
- **Pricing** (`Pricing.jsx`, rendered via `PublicLayout`, so it's in the dark theme despite being adjacent to the cream landing page) — 3-tier card grid, featured/"Most popular" tier gets an amber gradient wash + ring + floating badge; uses `<i className="ti ti-check">`/`ti-shield-check` classes (Tabler Icons) — the **only place in the audited files that references a Tabler Icons class name**; no `tabler-icons` import/CSS link was found in `index.html`, `package.json`, or elsewhere, so these icons will not render (see §14).
- **Project Wizard** (`ProjectWizard/*`, fullscreen, gold `#E8B84B`/`#FFC400` accent world) — `StepProgress` (vertical numbered stepper with a fill-progress line, pulsing active-step ring), `WizardPanel`/`WizardCard` (plain content wrapper vs. the app's `Card.jsx` surface-styled variant), `ProcessingLoader` (checklist + fake-terminal two-pane loading screen with slow-spinning decorative gear icons, particle "travel" animation between steps), `CfnEditor` (Monaco YAML editor, `vs-dark` theme, JetBrains Mono), `StepSeven` monitoring dashboard (12-col grid of health/metrics/uptime/alerts/logs cards).
- **Login/Signup** (`Login.jsx` shown) — full-viewport split layout: left form pane (`bg-[#070b0f]` with a faint radial amber glow + subtle white gradient overlay) and right full-bleed photographic image pane (`loginArt`, hidden below `lg`), OAuth buttons (Google/GitHub, GitHub disabled with a "coming soon" tooltip) above an email/password form.
- **ServerDown** (`ServerDown.jsx`, the 9AM–9PM IST "sleeping" gate screen) — centered single-column status page, live IST clock, animated countdown, `StatusRow` mono-font key/value rows inside a bordered panel with an animated progress bar, gradient-clipped headline word — visually the most "product status page"-like screen in the app, distinct from every other screen's layout conventions.

---

## 7. Component Styling

- **Button** (`components/ui/Button.jsx`) — the one true shared button, 5 variants (`primary`, `secondary`, `ghost`, `danger`, `link`) × 3 sizes (`sm`/`md`/`lg`). `primary` = amber gradient (`from-amber-400 to-amber-500`) with inset highlight/shadow, glow on hover, scale-down on active (`active:scale-[0.97]`). `secondary` = translucent white border/fill with amber hover tint. Base class always includes `rounded-lg font-semibold transition-all duration-100 active:scale-[0.97]`. **Not used** by: `LandingNavbar`/`LandingFooter`/`HeroSection`/most marketing sections (hand-rolled anchors instead), `HowItWorksCard`'s CTA (fully inline-styled), `ProjectsToolbar` dropdown triggers, `GlassSelect` trigger — meaning there are at least 4 parallel "button-like" visual languages in the app beyond the shared component.
- **Card** (`components/ui/Card.jsx`) — single minimal wrapper: `rounded-xl border border-white/[0.07] bg-surface shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.04]`, fixed `p-5` inner padding. Used directly in relatively few places; most "card" surfaces in the app (Dashboard StatCard, ProjectCard, Profile SectionCard, Settings Card, Pricing TierCard) redeclare very similar-but-not-identical styles locally rather than composing `Card.jsx` — see §14.
- **Badge** (`components/ui/Badge.jsx`) — 4 semantic variants (`success`/`warning`/`danger`/`neutral`) all built from the design-token colors (`success`, `accent-soft`, `danger`, `surface`), `rounded-full px-2 py-1 text-xs`. `ProjectStatusBadge.jsx` wraps a separate status→style map (`lib/projectStatus.js`, not read in full but referenced) rather than reusing `Badge`'s variant set directly.
- **Input** (`components/ui/Input.jsx`) — label + input + error/helper text, `rounded-lg border bg-surface`, amber caret/focus ring (`caret-accent`, `focus-visible:ring-accent/20`), red error state swaps border/ring to `danger`.
- **Select** (`components/ui/Select.jsx`) — native `<select>` styled to visually match `Input.jsx` (same border/radius/focus treatment) with a manual `ChevronDown` icon overlay (`appearance-none` + absolute-positioned icon).
- **GlassSelect** (`components/ui/GlassSelect.jsx`) — a **second, unrelated** select implementation: fully custom dropdown via `createPortal`, inline `style` objects (not Tailwind), heavy glassmorphism (`background: rgba(3,6,15,0.90)`, `backdropFilter: blur(20-24px)`), gold `#FFC400` selection/hover color (matching Sidebar's gold, not `--color-accent` orange). Two independent select components with materially different visual languages coexist in the same app (`Select.jsx` vs `GlassSelect.jsx`).
- **ConfirmDialog** (`components/ui/ConfirmDialog.jsx`) — the shared modal pattern: full-screen `bg-background/80 backdrop-blur-sm` scrim, centered `max-w-md rounded-xl border border-border bg-surface` panel, optional "consequences" bullet list in a danger-tinted box, optional type-to-confirm text input for destructive actions. `InfraManageModal.jsx` reimplements this same scrim/panel pattern independently (`bg-background/80 backdrop-blur-sm` + `rounded-2xl border border-border bg-surface`) rather than composing `ConfirmDialog`, with a slightly different corner radius (`rounded-2xl` vs `rounded-xl`).
- **ScallopedPanel** (`components/ui/ScallopedPanel.jsx` + `utils/scallopedPath.js`) — a bespoke SVG-path-generated "castle battlement" notched-border frame (ResizeObserver-driven, notch width/depth/corner-radius constants), amber stroke (`#F6B93B`) on a `#1c1e26` fill. A unique decorative treatment not seen combined with any other component read in this audit — likely reserved for a specific surface (not confirmed which page consumes it, as no import site was in the read set).
- **ProcessingLoader** (`components/ui/ProcessingLoader.jsx`) — full-screen or inline loading overlay: two-pane layout (checklist + fake terminal), custom keyframe animations (`plSpin`, `plSpinReverse`, `plTravel`, `plTermIn`) defined inline via a `<style>` tag rather than in `index.css`, decorative slow-spinning gear icons at very low opacity, gold `#E8B84B` accent (a **third** amber value, distinct from both `--color-accent` `#F97316` and Sidebar/GlassSelect's `#FFC400`).
- **StepProgress** (wizard) — vertical stepper with an animated fill line and a pulsing (`animate-[stepProgressBlink…]`) active-step ring, gold `#E8B84B` accent again.
- **BrandIcons** (`components/ui/BrandIcons.jsx`) — hand-drawn inline SVGs for Google/GitHub/GitLab/Bitbucket, multicolor for brand-accurate marks (Google, GitLab, Bitbucket) vs `currentColor` monochrome for GitHub.
- **Tabs/Dropdowns/Tooltips/Tables/Loaders**: no dedicated `Tabs`, `Tooltip`, or `Table` components exist in `components/ui/`. "Dropdown" is implemented at least 3 separate times with 3 different visual languages: native `<select>` (`Select.jsx`), portal-based glass menu (`GlassSelect.jsx`), and a bespoke absolute-positioned menu with its own fade/slide transition (`ProjectsToolbar.jsx`'s `renderDropdown`). Loaders are similarly ad hoc: `Loader2` spin icon (lucide, used in several places), custom `border-2 border-t-transparent animate-spin` circles (Projects, Pricing button loading, Profile loading state), and the elaborate `ProcessingLoader` overlay — three different spinner idioms with no shared `Spinner` component.

---

## 8. Color System

### App-shell design tokens (`index.css` `@theme`/`:root`, mapped 1:1 to `tailwind.config.js`'s intent even though that file isn't actually loaded — see §13)

| Token | Dark value | Light value | Where used |
|---|---|---|---|
| `--color-background` / `bg-background` | `#111318` | `#f6f7f9` | Page backgrounds (`AppLayout`, `PublicLayout`, `Navbar`) |
| `--color-surface` / `bg-surface` | `#1c1e26` | `#ffffff` | `Card.jsx`, `Input`/`Select` fields, modals |
| `--color-border` / `border-border` | `#2c2e38` | `#e3e5ec` | `ConfirmDialog`, `InfraManageModal` panels (one of the few places the token is actually used instead of `white/[0.0N]`) |
| `--color-accent` / `text/bg-accent` | `#f97316` (orange) | `#f97316` | `Badge` warning variant, `Input` focus ring/caret, `Button` secondary hover tint |
| `--color-accent-soft` | `#431407` | `#ffedd5` | `Badge` warning background |
| `--color-text-primary` | `#eeeef0` | `#1a1c22` | Default body/heading text |
| `--color-text-muted` | `#6b7080` | `#5b6070` | Secondary/caption text |
| `--color-success` | `#22c55e` | `#16a34a` | `Badge` success variant |
| `--color-danger` | `#ef4444` | `#dc2626` | `Badge` danger variant, error text, danger `Button` |
| `--c-body` (page `<body>` bg, separate from `--color-background`) | `#040404` | `#eceef2` | `body` element only |

### Marketing-only fixed tokens (`index.css` `@theme`, never theme-switched)
| Token | Value | Notes |
|---|---|---|
| `--color-marketing-dark` | `#0d0b16` | Section backgrounds on landing (deep purple-black, **not** the same as `--color-background` `#111318`) |
| `--color-marketing-dark-surface` | `#161421` | Card surfaces on landing |
| `--color-marketing-amber` | `#e8a33d` | Landing's accent gold — a **fourth** distinct amber (see below) |
| `--color-marketing-amber-soft` | `rgba(232,163,61,0.14)` | Icon badge backgrounds |
| `--color-marketing-amber-border` | `rgba(232,163,61,0.4)` | Pill/badge borders |
| `--color-marketing-ink` | `#f7f6f3` | Primary text on dark landing sections |
| `--color-marketing-muted` | `#a6a3b5` | Secondary text on dark landing sections |

### The "amber problem" — five materially different amber/gold values in active use, none reconciled into one token:
1. `--color-accent` `#f97316` — true orange, the actual design-system token (app shell `Badge`, `Input`, `Button` secondary).
2. Tailwind's built-in `amber-300`/`amber-400`/`amber-500` palette (e.g. `#fbbf24`/`#f59e0b`-ish) — used directly by `Button.jsx`'s `primary` variant, `Navbar`, `Footer`, `Dashboard`, `Profile`, `Login`, `ServerDown`, i.e. most of the actual on-screen "orange/amber" the user sees is Tailwind's stock amber scale, **not** the `--color-accent` token.
3. `#FFC400` ("gold") — `Sidebar.jsx` active nav state, `GlassSelect.jsx` selection color, `ProjectsToolbar.jsx` dropdown hover/selection.
4. `#E8B84B` ("muted gold") — `ProcessingLoader.jsx`, `StepProgress.jsx`, `WizardNavbar.jsx` (as `rgba(255,196,0,…)` for borders/glow, which is `#FFC400` again but re-expressed as a raw rgba rather than reusing a token — i.e. WizardNavbar mixes gold-as-rgba(255,196,0,…) *and* references `#E8B84B`-styled siblings without a shared constant).
5. `#e8a33d` (`--color-marketing-amber`) — the landing page's own gold, close to but distinct from all of the above.

None of these five are aliases of one another in code — they are five independently chosen hex/Tailwind values that all read as "amber/gold/orange" to a user, which is the single most significant color-system inconsistency in the codebase.

### Other recurring non-token colors
- **Status colors** beyond the `success`/`danger` tokens: `blue-500`/`sky-400` (repo-connected project icon, Profile's Pro-tier badge — "Pro" and "Enterprise" tiers reuse the same sky-blue in `Profile.jsx`'s `TIER_META`, while `Pricing.jsx`'s tier cards use amber/orange for the featured tier — inconsistent tier-color mapping between the two surfaces), `green-400`/`green-500` (live/healthy states, success checks — sits alongside but separate from the `--color-success` token), `red-400`/`red-500` (danger states, sits alongside but separate from `--color-danger`), `fuchsia-500`/`violet-500` (Profile's avatar-fallback gradient only — a one-off multi-hue moment nowhere else in the app).
- **True blacks**: `#030609` (Login, ServerDown, CheckingServerStatus full-screen backgrounds), `#040404` (`--c-body`), `#070b0f` (Login's left pane), `#04080c` (Login's right pane), `#0B0B0B` (ProcessingLoader terminal, landing's cream-theme ink color), `#050912` (Sidebar). At least 6 distinct near-black hex values are in use for what is conceptually "the darkest surface," none unified under one token.

---

## 9. Spacing & Shape System

- **Border-radius**: no single scale is enforced. Observed values across the app: `rounded-md` (6px, small buttons/links), `rounded-lg` (8px, inputs/buttons), `rounded-xl` (12px, `Card.jsx`, most modals), `rounded-2xl` (16px, section cards, `ProjectCard`, `Sidebar` nav items, `InfraManageModal`), `rounded-3xl` (24px, `Sidebar` outer shell, `Settings` cards), plus arbitrary pixel radii: `rounded-[24px]` (`WizardNavbar`), `rounded-[18px]`/`rounded-[16px]` (`ProcessingLoader` inner panels, `ProjectsToolbar` dropdown), `rounded-[14px]` (`WizardNavbar`'s back button). Card-level radius alone spans 12px→24px depending on which component authored it.
- **Border width**: universally `1px` (default Tailwind `border`) except `border-[1.5px]` in `StepProgress`'s step circles and 1.5–2px inline borders in `HowItWorksCard.jsx`'s theme objects.
- **Shadow patterns**: three repeating idioms — (a) soft ambient elevation `shadow-sm shadow-black/20`–`/30` on flat cards, (b) large "floating panel" shadow `shadow-[0_24px_80px_rgba(0,0,0,0.45)]` on modals/Sidebar/WizardNavbar, (c) colored glow shadows tied to state/accent (`shadow-[0_0_20px_rgba(249,115,22,0.3)]` on primary button hover, `shadow-[0_0_25px_rgba(232,184,75,0.35)]` on the active wizard step, `shadow-[0_8px_24px_rgba(34,197,94,0.12)]` on a live-status project icon). Glow-shadow colors always match whatever local accent that component happens to use (orange, gold, green, red), reinforcing the fragmented color system rather than a single "brand glow."
- **Padding conventions**: `p-5` (Card.jsx default, ProjectsHeader/Toolbar), `p-6` (AppLayout main, most modal panels, Settings cards), `px-5 py-4`/`px-5 py-4` sectioned card headers (Profile `SectionCard`). Button padding is centralized in `Button.jsx`'s `sizeClasses` (`px-3.5 py-1.5` sm / `px-5 py-2.5` md / `px-6 py-3` lg) — one of the few places padding is genuinely systematized.
- **Gaps**: `gap-2`/`gap-3` dominate inline icon+label pairings; `gap-4`/`gap-5` for card grids; `gap-7`–`gap-14` for large marketing section grids.
- **Container widths**: see §3 — at least 5 different max-width values (`max-w-5xl`, `max-w-7xl`, `max-w-[1240px]`, `max-w-[1700px]`, plus `ProjectWizard`/`StepSeven`'s own `max-w-7xl`) are used for conceptually the same "constrained content column" role.

---

## 10. Animations & Interactions

- **No animation library is actually wired in** despite `gsap` and `lottie-react` being listed in `package.json` dependencies — none of the files read in this audit import `gsap` or `lottie-react`. (`useHowItWorksAnimation.js` exists in `src/hooks/` and its name strongly implies GSAP scroll-pinning per the `CARD_DESKTOP_BREAKPOINT` comment in `useCardBreakpoint.js`, but its contents were not read in this pass — its actual implementation could not be verified here.)
- **CSS transitions** are the primary interaction mechanic, applied per-component via Tailwind's `transition-*` utilities: `duration-100` (Button, snappy), `duration-150` (most hover states, inputs), `duration-200` (cards, hover-lift), `duration-[250ms]`/`duration-[420ms]` (Sidebar's collapse animation, WizardNavbar), consistently using either Tailwind's default ease or an explicit `cubic-bezier(.22,1,.36,1)` "ease-out-back-ish" curve (Sidebar, WizardNavbar, StepProgress) — this specific bezier is a recurring signature curve for "premium" motion in the app-shell/wizard, not used on the marketing site.
- **Custom `@keyframes`** (all scoped locally via inline `<style>` tags rather than centralized in `index.css`, except the two already in `index.css`):
  - `index.css`: `chat-message-in` (fade+translateY, used for chat bubble entrance — referenced by name but the consuming component wasn't in the read set).
  - `ProcessingLoader.jsx`: `plSpin`/`plSpinReverse` (decorative gear rotation), `plTravel` (particle traveling along the step connector), `plTermIn` (terminal line fade-in).
  - `StepProgress.jsx`: `stepProgressBlink` (pulsing scale on the active step).
  - `GlassSelect.jsx`: `dropIn` (dropdown open animation, translateY+scale).
  - `ServerDown.jsx`: `clyro-sd-progress` (width 0→100% progress bar loop).
- **Hover micro-interactions**: `hover:-translate-y-0.5`/`hover:-translate-y-px` lift on cards and CTA buttons is the single most repeated hover idiom across both marketing and app shell. `hover:scale-110` on small icon-only action buttons (ProjectCard's manage/delete/open icons). `active:scale-[0.97]` on all `Button.jsx` variants for tactile press feedback.
- **Loading/transition states**: `animate-spin` (Tailwind) drives all spinner iconography; `animate-pulse` marks "live" indicators (ServerDown's IST-time dot, StatusRow accent dot, active-step dot in ProcessingLoader).
- **Scroll animations**: none confirmed in the read files beyond `scroll-behavior: smooth` set globally on `html` (`index.css:81`). No `IntersectionObserver`-driven reveal-on-scroll pattern was found in the components read.
- **Reduced-motion respect**: only `ParticleSwarm.jsx` (currently unused, see §5/§14) explicitly checks `prefers-reduced-motion`. No other animated component (ProcessingLoader's gear spins, StepProgress's pulse, Sidebar's transitions) branches on that media query.

---

## 11. Images, Illustrations & Icons

- **Icon library**: `lucide-react` is the sole icon set used throughout (confirmed via imports in nearly every file read) — consistent stroke-based line icons, typically `h-4 w-4`–`h-6 w-6`, `strokeWidth` occasionally bumped to `2.2`/`2.3` for emphasis (ProjectCard's action icons).
- **Brand icons**: hand-authored inline SVGs for OAuth/social/tool marks that lucide doesn't cover — `BrandIcons.jsx` (Google, GitHub, GitLab, Bitbucket), `GitHubLogo.jsx` (wraps a static SVG asset), `LandingFooter.jsx`'s inline `YoutubeMark`, `ToolsStrip.jsx`'s inline `MicrosoftMark`/`DockerMark`. Where no bespoke mark exists, generic lucide icons stand in for brand logos (`MapPin` for Airbnb, `Activity` for Datadog in `ToolsStrip.jsx`) — a pragmatic but visually inconsistent substitution.
- **Images**: `Clyro_logo.png` (raster PNG logo, used everywhere — no SVG logo variant found in the read set), `login_art6.jpg` (photographic hero image, right pane of `Login.jsx`), assorted brand SVGs (`github-fill.svg`, `linkedin-box-fill.svg`, `twitter-fill.svg`, `discord-fill.svg`, `AWS_Logo.svg`, `github_black.svg`).
- **Illustration style**: the marketing landing page's actual illustration slots (hero visual, `BuiltForEngineers`/`FeatureShowcase`'s screenshot panels, `HowClyroWorks`'s per-step art) are **all unfilled placeholders** — bordered boxes with literal "Illustration placeholder"/"placeholder" text, meaning the landing page's visual/illustration identity is not yet established in code (this is a build-in-progress state, not a finished design decision).
- **SVG usage**: beyond icons, SVG is used generatively in `ScallopedPanel.jsx` (path built at runtime from measured DOM size) — the only place SVG is used for structural/decorative framing rather than as a static icon or logo.
- **Icon color**: mostly `currentColor` (inherits text color) or explicit Tailwind color utilities matched to the local accent (amber/gold/status colors per §8); no icons are ever tinted with the raw `--color-accent` token directly except via Tailwind's `text-accent` in a few Button/Input contexts.
- **Visual consistency**: strong at the icon-library level (lucide throughout keeps stroke weight/style consistent) but weak at the illustration/photography level (one photographic hero image on Login, everything else either icon-based or an explicit placeholder — no consistent illustration style has been established).

---

## 12. Responsive Design

- **Breakpoints**: standard Tailwind `sm`(640)/`md`(768)/`lg`(1024) are used throughout; `xl`/`2xl` are rare (seen once, `xl:grid-cols-1` in `StepSevenPanel`'s `LogsPanel` span). The one custom breakpoint, `CARD_DESKTOP_BREAKPOINT = 1024`, deliberately duplicates `lg` rather than referencing Tailwind's config (unsurprising, since `tailwind.config.js` isn't actually loaded — see §13).
- **Desktop → tablet → mobile changes observed**:
  - Marketing navbars/footers: full nav collapses to a hamburger + slide-down panel below `md`/`lg`.
  - Hero: two-column → single column below `lg`; floating callout badges hidden below `lg`.
  - `HowItWorksCard.jsx`: swaps `flex-direction: row`/`row-reverse` (desktop, alternating per step number) to `column` (mobile, `useIsMobileCard` hook keyed to <768px, distinct from the 1024px card breakpoint used elsewhere — **two different mobile thresholds for conceptually related "card" components**), and hides the description/feature-pill-grid/tagline/CTA entirely on mobile rather than reflowing them.
  - `Sidebar.jsx`: no responsive collapse logic tied to viewport — it's a manual user toggle (desktop-oriented; no mobile drawer/overlay variant was found, implying the app shell may not have a dedicated mobile nav pattern at all — worth flagging as unverified/likely gap).
  - `Login.jsx`: right-side photographic pane (`lg:flex`, otherwise `hidden`) — mobile users only see the form pane.
  - `StepSevenPanel`: 12-col grid collapses via explicit `md:`/`lg:` column-span overrides per card rather than a single `grid-cols-1 md:grid-cols-12` toggle.
- **Typography responsiveness**: handled per-component as noted in §2 — no shared responsive type-scale.
- **Hidden/shown elements**: `hidden md:flex`/`hidden lg:block` is the standard idiom throughout for auth CTAs, illustration panes, badges, and manage-buttons (e.g. `ProjectCard`'s "Manage" label hidden below `sm` while the icon persists).

---

## 13. Implementation & Styling Architecture

- **Styling method**: overwhelmingly Tailwind utility classes written directly in JSX `className` strings (often very long, 15–30+ utilities per element). No CSS Modules pattern is used for the live component tree except one orphaned file (`WhyCrylo.module.css`, part of the unused legacy landing components in §6/§14). One global non-module CSS file exists for the same legacy feature (`WhyCrylo-global.css`), also currently unreferenced by the live tree.
- **Tailwind version & config**: Tailwind v4 via `@tailwindcss/vite`, using the **CSS-first `@theme` directive** in `index.css` rather than the classic JS config object. Critically, `index.css:4-11` contains a developer comment explaining that `tailwind.config.js` is a **dead file** — Tailwind v4 only reads `@config`-referenced config, and nothing in the codebase references it, so every custom token defined there (`background`, `surface`, `border`, `accent`, `accent-soft`, `text-primary`, `text-muted`, `success`, `danger`) only actually works because they were **duplicated** into `index.css`'s `@theme`/`:root` block. `tailwind.config.js` itself is stale/inert and should not be trusted as documentation of current tokens (this audit cross-checked both files and confirmed `index.css` is the source of truth).
- **Design tokens**: implemented as CSS custom properties (`--c-*` in `:root`/`:root[data-theme='light']`) indirected through Tailwind's `@theme` block (`--color-background: var(--c-background)`, etc.) — this indirection is specifically what allows the `data-theme` attribute swap to re-color `bg-background`/`text-text-muted`/etc. utilities at runtime without a JS re-render. Marketing tokens (`--color-marketing-*`) are defined directly in `@theme` with static values (no `--c-*` indirection), consistent with them never needing to theme-switch.
- **Theme switching mechanism**: `lib/theme.js` reads/writes `localStorage['clyro_theme']`, resolves `'system'` via `matchMedia('(prefers-color-scheme: dark)')`, and stamps `data-theme="light"|"dark"` on `<html>` — called synchronously before React mounts (per its own comment) to avoid a flash of wrong theme. `PreferencesContext.jsx`/`usePreferences.js` (not read in full) presumably wraps this for the `Settings.jsx` `ThemeSwitch` control.
- **Component structure**: flat `components/{common,layout,marketing,projects,ui,wizard}/` taxonomy plus page-local component folders under `pages/app/ProjectWizard/step{1-7}/` for wizard-step-specific UI. `components/ui/` is the closest thing to a design-system folder but is small (11 files) relative to how many one-off "card"/"modal"/"dropdown" implementations exist scattered across pages (see §14) — most page-specific visual complexity is **not** extracted into `components/ui/`.
- **Inline styles**: used pragmatically where Tailwind's static utility model can't express the need — dynamically computed SVG paths (`ScallopedPanel`), portal-positioned dropdown coordinates (`GlassSelect`), GLSL/canvas setup (`ParticleSwarm`), width/transition orchestration during the Sidebar's collapse animation, and the entirety of `HowItWorksCard.jsx`'s per-step theme system (a large `CARD_THEMES` object of raw CSS values applied via `style={}` rather than Tailwind classes — this one component is the biggest outlier from the "Tailwind-only" convention used everywhere else).
- **Shared/reusable primitives that do exist**: `Button`, `Card`, `Badge`, `Input`, `Select`, `ConfirmDialog` (`components/ui/`), `WizardPanel`/`WizardCard` (`components/wizard/WizardPanel.jsx`, explicitly commented as "matching the app's card treatment (Card.jsx / AppLayout)" — intentional reuse of the visual language even though it doesn't literally import `Card.jsx`).

---

## 14. Consistency Audit

**Consistent / well-systematized:**
- Icon language (lucide-react everywhere, consistent stroke style).
- Font family (Geist) applied uniformly via a single global rule.
- Focus-visible ring treatment (`focus-visible:ring-2 focus-visible:ring-amber-*`) is near-universal across interactive elements in the dark app shell.
- The "soft white-alpha border + dark surface" card idiom (`border-white/[0.07-0.10] bg-surface|white/[0.0N]`) recurs correctly across dozens of unrelated components — this is the strongest unifying visual thread in the whole app.
- `cubic-bezier(.22,1,.36,1)` motion curve reused deliberately across Sidebar/WizardNavbar/StepProgress as a signature "premium" easing.
- Section vertical rhythm (`py-16 lg:py-24`) and horizontal gutter (`px-5 sm:px-6 lg:px-8`) are consistently applied across all marketing landing sections.

**Inconsistent (existing characteristics of the code, not fixed by this audit):**
1. **Five different amber/gold values** doing the job of "the brand accent color" with no shared token (§8) — `#f97316` (the actual `--color-accent` token, underused), Tailwind's stock `amber-300/400/500`, `#FFC400`, `#E8B84B`, `#e8a33d`. A user moving from Sidebar → Wizard → Landing sees three visibly different "golds."
2. **The landing page is internally split** between a cream light theme (navbar, footer — but footer is actually dark too, so really *only the navbar*) and a dark purple-black theme (every content section) — this reads as an unfinished theme migration rather than an intentional two-tone design (`Landing.jsx`'s own comment confirms sections are "being migrated off the light cream theme").
3. **Page `<h1>` sizing is uncoordinated** across `/app` pages: Dashboard `text-2xl`, ProjectsHeader `text-2xl sm:text-3xl`, Profile `text-4xl`, Settings `text-5xl` — four different scales for the same semantic role with no shared `PageHeading` component.
4. **Border-radius has no enforced scale** — 12px/16px/24px and several arbitrary pixel values all serve as "the card radius" depending on which file authored it (§9).
5. **At least three parallel dropdown/select implementations** (`Select.jsx` native, `GlassSelect.jsx` portal-glass, `ProjectsToolbar.jsx`'s bespoke inline dropdown) with different colors (`--color-accent` vs `#FFC400`), different corner radii, and different open/close transitions.
6. **Modal/dialog scrim + panel pattern is duplicated** rather than shared — `ConfirmDialog.jsx` and `InfraManageModal.jsx` independently reimplement the same `fixed inset-0 … bg-background/80 backdrop-blur-sm` + centered panel structure with slightly different radii (`rounded-xl` vs `rounded-2xl`).
7. **Container max-widths** are not standardized: `max-w-5xl` (Pricing), `max-w-7xl` (Navbar/Footer/StepSeven), `max-w-[1240px]` (all landing sections), `max-w-[1700px]` (Footer, wider than its sibling Navbar despite sharing a page).
8. **Tier/plan color-coding disagrees between surfaces**: `Profile.jsx`'s `TIER_META` colors "Pro" amber and "Enterprise" sky-blue; `Pricing.jsx`'s tier cards instead give the *amber* treatment specifically to the "featured/most popular" tier (Pro) with no equivalent enterprise-blue anywhere on that page — the two surfaces don't share a tier-color mapping.
9. **`Pricing.jsx` references Tabler Icons classes** (`ti ti-check`, `ti ti-shield-check`) that have no corresponding stylesheet import anywhere in the audited files (`index.html`, `package.json`) — these icons are almost certainly not rendering, unlike every other icon in the app which correctly uses lucide-react.
10. **Two unrelated mobile-breakpoint hooks for "card" components**: `useCardBreakpoint.js` (1024px, shared name suggests broad intent) vs `HowItWorksCard.jsx`'s local `useIsMobileCard` (768px) — both exist to answer "is this a mobile card layout," at different thresholds.
11. **Six-plus distinct near-black hex values** (`#111318`, `#030609`, `#040404`, `#070b0f`, `#04080c`, `#050912`, `#0d0b16`, `#0B0B0B`) all serving as "the darkest surface" in different files, none aliased to a shared token beyond the two that do route through `--c-background`/`--c-body`.
12. **Orphaned/dead components**: six legacy landing-page components (`Hero.jsx`, `CTA.jsx`, `HowItWorks.jsx`, `Testimonials.jsx`, `TrustedBy.jsx`, `WhyCrylo.jsx`+CSS) plus the WebGL `ParticleSwarm.jsx` exist in `pages/marketing/landing/` but are not imported by the live `Landing.jsx` — a prior design iteration left in place alongside the current one, which could confuse future contributors about which files are authoritative.
13. **`components/ui/Card.jsx` is under-adopted** — most "card" surfaces across the app (StatCard, ProjectCard, SectionCard, Settings' Card, Pricing's TierCard) reimplement very similar `rounded-* border border-white/[0.0N] bg-surface` styling locally instead of composing the shared component, so `Card.jsx`'s existence doesn't actually guarantee card consistency elsewhere.
14. **Button-like elements bypass `Button.jsx`** on the landing page entirely (hero CTAs, footer newsletter submit, `HowItWorksCard`'s inline-styled CTA) — meaning the shared button component's variant system has no influence over roughly half the marketing site's interactive elements.

---

## 15. Page / Section Design Map

```
/  (Landing.jsx — no shared layout, self-contained chrome)
├─ LandingNavbar            cream (#FDF6ED), sticky, glass blur
├─ HeroSection               dark (#0d0b16), radial gradient + dot texture + amber glow, 2-col
├─ ToolsStrip                dark, logo row (mixed SVG/icon/raster)
├─ FeatureHighlights         dark, 4-card icon grid
├─ HowClyroWorks             dark, 5-step numbered cards w/ placeholder art
├─ FeatureShowcase           dark, 2-col (placeholder panel + icon-list)
├─ WhyEngineers              dark, testimonial cards / mobile carousel
├─ BuiltForEngineers         dark, 2-col (checklist + placeholder panel)
├─ FinalCTA                  dark, centered CTA band
└─ LandingFooter              dark, 5-col grid + newsletter + socials

/pricing, /login, /signup, /verify-otp, /auth/callback  (PublicLayout)
├─ Navbar (dark app-shell variant, distinct from LandingNavbar)
├─ Pricing.jsx                dark, 3-tier card grid, Tabler-icon checkmarks (likely broken)
├─ Login.jsx                  dark, full-viewport split (form + photo), OAuth + email/pass
└─ Footer (dark app-shell variant, distinct from LandingFooter)

/app/{dashboard,profile,projects,settings}  (AppLayout — Sidebar + floating rounded main panel)
├─ Sidebar                    near-black glass panel, gold (#FFC400) active state, collapsible
├─ Dashboard.jsx               greeting header, 3-stat row, recent-projects list
├─ Projects.jsx                header + search/filter/sort toolbar (gold-accented) + card list
├─ Profile.jsx                 avatar hero card + SectionCard pattern (info/GitHub/plan) + Danger Zone
└─ Settings.jsx                 gradient-glow cards, GlassSelect region picker, segmented ThemeSwitch

/app/projects/:id, /app/projects/:id/canvas  (FullscreenLayout — no shared chrome)
└─ ProjectWizard (self-drawn WizardNavbar, gold #E8B84B/#FFC400 world)
    ├─ Step 1  Repo connect / scan / secrets            gold stepper, glass cards
    ├─ Step 2  AWS connect                                (not read in detail)
    ├─ Step 3  Intent Q&A                                 (not read in detail)
    ├─ Step 4  Architecture canvas + chat                 (not read in detail)
    ├─ Step 5  CFN editor (Monaco, vs-dark, JetBrains Mono)
    ├─ Step 6  Deploy / provisioning log                   ProcessingLoader overlay
    └─ Step 7  Live monitoring dashboard                   12-col grid, health/metrics/alerts/logs

Cross-cutting overlays (not page-scoped)
├─ HealthGate → CheckingServerStatus / ServerDown         true-black full-screen gates
├─ ConfirmDialog / InfraManageModal                        duplicated scrim+panel modal pattern
└─ ProcessingLoader                                        full-screen gold-glass loading overlay
```

---

## 16. Design System Summary

| Category | Current Design |
|---|---|
| Primary Colors | Amber/orange, but expressed as **5 different unreconciled values**: `#f97316` (token), Tailwind `amber-300/400/500`, `#FFC400`, `#E8B84B`, `#e8a33d` (marketing-only) |
| Secondary Colors | Near-black surfaces in 6+ distinct hex values (`#111318`, `#0d0b16`, `#030609`, `#040404`, `#070b0f`, `#050912`, `#0B0B0B`); one cream value (`#FDF6ED`) for the landing navbar chrome only |
| Accent Colors | Status colors layered on top: green (`success`/`green-400`), red (`danger`/`red-400`), one-off blue (`sky-400` Profile tier badge, Settings card glow), one-off fuchsia/violet (Profile avatar fallback) |
| Backgrounds | Token-driven for the app shell (`--c-background`/`--c-surface`, theme-switchable); fixed dark for marketing sections (`--color-marketing-dark`); flat black overlays for gates/auth (untokenized) |
| Typography | Geist (sans, primary) + JetBrains Mono (code/mono, Google-Fonts-loaded not self-hosted); heading sizes not standardized — 4 different `<h1>` scales across `/app` pages, `rem`-based arbitrary sizes on marketing, `clamp()`-based fluid sizing in `HowItWorksCard` only |
| Border Radius | No enforced scale: `rounded-md/lg/xl/2xl/3xl` plus multiple arbitrary-pixel radii (`rounded-[24px]`, `[18px]`, `[16px]`, `[14px]`) coexist as "the card radius" |
| Borders | Overwhelmingly `border-white/[0.07–0.15]` (opacity-based, not the `--color-border` token) except in `ConfirmDialog`/`InfraManageModal` which do use the token |
| Shadows | Three idioms: soft ambient (`shadow-sm shadow-black/20-30`), large floating-panel (`shadow-[0_24px_80px_rgba(0,0,0,0.45)]`), and per-component colored glow shadows matched to whichever local accent is in play |
| Spacing | `p-5`/`p-6` for card/page padding, `gap-2/3` inline, `gap-4/5` grids; button padding is the one genuinely systematized spacing scale (`Button.jsx`'s `sizeClasses`) |
| Layout | 3 route-level layouts (`PublicLayout`, `AppLayout` "floating panel in a frame," `FullscreenLayout`); landing page opts out of all three with its own chrome; container max-widths not standardized (5 different values) |
| Buttons | One shared `Button.jsx` (5 variants × 3 sizes, amber-gradient primary) — but roughly half of marketing-site CTAs and several app-shell dropdown triggers bypass it with hand-rolled styles |
| Cards | One shared `Card.jsx` — but most page-level "card" surfaces (StatCard, ProjectCard, SectionCard, Pricing TierCard, Settings Card) reimplement similar-but-distinct styling locally instead of composing it |
| Icons | lucide-react throughout (consistent), supplemented by hand-drawn brand SVGs where lucide has no equivalent; one page (`Pricing.jsx`) references unloaded Tabler Icons classes that likely don't render |
| Animations | CSS-transition-driven, no confirmed GSAP/Lottie usage despite both being dependencies; a recurring signature `cubic-bezier(.22,1,.36,1)` curve in the app-shell/wizard; several component-local `@keyframes` blocks rather than a shared animation library |
| Responsive Strategy | Standard Tailwind `sm/md/lg` breakpoints, `hidden`/`flex` toggling; two different "is this a mobile card" thresholds (1024px shared hook vs. 768px local hook) for related components; Sidebar has no confirmed mobile-drawer pattern |

---

## 17. Design DNA

- Dark, near-black "developer tool" aesthetic as the dominant app-shell identity, with amber/orange as the intended (if inconsistently executed) brand accent.
- Heavy reliance on white-opacity layering (`white/[0.02]` to `white/[0.15]`) rather than flat gray tokens to build surface hierarchy — everything reads as "glass over black."
- Deliberate glassmorphism in specific high-visibility chrome (Sidebar, WizardNavbar, GlassSelect, navbars) via `backdrop-blur`, but not applied uniformly to every surface.
- A landing page that is visually a *different product* from the app shell — cream/paper-editorial navbar chrome wrapping an otherwise fully dark, gold-accented marketing body.
- Soft, large-blur shadows (`shadow-[0_24px_80px_rgba(0,0,0,0.45)]`) used to convey elevation on any "floating" surface — sidebar, modals, wizard navbar.
- Colored glow-shadows on interactive/status elements (amber on hover, gold on active steps, green/red on status icons) as the primary way "importance" or "state" is communicated beyond color alone.
- Numbers and stats are consistently set in `font-semibold`/`font-bold` with tight tracking, distinct from the softer `font-medium` body copy.
- Uppercase, wide-tracked eyebrow labels (`tracking-[0.18-0.22em]`) are the recurring device for section/status labeling across both marketing and app shell.
- lucide-react's thin-stroke line-icon language is the single most consistent visual thread across the entire codebase.
- The 5-color amber problem (§8/§14) is the codebase's most consequential and pervasive inconsistency — "the brand color" is not actually one color anywhere it's implemented.
- A signature `cubic-bezier(.22,1,.36,1)` easing curve recurs specifically in "premium" interactive moments (sidebar collapse, wizard navbar, step progress) — a deliberate motion-design choice, even if not codified as a shared constant.
- CloudFormation/YAML editing (Monaco, JetBrains Mono, `vs-dark`) and a fake-terminal loading screen (`ProcessingLoader`) signal a developer-tool identity leaning into "infrastructure-as-code" visual tropes.
- Placeholder illustration boxes throughout the marketing site indicate the visual/illustration identity is unfinished — the current landing design is built around type, icons, and color, not custom artwork, at least in the code as it stands today.
- Status/monitoring surfaces (`ServerDown`, `StepSeven`'s dashboard) adopt a more literal "ops dashboard" visual language (mono-font key/value rows, live pulsing dots, grid-of-cards) distinct from the softer card-and-copy language of the rest of the app.
- Component reuse is real but shallow: a `components/ui/` folder exists and is genuinely shared for primitives (Button, Input, Badge, ConfirmDialog), but most higher-level "card" and "dropdown" patterns are reinvented per page rather than composed from it.

---

## 18. Potential Improvements

*(Observations/recommendations — separate from the factual audit above.)*

- Consolidate the five amber/gold values (§8) into the existing `--color-accent` token (or promote one of the more-used hex values, e.g. `#FFC400`, to be the single token) and have Sidebar, GlassSelect, ProcessingLoader, StepProgress, WizardNavbar, and the landing page all reference it — this is the highest-leverage single fix, since it currently undermines "one brand" coherence more than any other issue found.
- Decide intentionally whether the landing page should be cream or dark, and apply that decision to the footer and navbar consistently with the body sections (currently only the navbar diverges from the otherwise all-dark landing body).
- Extract a shared `PageHeading`/`PageHeader` component for `/app/*` pages so page `<h1>` sizing (currently `2xl`/`3xl`/`4xl`/`5xl` across four pages) is standardized.
- Standardize on one dropdown/select implementation (or clearly document why `Select.jsx` and `GlassSelect.jsx` both need to exist) rather than three independent visual languages for the same interaction pattern.
- Fold `InfraManageModal.jsx`'s scrim+panel markup into `ConfirmDialog.jsx` (or a shared `Modal` wrapper) so radius/backdrop/shadow stay in one place.
- Fix or remove the Tabler Icons references in `Pricing.jsx` (`ti ti-check`, `ti ti-shield-check`) — either add the stylesheet or swap to lucide-react equivalents to match the rest of the app.
- Either finish wiring `ParticleSwarm.jsx` into the hero (it appears to be built for exactly that slot) or remove it along with the other five orphaned legacy landing components to reduce contributor confusion about which files are live.
- Adopt `components/ui/Card.jsx` (or extend it with the small style variants already duplicated ad hoc) for StatCard/ProjectCard/SectionCard/TierCard so future card additions inherit consistent radius/border/shadow by default.
- Establish one canonical container max-width (or a small named scale: e.g. `narrow`/`default`/`wide`) instead of the five distinct values currently spread across Pricing, Navbar/Footer, landing sections, and Footer's own outlier width.
- Confirm whether Sidebar has (or needs) a mobile drawer/overlay pattern — none was found in the read files, which may mean the app shell is not yet mobile-responsive at the navigation level.
