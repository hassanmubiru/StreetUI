/**
 * Deterministic accessibility id helpers.
 *
 * Accessible markup often needs stable id relationships — a `<label for>` (or
 * `aria-labelledby`) pointing at an input, an `aria-describedby` pointing at a
 * hint/error, an `aria-labelledby` on a dialog pointing at its title. Those ids
 * must be IDENTICAL on the server and the client, otherwise a hydrated subtree
 * that re-renders (e.g. a toggled `when()` branch) would compute a different id
 * than the server emitted and break the association.
 *
 * These helpers derive ids purely from a caller-supplied stable base string
 * (typically a form field name or a dialog name). They use NO incrementing
 * counter and NO randomness, so `a11yIds('email')` yields the same ids in every
 * environment and on every call — which is exactly what SSR + hydration needs.
 */

const UNSAFE = /[^A-Za-z0-9_-]+/g;

/** Normalise an arbitrary base into a token safe for use in an id/selector. */
export function toIdToken(base: string): string {
  const token = base.trim().replace(UNSAFE, '-').replace(/^-+|-+$/g, '');
  return token.length > 0 ? token : 'field';
}

export interface A11yIds {
  /** The normalised base token. */
  readonly base: string;
  /** Id for the primary interactive element (e.g. the input). */
  readonly input: string;
  /** Id for a label element / labelling text (target of `aria-labelledby`). */
  readonly label: string;
  /** Id for descriptive/help text (target of `aria-describedby`). */
  readonly description: string;
  /** Id for an error message element. */
  readonly error: string;
  /** Id for a title element (e.g. a dialog title; target of `aria-labelledby`). */
  readonly title: string;
  /**
   * Id for a control that triggers a popup (button/summary). Pair with
   * `controls` on the popup it opens (`ariaControls: ids.controls`,
   * `ariaExpanded: open`).
   */
  readonly trigger: string;
  /** Id for a popup/region a `trigger` controls (target of `aria-controls`). */
  readonly controls: string;
  /** Id for a subtree owned out-of-DOM-order (target of `aria-owns`). */
  readonly owns: string;
  /** Derive an arbitrary suffixed id from the same base. */
  id(suffix: string): string;
}

/**
 * Build a set of deterministic, SSR-stable ids from a base string.
 *
 * @example
 * const ids = a11yIds('email');
 * // ids.input === 'email-input', ids.label === 'email-label', ...
 * input({ bind: value, id: ids.input, ariaLabelledBy: ids.label, ariaDescribedBy: ids.error });
 * text('Email', { id: ids.label });
 *
 * @example
 * // A menu button that controls its popup, wired by shared ids:
 * const m = a11yIds('actions');
 * button('Actions', { id: m.trigger, ariaControls: m.controls, ariaExpanded: open });
 * page.dropdown('menu', { open, id: m.controls }, (d) => { … });
 */
export function a11yIds(base: string): A11yIds {
  const token = toIdToken(base);
  return {
    base: token,
    input: `${token}-input`,
    label: `${token}-label`,
    description: `${token}-description`,
    error: `${token}-error`,
    title: `${token}-title`,
    trigger: `${token}-trigger`,
    controls: `${token}-controls`,
    owns: `${token}-owns`,
    id: (suffix: string) => `${token}-${toIdToken(suffix)}`,
  };
}
