import { AudioEngine } from '../synth/AudioEngine.ts';
import type { SwitchPreset } from '../synth/types.ts';
import { FACTORY_PRESETS, getFactoryPreset, DEFAULT_PRESET_ID } from '../presets/index.ts';
import { InputHandler } from './InputHandler.ts';
import { WaveformVisualizer } from './WaveformVisualizer.ts';
import { PresetSelector } from './PresetSelector.ts';
import { VolumeControl } from './VolumeControl.ts';
import { Designer } from './Designer.ts';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import {
  loadSettings,
  saveSettings,
  loadCustomPresets,
  addCustomPreset,
  exportPreset,
  importPreset,
} from '../storage/persistence.ts';

export class AppController {
  private engine: AudioEngine;
  private currentPreset!: SwitchPreset;
  private customPresets: SwitchPreset[] = [];
  private settings = loadSettings();

  // Components
  private waveform!: WaveformVisualizer;
  private presetSelector!: PresetSelector;
  private volumeControl!: VolumeControl;
  private designer!: Designer;
  private inputHandler!: InputHandler;
  
  private audioInitialized = false;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  public initialize() {
    this.setupComponents();
    this.setupAudioInit();
    this.setupPanelToggles();
    this.setupPresets();
    this.setupCustomActions();
    this.setupMutedApps();
    this.setupAutostart();
    this.setupVisibility();
  }

  public dispose() {
    this.inputHandler?.dispose();
    this.waveform?.dispose();
    this.presetSelector?.dispose();
    this.volumeControl?.dispose();
    this.designer?.dispose();
  }

  private showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 200ms ease';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  private setupComponents() {
    const canvas = document.getElementById('waveform-canvas') as HTMLCanvasElement;
    this.waveform = new WaveformVisualizer(canvas);

    const presetContainer = document.getElementById('preset-selector-container') as HTMLElement;
    this.presetSelector = new PresetSelector(presetContainer, this.engine, (preset) => this.setActivePreset(preset));

    const volumeContainer = document.getElementById('volume-control') as HTMLElement;
    this.engine.setVolume(this.settings.masterVolume);
    this.volumeControl = new VolumeControl(volumeContainer, this.engine, (vol) => {
      this.settings.masterVolume = vol;
      saveSettings(this.settings);
    });
    this.volumeControl.setValue(this.settings.masterVolume);

    const designerContainer = document.getElementById('designer-container') as HTMLElement;
    this.designer = new Designer(designerContainer, (modifiedPreset) => {
      if (modifiedPreset.isFactory) return;
      this.engine.setPreset(modifiedPreset);
      this.currentPreset = modifiedPreset;
    });
    this.designer.setOpen(this.settings.designerOpen);

    const textarea = document.getElementById('typing-area') as HTMLTextAreaElement;
    this.inputHandler = new InputHandler(textarea, this.engine);
    this.inputHandler.setMutedApps(this.settings.mutedApps);
    
