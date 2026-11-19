/**
 * StreetUI Playground — IDE UI.
 *
 * Built entirely with StreetUI (DSL → Compiler → Graph → Runtime → Renderer).
 * CodeMirror 6 is the text-editor host only; it does not participate in
 * StreetUI compilation or rendering. The Playground talks to the local
 * orchestration server's authenticated control API.
 */

import { signal } from '@streetui/state';
import { streetui } from '@streetui/dsl';
import { compile } from '@streetui/compiler';
import { createRuntime } from '@streetui/runtime';
import { createRenderer } from '@streetui/renderer';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';

const token: string = ((): string => {
  const raw = (window as unknown as { __PLAYGROUND_TOKEN__?: string }).__PLAYGROUND_TOKEN__ ?? '';
  delete (window as unknown as { __PLAYGROUND_TOKEN__?: string }).__PLAYGROUND_TOKEN__;
  return raw;
})();

// ── State ─────────────────────────────────────────────────────────────────────
const files = signal<string[]>([]);
const activePath = signal<string | null>(null);
const content = signal('');
const dirty = signal<Record<string, boolean>>({});
const projectName = signal('project');
const frameworkVersion = signal('');
const previewUrl = signal('');
const previewMode = signal<'desktop' | 'tablet' | 'mobile'>('desktop');
const status = signal<'starting' | 'ready' | 'error'>('starting');
const diagnostics = signal<Array<{ message: string; file?: string }>>([]);
const consoleLines = signal<Array<{ text: string; error: boolean }>>([]);
const buildOutput = signal('');
const panel = signal<'console' | 'diagnostics' | 'build'>('console');

// ── Control API client ────────────────────────────────────────────────────────
async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`/__playground/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

function pushConsole(text: string, error = false): void {
  consoleLines.update((lines) => [...lines.slice(-200), { text, error }]);
}

// ── CodeMirror host ────────────────────────────────────────────────────────────
let editor: EditorView | null = null;
let editorHost: HTMLElement | null = null;

function createEditor(parent: HTMLElement, doc: string): EditorView {
  return new EditorView({
    parent,
    doc,
    extensions: [
      basicSetup,
      javascript({ typescript: true }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          content.set(update.state.doc.toString());
          const p = activePath.get();
          if (p) dirty.update((d) => ({ ...d, [p]: true }));
        }
      }),
    ],
  });
}

// ── File operations ────────────────────────────────────────────────────────────
async function refreshFiles(): Promise<void> {
  const data = (await api('/files')) as { files?: string[] };
  files.set(data.files ?? []);
}

async function openFile(path: string): Promise<void> {
  if (activePath.get() === path && editor) return;
  activePath.set(path);
  let text: string | null = null;
  try {
    const data = (await api(`/file?path=${encodeURIComponent(path)}`)) as { content?: string };
    text = data.content ?? '';
    void cacheFile(path, text);
  } catch (error) {
    // Server unreachable — fall back to the last cached copy, if any.
    const cached = await getCachedFile(path);
    if (cached === null) throw error;
    text = cached;
    pushConsole(`offline: showing cached ${path}`, true);
  }
  content.set(text);
  if (editorHost) {
    editor?.destroy();
    editor = createEditor(editorHost, text);
  }
}

async function saveActive(): Promise<void> {
  const p = activePath.get();
  if (!p) return;
  await api('/file', { method: 'POST', body: JSON.stringify({ path: p, content: content.get() }) });
  dirty.update((d) => ({ ...d, [p]: false }));
  void cacheFile(p, content.get());
  pushConsole(`saved ${p}`);
}

async function runBuild(): Promise<void> {
  panel.set('build');
  buildOutput.set('building…');
  pushConsole('building…');
  const data = (await api('/build', { method: 'POST' })) as { ok?: boolean; error?: string; files?: number; durationMs?: number };
  if (data.ok) {
    buildOutput.set(`build ok — ${data.files ?? 0} files in ${data.durationMs ?? 0}ms`);
    pushConsole(`build completed (${data.files} files)`);
  } else {
    buildOutput.set(`build failed:\n${data.error ?? 'unknown error'}`);
    pushConsole(`build failed: ${data.error ?? ''}`, true);
  }
}

// ── HMR WebSocket (events → status/diagnostics/console) ────────────────────────
function connectHmr(): void {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/__streetui_hmr`);
  ws.addEventListener('open', () => status.set('ready'));
  ws.addEventListener('message', (event) => {
    let msg: { type?: string; diagnostics?: Array<{ message: string }>; message?: string };
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (msg.type === 'error') {
      status.set('error');
      diagnostics.set(msg.diagnostics ?? []);
      for (const d of msg.diagnostics ?? []) pushConsole(d.message, true);
    } else if (msg.type === 'runtime-error') {
      pushConsole(`runtime: ${msg.message ?? ''}`, true);
    } else if (msg.type === 'connected') {
      status.set('ready');
    }
  });
  ws.addEventListener('close', () => status.set('starting'));
}

