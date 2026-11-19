/**
 * The browser-side HMR client, served at `/@streetui/client/hmr.js`.
 *
 * It is a self-executing module that connects to the dev server's own
 * WebSocket, applies updates according to the documented guarantees, reports
 * runtime errors back to the terminal, and renders a recoverable error overlay
 * for build failures. It never throws into application code.
 */

export const HMR_CLIENT_CODE = String.raw`(function () {
  if (globalThis.__STREETUI_HMR_CLIENT__) return;
  globalThis.__STREETUI_HMR_CLIENT__ = true;

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  let socket;
  try {
    socket = new WebSocket(protocol + '://' + location.host + '/__streetui_hmr');
  } catch (error) {
    return;
  }

  let runtimeReady = null;
  function runtime() {
    if (runtimeReady === null) runtimeReady = import('/@streetui/client/hmr-runtime.js');
    return runtimeReady;
  }

  function send(message) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(message));
  }

  function overlay() {
    let root = document.getElementById('__streetui_hmr_overlay');
    if (root) return root;
    root = document.createElement('div');
    root.id = '__streetui_hmr_overlay';
    root.setAttribute('style', [
      'position:fixed', 'inset:auto 12px 12px auto', 'z-index:2147483647',
      'max-width:min(560px,90vw)', 'max-height:60vh', 'overflow:auto',
      'background:#1b1416', 'color:#ffd7d7', 'border:1px solid #d33',
      'border-radius:8px', 'padding:12px 14px',
      'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'box-shadow:0 8px 24px rgba(0,0,0,.4)',
    ].join(';'));
    document.body.appendChild(root);
    return root;
  }

  function showDiagnostics(diagnostics) {
    const root = overlay();
    const items = (diagnostics || []).map(function (d) {
      const pos = d.file ? d.file + (d.line ? ':' + d.line + (d.column ? ':' + d.column : '') : '') : '';
      return '<div><strong>' + escapeHtml(pos || 'error') + '</strong><br>' + escapeHtml(d.message || '') + '</div>';
    }).join('<hr style="border-color:#552">');
    root.innerHTML = '<div style="font-weight:700;margin-bottom:6px">StreetUI build error</div>' + items +
      '<button style="margin-top:10px;background:#d33;color:#fff;border:0;border-radius:4px;padding:4px 10px;cursor:pointer">Dismiss</button>';
    const button = root.querySelector('button');
    if (button) button.addEventListener('click', function () { root.remove(); });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function applyUpdates(updates) {
    let forceReload = false;
    let pending = updates.length;
    if (pending === 0) return;
    updates.forEach(function (update) {
      if (update.kind === 'css') {
        import(update.url).then(function () {
          send({ type: 'hmr_applied', updateId: update.id, ok: true });
          if (--pending === 0 && forceReload) location.reload();
        }).catch(function (error) {
          send({ type: 'hmr_failed', updateId: update.id, ok: false, error: String(error && error.message || error) });
          forceReload = true;
          if (--pending === 0) location.reload();
        });
        return;
      }
      runtime().then(function (mod) {
        const accept = mod.__streetuiAccept(update.id);
        if (!accept) { forceReload = true; send({ type: 'hmr_failed', updateId: update.id, ok: false, error: 'no accept handler' }); if (--pending === 0) location.reload(); return; }
        mod.__streetuiDispose(update.id);
        import(update.url).then(function (newModule) {
          try { accept(newModule); } catch (error) {
            send({ type: 'runtime-error', message: String(error && error.message || error), stack: error && error.stack });
            send({ type: 'hmr_failed', updateId: update.id, ok: false, error: String(error && error.message || error) });
            forceReload = true;
            if (--pending === 0) location.reload();
            return;
          }
          send({ type: 'hmr_applied', updateId: update.id, ok: true });
          if (--pending === 0 && forceReload) location.reload();
        }).catch(function (error) {
          send({ type: 'runtime-error', message: String(error && error.message || error), stack: error && error.stack });
          send({ type: 'hmr_failed', updateId: update.id, ok: false, error: String(error && error.message || error) });
          forceReload = true;
          if (--pending === 0) location.reload();
        });
      }).catch(function (error) {
        send({ type: 'hmr_failed', updateId: update.id, ok: false, error: String(error && error.message || error) });
        forceReload = true;
        if (--pending === 0) location.reload();
      });
    });
  }

  socket.addEventListener('open', function () {
    send({ type: 'connected' });
    const root = document.getElementById('__streetui_hmr_overlay');
    if (root) root.remove();
  });

  socket.addEventListener('message', function (event) {
    let message;
    try { message = JSON.parse(event.data); } catch (error) { return; }
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'update') applyUpdates(message.updates || []);
    else if (message.type === 'reload') location.reload();
    else if (message.type === 'error') showDiagnostics(message.diagnostics || []);
    else if (message.type === 'ping') send({ type: 'pong' });
    else if (message.type === 'inspect_dom') {
      send({ type: 'inspect_dom_response', requestId: message.requestId, ok: true, payload: { html: document.documentElement.outerHTML } });
    } else if (message.type === 'inspect_element') {
      var el = message.selector ? document.querySelector(message.selector) : null;
      if (el) {
        var rect = el.getBoundingClientRect();
        send({ type: 'inspect_element_response', requestId: message.requestId, ok: true, payload: { attributes: el.attributes, dimensions: { x: rect.left, y: rect.top, width: rect.width, height: rect.height }, text: el.textContent, html: el.outerHTML } });
      } else {
        send({ type: 'inspect_element_response', requestId: message.requestId, ok: false, error: 'Element not found' });
      }
    } else if (message.type === 'screenshot') {
      send({ type: 'screenshot_response', requestId: message.requestId, ok: false, error: 'Screenshot requires canvas/OffscreenCanvas which is not available in preview iframe' });
    } else if (message.type === 'navigate') {
      location.href = message.url;
      send({ type: 'navigate_response', requestId: message.requestId, ok: true, payload: { url: location.href } });
    } else if (message.type === 'reload') {
      location.reload();
      send({ type: 'reload_response', requestId: message.requestId, ok: true });
    } else if (message.type === 'get_console') {
      send({ type: 'get_console_response', requestId: message.requestId, ok: true, payload: { messages: [] } });
    } else if (message.type === 'get_errors') {
      send({ type: 'get_errors_response', requestId: message.requestId, ok: true, payload: { errors: [] } });
    }
  });

  window.addEventListener('error', function (event) {
    send({ type: 'runtime-error', message: String(event.message || 'Unknown error'), stack: event.error && event.error.stack });
  });
  window.addEventListener('unhandledrejection', function (event) {
    const reason = event.reason;
    send({ type: 'runtime-error', message: String(reason && reason.message || reason), stack: reason && reason.stack });
  });

  globalThis.__STREETUI_HMR_SEND__ = send;
})();
`;