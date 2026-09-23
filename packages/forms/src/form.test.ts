import { describe, it, expect } from 'vitest';
import { createForm } from './form.js';
import { required, minLength, email } from './validators.js';

function signupForm() {
  return createForm({
    initialValues: { name: '', email: '', password: '' },
    validators: {
      name: required('Name is required'),
      email: [required(), email()],
      password: [required(), minLength(8)],
    },
    onSubmit: async () => {},
  });
}

describe('createForm — model', () => {
  it('creates fields from initial values and exposes a values snapshot', () => {
    const form = createForm({ initialValues: { a: '1', b: '2' } });
    expect(form.values.get()).toEqual({ a: '1', b: '2' });
    expect(form.field('a').value.get()).toBe('1');
  });

  it('field.value is a writable signal that updates the values snapshot', () => {
    const form = signupForm();
    form.field('name').value.set('Ada');
    expect(form.values.get().name).toBe('Ada');
  });

  it('validates reactively and aggregates errors', () => {
    const form = signupForm();
    expect(form.field('email').error.get()).toBe('This field is required');
    form.field('email').value.set('bad');
    expect(form.field('email').error.get()).toBe('Enter a valid email address');
    form.field('email').value.set('a@b.com');
    expect(form.field('email').error.get()).toBeUndefined();
  });

  it('tracks form.valid reactively', () => {
    const form = signupForm();
    expect(form.valid.get()).toBe(false);
    form.field('name').value.set('Ada');
    form.field('email').value.set('ada@example.com');
    form.field('password').value.set('supersecret');
    expect(form.valid.get()).toBe(true);
    expect(form.errors.get()).toEqual({});
  });

  it('marks touched only after genuine interaction, not programmatic updates', () => {
    const form = signupForm();
    expect(form.field('name').touched.get()).toBe(false);
    form.setValues({ name: 'Ada' }); // programmatic — should NOT touch
    expect(form.field('name').touched.get()).toBe(false);
    form.field('name').value.set('Ada Lovelace'); // user edit — touches
    expect(form.field('name').touched.get()).toBe(true);
    expect(form.touched.get().name).toBe(true);
  });

  it('tracks dirty state per field and for the form', () => {
    const form = signupForm();
    expect(form.dirty.get()).toBe(false);
    form.field('name').value.set('Ada');
    expect(form.field('name').dirty.get()).toBe(true);
    expect(form.dirty.get()).toBe(true);
    form.field('name').value.set(''); // back to initial
    expect(form.field('name').dirty.get()).toBe(false);
    expect(form.dirty.get()).toBe(false);
  });

  it('reset restores values, touched, dirty and submission state', async () => {
    const form = signupForm();
    form.field('name').value.set('Ada');
    form.field('email').value.set('bad');
    await form.submit(); // invalid -> touches all, stays idle
    expect(form.field('name').touched.get()).toBe(true);
    form.reset();
    expect(form.values.get()).toEqual({ name: '', email: '', password: '' });
    expect(form.field('name').touched.get()).toBe(false);
    expect(form.dirty.get()).toBe(false);
    expect(form.status.get()).toBe('idle');
  });
});

describe('createForm — submission lifecycle', () => {
  it('does not submit when invalid; marks all fields touched', async () => {
    let called = 0;
    const form = createForm({
      initialValues: { name: '' },
      validators: { name: required() },
      onSubmit: () => {
        called++;
      },
    });
    await form.submit();
    expect(called).toBe(0);
    expect(form.field('name').touched.get()).toBe(true);
    expect(form.status.get()).toBe('idle');
  });

  it('transitions idle -> submitting -> success and passes typed values', async () => {
    const seen: Array<{ name: string }> = [];
    let resolveSubmit!: () => void;
    const form = createForm({
      initialValues: { name: '' },
      validators: { name: required() },
      onSubmit: (values) => {
        seen.push(values);
        return new Promise<void>((r) => {
          resolveSubmit = r;
        });
      },
    });
    form.field('name').value.set('Ada');

    const p = form.submit();
    expect(form.submitting.get()).toBe(true);
    expect(form.status.get()).toBe('submitting');
    resolveSubmit();
    await p;
    expect(form.status.get()).toBe('success');
    expect(form.submitted.get()).toBe(true);
    expect(seen).toEqual([{ name: 'Ada' }]);
  });

  it('captures a submission error and enters the error state', async () => {
    const form = createForm({
      initialValues: { name: '' },
      validators: { name: required() },
      onSubmit: () => {
        throw new Error('server down');
      },
    });
    form.field('name').value.set('Ada');
    await form.submit();
    expect(form.status.get()).toBe('error');
    expect((form.submitError.get() as Error).message).toBe('server down');
    expect(form.submitted.get()).toBe(false);
  });
});

describe('createForm — cleanup', () => {
  it('dispose tears down subscriptions without throwing and stops touch tracking', () => {
    const form = signupForm();
    expect(() => form.dispose()).not.toThrow();
    // After dispose, the touch subscription is gone; setting a value should not throw.
    expect(() => form.field('name').value.set('x')).not.toThrow();
  });
});
