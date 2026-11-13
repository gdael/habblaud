// Móveis das salas de projeto: mesas (frente e traseira), cadeiras, estantes, arquivo, impressora,
// lixeira, plantas, divisórias de vidro, mesa de reunião, banqueta, luminária e bebedouro.
// Coordenadas de desenho = footprint (0,0 no canto superior esquerdo; base em y = h*TILE).
import { mix, ramp, shade, type Ramp } from '../core/color';
import { floorSheet, rectAt, wallSheet, type BufFurniture, type BufSprite } from '../core/sprite';
import type { PixelBuf } from '../core/pixbuf';
import {
  ACCENTS, M, bigLeaf, book, contact, foliage, frontFace, keyboard, leafBlade, monitorBack, monitorFront, mouse, mug,
  papers, pencilCup, photoFrame, pick, pot, rngOf, smallSucculent, staticScreen, topFace, underRect, woodGrain,
  type DeskItemTone,
} from './kit';

type Box = { x: number; y: number; w: number; h: number };

// ------------------------------------------------------------------ mesas

interface DeskMats {
  top: Ramp;
  edge: Ramp;
  legs: Ramp;
  ped: Ramp;
}

function deskMats(variant: string | undefined): DeskMats {
  switch (variant) {
    case 'white':
      return { top: M.white, edge: ramp('#d7d6d1', 0.05), legs: M.steel, ped: ramp('#dcdbd6', 0.05) };
    case 'dark':
      return { top: M.walnut, edge: ramp('#5f4535', 0.06), legs: M.graphite, ped: ramp('#5a4334', 0.06) };
    default:
      return { top: M.oak, edge: M.oakDark, legs: ramp('#e9e8e4', 0.05), ped: ramp('#e6e4de', 0.05) };
  }
}

const MUG_COLORS = ['#e2604f', '#3f7fd8', '#f2c14e', '#4cae6a', '#f4f2ee', '#8d66cf'] as const;

/** Sombra de contato da mesa e sombra do vão sob o tampo (compostas por baixo, após o contorno). */
function deskShadow(b: PixelBuf): void {
  underRect(b, 3, 8, 26, 7, 'rgba(30,34,52,0.2)');
  contact(b, -1, 13, 34, 4, 0.2);
}

/** Tampo + bordas + pernas + gaveteiro (comum a desk e desk_back). */
function deskBody(s: BufSprite, m: DeskMats, seed: number, back: boolean): void {
  const b = s.buf;
  if (back) {
    // Painel frontal (lado de quem olha) cobrindo o vão.
    frontFace(b, 1, 8, 30, 6, m.ped);
    b.hline(1, 30, 8, m.ped.dk);
    b.hline(2, 29, 11, m.ped.lt);
  }
  // Pernas (laterais) com brilho.
  for (const x of [0, 29]) {
    b.rect(x, 8, 3, 8, m.legs.base);
    b.vline(x, 8, 15, m.legs.lt);
    b.vline(x + 2, 8, 15, m.legs.dk);
    b.hline(x, x + 2, 15, m.legs.dd);
  }
  if (!back) {
    // Gaveteiro sob o lado direito.
    frontFace(b, 19, 8, 10, 8, m.ped);
    b.hline(19, 28, 11, m.ped.dk);
    b.hline(19, 28, 12, m.ped.lt);
    b.hline(22, 25, 9, m.ped.dd);
    b.hline(22, 25, 13, m.ped.dd);
  }
  // Tampo (12 linhas) + espessura da borda (2 linhas).
  topFace(b, 0, -6, 32, 12, m.top);
  woodGrain(b, 1, -5, 30, 10, m.top, seed);
  b.hline(0, 31, 6, m.edge.base);
  b.hline(0, 31, 7, m.edge.dk);
  b.set(0, 6, m.edge.lt);
}

/** Objetos sobre a mesa (variações por semente). Retorna o retângulo da tela principal e o da secundária. */
function deskTop(s: BufSprite, seed: number, tone: DeskItemTone): { screen: Box; screen2?: Box } {
  const b = s.buf;
  const r = rngOf(seed, 11);
  const v = seed % 6;
  const mugC = pick(r, MUG_COLORS);
  let screen: Box;
  let screen2: Box | undefined;
  switch (v) {
    case 1: {
      screen = monitorFront(b, 2, -17, 16, 11);
      screen2 = monitorFront(b, 18, -16, 13, 10);
      staticScreen(b, screen2, 'sheet', seed);
      keyboard(b, 6, -1, 11, tone);
      mouse(b, 20, 0, tone);
      mug(b, 26, -2, mugC);
      break;
    }
    case 2: {
      screen = monitorFront(b, 5, -17, 16, 11);
      // Notebook aberto à direita (tela ligada com conteúdo fixo).
      b.rect(22, -9, 9, 6, '#3a404d');
      b.hline(22, 30, -9, '#4d5464');
      screen2 = { x: 23, y: -8, w: 7, h: 4 };
      staticScreen(b, screen2, 'ide', seed);
      b.rect(21, -3, 11, 2, '#c9ced6');
      b.hline(21, 31, -2, '#9aa1ad');
      b.hline(22, 31, -1, tone === 'onLight' ? 'rgba(40,46,70,0.3)' : 'rgba(60,40,40,0.2)');
      keyboard(b, 8, -1, 10, tone);
      smallSucculent(b, 1, -3);
      break;
    }
    case 3: {
      screen = monitorFront(b, 8, -17, 16, 11);
      b.rect(22, -15, 2, 2, '#f7d154');
      b.rect(9, -15, 2, 2, '#ff9fb2');
      keyboard(b, 11, -1, 10, tone);
      mouse(b, 23, 0, tone);
      photoFrame(b, 2, -5);
      papers(b, 24, -4, 6, 4, tone);
      mug(b, 3, 0, mugC);
      break;
    }
    case 4: {
      screen = monitorFront(b, 4, -17, 15, 11);
      screen2 = monitorFront(b, 19, -17, 12, 10);
      staticScreen(b, screen2, 'chart', seed);
      keyboard(b, 7, -1, 11, tone);
      mouse(b, 21, 0, tone);
      papers(b, 1, -2, 5, 4, tone);
      break;
    }
    case 5: {
      screen = monitorFront(b, 8, -17, 16, 11);
      keyboard(b, 11, -1, 10, tone);
      mouse(b, 23, 0, tone);
      // Fone de ouvido sobre a mesa.
      b.hline(2, 6, -4, '#3a3f4b');
      b.set(1, -3, '#3a3f4b');
      b.set(7, -3, '#3a3f4b');
      b.rect(1, -2, 2, 2, '#e2604f');
      b.rect(6, -2, 2, 2, '#e2604f');
      mug(b, 26, -3, mugC);
      pencilCup(b, 28, 2);
      break;
    }
    default: {
      screen = monitorFront(b, 8, -17, 16, 11);
      keyboard(b, 11, -1, 10, tone);
      mouse(b, 23, 0, tone);
      mug(b, 3, -2, mugC);
      papers(b, 25, -4, 6, 4, tone);
      smallSucculent(b, 26, 2);
      break;
    }
  }
  return { screen, screen2 };
}

