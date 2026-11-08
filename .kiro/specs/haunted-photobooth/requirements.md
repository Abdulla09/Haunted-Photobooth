# Requirements Document

## Introduction

Haunted Photobooth is a client-side browser app built with Vite and TypeScript (vanilla, no framework). In Normal Mode it shows the user's mirrored webcam feed. A held fist gesture (or the Spacebar as a demo fallback) triggers a transition that reveals Monster Mode: a stylized anime cel-shaded Halloween scene with the person cut out, an indigo and violet halftone background, a single wispy ghost-fire, and 3D low-poly floating ghosts. A held open palm (or the Spacebar) returns to Normal Mode. The app also provides 5-second WebM recording, a debug overlay, on-screen gesture hints, and a camera-permission-denied screen.

Until the shatter transition exists (Phase 5), the Transitioning state completes immediately, so Monster Mode is reachable by a normal Trigger from Phase 1 onward and the effects of Phases 2 to 4 are visible without any developer flag.

Phases:

1. Phase 1: Camera, person segmentation, gestures, mode state, on-screen hints, inference performance, permission screen, debug overlay
2. Phase 2: Person shader
3. Phase 3: Background (halftone, flames)
4. Phase 4: Particles (ghosts)
5. Phase 5: Shatter transition and return to Normal Mode
6. Phase 6: Recording

Visual identity: anime-style flat cel art in a purple duotone; palette midnight #0D0820, deep indigo #1E1450, violet #5B3FC4, lavender #B8A8FF, ghost mint #8CFFC1, mint shadow #2E8C6A; dark ink outlines; stepped animation at a 12 to 18 fps feel; ghosts are the only motif; no text appears in the scene and the UI uses icons only; the person always stays clearly readable with face and features visible; UI chrome is minimal and dark.

