/**
 * Tests for the component-focused testing helpers (§22): renderComponent,
 * hydrateComponent, findComponent/findAllComponents/getComponentName, trigger.
 * Exercised through the same real renderer/SSR path the framework uses.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { component, type ContainerDSL } from '@streetui/dsl';
import { signal, type Signal } from '@streetui/state';
import {
  renderComponent,
  hydrateComponent,
  findComponent,
  findAllComponents,
  getComponentName,
  trigger,
} from './component.js';

beforeEach(() => {
  resetIdCounter();
  document.body.innerHTML = '';
});

describe('renderComponent', () => {
  it('mounts a single component in a host app and returns its root element', () => {
    const Card = component<{ title: string }>((props) => (c) => {
      c.heading(props.title, { level: 3 });
    }, { name: 'Card' });

    const r = renderComponent(Card, { title: 'Hello' });
    expect(r.component.tagName).toBe('DIV');
    expect(getComponentName(r.component)).toBe('Card');
    expect(r.component.querySelector('h3')?.textContent).toBe('Hello');
    r.unmount();
  });

  it('passes children through to a component slot', () => {
    const Panel = component<{ heading: string }>((props, ctx) => (c) => {
      c.heading(props.heading, { level: 2 });
      c.container('slot', (slot) => ctx.renderChildren(slot), { id: 'slot' });
    }, { name: 'Panel' });

    const r = renderComponent(Panel, { heading: 'T' }, (slot: ContainerDSL) => {
      slot.text('slotted', { id: 'child' });
    });
    expect(r.find('#slot #child').textContent).toBe('slotted');
    r.unmount();
  });

  it('drives local state reactively through trigger + flush', async () => {
    const Toggle = component((_p, _ctx) => {
      const open = signal(false);
      return (c) => {
        c.button('toggle', { id: 'tgl', onClick: () => open.set(!open.peek()) });
        c.when(open, (b) => b.text('OPEN', { id: 'body' }));
      };
    }, { name: 'Toggle' });

    const r = renderComponent(Toggle, {});
    expect(r.query('#body')).toBeNull();
    trigger(r.find('#tgl'), 'click');
    r.flush();
    expect(r.query('#body')?.textContent).toBe('OPEN');
    r.unmount();
  });
});

describe('findComponent / findAllComponents', () => {
  it('locates instances by name and disambiguates', () => {
    const Item = component<{ n: number }>((props) => (c) => {
      c.text(String(props.n));
    }, { name: 'Item' });
    const List = component((_p) => (c) => {
      c.component('a', Item, { n: 1 });
      c.component('b', Item, { n: 2 });
    }, { name: 'List' });

    const r = renderComponent(List, {});
    expect(findAllComponents(r.container, 'Item')).toHaveLength(2);
    expect(getComponentName(findComponent(r.container, 'List'))).toBe('List');
    expect(() => findComponent(r.container, 'Item')).toThrow(/2 components/);
    expect(() => findComponent(r.container, 'Nope')).toThrow(/No component/);
    r.unmount();
  });
});

describe('trigger', () => {
  it('dispatches a bubbling click that a component onClick handles', () => {
    let clicks = 0;
    const Btn = component((_p) => (c) => {
      c.button('b', { id: 'b', onClick: () => { clicks++; } });
    }, { name: 'Btn' });

    const r = renderComponent(Btn, {});
    trigger(r.find('#b'), 'click');
    expect(clicks).toBe(1);
    r.unmount();
  });

  it('dispatches keyboard events with forwarded init fields', () => {
    const Host = component((_p) => (c) => {
      c.button('k', { id: 'k' });
    }, { name: 'Host' });

    const r = renderComponent(Host, {});
    const el = r.find('#k');
    let key: string | null = null;
    el.addEventListener('keydown', (e) => { key = (e as KeyboardEvent).key; });
    trigger(el, 'keydown', { key: 'Escape' });
    expect(key).toBe('Escape');
    r.unmount();
  });
});

describe('hydrateComponent', () => {
  it('SSR-renders then hydrates a component in place and stays reactive', async () => {
    const name = signal('Ada');
    const build = () => {
      const Name = component<{ name: Signal<string> }>((props) => (c) => {
        c.text(props.name, { id: 'n' });
      }, { name: 'Name' });
      return { def: Name, props: { name } };
    };

    const r = hydrateComponent(build);
    expect(r.serverHtml).toContain('data-streetui-component="Name"');
    expect(r.container.querySelector('#n')?.textContent).toBe('Ada');
    expect(r.diagnostics).toHaveLength(0);

    name.set('Grace');
    r.flush();
    expect(r.container.querySelector('#n')?.textContent).toBe('Grace');
    r.unmount();
  });
});
