import type { SwitchPreset } from '../synth/types.ts';
import { BLUE_PRESET } from './blue.ts';
import { BROWN_PRESET } from './brown.ts';
import { RED_PRESET } from './red.ts';
import { BUCKLING_SPRING_PRESET } from './buckling-spring.ts';
import { TOPRE_PRESET } from './topre.ts';
import { SILENT_RED_PRESET } from './silent-red.ts';

export const FACTORY_PRESETS: readonly SwitchPreset[] = [
  BLUE_PRESET,
  BROWN_PRESET,
  RED_PRESET,
  BUCKLING_SPRING_PRESET,
  TOPRE_PRESET,
  SILENT_RED_PRESET
];

export const FACTORY_PRESET_MAP: ReadonlyMap<string, SwitchPreset> = new Map(
  FACTORY_PRESETS.map(preset => [preset.id, preset])
);

export function getFactoryPreset(id: string): SwitchPreset | undefined {
  return FACTORY_PRESET_MAP.get(id);
}

export const DEFAULT_PRESET_ID: string = 'cherry-mx-blue';