/** Tom dos objetos conforme o tampo: no branco, um degrau mais escuros e com sombra firme. */
function itemTone(variant: string | undefined): DeskItemTone {
  return variant === 'white' ? 'onLight' : 'light';
}

export function desk(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(2, 1, 20);
  const m = deskMats(variant);
  deskBody(s, m, seed, false);
  const scr = deskTop(s, seed, itemTone(variant));
  s.buf.outline();
  deskShadow(s.buf);
  s.rects = { screen: rectAt(s, scr.screen.x, scr.screen.y, scr.screen.w, scr.screen.h) };
  if (scr.screen2) s.rects.screen2 = rectAt(s, scr.screen2.x, scr.screen2.y, scr.screen2.w, scr.screen2.h);
  return { base: s };
}

export function deskBack(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(2, 1, 12);
  const m = deskMats(variant);
  const b = s.buf;
  deskBody(s, m, seed, true);
  const r = rngOf(seed, 12);
  const v = seed % 4;
  const mugC = pick(r, MUG_COLORS);
  const tone = itemTone(variant);
  // Verso em plástico claro; na mesa escura (nogueira), cinza médio para não brilhar demais.
  const plastic = variant === 'dark' ? 'mid' : 'light';
  if (v === 1) {
    monitorBack(b, 2, -7, 15, 10, plastic);
    monitorBack(b, 17, -6, 13, 9, plastic);
  } else {
    monitorBack(b, 8, -7, 16, 10, plastic);
    if (v === 2) smallSucculent(b, 26, 0);
    else papers(b, 25, -1, 6, 4, tone);
    if (v === 3) photoFrame(b, 2, -3);
    else mug(b, 2, 0, mugC);
  }
  b.outline();
  deskShadow(b);
  return { base: s };
}

// ------------------------------------------------------------------ cadeiras

const CHAIR_COLORS: Readonly<Record<string, string>> = {
  black: '#41465a',
  blue: '#3f62a3',
  red: '#b44a4a',
  green: '#3f8a62',
  gray: '#8b929e',
};

function chairRamp(variant: string | undefined): Ramp {
  return ramp(CHAIR_COLORS[variant ?? 'black'] ?? CHAIR_COLORS.black, 0.07);
}

/** Base estrela com rodízios + pistão. */
function starBase(b: BufSprite['buf']): void {
  const metal = '#565d6b';
  const caster = '#23262e';
  b.hline(3, 12, 13, metal);
  b.hline(5, 10, 14, metal);
  b.set(3, 13, '#6c7382');
  for (const [x, y] of [[2, 14], [13, 14], [4, 15], [11, 15]] as const) {
    b.set(x, y, caster);
    b.set(x + (x < 8 ? 1 : -1), y, caster);
  }
  b.rect(7, 9, 2, 4, '#a3aab6');
  b.vline(8, 9, 12, '#7d8592');
}

export function officeChair(variant: string | undefined): BufFurniture {
  const c = chairRamp(variant);
  // Base: assento visto por trás + base estrela (o encosto fica no `front`).
  const base = floorSheet(1, 1, 6);
  const b = base.buf;
  starBase(b);
  b.rect(2, 4, 12, 6, c.lt);
  b.hline(3, 12, 4, c.hi);
  b.hline(2, 13, 8, c.base);
  b.hline(2, 13, 9, c.dk);
  b.set(2, 4, c.base);
  b.set(13, 4, c.base);
  b.outline();
  contact(b, 1, 13, 14, 3, 0.22);
  // Frente: encosto baixo e estreito — cobre a lombar de quem senta e deixa ombros e braços à mostra.
  const front = floorSheet(1, 1, 6);
  const f = front.buf;
  f.rect(4, 7, 8, 6, c.base);
  f.hline(5, 10, 6, c.lt);
  f.hline(4, 11, 7, c.lt);
  f.set(5, 7, c.hi);
  f.set(6, 7, c.hi);
  f.vline(4, 8, 11, c.lt);
  f.vline(11, 7, 12, c.dk);
  f.hline(5, 10, 9, c.dk);
  f.hline(5, 10, 10, c.dk);
  f.hline(4, 11, 12, c.dd);
  f.rect(7, 13, 2, 1, '#4a505c');
  f.outline();
  return { base, front };
}

export function officeChairFront(variant: string | undefined): BufFurniture {
  const c = chairRamp(variant);
  const s = floorSheet(1, 1, 10);
  const b = s.buf;
  starBase(b);
  // Encosto ao norte (de frente para a câmera).
  b.rect(3, -6, 10, 10, c.base);
  b.hline(4, 11, -7, c.lt);
  b.rect(4, -5, 8, 7, c.lt);
  b.hline(5, 10, -5, c.hi);
  b.vline(12, -6, 3, c.dk);
  b.hline(3, 12, 3, c.dd);
  b.rect(7, 4, 2, 2, '#4a505c');
  // Assento.
  b.rect(2, 5, 12, 5, c.lt);
  b.hline(3, 12, 5, c.hi);
  b.hline(2, 13, 9, c.dk);
  b.hline(2, 13, 10, c.dd);
  for (const x of [1, 13]) {
    b.rect(x, 3, 2, 5, '#3a3f4b');
    b.set(x, 3, '#5a6070');
  }
  b.outline();
  contact(b, 1, 13, 14, 3, 0.22);
  return { base: s };
}

// ------------------------------------------------------------------ estantes e arquivos

