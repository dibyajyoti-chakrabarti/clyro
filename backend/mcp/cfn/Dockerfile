# AWS IaC MCP server as an AgentCore Gateway Lambda target (read-only:
# validate_cloudformation_template / cfn-lint).
FROM public.ecr.aws/lambda/python:3.12

# Quieter awslabs/FastMCP logging in CloudWatch.
ENV FASTMCP_LOG_LEVEL=WARNING

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
