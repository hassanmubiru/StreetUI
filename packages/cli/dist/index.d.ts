import { IncomingMessage, ServerResponse, Server } from 'node:http';

interface Logger {
    info(message: string): void;
    success(message: string): void;
    warn(message: string): void;
    error(message: string): void;
    plain(message: string): void;
}
/** The default logger writes to stdout/stderr with a `streetui` prefix. */
declare function createLogger(prefix?: string): Logger;

/**
 * A tiny, dependency-free argument parser tailored to the StreetUI CLI.
 *
 * It intentionally supports only what the CLI actually uses — a leading command
 * word, positional arguments, boolean flags, and a handful of value options
 * (`--port`, `--host`, `--template`, `--dir`). Unknown flags are collected so a
 * command can reject them with a useful message rather than silently ignoring
 * them (Phase 14: no options that are ignored).
 */
interface ParsedArgs {
    /** The command word, e.g. `create` / `dev` / `build` / `start`. */
    readonly command: string | undefined;
    /** Positional arguments after the command (e.g. the project name). */
    readonly positionals: readonly string[];
    /** `--help` / `-h` anywhere. */
    readonly help: boolean;
    /** `--version` / `-v` anywhere. */
    readonly version: boolean;
    /** `--port <n>` (validated as an integer, else `undefined`). */
    readonly port: number | undefined;
    /** `--host <h>`. */
    readonly host: string | undefined;
    /** `--template <name>` (project template for `create`). */
    readonly template: string | undefined;
    /** `--dir <path>` project directory override. */
    readonly dir: string | undefined;
    /** Any flags we do not recognise, reported verbatim (without leading `--`). */
    readonly unknown: readonly string[];
}
/** Parse `process.argv.slice(2)`-style tokens into a `ParsedArgs`. */
declare function parseArgs(argv: readonly string[]): ParsedArgs;

/**
 * StreetUI project configuration (Phase 9). The config is intentionally tiny:
 * every field has a sensible default so `streetui.config.ts` is optional. A
 * project with no config file still builds and runs.
 *
 * The file is authored as TypeScript (`streetui.config.ts`) and compiled with
 * esbuild to a temporary ESM module before import, so we never depend on the
 * host having a TS loader registered.
 */
/** User-facing configuration shape (all fields optional). */
interface StreetUIConfig {
    /** Dev server / preview port. Default 3000. */
    readonly port?: number;
    /** Host to bind. Default 'localhost'. */
    readonly host?: string;
    /** Client/browser entry, relative to project root. Default 'src/main.ts'. */
    readonly clientEntry?: string;
    /** Server entry used for SSR, relative to project root. Default 'src/server.ts'. */
    readonly serverEntry?: string;
    /** Output directory for `build`. Default 'dist'. */
    readonly outDir?: string;
    /** Static assets directory copied verbatim. Default 'public'. */
    readonly publicDir?: string;
}
/** Fully-resolved config: every field present, all paths absolute. */
interface ResolvedConfig {
    readonly root: string;
    readonly port: number;
    readonly host: string;
    readonly clientEntry: string;
    readonly serverEntry: string;
    readonly outDir: string;
    readonly publicDir: string;
}
/**
 * Identity helper that gives config authors type-checking and autocomplete.
 * It returns its argument unchanged — the value matters, not the call.
 */
declare function defineConfig(config: StreetUIConfig): StreetUIConfig;
/** Absolute path of the first config file present in `root`, or undefined. */
declare function findConfigFile(root: string): string | undefined;
/**
 * Load and fully resolve configuration for the project rooted at `root`.
 * Missing config file → all defaults. Every returned path is absolute.
 */
declare function loadConfig(root: string): Promise<ResolvedConfig>;

/**
 * Environment variables (Phase 10). The rule is simple and safe by default:
 * only variables whose names begin with `STREETUI_PUBLIC_` are exposed to the
 * browser bundle. Everything else stays on the server, so secrets in the
 * process environment cannot leak into client-side JavaScript.
 *
 * `NODE_ENV` is always defined (as the build mode) so app code can branch on
 * development vs production.
 */
/** Prefix that marks an env var as safe to ship to the browser. */
declare const PUBLIC_ENV_PREFIX = "STREETUI_PUBLIC_";
/**
 * Build the esbuild `define` map for the CLIENT bundle: `NODE_ENV` plus every
 * `STREETUI_PUBLIC_*` variable, each stringified as a compile-time constant.
 * Server-only variables are deliberately excluded.
 */
declare function clientEnvDefine(mode: 'development' | 'production', env?: NodeJS.ProcessEnv): Record<string, string>;
/** Names of the public variables currently visible (for logging/diagnostics). */
declare function publicEnvNames(env?: NodeJS.ProcessEnv): string[];

