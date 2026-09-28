# CLI

```
npm install streetui
```

The `streetui` package ships a command-line interface for scaffolding,
developing, building, and serving apps. It is dispatched by `runCli` and exposes
four commands.

```
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
```

Unknown flags are rejected before anything runs (no silently ignored options),
and expected errors map to an exit code and a logged message rather than a
thrown stack.

## Scaffold a project

```
npm create streetui@latest my-app
# or, with the CLI already installed:
streetui create my-app --template basic
```

Templates are `basic` and `ssr`. Generated projects pin their `@streetui/*`
dependencies to the exact framework version (no floating ranges) and contain no
unresolved template placeholders.

## Develop

```
streetui dev --port 4000
```

Starts the development server with live reload.

## Build & serve

```
streetui build          # → dist/client and dist/server
streetui start          # serve the production build
```

`build` produces a client bundle and a server bundle; `start` serves the built
output. See [Deployment](deployment.md) for running the server build in
production.

## Programmatic API

The same commands are exported as functions for scripting and tests:
`runCli(argv, options)`, `createProject(options)`, `buildProject(dir, mode)`,
`runDev(options)`, `runStart(options)`, and `startServer` / `ReloadHub` (the
dev server internals). These live in the CLI/tooling entry and are **not** part
of the client runtime — they are tree-shaken out of browser bundles.

See also: [Getting started](getting-started.md) and [Deployment](deployment.md).
