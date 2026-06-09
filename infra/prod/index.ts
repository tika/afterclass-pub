import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";

import "./database";
import * as github from "./github";
import { secretValues, ssmParameters } from "./secrets";

export { ssmParameters };

const stack = pulumi.getStack();
const afterclassConfig = new pulumi.Config("afterclass");
const sentryDsn = afterclassConfig.getSecret("sentry-dsn");
// Non-secret allowlist of super-admin emails (comma-separated). Set via:
//   pulumi config set afterclass:super-admin-emails "a@x.edu,b@y.edu"
const superAdminEmails = afterclassConfig.get("super-admin-emails") ?? "";

// Buckets
const assetsBucket = new aws.s3.Bucket("assets", {
  bucket: `afterclass-${stack}-assets`,
});

// Roles
const apiRole = new aws.iam.Role("apiRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
      },
    ],
  }),
});

new aws.iam.RolePolicyAttachment("apiBasic", {
  role: apiRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

// Give the API role access to the SSM parameters (needed for env vars)
new aws.iam.RolePolicy("apiSSM", {
  role: apiRole.name,
  policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": ["ssm:GetParameter", "ssm:GetParameters"],
        "Resource": "arn:aws:ssm:*:*:parameter/afterclass/${stack}/*"
      }]
    }`,
});

// Give the API role access to the S3 bucket (needed for assets)
new aws.iam.RolePolicy("apiS3", {
  role: apiRole.name,
  policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
        "Resource": [
          "${assetsBucket.arn}/*",
          "${assetsBucket.arn}"
        ]
      }]
    }`,
});

// Disable S3 public-access blocking so bucket policies can grant public read
new aws.s3.BucketPublicAccessBlock("assetsPublicAccessBlock", {
  bucket: assetsBucket.id,
  blockPublicAcls: true,
  ignorePublicAcls: true,
  blockPublicPolicy: false, // allow public bucket policy
  restrictPublicBuckets: false,
});

// Allow anyone to read the assets bucket
// Public read access for specific paths
new aws.s3.BucketPolicy("assetsPolicy", {
  bucket: assetsBucket.id,
  policy: pulumi.interpolate`{
	"Version": "2012-10-17",
	"Statement": [{
		"Effect": "Allow",
		"Principal": "*",
		"Action": "s3:GetObject",
		"Resource": [
		"${assetsBucket.arn}/groups/*",
		"${assetsBucket.arn}/events/published/*"
		]
	}]
	}`,
});

const apiBuild = new command.local.Command("apiBuild", {
  dir: "../apps/api",
  create: "pnpm build",
  update: "pnpm build",
});

// API log group (must exist before Lambda; also used by Better Stack subscription filter)
const apiLogGroup = new aws.cloudwatch.LogGroup(
  "apiLogs",
  {
    logGroupClass: "STANDARD",
    name: "/aws/lambda/afterclass-api",
  },
  { protect: true },
);

// Lambda function
const api = new aws.lambda.Function(
  "api",
  {
    runtime: "nodejs22.x",
    handler: "index.handler", // Looks for index.cjs at root
    role: apiRole.arn,
    code: apiBuild.stdout.apply(
      () =>
        new pulumi.asset.AssetArchive({
          "index.cjs": new pulumi.asset.FileAsset("../apps/api/dist/index.cjs"),
          node_modules: new pulumi.asset.FileArchive("../apps/api/node_modules"),
        }),
    ),
    environment: {
      variables: {
        STAGE: stack,
        BUCKET_NAME: assetsBucket.bucket,
        SUPER_ADMIN_EMAILS: superAdminEmails,
        ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
        // Inject secrets directly as env vars (eliminates runtime SSM/KMS calls)
        ...secretValues,
      },
    },
    timeout: 30,
    memorySize: 512,
    loggingConfig: {
      logFormat: "JSON",
      logGroup: apiLogGroup.name,
    },
  },
  { dependsOn: [apiLogGroup] },
);

// Function URL (CORS handled by Hono middleware - do not add here or headers duplicate)
const functionUrl = new aws.lambda.FunctionUrl("api-url", {
  functionName: api.name,
  authorizationType: "NONE",
});

// // Custom domain: api.afterclass.rsvp
// // ACM certificate must be in us-east-1 for CloudFront
// const usEast1 = new aws.Provider("us-east-1", {
// 	region: "us-east-1",
// });

// const apiCert = new aws.acm.Certificate(
// 	"apiCert",
// 	{
// 		domainName: "api.afterclass.rsvp",
// 		validationMethod: "DNS",
// 	},
// 	{ provider: usEast1 },
// );

// // CloudFront distribution in front of Lambda Function URL
// const apiCdn = new aws.cloudfront.Distribution("apiCdn", {
// 	enabled: true,
// 	aliases: ["api.afterclass.rsvp"],
// 	origins: [
// 		{
// 			domainName: functionUrl.functionUrl.apply(
// 				(url) => new URL(url).hostname,
// 			),
// 			originId: "lambda-api",
// 			customOriginConfig: {
// 				httpPort: 80,
// 				httpsPort: 443,
// 				originProtocolPolicy: "https-only",
// 				originSslProtocols: ["TLSv1.2"],
// 			},
// 		},
// 	],
// 	defaultCacheBehavior: {
// 		targetOriginId: "lambda-api",
// 		viewerProtocolPolicy: "redirect-to-https",
// 		allowedMethods: [
// 			"GET",
// 			"HEAD",
// 			"OPTIONS",
// 			"PUT",
// 			"PATCH",
// 			"POST",
// 			"DELETE",
// 		],
// 		cachedMethods: ["GET", "HEAD"],
// 		// AWS managed policy: CachingDisabled
// 		cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
// 		// AWS managed policy: AllViewerExceptHostHeader
// 		// (Lambda Function URLs reject requests with a mismatched Host header)
// 		originRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",
// 	},
// 	viewerCertificate: {
// 		acmCertificateArn: apiCert.arn,
// 		sslSupportMethod: "sni-only",
// 		minimumProtocolVersion: "TLSv1.2_2021",
// 	},
// 	restrictions: {
// 		geoRestriction: { restrictionType: "none" },
// 	},
// });

