// src/index.ts
import { existsSync as existsSync11 } from "node:fs";
import { readdirSync as readdirSync2 } from "node:fs";
import { spawnSync } from "node:child_process";
import { join as join18 } from "node:path";

// src/args.ts
var VALUE_FLAGS = /* @__PURE__ */ new Set(["port", "host", "template", "dir"]);
var BOOLEAN_FLAGS = /* @__PURE__ */ new Set(["help", "version", "json"]);
var SHORT = { h: "help", v: "version", p: "port" };
function parseArgs(argv) {
  let command;
  const positionals = [];
  const unknown = [];
  let help = false;
  let version = false;
  let json = false;
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
      const inlineValue = eq >= 0 ? raw.slice(eq + 1) : void 0;
      if (!isLong) name = SHORT[name] ?? name;
      if (BOOLEAN_FLAGS.has(name)) {
        if (name === "help") help = true;
        else if (name === "version") version = true;
        else if (name === "json") json = true;
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
      continue;
    }
    if (command === void 0) command = token;
    else positionals.push(token);
  }
  return { command, positionals, help, version, port, host, template, dir, json, unknown };
}

// src/logger.ts
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

// src/diagnostics.ts
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

// src/project.ts
import { existsSync as existsSync2, readFileSync } from "node:fs";
import { resolve as resolve2, join as join2 } from "node:path";

// src/config.ts
import { rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as ts from "typescript";
function defineConfig(config) {
  return config;
}
var DEFAULTS = {
  port: 3e3,
  host: "localhost",
  clientEntry: "src/main.ts",
  serverEntry: "src/server.ts",
  outDir: "dist",
  publicDir: "public",
  sourcemap: true,
  spaFallback: true,
  hmr: true
};
var DEFAULT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];
var CONFIG_FILENAMES = ["streetui.config.ts", "streetui.config.mjs", "streetui.config.js"];
function findConfigFile(root) {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(root, name);
    if (existsSync(candidate)) return candidate;
  }
  return void 0;
}
function transpileConfig(source, file) {
  const result = ts.transpileModule(source, {
    fileName: file,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: false,
      esModuleInterop: true,
      isolatedModules: true
    }
  });
  return result.outputText;
}
async function importConfigFile(file) {
  if (!file.endsWith(".ts")) {
    const mod = await import(pathToFileURL(file).href);
    return mod.default ?? {};
  }
  const source = await (await import("node:fs/promises")).readFile(file, "utf8");
  const code = transpileConfig(source, file);
  const outFile = join(dirname(file), `.streetui.config.${Date.now()}.mjs`);
  try {
    await writeFile(outFile, code, "utf8");
    const mod = await import(pathToFileURL(outFile).href);
    return mod.default ?? {};
  } finally {
    await rm(outFile, { force: true });
  }
}
function toAbsolute(root, p) {
  return isAbsolute(p) ? p : resolve(root, p);
}
function resolveAliases(root, alias) {
  if (alias === void 0) return {};
  const result = {};
  for (const [key, target] of Object.entries(alias)) {
    result[key] = isAbsolute(target) ? target : resolve(root, target);
  }
  return result;
}
async function loadConfig(root) {
  const absRoot = resolve(root);
  const file = findConfigFile(absRoot);
  const user = file ? await importConfigFile(file) : {};
  return {
    root: absRoot,
    port: user.port ?? DEFAULTS.port,
    host: user.host ?? DEFAULTS.host,
    clientEntry: toAbsolute(absRoot, user.clientEntry ?? DEFAULTS.clientEntry),
    serverEntry: toAbsolute(absRoot, user.serverEntry ?? DEFAULTS.serverEntry),
    outDir: toAbsolute(absRoot, user.outDir ?? DEFAULTS.outDir),
    publicDir: toAbsolute(absRoot, user.publicDir ?? DEFAULTS.publicDir),
    aliases: resolveAliases(absRoot, user.alias),
    extensions: user.extensions ?? DEFAULT_EXTENSIONS,
    sourcemap: user.sourcemap ?? DEFAULTS.sourcemap,
    spaFallback: user.spaFallback ?? DEFAULTS.spaFallback,
    hmr: user.hmr ?? DEFAULTS.hmr
  };
}

// src/project.ts
function readPackageJson(root) {
  const pkgPath = join2(root, "package.json");
  if (!existsSync2(pkgPath)) {
    throw new CliError(`No package.json found in ${root}.`, {
      suggestion: 'Run this command from the root of a StreetUI project, or create one with "npm create streetui@latest".'
    });
  }
  let raw;
  try {
    raw = readFileSync(pkgPath, "utf8");
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
  const root = resolve2(cwd);
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
  if (options?.requireEntry === true && !existsSync2(config.clientEntry)) {
    throw new CliError(`Client entry not found: ${config.clientEntry}`, {
      suggestion: 'Create the entry file, or set "clientEntry" in streetui.config.ts to point at your app entry.'
    });
  }
  return { root, packageJson, config };
}

// src/toolchain/build/builder.ts
import { copyFile, mkdir, readFile as readFile2, readdir, rm as rm2, writeFile as writeFile3 } from "node:fs/promises";
import { existsSync as existsSync4 } from "node:fs";
import { basename as basename2, dirname as dirname4, extname as extname3, join as join6, sep as sep4 } from "node:path";

// src/toolchain/json/events.ts
import { randomUUID } from "node:crypto";
var STREETUI_EVENT_SCHEMA_VERSION = 1;
function makeEventId() {
  return randomUUID();
}
function createEventLogger(options = {}) {
  const write = options.write ?? ((line) => console.log(line));
  const now = options.now ?? (() => /* @__PURE__ */ new Date());
  const sessionId = options.sessionId ?? makeEventId();
  return {
    emit(event) {
      write(JSON.stringify(event));
    },
    send(event, payload, opts) {
      const { event: _ignored, ...rest } = payload;
      const full = {
        schemaVersion: STREETUI_EVENT_SCHEMA_VERSION,
        eventId: makeEventId(),
        sessionId: opts?.sessionId ?? sessionId,
        framework: "streetui",
        timestamp: now().toISOString(),
        ...rest,
        event
      };
      write(JSON.stringify(full));
    }
  };
}
var silentEventLogger = {
  emit() {
  },
  send() {
  }
};

// src/toolchain/graph/crawl.ts
import { readFileSync as readFileSync3, statSync as statSync2 } from "node:fs";

// src/toolchain/resolve/resolver.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, statSync } from "node:fs";
import { dirname as dirname2, extname, isAbsolute as isAbsolute3, join as join3, resolve as resolve4, sep as sep2 } from "node:path";

// src/toolchain/resolve/paths.ts
import { isAbsolute as isAbsolute2, relative, resolve as resolve3, sep } from "node:path";
function safeDecode(value) {
  try {
    const decoded = decodeURIComponent(value);
    return decoded.includes("\0") ? void 0 : decoded;
  } catch {
    return void 0;
  }
}
function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel === "" || !rel.startsWith("..") && !isAbsolute2(rel);
}
function toPosix(value) {
  return value.split(sep).join("/");
}
function pathnameOf(url) {
  const q = url.indexOf("?");
  const h = url.indexOf("#");
  let end = url.length;
  if (q >= 0) end = Math.min(end, q);
  if (h >= 0) end = Math.min(end, h);
  return url.slice(0, end);
}

