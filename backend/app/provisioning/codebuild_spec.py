"""Deterministic CFN fragment generator for the build step that actually gets
customer code into the infrastructure IacArchitect generates.

Not LLM-authored, on purpose: mirrors the `enforce_*()` correctors in `iac.py`
(`enforce_elasticache_deletion_policy`, `enforce_rds_deletion_policy`,
`enforce_log_group_naming`, `enforce_sg_description_charset`) — trusting the
LLM alone to get a recurring structural requirement right has repeatedly
failed live-testing this session, and a working build pipeline is exactly
that kind of requirement. IacArchitect's prompt is not changed; this module's
output is spliced into the generated template by `iac.enforce_codebuild_projects`.

Pure Python, no Django import, matching `build_spec.py`'s style — the only
external input is `spec` (this module's own build_spec dict) plus the
CloudFront distribution's logical ID (which IS LLM-chosen and must be
extracted from the template text by the caller, since it isn't deterministic
the way ECR image URIs and S3 bucket names are).

Naming prefixes are interpolated as literal strings from
``spec['naming_prefix']``/``spec['iam_scoped_prefix']``, NOT as
``${NamingPrefix}``/``${IamScopedPrefix}`` CFN parameter substitutions. Found
live: IacArchitect doesn't always declare those as actual CFN `Parameters:` —
one real generation inlined literal values everywhere instead (a valid,
LLM-chosen authoring style IacArchitect's prompt doesn't forbid), which broke
every `${NamingPrefix}`/`${IamScopedPrefix}` reference in the injected
CodeBuild blocks with cfn-lint's E1019 ("not one of [known logical ids]") —
there was no such parameter to resolve. `build_spec()` already computes the
real prefix values as plain Python strings; using them directly here removes
the dependency on how IacArchitect chose to declare (or not declare) them as
CFN parameters. Only genuine AWS pseudo-parameters (`${AWS::AccountId}`,
`${AWS::Region}`) are kept as `!Sub` substitutions, since those always exist
regardless of authoring style. The CloudFront distribution's and the frontend
bucket's logical IDs are the pieces that are still genuinely unpredictable and
must be passed in by the caller.

The frontend bucket used to be reconstructed here as
``{iam_scoped_prefix}-{node_id}-{account}``. Found live: IacArchitect actually
named it ``${IamScopedPrefix}-${AWS::AccountId}`` (no node-id segment), so the
CodeBuild project synced to a bucket that did not exist and its IAM policy
scoped to the wrong ARN — `aws s3 sync` exited 1 and the site never deployed.
Bucket *names* are LLM-chosen, so reference the bucket by logical ID via
``!Ref``/``!GetAtt`` instead of guessing what it was called.

Also found live, and worth writing down because it is the opposite of what is
commonly assumed: CodeBuild **does** carry the working directory across phases.
A `cd` in `build` is still in effect in `post_build`. Paths that must survive a
phase boundary are therefore anchored on ``$CODEBUILD_SRC_DIR``, which is correct
either way, rather than on a repeated `cd` or a bare relative path.
"""

from __future__ import annotations

import re
from typing import Any

_BUILD_IMAGE = "aws/codebuild/standard:7.0"
_OUTPUTS_SECTION_RE = re.compile(r"^Outputs:", re.M)


def _pascal(node_id: str) -> str:
    return "".join(part.capitalize() for part in node_id.replace("-", "_").split("_"))


def _role_id(node_id: str) -> str:
    return f"{_pascal(node_id)}CodeBuildRole"


def _project_id(node_id: str) -> str:
    return f"{_pascal(node_id)}CodeBuildProject"


def _ecr_uri(node_id: str, naming_prefix: str) -> str:
    return f"${{AWS::AccountId}}.dkr.ecr.${{AWS::Region}}.amazonaws.com/{naming_prefix}-{node_id}"


def _docker_buildspec(build_path: str, ecr_uri: str) -> str:
    return (
        "version: 0.2\n"
        "phases:\n"
        "  pre_build:\n"
        "    commands:\n"
        "      - aws ecr get-login-password --region $AWS_DEFAULT_REGION | "
        f"docker login --username AWS --password-stdin {ecr_uri}\n"
        "  build:\n"
        "    commands:\n"
        f"      - cd {build_path}\n"
        f"      - docker build -t {ecr_uri}:latest .\n"
        "  post_build:\n"
        "    commands:\n"
        f"      - docker push {ecr_uri}:latest\n"
    )


def _abs_build_dir(build_path: str) -> str:
    """`./frontend` -> `$CODEBUILD_SRC_DIR/frontend`; `.` -> `$CODEBUILD_SRC_DIR`."""
    rel = build_path[2:] if build_path.startswith("./") else build_path
    rel = rel.strip("/")
    return "$CODEBUILD_SRC_DIR" if rel in ("", ".") else f"$CODEBUILD_SRC_DIR/{rel}"


