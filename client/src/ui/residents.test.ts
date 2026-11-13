import { describe, expect, it } from 'vitest';
import type { AgentInfo, RoomInfo } from '../../../shared/types';
import { isResidentId } from '../../../shared/timeline';
import { composerMode } from './composer-model';
import { canEditCharacter } from './character-model';
import { roomPathLabel } from './format';
import { computeCounters, idleForMs, isTabPeer, roleBadgeText } from './model';
import { ptyControllable } from './ptyapi';
import { canRenameRoom } from './roomrename';
import { loadAccess } from '../net/access';
import type { UiContext } from './context';

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
    expect(canEditCharacter(r, { live: true, terminal: true, local: true, replaying: false, mock: false })).toBe(false);
    expect(composerMode(r, { enabled: true, local: true, replaying: false }).kind).toBe('off');
    const h = agent({ id: '.claude:42', roomId: 'v2', resident: true, canMessage: true });
    expect(ptyControllable(h)).toBe(true);
    expect(composerMode(h, { enabled: true, local: true, replaying: false })).toEqual({ kind: 'ready' });
  });

  it('the editor is never offered on a resident, not even the adopted Hiraya (real id)', () => {
    const gate = { live: true, terminal: true, local: true, replaying: false, mock: false };
    expect(canEditCharacter(agent({ id: '.claude:42', roomId: 'v2', resident: true }), gate)).toBe(false);
    expect(canEditCharacter(agent({ id: '.claude:42', roomId: 'v2' }), gate)).toBe(true);
  });

  it('resident rooms cannot be renamed', async () => {
    const ok = { ok: true, status: 200, json: async () => ({ remote: false, local: true, permissions: true, messages: true, terminal: true }) };
    await loadAccess((async () => ok) as unknown as typeof fetch);
    const ctx = { renameRoom: () => {}, store: { mock: false, replaying: false, snapshot: { meta: { terminal: true } } } } as unknown as UiContext;
    expect(canRenameRoom(ctx, '/p/real')).toBe(true);
    expect(canRenameRoom(ctx, 'resident:talend-qa')).toBe(false);
  });

  it('badge shows role for residents, Principal otherwise', () => {
    expect(roleBadgeText(res('dev', 'mtc'))).toBe('Developer');
    expect(roleBadgeText(agent({ id: 'x', roomId: 'r', resident: true, role: 'Lead' }))).toBe('Lead');
    expect(roleBadgeText(agent({ id: 'x', roomId: 'r' }))).toBe('Principal');
  });

  it('idle residents show idle time and a resting status', () => {
    expect(idleForMs(res('dev', 'mtc', { statusSince: 1000 }), 61_000)).toBe(60_000);
    expect(idleForMs(res('dev', 'mtc', { status: 'working', statusSince: 1000 }), 61_000)).toBe(0);
    expect(idleForMs(res('dev', 'mtc', { status: 'waiting', statusSince: 1000 }), 61_000)).toBe(0);
  });

  it('badge falls back to stock label when a resident role is empty', () => {
    expect(roleBadgeText(agent({ id: 'resident:x', roomId: 'r', resident: true, role: '' }))).toBe('Principal');
  });

  it('terminal tabs skip resident: agents, keep adopted Hiraya', () => {
    const peers = [res('dev', 'mtc'), res('qa', 'mtc'), agent({ id: '.claude:42', roomId: 'mtc', resident: true, role: 'Lead' })];
    expect(peers.filter((a) => isTabPeer(a, 'mtc')).map((a) => a.id)).toEqual(['.claude:42']);
  });
});

describe('roomPathLabel', () => {
  it('hides the internal id of resident rooms', () => {
    expect(roomPathLabel({ id: 'resident:talend-designer', path: 'resident:talend-designer' })).toBe('');
    expect(roomPathLabel({ id: 'x', path: 'resident:y' })).toBe('');
  });
  it('shows the short path for real rooms', () => {
    expect(roomPathLabel({ id: '/Users/ana/x', path: '/Users/ana/x' })).toBe('~/x');
    expect(roomPathLabel({ id: 'c:/p', path: 'C:/p' })).toBe('C:/p');
  });
});
