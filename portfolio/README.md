# One Thread: portfolio, iteration 1

stone → ripple → flow → hair → knot → red thread. Design notes are in `../DESIGN-LANGUAGE.md`.

## Run
```
npm install
npm run dev        # http://127.0.0.1:5173   (add ?debug for fps / dpr / particle count)
npm run build      # production build in dist/
```

## Swap in your real assets
| Drop this file | What happens |
|---|---|
| *(none)* | **About = the crystal cleaves in two.** `splitConvex` in `src/shapes.js` splits it along a plane into two solid halves that open like a V and release the light. The old portrait, hair cut-out and Blender stone are in `archive/` and are no longer served. |
| *(none)* | **The crystal** is generated in code (`makeCrystalGeometry` in `src/shapes.js`): a faceted, double-pointed quartz. Change the seed for a different one. The old Blender stone (`tools/taihu_stone.py`, `stone.glb`) is kept but no longer loaded. |

Regenerate the stone (change the seed for a different one):
```
/Applications/Blender.app/Contents/MacOS/Blender --background --python tools/taihu_stone.py -- 7
```

### Rebuilding the portrait from a new photo
1. Depth + person cut-out, on-device with Apple's Depth Anything V2 Core ML model (`apple/coreml-depth-anything-v2-small`, F16, 49.8 MB) and Apple Vision.
   Crop to head and shoulders in a roughly 4:3 landscape frame, which matches the model's 518×392 input:
   `swift depth.swift DepthAnythingV2SmallF16.mlpackage photo.jpg outdir 0 120 902 680` (x y w h)
2. `python tools/portrait_pack.py outdir` keeps only the nearest person (people behind you are cut by depth) and writes the two assets.

Note: the portrait files contain your face. They're kept in `archive/`, which is not served.

All text is placeholder copy in `index.html`. The accent colour is `--accent` in `src/style.css` plus `ACCENT` in `src/scene.js`.

## Map
- `src/scene.js`: the pond (ripple shader), the stone, the particle morph, and the scroll keyframes (`ELEMENT`, `DISSOLVE`, `PSTATE`)
- `src/shapes.js`: generators for the stone, hair, knot (one continuous cord), dust and the Blender-stone prep
- `src/main.js`: loader, smooth scroll, theme, sound, work carousel, parallax memories, red thread
- `src/doodles.js`: playground doodles (placeholders until your pins)
- `src/audio.js`: all sound is synthesised, so there are no audio files to download

## Performance built in
- Night bloom (with a cleanup pass so one bad pixel can't spread) is the first thing adaptive quality switches off. The glass refracts a 40–60% resolution copy of the scene.
- One WebGL scene, one element: the six "states" are a single particle buffer morphed on the GPU
- Adaptive quality: drops resolution and particle count if frames go over 24 ms, and raises them again when there's headroom
- Phones and low-core devices start at 26k particles (60k on desktop) with no MSAA
- The stone is 16k triangles / 188 KB. The GLTF loader is split out (13 KB gz)
- Honours `prefers-reduced-motion` (no smooth scroll, near-static particles)