export function bookshelf(seed: number): BufFurniture {
  const s = floorSheet(2, 1, 22);
  const b = s.buf;
  const w = M.oak;
  const r = rngOf(seed, 21);
  // Corpo: laterais, topo e fundo.
  topFace(b, 0, -21, 32, 3, w);
  b.rect(0, -18, 32, 34, w.dk);
  b.rect(2, -17, 28, 31, shade(w.dd, -0.12));
  b.vline(0, -18, 15, w.lt);
  b.vline(1, -18, 15, w.base);
  b.vline(30, -18, 15, w.base);
  b.vline(31, -18, 15, w.dd);
  // Prateleiras.
  const shelves = [-8, 3, 15];
  for (const y of shelves) {
    b.hline(1, 30, y, w.lt);
    b.hline(1, 30, y + 1, w.dk);
  }
  b.hline(0, 31, 15, w.dd);
  // Conteúdo de cada prateleira (apoiado na prateleira de baixo).
  shelves.forEach((shelf, i) => {
    const bottom = shelf - 1;
    let x = 3;
    while (x < 29) {
      const kind = r();
      if (kind < 0.12 && x < 25) {
        // Vaso pequeno com planta.
        pot(b, x, bottom - 3, 4, 4, M.ceramic);
        foliage(b, x + 2, bottom - 5, 2.5, 2, M.leaf, seed + x + i * 7);
        x += 5;
      } else if (kind < 0.2 && x < 24) {
        // Caixa de arquivo.
        const bc = pick(r, ['#e9e4d6', '#c9a46e', '#9fb6cf']);
        b.rect(x, bottom - 4, 5, 5, bc);
        b.hline(x, x + 4, bottom - 4, shade(bc, 0.1));
        b.rect(x + 1, bottom - 2, 3, 1, shade(bc, -0.2));
        x += 6;
      } else if (kind < 0.26 && x < 26) {
        // Troféu.
        b.rect(x + 1, bottom - 4, 3, 2, '#f2c14e');
        b.set(x, bottom - 4, '#d9a42e');
        b.set(x + 4, bottom - 4, '#d9a42e');
        b.set(x + 2, bottom - 2, '#d9a42e');
        b.rect(x + 1, bottom - 1, 3, 2, '#6b4a32');
        x += 6;
      } else {
        // Grupo de livros com alturas variadas (um às vezes inclinado).
        const n = 2 + Math.floor(r() * 4);
        for (let k = 0; k < n && x < 29; k++) {
          const bw = 1 + Math.floor(r() * 2);
          const bh = 6 + Math.floor(r() * 4);
          book(b, x, bottom - bh + 1, bw, bh, pick(r, ACCENTS));
          x += bw;
        }
        if (r() < 0.3 && x < 26) {
          b.line(x, bottom, x + 3, bottom - 6, pick(r, ACCENTS), 1);
          b.line(x + 1, bottom, x + 4, bottom - 6, pick(r, ACCENTS), 1);
          x += 5;
        } else x += 1;
      }
    }
  });
  b.outline();
  contact(b, -1, 13, 34, 4, 0.22);
  return { base: s };
}

export function binderShelf(seed: number): BufFurniture {
  const s = floorSheet(1, 1, 22);
  const b = s.buf;
  const w = ramp('#ecebe6', 0.05);
  const r = rngOf(seed, 23);
  topFace(b, 0, -21, 16, 3, w);
  b.rect(0, -18, 16, 34, w.dk);
  b.rect(1, -17, 14, 31, '#7d8592');
  b.vline(0, -18, 15, w.lt);
  b.vline(15, -18, 15, w.dd);
  const shelves = [-8, 3, 15];
  for (const y of shelves) {
    b.hline(1, 14, y, w.lt);
    b.hline(1, 14, y + 1, w.dk);
  }
  const tops = [-17, -6, 5];
  const binders = ['#3f7fd8', '#ec8a3c', '#4cae6a', '#3f7fd8', '#ec8a3c', '#e05a5a', '#f2c14e'];
  tops.forEach((top, i) => {
    const bottom = shelves[i] - 1;
    const h = bottom - top + 1;
    if (i === 2 && r() < 0.6) {
      // Caixas de papelão na prateleira de baixo.
      b.rect(2, bottom - 6, 6, 7, M.cardboard.base);
      b.hline(2, 7, bottom - 6, M.cardboard.lt);
      b.rect(3, bottom - 4, 4, 2, '#f4efe2');
      b.rect(8, bottom - 5, 6, 6, M.cardboard.dk);
      b.hline(8, 13, bottom - 5, M.cardboard.base);
      b.rect(9, bottom - 3, 4, 2, '#f4efe2');
      return;
    }
    let x = 2;
    while (x < 14) {
      const c = pick(r, binders);
      const bh = Math.min(h - 1, 8 + Math.floor(r() * 2));
      b.rect(x, bottom - bh + 1, 2, bh, c);
      b.vline(x, bottom - bh + 1, bottom, shade(c, 0.1));
      b.set(x, bottom - bh + 3, '#f4f2ee');
      b.set(x + 1, bottom - bh + 3, '#f4f2ee');
      b.set(x + 1, bottom - 1, shade(c, -0.2));
      x += 2;
      if (r() < 0.12) x += 1;
    }
  });
  b.outline();
  contact(b, 0, 13, 16, 4, 0.22);
  return { base: s };
}

export function serverRack(seed: number): BufFurniture {
  const s = floorSheet(1, 1, 22);
  const b = s.buf;
  const r = rngOf(seed, 41);
  const w = ramp('#2b303b', 0.06);
  topFace(b, 0, -21, 16, 3, w);
  b.rect(0, -18, 16, 34, w.dk);
  b.rect(1, -17, 14, 31, '#171a21');
  b.vline(0, -18, 15, w.lt);
  b.vline(15, -18, 15, w.dd);
  // Cinco unidades 1U/2U com vento, LED de atividade e LED de link.
  const units = [-17, -11, -5, 1, 7];
  const leds = ['#5fd07a', '#5fd07a', '#5fd07a', '#f2c14e', '#7fd0ff'];
  units.forEach((top, i) => {
    b.rect(2, top, 12, 5, '#262b36');
    b.hline(2, 13, top, '#3a4150');
    b.hline(2, 13, top + 4, '#0e1015');
    for (let x = 3; x < 9; x += 2) b.vline(x, top + 1, top + 3, '#10131a');
    b.set(11, top + 1, r() < 0.2 ? '#e05a5a' : leds[i % leds.length]);
    b.set(12, top + 1, r() < 0.5 ? '#7fd0ff' : '#3a4150');
    b.set(11, top + 3, '#5fd07a');
  });
  b.outline();
  contact(b, 0, 13, 16, 4, 0.22);
  return { base: s };
}

/**
 * Parede de monitores (3x1, sala Servidor/Rede, MTC): três telas escuras num painel azul-marinho
 * sobre dois pés, com linhas de status verdes e um alerta âmbar. Só cores da marca (navy, verde,
 * verde suave, branco; âmbar apenas no destaque).
 */
