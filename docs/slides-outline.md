# Presentation Outline (16 slides, 10 minutes, all five members speak)

Speaker roles: **L** Project Lead, **D** DevOps/CI-CD, **I** Infrastructure, **B** Backend and Database, **F** Frontend/QA/Docs. Times add up to 10 minutes. Leave the live demo (slide 12) as the longest block.

| # | Slide | Speaker | Time | Content / screenshot |
|---|---|---|---|---|
| 1 | Title | L | 0:15 | Project title, group name, members and roles |
| 2 | The application | L | 0:35 | What it does in 3 lines: browse and register, accounts, admin panel. One screenshot of the event list |
| 3 | Architecture | I | 0:45 | Diagram: proxy, web, server, db, network, volume, one published port, request flow |
| 4 | Modules and stack | B | 0:40 | Table of the four modules with technology and why |
| 5 | Features | F | 0:35 | Screenshots: My Registrations, admin Events tab, Report tab |
| 6 | Dockerfiles | I | 0:45 | Multi-stage client build, non-root users, health checks, pinned versions |
| 7 | Docker Compose | I | 0:45 | Services, `depends_on: service_healthy`, named volume, restart policy, only proxy exposed |
| 8 | Secrets and security | D | 0:35 | `.env.example` in Git, real `.env` in Jenkins credentials, nothing secret in the Jenkinsfile |
| 9 | Jenkins setup | D | 0:35 | Jenkins in its own compose file, Docker socket, plugins, credential, poll trigger |
| 10 | The pipeline | D | 0:50 | Stage View screenshot; one line per stage; "failed tests never reach Deploy" |
| 11 | Testing strategy | F | 0:40 | Three levels: server unit, client unit, end-to-end on a throw-away stack; test counts |
| 12 | Live demo | all | (see demo script) | Seven demo steps; this slide is just a divider with the list |
| 13 | Persistence and rollback | D | 0:40 | Named volume, numbered images, ROLLBACK_TAG parameter (screenshots as a backup) |
| 14 | Problems and lessons | each member, one line | 0:50 | One real problem per person, for example: Windows line endings in the env file, missing Compose plugin, schema not updating on an old volume, stale registrations in a fresh database |
| 15 | Contributions and next steps | L | 0:30 | Who did what; ideas: webhook trigger, HTTPS, more tests |
| 16 | Q&A | all | 5:00 | Everyone should be ready to answer one question about their own part |

Tips
- Put the 10-minute budget on the demo: ask your instructor whether the demo counts inside the 10 minutes. If it does, see the timing advice in the demo script.
- Keep slides to diagrams, screenshots and short bullets. Speakers should explain, not read.
- Include the repository URL on the last slide and confirm the instructor is a collaborator (or the repo is public).