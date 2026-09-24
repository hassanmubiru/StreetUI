/**
 * Deterministic domain data for the performance app.
 *
 * Everything is generated from a seeded PRNG so the SAME dataset is produced on
 * the server and the client — a hard requirement for hydration to adopt the
 * server DOM node-for-node. No `Math.random()`, no `Date.now()`, no network
 * dependency: the data is a pure function of its inputs.
 */

/** Tiny deterministic PRNG (mulberry32) — stable across server + client. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Role = 'admin' | 'editor' | 'viewer';
export type Status = 'active' | 'invited' | 'suspended';

export interface UserRow {
  readonly id: number;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly status: Status;
  readonly score: number;
  readonly team: string;
}

const FIRST = ['Ada', 'Grace', 'Alan', 'Linus', 'Edsger', 'Barbara', 'Ken', 'Margaret', 'Donald', 'Katherine'];
const LAST = ['Lovelace', 'Hopper', 'Turing', 'Torvalds', 'Dijkstra', 'Liskov', 'Thompson', 'Hamilton', 'Knuth', 'Johnson'];
const ROLES: Role[] = ['admin', 'editor', 'viewer'];
const STATUSES: Status[] = ['active', 'invited', 'suspended'];
const TEAMS = ['Platform', 'Growth', 'Payments', 'Infra', 'Mobile', 'Data'];

/**
 * Build `count` deterministic user rows. Given the same `count` and `seed` the
 * output is byte-identical, so server and client agree.
 */
export function makeUsers(count: number, seed = 0x51_75_ee): UserRow[] {
  const rand = mulberry32(seed);
  const rows: UserRow[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)]!;
    const last = LAST[Math.floor(rand() * LAST.length)]!;
    const role = ROLES[Math.floor(rand() * ROLES.length)]!;
    const status = STATUSES[Math.floor(rand() * STATUSES.length)]!;
    const team = TEAMS[Math.floor(rand() * TEAMS.length)]!;
    const score = Math.floor(rand() * 1000);
    rows[i] = {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first}.${last}.${i + 1}`.toLowerCase() + '@example.com',
      role,
      status,
      score,
      team,
    };
  }
  return rows;
}

export type SortKey = 'id' | 'name' | 'role' | 'status' | 'score' | 'team';
export type SortDir = 'asc' | 'desc';

/** Pure filter + sort over rows — used by the table's derived view. */
export function selectRows(
  rows: readonly UserRow[],
  opts: { query: string; role: Role | 'all'; sortKey: SortKey; sortDir: SortDir },
): UserRow[] {
  const q = opts.query.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (opts.role !== 'all' && r.role !== opts.role) return false;
    if (q.length === 0) return true;
    return r.name.toLowerCase().includes(q) || r.email.includes(q) || r.team.toLowerCase().includes(q);
  });

  const dir = opts.sortDir === 'asc' ? 1 : -1;
  const key = opts.sortKey;
  out = out.slice().sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return (a.id - b.id) * dir;
  });
  return out;
}
