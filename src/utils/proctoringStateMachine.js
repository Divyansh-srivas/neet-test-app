/**
 * Pure, deterministic Proctoring State Machine.
 * Manages grace periods, sustained timers, cooldown periods, hysteresis,
 * continuous-incident single-violation rule, and auto-submit thresholds without browser DOM dependencies.
 */

import { PROCTORING_CONFIG } from '../config/proctoring.js';

export const VIOLATION_TYPES = {
  NO_FACE: 'No Face Detected (Leaving Frame)',
  MULTIPLE_FACES: 'Multiple Faces Detected',
  LOOKING_AWAY: 'Looking Away From Screen',
  COVERED_LENS: 'Camera Blocked / Covered Lens',
  CAMERA_BLOCKED: 'Camera Blocked / Covered Lens',
  CAMERA_LOST: 'Camera Stream Disconnected / Muted'
};

export class ProctoringStateMachine {
  constructor(customConfig = {}) {
    this.config = { ...PROCTORING_CONFIG, ...customConfig };
    this.reset();
  }

  reset(startTime = null, initialViolationCount = 0) {
    this.startTime = startTime !== null ? startTime : null;
    this.violationCount = Math.max(0, Number(initialViolationCount) || 0);
    this.lastViolationTime = -Infinity;

    // Active condition trackers: { type, startTimestamp }
    this.activeCondition = null;
    this.hasTriggeredForCurrentIncident = false;
    this.isLookingAwayWithHysteresis = false;
  }

  setViolationCount(count) {
    this.violationCount = Math.max(0, Number(count) || 0);
  }

  getViolationCount() {
    return this.violationCount;
  }

  /**
   * Evaluates a single frame input against proctoring rules.
   *
   * Rule: One continuous event = ONE violation.
   * It can only count again after the condition has completely cleared (returned to normal)
   * AND the cooldown period has elapsed.
   *
   * @param {Object} frame
   * @param {number} frame.timestamp - Monotonic or epoch timestamp in milliseconds
   * @param {number} [frame.faceCount] - Number of faces detected (0, 1, 2+)
   * @param {Object} [frame.headPose] - { yaw, pitch, roll } in degrees
   * @param {number} [frame.brightness] - Average pixel brightness (0-255)
   * @param {number} [frame.variance] - Pixel variance (0-255)
   * @param {boolean} [frame.cameraLost] - True if stream/track ended, muted, or disconnected
   * @returns {Object} State result
   */
  processFrame({
    timestamp,
    faceCount = 1,
    headPose = { yaw: 0, pitch: 0, roll: 0 },
    brightness = 128,
    variance = 40,
    cameraLost = false
  }) {
    if (this.startTime === null) {
      this.startTime = timestamp;
    }

    // 1. Initial Grace Period check
    const elapsed = timestamp - this.startTime;
    if (elapsed < this.config.GRACE_PERIOD_MS) {
      this.activeCondition = null;
      this.hasTriggeredForCurrentIncident = false;
      this.isLookingAwayWithHysteresis = false;
      return {
        status: 'grace_period',
        inGracePeriod: true,
        violationType: null,
        activeWarning: null,
        violationCount: this.violationCount,
        autoSubmit: false
      };
    }

    // 2. Evaluate current instantaneous condition
    let currentCondition = null;
    if (cameraLost) {
      currentCondition = VIOLATION_TYPES.CAMERA_LOST;
    } else {
      currentCondition = this._detectInstantaneousCondition({
        faceCount,
        headPose,
        brightness,
        variance
      });
    }

    // 3. Condition Cleared -> reset incident flag and return normal
    if (!currentCondition) {
      this.activeCondition = null;
      this.hasTriggeredForCurrentIncident = false; // Event cleared! Now eligible for future violations once cooldown passes
      this.isLookingAwayWithHysteresis = false;
      return {
        status: 'normal',
        violationType: null,
        activeWarning: null,
        violationCount: this.violationCount,
        autoSubmit: false
      };
    }

    // 4. One continuous event = ONE violation
    // If a violation has already fired for this continuous event and condition has not cleared,
    // do NOT fire again, regardless of how long it lasts.
    if (this.hasTriggeredForCurrentIncident) {
      return {
        status: 'incident_active',
        violationType: null,
        activeWarning: currentCondition,
        violationCount: this.violationCount,
        autoSubmit: false
      };
    }

    // 5. Cooldown period check (only checked if a new incident has started after clear)
    const sinceLastViolation = timestamp - this.lastViolationTime;
    if (sinceLastViolation < this.config.COOLDOWN_MS) {
      this.activeCondition = null;
      return {
        status: 'cooldown',
        inCooldown: true,
        violationType: null,
        activeWarning: currentCondition,
        violationCount: this.violationCount,
        autoSubmit: false
      };
    }

    // 6. Track sustained duration of this condition
    if (!this.activeCondition || this.activeCondition.type !== currentCondition) {
      // Condition just started
      this.activeCondition = {
        type: currentCondition,
        startTimestamp: timestamp
      };
      return {
        status: 'warning',
        violationType: null,
        activeWarning: currentCondition,
        violationCount: this.violationCount,
        autoSubmit: false
      };
    }

    // Condition has been sustained
    const sustainedDuration = timestamp - this.activeCondition.startTimestamp;
    const requiredDuration = this._getRequiredSustainedDuration(currentCondition);

    if (sustainedDuration >= requiredDuration) {
      // Sustained threshold reached -> TRIGGER VIOLATION!
      const violationType = currentCondition;
      this.violationCount += 1;
      this.lastViolationTime = timestamp;
      this.hasTriggeredForCurrentIncident = true; // Lock: continuous event rule
      this.activeCondition = null;
      this.isLookingAwayWithHysteresis = false;

      const autoSubmit = this.violationCount >= this.config.MAX_VIOLATIONS;

      return {
        status: 'violation',
        violationType,
        activeWarning: null,
        violationCount: this.violationCount,
        autoSubmit
      };
    }

    // Condition is active but not yet sustained long enough (e.g. short glance / blink)
    return {
      status: 'warning',
      violationType: null,
      activeWarning: currentCondition,
      violationCount: this.violationCount,
      autoSubmit: false,
      sustainedDuration,
      requiredDuration
    };
  }

