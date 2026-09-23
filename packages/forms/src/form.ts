/**
 * Reactive form model built entirely on `@streetui/state` signals.
 *
 * There is no second state system here: every piece of form state (`values`,
 * `errors`, `touched`, `dirty`, `valid`, submission status) is a signal or a
 * derived signal, so it composes with the renderer's existing reactive bindings.
 * A field's `value` is a writable `Signal<string>`, which plugs straight into
 * the DSL's `input({ bind })` — typing updates form state and programmatic
 * updates update the input, through the one binding the renderer already wires.
 */

import {
  signal,
  derived,
  batch,
  DerivedSignal,
  type Signal,
  type ReadonlySignal,
  type Unsubscribe,
} from '@streetui/state';
import { type Validator, runValidators } from './validators.js';

/** Form values are a flat, typed record of string fields (HTML input values). */
export type FormValues = Record<string, string>;

export interface Field {
  readonly name: string;
  /** Writable value signal — pass to `input({ bind: field.value })`. */
  readonly value: Signal<string>;
  /** Current validation error, or `undefined` when the field is valid. */
  readonly error: ReadonlySignal<string | undefined>;
  /** True once the field has received a genuine user interaction. */
  readonly touched: ReadonlySignal<boolean>;
  /** True when the value differs from its initial value. */
  readonly dirty: ReadonlySignal<boolean>;
  /** True when the field has no validation error. */
  readonly valid: ReadonlySignal<boolean>;
  /** Programmatically set the value (does not mark the field touched). */
  setValue(next: string): void;
  /** Force the touched flag (defaults to true). */
  markTouched(touched?: boolean): void;
  /** Restore this field's initial value and clear its touched flag. */
  reset(): void;
}

export type FormValidators<T extends FormValues> = {
  readonly [K in keyof T]?: Validator | ReadonlyArray<Validator>;
};

export interface FormConfig<T extends FormValues> {
  readonly initialValues: T;
  readonly validators?: FormValidators<T>;
  /** Called by `submit()` once all fields are valid. May be async. */
  readonly onSubmit?: (values: T) => void | Promise<void>;
}

export type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface Form<T extends FormValues> {
  readonly values: ReadonlySignal<T>;
  readonly errors: ReadonlySignal<Partial<Record<keyof T, string>>>;
  readonly touched: ReadonlySignal<Partial<Record<keyof T, boolean>>>;
  readonly dirty: ReadonlySignal<boolean>;
  readonly valid: ReadonlySignal<boolean>;
  readonly submitting: ReadonlySignal<boolean>;
  readonly submitted: ReadonlySignal<boolean>;
  readonly status: ReadonlySignal<SubmitStatus>;
  readonly submitError: ReadonlySignal<unknown>;
  /** Access the reactive state + setters for one field. */
  field<K extends keyof T & string>(name: K): Field;
  /** Merge a partial set of values in (does not mark fields touched). */
  setValues(partial: Partial<T>): void;
  /** Validate, mark all fields touched, then run `onSubmit` if valid. */
  submit(): Promise<void>;
  /** Restore initial values and clear errors/touched/dirty/submission state. */
  reset(): void;
  /** Tear down all field subscriptions and derived signals. */
  dispose(): void;
}

interface FieldInternal {
  readonly api: Field;
  readonly value: Signal<string>;
  readonly touched: Signal<boolean>;
  readonly error: DerivedSignal<string | undefined>;
  readonly valid: DerivedSignal<boolean>;
  readonly dirty: DerivedSignal<boolean>;
  readonly initial: string;
  readonly unsub: Unsubscribe;
}

// __FORM_IMPL__
