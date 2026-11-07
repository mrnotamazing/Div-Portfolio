# Portfolio — flagship project brief

This is my personal creative-coding portfolio site. It's my most important project:
treat it as a flagship. Quality, craft and originality matter more than speed.
I'll give you references, ideas and content in chat. Your job is to turn them into
a distinctive, polished, fast site using everything in the toolkit below.

## How to work with me
- **Start every session** by running `/mcp` and `/plugin` (or checking available tools) and
  tell me in one line what's connected and what's missing. Don't assume a tool works; verify it.
- **Plan before building.** For any new section or piece, propose the approach and which
  tools you'll use, and wait for my OK before large changes.
- **Ask, don't guess,** about taste: references, palette, type, tone, motion feel.
- **Show, don't tell:** after visual changes, run the dev server and take screenshots
  (desktop and phone width) so I can see the result.
- **Commit often** with clear messages. Never force-push. Keep secrets out of git.
- **Credits:** Higgsfield, ElevenLabs, Canva generation and Firecrawl agent runs cost credits.
  Tell me what you'll generate and roughly how much before spending.

## My machine
- MacBook Air M1, base model (8 GB RAM, fanless). Keep dev builds light. Close heavy
  previews when not needed. Do long renders in chunks.
- Claude Code runs locally in this folder. A cloud session (claude.ai/code) with the
  same plugins is available for heavy rendering if the Mac struggles.

## The toolkit

### 1. TouchDesigner (live on this Mac) — `touchdesigner` plugin
- TouchDesigner is installed. The MCP bridge `mcp_webserver_base` runs on **port 9983**
  (host `http://127.0.0.1`). Plugin setting `touchdesigner_port` = 9983.
- Saved project: `~/Documents/noise_level_null.toe`. Save each new piece as its own `.toe`.
- Tools: create/delete nodes, read/update parameters, run Python in TD,
  read node errors, grab a TOP's image (`get_top_image`), and inspect TD classes.
- Skills: `/touchdesigner:setup` (check the connection), `/touchdesigner:launch`,
  `/touchdesigner:snapshot`, `/touchdesigner:debug`, `/touchdesigner:perf`,
  `/touchdesigner:overview`, `touchdesigner:fundamentals`, `touchdesigner:python-api`.
- Use for: real-time generative pieces, audio-reactive visuals, feedback and particle
  systems. Render portfolio clips with **Movie File Out**, then compress with ffmpeg.
- If the connection fails: TD must be open with the saved `.toe`. A fresh
  `mcp_webserver_base.tox` defaults to 9981, so set it to 9983 and save. If the Claude
  desktop app's own TouchDesigner sidecar grabs a port, quit that app.

### 2. Web and 3D
- **Three.js**: `threejs` skill (claude-skills). Scenes, GLTF, custom GLSL shaders,
  post-processing, interaction. Prime candidate for the hero.
- **PixiJS v8**: `pixijs-skills` (start with the `pixijs` router skill). Fast 2D WebGL/WebGPU,
  filters, particles, custom shaders.
- **p5.js**: generative sketches, embeddable as live pieces.
- **gl-transitions**: a library of GLSL transitions for page/project transitions and video cuts.
- **Vite** as the default build tool unless we decide otherwise.

### 3. Video and motion
- **Remotion** (`remotion` plugin): React-based video. Showreel, project trailers,
  animated captions, `remotion-render` to export.
- **hyperframes** (HeyGen): HTML/CSS/JS compositions rendered to video. Good for
  typographic and motion-graphic clips built with web tech.
- **lemo-opuscar** (`/lemo-opuscar:lemo-opuscar`): code-made short films in curated styles
  (oil paint, watercolor, ukiyo-e, satellite briefing, exploded teardown…). Good for a
  showreel intro or narrative pieces. Takes 30–60 min and a lot of tokens per film; ask first.
- **ffmpeg**: transcode for the web. H.264 MP4 plus WebM/AV1 where useful, short loops,
  poster frames, no audio for autoplay loops, target small file sizes.
- **Motion Design** skill/connector: easing, timing, micro-interaction guidance.

### 4. Connectors (claude.ai account — verify with `/mcp`)
- **Higgsfield**: image, video, 3D (GLB), audio generation; upscale; background removal;
  reframe. Use for textures, concept art and hero imagery, only when I approve.
- **ElevenLabs**: voiceover, sound design and SFX for the showreel, and audio for
  audio-reactive pieces.
- **Canva**: social cards, OG images, case-study graphics, CV/one-pager.
- **Firecrawl**: scrape and analyse reference sites I give you (layout, type, motion
  ideas). Never copy them, only learn from them.
- **Google Drive / Google Docs**: pull my content, CV, project write-ups and assets.
- **Claude Docs**: shareable planning docs (site plan, copy drafts, case-study outlines).
- **GitHub**: repo, issues, deploy via GitHub Pages or a connected host.

### 5. Built-in skills worth using
- `artifact-design` / artifacts: quick shareable previews of ideas and moodboards.
- `dataviz`: if any project shows data or stats.
- `run`: launch the dev server and screenshot the real site.
- `code-review`, `simplify`, `security-review`: before each release.

## Quality bar
- **Original:** no templates or look-alikes of famous portfolios. References inspire,
  they aren't copied.
- **Fast:** Lighthouse performance 90+ on mobile. Lazy-load heavy WebGL and video, keep
  the first load light, and pause offscreen canvases and videos.
- **Fallbacks:** each live WebGL piece has a video or image fallback for weak devices.
- **Accessible:** respect `prefers-reduced-motion`, keyboard navigation, alt text,
  contrast. Motion must never block reading.
- **Responsive:** looks intentional at phone width, with no horizontal scroll.
- **SEO and sharing:** title, meta, OG images per project.
- **Every project page:** a hero loop, the idea, the process (with TD/code screenshots),
  the tools used, and a credits/links line.

## Content I'll provide
Name, role I'm targeting, bio, references and moodboard, project list, contact details,
domain/hosting preference. Ask for anything missing before inventing placeholder copy,
and mark any placeholder clearly.
