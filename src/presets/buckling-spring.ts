import type { SwitchPreset } from '../synth/types.ts';

export const BUCKLING_SPRING_PRESET: SwitchPreset = {
  id: 'buckling-spring',
  name: 'Buckling Spring',
  description: 'Metallic · Resonant · Loud',
  isFactory: true,
  click: {
    enabled: false,
    frequency: 4500,
    q: 14,
    volume: 0.6,
    decay: 0.01
  },
  thock: {
    frequency: 250,
    waveform: 'sawtooth',
    volume: 0.45,
    decay: 0.15,
    noiseMix: 0.6,
    lowpass: 1800
  },
  release: {
    enabled: true,
    frequency: 4800,
    volume: 0.25,
    decay: 0.008
  },
  variation: {
    pitch: 0.035,
    volume: 0.04,
    decay: 0.07
  }
};
