"""ECS entrypoint for the celery worker/beat containers.

These containers reuse the same image built for the Lambda API handler
(Dockerfile.lambda) rather than a second, separately-built image — the ECS
task definition overrides that image's ENTRYPOINT (awslambdaric, which
expects a Lambda handler path, not a shell command) to run this script
instead, which then execs the real command (celery worker / celery beat).

Mirrors lambda_handler.py's PEM-write trick: settings.GITHUB_APP_PRIVATE_KEY_PATH
only reads a PEM *file* from disk, but the container only carries the PEM
content as the GITHUB_APP_PRIVATE_KEY env var — write it to /tmp before the
real command (and therefore Django settings) loads.
"""

import os
import sys

_pem_content = os.environ.get('GITHUB_APP_PRIVATE_KEY')
if _pem_content:
    _pem_path = '/tmp/github-app.pem'
    with open(_pem_path, 'w') as f:
        f.write(_pem_content)
    os.environ['GITHUB_APP_PRIVATE_KEY_PATH'] = _pem_path

os.execvp(sys.argv[1], sys.argv[1:])