export function monitorWall(seed: number): BufFurniture {
  const s = floorSheet(3, 1, 30);
  const b = s.buf;
  const r = rngOf(seed, 59);
  const NAVY = '#0a1f54';
  const PANEL = '#1e2c5d';
  const GREEN = '#35a83f';
  const SOFT = '#4e8e5c';
  const AMBER = '#fec00b';
  const WHITE = '#ffffff';
  const frame = ramp(NAVY, 0.07);
  const screen = shade(NAVY, -0.45);
  // Pés com sapatas (o painel fica de pé no chão, de frente para a câmera).
  for (const x of [9, 37]) {
    b.rect(x, -6, 2, 19, frame.base);
    b.vline(x, -6, 12, frame.lt);
    b.rect(x - 3, 12, 8, 2, frame.dk);
    b.hline(x - 3, x + 4, 12, frame.lt);
  }
  // Painel: moldura navy com borda clara no topo e escura embaixo.
  topFace(b, 0, -29, 48, 2, frame);
  b.rect(0, -27, 48, 21, PANEL);
  b.hline(0, 47, -7, frame.dd);
  b.vline(0, -27, -7, frame.lt);
  b.vline(47, -27, -7, frame.dd);
  // Três telas escuras.
  const xs = [2, 17, 32];
  const top = -25;
  const h = 15;
  xs.forEach((x) => {
    b.rect(x, top, 14, h, screen);
    b.hline(x, x + 13, top, NAVY);
    b.set(x + 1, top + 1, frame.hi);
  });
  // Tela 1: barras de tráfego (verde), uma em âmbar.
  {
    const x0 = xs[0] + 2;
    const amberBar = Math.floor(r() * 5);
    for (let i = 0; i < 5; i++) {
      const bh = 3 + Math.floor(r() * 8);
      b.rect(x0 + i * 2, top + h - 2 - bh, 1, bh, i === amberBar ? AMBER : i % 2 ? SOFT : GREEN);
    }
    b.hline(xs[0] + 1, xs[0] + 12, top + h - 2, SOFT);
  }
  // Tela 2: linha de latência (verde) sobre grade suave, com um pico marcado em âmbar.
  {
    const x0 = xs[1] + 1;
    for (const gy of [top + 4, top + 8, top + 12]) for (let x = x0; x < x0 + 12; x += 2) b.set(x, gy, PANEL);
    let y = top + 9;
    let peak = { x: x0, y };
    for (let i = 0; i < 12; i++) {
      y = Math.max(top + 3, Math.min(top + 12, y + Math.floor(r() * 5) - 2));
      b.set(x0 + i, y, GREEN);
      if (y < peak.y) peak = { x: x0 + i, y };
    }
    b.set(peak.x, peak.y - 1, AMBER);
    b.set(peak.x, peak.y - 2, AMBER);
  }
  // Tela 3: lista de status (ponto + linha); um item em alerta âmbar.
  {
    const x0 = xs[2] + 2;
    const alert = 1 + Math.floor(r() * 3);
    for (let i = 0; i < 4; i++) {
      const y = top + 2 + i * 3;
      b.set(x0, y, i === alert ? AMBER : GREEN);
      const len = 4 + Math.floor(r() * 6);
      b.hline(x0 + 2, x0 + 1 + len, y, i === 0 ? WHITE : SOFT);
    }
  }
  // LED de energia e etiqueta branca no rodapé do painel.
  b.set(44, -9, GREEN);
  b.rect(20, -9, 8, 1, WHITE);
  b.outline();
  contact(b, 4, 12, 40, 4, 0.22);
  return { base: s };
}

// Cores da marca MTC (skill mtc-presentation-theme) usadas nos móveis do estúdio do Designer.
const MTC_NAVY = '#0a1f54';
const MTC_PANEL = '#1e2c5d';
const MTC_DEEP = '#041d56';
const MTC_GREEN = '#35a83f';
const MTC_SOFT = '#4e8e5c';
const MTC_MIST = '#a9aec4';
const MTC_AMBER = '#fec00b';
const MTC_WHITE = '#ffffff';

/**
 * Prancheta de desenho (2x1, estúdio do Designer, MTC): tampo inclinado (a borda de trás mais alta
 * e mais estreita, com a lateral do tampo à mostra) sobre dois cavaletes em X navy. Em cima, uma
 * folha de blueprint navy com grade, fachada em traço branco e cotas/marcas verdes, a régua T
 * branca atravessando a folha, o aparador com um lápis âmbar (único destaque) e uma luminária
 * articulada de cúpula verde. Só cores da marca.
 */
