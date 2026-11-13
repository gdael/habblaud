import { describe, expect, it } from 'vitest';
import type { AgentInfo, RoomInfo } from '../../../shared/types';
import { isResidentId } from '../../../shared/timeline';
import { composerMode } from './composer-model';
import { canEditCharacter } from './character-model';
import { computeCounters, idleForMs, roleBadgeText, statusLabel } from './model';
import { ptyControllable } from './ptyapi';

function agent(p: Partial<AgentInfo> & Pick<AgentInfo, 'id' | 'roomId'>): AgentInfo {
  return {
    kind: 'main', name: p.id, look: 'f', role: 'Agente principal', sessionId: `s-${p.id}`, account: '.claude', status: 'idle',
    recent: [], tasks: [], startedAt: 0, lastEventAt: 0, statusSince: 0, stats: { toolCalls: 0, tokensIn: 0, tokensOut: 0, subagents: 0 }, seed: 1, ...p,
  };
}
const room = (id: string, slot: number): RoomInfo => ({ id, name: id, path: `/p/${id}`, slot, seed: slot, createdAt: 0 });
const res = (id: string, roomId: string, over: Partial<AgentInfo> = {}) => agent({ id: `resident:${id}`, roomId, resident: true, role: 'Developer', canMessage: true, ...over });

describe('residents', () => {
  it('isResidentId keys on the prefix', () => {
    expect(isResidentId('resident:dev')).toBe(true);
    expect(isResidentId('acc:123')).toBe(false);
  });

  it('counters: idle residents count nothing, resident-only rooms are skipped', () => {
    const rooms = [room('real', 0), room('mtc', 1)];
    const agents = [agent({ id: 'a1', roomId: 'real', status: 'working' }), res('dev', 'mtc'), res('qa', 'mtc')];
    expect(computeCounters({ rooms, agents })).toMatchObject({ rooms: 1, agents: 1, working: 1, waiting: 0 });
  });

  it('counters: working/waiting resident counts and its room counts', () => {
    const rooms = [room('mtc', 1)];
    const w = computeCounters({ rooms, agents: [res('dev', 'mtc', { status: 'working' }), res('qa', 'mtc')] });
    expect(w).toMatchObject({ rooms: 1, agents: 1, working: 1 });
    const n = computeCounters({ rooms, agents: [res('dev', 'mtc', { status: 'waiting' })] });
    expect(n).toMatchObject({ rooms: 1, agents: 1, waiting: 1 });
  });

  it('counters: adopted Hiraya (real id) counts like a normal agent', () => {
    const rooms = [room('v2', 0)];
    const h = agent({ id: '.claude:42', roomId: 'v2', resident: true, name: 'Hiraya', role: 'Lead' });
    expect(computeCounters({ rooms, agents: [h] })).toMatchObject({ rooms: 1, agents: 1 });
  });

  it('no PTY, no editor, no messages for resident: ids; adopted Hiraya stays stock', () => {
    const r = res('dev', 'mtc');
    expect(ptyControllable(r)).toBe(false);
    expect(canEditCharacter(r, { live: true, terminal: false, local: true, replaying: false, mock: false })).toBe(false);
    expect(composerMode(r, { enabled: true, local: true, replaying: false }).kind).toBe('off');
    const h = agent({ id: '.claude:42', roomId: 'v2', resident: true, canMessage: true });
    expect(ptyControllable(h)).toBe(true);
    expect(composerMode(h, { enabled: true, local: true, replaying: false })).toEqual({ kind: 'ready' });
  });

  it('badge shows role for residents, Principal otherwise', () => {
    expect(roleBadgeText(res('dev', 'mtc'))).toBe('Developer');
    expect(roleBadgeText(agent({ id: 'x', roomId: 'r', resident: true, role: 'Lead' }))).toBe('Lead');
    expect(roleBadgeText(agent({ id: 'x', roomId: 'r' }))).toBe('Principal');
  });

  it('idle residents show idle time and a resting status', () => {
    expect(idleForMs(res('dev', 'mtc', { statusSince: 1000 }), 61_000)).toBe(60_000);
    expect(idleForMs(res('dev', 'mtc', { status: 'working', statusSince: 1000 }), 61_000)).toBe(0);
    expect(statusLabel('idle')).not.toMatch(/principal/i);
  });
});
