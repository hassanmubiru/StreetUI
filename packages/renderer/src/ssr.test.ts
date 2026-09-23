import { describe, it, expect } from 'vitest';
import { resetIdCounter } from '@streetui/core';
import { streetui } from '@streetui/dsl';
import { signal } from '@streetui/state';
import { compile } from '@streetui/compiler';
import { BrowserDOMAdapter } from '@streetui/dom';
import { renderToString } from './ssr.js';
import { serializeState, readState, STATE_MARKER_ATTR } from './dehydrate.js';

function render(buildFn: (app: ReturnType<typeof streetui.app>) => void): string {
  resetIdCounter();
  const app = streetui.app({ name: 'ssr-test' });
  buildFn(app);
  return renderToString(compile(app));
}

describe('renderToString — server rendering', () => {
  it('renders headings, text and nested structure', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.heading('Title');
        page.section('body', (s) => {
          s.text('Hello');
        });
      });
    });
    expect(html).toContain('<h1>Title</h1>');
    expect(html).toContain('<section');
    expect(html).toContain('<span>Hello</span>');
  });

  it('renders attributes and class', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.container('box', () => {}, { id: 'main', class: 'a b' });
      });
    });
    expect(html).toContain('id="main"');
    expect(html).toContain('class="a b"');
  });

  it('self-closes void elements (img/input)', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.image({ src: '/x.png', alt: 'x' });
        page.input({ placeholder: 'name' });
      });
    });
    expect(html).toMatch(/<img[^>]*\/>/);
    expect(html).toMatch(/<input[^>]*\/>/);
    expect(html).not.toContain('</img>');
    expect(html).not.toContain('</input>');
  });

  it('escapes text content and attribute values (XSS-safe)', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.text('<script>alert(1)</script>');
        page.container('c', () => {}, { id: '"><b>' });
      });
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;&gt;&lt;b&gt;');
  });

  it('renders reactive-list initial items with identity keys', () => {
    const items = signal([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
    const html = render((app) => {
      app.page('home', (page) => {
        page.listOf('rows', items, (item, _i, c) => c.text(item.name));
      });
    });
    expect(html).toContain('data-streetui-key="id:1"');
    expect(html).toContain('data-streetui-key="id:2"');
    expect(html).toContain('<span>A</span>');
    expect(html).toContain('<span>B</span>');
  });

  it('renders the true branch of when() and nothing for false', () => {
    const onHtml = render((app) => {
      app.page('home', (page) => {
        page.when(signal(true), (b) => b.text('SHOWN'));
      });
    });
    expect(onHtml).toContain('SHOWN');

    const offHtml = render((app) => {
      app.page('home', (page) => {
        page.when(signal(false), (b) => b.text('SHOWN'));
      });
    });
    expect(offHtml).not.toContain('SHOWN');
  });

  it('reflects a controlled input value into the HTML', () => {
    const html = render((app) => {
      app.page('home', (page) => {
        page.input({ value: 'seeded' });
      });
    });
    expect(html).toContain('value="seeded"');
  });

  it('does not leave live subscriptions after render (lifecycle)', () => {
    resetIdCounter();
    const label = signal('a');
    const app = streetui.app({ name: 'life' });
    app.page('home', (page) => page.heading(label));
    const compiled = compile(app);
    const html = renderToString(compiled);
    expect(html).toContain('<h1>a</h1>');
    // The SSR instance was disposed; mutating the signal must not throw and
    // there is no DOM to update on the server.
    expect(() => label.set('b')).not.toThrow();
  });
});

describe('dehydrate — state transfer', () => {
  it('serializes a state map into an inert JSON script island', () => {
    const script = serializeState({ 'user:1': { name: 'Ada' } });
    expect(script).toContain(`type="application/json"`);
    expect(script).toContain(STATE_MARKER_ATTR);
    expect(script).toContain('Ada');
  });

  it('returns empty string for an empty map', () => {
    expect(serializeState({})).toBe('');
  });

  it('escapes </script> and separators so the island cannot break out', () => {
    const script = serializeState({ payload: '</script><img onerror=x>' });
    expect(script).not.toContain('</script><img');
    expect(script).toContain('\\u003c');
  });

  it('round-trips through readState in the DOM', () => {
    const state = { 'k': { a: 1, b: [1, 2, 3] } };
    const html = serializeState(state);
    const container = document.createElement('div');
    container.innerHTML = html;
    const dom = new BrowserDOMAdapter();
    const read = readState(dom, container);
    expect(read).toEqual(state);
  });

  it('returns {} when no island is present', () => {
    const container = document.createElement('div');
    const dom = new BrowserDOMAdapter();
    expect(readState(dom, container)).toEqual({});
  });
});
