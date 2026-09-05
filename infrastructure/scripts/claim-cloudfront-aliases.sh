#!/usr/bin/env bash
# Move clyro.cloud, www. and admin. onto this account's CloudFront
# distributions, from the abandoned account that still holds them.
#
# Why this is needed
# ------------------
# CloudFront enforces alternate domain names globally, across every AWS
# account. Those three names are still attached to distributions in account
# 321613317660, which nobody can log into any more, so CreateDistribution
# fails with CNAMEAlreadyExists.
#
# associate-alias solves exactly this. It proves control of the domain with a
# DNS TXT record rather than with credentials in the holding account, so an
# unreachable source account is not a blocker. The AWS documentation says an
# apex domain move across accounts needs Support; that is conditional on being
# unable to create the TXT record, and the zone is ours.
#
# Order matters
# -------------
#   1. terraform apply -var enable_cloudfront_aliases=false
#        A distribution cannot be created carrying a held alias, and it has to
#        exist before it can be the target of a move.
#   2. this script
#   3. terraform apply          (aliases back on, the default)
#        Do this immediately. An apply that still has the aliases gated off
#        resets the distribution's alias list to empty and silently undoes
#        everything below.
#
# Safe to re-run: a name already pointing at the right distribution is skipped.
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
LAYER="$(cd "$(dirname "$0")/../foundation" && pwd)"

need() { command -v "$1" >/dev/null || { echo "$1 is required" >&2; exit 1; }; }
need aws; need terraform; need dig; need python3

ZONE_ID="$(terraform -chdir="$LAYER" output -raw route53_zone_id)"

# The TXT record proving control is named after the alias, with the leftmost
# label prefixed by an underscore. The apex is the special case and the one
# that wastes people's time: it is "_." plus the domain, underscore AND period.
# Note that "_clyro.cloud" is NOT it. Route 53 rejects that outright, because
# it is a sibling of the zone rather than a name inside it, and the refusal
# reads like a policy limitation when it is really a typo.
txt_name() {
  local alias="$1" apex="$2"
  if [ "$alias" = "$apex" ]; then
    echo "_.${apex}"
  else
    echo "_${alias}"
  fi
}

change_txt() {
  local action="$1" name="$2" value="$3"
  aws route53 change-resource-record-sets \
    --hosted-zone-id "$ZONE_ID" \
    --change-batch "$(python3 -c '
import json,sys
action,name,value=sys.argv[1:4]
print(json.dumps({"Changes":[{"Action":action,"ResourceRecordSet":{
  "Name":name,"Type":"TXT","TTL":60,
  "ResourceRecords":[{"Value":f"\"{value}\""}]}}]}))' "$action" "$name" "$value")" \
    --query 'ChangeInfo.Id' --output text
}

claim() {
  local alias="$1" dist_id="$2" dist_domain="$3" apex="$4"

  # Already ours? associate-alias is idempotent but noisy; skip cleanly.
  local current
  current="$(aws cloudfront get-distribution --id "$dist_id" \
    --query "Distribution.DistributionConfig.Aliases.Items" --output text 2>/dev/null || true)"
  if printf '%s' "$current" | tr '\t' '\n' | grep -qx "$alias"; then
    echo "  $alias already attached to $dist_id"
    return
  fi

  # Who is holding it, if anyone? Purely diagnostic, and it needs the target
  # distribution to carry a certificate covering the name, which is another
  # reason the distribution must exist first.
  local holder
  holder="$(aws cloudfront list-conflicting-aliases --distribution-id "$dist_id" \
    --alias "$alias" --query 'ConflictingAliasesList.Items[0].AccountId' \
    --output text 2>/dev/null || echo "unknown")"
  echo "  $alias currently held by account: $holder"

  local record; record="$(txt_name "$alias" "$apex")"
  echo "  proving control via TXT $record -> $dist_domain"
  change_txt UPSERT "$record" "$dist_domain" >/dev/null

  # Wait for it to actually resolve. Calling associate-alias against a change
  # that is still PENDING fails with "Invalid or missing alias DNS TXT records",
  # which looks like a permissions problem and is not.
  local ns; ns="$(dig +short NS "$apex" | head -1)"
  for _ in $(seq 1 30); do
    if dig +short TXT "$record" "@${ns:-8.8.8.8}" | grep -q "$dist_domain"; then
      break
    fi
    sleep 5
  done

  aws cloudfront associate-alias --alias "$alias" --target-distribution-id "$dist_id"
  echo "  claimed $alias"

  # The proof is not needed once the association exists; it is permanent.
  change_txt DELETE "$record" "$dist_domain" >/dev/null
}

# Read the whole plan out of Terraform once, as tab-separated lines of
# "distribution-id  distribution-domain  alias", so the shell never has to
# parse JSON itself.
read_targets() {
  terraform -chdir="$LAYER" output -json > "$TMP_JSON"
  python3 - "$TMP_JSON" <<'PYEOF'
import json, sys
data = json.load(open(sys.argv[1]))
for key in ("frontend", "frontend_admin"):
    block = data[key]["value"]
    for alias in block["aliases"]:
        print("\t".join([block["distribution_id"], block["cloudfront"], alias]))
PYEOF
}

TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

APEX=""
while IFS=$'\t' read -r dist_id dist_domain alias; do
  [ -z "$APEX" ] && APEX="$alias"   # first alias emitted is the apex
  echo "== $alias =="
  claim "$alias" "$dist_id" "$dist_domain" "$APEX"
done < <(read_targets)

echo
echo "Done. Now run, immediately:"
echo "  terraform -chdir=infrastructure/foundation apply"
echo "so Terraform owns the aliases again. Leaving them gated off resets them."
