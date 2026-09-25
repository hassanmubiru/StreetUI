#!/usr/bin/env node
"use strict";

// ../cli/src/args.ts
var VALUE_FLAGS = /* @__PURE__ */ new Set(["port", "host", "template", "dir"]);
var BOOLEAN_FLAGS = /* @__PURE__ */ new Set(["help", "version"]);
var SHORT = { h: "help", v: "version", p: "port" };
function parseArgs(argv) {
  let command;
  const positionals = [];
  const unknown = [];
  let help = false;
  let version = false;
  let port;
  let host;
  let template;
  let dir;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === void 0) continue;
    if (token.startsWith("--") || token.startsWith("-") && token.length > 1 && !/^-\d/.test(token)) {
      const isLong = token.startsWith("--");
      const raw = isLong ? token.slice(2) : token.slice(1);
      const eq = raw.indexOf("=");
      let name = eq >= 0 ? raw.slice(0, eq) : raw;
      let inlineValue = eq >= 0 ? raw.slice(eq + 1) : void 0;
      if (!isLong) name = SHORT[name] ?? name;
      if (BOOLEAN_FLAGS.has(name)) {
        if (name === "help") help = true;
        else if (name === "version") version = true;
        continue;
      }
      if (VALUE_FLAGS.has(name)) {
        const value = inlineValue ?? argv[++i];
        if (value === void 0) {
          unknown.push(`${name} (missing value)`);
          continue;
        }
        if (name === "port") {
          const n = Number.parseInt(value, 10);
          port = Number.isFinite(n) && n > 0 ? n : void 0;
          if (port === void 0) unknown.push(`port (invalid: ${value})`);
        } else if (name === "host") host = value;
        else if (name === "template") template = value;
        else if (name === "dir") dir = value;
        continue;
      }
      unknown.push(name);
      inlineValue = void 0;
      continue;
    }
    if (command === void 0) command = token;
    else positionals.push(token);
  }
  return { command, positionals, help, version, port, host, template, dir, unknown };
}

// ../cli/src/logger.ts
var useColor = process.env["NO_COLOR"] === void 0 && process.env["FORCE_COLOR"] !== "0" && (process.stdout.isTTY === true || process.env["FORCE_COLOR"] !== void 0);
function paint(code, text) {
  return useColor ? `\x1B[${code}m${text}\x1B[0m` : text;
}
var style = {
  bold: (t) => paint(1, t),
  dim: (t) => paint(2, t),
  red: (t) => paint(31, t),
  green: (t) => paint(32, t),
  yellow: (t) => paint(33, t),
  blue: (t) => paint(34, t),
  cyan: (t) => paint(36, t)
};
var BRAND = style.bold(style.cyan("streetui"));
function createLogger(prefix = BRAND) {
  return {
    info: (m) => console.log(`${prefix} ${m}`),
    success: (m) => console.log(`${prefix} ${style.green(m)}`),
    warn: (m) => console.warn(`${prefix} ${style.yellow(m)}`),
    error: (m) => console.error(`${prefix} ${style.red(m)}`),
    plain: (m) => console.log(m)
  };
}

