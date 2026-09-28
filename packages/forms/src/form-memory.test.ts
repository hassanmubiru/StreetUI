/**
 * Form memory stress (StreetUI 2.0 §26).
 *
 * Creates and disposes forms at 50 / 100 / 200 instances and proves teardown
 * leaves NO residue:
 *   • after `dispose()`, every field's value signal has zero live observers —
 *     the internal touch-subscription and the error/valid/dirty derived
 *     consumers are all released (no leaked subscribers or derived consumers);
 *   • a post-dispose `field.value.set(...)` is a safe no-op that no longer marks
 *     the field touched (the subscription is gone).
 *
 * Deterministic structural assertions (observer counts) — no timing.
 */
import { describe, it, expect } from 'vitest';
import { observerCount } from '@streetui/state';
import { createForm } from './form.js';
import { required, minLength, email } from './validators.js';

function makeForm() {
  const form = createForm({
    initialValues: { name: '', email: '', password: '' },
    validators: {
      name: [required(), minLength(2)],
      email: [required(), email()],
      password: [required(), minLength(8)],
    },
    onSubmit: async () => {},
  });
  // Force the lazy error/valid/dirty deriveds to register as consumers of each
  // field's value signal, so there is a real subscription graph to tear down.
  form.errors.get();
  form.valid.get();
  form.dirty.get();
  form.values.get();
  return form;
}

describe.each([50, 100, 200])('form memory stress — %i instances', (N) => {
  it('create → dispose N forms leaves zero observers on every field value', () => {
    for (let i = 0; i < N; i++) {
      const form = makeForm();

      // A live form has observers on each field value (touch sub + deriveds).
      const nameVal = form.field('name').value;
      expect((observerCount(nameVal) ?? 0)).toBeGreaterThan(0);

      form.dispose();

      // Teardown released every subscriber and derived consumer.
      for (const f of ['name', 'email', 'password'] as const) {
        expect(observerCount(form.field(f).value)).toBe(0);
      }

      // Post-dispose writes are safe no-ops: the touch subscription is gone, so
      // touched stays false even though we mutate the raw value signal.
      form.field('name').value.set('late');
      expect(form.field('name').touched.get()).toBe(false);
    }
  });
});