    // Focus the textarea initially
    textarea.focus();
  }

  private async initializeAudio() {
    if (this.audioInitialized) return;
    try {
      await this.engine.initialize();
      this.audioInitialized = true;

      const analyser = this.engine.getAnalyserNode();
      if (analyser) this.waveform.connect(analyser);
      this.waveform.start();

      document.getElementById('audio-init-overlay')?.classList.add('audio-init-overlay--hidden');
      console.log('[Klick] Audio engine initialized');
    } catch (err) {
      console.error('[Klick] Failed to initialize audio:', err);
      this.showToast('Failed to initialize audio engine', 'error');
    }
  }

  private setupAudioInit() {
    const handler = () => {
      this.initializeAudio();
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
    document.addEventListener('click', handler, { passive: true });
    document.addEventListener('keydown', handler, { passive: true });
  }

  private setupPanelToggles() {
    const togglePanel = (toggleId: string, panelId: string) => {
      const toggle = document.getElementById(toggleId);
      const panel = document.getElementById(panelId);
      if (!toggle || !panel) return;
      
      toggle.addEventListener('click', () => {
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        const icon = toggle.querySelector('.panel-toggle-icon') as HTMLElement;
        if (icon) {
          icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        }
      });
    };
    togglePanel('toggle-designer', 'panel-designer');
    togglePanel('toggle-settings', 'panel-settings');
  }

  private resolvePreset(id: string): SwitchPreset {
    const factory = getFactoryPreset(id);
    if (factory) return factory;
    const custom = this.customPresets.find(p => p.id === id);
    if (custom) return custom;
    return getFactoryPreset(DEFAULT_PRESET_ID) ?? FACTORY_PRESETS[0];
  }

  private setActivePreset(preset: SwitchPreset) {
    this.currentPreset = preset;
    this.engine.setPreset(preset);
    this.designer.setPreset(preset);
    this.presetSelector.setActive(preset.id);

    this.settings.selectedPresetId = preset.id;
    saveSettings(this.settings);

    const nameEl = document.getElementById('active-switch-name');
    const metaEl = document.getElementById('active-switch-metadata');
    if (nameEl) nameEl.textContent = preset.name;
    if (metaEl) metaEl.textContent = preset.description ? preset.description.toUpperCase() : (preset.isFactory ? 'PRESET' : 'CUSTOM');

    const btnDelete = document.getElementById('btn-delete-custom');
    if (btnDelete) {
      btnDelete.style.display = preset.isFactory ? 'none' : 'inline-block';
    }
  }

  private setupPresets() {
    this.customPresets = loadCustomPresets();
    for (const preset of this.customPresets) {
      this.presetSelector.addCustomPreset(preset);
    }
    this.currentPreset = this.resolvePreset(this.settings.selectedPresetId);
    this.setActivePreset(this.currentPreset);
  }

  private setupCustomActions() {
    document.getElementById('btn-save-custom')?.addEventListener('click', () => {
      const presetToSave = this.designer.getPreset();
      const customId = `custom-${Date.now()}`;
      const customName = presetToSave.isFactory ? `${presetToSave.name} (Custom)` : presetToSave.name;
      const newPreset: SwitchPreset = { ...presetToSave, id: customId, name: customName, isFactory: false };
      
      if (addCustomPreset(newPreset)) {
        this.customPresets = loadCustomPresets();
        this.presetSelector.addCustomPreset(newPreset);
        this.setActivePreset(newPreset);
        this.showToast(`Saved "${newPreset.name}"`, 'success');
      } else {
        this.showToast('Custom preset limit reached (50)', 'error');
      }
    });

    document.getElementById('btn-export-preset')?.addEventListener('click', () => {
      const json = exportPreset(this.currentPreset);
      this.createModal('Export Preset', json, true, (ta) => {
        navigator.clipboard.writeText(ta.value).then(() => this.showToast('Copied to clipboard', 'success'));
      }, 'Copy');
    });

    document.getElementById('btn-import-preset')?.addEventListener('click', () => {
      this.createModal('Import Preset', '', false, (ta, overlay) => {
        const result = importPreset(ta.value);
        if (result.success && result.preset) {
          if (addCustomPreset(result.preset)) {
            this.customPresets = loadCustomPresets();
            this.presetSelector.addCustomPreset(result.preset);
            this.setActivePreset(result.preset);
            this.showToast(`Imported "${result.preset.name}"`, 'success');
            overlay.remove();
          } else {
            this.showToast('Custom preset limit reached (50)', 'error');
          }
        } else {
          this.showToast(result.errors[0] || 'Invalid preset JSON', 'error');
        }
      }, 'Import', 'Paste preset JSON here...');
    });

    document.getElementById('btn-delete-custom')?.addEventListener('click', () => {
      if (this.currentPreset.isFactory) return;
      if (confirm(`Are you sure you want to delete "${this.currentPreset.name}"?`)) {
        this.customPresets = this.customPresets.filter(p => p.id !== this.currentPreset.id);
        localStorage.setItem('klick_custom_presets', JSON.stringify(this.customPresets));
        this.presetSelector.removeCustomPreset(this.currentPreset.id);
        this.setActivePreset(this.resolvePreset(DEFAULT_PRESET_ID));
        this.showToast('Preset deleted', 'success');
      }
    });
  }

  private createModal(titleText: string, content: string, readOnly: boolean, onAction: (ta: HTMLTextAreaElement, overlay: HTMLElement) => void, actionText: string, placeholder = '') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const title = document.createElement('div');
    title.className = 'modal-title';
    title.textContent = titleText;
    
    const ta = document.createElement('textarea');
    ta.className = 'modal-textarea';
    ta.value = content;
    ta.readOnly = readOnly;
    if (placeholder) ta.placeholder = placeholder;
    
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    
    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn btn--accent';
    actionBtn.textContent = actionText;
    actionBtn.addEventListener('click', () => onAction(ta, overlay));
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => overlay.remove());
    
    actions.appendChild(actionBtn);
    actions.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(ta);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  private renderMutedApps(mutedAppsList: HTMLElement) {
    mutedAppsList.innerHTML = '';
    this.settings.mutedApps.forEach(app => {
      const tag = document.createElement('div');
      tag.className = 'muted-app-tag';
      
      const label = document.createElement('span');
      label.textContent = app;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'muted-app-tag-remove';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => {
        this.settings.mutedApps = this.settings.mutedApps.filter(a => a !== app);
        saveSettings(this.settings);
        this.inputHandler.setMutedApps(this.settings.mutedApps);
        this.renderMutedApps(mutedAppsList);
      });
      
      tag.appendChild(label);
      tag.appendChild(removeBtn);
      mutedAppsList.appendChild(tag);
    });
  }

  private setupMutedApps() {
    const list = document.getElementById('muted-apps-list');
    const input = document.getElementById('muted-app-input') as HTMLInputElement;
    const btn = document.getElementById('btn-add-muted-app');
    
    if (list && input && btn) {
      btn.addEventListener('click', () => {
        const val = input.value.trim().toLowerCase();
        if (val && !this.settings.mutedApps.includes(val)) {
          this.settings.mutedApps.push(val);
          saveSettings(this.settings);
          this.inputHandler.setMutedApps(this.settings.mutedApps);
          input.value = '';
          this.renderMutedApps(list);
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btn.click();
      });
      this.renderMutedApps(list);
    }
  }

  private async setupAutostart() {
    const toggle = document.getElementById('autostart-toggle') as HTMLInputElement;
    if (!toggle) return;

    const sync = async () => {
      if (!(window as any).__TAURI_INTERNALS__) return;
      try {
        if (this.settings.runOnStartup) await enable();
        else await disable();
        toggle.checked = await isEnabled();
      } catch (e) {
        console.warn("Failed to sync autostart:", e);
      }
    };

    toggle.checked = this.settings.runOnStartup;
    toggle.addEventListener('change', async () => {
      this.settings.runOnStartup = toggle.checked;
      saveSettings(this.settings);
      await sync();
    });
    
    await sync();
  }

  private setupVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.audioInitialized && this.engine.getState() === 'suspended') {
        this.engine.initialize().catch(console.error);
      }
    });

    if ((window as any).__TAURI_INTERNALS__) {
      document.body.classList.add('desktop-mode');
    }
  }
}
