# Tech rules
- Vite + TypeScript, vanilla (no framework)
- MediaPipe Tasks Vision (@mediapipe/tasks-vision): HandLandmarker and ImageSegmenter (selfie model), GPU delegate
- Three.js for the 3D particle layer; raw GLSL for all 2D effects
- Rendering is a sequence of named passes, each in its own file under src/passes/
- Shaders live in src/shaders/*.glsl
- Target 30fps on a mid-range laptop with integrated GPU
- All processing is client-side. Camera data never leaves the browser.
- Deploy target: AWS Amplify (static hosting)