export function draftingBoard(): BufFurniture {
  const s = floorSheet(2, 1, 24);
  const b = s.buf;
  const frame = ramp(MTC_PANEL, 0.07);
  const edge = ramp(MTC_MIST, 0.06);
  // Cavaletes em X (dois de cada lado) com a travessa entre eles.
  for (const x0 of [2, 22]) {
    b.line(x0, 2, x0 + 7, 14, frame.base);
    b.line(x0 + 7, 2, x0, 14, frame.lt);
    b.hline(x0 - 1, x0 + 1, 14, frame.dk);
    b.hline(x0 + 6, x0 + 8, 14, frame.dk);
  }
  b.rect(9, 7, 14, 1, frame.dk);
  // Tampo inclinado: a borda de trás (norte) é mais estreita e fica mais alta; as laterais
  // mostram a espessura do tampo em Mist escuro.
  const top = -15;
  const bot = 0;
  for (let y = top; y <= bot; y++) {
    const inset = Math.round(((bot - y) / (bot - top)) * 3);
    b.hline(inset, 31 - inset, y, edge.lt);
    b.set(inset, y, edge.dk);
    b.set(31 - inset, y, edge.dd);
  }
  b.hline(3, 28, top, edge.hi);
  b.rect(0, bot + 1, 32, 2, edge.dk);
  b.hline(0, 31, bot + 1, edge.base);
  // Folha de blueprint navy com grade (linhas do painel) e cantos com fita branca.
  const sx = 5;
  const sy = -13;
  const sw = 22;
  const sh = 12;
  b.rect(sx, sy, sw, sh, MTC_NAVY);
  for (let y = sy + 3; y < sy + sh; y += 4) b.hline(sx, sx + sw - 1, y, MTC_PANEL);
  for (let x = sx + 3; x < sx + sw; x += 4) b.vline(x, sy, sy + sh - 1, MTC_PANEL);
  for (const [x, y] of [[sx, sy], [sx + sw - 1, sy], [sx, sy + sh - 1], [sx + sw - 1, sy + sh - 1]] as const) b.set(x, y, MTC_WHITE);
  // Fachada em traço branco: telhado em duas águas, paredes e uma janela.
  b.line(sx + 2, sy + 5, sx + 7, sy + 1, MTC_WHITE);
  b.line(sx + 7, sy + 1, sx + 12, sy + 5, MTC_WHITE);
  b.vline(sx + 3, sy + 5, sy + 9, MTC_WHITE);
  b.vline(sx + 11, sy + 5, sy + 9, MTC_WHITE);
  b.hline(sx + 3, sx + 11, sy + 9, MTC_WHITE);
  b.rect(sx + 6, sy + 6, 2, 2, MTC_SOFT);
  // Cotas e marcas verdes ao lado do desenho.
  b.vline(sx + 15, sy + 1, sy + 9, MTC_GREEN);
  b.set(sx + 14, sy + 1, MTC_GREEN);
  b.set(sx + 14, sy + 9, MTC_GREEN);
  b.line(sx + 17, sy + 2, sx + 20, sy + 5, MTC_GREEN);
  b.hline(sx + 17, sx + 20, sy + 8, MTC_SOFT);
  // Régua T branca atravessando a folha (cabeça na borda esquerda do tampo).
  b.hline(2, 28, sy + sh - 2, MTC_WHITE);
  b.hline(3, 28, sy + sh - 1, edge.base);
  b.rect(1, sy + sh - 4, 2, 5, MTC_WHITE);
  // Aparador de lápis na frente, com um lápis âmbar.
  b.hline(1, 30, bot + 3, edge.dd);
  b.hline(8, 13, bot + 2, MTC_AMBER);
  b.set(7, bot + 2, MTC_DEEP);
  // Luminária articulada presa no canto de trás: braço Mist, cúpula verde.
  b.line(27, top - 1, 24, top - 5, edge.dk);
  b.line(24, top - 5, 19, top - 3, edge.dk);
  b.rect(17, top - 3, 4, 2, MTC_GREEN);
  b.hline(17, 20, top - 3, MTC_SOFT);
  b.outline();
  contact(b, 1, 12, 30, 4, 0.2);
  return { base: s };
}

/**
 * Moodboard (item de parede, 2 tiles, estúdio do Designer, MTC): quadro de feltro claro com moldura
 * navy, amostras de cor da paleta da marca (navy, painel, verde, verde suave, Mist e um chip âmbar)
 * e dois esboços presos com alfinetes (um wireframe e um anel do logo).
 */
export function moodboard(): BufFurniture {
  const s = wallSheet(2);
  const b = s.buf;
  const frame = ramp(MTC_NAVY, 0.07);
  const felt = ramp(MTC_MIST, 0.07).hi;
  const x = 2;
  const y = -27;
  const w = 28;
  const h = 19;
  b.rect(x, y, w, h, frame.base);
  b.hline(x, x + w - 1, y, frame.hi);
  b.vline(x, y, y + h - 1, frame.lt);
  b.vline(x + w - 1, y, y + h - 1, frame.dk);
  b.hline(x, x + w - 1, y + h - 1, frame.dk);
  b.rect(x + 1, y + 1, w - 2, h - 2, felt);
  // Amostras de cor (chip colorido com etiqueta branca embaixo), duas colunas.
  const chips = [[MTC_NAVY, MTC_GREEN], [MTC_PANEL, MTC_SOFT], [MTC_MIST, MTC_AMBER]] as const;
  chips.forEach((row, i) => {
    row.forEach((c, j) => {
      const cx = x + 2 + j * 5;
      const cy = y + 2 + i * 5;
      b.rect(cx, cy, 4, 3, c);
      b.hline(cx, cx + 3, cy + 3, MTC_WHITE);
    });
  });
  // Esboço 1: wireframe de tela (cabeçalho navy, linhas, botão verde), alfinete verde.
  const ax = x + 13;
  const ay = y + 2;
  b.rect(ax, ay, 8, 9, MTC_WHITE);
  b.vline(ax + 8, ay + 1, ay + 9, MTC_MIST);
  b.hline(ax + 1, ax + 8, ay + 9, MTC_MIST);
  b.rect(ax + 1, ay + 1, 6, 2, MTC_PANEL);
  b.hline(ax + 1, ax + 6, ay + 4, MTC_NAVY);
  b.hline(ax + 1, ax + 4, ay + 6, MTC_PANEL);
  b.rect(ax + 4, ay + 7, 3, 1, MTC_GREEN);
  b.set(ax + 4, ay, MTC_GREEN);
  // Esboço 2: anel do logo com traço verde, por cima do primeiro; alfinete âmbar.
  const bx = x + 19;
  const by = y + 8;
  b.rect(bx, by, 7, 9, MTC_WHITE);
  b.vline(bx + 7, by + 1, by + 8, MTC_MIST);
  b.ellipse(bx + 3.5, by + 4, 2.6, 2.6, MTC_NAVY);
  b.ellipse(bx + 3.5, by + 4, 1.4, 1.4, MTC_WHITE);
  b.hline(bx + 1, bx + 5, by + 7, MTC_GREEN);
  b.set(bx + 3, by, MTC_AMBER);
  b.outline();
  for (let yy = y; yy <= y + h + 1; yy++) b.under(x + w, yy, 'rgba(30,34,52,0.16)');
  for (let xx = x; xx <= x + w; xx++) b.under(xx, y + h + 1, 'rgba(30,34,52,0.16)');
  return { base: s };
}

export function filingCabinet(): BufFurniture {
  const s = floorSheet(1, 1, 8);
  const b = s.buf;
  const m = ramp('#c3c9d2', 0.06);
  topFace(b, 1, -7, 14, 4, m);
  frontFace(b, 1, -3, 14, 19, m);
  for (const y of [3, 9]) {
    b.hline(1, 14, y, m.dd);
    b.hline(1, 14, y + 1, m.lt);
  }
  for (const y of [-1, 5, 11]) {
    b.rect(6, y, 4, 1, '#7d8592');
    b.rect(6, y + 1, 4, 1, '#eef1f5');
    b.set(5, y + 1, '#9aa2ae');
  }
  b.set(2, -3, m.hi);
  // Planta pequena em cima.
  smallSucculent(b, 9, -9);
  b.outline();
  contact(b, 0, 13, 16, 4, 0.22);
  return { base: s };
}

