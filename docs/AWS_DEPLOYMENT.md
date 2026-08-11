# AWS Deployment Guide

Articulation Mastery is prepared for deployment to AWS App Runner or Amazon ECS Fargate. The service is a single Node.js web process that serves the built React client and tRPC API from the same container. It reads the runtime port from `PORT` and does not depend on persistent local storage. The production CI/CD reference implementation targets ECS Fargate; see the detailed [AWS CI/CD Runbook](AWS_CICD.md).

## Independent AWS runtime prerequisite

The current application uses Manus-managed OAuth and Forge services for identity, AI feedback, transcription, storage, and notifications. Those managed integrations are not automatically available outside Manus. Before sending independent AWS production traffic, replace them with independently operated providers—such as Cognito for identity, Bedrock for AI feedback, Transcribe for voice, S3 for files, and SES/SNS or EventBridge for notifications—or implement a supported integration path. Do not export or copy Manus-provided credentials into AWS.

## 1. Provision managed dependencies

Create an Amazon RDS MySQL or Aurora MySQL database and a security group that permits the application service to reach the database. Store `DATABASE_URL`, `JWT_SECRET`, OAuth settings, and the Forge integration keys in AWS Secrets Manager. The audio practice files use managed object storage through the preconfigured storage interface; do not mount local disks for application data.

## 2. Build and publish the image

The repository includes `Dockerfile.aws` for AWS deployment. The file is deliberately named to avoid replacing the platform-managed image used by the development workspace.

```bash
docker build -f Dockerfile.aws -t articulation-mastery:latest .
aws ecr create-repository --repository-name articulation-mastery
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker tag articulation-mastery:latest <account>.dkr.ecr.<region>.amazonaws.com/articulation-mastery:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/articulation-mastery:latest
```

## 3. Deploy to App Runner

Create an App Runner service from the ECR image. Assign a service role that can read the referenced AWS Secrets Manager values, add all environment variables listed in `.env.example`, and set a health check path that reaches the root application URL. App Runner supplies `PORT` automatically.

For an ECS Fargate deployment, use the same image in a task definition, map the container port that the runtime provides, and place the service behind an Application Load Balancer. Keep the desired count at least one if you require a consistently warm service; the scheduled reminder callback itself is platform managed and does not require an in-container worker.

## 4. Run the application migration

Generate and review database migrations in CI or in a controlled release process, then apply the SQL from `drizzle/migrations/` to the production database before sending production traffic. The current initial application migration is `0001_silent_gwen_stacy.sql`.

## 5. Complete post-deployment setup

After the production service is live, sign in as each learner and use **Activate hosted reminders** in the profile area. The application creates a secure, platform-managed recurring callback tied to that learner. It delivers an in-app daily practice cue and milestone celebrations after completed weekly increments. Scheduled callbacks cannot target local or preview environments.

## Security checklist

Do not commit `.env` files or long-lived credentials. Restrict database ingress to the deployed service, rotate secrets through AWS Secrets Manager, enable encryption at rest for RDS, use HTTPS at the load balancer or App Runner endpoint, and grant manager/admin roles only to trusted operators.