// --- Push Notifications Worker Infrastructure ---
const pushQueue = new aws.sqs.Queue("pushNotificationsQueue", {
  name: `afterclass-${stack}-push-notifications`,
  // Must be >= Lambda timeout (60s). Use 6x for batch processing (batchSize: 10).
  visibilityTimeoutSeconds: 360,
});

const workerRole = new aws.iam.Role("pushWorkerRole", {
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Action: "sts:AssumeRole",
        Effect: "Allow",
        Principal: { Service: "lambda.amazonaws.com" },
      },
    ],
  }),
});

new aws.iam.RolePolicyAttachment("workerBasic", {
  role: workerRole.name,
  policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
});

new aws.iam.RolePolicy("workerSSM", {
  role: workerRole.name,
  policy: pulumi.interpolate`{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": ["ssm:GetParameter", "ssm:GetParameters"],
        "Resource": "arn:aws:ssm:*:*:parameter/afterclass/${stack}/*"
      }]
    }`,
});

new aws.iam.RolePolicy("workerSQS", {
  role: workerRole.name,
  policy: pulumi.all([pushQueue.arn]).apply(([queueArn]) =>
    JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Action: ["sqs:SendMessage"],
          Resource: queueArn,
        },
        {
          Effect: "Allow",
          Action: [
            "sqs:ReceiveMessage",
            "sqs:DeleteMessage",
            "sqs:GetQueueAttributes",
            "sqs:ChangeMessageVisibility",
          ],
          Resource: queueArn,
        },
      ],
    }),
  ),
});

const workerCode = apiBuild.stdout.apply(
  () =>
    new pulumi.asset.AssetArchive({
      "index.cjs": new pulumi.asset.FileAsset("../apps/api/dist/index.cjs"),
      node_modules: new pulumi.asset.FileArchive("../apps/api/node_modules"),
    }),
);

const pushPoller = new aws.lambda.Function("pushPoller", {
  runtime: "nodejs22.x",
  handler: "index.pollerHandler",
  role: workerRole.arn,
  code: workerCode,
  environment: {
    variables: {
      STAGE: stack,
      PUSH_NOTIFICATIONS_QUEUE_URL: pushQueue.url,
      ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
      // Inject secrets directly as env vars (eliminates runtime SSM/KMS calls)
      ...secretValues,
    },
  },
  timeout: 60,
  memorySize: 256,
});

const pushWorker = new aws.lambda.Function("pushWorker", {
  runtime: "nodejs22.x",
  handler: "index.pushWorkerHandler",
  role: workerRole.arn,
  code: workerCode,
  environment: {
    variables: {
      STAGE: stack,
      ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
      // Inject secrets directly as env vars (eliminates runtime SSM/KMS calls)
      ...secretValues,
    },
  },
  timeout: 60,
  memorySize: 256,
});

new aws.lambda.EventSourceMapping("pushWorkerSqsTrigger", {
  eventSourceArn: pushQueue.arn,
  functionName: pushWorker.name,
  batchSize: 10,
});

const pushPollerSchedule = new aws.cloudwatch.EventRule("pushPollerSchedule", {
  scheduleExpression: "rate(1 minute)",
});

new aws.cloudwatch.EventTarget("pushPollerTarget", {
  rule: pushPollerSchedule.name,
  targetId: "pushPoller",
  arn: pushPoller.arn,
});

new aws.lambda.Permission("pushPollerEventBridge", {
  action: "lambda:InvokeFunction",
  function: pushPoller.name,
  principal: "events.amazonaws.com",
  sourceArn: pushPollerSchedule.arn,
});

// --- Discovery Schedule Generator ---
// Runs once per week (Sunday 5 AM UTC ≈ midnight ET) to create 2 random
// notification slots per user for the upcoming week.
const scheduleGenerator = new aws.lambda.Function("scheduleGenerator", {
  runtime: "nodejs22.x",
  handler: "index.scheduleGeneratorHandler",
  role: workerRole.arn,
  code: workerCode,
  environment: {
    variables: {
      STAGE: stack,
      ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
      ...secretValues,
    },
  },
  timeout: 120, // may iterate over many users
  memorySize: 256,
});

const scheduleGeneratorRule = new aws.cloudwatch.EventRule("scheduleGeneratorSchedule", {
  scheduleExpression: "cron(0 5 ? * SUN *)", // Every Sunday at 5 AM UTC
});

new aws.cloudwatch.EventTarget("scheduleGeneratorTarget", {
  rule: scheduleGeneratorRule.name,
  targetId: "scheduleGenerator",
  arn: scheduleGenerator.arn,
});

new aws.lambda.Permission("scheduleGeneratorEventBridge", {
  action: "lambda:InvokeFunction",
  function: scheduleGenerator.name,
  principal: "events.amazonaws.com",
  sourceArn: scheduleGeneratorRule.arn,
});

export const apiUrl = functionUrl.functionUrl;
// export const apiDomainName = apiCdn.domainName;
// export const certValidation = apiCert.domainValidationOptions;
export const assetsBucketName = assetsBucket.id;
export const githubRoleArn = github.githubRoleArn;