def _frontend_buildspec(build_path: str) -> str:
    # No detection for the bundler's actual output directory today — dist
    # (Vite) and build (CRA) cover the overwhelming majority of React/Vue
    # scaffolds; fall back between them rather than hardcoding one.
    #
    # OUT_DIR is absolute rather than relative, so it resolves correctly no matter
    # what the working directory is when post_build starts. Found live: CodeBuild
    # *does* carry the working directory across phases — a `cd {build_path}` repeated
    # in post_build failed with "can't cd to ./frontend" because `build` had already
    # left us inside it. Anchoring on $CODEBUILD_SRC_DIR depends on neither behaviour.
    out_dir = _abs_build_dir(build_path)
    return (
        "version: 0.2\n"
        "phases:\n"
        "  install:\n"
        "    commands:\n"
        "      - n 20\n"
        "  build:\n"
        "    commands:\n"
        f"      - cd {build_path}\n"
        "      - npm ci\n"
        "      - npm run build\n"
        "  post_build:\n"
        "    commands:\n"
        f"      - OUT_DIR=\"{out_dir}/dist\"; [ -d \"$OUT_DIR\" ] || "
        f"OUT_DIR=\"{out_dir}/build\"\n"
        "      - aws s3 sync \"$OUT_DIR\" s3://$BUCKET_NAME --delete\n"
        "      - aws cloudfront create-invalidation --distribution-id "
        "$DISTRIBUTION_ID --paths \"/*\"\n"
    )


