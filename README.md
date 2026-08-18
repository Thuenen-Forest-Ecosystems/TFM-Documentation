# TFM Documentation

## Requirements
Before you begin, ensure you have met the following requirements:

- [Node.js](https://nodejs.org/) (version 14 or later)
- A code editor such as [Visual Studio Code](https://code.visualstudio.com/) (optional)

### Testing Requirements
To check your Node.js and npm versions, run the following commands in your terminal:
```
node -v
npm -v
```

## Installation
To install TFM, follow these steps:
1. Clone the repository:
   ```bash
   git clone https://github.com/Thuenen-Forest-Ecosystems/TFM-Documentation.git
   ```
2. Navigate to the project directory:
   ```bash
   cd TFM-Documentation
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```


## Configuration (.env files)
The server URLs (Supabase API, PowerSync sync service) are configured through environment variables instead of being hardcoded. Vite only exposes variables prefixed with `VITE_`:

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase API URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) API key |
| `VITE_REDIRECT_TO` | Redirect URL used for authentication flows |
| `VITE_SYNC_URL` | PowerSync sync service URL (defaults to `{VITE_SUPABASE_URL}/sync` if unset) |

If a variable is not set anywhere, the code falls back to the remote production server.

Two ready-made configurations are committed to the repository:

- **`.env.remote`** — remote production server (`https://ci.thuenen.de`)
- **`.env.local-server`** — local development stack (Supabase on `http://127.0.0.1:54321`, PowerSync on `http://localhost:8181`)

> **Note:** The local file is intentionally **not** named `.env.local` — Vite automatically loads a file with that exact name in *every* run, which would break switching between servers.

Optionally, copy `.env.example` to `.env` (gitignored) as your personal default configuration for the plain `npm run docs:dev` / `npm run docs:build` commands:
```bash
cp .env.example .env
```
The dedicated `:remote` / `:local` scripts below always take priority over `.env`.

## Usage
To run the documentation locally, follow these steps:
1. Start the development server against the server of your choice:
   ```bash
   npm run docs:dev          # uses your personal .env (falls back to remote defaults)
   npm run docs:dev:remote   # forces the remote production server (.env.remote)
   npm run docs:dev:local    # forces the local development stack (.env.local-server)
   ```
2. Open your web browser and go to [http://localhost:5173/TFM-Documentation/](http://localhost:5173/TFM-Documentation/) to view the documentation.

### Local development stack
`npm run docs:dev:local` expects the local server stack from the [TFM-Server](https://github.com/Thuenen-Forest-Ecosystems/TFM-Server) repository to be running:

```bash
supabase start   # Supabase API on http://127.0.0.1:54321
```

The PowerSync sync service (`http://localhost:8181`, `PS_PORT` in TFM-Server) must be started separately — without it, the Synchronization and WebSocket checks on the [Health Check](https://thuenen-forest-ecosystems.github.io/TFM-Documentation/health-check) page will show as failing.

## Build & Testing
Before push to main branch, ensure that the documentation builds correctly by running:
```bash
npm run docs:build
```

## CI/CD
This project uses GitHub Actions for continuous integration and deployment. The workflow is defined in the `.github/workflows/deploy.yml` file.

The deployment process is triggered on pushes to the `main` branch. The built documentation is deployed to [GitHub Pages](https://thuenen-forest-ecosystems.github.io/TFM-Documentation/).