// ../cli/src/diagnostics.ts
var CliError = class extends Error {
  suggestion;
  /** Process exit code to use when this error reaches the top level. */
  exitCode;
  constructor(message, options) {
    super(message);
    this.name = "CliError";
    this.suggestion = options?.suggestion;
    this.exitCode = options?.exitCode ?? 1;
  }
};
var KNOWN_DSL_METHODS = [
  "app",
  "page",
  "section",
  "container",
  "heading",
  "text",
  "button",
  "link",
  "input",
  "form",
  "list",
  "listOf",
  "when",
  "errorBoundary"
];
function fromEsbuildMessage(msg) {
  const problem = { message: msg.text };
  const loc = msg.location;
  if (loc === null) return withSuggestion(problem);
  return withSuggestion({
    message: msg.text,
    file: loc.file,
    line: loc.line,
    column: loc.column + 1,
    // esbuild columns are 0-based; humans count from 1.
    lineText: loc.lineText
  });
}
function withSuggestion(problem) {
  const unknownApi = /Property '(\w+)' does not exist|'(\w+)' is not a function/.exec(problem.message);
  const missingModule = /Could not resolve ["']([^"']+)["']/.exec(problem.message);
  if (missingModule) {
    const spec = missingModule[1] ?? "";
    if (spec.startsWith("@streetui/")) {
      return {
        ...problem,
        suggestion: `Install the StreetUI packages (run "npm install") \u2014 "${spec}" is not resolvable yet.`
      };
    }
    return { ...problem, suggestion: `Check the import path "${spec}" \u2014 the file or package could not be found.` };
  }
  if (unknownApi) {
    const name = unknownApi[1] ?? unknownApi[2] ?? "";
    const near = KNOWN_DSL_METHODS.find((m) => m.toLowerCase() === name.toLowerCase() && m !== name) ?? KNOWN_DSL_METHODS.find((m) => m.startsWith(name.slice(0, 3)));
    if (near !== void 0 && name.length > 0) {
      return { ...problem, suggestion: `Did you mean "${near}"? Check the StreetUI DSL API.` };
    }
  }
  return problem;
}
function formatProblem(problem) {
  const lines = [];
  if (problem.file !== void 0) {
    const pos = problem.line !== void 0 ? `:${problem.line}${problem.column !== void 0 ? `:${problem.column}` : ""}` : "";
    lines.push(style.cyan(`${problem.file}${pos}`));
  }
  lines.push(problem.message);
  if (problem.lineText !== void 0 && problem.lineText.trim().length > 0) {
    lines.push(style.dim(`  | ${problem.lineText.trim()}`));
  }
  if (problem.suggestion !== void 0) {
    lines.push("");
    lines.push(`${style.yellow("Suggestion:")} ${problem.suggestion}`);
  }
  return lines.join("\n");
}
function formatBuildFailure(problems) {
  const header = style.red(style.bold("StreetUI build error"));
  const count = problems.length === 1 ? "1 error" : `${problems.length} errors`;
  const blocks = problems.map((p) => formatProblem(p)).join("\n\n");
  return `${header} (${count})

${blocks}`;
}

// ../cli/src/project.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");

// ../cli/src/config.ts
var import_esbuild = require("esbuild");
var import_promises = require("fs/promises");
var import_node_fs = require("fs");
var import_node_path = require("path");
var import_node_url = require("url");
var DEFAULTS = {
  port: 3e3,
  host: "localhost",
  clientEntry: "src/main.ts",
  serverEntry: "src/server.ts",
  outDir: "dist",
  publicDir: "public"
};
var CONFIG_FILENAMES = ["streetui.config.ts", "streetui.config.mjs", "streetui.config.js"];
function findConfigFile(root) {
  for (const name of CONFIG_FILENAMES) {
    const candidate = (0, import_node_path.join)(root, name);
    if ((0, import_node_fs.existsSync)(candidate)) return candidate;
  }
  return void 0;
}
async function importConfigFile(file) {
  if (!file.endsWith(".ts")) {
    const mod = await import((0, import_node_url.pathToFileURL)(file).href);
    return mod.default ?? {};
  }
  const result = await (0, import_esbuild.build)({
    entryPoints: [file],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    // Keep node builtins and any deps external — we only want the config value.
    packages: "external",
    logLevel: "silent"
  });
  const code = result.outputFiles[0]?.text ?? "";
  const outFile = (0, import_node_path.join)((0, import_node_path.dirname)(file), `.streetui.config.${Date.now()}.mjs`);
  try {
    await (0, import_promises.writeFile)(outFile, code, "utf8");
    const mod = await import((0, import_node_url.pathToFileURL)(outFile).href);
    return mod.default ?? {};
  } finally {
    await (0, import_promises.rm)(outFile, { force: true });
  }
}
function toAbsolute(root, p) {
  return (0, import_node_path.isAbsolute)(p) ? p : (0, import_node_path.resolve)(root, p);
}
async function loadConfig(root) {
  const absRoot = (0, import_node_path.resolve)(root);
  const file = findConfigFile(absRoot);
  const user = file ? await importConfigFile(file) : {};
  return {
    root: absRoot,
    port: user.port ?? DEFAULTS.port,
    host: user.host ?? DEFAULTS.host,
    clientEntry: toAbsolute(absRoot, user.clientEntry ?? DEFAULTS.clientEntry),
    serverEntry: toAbsolute(absRoot, user.serverEntry ?? DEFAULTS.serverEntry),
    outDir: toAbsolute(absRoot, user.outDir ?? DEFAULTS.outDir),
    publicDir: toAbsolute(absRoot, user.publicDir ?? DEFAULTS.publicDir)
  };
}

