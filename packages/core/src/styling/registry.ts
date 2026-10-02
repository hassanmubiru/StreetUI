/**
 * StreetUI styling — the deduplicated CSS rule registry (§15/§18).
 *
 * A single module-level registry maps a *style identity* (`s-<hash>`) to the CSS
 * rule text for that style. Registration is idempotent: registering the same
 * identity twice with identical content is a no-op, so 10,000 elements that share
 * a style produce exactly one rule (§18). The registry is keyed by identity —
 * **never** by node or element — so it holds only bounded rule strings and
 * unmounting nodes never strands state in it (§17 memory-leak avoidance).
 *
 * Ordering is deterministic (insertion order within fixed category bands), so
 * serialization is byte-stable across runs (§11/§16). An empty registry
 * serializes to the empty string, mirroring `renderHead` — so a route that
 * declares no styles emits no `<style>` block and stays byte-identical.
 */

/** Category bands fix the serialization order regardless of registration order. */
export type StyleBand = 'tokens' | 'base' | 'responsive' | 'state' | 'variant';

const BAND_ORDER: readonly StyleBand[] = ['tokens', 'base', 'responsive', 'state', 'variant'];

interface Entry {
  readonly id: string;
  readonly band: StyleBand;
  readonly css: string;
  /** Monotonic sequence to keep a stable, deterministic order within a band. */
  readonly seq: number;
}

export class StyleRegistry {
  private readonly _entries = new Map<string, Entry>();
  private _seq = 0;

  /** True once the registry has adopted a server-emitted stylesheet (§12). */
  private _adopted = false;

  /**
   * Register (idempotently) the CSS for a style identity. Returns the identity so
   * callers can chain. Re-registering an existing id with the same css is a no-op;
   * with different css it keeps the first registration (identity is content-derived,
   * so this cannot happen for honest input and signals a hash collision if it does).
   */
  register(id: string, band: StyleBand, css: string): string {
    const existing = this._entries.get(id);
    if (existing !== undefined) return id;
    this._entries.set(id, { id, band, css, seq: this._seq++ });
    return id;
  }

  /** Whether an identity is already present (server-adopted or locally registered). */
  has(id: string): boolean {
    return this._entries.has(id);
  }

  /** Number of distinct rules held (bounded by source diversity, not instances). */
  get size(): number {
    return this._entries.size;
  }

  /**
   * Seed the registry from identities a server stylesheet already shipped (§12).
   * We only need the *keys* to avoid re-emitting duplicates; the rule text is
   * already in the adopted `<style>` element, so a placeholder css is stored.
   */
  adoptServerIdentities(ids: Iterable<string>): void {
    for (const id of ids) {
      if (!this._entries.has(id)) {
        this._entries.set(id, { id, band: 'base', css: '', seq: this._seq++ });
      }
    }
    this._adopted = true;
  }

  get adopted(): boolean {
    return this._adopted;
  }

  /** Serialize all rules to a single CSS string in deterministic band order. */
  serializeCSS(): string {
    if (this._entries.size === 0) return '';
    const byBand: Record<StyleBand, Entry[]> = {
      tokens: [], base: [], responsive: [], state: [], variant: [],
    };
    for (const e of this._entries.values()) {
      if (e.css.length > 0) byBand[e.band].push(e);
    }
    let out = '';
    for (const band of BAND_ORDER) {
      const list = byBand[band].sort((a, b) => a.seq - b.seq);
      for (const e of list) out += e.css;
    }
    return out;
  }

  /** The ordered list of identities present (for the `data-streetui-css-keys` attr). */
  identities(): string[] {
    return [...this._entries.values()].sort((a, b) => a.seq - b.seq).map((e) => e.id);
  }

  /** Clear everything — test isolation and per-process reset only. */
  reset(): void {
    this._entries.clear();
    this._seq = 0;
    this._adopted = false;
  }
}

/**
 * The process-wide registry instance. Because consuming packages (`dsl` authoring
 * and `renderer` SSR) both resolve `@streetui/core` to the *same* module, they
 * share this one instance — the authoring side registers rules and the SSR side
 * serializes them, with no cross-package plumbing.
 */
export const styleRegistry = new StyleRegistry();