export function printer(): BufFurniture {
  const s = floorSheet(1, 1, 14);
  const b = s.buf;
  const body = ramp('#dfe2e7', 0.05);
  const dark = ramp('#7b8391', 0.06);
  // Gabinete com bandejas de papel.
  frontFace(b, 0, 2, 16, 14, body);
  for (const y of [6, 10]) {
    b.hline(1, 14, y, body.dd);
    b.rect(6, y + 1, 4, 1, dark.base);
  }
  // Corpo da impressora.
  topFace(b, 0, -11, 16, 6, body);
  b.rect(1, -10, 14, 3, '#f4f5f7');
  b.hline(1, 14, -8, '#c9ced6');
  frontFace(b, 0, -5, 16, 7, body);
  // Painel de controle com tela e LED.
  b.rect(10, -10, 5, 3, dark.base);
  b.rect(11, -9, 3, 1, '#7fd0ff');
  b.set(14, -8, '#5fd07a');
  // Saída de papel.
  b.rect(2, -4, 9, 2, '#3d4350');
  b.rect(3, -5, 7, 2, '#fbfbf8');
  b.hline(3, 9, -3, '#e3e1da');
  b.set(13, -2, '#5fd07a');
  b.outline();
  contact(b, -1, 13, 18, 4, 0.22);
  return { base: s };
}

export function trashBin(): BufFurniture {
  const s = floorSheet(1, 1, 2);
  const b = s.buf;
  const m = ramp('#8a96a8', 0.07);
  // Corpo afunilado.
  for (let y = 7; y <= 15; y++) {
    const inset = y > 13 ? 1 : 0;
    b.hline(4 + inset, 11 - inset, y, m.base);
    b.set(4 + inset, y, m.lt);
    b.set(11 - inset, y, m.dk);
  }
  b.hline(5, 10, 15, m.dk);
  // Boca (elipse) com papel amassado.
  b.ellipse(8, 6.5, 4.5, 2, m.lt);
  b.ellipse(8, 6.6, 3.5, 1.3, '#3b4150');
  b.rect(6, 5, 3, 2, '#f4f2ee');
  b.set(8, 5, '#d8d4ca');
  b.set(9, 6, '#f7d154');
  b.outline();
  contact(b, 3, 14, 10, 2, 0.22);
  return { base: s };
}

// ------------------------------------------------------------------ plantas

export function plantSmall(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(1, 1, 10);
  const b = s.buf;
  const v = variant ?? 'fern';
  if (v === 'succulent') {
    pot(b, 4, 9, 8, 7, M.ceramic);
    b.rect(5, 9, 6, 1, '#5b4636');
    // Roseta azulada: pétalas grossas em camadas.
    const g = ramp('#7fbf9f', 0.08);
    const petals: [number, number, number, number][] = [[3, 8, 6, 5], [13, 8, 10, 5], [5, 5, 7, 3], [11, 5, 9, 3], [8, 3, 8, 6], [4, 7, 8, 6], [12, 7, 8, 6]];
    petals.forEach(([x1, y1, x0, y0], i) => leafBlade(b, x0, y0 + 2, x1, y1, 3, i < 2 ? ramp(g.dk, 0.08) : g, true));
    b.set(8, 5, g.hi);
    b.set(7, 6, g.lt);
  } else if (v === 'flower') {
    pot(b, 4, 9, 8, 7, M.terracotta);
    b.rect(5, 9, 6, 1, '#5b4636');
    const g = M.leaf;
    for (const [x1, y1] of [[2, 6], [14, 5], [5, 2], [11, 2], [8, 4]] as const) leafBlade(b, 8, 9, x1, y1, 3, g, x1 < 8);
    const petals = pick(rngOf(seed, 5), ['#f26d8a', '#f2c14e', '#ffffff', '#b07ae8']);
    for (const [x, y] of [[4, 1], [10, 0], [7, 3], [12, 4], [3, 5]] as const) {
      b.set(x, y, petals);
      b.set(x + 1, y, shade(petals, 0.12));
      b.set(x, y + 1, shade(petals, -0.12));
      b.set(x + 1, y + 1, '#f7d154');
    }
  } else {
    pot(b, 4, 9, 8, 7, M.terracotta);
    b.rect(5, 9, 6, 1, '#5b4636');
    // Samambaia: frondes arqueadas em lâminas finas.
    const g = M.leaf;
    const fr: [number, number, number][] = [[0, 7, 0], [16, 7, 0], [2, 1, 1], [14, 1, 0], [5, -3, 1], [11, -3, 1], [8, -5, 1], [-1, 11, 0], [17, 11, 0]];
    fr.forEach(([x1, y1, light]) => leafBlade(b, 8, 9, x1, y1, 2.6, light ? g : ramp(g.dk, 0.07), x1 < 8));
    b.set(8, -5, g.hi);
  }
  b.outline();
  contact(b, 3, 14, 10, 2, 0.24);
  return { base: s };
}

