import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import { setQuiet } from '../log.js';
import { normalizeCwd } from './rooms.js';
import {
  isResidentId,
  loadRoster,
  matchResident,
  parseRoster,
  residentAgentId,
  residentRoomId,
} from './residents.js';

const SHIPPED = new URL('../../../habblaud-mtc/roster.json', import.meta.url);
const shipped = () => JSON.parse(readFileSync(SHIPPED, 'utf8'));
const base = { name: 'A', role: 'R', look: 'f', type: 'subagent', agentTypes: [], aliases: [] };

beforeAll(() => setQuiet(true));

describe('residents', () => {
  it('parses shipped roster', () => {
    expect(parseRoster(shipped()).length).toBeGreaterThan(0);
  });
  it('rejects duplicate ids', () => {
    expect(() => parseRoster({ residents: [{ ...base, id: 'a' }, { ...base, id: 'a' }] })).toThrow(/id/);
  });
  it('rejects main without cwd', () => {
    expect(() => parseRoster({ residents: [{ ...base, id: 'a', type: 'main' }] })).toThrow(/cwd/);
  });
  it('rejects empty name', () => {
    expect(() => parseRoster({ residents: [{ ...base, id: 'a', name: '' }] })).toThrow(/name/);
  });
  it('matches case-insensitively', () => {
    const roster = parseRoster(shipped());
    expect(matchResident(roster, 'Talend-Developer')?.name).toBe('Developer');
    expect(matchResident(roster, 'HIRAYA')?.id).toBe('hiraya');
    expect(matchResident(roster, 'Explore')).toBeUndefined();
  });
  it('matches aliases', () => {
    const roster = parseRoster({ residents: [{ ...base, id: 'a', aliases: ['Zed'] }] });
    expect(matchResident(roster, 'zed')?.id).toBe('a');
  });
  it('builds ids', () => {
    const roster = parseRoster(shipped());
    const hiraya = roster.find((d) => d.id === 'hiraya')!;
    const dev = roster.find((d) => d.id === 'talend-developer')!;
    expect(residentRoomId(hiraya)).toBe(normalizeCwd('C:/ClaudeCode_v2'));
    expect(residentRoomId(dev)).toBe('resident:talend-developer');
    expect(residentAgentId(dev)).toBe('resident:talend-developer');
    expect(isResidentId('resident:x')).toBe(true);
    expect(isResidentId('x')).toBe(false);
  });
  it('loadRoster never throws', () => {
    expect(loadRoster('nope.json')).toEqual([]);
  });
});
