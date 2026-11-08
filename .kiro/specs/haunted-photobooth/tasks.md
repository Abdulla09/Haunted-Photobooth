# Implementation Plan: Haunted Photobooth

## Overview

Implementation language: TypeScript (Vite, vanilla), with GLSL in `src/shaders/*.glsl`. The plan follows the design's six-phase build plan. Each phase ends runnable with `npm run dev` and buildable with `npm run build`. Pure logic (gesture, mode, clock, wedges, particles, layout) is built with injected clocks and seeded RNGs and tested with Vitest and fast-check. Every property test is a single fast-check test with at least 100 runs and a tag comment `// Feature: haunted-photobooth, Property N: <property text>`. Required properties (2, 3, 4, 7, 8, 17) are regular tasks. All other properties are optional (`*`).

## Tasks

- [x] 1. Phase 1: Project setup and pure foundations
  - [x] 1.1 Set up dependencies, scripts, and stage layout
    - Add `@mediapipe/tasks-vision`, `vitest`, `fast-check` as exact-version dependencies; add `"test": "vitest --run"`
    - Add `scripts/copy-mediapipe.mjs` (copies WASM to `public/mediapipe/wasm/`) and run it as `predev` and `prebuild`
    - Place `hand_landmarker.task` and `selfie_segmenter.tflite` under `public/models/`
    - Remove Vite template content (`src/counter.ts`, template assets, template CSS); replace `index.html` with `#stage` (canvas and overlays), `#hint`, `#screens`, `#record` containers
    - Write dark minimal `src/style.css` (contain-fit canvas on `#0A0A0A`)
    - _Requirements: 1.5, 1.6, 17.2, 17.4, 17.5, 17.6_

  - [x] 1.2 Implement `config.ts`, `palette.ts`, `rng.ts`, `SteppedClock.ts`, `LatestSlot.ts`, and `fitRect`
    - Constants: hold times, cooldowns, step rate 18, particle count 150, record 5000 ms, shatter 400 + 1200 ms, slam 300 ms, max width 1280, mask size 256
    - Palette hex and normalized vec3 values; seeded mulberry32 PRNG
    - `SteppedClock.update` returns `{ step, stepTimeSec, changed }`; `LatestSlot.publish/read` with strictly increasing version
    - `fitRect(viewport, content)` for contain-fit layout
    - _Requirements: 1.5, 8.3, 8.4, 10.4, 11.3_

  - [ ]* 1.3 Write property test for fit rectangle
    - **Property 1: Fit rectangle preserves aspect ratio**
    - **Validates: Requirements 1.5**

  - [ ]* 1.4 Write property test for stepped clock
    - **Property 12: Particle simulation advances only on step changes** (clock part: `changed` only when the step index changes; step equals `floor(t * 18 / 1000)`)
    - **Validates: Requirements 12.6, 14.5**

  - [ ]* 1.5 Write property test for latest-result handoff
    - **Property 9: Latest-result handoff never blocks and never goes stale**
    - **Validates: Requirements 8.3, 8.4**

