import { parse } from 'yaml'

// CloudFormation short-form intrinsics (!Ref, !Sub, …) are YAML custom tags —
// the parser rejects the template unless it knows them. The BOM never looks at
// intrinsic values, so they all resolve to plain data. Each name is registered
// for every node shape it can legally take (!Sub can be a scalar or a list,
// !ImportValue a scalar or a map, …).
const SCALAR_TAGS = ['!Ref', '!Sub', '!GetAtt', '!ImportValue', '!Base64', '!GetAZs', '!Condition']
const SEQ_TAGS = [
  '!Sub', '!GetAtt', '!Join', '!Select', '!Split', '!FindInMap', '!If',
  '!And', '!Or', '!Not', '!Equals', '!Cidr', '!ImportValue', '!Base64', '!GetAZs',
]
const MAP_TAGS = ['!Sub', '!ImportValue', '!Base64', '!Transform']

const CFN_TAGS = [
  ...SCALAR_TAGS.map((tag) => ({ tag, resolve: (value) => value })),
  ...SEQ_TAGS.map((tag) => ({ tag, collection: 'seq' })),
  ...MAP_TAGS.map((tag) => ({ tag, collection: 'map' })),
]

// Friendly names for the CFN namespaces Clyro's templates actually use; anything
// unmapped falls back to the raw namespace token (e.g. "SNS").
const SERVICE_LABELS = {
  EC2: 'Networking (EC2/VPC)',
  ECS: 'Containers (ECS)',
  ECR: 'Container registry (ECR)',
  ElasticLoadBalancingV2: 'Load balancing',
  RDS: 'Database (RDS)',
  ElastiCache: 'Cache (ElastiCache)',
  DynamoDB: 'Database (DynamoDB)',
  S3: 'Storage (S3)',
  SQS: 'Queues (SQS)',
  IAM: 'Access control (IAM)',
  Logs: 'Logging (CloudWatch)',
  CloudWatch: 'Monitoring (CloudWatch)',
  CloudFront: 'CDN (CloudFront)',
  CodeBuild: 'Build (CodeBuild)',
  Lambda: 'Functions (Lambda)',
  SecretsManager: 'Secrets Manager',
  CertificateManager: 'Certificates (ACM)',
  ApplicationAutoScaling: 'Auto scaling',
  Route53: 'DNS (Route 53)',
}

// "VPCGatewayAttachment" → "VPC Gateway Attachment", "DBInstance" → "DB Instance"
function humanizeType(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

/**
 * Build a bill of materials from a CloudFormation YAML template.
 * Returns { total, groups: [{ service, namespace, items: [{ type, label, count, names }] }] },
 * or null when the template is missing or unparseable (callers hide the BOM).
 * `namespace` is the raw CFN namespace token (e.g. "RDS", "EC2") the service label
 * was derived from — callers use it to look up a per-service icon.
 */
export function buildCfnBom(template) {
  if (!template) return null
  let doc
  try {
    doc = parse(template, { customTags: CFN_TAGS })
  } catch {
    return null
  }
  const resources = doc?.Resources
  if (!resources || typeof resources !== 'object') return null

  const byType = new Map()
  for (const [logicalId, resource] of Object.entries(resources)) {
    const type = resource?.Type
    if (typeof type !== 'string') continue
    const entry = byType.get(type) || { type, count: 0, names: [] }
    entry.count += 1
    entry.names.push(logicalId)
    byType.set(type, entry)
  }
  if (byType.size === 0) return null

  const groups = new Map()
  let total = 0
  for (const entry of byType.values()) {
    total += entry.count
    // "AWS::EC2::VPC" → namespace "EC2", resource "VPC"; Custom::X has no namespace
    const parts = entry.type.split('::')
    const namespace = parts.length === 3 ? parts[1] : parts[0]
    const service = SERVICE_LABELS[namespace] || namespace
    const label = humanizeType(parts[parts.length - 1])
    const group = groups.get(service) || { service, namespace, items: [] }
    group.items.push({ ...entry, label })
    groups.set(service, group)
  }

  const sorted = [...groups.values()].sort((a, b) => a.service.localeCompare(b.service))
  for (const group of sorted) group.items.sort((a, b) => a.label.localeCompare(b.label))
  return { total, groups: sorted }
}
