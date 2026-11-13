// Interior das salas de projeto: o interior padrão (ilha 3x2, canto de reunião, estante e
// coluna, cantos de baixo, pontos em pé) e os interiores temáticos das salas dos residentes
// (MTC). `layoutProjectRoom` monta a casca (piso, paredes, porta, caminhabilidade, itens de
// parede) e delega o interior para cá.
//
// Regra de ouro: o interior padrão consome o rng da sala exatamente na mesma ordem de antes, para
// que as salas de projeto comuns (sem variante) fiquem idênticas (guardado por fixture em teste).
import type { Dir, FurnitureKind, RoomTheme } from '../../art/api';
import { TILE } from '../constants';
import type { SpotOpts } from './builder';
import type { RoomKind } from '../../../../shared/types';
import type { CornerStyle, RoomVariant } from './room';
import type { SpotDef, SpotKind } from './types';

const PLANTS_TALL = ['palm', 'ficus', 'monstera', 'bonsai'] as const;
const PLANTS_SMALL = ['fern', 'succulent', 'flower'] as const;
const BEANBAGS = ['red', 'blue', 'yellow', 'green'] as const;

/** Variação de uma cor hex (clareia/escurece) — usado para tapetes e detalhes. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount > 0 ? (255 - v) * amount : v * amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * O que um interior recebe de `layoutProjectRoom`: as mesmas funções locais de lá (coordenadas
 * locais pensadas com a ilha à esquerda; o espelhamento já é aplicado por elas).
 */
export interface InteriorCtx {
  furn: (kind: FurnitureKind, lx: number, ly: number, variant?: string, o?: { dx?: number; dy?: number; order?: number; seat?: string }) => string;
  seat: (kind: SpotKind, fk: FurnitureKind, lx: number, ly: number, dir: Dir, variant?: string, o?: SpotOpts & { order?: number }, dirVariant?: boolean) => SpotDef;
  spot: (kind: SpotKind, lx: number, ly: number, dir: Dir, o?: SpotOpts) => SpotDef;
  wallItem: (kind: FurnitureKind, cx: number, variant?: string, o?: { ly?: number; on?: 'face' | 'south'; order?: number }) => string;
  rug: (lx: number, ly: number, w: number, h: number, color: string, seed: number) => void;
  /** Sorteio com o rng da sala (cada chamada consome um número). */
  pick: <T>(arr: readonly T[]) => T;
  /** O rng da sala, para sorteios que não são `pick`. */
  rng: () => number;
  theme: RoomTheme;
  /** Sala ao norte do corredor (porta na parede sul). */
  north: boolean;
  /** Layout espelhado (a ilha vai para a direita). */
  mirror: boolean;
  /** Semente da sala. */
  seed: number;
  /** Variações sorteadas pela semente (canto de reunião, cantos de baixo). */
  rv: RoomVariant;
}

/**
 * Interior temático de uma variante. Devolve false quando a variante ainda não tem interior
 * próprio: então o chamador usa o interior padrão.
 */
export function placeInterior(kind: RoomKind, c: InteriorCtx): boolean {
  switch (kind) {
    case 'server':
      placeServerInterior(c);
      return true;
    case 'lead':
      placeLeadInterior(c);
      return true;
    case 'studio':
      placeStudioInterior(c);
      return true;
    default:
      return false;
  }
}

/**
 * Apoio na parede norte das salas temáticas (sem cobrir quadro, placa ou janela): estante na coluna
 * `shelfX` com o ponto da estante, planta alta no canto leste e, conforme o lado, o ponto da janela
 * ou um vaso pequeno no canto oeste. Mesma ordem de sorteio do bloco equivalente do interior
 * padrão (que mantém a sua própria cópia, para a ordem do rng das salas comuns nunca mudar).
 * `shelf: false` deixa a parede livre na coluna da estante (o ponto continua, diante da parede).
 * Devolve `shelfX`.
 */
function placeNorthSupport(c: InteriorCtx, o: { shelf?: boolean } = {}): number {
  const { furn, spot, pick, north } = c;
  const shelfX = north ? 1 : 4;
  if (o.shelf !== false) furn('bookshelf', shelfX, 2, undefined, { order: 0.25 });
  spot('shelf', shelfX, 3, 'up', { dx: 8, dy: -2 });
  furn('plant_tall', 14, 2, pick(PLANTS_TALL), { order: 0.2 });
  if (north) spot('window', 12, 2, 'up', { dx: 12, dy: 1 });
  else furn('plant_small', 1, 2, pick(PLANTS_SMALL), { order: 0.22 });
  return shelfX;
}

