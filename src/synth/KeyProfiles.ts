import type { KeyProfile } from './types.ts';

/**
 * Default acoustic profiles for special keys.
 * These produce subtle pitch, volume, and decay differences
 * that give larger/special keys their distinctive character.
 */
const DEFAULT_KEY_PROFILES: ReadonlyArray<KeyProfile> = [
  { keyCode: 'Space', pitchMultiplier: 0.75, volumeMultiplier: 1.15, decayMultiplier: 1.4 },
  { keyCode: 'Enter', pitchMultiplier: 0.85, volumeMultiplier: 1.1, decayMultiplier: 1.2 },
  { keyCode: 'NumpadEnter', pitchMultiplier: 0.85, volumeMultiplier: 1.1, decayMultiplier: 1.2 },
  { keyCode: 'ShiftLeft', pitchMultiplier: 0.9, volumeMultiplier: 1.05, decayMultiplier: 1.15 },
  { keyCode: 'ShiftRight', pitchMultiplier: 0.9, volumeMultiplier: 1.05, decayMultiplier: 1.15 },
  { keyCode: 'Backspace', pitchMultiplier: 0.88, volumeMultiplier: 1.08, decayMultiplier: 1.1 },
  { keyCode: 'Tab', pitchMultiplier: 0.92, volumeMultiplier: 1.03, decayMultiplier: 1.05 },
  { keyCode: 'CapsLock', pitchMultiplier: 0.9, volumeMultiplier: 1.05, decayMultiplier: 1.1 },
  { keyCode: 'ControlLeft', pitchMultiplier: 0.95, volumeMultiplier: 1.0, decayMultiplier: 1.05 },
  { keyCode: 'ControlRight', pitchMultiplier: 0.95, volumeMultiplier: 1.0, decayMultiplier: 1.05 },
  { keyCode: 'AltLeft', pitchMultiplier: 0.95, volumeMultiplier: 1.0, decayMultiplier: 1.05 },
  { keyCode: 'AltRight', pitchMultiplier: 0.95, volumeMultiplier: 1.0, decayMultiplier: 1.05 },
];

/** Pre-built map for O(1) lookup */
const profileMap = new Map<string, KeyProfile>();
for (const profile of DEFAULT_KEY_PROFILES) {
  profileMap.set(profile.keyCode, profile);
}

/** Neutral profile returned when no key-specific profile exists */
const NEUTRAL_PROFILE: KeyProfile = {
  keyCode: '',
  pitchMultiplier: 1.0,
  volumeMultiplier: 1.0,
  decayMultiplier: 1.0,
};

/**
 * Get the acoustic profile for a given key code.
 * Returns a neutral profile (all multipliers 1.0) for unrecognized keys.
 * @param keyCode - KeyboardEvent.code value (e.g., 'Space', 'KeyA')
 */
export function getKeyProfile(keyCode: string): KeyProfile {
  return profileMap.get(keyCode) ?? NEUTRAL_PROFILE;
}
