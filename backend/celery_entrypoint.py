"""ECS entrypoint for the celery worker/beat containers.

These containers reuse the same image built for the Lambda API handler
(Dockerfile.lambda) rather than a second, separately-built image — the ECS
task definition overrides that image's ENTRYPOINT (awslambdaric, which
expects a Lambda handler path, not a shell command) to run this script
instead, which then execs the real command (celery worker / celery beat).

This used to also write the GitHub App PEM to /tmp from a plaintext
GITHUB_APP_PRIVATE_KEY env var, mirroring lambda_handler.py. Both copies are
gone: the key is fetched from SSM at runtime by config/aws_secrets.py, which
settings.py calls on the way in — so the exec'd celery process picks it up
itself and there is nothing to prepare here.
"""

import os
import sys

os.execvp(sys.argv[1], sys.argv[1:])
