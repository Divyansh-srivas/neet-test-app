/**
 * MediaPipe Face Landmarker Wrapper for Camera Proctoring.
 * Loads face_landmarker.task and wasm from /models/.
 * Computes real 3D head pose (yaw, pitch, roll) from landmarks.
 * Provides resilient error handling: if model fails to load, gracefully falls back.
 */

let landmarkerInstance = null;
let isLoadingLandmarker = false;
let loadPromise = null;

export async function getFaceLandmarker({
  wasmPath = '/models/wasm',
  modelPath = '/models/face_landmarker.task',
  runningMode = 'VIDEO',
  numFaces = 2
} = {}) {
  if (landmarkerInstance) {
    return landmarkerInstance;
  }
  if (isLoadingLandmarker && loadPromise) {
    return loadPromise;
  }

  isLoadingLandmarker = true;
  loadPromise = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: 'GPU'
        },
        runningMode,
        numFaces,
        outputFacialTransformationMatrixes: true,
        outputFaceBlendshapes: false
      });

      return landmarkerInstance;
    } catch (primaryErr) {
      console.warn('[FaceLandmarker] GPU initialization failed, attempting CPU fallback:', primaryErr);
      try {
        const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        landmarkerInstance = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU'
          },
          runningMode,
          numFaces,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
        return landmarkerInstance;
      } catch (fallbackErr) {
        console.error('[FaceLandmarker] Failed to load FaceLandmarker (will use heuristic fallback):', fallbackErr);
        landmarkerInstance = null;
        throw fallbackErr;
      }
    } finally {
      isLoadingLandmarker = false;
    }
  })();

  return loadPromise;
}

/**
 * Extracts head pose (yaw, pitch, roll in degrees) from transformation matrix or landmarks.
 */
export function extractHeadPose(faceResult, faceIndex = 0) {
  if (!faceResult) return { yaw: 0, pitch: 0, roll: 0 };

  // 1. Try transformation matrix if provided by MediaPipe
  if (
    faceResult.facialTransformationMatrixes &&
    faceResult.facialTransformationMatrixes.length > faceIndex
  ) {
    const mat = faceResult.facialTransformationMatrixes[faceIndex].data || faceResult.facialTransformationMatrixes[faceIndex];
    if (mat && mat.length >= 16) {
      // Column-major 4x4 matrix
      const m02 = mat[8];
      const m12 = mat[9];
      const m22 = mat[10];
      const m10 = mat[1];
      const m11 = mat[5];

      const yaw = Math.atan2(m02, m22) * (180 / Math.PI);
      const pitch = Math.asin(-Math.max(-1, Math.min(1, m12))) * (180 / Math.PI);
      const roll = Math.atan2(m10, m11) * (180 / Math.PI);

      if (!isNaN(yaw) && !isNaN(pitch)) {
        return {
          yaw: Math.round(yaw * 10) / 10,
          pitch: Math.round(pitch * 10) / 10,
          roll: Math.round(roll * 10) / 10
        };
      }
    }
  }

  // 2. Compute from 3D Landmark geometry
  const landmarks = faceResult.faceLandmarks?.[faceIndex];
  if (landmarks && landmarks.length >= 264) {
    const nose = landmarks[1];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const chin = landmarks[152];
    const forehead = landmarks[10];

    const eyeMidX = (leftEye.x + rightEye.x) / 2;
    const eyeMidY = (leftEye.y + rightEye.y) / 2;
    const eyeSpan = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y) || 0.1;

    // Horizontal ratio: nose deviation from center of eyes
    const dx = nose.x - eyeMidX;
    const yaw = (dx / (eyeSpan * 0.5)) * 42;

    // Vertical ratio: nose height between forehead and chin
    const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y) || 0.2;
    const dy = nose.y - eyeMidY;
    const neutralDy = faceHeight * 0.32;
    const pitch = -((dy - neutralDy) / (faceHeight * 0.5)) * 35;

    return {
      yaw: Math.round(yaw * 10) / 10,
      pitch: Math.round(pitch * 10) / 10,
      roll: 0
    };
  }

  return { yaw: 0, pitch: 0, roll: 0 };
}
