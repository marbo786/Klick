/**
 * Klick — Main Entry Point
 * 
 * Wires together the audio engine, UI components, persistence,
 * and handles the application lifecycle.
 */

import './style.css';

import type { SwitchPreset } from './synth/types.ts';
import { AudioEngine } from './synth/AudioEngine.ts';
import { FACTORY_PRESETS, getFactoryPreset, DEFAULT_PRESET_ID } from './presets/index.ts';
import { InputHandler } from './ui/InputHandler.ts';
import { WaveformVisualizer } from './ui/WaveformVisualizer.ts';
import { PresetSelector } from './ui/PresetSelector.ts';
import { VolumeControl } from './ui/VolumeControl.ts';
import { Designer } from './ui/Designer.ts';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import {
  loadSettings,
  saveSettings,
  loadCustomPresets,
  addCustomPreset,
  exportPreset,
  importPreset,
} from './storage/persistence.ts';

// ─── Application State ──────────────────────────────────────────────────────

const engine = new AudioEngine();
(window as any).engine = engine; // Expose for testing
let currentPreset: SwitchPreset;
let customPresets: SwitchPreset[] = [];
let settings = loadSettings();

// ─── DOM Elements ───────────────────────────────────────────────────────────

const textarea = document.getElementById('typing-area') as HTMLTextAreaElement;
const canvas = document.getElementById('waveform-canvas') as HTMLCanvasElement;
const presetContainer = document.getElementById('preset-selector-container') as HTMLElement;
const volumeContainer = document.getElementById('volume-control') as HTMLElement;
const designerContainer = document.getElementById('designer-container') as HTMLElement;
const audioOverlay = document.getElementById('audio-init-overlay') as HTMLElement;

// Top active switch info
const activeSwitchName = document.getElementById('active-switch-name') as HTMLElement;
const activeSwitchMetadata = document.getElementById('active-switch-metadata') as HTMLElement;

// Panel toggles
const toggleDesigner = document.getElementById('toggle-designer') as HTMLElement;
const panelDesigner = document.getElementById('panel-designer') as HTMLElement;
const toggleSettings = document.getElementById('toggle-settings') as HTMLElement;
const panelSettings = document.getElementById('panel-settings') as HTMLElement;

// Custom Actions
const btnSave = document.getElementById('btn-save-custom') as HTMLButtonElement;
const btnExport = document.getElementById('btn-export-preset') as HTMLButtonElement;
const btnImport = document.getElementById('btn-import-preset') as HTMLButtonElement;
const btnDelete = document.getElementById('btn-delete-custom') as HTMLButtonElement;

const mutedAppsList = document.getElementById('muted-apps-list') as HTMLElement;
const mutedAppInput = document.getElementById('muted-app-input') as HTMLInputElement;
const btnAddMutedApp = document.getElementById('btn-add-muted-app') as HTMLButtonElement;
const autostartToggle = document.getElementById('autostart-toggle') as HTMLInputElement;

// Toast container
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

// ─── Toast Notifications ────────────────────────────────────────────────────

function showToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// ─── Audio Initialization ───────────────────────────────────────────────────

let audioInitialized = false;

async function initializeAudio(): Promise<void> {
  if (audioInitialized) return;

  try {
    await engine.initialize();
    audioInitialized = true;

    // Connect waveform visualizer
    const analyser = engine.getAnalyserNode();
    if (analyser) {
      waveform.connect(analyser);
    }
    waveform.start();

    // Hide the overlay
    audioOverlay.classList.add('audio-init-overlay--hidden');

    console.log('[Klick] Audio engine initialized');
  } catch (err) {
    console.error('[Klick] Failed to initialize audio:', err);
    showToast('Failed to initialize audio engine', 'error');
  }
}

// Initialize on any user interaction
function handleFirstInteraction(): void {
  initializeAudio();
  document.removeEventListener('click', handleFirstInteraction);
  document.removeEventListener('keydown', handleFirstInteraction);
}
document.addEventListener('click', handleFirstInteraction, { passive: true });
document.addEventListener('keydown', handleFirstInteraction, { passive: true });

// ─── Preset Management ─────────────────────────────────────────────────────

function resolvePreset(id: string): SwitchPreset {
  // Check factory presets first
  const factory = getFactoryPreset(id);
  if (factory) return factory;

  // Check custom presets
  const custom = customPresets.find(p => p.id === id);
  if (custom) return custom;

  // Fallback to default
  return getFactoryPreset(DEFAULT_PRESET_ID) ?? FACTORY_PRESETS[0];
}

