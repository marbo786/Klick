/**
 * Klick — Voice
 * 
 * A Voice represents the audio graph for a single keystroke event (press or release).
 * Each voice is ephemeral: it builds its nodes, schedules their envelopes,
 * and cleans itself up automatically when playback finishes.
 * 
 * Voice architecture per press:
 *   Click:  NoiseSource → BandPass → ClickGain ─┐
 *   Thock:  Oscillator → ThockGain ──────────────┤→ VoiceGain → destination
 *   Noise:  NoiseSource → LowPass → NoiseGain ──┘
 * 
 * Release voices use a simpler single-layer structure.
 */

import type { SwitchPreset, KeyProfile, VoiceState, VoiceEndCallback } from './types.ts';
import { GAIN_EPSILON } from './types.ts';
import type NoiseBuffer from './NoiseBuffer.ts';

/** Internal counter for unique voice IDs */
let voiceIdCounter = 0;

/** Generate a unique voice ID */
function nextVoiceId(): string {
  return `voice-${++voiceIdCounter}`;
}

/**
 * Apply deterministic-ish variation to a base value.
 * Uses a simple hash of key + a variation seed to produce consistent-per-key
 * but different-across-keys variation.
 */
function applyVariation(base: number, range: number, key: string, seed: number): number {
  // Simple hash: sum of char codes * seed, mapped to [-1, 1]
  let hash = seed;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  // Map to [-1, 1] using sin for smooth distribution
  const normalized = Math.sin(hash * 0.0001 + seed * 0.001);
  return base * (1 + normalized * range);
}

/**
 * Represents a single keystroke's audio output.
 * Handles its own lifecycle from creation through automatic disposal.
 */
export class Voice {
  readonly id: string;
  readonly key: string;
  readonly type: 'press' | 'release';

  private state: VoiceState = 'scheduled';
  private readonly ctx: AudioContext;
  private readonly preset: SwitchPreset;
  private readonly keyProfile: KeyProfile;
  private readonly noiseBuffer: NoiseBuffer;
  private readonly destination: AudioNode;
  private readonly onEnded: VoiceEndCallback;

  /** All nodes owned by this voice, for cleanup */
  private nodes: AudioNode[] = [];
  /** All source nodes that need explicit stop() */
  private sources: AudioBufferSourceNode[] = [];
  /** All oscillators that need explicit stop() */
  private oscillators: OscillatorNode[] = [];
  /** Calculated end time for the entire voice */
  private endTime: number = 0;
  /** Cleanup timeout as safety net */
  private cleanupTimer: number = 0;
  private disposed = false;

  constructor(
    ctx: AudioContext,
    preset: SwitchPreset,
    keyProfile: KeyProfile,
    noiseBuffer: NoiseBuffer,
    destination: AudioNode,
    key: string,
    type: 'press' | 'release',
    onEnded: VoiceEndCallback
  ) {
    this.id = nextVoiceId();
    this.ctx = ctx;
    this.preset = preset;
    this.keyProfile = keyProfile;
    this.noiseBuffer = noiseBuffer;
    this.destination = destination;
    this.key = key;
    this.type = type;
    this.onEnded = onEnded;
  }

  /** Get the current voice state */
  getState(): VoiceState {
    return this.state;
  }

  /** Get the scheduled end time */
  getEndTime(): number {
    return this.endTime;
  }

  /**
   * Build and start the voice's audio graph.
   * @param time - AudioContext.currentTime-based start time
   * @param volumeScale - Additional volume scaling (e.g., for key repeat at −3 dB)
   */
  start(time: number, volumeScale: number = 1.0): void {
    if (this.disposed) return;

    this.state = 'playing';

    // Use a per-keystroke seed for variation
    const seed = time * 1000 + this.key.length;

    if (this.type === 'press') {
      this.buildPressVoice(time, seed, volumeScale);
    } else {
      this.buildReleaseVoice(time, seed, volumeScale);
    }

    // Schedule automatic cleanup with a safety margin
    const safetyDuration = (this.endTime - time + 0.1) * 1000;
    this.cleanupTimer = window.setTimeout(() => {
      this.dispose();
    }, Math.max(safetyDuration, 50));
  }

