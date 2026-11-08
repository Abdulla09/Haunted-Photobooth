# Requirements Document

## Introduction

Haunted Photobooth is a client-side browser app built with Vite and TypeScript (vanilla, no framework). In Normal Mode it shows the user's mirrored webcam feed. A held fist gesture (or the Spacebar as a demo fallback) triggers a transition that reveals Monster Mode: a stylized anime cel-shaded Halloween scene with the person cut out, a halftone background, ghost-fire flames, 3D low-poly particles, and a title card. A held open palm (or the Spacebar) returns to Normal Mode. The app also provides 5-second WebM recording, a debug overlay, on-screen gesture hints, and a camera-permission-denied screen.

Until the shatter transition exists (Phase 5), the Transitioning state completes immediately, so Monster Mode is reachable by a normal Trigger from Phase 1 onward and the effects of Phases 2 to 4 are visible without any developer flag.

Phases:

1. Phase 1: Camera, person segmentation, gestures, mode state, on-screen hints, inference performance, permission screen, debug overlay
2. Phase 2: Person shader
3. Phase 3: Background (halftone, light rays, flames)
4. Phase 4: Particles and title card
5. Phase 5: Shatter transition and return to Normal Mode
6. Phase 6: Recording

Visual identity: palette toxic green #39FF14, deep purple #2A0845, pumpkin orange #FF6A00, bone #F2EAD3, black #0A0A0A; stepped animation at a 12 to 18 fps feel; original title text only, with no copyrighted characters, logos, or show names; UI chrome is minimal and dark.

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
- **Monster_Mode**: The state in which the App renders the Person_Pass, Background_Pass, Flames, Particle_Pass, and Title_Card.
- **Transitioning**: The Mode_Controller state between Normal_Mode and Monster_Mode.
- **Trigger**: An event, raised by a held Fist or by the Spacebar, that requests the change from Normal_Mode to Monster_Mode.
- **Return_Event**: An event, raised by a held Open_Palm or by the Spacebar, that requests the change from Monster_Mode to Normal_Mode.
- **Cooldown**: A period during which the Mode_Controller ignores Triggers and Return_Events.
- **Render_Pipeline**: The ordered sequence of named render passes, each implemented in its own file under src/passes/.
- **Output_Canvas**: The single canvas element on which the Render_Pipeline draws the final composited image; the Recorder captures this canvas.
- **Person_Pass**: The render pass that draws the stylized person using the Person_Mask.
- **Kuwahara_Filter**: An edge-preserving painterly smoothing filter.
- **Gradient_Map**: A color mapping from luminance to a vertical gradient running from toxic green at the top to deep purple at the bottom.
- **Rim_Light**: A hard-edged pumpkin orange (#FF6A00) band along the inner edge of the Person_Mask.
- **Background_Pass**: The render pass that draws the Halftone_Image and Light_Rays.
- **Halftone_Image**: A halftone-dot rendering of the camera image.
- **Light_Rays**: Rays radiating from the Person_Center.
- **Flames**: Three layers of ghost-fire that follow the Person_Mask silhouette.
- **Particle**: A 3D low-poly object in the Particle_Pass.
- **Particle_Kind**: One of bat, skull, pumpkin, candy corn, coffin, eyeball, tombstone, or spider.
- **Particle_Pass**: The Three.js render pass that draws Particles.
- **Person_Center**: The normalized centroid of the Person_Mask.
- **Title_Card**: The three-row tilted title text shown in Monster_Mode, drawn into the Output_Canvas by a render pass, and therefore part of any recording.
- **Shatter_Pass**: The render pass that draws the shatter transition.
- **Wedge**: One irregular piece of the screen in the shatter transition.
- **Crack_Effect**: Glowing toxic green cracks drawn along the Wedge boundaries.
- **Burst_Start**: The moment the Wedges begin separating, or the moment the Mode_Controller enters Monster_Mode when no Shatter_Pass exists. The particle burst and title slam start here.
- **Stepped_Rate**: An 18 fps update rate for stylized animation, independent of the render rate.
- **Recorder**: The component that records the Output_Canvas to WebM using MediaRecorder.
- **Record_Button**: The button labeled "Record 5s" that starts a recording.
- **Debug_Overlay**: A toggleable overlay showing landmarks, the Person_Mask tint, and statistics.
- **Permission_Screen**: The screen shown when camera access is denied or no camera is found.
- **Hint**: A short on-screen text label that tells the user which gesture to make next.
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

1. WHILE the Mode_Controller is in Normal_Mode and the Permission_Screen is hidden, THE App SHALL display the Hint "Make a fist to transform".
2. WHILE the Mode_Controller is in Monster_Mode, THE App SHALL display the Hint "Open palm to return".
3. WHILE the Mode_Controller is in Transitioning, THE App SHALL hide the Hint.
4. THE App SHALL style the Hint in bone (#F2EAD3) text with a black (#0A0A0A) hard outline and a toxic green (#39FF14) accent in Normal_Mode and a pumpkin orange (#FF6A00) accent in Monster_Mode.
5. THE App SHALL position the Hint near the bottom of the viewport so that the Hint does not cover the centre of the camera scene.
6. WHEN the Mode_Controller changes between Normal_Mode and Monster_Mode, THE App SHALL change the Hint text within 100 ms of the state change.

### Requirement 8: Inference Performance (Phase 1)

**User Story:** As a user, I want smooth video even while tracking runs, so that the app feels responsive on a modest laptop.

#### Acceptance Criteria

1. THE App SHALL pass the Hand_Tracker and the Segmenter an Inference_Input that has a lower resolution than the camera frame.
2. THE App SHALL allow the Hand_Tracker and the Segmenter to update at a lower rate than the render loop.
3. THE App SHALL run the render loop without waiting for the completion of any Hand_Tracker or Segmenter inference.
4. WHILE an inference call is in progress, THE App SHALL render each frame using the most recent completed Person_Mask and hand result.

### Requirement 9: Person Shader (Phase 2)

**User Story:** As a user, I want to see myself as a cel-shaded monster cutout, so that Monster Mode looks like an anime Halloween scene.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Monster_Mode, THE Person_Pass SHALL render only the camera pixels inside the Person_Mask.
2. THE Person_Pass SHALL apply the Kuwahara_Filter before the Gradient_Map.
3. THE Person_Pass SHALL apply the Gradient_Map with toxic green (#39FF14) at the top and deep purple (#2A0845) at the bottom.
4. THE Person_Pass SHALL draw the Rim_Light in pumpkin orange (#FF6A00) along the inner edge of the Person_Mask.
5. THE Person_Pass SHALL be implemented in its own file under src/passes/ with its GLSL in src/shaders/*.glsl.
6. WHEN the Person_Pass is added, THE App SHALL remain runnable with the Phase 1 functions intact.
7. IF the Segmenter fails to load, THEN THE Person_Pass SHALL apply the Kuwahara_Filter and the Gradient_Map to the full camera frame and omit the Rim_Light.

### Requirement 10: Halftone Background (Phase 3)

**User Story:** As a user, I want a halftone comic-style background behind me, so that the scene feels like an anime frame.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Monster_Mode, THE Background_Pass SHALL render the Halftone_Image of the camera behind the Person_Pass output.
2. THE Background_Pass SHALL color the halftone dots from the palette with a dot radius proportional to the local luminance.
3. THE Background_Pass SHALL render Light_Rays radiating from the Person_Center.
4. THE Background_Pass SHALL animate the Light_Rays at the Stepped_Rate.
5. THE Background_Pass SHALL be implemented in its own file under src/passes/ with its GLSL in src/shaders/*.glsl.

### Requirement 11: Ghost-Fire Flames (Phase 3)

**User Story:** As a user, I want ghostly flames hugging my silhouette, so that I look haunted.

#### Acceptance Criteria

1. WHILE the Mode_Controller is in Monster_Mode, THE App SHALL render three Flames layers that follow the Person_Mask silhouette.
2. THE App SHALL differentiate the Flames layers by color, scale, and animation phase, using toxic green, deep purple, and bone.
3. THE App SHALL animate the Flames at the Stepped_Rate.
4. WHEN the Person_Mask updates, THE App SHALL update the Flames silhouette within one rendered frame.
5. THE App SHALL render the Flames behind the Person_Pass output and in front of the Halftone_Image.
6. IF the Segmenter fails to load, THEN THE App SHALL omit the Flames.

### Requirement 12: Halloween Particle Layer (Phase 4)

**User Story:** As a user, I want 3D Halloween objects bursting out around me, so that Monster Mode feels alive.

#### Acceptance Criteria

1. WHEN Burst_Start occurs, THE Particle_Pass SHALL spawn 150 Particles at the Person_Center.
2. THE Particle_Pass SHALL distribute the Particles across all eight Particle_Kinds with at least 10 Particles of each kind.
3. THE Particle_Pass SHALL give each Particle an initial velocity directed away from the Person_Center.
4. THE Particle_Pass SHALL render each Particle as a low-poly mesh with a cel-shaded material that uses at most four discrete shading bands.
5. THE Particle_Pass SHALL color the Particles from the palette.
6. THE Particle_Pass SHALL update Particle motion and rotation at the Stepped_Rate.
7. WHEN a Particle leaves the viewport bounds, THE Particle_Pass SHALL respawn the Particle at the Person_Center with a new outward velocity.
8. WHEN the Mode_Controller enters Normal_Mode, THE Particle_Pass SHALL hide all Particles shown since Burst_Start and reset their state while retaining the allocated GPU resources.
9. WHEN the page unloads, THE Particle_Pass SHALL release its GPU resources.
10. THE Particle_Pass SHALL render in front of the Person_Pass output.
11. THE Particle_Pass SHALL be implemented in its own file under src/passes/ using Three.js.

### Requirement 13: Title Card (Phase 4)

**User Story:** As a user, I want a dramatic title card slamming onto the screen, so that the transformation feels like an episode opening.

#### Acceptance Criteria

1. WHEN Burst_Start occurs, THE App SHALL display the Title_Card as three text rows, each tilted at a different angle.
2. WHEN the Title_Card appears, THE App SHALL play a slam-in animation lasting between 200 ms and 400 ms at the Stepped_Rate.
3. THE Title_Card SHALL use original text that contains no copyrighted characters, logos, or show names.
4. THE Title_Card SHALL use palette colors with a hard outline.
5. WHEN the Mode_Controller enters Normal_Mode, THE App SHALL remove the Title_Card.
6. THE App SHALL render the Title_Card as part of the Render_Pipeline and SHALL NOT render the Title_Card as an HTML element.

### Requirement 14: Shatter Transition (Phase 5)

**User Story:** As a user, I want the screen to shatter from my fist into Monster Mode, so that the transformation feels dramatic.

#### Acceptance Criteria

1. WHEN the Mode_Controller enters Transitioning, THE Shatter_Pass SHALL divide the screen into 13 irregular Wedges radiating from the Fist_Position.
2. THE Shatter_Pass SHALL choose the Wedge angles so that the angles sum to 360 degrees and no two adjacent Wedges have identical angular widths.
3. WHEN the Shatter_Pass starts, THE Shatter_Pass SHALL draw the Crack_Effect in toxic green with a glow for 400 ms before the Wedges separate.
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

1. WHEN the Mode_Controller accepts a Return_Event, THE App SHALL stop rendering the Person_Pass, Background_Pass, Flames, Particle_Pass, and Title_Card.
2. WHEN the Mode_Controller accepts a Return_Event, THE App SHALL render the Mirrored_Feed full-viewport within 100 ms.
3. WHILE the Cooldown from the most recent Trigger or Return_Event is active, THE Mode_Controller SHALL ignore Return_Events from both the Open_Palm hold and the Spacebar.
4. WHEN the Cooldown has expired, THE Mode_Controller SHALL accept a new Trigger.

### Requirement 16: Record 5 Seconds to WebM (Phase 6)

**User Story:** As a user, I want to record a 5-second clip of the scene, so that I can save and share my transformation.

#### Acceptance Criteria

1. THE App SHALL display the Record_Button.
2. WHEN the user activates the Record_Button, THE Recorder SHALL capture the Output_Canvas at 30 fps for 5000 ms using MediaRecorder.
3. WHEN the recording ends, THE Recorder SHALL produce a WebM file and start a browser download.
4. WHILE a recording is in progress, THE App SHALL disable the Record_Button and show the remaining seconds.
5. THE Recorder SHALL exclude the Debug_Overlay, the Hints, and the UI chrome from the recording.
6. IF MediaRecorder or WebM is unsupported, THEN THE App SHALL disable the Record_Button and show an unsupported message.
7. IF a recording fails, THEN THE App SHALL re-enable the Record_Button and show an error message.
8. THE Recorder SHALL name the file haunted-photobooth-<timestamp>.webm.
9. THE Recorder SHALL keep all recorded data in the browser.
10. THE Recorder SHALL include the Title_Card in the recording, because the Title_Card is drawn into the Output_Canvas.

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