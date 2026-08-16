/**
 * Klick — Audio Engine
 * 
 * The main controller that implements the KeyboardSynth interface.
 * Coordinates the AudioContext, MasterBus, NoiseBuffer, VoiceManager,
 * and presets into a clean public API.
 * 
 * The UI should only interact with the synth through this class.
 */

import type { KeyboardSynth, SwitchPreset, EngineState, EngineDiagnostics } from './types.ts';
import NoiseBuffer from './NoiseBuffer.ts';
import MasterBus from './MasterBus.ts';
import { VoiceManager } from './VoiceManager.ts';
import { getKeyProfile } from './KeyProfiles.ts';

export class AudioEngine implements KeyboardSynth {
  private ctx: AudioContext | null = null;
  private masterBus: MasterBus | null = null;
  private noiseBuffer: NoiseBuffer | null = null;
  private voiceManager: VoiceManager | null = null;
  private currentPreset: SwitchPreset | null = null;
  private volume: number = 0.75;
  private state: EngineState = 'uninitialized';

  /** Track initialization to prevent multiple concurrent init attempts */
  private initializing = false;

  /**
   * Initialize or resume the AudioContext.
   * Must be called from a user gesture handler in browsers.
   */
  async initialize(): Promise<void> {
    // Already running
    if (this.state === 'running' && this.ctx?.state === 'running') {
      return;
    }

    // Prevent re-entrant initialization
    if (this.initializing) return;
    this.initializing = true;

    try {
      if (!this.ctx) {
        // Create the audio context (only once)
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();

        // Build the audio graph
        this.masterBus = new MasterBus(this.ctx);
        this.masterBus.setVolume(this.volume);

        this.noiseBuffer = new NoiseBuffer(this.ctx);

        this.voiceManager = new VoiceManager(
          this.ctx,
          this.noiseBuffer,
          this.masterBus.getInputNode()
        );
      }

      // Resume if suspended (browser autoplay restriction)
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      this.state = this.ctx.state === 'running' ? 'running' : 'suspended';

      // Listen for state changes (e.g., page visibility)
      this.ctx.onstatechange = () => {
        if (!this.ctx) return;
        if (this.ctx.state === 'running') {
          this.state = 'running';
        } else if (this.ctx.state === 'suspended') {
          this.state = 'suspended';
        } else if (this.ctx.state === 'closed') {
          this.state = 'closed';
        }
      };
    } catch (err) {
      console.error('[Klick] AudioContext initialization failed:', err);
      this.state = 'uninitialized';
      throw err;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Set the active switch preset.
   * Only affects future keystrokes — currently playing voices finish naturally.
   */
  setPreset(preset: SwitchPreset): void {
    this.currentPreset = preset;
  }

  /**
   * Set master volume (0.0–1.0).
   * Perceptual curve applied by MasterBus internally.
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.masterBus?.setVolume(this.volume);
  }

  /** Get current master volume (0.0–1.0, linear) */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Trigger press sound for a key.
   * @param key - KeyboardEvent.code (e.g., 'KeyA', 'Space')
   * @param timestamp - Optional AudioContext-relative timestamp
   * @param volumeScale - Volume multiplier (e.g., 0.707 for −3 dB on repeat)
   */
  keyDown(key: string, timestamp?: number, volumeScale?: number): void {
    if (this.state !== 'running' || !this.voiceManager || !this.currentPreset) return;

    const keyProfile = getKeyProfile(key);
    this.voiceManager.triggerPress(
      key,
      this.currentPreset,
      keyProfile,
      timestamp,
      volumeScale
    );
  }

  /**
   * Trigger release sound for a key.
   * @param key - KeyboardEvent.code
   * @param timestamp - Optional AudioContext-relative timestamp
   */
  keyUp(key: string, timestamp?: number): void {
    if (this.state !== 'running' || !this.voiceManager || !this.currentPreset) return;

    const keyProfile = getKeyProfile(key);
    this.voiceManager.triggerRelease(
      key,
      this.currentPreset,
      keyProfile,
      timestamp
    );
  }

  /** Kill all active voices immediately */
  stopAll(): void {
    this.voiceManager?.stopAll();
  }

  /** Get the AnalyserNode for waveform visualization */
  getAnalyserNode(): AnalyserNode | null {
    return this.masterBus?.getAnalyserNode() ?? null;
  }

  /** Get current engine state */
  getState(): EngineState {
    return this.state;
  }

  /** Get current diagnostics snapshot */
  getDiagnostics(): EngineDiagnostics {
    return {
      state: this.state,
      sampleRate: this.ctx?.sampleRate ?? 0,
      activeVoiceCount: this.voiceManager?.getActiveCount() ?? 0,
      maxVoices: 48,
      currentPresetId: this.currentPreset?.id ?? 'none',
      masterVolume: this.volume,
      estimatedLatencyMs: this.estimateLatency(),
    };
  }

  /** Tear down the audio context and all resources */
  dispose(): void {
    this.voiceManager?.dispose();
    this.masterBus?.dispose();

    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => { /* ignore close errors */ });
    }

    this.ctx = null;
    this.masterBus = null;
    this.noiseBuffer = null;
    this.voiceManager = null;
    this.state = 'closed';
  }

  // ─── Private ───────────────────────────────────────────────────────────

  /**
   * Estimate software-side latency in milliseconds.
   * This is the AudioContext's own reported latency, NOT speaker output latency.
   */
  private estimateLatency(): number {
    if (!this.ctx) return 0;

    // baseLatency is the processing delay of the AudioContext
    // outputLatency is the delay from the context to the audio hardware
    const base = (this.ctx as AudioContext & { baseLatency?: number }).baseLatency ?? 0;
    const output = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;

    return Math.round((base + output) * 1000 * 100) / 100;
  }
}
