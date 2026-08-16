import type { SwitchPreset, WaveformType } from '../synth/types.ts';

export class Designer {
  private container: HTMLElement;
  private onPresetChanged: (preset: SwitchPreset) => void;
  private currentPreset: SwitchPreset | null = null;

  private valueDisplays: Map<HTMLElement, { el: HTMLElement, formatter: (val: string) => string }> = new Map();

  // Click inputs
  private clickEnabled: HTMLInputElement;
  private clickFreq: HTMLInputElement;
  private clickQ: HTMLInputElement;
  private clickVol: HTMLInputElement;
  private clickDecay: HTMLInputElement;

  // Thock inputs
  private thockFreq: HTMLInputElement;
  private thockWave: HTMLSelectElement;
  private thockVol: HTMLInputElement;
  private thockDecay: HTMLInputElement;
  private thockNoise: HTMLInputElement;
  private thockLowpass: HTMLInputElement;

  // Release inputs
  private releaseEnabled: HTMLInputElement;
  private releaseFreq: HTMLInputElement;
  private releaseVol: HTMLInputElement;
  private releaseDecay: HTMLInputElement;

  // Variation inputs
  private varPitch: HTMLInputElement;
  private varVol: HTMLInputElement;
  private varDecay: HTMLInputElement;

  constructor(container: HTMLElement, onPresetChanged: (preset: SwitchPreset) => void) {
    this.container = container;
    this.onPresetChanged = onPresetChanged;
    this.container.className = 'designer-grid';

    // Initialize all input elements
    this.clickEnabled = this.createCheckbox();
    this.clickFreq = this.createSlider(1000, 10000, 100);
    this.clickQ = this.createSlider(1, 20, 0.5);
    this.clickVol = this.createSlider(0, 100, 1);
    this.clickDecay = this.createSlider(1, 50, 0.5);

    this.thockFreq = this.createSlider(40, 500, 5);
    this.thockWave = this.createSelect(['sine', 'triangle', 'sawtooth', 'square']);
    this.thockVol = this.createSlider(0, 100, 1);
    this.thockDecay = this.createSlider(10, 200, 1);
    this.thockNoise = this.createSlider(0, 100, 1);
    this.thockLowpass = this.createSlider(100, 3000, 50);

    this.releaseEnabled = this.createCheckbox();
    this.releaseFreq = this.createSlider(500, 10000, 100);
    this.releaseVol = this.createSlider(0, 100, 1);
    this.releaseDecay = this.createSlider(1, 50, 0.5);

    this.varPitch = this.createSlider(0, 20, 0.5);
    this.varVol = this.createSlider(0, 20, 0.5);
    this.varDecay = this.createSlider(0, 30, 0.5);

    // Build sections
    this.container.appendChild(this.buildModule('CLICK', [
      this.buildParamRow('Enabled', this.clickEnabled, v => v === 'true' ? 'On' : 'Off'),
      this.buildParamRow('Frequency', this.clickFreq, v => `${v} Hz`),
      this.buildParamRow('Resonance', this.clickQ, v => v),
      this.buildParamRow('Volume', this.clickVol, v => `${v}%`),
      this.buildParamRow('Decay', this.clickDecay, v => `${v} ms`),
    ]));

    this.container.appendChild(this.buildModule('BODY (THOCK)', [
      this.buildParamRow('Frequency', this.thockFreq, v => `${v} Hz`),
      this.buildParamRow('Waveform', this.thockWave, v => v),
      this.buildParamRow('Volume', this.thockVol, v => `${v}%`),
      this.buildParamRow('Decay', this.thockDecay, v => `${v} ms`),
      this.buildParamRow('Noise', this.thockNoise, v => `${v}%`),
      this.buildParamRow('Low-pass', this.thockLowpass, v => `${v} Hz`),
    ]));

    this.container.appendChild(this.buildModule('RELEASE', [
      this.buildParamRow('Enabled', this.releaseEnabled, v => v === 'true' ? 'On' : 'Off'),
      this.buildParamRow('Frequency', this.releaseFreq, v => `${v} Hz`),
      this.buildParamRow('Volume', this.releaseVol, v => `${v}%`),
      this.buildParamRow('Decay', this.releaseDecay, v => `${v} ms`),
    ]));

    this.container.appendChild(this.buildModule('VARIATION', [
      this.buildParamRow('Pitch', this.varPitch, v => `±${v}%`),
      this.buildParamRow('Volume', this.varVol, v => `±${v}%`),
      this.buildParamRow('Decay', this.varDecay, v => `±${v}%`),
    ]));
  }

