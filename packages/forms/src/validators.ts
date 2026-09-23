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

export type Validator = (value: string) => string | undefined;

/** Fails when the trimmed value is empty. */
export function required(message = 'This field is required'): Validator {
  return (value) => (value.trim().length === 0 ? message : undefined);
}

/** Fails when the value is shorter than `length` characters. */
export function minLength(length: number, message?: string): Validator {
  return (value) =>
    value.length < length
      ? (message ?? `Must be at least ${length} characters`)
      : undefined;
}

/** Fails when the value is longer than `length` characters. */
export function maxLength(length: number, message?: string): Validator {
  return (value) =>
    value.length > length
      ? (message ?? `Must be at most ${length} characters`)
      : undefined;
}

// Pragmatic, dependency-free email shape check (not a full RFC 5322 parser).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fails when a non-empty value is not a plausible email address. */
export function email(message = 'Enter a valid email address'): Validator {
  return (value) => (value.length === 0 || EMAIL_RE.test(value) ? undefined : message);
}

/** Fails when a non-empty value does not match `regex`. */
export function pattern(regex: RegExp, message = 'Invalid format'): Validator {
  return (value) => (value.length === 0 || regex.test(value) ? undefined : message);
}

/** Run a validator (or ordered list) and return the first error, if any. */
export function runValidators(
  value: string,
  validators: Validator | ReadonlyArray<Validator> | undefined,
): string | undefined {
  if (validators === undefined) return undefined;
  const list = Array.isArray(validators) ? validators : [validators];
  for (const validate of list) {
    const error = validate(value);
    if (error !== undefined) return error;
  }
  return undefined;
}
