# AWS CI/CD Runbook

This package deploys the existing single-node Articulation Mastery container to **Amazon ECS on Fargate** through GitHub Actions. It uses GitHub OpenID Connect (OIDC), so the deployment workflow exchanges an identity token for short-lived AWS credentials instead of storing AWS access keys in GitHub.[1]

> **Portability prerequisite.** The current application was developed with Manus-managed OAuth, AI, voice-transcription, storage, and notification integrations. Those credentials and endpoints are not automatically portable to an independent AWS runtime. Complete the provider migration described in [AWS Deployment Guide](AWS_DEPLOYMENT.md#independent-aws-runtime-prerequisite) before enabling production traffic on AWS.

## Architecture

| Layer | AWS service | Responsibility |
| --- | --- | --- |
| Container registry | Amazon ECR | Stores immutable images tagged with the Git commit SHA. |
| Compute | Amazon ECS Fargate | Runs the unified Express API and React client in one Node.js container. |
| Ingress | Application Load Balancer | Terminates TLS, routes traffic, and checks `/` for service health. |
| Database | Amazon RDS MySQL or Aurora MySQL | Stores users, curriculum progress, practice submissions, feedback, and reporting data. |
| Secret storage | AWS Secrets Manager | Stores server runtime configuration and external-provider credentials. |
| Delivery identity | AWS IAM + GitHub OIDC | Authorizes the GitHub deployment environment with short-lived credentials. |

## AWS foundation

Provision these resources before enabling deployment automation.

| Resource | Required configuration |
| --- | --- |
| ECR | Create a private `articulation-mastery` repository and configure lifecycle retention for unreferenced images. |
| ECS | Create a Fargate cluster, task definition family, service, execution role, task role, and CloudWatch log group. Use at least two private subnets across Availability Zones for production. |
| ALB | Configure HTTPS listener, ACM certificate, target group health check path `/`, and security group ingress only on ports 80/443. |
| RDS | Use MySQL 8 or Aurora MySQL in private subnets; restrict database ingress to the ECS service security group. Enable automated backups, encryption, and deletion protection. |
| Secrets Manager | Create one secret per runtime value or a JSON secret with strict task-role access. Do not store credentials in GitHub Actions. |
| DNS | Point the production hostname to the ALB after a healthy service deployment. |

## GitHub OIDC setup

Add `https://token.actions.githubusercontent.com` as an IAM OpenID Connect provider with audience `sts.amazonaws.com`. Scope the IAM role to the GitHub `production` environment, not to every repository workflow.[1]

The repository was created after GitHub's immutable-subject rollout. Use this trust policy subject, derived from the repository identifiers verified during setup:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:vigilai-stack@293247784/Articulation-Mastery@1331323099:environment:production"
      }
    }
  }]
}
```

Grant the assumed deployment role only the minimum permissions required to push to the specified ECR repository, describe and register the target ECS task definition, update the named ECS service, and pass the already-provisioned ECS execution and task roles. GitHub's ECS workflow guidance describes the ECR repository, task definition, cluster, and service as required deployment inputs.[2]

## GitHub environment configuration

Create a **production** GitHub environment. Restrict it to the `main` branch and require a reviewer before deployment. Add the following **environment variables**; none is a secret.

| Variable | Example | Purpose |
| --- | --- | --- |
| `AWS_DEPLOY_ENABLED` | `false` initially, then `true` | Safety switch. The workflow is skipped until this value is explicitly enabled. |
| `AWS_REGION` | `us-east-1` | Region containing ECR and ECS. |
| `AWS_ROLE_TO_ASSUME` | `arn:aws:iam::<account>:role/GitHubActionsArticulationMasteryDeploy` | OIDC deployment role ARN. |
| `ECR_REPOSITORY` | `articulation-mastery` | ECR repository name. |
| `ECS_CLUSTER` | `articulation-mastery-production` | ECS cluster name. |
| `ECS_SERVICE` | `articulation-mastery-web` | ECS service name. |
| `ECS_TASK_FAMILY` | `articulation-mastery-web` | Existing task-definition family. |
| `CONTAINER_NAME` | `web` | Container definition name within the task definition. |

The deployment workflow is defined in `.github/workflows/deploy-aws-ecs.yml`. It builds `Dockerfile.aws`, pushes an image tagged with the commit SHA, renders that immutable image into the current task definition, deploys it, and waits for ECS service stability.

## Runtime configuration

Set runtime secrets in AWS Secrets Manager and reference them from the ECS task definition. The **task role**, not the GitHub deployment role, should receive `secretsmanager:GetSecretValue` permission for only the named secrets.

| Runtime value | Status for an independent AWS deployment | Action |
| --- | --- | --- |
| `DATABASE_URL` | Required | Create a least-privilege MySQL application user and use the private RDS endpoint. |
| `JWT_SECRET` | Required | Generate a high-entropy value and store it only in Secrets Manager. |
| `OAUTH_SERVER_URL`, `VITE_APP_ID`, `VITE_OAUTH_PORTAL_URL` | Manus-specific | Replace the current OAuth integration with Amazon Cognito, Auth0, or another independently operated OIDC provider before AWS cutover. |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, frontend Forge values | Manus-specific | Replace the AI-feedback, voice-transcription, storage, and notification integrations with independently provisioned services. Amazon Bedrock, Transcribe, S3, and SES/SNS are suitable AWS-managed options, but require application integration work. |
| Analytics values | Optional | Configure a production analytics provider only after confirming its privacy and data-retention controls. |

> The container and CI/CD package can be built and delivered to ECS now. A fully independent AWS production cutover is blocked until the Manus-managed identity and Forge integrations are replaced or otherwise made available to the AWS runtime. Do not copy Manus-provided credentials into AWS.

## Database migration control

Deploy schema changes before application traffic that depends on them. Keep migrations out of the automated deploy workflow unless the team has introduced a reviewed, idempotent migration runner with database-network access. For the current project, use a controlled release step from a network location that can reach RDS:

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
```