function setActivePreset(preset: SwitchPreset): void {
  currentPreset = preset;
  engine.setPreset(preset);
  designer.setPreset(preset);
  presetSelector.setActive(preset.id);

  settings.selectedPresetId = preset.id;
  saveSettings(settings);

  // Update centerpiece
  activeSwitchName.textContent = preset.name;
  activeSwitchMetadata.textContent = preset.description ? preset.description.toUpperCase() : (preset.isFactory ? 'PRESET' : 'CUSTOM');

  // Toggle delete button
  if (preset.isFactory) {
    btnDelete.style.display = 'none';
  } else {
    btnDelete.style.display = 'inline-block';
  }
}

// ─── Panel Toggles ──────────────────────────────────────────────────────────

function setupPanelToggle(toggle: HTMLElement, panel: HTMLElement) {
  toggle.addEventListener('click', () => {
    // We toggle a class on the panel's wrapper/parent, or just on the panel itself
    // Let's toggle class on the parent of both, which is the section, or just toggle on the panel itself?
    // In our CSS: .panel--open .panel-content -> wait, the structure is:
    // <div class="panel-toggle">...</div> <div class="panel-content">...</div>
    // So if we wrap them in a .panel, or just add .panel--open to the parent?
    // Let's just toggle 'display: block' or add a class to the toggle's parent (the section).
    // Actually, let's just toggle a class on the panel itself and update CSS.
    // I'll toggle a custom class directly on the panel.
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    
    // Rotate icon
    const icon = toggle.querySelector('.panel-toggle-icon') as HTMLElement;
    if (icon) {
      icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    }
  });
}
setupPanelToggle(toggleDesigner, panelDesigner);
setupPanelToggle(toggleSettings, panelSettings);

// ─── UI Components ──────────────────────────────────────────────────────────

// Waveform Visualizer
const waveform = new WaveformVisualizer(canvas);

// Preset Selector
const presetSelector = new PresetSelector(presetContainer, engine, (preset) => {
  setActivePreset(preset);
});

// Volume Control
engine.setVolume(settings.masterVolume);
const volumeControl = new VolumeControl(volumeContainer, engine, (volume) => {
  settings.masterVolume = volume;
  saveSettings(settings);
});
volumeControl.setValue(settings.masterVolume);

// Designer
const designer = new Designer(designerContainer, (modifiedPreset) => {
  // If it's a factory preset being modified, the designer produces a custom copy
  if (modifiedPreset.isFactory) {
    // Don't apply factory modifications directly — user must save as custom
    return;
  }

  // Apply changes to the engine immediately for live preview
  engine.setPreset(modifiedPreset);
  currentPreset = modifiedPreset;
});
designer.setOpen(settings.designerOpen);

// Input Handler
const inputHandler = new InputHandler(textarea, engine);
inputHandler.setMutedApps(settings.mutedApps);

// ─── Muted Apps ─────────────────────────────────────────────────────────────

function renderMutedApps() {
  mutedAppsList.innerHTML = '';
  settings.mutedApps.forEach(app => {
    const tag = document.createElement('div');
    tag.className = 'muted-app-tag';
    
    const label = document.createElement('span');
    label.textContent = app;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'muted-app-tag-remove';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      settings.mutedApps = settings.mutedApps.filter(a => a !== app);
      saveSettings(settings);
      inputHandler.setMutedApps(settings.mutedApps);
      renderMutedApps();
    });
    
    tag.appendChild(label);
    tag.appendChild(removeBtn);
    mutedAppsList.appendChild(tag);
  });
}

btnAddMutedApp.addEventListener('click', () => {
  const val = mutedAppInput.value.trim().toLowerCase();
  if (val && !settings.mutedApps.includes(val)) {
    settings.mutedApps.push(val);
    saveSettings(settings);
    inputHandler.setMutedApps(settings.mutedApps);
    mutedAppInput.value = '';
    renderMutedApps();
  }
});

mutedAppInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnAddMutedApp.click();
});

renderMutedApps();

// ─── Autostart ──────────────────────────────────────────────────────────────

async function syncAutostart() {
  if (!(window as any).__TAURI_INTERNALS__) return;
  try {
    if (settings.runOnStartup) {
      await enable();
    } else {
      await disable();
    }
    const state = await isEnabled();
    autostartToggle.checked = state;
  } catch (e) {
    console.warn("Failed to sync autostart:", e);
  }
}

autostartToggle.checked = settings.runOnStartup;
autostartToggle.addEventListener('change', async () => {
  settings.runOnStartup = autostartToggle.checked;
  saveSettings(settings);
  await syncAutostart();
});

