import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const stack = pulumi.getStack();
const config = new pulumi.Config("afterclass");

export const databaseRuntimeUrl = new aws.ssm.Parameter("databaseRuntimeUrl", {
  name: `/afterclass/${stack}/database-runtime-url`,
  type: aws.ssm.ParameterType.SecureString,
  value: config.requireSecret("database-runtime-url"),
});

export const databaseOwnerUrl = new aws.ssm.Parameter("databaseOwnerUrl", {
  name: `/afterclass/${stack}/database-owner-url`,
  type: aws.ssm.ParameterType.SecureString,
  value: config.requireSecret("database-owner-url"),
});
