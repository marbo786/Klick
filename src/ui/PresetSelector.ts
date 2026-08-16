import { AudioEngine } from '../synth/AudioEngine.ts';
import { FACTORY_PRESETS } from '../presets/index.ts';
import type { SwitchPreset } from '../synth/types.ts';

export class PresetSelector {
  private activePresetId: string | null = null;
  private customPresets: Map<string, SwitchPreset> = new Map();
  private listContainer: HTMLDivElement;

  private container: HTMLElement;
  private engine: AudioEngine;
  private onChange: (preset: SwitchPreset) => void;

  constructor(
    container: HTMLElement,
    engine: AudioEngine,
    onChange: (preset: SwitchPreset) => void
  ) {
    this.container = container;
    this.engine = engine;
    this.onChange = onChange;
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'switch-list';
    this.container.appendChild(this.listContainer);
    
    this.render();
  }

  public addCustomPreset(preset: SwitchPreset) {
    this.customPresets.set(preset.id, preset);
    this.render();
  }

  public removeCustomPreset(id: string) {
    this.customPresets.delete(id);
    this.render();
  }

  public setActive(presetId: string) {
    this.activePresetId = presetId;
    this.updateActiveHighlight();
  }

  private render() {
    this.listContainer.innerHTML = '';

    // Render Factory Group
    const factoryGroup = this.createGroup('FACTORY');
    for (const preset of FACTORY_PRESETS) {
      factoryGroup.appendChild(this.createPresetRow(preset));
    }
    this.listContainer.appendChild(factoryGroup);

    // Render Custom Group if exists
    if (this.customPresets.size > 0) {
      const customGroup = this.createGroup('CUSTOM');
      for (const preset of Array.from(this.customPresets.values())) {
        customGroup.appendChild(this.createPresetRow(preset));
      }
      this.listContainer.appendChild(customGroup);
    }
  }

  private createGroup(label: string): HTMLElement {
    const group = document.createElement('div');
    group.className = 'preset-group';
    const groupLabel = document.createElement('div');
    groupLabel.className = 'preset-group-label';
    groupLabel.textContent = label;
    group.appendChild(groupLabel);
    return group;
  }

  private createPresetRow(preset: SwitchPreset): HTMLElement {
    const row = document.createElement('div');
    row.className = 'preset-row';
    row.dataset.id = preset.id;
    
    if (preset.id === this.activePresetId) {
      row.classList.add('preset-row--active');
    }

    const nameEl = document.createElement('div');
    nameEl.className = 'preset-name';
    nameEl.textContent = preset.name;

    const descEl = document.createElement('div');
    descEl.className = 'preset-desc';
    // Format description to be uppercase and clean
    descEl.textContent = preset.description ? preset.description.toUpperCase() : (preset.isFactory ? 'PRESET' : 'CUSTOM');

    row.appendChild(nameEl);
    row.appendChild(descEl);

    row.addEventListener('click', () => {
      this.engine.setPreset(preset);
      this.activePresetId = preset.id;
      this.updateActiveHighlight();
      this.onChange(preset);
    });

    return row;
  }

  private updateActiveHighlight() {
    const rows = this.listContainer.querySelectorAll('.preset-row');
    rows.forEach(row => {
      if ((row as HTMLElement).dataset.id === this.activePresetId) {
        row.classList.add('preset-row--active');
      } else {
        row.classList.remove('preset-row--active');
      }
    });
  }

  public dispose() {
    this.container.removeChild(this.listContainer);
  }
}
