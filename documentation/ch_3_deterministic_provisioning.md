# Chapter 3: Deterministic Provisioning

In earlier iterations, Clyro asked an LLM to write the final CloudFormation template directly. This proved unreliable, leading to syntax errors and security policy misconfigurations.

## The Spec Approach
Now, the AI generates a simplified JSON architecture `spec` (see `app.tests` for examples).

## cfn_generator.py
This module takes the JSON spec and outputs a strictly valid, deterministic CloudFormation YAML.
- **Networking**: `_add_networking` creates VPCs, Subnets, IGWs, NATs.
- **Compute**: `_add_ecs` creates Fargate Task Definitions and Services.
- **Pipelines**: `codebuild_spec.py` generates AWS CodeBuild projects and IAM roles to fetch the code from an S3 archive bucket and build/push it to ECR or CloudFront.

## Deployment Execution
The `deploy.py` module takes the generated CFN and calls `boto3` to submit a `CreateStack` or `UpdateStack` request to the user's AWS account.
