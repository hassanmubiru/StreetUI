/**
 * StreetUI styling — layout primitives (§12).
 *
 * Thin, token-driven `style()` presets — **not** new graph nodes and **not** a
 * utility-class framework. Each primitive is a function that takes a small, typed
 * option bag and returns a single deduplicated class string, so composing a layout
 * is `container()`, `stack({ gap: 4 })`, etc. Because they compile through the same
 * `style()` registry, identical option bags share one CSS rule (§15/§18), and they
 * carry no runtime dependency — the return value is a plain class token.
 *
 * Spacing/gap options are **space-scale keys** (`'0'`…`'10'`) resolved to the
 * `--space-*` token variables, so layouts stay on the design system by default and
 * remain theme-consistent. Raw CSS escape values are still accepted where a bare
 * `CSSValue` is allowed.
 */

import { type CSSValue, type StyleDef } from './canonical.js';
import { style } from './style.js';
import { tokens } from './tokens.js';

/** A spacing-scale key resolved against the `--space-*` tokens. */
export type SpaceKey = keyof typeof tokens.ref.space;

const space = (k: SpaceKey): string => tokens.ref.space[k];

export interface ContainerOptions {
  /** Max content width (default `1120px`). A number is treated as `px`. */
  readonly max?: CSSValue;
  /** Horizontal padding as a space-scale key (default `'4'`). */
  readonly padX?: SpaceKey;
  /** Center the container horizontally (default `true`). */
  readonly center?: boolean;
}

/** A width-capped, centered content column with symmetric horizontal padding. */
export function container(opts: ContainerOptions = {}): string {
  const def: StyleDef = {
    width: '100%',
    maxWidth: opts.max ?? 1120,
    paddingLeft: space(opts.padX ?? '4'),
    paddingRight: space(opts.padX ?? '4'),
    ...(opts.center === false ? {} : { marginLeft: 'auto', marginRight: 'auto' }),
  };
  return style(def);
}

export interface StackOptions {
  /** Gap between children as a space-scale key (default `'4'`). */
  readonly gap?: SpaceKey;
  /** Cross-axis alignment (`align-items`). */
  readonly align?: 'start' | 'center' | 'end' | 'stretch';
  /** Main-axis distribution (`justify-content`). */
  readonly justify?: 'start' | 'center' | 'end' | 'between' | 'around';
}

const ALIGN: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' };
const JUSTIFY: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between', around: 'space-around',
};

/** A vertical fl<!---->ex column with a token-scaled gap. */
export function stack(opts: StackOptions = {}): string {
  return style({
    display: 'flex',
    flexDirection: 'column',
    gap: space(opts.gap ?? '4'),
    ...(opts.align ? { alignItems: ALIGN[opts.align] } : {}),
    ...(opts.justify ? { justifyContent: JUSTIFY[opts.justify] } : {}),
  });
}

export interface RowOptions extends StackOptions {
  /** Allow children to wrap onto multiple lines (default `false`). */
  readonly wrap?: boolean;
}

/** A horizontal flex row with a token-scaled gap. */
export function row(opts: RowOptions = {}): string {
  return style({
    display: 'flex',
    flexDirection: 'row',
    gap: space(opts.gap ?? '4'),
    alignItems: opts.align ? ALIGN[opts.align] : 'center',
    ...(opts.justify ? { justifyContent: JUSTIFY[opts.justify] } : {}),
    ...(opts.wrap ? { flexWrap: 'wrap' } : {}),
  });
}

export interface GridOptions {
  /** Fixed column count, or `'auto'` for a responsive auto-fill track. */
  readonly columns?: number | 'auto';
  /** Minimum track width for the `'auto'` mode (default `220px`). */
  readonly min?: CSSValue;
  /** Gap between cells as a space-scale key (default `'4'`). */
  readonly gap?: SpaceKey;
}

/** A CSS grid with either a fixed column count or an auto-fill responsive track. */
export function grid(opts: GridOptions = {}): string {
  const columns = opts.columns ?? 'auto';
  const min = typeof opts.min === 'number' ? `${opts.min}px` : opts.min ?? '220px';
  const template = columns === 'auto'
    ? `repeat(auto-fill, minmax(${min}, 1fr))`
    : `repeat(${columns}, minmax(0, 1fr))`;
  return style({ display: 'grid', gridTemplateColumns: template, gap: space(opts.gap ?? '4') });
}

export interface CenterOptions {
  /** Use inline-flex instead of block flex (default `false`). */
  readonly inline?: boolean;
  /** Minimum height of the centering box (e.g. `'100vh'`). */
  readonly minHeight?: CSSValue;
}

/** Center a single child on both axes. */
export function center(opts: CenterOptions = {}): string {
  return style({
    display: opts.inline ? 'inline-flex' : 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...(opts.minHeight !== undefined ? { minHeight: opts.minHeight } : {}),
  });
}

export interface SpacerOptions {
  /** Fixed size (both dimensions). When omitted the spacer flexes to fill. */
  readonly size?: CSSValue;
}

/** A flexible gap: fills available space, or a fixed box when `size` is given. */
export function spacer(opts: SpacerOptions = {}): string {
  return opts.size !== undefined
    ? style({ flex: '0 0 auto', width: opts.size, height: opts.size })
    : style({ flex: '1 1 0%' });
}

/** The layout primitive family (§12), exported as one namespace object. */
export const layout = { container, stack, row, grid, center, spacer } as const;
