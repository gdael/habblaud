// Roster de residentes fixos (MTC): quem é quem, e como casar um papel de agente com um residente.
import { readFileSync } from 'node:fs';
import { log, errMsg } from '../log.js';
import { normalizeCwd } from './rooms.js';

export interface ResidentDef {
  id: string;
  name: string;
  role: string;
  look: 'f' | 'm';
  type: 'main' | 'subagent';
  agentTypes: string[];
  aliases: string[];
  cwd?: string;
}

function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`roster: ${field} must be a non-empty string`);
  return v;
}

function strList(v: unknown, field: string): string[] {
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || x.trim() === '')) {
    throw new Error(`roster: ${field} must be an array of non-empty strings`);
  }
  return v as string[];
}

/** Valida o JSON do roster à mão; lança Error nomeando o campo inválido. */
export function parseRoster(raw: unknown): ResidentDef[] {
  const list = (raw as { residents?: unknown } | null)?.residents;
  if (!Array.isArray(list)) throw new Error('roster: residents must be an array');
  const seen = new Set<string>();
  return list.map((item, i) => {
    const p = `residents[${i}]`;
    if (!item || typeof item !== 'object') throw new Error(`roster: ${p} must be an object`);
    const r = item as Record<string, unknown>;
    const id = str(r.id, `${p}.id`);
    if (seen.has(id)) throw new Error(`roster: ${p}.id duplicate "${id}"`);
    seen.add(id);
    const name = str(r.name, `${p}.name`);
    const role = str(r.role, `${p}.role`);
    if (r.look !== 'f' && r.look !== 'm') throw new Error(`roster: ${p}.look must be "f" or "m"`);
    if (r.type !== 'main' && r.type !== 'subagent') throw new Error(`roster: ${p}.type must be "main" or "subagent"`);
    const def: ResidentDef = {
      id,
      name,
      role,
      look: r.look,
      type: r.type,
      agentTypes: strList(r.agentTypes ?? [], `${p}.agentTypes`),
      aliases: strList(r.aliases ?? [], `${p}.aliases`),
    };
    if (r.type === 'main') def.cwd = str(r.cwd, `${p}.cwd`);
    else if (r.cwd !== undefined) def.cwd = str(r.cwd, `${p}.cwd`);
    return def;
  });
}

/** Nunca lança: arquivo ausente/inválido gera um aviso e roster vazio. */
export function loadRoster(file: string): ResidentDef[] {
  try {
    return parseRoster(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    log.warn(`roster not loaded (${file}): ${errMsg(err)}`);
    return [];
  }
}

/** Casa (sem diferenciar maiúsculas) por id, agentTypes ou aliases. */
export function matchResident(roster: ResidentDef[], role: string): ResidentDef | undefined {
  const k = role.trim().toLowerCase();
  return roster.find(
    (d) =>
      d.id.toLowerCase() === k ||
      d.agentTypes.some((a) => a.toLowerCase() === k) ||
      d.aliases.some((a) => a.toLowerCase() === k),
  );
}

export function residentAgentId(def: ResidentDef): string {
  return `resident:${def.id}`;
}

export function residentRoomId(def: ResidentDef): string {
  return def.type === 'main' && def.cwd ? normalizeCwd(def.cwd) : `resident:${def.id}`;
}

export function isResidentId(id: string): boolean {
  return id.startsWith('resident:');
}
