// Temas de sala (puros): paleta MTC (skill mtc-presentation-theme). Paredes e carpetes são tons do azul-marinho
// #0A1F54 / painel #1E2C5D / verde #35A83F / verde suave #4E8E5C / slate #5B6173 misturados com branco, e as
// paredes ficam no branco/mist da marca (#FFFFFF, #F5F6FC, #E3E6F2). Destaques só verde, verde suave ou branco.
// Sementes consecutivas (slots vizinhos) recebem temas diferentes; a ordem alterna famílias de propósito.
import type { RoomTheme } from './api';

const THEMES: readonly RoomTheme[] = [
  { carpet: '#b6bccc', carpet2: '#acb3c5', wall: { base: '#f5f6fc', trim: '#6c7998', pattern: 'plain' }, accent: '#35a83f', deskVariant: 'white', chairVariant: 'blue' },
  { carpet: '#c2e5c5', carpet2: '#bae1be', wall: { base: '#ffffff', trim: '#90cf95', pattern: 'stripes' }, accent: '#ffffff', deskVariant: 'wood', chairVariant: 'black' },
  { carpet: '#c9ced9', carpet2: '#bfc5d3', wall: { base: '#e6f0ed', trim: '#95bb9d', pattern: 'wood_panel' }, accent: '#4e8e5c', deskVariant: 'wood', chairVariant: 'green' },
  { carpet: '#d1d3d8', carpet2: '#cbccd2', wall: { base: '#e3e6f2', trim: '#6c7998', pattern: 'plain' }, accent: '#ffffff', deskVariant: 'white', chairVariant: 'gray' },
  { carpet: '#bcc0ce', carpet2: '#c7cad6', wall: { base: '#f5f6fc', trim: '#35a83f', pattern: 'stripes' }, accent: '#35a83f', deskVariant: 'dark', chairVariant: 'blue' },
  { carpet: '#cddfd1', carpet2: '#c6dbcb', wall: { base: '#ffffff', trim: '#9da0ab', pattern: 'plain' }, accent: '#4e8e5c', deskVariant: 'white', chairVariant: 'green' },
  { carpet: '#acb3c5', carpet2: '#b6bccc', wall: { base: '#e7e9f2', trim: '#0a1f54', pattern: 'brick' }, accent: '#ffffff', deskVariant: 'dark', chairVariant: 'black' },
  { carpet: '#bae1be', carpet2: '#c2e5c5', wall: { base: '#f5f6fc', trim: '#4e8e5c', pattern: 'wood_panel' }, accent: '#35a83f', deskVariant: 'wood', chairVariant: 'gray' },
  { carpet: '#bfc5d3', carpet2: '#c9ced9', wall: { base: '#e4ecec', trim: '#6c7998', pattern: 'stripes' }, accent: '#ffffff', deskVariant: 'white', chairVariant: 'blue' },
  { carpet: '#cbccd2', carpet2: '#d1d3d8', wall: { base: '#ffffff', trim: '#1e2c5d', pattern: 'wood_panel' }, accent: '#4e8e5c', deskVariant: 'dark', chairVariant: 'black' },
];

/** Tema fixo da sala Servidor/Rede (Makisig): carpete e parede azul-marinho escuro MTC, destaque verde da marca. */
export const SERVER_THEME: RoomTheme = {
  carpet: '#1e2c5d', carpet2: '#22306b', wall: { base: '#041d56', trim: '#35a83f', pattern: 'plain' }, accent: '#35a83f', deskVariant: 'dark', chairVariant: 'black',
};

export const THEME_COUNT = THEMES.length;

export function roomTheme(seed: number): RoomTheme {
  const n = THEMES.length;
  const t = THEMES[((Math.floor(seed) % n) + n) % n];
  return { ...t, wall: { ...t.wall } };
}