  private createSlider(min: number, max: number, step: number): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min.toString();
    input.max = max.toString();
    input.step = step.toString();
    input.className = 'slider';
    input.addEventListener('input', this.handleInput);
    return input;
  }

  private createCheckbox(): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'ui-toggle';
    input.addEventListener('change', this.handleInput);
    return input;
  }

  private createSelect(options: string[]): HTMLSelectElement {
    const select = document.createElement('select');
    select.className = 'ui-select';
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      select.appendChild(option);
    }
    select.addEventListener('change', this.handleInput);
    return select;
  }

  private buildModule(title: string, rows: HTMLElement[]): HTMLElement {
    const module = document.createElement('div');
    module.className = 'designer-module';
    const header = document.createElement('div');
    header.className = 'designer-module-title';
    header.textContent = title;
    module.appendChild(header);
    for (const row of rows) {
      module.appendChild(row);
    }
    return module;
  }

  private buildParamRow(label: string, input: HTMLInputElement | HTMLSelectElement, formatter: (val: string) => string): HTMLElement {
    const param = document.createElement('div');
    param.className = 'designer-param';

    const lbl = document.createElement('span');
    lbl.className = 'designer-param-label';
    lbl.textContent = label;

    const controlBox = document.createElement('div');
    controlBox.className = 'designer-param-control';
    controlBox.appendChild(input);

    const val = document.createElement('span');
    val.className = 'designer-param-value';

    param.appendChild(lbl);
    param.appendChild(controlBox);
    param.appendChild(val);

    this.valueDisplays.set(input, { el: val, formatter });
    
    return param;
  }

  private handleInput = () => {
    this.updateDisplays();
    if (this.currentPreset) {
      const newPreset = this.getPreset();
      if (this.currentPreset.isFactory) {
         newPreset.isFactory = false;
         newPreset.id = `custom-${Date.now()}`;
         newPreset.name = `${this.currentPreset.name} (Custom)`;
         this.currentPreset = newPreset;
      }
      this.onPresetChanged(newPreset);
    }
  };

  private updateDisplays() {
    for (const [input, { el, formatter }] of this.valueDisplays.entries()) {
      if (input instanceof HTMLInputElement && input.type === 'checkbox') {
        el.textContent = formatter(input.checked.toString());
      } else {
        el.textContent = formatter((input as HTMLInputElement | HTMLSelectElement).value);
      }
    }
  }

  public setPreset(preset: SwitchPreset): void {
    this.currentPreset = preset;
    
    this.clickEnabled.checked = preset.click.enabled;
    this.clickFreq.value = preset.click.frequency.toString();
    this.clickQ.value = preset.click.q.toString();
    this.clickVol.value = (preset.click.volume * 100).toString();
    this.clickDecay.value = (preset.click.decay * 1000).toString(); // stored as sec, displayed as ms

    this.thockFreq.value = preset.thock.frequency.toString();
    this.thockWave.value = preset.thock.waveform;
    this.thockVol.value = (preset.thock.volume * 100).toString();
    this.thockDecay.value = (preset.thock.decay * 1000).toString();
    this.thockNoise.value = (preset.thock.noiseMix * 100).toString();
    this.thockLowpass.value = preset.thock.lowpass.toString();

    this.releaseEnabled.checked = preset.release.enabled;
    this.releaseFreq.value = preset.release.frequency.toString();
    this.releaseVol.value = (preset.release.volume * 100).toString();
    this.releaseDecay.value = (preset.release.decay * 1000).toString();

    this.varPitch.value = (preset.variation.pitch * 100).toString();
    this.varVol.value = (preset.variation.volume * 100).toString();
    this.varDecay.value = (preset.variation.decay * 100).toString();

    this.updateDisplays();
  }

  public getPreset(): SwitchPreset {
    if (!this.currentPreset) {
      throw new Error("No preset loaded");
    }

    return {
      id: this.currentPreset.id,
      name: this.currentPreset.name,
      description: this.currentPreset.description,
      isFactory: this.currentPreset.isFactory,
      click: {
        enabled: this.clickEnabled.checked,
        frequency: parseFloat(this.clickFreq.value),
        q: parseFloat(this.clickQ.value),
        volume: parseFloat(this.clickVol.value) / 100,
        decay: parseFloat(this.clickDecay.value) / 1000,
      },
      thock: {
        frequency: parseFloat(this.thockFreq.value),
        waveform: this.thockWave.value as WaveformType,
        volume: parseFloat(this.thockVol.value) / 100,
        decay: parseFloat(this.thockDecay.value) / 1000,
        noiseMix: parseFloat(this.thockNoise.value) / 100,
        lowpass: parseFloat(this.thockLowpass.value),
      },
      release: {
        enabled: this.releaseEnabled.checked,
        frequency: parseFloat(this.releaseFreq.value),
        volume: parseFloat(this.releaseVol.value) / 100,
        decay: parseFloat(this.releaseDecay.value) / 1000,
      },
      variation: {
        pitch: parseFloat(this.varPitch.value) / 100,
        volume: parseFloat(this.varVol.value) / 100,
        decay: parseFloat(this.varDecay.value) / 100,
      }
    };
  }

  // Backwards compatibility for main.ts bindings
  public isOpen(): boolean { return false; }
  public setOpen(open: boolean): void { /* Handled externally now */ }

  public dispose(): void {
    this.container.innerHTML = '';
  }
}