/** Interior padrão das salas de projeto. */
export function placeStockInterior(c: InteriorCtx): void {
  const { furn, seat, spot, rug, pick, rng, theme, north } = c;
  const v = c.rv;
  const seed = c.seed;

  // ---- ilha de trabalho 3x2 face a face (colunas 2–7, linhas 4–7)
  const deskV = theme.deskVariant;
  const chairV = theme.chairVariant;
  const ranks = [2, 0, 4];
  for (let i = 0; i < 3; i++) {
    const lx = 2 + i * 2;
    const back = furn('desk_back', lx, 5, deskV, { order: 0.35 + i * 0.05, seat: `N${i}` });
    const front = furn('desk', lx, 6, deskV, { order: 0.4 + i * 0.05, seat: `S${i}` });
    seat('desk', 'office_chair_front', lx, 4, 'down', chairV, { dx: TILE / 2, deskId: back, rank: ranks[i] + 1, side: 'N', order: 0.55 + i * 0.03 });
    seat('desk', 'office_chair', lx, 7, 'up', chairV, { dx: TILE / 2, deskId: front, rank: ranks[i], side: 'S', order: 0.6 + i * 0.03 });
  }
  furn('trash_bin', 9, 6, undefined, { order: 0.7 });

  // ---- canto de reunião (assentos extras para subagentes: banquetas ou poltronas)
  if (v.meeting === 'table') {
    furn('meeting_table', 10, 5, undefined, { order: 0.45 });
    seat('stool', 'stool', 10, 4, 'down', undefined, { order: 0.65 });
    seat('stool', 'stool', 12, 4, 'down', undefined, { order: 0.66 });
    seat('stool', 'stool', 10, 7, 'up', undefined, { order: 0.67 });
    seat('stool', 'stool', 12, 7, 'up', undefined, { order: 0.68 });
  } else if (v.meeting === 'round') {
    // duas mesinhas redondas com duas banquetas cada (em diagonal, para circular entre elas)
    furn('cafe_table', 11, 4, undefined, { order: 0.45 });
    seat('stool', 'stool', 10, 4, 'right', undefined, { order: 0.65 });
    seat('stool', 'stool', 12, 4, 'left', undefined, { order: 0.66 });
    furn('cafe_table', 11, 7, undefined, { order: 0.46 });
    seat('stool', 'stool', 10, 7, 'right', undefined, { order: 0.67 });
    seat('stool', 'stool', 12, 7, 'left', undefined, { order: 0.68 });
    furn('plant_small', 12, 5, pick(PLANTS_SMALL), { order: 0.47 });
  } else {
    // recanto com poltronas e puffs em volta de uma mesa de centro (sem mesa de reunião)
    rug(9.6, 3.7, 4.8, 4.6, shade(theme.carpet2, 0.25), seed + 2);
    furn('coffee_table', 10, 5, undefined, { order: 0.45 });
    seat('nook', 'armchair', 9, 5, 'right', undefined, { order: 0.65 }, true);
    seat('nook', 'armchair', 12, 5, 'left', undefined, { order: 0.66 }, true);
    seat('nook', 'beanbag', 10, 7, 'up', pick(BEANBAGS), { order: 0.67 });
    seat('nook', 'beanbag', 11, 7, 'up', pick(BEANBAGS), { order: 0.68 });
    seat('nook', 'beanbag', 11, 3, 'down', pick(BEANBAGS), { order: 0.69 });
  }

  // ---- apoio: estante na parede norte (sem cobrir quadro, placa ou janela) e coluna junto à parede
  const tall = pick(PLANTS_TALL);
  const shelfX = north ? 1 : 4;
  furn('bookshelf', shelfX, 2, undefined, { order: 0.25 });
  spot('shelf', shelfX, 3, 'up', { dx: 8, dy: -2 });
  furn('plant_tall', 14, 2, tall, { order: 0.2 });
  if (north) spot('window', 12, 2, 'up', { dx: 12, dy: 1 });
  else furn('plant_small', 1, 2, pick(PLANTS_SMALL), { order: 0.22 });
  const column = Math.floor(rng() * 3);
  if (column === 0) {
    furn('binder_shelf', 14, 4, undefined, { order: 0.3 });
    furn('printer', 14, 6, undefined, { order: 0.32 });
    furn('floor_lamp', 14, 8, undefined, { order: 0.34 });
  } else if (column === 1) {
    furn('binder_shelf', 14, 4, undefined, { order: 0.3 });
    furn('binder_shelf', 14, 5, undefined, { order: 0.31 });
    furn('floor_lamp', 14, 8, undefined, { order: 0.34 });
  } else {
    furn('floor_lamp', 14, 4, undefined, { order: 0.3 });
    furn('filing_cabinet', 14, 6, undefined, { order: 0.32 });
    furn('plant_tall', 14, 8, pick(PLANTS_TALL), { order: 0.34 });
  }

  // ---- cantos da parte de baixo (linhas 9–10; a passagem da porta, colunas 6–9, fica livre)
  corner(v.left, 'left');
  corner(v.right, 'right');

  function corner(style: CornerStyle, where: 'left' | 'right'): void {
    // a zona da esquerda ocupa as colunas 1–5; a da direita, 10–14
    const x0 = where === 'left' ? 1 : 10;
    const o = 0.2 + (where === 'left' ? 0 : 0.05);
    switch (style) {
      case 'rest': {
        // canto de descanso: tapete, dois puffs (também servem de lugar extra) e plantas
        rug(x0 + 0.5, 8.85, 4, 2, shade(theme.carpet, 0.35), seed + 3);
        seat('nook', 'beanbag', x0 + 1, 10, 'up', pick(BEANBAGS), { order: o + 0.4 });
        seat('nook', 'beanbag', x0 + 3, 10, 'up', pick(BEANBAGS), { order: o + 0.41 });
        furn('plant_small', x0 + 2, 10, pick(PLANTS_SMALL), { order: o });
        furn('plant_tall', where === 'left' ? x0 : x0 + 4, 10, pick(PLANTS_TALL), { order: o + 0.01 });
        return;
      }
      case 'print': {
        // estação de impressão com estante de pastas e arquivo
        furn('printer', x0, 10, undefined, { order: o });
        furn('binder_shelf', x0 + 1, 10, undefined, { order: o + 0.01 });
        furn('binder_shelf', x0 + 2, 10, undefined, { order: o + 0.02 });
        furn('filing_cabinet', x0 + 3, 10, undefined, { order: o + 0.03 });
        furn('trash_bin', x0 + 4, 10, undefined, { order: o + 0.04 });
        return;
      }
      case 'green': {
        // cantinho verde com luminária e uma poltrona de leitura
        furn('plant_tall', x0, 10, pick(PLANTS_TALL), { order: o });
        furn('floor_lamp', x0 + 1, 10, undefined, { order: o + 0.01 });
        seat('nook', 'armchair', x0 + 2, 10, 'up', undefined, { order: o + 0.4 }, true);
        furn('plant_small', x0 + 3, 10, pick(PLANTS_SMALL), { order: o + 0.02 });
        furn('plant_tall', x0 + 4, 10, pick(PLANTS_TALL), { order: o + 0.03 });
        return;
      }
      case 'standdesk': {
        // mesa de pé com notebook (lugar de trabalho em pé, de frente para a câmera)
        furn('cafe_table', x0 + 2, 10, undefined, { order: o });
        spot('stand', x0 + 2, 9, 'down', { dy: -1 });
        furn('plant_small', x0 + 4, 10, pick(PLANTS_SMALL), { order: o + 0.01 });
        furn('trash_bin', x0, 10, undefined, { order: o + 0.02 });
        return;
      }
      case 'stands': {
        // pontos em pé junto ao quadro móvel/estante baixa
        furn('filing_cabinet', x0 + 4, 10, undefined, { order: o });
        furn('plant_small', x0, 10, pick(PLANTS_SMALL), { order: o + 0.01 });
        spot('stand', x0 + 1, 9, 'up', { dy: -2 });
        spot('stand', x0 + 2, 9, 'up', { dy: -2 });
        return;
      }
    }
  }

  // pontos em pé (subagentes sem lugar sentado trabalham aqui; também servem de conversa)
  spot('stand', 9, 3, 'left');
  spot('stand', 1, 7, 'right');
  spot('stand', 13, 9, 'up', { dy: -2 });
}

