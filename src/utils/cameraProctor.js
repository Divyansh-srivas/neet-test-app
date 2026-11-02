/**
 * Client-side Camera Proctoring & Frame Analysis Engine.
 * Captures video frames, computes lighting/variance, detects face presence,
 * estimates head pose with MediaPipe FaceLandmarker, drives the ProctoringStateMachine,
 * and captures small snapshots (<=20KB).
 */

import { PROCTORING_CONFIG } from '../config/proctoring.js';
import { ProctoringStateMachine, VIOLATION_TYPES } from './proctoringStateMachine.js';
import { getFaceLandmarker, extractHeadPose } from './faceLandmarker.js';

export class CameraProctor {
  constructor({
    videoElement = null,
    onViolation = () => {},
    onStateChange = () => {},
    onFallbackToWithoutCamera = () => {},
    initialViolationCount = 0,
    baselinePose = { yaw: 0, pitch: 0 }
  } = {}) {
    this.videoElement = videoElement;
    this.onViolation = onViolation;
    this.onStateChange = onStateChange;
    this.onFallbackToWithoutCamera = onFallbackToWithoutCamera;

    this.stateMachine = new ProctoringStateMachine(PROCTORING_CONFIG);
    this.stateMachine.setViolationCount(initialViolationCount);
    if (baselinePose) {
      this.stateMachine.setBaselinePose(baselinePose);
    }

    this.stream = null;
    this.intervalId = null;
    this.isRunning = false;
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.landmarker = null;
    this.faceDetector = null;
    this.isCameraLost = false;

    // Bound listeners for stream disconnection
    this._handleTrackEnded = this._handleTrackEnded.bind(this);
    this._handleTrackMute = this._handleTrackMute.bind(this);
  }

  _handleTrackEnded() {
    console.warn('[CameraProctor] Video track ended unexpectedly (CAMERA_LOST)');
    this.isCameraLost = true;
  }

  _handleTrackMute() {
    console.warn('[CameraProctor] Video track muted (CAMERA_LOST)');
    this.isCameraLost = true;
  }