  _detectInstantaneousCondition({ faceCount, headPose, brightness, variance }) {
    // 1. Covered lens / camera blocked
    if (
      brightness < this.config.MIN_FRAME_BRIGHTNESS ||
      brightness > this.config.MAX_FRAME_BRIGHTNESS ||
      variance < this.config.MIN_FRAME_VARIANCE
    ) {
      return VIOLATION_TYPES.COVERED_LENS;
    }

    // 2. No face detected (leaving frame)
    if (faceCount === 0) {
      return VIOLATION_TYPES.NO_FACE;
    }

    // 3. Multiple faces detected
    if (faceCount > 1) {
      return VIOLATION_TYPES.MULTIPLE_FACES;
    }

    // 4. Looking away with hysteresis
    const isLookingAway = this._checkLookingAway(headPose);
    if (isLookingAway) {
      return VIOLATION_TYPES.LOOKING_AWAY;
    }

    return null; // Normal single face looking ahead
  }

  _checkLookingAway(headPose) {
    const yaw = Math.abs(headPose.yaw || 0);
    const pitch = headPose.pitch || 0;

    const yawLimit = this.config.YAW_THRESHOLD_DEG;
    const pitchUpLimit = this.config.PITCH_UP_THRESHOLD_DEG;
    const pitchDownLimit = this.config.PITCH_DOWN_THRESHOLD_DEG;
    const margin = this.config.HYSTERESIS_MARGIN;

    if (this.isLookingAwayWithHysteresis) {
      // Must return clearly below threshold minus hysteresis margin to exit looking away state
      const yawExit = yawLimit * (1 - margin);
      const pitchUpExit = pitchUpLimit * (1 - margin);
      const pitchDownExit = pitchDownLimit * (1 - margin);

      const stillLookingAway =
        yaw >= yawExit || pitch >= pitchUpExit || pitch <= -pitchDownExit;

      this.isLookingAwayWithHysteresis = stillLookingAway;
      return stillLookingAway;
    } else {
      // Enter looking away state when crossing threshold
      const enteredLookingAway =
        yaw >= yawLimit || pitch >= pitchUpLimit || pitch <= -pitchDownLimit;

      this.isLookingAwayWithHysteresis = enteredLookingAway;
      return enteredLookingAway;
    }
  }

  _getRequiredSustainedDuration(conditionType) {
    switch (conditionType) {
      case VIOLATION_TYPES.NO_FACE:
        return this.config.SUSTAINED_NO_FACE_MS;
      case VIOLATION_TYPES.MULTIPLE_FACES:
        return this.config.SUSTAINED_MULTIPLE_FACES_MS;
      case VIOLATION_TYPES.LOOKING_AWAY:
        return this.config.SUSTAINED_LOOKING_AWAY_MS;
      case VIOLATION_TYPES.COVERED_LENS:
      case VIOLATION_TYPES.CAMERA_BLOCKED:
        return this.config.SUSTAINED_COVERED_LENS_MS;
      case VIOLATION_TYPES.CAMERA_LOST:
        return 3000;
      default:
        return 4000;
    }
  }
}

export function createProctoringStateMachine(config) {
  return new ProctoringStateMachine(config);
}
