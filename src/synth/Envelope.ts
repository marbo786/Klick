import { GAIN_EPSILON } from './types.ts';

/**
 * Schedules a fast attack ramp followed by an exponential decay.
 * 
 * @param param - The AudioParam (e.g., GainNode.gain) to schedule.
 * @param startTime - The time to start the attack.
 * @param attackTime - The duration of the attack phase.
 * @param peakLevel - The peak level reached at the end of the attack.
 * @param decayTime - The duration of the decay phase.
 * @param sustainLevel - The level to sustain at after decay (default: GAIN_EPSILON).
 * @returns The calculated end time (startTime + attackTime + decayTime).
 */
export function applyAttackDecay(
  param: AudioParam,
  startTime: number,
  attackTime: number,
  peakLevel: number,
  decayTime: number,
  sustainLevel: number = GAIN_EPSILON
): number {
  const peakTime = startTime + attackTime;
  const endTime = peakTime + decayTime;
  
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(GAIN_EPSILON, startTime);
  
  // Fast attack ramp to peak
  param.linearRampToValueAtTime(Math.max(peakLevel, GAIN_EPSILON), peakTime);
  
  // Exponential decay
  const finalLevel = Math.max(sustainLevel, GAIN_EPSILON);
  param.exponentialRampToValueAtTime(finalLevel, endTime);
  
  // Snap to 0 if we reached the epsilon floor
  if (finalLevel <= GAIN_EPSILON) {
    param.setValueAtTime(0, endTime);
  }
  
  return endTime;
}

/**
 * Sets peak immediately and decays exponentially.
 * 
 * @param param - The AudioParam to schedule.
 * @param startTime - The time to start the decay.
 * @param peakLevel - The peak level to start at.
 * @param decayTime - The duration of the decay phase.
 * @returns The calculated end time (startTime + decayTime).
 */
export function applyDecayOnly(
  param: AudioParam,
  startTime: number,
  peakLevel: number,
  decayTime: number
): number {
  const endTime = startTime + decayTime;
  
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(Math.max(peakLevel, GAIN_EPSILON), startTime);
  param.exponentialRampToValueAtTime(GAIN_EPSILON, endTime);
  param.setValueAtTime(0, endTime);
  
  return endTime;
}

/**
 * Ramps current value to silence exponentially.
 * 
 * @param param - The AudioParam to schedule.
 * @param startTime - The time to start the release.
 * @param releaseTime - The duration of the release phase.
 * @returns The calculated end time (startTime + releaseTime).
 */
export function applyRelease(
  param: AudioParam,
  startTime: number,
  releaseTime: number
): number {
  const endTime = startTime + releaseTime;
  
  param.cancelScheduledValues(startTime);
  
  // Exponential ramp from current value down to epsilon, then snap to 0
  param.exponentialRampToValueAtTime(GAIN_EPSILON, endTime);
  param.setValueAtTime(0, endTime);
  
  return endTime;
}