export function plantTall(variant: string | undefined, seed: number): BufFurniture {
  const s = floorSheet(1, 1, 24, 6);
  const b = s.buf;
  const v = variant ?? 'ficus';
  if (v === 'bonsai') {
    // Bonsai: suporte baixo de madeira, vaso-bandeja cerâmico e copa em "nuvens".
    const st = M.walnut;
    topFace(b, 1, 7, 14, 3, st);
    frontFace(b, 1, 10, 14, 3, st);
    for (const x of [2, 12]) b.rect(x, 13, 2, 3, st.dd);
    const tray = ramp('#4f6a8f', 0.07);
    b.rect(3, 4, 10, 1, tray.lt);
    b.rect(3, 5, 10, 2, tray.base);
    b.hline(4, 11, 4, '#5b4636');
    b.vline(12, 5, 6, tray.dk);
    b.hline(4, 11, 6, tray.dk);
    // Tronco retorcido com raízes aparentes.
    const tr = ramp('#7a5a40', 0.08);
    b.line(7, 4, 6, 0, tr.base, 2);
    b.line(6, 0, 9, -4, tr.base, 2);
    b.line(9, -4, 8, -8, tr.base, 1);
    b.line(8, -3, 4, -5, tr.base, 1);
    b.line(9, -5, 12, -6, tr.base, 1);
    b.set(6, 3, tr.dk);
    b.set(9, 4, tr.lt);
    b.set(5, 4, tr.lt);
    foliage(b, 4, -6.5, 3.6, 2.2, M.leafDark, seed + 3);
    foliage(b, 12.5, -7.5, 3.2, 2, M.leafDark, seed + 4);
    foliage(b, 8.5, -10.5, 4, 2.4, M.leaf, seed + 5);
  } else if (v === 'palm') {
    pot(b, 3, 6, 10, 10, M.ceramic);
    b.rect(4, 6, 8, 1, '#5b4636');
    const g = M.leaf;
    const dark = ramp(M.leaf.dk, 0.07);
    for (const sx of [6, 8, 10]) b.line(8, 6, sx, -4, '#86a04f', 1);
    // Frondes pinadas (de trás, escuras; da frente, claras) abrindo em leque.
    const fronds: [number, number, number, number, Ramp][] = [
      [7, -3, -2, -20, dark], [9, -3, 17, -19, dark], [7, -2, -5, -8, g], [9, -2, 21, -8, g], [8, -3, 8, -23, g],
    ];
    for (const [x0, y0, x1, y1, m] of fronds) bigLeaf(b, x0, y0, x1, y1, 6, m, 'pinnate');
  } else if (v === 'monstera') {
    pot(b, 3, 6, 10, 10, M.terracotta);
    b.rect(4, 6, 8, 1, '#5b4636');
    const g = ramp('#43995a', 0.08);
    const dark = ramp('#2f7a45', 0.08);
    // Folhas grandes recortadas, das de trás para as da frente, com hastes.
    const leaves: [number, number, number, number, number, Ramp][] = [
      [7, -7, 1, -17, 9, dark], [9, -7, 16, -16, 9, dark], [8, -6, 9, -21, 9, g],
      [6, 1, -3, -6, 9, g], [10, 1, 19, -5, 9, g], [8, 3, 6, -5, 7, dark],
    ];
    for (const [x0, y0] of leaves) b.line(8, 6, x0, y0, '#2f6b3d');
    for (const [x0, y0, x1, y1, w, m] of leaves) bigLeaf(b, x0, y0, x1, y1, w, m, 'monstera');
  } else {
    // Ficus: copa cheia em camadas sobre tronco fino.
    pot(b, 3, 6, 10, 10, M.ceramic);
    b.rect(4, 6, 8, 1, '#5b4636');
    const tr = '#7a5a3c';
    b.line(8, 6, 8, -4, tr, 1);
    b.line(7, 6, 7, 0, '#8e6b48', 1);
    b.line(8, -1, 5, -5, tr, 1);
    b.line(8, -3, 11, -6, tr, 1);
    foliage(b, 8, -10, 7, 5.5, M.leafDark, seed + 7);
    foliage(b, 6, -13, 4.6, 3.6, M.leaf, seed + 8);
    foliage(b, 11.5, -9, 3.8, 3.2, M.leaf, seed + 9);
    foliage(b, 4, -7, 3.2, 2.6, M.leaf, seed + 10);
  }
  b.outline();
  contact(b, 2, 14, 12, 3, 0.24);
  return { base: s };
}

// ------------------------------------------------------------------ divisórias de vidro

export function glassPartition(variant: string | undefined): BufFurniture {
  const v = variant ?? 'h';
  const s = floorSheet(1, 1, 22, 2);
  const b = s.buf;
  const wall = ramp('#f1f1ee', 0.045);
  const metal = ramp('#c3cad4', 0.06);
  if (v === 'v') {
    // Corre norte-sul: de cima vemos uma faixa uniforme (topo branco da meia-parede com o vidro e o
    // trilho no meio). Sem contorno automático para os segmentos emendarem sem costura.
    const cols = ['#aab2be', '#fbfbf9', '#f0f0ec', '#dce9f3', 'rgba(130,190,230,0.75)', '#e1e1dc', '#d0d0cb', '#9aa2ae'];
    cols.forEach((c, i) => b.vline(4 + i, -16, 15, c));
    for (let y = -16; y < 16; y += 7) b.set(8, y, 'rgba(255,255,255,0.8)');
    underRect(b, 12, -16, 2, 32, 'rgba(30,34,52,0.12)');
    return { base: s };
  }
  if (v === 'end') {
    // Ponta: coluna de alumínio sobre a base branca da meia-parede.
    topFace(b, 4, 3, 8, 4, wall);
    frontFace(b, 4, 7, 8, 9, wall);
    b.hline(4, 11, 13, mix(wall.dk, '#9aa2ae', 0.5));
    b.rect(6, -18, 4, 22, metal.base);
    b.vline(6, -18, 3, metal.hi);
    b.vline(9, -18, 3, metal.dk);
    b.hline(6, 9, -18, metal.hi);
    b.outline();
    contact(b, 3, 13, 10, 4, 0.2);
    return { base: s };
  }
  // 'h': corre leste-oeste (meia-parede branca + vidro azulado com reflexo).
  // A área do vidro fica opaca durante o contorno (máscara) para não ganhar borda por dentro.
  b.rect(0, -14, 16, 20, '#000000');
  b.rect(0, -17, 16, 3, metal.lt);
  b.hline(0, 15, -17, metal.hi);
  b.hline(0, 15, -15, metal.dk);
  topFace(b, 0, 6, 16, 3, wall);
  frontFace(b, 0, 9, 16, 7, wall);
  b.hline(0, 15, 14, mix(wall.dk, '#9aa2ae', 0.5));
  b.outline();
  b.clearRect(0, -14, 16, 20);
  // Vidro com um reflexo diagonal suave por módulo, brilho no topo e montante.
  b.rect(0, -14, 16, 20, 'rgba(172,214,238,0.34)');
  b.rect(0, -14, 16, 3, 'rgba(255,255,255,0.22)');
  for (let i = 0; i < 20; i++) {
    const x = 13 - Math.floor(i * 0.6);
    b.set(x, -14 + i, 'rgba(255,255,255,0.3)');
    b.set(x - 2, -14 + i, 'rgba(255,255,255,0.14)');
  }
  b.vline(0, -14, 5, 'rgba(195,202,212,0.85)');
  b.hline(0, 15, 5, 'rgba(120,150,175,0.35)');
  // Remove o contorno lateral para segmentos contínuos.
  for (let y = 0; y < b.h; y++) {
    b.clear(-1, y - b.oy);
    b.clear(16, y - b.oy);
  }
  contact(b, 0, 14, 16, 3, 0.16);
  return { base: s };
}

// ------------------------------------------------------------------ reunião e apoio