// src/toolchain/resolve/resolver.ts
var DEFAULT_EXTENSIONS2 = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"];
var BROWSER_CONDITIONS = ["browser", "import", "module", "default"];
var NODE_CONDITIONS = ["node", "import", "require", "default"];
var ASSET_EXTENSIONS = /* @__PURE__ */ new Set([
  ".svg",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp4",
  ".webm",
  ".mp3",
  ".wav",
  ".pdf"
]);
function kindForFile(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  if (ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts") return "ts";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "js";
  if (ASSET_EXTENSIONS.has(ext)) return "asset";
  return "asset";
}
function formatForFile(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".mjs" || ext === ".mts") return "esm";
  if (ext === ".cjs" || ext === ".cts") return "cjs";
  let dir = dirname2(resolve4(file));
  while (true) {
    const pkgJsonPath = join3(dir, "package.json");
    if (existsSync3(pkgJsonPath)) {
      try {
        const type_ = JSON.parse(readFileSync2(pkgJsonPath, "utf8")).type;
        return type_ === "module" ? "esm" : "cjs";
      } catch {
        return "cjs";
      }
    }
    const parent = dirname2(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "cjs";
}
function isFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
function withExtensionCandidates(base, extensions) {
  const candidates = [base];
  if (base.endsWith(".js")) {
    const stem = base.slice(0, -3);
    candidates.push(`${stem}.ts`, `${stem}.tsx`, `${stem}.mts`, `${stem}.cts`);
  } else if (base.endsWith(".mjs")) {
    candidates.push(`${base.slice(0, -4)}.mts`);
  } else if (base.endsWith(".cjs")) {
    candidates.push(`${base.slice(0, -4)}.cts`);
  }
  for (const ext of extensions) {
    if (!extname(base)) candidates.push(`${base}${ext}`);
  }
  return candidates;
}
function resolveFile(base, extensions) {
  for (const candidate of withExtensionCandidates(base, extensions)) {
    if (isFile(candidate)) return candidate;
  }
  if (isDirectory(base)) {
    for (const ext of extensions) {
      const index = join3(base, `index${ext}`);
      if (isFile(index)) return index;
    }
  }
  return void 0;
}
function findPackage(name, startDir, root) {
  let dir = resolve4(startDir);
  while (true) {
    const candidate = join3(dir, "node_modules", name);
    if (isInside(root, candidate)) {
      const pkgJsonPath = join3(candidate, "package.json");
      if (existsSync3(pkgJsonPath)) {
        try {
          return { dir: candidate, json: JSON.parse(readFileSync2(pkgJsonPath, "utf8")) };
        } catch {
          return void 0;
        }
      }
    }
    const parent = dirname2(dir);
    if (parent === dir) return void 0;
    dir = parent;
  }
}
function isSubpathMap(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).some((key) => key.startsWith("."));
}
function resolveExportTarget(target, pkgDir, conditions, star) {
  if (typeof target === "string") {
    const withStar = star === void 0 ? target : target.split("*").join(star);
    if (!withStar.startsWith("./")) return void 0;
    return resolveFile(join3(pkgDir, withStar.slice(2)), [".js", ".mjs", ".cjs", ".json", ".ts"]);
  }
  if (Array.isArray(target)) {
    for (const entry of target) {
      const resolved = resolveExportTarget(entry, pkgDir, conditions, star);
      if (resolved !== void 0) return resolved;
    }
    return void 0;
  }
  if (typeof target === "object" && target !== null) {
    const record = target;
    for (const condition of conditions) {
      if (condition in record) {
        const resolved = resolveExportTarget(record[condition], pkgDir, conditions, star);
        if (resolved !== void 0) return resolved;
      }
    }
    if ("default" in record) return resolveExportTarget(record.default, pkgDir, conditions, star);
  }
  return void 0;
}
function matchSubpath(exportsValue, subpath, pkgDir, conditions) {
  if (typeof exportsValue === "string" || Array.isArray(exportsValue) || !isSubpathMap(exportsValue)) {
    if (subpath !== ".") return void 0;
    return resolveExportTarget(exportsValue, pkgDir, conditions, void 0);
  }
  if (subpath in exportsValue) {
    return resolveExportTarget(exportsValue[subpath], pkgDir, conditions, void 0);
  }
  for (const [key, value] of Object.entries(exportsValue)) {
    const star = key.indexOf("*");
    if (star < 0) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (subpath.startsWith(prefix) && subpath.endsWith(suffix) && subpath.length >= prefix.length + suffix.length) {
      const captured = subpath.slice(prefix.length, subpath.length - suffix.length);
      return resolveExportTarget(value, pkgDir, conditions, captured);
    }
  }
  return void 0;
}
function resolvePackage(name, subpath, startDir, root, conditions) {
  const pkg = findPackage(name, startDir, root);
  if (pkg === void 0) return void 0;
  if (pkg.json.exports !== void 0) {
    const resolved2 = matchSubpath(pkg.json.exports, subpath, pkg.dir, conditions);
    if (resolved2 !== void 0) {
      return { kind: kindForFile(resolved2), file: resolved2, format: formatForFile(resolved2), pkgName: name, pkgDir: pkg.dir };
    }
    return void 0;
  }
  const legacy = subpath === "." ? pkg.json.module ?? pkg.json.main ?? "index.js" : subpath;
  const resolved = resolveFile(join3(pkg.dir, legacy), [".js", ".mjs", ".cjs", ".json", ".ts"]);
  if (resolved === void 0) return void 0;
  return { kind: kindForFile(resolved), file: resolved, format: formatForFile(resolved), pkgName: name, pkgDir: pkg.dir };
}
function resolveAlias(specifier, aliases, root, extensions) {
  for (const [key, target] of Object.entries(aliases)) {
    if (key.endsWith("*")) {
      const prefix = key.slice(0, -1);
      if (specifier.startsWith(prefix)) {
        const rest = specifier.slice(prefix.length);
        const substituted = target.includes("*") ? target.split("*").join(rest) : join3(target, rest);
        const absoluteTarget = isAbsolute3(substituted) ? substituted : resolve4(root, substituted);
        return resolveFile(absoluteTarget, extensions);
      }
    } else if (specifier === key) {
      const absoluteTarget = isAbsolute3(target) ? target : resolve4(root, target);
      return resolveFile(absoluteTarget, extensions);
    }
  }
  return void 0;
}
function findNearestPackage(startDir, root) {
  let dir = resolve4(startDir);
  while (true) {
    const pkgJsonPath = join3(dir, "package.json");
    if (isInside(root, pkgJsonPath) && existsSync3(pkgJsonPath)) {
      try {
        return { dir, json: JSON.parse(readFileSync2(pkgJsonPath, "utf8")) };
      } catch {
        return void 0;
      }
    }
    const parent = dirname2(dir);
    if (parent === dir) return void 0;
    dir = parent;
  }
}
function resolvePackageImports(specifier, startDir, root, conditions) {
  const pkg = findNearestPackage(startDir, root);
  const imports = pkg?.json.imports;
  if (imports === void 0 || typeof imports !== "object" || imports === null) return void 0;
  let target;
  if (Object.prototype.hasOwnProperty.call(imports, specifier)) {
    target = imports[specifier];
  } else {
    for (const [key, value] of Object.entries(imports)) {
      const star = key.indexOf("*");
      if (star < 0) continue;
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      if (specifier.startsWith(prefix) && specifier.endsWith(suffix) && specifier.length >= prefix.length + suffix.length) {
        const captured = specifier.slice(prefix.length, specifier.length - suffix.length);
        target = typeof value === "string" ? value.split("*").join(captured) : value;
        break;
      }
    }
  }
  if (target === void 0) return void 0;
  if (pkg === void 0) return void 0;
  const resolved = resolveExportTarget(target, pkg.dir, conditions, void 0);
  if (resolved === void 0) return void 0;
  return { kind: kindForFile(resolved), file: resolved, format: formatForFile(resolved), pkgName: pkg.json.name, pkgDir: pkg.dir };
}
function splitQuery(specifier) {
  const index = specifier.indexOf("?");
  if (index < 0) return { path: specifier };
  return { path: specifier.slice(0, index), query: specifier.slice(index + 1) };
}
function finish(file, kind, pkg, query) {
  return {
    kind,
    file,
    format: formatForFile(file),
    ...pkg?.name !== void 0 ? { pkgName: pkg.name } : {},
    ...pkg?.dir !== void 0 ? { pkgDir: pkg.dir } : {},
    ...query !== void 0 ? { query } : {}
  };
}
function createResolver(options) {
  const root = resolve4(options.root);
  const extensions = options.extensions ?? DEFAULT_EXTENSIONS2;
  const aliases = options.aliases ?? {};
  const conditions = options.conditions ?? BROWSER_CONDITIONS;
  const resolveWith = (specifier, importerFile, conditionsForMode) => {
    const { path, query } = splitQuery(specifier);
    if (path.length === 0) return void 0;
    if (path.startsWith("node:")) return finish(path, "builtin", void 0, query);
    const withinRoot = (file2) => file2 !== void 0 && isInside(root, file2) ? file2 : void 0;
    const alias = withinRoot(resolveAlias(path, aliases, root, extensions));
    if (alias !== void 0) return finish(alias, kindForFile(alias), void 0, query);
    if (path.startsWith("#")) {
      const resolved2 = resolvePackageImports(path, importerFile === void 0 ? root : dirname2(importerFile), root, conditionsForMode);
      if (resolved2 === void 0) return void 0;
      const file2 = withinRoot(resolved2.file);
      return file2 === void 0 ? void 0 : finish(file2, resolved2.kind, { name: resolved2.pkgName, dir: resolved2.pkgDir }, query);
    }
    if (path.startsWith("/")) {
      const file2 = withinRoot(resolveFile(join3(root, path), extensions));
      return file2 === void 0 ? void 0 : finish(file2, kindForFile(file2), void 0, query);
    }
    if (path.startsWith("./") || path.startsWith("../")) {
      const base = importerFile === void 0 ? root : dirname2(importerFile);
      const file2 = withinRoot(resolveFile(resolve4(base, path), extensions));
      return file2 === void 0 ? void 0 : finish(file2, kindForFile(file2), void 0, query);
    }
    const segments = path.split("/");
    const name = path.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
    if (name === void 0) return void 0;
    const subpath = `.${path.slice(name.length)}` || ".";
    const resolved = resolvePackage(name, subpath, importerFile === void 0 ? root : dirname2(importerFile), root, conditionsForMode);
    if (resolved === void 0) return void 0;
    const file = withinRoot(resolved.file);
    if (file === void 0) return void 0;
    return finish(file, resolved.kind, { name, dir: resolved.pkgDir }, query);
  };
  return {
    root,
    extensions,
    aliases,
    resolve: (specifier, importerFile) => resolveWith(specifier, importerFile, conditions),
    resolveBrowser: (specifier, importerFile) => resolveWith(specifier, importerFile, BROWSER_CONDITIONS),
    resolveNode: (specifier, importerFile) => resolveWith(specifier, importerFile, NODE_CONDITIONS)
  };
}
function fileToUrl(file, root) {
  const normalized = resolve4(file);
  if (!isInside(root, normalized)) return void 0;
  const marker = `${sep2}node_modules${sep2}`;
  const index = normalized.indexOf(marker);
  if (index >= 0) {
    const after = normalized.slice(index + marker.length);
    const parts = after.split(sep2);
    let name;
    let rest;
    if (parts[0]?.startsWith("@")) {
      name = `${parts[0]}/${parts[1] ?? ""}`;
      rest = parts.slice(2);
    } else {
      name = parts[0] ?? "";
      rest = parts.slice(1);
    }
    return `/@streetui/pkg/${name}/${rest.join("/")}`;
  }
  return `/${toPosix(normalized.slice(root.length).replace(/^[/\\]/, ""))}`;
}
function urlToFile(url, root) {
  const { path } = splitQuery(url);
  let decoded;
  try {
    decoded = safeDecode(path);
  } catch {
    return void 0;
  }
  if (decoded === void 0) return void 0;
  if (decoded.startsWith("/@streetui/pkg/")) {
    const rest = decoded.slice("/@streetui/pkg/".length);
    const parts = rest.split("/");
    let name;
    let relative7;
    if (rest.startsWith("@")) {
      name = `${parts[0] ?? ""}/${parts[1] ?? ""}`;
      relative7 = parts.slice(2).join("/");
    } else {
      name = parts[0] ?? "";
      relative7 = parts.slice(1).join("/");
    }
    const pkg = findPackage(name, root, root);
    if (pkg === void 0) return void 0;
    const file2 = resolve4(pkg.dir, relative7);
    return isInside(root, file2) ? file2 : void 0;
  }
  if (decoded.startsWith("/@streetui/")) return void 0;
  const file = resolve4(root, decoded.replace(/^\/+/, ""));
  return isInside(root, file) ? file : void 0;
}

// src/toolchain/graph/graph.ts
import { createHash } from "node:crypto";
function hashContent(source) {
  return createHash("sha256").update(source).digest("hex");
}
function shortHash(source, length = 8) {
  return hashContent(source).slice(0, length);
}
var ModuleGraph = class {
  nodes = /* @__PURE__ */ new Map();
  root;
  constructor(root) {
    this.root = root;
  }
  add(node) {
    const existing = this.nodes.get(node.id);
    if (existing !== void 0) return existing;
    this.nodes.set(node.id, node);
    return node;
  }
  get(id) {
    return this.nodes.get(id);
  }
  connect(importerId, specifier, dependencyId) {
    const importer = this.nodes.get(importerId);
    const dependency = this.nodes.get(dependencyId);
    if (importer === void 0 || dependency === void 0) return;
    importer.dependencies.set(specifier, dependencyId);
    dependency.importers.add(importerId);
  }
  /** Mark a module dirty and clear its cached transform state. */
  invalidate(id) {
    const node = this.nodes.get(id);
    if (node === void 0) return void 0;
    node.state = "dirty";
    node.error = void 0;
    return node;
  }
  /** All transitive importers of a module, nearest first. */
  dependents(id) {
    const seen = /* @__PURE__ */ new Set();
    const queue = [id];
    const result = [];
    while (queue.length > 0) {
      const current = queue.shift();
      const node = this.nodes.get(current);
      if (node === void 0) continue;
      for (const importer of node.importers) {
        if (seen.has(importer)) continue;
        seen.add(importer);
        result.push(importer);
        queue.push(importer);
      }
    }
    return result;
  }
  /** Dependency cycles as arrays of module ids. */
  detectCycles() {
    const cycles = [];
    const state = /* @__PURE__ */ new Map();
    const stack = [];
    const visit = (id) => {
      const current = state.get(id);
      if (current === "visited") return;
      if (current === "visiting") {
        const start = stack.indexOf(id);
        if (start >= 0) cycles.push([...stack.slice(start), id]);
        return;
      }
      state.set(id, "visiting");
      stack.push(id);
      const node = this.nodes.get(id);
      if (node !== void 0) {
        for (const dependency of node.dependencies.values()) visit(dependency);
      }
      stack.pop();
      state.set(id, "visited");
    };
    for (const id of this.nodes.keys()) visit(id);
    return cycles;
  }
  /** Depth-first post-order traversal from an entry (dependencies before importers). */
  postOrder(entryId) {
    const visited = /* @__PURE__ */ new Set();
    const result = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node === void 0) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
      result.push(id);
    };
    visit(entryId);
    return result;
  }
  /** Depth-first pre-order traversal from an entry (importers before dependencies). */
  preOrder(entryId) {
    const visited = /* @__PURE__ */ new Set();
    const result = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      result.push(id);
      const node = this.nodes.get(id);
      if (node === void 0) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
    };
    visit(entryId);
    return result;
  }
  /** CSS nodes reachable from an entry, in import order. */
  cssInOrder(entryId) {
    const visited = /* @__PURE__ */ new Set();
    const result = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node === void 0) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
      if (node.kind === "css") result.push(node);
    };
    visit(entryId);
    return result;
  }
  /** Asset nodes reachable from an entry. */
  assets(entryId) {
    const visited = /* @__PURE__ */ new Set();
    const result = [];
    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const node = this.nodes.get(id);
      if (node === void 0) return;
      for (const dependency of node.dependencies.values()) visit(dependency);
      if (node.kind === "asset") result.push(node);
    };
    visit(entryId);
    return result;
  }
};

