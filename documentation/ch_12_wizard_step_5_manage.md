# Chapter 12: Wizard Step 7, Your infrastructure is live

> **Filename note.** This file is `ch_12_wizard_step_5_manage.md` because the dashboard
> was Step 5 under the old five-step wizard. It is **Step 7** now. The filename is kept
> so existing links keep working.
>
> Rewritten 2026-09-06 against the code. The previous version was a target design with a
> partial-implementation note bolted on top, and the gap between the two had widened to
> the point where the design was being read as the product. This chapter documents what
> is live. Anything not built is listed at the end, in one place, so it cannot be mistaken
> for behaviour.

Step 7 is the operational home for a deployed project. It reads the user's AWS account
through the same assumed role established at Step 2, translates what it finds into plain
English, and refreshes on a poll. It is read-only: there are no lifecycle controls on
this screen.

The page polls every 20 seconds, through a 15 second client cache that matches a 15
second server cache.

## 12.1: What is live, panel by panel

| Panel | Backed by |
| --- | --- |
| Health overview | Live. ECS running and desired task counts, plus ALB target health |
| Key metrics and sparklines | Live. CloudWatch `GetMetricData` |
| Uptime and downtime timeline | Live. `HealthSnapshot` rows collected by a scheduled task |
| Alerts | Live. Derived fresh on every poll |
| Alarms and notifications | Live. Real CloudWatch alarm states, 30 day history, SNS subscription status |
| Logs | Live. CloudWatch for the last hour, S3 archive beyond that |
| Stack status | Live. Rendered as the footer of the logs card |
| **Cost** | **Placeholder.** See 12.5 |

## 12.2: Health

`deploy.health()` returns the stack status, a list of health items, a metrics dictionary,
their series, alerts, warnings, and the stack's name, status and last-updated time. Every
value is a live AWS call under the assumed role.

**Stack-gone detection.** If the stack cannot be described, or has no ECS services, the
endpoint returns `stack_status: "not_found"` rather than raising, and the UI says the
infrastructure could not be found and may have been deleted outside Clyro. Before this
existed the page hung on a waiting state forever.

**Per service**, `describe_ecs_service` gives running and desired counts. The backend
calls a service healthy when `desired == 0` or `running >= desired`, and `scaling`
otherwise.

> Two consequences of that mapping are worth knowing. The frontend collapses anything
> that is not `healthy` into "Degraded", which makes the `unhealthy` icon branch
> unreachable. And a **paused project reports healthy**, because its desired count is
> zero.

Each unhealthy ALB target produces a `critical` alert.

**Metrics** come from a single `GetMetricData` call with up to four queries, all for the
one service that has a load balancer attached: `TargetResponseTime` (average),
`RequestCount` (sum), `HTTPCode_Target_5XX_Count` (sum) and ECS `CPUUtilization`
(average). Response time is converted to milliseconds, the request rate is the sum
divided by 5 because the periods are five minutes, and the error rate is 5xx over
requests. Each headline number is simply the last point of its series.

**Warnings** are IAM gaps, not application problems. A connector role created before
`cloudwatch:GetMetricData` was added to `bootstrap.yaml` produces a warning and empty
metrics rather than an error, and the same pattern covers `logs:FilterLogEvents` and the
alarm reads. Accounts on an older bootstrap role need to re-run the CloudFormation
quick-create to get real metrics. They render as a dismissible amber banner.

## 12.3: Uptime, logs and the scheduled tasks

Two of the three scheduled Celery tasks feed this page. Both iterate **only** projects
whose status is `live`, so a paused or failed project records no uptime and archives no
logs.

**`run_health_snapshot_task`, every 60 seconds.** Calls `health()` for every live project
and writes a `HealthSnapshot`. A snapshot counts as healthy only if the stack is ok, there
is at least one item, and every item is healthy. Rows older than seven days are pruned.

This is the only source for the uptime figures. `monitoring.history` computes 24 hour and
7 day uptime, which are null until snapshots exist, and a 48 bucket, 30 minute strip where
a bucket is down if any snapshot in it was unhealthy and empty if the collector was not
running. A brand-new deployment therefore shows no uptime and "no history yet", and that
is correct rather than broken.

**`run_log_archive_task`, every 5 minutes.** Copies each live service's CloudWatch events
into the generated stack's log archive bucket as five-minute JSONL objects, keyed by
service, date and time slot. Keys are idempotent, the last three slots are re-checked, and
slots newer than a five-minute settle window are skipped.

