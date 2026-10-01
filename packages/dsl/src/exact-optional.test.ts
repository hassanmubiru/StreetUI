/**
 * F-3 regression — public DSL option fields accept an explicit `undefined`
 * under `exactOptionalPropertyTypes`.
 *
 * The root tsconfig enables `exactOptionalPropertyTypes`, under which a field
 * declared `prop?: T` REJECTS an explicitly-passed `undefined` (only omission
 * is allowed). A consumer that forwards a possibly-`undefined` value — e.g.
 * `doc?.summary` of type `string | undefined` — into an optional DSL option
 * then fails to compile. Because every builder guards each option with
 * `!== undefined` (see `applyA11yProps`/`containerProps`), passing `undefined`
 * is semantically identical to omission, so the option types model that by
 * declaring the fields `prop?: T | undefined`.
 *
 * These are COMPILE-TIME assertions: if any widened field is narrowed back to
 * `prop?: T`, the assignments below stop type-checking and `tsc --noEmit`
 * (the package's `typecheck` task) fails — a regression caught before release.
 * The runtime body is a trivial truthy check so the file is also a valid test.
 */

import { describe, it, expect } from 'vitest';
import type {
  TextOptions,
  HeadingOptions,
  ButtonOptions,
  ControlledInputOptions,
  LinkOptions,
  ImageOptions,
  CodeOptions,
  ContainerOptions,
  OverlayOptions,
  A11yOptions,
} from './dsl-types.js';

// A value whose type is exactly `T | undefined` — the shape a consumer gets
// from an optional property access (`doc?.summary`) or a `?:`-typed field.
const maybe = <T>(v: T): T | undefined => (Math.random() < 2 ? v : undefined);

const s: string | undefined = maybe('x');
const n: number | undefined = maybe(1);
const b: boolean | undefined = maybe(true);
const fn: (() => void) | undefined = maybe(() => {});

// ── Each of these object literals must type-check. They assign a
//    `… | undefined` value to an optional field; that only compiles when the
//    field is declared `?: T | undefined`. ───────────────────────────────────

const _text: TextOptions = { class: s, id: s, role: s, ariaLabel: s };
const _heading: HeadingOptions = { level: maybe<1 | 2 | 3>(1), class: s };
const _button: ButtonOptions = { class: s, onClick: fn, disabled: b };
const _input: ControlledInputOptions = { placeholder: s, onInput: maybe((_v: string) => {}) };
const _link: LinkOptions = { href: '/x', class: s, external: b, onClick: fn };
const _image: ImageOptions = { src: '/a.png', alt: 'a', width: n, height: n };
const _code: CodeOptions = { class: s, id: s, language: s };
const _container: ContainerOptions = { class: s, id: s, key: s };
const _overlay: OverlayOptions = { open: true, onClose: fn, initialFocusId: s, closeOnEscape: b };
const _a11y: A11yOptions = { ariaHidden: b, tabIndex: n, ariaExpanded: b };

describe('F-3 — optional DSL option fields accept explicit undefined', () => {
  it('type-checks assignments of `T | undefined` into optional options', () => {
    // The real assertion is the compile step above; this keeps vitest happy.
    for (const o of [
      _text, _heading, _button, _input, _link, _image, _code, _container, _overlay, _a11y,
    ]) {
      expect(o).toBeTypeOf('object');
    }
  });
});
