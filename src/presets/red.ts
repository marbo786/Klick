import type { SwitchPreset } from '../synth/types.ts';

export const RED_PRESET: SwitchPreset = {
  id: 'cherry-mx-red',
  name: 'Cherry MX Red',
  description: 'Linear · Smooth · Clean',
  isFactory: true,
  click: {
    enabled: false,
    frequency: 3000,
    q: 5,
    volume: 0,
    decay: 0.005
  },
  thock: {
    frequency: 200,
    waveform: 'sine',
    volume: 0.5,
    decay: 0.052,
    noiseMix: 0.25,
    lowpass: 800
  },
  release: {
    enabled: true,
    frequency: 3000,
    volume: 0.1,
    decay: 0.004
  },
  variation: {
    pitch: 0.02,
    volume: 0.02,
    decay: 0.05
  }
};
