// Apoio para testes de layout (importável por qualquer arquivo de teste sem rodar os testes de
// layout.test.ts).
import { expect } from 'vitest';
import { FURNITURE } from '../../art/api';
import { COL_W } from '../constants';
import { assembleBuilding } from './building';
import { columnsFor, slotAt } from './geometry';
import type { AreaLayout } from './types';

/**
 * Invariantes de qualquer sala de projeto (padrão ou temática): ao menos uma mesa, todo spot
 * alcançável a partir da porta (BFS no grid de caminhada), footprints de móveis sem sobreposição
 * e tiles da porta caminháveis. Usado pelos testes das variantes (salas dos residentes).
 */
export function assertRoomInvariants(layout: AreaLayout): void {
  expect(layout.spots.some((s) => s.kind === 'desk'), `${layout.id}: sem mesa`).toBe(true);
  const used = new Map<string, string>();
  for (const f of layout.furniture) {
    const def = FURNITURE[f.kind];
    for (let y = f.ty; y < f.ty + def.footprint.h; y++)
      for (let x = f.tx; x < f.tx + def.footprint.w; x++) {
        const key = `${x},${y}`;
        expect(used.get(key), `${layout.id}: ${f.id} sobre ${used.get(key)}`).toBeUndefined();
        used.set(key, f.id);
      }
  }
  const slot = slotAt(layout.rect.x / COL_W, layout.side ?? 'north');
  const b = assembleBuilding(columnsFor([slot]), [layout]);
  const door = layout.door!;
  expect(door, `${layout.id}: sem porta`).toBeDefined();
  for (let y = door.y; y < door.y + door.h; y++)
    for (let x = door.x; x < door.x + door.w; x++) expect(b.grid.walkable(x, y), `${layout.id}: porta ${x},${y} bloqueada`).toBe(true);
  const reach = b.grid.reachableFrom(door.x, door.y);
  for (const sp of layout.spots) expect(reach[sp.ty * b.grid.w + sp.tx], `${layout.id}: ${sp.id} inalcançável`).toBe(1);
}