/**
 * Project resolution and validation (Phase 17). Before `dev`, `build`, or
 * `start` do any real work, we confirm the working directory actually looks
 * like a StreetUI project and fail with a clear, actionable message otherwise —
 * never a cryptic stack trace.
 */

/** A validated StreetUI project ready for a command to act on. */
interface ResolvedProject {
    /** Absolute project root. */
    readonly root: string;
    /** Parsed package.json. */
    readonly packageJson: PackageJson;
    /** Fully-resolved configuration (defaults applied). */
    readonly config: ResolvedConfig;
}
interface PackageJson {
    readonly name?: string;
    readonly version?: string;
    readonly type?: string;
    readonly dependencies?: Record<string, string>;
    readonly devDependencies?: Record<string, string>;
    readonly scripts?: Record<string, string>;
    readonly [key: string]: unknown;
}
/**
 * Resolve + validate the project rooted at `cwd` (or `--dir`). Throws a
 * `CliError` with a helpful suggestion for every failure mode Phase 17 lists:
 * missing package.json, not a StreetUI project, invalid config, missing entry.
 */
declare function resolveProject(cwd: string, options?: {
    requireEntry?: boolean;
}): Promise<ResolvedProject>;

/**
 * Production build (Phase 7). Two esbuild passes over the project's real
 * entries — a browser bundle for hydration and a Node bundle for SSR — plus a
 * copy of the public directory. No separate production rendering system: the
 * same DSL → compile → renderer pipeline the app already uses is bundled as-is.
 */

/** Where each artifact lands under the configured `outDir`. */
interface BuildOutput {
    readonly clientDir: string;
    readonly serverDir: string;
    readonly clientBundle: string;
    readonly serverBundle: string;
}
/**
 * Run the production build for `project`. Returns the output layout on success;
 * throws a `CliError` carrying formatted diagnostics on failure. When
 * `serverEntry` is absent the server pass is skipped (client-only project).
 */
declare function buildProject(project: ResolvedProject, mode?: 'development' | 'production'): Promise<BuildOutput>;

/**
 * `streetui dev` (Phase 5). Builds the project once, then watches for changes
 * with esbuild's incremental context API and rebuilds only what changed —
 * avoiding a full cold build per keystroke (Phase 27). On each successful
 * rebuild connected browsers are told to reload; build errors are printed with
 * real source positions and never crash the server.
 */

interface DevOptions {
    readonly project: ResolvedProject;
    readonly logger: Logger;
    readonly host?: string;
    readonly port?: number;
}
/** Handle returned so callers (and tests) can shut the dev server down. */
interface DevServer {
    readonly url: string;
    stop(): Promise<void>;
}
/** Start the dev server. Resolves once it is listening; keep the handle to stop. */
declare function runDev(options: DevOptions): Promise<DevServer>;

/**
 * The StreetUI HTTP server (Phases 5 & 8). Built on Node's standard `node:http`
 * — no Express, no third-party server. It serves the built client assets as
 * static files and delegates every other request to the project's server
 * bundle, which exports a `render(request)` function producing full HTML.
 *
 * The same server backs both `dev` (with live-reload injection) and `start`
 * (production). Dev-only behaviour is gated behind the `reload` option.
 */

/** The contract a project's server entry must satisfy. */
interface RenderRequest {
    readonly url: string;
    readonly method: string;
    readonly headers: Record<string, string | string[] | undefined>;
}
interface RenderResult {
    readonly html: string;
    readonly status?: number;
    readonly headers?: Record<string, string>;
}
type RenderFn = (request: RenderRequest) => RenderResult | Promise<RenderResult>;
interface ServeOptions {
    readonly clientDir: string;
    readonly serverBundle: string;
    readonly host: string;
    readonly port: number;
    /** When set, HTML responses get a live-reload snippet + an SSE endpoint. */
    readonly reload?: ReloadHub;
    /**
     * Dev mode: re-import the server bundle on every request so edits are picked
     * up without restarting. In production the bundle is loaded once.
     */
    readonly devMode?: boolean;
}
/** A running server plus the resolved address and a stop handle. */
interface RunningServer {
    readonly server: Server;
    readonly url: string;
    close(): Promise<void>;
}
/** Live-reload coordination for dev: tracks SSE clients and pushes events. */
declare class ReloadHub {
    private readonly clients;
    static readonly PATH = "/__streetui_reload";
    /** The snippet injected before `</body>` so the page listens for reloads. */
    static readonly snippet: string;
    handle(_req: IncomingMessage, res: ServerResponse): void;
    /** Tell every connected browser to reload. */
    triggerReload(): void;
    closeAll(): void;
}
/** Start the HTTP server and resolve once it is actually listening. */
declare function startServer(options: ServeOptions): Promise<RunningServer>;

