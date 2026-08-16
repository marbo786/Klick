import type { SwitchPreset } from '../synth/types.ts';

export const BROWN_PRESET: SwitchPreset = {
  id: 'cherry-mx-brown',
  name: 'Cherry MX Brown',
  description: 'Tactile · Balanced · Moderate',
  isFactory: true,
  click: {
    enabled: false,
    frequency: 900,
    q: 2.5,
    volume: 0.2,
    decay: 0.008
  },
  thock: {
    frequency: 200,
    waveform: 'triangle',
    volume: 0.5,
    decay: 0.06,
    noiseMix: 0.3,
    lowpass: 800
  },
  release: {
    enabled: true,
    frequency: 3500,
    volume: 0.15,
    decay: 0.005
  },
  variation: {
    pitch: 0.025,
    volume: 0.03,
    decay: 0.06
  }
};
