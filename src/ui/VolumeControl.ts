import { AudioEngine } from '../synth/AudioEngine.ts';

export class VolumeControl {
  private slider: HTMLInputElement;
  private readout: HTMLSpanElement;
  private lastVolume: number = 0.5;

  private container: HTMLElement;
  private engine: AudioEngine;
  private onChange: (volume: number) => void;

  constructor(
    container: HTMLElement,
    engine: AudioEngine,
    onChange: (volume: number) => void
  ) {
    this.container = container;
    this.engine = engine;
    this.onChange = onChange;

    const label = document.createElement('span');
    label.className = 'volume-label';
    label.textContent = 'VOLUME';

    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.id = 'volume-slider';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.step = '1';
    this.slider.className = 'slider';
    
    // Initialize based on engine current volume
    const currentVol = this.engine.getVolume();
    this.slider.value = Math.round(currentVol * 100).toString();
    this.lastVolume = currentVol > 0 ? currentVol : 0.5;

    this.readout = document.createElement('span');
    this.readout.className = 'volume-label';
    this.readout.style.textAlign = 'right';
    this.readout.style.minWidth = '40px';
    this.readout.textContent = `${this.slider.value}%`;

    this.slider.addEventListener('input', this.handleInput);

    this.container.appendChild(label);
    this.container.appendChild(this.slider);
    this.container.appendChild(this.readout);
  }

  private handleInput = () => {
    const val = parseInt(this.slider.value, 10);
    const volume = val / 100;
    this.readout.textContent = `${val}%`;
    
    this.engine.setVolume(volume);
    this.onChange(volume);
    
    if (volume > 0) {
      this.lastVolume = volume;
    }
  };

  public setValue(volume: number) {
    const val = Math.max(0, Math.min(1, volume));
    const percent = Math.round(val * 100);
    this.slider.value = percent.toString();
    this.readout.textContent = `${percent}%`;
  }

  public getValue(): number {
    return parseInt(this.slider.value, 10) / 100;
  }

  public dispose() {
    this.slider.removeEventListener('input', this.handleInput);
    this.container.innerHTML = '';
  }
}
