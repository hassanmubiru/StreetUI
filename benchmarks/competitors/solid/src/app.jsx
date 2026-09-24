// DEV-ONLY benchmark artifact — Solid 1.9 competitor workload. NOT part of the `streetui` runtime.
/**
 * Solid 1.9 implementations of the shared benchmark workload (scenarios A–H),
 * using Solid's fine-grained primitives idiomatically: `createSignal`,
 * `createStore`, and keyed `<For>` (plus `<Index>` for the static rows where a
 * key is meaningless). Signals/stores are created by the scenario runner and
 * passed in as props (accessors), so an update is a plain synchronous setter
 * call — Solid commits the minimal DOM change immediately (no tick needed).
 *
 * Every visible row is one element with a single text child, matching
 * StreetUI's `s.text(...)`.
 */

import { For, Index } from 'solid-js';

export function FlatList(props) {
  const rows = Array.from({ length: props.n }, (_, i) => i);
  return (
    <section class="main">
      <Index each={rows}>{(i) => <div class="row">{`node ${i()}`}</div>}</Index>
    </section>
  );
}

export function OneBound(props) {
  const rows = Array.from({ length: props.n }, (_, i) => i);
  return (
    <section class="main">
      <Index each={rows}>{(i) => <div class="row">{`static ${i()}`}</div>}</Index>
      <div class="live" id="live">{props.live()}</div>
    </section>
  );
}

export function FanOut(props) {
  const rows = Array.from({ length: props.n }, (_, i) => i);
  return (
    <section class="main">
      <Index each={rows}>{() => <div class="sub">{props.val()}</div>}</Index>
    </section>
  );
}

export function KeyedList(props) {
  return (
    <section class="main">
      <For each={props.items()}>{(it) => <div class="cell">{it.label}</div>}</For>
    </section>
  );
}

export function DeepState(props) {
  const user = props.user;
  return (
    <section class="main">
      <div class="leaf">{user.profile.name}</div>
      <div class="leaf">{user.preferences.theme}</div>
      <div class="leaf">{String(user.permissions.admin)}</div>
      <div class="leaf" id="activity">{`seen:${user.activity.lastSeen}`}</div>
    </section>
  );
}