/**
 * Sala Servidor/Rede (Makisig): racks junto à parede leste e uma fileira de racks no fundo, a
 * parede de monitores no lugar da ilha e uma única mesa de operador virada para ela. Sem canto de
 * reunião; quem visita fica nos pontos em pé (diante dos racks e no corredor).
 */
function placeServerInterior(c: InteriorCtx): void {
  const { furn, seat, spot, pick, theme } = c;

  // ---- posto de monitoramento: parede de monitores (3x1) e, à frente, a mesa do operador
  // (a pessoa senta de costas para a câmera, olhando para as telas). O painel é deslocado meio
  // tile para ficar centrado sobre a mesa (colunas 2–3). Fica na linha 5 para não cobrir o que está
  // encostado na parede norte (estante, planta).
  furn('monitor_wall', 2, 5, undefined, { dx: -TILE / 2, order: 0.3 });
  const desk = furn('desk', 2, 7, theme.deskVariant, { order: 0.4, seat: 'S0' });
  seat('desk', 'office_chair', 2, 8, 'up', theme.chairVariant, { dx: TILE / 2, deskId: desk, rank: 0, side: 'S', order: 0.6 });
  furn('trash_bin', 4, 7, undefined, { order: 0.42 });

  // ---- racks: fileira no fundo (colunas 10–12) e a coluna junto à parede leste, como antes
  for (let i = 0; i < 3; i++) furn('server_rack', 10 + i, 4, undefined, { order: 0.3 + i * 0.01 });
  furn('server_rack', 14, 4, undefined, { order: 0.33 });
  furn('server_rack', 14, 5, undefined, { order: 0.34 });
  furn('server_rack', 14, 6, undefined, { order: 0.35 });
  furn('floor_lamp', 14, 8, undefined, { order: 0.36 });

  // ---- apoio na parede norte (sem cobrir quadro, placa ou janela), como no interior padrão
  placeNorthSupport(c);

  // ---- parte de baixo (linhas 9–10; a passagem da porta, colunas 6–9, fica livre):
  // arquivo e pastas à esquerda, mais dois racks à direita
  furn('plant_tall', 1, 10, pick(PLANTS_TALL), { order: 0.2 });
  furn('filing_cabinet', 2, 10, undefined, { order: 0.21 });
  furn('binder_shelf', 3, 10, undefined, { order: 0.22 });
  furn('printer', 4, 10, undefined, { order: 0.23 });
  furn('server_rack', 12, 10, undefined, { order: 0.25 });
  furn('server_rack', 13, 10, undefined, { order: 0.26 });
  furn('plant_small', 14, 10, pick(PLANTS_SMALL), { order: 0.27 });

  // pontos em pé: diante da fileira de racks, diante dos racks de baixo e no corredor
  spot('stand', 11, 5, 'up', { dy: -2 });
  spot('stand', 13, 9, 'up', { dy: -2 });
  spot('stand', 9, 3, 'left');
}