// ── StreetUI DSL app ────────────────────────────────────────────────────────────
const app = streetui.app({ name: 'StreetUI Playground', version: '1.0.0' });

app.page('home', (page) => {
  page.section('root', () => {}, { class: 'pg-root' });

  page.container('header', () => {
    page.text('StreetUI', { id: 'brand', class: 'pg-brand' });
    page.text(projectName, { id: 'project', class: 'pg-project' });
    page.container('spacer', () => {}, { class: 'pg-spacer' });
    page.button('Run', { id: 'run-btn', class: 'pg-btn primary' });
    page.button('Build', { id: 'build-btn', class: 'pg-btn' });
    page.button('New', { id: 'new-btn', class: 'pg-btn' });
    page.button('Export', { id: 'export-btn', class: 'pg-btn' });
    page.button('Share', { id: 'share-btn', class: 'pg-btn' });
  }, { class: 'pg-header', id: 'header' });

  page.container('body', () => {
    page.container('explorer', () => {
      page.text('Files', { id: 'explorer-title', class: 'pg-explorer-title' });
      page.container('explorer-list', () => {}, { id: 'explorer-list' });
    }, { class: 'pg-explorer', id: 'explorer' });

    page.container('center', () => {
      page.container('tabs', () => {}, { class: 'pg-tabs', id: 'tabs' });
      page.container('editor', () => {}, { class: 'pg-editor', id: 'editor' });
    }, { class: 'pg-center', id: 'center' });

    page.container('preview', () => {
      page.container('preview-bar', () => {
        page.text(status, { id: 'preview-status', class: 'pg-preview-status' });
        page.button('Desktop', { id: 'dev-desktop', class: 'pg-btn' });
        page.button('Tablet', { id: 'dev-tablet', class: 'pg-btn' });
        page.button('Mobile', { id: 'dev-mobile', class: 'pg-btn' });
      }, { class: 'pg-preview-bar', id: 'preview-bar' });
      page.container('preview-frame-wrap', () => {
        page.container('preview-frame', () => {}, { id: 'preview-frame' });
      }, { class: 'pg-preview-frame-wrap', id: 'preview-frame-wrap' });
    }, { class: 'pg-preview', id: 'preview' });
  }, { class: 'pg-body', id: 'body' });

  page.container('bottom', () => {
    page.container('bottom-tabs', () => {
      page.button('Console', { id: 'panel-console', class: 'pg-btn' });
      page.button('Diagnostics', { id: 'panel-diagnostics', class: 'pg-btn' });
      page.button('Build', { id: 'panel-build', class: 'pg-btn' });
    }, { class: 'pg-bottom-tabs', id: 'bottom-tabs' });
    page.container('bottom-body', () => {}, { class: 'pg-bottom-body', id: 'bottom-body' });
  }, { class: 'pg-bottom', id: 'bottom' });
});

const compiled = compile(app);
const renderer = createRenderer();
const runtime = createRuntime({ renderer });

// ── Workspace + file persistence (IndexedDB with localStorage fallback) ─────
const DB_NAME = 'streetui.playground';
const DB_VERSION = 1;
const WS_STORE = 'workspace';
const FILES_STORE = 'files';
const WS_KEY = 'streetui.playground.workspace';

let idb: IDBDatabase | null = null;

