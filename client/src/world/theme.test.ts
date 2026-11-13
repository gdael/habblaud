import { describe, expect, it } from 'vitest';
import { seasonalThemeFor } from './api';
import { SERVER_THEME, THEME_COUNT, roomTheme } from '../art/theme';

describe('tema do escritório', () => {
  const at = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour);

  it('automático segue o calendário (hora local)', () => {
    expect(seasonalThemeFor('auto', at(9, 30, 23))).toBe('none');
    expect(seasonalThemeFor('auto', at(10, 1, 0))).toBe('halloween');
    expect(seasonalThemeFor('auto', at(10, 31, 23))).toBe('halloween');
    expect(seasonalThemeFor('auto', at(11, 1, 0))).toBe('christmas');
    expect(seasonalThemeFor('auto', at(12, 26, 23))).toBe('christmas');
    expect(seasonalThemeFor('auto', at(12, 27, 0))).toBe('none');
    expect(seasonalThemeFor('auto', at(1, 1))).toBe('none');
    expect(seasonalThemeFor('auto', at(7, 15))).toBe('none');
    // Sem preferência (opções antigas do mundo) vale o automático.
    expect(seasonalThemeFor(undefined, at(10, 13))).toBe('halloween');
  });

  it('escolha fixa vale o ano todo', () => {
    for (const date of [at(1, 1), at(10, 13), at(12, 1)]) {
      expect(seasonalThemeFor('none', date)).toBe('none');
      expect(seasonalThemeFor('christmas', date)).toBe('christmas');
      expect(seasonalThemeFor('halloween', date)).toBe('halloween');
    }
  });
});

// Paleta MTC (skill mtc-presentation-theme, SKILL.md "Palette"): verde da marca #35A83F, verde suave #4E8E5C e
// branco #FFFFFF são os únicos destaques de sala; paredes e carpetes ficam na família azul-marinho/verde.
const MTC_ACCENTS = ['#35a83f', '#4e8e5c', '#ffffff'] as const;
const MTC_GREEN = '#35a83f';

function rgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

/** Azul-marinho escuro: azul domina e o tom é escuro (luminância relativa baixa). */
function isDarkNavy(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return b > r + 20 && b > g + 10 && lum < 0.25;
}

describe('tema MTC das salas', () => {
  it('toda sala usa um destaque do conjunto MTC', () => {
    for (let i = 0; i < THEME_COUNT; i++) {
      expect(MTC_ACCENTS).toContain(roomTheme(i).accent.toLowerCase());
    }
    expect(MTC_ACCENTS).toContain(SERVER_THEME.accent.toLowerCase());
  });

  it('sementes vizinhas recebem temas diferentes (inclusive na volta da lista)', () => {
    for (let i = 0; i < THEME_COUNT; i++) {
      const a = roomTheme(i);
      const b = roomTheme(i + 1);
      expect(a).not.toEqual(b);
      expect(a.accent).not.toBe(b.accent);
      expect(a.carpet).not.toBe(b.carpet);
    }
  });

  it('sala do servidor (Makisig) é azul-marinho escuro com destaque verde', () => {
    expect(isDarkNavy(SERVER_THEME.wall.base)).toBe(true);
    expect(isDarkNavy(SERVER_THEME.carpet)).toBe(true);
    expect(isDarkNavy(SERVER_THEME.carpet2)).toBe(true);
    expect(SERVER_THEME.accent.toLowerCase()).toBe(MTC_GREEN);
  });
});
