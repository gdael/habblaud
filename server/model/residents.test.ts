import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeAll, vi, afterEach } from 'vitest';
import type { Activity, PermissionRequestInfo } from '../../shared/types';
import { log, setQuiet } from '../log.js';
import { tempDir } from '../test/fixtures.js';
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
  it('rejects duplicate ids case-insensitively', () => {
    expect(() => parseRoster({ residents: [{ ...base, id: 'Hiraya' }, { ...base, id: 'hiraya' }] })).toThrow(/duplicate/);
  });
  it('returns trimmed strings', () => {
    const [d] = parseRoster({ residents: [{ ...base, id: ' a ', name: ' N ' }] });
    expect(d.id).toBe('a');
    expect(d.name).toBe('N');
    expect(matchResident([d], 'a')?.id).toBe('a');
  });
  it('shipped roster: 6 residents, Hiraya cwd is C:/ClaudeCode_v2', () => {
    const roster = parseRoster(shipped());
    expect(roster).toHaveLength(6);
    expect(roster.find((d) => d.id === 'hiraya')!.cwd).toBe('C:/ClaudeCode_v2');
  });
});

describe('loadRoster', () => {
  afterEach(() => vi.restoreAllMocks());
  const withFile = (content: string, fn: (file: string) => void) => {
    const t = tempDir();
    try {
      const file = join(t.dir, 'roster.json');
      writeFileSync(file, content);
      fn(file);
    } finally {
      t.cleanup();
    }
  };
  it('missing file: [] and exactly one warning', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    expect(loadRoster('nope.json')).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('invalid JSON: [] and one warning', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    withFile('{ not json', (f) => expect(loadRoster(f)).toEqual([]));
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('invalid schema: [] and one warning', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    withFile(JSON.stringify({ residents: [{ id: 'a' }] }), (f) => expect(loadRoster(f)).toEqual([]));
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------- overlay no Office

function makeOffice(opts: { roster?: ResidentDef[]; perms?: Map<string, PermissionRequestInfo>; names?: NameStore; reach?: Set<string> } = {}) {
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
    ...(opts.reach ? { messages: () => opts.reach! } : {}),
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

describe('residents: room variant', () => {
  it('parseRoster accepts a valid room', () => {
    const [d] = parseRoster({ residents: [{ ...base, id: 'a', room: 'studio' }] });
    expect(d.room).toBe('studio');
  });
  it('parseRoster rejects an unknown room naming the field', () => {
    expect(() => parseRoster({ residents: [{ ...base, id: 'a', room: 'nope' }] })).toThrow(/residents\[0\]\.room/);
  });
  it('shipped roster maps the six residents to their variants', () => {
    const m = Object.fromEntries(parseRoster(shipped()).map((d) => [d.id, d.room]));
    expect(m).toEqual({
      hiraya: 'lead',
      'talend-designer': 'studio',
      'talend-developer': 'devbay',
      'talend-reviewer': 'review',
      'talend-qa': 'testlab',
      makisig: 'server',
    });
  });
  it('snapshot rooms carry the variant, Hiraya folded room included', () => {
    const { office } = makeOffice({ roster: parseRoster(shipped()) });
    const rooms = office.commit().snapshot.rooms;
    expect(rooms.find((r) => r.id === 'resident:talend-designer')!.variant).toBe('studio');
    expect(rooms.find((r) => r.id === normalizeCwd('C:/ClaudeCode_v2'))!.variant).toBe('lead');
  });
  it('a real agent in Hiraya cwd written another way still gives one lead room', () => {
    const { office, now } = makeOffice({ roster: parseRoster(shipped()) });
    office.addMain(main('acc:1', 'C:\\claudecode_v2', now()));
    const rooms = office.commit().snapshot.rooms.filter((r) => r.variant === 'lead');
    expect(rooms).toHaveLength(1);
  });
  it('an empty roster gives no variant anywhere', () => {
    const { office } = makeOffice({ roster: [] });
    expect(office.commit().snapshot.rooms.every((r) => r.variant === undefined)).toBe(true);
  });
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

  it('placeholder Hiraya has the resident id', () => {
    const { office } = makeOffice({ roster: roster() });
    const hir = office.commit().snapshot.agents.find((a) => a.name === 'Hiraya')!;
    expect(hir.id).toBe('resident:hiraya');
    expect(hir.status).toBe('idle');
  });

  it('Hiraya adopts the real main (room id exactly C:/ClaudeCode_v2): real id and canMessage kept', () => {
    const reach = new Set(['acc:1']);
    const { office, now } = makeOffice({ roster: roster(), reach });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    office.addActivity('acc:1', act('a1', now()), true);
    office.addSub(sub('s:x', 'acc:1', 'Explore', now()));
    const r = office.commit();
    const snap = r.snapshot;
    const hir = snap.agents.filter((a) => a.name === 'Hiraya');
    expect(hir).toHaveLength(1);
    expect(hir[0].id).toBe('acc:1');
    expect(hir[0].resident).toBe(true);
    expect(hir[0].canMessage).toBe(true);
    expect(hir[0].activity?.id).toBe('a1');
    expect(hir[0].status).toBe('working');
    expect(hir[0].roomId).toBe(HIRAYA_ROOM);
    expect(snap.agents.some((a) => a.id === 'resident:hiraya')).toBe(false);
    // Children of the adopted session keep pointing at its real id.
    expect(snap.agents.find((a) => a.id === 's:x')!.parentId).toBe('acc:1');
    expect(snap.agents).toHaveLength(7);
    expect(snap.accounts[0].sessions).toBe(1);
    expect(snap.rooms).toHaveLength(6);
    expect(snap.rooms.find((x) => x.id === HIRAYA_ROOM)!.name).toBe('ClaudeCode_v2');
    // Pinned room: no "new room" notice.
    expect(r.notices.some((n) => n.text.includes('🏗️'))).toBe(false);
    // detail(real id) gives the resident view and the real history.
    const d = office.detail('acc:1')!;
    expect(d.agent.name).toBe('Hiraya');
    expect(d.agent.resident).toBe(true);
    expect(d.history.map((a) => a.id)).toEqual(['a1']);
    expect(office.roomPath(HIRAYA_ROOM)).toBe('C:/ClaudeCode_v2');
  });

  it('exactly one Hiraya across close and reopen, backslash and mixed-case cwds', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:\\ClaudeCode_v2', now()));
    let snap = office.commit().snapshot;
    expect(snap.agents.filter((a) => a.name === 'Hiraya').map((a) => a.id)).toEqual(['acc:1']);
    expect(snap.rooms).toHaveLength(6);

    office.closeMain('acc:1');
    advance(1_000);
    office.addMain(main('acc:2', 'c:\\claudecode_V2', now()));
    snap = office.commit().snapshot;
    const hir = snap.agents.filter((a) => a.name === 'Hiraya');
    expect(hir.map((a) => a.id)).toEqual(['acc:2']);
    expect(hir[0].status).toBe('working');
    // the closed adoptee is not shown as a second character
    expect(snap.agents.some((a) => a.id === 'acc:1')).toBe(false);
    expect(snap.agents).toHaveLength(6);
    // Mixed-case Windows cwd still lands in Hiraya's room, not a second one.
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
    // detail() of a non-resident main stays stock
    expect(office.detail('acc:3')!.agent.resident).toBeUndefined();
  });

  it('children of an absorbed pod sub hang off the resident', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:dev', 'acc:1', 'talend-developer', now()));
    office.addSub(sub('s:kid', 's:dev', 'Explore', now()));
    const snap = office.commit().snapshot;
    expect(snap.agents.find((a) => a.id === 's:kid')!.parentId).toBe('resident:talend-developer');
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

  it('adopted Hiraya drops parts and custom (look is fixed)', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    const rec = office.get('acc:1')!;
    rec.custom = true;
    rec.parts = { hair: 1 } as never;
    const hir = office.commit().snapshot.agents.find((a) => a.id === 'acc:1')!;
    expect(hir.resident).toBe(true);
    expect(hir.parts).toBeUndefined();
    expect(hir.custom).toBeUndefined();
  });

  it('subs of a hidden closed adoptee follow the current adopted view, or the placeholder', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    office.commit();
    office.addSub(sub('s:old', 'acc:1', 'Explore', now()));
    office.closeMain('acc:1');
    // closed, nobody else: sub hangs off the placeholder
    let snap = office.commit().snapshot;
    expect(snap.agents.find((a) => a.id === 's:old')!.parentId).toBe('resident:hiraya');
    advance(1_000);
    office.addMain(main('acc:2', 'C:/ClaudeCode_v2', now()));
    snap = office.commit().snapshot;
    expect(snap.agents.find((a) => a.id === 's:old')!.parentId).toBe('acc:2');
  });

  it('folded room lookups for backslash cwd', () => {
    const reach = new Set<string>();
    const aliases: string[] = [];
    let clock = 1_000_000;
    const office = new Office({
      names: new NameStore(null),
      version: 't',
      startedAt: clock,
      accounts: (s) => [{ id: 'acc', short: 'C', name: 'C', color: '#fff', configDir: '/x', sessions: s.get('acc') ?? 0, usageStatus: 'disabled' }],
      sources: () => [],
      accountName: () => 'C',
      now: () => clock,
      roster: roster(),
      messages: () => reach,
      roomAlias: (p) => {
        aliases.push(p);
        return p.toLowerCase().includes('claudecode_v2') ? 'Casa' : undefined;
      },
    });
    office.addMain(main('acc:1', 'C:\\ClaudeCode_v2', clock));
    const r = office.commit();
    expect(office.roomPath(HIRAYA_ROOM)).toBe('C:\\ClaudeCode_v2');
    expect(r.snapshot.rooms.find((x) => x.id === HIRAYA_ROOM)!.name).toBe('Casa');
    expect(r.notices.some((n) => n.text.includes('Nova sala'))).toBe(false);
  });

  it('GitHub effect recorded under the backslash cwd room shows on Hiraya room', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:\\ClaudeCode_v2', now()));
    office.githubEvent('acc:1', { kind: 'ci_failed', repo: 'o/r', branch: 'main' }, { key: 'k1', at: now() });
    const room = office.commit().snapshot.rooms.find((x) => x.id === HIRAYA_ROOM)!;
    expect(room.effect).toBeDefined();
  });

  it('feed and notices of a mirrored pod run name the resident; the clicked id is in the snapshot', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', '/p/other', now()));
    office.commit();
    office.addSub(sub('s:qa', 'acc:1', 'talend-qa', now(), 'Run QA'));
    office.addActivity('s:qa', act('q1', now()), true);
    let r = office.commit();
    const item = r.feed.find((f) => f.id === 'q1')!;
    expect(item.agentName).toBe('QA');
    expect(item.agentId).toBe('resident:talend-qa');
    expect(item.roomId).toBe('resident:talend-qa');
    expect(item.roomName).toBe('QA');
    expect(r.snapshot.agents.some((a) => a.id === item.agentId)).toBe(true);
    expect(r.snapshot.rooms.some((x) => x.id === item.roomId)).toBe(true);
    office.completeSub('s:qa');
    r = office.commit();
    const deliver = r.notices.find((n) => n.text.includes('📦'))!;
    expect(deliver.text).toContain('QA');
    expect(deliver.text).not.toContain(office.get('s:qa')!.name);
    expect(deliver.agentId).toBe('resident:talend-qa');
    expect(deliver.roomId).toBe('resident:talend-qa');
  });

  it('feed and notices of the adopted Hiraya name Hiraya and keep its real id', () => {
    const { office, now } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:\\ClaudeCode_v2', now()));
    office.commit();
    const realName = office.get('acc:1')!.name;
    office.addActivity('acc:1', act('h1', now()), true);
    office.setStatus('acc:1', 'waiting', 'ok?');
    let r = office.commit();
    const item = r.feed.find((f) => f.id === 'h1')!;
    expect(item.agentName).toBe('Hiraya');
    expect(item.agentId).toBe('acc:1');
    expect(item.roomId).toBe(HIRAYA_ROOM);
    const wait = r.notices.find((n) => n.text.includes('✋'))!;
    expect(wait.text).toContain('Hiraya');
    expect(wait.text).not.toContain(realName);
    expect(wait.roomId).toBe(HIRAYA_ROOM);
    office.closeMain('acc:1');
    r = office.commit();
    const leave = r.notices.find((n) => n.text.includes('🚪'))!;
    expect(leave.text).toContain('Hiraya');
    expect(leave.agentId).toBe('resident:hiraya');
    expect(r.snapshot.agents.some((a) => a.id === leave.agentId)).toBe(true);
  });

  it('Hiraya adopts the live main with the newest activity, not the earliest started', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    advance(1_000);
    office.addMain(main('acc:2', 'C:/ClaudeCode_v2', now()));
    advance(1_000);
    office.addActivity('acc:2', act('b1', now()), true);
    const snap = office.commit().snapshot;
    expect(snap.agents.filter((a) => a.name === 'Hiraya').map((a) => a.id)).toEqual(['acc:2']);
    expect(snap.agents.find((a) => a.id === 'acc:1')!.resident).toBeUndefined();
  });

  it('adoption is sticky while the adoptee works; switches when it idles and another main works', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    const hir = () => office.commit().snapshot.agents.filter((a) => a.name === 'Hiraya').map((a) => a.id);
    expect(hir()).toEqual(['acc:1']);
    advance(1_000);
    office.addMain(main('acc:2', 'C:/ClaudeCode_v2', now()));
    office.addActivity('acc:2', act('b1', now()), true);
    // acc:1 still working: stays Hiraya even though acc:2 is newer.
    expect(hir()).toEqual(['acc:1']);
    // acc:1 idles while acc:2 works: Hiraya moves to acc:2.
    office.setStatus('acc:1', 'idle');
    expect(hir()).toEqual(['acc:2']);
    // both idle, acc:1 newer: still sticky to acc:2.
    office.setStatus('acc:2', 'idle');
    advance(1_000);
    office.addActivity('acc:1', act('a9', now()), true);
    expect(hir()).toEqual(['acc:2']);
  });

  it('a past adoptee closing keeps its own name in the notice (not Hiraya, not linked to the new adoptee)', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    office.addMain(main('acc:1', 'C:/ClaudeCode_v2', now()));
    office.commit();
    advance(1_000);
    office.addMain(main('acc:2', 'C:/ClaudeCode_v2', now()));
    office.setStatus('acc:1', 'idle');
    expect(office.commit().snapshot.agents.filter((a) => a.name === 'Hiraya').map((a) => a.id)).toEqual(['acc:2']);
    const realName = office.get('acc:1')!.name;
    office.closeMain('acc:1');
    const leave = office.commit().notices.find((n) => n.text.includes('🚪'))!;
    expect(leave.text).toContain(realName);
    expect(leave.text).not.toContain('Hiraya');
    expect(leave.agentId).toBe('acc:1');
  });

  it('idle resident shows idle since its last mirrored run, not since server start', () => {
    const { office, now, advance } = makeOffice({ roster: roster() });
    const start = now();
    const qa = () => office.commit().snapshot.agents.find((a) => a.id === 'resident:talend-qa')!;
    expect(qa().statusSince).toBe(start);
    advance(60_000);
    office.addMain(main('acc:1', '/p/other', now()));
    office.addSub(sub('s:qa', 'acc:1', 'talend-qa', now()));
    expect(qa().status).toBe('working');
    const ranAt = now();
    advance(5_000);
    office.completeSub('s:qa');
    const idle = qa();
    expect(idle.status).toBe('idle');
    expect(idle.statusSince).toBe(ranAt);
    expect(idle.statusSince).toBeGreaterThan(start);
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
