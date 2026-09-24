// DEV-ONLY benchmark artifact — React 19 competitor workload. NOT part of the `streetui` runtime.
/**
 * React 19 implementations of the shared benchmark workload (scenarios A–H).
 *
 * These components are the fair React equivalents of the StreetUI apps in
 * `packages/benchmarks/v11-scenarios.mjs`:
 *   - flat list of N rows            (A initial render, F SSR, G hydration)
 *   - N static rows + ONE bound cell (B single reactive update)
 *   - N cells bound to ONE value     (D reactive fan-out)
 *   - keyed list of {id,label}       (C large list — real `key={id}`)
 *   - nested `user` object           (E deep reactive state)
 *
 * Each visible row is exactly one element with a single text child (template
 * literal, so React emits ONE text node), matching StreetUI's `s.text(...)`.
 *
 * State setters are surfaced to the scenario runner through a plain `bridge`
 * object registered in `useLayoutEffect` (runs synchronously after commit).
 * This lets the harness drive an update from outside React and wrap it in
 * `flushSync` for a deterministic, synchronous DOM commit — the idiomatic way
 * to force React to apply an update immediately.
 */

import { useState, useLayoutEffect } from 'react';

export function FlatList({ n }) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(
      <div className="row" key={i}>
        {`node ${i}`}
      </div>,
    );
  }
  return <section className="main">{rows}</section>;
}

export function OneBound({ n, bridge }) {
  const [live, setLive] = useState('init');
  useLayoutEffect(() => {
    bridge.setLive = setLive;
  }, [bridge]);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(
      <div className="row" key={i}>
        {`static ${i}`}
      </div>,
    );
  }
  return (
    <section className="main">
      {rows}
      <div className="live" id="live">
        {live}
      </div>
    </section>
  );
}

export function FanOut({ n, bridge }) {
  const [val, setVal] = useState('init');
  useLayoutEffect(() => {
    bridge.setVal = setVal;
  }, [bridge]);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push(
      <div className="sub" key={i}>
        {val}
      </div>,
    );
  }
  return <section className="main">{rows}</section>;
}

export function KeyedList({ initial, bridge }) {
  const [items, setItems] = useState(initial);
  useLayoutEffect(() => {
    bridge.setItems = setItems;
  }, [bridge]);
  return (
    <section className="main">
      {items.map((it) => (
        <div className="cell" key={it.id}>
          {it.label}
        </div>
      ))}
    </section>
  );
}

export function DeepState({ bridge }) {
  const [user, setUser] = useState({
    profile: { name: 'Ada' },
    preferences: { theme: 'dark' },
    permissions: { admin: false },
    activity: { lastSeen: 0, streak: 0 },
  });
  useLayoutEffect(() => {
    bridge.setUser = setUser;
  }, [bridge]);
  return (
    <section className="main">
      <div className="leaf">{user.profile.name}</div>
      <div className="leaf">{user.preferences.theme}</div>
      <div className="leaf">{String(user.permissions.admin)}</div>
      <div className="leaf" id="activity">{`seen:${user.activity.lastSeen}`}</div>
    </section>
  );
}
