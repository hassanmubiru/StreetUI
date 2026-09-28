# __PROJECT_NAME__

A StreetUI application with server-side rendering and client hydration,
scaffolded with the StreetUI CLI.

## Getting started

```bash
npm install
npm run dev
```

Then open the URL printed in your terminal (default http://localhost:3000).
Editing files under `src/` rebuilds the app and reloads the browser.

## Scripts

| Command         | What it does                                              |
| --------------- | --------------------------------------------------------- |
| `npm run dev`   | Start the dev server with live reload                     |
| `npm run build` | Produce a production build in `dist/`                     |
| `npm run start` | Serve the production build                                |
| `npm run typecheck` | Type-check the project with `tsc`                     |

## Project structure

```
__PROJECT_NAME__/
├── public/            Static assets copied as-is (styles.css, favicon.svg)
├── src/
│   ├── app.ts         The universal app: one definition for server + browser
│   ├── server.ts      Server entry — exports render(request) → HTML
│   └── main.ts        Browser entry — hydrates the server HTML in place
├── streetui.config.ts Project configuration (all fields optional)
└── package.json
```

## How it works

`src/app.ts` defines the UI once using the StreetUI DSL and reactive signals.
`src/server.ts` renders it to HTML for each request and embeds a state snapshot;
`src/main.ts` reads that snapshot in the browser and hydrates the existing DOM so
the app becomes interactive without re-rendering.

This project depends on a single package — `streetui` — and all of its source
imports from `"streetui"`.
