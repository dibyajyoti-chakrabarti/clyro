# Chapter 1: Introduction

Clyro is an AI-powered cloud infrastructure provisioning tool. It allows users to connect their GitHub repositories, chat with an AI (CryloCanvas) to define their architecture, and then automatically generate and deploy a deterministic CloudFormation template to their AWS account.

## Core Tenets

1. **Deterministic CloudFormation**: LLMs are great for planning (the spec), but terrible at writing exact CFN syntax. Clyro uses a deterministic Python generator (`cfn_generator.py`) to author the final template based on the AI-generated JSON spec.
2. **Infrastructure as Code**: The platform itself is deployed via two-layer Terraform (`foundation` and `workloads`).
3. **Async Everything**: LLM generation takes minutes. Clyro handles this gracefully via Celery workers, tracking status through `IntentRecord` and `ProvisioningLogEntry` models.

