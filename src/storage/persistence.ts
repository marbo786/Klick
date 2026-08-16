/**
 * Klick — Persistence Layer
 * 
 * Abstracts localStorage access behind a clean API.
 * Handles corrupted data gracefully and enforces the 50-preset limit.
 */

import type { AppSettings, SwitchPreset, PresetImportResult } from '../synth/types.ts';
import { MAX_CUSTOM_PRESETS } from '../synth/types.ts';

const STORAGE_KEYS = {
  settings: 'klick-settings',
  customPresets: 'klick-custom-presets',
} as const;

// ─── Default Settings ────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  selectedPresetId: 'cherry-mx-blue',
  masterVolume: 0.75,
  designerOpen: false,
  diagnosticsOpen: false,
  mutedApps: [],
  runOnStartup: true, // Default to true since it's a background utility
};

// ─── Settings ────────────────────────────────────────────────────────────────

/** Load persisted settings, falling back to defaults on any error */
export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(raw) as Partial<AppSettings>;

    // Merge with defaults so missing keys are filled
    return {
      selectedPresetId: typeof parsed.selectedPresetId === 'string'
        ? parsed.selectedPresetId
        : DEFAULT_SETTINGS.selectedPresetId,
      masterVolume: typeof parsed.masterVolume === 'number' && parsed.masterVolume >= 0 && parsed.masterVolume <= 1
        ? parsed.masterVolume
        : DEFAULT_SETTINGS.masterVolume,
      designerOpen: typeof parsed.designerOpen === 'boolean'
        ? parsed.designerOpen
        : DEFAULT_SETTINGS.designerOpen,
      diagnosticsOpen: typeof parsed.diagnosticsOpen === 'boolean'
        ? parsed.diagnosticsOpen
        : DEFAULT_SETTINGS.diagnosticsOpen,
      mutedApps: Array.isArray(parsed.mutedApps)
        ? parsed.mutedApps
        : DEFAULT_SETTINGS.mutedApps,
      runOnStartup: typeof parsed.runOnStartup === 'boolean'
        ? parsed.runOnStartup
        : DEFAULT_SETTINGS.runOnStartup,
    };
  } catch (err) {
    console.warn('[Klick] Failed to load settings, using defaults:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

/** Save settings to localStorage */
export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  } catch (err) {
    console.warn('[Klick] Failed to save settings:', err);
  }
}

// ─── Custom Presets ──────────────────────────────────────────────────────────

/** Load custom presets from localStorage */
export function loadCustomPresets(): SwitchPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customPresets);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Validate each preset
    return parsed
      .filter((p: unknown) => isValidPreset(p))
      .map((p: SwitchPreset) => ({ ...p, isFactory: false }))
      .slice(0, MAX_CUSTOM_PRESETS);
  } catch (err) {
    console.warn('[Klick] Failed to load custom presets:', err);
    return [];
  }
}

/** Save custom presets to localStorage. Enforces the 50-preset limit. */
export function saveCustomPresets(presets: SwitchPreset[]): boolean {
  if (presets.length > MAX_CUSTOM_PRESETS) {
    console.warn(`[Klick] Custom preset limit (${MAX_CUSTOM_PRESETS}) exceeded, truncating`);
    presets = presets.slice(0, MAX_CUSTOM_PRESETS);
  }

  try {
    // Strip isFactory to save space (custom presets are always non-factory)
    const toSave = presets.map(p => ({ ...p, isFactory: false }));
    localStorage.setItem(STORAGE_KEYS.customPresets, JSON.stringify(toSave));
    return true;
  } catch (err) {
    console.warn('[Klick] Failed to save custom presets:', err);
    return false;
  }
}

/** Add a custom preset. Returns false if the limit is reached. */
export function addCustomPreset(preset: SwitchPreset): boolean {
  const existing = loadCustomPresets();
  if (existing.length >= MAX_CUSTOM_PRESETS) {
    return false;
  }

  // Ensure unique ID
  const dedupedId = ensureUniqueId(preset.id, existing);
  existing.push({ ...preset, id: dedupedId, isFactory: false });
  return saveCustomPresets(existing);
}

/** Delete a custom preset by ID */
export function deleteCustomPreset(id: string): boolean {
  const existing = loadCustomPresets();
  const filtered = existing.filter(p => p.id !== id);
  if (filtered.length === existing.length) return false;
  return saveCustomPresets(filtered);
}

/** Update an existing custom preset */
export function updateCustomPreset(preset: SwitchPreset): boolean {
  const existing = loadCustomPresets();
  const idx = existing.findIndex(p => p.id === preset.id);
  if (idx === -1) return false;
  existing[idx] = { ...preset, isFactory: false };
  return saveCustomPresets(existing);
}

/** Get the count of custom presets */
export function getCustomPresetCount(): number {
  return loadCustomPresets().length;
}

// ─── Import / Export ─────────────────────────────────────────────────────────

/** Export a single preset as a JSON string */
export function exportPreset(preset: SwitchPreset): string {
  return JSON.stringify(preset, null, 2);
}

/** Export all custom presets as a JSON string */
export function exportAllPresets(): string {
  const presets = loadCustomPresets();
  return JSON.stringify(presets, null, 2);
}

