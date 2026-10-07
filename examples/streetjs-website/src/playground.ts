/**
 * StreetJS website — playground logic.
 *
 * Three small tools that make documented StreetJS v1.2.8 behaviours concrete.
 * They are plain, pure functions (unit-tested) wrapped in StreetUI signals.
 * They run entirely in the visitor's browser and do NOT call StreetJS — they
 * are teaching aids, not StreetJS APIs.
 */

import { derived, signal, type ReadonlySignal, type Signal } from 'streetui';

/* ── 1. Row decoder ─────────────────────────────────────────────────────── */

export type ColumnType = 'text' | 'int' | 'bigint' | 'boolean' | 'timestamp' | 'jsonb';
const COLUMN_TYPES: readonly ColumnType[] = ['text', 'int', 'bigint', 'boolean', 'timestamp', 'jsonb'];

export interface DecodedColumn {
  readonly column: string;
  readonly type: string;
  readonly raw: string;
  readonly ok: boolean;
  /** Human-readable decoded value, or the reason it could not be decoded. */
  readonly result: string;
}

/**
 * The StreetJS pg driver returns every column as a string. Decode one raw
 * string according to the declared column type.
 */
export function decodeColumn(type: string, raw: string): { ok: boolean; result: string } {
  switch (type) {
    case 'text':
      return { ok: true, result: JSON.stringify(raw) };
    case 'int': {
      if (!/^-?\d+$/.test(raw)) return { ok: false, result: 'not an integer string' };
      const n = Number(raw);
      if (!Number.isSafeInteger(n)) return { ok: false, result: 'outside the safe integer range — use bigint' };
      return { ok: true, result: String(n) };
    }
    case 'bigint': {
      if (!/^-?\d+$/.test(raw)) return { ok: false, result: 'not an integer string' };
      return { ok: true, result: `${BigInt(raw).toString()}n` };
    }
    case 'boolean':
      if (raw === 't') return { ok: true, result: 'true' };
      if (raw === 'f') return { ok: true, result: 'false' };
      return { ok: false, result: `expected 't' or 'f', got ${JSON.stringify(raw)}` };
    case 'timestamp': {
      // Postgres text form: "2026-01-02 03:04:05[.ffffff][+tz]" — not ISO 8601.
      const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/.exec(raw);
      if (m === null) return { ok: false, result: 'not a Postgres timestamp string' };
      let zone = m[3] ?? 'Z';
      if (/^[+-]\d{2}$/.test(zone)) zone = `${zone}:00`;
      else if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
      const d = new Date(`${m[1]}T${m[2]}${zone}`);
      return Number.isNaN(d.getTime())
        ? { ok: false, result: 'could not be parsed as a date' }
        : { ok: true, result: d.toISOString() };
    }
    case 'jsonb':
      try {
        return { ok: true, result: JSON.stringify(JSON.parse(raw)) };
      } catch {
        return { ok: false, result: 'not valid JSON text' };
      }
    default:
      return { ok: false, result: `unknown type "${type}" (use ${COLUMN_TYPES.join(', ')})` };
  }
}

/** Parse `column | type | raw` lines. Blank lines and `#` comments are skipped. */
export function decodeRows(input: string): DecodedColumn[] {
  const out: DecodedColumn[] = [];
  // The StreetUI DSL has no multi-line input, so entries are separated by ";"
  // (or a newline when called programmatically).
  for (const line of input.split(/[\n;]/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('|');
    if (parts.length < 3) {
      out.push({ column: trimmed, type: '?', raw: '', ok: false, result: 'expected "column | type | value"' });
      continue;
    }
    const column = (parts[0] ?? '').trim();
    const type = (parts[1] ?? '').trim();
    const raw = parts.slice(2).join('|').trim();
    out.push({ column, type, raw, ...decodeColumn(type, raw) });
  }
  return out;
}

/** Entries are `column | type | raw value as the driver returns it`, separated by ";". */
export const DECODER_SAMPLE = [
  'id | bigint | 9007199254740993',
  'active | boolean | t',
  'created_at | timestamp | 2026-01-02 03:04:05.123456+00',
  'attempts | int | 3',
  'meta | jsonb | {"plan":"pro"}',
].join('; ');

/* ── 2. Migration order checker ─────────────────────────────────────────── */

export interface MigrationReport {
  readonly order: readonly string[];
  readonly problems: readonly string[];
}

const MIGRATION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_\-.]*\.sql$/;