/**
 * Sala do líder (Hiraya): três mesas de madeira em fila (só três lugares de mesa) sobre um tapete
 * grande nas cores do tema, estantes (uma ao norte, outra embaixo) e o canto de reunião com mesa e quatro
 * banquetas para os subagentes visitantes. Pontos em pé extras para quem não achar lugar.
 */
function placeLeadInterior(c: InteriorCtx): void {
  const { furn, seat, spot, rug, pick, theme, seed } = c;

  // ---- estação do líder: tapete grande, três mesas (frente) com as mesas de trás como bancada
  rug(1.2, 3.6, 7.6, 5, shade(theme.carpet2, 0.2), seed + 4);
  for (let i = 0; i < 3; i++) {
    const lx = 2 + i * 2;
    furn('desk_back', lx, 5, 'wood', { order: 0.35 + i * 0.05 });
    const front = furn('desk', lx, 6, 'wood', { order: 0.4 + i * 0.05, seat: `S${i}` });
    seat('desk', 'office_chair', lx, 7, 'up', theme.chairVariant, { dx: TILE / 2, deskId: front, rank: i, side: 'S', order: 0.6 + i * 0.03 });
  }
  furn('trash_bin', 8, 6, undefined, { order: 0.7 });
  furn('plant_small', 1, 6, pick(PLANTS_SMALL), { order: 0.41 });

  // ---- canto de reunião (visitantes): mesa de reunião com quatro banquetas
  furn('meeting_table', 10, 5, undefined, { order: 0.45 });
  seat('stool', 'stool', 10, 4, 'down', undefined, { order: 0.65 });
  seat('stool', 'stool', 12, 4, 'down', undefined, { order: 0.66 });
  seat('stool', 'stool', 10, 7, 'up', undefined, { order: 0.67 });
  seat('stool', 'stool', 12, 7, 'up', undefined, { order: 0.68 });

  // ---- estante na parede norte (sem cobrir quadro, placa ou janela) e plantas
  placeNorthSupport(c);
  furn('binder_shelf', 14, 4, undefined, { order: 0.3 });
  furn('floor_lamp', 14, 5, undefined, { order: 0.31 });
  furn('plant_tall', 14, 8, pick(PLANTS_TALL), { order: 0.34 });

  // ---- parte de baixo (linhas 9–10; a passagem da porta, colunas 6–9, fica livre)
  // (a parede de cima tem quadro, placa e relógio: a segunda estante fica encostada embaixo)
  furn('bookshelf', 1, 10, undefined, { order: 0.2 });
  furn('filing_cabinet', 3, 10, undefined, { order: 0.21 });
  furn('plant_tall', 4, 10, pick(PLANTS_TALL), { order: 0.22 });
  furn('plant_tall', 10, 10, pick(PLANTS_TALL), { order: 0.25 });
  furn('plant_small', 14, 10, pick(PLANTS_SMALL), { order: 0.27 });

  // pontos em pé para subagentes sem lugar sentado
  spot('stand', 9, 3, 'left');
  spot('stand', 1, 8, 'right');
  spot('stand', 12, 9, 'up', { dy: -2 });
  spot('stand', 13, 9, 'up', { dy: -2 });
}

