/**
 * Node server entry (#23). Pure server-side: no window, no document, no DOM
 * globals. It renders a full HTML document, prints it to stdout, and exits
 * cleanly — no open listeners, the process terminates on its own.
 *
 * Framework-neutral: there is no Express/Fastify assumption. A real server
 * (StreetJS or otherwise) would call `renderDocument()` inside a request handler
 * and send the returned string as the response body.
 */

import { renderDocument } from './document.js';

const html = renderDocument();
process.stdout.write(html + '\n');
process.exit(0);