// ../cli/src/project.ts
function readPackageJson(root) {
  const pkgPath = (0, import_node_path2.join)(root, "package.json");
  if (!(0, import_node_fs2.existsSync)(pkgPath)) {
    throw new CliError(`No package.json found in ${root}.`, {
      suggestion: 'Run this command from the root of a StreetUI project, or create one with "npm create streetui@latest".'
    });
  }
  let raw;
  try {
    raw = (0, import_node_fs2.readFileSync)(pkgPath, "utf8");
  } catch (err) {
    throw new CliError(`Could not read ${pkgPath}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new CliError(`package.json is not valid JSON: ${err.message}`, {
      suggestion: "Fix the syntax error in package.json and try again."
    });
  }
}
function dependsOnStreetUI(pkg) {
  const deps = { ...pkg.dependencies ?? {}, ...pkg.devDependencies ?? {} };
  return Object.keys(deps).some((name) => name === "streetui" || name.startsWith("@streetui/"));
}
async function resolveProject(cwd, options) {
  const root = (0, import_node_path2.resolve)(cwd);
  const packageJson = readPackageJson(root);
  if (!dependsOnStreetUI(packageJson)) {
    throw new CliError(`${root} does not look like a StreetUI project.`, {
      suggestion: 'Its package.json declares no "@streetui/*" dependency. Create a project with "npm create streetui@latest".'
    });
  }
  let config;
  try {
    config = await loadConfig(root);
  } catch (err) {
    if (err instanceof CliError) throw err;
    throw new CliError(`Failed to load streetui.config: ${err.message}`, {
      suggestion: "Check streetui.config.ts for syntax or import errors."
    });
  }
  if (options?.requireEntry === true && !(0, import_node_fs2.existsSync)(config.clientEntry)) {
    throw new CliError(`Client entry not found: ${config.clientEntry}`, {
      suggestion: 'Create the entry file, or set "clientEntry" in streetui.config.ts to point at your app entry.'
    });
  }
  return { root, packageJson, config };
}

// ../cli/src/build.ts
var import_esbuild2 = require("esbuild");
var import_promises2 = require("fs/promises");
var import_node_fs3 = require("fs");
var import_node_path3 = require("path");

// ../cli/src/env.ts
var PUBLIC_ENV_PREFIX = "STREETUI_PUBLIC_";
function clientEnvDefine(mode, env = process.env) {
  const define = {
    "process.env.NODE_ENV": JSON.stringify(mode)
  };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith(PUBLIC_ENV_PREFIX) && value !== void 0) {
      define[`process.env.${key}`] = JSON.stringify(value);
    }
  }
  return define;
}

// ../cli/src/build.ts
function toProblems(messages) {
  return messages.map((m) => fromEsbuildMessage({ text: m.text, location: m.location }));
}
function baseOptions(mode) {
  return {
    bundle: true,
    format: "esm",
    sourcemap: true,
    logLevel: "silent",
    define: {
      // Public build-time constants. Server secrets are never injected here.
      "process.env.NODE_ENV": JSON.stringify(mode)
    },
    minify: mode === "production"
  };
}
async function buildProject(project, mode = "production") {
  const { config } = project;
  const clientDir = (0, import_node_path3.join)(config.outDir, "client");
  const serverDir = (0, import_node_path3.join)(config.outDir, "server");
  await (0, import_promises2.rm)(config.outDir, { recursive: true, force: true });
  await (0, import_promises2.mkdir)(clientDir, { recursive: true });
  const errors = [];
  await (0, import_esbuild2.build)({
    ...baseOptions(mode),
    entryPoints: [config.clientEntry],
    outfile: (0, import_node_path3.join)(clientDir, "main.js"),
    platform: "browser",
    target: ["es2022"],
    // Only STREETUI_PUBLIC_* env vars reach the browser (plus NODE_ENV).
    define: clientEnvDefine(mode)
  }).catch((err) => {
    errors.push(...toProblems(err.errors ?? []));
    return void 0;
  });
  const hasServerEntry = (0, import_node_fs3.existsSync)(config.serverEntry);
  if (hasServerEntry) {
    await (0, import_promises2.mkdir)(serverDir, { recursive: true });
    await (0, import_esbuild2.build)({
      ...baseOptions(mode),
      entryPoints: [config.serverEntry],
      outfile: (0, import_node_path3.join)(serverDir, "server.js"),
      platform: "node",
      target: ["node18"],
      packages: "external"
    }).catch((err) => {
      errors.push(...toProblems(err.errors ?? []));
      return void 0;
    });
  }
  if (errors.length > 0) {
    throw new CliError(formatBuildFailure(errors), { exitCode: 1 });
  }
  if ((0, import_node_fs3.existsSync)(config.publicDir)) {
    await (0, import_promises2.cp)(config.publicDir, clientDir, { recursive: true });
  }
  return {
    clientDir,
    serverDir,
    clientBundle: (0, import_node_path3.join)(clientDir, "main.js"),
    serverBundle: (0, import_node_path3.join)(serverDir, "server.js")
  };
}

// ../cli/src/dev.ts
var import_esbuild3 = require("esbuild");
var import_promises4 = require("fs/promises");
var import_node_fs4 = require("fs");
var import_node_path5 = require("path");

// ../cli/src/serve.ts
var import_node_http = require("http");
var import_promises3 = require("fs/promises");
var import_node_path4 = require("path");
var import_node_url2 = require("url");
var MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8"
};
var ReloadHub = class _ReloadHub {
  clients = /* @__PURE__ */ new Set();
  static PATH = "/__streetui_reload";
  /** The snippet injected before `</body>` so the page listens for reloads. */
  static snippet = `<script>(function(){try{new EventSource("${_ReloadHub.PATH}").onmessage=function(e){if(e.data==="reload")location.reload()}}catch(_){}})();</script>`;
  handle(_req, res) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    res.write(": connected\n\n");
    this.clients.add(res);
    res.on("close", () => this.clients.delete(res));
  }
  /** Tell every connected browser to reload. */
  triggerReload() {
    for (const res of this.clients) res.write("data: reload\n\n");
  }
  closeAll() {
    for (const res of this.clients) res.end();
    this.clients.clear();
  }
};
function resolveStatic(clientDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  } catch {
    return void 0;
  }
  if (decoded.includes("\0")) return void 0;
  const clean = (0, import_node_path4.normalize)(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = (0, import_node_path4.join)(clientDir, clean);
  const rel = (0, import_node_path4.relative)(clientDir, full);
  if (rel === "" || !rel.startsWith("..") && !(0, import_node_path4.isAbsolute)(rel)) return full;
  return void 0;
}
async function tryServeStatic(clientDir, urlPath, res, devMode) {
  const full = resolveStatic(clientDir, urlPath);
  if (full === void 0) return false;
  try {
    const info = await (0, import_promises3.stat)(full);
    if (!info.isFile()) return false;
    const body = await (0, import_promises3.readFile)(full);
    res.writeHead(200, {
      "Content-Type": MIME[(0, import_node_path4.extname)(full)] ?? "application/octet-stream",
      // Never let a browser MIME-sniff a served asset into something executable.
      "X-Content-Type-Options": "nosniff",
      // Dev must always re-fetch; production may cache immutable build output.
      "Cache-Control": devMode ? "no-cache" : "public, max-age=3600"
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}
async function loadRender(serverBundle) {
  const mod = await import(`${(0, import_node_url2.pathToFileURL)(serverBundle).href}?t=${Date.now()}`);
  const candidate = mod.render ?? (typeof mod.default === "function" ? mod.default : mod.default?.render);
  if (typeof candidate !== "function") {
    throw new Error(`Server entry ${serverBundle} must export a "render(request)" function.`);
  }
  return candidate;
}
function injectReload(html) {
  if (html.includes("</body>")) return html.replace("</body>", `${ReloadHub.snippet}</body>`);
  return html + ReloadHub.snippet;
}
async function startServer(options) {
  let cachedRender;
  const getRender = async () => {
    if (options.devMode === true) return loadRender(options.serverBundle);
    if (cachedRender === void 0) cachedRender = await loadRender(options.serverBundle);
    return cachedRender;
  };
  await getRender();
  const server = (0, import_node_http.createServer)((req, res) => {
    void handleRequest(req, res, getRender, options);
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolvePromise();
    });
  });
  const url = `http://${options.host}:${options.port}`;
  return {
    server,
    url,
    close: () => new Promise((resolveClose) => {
      options.reload?.closeAll();
      server.close(() => resolveClose());
    })
  };
}
async function handleRequest(req, res, getRender, options) {
  const url = req.url ?? "/";
  if (options.reload && url === ReloadHub.PATH) {
    options.reload.handle(req, res);
    return;
  }
  if ((0, import_node_path4.extname)(url.split("?")[0] ?? "") !== "") {
    const served = await tryServeStatic(options.clientDir, url, res, options.devMode === true);
    if (served) return;
  }
  try {
    const render = await getRender();
    const result = await render({
      url,
      method: req.method ?? "GET",
      headers: req.headers
    });
    const status = result.status ?? 200;
    const html = options.reload ? injectReload(result.html) : result.html;
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...result.headers });
    res.end(html);
  } catch (err) {
    console.error(`[StreetUI] render error for ${url}:`, err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    if (options.devMode === true) {
      const message = err instanceof Error ? err.stack ?? err.message : String(err);
      res.end(`StreetUI server error while rendering ${url}:

${message}`);
    } else {
      res.end("Internal Server Error");
    }
  }
}

// ../cli/src/dev.ts
function reportResult(label, errors, logger, reload) {
  if (errors.length > 0) {
    const problems = errors.map((m) => fromEsbuildMessage({ text: m.text, location: m.location }));
    logger.error(`${label} rebuild failed:`);
    logger.plain(formatBuildFailure(problems));
    return;
  }
  reload.triggerReload();
}
async function runDev(options) {
  const { project, logger } = options;
  const { config } = project;
  const clientDir = (0, import_node_path5.join)(config.outDir, "client");
  const serverDir = (0, import_node_path5.join)(config.outDir, "server");
  const serverBundle = (0, import_node_path5.join)(serverDir, "server.js");
  const reload = new ReloadHub();
  await (0, import_promises4.rm)(config.outDir, { recursive: true, force: true });
  await (0, import_promises4.mkdir)(clientDir, { recursive: true });
  await (0, import_promises4.mkdir)(serverDir, { recursive: true });
  const shared = {
    bundle: true,
    format: "esm",
    sourcemap: true,
    logLevel: "silent",
    define: { "process.env.NODE_ENV": JSON.stringify("development") }
  };
  const contexts = [];
  const clientCtx = await (0, import_esbuild3.context)({
    ...shared,
    entryPoints: [config.clientEntry],
    outfile: (0, import_node_path5.join)(clientDir, "main.js"),
    platform: "browser",
    target: ["es2022"],
    define: clientEnvDefine("development"),
    plugins: [
      {
        name: "streetui-client-reload",
        setup(builder) {
          builder.onEnd((result) => reportResult("Client", result.errors, logger, reload));
        }
      }
    ]
  });
  contexts.push(clientCtx);
  const hasServerEntry = (0, import_node_fs4.existsSync)(config.serverEntry);
  if (hasServerEntry) {
    const serverCtx = await (0, import_esbuild3.context)({
      ...shared,
      entryPoints: [config.serverEntry],
      outfile: serverBundle,
      platform: "node",
      target: ["node18"],
      packages: "external",
      plugins: [
        {
          name: "streetui-server-reload",
          setup(builder) {
            builder.onEnd((result) => {
              if (result.errors.length > 0) {
                reportResult("Server", result.errors, logger, reload);
              }
            });
          }
        }
      ]
    });
    contexts.push(serverCtx);
  }
  await Promise.all(contexts.map((c) => c.rebuild().catch(() => void 0)));
  await Promise.all(contexts.map((c) => c.watch()));
  if ((0, import_node_fs4.existsSync)(config.publicDir)) {
    await (0, import_promises4.cp)(config.publicDir, clientDir, { recursive: true });
  }
  const host = options.host ?? config.host;
  const port = options.port ?? config.port;
  let running;
  if (hasServerEntry) {
    running = await startServer({ clientDir, serverBundle, host, port, reload, devMode: true });
    logger.success(`Dev server running at ${running.url}`);
    logger.info("Watching for changes\u2026 (press Ctrl+C to stop)");
  } else {
    logger.warn("No server entry found \u2014 client bundle is being watched, but no dev server was started.");
  }
  const url = running?.url ?? `http://${host}:${port}`;
  return {
    url,
    stop: async () => {
      await Promise.all(contexts.map((c) => c.dispose()));
      await running?.close();
    }
  };
}

// ../cli/src/start.ts
var import_node_fs5 = require("fs");
var import_node_path6 = require("path");
async function runStart(options) {
  const { project, logger } = options;
  const { config } = project;
  const clientDir = (0, import_node_path6.join)(config.outDir, "client");
  const serverBundle = (0, import_node_path6.join)(config.outDir, "server", "server.js");
  if (!(0, import_node_fs5.existsSync)(serverBundle)) {
    logger.info("No production build found \u2014 building first\u2026");
    await buildProject(project, "production");
  }
  if (!(0, import_node_fs5.existsSync)(serverBundle)) {
    throw new CliError("Production build did not produce a server bundle.", {
      suggestion: "Ensure your project has a server entry (default src/server.ts) that exports render()."
    });
  }
  const host = options.host ?? config.host;
  const port = options.port ?? config.port;
  const running = await startServer({ clientDir, serverBundle, host, port });
  logger.success(`Production server running at ${running.url}`);
  return running;
}

// ../cli/src/create.ts
var import_promises5 = require("fs/promises");
var import_node_fs7 = require("fs");
var import_node_path8 = require("path");

// ../cli/src/templates.ts
var import_node_fs6 = require("fs");
var import_node_path7 = require("path");
var import_node_url3 = require("url");
var import_meta = {};
var TEMPLATES = ["basic", "ssr"];
var DEFAULT_TEMPLATE = "ssr";
var NAME_MAP = {
  "_gitignore": ".gitignore",
  "_npmrc": ".npmrc",
  "_package.json": "package.json"
};
function templatesRoot() {
  const here = (0, import_node_path7.dirname)((0, import_node_url3.fileURLToPath)(import_meta.url));
  const candidates = [(0, import_node_path7.resolve)(here, "..", "templates"), (0, import_node_path7.resolve)(here, "..", "..", "templates")];
  for (const c of candidates) {
    if ((0, import_node_fs6.existsSync)(c)) return c;
  }
  return candidates[0] ?? (0, import_node_path7.resolve)(here, "..", "templates");
}
function templateDir(name) {
  return (0, import_node_path7.join)(templatesRoot(), name);
}
function resolveTemplateName(name) {
  if (name === void 0) return DEFAULT_TEMPLATE;
  if (TEMPLATES.includes(name)) return name;
  throw new Error(`Unknown template "${name}". Available: ${TEMPLATES.join(", ")}.`);
}
function materialisedName(fileName) {
  return NAME_MAP[fileName] ?? fileName;
}
function applyTokens(contents, tokens) {
  return contents.replaceAll("__PROJECT_NAME__", tokens.projectName).replaceAll("__FRAMEWORK_VERSION__", tokens.frameworkVersion);
}
var TEXT_EXTENSIONS = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".css",
  ".html",
  ".md",
  ".txt",
  ".npmrc",
  ""
]);
function isTextFile(fileName) {
  const dot = fileName.lastIndexOf(".");
  const ext = dot >= 0 ? fileName.slice(dot) : "";
  return TEXT_EXTENSIONS.has(ext);
}

