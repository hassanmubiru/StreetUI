# __PROJECT_NAME__

A reusable components demo built with StreetUI, showcasing composable UI
components with independent state.

## Getting started

```bash
npm install
npm run dev
```

Open the URL printed in your terminal (default http://localhost:3000). Editing
files under `src/` rebuilds the app and reloads the browser.

## Scripts

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | StreetUI dev server with HMR          |
| `npm run build`     | Production build in `dist/`           |
| `npm run start`     | Serve the production build            |
| `npm run preview`   | Serve `dist/client` statically        |
| `npm run doctor`    | Diagnose the project and toolchain    |
| `npm run typecheck` | Type-check with `tsc`                 |

## Project structure

```
__PROJECT_NAME__/
├── public/            Static assets (styles.css)
├── src/
│   ├── app.ts         The universal app (server + browser)
│   ├── server.ts      Server entry — render(request) → HTML
│   └── main.ts        Browser entry — hydrates the server HTML
├── streetui.config.ts Project configuration
└── package.json
```

> **Note:** the `@streetui/*` packages are not yet published to npm. In this
> preview, install them from the StreetUI monorepo (workspace linking).
