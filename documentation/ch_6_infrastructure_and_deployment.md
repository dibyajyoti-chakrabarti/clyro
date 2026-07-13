# Chapter 6: Infrastructure & Deployment

Clyro is deployed to AWS via Terraform, located in `infrastructure/`.

## Two-Layer Architecture
1. **Foundation (`infrastructure/foundation`)**:
   - VPC, Subnets, NAT Gateways
   - ECR Repositories
   - This state changes rarely.
2. **Workloads (`infrastructure/workloads`)**:
   - ECS Fargate Services (Backend, Celery Worker, Frontend Nginx)
   - RDS PostgreSQL Database
   - ElastiCache Redis
   - Cognito User Pools

## Deployment
CI/CD or manual scripts apply these Terraform modules. The workloads state reads outputs from the foundation state using `data "terraform_remote_state"`.
