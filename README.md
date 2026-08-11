# Articulation Mastery

Articulation Mastery is a full-stack professional communication coaching platform. It supports a role-aware 28-day curriculum, learner practice submissions, AI-generated coaching feedback, analytical dashboards, team reporting, a personal journal, scheduled reminder infrastructure, and a private progression system for deliberate practice.

## Application architecture

The application uses React 19 and Tailwind CSS for the client experience, an Express and tRPC server for typed application procedures, MySQL/TiDB through Drizzle ORM for persistence, and protected object storage for recorded practice. Authentication is provided by the existing OAuth integration. AI feedback is called only from the server to keep credentials private.

| Concern | Implementation |
| --- | --- |
| Identity and access | OAuth-backed roles: `learner`, `manager`, and `admin` |
| Practice feedback | Server-side structured LLM response with resilient standard-scoring fallback |
| Recorded practice | Browser recording, database metadata, and managed object storage |
| Transcription | Server-side voice transcription for supported audio recordings |
| Reporting | Role-restricted tRPC reporting procedures and browser CSV download |
| Scheduled reminders | Platform-managed authenticated recurring callback design |
| Gamification | Rule-driven points, levels, and milestone achievements derived from completed practice |
| Visual preferences | Persisted teal light/dark visual modes with high-contrast action and evidence colors |

## Practice and progression experience

Each daily lesson provides a principle, video-coaching cue, preparation space, focused delivery timer, written or recorded response, structured AI feedback, and a private multi-take comparison view. A reviewed practice earns 60 progression points. Every 240 points advances the learner to the next level, while milestone achievements unlock at distinct day-completion thresholds. The progression model is private by default; it does not create a public leaderboard or expose learner scores to peers.

Learners can open **My achievements** from the workspace to view their current level, points to the next level, and earned practice markers. Theme preference is stored in the browser and can be changed with the visible light/dark control without affecting learner records or reporting.

## Reusable delivery skill

The repository’s workflow has also been packaged as the `articulation-mastery-program-builder` skill. It provides an implementation contract for creating or extending similar role-aware professional communication programs, including curriculum design, practice feedback, engagement rules, reporting boundaries, hosted reminders, and production delivery standards.

## Local development

Install the package manager version pinned by the repository, then run the development server.

```bash
corepack enable
pnpm install
pnpm dev
```

Run type checks and the test suite before promoting a build.

```bash
pnpm check
pnpm test
pnpm build
```

## Database setup

The project uses Drizzle migrations in `drizzle/migrations/`. Configure `DATABASE_URL` in your deployment environment, generate migrations after schema changes, then apply the generated SQL through your database deployment process.

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## Roles and team reporting

New accounts are learners by default. Promote trusted operators to `manager` or `admin` in the `users.role` column. Managers only receive reporting access for their explicit `manager_assignments`; administrators can report across all learner accounts.

## AWS deployment

The repository is compatible with AWS App Runner, ECS Fargate, or Elastic Beanstalk. Provision a MySQL-compatible database such as Amazon RDS or Aurora, inject the expected environment variables through AWS Secrets Manager, and ensure the service can reach the OAuth and managed storage endpoints. The included `Dockerfile.aws` builds the client and server in the container image, and the server honors `PORT` from its runtime environment. Review the [AWS deployment guide](docs/AWS_DEPLOYMENT.md) and the [AWS CI/CD runbook](docs/AWS_CICD.md) before provisioning production infrastructure.

> **Important:** Manus-managed OAuth and Forge integrations are not automatically portable to an independent AWS runtime. The AWS runbook identifies the current provider migration requirements; do not copy platform-injected credentials into AWS.

Required production configuration includes `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `BUILT_IN_FORGE_API_URL`, and the corresponding Forge API keys. Do not commit `.env` files or literal credentials.

## GitHub workflow

Create a private repository, push the project, then configure GitHub Actions or your preferred CI provider to run `pnpm check`, `pnpm test`, and `pnpm build` for every pull request. A complete workflow is included at `.github/workflows/ci.yml`. Connect the protected main branch to the chosen AWS deployment service only after environment variables and database migrations are configured.
