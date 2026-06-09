import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

const assetsBucket = new aws.s3.Bucket("assets", {
  bucket: `afterclass-dev-assets`,
});

new aws.s3.BucketPublicAccessBlock("assetsPublicAccessBlock", {
  bucket: assetsBucket.id,
  blockPublicAcls: true,
  ignorePublicAcls: true,
  blockPublicPolicy: false, // allow public bucket policy
  restrictPublicBuckets: false,
});

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

export const assetsBucketName = assetsBucket.id;