/**
 * Estúdio (Designer): a mesa do Designer (rank 0) e uma segunda mesa ao lado, uma prancheta atrás
 * delas e mais duas pranchetas sobre um tapete na cor do tema no lado leste, uma mesinha com duas
 * banquetas para revisar esboços, o moodboard na parede norte (no lugar da estante, que desce
 * para a parede de baixo) e plantas. O quadro branco é o da casca da sala.
 */
function placeStudioInterior(c: InteriorCtx): void {
  const { furn, seat, spot, wallItem, rug, pick, theme, seed } = c;

  // ---- mesas: a do Designer (rank 0) e uma segunda (rank 1), de costas para a câmera
  for (let i = 0; i < 2; i++) {
    const lx = 2 + i * 2;
    const desk = furn('desk', lx, 6, theme.deskVariant, { order: 0.4 + i * 0.05, seat: `S${i}` });
    seat('desk', 'office_chair', lx, 7, 'up', theme.chairVariant, { dx: TILE / 2, deskId: desk, rank: i, side: 'S', order: 0.6 + i * 0.03 });
  }
  furn('trash_bin', 6, 6, undefined, { order: 0.42 });
  furn('plant_small', 1, 6, pick(PLANTS_SMALL), { order: 0.41 });

  // ---- pranchetas: uma atrás das mesas, duas no lado leste sobre um tapete do tema; quem desenha
  // fica em pé ao sul de cada uma, virado para ela
  furn('drafting_board', 2, 4, undefined, { order: 0.3 });
  spot('stand', 2, 5, 'up', { dx: TILE / 2, dy: -2 });
  rug(9.6, 3.6, 4.8, 4.8, shade(theme.carpet2, 0.25), seed + 4);
  furn('drafting_board', 10, 4, undefined, { order: 0.31 });
  furn('drafting_board', 12, 4, undefined, { order: 0.32 });
  spot('stand', 10, 5, 'up', { dx: TILE / 2, dy: -2 });
  spot('stand', 12, 5, 'up', { dx: TILE / 2, dy: -2 });

  // ---- mesinha de revisão com duas banquetas (visitas e conversa sobre os esboços)
  furn('cafe_table', 11, 7, undefined, { order: 0.45 });
  seat('stool', 'stool', 10, 7, 'right', undefined, { order: 0.65 });
  seat('stool', 'stool', 12, 7, 'left', undefined, { order: 0.66 });

  // ---- parede norte: moodboard onde ficaria a estante (sem cobrir quadro, placa ou janela)
  const shelfX = placeNorthSupport(c, { shelf: false });
  wallItem('moodboard', shelfX + 1, undefined, { order: 0.55 });
  furn('binder_shelf', 14, 4, undefined, { order: 0.3 });
  furn('floor_lamp', 14, 6, undefined, { order: 0.33 });
  furn('plant_tall', 14, 8, pick(PLANTS_TALL), { order: 0.34 });

  // ---- parte de baixo (linhas 9–10; a passagem da porta, colunas 6–9, fica livre): a estante
  // encostada embaixo, plantas e um canto com dois puffs nas cores da marca
  furn('bookshelf', 1, 10, undefined, { order: 0.2 });
  furn('plant_tall', 3, 10, pick(PLANTS_TALL), { order: 0.21 });
  furn('filing_cabinet', 4, 10, undefined, { order: 0.22 });
  furn('plant_tall', 10, 10, pick(PLANTS_TALL), { order: 0.25 });
  seat('nook', 'beanbag', 12, 10, 'up', 'green', { order: 0.66 });
  seat('nook', 'beanbag', 13, 10, 'up', 'blue', { order: 0.67 });
  furn('plant_small', 14, 10, pick(PLANTS_SMALL), { order: 0.27 });

  // pontos em pé para quem visita
  spot('stand', 9, 3, 'left');
  spot('stand', 1, 8, 'right');
}