/**
 * `streetui start` (Phase 8). Serves an existing production build. If the build
 * output is missing we build it first, so `start` on a fresh checkout still
 * works. Uses the standard Node HTTP server from `serve.ts`.
 */

interface StartOptions {
    readonly project: ResolvedProject;
    readonly logger: Logger;
    /** Overrides for the configured host/port (from --host/--port). */
    readonly host?: string;
    readonly port?: number;
}
/** Build (if needed) and serve the production output. Resolves once listening. */
declare function runStart(options: StartOptions): Promise<RunningServer>;

/**
 * Template registry (Phases 3, 11, 12). Templates are real files shipped inside
 * the CLI package under `templates/<name>/`. They are copied verbatim at
 * scaffold time, with two transforms: a small set of placeholder tokens are
 * substituted, and files prefixed `_` are un-prefixed (so `_gitignore` becomes
 * `.gitignore` and `_package.json` becomes `package.json` — npm would otherwise
 * mangle those names on publish).
 */
/** Available starter templates. */
type TemplateName = 'basic' | 'ssr';

/**
 * `streetui create` / `npm create streetui` (Phase 3). Scaffolds a real,
 * working StreetUI project from a shipped template. No network access, no
 * post-install magic — just a recursive copy with placeholder substitution.
 */

interface CreateOptions {
    /** Target directory (relative or absolute). */
    readonly targetDir: string;
    /** Template to use; defaults to the SSR starter. */
    readonly template?: string;
    /** StreetUI package version the generated project should depend on. */
    readonly frameworkVersion: string;
    readonly logger: Logger;
}
interface CreateResult {
    readonly root: string;
    readonly template: TemplateName;
    readonly files: readonly string[];
}
/**
 * Scaffold a new project. Validates the template and the (empty) target, copies
 * the tree, and returns the created root + file list. Throws `CliError` on any
 * user-facing problem.
 */
declare function createProject(options: CreateOptions): Promise<CreateResult>;

/**
 * Developer-facing diagnostics. Two rules govern everything here (Phase 6, 19,
 * 22): be USEFUL and be TRUTHFUL. We only print a source position when the
 * underlying tool (esbuild / Node) actually gives us one, and we never dress up
 * a failure as anything other than what it is.
 */
/**
 * A CLI-level error carrying a human-readable explanation and, optionally, a
 * concrete suggestion. Throwing this (instead of a bare `Error`) lets the top
 * level render a clean message rather than a raw stack trace for expected
 * user mistakes (Phase 17).
 */
declare class CliError extends Error {
    readonly suggestion: string | undefined;
    /** Process exit code to use when this error reaches the top level. */
    readonly exitCode: number;
    constructor(message: string, options?: {
        suggestion?: string;
        exitCode?: number;
    });
}

/**
 * `@streetui/cli` public entry. Exposes the programmatic API used by the
 * executables and the tests, and implements `runCli` — the command dispatcher
 * that turns argv into one of `create` / `dev` / `build` / `start` (plus
 * `--help` / `--version`). The CLI only orchestrates the existing StreetUI
 * pipeline; it is not a framework layer of its own.
 */

/** The CLI version, read from the compiled package. Kept in one place. */
declare const CLI_VERSION = "1.3.0";
/** Options for `runCli`, all injectable so tests can drive it in-process. */
interface RunCliOptions {
    /** Working directory the command acts on. Defaults to `process.cwd()`. */
    readonly cwd?: string;
    /** Logger sink. Defaults to the branded stdout logger. */
    readonly logger?: Logger;
    /**
     * When true, `dev` and `start` return their running handle instead of
     * blocking forever. Tests set this; the real binary leaves it false.
     */
    readonly returnServer?: boolean;
}
/** Result of a command: an exit code plus any long-lived handle for tests. */
interface RunCliResult {
    readonly exitCode: number;
    readonly server?: {
        url: string;
        stop: () => Promise<void>;
    };
}
/** Dispatch a parsed command line. Never throws for expected errors — it maps
 *  `CliError` to an exit code and a logged message instead. */
declare function runCli(argv: readonly string[], options?: RunCliOptions): Promise<RunCliResult>;

export { type BuildOutput, CLI_VERSION, CliError, type CreateResult, type DevServer, type Logger, PUBLIC_ENV_PREFIX, ReloadHub, type RenderFn, type RenderRequest, type RenderResult, type ResolvedConfig, type ResolvedProject, type RunCliOptions, type RunCliResult, type StreetUIConfig, buildProject, clientEnvDefine, createLogger, createProject, defineConfig, findConfigFile, loadConfig, parseArgs, publicEnvNames, resolveProject, runCli, runDev, runStart, startServer };
