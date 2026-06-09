// This file is used to create a GitHub OIDC provider and role for the production environment

import * as aws from "@pulumi/aws";

// 1. Create an OIDC Provider for GitHub (if you don't have one)
const githubOidcProvider = new aws.iam.OpenIdConnectProvider("github-oidc", {
  url: "https://token.actions.githubusercontent.com",
  clientIdLists: ["sts.amazonaws.com"],
  thumbprintLists: ["6938fd4d98bab03faadb97b34396831e3780aea1"], // Standard GitHub thumbprint
});

// 2. Create the Role GitHub will use
const githubRole = new aws.iam.Role("github-actions-role", {
  name: "GitHubActionsDeployRole",
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRoleWithWebIdentity",
        Effect: "Allow",
        Principal: { Federated: githubOidcProvider.arn },
        Condition: {
          StringLike: {
            // Only allow your specific repo to use this role
            "token.actions.githubusercontent.com:sub": "repo:tika/afterclass:*",
          },
        },
      },
    ],
  },
});

// 3. Give this role Admin (or specific) permissions
new aws.iam.RolePolicyAttachment("github-admin", {
  role: githubRole.name,
  policyArn: "arn:aws:iam::aws:policy/AdministratorAccess",
});

export const githubRoleArn = githubRole.arn;