That archive is what backs every log range except the last hour. "1h" reads CloudWatch
live; 6h, 24h and 7d read S3 and can honestly report themselves truncated. A stack
provisioned before the archive bucket existed gets a warning instead of history.

**`run_reconcile_sweep_task`, every 15 minutes**, contributes nothing to this page. It
marks dead account connections unreachable, rate-limited to one recheck every ten minutes,
and resolves deployments stuck in `deleting`, finishing an interrupted project delete if
it finds one.

## 12.4: Alerts and alarms are different things

This distinction matters and the UI does not make it obvious.

**Alerts** are computed fresh on every 20 second poll from the current ECS and ALB state.
They are never persisted, they vanish when the condition clears, and they notify nobody.
Their `fired_at` is the time the poll noticed them, not the time the condition started.

**Alarms** are real CloudWatch alarms provisioned into the stack, with an SNS email
subscription. They fire whether or not anybody has the page open. Stacks provisioned
before alarms were generated report `configured: false`, and the UI says alarms will
appear on the next provision.

## 12.5: Cost is not wired up

The cost card renders three tiles, "this month so far", "projected" and "last month", and
all three are empty states. There is no data source behind them. A repository-wide search
finds no Cost Explorer client, no `GetCostAndUsage` call, and no `ce:` permission anywhere
in the backend.

The Step 4 canvas cost panel is a genuine estimate from `canvas_core/cost_engine.py`, but
that is an estimate of what a stack should cost, not a reading of what it did cost. Do not
write copy implying Step 7 shows spend.

## 12.6: Lifecycle operations

None of these are on the Step 7 screen. They are surfaced from the Step 6 success and
failure screens, and from the manage modal on the dashboard and projects list.

| Operation | What it does |
| --- | --- |
| **Pause** | Scales every ECS service in the stack to 0, stops the Aurora cluster or the standalone RDS instance, and records the prior counts. The CloudFormation stack is untouched. |
| **Resume** | Restores each service's saved count and starts the database back up. |
| **Teardown** | Empties every S3 bucket and ECR repository in the stack first, because CloudFormation cannot delete a non-empty one, then deletes the stack. The status moves to `deleting`, and the poll completes the transition to `deleted` when the stack starts returning 404. This is what the "Delete infrastructure" button calls. |
| **Destroy** | The full purge, used only when the whole project is deleted: the application stack, then the Secrets Manager secrets, then the `ClyroBootstrap` connector stack last. The secret purge sits in a `finally`, because a failed teardown used to strand paid secrets behind. Not offered as a button anywhere. |
| **Recreate** | Teardown, wait for deletion, reapply the enforcers, provision again. Hard-gated to projects that have never been live, in the view and in the function. Offered only on the Step 6 failure screen. |

> **"Delete infrastructure" is teardown, not destroy.** Teardown removes the stack.
> Destroy also removes the secrets and the connector stack, and only runs when the project
> row itself is deleted.

### Deleting a project

`DELETE /api/projects/<pk>/`. If the project has real AWS resources, the first call starts
the teardown and returns `202 {"status": "tearing_down"}`; the client retries the delete
once teardown finishes, which is the same poll-and-retry convention used by pause, resume
and teardown. Once there is nothing live left, the row and its deployments are hard
deleted.

This exists because failed and abandoned test projects previously had no removal path and
accumulated on the dashboard forever. It is a manual action. The reconcile sweep will
finish an interrupted delete, but nothing periodically checks a project's status against
real AWS state, so a stack torn down outside Clyro still shows as live until somebody
opens this step, which at least now says the infrastructure could not be found.

## 12.7: Not built

Listed here rather than scattered through the chapter, so nothing above can be mistaken
for a plan and nothing here can be mistaken for behaviour.

- Cost Explorer integration and real spend data
- A resource detail panel behind each health row
- Alert severity levels and an alarm translation table
- One-click remediation, restarting a task from the dashboard
- Continuous deployment. The build runs exactly once per provision. There is no push
  webhook and no rebuild on canvas change, and "Retry build" re-downloads the same ref.
  The success screen's "set up your CI/CD pipeline" next step is honest advice, not a
  feature.
- Canvas live status overlay
- Custom alert thresholds
- Cost anomaly detection
- Infrastructure drift detection
- Periodic reconciliation of `Project.status` against real AWS state

One more caveat on the UI: the timings shown during provisioning and review, "~10-15 min",
"8 to 12 minutes", "2 to 5 minutes", are hardcoded estimates and are not computed from
anything.
