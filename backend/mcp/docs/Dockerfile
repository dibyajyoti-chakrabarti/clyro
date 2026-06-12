# AWS Documentation MCP server as an AgentCore Gateway Lambda target.
FROM public.ecr.aws/lambda/python:3.12

# Global AWS partition; quieter awslabs/FastMCP logging in CloudWatch.
ENV AWS_DOCUMENTATION_PARTITION=aws \
    FASTMCP_LOG_LEVEL=WARNING

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r requirements.txt

COPY handler.py ${LAMBDA_TASK_ROOT}/

CMD ["handler.handler"]
