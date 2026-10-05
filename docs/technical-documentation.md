# Event Registration System: Technical Documentation (DRAFT)

> Fill in every `[bracketed]` item and replace each `[Screenshot: ...]` with a real screenshot.

## 1. Title Page

- **Project title:** Event Registration System with a Containerized CI/CD Pipeline
- **Course / Section:** System Architecture and Integration, [section]
- **Group name:** [group name]
- **Repository:** [GitHub URL]

| Member | Role |
|---|---|
| [Surname, Firstname MI.] | Project Lead / Scrum Master |
| [Surname, Firstname MI.] | DevOps / CI-CD Engineer |
| [Surname, Firstname MI.] | Infrastructure Engineer |
| [Surname, Firstname MI.] | Backend and Database Engineer |
| [Surname, Firstname MI.] | Frontend, QA, and Documentation Lead |

## 2. Project Description and Modules

The Event Registration System lets people browse upcoming events and register for them. Visitors can register without an account. Users who create an account get a **My Registrations** page where they can edit or delete their own registrations. An administrator signs in with a fixed account to create, edit and delete events (each with an optional image URL), see who registered for each event, and read a per-event report table.

| Module (container) | Responsibility |
|---|---|
| **proxy** | nginx reverse proxy, the single public entry point. Routes `/` to the web container and `/api/` to the server container. |
| **web** | nginx serving the built React app (user interface). The page footer shows the build number of the running release. |
| **server** | Express API: events, registration, signup and login, My Registrations, admin CRUD, report, and `/api/health`. |
| **db** | MySQL 8.0 with tables `users`, `events` and `registrations`. The schema and three seed events are loaded from `init.sql` on first start. |

The API exposes a health endpoint (`GET /api/health`) that returns 200 only when the database answers.

## 3. Architecture

[Insert architecture diagram here: `docs/architecture.png`]

```
Browser --:4000--> proxy (nginx :8080)
                     |  /        -> web (nginx :8080, React static files)
                     |  /api/*   -> server (Express :3000)
                                      |  DB_HOST=db
                                      v
                                    db (MySQL :3306) --- volume evt-db-data

Network: evt-net (user-defined). Published port: 4000 -> proxy only.
CI uses a second, throw-away copy of the same stack (compose project evtci, port 4001, own volume).
```

**Request flow.** The browser only ever talks to the proxy on port 4000. The proxy forwards page requests to `web` and API calls to `server` using Docker's built-in DNS (the service names). The server reaches MySQL through the name `db`. Only the proxy publishes a port, so web, server and database can only be reached from inside the Docker network.