async function initDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { idb = req.result; resolve(req.result); };
      req.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(WS_STORE)) {
          database.createObjectStore(WS_STORE, { keyPath: 'key' });
        }
        if (!database.objectStoreNames.contains(FILES_STORE)) {
          database.createObjectStore(FILES_STORE, { keyPath: 'path' });
        }
      };
    });
  } catch {
    return null;
  }
}

async function idbGet<T>(store: string, key: string): Promise<T | null> {
  if (!idb) return null;
  try {
    return await new Promise((resolve, reject) => {
      const tx = idb!.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve((req.result as T) ?? null);
    });
  } catch {
    return null;
  }
}

async function idbPut(store: string, value: Record<string, unknown>): Promise<void> {
  if (!idb) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb!.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(value);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } catch {
    /* storage unavailable */
  }
}

interface Workspace {
  previewMode?: 'desktop' | 'tablet' | 'mobile';
  panel?: 'console' | 'diagnostics' | 'build';
  activePath?: string | null;
}

async function saveWorkspace(): Promise<void> {
  const ws: Workspace = { previewMode: previewMode.get(), panel: panel.get(), activePath: activePath.get() };
  await idbPut(WS_STORE, { key: WS_KEY, value: ws });
  try {
    localStorage.setItem(WS_KEY, JSON.stringify(ws));
  } catch {
    /* localStorage unavailable */
  }
}

async function loadWorkspace(): Promise<Workspace> {
  const rec = await idbGet<{ key: string; value: Workspace }>(WS_STORE, WS_KEY);
  const ws = rec?.value;
  if (ws) return ws;
  try {
    const raw = localStorage.getItem(WS_KEY);
    return raw ? (JSON.parse(raw) as Workspace) : {};
  } catch {
    return {};
  }
}

async function cacheFile(path: string, content: string): Promise<void> {
  await idbPut(FILES_STORE, { path, content, ts: Date.now() });
}

async function getCachedFile(path: string): Promise<string | null> {
  const rec = await idbGet<{ path: string; content: string; ts: number }>(FILES_STORE, path);
  return rec?.content ?? null;
}

void initDB();

// ── Template gallery overlay ───────────────────────────────────────────────────
async function openGallery(): Promise<void> {
  let existing = document.getElementById('pg-gallery');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'pg-gallery';
    existing.setAttribute(
      'style',
      'position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:100;',
    );
    const card = document.createElement('div');
    card.setAttribute('style', 'background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px;width:560px;max-height:80vh;overflow:auto;');
    card.innerHTML = '<div style="font-size:16px;font-weight:700;margin-bottom:8px">New project</div>';
    const list = document.createElement('div');
    list.id = 'pg-gallery-list';
    card.appendChild(list);
    const dirRow = document.createElement('div');
    dirRow.setAttribute('style', 'display:flex;gap:8px;margin-top:12px;align-items:center;');
    dirRow.innerHTML = '<span>Name:</span>';
    const input = document.createElement('input');
    input.id = 'pg-gallery-dir';
    input.placeholder = 'my-app';
    input.style.flex = '1';
    dirRow.appendChild(input);
    const createBtn = document.createElement('button');
    createBtn.id = 'pg-gallery-create';
    createBtn.textContent = 'Create';
    createBtn.classList.add('pg-btn');
    createBtn.addEventListener('click', async () => {
      const input = document.getElementById('pg-gallery-dir') as HTMLInputElement | null;
      const name = input?.value.trim() ?? '';
      const templateId = input?.dataset.template;
      const msg = document.getElementById('pg-gallery-msg');
      if (!sessionRoot.get()) {
        if (msg) msg.textContent = 'project root unavailable — wait for the session to load';
        return;
      }
      if (!name || !templateId) {
        if (msg) msg.textContent = 'choose a template and enter a project name';
        return;
      }
      const dir = `${projectRootForCreate()}/${safeName(name)}`;
      try {
        const res = (await api('/create', { method: 'POST', body: JSON.stringify({ template: templateId, dir }) })) as {
          ok?: boolean;
          error?: string;
          dir?: string;
        };
        if (msg) msg.textContent = res.ok ? `created at ${res.dir}. Open it with: streetui playground ${res.dir}` : `create failed: ${res.error ?? ''}`;
      } catch (error) {
        if (msg) msg.textContent = `create failed: ${String(error)}`;
      }
    });
    dirRow.appendChild(createBtn);
    card.appendChild(dirRow);
    const msg = document.createElement('div');
    msg.id = 'pg-gallery-msg';
    msg.style.marginTop = '10px';
    msg.style.color = 'var(--muted)';
    card.appendChild(msg);
    existing.appendChild(card);
    document.body.appendChild(existing);
  }

  const list = document.getElementById('pg-gallery-list');
  if (!list) return;
  list.textContent = 'loading templates…';
  try {
    const data = (await api('/templates')) as { templates?: Array<{ id: string; name: string; description: string; preview?: string }> };
    list.textContent = '';
    for (const t of data.templates ?? []) {
      const item = document.createElement('div');
      item.className = 'pg-template';
      item.setAttribute('style', 'border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;');
      item.innerHTML = `<div style="font-weight:600">${escapeHtml(t.name)}</div><div style="color:var(--muted);font-size:12px">${escapeHtml(t.description)}</div>`;
      item.dataset.id = t.id;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        document.querySelectorAll('.pg-template').forEach((el) => ((el as HTMLElement).style.borderColor = 'var(--border)'));
        item.style.borderColor = 'var(--accent)';
        const input = document.getElementById('pg-gallery-dir') as HTMLInputElement | null;
        if (input) input.dataset.template = t.id;
      });
      list.appendChild(item);
    }
  } catch (error) {
    list.textContent = `failed to load templates: ${String(error)}`;
  }
}