- [x] 2. Phase 1: WebGL2 foundation and Normal_Mode rendering
  - [x] 2.1 Implement GL core modules
    - `GlContext` (WebGL2 creation with the design's attributes, canvas sizing, `webglcontextlost` handling), `GlState` (`applyBaseline`, `begin`, DEV-only `assertBaseline`), `Quad`, `Program` (compile/link with info log and uniform cache), `Targets`, `Textures` (video texture, `R8` mask texture with `texStorage2D`, `texSubImage2D` upload with alignment restore)
    - _Requirements: 4.2, 17.7, 1.4_

  - [x] 2.2 Implement pass interface, pipeline, `FeedPass`, and `PresentPass`
    - `Pass.ts` (`RenderPass`, `FrameState`), `Pipeline.ts` with Normal / Monster / Transitioning lists (Monster = `FeedPass → PresentPass` for now)
    - Shaders `fullscreen.vert.glsl`, `feed.frag.glsl` (mirrored), `present.frag.glsl`
    - _Requirements: 1.2, 5.6, 15.2, 17.1, 17.2_

- [x] 3. Phase 1: Camera and permission screens
  - [x] 3.1 Implement `CameraService`, `PermissionScreen`, and `WebGLMissingScreen`
    - `getUserMedia` with error classification (`denied`, `no_camera`, `unavailable`)
    - Permission screen states that the camera is required and data stays in the browser; "Try again" retries and hides the screen on success; "no camera detected" variant
    - WebGL2-missing screen shows that WebGL2 is required and stops startup
    - _Requirements: 1.1, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 17.7_

  - [ ]* 3.2 Write unit tests for camera error mapping and retry
    - Mocked `getUserMedia`: denied, not found, in use; Try-again flow shows and hides the screen
    - _Requirements: 2.1, 2.4, 2.5, 2.6_

- [x] 4. Phase 1: Inference
  - [x] 4.1 Implement `maskMath.ts`
    - `toU8` (clamped float to byte), `personCenter` (x-mirrored centroid of pixels ≥ 128, default `(0.5, 0.5)` below 16 pixels)
    - _Requirements: 4.2, 4.3, 4.4, 4.6_

  - [ ]* 4.2 Write property test for mask conversion
    - **Property 5: Mask conversion is bounded and accurate**
    - **Validates: Requirements 4.2**

  - [ ]* 4.3 Write property test for Person_Center
    - **Property 6: Person_Center lies inside the person pixels' bounds, is mirrored, and defaults to the center**
    - **Validates: Requirements 4.4, 4.6**

  - [x] 4.4 Implement `HandTracker`, `Segmenter`, and `InferenceScheduler`
    - GPU-delegate MediaPipe models loaded from same-origin paths; 256x256 and ~320 px-wide Inference_Input canvases
    - Time-sliced scheduler (hand every tick, mask every second tick, adaptive, mask floor 10 Hz), `requestVideoFrameCallback` when available, never awaited by the render loop
    - Publish to `LatestSlot` (copy the mask inside the callback, compute Person_Center there); catch errors and disable a model after three consecutive failures; clear `hasHands` / `hasSegmenter` on load failure
    - _Requirements: 3.1, 3.7, 4.1, 4.3, 4.5, 8.1, 8.2, 8.3, 8.4_

- [x] 5. Phase 1: Gesture recognition
  - [x] 5.1 Implement `classify.ts`
    - Fist, Open_Palm, Other from landmark indices per the design; mutually exclusive by construction
    - _Requirements: 3.2_

  - [x] 5.2 Write property test for gesture classification
    - **Property 2: Gesture classification is exclusive and matches the definitions**
    - **Validates: Requirements 3.2**

  - [x] 5.3 Implement `GestureDetector.ts`
    - Hold timers with injected time (Fist 250 ms, Open_Palm 500 ms only in Monster_Mode), reset on class change or lost hand, latched events, `fistPosition = (1 - palm.x, palm.y)` using landmark 9
    - _Requirements: 3.3, 3.4, 3.5, 3.6_

  - [x] 5.4 Write property test for hold timing
    - **Property 3: Hold timing raises events exactly when a hold completes**
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [x] 5.5 Write property test for Fist_Position mirroring
    - **Property 4: Fist position is mirrored horizontally**
    - **Validates: Requirements 3.6**

- [x] 6. Phase 1: Mode controller
  - [x] 6.1 Implement `ModeController.ts` and `ImmediateDriver`
    - States Normal / Transitioning / Monster, `dispatch(event, nowMs)` with cooldown first (3000 ms on Trigger, 1500 ms on Return), `burstStartMs`, `onChange` and `onBurst` observers
    - `TransitionDriver` interface; `ImmediateDriver.start` calls `onBurstStart` then `onComplete` synchronously
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.6, 5.7, 5.9, 15.3, 15.4_

  - [x] 6.2 Write property test for cooldown
    - **Property 7: Cooldown ignores every event**
    - **Validates: Requirements 5.4, 15.3**

  - [x] 6.3 Write property test for the state machine
    - **Property 8: Mode_Controller matches the reference state machine**
    - **Validates: Requirements 5.2, 5.5, 5.7, 5.9, 15.4**

  - [ ]* 6.4 Write unit tests for the mode controller and placeholder driver
    - `ImmediateDriver` reaches Monster_Mode synchronously with burst notified before completion; initial state is Normal; Return in Transitioning ignored
    - _Requirements: 5.1, 5.6, 5.9_

- [x] 7. Phase 1: UI and app wiring
  - [x] 7.1 Implement `Hints.ts` and `DebugOverlay.ts`
    - Hints: aria-live bottom-center HTML, synchronous update on state change ("Make a fist to transform", "Open palm to return", hidden in Transitioning and while a screen is visible), bone text with hard black outline and green / orange accent
    - Debug overlay: separate canvas and stats, hidden at start; draws 21 landmarks and connections, mask tint, FPS updated each second, gesture class, mode state, per-model inference times
    - _Requirements: 6.1, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.2 Implement `App.ts` and `main.ts` and wire Phase 1
    - Bootstrap: GL context → camera → inference → render loop (rAF, not awaiting inference); resize recomputes only the CSS rect; mask upload when version changes; skip frames until `videoWidth > 0`
    - Keyboard: Space (with `preventDefault`) raises Trigger at `(0.5, 0.5)` in Normal and Return in Monster, always active; D toggles debug overlay
    - Wire GestureDetector → ModeController → Hints; context-lost message with Reload; `pagehide` disposal
    - _Requirements: 1.2, 1.4, 1.5, 3.7, 5.3, 5.8, 5.10, 6.2, 8.3, 8.4, 15.1, 15.2, 17.4_

  - [ ]* 7.3 Write unit tests for hints, keyboard, and pipeline lists
    - Hint text per mode and synchronous update; Space behavior and `preventDefault`; D toggle; pass list order per mode
    - _Requirements: 5.3, 5.8, 5.10, 6.2, 7.1, 7.2, 7.3, 7.6, 17.1_

- [x] 8. Checkpoint - Phase 1 complete
  - Run `npm run test` and `npm run build`; ensure both pass and the app is runnable with `npm run dev`. Ask the user if questions arise.

- [x] 9. Phase 2: Person shader
  - [x] 9.1 Implement `PersonPass` and its shaders
    - `kuwahara_gradient.frag.glsl` (radius-3 four-quadrant Kuwahara at half resolution, 4-band quantized gradient map green top to purple bottom) and `person.frag.glsl` (mask `smoothstep(0.45, 0.55)`, mirrored mask UVs, hard `#FF6A00` rim light, premultiplied output)
    - Full-frame fallback without rim when `hasSegmenter` is false
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.7_

  - [x] 9.2 Wire `PersonPass` into the Monster list
    - Monster list becomes solid `#2A0845` base → `PersonPass` → `PresentPass`; Phase 1 behavior remains intact
    - _Requirements: 9.1, 9.6, 17.1_

  - [ ]* 9.3 Write unit tests for the Person pass wiring
    - Pass enabled only in Monster_Mode; fallback flag when no segmenter; shader sources import via `?raw` from `src/shaders`
    - _Requirements: 9.1, 9.5, 9.7_

- [x] 10. Checkpoint - Phase 2 complete
  - Run `npm run test` and `npm run build`; ensure all tests pass, ask the user if questions arise.

- [x] 11. Phase 3: Background and flames
  - [x] 11.1 Implement `MaskBlurPass`
    - Two-pass separable 9-tap Gaussian at 1/4 resolution, rerun only when `maskVersion` changes
    - _Requirements: 11.4_

  - [x] 11.2 Implement `BackgroundPass` (halftone and light rays)
    - `halftone.frag.glsl`: 45° rotated 10 px grid, dot radius proportional to sqrt of luminance, palette colors on `#0A0A0A`
    - `rays.frag.glsl`: 24 rays from the smoothed Person_Center, rotating on `uStepTime`, additive bone
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.3 Implement `FlamesPass`
    - `flames.frag.glsl`: three layers (green, purple, bone) differing in scale, phase, and color, driven by value noise and the blurred mask, stepped animation; disabled when no segmenter
    - _Requirements: 11.1, 11.2, 11.3, 11.5, 11.6_

  - [x] 11.4 Wire Phase 3 into the pipeline
    - Monster order: `MaskBlurPass → BackgroundPass → FlamesPass → PersonPass → PresentPass`; per-step lerp (0.25) smoothing of Person_Center
    - _Requirements: 10.1, 11.4, 11.5, 17.1_

  - [ ]* 11.5 Write unit tests for Phase 3 pass ordering and predicates
    - Flames after Halftone and before Person; Flames disabled without segmenter; mask blur reruns only on a new version
    - _Requirements: 11.4, 11.5, 11.6_

- [x] 12. Checkpoint - Phase 3 complete
  - Run `npm run test` and `npm run build`; ensure all tests pass, ask the user if questions arise.

- [x] 13. Phase 4: Particle layer
  - [x] 13.1 Add Three.js and the shared-context handoff
    - Add `three` and `@types/three` with exact versions; `THREE.ColorManagement.enabled = false`; `WebGLRenderer({ canvas, context })` with `autoClear = false`, linear output, no tone mapping, no `setSize`
    - `ParticlePass` skeleton: 4x MSAA `RGBA8` render target, texture handle self-test (`renderer.properties.get(...).__webglTexture`, `gl.isTexture`) that disables the pass on failure; `resetState()` at Boundary 1 and `GlState.applyBaseline` at Boundary 2
    - _Requirements: 12.11, 17.3_

  - [x] 13.2 Implement particle geometry, kinds, and toon material
    - `kinds.ts`, `geometry.ts` (eight procedural low-poly kinds under ~120 triangles with palette vertex colors), `toon.ts` (4-texel `DataTexture` gradient map with `NearestFilter`, `MeshToonMaterial`, inverted-hull outline), one `InstancedMesh` per kind (capacity 19)
    - _Requirements: 12.2, 12.4, 12.5_

  - [x] 13.3 Implement `simulation.ts` and `distributeKinds`
    - Pure, Three-free: struct-of-arrays state, `spawn`, `step(dt, bounds, center)` outward motion, out-of-bounds respawn at center, idempotent `reset(center)` without reallocation; `distributeKinds(150, rng)` gives 18 or 19 per kind
    - _Requirements: 12.1, 12.2, 12.3, 12.6, 12.7, 12.8_

  - [ ]* 13.4 Write property test for spawn count, distribution, and palette
    - **Property 10: Particle spawn count, kind distribution, and palette**
    - **Validates: Requirements 12.1, 12.2, 12.5**

  - [ ]* 13.5 Write property test for outward motion
    - **Property 11: Particles move monotonically away from the center**
    - **Validates: Requirements 12.3**

  - [ ]* 13.6 Write property test for stepped simulation updates
    - **Property 12: Particle simulation advances only on step changes** (simulation part: state changes only on frames where the step index changed)
    - **Validates: Requirements 12.6, 14.5**

  - [ ]* 13.7 Write property test for respawn
    - **Property 13: Out-of-bounds particles respawn at the center**
    - **Validates: Requirements 12.7**

  - [ ]* 13.8 Write property test for reset
    - **Property 14: Reset is history-independent and idempotent**
    - **Validates: Requirements 12.8**

  - [x] 13.9 Complete `ParticlePass` and add `ParticleCompositePass`
    - Scene with camera (fov 40), directional + ambient light, `viewportWorldBounds()`, matrices rewritten only on step change
    - `composite.frag.glsl` and `ParticleCompositePass` blending the particle texture with `(ONE, ONE_MINUS_SRC_ALPHA)`
    - `dispose()` releases geometries, materials, gradient texture, render target, and renderer
    - _Requirements: 12.4, 12.6, 12.9, 12.10, 12.11_

  - [x] 13.10 Wire particles to Burst_Start
    - Add `ParticlePass` (first, before raw passes) and `ParticleCompositePass` (after Person) to the pipeline; both enabled when `burstStartMs !== null`
    - On burst start: `reset(personCenter)` and show; on return to Normal: hide and reset while retaining GPU resources; dispose on `pagehide`
    - _Requirements: 12.1, 12.8, 12.9, 12.10_

- [x] 14. Phase 4: Title card
  - [x] 14.1 Implement `titleCard/layout.ts`
    - `layoutRows(w, h)` returns three rows with distinct tilts (-8°, +5°, -3°) inside the canvas; `slamProgress(sinceBurstStartMs)` is 300 ms, stepped at 1/18 s, with 80 ms row stagger
    - _Requirements: 13.1, 13.2_

  - [ ]* 14.2 Write property test for title card layout
    - **Property 15: Title card rows are distinct and inside the canvas**
    - **Validates: Requirements 13.1**

  - [ ]* 14.3 Write property test for slam progress
    - **Property 16: Slam-in is monotonic, bounded, and stepped**
    - **Validates: Requirements 13.2**

  - [x] 14.4 Implement `atlas.ts`, `TitleCardPass`, and title card shaders
    - Bake "HAUNTED / PHOTO / BOOTH" once into a 2048x768 2D canvas atlas with system font stack, thick round-joined black outline, palette fills, hard purple shadow; upload with premultiply only during upload
    - `titlecard.vert.glsl` / `titlecard.frag.glsl`: three tilted quads, scale 2.5 → 1.0 with overshoot, alpha ramp, 2-step shake
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.6_

  - [x] 14.5 Wire the title card to Burst_Start
    - `TitleCardPass` placed after `ParticleCompositePass` and before `PresentPass`, enabled only while `burstStartMs !== null`; slam clock starts at Burst_Start; removed on return to Normal_Mode
    - _Requirements: 13.1, 13.5, 13.6_

  - [ ]* 14.6 Write unit and static tests for Phase 4
    - Pass list order (Particles after Person, Title card last before Present); passes disabled before Burst_Start and in Normal_Mode; title text constants are the expected original strings and no DOM element contains them; particle dispose spy; Three self-test failure disables only the particle passes
    - Automated grep test: `three` is imported only in `src/passes/ParticlePass.ts` and `src/passes/particles/*`
    - _Requirements: 12.9, 12.10, 13.3, 13.6, 17.3_

- [x] 15. Checkpoint - Phase 4 complete
  - Run `npm run test` and `npm run build`; confirm the dev-mode `GlState.assertBaseline` guard reports no warnings across the Three boundary. Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Phase 5: Shatter transition and return
  - [ ] 16.1 Implement `shatter/wedges.ts`
    - `generateWedges(seed)`: 13 weights in [0.55, 1.45], normalized to 360°, nudged until cyclically adjacent widths differ by at least 1.0° and each width ≥ 8°; boundaries from a random phase; per-wedge direction, speed, spin, z
    - _Requirements: 14.1, 14.2_

  - [ ] 16.2 Write property test for wedge geometry
    - **Property 17: Wedge geometry is valid**
    - **Validates: Requirements 14.1, 14.2**

  - [ ] 16.3 Implement `shatter/timeline.ts` and `clampOrigin`
    - `timeline(tMs)`: crack `[0, 400)`, separate `[400, 1600]`, then done; `clampOrigin` clamps to [0,1]²
    - _Requirements: 14.3, 14.4, 14.6, 14.8_

  - [ ]* 16.4 Write property test for the shatter timeline
    - **Property 18: Shatter timeline phases and completion**
    - **Validates: Requirements 14.3, 14.4, 14.6, 14.7**

  - [ ]* 16.5 Write property test for origin clamping
    - **Property 19: Origin clamping**
    - **Validates: Requirements 14.8**

  - [ ] 16.6 Implement `ShatterPass` and `shatter.frag.glsl`
    - Wedge inverse transforms in z order sampling `uNormal`, uncovered pixels show `uMonster`; jittered toxic green cracks with bone center; edge glow fading with separation; wedges fully off-screen at `separate = 1`; enabled only in Transitioning
    - _Requirements: 14.1, 14.3, 14.4, 14.5, 14.10, 14.11_

  - [ ] 16.7 Implement `ShatterDriver` and wire Phase 5
    - `ShatterDriver` replaces `ImmediateDriver`: calls `onBurstStart` once at the start of separation and `onComplete` once at the end, evaluated on the stepped clock
    - Transitioning pipeline: Monster passes without `PresentPass`, `FeedPass → targets.normal`, then `ShatterPass`; pass the clamped Fist_Position as origin; return to Normal_Mode renders the feed immediately
    - _Requirements: 14.7, 14.9, 14.10, 15.1, 15.2_

  - [ ]* 16.8 Write unit tests for Phase 5
    - Driver calls burst start once then complete once; burst start occurs at separation start, not during the crack phase; Transitioning pass list; no wedge artifacts after return (`ShatterPass` disabled outside Transitioning); cooldown (3000 ms) exceeds shatter length
    - _Requirements: 14.7, 14.9, 14.10, 15.1, 15.3_

- [ ] 17. Checkpoint - Phase 5 complete
  - Run `npm run test` and `npm run build`. Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Phase 6: Recording
  - [ ] 18.1 Implement `recorder/format.ts`
    - `recordingFileName(date)` → `haunted-photobooth-YYYYMMDD-HHmmss.webm`; `remainingSeconds(elapsedMs)` → `ceil((5000 - elapsed) / 1000)` clamped to [0,5]
    - _Requirements: 16.4, 16.8_

  - [ ]* 18.2 Write property test for the recording countdown
    - **Property 20: Recording countdown**
    - **Validates: Requirements 16.4**

  - [ ]* 18.3 Write property test for the file name format
    - **Property 21: Recording file name format**
    - **Validates: Requirements 16.8**

  - [ ] 18.4 Implement `Recorder` and `RecordButton`
    - `isSupported()` check with WebM codec selection; `captureStream(0)` plus `requestFrame()` at most every 33 ms; `MediaRecorder` at 5 Mbps, auto-stop after 5000 ms; in-memory chunks, download via temporary anchor then revoke URL; nothing uploaded
    - `RecordButton` labeled "Record 5s": disabled with remaining seconds while recording (updated 4x per second), disabled with an "unsupported" message when needed, re-enabled with an error message on failure
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.6, 16.7, 16.9_

  - [ ] 18.5 Wire the recorder into `App`
    - Call `recorder.onFrame(nowMs)` after each rendered frame; capture only the Output_Canvas so Hints, Debug_Overlay, button, and screens are excluded while the Title_Card, particles, and effects are included
    - _Requirements: 16.2, 16.5, 16.10_

  - [ ]* 18.6 Write unit tests for the recorder
    - Mocked `MediaRecorder`: unsupported path disables the button with a message; error path re-enables the button with a message; countdown display; file download uses the formatted name
    - _Requirements: 16.4, 16.6, 16.7, 16.8_

- [ ] 19. Final checkpoint - All phases complete
  - Run `npm run test` and `npm run build`; confirm static assets are produced for AWS Amplify and the `three` import grep test passes. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Required property tests (2, 3, 4, 7, 8, 17) are regular tasks; all other properties are optional.
- Each property test is a single fast-check test with at least 100 runs and a tag `// Feature: haunted-photobooth, Property N: <text>`.
- Visual quality, 30 fps on integrated GPUs, and the recorded WebM content (Title_Card and effects present; Hints, Debug_Overlay, and buttons absent) need a manual check with `npm run dev`; these are not coding tasks and are not listed above.
- Each task references specific requirements for traceability.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5", "2.2", "3.2", "4.2", "4.3", "4.4", "5.2", "5.3", "6.1"] },
    { "id": 3, "tasks": ["5.4", "5.5", "6.2", "6.3", "6.4", "7.1"] },
    { "id": 4, "tasks": ["7.2"] },
    { "id": 5, "tasks": ["7.3"] },
    { "id": 6, "tasks": ["9.1"] },
    { "id": 7, "tasks": ["9.2"] },
    { "id": 8, "tasks": ["9.3", "11.1", "11.2", "11.3"] },
    { "id": 9, "tasks": ["11.4"] },
    { "id": 10, "tasks": ["11.5"] },
    { "id": 11, "tasks": ["13.1", "13.3", "14.1", "16.1", "16.3", "18.1"] },
    { "id": 12, "tasks": ["13.2", "13.4", "13.5", "13.6", "13.7", "13.8", "14.2", "14.3", "16.2", "16.4", "16.5", "18.2", "18.3"] },
    { "id": 13, "tasks": ["13.9", "14.4", "16.6", "18.4"] },
    { "id": 14, "tasks": ["13.10"] },
    { "id": 15, "tasks": ["14.5"] },
    { "id": 16, "tasks": ["14.6"] },
    { "id": 17, "tasks": ["16.7"] },
    { "id": 18, "tasks": ["16.8"] },
    { "id": 19, "tasks": ["18.5"] },
    { "id": 20, "tasks": ["18.6"] }
  ]
}
```
