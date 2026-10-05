# Event Registration System

A small multi-container web app (events, registration, accounts, admin panel) built to demonstrate containerization with Docker and an automatic CI/CD pipeline with Jenkins.

**Team:** [Surname, Firstname MI.] (Project Lead), [..] (DevOps / CI-CD), [..] (Infrastructure), [..] (Backend and Database), [..] (Frontend, QA, Documentation)

## Architecture

```
Browser --:4000--> proxy (nginx, :8080)
                     |  /       -> web    (nginx, React build)
                     |  /api/*  -> server (Node.js + Express, :3000)
                                     |
                                     v
                                   db (MySQL 8.0) -- named volume evt-db-data

network: evt-net (user-defined)   |   only the proxy publishes a port
```

| Container | Image / tech | Role |
|---|---|---|
| `proxy` | nginx-unprivileged 1.27 | Single public entry point, routes `/` and `/api/` |
| `web` | React 18 + Vite, served by nginx-unprivileged | User interface, shows the build number in the footer |
| `server` | Node 20 + Express | API: events, registration, signup/login, My Registrations, admin CRUD, report, `/api/health` |
| `db` | MySQL 8.0 | Users, events, registrations. Data in volume `evt-db-data` |
| `jenkins` | Jenkins LTS (separate compose file) | CI/CD server |

## Prerequisites

Git, Docker with the Compose plugin (`docker compose version`).

## Run the application

```
cp .env.example .env        # then edit the placeholder values
docker compose up -d --build
```

Open http://localhost:4000. Admin login uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`. Stop with `docker compose down` (data stays in the volume; add `-v` only if you want to delete it).

## Run the tests

```
cd server && npm install && npm test     # API unit tests (Jest)
cd client && npm install && npm test     # UI tests (Vitest)
```
The end-to-end tests (`e2e/`) run in the pipeline against a throw-away copy of the stack.

## Jenkins (CI/CD)

1. Start Jenkins from its own compose file: `cd infra/jenkins && docker compose up -d --build`
2. Open http://localhost:8080, unlock with `docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword`, install the suggested plugins, then add the **NodeJS** plugin and a NodeJS tool named `node20`.
3. **Manage Jenkins > Credentials:** add a **Secret file** with id `evt-env` containing the production `.env` (same keys as `.env.example`, real values).
4. **New Item > Pipeline > Pipeline script from SCM:** repository URL, branch `main`, script path `Jenkinsfile`.
5. **Trigger:** `pollSCM('H/2 * * * *')` is defined in the Jenkinsfile, so Jenkins checks the repository every two minutes and builds on its own when someone pushes.

### Pipeline stages

Checkout > Install > Unit Test > Build Images > Start test stack > Health checks > E2E Test > Deploy (main only) > Verify

- Images are built as `:candidate`, tested in a separate throw-away stack (`evtci`), and only if everything passes are they tagged with the build number (for example `evt-web:12`) and deployed as project `evt`.
- A failing test stops the pipeline before Deploy, so the running site stays on the previous release.
- The three newest releases of each image are kept for rollback.

### Rollback

In Jenkins: **Build with Parameters**, set `ROLLBACK_TAG` to an older build number (for example `11`). The pipeline skips build and test and redeploys those tagged images.

### Data persistence

Database files live in the named volume `evt-db-data`. Redeploying or running `docker compose down` / `up` keeps the data.

## Repository layout

```
Jenkinsfile                 pipeline as code
docker-compose.yml          application stack
.env.example                placeholder configuration (real .env is not committed)
proxy/  client/  server/  db/   one Dockerfile per module (+ .dockerignore)
e2e/                        end-to-end tests
infra/jenkins/              Jenkins Dockerfile + compose file (deployed separately)
docs/                       technical documentation
```
