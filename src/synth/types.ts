/**
 * Klick — Synth Engine Type Definitions
 * 
 * All shared types for the procedural keyboard sound synthesizer.
 * This file has zero runtime code — types and interfaces only.
 */

// ─── Preset Schema ──────────────────────────────────────────────────────────

/** Oscillator waveform types supported by Web Audio */
export type WaveformType = 'sine' | 'triangle' | 'sawtooth' | 'square';

/** Click / tactile transient component configuration */
export interface ClickConfig {
  /** Whether this component is active for the preset */
  enabled: boolean;
  /** Center frequency of the bandpass filter in Hz (typically 2000–5000) */
  frequency: number;
  /** Q factor of the bandpass filter (higher = more resonant, typically 2–15) */
  q: number;
  /** Volume relative to master (0.0–1.0) */
  volume: number;
  /** Decay time in seconds (typically 0.002–0.015) */
  decay: number;
}

/** Bottom-out / thock body component configuration */
export interface ThockConfig {
  /** Fundamental frequency in Hz (typically 80–350) */
  frequency: number;
  /** Oscillator waveform type */
  waveform: WaveformType;
  /** Volume relative to master (0.0–1.0) */
  volume: number;
  /** Decay time in seconds (typically 0.03–0.12) */
  decay: number;
  /** Mix ratio of noise layer (0.0 = pure tone, 1.0 = pure noise) */
  noiseMix: number;
  /** Low-pass filter cutoff frequency in Hz (typically 200–1500) */
  lowpass: number;
}

/** Release / key-up sound component configuration */
export interface ReleaseConfig {
  /** Whether release sound is active for the preset */
  enabled: boolean;
  /** Center frequency in Hz */
  frequency: number;
  /** Volume relative to master (0.0–1.0, typically lower than press) */
  volume: number;
  /** Decay time in seconds (typically shorter than press) */
  decay: number;
}

/** Micro-variation configuration for natural sound */
export interface VariationConfig {
  /** Pitch variation range as a fraction (e.g., 0.03 = ±3%) */
  pitch: number;
  /** Volume variation in linear scale (e.g., 0.05 = ±5%) */
  volume: number;
  /** Decay variation as a fraction (e.g., 0.08 = ±8%) */
  decay: number;
}

/** Complete switch preset definition — data-driven, no code paths */
export interface SwitchPreset {
  /** Unique identifier (e.g., 'cherry-mx-blue') */
  id: string;
  /** Display name (e.g., 'Cherry MX Blue') */
  name: string;
  /** Short descriptor (e.g., 'Clicky · Sharp · Loud') */
  description: string;
  /** Whether this is a factory preset (immutable) */
  isFactory: boolean;

  click: ClickConfig;
  thock: ThockConfig;
  release: ReleaseConfig;
  variation: VariationConfig;
}

// ─── Key Profiles ───────────────────────────────────────────────────────────

/** Per-key acoustic variation profile */
export interface KeyProfile {
  /** Key code pattern to match (e.g., 'Space', 'Enter', 'ShiftLeft') */
  keyCode: string;
  /** Pitch multiplier (1.0 = no change, 0.8 = 20% lower) */
  pitchMultiplier: number;
  /** Volume multiplier (1.0 = no change) */
  volumeMultiplier: number;
  /** Decay multiplier (1.0 = no change, 1.3 = 30% longer) */
  decayMultiplier: number;
}

// ─── Voice Types ────────────────────────────────────────────────────────────

/** Voice lifecycle states */
export type VoiceState = 'scheduled' | 'playing' | 'releasing' | 'disposed';

/** Callback when a voice finishes and is ready for cleanup */
export type VoiceEndCallback = (voiceId: string) => void;

/** Information about an active voice for diagnostics */
export interface ActiveVoiceInfo {
  id: string;
  key: string;
  state: VoiceState;
  startTime: number;
  type: 'press' | 'release';
}

// ─── Engine Interface ───────────────────────────────────────────────────────

/** Engine lifecycle states */
export type EngineState = 'uninitialized' | 'suspended' | 'running' | 'closed';

/** Diagnostics snapshot from the engine */
export interface EngineDiagnostics {
  state: EngineState;
  sampleRate: number;
  activeVoiceCount: number;
  maxVoices: number;
  currentPresetId: string;
  masterVolume: number;
  estimatedLatencyMs: number;
}

/** 
 * Public API for the keyboard synthesizer.
 * The UI should only interact with the synth through this interface.
 */
export interface KeyboardSynth {
  /** Initialize/resume the AudioContext. Requires user gesture in browsers. */
  initialize(): Promise<void>;
  /** Set the active preset. Only affects future keystrokes. */
  setPreset(preset: SwitchPreset): void;
  /** Set master volume (0.0–1.0). Perceptual mapping applied internally. */
  setVolume(volume: number): void;
  /** Get current master volume (0.0–1.0) */
  getVolume(): number;
  /** Trigger press sound for a key */
  keyDown(key: string, timestamp?: number): void;
  /** Trigger release sound for a key */
  keyUp(key: string, timestamp?: number): void;
  /** Kill all active voices immediately */
  stopAll(): void;
  /** Get the AnalyserNode for waveform visualization */
  getAnalyserNode(): AnalyserNode | null;
  /** Get current diagnostics */
  getDiagnostics(): EngineDiagnostics;
  /** Get current engine state */
  getState(): EngineState;
  /** Tear down the audio context and all resources */
  dispose(): void;
}

// ─── Storage Types ──────────────────────────────────────────────────────────

/** Persisted application settings */
export interface AppSettings {
  selectedPresetId: string;
  masterVolume: number;
  designerOpen: boolean;
  diagnosticsOpen: boolean;
  mutedApps: string[];
  runOnStartup: boolean;
}

/** Result of a preset import validation */
export interface PresetImportResult {
  success: boolean;
  preset?: SwitchPreset;
  errors: string[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of simultaneous active voices */
export const MAX_ACTIVE_VOICES = 48;

/** Maximum number of custom presets that can be stored */
export const MAX_CUSTOM_PRESETS = 50;

/** Epsilon floor for exponential ramps (≈ −80 dB, inaudible) */
export const GAIN_EPSILON = 1e-4;

/** Duration of the shared noise buffer in seconds */
export const NOISE_BUFFER_DURATION = 2.0;