  /**
   * Initializes webcam stream and starts real-time proctoring.
   */
  async start() {
    if (this.isRunning) return;

    // 1. Check getUserMedia support
    if (!navigator?.mediaDevices?.getUserMedia) {
      console.warn('[CameraProctor] getUserMedia not supported on this browser.');
      this.onFallbackToWithoutCamera({ reason: 'unsupported' });
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: PROCTORING_CONFIG.SNAPSHOT_WIDTH },
          height: { ideal: PROCTORING_CONFIG.SNAPSHOT_HEIGHT },
          facingMode: 'user'
        },
        audio: false
      });

      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.addEventListener('ended', this._handleTrackEnded);
        videoTrack.addEventListener('mute', this._handleTrackMute);
      }

      if (this.videoElement) {
        this.videoElement.srcObject = this.stream;
        this.videoElement.playsInline = true;
        this.videoElement.muted = true;
        await this.videoElement.play().catch(e => console.warn('[CameraProctor] play() note:', e));
      }
    } catch (err) {
      console.warn('[CameraProctor] Failed to acquire camera stream:', err);
      this.onFallbackToWithoutCamera({ reason: 'permission_or_device_error', error: err });
      return;
    }

    // 2. Initialize offscreen analysis canvas
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = PROCTORING_CONFIG.SNAPSHOT_WIDTH;
    this.offscreenCanvas.height = PROCTORING_CONFIG.SNAPSHOT_HEIGHT;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });

    // 3. Initialize Face Landmarker (MediaPipe WASM + .task model)
    try {
      this.landmarker = await getFaceLandmarker({
        wasmPath: '/models/wasm',
        modelPath: '/models/face_landmarker.task',
        runningMode: 'VIDEO',
        numFaces: 2
      });
      console.log('[CameraProctor] MediaPipe FaceLandmarker loaded successfully.');
    } catch (modelErr) {
      console.warn('[CameraProctor] MediaPipe model failed to load. Falling back to WITHOUT CAMERA mode for this attempt:', modelErr);
      this.stop();
      this.onFallbackToWithoutCamera({
        reason: 'model_load_failure',
        message: 'Camera proctoring model could not be loaded. Exam is continuing in Without Camera mode without penalty.',
        error: modelErr
      });
      return;
    }

    this.isRunning = true;
    this.isCameraLost = false;
    this.stateMachine.reset(Date.now(), this.stateMachine.getViolationCount());

    // 4. Start analysis loop
    this.intervalId = setInterval(() => {
      this._analyzeCurrentFrame().catch(err => {
        console.warn('[CameraProctor] Frame analysis error:', err);
      });
    }, PROCTORING_CONFIG.FRAME_INTERVAL_MS);
  }

  /**
   * Captures and evaluates a single frame from the video element.
   */
  async _analyzeCurrentFrame() {
    if (!this.isRunning) return;

    const timestamp = Date.now();

    // Check if camera stream has been lost / disconnected mid-exam
    const videoTrack = this.stream?.getVideoTracks()?.[0];
    const trackEnded = !videoTrack || videoTrack.readyState === 'ended' || videoTrack.muted;
    if (this.isCameraLost || trackEnded) {
      const frameResult = this.stateMachine.processFrame({
        timestamp,
        cameraLost: true
      });
      this.onStateChange(frameResult);
      if (frameResult.status === 'violation' && frameResult.violationType) {
        this.onViolation({
          violationType: VIOLATION_TYPES.CAMERA_LOST,
          violationCount: frameResult.violationCount,
          autoSubmit: frameResult.autoSubmit,
          snapshotBase64: null,
          timestamp
        });
      }
      return;
    }

    if (!this.videoElement || this.videoElement.readyState < 2) {
      return;
    }

    const { videoWidth, videoHeight } = this.videoElement;
    if (!videoWidth || !videoHeight) return;

    // Draw frame to canvas
    this.offscreenCtx.drawImage(
      this.videoElement,
      0, 0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );

    // Compute pixel luminosity and variance for covered lens detection
    const imgData = this.offscreenCtx.getImageData(
      0, 0,
      this.offscreenCanvas.width,
      this.offscreenCanvas.height
    );
    const { brightness, variance } = this._computeImageMetrics(imgData);

    // Face detection & head pose estimation
    const detectionResult = await this._detectFaces(imgData, timestamp);

    const frameResult = this.stateMachine.processFrame({
      timestamp,
      faceCount: detectionResult.faceCount,
      headPose: detectionResult.headPose,
      brightness,
      variance
    });

    // Notify UI of status changes
    this.onStateChange(frameResult);

    // If a violation was triggered, capture snapshot and notify
    if (frameResult.status === 'violation' && frameResult.violationType) {
      const snapshotBase64 = this._captureSnapshotJpeg();
      this.onViolation({
        violationType: frameResult.violationType,
        violationCount: frameResult.violationCount,
        autoSubmit: frameResult.autoSubmit,
        snapshotBase64,
        timestamp
      });
    }
  }

  /**
   * Detects faces and estimates head pose using MediaPipe FaceLandmarker.
   */
  async _detectFaces(imgData, timestamp) {
    if (this.landmarker && this.videoElement) {
      try {
        const mpResult = this.landmarker.detectForVideo(this.videoElement, timestamp);
        if (mpResult && mpResult.faceLandmarks) {
          const faceCount = mpResult.faceLandmarks.length;
          if (faceCount > 0) {
            const headPose = extractHeadPose(mpResult, 0);
            return { faceCount, headPose };
          }
          return { faceCount: 0, headPose: { yaw: 0, pitch: 0 } };
        }
      } catch (err) {
        console.warn('[CameraProctor] MediaPipe detection frame error:', err);
      }
    }

    return { faceCount: 0, headPose: { yaw: 0, pitch: 0 } };
  }

  _computeImageMetrics(imgData) {
    const data = imgData.data;
    let sumLuma = 0;
    let sumSqDiff = 0;
    const sampleStep = 8;
    let samples = 0;

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sumLuma += luma;
      samples++;
    }

    const brightness = sumLuma / samples;

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      sumSqDiff += (luma - brightness) * (luma - brightness);
    }

    const variance = Math.sqrt(sumSqDiff / samples);
    return { brightness, variance };
  }

  /**
   * Generates a compressed JPEG snapshot <= 20 KB.
   */
  _captureSnapshotJpeg() {
    if (!this.offscreenCanvas) return null;

    let quality = PROCTORING_CONFIG.SNAPSHOT_QUALITY;
    let dataUrl = this.offscreenCanvas.toDataURL('image/jpeg', quality);
    let byteSize = Math.round((dataUrl.length - 22) * 0.75);

    if (byteSize > PROCTORING_CONFIG.SNAPSHOT_MAX_SIZE_KB * 1024) {
      quality = 0.25;
      dataUrl = this.offscreenCanvas.toDataURL('image/jpeg', quality);
    }

    return dataUrl;
  }

  setViolationCount(count) {
    this.stateMachine.setViolationCount(count);
  }

  getViolationCount() {
    return this.stateMachine.getViolationCount();
  }

  stop() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      const tracks = this.stream.getTracks();
      tracks.forEach(track => {
        track.removeEventListener('ended', this._handleTrackEnded);
        track.removeEventListener('mute', this._handleTrackMute);
        track.stop();
      });
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
  }
}
