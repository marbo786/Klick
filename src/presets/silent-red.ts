import type { SwitchPreset } from '../synth/types.ts';

export const SILENT_RED_PRESET: SwitchPreset = {
  id: 'silent-red',
  name: 'Silent Red',
  description: 'Damped · Quiet · Subtle',
  isFactory: true,
  click: {
    enabled: false,
    frequency: 3000,
    q: 5,
    volume: 0,
    decay: 0.005
  },
  thock: {
    frequency: 150,
    waveform: 'sine',
    volume: 0.25,
    decay: 0.02,
    noiseMix: 0.05,
    lowpass: 200
  },
  release: {
    enabled: true,
    frequency: 1800,
    volume: 0.05,
    decay: 0.003
  },
  variation: {
    pitch: 0.015,
    volume: 0.015,
    decay: 0.04
  }
};
