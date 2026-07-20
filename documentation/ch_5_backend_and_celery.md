# Chapter 5: Backend, Celery & Agents

The Django backend handles API requests, database interactions, and AWS authentication.

## Celery Tasks
Long-running AI generation cannot block an HTTP request.
- When the frontend asks to generate IaC, the Django view queues a Celery task.
- The task continuously updates a `ProvisioningLogEntry` table.
- The frontend polls the backend to stream these logs to the UI.

## AI Agents
- **CryloCanvas**: An LLM agent that chats with the user to refine the architecture spec.
- **CryloIac**: Historically an agent that wrote IaC, now largely superseded by the deterministic `cfn_generator` which guarantees valid AWS syntax.
