import { Signal, ReadonlySignal } from '@streetui/state';

/**
 * A small, sync validation system.
 *
 * A `Validator` maps a string field value to an error message, or `undefined`
 * when the value is acceptable. This is deliberately tiny — the built-ins cover
 * the common cases (`required`, `minLength`, `maxLength`, `email`, `pattern`)
 * and anything else is just a plain function `(value: string) => string | undefined`.
 *
 * Validators for a field run in order and the FIRST error wins, so list
 * `required` first if a field is mandatory.
 *
 * Async validation is intentionally NOT part of this core. It can be layered on
 * top with `@streetui/state`'s `resource()` (kick off a resource on value
 * change and surface `resource.error` alongside the field error) without
 * destabilising the synchronous validity model here.
 */
type Validator = (value: string) => string | undefined;
/** Fails when the trimmed value is empty. */
declare function required(message?: string): Validator;
/** Fails when the value is shorter than `length` characters. */
declare function minLength(length: number, message?: string): Validator;
/** Fails when the value is longer than `length` characters. */
declare function maxLength(length: number, message?: string): Validator;
/** Fails when a non-empty value is not a plausible email address. */
declare function email(message?: string): Validator;
/** Fails when a non-empty value does not match `regex`. */
declare function pattern(regex: RegExp, message?: string): Validator;
/** Run a validator (or ordered list) and return the first error, if any. */
declare function runValidators(value: string, validators: Validator | ReadonlyArray<Validator> | undefined): string | undefined;

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

/** Form values are a flat, typed record of string fields (HTML input values). */
type FormValues = Record<string, string>;
interface Field {
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
type FormValidators<T extends FormValues> = {
    readonly [K in keyof T]?: Validator | ReadonlyArray<Validator>;
};
interface FormConfig<T extends FormValues> {
    readonly initialValues: T;
    readonly validators?: FormValidators<T>;
    /** Called by `submit()` once all fields are valid. May be async. */
    readonly onSubmit?: (values: T) => void | Promise<void>;
}
type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';
interface Form<T extends FormValues> {
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
declare function createForm<T extends FormValues>(config: FormConfig<T>): Form<T>;

export { type Field, type Form, type FormConfig, type FormValidators, type FormValues, type SubmitStatus, type Validator, createForm, email, maxLength, minLength, pattern, required, runValidators };
