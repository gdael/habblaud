import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import type { Activity, PermissionRequestInfo } from '../../shared/types';
import { setQuiet } from '../log.js';
import { NameStore } from './names';
import { Office } from './office';
import { normalizeCwd } from './rooms.js';
import {
  isResidentId,
  loadRoster,
  matchResident,
  parseRoster,
  residentAgentId,
  residentRoomId,
  type ResidentDef,
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

// ---------------------------------------------------------------- overlay no Office

function makeOffice(opts: { roster?: ResidentDef[]; perms?: Map<string, PermissionRequestInfo>; names?: NameStore } = {}) {
  let clock = 1_000_000;
  const perms = opts.perms;
  const office = new Office({
    names: opts.names ?? new NameStore(null),
    version: 't',
    startedAt: clock,
    accounts: (s) => [{ id: 'acc', short: 'C', name: 'Conta C', color: '#f08a3c', configDir: '/x', sessions: s.get('acc') ?? 0, usageStatus: 'disabled' }],
    sources: () => [],
    accountName: () => 'Conta C',
    now: () => clock,
    ...(opts.roster ? { roster: opts.roster } : {}),
    ...(perms ? { permissions: () => perms } : {}),
  });
  return { office, advance: (ms: number) => (clock += ms), now: () => clock };
}

const act = (id: string, at: number): Activity => ({ id, at, kind: 'read', icon: '📖', text: 'Lendo x' });
const main = (id: string, cwd: string, at: number, sessionId = `s-${id}`) => ({
  id,
  account: 'acc',
  sessionId,
  cwd,
  role: 'Agente principal',
  startedAt: at,
  status: 'working' as const,
});
const sub = (id: string, parentId: string, role: string, at: number, title = `t-${id}`) => ({
  id,
  parentId,
  sessionId: 's-sub',
  role,
  title,
  background: false,
  startedAt: at,
});

describe('residents: overlay no Office', () => {
  const roster = () => parseRoster(shipped());
  const HIRAYA_ROOM = normalizeCwd('C:/ClaudeCode_v2');

  it('fresh office: 6 idle residents in 6 pinned rooms at slots 0..5', () => {
    const { office } = makeOffice({ roster: roster() });
    const snap = office.commit().snapshot;
    expect(snap.agents).toHaveLength(6);
    for (const a of snap.agents) {
      expect(a.resident).toBe(true);
      expect(a.kind).toBe('main');
      expect(a.status).toBe('idle');
    }
    expect(snap.rooms).toHaveLength(6);
    expect(snap.rooms.map((r) => r.slot)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(snap.rooms[0].id).toBe(HIRAYA_ROOM);
    expect(snap.agents.find((a) => a.name === 'Hiraya')!.roomId).toBe(HIRAYA_ROOM);
    expect(snap.rooms.map((r) => r.id).slice(1)).toEqual(roster().slice(1).map((d) => `resident:${d.id}`));
    expect(snap.accounts[0].sessions).toBe(0);
  });

  it('Hiraya adopts the real main in C:/ClaudeCode_v2; exactly one Hiraya across close and reopen', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    office.addActivity('acc:1', act('a1', now()), true);
    let snap = office.commit().snapshot;
    let hir = snap.agents.filter((a) => a.name === 'Hiraya');
    expect(hir).toHaveLength(1);
    expect(hir[0].resident).toBe(true);
    expect(hir[0].id).toBe('resident:hiraya');
    expect(hir[0].activity?.id).toBe('a1');
    expect(hir[0].status).toBe('working');
    expect(snap.agents.some((a) => a.id === 'acc:1')).toBe(false);
    expect(snap.agents).toHaveLength(6);
    expect(snap.accounts[0].sessions).toBe(1);
    expect(snap.rooms.filter((r) => r.id === HIRAYA_ROOM)).toHaveLength(1);

    office.closeMain('acc:1');
    advance(1_000);
    office.addMain(main('acc:2', 'c:\\ClaudeCode_v2', now()));
    snap = office.commit().snapshot;
    hir = snap.agents.filter((a) => a.name === 'Hiraya');
    expect(hir).toHaveLength(1);
    expect(hir[0].status).toBe('working');
    expect(snap.agents).toHaveLength(6);
    // Windows cwd with backslashes still lands in Hiraya's room, not a second one.
    expect(snap.rooms).toHaveLength(6);
    // A second live main in the same cwd stays a normal agent, in Hiraya's room.
    office.addMain(main('acc:3', 'C:\\ClaudeCode_v2', now()));
    snap = office.commit().snapshot;
    expect(snap.agents.filter((a) => a.name === 'Hiraya')).toHaveLength(1);
    const other = snap.agents.find((a) => a.id === 'acc:3')!;
    expect(other.resident).toBeUndefined();
    expect(other.roomId).toBe(HIRAYA_ROOM);
    expect(snap.rooms).toHaveLength(6);
    expect(snap.accounts[0].sessions).toBe(2);
  });

  it('a talend-developer sub drives the Developer resident; no visitor', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:dev', 'acc:1', 'talend-developer', now(), 'Build job'));
    office.addActivity('s:dev', act('d1', now()), true);
    office.applyTranscript('s:dev', { tasks: [{ id: '1', title: 'x', status: 'pending' }], stats: { toolCalls: 3, tokensIn: 1, tokensOut: 2, subagents: 0 } });
    const snap = office.commit().snapshot;
    expect(snap.agents.some((a) => a.id === 's:dev')).toBe(false);
    const dev = snap.agents.find((a) => a.id === 'resident:talend-developer')!;
    const real = office.get('s:dev')!;
    expect(dev.status).toBe('working');
    expect(dev.title).toBe('Build job');
    expect(dev.activity).toEqual(real.activity);
    expect(dev.recent).toEqual(real.recent);
    expect(dev.tasks).toEqual(real.tasks);
    expect(dev.stats).toEqual(real.stats);
    expect(dev.parentId).toBeUndefined();
    expect(dev.name).toBe('Developer');
    expect(dev.kind).toBe('main');
    expect(dev.roomId).toBe('resident:talend-developer');
    expect(snap.rooms.find((r) => r.id === 'resident:talend-developer')!.slot).toBe(2);
  });

  it('two concurrent runs: working until the last ends; shows the newest', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:a', 'acc:1', 'talend-developer', now(), 'run A'));
    office.addSub(sub('s:b', 'acc:1', 'Talend-Developer', now(), 'run B'));
    advance(1_000);
    office.addActivity('s:a', act('a1', now()), true);
    advance(1_000);
    office.addActivity('s:b', act('b1', now()), true);
    const dev = () => office.commit().snapshot.agents.find((a) => a.id === 'resident:talend-developer')!;
    expect(dev().title).toBe('run B');
    office.completeSub('s:b');
    const d1 = dev();
    expect(d1.status).toBe('working');
    expect(d1.title).toBe('run A');
    office.completeSub('s:a');
    const d2 = dev();
    expect(d2.status).toBe('idle');
    expect(d2.title).toBeUndefined();
    expect(office.commit().snapshot.agents.some((a) => a.id === 's:a' || a.id === 's:b')).toBe(false);
  });

  it('a pending permission on the sub makes the resident waiting', () => {
    const perms = new Map<string, PermissionRequestInfo>();
    const { office, now } = makeOffice({ roster: roster(), perms });
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:dev', 'acc:1', 'talend-developer', now()));
    perms.set('s:dev', { id: 'p1', tool: 'Bash', title: 'Bash(ls)', text: 'x', icon: '💻', createdAt: now(), expiresAt: now() + 60_000 });
    office.markDirty();
    const dev = office.commit().snapshot.agents.find((a) => a.id === 'resident:talend-developer')!;
    expect(dev.status).toBe('waiting');
    expect(dev.permission?.id).toBe('p1');
  });

  it('non-roster subs stay stock', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:x', 'acc:1', 'Explore', now()));
    const a = office.commit().snapshot.agents.find((x) => x.id === 's:x')!;
    expect(a).toBeDefined();
    expect(a.kind).toBe('sub');
    expect(a.parentId).toBe('acc:1');
    expect(a.resident).toBeUndefined();
  });

  it('real agents never get a resident name', () => {
    const names = new NameStore(null);
    const reserved = ['Hiraya', 'Designer', 'Developer', 'Reviewer', 'QA', 'Makisig'];
    reserved.forEach((n, i) => names.remember(`s${i}`, { name: n, look: 'f' }));
    const { office, now } = makeOffice({ roster: roster(), names });
    reserved.forEach((_, i) => office.addMain(main(`acc:${i}`, `/p/r${i}`, now(), `s${i}`)));
    office.addSub(sub('s:x', 'acc:0', 'Explore', now()));
    expect(office.list()).toHaveLength(7);
    for (const a of office.list()) expect(reserved).not.toContain(a.name);
  });

  it('detail of a resident: the active run history, or the idle template', () => {
    const { office, now } = makeOffice({ roster: roster() });
    const idle = office.detail('resident:talend-developer')!;
    expect(idle.agent.status).toBe('idle');
    expect(idle.agent.resident).toBe(true);
    expect(idle.history).toEqual([]);
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:dev', 'acc:1', 'talend-developer', now()));
    office.addActivity('s:dev', act('d1', now()), true);
    office.addActivity('s:dev', act('d2', now()), true);
    const d = office.detail('resident:talend-developer')!;
    expect(d.history.map((a) => a.id)).toEqual(['d1', 'd2']);
    expect(d.agent.id).toBe('resident:talend-developer');
    expect(d.agent.status).toBe('working');
    expect(office.detail('resident:nope')).toBeUndefined();
  });

  it('empty roster: snapshot identical to stock', () => {
    const run = (r?: ResidentDef[]) => {
      const { office, now } = makeOffice(r ? { roster: r } : {});
      office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
      office.addSub(sub('s:dev', 'acc:1', 'talend-developer', now()));
      return office.commit().snapshot;
    };
    expect(run([])).toEqual(run());
    expect(run([]).rooms).toHaveLength(1);
    expect(run([]).agents).toHaveLength(2);
  });
});