def _indent_buildspec(buildspec: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(pad + line if line else line for line in buildspec.splitlines())


def _docker_project_block(node_id: str, build_path: str, naming_prefix: str, iam_scoped_prefix: str) -> str:
    role_id = _role_id(node_id)
    project_id = _project_id(node_id)
    ecr_uri = _ecr_uri(node_id, naming_prefix)
    ecr_repo_arn = f"${{AWS::AccountId}}:repository/{naming_prefix}-{node_id}"
    buildspec = _indent_buildspec(_docker_buildspec(build_path, ecr_uri), 10)
    return f"""  {role_id}:
    Type: AWS::IAM::Role
    Properties:
      RoleName: {iam_scoped_prefix}-{node_id}-codebuild
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: codebuild.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: build-and-push
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - ecr:GetAuthorizationToken
                Resource: '*'
              - Effect: Allow
                Action:
                  - ecr:BatchCheckLayerAvailability
                  - ecr:InitiateLayerUpload
                  - ecr:UploadLayerPart
                  - ecr:CompleteLayerUpload
                  - ecr:PutImage
                  - ecr:BatchGetImage
                Resource: !Sub 'arn:aws:ecr:${{AWS::Region}}:{ecr_repo_arn}'
              - Effect: Allow
                # Found live: CodeBuild's own service role needs this to pull
                # its own source archive — CodeBuild downloads it directly
                # with this role's credentials, not Clyro's assumed role.
                Action:
                  - s3:GetObject
                Resource: !Sub 'arn:aws:s3:::{iam_scoped_prefix}-build-archive-${{AWS::AccountId}}/*'
              - Effect: Allow
                Action:
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                Resource: !Sub 'arn:aws:logs:${{AWS::Region}}:${{AWS::AccountId}}:log-group:/aws/codebuild/{iam_scoped_prefix}-{node_id}-build*'
  {project_id}:
    Type: AWS::CodeBuild::Project
    Properties:
      Name: {iam_scoped_prefix}-{node_id}-build
      ServiceRole: !GetAtt {role_id}.Arn
      Artifacts:
        Type: NO_ARTIFACTS
      Environment:
        Type: LINUX_CONTAINER
        ComputeType: BUILD_GENERAL1_SMALL
        Image: {_BUILD_IMAGE}
        PrivilegedMode: true
      Source:
        Type: S3
        Location: !Sub '${{BuildArchiveBucket}}/placeholder.zip'
        BuildSpec: !Sub |
{buildspec}
      TimeoutInMinutes: 30
"""


def _frontend_project_block(node_id: str, build_path: str, iam_scoped_prefix: str,
                            bucket_logical_id: str) -> str:
    role_id = _role_id(node_id)
    project_id = _project_id(node_id)
    buildspec = _indent_buildspec(_frontend_buildspec(build_path), 10)
    return f"""  {role_id}:
    Type: AWS::IAM::Role
    Properties:
      RoleName: {iam_scoped_prefix}-{node_id}-codebuild
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: codebuild.amazonaws.com
            Action: sts:AssumeRole
      Policies:
        - PolicyName: build-and-publish
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - s3:PutObject
                  - s3:GetObject
                  - s3:ListBucket
                  - s3:DeleteObject
                Resource:
                  - !GetAtt {bucket_logical_id}.Arn
                  - !Sub '${{{bucket_logical_id}.Arn}}/*'
              - Effect: Allow
                Action:
                  - cloudfront:CreateInvalidation
                Resource: !Sub 'arn:aws:cloudfront::${{AWS::AccountId}}:distribution/${{__CFDIST__}}'
              - Effect: Allow
                # Found live: CodeBuild's own service role needs this to pull
                # its own source archive — CodeBuild downloads it directly
                # with this role's credentials, not Clyro's assumed role.
                Action:
                  - s3:GetObject
                Resource: !Sub 'arn:aws:s3:::{iam_scoped_prefix}-build-archive-${{AWS::AccountId}}/*'
              - Effect: Allow
                Action:
                  - logs:CreateLogGroup
                  - logs:CreateLogStream
                  - logs:PutLogEvents
                Resource: !Sub 'arn:aws:logs:${{AWS::Region}}:${{AWS::AccountId}}:log-group:/aws/codebuild/{iam_scoped_prefix}-{node_id}-build*'
  {project_id}:
    Type: AWS::CodeBuild::Project
    Properties:
      Name: {iam_scoped_prefix}-{node_id}-build
      ServiceRole: !GetAtt {role_id}.Arn
      Artifacts:
        Type: NO_ARTIFACTS
      Environment:
        Type: LINUX_CONTAINER
        ComputeType: BUILD_GENERAL1_MEDIUM
        Image: {_BUILD_IMAGE}
        EnvironmentVariables:
          - Name: BUCKET_NAME
            Value: !Ref {bucket_logical_id}
          - Name: DISTRIBUTION_ID
            Value: !Ref __CFDIST__
      Source:
        Type: S3
        Location: !Sub '${{BuildArchiveBucket}}/placeholder.zip'
        BuildSpec: !Sub |
{buildspec}
      TimeoutInMinutes: 15
"""


def generate_codebuild_resources(spec: dict[str, Any], cloudfront_logical_id: str | None,
                                 frontend_bucket_logical_id: str | None = None) -> str:
    """Return a YAML fragment (2-space-indented top-level Resources entries) with
    one AWS::CodeBuild::Project + AWS::IAM::Role per buildable node in
    ``spec['resources']``. Worker nodes that share the backend's build_path
    (the common case — see canvas_builder.py) are skipped: the backend's
    project already pushes the one shared image. Returns "" if there is
    nothing to build (defensive; every real spec has at least a backend).

    Both the CloudFront distribution's and the frontend bucket's logical IDs are
    LLM-chosen and must be passed in by the caller."""
    resources = spec.get("resources") or []
    naming_prefix = spec.get("naming_prefix", "app")
    iam_scoped_prefix = spec.get("iam_scoped_prefix", f"clyro-{naming_prefix}")
    blocks: list[str] = []
    seen_docker_paths: set[str] = set()

    for entry in resources:
        node_type = entry.get("type")
        build_path = entry.get("build_path")
        if not build_path:
            continue
        if node_type in ("service", "worker") and entry.get("image") == "ecr":
            if build_path in seen_docker_paths:
                continue  # worker reusing the backend's image — one build covers both
            seen_docker_paths.add(build_path)
            blocks.append(_docker_project_block(entry["node_id"], build_path, naming_prefix, iam_scoped_prefix))
        elif node_type == "static":
            if not cloudfront_logical_id or not frontend_bucket_logical_id:
                # No CloudFront::Distribution / origin bucket found in the template to
                # reference — skip rather than emit a broken !Ref/Sub to a placeholder.
                continue
            block = _frontend_project_block(entry["node_id"], build_path, iam_scoped_prefix,
                                            frontend_bucket_logical_id)
            block = block.replace("__CFDIST__", cloudfront_logical_id)
            blocks.append(block)

    if not blocks:
        return ""

    archive_bucket = f"""  BuildArchiveBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub '{iam_scoped_prefix}-build-archive-${{AWS::AccountId}}'
      LifecycleConfiguration:
        Rules:
          - Id: ExpireArchives
            Status: Enabled
            ExpirationInDays: 7
"""
    return archive_bucket + "\n" + "\n".join(blocks)


def splice_into_template(template: str, fragment: str) -> str:
    """Insert a Resources-entries YAML fragment into an already-rendered CFN
    template. Anchored on the ``Outputs:`` section (falling back to
    end-of-file) rather than on the ``Resources:`` header line, since the
    header's exact formatting isn't guaranteed. Single implementation shared
    by both `cfn_generator.generate_template` and `iac.enforce_codebuild_projects`
    — they used to each splice this independently and had drifted."""
    if not fragment:
        return template
    out_match = _OUTPUTS_SECTION_RE.search(template)
    if out_match:
        insert_at = out_match.start()
        return template[:insert_at] + fragment + "\n" + template[insert_at:]
    return template.rstrip("\n") + "\n" + fragment


def buildable_node_ids(spec: dict[str, Any]) -> list[str]:
    """Node ids that get a CodeBuild project (used by build.py to know which
    projects to StartBuild), deduped the same way generate_codebuild_resources
    dedupes a worker sharing the backend's build path."""
    resources = spec.get("resources") or []
    ids: list[str] = []
    seen_docker_paths: set[str] = set()
    for entry in resources:
        node_type = entry.get("type")
        build_path = entry.get("build_path")
        if not build_path:
            continue
        if node_type in ("service", "worker") and entry.get("image") == "ecr":
            if build_path in seen_docker_paths:
                continue
            seen_docker_paths.add(build_path)
            ids.append(entry["node_id"])
        elif node_type == "static":
            ids.append(entry["node_id"])
    return ids
