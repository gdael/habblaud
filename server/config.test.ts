import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadConfig } from './config';
import { setQuiet } from './log.js';
import { loadRoster } from './model/residents.js';

beforeAll(() => setQuiet(true));

describe('config rosterPath', () => {
  it('takes rosterPath from HABBLAUD_ROSTER', () => {
    const cfg = loadConfig({ ...process.env, HABBLAUD_ROSTER: 'some/roster.json' }, []);
    expect(cfg.rosterPath).toBe(resolve('some/roster.json'));
  });
  it('defaults to ../habblaud-mtc/roster.json from the project root', () => {
    const env = { ...process.env };
    delete env.HABBLAUD_ROSTER;
    const cfg = loadConfig(env, []);
    expect(cfg.rosterPath).toBe(resolve(cfg.rootDir, '..', 'habblaud-mtc', 'roster.json'));
  });
  it('invalid roster path yields an empty roster without throwing', () => {
    const cfg = loadConfig({ ...process.env, HABBLAUD_ROSTER: 'nope/does-not-exist.json' }, []);
    expect(loadRoster(cfg.rosterPath)).toEqual([]);
  });
});
