import type { SwitchPreset } from '../synth/types.ts';

export const BLUE_PRESET: SwitchPreset = {
  id: 'cherry-mx-blue',
  name: 'Cherry MX Blue',
  description: 'Clicky · Sharp · Loud',
  isFactory: true,
  click: {
    enabled: false,
    frequency: 11000,
    q: 12,
    volume: 0.65,
    decay: 0.008
  },
  thock: {
    frequency: 250,
    waveform: 'triangle',
    volume: 0.35,
    decay: 0.065,
    noiseMix: 0.4,
    lowpass: 700
  },
  release: {
    enabled: true,
    frequency: 4200,
    volume: 0.2,
    decay: 0.006
  },
  variation: {
    pitch: 0.03,
    volume: 0.04,
    decay: 0.08
  }
};
