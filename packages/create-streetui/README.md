# create-streetui

The `npm create streetui@latest` initializer for StreetUI projects.

```bash
npm create streetui@latest my-app
cd my-app
npm install
npm run dev
```

Templates:

```bash
npm create streetui@latest my-app -- --template basic   # minimal app
npm create streetui@latest my-app -- --template ssr     # SSR + hydration app
```

This package is a thin wrapper over `@streetui/cli`; it contains no framework
logic. StreetUI uses its own independent toolchain (no Vite, no bundler
dependency for application builds).
