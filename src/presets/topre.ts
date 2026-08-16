import type { SwitchPreset } from '../synth/types.ts';

export const TOPRE_PRESET: SwitchPreset = {
  id: 'topre',
  name: 'Topre',
  description: 'Deep · Soft · Rounded',
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
    volume: 0.45,
    decay: 0.08,
    noiseMix: 0.1,
    lowpass: 250
  },
  release: {
    enabled: true,
    frequency: 2000,
    volume: 0.1,
    decay: 0.005
  },
  variation: {
    pitch: 0.02,
    volume: 0.025,
    decay: 0.05
  }
};