**Authentication flow.** Passwords are hashed with scrypt (Node's built-in `crypto`). Login returns a signed token that the browser stores and sends in the `Authorization` header. The admin account is checked against fixed credentials before the database is consulted.

## 4. Technology Stack and Justification

| Component | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite, React Router | [e.g. component reuse for the forms; fast build] |
| Web server / proxy | nginx-unprivileged 1.27 (alpine) | Separate proxy container gives one public entry point; the unprivileged image runs as a non-root user |
| Backend | Node.js 20 + Express 4 | [e.g. the team knows JavaScript; one language for client and server] |
| Database | MySQL 8.0 | Relational data with foreign keys and a unique (event, email) constraint that prevents duplicate registrations |
| Auth | Built-in `crypto` (scrypt + HMAC token) | No extra dependencies to install or secure |
| Unit tests | Jest + Supertest (server), Vitest + Testing Library (client) | Fast, no database needed (the DB is replaced by a fake) |
| E2E tests | Jest with Node's `fetch` | Tests the real stack over HTTP with no browser to install |
| CI/CD | Jenkins (in Docker) + GitHub | [e.g. required by the course; Poll SCM works without a public URL] |

## 5. Dockerfile Explanations

| Image | Base | What it does |
|---|---|---|
| `server/Dockerfile` | `node:20-alpine` | Copies `package*.json` first so the dependency layer is cached, runs `npm install --omit=dev`, then copies `src`. Runs as the non-root `node` user. `HEALTHCHECK` calls `/api/health`. |
| `client/Dockerfile` | multi-stage: `node:20-alpine` then `nginx-unprivileged:1.27-alpine` | Stage 1 builds the React app and bakes the build number into it (`BUILD_NUMBER` build argument). Stage 2 copies only the compiled files and `nginx.conf`, so the final image has no Node or source code and runs as non-root. `HEALTHCHECK` calls `/healthz`. |
| `proxy/Dockerfile` | `nginx-unprivileged:1.27-alpine` | Config is baked into the image (no bind mount). Non-root, `HEALTHCHECK` on `/healthz`. |
| `db/Dockerfile` | `mysql:8.0` | Copies `init.sql` into `/docker-entrypoint-initdb.d/` so the schema and seed data load on first start. `HEALTHCHECK` uses `mysqladmin ping` over TCP, so it only passes once MySQL really accepts connections. |

Security and quality choices: pinned base image versions (no `latest`), a `.dockerignore` in every module, non-root users in the API, web and proxy images, no secrets baked into images, configuration passed as environment variables.

## 6. Docker Compose

- **Services:** `db`, `server`, `web`, `proxy`, each built from its own Dockerfile and tagged `evt-<name>:${TAG}`. One command starts everything: `docker compose up -d --build`.
- **Dependencies:** `server` waits for `db`, `web` waits for `server`, and `proxy` waits for `web` and `server`, all with `condition: service_healthy` (the health checks come from the Dockerfiles).
- **Network:** one user-defined network, `evt-net`. Only `proxy` publishes a port (`4000:8080`); the database is never exposed.
- **Volume:** `evt-db-data` mounted at `/var/lib/mysql`, so data survives restarts and redeploys.
- **Environment variables:** database passwords, `AUTH_SECRET` and the admin login come from a `.env` file that is not committed. `.env.example` holds placeholders. The compose file refuses to start if a required value is missing.
- **Restart policy:** `unless-stopped` on every service.
- **CI vs production:** the pipeline starts the same file twice with different project names: `evtci` (test copy, port 4001, throw-away volume) and `evt` (production, port 4000).

## 7. Jenkins Setup

- **Installation:** Jenkins runs from `infra/jenkins/docker-compose.yml` (built on `jenkins/jenkins:lts-jdk17`) in a stack separate from the application, so the pipeline never redeploys Jenkins.
- **Persistence:** the `jenkins_data` volume holds `/var/jenkins_home`.
- **Docker access:** the host's `/var/run/docker.sock` is mounted so pipeline steps can build and run containers.
- **Network:** Jenkins joins `ci-network`, which lets it reach the temporary test copy of the site.
- **Plugins and tools:** suggested plugins, Pipeline, Git, JUnit, NodeJS plugin with a tool named `node20`. The Jenkins image includes the Docker CLI and the Compose plugin (`infra/jenkins/Dockerfile`).
- **Job:** Pipeline script from SCM, repository [URL], branch `main`, script path `Jenkinsfile`.
- **Credentials:** a **Secret file** credential with id `evt-env` holds the production `.env` (database passwords, auth secret, admin login). The Jenkinsfile copies it into the workspace for the run and deletes it afterwards, so no secret is in Git or in the Jenkinsfile.
- **Trigger:** `pollSCM('H/2 * * * *')` in the Jenkinsfile: Jenkins checks GitHub every two minutes and starts a build when it finds a new commit. No manual click is needed.

> Security note: mounting the Docker socket and running as root gives Jenkins full control of the host's Docker. That is acceptable for a lab. In production you would use dedicated build agents, rootless Docker, or Docker-in-Docker with TLS.

[Screenshot: Jenkins job configuration showing the trigger]

## 8. Pipeline Explanation

| Stage | What it does | If it fails |
|---|---|---|
| Checkout | Gets the code, copies the secret `.env` from Jenkins credentials, checks `docker compose` is available | Build stops |
| Install | `npm install` in `server`, `client` and `e2e` | Build stops |
| Unit Test | Runs the server (Jest) and client (Vitest) tests | Build stops; nothing is built or deployed |
| Build Images | `docker compose build` creates `:candidate` images for all four modules | Build stops |
| Start test stack | Starts a throw-away copy of the whole stack (project `evtci`) and waits until every container is healthy | Build stops; logs are archived |
| Health checks | `curl` on `/healthz` and `/api/health` through the test proxy | Retried 3 times, then the build stops |
| E2E Test | Runs the end-to-end tests against the test stack | Build stops; the live site is untouched |
| Deploy | Only on `main`: tags the tested images with the build number, runs `docker compose up -d --no-build` for project `evt`, waits for health, removes old releases beyond the newest 3 | Build fails; previous release tags remain on the host |
| Verify | Smoke test of the live stack: `/healthz` and `/api/health` through the production proxy | Build fails |

**Post actions:** a success or failure message with the release number and the rollback hint; always publish JUnit results, archive the test stack logs, remove the test stack and its volume, prune dangling images and delete the `.env` copy from the workspace.

**Trigger.** `pollSCM` in the Jenkinsfile starts the pipeline automatically within about two minutes of a push. Nobody presses Build Now.

**Image tagging.** Every build produces `:candidate` images for testing. Only after every test passes on `main` are they tagged with the build number (for example `evt-web:12`). The same number is shown in the website footer. The three newest numbered tags of each image are kept for rollback.

[Screenshot: Stage View with a fully green build]

## 9. Testing Strategy

| Level | Tool | What it covers | Count |
|---|---|---|---|
| Server unit/integration | Jest + Supertest with a mocked database | Validation, health endpoint, registration rules (full, duplicate, not found), signup and login, access control (401/403), My Registrations ownership, admin CRUD, report | [30] |
| Client unit | Vitest + Testing Library | Event list, registration form validation, login form, My Registrations delete flow, admin page access, event form | [count] |
| End-to-end | Jest over HTTP against nginx, Express and MySQL | Seeded data, SPA routing fallback, registration, duplicates, signup/login, edit and delete own registration, admin login, event CRUD, report, forbidden access | [count] |

**How failures block deployment.** Jenkins runs the stages in order and stops at the first failing one. The Deploy stage comes last and also requires the `main` branch, so a failing unit or end-to-end test can never replace the running site.

[Screenshot: a build failing at Unit Test, with the live site unchanged]

## 10. Rollback and Data Persistence

**Persistence proof.** Data lives in the named volume `evt-db-data`, which is not removed when containers are replaced (`docker compose down` without `-v`, or a new deployment).
1. Register for an event or create an account.
2. Trigger a new deployment.
3. The record is still there.

[Screenshot: record before redeploy] [Screenshot: same record after redeploy]

**Rollback.** Previous releases remain as tagged images. In Jenkins, open the job, choose **Build with Parameters**, enter an older build number in `ROLLBACK_TAG` (for example `11`) and start the build. The pipeline skips build and test, then runs `TAG=11 docker compose -p evt up -d --no-build`, so the site returns to release 11 and the footer shows `Build 11`. The same can be done by hand on the host with that command.

[Screenshot: `docker images evt-web` showing several tags] [Screenshot: Build with Parameters] [Screenshot: the site footer after rollback]

## 11. Problems Encountered and How We Solved Them

| Problem | Cause | Fix |
|---|---|---|
| New server test suite failed to load | [e.g. a file was missing or in the wrong folder] | [what you did] |
| Database tables missing after adding accounts | `init.sql` only runs on an empty volume | Removed the old `evt-db-data` volume once |
| Client tests failed locally with a rollup error | `node_modules` installed on Windows used on Linux | Reinstalled dependencies |
| [add your own] | | |

## 12. Individual Contributions and References

| Member | Contribution |
|---|---|
| [Name] | [what they did] |
| [Name] | [what they did] |
| [Name] | [what they did] |
| [Name] | [what they did] |
| [Name] | [what they did] |

**References:** Docker documentation (docs.docker.com); Jenkins Pipeline documentation (jenkins.io/doc/book/pipeline); nginx documentation; React and Vite documentation; MySQL 8.0 reference manual; [course manual: SYSIN Final Project Guidelines].
