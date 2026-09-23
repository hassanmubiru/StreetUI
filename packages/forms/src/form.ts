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

export function createForm<T extends FormValues>(config: FormConfig<T>): Form<T> {
  const names = Object.keys(config.initialValues) as Array<keyof T & string>;
  const validators = config.validators ?? ({} as FormValidators<T>);

  // While true, value changes originate from setValues()/reset() and must NOT
  // mark a field touched. Batch flushes run synchronously inside batch(), i.e.
  // before this flag is reset, so guarding around batch() is sound.
  let programmatic = false;

  const fields = new Map<string, FieldInternal>();

  for (const name of names) {
    // Keys come from Object.keys(initialValues), so the value is always present;
    // the annotation defeats noUncheckedIndexedAccess widening to `| undefined`.
    const initial: string = config.initialValues[name] as string;
    const value = signal<string>(initial);
    const touched = signal<boolean>(false);
    const error = derived<string | undefined>(() =>
      runValidators(value.get(), validators[name]),
    );
    const valid = derived<boolean>(() => error.get() === undefined);
    const dirty = derived<boolean>(() => value.get() !== initial);

    // Mark touched on the first genuine (non-programmatic) value change.
    const unsub = value.subscribe(() => {
      if (!programmatic) touched.set(true);
    });

    const api: Field = {
      name,
      value,
      error,
      touched,
      dirty,
      valid,
      setValue(next: string): void {
        value.set(next);
      },
      markTouched(next = true): void {
        touched.set(next);
      },
      reset(): void {
        programmatic = true;
        try {
          batch(() => {
            value.set(initial);
            touched.set(false);
          });
        } finally {
          programmatic = false;
        }
      },
    };

    fields.set(name, { api, value, touched, error, valid, dirty, initial, unsub });
  }

  const field = (name: string): FieldInternal => {
    const f = fields.get(name);
    if (f === undefined) throw new Error(`Unknown form field: ${name}`);
    return f;
  };

  const values = derived<T>(() => {
    const out: Record<string, string> = {};
    for (const name of names) out[name] = field(name).value.get();
    return out as T;
  });

  const errors = derived<Partial<Record<keyof T, string>>>(() => {
    const out: Partial<Record<keyof T, string>> = {};
    for (const name of names) {
      const e = field(name).error.get();
      if (e !== undefined) out[name] = e;
    }
    return out;
  });

  const touchedMap = derived<Partial<Record<keyof T, boolean>>>(() => {
    const out: Partial<Record<keyof T, boolean>> = {};
    for (const name of names) out[name] = field(name).touched.get();
    return out;
  });

  const dirty = derived<boolean>(() => names.some((n) => field(n).dirty.get()));
  const valid = derived<boolean>(() => names.every((n) => field(n).valid.get()));

  const status = signal<SubmitStatus>('idle');
  const submitting = derived<boolean>(() => status.get() === 'submitting');
  const submitted = derived<boolean>(() => status.get() === 'success');
  const submitError = signal<unknown>(undefined);

  function setValues(partial: Partial<T>): void {
    programmatic = true;
    try {
      batch(() => {
        for (const name of names) {
          const next = partial[name];
          if (next !== undefined) field(name).value.set(next);
        }
      });
    } finally {
      programmatic = false;
    }
  }

  function reset(): void {
    programmatic = true;
    try {
      batch(() => {
        for (const name of names) {
          const f = field(name);
          f.value.set(f.initial);
          f.touched.set(false);
        }
        status.set('idle');
        submitError.set(undefined);
      });
    } finally {
      programmatic = false;
    }
  }

  async function submit(): Promise<void> {
    // Touch every field so validation errors become visible on submit attempts.
    batch(() => {
      for (const name of names) field(name).touched.set(true);
    });
    if (!valid.peek()) {
      // Invalid — do not enter the submitting lifecycle; field errors now show.
      return;
    }
    submitError.set(undefined);
    status.set('submitting');
    try {
      await config.onSubmit?.(values.peek());
      status.set('success');
    } catch (err) {
      submitError.set(err);
      status.set('error');
    }
  }

  function dispose(): void {
    for (const f of fields.values()) {
      f.unsub();
      f.error.dispose();
      f.valid.dispose();
      f.dirty.dispose();
    }
    values.dispose();
    errors.dispose();
    touchedMap.dispose();
    dirty.dispose();
    valid.dispose();
    submitting.dispose();
    submitted.dispose();
  }

  return {
    values,
    errors,
    touched: touchedMap,
    dirty,
    valid,
    submitting,
    submitted,
    status,
    submitError,
    field: (name) => field(name).api,
    setValues,
    submit,
    reset,
    dispose,
  };
}