Record the migration version, take an RDS snapshot before destructive changes, and require a reviewed rollback plan for every migration. Never place the production database URL in a GitHub Actions secret merely to make migrations convenient.

## Release procedure

1. Merge the validated change to `main`; the existing CI workflow runs type checking, tests, and a production build.
2. Confirm migration status and apply any reviewed schema changes.
3. Confirm that the ECS task definition references the correct Secrets Manager values and that the target group reports healthy instances.
4. Set `AWS_DEPLOY_ENABLED` to `true` in the GitHub `production` environment and approve the deployment.
5. The deployment workflow publishes an image tagged with the commit SHA, updates the ECS task definition, and waits for the service to stabilize.
6. Verify the ALB health target, application root path, authentication callback, one text practice submission, reporting access, and CloudWatch logs.

## Rollback and recovery

The deployment uses immutable image tags. To roll back, select the prior successful ECS task definition revision in the ECS console or redeploy the corresponding commit through GitHub Actions. Confirm target health before resuming normal traffic. For a database-related incident, restore only after evaluating the migration rollback plan and RDS recovery-point objective.

## Production readiness checklist

- [ ] ECR repository, lifecycle policy, ECS task roles, RDS, ALB, ACM certificate, CloudWatch logs, and private networking are provisioned.
- [ ] GitHub OIDC provider and the repository-scoped deployment role are in place.
- [ ] GitHub `production` environment has branch restrictions, reviewer approval, and the listed deployment variables.
- [ ] ECS runtime secrets exist in AWS Secrets Manager and are referenced only from the task definition.
- [ ] Database migrations, backup posture, health checks, logging alarms, and rollback owners are reviewed.
- [ ] Manus-specific OAuth and Forge integrations are replaced or explicitly supported for the AWS environment.

## References

[1]: https://docs.github.com/actions/deployment/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services "GitHub Docs: Configuring OpenID Connect in AWS"
[2]: https://docs.github.com/enterprise-cloud@latest/actions/how-tos/deploy/deploy-to-third-party-platforms/amazon-elastic-container-service "GitHub Docs: Deploying to Amazon ECS"
[3]: https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/build-and-push-docker-images-to-amazon-ecr-using-github-actions-and-terraform.html "AWS Prescriptive Guidance: ECR and GitHub Actions"

