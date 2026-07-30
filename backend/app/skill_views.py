"""Serve the offline scan skill to users.

Step 1 asks the user to install ``/clyro-scan`` into their own coding agent, so
the skill has to be fetchable without an account — the whole point is that they
run it in their terminal before they have a Clyro project. Public and
unauthenticated by design; it's the same file that lives in this repo, and it
contains nothing user-specific.

Serving it from here rather than a CDN keeps one source of truth: the file the
wizard hands out is the file this backend was deployed with, so instructions and
schema can never drift apart across a release.
"""

from pathlib import Path

from django.conf import settings
from django.http import HttpResponse, JsonResponse

SKILLS_ROOT = Path(settings.BASE_DIR) / 'skills'

# Only these are servable. An allowlist rather than path composition — a name
# taken from the URL and joined onto a filesystem path is a traversal waiting to
# happen, and there is no reason for this endpoint to be general.
_SKILLS = {
    'clyro-scan': ('clyro-scan/SKILL.md', 'clyro-scan'),
}


def skill_detail(_request, name: str):
    """The raw SKILL.md text, so the Step 1 instructions can offer both a
    ``curl`` straight into ~/.claude/skills/ and a copy-paste for other agents."""
    entry = _SKILLS.get(name)
    if entry is None:
        return JsonResponse({'error': 'Unknown skill'}, status=404)

    relative, filename = entry
    path = SKILLS_ROOT / relative
    try:
        content = path.read_text(encoding='utf-8')
    except OSError:
        # Missing on disk means a packaging problem in this deploy, not a bad
        # request — say so rather than implying the skill doesn't exist.
        return JsonResponse({'error': 'Skill is not available in this deployment'}, status=503)

    response = HttpResponse(content, content_type='text/markdown; charset=utf-8')
    # Named so `curl -O` lands a usable SKILL.md, and cached briefly: it only
    # changes on deploy, but a stale skill for hours would be confusing.
    response['Content-Disposition'] = f'inline; filename="{filename}-SKILL.md"'
    response['Cache-Control'] = 'public, max-age=300'
    return response
