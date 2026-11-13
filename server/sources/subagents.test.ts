import { describe, expect, it } from 'vitest';
import { IDLE_TIMEOUT_MS, RESUME_MIN_GROWTH_BYTES, RESUME_SETTLE_MS, resumedAfterFinish } from './subagents';

describe('resumedAfterFinish', () => {
  const mark = { size: 10_000, mtimeMs: 1_000_000 };
  const later = mark.mtimeMs + RESUME_SETTLE_MS + 5_000;
  const grown = mark.size + RESUME_MIN_GROWTH_BYTES;

  it('no growth: not resumed', () => {
    expect(resumedAfterFinish(mark, { size: mark.size, mtimeMs: later }, later)).toBe(false);
  });

  it('growth below the margin: not resumed', () => {
    expect(resumedAfterFinish(mark, { size: grown - 1, mtimeMs: later }, later)).toBe(false);
  });

  it('growth written right around the finish (inside the settle window): not resumed', () => {
    const mtimeMs = mark.mtimeMs + RESUME_SETTLE_MS - 1;
    expect(resumedAfterFinish(mark, { size: grown + 5_000, mtimeMs }, mtimeMs + 1_000)).toBe(false);
  });

  it('growth written long ago (older than the idle timeout): not resumed', () => {
    expect(resumedAfterFinish(mark, { size: grown, mtimeMs: later }, later + IDLE_TIMEOUT_MS)).toBe(false);
  });

  it('stopped after a long quiet command: a late write right after the observed finish is not a resume', () => {
    // Last write 60 s before the stop; the stop is observed at `stopAt`; the interrupted result lands 1 s later.
    const stopAt = mark.mtimeMs + 60_000;
    const m = { ...mark, finishedAt: stopAt };
    expect(resumedAfterFinish(m, { size: grown + 2_000, mtimeMs: stopAt + 1_000 }, stopAt + 2_000)).toBe(false);
    expect(resumedAfterFinish(m, { size: grown, mtimeMs: stopAt + RESUME_SETTLE_MS }, stopAt + RESUME_SETTLE_MS)).toBe(true);
  });

  it('growth past the margin, after the settle window and recent: resumed', () => {
    expect(resumedAfterFinish(mark, { size: grown, mtimeMs: later }, later + 1_000)).toBe(true);
  });
});
