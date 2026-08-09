import os

# The GitHub App PEM used to be written to /tmp here, from a plaintext
# GITHUB_APP_PRIVATE_KEY environment variable. Both halves of that moved:
# the key is now fetched from SSM at runtime instead of being baked into the
# function's environment, and the fetch + PEM write happen in
# config/aws_secrets.py, which settings.py calls before reading any setting.
# That covers every entrypoint at once rather than each one repeating it.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from mangum import Mangum  # noqa: E402

from config.asgi import application  # noqa: E402

handler = Mangum(application)