// ../cli/src/create.ts
async function isEmptyDir(dir) {
  if (!(0, import_node_fs7.existsSync)(dir)) return true;
  const entries = await (0, import_promises5.readdir)(dir);
  return entries.filter((e) => e !== ".git").length === 0;
}
async function copyTree(srcDir, destDir, tokens, written) {
  await (0, import_promises5.mkdir)(destDir, { recursive: true });
  const entries = await (0, import_promises5.readdir)(srcDir);
  for (const entry of entries) {
    const srcPath = (0, import_node_path8.join)(srcDir, entry);
    const info = await (0, import_promises5.stat)(srcPath);
    const destName = materialisedName(entry);
    const destPath = (0, import_node_path8.join)(destDir, destName);
    if (info.isDirectory()) {
      await copyTree(srcPath, destPath, tokens, written);
    } else if (isTextFile(entry)) {
      const raw = await (0, import_promises5.readFile)(srcPath, "utf8");
      await (0, import_promises5.writeFile)(destPath, applyTokens(raw, tokens), "utf8");
      written.push(destPath);
    } else {
      const raw = await (0, import_promises5.readFile)(srcPath);
      await (0, import_promises5.writeFile)(destPath, raw);
      written.push(destPath);
    }
  }
}
async function createProject(options) {
  const { logger } = options;
  let template;
  try {
    template = resolveTemplateName(options.template);
  } catch (err) {
    throw new CliError(err.message, { suggestion: "Pass a valid --template value." });
  }
  const root = (0, import_node_path8.resolve)(options.targetDir);
  const projectName = (0, import_node_path8.basename)(root);
  if (!await isEmptyDir(root)) {
    throw new CliError(`Target directory ${root} already exists and is not empty.`, {
      suggestion: "Choose a new directory name or empty the existing one."
    });
  }
  const src = templateDir(template);
  if (!(0, import_node_fs7.existsSync)(src)) {
    throw new CliError(`Template "${template}" is missing from the CLI installation (${src}).`, {
      suggestion: "Reinstall @streetui/cli \u2014 the shipped templates appear to be absent."
    });
  }
  const tokens = { projectName, frameworkVersion: options.frameworkVersion };
  const files = [];
  await copyTree(src, root, tokens, files);
  logger.success(`Created ${projectName} (${template} template) with ${files.length} files.`);
  logger.plain("");
  logger.info("Next steps:");
  logger.plain(`  cd ${options.targetDir}`);
  logger.plain("  npm install");
  logger.plain("  npm run dev");
  return { root, template, files };
}

