# Chapter 2: System Architecture

Clyro's architecture is divided into the **Client Plane** and the **Control Plane**.

## Client Plane (Frontend)
- **Framework**: React 19 + Vite
- **Styling**: TailwindCSS 4
- **Routing**: React Router
- **Key Features**: Multi-step project creation wizard (Step 1-4), Monaco editor for IaC review, Live provisioning logs.

## Control Plane (Backend)
- **API**: Django REST Framework
- **Database**: PostgreSQL (managed by RDS in production)
- **Cache & Broker**: Redis (ElastiCache in production)
- **Async Workers**: Celery (runs long-running AI tasks like IaC generation and provisioning)
- **Auth**: AWS Cognito (Pre-Signup Lambda to auto-verify domains)

## AWS Integration
- Users authenticate via OAuth.
- To provision, Clyro assumes a cross-account role deployed in the user's AWS account via a bootstrap stack.
- Clyro creates an S3 Build Archive bucket, downloads the user's GitHub repository via a GitHub App token, and triggers a CodeBuild pipeline.
