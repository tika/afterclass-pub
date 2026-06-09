#!/bin/bash
set -e

# Build the API package (esbuild bundles all dependencies including @afterclass/core)
pnpm --filter @afterclass/api run build

# Deploy to AWS via Pulumi
cd infra && pulumi up --skip-preview
