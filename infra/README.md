# AWS TypeScript Pulumi Template

A minimal Pulumi template for provisioning AWS infrastructure using TypeScript. This template creates an Amazon S3 bucket and exports its name.

## Prerequisites

- Pulumi CLI (>= v3): https://www.pulumi.com/docs/get-started/install/
- Node.js (>= 14): https://nodejs.org/
- AWS credentials configured (e.g., via `aws configure` or environment variables)

## Getting Started

1.  Initialize a new Pulumi project:

    ```bash
    pulumi new aws-typescript
    ```

    Follow the prompts to set your:
    - Project name
    - Project description
    - AWS region (defaults to `us-east-1`)

2.  Preview and deploy your infrastructure:

    ```bash
    pulumi preview
    pulumi up
    ```

3.  When you're finished, tear down your stack:

    ```bash
    pulumi destroy
    pulumi stack rm
    ```

## Project Layout

- `Pulumi.yaml` — Pulumi project and template metadata
- `index.ts` — Main Pulumi program (creates an S3 bucket)
- `package.json` — Node.js dependencies
- `tsconfig.json` — TypeScript compiler options

## Configuration

| Key          | Description                             | Default     |
| ------------ | --------------------------------------- | ----------- |
| `aws:region` | The AWS region to deploy resources into | `us-east-1` |

Use `pulumi config set <key> <value>` to customize configuration.

## Secrets

Secrets are stored encrypted in `Pulumi.<stack>.yaml` via `pulumi config set --secret`. All commands below should be run from the `infra/` directory against the target stack (e.g. `prod`).

```bash
cd infra
pulumi stack select prod
```

### Application secrets

```bash
# Database (two URLs for principle of least privilege)
# - database-runtime-url (DATABASE_RUNTIME_URL): app runtime, DML only
# - database-owner-url (DATABASE_OWNER_URL): MIGRATIONS ONLY. Never in app, studio, or scripts.
pulumi config set afterclass:database-runtime-url "postgres://..." --secret
pulumi config set afterclass:database-owner-url "postgres://..." --secret

# Migration from database-url: run `pulumi config set afterclass:database-runtime-url "$(pulumi config get afterclass:database-url)" --secret` then `pulumi config rm afterclass:database-url`

# Clerk (auth)
pulumi config set afterclass:clerk-secret-key "sk_..." --secret
pulumi config set afterclass:clerk-public-key "pk_..." --secret

# Cookie signing
pulumi config set afterclass:cookie-secret "<random-string>" --secret

# Resend (email)
pulumi config set afterclass:resend-api-key "re_..." --secret

# Internal API key (used between services)
pulumi config set afterclass:afterclass-api-key "<random-string>" --secret

# AI providers
pulumi config set afterclass:google-genai-api-key "<key>" --secret
pulumi config set afterclass:cerebras-api-key "<key>" --secret
pulumi config set afterclass:openai-api-key "<key>" --secret

# Upstash Redis
pulumi config set afterclass:upstash-redis-url "https://..." --secret
pulumi config set afterclass:upstash-redis-token "<token>" --secret
```

### Apple Push Notification Service (APNS)

```bash
# Non-sensitive identifiers (stored as plain text)
pulumi config set afterclass:apns-key-id "<10-char-key-id>"
pulumi config set afterclass:apns-team-id "<10-char-team-id>"
pulumi config set afterclass:apns-bundle-id "com.example.app"

# Private key (.p8 file contents)
pulumi config set afterclass:apns-key-p8 "$(cat AuthKey_XXXXXX.p8)" --secret
```

### Observability

```bash
# Better Stack log forwarding (source token from Better Stack → Sources)
pulumi config set afterclass:better-stack-source-token "<token>" --secret

# Optional: custom ingest host (defaults to https://in.logs.betterstack.com)
pulumi config set afterclass:better-stack-entrypoint "https://your-ingest-host"

# Sentry
pulumi config set afterclass:sentry-dsn "https://...@sentry.io/..." --secret
```

### Better Stack Log Forwarding (prod)

CloudWatch logs from Lambda functions are forwarded to [Better Stack](https://betterstack.com/docs/logs/aws-cloudwatch/) when configured:

```bash
# Required: Source token from Better Stack → Sources → Create source
pulumi config set afterclass:better-stack-source-token <token> --secret

# Optional: Custom ingest host (default: https://in.logs.betterstack.com)
pulumi config set afterclass:better-stack-entrypoint https://your-ingest-host
```

Log groups forwarded: API (`/aws/lambda/afterclass-api`), push poller, and push worker Lambdas.

If the API log group already exists (e.g. from a prior deploy), import it before running `pulumi up`:

```bash
pulumi import aws:cloudwatch/logGroup:LogGroup apiLogs /aws/lambda/afterclass-api
```

## Next Steps

- Extend `index.ts` to provision additional resources (e.g., VPCs, Lambda functions, DynamoDB tables).
- Explore [Pulumi AWSX](https://www.pulumi.com/docs/reference/pkg/awsx/) for higher-level AWS components.
- Consult the [Pulumi documentation](https://www.pulumi.com/docs/) for more examples and best practices.

## Getting Help

If you encounter any issues or have suggestions, please open an issue in this repository.
