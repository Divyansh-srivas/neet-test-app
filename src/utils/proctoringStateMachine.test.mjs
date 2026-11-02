import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProctoringStateMachine, VIOLATION_TYPES } from './proctoringStateMachine.js';

describe('ProctoringStateMachine', () => {
  // Spec thresholds
  const config = {
    MAX_VIOLATIONS: 5,
    GRACE_PERIOD_MS: 10000,         // 10s grace
    SUSTAINED_NO_FACE_MS: 4000,     // 4s sustained no-face
    SUSTAINED_MULTIPLE_FACES_MS: 3000, // 3s sustained multiple faces
    SUSTAINED_LOOKING_AWAY_MS: 4000,   // 4s sustained looking away
    SUSTAINED_COVERED_LENS_MS: 4000,   // 4s sustained covered lens
    COOLDOWN_MS: 15000,             // 15s cooldown
    YAW_THRESHOLD_DEG: 35,          // 35 deg relative to calibration baseline
    PITCH_UP_THRESHOLD_DEG: 25,     // 25 deg
    PITCH_DOWN_THRESHOLD_DEG: 28,   // 28 deg
    HYSTERESIS_MARGIN: 0.1,
    MIN_FRAME_BRIGHTNESS: 15,
    MIN_FRAME_VARIANCE: 4.5
  };

  it('ignores suspicious conditions during initial grace period (10s)', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0); // starts at t=0

    // At t=2000ms (2s in), student has no face in frame
    let res = sm.processFrame({ timestamp: 2000, faceCount: 0 });
    assert.equal(res.status, 'grace_period');
    assert.equal(res.violationType, null);
    assert.equal(res.inGracePeriod, true);

    // At t=8000ms (8s in), still within 10s grace period
    res = sm.processFrame({ timestamp: 8000, faceCount: 0 });
    assert.equal(res.status, 'grace_period');
    assert.equal(res.violationCount, 0);

    // At t=10000ms (grace period elapsed), normal frame
    res = sm.processFrame({ timestamp: 10000, faceCount: 1 });
    assert.equal(res.status, 'normal');
    assert.equal(res.violationCount, 0);
  });

  it('face missing for 60s continuously -> exactly 1 violation', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0); // Start at t=0

    // t=0 to t=9999ms: Grace period (no face)
    for (let t = 0; t < 10000; t += 500) {
      const res = sm.processFrame({ timestamp: t, faceCount: 0 });
      assert.equal(res.violationCount, 0, `Violation occurred during grace period at t=${t}`);
    }

    // t=10000ms: Grace period ends, sustained timer begins
    const at10s = sm.processFrame({ timestamp: 10000, faceCount: 0 });
    assert.equal(at10s.status, 'warning');
    assert.equal(at10s.violationCount, 0);

    // t=10500 to 13500ms: Sustained no-face accumulating (< 4000ms required)
    for (let t = 10500; t < 14000; t += 500) {
      const res = sm.processFrame({ timestamp: t, faceCount: 0 });
      assert.equal(res.status, 'warning');
      assert.equal(res.violationCount, 0);
    }

    // t=14000ms: Exactly 4000ms sustained -> Violation #1 triggers!
    const at14s = sm.processFrame({ timestamp: 14000, faceCount: 0 });
    assert.equal(at14s.status, 'violation');
    assert.equal(at14s.violationType, VIOLATION_TYPES.NO_FACE);
    assert.equal(at14s.violationCount, 1);

    // Now continue with face missing up to t=70000ms (total missing > 60 continuous seconds!)
    // Past cooldown (14000 + 15000 = 29000ms), continuous event rule MUST prevent any further violations
    for (let t = 14500; t <= 74000; t += 500) {
      const res = sm.processFrame({ timestamp: t, faceCount: 0 });
      assert.equal(
        res.violationCount,
        1,
        `Violation count changed to ${res.violationCount} at t=${t} during continuous absence`
      );
      assert.notEqual(res.status, 'violation');
    }

    // Final assertion: exactly 1 violation
    assert.equal(sm.getViolationCount(), 1, 'Face missing for 60s continuously must result in exactly 1 violation');
  });

  it('can only count again after condition has cleared AND cooldown has passed', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);

    // Fast forward to t=10000
    sm.processFrame({ timestamp: 10000, faceCount: 1 });

    // Incident 1: No face from 11000 to 15000ms (4000ms sustained)
    sm.processFrame({ timestamp: 11000, faceCount: 0 });
    const r1 = sm.processFrame({ timestamp: 15000, faceCount: 0 });
    assert.equal(r1.status, 'violation');
    assert.equal(r1.violationCount, 1);

    // Student returns at t=20000ms (condition clears!)
    const rClear = sm.processFrame({ timestamp: 20000, faceCount: 1 });
    assert.equal(rClear.status, 'normal');
    assert.equal(sm.getViolationCount(), 1);

    // Student leaves again at t=25000ms
    // Cooldown is 15s after 15000ms = 30000ms. At 25000ms, cooldown is NOT passed yet!
    const rCooldown = sm.processFrame({ timestamp: 25000, faceCount: 0 });
    assert.equal(rCooldown.status, 'cooldown');
    assert.equal(rCooldown.inCooldown, true);
    assert.equal(sm.getViolationCount(), 1);

    // Condition clears again at t=28000ms
    sm.processFrame({ timestamp: 28000, faceCount: 1 });

    // At t=31000ms: Cooldown (15000ms) has now expired! Condition was clear.
    // Incident 2 begins at t=31000ms
    sm.processFrame({ timestamp: 31000, faceCount: 0 });
    sm.processFrame({ timestamp: 33000, faceCount: 0 });
    // 4000ms sustained at t=35000ms -> Violation #2 fires!
    const r2 = sm.processFrame({ timestamp: 35000, faceCount: 0 });
    assert.equal(r2.status, 'violation');
    assert.equal(r2.violationCount, 2);
  });

  it('yaw relative to calibration baseline: off-center (10-15 deg) NEVER fires, clearly turned (>40 deg) fires after sustained time', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);
    // Calibration baseline captured: candidate sits with slight natural offset (yaw: +2 deg, pitch: +1 deg)
    sm.setBaselinePose({ yaw: 2, pitch: 1 });

    // 1. Candidate sits slightly off-center for 30 continuous seconds (yaw = 14 deg -> relative yaw = 12 deg < 35 deg limit)
    for (let t = 10000; t <= 40000; t += 1000) {
      const r = sm.processFrame({ timestamp: t, faceCount: 1, headPose: { yaw: 14, pitch: 1 } });
      assert.equal(r.status, 'normal', `Slightly off-center pose (12 deg relative) must NOT trigger warning at t=${t}`);
      assert.equal(r.violationCount, 0);
    }
    assert.equal(sm.getViolationCount(), 0, 'Off-center sitting pose (10-15 deg) must NEVER fire a violation');

    // 2. Candidate clearly turns head to side (>40 deg relative: yaw = 47 deg -> relative yaw = 45 deg >= 35 deg)
    // Starts looking away at t=45000ms
    sm.processFrame({ timestamp: 45000, faceCount: 1, headPose: { yaw: 47, pitch: 1 } });
    sm.processFrame({ timestamp: 47000, faceCount: 1, headPose: { yaw: 47, pitch: 1 } }); // 2.0s
    sm.processFrame({ timestamp: 48500, faceCount: 1, headPose: { yaw: 47, pitch: 1 } }); // 3.5s

    // At t=49000ms (exactly 4000ms sustained >= 4000ms threshold)
    const rTurned = sm.processFrame({ timestamp: 49000, faceCount: 1, headPose: { yaw: 47, pitch: 1 } });
    assert.equal(rTurned.status, 'violation');
    assert.equal(rTurned.violationType, VIOLATION_TYPES.LOOKING_AWAY);
    assert.equal(rTurned.violationCount, 1);

    // Continuous event: stays turned head past 49000ms, does not fire a second violation
    for (let t = 49500; t <= 65000; t += 1000) {
      const rStillTurned = sm.processFrame({ timestamp: t, faceCount: 1, headPose: { yaw: 47, pitch: 1 } });
      assert.equal(rStillTurned.violationCount, 1, 'Continuous turned head event must remain exactly 1 violation');
    }
  });

  it('ignores momentary blinks or short glances (< 4s sustained threshold)', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);

    // After grace period at t=10000ms
    sm.processFrame({ timestamp: 10000, faceCount: 1, headPose: { yaw: 0, pitch: 0 } });

    // Glances away (yaw = 45 deg) at t=10500ms
    let r1 = sm.processFrame({ timestamp: 10500, faceCount: 1, headPose: { yaw: 45, pitch: 0 } });
    assert.equal(r1.status, 'warning');
    assert.equal(r1.activeWarning, VIOLATION_TYPES.LOOKING_AWAY);

    // At t=13000ms (glance lasted 2.5s < 4.0s limit)
    let r2 = sm.processFrame({ timestamp: 13000, faceCount: 1, headPose: { yaw: 45, pitch: 0 } });
    assert.equal(r2.status, 'warning');
    assert.equal(r2.violationType, null);

    // Returns eyes to screen at t=13500ms (normal)
    let r3 = sm.processFrame({ timestamp: 13500, faceCount: 1, headPose: { yaw: 5, pitch: 0 } });
    assert.equal(r3.status, 'normal');
    assert.equal(r3.violationCount, 0);

    // Still 0 violations
    assert.equal(sm.getViolationCount(), 0);
  });

  it('triggers MULTIPLE_FACES violation when two faces are present for >= 3000ms', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);

    sm.processFrame({ timestamp: 10000, faceCount: 1 });

    // Second person appears at t=11000ms
    sm.processFrame({ timestamp: 11000, faceCount: 2 });
    sm.processFrame({ timestamp: 12500, faceCount: 2 });
    // 3.0s later at t=14000ms
    const r = sm.processFrame({ timestamp: 14000, faceCount: 2 });

    assert.equal(r.status, 'violation');
    assert.equal(r.violationType, VIOLATION_TYPES.MULTIPLE_FACES);
    assert.equal(r.violationCount, 1);
  });

  it('triggers COVERED_LENS violation when camera is blocked or dark for >= 4000ms', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);

    sm.processFrame({ timestamp: 10000, faceCount: 1, brightness: 120, variance: 30 });

    // Lens covered (brightness = 5, variance = 1) at t=11000ms
    sm.processFrame({ timestamp: 11000, faceCount: 0, brightness: 5, variance: 1 });
    sm.processFrame({ timestamp: 13000, faceCount: 0, brightness: 5, variance: 1 });
    // 4.0s later at t=15000ms
    const r = sm.processFrame({ timestamp: 15000, faceCount: 0, brightness: 5, variance: 1 });

    assert.equal(r.status, 'violation');
    assert.equal(r.violationType, VIOLATION_TYPES.COVERED_LENS);
    assert.equal(r.violationCount, 1);
  });

  it('hysteresis prevents flapping near angle boundaries (35 deg limit)', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);

    sm.processFrame({ timestamp: 10000, faceCount: 1 });

    // 1. Cross threshold: yaw = 36 deg (> 35 deg limit)
    sm.processFrame({ timestamp: 10500, faceCount: 1, headPose: { yaw: 36 } });
    assert.equal(sm.isLookingAwayWithHysteresis, true);

    // 2. Drop slightly to 33 deg (still within hysteresis margin 35 * (1 - 0.1) = 31.5 deg)
    sm.processFrame({ timestamp: 10800, faceCount: 1, headPose: { yaw: 33 } });
    assert.equal(sm.isLookingAwayWithHysteresis, true);

    // 3. Drop clearly below exit threshold to 30 deg -> exits looking away!
    sm.processFrame({ timestamp: 11000, faceCount: 1, headPose: { yaw: 30 } });
    assert.equal(sm.isLookingAwayWithHysteresis, false);
  });

  it('restores violation count on page refresh and auto-submits on 5th violation', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0, 4);
    assert.equal(sm.getViolationCount(), 4);

    // Fast-forward past grace period
    sm.processFrame({ timestamp: 10000, faceCount: 1 });

    // 5th violation triggered
    sm.processFrame({ timestamp: 11000, faceCount: 0 });
    const r = sm.processFrame({ timestamp: 15000, faceCount: 0 });

    assert.equal(r.status, 'violation');
    assert.equal(r.violationCount, 5);
    assert.equal(r.autoSubmit, true, '5th violation must trigger autoSubmit');
  });

  it('consistently stays normal during normal attentive sitting', () => {
    const sm = new ProctoringStateMachine(config);
    sm.reset(0);

    for (let t = 10000; t <= 30000; t += 1000) {
      const r = sm.processFrame({
        timestamp: t,
        faceCount: 1,
        headPose: { yaw: 2, pitch: -3 },
        brightness: 115,
        variance: 35
      });
      assert.equal(r.status, 'normal');
      assert.equal(r.violationCount, 0);
    }
    assert.equal(sm.getViolationCount(), 0);
  });
});