// ../cli/src/index.ts
var CLI_VERSION = "1.5.0";
var HELP = `streetui \u2014 the StreetUI application CLI

Usage:
  streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start the development server with live reload
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build

Options:
  -h, --help          Show this help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start (default 3000)
      --host <host>   Host for dev/start (default localhost)
      --template <t>  Template for create (basic | ssr)
      --dir <path>    Project directory (default current directory)

Examples:
  npm create streetui@latest my-app
  streetui dev --port 4000
  streetui build
  streetui start`;
async function runCli(argv, options = {}) {
  const logger = options.logger ?? createLogger();
  const cwd = options.cwd ?? process.cwd();
  const args = parseArgs(argv);
  if (args.unknown.length > 0) {
    logger.error(`Unknown or invalid option(s): ${args.unknown.join(", ")}`);
    logger.plain(HELP);
    return { exitCode: 1 };
  }
  if (args.version && args.command === void 0) {
    logger.plain(CLI_VERSION);
    return { exitCode: 0 };
  }
  if (args.help || args.command === void 0) {
    logger.plain(HELP);
    return { exitCode: args.command === void 0 && !args.help ? 1 : 0 };
  }
  try {
    return await dispatch(args, cwd, logger, options.returnServer === true);
  } catch (err) {
    if (err instanceof CliError) {
      logger.error(err.message);
      if (err.suggestion !== void 0) logger.plain(err.suggestion);
      return { exitCode: err.exitCode };
    }
    logger.error(`Unexpected error: ${err.message}`);
    return { exitCode: 1 };
  }
}
async function dispatch(args, cwd, logger, returnServer) {
  const projectCwd = args.dir ?? cwd;
  switch (args.command) {
    case "create": {
      const targetDir = args.positionals[0] ?? args.dir;
      if (targetDir === void 0) {
        throw new CliError("create requires a target directory.", {
          suggestion: "Usage: streetui create <dir> [--template basic|ssr]"
        });
      }
      await createProject({
        targetDir,
        ...args.template !== void 0 ? { template: args.template } : {},
        frameworkVersion: CLI_VERSION,
        logger
      });
      return { exitCode: 0 };
    }
    case "build": {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      const out = await buildProject(project, "production");
      logger.success(`Build complete \u2192 ${out.clientDir}`);
      return { exitCode: 0 };
    }
    case "dev": {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      const server = await runDev({
        project,
        logger,
        ...args.host !== void 0 ? { host: args.host } : {},
        ...args.port !== void 0 ? { port: args.port } : {}
      });
      if (returnServer) return { exitCode: 0, server };
      await blockForever();
      return { exitCode: 0 };
    }
    case "start": {
      const project = await resolveProject(projectCwd);
      const running = await runStart({
        project,
        logger,
        ...args.host !== void 0 ? { host: args.host } : {},
        ...args.port !== void 0 ? { port: args.port } : {}
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.close } };
      await blockForever();
      return { exitCode: 0 };
    }
    default:
      throw new CliError(`Unknown command "${args.command}".`, {
        suggestion: 'Run "streetui --help" to see available commands.'
      });
  }
}
function blockForever() {
  return new Promise(() => {
  });
}

// src/bin.ts
runCli(process.argv.slice(2)).then((result) => {
  if (result.exitCode !== 0) process.exitCode = result.exitCode;
}).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
//# sourceMappingURL=bin.cjs.map