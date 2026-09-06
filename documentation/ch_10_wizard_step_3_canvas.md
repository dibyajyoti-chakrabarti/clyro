# Chapter 10: Wizard Step 4, Review your architecture

> **Filename note.** This file is `ch_10_wizard_step_3_canvas.md` because the canvas was
> Step 3 under the old five-step wizard. It is **Step 4** now. The filename is kept so
> existing links keep working.
>
> Rewritten 2026-09-06 against the code. The previous version was a design document
> written before the deterministic layer existed, and it attributed to the agent a
> quantity of work the agent does not do.

Step 4 is the interactive architecture canvas. It takes the canvas built from the
contract and the intent record, renders it as an editable diagram, and lets the user
change it in conversation. When they finalise it, the result is the input to IaC
generation at Step 5.

## The division of labour, which is the point of this step

The agent is the only LLM here, and it does exactly one thing: it turns a sentence into
**one bounded operation**, or into an answer. It does not place nodes, it does not
compute costs, it does not decide what is legal, and it does not write YAML.

Everything else is `backend/canvas_core/`, pure Python with no Django and no AWS
dependency. That constraint is deliberate: it lets the AgentCore runtimes vendor a copy
of the package into their deployment bundles, so the cost math, the bounded operations,
the layout and the hard constraints cannot drift between the agent and the backend. The
`deploy-agents.yml` workflow has an explicit step to vendor `canvas_core` into the
runtime bundle for exactly this reason.

| Module | Owns |
| --- | --- |
| `canvas_builder.py` | Building the initial canvas from the contract and the intent record |
| `canvas_ops.py` | Parsing and serialising `canvas.yml`, applying the five bounded operations, building versions |
| `constraints.py` | The allowed node types, the allowed `aws_service` per type, and the hard constraints |
| `layout_solver.py` | Collision-free node placement and arrow routing |
| `cost_engine.py` | Deterministic monthly cost |
| `types.py` | The shared shapes |

## Inputs

| Input | Source |
| --- | --- |
| The canvas | Built by `canvas_builder` from the Step 1 contract and the Step 3 intent record |
| Intent record | Step 3. Drives sizing and therefore cost |
| Detected resources | Step 1. Agent context only |

Where the intent record does not carry a choice, the builder defaults it:
`rds_postgres` for the database, `ecs_fargate` for the backend and the worker. Those are
defaults the user can change here, which is why Step 3 stopped asking for them.

## The operation set

Five operations, and only five. They are named in `constraints.OPERATIONS`:

`ADD_NODE`, `REMOVE_NODE`, `UPDATE_NODE`, `ADD_CONNECTION`, `REMOVE_CONNECTION`.

The agent proposes one, the user confirms, and the backend applies it through
`canvas_ops.apply_operation`, which checks the constraints **first** and raises rather
than applying anything that violates them. The agent's proposal is not trusted; it is
validated. `POST` to the canvas endpoint carries either a `prompt` (a new turn) or
`confirm` plus the `pending_operation` (applying the previous proposal), never both.

An operation that is not a mutation is an answer. The agent classifies every user turn
into exactly one outcome, a mutation intent or an answer, never both, and a proposed
mutation always waits for confirmation.

## The hard constraints

Enforced in `constraints.check_operation`, not in the prompt. A model that ignores its
instructions still cannot get past these.

**Node types are a closed set**: `service`, `static`, `database`, `cache`, `worker`,
`queue`, `storage`.

**The `aws_service` for each type is a closed set:**

| Node type | Allowed | Fixed? |
| --- | --- | --- |
| `service` | `ecs_fargate`, `ecs_ec2`, `ec2` | user choice |
| `worker` | `ecs_fargate`, `ecs_ec2`, `ec2` | user choice |
| `database` | `rds_postgres`, `aurora_postgres` | user choice |
| `static` | `s3_cloudfront` | fixed |
| `cache` | `elasticache` | fixed |
| `queue` | `sqs` | fixed |
| `storage` | `s3` | fixed |

**Networking is never on the canvas.** ALBs, VPCs, subnets, security groups, API
gateways, NAT and internet gateways are all rejected by keyword. They are derived from
the connection graph when the template is generated, because a user placing a security
group by hand is a user who can place it wrongly.

**The backend node cannot be removed.** Every Clyro project has one.

**Containerisation is not negotiable.** `image: ecr` on service and worker nodes cannot
be changed.

The agent also cannot trigger IaC generation. That is Step 5, and only the finalise
action gets there.

## Cost

The cost panel is always visible and is **not AI-generated**. `cost_engine.estimate_cost`
computes it from the canvas, the intent record and the connected AWS account, using a
fixed calculation over an injectable price book. The reasoning agent fills that book with
live prices from the pricing MCP Lambda; when it cannot, a calibrated
`DEFAULT_PRICE_BOOK` is the fallback, and the panel is honest about which it used.

The region matters and is taken from the AWS connection rather than defaulted. An earlier
version defaulted the override to us-east-1 and then printed "us-east-1 pricing" under a
panel for a stack being built somewhere else.

Re-pricing an unchanged canvas updates the existing version in place rather than cutting
a new one. A price is a property of the moment it was quoted, not an edit the user made,
and putting it in the version history would fill that history with changes nobody made.

## Versioning and finalise

Every confirmed mutation writes a new `CanvasVersion` carrying the operation, the node it
changed, the previous value, the new value and a snapshot. Reverting creates a new
version rather than deleting history.

Finalise (`POST` to the canvas finalise endpoint,
`backend/app/canvas/views.py::canvas_finalize`) snapshots the current canvas and marks it
finalised, which is what moves the project to `canvas_finalized` and unlocks Step 5.
Reopening creates a new draft that must be finalised again; Step 5 always reads the most
recently finalised version.

## What Step 4 does not do

- Does not connect to AWS. No AWS API call is made from this step, other than the
  pricing lookup the agent performs through its MCP tool.
- Does not generate CloudFormation. That is Step 5.
- Does not modify the intent record or the contract.
- Does not place networking resources.
- Does not let the agent write YAML directly. Every change goes through a bounded
  operation and is re-validated on the backend.

## Step 4 outputs

| Output | Location | Consumer |
| --- | --- | --- |
| Finalised canvas | `CanvasVersion` (JSONB, versioned) | Step 5, via `build_spec` |
| Version history | `CanvasVersion` | Audit and revert |
| Cost estimate | On the version row | The panel, and the Step 6 review screen |

> **Stale comment in the code (2026-09-06).** `backend/canvas_core/README.md` still calls
> this "Crylo Step 3 (Canvas)", points at `backend/canvas/` where the app is
> `backend/app/canvas/`, lists an `examples.py` module that is not in the package, and
> attributes the price book to the awslabs Pricing MCP rather than Clyro's own
> `clyro-mcp-pricing` Lambda. The description of what each module owns is still correct.