// src/toolchain/transform/typescript.ts
import { basename, dirname as dirname3, extname as extname2, join as join4, relative as relative2, resolve as resolve5, sep as sep3 } from "node:path";
import * as ts2 from "typescript";
function collectSpecifiers(source, fileName) {
  const sourceFile = ts2.createSourceFile(fileName, source, ts2.ScriptTarget.Latest, true, ts2.ScriptKind.TS);
  const refs = [];
  const push = (text, dynamic) => {
    if (!refs.some((ref) => ref.text === text && ref.dynamic === dynamic)) refs.push({ text, dynamic });
  };
  const visit = (node) => {
    if (ts2.isImportDeclaration(node) && ts2.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, false);
    } else if (ts2.isExportDeclaration(node) && node.moduleSpecifier !== void 0 && ts2.isStringLiteral(node.moduleSpecifier)) {
      push(node.moduleSpecifier.text, false);
    } else if (ts2.isCallExpression(node) && node.expression.kind === ts2.SyntaxKind.ImportKeyword && node.arguments[0] !== void 0 && ts2.isStringLiteral(node.arguments[0])) {
      push(node.arguments[0].text, true);
    }
    ts2.forEachChild(node, visit);
  };
  visit(sourceFile);
  return refs;
}
function usesHotApi(source) {
  return /import\s*\.\s*meta\s*\.\s*hot/.test(source);
}
function defaultBinding(node) {
  const clause = node.importClause;
  if (clause?.name === void 0) return void 0;
  return clause.name.text;
}
function findSpecifier(node) {
  if (ts2.isImportDeclaration(node) && ts2.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier;
  if (ts2.isExportDeclaration(node) && node.moduleSpecifier !== void 0 && ts2.isStringLiteral(node.moduleSpecifier)) {
    return node.moduleSpecifier;
  }
  if (ts2.isCallExpression(node) && node.expression.kind === ts2.SyntaxKind.ImportKeyword && node.arguments[0] !== void 0 && ts2.isStringLiteral(node.arguments[0])) {
    return node.arguments[0];
  }
  return void 0;
}
function isImportMetaHot(node) {
  return ts2.isPropertyAccessExpression(node) && ts2.isMetaProperty(node.expression) && node.expression.keywordToken === ts2.SyntaxKind.ImportKeyword && node.name.text === "hot";
}
function isHotAcceptCall(node) {
  return ts2.isCallExpression(node) && ts2.isPropertyAccessExpression(node.expression) && node.expression.name.text === "accept" && isImportMetaHot(node.expression.expression) && node.arguments[0] !== void 0 && ts2.isStringLiteral(node.arguments[0]);
}
function envObjectLiteral(env) {
  const entries = Object.entries(env);
  if (entries.length === 0) return ts2.factory.createObjectLiteralExpression();
  return ts2.factory.createObjectLiteralExpression(
    entries.map(
      ([key, value]) => ts2.factory.createPropertyAssignment(
        ts2.factory.createStringLiteral(key),
        ts2.factory.createStringLiteral(value)
      )
    )
  );
}
function isProcessEnvAccess(node) {
  return ts2.isPropertyAccessExpression(node) && ts2.isIdentifier(node.expression) && node.expression.text === "process" && node.name.text === "env";
}
function isProcessEnvMember(node) {
  return ts2.isPropertyAccessExpression(node) && ts2.isPropertyAccessExpression(node.expression) && ts2.isIdentifier(node.expression.expression) && node.expression.expression.text === "process" && node.expression.name.text === "env" && ts2.isIdentifier(node.name);
}
function toBuildProblems(diagnostics, source, fileName) {
  const sourceFile = ts2.createSourceFile(fileName, source, ts2.ScriptTarget.Latest, true, ts2.ScriptKind.TS);
  const lines = source.split(/\r?\n/);
  const problems = [];
  for (const diagnostic of diagnostics) {
    const message = ts2.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (diagnostic.start === void 0) {
      problems.push({ message });
      continue;
    }
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(diagnostic.start);
    problems.push({
      message,
      file: fileName,
      line: line + 1,
      column: character + 1,
      lineText: lines[line] ?? ""
    });
  }
  return problems;
}
var COMPILER_OPTIONS = {
  target: ts2.ScriptTarget.ES2022,
  module: ts2.ModuleKind.ESNext,
  moduleResolution: ts2.ModuleResolutionKind.Bundler,
  isolatedModules: true,
  sourceMap: true,
  inlineSources: true,
  useDefineForClassFields: true,
  esModuleInterop: true,
  forceConsistentCasingInFileNames: true,
  skipLibCheck: true,
  removeComments: false
};
function transformModule(source, options) {
  const { fileName, moduleId, mode, resolve: resolve8 } = options;
  const env = options.env ?? {};
  const specifiers = collectSpecifiers(source, fileName);
  const dependencies = specifiers.map((ref) => ref.text);
  const hot = usesHotApi(source);
  const assetDeclarations = [];
  const resolved = /* @__PURE__ */ new Map();
  for (const ref of specifiers) {
    if (!resolved.has(ref.text)) resolved.set(ref.text, resolve8(ref.text));
  }
  const transformer = (context) => {
    const factory2 = context.factory;
    const visitor = (node) => {
      if (isImportMetaHot(node)) return factory2.createIdentifier("__streetui_hot");
      if (isHotAcceptCall(node) && node.arguments[0] !== void 0 && ts2.isStringLiteral(node.arguments[0])) {
        const id = options.resolveId?.(node.arguments[0].text);
        const callee = factory2.createPropertyAccessExpression(factory2.createIdentifier("__streetui_hot"), "accept");
        if (id !== void 0) {
          return factory2.updateCallExpression(node, callee, node.typeArguments, [
            factory2.createStringLiteral(id),
            ...node.arguments.slice(1)
          ]);
        }
        return factory2.updateCallExpression(node, callee, node.typeArguments, node.arguments);
      }
      if (isProcessEnvMember(node)) {
        const name = node.name.text;
        if (name === "NODE_ENV") {
          return factory2.createStringLiteral(mode === "production" ? "production" : "development");
        }
        if (name.startsWith("STREETUI_PUBLIC_") && env[name] !== void 0) {
          return factory2.createStringLiteral(env[name]);
        }
        return factory2.createIdentifier("undefined");
      }
      if (isProcessEnvAccess(node)) return envObjectLiteral(env);
      const specifier = findSpecifier(node);
      if (specifier !== void 0) {
        const target = resolved.get(specifier.text);
        if (target !== void 0) {
          if (mode === "production" && (target.kind === "css" || target.kind === "asset")) {
            if (target.kind === "asset" && ts2.isImportDeclaration(node)) {
              const binding = defaultBinding(node);
              if (binding !== void 0) assetDeclarations.push(`const ${binding} = ${JSON.stringify(target.url)};`);
            }
            return void 0;
          }
          const replacement = factory2.createStringLiteral(target.url);
          if (ts2.isImportDeclaration(node)) {
            return factory2.updateImportDeclaration(
              node,
              node.modifiers,
              node.importClause,
              replacement,
              node.assertClause
            );
          }
          if (ts2.isExportDeclaration(node)) {
            return factory2.updateExportDeclaration(
              node,
              node.modifiers,
              node.isTypeOnly,
              node.exportClause,
              replacement,
              node.assertClause
            );
          }
          if (ts2.isCallExpression(node) && node.arguments[0] !== void 0) {
            return factory2.updateCallExpression(
              node,
              node.expression,
              node.typeArguments,
              [replacement, ...node.arguments.slice(1)]
            );
          }
        }
      }
      if (ts2.isCallExpression(node) && node.expression.kind === ts2.SyntaxKind.ImportKeyword) {
        const first = node.arguments[0];
        if (first !== void 0 && ts2.isStringLiteral(first)) {
          const target = resolved.get(first.text);
          if (target !== void 0) {
            return factory2.updateCallExpression(node, node.expression, node.typeArguments, [
              factory2.createStringLiteral(target.url),
              ...node.arguments.slice(1)
            ]);
          }
        }
      }
      return ts2.visitEachChild(node, visitor, context);
    };
    return (transformed) => ts2.visitNode(transformed, visitor);
  };
  const result = ts2.transpileModule(source, {
    compilerOptions: COMPILER_OPTIONS,
    fileName,
    reportDiagnostics: true,
    transformers: { before: [transformer] }
  });
  let code = result.outputText;
  if (hot) {
    const header = mode === "development" ? `import { createHotContext as __streetui_createHotContext } from "/@streetui/client/hmr-runtime.js";
const __streetui_hot = __streetui_createHotContext(${JSON.stringify(moduleId)});
` : `const __streetui_hot = { accept() {}, dispose() {} };
`;
    code = `${header}${assetDeclarations.join("\n")}${assetDeclarations.length > 0 ? "\n" : ""}${code}`;
  } else if (assetDeclarations.length > 0) {
    code = `${assetDeclarations.join("\n")}
${code}`;
  }
  return {
    code,
    ...result.sourceMapText !== void 0 ? { sourceMap: result.sourceMapText } : {},
    diagnostics: toBuildProblems(result.diagnostics ?? [], source, fileName),
    dependencies,
    usesHot: hot
  };
}
function inlineSourceMap(map) {
  const encoded = Buffer.from(map, "utf8").toString("base64");
  return `
//# sourceMappingURL=data:application/json;base64,${encoded}`;
}
function externalSourceMap(outputFile) {
  return `
//# sourceMappingURL=${basename(outputFile)}.map`;
}
function withExtension(file, extension) {
  const ext = extname2(file);
  if (ext.length === 0) return `${file}${extension}`;
  return `${file.slice(0, -ext.length)}${extension}`;
}
function serverOutputPath(root, file, entryFile) {
  if (file === entryFile) return "server.js";
  const relative7 = file.slice(root.length).replace(/^[/\\]/, "");
  return withExtension(relative7, ".js").split("\\").join("/");
}
function relativeOutputSpecifier(fromFile, toFile) {
  const fromDir = dirname3(resolve5(fromFile));
  let relativePath = relative2(fromDir, resolve5(toFile));
  if (relativePath === "") relativePath = ".";
  else if (!relativePath.startsWith(".")) relativePath = `./${relativePath}`;
  return relativePath.split(sep3).join("/");
}

// src/toolchain/graph/crawl.ts
function mtimeOf(file) {
  try {
    return statSync2(file).mtimeMs;
  } catch {
    return 0;
  }
}
function crawl(options) {
  const { entry, root, mode } = options;
  const resolver = createResolver({ root, ...options.resolver ?? {} });
  const graph = new ModuleGraph(root);
  const diagnostics = [];
  const visited = /* @__PURE__ */ new Set();
  const resolveSpecifier = (specifier, importerFile) => {
    if (options.resolveSpecifier !== void 0) return options.resolveSpecifier(specifier, importerFile);
    const resolved = mode === "production" ? resolver.resolveNode(specifier, importerFile) : resolver.resolveBrowser(specifier, importerFile);
    if (resolved === void 0 || resolved.kind === "builtin") return void 0;
    return { file: resolved.file, kind: resolved.kind };
  };
  const visit = (file) => {
    if (visited.has(file)) return;
    visited.add(file);
    let source;
    try {
      source = options.readFile !== void 0 ? options.readFile(file) : readFileSync3(file, "utf8");
    } catch (error) {
      diagnostics.push({
        message: `Could not read module ${file}: ${error.message}`,
        file
      });
      return;
    }
    const url = fileToUrl(file, root);
    if (url === void 0) {
      diagnostics.push({ message: `Module is outside the project root and cannot be served: ${file}`, file });
      return;
    }
    const kind = kindOf(file);
    const node = graph.add({
      id: file,
      url,
      file,
      kind,
      source,
      contentHash: hashContent(source),
      mtimeMs: mtimeOf(file),
      dependencies: /* @__PURE__ */ new Map(),
      importers: /* @__PURE__ */ new Set(),
      state: "clean",
      hmrAccepted: usesHotApi(source)
    });
    if (kind !== "ts" && kind !== "js") return;
    if (options.shouldRecurse !== void 0 && !options.shouldRecurse(file)) return;
    for (const ref of collectSpecifiers(source, file)) {
      if (ref.text.startsWith("node:")) continue;
      const resolved = resolveSpecifier(ref.text, file);
      if (resolved === void 0) {
        diagnostics.push({
          message: `Could not resolve "${ref.text}" from ${file}`,
          file,
          suggestion: ref.text.startsWith("@streetui/") ? 'Run "npm install" so the StreetUI package is present in node_modules.' : "Check the import path and file extension."
        });
        continue;
      }
      visit(resolved.file);
      graph.connect(node.id, ref.text, resolved.file);
    }
  };
  visit(entry);
  return { graph, entryId: entry, diagnostics };
}
function kindOf(file) {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  if (ext === ".css") return "css";
  if (ext === ".json") return "json";
  if (ext === ".ts" || ext === ".tsx" || ext === ".mts" || ext === ".cts") return "ts";
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "js";
  return "asset";
}

// src/toolchain/build/manifest.ts
import { readFile, writeFile as writeFile2 } from "node:fs/promises";
import { join as join5 } from "node:path";
async function writeManifest(clientDir, manifest) {
  await writeFile2(join5(clientDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}
`, "utf8");
}
async function readManifest(clientDir) {
  try {
    return JSON.parse(await readFile(join5(clientDir, "manifest.json"), "utf8"));
  } catch {
    return void 0;
  }
}

// src/toolchain/build/builder.ts
function publicEnv(env = process.env) {
  const result = { NODE_ENV: "production" };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("STREETUI_PUBLIC_") && value !== void 0) result[key] = value;
  }
  return result;
}
function uniqueName(base, used) {
  let name = base;
  let counter = 1;
  while (used.has(name)) name = `${base}-${counter++}`;
  used.add(name);
  return name;
}
async function buildProject(options) {
  const started = Date.now();
  const { project, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const mode = options.mode ?? "production";
  const config = project.config;
  const root = config.root;
  const env = publicEnv();
  const problems = [];
  const resolver = createResolver({
    root,
    ...config.extensions !== void 0 ? { extensions: config.extensions } : {},
    ...config.aliases !== void 0 ? { aliases: config.aliases } : {}
  });
  events?.emit({
    event: "compilation_started",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    mode
  });
  await rm2(config.outDir, { recursive: true, force: true });
  const clientDir = join6(config.outDir, "client");
  const serverDir = join6(config.outDir, "server");
  await mkdir(clientDir, { recursive: true });
  const clientCrawl = crawl({ entry: config.clientEntry, root, mode: "production" });
  const clientGraph = clientCrawl.graph;
  problems.push(...clientCrawl.diagnostics);
  const entryNode = clientGraph.get(clientCrawl.entryId);
  if (entryNode === void 0) {
    throw new CliError(`Client entry could not be read: ${config.clientEntry}`);
  }
  const used = /* @__PURE__ */ new Set();
  const outputPath = /* @__PURE__ */ new Map();
  const outputUrl = /* @__PURE__ */ new Map();
  const assignJsName = (node) => {
    const name = node.id === clientCrawl.entryId ? uniqueName(`app-${shortHash(node.source)}.js`, used) : uniqueName(`${basename2(node.file).replace(/\.[^.]+$/, "")}-${shortHash(node.source + node.file)}.js`, used);
    const path = `assets/${name}`;
    outputPath.set(node.id, path);
    outputUrl.set(node.id, `/${path}`);
    return name;
  };
  const jsModules = clientGraph.preOrder(clientCrawl.entryId).map((id) => clientGraph.get(id)).filter((node) => {
    if (node === void 0) return false;
    return node.kind === "ts" || node.kind === "js" || node.kind === "json";
  });
  for (const node of jsModules) assignJsName(node);
  const cssNodes = clientGraph.cssInOrder(clientCrawl.entryId);
  const css = cssNodes.map((node) => node.source).join("\n");
  const cssName = uniqueName(`styles-${shortHash(css || entryNode.source)}.css`, used);
  const cssPath = `assets/${cssName}`;
  const assetNodes = clientGraph.assets(clientCrawl.entryId);
  const assetFiles = [];
  for (const node of assetNodes) {
    const content = await readFile2(node.file);
    const name = uniqueName(
      `${basename2(node.file).replace(/\.[^.]+$/, "")}-${shortHash(node.source + node.file)}.${extname3(node.file).slice(1)}`,
      used
    );
    const out = `assets/${name}`;
    outputPath.set(node.id, out);
    outputUrl.set(node.id, `/${out}`);
    assetFiles.push({ file: node.file, out });
  }
  const resolveClientTarget = (specifier, importerFile, importerOutput) => {
    const resolved = resolver.resolveBrowser(specifier, importerFile);
    if (resolved === void 0) return void 0;
    if (resolved.kind === "css") {
      return { url: `/${cssPath}`, kind: "css", id: resolved.file };
    }
    if (resolved.kind === "asset") {
      const url = outputUrl.get(resolved.file);
      if (url === void 0) return void 0;
      return { url, kind: "asset", id: resolved.file };
    }
    if (resolved.kind === "json") {
      const out2 = outputPath.get(resolved.file);
      if (out2 === void 0) return void 0;
      return { url: relativeOutputSpecifier(importerOutput, out2), kind: "json", id: resolved.file };
    }
    const out = outputPath.get(resolved.file);
    if (out === void 0) return void 0;
    return { url: relativeOutputSpecifier(importerOutput, out), kind: resolved.kind, id: resolved.file };
  };
  for (const node of jsModules) {
    const out = outputPath.get(node.id);
    if (out === void 0) continue;
    if (node.kind === "json") {
      const target2 = join6(clientDir, out);
      await mkdir(dirname4(target2), { recursive: true });
      await writeFile3(target2, `export default ${node.source};
`, "utf8");
      continue;
    }
    if (node.kind === "js" && formatForFile(node.file) === "cjs") {
      const importer = [...node.importers][0];
      problems.push({
        message: `Module ${node.file} is CommonJS and cannot be bundled for the browser. ` + (importer !== void 0 ? `Importing module: ${importer}. ` : "") + `Module format: CommonJS. Reason: StreetUI emits browser-native ESM; CommonJS package entry points are not converted. Choose an ESM entry (import/module condition or .mjs) or wrap the dependency in a small ESM adapter.`,
        file: node.file,
        importer
      });
      continue;
    }
    const transform = transformModule(node.source, {
      fileName: node.file,
      moduleId: node.id,
      mode,
      env,
      resolve: (specifier) => resolveClientTarget(specifier, node.file, out),
      resolveId: (specifier) => resolver.resolveBrowser(specifier, node.file)?.file
    });
    problems.push(...transform.diagnostics);
    if (transform.diagnostics.length > 0) continue;
    const target = join6(clientDir, out);
    await mkdir(dirname4(target), { recursive: true });
    const mapComment = transform.sourceMap !== void 0 ? externalSourceMap(basename2(out)) : "";
    await writeFile3(target, `${transform.code}${mapComment}`, "utf8");
    if (transform.sourceMap !== void 0) {
      await writeFile3(`${target}.map`, transform.sourceMap, "utf8");
    }
  }
  if (css.length > 0) {
    await mkdir(join6(clientDir, "assets"), { recursive: true });
    await writeFile3(join6(clientDir, cssPath), css, "utf8");
  }
  for (const asset of assetFiles) {
    const target = join6(clientDir, asset.out);
    await mkdir(dirname4(target), { recursive: true });
    await copyFile(asset.file, target);
  }
  const entryOut = outputPath.get(entryNode.id) ?? "assets/app.js";
  const manifest = {
    schemaVersion: 1,
    framework: "streetui",
    entry: {
      js: `/${entryOut}`,
      ...css.length > 0 ? { css: `/${cssPath}` } : {}
    },
    modules: Object.fromEntries(
      jsModules.map((node) => [node.id, `/${outputPath.get(node.id) ?? entryOut}`])
    ),
    assets: Object.fromEntries(assetFiles.map((asset) => {
      const node = assetNodes.find((candidate) => candidate.file === asset.file);
      return [node?.id ?? asset.file, `/${asset.out}`];
    })),
    dynamicImports: {}
  };
  await writeManifest(clientDir, manifest);
  if (!existsSync4(config.serverEntry)) {
    const tags = [
      manifest.entry.css !== void 0 ? `<link rel="stylesheet" href="${manifest.entry.css}" />` : "",
      `<script type="module" src="${manifest.entry.js}"></script>`
    ].filter((tag) => tag.length > 0).join("\n    ");
    const html = [
      "<!doctype html>",
      '<html lang="en">',
      "<head>",
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
      `  ${tags}`,
      "</head>",
      "<body>",
      '  <div id="app"></div>',
      "</body>",
      "</html>",
      ""
    ].join("\n");
    await writeFile3(join6(clientDir, "index.html"), html, "utf8");
  }
  if (existsSync4(config.publicDir)) {
    await copyDir(config.publicDir, clientDir);
  }
  let serverEntry;
  if (existsSync4(config.serverEntry)) {
    const serverCrawl = crawl({ entry: config.serverEntry, root, mode: "production" });
    problems.push(...serverCrawl.diagnostics);
    const serverGraph = serverCrawl.graph;
    await mkdir(serverDir, { recursive: true });
    await writeFile3(join6(serverDir, "package.json"), JSON.stringify({ type: "module" }), "utf8");
    const serverResolve = (specifier, importerFile, importerOutput) => {
      const isRelative = specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("/");
      const isAlias = Object.keys(resolver.aliases).some(
        (key) => key.endsWith("*") ? specifier.startsWith(key.slice(0, -1)) : specifier === key
      );
      if (!isRelative && !isAlias) return void 0;
      const resolved = resolver.resolveNode(specifier, importerFile);
      if (resolved === void 0) return void 0;
      if (resolved.kind === "css") return { url: "", kind: "css", id: resolved.file };
      if (resolved.kind === "asset") {
        const node = serverGraph.get(resolved.file);
        return { url: node?.url ?? "", kind: "asset", id: resolved.file };
      }
      const dependencyOutput = serverOutputPath(root, resolved.file, config.serverEntry);
      return {
        url: relativeOutputSpecifier(importerOutput, dependencyOutput),
        kind: resolved.kind,
        id: resolved.file
      };
    };
    for (const id of serverGraph.postOrder(config.serverEntry)) {
      const node = serverGraph.get(id);
      if (node === void 0) continue;
      if (node.kind !== "ts" && node.kind !== "js") continue;
      if (node.file.includes(`${sep4}node_modules${sep4}`)) continue;
      const output = serverOutputPath(root, node.file, config.serverEntry);
      const transform = transformModule(node.source, {
        fileName: node.file,
        moduleId: node.id,
        mode,
        env,
        resolve: (specifier) => serverResolve(specifier, node.file, output),
        resolveId: (specifier) => resolver.resolveNode(specifier, node.file)?.file
      });
      problems.push(...transform.diagnostics);
      if (transform.diagnostics.length > 0) continue;
      const target = join6(serverDir, output);
      await mkdir(dirname4(target), { recursive: true });
      const mapComment = transform.sourceMap !== void 0 ? externalSourceMap(basename2(target)) : "";
      await writeFile3(target, `${transform.code}${mapComment}`, "utf8");
      if (transform.sourceMap !== void 0) {
        await writeFile3(`${target}.map`, transform.sourceMap, "utf8");
      }
    }
    serverEntry = join6(serverDir, "server.js");
  }
  const blocking = problems.filter((problem) => problem.message.length > 0);
  if (blocking.length > 0) {
    throw new CliError(formatBuildFailure(blocking), {
      suggestion: 'Fix the reported errors and run "streetui build" again.'
    });
  }
  const durationMs = Date.now() - started;
  const fileCount = jsModules.length + assetFiles.length + cssNodes.length + (existsSync4(config.serverEntry) ? 1 : 0);
  logger?.success(`Built ${fileCount} client modules \u2192 ${clientDir}`);
  events?.emit({
    event: "build_completed",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    outDir: clientDir,
    files: fileCount,
    durationMs
  });
  return {
    clientDir,
    serverDir,
    manifest,
    entryJs: join6(clientDir, entryOut),
    ...serverEntry !== void 0 ? { serverEntry } : {},
    fileCount,
    durationMs
  };
}
async function copyDir(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const source = join6(from, entry.name);
    const target = join6(to, entry.name);
    if (entry.isDirectory()) await copyDir(source, target);
    else if (entry.isFile()) await copyFile(source, target);
  }
}

// src/build.ts
async function buildProject2(project, mode = "production", options = {}) {
  return buildProject({
    project,
    mode,
    ...options.logger !== void 0 ? { logger: options.logger } : {},
    ...options.events !== void 0 ? { events: options.events } : {},
    ...options.sessionId !== void 0 ? { sessionId: options.sessionId } : {}
  });
}

// src/toolchain/server/dev-server.ts
import { createServer } from "node:http";
import { readFileSync as readFileSync4, statSync as statSync4, existsSync as existsSync5 } from "node:fs";
import { extname as extname5, join as join10, relative as relative5, sep as sep5 } from "node:path";

// src/toolchain/cache/transform-cache.ts
var TransformCache = class {
  entries = /* @__PURE__ */ new Map();
  get(file, hash) {
    const entry = this.entries.get(file);
    if (entry === void 0 || entry.hash !== hash) return void 0;
    return entry.result;
  }
  set(file, hash, result) {
    this.entries.set(file, { hash, result });
  }
  invalidate(file) {
    this.entries.delete(file);
  }
  clear() {
    this.entries.clear();
  }
  get size() {
    return this.entries.size;
  }
};

// src/toolchain/transform/css.ts
import { createHash as createHash2 } from "node:crypto";
function keyFor(id) {
  return createHash2("sha256").update(id).digest("hex").slice(0, 12);
}
function cssToDevModule(css, id) {
  const key = keyFor(id);
  return [
    `const __streetuiCss = ${JSON.stringify(css)};`,
    `const __streetuiKey = ${JSON.stringify(key)};`,
    `let __streetuiStyle = document.querySelector('style[data-streetui-css="' + __streetuiKey + '"]');`,
    `if (!__streetuiStyle) {`,
    `  __streetuiStyle = document.createElement('style');`,
    `  __streetuiStyle.setAttribute('data-streetui-css', __streetuiKey);`,
    `  document.head.appendChild(__streetuiStyle);`,
    `}`,
    `__streetuiStyle.textContent = __streetuiCss;`,
    `export {};`
  ].join("\n");
}
function assetToDevModule(url) {
  return `export default ${JSON.stringify(url)};
`;
}
function cssUrl(url, version) {
  return `${url}?streetui=js&t=${version}`;
}
function assetUrl(url) {
  return `${url}?streetui=url`;
}

// src/toolchain/server/ssr-runner.ts
import { mkdir as mkdir2, rm as rm3, writeFile as writeFile4 } from "node:fs/promises";
import { dirname as dirname5, join as join7, relative as relative3 } from "node:path";
import { pathToFileURL as pathToFileURL2 } from "node:url";
function createSsrRunner(options) {
  const resolver = createResolver({ root: options.root, ...options.resolver ?? {} });
  let built;
  let diagnostics = [];
  let files = /* @__PURE__ */ new Set();
  let buildCounter = 0;
  let inflight = Promise.resolve();
  const resolveSpecifier = (specifier, importerFile, importerOutput) => {
    if (specifier.startsWith("node:")) return void 0;
    const resolved = resolver.resolveNode(specifier, importerFile);
    if (resolved === void 0) return void 0;
    const dependencyOutput = serverOutputPath(options.root, resolved.file, options.serverEntry);
    return {
      url: relativeOutputSpecifier(importerOutput, dependencyOutput),
      kind: resolved.kind,
      id: resolved.file
    };
  };
  const build = async () => {
    const { graph, diagnostics: crawlDiagnostics } = crawl({
      entry: options.serverEntry,
      root: options.root,
      mode: "production",
      ...options.resolver !== void 0 ? { resolver: options.resolver } : {},
      resolveSpecifier: (specifier, importerFile) => {
        const resolved = resolver.resolveNode(specifier, importerFile);
        if (resolved === void 0 || resolved.kind === "builtin") return void 0;
        return { file: resolved.file, kind: resolved.kind };
      }
    });
    diagnostics = [...crawlDiagnostics];
    files = new Set(graph.nodes.keys());
    const buildId = `${Date.now().toString(36)}-${(buildCounter++).toString(36)}`;
    const outDir = join7(options.cacheDir, "ssr", buildId);
    await mkdir2(outDir, { recursive: true });
    await writeFile4(join7(outDir, "package.json"), JSON.stringify({ type: "module" }), "utf8");
    for (const id of graph.postOrder(options.serverEntry)) {
      const node = graph.get(id);
      if (node === void 0) continue;
      if (node.kind !== "ts" && node.kind !== "js") continue;
      const outputPath = serverOutputPath(options.root, node.file, options.serverEntry);
      const importerOutput = join7(outDir, outputPath);
      const transform = transformModule(node.source, {
        fileName: node.file,
        moduleId: node.id,
        // The server graph is emitted for Node; it must never contain CSS/asset
        // imports (browser-only). Production-mode transform strips them.
        mode: "production",
        env: options.env ?? {},
        resolve: (specifier) => resolveSpecifier(specifier, node.file, outputPath),
        resolveId: (specifier) => {
          const resolved = resolver.resolveNode(specifier, node.file);
          return resolved?.file;
        }
      });
      if (transform.diagnostics.length > 0) {
        diagnostics = [...diagnostics, ...transform.diagnostics];
        continue;
      }
      const target = join7(outDir, outputPath);
      await mkdir2(dirname5(target), { recursive: true });
      await writeFile4(target, transform.code, "utf8");
    }
    const entryOutput = join7(outDir, serverOutputPath(options.root, options.serverEntry, options.serverEntry));
    const mod = await import(pathToFileURL2(entryOutput).href);
    const render = mod.render ?? (typeof mod.default === "function" ? mod.default : mod.default?.render);
    if (typeof render !== "function") {
      throw new Error(`Server entry ${options.serverEntry} must export a "render(request)" function.`);
    }
    return { dir: outDir, render };
  };
  const enqueue = (fn) => {
    const run = inflight.then(fn, fn);
    inflight = run.then(
      () => void 0,
      () => void 0
    );
    return run;
  };
  const ensureBuilt = async () => {
    if (built === void 0) built = await enqueue(build);
    return built;
  };
  return {
    get diagnostics() {
      return diagnostics;
    },
    async render(request) {
      const current = await ensureBuilt();
      return current.render(request);
    },
    async reload() {
      await enqueue(async () => {
        const next = await build();
        const previous = built;
        built = next;
        if (previous !== void 0 && previous.dir !== next.dir) {
          await rm3(previous.dir, { recursive: true, force: true }).catch(() => void 0);
        }
      });
    },
    async close() {
      if (built === void 0) return;
      await rm3(built.dir, { recursive: true, force: true }).catch(() => void 0);
      built = void 0;
    },
    getFiles() {
      return files;
    }
  };
}

// src/toolchain/server/ws.ts
import { createHash as createHash3 } from "node:crypto";
var GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
var MAX_PAYLOAD = 1024 * 1024;
var OP_CONTINUATION = 0;
var OP_TEXT = 1;
var OP_BINARY = 2;
var OP_CLOSE = 8;
var OP_PING = 9;
var OP_PONG = 10;
function encodeFrame(payload, opcode) {
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.alloc(2);
    header[1] = length;
  } else if (length < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  header[0] = 128 | opcode;
  return Buffer.concat([header, payload]);
}
function parseFrames(buffer) {
  const frames = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const fin = (first & 128) !== 0;
    const opcode = first & 15;
    const masked = (second & 128) !== 0;
    let length = second & 127;
    let cursor = offset + 2;
    if (length === 126) {
      if (cursor + 2 > buffer.length) break;
      length = buffer.readUInt16BE(cursor);
      cursor += 2;
    } else if (length === 127) {
      if (cursor + 8 > buffer.length) break;
      const big = buffer.readBigUInt64BE(cursor);
      if (big > BigInt(MAX_PAYLOAD)) throw new Error("WebSocket frame exceeds the payload limit");
      length = Number(big);
      cursor += 8;
    }
    if (length > MAX_PAYLOAD) throw new Error("WebSocket frame exceeds the payload limit");
    let maskKey;
    if (masked) {
      if (cursor + 4 > buffer.length) break;
      maskKey = buffer.subarray(cursor, cursor + 4);
      cursor += 4;
    }
    if (cursor + length > buffer.length) break;
    let payload = buffer.subarray(cursor, cursor + length);
    if (maskKey !== void 0) {
      const unmasked = Buffer.allocUnsafe(payload.length);
      for (let i = 0; i < payload.length; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
      payload = unmasked;
    }
    frames.push({ fin, opcode, payload });
    offset = cursor + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}
var WebSocketHub = class {
  constructor(options) {
    this.options = options;
    options.server.on("upgrade", (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    });
    const heartbeatMs = options.heartbeatMs ?? 3e4;
    if (heartbeatMs > 0) {
      this.heartbeat = setInterval(() => this.pingAll(), heartbeatMs);
      this.heartbeat.unref?.();
    }
  }
  clients = /* @__PURE__ */ new Map();
  heartbeat;
  nextId = 1;
  pendingRequests = /* @__PURE__ */ new Map();
  static REQUEST_TIMEOUT_MS = 3e4;
  get size() {
    return this.clients.size;
  }
  get clientIds() {
    return [...this.clients.keys()];
  }
  sendToClient(clientId, data) {
    const record = this.clients.get(clientId);
    if (!record) return false;
    this.sendText(record, JSON.stringify(data));
    return true;
  }
  /** Politely close one client (used to expire stale preview clients). */
  disconnect(clientId) {
    const record = this.clients.get(clientId);
    if (!record) return false;
    this.sendRaw(record, Buffer.alloc(0), OP_CLOSE);
    record.socket.end();
    this.remove(record);
    return true;
  }
  sendRequest(clientId, data, timeoutMs = 3e4) {
    return new Promise((resolve8, reject) => {
      const record = this.clients.get(clientId);
      if (!record) {
        reject(new Error(`Client ${clientId} not found`));
        return;
      }
      const requestId = `r${Date.now()}${Math.random().toString(36).slice(2)}`;
      const payload = { ...data, requestId };
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out`));
      }, timeoutMs);
      this.pendingRequests.set(requestId, { resolve: resolve8, reject, timeout });
      this.sendText(record, JSON.stringify(payload));
    });
  }
  broadcast(message) {
    const text = JSON.stringify(message);
    for (const client of this.clients.values()) this.sendText(client, text);
  }
  closeAll() {
    if (this.heartbeat !== void 0) clearInterval(this.heartbeat);
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("WebSocket hub closed"));
    }
    this.pendingRequests.clear();
    for (const client of [...this.clients.values()]) {
      try {
        if (!client.socket.destroyed) client.socket.write(encodeFrame(Buffer.alloc(0), OP_CLOSE));
      } catch {
      }
      client.socket.end();
      this.clients.delete(client.id);
    }
  }
  handleUpgrade(request, socket, head) {
    const url = request.url ?? "/";
    const path = url.split("?")[0] ?? url;
    if (path !== this.options.path) {
      socket.destroy();
      return;
    }
    if (!this.options.isOriginAllowed(request.headers.origin)) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string" || key.length === 0) {
      socket.destroy();
      return;
    }
    const accept = createHash3("sha1").update(key + GUID).digest("base64");
    socket.write(
      [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Accept: ${accept}`,
        "\r\n"
      ].join("\r\n")
    );
    const record = {
      id: `c${this.nextId++}`,
      socket,
      alive: true,
      buffer: Buffer.alloc(0),
      fragments: [],
      fragmentOpcode: void 0
    };
    this.clients.set(record.id, record);
    this.options.onConnect?.(this.publicClient(record));
    socket.on("data", (chunk) => this.handleData(record, chunk));
    socket.on("close", () => this.remove(record));
    socket.on("error", () => this.remove(record));
    if (head.length > 0) this.handleData(record, head);
  }
  handleData(record, chunk) {
    record.buffer = Buffer.concat([record.buffer, chunk]);
    try {
      const { frames, rest } = parseFrames(record.buffer);
      record.buffer = rest;
      for (const frame of frames) this.handleFrame(record, frame);
    } catch (error) {
      this.sendText(record, JSON.stringify({ type: "error", message: error.message }));
      record.socket.destroy();
    }
  }
  handleFrame(record, frame) {
    const { fin, opcode, payload } = frame;
    if (opcode === OP_CLOSE) {
      try {
        if (!record.socket.destroyed) record.socket.write(encodeFrame(Buffer.alloc(0), OP_CLOSE));
      } catch {
      }
      this.remove(record);
      return;
    }
    if (opcode === OP_PING) {
      this.sendRaw(record, payload, OP_PONG);
      return;
    }
    if (opcode === OP_PONG) {
      record.alive = true;
      return;
    }
    if (opcode === OP_CONTINUATION) {
      if (record.fragmentOpcode === void 0) return;
      record.fragments.push(payload);
      if (!fin) return;
      const complete = Buffer.concat(record.fragments);
      const messageOpcode = record.fragmentOpcode;
      record.fragments = [];
      record.fragmentOpcode = void 0;
      if (messageOpcode === OP_TEXT) this.dispatch(record, complete);
      return;
    }
    if (opcode === OP_TEXT || opcode === OP_BINARY) {
      if (!fin) {
        record.fragmentOpcode = opcode;
        record.fragments = [payload];
        return;
      }
      if (opcode === OP_TEXT) this.dispatch(record, payload);
    }
  }
  dispatch(record, payload) {
    const text = payload.toString("utf8");
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.requestId === "string") {
        const pending = this.pendingRequests.get(parsed.requestId);
        if (pending !== void 0) {
          this.pendingRequests.delete(parsed.requestId);
          clearTimeout(pending.timeout);
          if (parsed.ok === false) {
            pending.reject(new Error(String(parsed.error ?? "request failed")));
          } else {
            pending.resolve(parsed.payload);
          }
        }
      }
    } catch {
    }
    try {
      this.options.onMessage(text, this.publicClient(record));
    } catch {
    }
  }
  pingAll() {
    for (const client of this.clients.values()) {
      if (!client.alive) {
        client.socket.destroy();
        this.remove(client);
        continue;
      }
      client.alive = false;
      this.sendRaw(client, Buffer.alloc(0), OP_PING);
    }
  }
  sendText(record, text) {
    this.sendRaw(record, Buffer.from(text, "utf8"), OP_TEXT);
  }
  sendRaw(record, payload, opcode) {
    if (record.socket.destroyed) return;
    try {
      record.socket.write(encodeFrame(payload, opcode));
    } catch {
    }
  }
  remove(record) {
    if (!this.clients.delete(record.id)) return;
    try {
      this.options.onDisconnect?.(this.publicClient(record));
    } catch {
    }
  }
  publicClient(record) {
    return {
      id: record.id,
      send: (data) => this.sendText(record, data),
      close: () => {
        this.sendRaw(record, Buffer.alloc(0), OP_CLOSE);
        record.socket.end();
        this.remove(record);
      }
    };
  }
};

// src/toolchain/server/static.ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname as extname4, isAbsolute as isAbsolute4, join as join8, normalize, relative as relative4 } from "node:path";
var MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8"
};
function resolveStatic(clientDir, urlPath) {
  const decoded = safeDecode(urlPath.split("?")[0] ?? "");
  if (decoded === void 0) return void 0;
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = join8(clientDir, clean);
  const rel = relative4(clientDir, full);
  if (rel === "" || !rel.startsWith("..") && !isAbsolute4(rel)) return full;
  return void 0;
}
async function serveStaticFile(rootDir, urlPath, res, options = {}) {
  const full = resolveStatic(rootDir, urlPath);
  if (full === void 0) return false;
  try {
    const info = await stat(full);
    if (!info.isFile()) return false;
    res.writeHead(200, {
      "Content-Type": MIME[extname4(full).toLowerCase()] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": options.immutable === true ? "public, max-age=31536000, immutable" : options.devMode === true ? "no-cache" : `public, max-age=${options.maxAge ?? 3600}`
    });
    await new Promise((resolve8, reject) => {
      const stream = createReadStream(full);
      stream.on("error", reject);
      stream.on("end", resolve8);
      stream.pipe(res);
    });
    return true;
  } catch {
    return false;
  }
}

// src/toolchain/hmr/client.ts
var HMR_CLIENT_CODE = String.raw`(function () {
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

// src/toolchain/hmr/runtime.ts
var HMR_RUNTIME_CODE = String.raw`const __registry = (globalThis.__STREETUI_HMR_RUNTIME__ ||= {
  accept: new Map(),
  dispose: new Map(),
});

function disposeModule(id) {
  const cb = __registry.dispose.get(id);
  if (typeof cb === 'function') {
    try { cb(); } catch (error) { console.error('[streetui hmr] dispose failed', id, error); }
    __registry.dispose.delete(id);
  }
}

export function createHotContext(id) {
  return {
    accept(arg, maybeCb) {
      if (typeof arg === 'function') {
        __registry.accept.set(id, arg);
        return;
      }
      if (typeof arg === 'string') {
        const depId = arg;
        const cb = typeof maybeCb === 'function' ? maybeCb : () => {};
        __registry.accept.set(depId, cb);
        return;
      }
      // accept() with no callback: accept self and do nothing.
      if (arg === undefined) __registry.accept.set(id, () => {});
    },
    dispose(cb) {
      if (typeof cb === 'function') __registry.dispose.set(id, cb);
    },
    data: {},
  };
}

export function __streetuiAccept(id) {
  return __registry.accept.get(id);
}

export function __streetuiDispose(id) {
  disposeModule(id);
}

export function __streetuiDecline(id) {
  __registry.accept.delete(id);
}
`;

// src/toolchain/hmr/protocol.ts
var HMR_PROTOCOL_VERSION = 1;
var HMR_PATH = "/__streetui_hmr";
var HMR_CLIENT_PATH = "/@streetui/client/hmr.js";
var HMR_RUNTIME_PATH = "/@streetui/client/hmr-runtime.js";

// src/toolchain/watch/watcher.ts
import { watch } from "node:fs";
import { readdirSync, statSync as statSync3 } from "node:fs";
import { join as join9 } from "node:path";
var DEFAULT_IGNORED = [
  /(^|[/\\])node_modules([/\\]|$)/,
  /(^|[/\\])\.git([/\\]|$)/,
  /(^|[/\\])dist([/\\]|$)/,
  /(^|[/\\])\.turbo([/\\]|$)/,
  /(^|[/\\])\.cache([/\\]|$)/,
  /\.log$/
];
function watchRecursive(options) {
  const watchers = /* @__PURE__ */ new Map();
  const timers = /* @__PURE__ */ new Map();
  const debounceMs = options.debounceMs ?? 60;
  const ignored = options.ignored ?? ((file) => DEFAULT_IGNORED.some((re) => re.test(file)));
  let closed = false;
  const emit = (file) => {
    if (closed) return;
    const existing = timers.get(file);
    if (existing !== void 0) clearTimeout(existing);
    timers.set(
      file,
      setTimeout(() => {
        timers.delete(file);
        if (closed) return;
        try {
          if (statSync3(file).isFile()) options.onChange(file);
        } catch {
        }
      }, debounceMs)
    );
  };
  const addDirectory = (dir) => {
    if (closed || watchers.has(dir) || ignored(dir)) return;
    let watcher;
    try {
      watcher = watch(dir, { persistent: true }, (_event, filename) => {
        const target = filename == null ? dir : join9(dir, filename.toString());
        if (ignored(target)) return;
        try {
          if (statSync3(target).isDirectory()) {
            addDirectory(target);
          } else {
            emit(target);
          }
        } catch {
          emit(target);
        }
      });
    } catch {
      return;
    }
    watcher.on("error", () => {
      watchers.delete(dir);
    });
    watchers.set(dir, watcher);
    let entries;
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join9(dir, entry);
      if (ignored(full)) continue;
      try {
        if (statSync3(full).isDirectory()) addDirectory(full);
      } catch {
      }
    }
  };
  addDirectory(options.root);
  return {
    close() {
      closed = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const watcher of watchers.values()) watcher.close();
      watchers.clear();
    }
  };
}

// src/toolchain/server/dev-server.ts
var PUBLIC_PREFIX = "STREETUI_PUBLIC_";
function publicEnv2() {
  const env = { NODE_ENV: "development" };
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(PUBLIC_PREFIX) && value !== void 0) env[key] = value;
  }
  return env;
}
function send(res, status, contentType, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}
var sendJs = (res, code) => send(res, 200, "text/javascript; charset=utf-8", code);
function injectHtml(html, entryUrl) {
  const tags = `<script type="module" src="${entryUrl}"></script><script type="module" src="${HMR_CLIENT_PATH}"></script>`;
  if (html.includes("</body>")) return html.replace("</body>", `${tags}</body>`);
  return `${html}${tags}`;
}
function hasQuery(url, key, value) {
  const query = url.split("?")[1] ?? "";
  return new URLSearchParams(query).get(key) === value;
}
function packageNameForFile(file) {
  const marker = `${sep5}node_modules${sep5}`;
  const index = file.indexOf(marker);
  if (index < 0) return void 0;
  const after = file.slice(index + marker.length).split(sep5);
  if ((after[0] ?? "").startsWith("@")) return `${after[0]}/${after[1] ?? ""}`;
  return after[0];
}
async function createDevServer(options) {
  const { project, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const config = project.config;
  const root = config.root;
  const env = publicEnv2();
  const frameworkVersion = project.packageJson.devDependencies?.["@streetui/cli"] ?? project.packageJson.devDependencies?.["streetui"] ?? project.packageJson.dependencies?.["streetui"] ?? project.packageJson.version;
  if (!existsSync5(config.clientEntry)) {
    throw new CliError(`Client entry not found: ${config.clientEntry}`, {
      suggestion: 'Create the entry file or set "clientEntry" in streetui.config.ts.'
    });
  }
  const resolver = createResolver({
    root,
    ...config.extensions !== void 0 ? { extensions: config.extensions } : {},
    ...config.aliases !== void 0 ? { aliases: config.aliases } : {}
  });
  const cacheDir = join10(root, ".streetui-cache");
  const ssr = existsSync5(config.serverEntry) ? createSsrRunner({ root, serverEntry: config.serverEntry, cacheDir, env }) : void 0;
  const clientEntryUrl = fileToUrl(config.clientEntry, root);
  if (clientEntryUrl === void 0) {
    throw new CliError(`Client entry is outside the project root: ${config.clientEntry}`);
  }
  let graph;
  try {
    const crawled = crawl({ entry: config.clientEntry, root, mode: "development" });
    graph = crawled.graph;
    for (const diagnostic of crawled.diagnostics) logger.warn(diagnostic.message);
  } catch (error) {
    throw new CliError(`Failed to build the module graph: ${error.message}`);
  }
  const cache = new TransformCache();
  const version = Date.now();
  let versionCounter = 0;
  const server = createServer((req, res) => {
    void handleRequest2(req, res);
  });
  const sockets = /* @__PURE__ */ new Set();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  const isOriginAllowed = (origin) => {
    if (origin === void 0) return true;
    try {
      const parsed = new URL(origin);
      return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
    } catch {
      return false;
    }
  };
  const RING_BUFFER_MAX = 1e3;
  const browserLog = [];
  const browserErrors = [];
  function addToRingBuffer(entry) {
    if (entry.level === "error") {
      browserErrors.push(entry);
      if (browserErrors.length > RING_BUFFER_MAX) browserErrors.shift();
    }
    browserLog.push(entry);
    if (browserLog.length > RING_BUFFER_MAX) browserLog.shift();
  }
  let serverUrl = "";
  const hub = new WebSocketHub({
    server,
    path: HMR_PATH,
    isOriginAllowed,
    onConnect(client) {
      client.send(JSON.stringify({ type: "connected", protocol: HMR_PROTOCOL_VERSION }));
      events?.emit({
        event: "browser_connected",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        url: serverUrl,
        clientId: client.id
      });
    },
    onDisconnect(client) {
      events?.emit({
        event: "browser_disconnected",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        url: serverUrl,
        clientId: client.id
      });
    },
    onMessage(message, client) {
      let parsed;
      try {
        parsed = JSON.parse(message);
      } catch {
        return;
      }
      if (parsed.type === "runtime-error") {
        const runtimeMessage = parsed.message;
        const stack = parsed.stack;
        logger.error(`Runtime error in browser: ${String(runtimeMessage)}`);
        events?.emit({
          event: "runtime_error",
          eventId: makeEventId(),
          sessionId,
          schemaVersion: 1,
          framework: "streetui",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          message: String(runtimeMessage),
          ...typeof stack === "string" ? { stack } : {}
        });
        const ts3 = (/* @__PURE__ */ new Date()).toISOString();
        events?.emit({
          event: "browser_error",
          eventId: makeEventId(),
          sessionId,
          schemaVersion: 1,
          framework: "streetui",
          timestamp: ts3,
          message: String(runtimeMessage),
          clientId: client.id,
          ...typeof stack === "string" ? { stack } : {}
        });
        addToRingBuffer({ timestamp: ts3, level: "error", message: String(runtimeMessage), ...typeof stack === "string" ? { stack } : {} });
      }
      if (parsed.type === "log") {
        const level = parsed.level;
        const logMessage = parsed.message;
        const ts3 = (/* @__PURE__ */ new Date()).toISOString();
        events?.emit({
          event: "browser_console",
          eventId: makeEventId(),
          sessionId,
          schemaVersion: 1,
          framework: "streetui",
          timestamp: ts3,
          level: level ?? "info",
          message: String(logMessage),
          clientId: client.id
        });
        addToRingBuffer({ timestamp: ts3, level: level ?? "info", message: String(logMessage) });
      }
      if (parsed.type === "hmr_applied") {
        const updateId = parsed.updateId;
        events?.emit({
          event: "hmr_applied",
          eventId: makeEventId(),
          sessionId,
          schemaVersion: 1,
          framework: "streetui",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          file: String(updateId),
          accepted: true
        });
      }
      if (parsed.type === "hmr_failed") {
        const updateId = parsed.updateId;
        const error = parsed.error;
        events?.emit({
          event: "hmr_failed",
          eventId: makeEventId(),
          sessionId,
          schemaVersion: 1,
          framework: "streetui",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          file: String(updateId),
          error: String(error)
        });
      }
    }
  });
  const broadcast = (message) => hub.broadcast(message);
  const transformError = (file, problems) => {
    const detail = formatBuildFailure(problems.map((p) => ({ message: p.message })));
    return [
      `throw new Error(${JSON.stringify(`StreetUI transform error in ${file}:
${detail}`)});`,
      `export {};`
    ].join("\n");
  };
  const serveModule = async (file, url2, res) => {
    const kind = kindForFile(file);
    if (kind === "css") {
      const css = readFileSync4(file, "utf8");
      if (hasQuery(url2, "streetui", "js")) {
        sendJs(res, cssToDevModule(css, file));
      } else {
        send(res, 200, "text/css; charset=utf-8", css);
      }
      return;
    }
    if (kind === "asset") {
      if (hasQuery(url2, "streetui", "url")) {
        sendJs(res, assetToDevModule(pathnameOf(url2)));
        return;
      }
      const body = readFileSync4(file);
      send(res, 200, MIME[extname5(file).toLowerCase()] ?? "application/octet-stream", body);
      return;
    }
    if (kind === "json") {
      const json = readFileSync4(file, "utf8");
      sendJs(res, `export default ${json};
`);
      return;
    }
    if (kind !== "ts" && kind !== "js") {
      send(res, 500, "text/plain; charset=utf-8", `Unsupported module type: ${file}`);
      return;
    }
    if (kind === "js" && formatForFile(file) === "cjs") {
      const pkg = packageNameForFile(file);
      const importer = [...graph.get(file)?.importers ?? []][0];
      const message = `The module ${file} is CommonJS and cannot be executed in the browser.
` + (pkg !== void 0 ? `Package: ${pkg}
` : "") + (importer !== void 0 ? `Importing module: ${importer}
` : "") + `Module format: CommonJS
Reason: StreetUI serves browser-native ESM; CommonJS package entry points are not converted.
What to do: pick an ESM entry of the package (e.g. an "import"/"module" condition or a .mjs build), or wrap the dependency behind a tiny ESM adapter that re-exports the parts you need.`;
      broadcast({ type: "error", diagnostics: [{ message, file, importer }], fatal: false });
      logger.error(message);
      send(res, 500, "text/plain; charset=utf-8", message);
      return;
    }
    let source;
    try {
      source = readFileSync4(file, "utf8");
    } catch (error) {
      send(res, 500, "text/plain; charset=utf-8", `Could not read ${file}: ${error.message}`);
      return;
    }
    const hash = hashContent(source);
    let result = cache.get(file, hash);
    if (result === void 0) {
      result = transformModule(source, {
        fileName: file,
        moduleId: file,
        mode: "development",
        env,
        resolve(specifier) {
          const resolved = resolver.resolveBrowser(specifier, file);
          if (resolved === void 0 || resolved.kind === "builtin") return void 0;
          const depUrl = fileToUrl(resolved.file, root);
          if (depUrl === void 0) return void 0;
          if (resolved.kind === "css") return { url: cssUrl(depUrl, version), kind: resolved.kind, id: resolved.file };
          if (resolved.kind === "asset") return { url: assetUrl(depUrl), kind: resolved.kind, id: resolved.file };
          if (resolved.kind === "json") return { url: `${depUrl}?streetui=js`, kind: resolved.kind, id: resolved.file };
          return { url: `${depUrl}?t=${version}`, kind: resolved.kind, id: resolved.file };
        },
        resolveId(specifier) {
          return resolver.resolveBrowser(specifier, file)?.file;
        }
      });
      if (result.diagnostics.length > 0) {
        const body = transformError(file, result.diagnostics.map((d) => ({ message: d.message })));
        broadcast({ type: "error", diagnostics: result.diagnostics, fatal: false });
        send(res, 500, "text/javascript; charset=utf-8", body);
        return;
      }
      cache.set(file, hash, result);
    }
    const map = result.sourceMap !== void 0 ? inlineSourceMap(result.sourceMap) : "";
    sendJs(res, `${result.code}${map}`);
  };
  const renderSsr = async (url2, req, res) => {
    let html;
    let status = 200;
    const headers = {};
    if (ssr !== void 0) {
      try {
        const result = await ssr.render({ url: url2, method: req.method ?? "GET", headers: req.headers });
        html = result.html;
        status = result.status ?? 200;
        Object.assign(headers, result.headers ?? {});
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        logger.error(`SSR render failed for ${url2}: ${message}`);
        send(res, 500, "text/plain; charset=utf-8", `StreetUI server error while rendering ${url2}:

${message}`);
        return;
      }
    } else {
      const indexPath = join10(root, "index.html");
      if (existsSync5(indexPath)) {
        html = readFileSync4(indexPath, "utf8");
      } else {
        html = [
          "<!doctype html>",
          '<html lang="en">',
          '<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>',
          '<body><div id="app"></div></body>',
          "</html>"
        ].join("\n");
      }
    }
    res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
    res.end(injectHtml(html, clientEntryUrl));
  };
  const handleRequest2 = async (req, res) => {
    const url2 = req.url ?? "/";
    const path = pathnameOf(url2);
    try {
      if (path === HMR_PATH) {
        send(res, 426, "text/plain; charset=utf-8", "Upgrade Required");
        return;
      }
      if (path === HMR_CLIENT_PATH) {
        sendJs(res, HMR_CLIENT_CODE);
        return;
      }
      if (path === HMR_RUNTIME_PATH) {
        sendJs(res, HMR_RUNTIME_CODE);
        return;
      }
      if (options.beforeRequest !== void 0) {
        const handled = await options.beforeRequest(req, res, { url: url2, path });
        if (handled) return;
      }
      const file = urlToFile(url2, root);
      if (file !== void 0 && isInside(root, file) && existsSync5(file)) {
        try {
          if (statSync4(file).isFile()) {
            await serveModule(file, url2, res);
            return;
          }
        } catch {
        }
      }
      if (existsSync5(config.publicDir)) {
        const served = await serveStaticFile(config.publicDir, path, res, { devMode: true });
        if (served) return;
      }
      await renderSsr(url2, req, res);
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      logger.error(`Request failed for ${url2}: ${message}`);
      if (!res.writableEnded && !res.headersSent) send(res, 500, "text/plain; charset=utf-8", message);
    }
  };
  const handleChange = async (file) => {
    if (!isInside(root, file)) return;
    const rel = relative5(root, file);
    if (rel.startsWith("node_modules")) return;
    events?.emit({
      event: "file_changed",
      eventId: makeEventId(),
      sessionId,
      schemaVersion: 1,
      framework: "streetui",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      file
    });
    if (ssr !== void 0 && ssr.getFiles().has(file)) {
      try {
        await ssr.reload();
        broadcast({ type: "reload", reason: "server module changed" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`SSR rebuild failed: ${message}`);
        broadcast({ type: "error", diagnostics: [{ message }], fatal: false });
      }
      return;
    }
    cache.invalidate(file);
    graph.invalidate(file);
    const kind = kindForFile(file);
    const cacheVersion = ++versionCounter;
    if (kind === "css") {
      const depUrl = fileToUrl(file, root);
      if (depUrl === void 0) return;
      const update = { id: file, url: cssUrl(depUrl, cacheVersion), accepted: true, kind: "css" };
      broadcast({ type: "update", updates: [update] });
      events?.emit({
        event: "module_updated",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        id: file,
        url: update.url,
        accepted: true
      });
      return;
    }
    if (kind === "ts" || kind === "js") {
      let source;
      try {
        source = readFileSync4(file, "utf8");
      } catch (error) {
        broadcast({ type: "error", diagnostics: [{ message: error.message }], fatal: false });
        return;
      }
      const accepted = graph.get(file)?.hmrAccepted ?? /import\s*\.\s*meta\s*\.\s*hot/.test(source);
      const depUrl = fileToUrl(file, root);
      if (depUrl === void 0) {
        broadcast({ type: "reload", reason: "module outside project root" });
        return;
      }
      const update = { id: file, url: `${depUrl}?t=${cacheVersion}`, accepted, kind: "js" };
      broadcast({ type: "update", updates: [update] });
      events?.emit({
        event: "module_updated",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        id: file,
        url: update.url,
        accepted
      });
      return;
    }
    broadcast({ type: "reload", reason: `${kind} file changed` });
  };
  const watcher = watchRecursive({
    root,
    ignored: (file) => !isInside(root, file) || /[/\\]node_modules([/\\]|$)|[/\\]dist([/\\]|$)|[/\\]\.git([/\\]|$)|[/\\]\.streetui-cache([/\\]|$)/.test(file),
    onChange: (file) => {
      void handleChange(file);
    }
  });
  const host = options.host ?? config.host;
  const preferred = options.port ?? config.port;
  const strict = options.strictPort === true;
  let port = preferred;
  let listening = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await new Promise((resolve8, reject) => {
        const onError = (error) => reject(error);
        server.once("error", onError);
        server.listen(port, host, () => {
          server.off("error", onError);
          resolve8();
        });
      });
      listening = true;
      break;
    } catch (error) {
      const code = error.code;
      if (code === "EADDRINUSE" && !strict && preferred !== 0) {
        port += 1;
        continue;
      }
      watcher.close();
      hub.closeAll();
      throw new CliError(`Could not start the dev server on ${host}:${port}: ${error.message}`, {
        suggestion: strict ? "Choose a free port or omit --port to auto-select one." : "Check that the port is available."
      });
    }
  }
  if (!listening) {
    watcher.close();
    hub.closeAll();
    throw new CliError(`Could not find an available port near ${preferred}.`);
  }
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  serverUrl = url;
  logger.success(`StreetUI dev server ready at ${url}`);
  logger.info("Press Ctrl+C to stop.");
  events?.emit({
    event: "compilation_completed",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    mode: "development",
    modules: graph.nodes.size,
    durationMs: 0
  });
  events?.emit({
    event: "server_started",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url,
    port: actualPort,
    host,
    version: frameworkVersion
  });
  events?.emit({
    event: "preview_ready",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: `${url}/`,
    port: actualPort,
    status: "ready",
    version: frameworkVersion
  });
  let stopping = false;
  return {
    url,
    port: actualPort,
    host,
    hub,
    async stop() {
      if (stopping) return;
      stopping = true;
      watcher.close();
      hub.closeAll();
      await ssr?.close().catch(() => void 0);
      for (const socket of sockets) {
        try {
          socket.destroy();
        } catch {
        }
      }
      sockets.clear();
      await new Promise((resolve8) => server.close(() => resolve8()));
      events?.emit({
        event: "server_stopped",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  };
}

// src/dev.ts
async function runDev(options) {
  const running = await createDevServer({
    project: options.project,
    logger: options.logger,
    ...options.events !== void 0 ? { events: options.events } : {},
    ...options.sessionId !== void 0 ? { sessionId: options.sessionId } : {},
    ...options.host !== void 0 ? { host: options.host } : {},
    ...options.port !== void 0 ? { port: options.port } : {},
    ...options.strictPort !== void 0 ? { strictPort: options.strictPort } : {}
  });
  return { url: running.url, stop: running.stop };
}

// src/start.ts
import { existsSync as existsSync6 } from "node:fs";
import { join as join12 } from "node:path";

// src/serve.ts
import { createServer as createHttpServer } from "node:http";
import { readFile as readFile3, stat as stat2 } from "node:fs/promises";
import { join as join11, normalize as normalize2, extname as extname6, relative as relative6, isAbsolute as isAbsolute5 } from "node:path";
import { pathToFileURL as pathToFileURL3 } from "node:url";
var MIME2 = {
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
function resolveStatic2(clientDir, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0] ?? "");
  } catch {
    return void 0;
  }
  if (decoded.includes("\0")) return void 0;
  const clean = normalize2(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = join11(clientDir, clean);
  const rel = relative6(clientDir, full);
  if (rel === "" || !rel.startsWith("..") && !isAbsolute5(rel)) return full;
  return void 0;
}
async function tryServeStatic(clientDir, urlPath, res, devMode) {
  const full = resolveStatic2(clientDir, urlPath);
  if (full === void 0) return false;
  try {
    const info = await stat2(full);
    if (!info.isFile()) return false;
    const body = await readFile3(full);
    res.writeHead(200, {
      "Content-Type": MIME2[extname6(full)] ?? "application/octet-stream",
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
  const mod = await import(`${pathToFileURL3(serverBundle).href}?t=${Date.now()}`);
  const candidate = mod.render ?? (typeof mod.default === "function" ? mod.default : mod.default?.render);
  if (typeof candidate !== "function") {
    throw new Error(`Server entry ${serverBundle} must export a "render(request)" function.`);
  }
  return candidate;
}
function injectBuildTags(html, manifest, reload) {
  const tags = [];
  if (manifest?.entry.css !== void 0) {
    tags.push(`<link rel="stylesheet" href="${manifest.entry.css}" />`);
  }
  if (manifest?.entry.js !== void 0) {
    tags.push(`<script type="module" src="${manifest.entry.js}"></script>`);
  }
  if (reload !== void 0) tags.push(ReloadHub.snippet);
  const block = tags.join("");
  if (html.includes("</body>")) return html.replace("</body>", `${block}</body>`);
  return `${html}${block}`;
}
async function startServer(options) {
  let cachedRender;
  const getRender = async () => {
    if (options.devMode === true) return loadRender(options.serverBundle);
    if (cachedRender === void 0) cachedRender = await loadRender(options.serverBundle);
    return cachedRender;
  };
  await getRender();
  const server = createHttpServer((req, res) => {
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
  if (extname6(url.split("?")[0] ?? "") !== "") {
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
    const html = injectBuildTags(result.html, options.manifest, options.reload);
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

// src/start.ts
async function runStart(options) {
  const { project, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const { config } = project;
  const clientDir = join12(config.outDir, "client");
  let serverBundle = join12(config.outDir, "server", "server.js");
  if (!existsSync6(serverBundle)) {
    logger.info("No production build found \u2014 building first\u2026");
    await buildProject2(project, "production", {
      logger,
      ...sessionId !== void 0 ? { sessionId } : {},
      ...events !== void 0 ? { events } : {}
    });
  }
  if (!existsSync6(serverBundle)) {
    throw new CliError("Production build did not produce a server bundle.", {
      suggestion: "Ensure your project has a server entry (default src/server.ts) that exports render()."
    });
  }
  const manifest = await readManifest(clientDir);
  const host = options.host ?? config.host;
  const port = options.port ?? config.port;
  const running = await startServer({
    clientDir,
    serverBundle,
    host,
    port,
    ...manifest !== void 0 ? {
      manifest: {
        entry: {
          js: manifest.entry.js,
          ...manifest.entry.css !== void 0 ? { css: manifest.entry.css } : {}
        }
      }
    } : {}
  });
  logger.success(`Production server running at ${running.url}`);
  const version = project.packageJson.devDependencies?.["@streetui/cli"] ?? project.packageJson.devDependencies?.["streetui"] ?? project.packageJson.dependencies?.["streetui"] ?? project.packageJson.version;
  const actualPort = Number(new URL(running.url).port);
  events?.emit({
    event: "server_started",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: running.url,
    port: actualPort,
    host,
    version
  });
  return running;
}

// src/create.ts
import { mkdir as mkdir3, readdir as readdir2, readFile as readFile4, writeFile as writeFile5, stat as stat3 } from "node:fs/promises";
import { existsSync as existsSync8 } from "node:fs";
import { join as join14, resolve as resolve7, basename as basename3 } from "node:path";

// src/templates.ts
import { existsSync as existsSync7 } from "node:fs";
import { dirname as dirname6, join as join13, resolve as resolve6 } from "node:path";
import { fileURLToPath } from "node:url";
var TEMPLATES = [
  "basic",
  "ssr",
  "counter",
  "todo",
  "form",
  "routing",
  "signals",
  "components",
  "data-fetching",
  "interactive"
];
var DEFAULT_TEMPLATE = "ssr";
var NAME_MAP = {
  "_gitignore": ".gitignore",
  "_npmrc": ".npmrc",
  "_package.json": "package.json"
};
function templatesRoot() {
  function moduleDirectory() {
    if (typeof __dirname === "string") return __dirname;
    try {
      return dirname6(fileURLToPath(import.meta.url));
    } catch {
      return void 0;
    }
  }
  const hereCandidates = [moduleDirectory(), process.cwd()].filter(
    (value) => value !== void 0
  );
  const candidates = hereCandidates.flatMap((here) => [
    resolve6(here, "templates"),
    resolve6(here, "..", "templates"),
    resolve6(here, "..", "..", "templates")
  ]);
  for (const candidate of candidates) {
    if (existsSync7(candidate)) return candidate;
  }
  return candidates[0] ?? resolve6(process.cwd(), "templates");
}
function templateDir(name) {
  return join13(templatesRoot(), name);
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
  return contents.replaceAll("__PROJECT_NAME__", tokens.projectName).replaceAll("__FRAMEWORK_VERSION__", tokens.frameworkVersion).replaceAll("__CLI_VERSION__", tokens.cliVersion ?? tokens.frameworkVersion);
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

// src/create.ts
async function isEmptyDir(dir) {
  if (!existsSync8(dir)) return true;
  const entries = await readdir2(dir);
  return entries.filter((e) => e !== ".git").length === 0;
}
async function copyTree(srcDir, destDir, tokens, written) {
  await mkdir3(destDir, { recursive: true });
  const entries = await readdir2(srcDir);
  for (const entry of entries) {
    const srcPath = join14(srcDir, entry);
    const info = await stat3(srcPath);
    const destName = materialisedName(entry);
    const destPath = join14(destDir, destName);
    if (info.isDirectory()) {
      await copyTree(srcPath, destPath, tokens, written);
    } else if (isTextFile(entry)) {
      const raw = await readFile4(srcPath, "utf8");
      await writeFile5(destPath, applyTokens(raw, tokens), "utf8");
      written.push(destPath);
    } else {
      const raw = await readFile4(srcPath);
      await writeFile5(destPath, raw);
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
  const root = resolve7(options.targetDir);
  const projectName = basename3(root);
  if (!await isEmptyDir(root)) {
    throw new CliError(`Target directory ${root} already exists and is not empty.`, {
      suggestion: "Choose a new directory name or empty the existing one."
    });
  }
  const src = templateDir(template);
  if (!existsSync8(src)) {
    throw new CliError(`Template "${template}" is missing from the CLI installation (${src}).`, {
      suggestion: "Reinstall @streetui/cli \u2014 the shipped templates appear to be absent."
    });
  }
  const tokens = {
    projectName,
    frameworkVersion: options.frameworkVersion,
    ...options.cliVersion !== void 0 ? { cliVersion: options.cliVersion } : {}
  };
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

// src/preview.ts
import { createServer as createServer2 } from "node:http";
import { existsSync as existsSync9 } from "node:fs";
import { extname as extname7, join as join15 } from "node:path";
async function startPreview(options) {
  const { clientDir, logger, events } = options;
  const sessionId = options.sessionId ?? makeEventId();
  const host = options.host ?? "localhost";
  const manifest = await readManifest(clientDir);
  const hasIndex = existsSync9(join15(clientDir, "index.html"));
  const spaFallback = manifest === void 0 && hasIndex;
  const server = createServer2(async (req, res) => {
    const url2 = req.url ?? "/";
    const path = url2.split("?")[0] ?? url2;
    const extension = extname7(path);
    if (extension !== "") {
      const served = await serveStaticFile(clientDir, path, res, { immutable: /-[0-9a-f]{8,}\.[^/]+$/.test(path) });
      if (served) return;
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not Found");
      return;
    }
    if (spaFallback) {
      const served = await serveStaticFile(clientDir, "/index.html", res, { maxAge: 0 });
      if (served) return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  });
  let port = options.port ?? 4173;
  const strict = options.strictPort === true;
  let listening = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      await new Promise((resolve8, reject) => {
        const onError = (error) => reject(error);
        server.once("error", onError);
        server.listen(port, host, () => {
          server.off("error", onError);
          resolve8();
        });
      });
      listening = true;
      break;
    } catch (error) {
      if (error.code === "EADDRINUSE" && !strict && port !== 0) {
        port += 1;
        continue;
      }
      throw error;
    }
  }
  if (!listening) throw new Error(`Could not find an available port near ${port}`);
  const address = server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;
  const url = `http://${host}:${actualPort}`;
  logger.success(`StreetUI preview running at ${url}`);
  if (spaFallback) logger.info("Serving production build with SPA fallback.");
  events?.emit({
    event: "preview_ready",
    eventId: makeEventId(),
    sessionId,
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    url: `${url}/`,
    port: actualPort,
    status: "ready",
    ...options.version !== void 0 ? { version: options.version } : {}
  });
  return {
    url,
    port: actualPort,
    stop: () => new Promise((resolve8) => {
      server.close(() => resolve8());
    })
  };
}

// src/playground.ts
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname as dirname7, join as join16 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function resolvePlaygroundServer() {
  try {
    const require2 = createRequire(import.meta.url);
    return require2.resolve("@streetui/playground/dist/index.js");
  } catch {
    const here = dirname7(fileURLToPath2(import.meta.url));
    return join16(here, "..", "..", "playground", "dist", "index.js");
  }
}
async function runPlaygroundCommand(options) {
  const { project, logger } = options;
  const serverPath = resolvePlaygroundServer();
  const args = [project.root];
  if (options.host !== void 0) args.push("--host", options.host);
  if (options.port !== void 0) args.push("--port", String(options.port));
  if (options.sessionId !== void 0) args.push("--session-id", options.sessionId);
  const child = spawn(process.execPath, [serverPath, ...args], {
    cwd: project.root,
    env: { ...process.env, NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "inherit"]
  });
  return new Promise((resolvePromise, reject) => {
    let stdout = "";
    let settled = false;
    const fail = (message) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGTERM");
      reject(new Error(`${message}
${stdout}`));
    };
    const timer = setTimeout(() => fail("Playground did not become ready"), 6e4);
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev;
        try {
          ev = JSON.parse(line);
        } catch {
          continue;
        }
        if (ev.event === "session_attached" && !settled) {
          settled = true;
          clearTimeout(timer);
          const url = ev.url ?? "";
          const token = ev.token ?? "";
          logger.success(`Playground ready: ${url}`);
          process.stdout.write(
            JSON.stringify({
              event: "session_attached",
              eventId: makeEventId(),
              sessionId: ev.sessionId ?? "",
              schemaVersion: 1,
              framework: "streetui",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              url,
              previewUrl: ev.previewUrl ?? url,
              port: ev.port ?? 0,
              host: ev.host ?? "localhost",
              token,
              status: "attached"
            }) + "\n"
          );
          resolvePromise({
            url,
            previewUrl: ev.previewUrl ?? url,
            port: ev.port ?? 0,
            token,
            sessionId: ev.sessionId ?? "",
            stop: () => new Promise((res) => {
              child.once("exit", () => res());
              child.kill("SIGTERM");
            })
          });
          return;
        }
        if (ev.event === "session_stopped" && settled) {
          process.stdout.write(
            JSON.stringify({
              event: "session_stopped",
              eventId: makeEventId(),
              sessionId: ev.sessionId ?? "",
              schemaVersion: 1,
              framework: "streetui",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              ...ev.reason !== void 0 ? { reason: ev.reason } : {}
            }) + "\n"
          );
          child.kill("SIGTERM");
          return;
        }
      }
    });
    child.on("error", (error) => fail(`Playground failed to start: ${error.message}`));
    child.on("exit", (code) => {
      if (!settled) fail(`Playground exited early (${code})`);
    });
  });
}

// src/toolchain/doctor/doctor.ts
import { createServer as createServer3 } from "node:net";
import { existsSync as existsSync10 } from "node:fs";
import { join as join17 } from "node:path";
import { createRequire as createRequire2 } from "node:module";
async function portAvailable(host, port) {
  return new Promise((resolve8) => {
    const server = createServer3();
    const onError = () => {
      server.close(() => resolve8(false));
    };
    server.once("error", onError);
    server.listen(port, host, () => {
      server.close(() => resolve8(true));
    });
  });
}
async function browserCheck() {
  try {
    const playwright = await import("playwright");
    const chromium = playwright.chromium?.executablePath?.();
    const firefox = playwright.firefox?.executablePath?.();
    const present = [chromium, firefox].filter((path) => path !== void 0 && existsSync10(path));
    if (present.length === 0) {
      return { name: "browsers", ok: false, skipped: true, detail: 'Playwright is installed but no browser binary was found; run "npx playwright install".' };
    }
    return {
      name: "browsers",
      ok: true,
      detail: `Playwright browsers available: ${present.map((path) => path.split("/").pop()).join(", ")}`
    };
  } catch {
    return { name: "browsers", ok: false, skipped: true, detail: "Playwright is not installed; browser tests are skipped." };
  }
}
async function runDoctor(project) {
  const { root, packageJson, config } = project;
  const checks = [];
  const major = Number(process.versions.node.split(".")[0] ?? "0");
  checks.push({
    name: "node",
    ok: major >= 18,
    detail: `Node ${process.versions.node} (toolchain requires >= 18)`
  });
  checks.push({
    name: "package.json",
    ok: packageJson.name !== void 0,
    detail: packageJson.name ?? "package.json has no name"
  });
  const deps = { ...packageJson.dependencies ?? {}, ...packageJson.devDependencies ?? {} };
  const streetuiVersion = deps["streetui"] ?? Object.entries(deps).find(([name]) => name.startsWith("@streetui/"))?.[1];
  checks.push({
    name: "streetui dependency",
    ok: streetuiVersion !== void 0,
    detail: streetuiVersion ?? 'no "streetui" or "@streetui/*" dependency found'
  });
  checks.push({
    name: "config",
    ok: true,
    detail: `root=${root} port=${config.port} outDir=${config.outDir}`
  });
  checks.push({
    name: "client entry",
    ok: existsSync10(config.clientEntry),
    detail: config.clientEntry
  });
  checks.push({
    name: "server entry",
    ok: existsSync10(config.serverEntry),
    detail: existsSync10(config.serverEntry) ? config.serverEntry : `${config.serverEntry} (absent: client-only build)`,
    skipped: !existsSync10(config.serverEntry)
  });
  checks.push({
    name: "public dir",
    ok: existsSync10(config.publicDir),
    detail: config.publicDir,
    skipped: !existsSync10(config.publicDir)
  });
  try {
    const require2 = createRequire2(join17(root, "package.json"));
    const typescriptPath = require2.resolve("typescript");
    checks.push({ name: "typescript", ok: true, detail: typescriptPath });
  } catch {
    checks.push({ name: "typescript", ok: false, detail: "TypeScript is not resolvable from the project; install it as a devDependency." });
  }
  const portOk = await portAvailable(config.host, config.port);
  checks.push({
    name: "port",
    ok: portOk,
    detail: `${config.host}:${config.port} is ${portOk ? "available" : "in use"}`
  });
  checks.push(await browserCheck());
  const failed = checks.filter((check) => !check.ok && !check.skipped);
  return { ok: failed.length === 0, checks };
}
function emitDoctorReport(report, events, sessionId) {
  events?.emit({
    event: "environment_checked",
    eventId: makeEventId(),
    sessionId: sessionId ?? "",
    schemaVersion: 1,
    framework: "streetui",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    ok: report.ok,
    checks: report.checks.map((check) => ({ name: check.name, ok: check.ok, detail: check.detail }))
  });
}

// src/env.ts
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
function publicEnvNames(env = process.env) {
  return Object.keys(env).filter((k) => k.startsWith(PUBLIC_ENV_PREFIX));
}

// src/index.ts
var CLI_VERSION = "3.2.1";
var FRAMEWORK_VERSION = "3.2.1";
var HELP = `streetui \u2014 the StreetUI application CLI

Usage:
  streetui <command> [options]

Commands:
  create <dir>   Scaffold a new StreetUI project
  dev            Start StreetUI's own development server
  build          Produce a production build (dist/client, dist/server)
  start          Serve the production build (SSR)
  preview        Serve dist/client statically
  playground     Open the StreetUI Playground for the project
  doctor         Diagnose the project and toolchain environment

Options:
  -h, --help          Show this help
  -v, --version       Show the CLI version
  -p, --port <n>      Port for dev/start/preview (default 3000)
      --host <host>   Host for dev/start/preview (default localhost)
      --template <t>  Template for create (${TEMPLATES.join(" | ")})
      --dir <path>    Project directory (default current directory)
      --json          Machine-readable JSONL events (AI agents)

Examples:
  npm create streetui@latest my-app
  streetui dev --port 4000
  streetui build
  streetui preview`;
var quietLogger = {
  info() {
  },
  success() {
  },
  warn() {
  },
  error() {
  },
  plain() {
  }
};
function environmentChecks(project) {
  return [
    { name: "node", ok: Number(process.versions.node.split(".")[0] ?? "0") >= 18, detail: `Node ${process.versions.node}` },
    { name: "project", ok: project.packageJson.name !== void 0, detail: project.root },
    { name: "clientEntry", ok: true, detail: project.config.clientEntry }
  ];
}
function frameworkVersionOf(project) {
  return project.packageJson.devDependencies?.["@streetui/cli"] ?? project.packageJson.devDependencies?.["streetui"] ?? project.packageJson.dependencies?.["streetui"] ?? project.packageJson.version ?? CLI_VERSION;
}
async function runCli(argv, options = {}) {
  const human = options.logger ?? createLogger();
  const cwd = options.cwd ?? process.cwd();
  const args = parseArgs(argv);
  const logger = args.json ? quietLogger : human;
  const sessionId = makeEventId();
  const events = args.json ? createEventLogger({ sessionId }) : void 0;
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
    return await dispatch(args, cwd, logger, options.returnServer === true, events, sessionId);
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
async function dispatch(args, cwd, logger, returnServer, events, sessionId) {
  const projectCwd = args.dir ?? cwd;
  switch (args.command) {
    case "create": {
      const targetDir = args.positionals[0] ?? args.dir;
      if (targetDir === void 0) {
        throw new CliError("create requires a target directory.", {
          suggestion: `Usage: streetui create <dir> [--template ${TEMPLATES.join("|")}]`
        });
      }
      await createProject({
        targetDir,
        ...args.template !== void 0 ? { template: args.template } : {},
        frameworkVersion: FRAMEWORK_VERSION,
        cliVersion: CLI_VERSION,
        logger
      });
      return { exitCode: 0 };
    }
    case "dev": {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      events?.emit({
        event: "project_detected",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        root: project.root,
        version: frameworkVersionOf(project)
      });
      events?.emit({
        event: "environment_checked",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        ok: true,
        checks: environmentChecks(project)
      });
      events?.emit({
        event: "compilation_started",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        mode: "development"
      });
      const server = await runDev({
        project,
        logger,
        ...events !== void 0 ? { events } : {},
        ...args.host !== void 0 ? { host: args.host } : {},
        ...args.port !== void 0 ? { port: args.port } : {},
        strictPort: args.port !== void 0
      });
      if (returnServer) return { exitCode: 0, server: { url: server.url, stop: server.stop } };
      await blockForever({ stop: server.stop });
      return { exitCode: 0 };
    }
    case "build": {
      const project = await resolveProject(projectCwd, { requireEntry: true });
      events?.emit({
        event: "project_detected",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        root: project.root,
        version: frameworkVersionOf(project)
      });
      const out = await buildProject2(project, "production", {
        logger,
        sessionId,
        ...events !== void 0 ? { events } : {}
      });
      logger.success(`Build complete \u2192 ${out.clientDir}`);
      return { exitCode: 0 };
    }
    case "preview": {
      const project = await resolveProject(projectCwd);
      const running = await startPreview({
        clientDir: join18(project.config.outDir, "client"),
        logger,
        sessionId,
        ...events !== void 0 ? { events } : {},
        ...args.host !== void 0 ? { host: args.host } : {},
        ...args.port !== void 0 ? { port: args.port } : {},
        strictPort: args.port !== void 0,
        version: frameworkVersionOf(project)
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.stop } };
      await blockForever({ stop: running.stop });
      return { exitCode: 0 };
    }
    case "doctor": {
      const project = await resolveProject(projectCwd);
      const report = await runDoctor(project);
      emitDoctorReport(report, events, sessionId);
      if (args.json) return { exitCode: report.ok ? 0 : 1 };
      logger.plain(`StreetUI doctor \u2014 ${report.ok ? "OK" : "issues found"}`);
      for (const check of report.checks) {
        const mark = check.skipped ? "skip" : check.ok ? "ok" : "FAIL";
        logger.plain(`  [${mark}] ${check.name}: ${check.detail}`);
      }
      return { exitCode: report.ok ? 0 : 1 };
    }
    case "start": {
      const project = await resolveProject(projectCwd);
      const running = await runStart({
        project,
        logger,
        sessionId,
        ...events !== void 0 ? { events } : {},
        ...args.host !== void 0 ? { host: args.host } : {},
        ...args.port !== void 0 ? { port: args.port } : {}
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.close } };
      await blockForever({ stop: running.close });
      return { exitCode: 0 };
    }
    case "playground": {
      const pgDir = args.positionals[0] ?? args.dir ?? projectCwd;
      if (args.template !== void 0) {
        const missing = !existsSync11(pgDir) || readdirSync2(pgDir).length === 0;
        if (missing) {
          await createProject({
            targetDir: pgDir,
            template: args.template,
            frameworkVersion: FRAMEWORK_VERSION,
            cliVersion: CLI_VERSION,
            logger
          });
          try {
            const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], {
              cwd: pgDir,
              stdio: "ignore",
              env: { ...process.env, NO_COLOR: "1" }
            });
            if (r.status !== 0) logger.warn('npm install finished with a non-zero status; run "npm install" manually.');
          } catch (error) {
            logger.warn(`Could not install dependencies: ${error.message}`);
          }
        }
      }
      const project = await resolveProject(pgDir, { requireEntry: true });
      events?.emit({
        event: "project_detected",
        eventId: makeEventId(),
        sessionId,
        schemaVersion: 1,
        framework: "streetui",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        root: project.root,
        version: frameworkVersionOf(project)
      });
      const running = await runPlaygroundCommand({
        project,
        logger,
        sessionId,
        ...args.host !== void 0 ? { host: args.host } : {},
        ...args.port !== void 0 ? { port: args.port } : {}
      });
      if (returnServer) return { exitCode: 0, server: { url: running.url, stop: running.stop } };
      await blockForever({ stop: running.stop });
      return { exitCode: 0 };
    }
    default:
      throw new CliError(`Unknown command "${args.command}".`, {
        suggestion: 'Run "streetui --help" to see available commands.'
      });
  }
}
function blockForever(server) {
  return new Promise(() => {
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      void server.stop().finally(() => process.exit(0));
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}
export {
  CLI_VERSION,
  CliError,
  FRAMEWORK_VERSION,
  PUBLIC_ENV_PREFIX,
  ReloadHub,
  STREETUI_EVENT_SCHEMA_VERSION,
  buildProject2 as buildProject,
  clientEnvDefine,
  createDevServer,
  createEventLogger,
  createLogger,
  createProject,
  defineConfig,
  emitDoctorReport,
  findConfigFile,
  loadConfig,
  makeEventId,
  parseArgs,
  publicEnvNames,
  resolveProject,
  runCli,
  runDev,
  runDoctor,
  runPlaygroundCommand,
  runStart,
  silentEventLogger,
  startPreview,
  startServer
};
//# sourceMappingURL=index.js.map