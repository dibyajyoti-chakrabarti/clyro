import logging

from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_check(_request):
    """Deep health check used by the frontend to detect the "backend sleeping"
    state (RDS/NAT stopped via the nightly infra-stop workflow).

    A trivial 200 here is misleading: the Lambda still answers even when RDS
    is stopped, so a shallow check makes the frontend think the backend is
    healthy and skip the ServerDown page. Verifying DB connectivity makes the
    check reflect actual usability — returning 503 when the database is
    unreachable.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
    except Exception as exc:  # OperationalError, connect timeout, DNS, etc.
        logger.warning('health check failed: database unreachable: %s', exc)
        return JsonResponse({'status': 'unavailable', 'database': 'down'}, status=503)
    return JsonResponse({'status': 'ok'}, status=200)
