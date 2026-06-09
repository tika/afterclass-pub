import * as pulumi from "@pulumi/pulumi";

const stack = pulumi.getStack();

if (stack === "prod") {
  require("./prod");
} else {
  require("./dev");
}