  /**
   * Force-stop the voice early (e.g., for voice stealing).
   * Applies a fast fade-out to avoid clicks.
   */
  stop(time?: number): void {
    if (this.disposed || this.state === 'disposed') return;

    const now = time ?? this.ctx.currentTime;
    this.state = 'releasing';

    // Fast fade to avoid click
    for (const node of this.nodes) {
      if (node instanceof GainNode) {
        try {
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(node.gain.value || GAIN_EPSILON, now);
          node.gain.exponentialRampToValueAtTime(GAIN_EPSILON, now + 0.005);
          node.gain.setValueAtTime(0, now + 0.005);
        } catch {
          // Node may already be disconnected
        }
      }
    }

    // Stop sources shortly after fade
    const stopTime = now + 0.01;
    for (const source of this.sources) {
      try { source.stop(stopTime); } catch { /* already stopped */ }
    }
    for (const osc of this.oscillators) {
      try { osc.stop(stopTime); } catch { /* already stopped */ }
    }
  }

  /** Clean up all audio nodes and references */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.state = 'disposed';

    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = 0;
    }

    // Stop any still-playing sources
    for (const source of this.sources) {
      try { source.stop(); } catch { /* already stopped */ }
    }
    for (const osc of this.oscillators) {
      try { osc.stop(); } catch { /* already stopped */ }
    }

    // Disconnect all nodes
    for (const node of this.nodes) {
      try { node.disconnect(); } catch { /* already disconnected */ }
    }

    // Release references
    this.nodes = [];
    this.sources = [];
    this.oscillators = [];

    // Notify the voice manager
    this.onEnded(this.id);
  }

  // ─── Private: Press Voice Construction ─────────────────────────────────

  private buildPressVoice(time: number, seed: number, volumeScale: number): void {
    const { preset } = this;

    // Variation-adjusted values
    const pitchVar = applyVariation(1, preset.variation.pitch, this.key, seed);
    const volVar = applyVariation(1, preset.variation.volume, this.key, seed + 1);
    const decayVar = applyVariation(1, preset.variation.decay, this.key, seed + 2);

    let maxEndTime = time;

    // ── Click Transient ──────────────────────────────────────────────────
    if (preset.click.enabled) {
      const clickEnd = this.buildClickLayer(time, pitchVar, volVar * volumeScale, decayVar);
      maxEndTime = Math.max(maxEndTime, clickEnd);
    }

    // ── Thock / Bottom-out ───────────────────────────────────────────────
    const thockEnd = this.buildThockLayer(time, pitchVar, volVar * volumeScale, decayVar);
    maxEndTime = Math.max(maxEndTime, thockEnd);

    this.endTime = maxEndTime;
  }

  private buildClickLayer(time: number, pitchVar: number, volScale: number, decayVar: number): number {
    const { click } = this.preset;
    const { keyProfile, ctx, noiseBuffer, destination } = this;

    const frequency = click.frequency * pitchVar * keyProfile.pitchMultiplier;
    const decay = click.decay * decayVar * keyProfile.decayMultiplier;
    const volume = click.volume * volScale * keyProfile.volumeMultiplier;

    // Noise source → bandpass → gain → destination
    const source = noiseBuffer.createSource();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.setValueAtTime(click.q, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(GAIN_EPSILON, time);
    // Fast attack (~0.5ms)
    gain.gain.linearRampToValueAtTime(volume, time + 0.0005);
    // Exponential decay
    gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, time + decay);
    gain.gain.setValueAtTime(0, time + decay);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    this.nodes.push(filter, gain);
    this.sources.push(source);

    // Start source slightly before the envelope, stop after decay
    const endTime = time + decay + 0.01;
    source.start(time, Math.random() * 1.5, decay + 0.02);
    source.stop(endTime);

    source.onended = () => {
      try { source.disconnect(); } catch { /* ok */ }
    };

    return endTime;
  }

  private buildThockLayer(time: number, pitchVar: number, volScale: number, decayVar: number): number {
    const { thock } = this.preset;
    const { keyProfile, ctx, noiseBuffer, destination } = this;

    const frequency = thock.frequency * pitchVar * keyProfile.pitchMultiplier;
    const decay = thock.decay * decayVar * keyProfile.decayMultiplier;
    const volume = thock.volume * volScale * keyProfile.volumeMultiplier;

    let maxEnd = time;

    // ── Oscillator (tonal body) ──────────────────────────────────────────
    const toneMix = 1.0 - thock.noiseMix;
    if (toneMix > 0.01) {
      const osc = ctx.createOscillator();
      osc.type = thock.waveform;
      osc.frequency.setValueAtTime(frequency, time);
      // Subtle pitch drop for natural bottom-out feel
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(frequency * 0.85, 20), 
        time + decay
      );

      const oscGain = ctx.createGain();
      const oscVolume = volume * toneMix;
      oscGain.gain.setValueAtTime(oscVolume, time);
      oscGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, time + decay);
      oscGain.gain.setValueAtTime(0, time + decay);

      osc.connect(oscGain);
      oscGain.connect(destination);

      this.oscillators.push(osc);
      this.nodes.push(oscGain);

      osc.start(time);
      osc.stop(time + decay + 0.01);

      osc.onended = () => {
        try { osc.disconnect(); } catch { /* ok */ }
      };

      maxEnd = Math.max(maxEnd, time + decay + 0.01);
    }

    // ── Noise layer (texture/character) ──────────────────────────────────
    if (thock.noiseMix > 0.01) {
      const noiseSource = noiseBuffer.createSource();
      
      const noiseLp = ctx.createBiquadFilter();
      noiseLp.type = 'lowpass';
      noiseLp.frequency.setValueAtTime(thock.lowpass * pitchVar, time);
      noiseLp.Q.setValueAtTime(0.7, time);

      const noiseGain = ctx.createGain();
      const noiseVolume = volume * thock.noiseMix;
      noiseGain.gain.setValueAtTime(noiseVolume, time);
      noiseGain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, time + decay * 0.8);
      noiseGain.gain.setValueAtTime(0, time + decay * 0.8);

      noiseSource.connect(noiseLp);
      noiseLp.connect(noiseGain);
      noiseGain.connect(destination);

      this.nodes.push(noiseLp, noiseGain);
      this.sources.push(noiseSource);

      const noiseDuration = decay + 0.02;
      noiseSource.start(time, Math.random() * 1.5, noiseDuration);
      noiseSource.stop(time + noiseDuration);

      noiseSource.onended = () => {
        try { noiseSource.disconnect(); } catch { /* ok */ }
      };

      maxEnd = Math.max(maxEnd, time + noiseDuration);
    }

    return maxEnd;
  }

  // ─── Private: Release Voice Construction ───────────────────────────────

  private buildReleaseVoice(time: number, seed: number, volumeScale: number): void {
    const { release } = this.preset;
    if (!release.enabled) {
      this.endTime = time;
      // Immediately dispose if release is disabled
      window.setTimeout(() => this.dispose(), 10);
      return;
    }

    const { keyProfile, ctx, noiseBuffer, destination } = this;

    const pitchVar = applyVariation(1, this.preset.variation.pitch, this.key, seed + 10);
    const volVar = applyVariation(1, this.preset.variation.volume, this.key, seed + 11);
    const decayVar = applyVariation(1, this.preset.variation.decay, this.key, seed + 12);

    const frequency = release.frequency * pitchVar * keyProfile.pitchMultiplier;
    const decay = release.decay * decayVar * keyProfile.decayMultiplier;
    const volume = release.volume * volVar * volumeScale * keyProfile.volumeMultiplier;

    // Release: noise → bandpass → gain → destination
    const source = noiseBuffer.createSource();

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, time);
    filter.Q.setValueAtTime(3, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(GAIN_EPSILON, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.0003);
    gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, time + decay);
    gain.gain.setValueAtTime(0, time + decay);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    this.nodes.push(filter, gain);
    this.sources.push(source);

    const endTime = time + decay + 0.01;
    source.start(time, Math.random() * 1.5, decay + 0.02);
    source.stop(endTime);

    source.onended = () => {
      try { source.disconnect(); } catch { /* ok */ }
    };

    this.endTime = endTime;
  }
}
