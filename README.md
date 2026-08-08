# Articulation Mastery

Articulation Mastery is a full-stack professional communication coaching platform. It supports a role-aware 28-day curriculum, learner practice submissions, AI-generated coaching feedback, analytical dashboards, team reporting, a personal journal, and scheduled reminder infrastructure.

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

The repository is compatible with AWS App Runner, ECS Fargate, or Elastic Beanstalk. Provision a MySQL-compatible database such as Amazon RDS or Aurora, inject the expected environment variables through AWS Secrets Manager, and ensure the service can reach the OAuth and managed storage endpoints. The included `Dockerfile.aws` builds the client and server in the container image, and the server honors `PORT` from its runtime environment. Review the complete [AWS deployment guide](docs/AWS_DEPLOYMENT.md) before provisioning production infrastructure.

Required production configuration includes `DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL`, `BUILT_IN_FORGE_API_URL`, and the corresponding Forge API keys. Do not commit `.env` files or literal credentials.

## GitHub workflow

Create a private repository, push the project, then configure GitHub Actions or your preferred CI provider to run `pnpm check`, `pnpm test`, and `pnpm build` for every pull request. A complete workflow is included at `.github/workflows/ci.yml`. Connect the protected main branch to the chosen AWS deployment service only after environment variables and database migrations are configured.
