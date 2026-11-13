// Layout de uma sala de projeto (16x12 tiles com paredes próprias).
//
//   linhas 0–1  face da parede norte (salas ao sul: com a passagem da porta)
//   linhas 2–10 piso (interior 14x9: colunas 1–14)
//   linha 11    parede sul (salas ao norte: com a porta para o corredor)
//
// Ilha de 6 lugares face a face (3 desk ao sul, de costas para a câmera; 3 desk_back ao norte,
// de frente), quadro kanban, placa com o nome e decoração. Para as salas não ficarem idênticas,
// a semente da sala escolhe: o lado da ilha (layout espelhado), o tipo de canto de reunião
// (mesa retangular, mesinhas redondas ou recanto com poltronas), os "cantos" da parte de baixo
// (descanso, impressão, verde, mesa de pé) e a coluna de apoio junto à parede.
import { FURNITURE, type Dir, type FurnitureKind, type RoomTheme, type WallStyle } from '../../art/api';
import { mulberry32 } from '../../../../shared/hash';
import { DOOR_W, DOOR_X, TILE } from '../constants';
import { AreaBuilder, type SpotOpts } from './builder';
import { placeInterior, placeStockInterior, shade, type InteriorCtx } from './room-variants';
import { slotRect, slotSide } from './geometry';
import type { RoomKind } from '../../../../shared/types';
import type { AreaLayout, SpotDef, SpotKind } from './types';

export interface RoomInput {
  id: string;
  slot: number;
  seed: number;
  /** MTC: themed interior variant (resident rooms). */
  variant?: RoomKind;
  /** Sala Servidor/Rede: racks no lugar das estantes e das pastas. Alias de variant 'server'. */
  serverRoom?: boolean;
}

const POSTERS = ['code', 'coffee', 'rocket', 'cat', 'bug', 'ship_it'] as const;

/** Canto de reunião (assentos extras para subagentes). */
export type MeetingStyle = 'table' | 'round' | 'lounge';
/** Canto da parte de baixo da sala (linhas 9–10). */
export type CornerStyle = 'rest' | 'print' | 'green' | 'standdesk' | 'stands';

/** Variações sorteadas pela semente (exportado para testes). */
export interface RoomVariant {
  mirror: boolean;
  meeting: MeetingStyle;
  left: CornerStyle;
  right: CornerStyle;
}

/** Sorteio das variações da sala (determinístico pela semente). */
export function roomVariant(seed: number): RoomVariant {
  const rng = mulberry32((seed ^ 0x7a11) >>> 0);
  const mirror = rng() < 0.5;
  const m = rng();
  const meeting: MeetingStyle = m < 0.45 ? 'table' : m < 0.78 ? 'round' : 'lounge';
  const lefts: CornerStyle[] = ['rest', 'print', 'green'];
  const rights: CornerStyle[] = ['standdesk', 'stands', 'green'];
  const left = lefts[Math.floor(rng() * lefts.length) % lefts.length];
  let right = rights[Math.floor(rng() * rights.length) % rights.length];
  if (right === left) right = 'stands';
  return { mirror, meeting, left, right };
}

