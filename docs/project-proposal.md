# Project Proposal (Appendix A)

| Item | Details |
|---|---|
| Group name | [group name] |
| Project title | Event Registration System with a Containerized CI/CD Pipeline |
| Short description | A web application where visitors browse upcoming events and register for them. Users can create an account to manage their own registrations (edit or delete), and an administrator manages events, sees who registered and reads a per-event report. The system runs as four Docker containers behind a reverse proxy. A Jenkins pipeline tests every push, builds tagged images, deploys the stack automatically and can roll back to an earlier release. |
| Repository URL | https://github.com/apBarazon/event-registration2 |
| Project Lead / Scrum Master | [Surname, Firstname MI.] |
| DevOps / CI-CD Engineer | [Surname, Firstname MI.] |
| Infrastructure Engineer | [Surname, Firstname MI.] |
| Backend and Database Engineer | [Surname, Firstname MI.] |
| Frontend, QA, and Documentation Lead | [Surname, Firstname MI.] |

## Modules

| Module / Container | Technology | Purpose | Justification |
|---|---|---|---|
| proxy | nginx (unprivileged) | Single public entry point; routes `/` to web and `/api/` to server | Only one published port, and the other containers stay private |
| web | React 18 + Vite, served by nginx | User interface: events, registration, account pages, admin panel | Component reuse for forms; the build produces static files, so the final image is small |
| server | Node.js 20 + Express | REST API, login, admin functions, `/api/health` | One language for client and server; the team already knows JavaScript |
| db | MySQL 8.0 + named volume | Stores users, events and registrations | Relational data with foreign keys and a unique (event, email) rule against duplicates |
| jenkins (separate compose file) | Jenkins LTS in Docker | CI/CD server | Required by the course; runs apart from the app so the pipeline never redeploys itself |

## Pipeline Plan

| Pipeline Plan | Details |
|---|---|
| Git hosting | GitHub |
| Trigger (webhook / polling) | Polling: `pollSCM` every 2 minutes (no public URL needed). A webhook can replace it if time allows. |
| Planned stages | Checkout, Install, Unit Test, Build Images, Start test stack, Health checks, E2E Test, Deploy (main only), Verify |
| Tests to be run | Server unit tests (Jest + Supertest), client unit tests (Vitest), end-to-end tests over HTTP against a throw-away copy of the full stack |
| Planned bonus features (optional) | Parameterized rollback job, secrets in Jenkins credentials, non-root images, build number shown on the page, keeping the three newest releases |

## Draft architecture diagram

```
Browser --:4000--> proxy (nginx)
                     |  /       -> web    (React build, nginx)
                     |  /api/*  -> server (Express :3000)
                                     |
                                     v
                                   db (MySQL 8.0) -- volume evt-db-data

network: evt-net | only the proxy publishes a port
CI: Jenkins (own compose file) -> builds, tests and deploys this stack
```

[Replace with a drawn or digital diagram, for example from draw.io.]