Technical rules: MediaPipe Tasks Vision (HandLandmarker and ImageSegmenter selfie model, GPU delegate), Three.js for the particle layer, raw GLSL in src/shaders/*.glsl for 2D effects, each render pass in its own file under src/passes/, 30 fps target on a mid-range integrated-GPU laptop, all processing client-side, static hosting on AWS Amplify.

## Glossary

- **App**: The Haunted Photobooth browser application.
- **Camera_Service**: The component that requests the webcam through getUserMedia and exposes video frames.
- **Mirrored_Feed**: The webcam video flipped horizontally, as in a mirror.
- **Hand_Tracker**: The component wrapping the MediaPipe HandLandmarker.
- **Segmenter**: The component wrapping the MediaPipe ImageSegmenter selfie model, which produces the Person_Mask.
- **Person_Mask**: A per-pixel mask marking which pixels of the camera frame belong to the person.
- **Gesture_Detector**: The component that classifies hand landmarks as Fist, Open_Palm, or Other and measures how long a class is held.
- **Fist**: A hand pose in which all four fingertips are closer to the wrist than their PIP landmarks.
- **Open_Palm**: A hand pose in which all four fingers and the thumb are extended.
- **Fist_Position**: The normalized position of the palm-center landmark, used as the shatter origin.
- **Mode_Controller**: The state machine with the states Normal_Mode, Transitioning, and Monster_Mode.
- **Normal_Mode**: The state in which the App shows the Mirrored_Feed.
- **Monster_Mode**: The state in which the App renders the Person_Pass, Background_Pass, Flames, and Particle_Pass.
- **Transitioning**: The Mode_Controller state between Normal_Mode and Monster_Mode.
- **Trigger**: An event, raised by a held Fist or by the Spacebar, that requests the change from Normal_Mode to Monster_Mode.
- **Return_Event**: An event, raised by a held Open_Palm or by the Spacebar, that requests the change from Monster_Mode to Normal_Mode.
- **Cooldown**: A period during which the Mode_Controller ignores Triggers and Return_Events.
- **Render_Pipeline**: The ordered sequence of named render passes, each implemented in its own file under src/passes/.
- **Output_Canvas**: The single canvas element on which the Render_Pipeline draws the final composited image; the Recorder captures this canvas.
- **Person_Pass**: The render pass that draws the stylized person using the Person_Mask.
- **Kuwahara_Filter**: An edge-preserving painterly smoothing filter.
- **Gradient_Map**: A purple duotone color mapping from luminance, with midnight in the shadows, violet in the midtones, and lavender in the highlights.
- **Ink_Outline**: A dark (midnight) line-art outline drawn on the Person_Pass where the luminance has strong edges.
- **Mint_Glow**: A ghost mint (#8CFFC1) glow outline along the edge of the Person_Mask.
- **Background_Pass**: The render pass that draws the Halftone_Image.
- **Halftone_Image**: A halftone-dot rendering of the camera image in indigo and violet dots on midnight paper.
- **Flames**: A single soft, wispy ghost-mint ghost-fire that rises mostly upward behind the person.
- **Particle**: A flat cel-shaded ghost in the Particle_Pass.
- **Particle_Kind**: The single ghost kind: a flat cute ghost with a rounded head, a wavy bottom, and two dark oval eyes, in ghost mint with a dark outline.
- **Particle_Pass**: The Three.js render pass that draws Particles.
- **Person_Center**: The normalized centroid of the Person_Mask.
- **Shatter_Pass**: The render pass that draws the shatter transition.
- **Wedge**: One irregular piece of the screen in the shatter transition.
- **Crack_Effect**: Glowing ghost mint cracks drawn along the Wedge boundaries.
- **Burst_Start**: The moment the Wedges begin separating, or the moment the Mode_Controller enters Monster_Mode when no Shatter_Pass exists. The particle burst starts here.
- **Stepped_Rate**: An 18 fps update rate for stylized animation, independent of the render rate.
- **Recorder**: The component that records the Output_Canvas to WebM using MediaRecorder.
- **Record_Button**: An icon-only button showing a red record-dot, with an accessible name, that starts a recording.
- **Debug_Overlay**: A toggleable overlay showing landmarks, the Person_Mask tint, and statistics.
- **Permission_Screen**: The screen shown when camera access is denied or no camera is found.
- **Hint**: A ghost mint icon (a fist or an open palm, with no words) that shows the user which gesture to make next.
- **Inference_Input**: The reduced-resolution image that the App passes to the Hand_Tracker and the Segmenter.

## Requirements

### Requirement 1: Camera Feed in Normal Mode (Phase 1)

**User Story:** As a user, I want to see my mirrored webcam feed when the app opens, so that I can frame myself before transforming.

#### Acceptance Criteria

1. WHEN the App loads, THE Camera_Service SHALL request webcam access.
2. WHEN webcam access is granted, THE App SHALL render the Mirrored_Feed full-viewport in Normal_Mode.
3. THE App SHALL process all camera frames locally and send no camera data over the network.
4. THE App SHALL render at a target of 30 fps on a mid-range laptop with integrated graphics.
5. WHEN the browser window is resized, THE App SHALL resize the canvas and preserve the camera aspect ratio.
6. THE App SHALL present a dark, minimal UI chrome that keeps the camera scene dominant.

### Requirement 2: Camera Permission Denied Screen (Phase 1)

**User Story:** As a user who denied camera access, I want a clear explanation and a way to retry, so that I can use the app without reloading the page.

#### Acceptance Criteria

1. IF webcam access is denied, THEN THE App SHALL display the Permission_Screen.
2. THE Permission_Screen SHALL state that the camera is required and that camera data stays in the browser.
3. THE Permission_Screen SHALL provide a "Try again" button.
4. WHEN the user activates the "Try again" button, THE Camera_Service SHALL request webcam access again.
5. WHEN a retried webcam request succeeds, THE App SHALL hide the Permission_Screen and show the Mirrored_Feed.
6. IF no webcam is found, THEN THE App SHALL display the Permission_Screen with a "no camera detected" message.

### Requirement 3: Hand Tracking and Gesture Recognition (Phase 1)

**User Story:** As a user, I want the app to recognize a held fist and a held open palm, so that I can switch modes with my hand.

#### Acceptance Criteria

1. THE Hand_Tracker SHALL track one hand using the MediaPipe HandLandmarker with the GPU delegate.
2. WHEN the Hand_Tracker produces a detection result, THE Gesture_Detector SHALL classify the hand as Fist, Open_Palm, or Other.
3. WHEN the Gesture_Detector classifies a Fist continuously for 250 ms, THE Gesture_Detector SHALL raise a Trigger carrying the Fist_Position.
4. WHILE the Mode_Controller is in Monster_Mode, WHEN the Gesture_Detector classifies an Open_Palm continuously for 500 ms, THE Gesture_Detector SHALL raise a Return_Event.
5. WHEN the gesture class changes or the hand is lost, THE Gesture_Detector SHALL reset the hold timer.
6. THE Gesture_Detector SHALL mirror the x coordinate of the Fist_Position to match the Mirrored_Feed.
7. IF the HandLandmarker fails to load, THEN THE App SHALL keep showing the Mirrored_Feed and enable the Spacebar as the Trigger and Return_Event source.

### Requirement 4: Person Segmentation (Phase 1)

**User Story:** As a user, I want the app to find my silhouette from the start, so that the debug view and the Monster Mode effects can use an accurate cutout.

#### Acceptance Criteria

1. THE Segmenter SHALL produce the Person_Mask using the MediaPipe ImageSegmenter selfie model with the GPU delegate.
2. WHEN the Segmenter produces a Person_Mask, THE App SHALL upload the Person_Mask to the GPU as a texture.
3. THE App SHALL compute the Person_Center at least 10 times per second.
4. IF the Person_Mask contains no person pixels, THEN THE App SHALL set the Person_Center to the viewport center.
5. IF the Segmenter fails to load, THEN THE App SHALL keep the Trigger enabled and, in Monster_Mode, apply the stylized effects to the full camera frame without a person cutout.
6. IF the Segmenter fails to load, THEN THE App SHALL set the Person_Center to the viewport center.

### Requirement 5: Mode State and Trigger Control (Phase 1)

**User Story:** As a user, I want predictable and debounced mode switching, so that accidental gestures do not cause flicker between modes.

#### Acceptance Criteria

1. WHEN the App starts, THE Mode_Controller SHALL be in Normal_Mode.
2. WHEN a Trigger is received in Normal_Mode and no Cooldown is active, THE Mode_Controller SHALL enter Transitioning and start a Cooldown of 3000 ms.
3. WHEN the Spacebar is pressed in Normal_Mode and no Cooldown is active, THE App SHALL raise a Trigger with the Fist_Position at the viewport center.
4. WHILE a Cooldown is active, THE Mode_Controller SHALL ignore all Triggers and Return_Events.
5. WHEN the transition completes, THE Mode_Controller SHALL enter Monster_Mode.
6. WHILE the Shatter_Pass is not yet implemented, THE Mode_Controller SHALL complete the Transitioning state immediately so that Monster_Mode is reachable by a Trigger.
7. WHEN a Return_Event is received in Monster_Mode and no Cooldown is active, THE Mode_Controller SHALL enter Normal_Mode and start a Cooldown of 1500 ms.
8. WHEN the Spacebar is pressed in Monster_Mode and no Cooldown is active, THE App SHALL raise a Return_Event.
9. WHILE the Mode_Controller is in Transitioning, THE Mode_Controller SHALL ignore Return_Events.
10. WHEN the Spacebar is pressed, THE App SHALL prevent the default page scroll.

### Requirement 6: Debug Overlay (Phase 1)

**User Story:** As a developer, I want a toggleable debug view, so that I can verify tracking, segmentation, and performance.

#### Acceptance Criteria

1. THE Debug_Overlay SHALL be hidden when the App starts.
2. WHEN the user presses the D key, THE App SHALL toggle the Debug_Overlay.
3. WHILE the Debug_Overlay is visible, THE Debug_Overlay SHALL draw the 21 hand landmarks and their connections over the Mirrored_Feed.
4. WHILE the Debug_Overlay is visible, THE Debug_Overlay SHALL draw the Person_Mask as a semi-transparent tint.
5. WHILE the Debug_Overlay is visible, THE Debug_Overlay SHALL show the frames per second, updated once per second.
6. WHILE the Debug_Overlay is visible, THE Debug_Overlay SHALL show the current gesture class and the Mode_Controller state.

### Requirement 7: On-Screen Gesture Hints (Phase 1)

**User Story:** As a first-time user, I want on-screen hints that tell me which gesture to make, so that I can discover the transformation without instructions.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Normal_Mode and the Permission_Screen is hidden, THE App SHALL display the Hint as a pulsing fist icon.
2. WHILE the Mode_Controller is in Monster_Mode, THE App SHALL display the Hint as an open palm icon.
3. WHILE the Mode_Controller is in Transitioning, THE App SHALL hide the Hint.
4. THE App SHALL draw the Hint icons in ghost mint (#8CFFC1) and SHALL show no words in the Hint.
5. THE App SHALL position the Hint at the bottom center of the viewport so that the Hint does not cover the centre of the camera scene.
6. WHEN the Mode_Controller changes between Normal_Mode and Monster_Mode, THE App SHALL change the Hint icon within 100 ms of the state change.
7. THE App SHALL expose a text alternative for the Hint through an aria-label and an aria-live region ("Make a fist to transform" in Normal_Mode and "Open palm to return" in Monster_Mode) that is not visible on screen.

### Requirement 8: Inference Performance (Phase 1)

**User Story:** As a user, I want smooth video even while tracking runs, so that the app feels responsive on a modest laptop.

#### Acceptance Criteria

1. THE App SHALL pass the Hand_Tracker and the Segmenter an Inference_Input that has a lower resolution than the camera frame.
2. THE App SHALL allow the Hand_Tracker and the Segmenter to update at a lower rate than the render loop.
3. THE App SHALL run the render loop without waiting for the completion of any Hand_Tracker or Segmenter inference.
4. WHILE an inference call is in progress, THE App SHALL render each frame using the most recent completed Person_Mask and hand result.

### Requirement 9: Person Shader (Phase 2)

**User Story:** As a user, I want to see myself as a cel-shaded purple anime cutout, so that Monster Mode looks like an anime ghost scene.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Monster_Mode, THE Person_Pass SHALL render only the camera pixels inside the Person_Mask.
2. THE Person_Pass SHALL apply the Kuwahara_Filter before the Gradient_Map.
3. THE Person_Pass SHALL apply the Gradient_Map with midnight (#0D0820) in the shadows, violet (#5B3FC4) in the midtones, and lavender (#B8A8FF) in the highlights, and SHALL quantize the luminance into hard posterized bands.
4. THE Person_Pass SHALL draw the Mint_Glow in ghost mint (#8CFFC1) along the edge of the Person_Mask.
5. THE Person_Pass SHALL draw the Ink_Outline in midnight (#0D0820) from luminance edges, as anime line art.
6. THE Person_Pass SHALL use a Kuwahara_Filter radius small enough that the face and its features stay clearly readable.
7. THE Person_Pass SHALL be implemented in its own file under src/passes/ with its GLSL in src/shaders/*.glsl.
8. WHEN the Person_Pass is added, THE App SHALL remain runnable with the Phase 1 functions intact.
9. IF the Segmenter fails to load, THEN THE Person_Pass SHALL apply the Kuwahara_Filter, the Gradient_Map, and the Ink_Outline to the full camera frame and omit the Mint_Glow.

### Requirement 10: Halftone Background (Phase 3)

**User Story:** As a user, I want a halftone comic-style background behind me, so that the scene feels like an anime frame.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Monster_Mode, THE Background_Pass SHALL render the Halftone_Image of the camera behind the Person_Pass output.
2. THE Background_Pass SHALL draw the halftone dots in deep indigo (#1E1450) and violet (#5B3FC4) on midnight (#0D0820) paper, with a dot radius proportional to the local luminance.
3. THE Background_Pass SHALL NOT render light rays or any other ray effect.
4. THE Background_Pass SHALL be implemented in its own file under src/passes/ with its GLSL in src/shaders/*.glsl.

### Requirement 11: Ghost-Fire Flames (Phase 3)

**User Story:** As a user, I want a soft ghost-fire rising behind me, so that I look haunted.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Monster_Mode, THE App SHALL render a single Flames shape that rises mostly upward behind the person, tallest above the head.
2. THE App SHALL render the Flames with curling tongue tips, a soft glow edge, and slight transparency.
3. THE App SHALL color the Flames with mint shadow (#2E8C6A) inside and ghost mint (#8CFFC1) at the edges.
4. THE App SHALL animate the Flames at the Stepped_Rate.
5. WHEN the Person_Mask updates, THE App SHALL update the Flames silhouette within one rendered frame.
6. THE App SHALL render the Flames behind the Person_Pass output and in front of the Halftone_Image.
7. IF the Segmenter fails to load, THEN THE App SHALL omit the Flames.

### Requirement 12: Ghost Particle Layer (Phase 4)

**User Story:** As a user, I want cute flat ghosts bursting out and floating around me, so that Monster Mode feels alive.

#### Acceptance Criteria

1. WHEN Burst_Start occurs, THE Particle_Pass SHALL spawn about 20 Particles (ghosts) at the Person_Center.
2. THE Particle_Pass SHALL render every Particle as the single ghost Particle_Kind, with a rounded head, a wavy bottom, and two dark oval eyes.
3. THE Particle_Pass SHALL give each Particle an initial velocity directed away from the Person_Center, so that the ghosts burst out.
4. THE Particle_Pass SHALL render each Particle as a flat shape in ghost mint (#8CFFC1) with a dark outline, using a cel-shaded material with at most four discrete shading bands.
5. WHEN the burst ends, THE Particle_Pass SHALL make each Particle float and drift around the person with a gentle bob.
6. THE Particle_Pass SHALL update Particle motion at the Stepped_Rate.
7. THE Particle_Pass SHALL keep every Particle outside a clear zone around the face and the Person_Center, so that no Particle covers the face.
8. WHEN a Particle leaves the viewport bounds, THE Particle_Pass SHALL bring the Particle back into view outside the clear zone.
9. WHEN the Mode_Controller enters Normal_Mode, THE Particle_Pass SHALL hide all Particles shown since Burst_Start and reset their state while retaining the allocated GPU resources.
10. WHEN the page unloads, THE Particle_Pass SHALL release its GPU resources.
11. THE Particle_Pass SHALL render in front of the Person_Pass output.
12. THE Particle_Pass SHALL be implemented in its own file under src/passes/ using Three.js.

### Requirement 13: Removed

**User Story:** Not applicable. The Title_Card was removed in the visual redesign. The number is retained so that Requirement 14 and later keep their identifiers.

#### Acceptance Criteria

1. THE App SHALL NOT display a Title_Card or any other text in the rendered scene.

### Requirement 14: Shatter Transition (Phase 5)

**User Story:** As a user, I want the screen to shatter from my fist into Monster Mode, so that the transformation feels dramatic.

#### Acceptance Criteria

1. WHEN the Mode_Controller enters Transitioning, THE Shatter_Pass SHALL divide the screen into 13 irregular Wedges radiating from the Fist_Position.
2. THE Shatter_Pass SHALL choose the Wedge angles so that the angles sum to 360 degrees and no two adjacent Wedges have identical angular widths.
3. WHEN the Shatter_Pass starts, THE Shatter_Pass SHALL draw the Crack_Effect in ghost mint (#8CFFC1) with a glow for 400 ms before the Wedges separate.
4. WHEN the Crack_Effect ends, THE Shatter_Pass SHALL move the Wedges apart to reveal Monster_Mode underneath.
5. THE Shatter_Pass SHALL animate at the Stepped_Rate of 18 fps.
6. THE Shatter_Pass SHALL complete the Wedge separation within 1200 ms of the end of the Crack_Effect.
7. WHEN the Wedge separation completes, THE Shatter_Pass SHALL notify the Mode_Controller.
8. IF the Fist_Position lies outside the viewport, THEN THE Shatter_Pass SHALL clamp the Fist_Position to the viewport bounds.
9. WHEN the Shatter_Pass is added, THE Mode_Controller SHALL replace the immediate placeholder transition with the Shatter_Pass.
10. WHEN the Mode_Controller returns to Normal_Mode, THE App SHALL show no Wedge artifacts.
11. THE Shatter_Pass SHALL be implemented in its own file under src/passes/ with its GLSL in src/shaders/*.glsl.

### Requirement 15: Return to Normal Mode (Phase 5)

**User Story:** As a user, I want to return to the plain camera view with an open palm or the Spacebar, so that I can switch back at will.

#### Acceptance Criteria

1. WHEN the Mode_Controller accepts a Return_Event, THE App SHALL stop rendering the Person_Pass, Background_Pass, Flames, and Particle_Pass.
2. WHEN the Mode_Controller accepts a Return_Event, THE App SHALL render the Mirrored_Feed full-viewport within 100 ms.
3. WHILE the Cooldown from the most recent Trigger or Return_Event is active, THE Mode_Controller SHALL ignore Return_Events from both the Open_Palm hold and the Spacebar.
4. WHEN the Cooldown has expired, THE Mode_Controller SHALL accept a new Trigger.

### Requirement 16: Record 5 Seconds to WebM (Phase 6)

**User Story:** As a user, I want to record a 5-second clip of the scene, so that I can save and share my transformation.

#### Acceptance Criteria

1. THE App SHALL display the Record_Button as a red record-dot icon with no text label and an aria-label that names the action.
2. WHEN the user activates the Record_Button, THE Recorder SHALL capture the Output_Canvas at 30 fps for 5000 ms using MediaRecorder.
3. WHEN the recording ends, THE Recorder SHALL produce a WebM file and start a browser download.
4. WHILE a recording is in progress, THE App SHALL disable the Record_Button and show a circular countdown ring, instead of numbers, that shows the remaining time.
5. THE Recorder SHALL exclude the Debug_Overlay, the Hints, and the UI chrome from the recording.
6. IF MediaRecorder or WebM is unsupported, THEN THE App SHALL disable the Record_Button and expose an unsupported message as its accessible name.
7. IF a recording fails, THEN THE App SHALL re-enable the Record_Button and expose an error message through an aria-live region.
8. THE Recorder SHALL name the file haunted-photobooth-<timestamp>.webm.
9. THE Recorder SHALL keep all recorded data in the browser.

### Requirement 17: Rendering Architecture and Deployment (All Phases)

**User Story:** As a developer, I want a clean pass-based architecture and a static build, so that each phase runs on its own and the app deploys easily.

#### Acceptance Criteria

1. THE Render_Pipeline SHALL run named passes in a fixed order, each implemented in its own file under src/passes/.
2. THE App SHALL store all GLSL in src/shaders/*.glsl.
3. THE App SHALL use Three.js only for the Particle_Pass and raw GLSL for all 2D effects.
4. WHEN a phase is completed, THE App SHALL run without errors using npm run dev.
5. WHEN npm run build is executed, THE App SHALL produce static assets deployable to AWS Amplify.
6. THE App SHALL load the MediaPipe WASM files and models from the bundled assets, local hosting, or a fixed versioned URL.
7. IF a WebGL2 context cannot be created, THEN THE App SHALL show a message that WebGL2 is required.