/**
 * Validate and import a preset from a JSON string.
 * Returns a result with the parsed preset or errors.
 */
export function importPreset(jsonString: string): PresetImportResult {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return { success: false, errors: ['Invalid JSON'] };
  }

  // Handle array (import first preset)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { success: false, errors: ['Empty preset array'] };
    }
    parsed = parsed[0];
  }

  if (!isValidPreset(parsed)) {
    return { success: false, errors: ['Invalid preset structure: missing or invalid fields'] };
  }

  // Clamp values to safe ranges
  const preset = clampPreset(parsed as SwitchPreset);
  preset.isFactory = false;

  // Check limit
  if (getCustomPresetCount() >= MAX_CUSTOM_PRESETS) {
    return { success: false, errors: [`Custom preset limit (${MAX_CUSTOM_PRESETS}) reached`] };
  }

  return { success: true, preset, errors };
}

/**
 * Import multiple presets from a JSON string.
 * Returns results for each preset.
 */
export function importMultiplePresets(jsonString: string): PresetImportResult[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return [{ success: false, errors: ['Invalid JSON'] }];
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map((item: unknown) => {
    if (!isValidPreset(item)) {
      return { success: false, errors: ['Invalid preset structure'] };
    }
    const preset = clampPreset(item as SwitchPreset);
    preset.isFactory = false;
    return { success: true, preset, errors: [] };
  });
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/** Type guard: check if an unknown value is a valid SwitchPreset */
function isValidPreset(value: unknown): value is SwitchPreset {
  if (!value || typeof value !== 'object') return false;

  const p = value as Record<string, unknown>;

  // Check required string fields
  if (typeof p.id !== 'string' || !p.id) return false;
  if (typeof p.name !== 'string' || !p.name) return false;

  // Check nested objects exist
  if (!p.click || typeof p.click !== 'object') return false;
  if (!p.thock || typeof p.thock !== 'object') return false;
  if (!p.release || typeof p.release !== 'object') return false;
  if (!p.variation || typeof p.variation !== 'object') return false;

  const click = p.click as Record<string, unknown>;
  const thock = p.thock as Record<string, unknown>;
  const release = p.release as Record<string, unknown>;
  const variation = p.variation as Record<string, unknown>;

  // Validate click
  if (typeof click.enabled !== 'boolean') return false;
  if (typeof click.frequency !== 'number') return false;
  if (typeof click.q !== 'number') return false;
  if (typeof click.volume !== 'number') return false;
  if (typeof click.decay !== 'number') return false;

  // Validate thock
  if (typeof thock.frequency !== 'number') return false;
  if (typeof thock.waveform !== 'string') return false;
  if (!['sine', 'triangle', 'sawtooth', 'square'].includes(thock.waveform as string)) return false;
  if (typeof thock.volume !== 'number') return false;
  if (typeof thock.decay !== 'number') return false;
  if (typeof thock.noiseMix !== 'number') return false;
  if (typeof thock.lowpass !== 'number') return false;

  // Validate release
  if (typeof release.enabled !== 'boolean') return false;
  if (typeof release.frequency !== 'number') return false;
  if (typeof release.volume !== 'number') return false;
  if (typeof release.decay !== 'number') return false;

  // Validate variation
  if (typeof variation.pitch !== 'number') return false;
  if (typeof variation.volume !== 'number') return false;
  if (typeof variation.decay !== 'number') return false;

  return true;
}

/** Clamp all preset values to safe ranges */
function clampPreset(preset: SwitchPreset): SwitchPreset {
  return {
    ...preset,
    description: preset.description || '',
    isFactory: false,
    click: {
      enabled: preset.click.enabled,
      frequency: clamp(preset.click.frequency, 100, 10000),
      q: clamp(preset.click.q, 0.1, 30),
      volume: clamp(preset.click.volume, 0, 1),
      decay: clamp(preset.click.decay, 0.001, 0.1),
    },
    thock: {
      frequency: clamp(preset.thock.frequency, 20, 1000),
      waveform: preset.thock.waveform,
      volume: clamp(preset.thock.volume, 0, 1),
      decay: clamp(preset.thock.decay, 0.01, 0.5),
      noiseMix: clamp(preset.thock.noiseMix, 0, 1),
      lowpass: clamp(preset.thock.lowpass, 50, 5000),
    },
    release: {
      enabled: preset.release.enabled,
      frequency: clamp(preset.release.frequency, 100, 10000),
      volume: clamp(preset.release.volume, 0, 1),
      decay: clamp(preset.release.decay, 0.001, 0.1),
    },
    variation: {
      pitch: clamp(preset.variation.pitch, 0, 0.2),
      volume: clamp(preset.variation.volume, 0, 0.2),
      decay: clamp(preset.variation.decay, 0, 0.3),
    },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Ensure a preset ID is unique by appending a number if needed */
function ensureUniqueId(id: string, existing: SwitchPreset[]): string {
  const ids = new Set(existing.map(p => p.id));
  if (!ids.has(id)) return id;

  let counter = 1;
  while (ids.has(`${id}-${counter}`)) counter++;
  return `${id}-${counter}`;
}