function safeName(name: string): string {
  return name.replace(/[^\w.-]/g, '_');
}

function projectRootForCreate(): string {
  // Use a sibling of the current project root (best-effort from the session root).
  return (sessionRoot.get() ?? '/').replace(/\/+$/, '');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

const sessionRoot = signal('');

function styleNodes(): void {
  document.querySelectorAll('#app button').forEach((b) => {
    if (!b.classList.contains('pg-btn')) b.classList.add('pg-btn');
  });
}

function mount(): void {
  const container = document.getElementById('app');
  if (!container) return;
  runtime.mount(compiled, container);
  styleNodes();

  editorHost = document.getElementById('editor');
  const explorerList = document.getElementById('explorer-list');
  const tabsEl = document.getElementById('tabs');
  const previewFrame = document.getElementById('preview-frame');
  const statusEl = document.getElementById('preview-status');
  const bottomBody = document.getElementById('bottom-body');
  const frameWrap = document.getElementById('preview-frame-wrap');

  document.getElementById('run-btn')?.addEventListener('click', () => {
    if (previewFrame) {
      const frame = document.createElement('iframe');
      frame.className = 'pg-preview-frame';
      frame.src = previewUrl.get();
      // allow-same-origin lets the app's ESM modules load (an opaque-origin
      // sandbox triggers cross-origin CORS blocks on module scripts). The
      // playground token is deleted from window at boot (see top of module), so
      // previewed code cannot exfiltrate it via parent.window; preview still runs
      // same-origin, so untrusted project code shares this origin.
      frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads');
      previewFrame.replaceChildren(frame);
      status.set('ready');
    }
  });
  document.getElementById('build-btn')?.addEventListener('click', () => void runBuild());
  document.getElementById('share-btn')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(location.href);
    pushConsole('copied playground URL');
  });
  document.getElementById('panel-console')?.addEventListener('click', () => panel.set('console'));
  document.getElementById('panel-diagnostics')?.addEventListener('click', () => panel.set('diagnostics'));
  document.getElementById('panel-build')?.addEventListener('click', () => panel.set('build'));
  document.getElementById('dev-desktop')?.addEventListener('click', () => {
    previewMode.set('desktop');
    frameWrap?.querySelector('iframe')?.classList.remove('tablet', 'mobile');
  });
  document.getElementById('dev-tablet')?.addEventListener('click', () => {
    previewMode.set('tablet');
    frameWrap?.querySelector('iframe')?.classList.add('tablet');
    frameWrap?.querySelector('iframe')?.classList.remove('mobile');
  });
  document.getElementById('dev-mobile')?.addEventListener('click', () => {
    previewMode.set('mobile');
    frameWrap?.querySelector('iframe')?.classList.add('mobile');
    frameWrap?.querySelector('iframe')?.classList.remove('tablet');
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveActive();
    }
  });

  function renderExplorer(): void {
    if (!explorerList) return;
    explorerList.textContent = '';
    for (const file of files.get()) {
      const row = document.createElement('div');
      row.className = 'pg-file';
      row.style.cssText = 'padding:4px 12px;cursor:pointer;font-family:ui-monospace,monospace;font-size:12px;';
      row.textContent = file;
      row.addEventListener('click', () => void openFile(file));
      explorerList.appendChild(row);
    }
  }

  function renderTabs(): void {
    if (!tabsEl) return;
    tabsEl.textContent = '';
    const p = activePath.get();
    if (!p) return;
    const tab = document.createElement('div');
    tab.className = 'pg-tab active' + (dirty.get()[p] ? ' dirty' : '');
    tab.textContent = p.split('/').pop() ?? p;
    tabsEl.appendChild(tab);
  }

  files.subscribe(renderExplorer);
  activePath.subscribe(renderTabs);
  dirty.subscribe(renderTabs);

  const renderPanel = (): void => {
    if (!bottomBody) return;
    const kind = panel.get();
    bottomBody.textContent = '';
    if (kind === 'console') {
      for (const line of consoleLines.get()) {
        const div = document.createElement('div');
        div.className = line.error ? 'pg-console-line error' : 'pg-console-line';
        div.textContent = line.text;
        bottomBody.appendChild(div);
      }
    } else if (kind === 'diagnostics') {
      for (const d of diagnostics.get()) {
        const div = document.createElement('div');
        div.className = 'pg-diagnostics-line error';
        div.textContent = d.file ? `${d.file}: ${d.message}` : d.message;
        bottomBody.appendChild(div);
      }
    } else {
      bottomBody.textContent = buildOutput.get();
    }
  };
  consoleLines.subscribe(() => { if (panel.get() === 'console') renderPanel(); });
  diagnostics.subscribe(() => { if (panel.get() === 'diagnostics') renderPanel(); });
  buildOutput.subscribe(() => { if (panel.get() === 'build') renderPanel(); });
  panel.subscribe(renderPanel);
  status.subscribe((s) => {
    if (statusEl) {
      statusEl.textContent = s;
      statusEl.className = `pg-preview-status ${s}`;
    }
  });

  void (async () => {
    try {
      const session = (await api('/session')) as { project?: string; frameworkVersion?: string; previewUrl?: string };
      sessionRoot.set(session.project ?? '');
      projectName.set((session.project ?? '').split('/').pop() ?? 'project');
      frameworkVersion.set(session.frameworkVersion ?? '');
      previewUrl.set(session.previewUrl ?? '');
      await refreshFiles();

      const ws = await loadWorkspace();
      if (ws.previewMode) previewMode.set(ws.previewMode);
      if (ws.panel) panel.set(ws.panel);
      if (ws.activePath && files.get().includes(ws.activePath)) await openFile(ws.activePath);

      connectHmr();
    } catch (error) {
      status.set('error');
      pushConsole(`session error: ${String(error)}`, true);
    }
  })();

  // persist workspace on significant state changes
  activePath.subscribe(saveWorkspace);
  panel.subscribe(saveWorkspace);
  previewMode.subscribe(saveWorkspace);

  // Export → download a zip archive of the project
  document.getElementById('export-btn')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/__playground/api/export', { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'project.zip';
      a.click();
      pushConsole('exported project.zip');
    } catch (error) {
      pushConsole(`export failed: ${String(error)}`, true);
    }
  });

  // New project gallery
  document.getElementById('new-btn')?.addEventListener('click', () => void openGallery());
  document.getElementById('pg-gallery')?.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'pg-gallery') {
      document.getElementById('pg-gallery')?.remove();
    }
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
}
