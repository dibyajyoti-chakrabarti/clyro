import os

# settings.GITHUB_APP_PRIVATE_KEY_PATH only reads a PEM *file* from disk; the
# Lambda environment carries the PEM content as GITHUB_APP_PRIVATE_KEY, so we
# write it to /tmp (the only writable path in the Lambda runtime) before
# Django settings are imported.
_pem_content = os.environ.get('GITHUB_APP_PRIVATE_KEY')
if _pem_content:
    _pem_path = '/tmp/github-app.pem'
    with open(_pem_path, 'w') as f:
        f.write(_pem_content)
    os.environ['GITHUB_APP_PRIVATE_KEY_PATH'] = _pem_path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from mangum import Mangum  # noqa: E402

from config.asgi import application  # noqa: E402

handler = Mangum(application)
