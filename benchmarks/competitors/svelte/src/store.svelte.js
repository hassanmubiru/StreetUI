// DEV-ONLY benchmark artifact — Svelte 5 universal reactive store. NOT part of the `streetui` runtime.
// `$state` in a `.svelte.js` module is Svelte 5's idiomatic cross-module
// reactivity: components import this object and read it; the scenario runner
// mutates it and the mounted component updates. Deep reactivity covers the
// nested `user` branch used by scenario E.
export const store = $state({
  live: 'init',
  val: 'init',
  items: [],
  user: {
    profile: { name: 'Ada' },
    preferences: { theme: 'dark' },
    permissions: { admin: false },
    activity: { lastSeen: 0, streak: 0 },
  },
});
