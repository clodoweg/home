/** washing-machine labels tests — French labels of modes, programs, phases, dryness and water hardness. */
import { describe, expect, it } from 'vitest';
import {
  formatDryLevel,
  formatMode,
  formatProgramName,
  formatProgramPhase,
  formatWaterHardness,
} from './labels';

describe('formatMode', () => {
  it.each([
    [undefined, 'Arrêt'],
    ['02', 'Lavage'],
    [' Paused ', 'En pause'],
    ['delayed_start', 'Départ différé'],
    ['42', 'Arrêté'],
    ['Eco', 'Eco'],
  ])('%s → %s', (mode, label) => {
    expect(formatMode(mode)).toBe(label);
  });
});

describe('formatProgramName', () => {
  it.each([
    [null, null],
    ['  ', null],
    ['Laundry.Washer.Program.Cotton', 'Coton'],
    ['white bed linen', 'Linge de lit blanc'],
    ['program_towels', 'Serviettes'],
    ['12', 'Vapeur / Anti-allergies'],
    ['87', 'Programme 87'],
    ['lot_wash_super_special', 'Super special'],
  ])('%s → %s', (program, label) => {
    expect(formatProgramName(program)).toBe(label);
  });
});

describe('formatProgramPhase', () => {
  it.each([
    [undefined, undefined],
    ['0', undefined],
    ['Rinsing', 'Rinçage'],
    ['anti_crease', 'Anti-froissement'],
    ['mystery', 'mystery'],
  ])('%s → %s', (phase, label) => {
    expect(formatProgramPhase(phase)).toBe(label);
  });
});

describe('formatDryLevel', () => {
  it.each([
    [undefined, undefined],
    ['OFF', undefined],
    ['none', undefined],
    ['iron dry', 'Prêt à repasser'],
    ['max', 'max'],
  ])('%s → %s', (level, label) => {
    expect(formatDryLevel(level)).toBe(label);
  });
});

describe('formatWaterHardness', () => {
  it.each([
    [undefined, undefined],
    ['Very_Hard', 'Très dure'],
    ['unknown', 'unknown'],
  ])('%s → %s', (hardness, label) => {
    expect(formatWaterHardness(hardness)).toBe(label);
  });
});