export function meetingTable(seed: number): BufFurniture {
  const s = floorSheet(3, 2, 10);
  const b = s.buf;
  const m = M.white;
  const r = rngOf(seed, 31);
  // Pernas em painel nas extremidades.
  for (const x of [2, 43]) {
    b.rect(x, 21, 3, 11, M.steel.base);
    b.vline(x, 21, 31, M.steel.lt);
    b.vline(x + 2, 21, 31, M.steel.dk);
  }
  topFace(b, 0, -4, 48, 24, m);
  b.hline(0, 47, 20, m.base);
  b.hline(0, 47, 21, m.dk);
  // Faixa central de madeira.
  b.rect(4, 2, 40, 10, M.oak.lt);
  b.hline(4, 43, 2, M.oak.base);
  b.hline(4, 43, 11, M.oak.hi);
  woodGrain(b, 4, 3, 40, 8, M.oak, seed);
  // Caixa de tomadas/viva-voz no centro.
  b.rect(21, 5, 6, 3, '#3a404d');
  b.rect(22, 5, 4, 1, '#5a6070');
  b.set(24, 6, '#5fd07a');
  // Notebooks e objetos (variam por semente).
  const laptop = (x: number, y: number, facing: 'up' | 'down') => {
    if (facing === 'down') {
      b.rect(x, y, 9, 5, '#3a404d');
      b.hline(x, x + 8, y, '#4d5464');
      staticScreen(b, { x: x + 1, y: y + 1, w: 7, h: 3 }, x < 20 ? 'ide' : 'sheet', seed + x);
      b.rect(x - 1, y + 5, 11, 2, '#c9ced6');
      b.hline(x - 1, x + 9, y + 6, '#9aa1ad');
    } else {
      b.rect(x - 1, y, 11, 2, '#c9ced6');
      b.rect(x, y + 2, 9, 4, '#aeb5c0');
      b.hline(x, x + 8, y + 2, '#d6dbe2');
      b.set(x + 4, y + 4, '#eef1f5');
    }
  };
  laptop(6, -3, 'down');
  laptop(32, 13, 'up');
  if (seed % 2 === 0) laptop(34, -3, 'down');
  else papers(b, 34, -1, 7, 5);
  papers(b, 8, 14, 6, 4);
  // Copos de água / canecas.
  mug(b, 18, 14, pick(r, MUG_COLORS));
  b.rect(29, -1, 2, 3, 'rgba(190,225,245,0.9)');
  b.set(29, -1, '#ffffff');
  b.rect(16, -2, 2, 3, 'rgba(190,225,245,0.9)');
  b.set(16, -2, '#ffffff');
  b.outline();
  contact(b, -1, 28, 50, 5, 0.22);
  underRect(b, 4, 22, 40, 8, 'rgba(30,34,52,0.16)');
  return { base: s };
}

export function stool(): BufFurniture {
  const s = floorSheet(1, 1, 2);
  const b = s.buf;
  // Base e haste.
  b.ellipse(8, 14.5, 4, 1.4, '#5b6272');
  b.rect(7, 8, 2, 6, '#9aa1ad');
  b.vline(8, 8, 13, '#737b89');
  b.hline(5, 10, 11, '#9aa1ad');
  // Assento redondo.
  const seat = ramp('#3f7fd8', 0.07);
  b.ellipse(8, 6, 5.5, 3, seat.dk);
  b.ellipse(8, 5.4, 5.5, 2.6, seat.lt);
  b.set(5, 4, seat.hi);
  b.set(6, 4, seat.hi);
  b.outline();
  contact(b, 3, 13, 10, 3, 0.22);
  return { base: s };
}

export function floorLamp(): BufFurniture {
  const s = floorSheet(1, 1, 26);
  const b = s.buf;
  b.ellipse(8, 14, 4, 1.5, '#3a3f4b');
  b.hline(6, 9, 13, '#5a6070');
  b.vline(8, -17, 13, '#4a505c');
  b.vline(7, -17, 13, '#6b7282');
  // Cúpula de tecido creme (luz acesa).
  const sh = ramp('#f3e6c8', 0.05);
  for (let i = 0; i < 7; i++) {
    const half = 3 + Math.floor(i / 2);
    b.hline(8 - half, 7 + half, -24 + i, i === 0 ? sh.hi : sh.lt);
    b.set(8 - half, -24 + i, sh.hi);
    b.set(7 + half, -24 + i, sh.dk);
  }
  b.hline(3, 12, -17, sh.dk);
  b.hline(5, 10, -16, '#fff6d8');
  b.outline();
  contact(b, 3, 13, 10, 3, 0.22);
  s.rects = { glow: rectAt(s, 4, -20, 8, 6) };
  return { base: s };
}

export function waterCooler(): BufFurniture {
  const s = floorSheet(1, 1, 20);
  const b = s.buf;
  const body = ramp('#eceef1', 0.05);
  // Corpo.
  topFace(b, 3, -5, 10, 3, body);
  frontFace(b, 3, -2, 10, 18, body);
  b.vline(3, -2, 15, body.hi);
  // Torneiras (quente/fria) e bandeja.
  b.rect(5, 1, 2, 2, '#4a86d8');
  b.rect(9, 1, 2, 2, '#e05a5a');
  b.set(5, 1, '#8ab8f0');
  b.set(9, 1, '#f08a8a');
  b.rect(4, 5, 8, 2, '#c3c9d2');
  b.hline(5, 10, 5, '#9aa2ae');
  // Porta inferior.
  b.rect(4, 8, 8, 7, body.base);
  b.hline(4, 11, 8, body.dk);
  b.rect(10, 11, 1, 2, '#9aa2ae');
  // Galão azul translúcido.
  const g = 'rgba(92,170,240,0.78)';
  b.rect(5, -6, 6, 1, '#5b8fd0');
  for (let y = -17; y <= -7; y++) {
    const narrow = y < -15 ? 1 : 0;
    b.hline(4 + narrow, 11 - narrow, y, g);
  }
  b.rect(6, -19, 4, 2, '#3f74c0');
  b.vline(5, -15, -8, 'rgba(255,255,255,0.65)');
  b.vline(6, -14, -9, 'rgba(255,255,255,0.3)');
  b.hline(5, 10, -12, 'rgba(60,120,200,0.6)');
  b.vline(10, -15, -8, 'rgba(40,90,170,0.55)');
  // Porta-copos lateral.
  b.rect(13, -1, 2, 6, '#f4f6f8');
  b.set(14, -1, '#c9ced6');
  b.outline();
  contact(b, 1, 13, 14, 4, 0.22);
  return { base: s };
}
