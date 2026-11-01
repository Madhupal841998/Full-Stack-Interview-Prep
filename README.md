# Full-Stack Interview Prep

A browser-based study portal for learning backend engineering and preparing for software engineering interviews. It organizes a set of 26 Markdown guides into learning tracks, with built-in search and local study progress tracking.

## Features

- Browse the backend engineering roadmap and its topic guides from a single dashboard.
- Search the study material and open matching documents.
- Read rendered Markdown with a table of contents and previous/next navigation.
- Mark documents as studied and see completion progress by document and learning track.
- Continue where you left off using recently visited documents.
- Keep study progress in browser `localStorage`; no account or backend service is required.

## Study material

The included guides cover:

- Engineering foundations, JavaScript, TypeScript, data structures, and problem solving
- Node.js, Express, HTTP, MySQL, SQL, ORMs, and data access
- Authentication, authorization, security, backend architecture, and API design
- Low-level and high-level system design, distributed systems, and multi-tenant SaaS
- Error handling, resilience, caching, background jobs, messaging, and file processing
- Observability, production operations, testing, performance, portfolio projects, and interview preparation

The roadmap and all study documents are stored in [`public/content`](public/content). The app reads the document list from `manifest.json` and loads the Markdown files as static assets.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Getting started

```bash
git clone https://github.com/Madhupal841998/Full-Stack-Interview-Prep.git
cd Full-Stack-Interview-Prep
npm ci
npm run dev
```

Open the local URL printed by Vite to use the portal.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run build` | Type-check the project and create a production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run lint` | Run ESLint across the project. |

## Production build

Run the following command to create a static production build:

```bash
npm run build
```

Deploy the contents of `dist/` to any static web host. The site does not require a separate API server.

## Project structure

```text
public/
  content/       Roadmap, Markdown study guides, and content manifest
src/
  components/    Dashboard, document reader, search, and UI components
  hooks/         Content loading and responsive-layout hooks
  lib/           Markdown, grouping, progress, and shared utilities
  types/         Study content and progress types
  App.tsx        Application shell and document navigation
```

## Progress and privacy

Study completion and visit timestamps are stored in the current browser using `localStorage`. Progress is local to that browser and is not synced between devices.

## License

This project is distributed under the MIT License. See [`LICENSE`](LICENSE).