syncAutostart();

// ─── Load Custom Presets ────────────────────────────────────────────────────

customPresets = loadCustomPresets();
for (const preset of customPresets) {
  presetSelector.addCustomPreset(preset);
}

// ─── Set Initial Preset ─────────────────────────────────────────────────────

currentPreset = resolvePreset(settings.selectedPresetId);
setActivePreset(currentPreset);

// ─── Custom Preset Actions ──────────────────────────────────────────────────

btnSave.addEventListener('click', () => {
  const presetToSave = designer.getPreset();

  // Generate a unique ID for the custom preset
  const customId = `custom-${Date.now()}`;
  const customName = presetToSave.isFactory
    ? `${presetToSave.name} (Custom)`
    : presetToSave.name;

  const newPreset: SwitchPreset = {
    ...presetToSave,
    id: customId,
    name: customName,
    isFactory: false,
  };

  const success = addCustomPreset(newPreset);
  if (success) {
    customPresets = loadCustomPresets();
    presetSelector.addCustomPreset(newPreset);
    setActivePreset(newPreset);
    showToast(`Saved "${newPreset.name}"`, 'success');
  } else {
    showToast('Custom preset limit reached (50)', 'error');
  }
});

btnExport.addEventListener('click', () => {
  const json = exportPreset(currentPreset);

  // Create modal with JSON
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Export Preset';

  const ta = document.createElement('textarea');
  ta.className = 'modal-textarea';
  ta.value = json;
  ta.readOnly = true;

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn--accent';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(json).then(() => {
      showToast('Copied to clipboard', 'success');
      overlay.remove();
    });
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn';
  closeBtn.textContent = 'Close';
  closeBtn.addEventListener('click', () => overlay.remove());

  actions.appendChild(copyBtn);
  actions.appendChild(closeBtn);
  modal.appendChild(title);
  modal.appendChild(ta);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
});

btnImport.addEventListener('click', () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  const title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = 'Import Preset';

  const ta = document.createElement('textarea');
  ta.className = 'modal-textarea';
  ta.placeholder = 'Paste preset JSON here...';

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn--accent';
  importBtn.textContent = 'Import';
  importBtn.addEventListener('click', () => {
    const result = importPreset(ta.value);
    if (result.success && result.preset) {
      const success = addCustomPreset(result.preset);
      if (success) {
        customPresets = loadCustomPresets();
        presetSelector.addCustomPreset(result.preset);
        setActivePreset(result.preset);
        showToast(`Imported "${result.preset.name}"`, 'success');
        overlay.remove();
      } else {
        showToast('Custom preset limit reached (50)', 'error');
      }
    } else {
      showToast(result.errors[0] || 'Invalid preset JSON', 'error');
    }
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn';
  closeBtn.textContent = 'Cancel';
  closeBtn.addEventListener('click', () => overlay.remove());

  actions.appendChild(importBtn);
  actions.appendChild(closeBtn);
  modal.appendChild(title);
  modal.appendChild(ta);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
});

// ─── Delete Custom Preset ───────────────────────────────────────────────────

btnDelete.addEventListener('click', () => {
  if (currentPreset.isFactory) return;
  if (confirm(`Are you sure you want to delete "${currentPreset.name}"?`)) {
    // Delete from localStorage by filtering and re-saving
    customPresets = customPresets.filter(p => p.id !== currentPreset.id);
    localStorage.setItem('klick_custom_presets', JSON.stringify(customPresets));
    
    // Update UI
    presetSelector.removeCustomPreset(currentPreset.id);
    
    // Switch to default
    setActivePreset(resolvePreset(DEFAULT_PRESET_ID));
    showToast('Preset deleted', 'success');
  }
});

// ─── Page Visibility ────────────────────────────────────────────────────────

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Optionally reduce resource usage when tab is hidden
    // The AudioContext will handle suspension automatically in some browsers
  } else {
    // Resume audio if it was suspended
    if (audioInitialized && engine.getState() === 'suspended') {
      engine.initialize().catch(console.error);
    }
  }
});

// ─── Cleanup (for HMR in dev) ───────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    inputHandler.dispose();
    waveform.dispose();
    presetSelector.dispose();
    volumeControl.dispose();
    designer.dispose();
    engine.dispose();
  });
}

// ─── Desktop Status Check ───────────────────────────────────────────────────

if ((window as any).__TAURI_INTERNALS__) {
  document.body.classList.add('desktop-mode');
}

// Focus the textarea on load
textarea.focus();
