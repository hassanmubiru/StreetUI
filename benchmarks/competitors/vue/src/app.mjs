// DEV-ONLY benchmark artifact — Vue 3.5 competitor workload. NOT part of the `streetui` runtime.
/**
 * Vue 3.5 implementations of the shared benchmark workload (scenarios A–H),
 * written with render functions (`h`) and Vue's reactivity primitives
 * (`ref`, `reactive`) — the "render fns" path the task allows, which keeps the
 * dependency set to `vue` (+ `@vue/server-renderer` for SSR) with no SFC
 * compiler. Each factory returns the component plus the reactive handles the
 * scenario runner drives, so updates are triggered idiomatically by writing to
 * a ref/reactive object (Vue then flushes on the next microtask — the runner
 * awaits `nextTick`).
 *
 * Every visible row is one element with a single text child, matching
 * StreetUI's `s.text(...)`, and keyed lists use a real `key`.
 */

import { defineComponent, h, ref, reactive } from 'vue';

export function makeFlat(n) {
  const App = defineComponent({
    setup() {
      return () =>
        h(
          'section',
          { class: 'main' },
          Array.from({ length: n }, (_, i) => h('div', { class: 'row', key: i }, `node ${i}`)),
        );
    },
  });
  return { App };
}

export function makeOneBound(n) {
  const live = ref('init');
  const App = defineComponent({
    setup() {
      return () =>
        h('section', { class: 'main' }, [
          ...Array.from({ length: n }, (_, i) => h('div', { class: 'row', key: i }, `static ${i}`)),
          h('div', { class: 'live', id: 'live' }, live.value),
        ]);
    },
  });
  return { App, live };
}

export function makeFanOut(n) {
  const val = ref('init');
  const App = defineComponent({
    setup() {
      return () =>
        h(
          'section',
          { class: 'main' },
          Array.from({ length: n }, (_, i) => h('div', { class: 'sub', key: i }, val.value)),
        );
    },
  });
  return { App, val };
}

export function makeList(initial) {
  const items = ref(initial);
  const App = defineComponent({
    setup() {
      return () =>
        h(
          'section',
          { class: 'main' },
          items.value.map((it) => h('div', { class: 'cell', key: it.id }, it.label)),
        );
    },
  });
  return { App, items };
}

export function makeDeep() {
  const user = reactive({
    profile: { name: 'Ada' },
    preferences: { theme: 'dark' },
    permissions: { admin: false },
    activity: { lastSeen: 0, streak: 0 },
  });
  const App = defineComponent({
    setup() {
      return () =>
        h('section', { class: 'main' }, [
          h('div', { class: 'leaf' }, user.profile.name),
          h('div', { class: 'leaf' }, user.preferences.theme),
          h('div', { class: 'leaf' }, String(user.permissions.admin)),
          h('div', { class: 'leaf', id: 'activity' }, `seen:${user.activity.lastSeen}`),
        ]);
    },
  });
  return { App, user };
}
