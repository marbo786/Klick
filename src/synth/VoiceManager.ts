/**
 * Klick — Voice Manager
 * 
 * Manages polyphony, voice lifecycle, and cleanup.
 * Enforces the maximum active voice limit and handles voice stealing
 * when the limit is reached during fast typing.
 */

import type { SwitchPreset, KeyProfile, ActiveVoiceInfo, VoiceState } from './types.ts';
import { MAX_ACTIVE_VOICES } from './types.ts';
import { Voice } from './Voice.ts';
import type NoiseBuffer from './NoiseBuffer.ts';

export class VoiceManager {
  private readonly ctx: AudioContext;
  private readonly noiseBuffer: NoiseBuffer;
  private readonly destination: AudioNode;

  /** All active voices indexed by their unique ID */
  private activeVoices = new Map<string, Voice>();

  /** 
   * Maps key codes to their currently-held press voice IDs.
   * Used to match keyUp events with the correct press voice for release timing.
   */
  private heldKeys = new Map<string, string>();

  /** Configurable maximum voice count */
  private maxVoices: number;

  constructor(
    ctx: AudioContext,
    noiseBuffer: NoiseBuffer,
    destination: AudioNode,
    maxVoices: number = MAX_ACTIVE_VOICES
  ) {
    this.ctx = ctx;
    this.noiseBuffer = noiseBuffer;
    this.destination = destination;
    this.maxVoices = maxVoices;
  }

  /**
   * Trigger a press voice for a key.
   * @param key - KeyboardEvent.code
   * @param preset - Active switch preset
   * @param keyProfile - Acoustic profile for this key
   * @param timestamp - AudioContext-relative time (defaults to now)
   * @param volumeScale - Additional volume scaling (e.g., 0.707 for −3 dB repeat)
   */
  triggerPress(
    key: string,
    preset: SwitchPreset,
    keyProfile: KeyProfile,
    timestamp?: number,
    volumeScale: number = 1.0
  ): void {
    this.enforceVoiceLimit();

    const time = timestamp ?? this.ctx.currentTime;

    const voice = new Voice(
      this.ctx,
      preset,
      keyProfile,
      this.noiseBuffer,
      this.destination,
      key,
      'press',
      (id) => this.handleVoiceEnded(id)
    );

    this.activeVoices.set(voice.id, voice);
    this.heldKeys.set(key, voice.id);

    voice.start(time, volumeScale);
  }

  /**
   * Trigger a release voice for a key.
   * @param key - KeyboardEvent.code
   * @param preset - Active switch preset
   * @param keyProfile - Acoustic profile for this key
   * @param timestamp - AudioContext-relative time (defaults to now)
   */
  triggerRelease(
    key: string,
    preset: SwitchPreset,
    keyProfile: KeyProfile,
    timestamp?: number
  ): void {
    // Remove this key from held keys
    this.heldKeys.delete(key);

    // Don't create release voice if release is disabled
    if (!preset.release.enabled) return;

    this.enforceVoiceLimit();

    const time = timestamp ?? this.ctx.currentTime;

    const voice = new Voice(
      this.ctx,
      preset,
      keyProfile,
      this.noiseBuffer,
      this.destination,
      key,
      'release',
      (id) => this.handleVoiceEnded(id)
    );

    this.activeVoices.set(voice.id, voice);
    voice.start(time);
  }

  /**
   * Check if a key is currently held (has an active press voice).
   */
  isKeyHeld(key: string): boolean {
    return this.heldKeys.has(key);
  }

  /**
   * Get the current number of active voices.
   */
  getActiveCount(): number {
    return this.activeVoices.size;
  }

  /**
   * Get diagnostics information about all active voices.
   */
  getActiveVoiceInfo(): ActiveVoiceInfo[] {
    const info: ActiveVoiceInfo[] = [];
    for (const voice of this.activeVoices.values()) {
      info.push({
        id: voice.id,
        key: voice.key,
        state: voice.getState() as VoiceState,
        startTime: voice.getEndTime(),
        type: voice.type,
      });
    }
    return info;
  }

  /**
   * Immediately stop and dispose all active voices.
   */
  stopAll(): void {
    const now = this.ctx.currentTime;
    for (const voice of this.activeVoices.values()) {
      voice.stop(now);
    }
    // Voices will clean themselves up via onEnded callbacks,
    // but clear our tracking immediately
    this.activeVoices.clear();
    this.heldKeys.clear();
  }

  /**
   * Clean up the voice manager.
   */
  dispose(): void {
    this.stopAll();
  }

  // ─── Private ───────────────────────────────────────────────────────────

  /**
   * Called when a voice finishes playing and has disposed itself.
   */
  private handleVoiceEnded(voiceId: string): void {
    this.activeVoices.delete(voiceId);

    // Also clean up heldKeys if this voice was still tracked
    for (const [key, id] of this.heldKeys) {
      if (id === voiceId) {
        this.heldKeys.delete(key);
        break;
      }
    }
  }

  /**
   * Enforce the maximum voice limit by stealing the oldest voices.
   * Called before creating a new voice.
   */
  private enforceVoiceLimit(): void {
    if (this.activeVoices.size < this.maxVoices) return;

    // Find the oldest voices to steal
    const voicesToSteal = this.activeVoices.size - this.maxVoices + 1;
    const now = this.ctx.currentTime;
    let stolen = 0;

    for (const [id, voice] of this.activeVoices) {
      if (stolen >= voicesToSteal) break;

      // Prefer stealing voices that are already past their scheduled end
      // or are release voices (less important than press voices)
      if (voice.getEndTime() <= now || voice.type === 'release') {
        voice.stop(now);
        voice.dispose();
        this.activeVoices.delete(id);
        stolen++;
      }
    }

    // If we still haven't freed enough, steal oldest regardless
    if (this.activeVoices.size >= this.maxVoices) {
      for (const [id, voice] of this.activeVoices) {
        if (this.activeVoices.size < this.maxVoices) break;
        voice.stop(now);
        voice.dispose();
        this.activeVoices.delete(id);
      }
    }
  }
}