/**
 * Migrations are tracked by file name and run in lexicographic order, which is
 * only correct when numeric prefixes are zero-padded to the same width.
 * `.rollback.sql` files are not forward migrations.
 */
export function checkMigrations(input: string): MigrationReport {
  const names = input.split(/[\n,]/).map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
  const problems: string[] = [];
  const forward: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    if (name.endsWith('.rollback.sql')) continue;
    if (!MIGRATION_NAME.test(name)) {
      problems.push(`${name}: not a valid migration file name`);
      continue;
    }
    if (seen.has(name)) {
      problems.push(`${name}: listed more than once`);
      continue;
    }
    seen.add(name);
    forward.push(name);
  }
  const widths = new Set<number>();
  const prefixes = new Map<string, string>();
  for (const name of forward) {
    const m = /^(\d+)/.exec(name);
    if (m === null) {
      problems.push(`${name}: no numeric prefix, so its position is arbitrary`);
      continue;
    }
    const digits = m[1] ?? '';
    widths.add(digits.length);
    const earlier = prefixes.get(digits);
    if (earlier !== undefined) problems.push(`${name}: same prefix as ${earlier}`);
    else prefixes.set(digits, name);
  }
  if (widths.size > 1) {
    problems.push('numeric prefixes have different widths — lexicographic order will not match numeric order');
  }
  const order = [...forward].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { order, problems };
}

export const MIGRATION_SAMPLE = [
  '001_create_users.sql',
  '002_create_orders.sql',
  '010_add_indexes.sql',
  '002_create_orders.rollback.sql',
].join(', ');

/* ── 3. Secret format checker ───────────────────────────────────────────── */

export interface SecretCheck {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Format rules only: JwtService needs ≥32 characters, SessionManager exactly 64 hex. */
export function checkSecretFormats(value: string): SecretCheck[] {
  const jwtOk = value.length >= 32;
  const sessionOk = /^[0-9a-fA-F]{64}$/.test(value);
  return [
    {
      label: 'JwtService secret',
      ok: jwtOk,
      detail: jwtOk ? `${value.length} characters (minimum 32)` : `${value.length} characters — needs at least 32`,
    },
    {
      label: 'SessionManager key',
      ok: sessionOk,
      detail: sessionOk ? '64 hex characters' : `${value.length} characters — needs exactly 64 hex characters`,
    },
  ];
}

/* ── Wiring ─────────────────────────────────────────────────────────────── */

export interface PlaygroundState {
  readonly decoderInput: Signal<string>;
  readonly decoded: ReadonlySignal<DecodedColumn[]>;
  readonly migrationInput: Signal<string>;
  readonly migrations: ReadonlySignal<MigrationReport>;
  readonly secretInput: Signal<string>;
  readonly secrets: ReadonlySignal<SecretCheck[]>;
  /** One-line summaries, bound to text() in the UI. */
  readonly decoderSummary: ReadonlySignal<string>;
  readonly migrationSummary: ReadonlySignal<string>;
}

export function createPlayground(): PlaygroundState {
  const decoderInput = signal(DECODER_SAMPLE);
  const migrationInput = signal(MIGRATION_SAMPLE);
  const secretInput = signal('');
  const decoded = derived<DecodedColumn[]>(() => decodeRows(decoderInput.get()));
  const migrations = derived<MigrationReport>(() => checkMigrations(migrationInput.get()));
  const secrets = derived<SecretCheck[]>(() => checkSecretFormats(secretInput.get()));
  const decoderSummary = derived(() => {
    const rows = decoded.get();
    const bad = rows.filter((r) => !r.ok).length;
    return `${rows.length} column${rows.length === 1 ? '' : 's'}, ${bad} problem${bad === 1 ? '' : 's'}`;
  });
  const migrationSummary = derived(() => {
    const r = migrations.get();
    return `${r.order.length} forward migration${r.order.length === 1 ? '' : 's'}, ${r.problems.length} problem${r.problems.length === 1 ? '' : 's'}`;
  });
  return { decoderInput, decoded, migrationInput, migrations, secretInput, secrets, decoderSummary, migrationSummary };
}