export function layoutProjectRoom(room: RoomInput, theme: RoomTheme): AreaLayout {
  const rect = slotRect(room.slot);
  const side = slotSide(room.slot);
  const rng = mulberry32(room.seed ^ 0x5eed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const v = roomVariant(room.seed);
  const b = new AreaBuilder(room.id, 'room', rect);
  const area = b.area;
  area.side = side;
  const wall: WallStyle = theme.wall;
  const north = side === 'north';
  const door = { lx: DOOR_X, w: DOOR_W };

  // ---- espelhamento (coordenadas locais pensadas com a ilha à esquerda)
  const mir = v.mirror;
  const fx = (lx: number, w = 1) => (mir ? 16 - lx - w : lx);
  const fdir = (d: Dir): Dir => (mir && (d === 'left' || d === 'right') ? (d === 'left' ? 'right' : 'left') : d);
  const fdx = (dx: number | undefined) => (dx === undefined ? undefined : mir ? -dx : dx);
  const furn = (kind: FurnitureKind, lx: number, ly: number, variant?: string, o: { dx?: number; dy?: number; order?: number; seat?: string } = {}) =>
    b.furn(kind, fx(lx, FURNITURE[kind].footprint.w), ly, variant, { ...o, dx: fdx(o.dx) });
  const spot = (kind: SpotKind, lx: number, ly: number, dir: Dir, o: SpotOpts = {}): SpotDef => b.spot(kind, fx(lx), ly, fdir(dir), { ...o, dx: fdx(o.dx) });
  /** Assento; `dirVariant` = a variante do móvel é a própria direção (poltrona, cadeira de café). */
  const seat = (kind: SpotKind, fk: FurnitureKind, lx: number, ly: number, dir: Dir, variant?: string, o: SpotOpts & { order?: number } = {}, dirVariant = false): SpotDef =>
    b.seat(kind, fk, fx(lx), ly, fdir(dir), dirVariant ? fdir(dir) : variant, { ...o, dx: fdx(o.dx) });
  const wallItem = (kind: FurnitureKind, cx: number, variant?: string, o: { ly?: number; on?: 'face' | 'south'; order?: number } = {}) => b.wall(kind, mir ? 16 - cx : cx, variant, o);
  const rug = (lx: number, ly: number, w: number, h: number, color: string, seed: number) => b.rug(fx(lx, w), ly, w, h, color, seed);

  // ---- piso: porcelanato claro (o banheiro é que usa azulejo); leve tom do tema dá identidade
  b.floor('marble', 0, 0, 16, 12, room.seed);
  area.floorTint = theme.carpet;
  // tapete na cor do tema sob a ilha (identidade da sala)
  rug(1.5, 3.25, 7, 5.5, theme.carpet, room.seed);
  // tapetinho na entrada
  rug(DOOR_X - 0.25, north ? 9.5 : 2, DOOR_W + 0.5, 1.25, shade(theme.carpet2, -0.1), room.seed + 1);

  // ---- paredes
  if (north) {
    b.face(0.5, 15, wall);
    b.south(0.5, 15, 11, wall, [door]);
  } else {
    b.face(0.5, 15, wall, [door]);
    b.south(0.5, 15, 11, { ...wall, exterior: true });
    // batente na passagem da porta (a face da parede norte mostra o vão)
    b.wall('door_frame', DOOR_X + DOOR_W / 2, undefined, { order: 0.05 });
  }
  b.cap(0, 0, 0.5, 12, wall);
  b.cap(15.5, 0, 0.5, 12, wall);

  // ---- caminhabilidade
  b.walk(1, 2, 14, 9);
  area.door = north ? { x: rect.x + DOOR_X, y: rect.y + 11, w: DOOR_W, h: 1 } : { x: rect.x + DOOR_X, y: rect.y, w: DOOR_W, h: 2 };
  b.walk(area.door.x - rect.x, area.door.y - rect.y, area.door.w, area.door.h);

  // ---- itens de parede
  const signCx = north ? 8 : 10.5;
  area.signId = wallItem('sign', signCx, undefined, { order: 0.95 });
  if (north) {
    wallItem('whiteboard', 4.5, undefined, { order: 0.6 });
    wallItem('clock', 10, undefined, { order: 0.7 });
    wallItem('poster', 11.1, pick(POSTERS), { order: 0.5 });
    wallItem('window', 12.75, undefined, { order: 0.4 });
    // interruptor ao lado da porta, na mureta (por dentro)
    wallItem('light_switch', DOOR_X - 0.5, 'on', { ly: 12, on: 'south', order: 0.8 });
    spot('switch', DOOR_X - 1, 10, 'down', { dy: -1 });
  } else {
    wallItem('whiteboard', 2.5, undefined, { order: 0.6 });
    wallItem('light_switch', DOOR_X - 0.5, 'on', { order: 0.8 });
    wallItem('clock', 12.3, undefined, { order: 0.7 });
    wallItem('poster', 13.35, pick(POSTERS), { order: 0.5 });
    spot('switch', DOOR_X - 1, 2, 'up', { dy: -3 });
  }
  spot('whiteboard', north ? 4 : 2, 2, 'up', { dx: 8, dy: 2 });

  // ---- interior: tema da variante (salas dos residentes) ou o interior padrão
  const ctx: InteriorCtx = { furn, seat, spot, wallItem, rug, pick, rng, theme, north, mirror: mir, seed: room.seed, rv: v };
  const kind: RoomKind | undefined = room.variant ?? (room.serverRoom === true ? 'server' : undefined);
  if (!kind || !placeInterior(kind, ctx)) placeStockInterior(ctx);

  // ---- sombreamento quando a luz está apagada (salas ao norte: a mureta sul fica clara)
  const p = { x: rect.x * TILE, y: rect.y * TILE, w: rect.w * TILE, h: rect.h * TILE };
  area.shade = north ? { x: p.x, y: p.y, w: p.w, h: p.h - TILE } : { x: p.x, y: p.y, w: p.w, h: p.h };
  return b.build();
}
