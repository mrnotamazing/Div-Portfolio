# Design Language: reference board

Source sites (the user's three favourites, studied 2026-11-07):
1. **Daiki Fujita**: https://daikifujita.com (Framer, WebGL, Lenis)
2. **Vadim Carazan**: https://vadimcarazan.com (custom JS, WebGL/OGL-Three)
3. **Daniel Ingrassia**: https://ingrassiadaniel.it (Next.js, WebGL, GSAP, Lenis, Barba)

Screenshots are in `references/`.

---

## The shared DNA (what all three have in common)

This is what the user is responding to. Treat these as rules.

| Principle | How it shows up |
|---|---|
| **The site is a world, not a page** | A full-bleed WebGL scene sits behind or around everything. Scrolling moves a camera through space ("Scroll to fly through the work", "float through it in a 3D dream", a drifting starfield). |
| **Extreme type scale contrast** | Giant display type (the name or a tagline at 200–380px, edge to edge, often cropped by the viewport) next to tiny 11–14px UI labels. Almost nothing in between. |
| **One typeface family does nearly everything** | **Inter Tight** is on all three sites. It's used for body, UI and (on Daiki and Daniel) the display type. Personality comes from size, tracking and placement, not from many fonts. |
| **Quiet, near-monochrome palette** | Near-black or warm off-white grounds, grey text, with at most *one* accent used sparingly. |
| **A "ritual" entry** | A preloader counter (`000 → 100`, `100%`), sometimes followed by an `[ ENTER ]` gate. Sound is opt-in ("Sound on"). |
| **Editorial micro-UI** | Labels like `(01) About`, `01 / 03`, `Currently:`, `Based in:` with a live local clock (`Tokyo 13:15`). Arrows as glyphs: `↗ → ↓ ↑`. |
| **Sparse, confident layout** | A thin 4-corner header (name left, nav centre or right, contact far right). Huge empty space. Content sits at the edges and bottom corners rather than in centred columns. |
| **Smooth inertial scroll** | Lenis-style smooth scroll everywhere. Everything is driven by scroll progress. |
| **Poetic copy** | Short, sense-led lines: "Sites for waking. Worlds for dreaming.", "Open the memory →", "Let's make the next one yours." |

---

## Site 1: Daiki Fujita: "light, dreamy, tactile 3D"

**Mood:** calm, airy, museum-like. Soft daylight with liquid and ice objects floating in it. Playful pixel-art accents.

- **Palette (light):** background `#ECEBE6` (warm paper), surface `#F4F2EE`, ink `#0B0B0C` / text `#121212`, accent `#231A58` (deep indigo, used for links). Faint vertical grid lines (~1px, low contrast) run across the whole page.
- **Type:** `Inter Tight` for display and UI (display ~288px, tight negative tracking, set solid with no line gaps, words cropped by the screen edges). `Instrument Serif` italic for single emphasised words ("like a *memory*"). `Noto Sans JP` for the bilingual text. UI labels are 11px uppercase.
- **3D:** a large refractive **glass/ice rock** (transmission, chromatic dispersion, iridescent edges) floats centre-screen and changes shape per section. Small rock shards drift around. A **pixel-art isometric cube** acts as a cursor-like companion. **Circular orbiting text** rings the object ("PORTFOLIO V2 · 2026 ·").
- **Signature interaction:** a **WAKE / DREAM** pill toggle (bottom centre), where Dream mode turns the whole archive into a 3D game-like world. Sound toggle.
- **Layout:** numbered sections `(01)`–`(06)`. Works are shown as a horizontal carousel (`01 / 03`), with a giant uppercase title, a Role/Year table and `OPEN THE MEMORY →`. Awards are a plain list.
- **Buttons:** square (0 radius) black fills, except the pill toggle (full radius, soft shadow).

## Site 2: Vadim Carazan: "dark cosmos, serif drama"

**Mood:** night sky, cinematic and luxurious. The strongest typographic statement of the three.

- **Palette (dark):** background `#0A0A0B`, text `#D2D2D2` / bright `#F2F2F2`, muted labels ~`#8A8A8A`, accent `#FF9B92` (coral) with deep `#B65750`. The accent is only used on links and hovers.
- **Type:** display is **`Editorial Old` italic** (fallback `Instrument Serif`), a high-contrast didone-style italic set *enormous* across the full width at the bottom of the hero ("Vadim Carazan"). Body/UI is `Inter Tight` 16px. Header labels are two-line: grey label (`Currently:`) over a white value.
- **3D / background:** a starfield of coloured dust particles plus **glowing hand-drawn signature strokes** (thin white lines that look scribbled into space). Scrolling flies a camera through **1,067 project images** floating in 3D space.
- **Components:** a pill outline button with a circular icon (`Explore the work ↓`, radius 999px, border `#606060`). Inputs have radius 12px with fill `#161617` and border `#272728`. Selected work, About and Contact open as **overlay panels** over the 3D world, not as separate pages.
- **Layout:** a 4-column top bar (logo / Currently / Based in + live clock / Navigation). Intro paragraph bottom-left, CTA bottom-right, giant name across the bottom edge.

## Site 3: Daniel Ingrassia: "minimal dark space, kinetic text"

**Mood:** deep and quiet, like drifting in space. It's all motion craft, with almost no chrome.

- **Palette (dark):** background `#222124`–`#27262B` (charcoal with a slight violet tint) and soft white/grey text. Accents appear only in the monogram: green `#379777` and yellow `#F4CE14`.
- **Type:** `Inter Tight` only, at light-to-regular weights. The hero is split as name on the far left and role on the far right, vertically centred. Text **curves in 3D** ("Available everywhere" / "Working globally" bend around the viewer). The contact email starts **blurred and comes into focus**.
- **3D / background:** a depth-of-field **star/dust particle field** (blurred bokeh in front, sharp points behind) that runs the full page length (~8,300px). Project cards slide in from the sides as framed screenshots with the title below and year on the right.
- **Entry:** a blurred `100%` preloader that resolves into sharp focus.
- **Layout:** extremely sparse. A tiny `SOME SELECTED WORKS` label top-left, a footer with legal text in tiny uppercase, a 0 radius everywhere and no visible buttons.

---

## Synthesis: proposed tokens for the user's site (draft, to confirm)

```css
:root {
  /* dark default (Vadim + Daniel), with an optional light "wake" mode (Daiki) */
  --bg:        #0B0B0C;
  --bg-soft:   #161617;
  --line:      #272728;
  --text:      #D2D2D2;
  --text-hi:   #F2F2F2;
  --text-mute: #8A8A8A;
  --accent:    /* ONE colour, user to choose */;

  --paper:     #ECEBE6;   /* light mode bg */
  --ink:       #0B0B0C;

  --font-sans:    "Inter Tight", "Helvetica Neue", Arial, sans-serif;
  --font-display: "Editorial Old", "Instrument Serif", serif; /* italic, optional */

  --fs-ui: 11px;          /* uppercase labels */
  --fs-body: 16px;
  --fs-display: clamp(96px, 18vw, 380px);
  --tracking-display: -0.04em;

  --radius-pill: 999px;   /* only for the one hero CTA/toggle */
  --radius: 0;            /* everything else is sharp */
  --unit: 4px;
}
```

**Stack that matches the references:** Three.js (or OGL) for the world, GSAP plus ScrollTrigger for scroll choreography, and Lenis for smooth scroll. Use Vite or Next.js for the site itself.

**Building blocks to reuse:**
1. A preloader counter `000→100` with an optional `[ ENTER ]` gate and a sound opt-in
2. A full-bleed WebGL background (particles, refractive object or floating image field)
3. A 4-corner editorial header with a live local clock
4. A giant edge-to-edge display name or tagline
5. Numbered sections `(01)` and counters `01 / 03`
6. Work presented as a 3D flythrough or horizontal carousel, with a Role/Year table and `Open →`
7. Overlay panels in place of separate pages
8. Kinetic text: curved 3D text, blur-to-focus, orbiting text rings
9. A contact block with a big email, `↗` links and "Back to top ↑"

## Decisions (user, 2026-11-07)
- **Themes:** both. Light = "Paper" (day), Dark = "Night water". The stone drop switches between them.
- **Display type:** dramatic italic serif, Vadim style (Editorial Old / Instrument Serif italic)
- **3D:** all of it (particles, realistic stone, image flythrough), as one evolving element
- **Accent (updated):** *crystal light*. The whole site is themed around the crystal, a faceted quartz holding blue-green light (refs: aurora-shard image + rotating crystal GIF). One iridescent band is used for every accent: night `#6b8dff → #57d6cf → #aee68f`, day `#2f55d4 → #12938f → #4b9338`. Grounds are cool: night `#07080C`, day `#ECEEF1`. Vermilion was retired because it competed with the crystal. Ripples, thread, seal, loader and emphasis text all use the crystal light, kept subtle so nothing is forced.
- **Sound:** yes
- **Playground section:** kept in for the first iteration, then reviewed
- **Performance:** optimise hard, but never at the cost of the look

## The user's image references (`references/ref1…ref6`)
| # | File | What the user loves | Rule for the site |
|---|---|---|---|
| 1 | `ref1-tiger-ripple.webp` | A foreground character plus the *effect* it has, built into the environment subtly, with an accent | The world reacts to the subject. The accent only marks the effect. |
| 2 | `ref2-rock-figures.webp` | Realistic, textured rock sculptures | One central, realistic, natural 3D element guides visitors through the site and changes across sections |
| 3 | `ref3-chinese-knot.webp` | Simple yet complex and deep | Tied from ONE continuous cord: one person, many loops (projects) |
| 4 | `ref4-hair-flow.webp` | Their hair is their favourite feature ("gentlemen flow") | Particle portrait of their hair, seen from behind |
| 5 | `ref5-nostalgic-pins.webp` | Nostalgic, dreamy depth from almost nothing | Film grain, haze, light shafts, figures from behind |
| 6 | `ref6-doodle-pins.webp` | Fun doodles: tiger, lion dance, daruma, seal stamps | The playful layer: margin doodles, cursor companion, seal-stamp logo |

## Story: *The light inside* (current, replaces the first concept)
**ripple → crystal found → crystal rises → refracts light → cracks → its light rises and becomes a constellation → loose ends → thread to you → drop → ripple.**
Every section is caused by the one before. It's one pond, one camera and one crystal, with no cuts.

| # | Section (label) | What happens | Why it leads on |
|---|---|---|---|
| 00 | Loader | Looking straight down into a dark pond. A drop falls and rings spread with the counter. A glow grows under the water. **A mystic cat opens the page:** the reference print's forward-facing tiger (mirrored, cut out as an ink mask, painted in the crystal colours by CSS), skinned to a skeleton on a bending mesh (spine, hind leg, two forelegs, head, eight-bone tail; drawn with three.js in its own small canvas), so it bends like skin with no cuts. It drops in from above, gathers in the air (spine compresses, legs draw in, tail swishes, head steady, eyes forward), then pounces head-first into the centre. Its splash is the first ripple, and only then do the counter and "Something is under the water." appear (src/jaguar.js, public/jaguar-mask.png). The print is another artist's work: license it or replace it before launch. *"Something is under the water."* `[ Reach in ]` | You've found something in the ripple. |
| 01 | Hero (Found in the ripple) | The camera tilts up from the water. The crystal rises through the ripple's centre, then hovers. Its drips keep rippling. The name surfaces. | The crystal is out, in the light. |
| 02 | Intro (Light) | The crystal refracts light into 5 beams. Each lands on the water and ripples, and its discipline lights up. | It's taking in more light than it can hold. |
| 03 | About (Pressure) | Light builds and a crack glows along the cleavage plane. The crystal cleaves into two halves (a V). The light inside gathers into **one filament** in the gap, then scatters upward like a plume. | Too much light to hold. |
| 04 | Work (Where the light went) | The released light settles into a **constellation**: a faint field of stars plus **one bright star per project**. The halves step back: **dark, matte, no shine**, so focus moves to the sky. **Each project lights its star and draws the line of light to it from the star before**. Unreached stars are dim, the line ahead is a faint ghost (a dotted star chart by day), and the current star pulses with four fine rays. By the last project the constellation is complete. | Every piece of work is a point of the same light. |
| 05 | Playground (Loose ends) | The constellation loosens into glowing sparks. The doodles play among them. | Even play is the same light. |
| 06 | Contact (The other end) | The crystal sits small and high, clear of the words. The Chinese knot appears only as the icon (header logo and the seal under the links), never in 3D. The sparks gather back into the thread. The halves return and close around it, and the crystal is whole. The thread's other end reaches the visitor's cursor. | — |
| ∞ | Ending | Pause at the bottom and a drop falls into the pond. *↺ Begin again* glides to the top, where the crystal sinks and rises again. Nothing auto-scrolls. | The loop closes where it began. |

All copy is story-shaped placeholder. *[Bracketed]* parts are for the user's own words.

**Art direction for the constellation and thread** (the gene and the Chinese knot were retired 2026-11-07 because nothing about a crystal makes them; the constellation is the crystal's own light): one **fibre of light**, a crisp glowing filament like fibre-optic or neon, in the crystal's blue→teal→green, with light travelling along the cord. It is never hand-drawn or crayon (that style is only for the playground doodles). The knot draws itself on along its single cord. Particles only show moments of change (flowing, sparks). Day = deep crystal colours with a bright core; night = luminous with a soft halo.

## Open questions (to settle once the storyboard arrives)
- Light, dark, or both (a Wake/Dream style toggle)?
- Serif italic display (Vadim) or all-sans display (Daiki and Daniel)?
- What the central 3D "hero object" or world is: particles, glass object, image flythrough, or something from your own work?
- The one accent colour.
- Sound: yes or no?

## Sound (2026-11-07)
One cinematic bus in the browser (src/audio.js): a gentle compressor and a generated hall reverb, every sound placed slightly left or right.
- **Reach in:** the jaguar roars as it gathers, whooshes as it pounces, splashes with a deep underwater boom; the crystal's rise answers. The jaguar plays on the Reach in click because browsers only allow sound after one.
- **Story moments (scroll):** glassy crack as the crystal splits (S 2.2), shimmer as its light scatters into the sky (S 3.05), sparks as the constellation loosens (S 4.3).
- **Constellation:** a crystal-bell chime per star, rising in pitch. The line is drawn by the scroll itself and reaches each star exactly where the project switches: that frame the chime plays and the star flares to its peak, then settles.
- **Day/night:** an airy swell. Recorded effects go in public/audio/ (roar, whoosh, splash, rise .mp3) and replace the synthesised versions automatically.

## Smoothness and sharpness
- Day/night: every colour token is a registered CSS property, so the whole page fades on one 1 s ease-in-out curve, the same curve the 3D scene uses.
- 3D renders at up to 2x pixel density; particles and stars are crisp anti-aliased points with a bright core and a minimum size; the crystal refracts at 0.8 resolution.
- Adaptive quality only steps down after sustained slowness and rarely steps back up, so it never hitches mid-scroll. The frame loop measures before it writes styles.
