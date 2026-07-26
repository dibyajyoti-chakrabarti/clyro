import cloudFront from '../../../../assets/steps/step6/CloudFront.svg'
import cloudWatch from '../../../../assets/steps/step6/CloudWatch.svg'
import codeBuild from '../../../../assets/steps/step6/CodeBuild.svg'
import elastiCache from '../../../../assets/steps/step6/ElastiCache.svg'
import ecr from '../../../../assets/steps/step6/Elastic Container Registry.svg'
import ecs from '../../../../assets/steps/step6/Elastic Container Service.svg'
import iam from '../../../../assets/steps/step6/IAM Identity Center.svg'
import rds from '../../../../assets/steps/step6/RDS.svg'
import secretsManager from '../../../../assets/steps/step6/Secrets Manager.svg'
import sns from '../../../../assets/steps/step6/Simple Notification Service.svg'
import s3 from '../../../../assets/steps/step6/Simple Storage Service.svg'
import vpc from '../../../../assets/steps/step6/Virtual Private Cloud.svg'
import route53 from '../../../../assets/steps/step6/aws-res-amazon-route-53-route-table.svg'
import elb from '../../../../assets/steps/step6/aws-res-elastic-load-balancing-application-load-balancer.svg'

// Per-namespace icon + accent color for the resource-category chips. Keyed by the
// raw CFN namespace (buildCfnBom's `group.namespace`), not the human-readable label,
// so renames to SERVICE_LABELS don't break icon lookup.
export const SERVICE_ICON_MAP = {
  EC2: { icon: vpc, chipClass: 'bg-sky-500/15 text-sky-400' },
  ECS: { icon: ecs, chipClass: 'bg-[#E9B949]/15 text-[#E9B949]' },
  ECR: { icon: ecr, chipClass: 'bg-[#E9B949]/15 text-[#E9B949]' },
  ElasticLoadBalancingV2: { icon: elb, chipClass: 'bg-teal-500/15 text-teal-400' },
  RDS: { icon: rds, chipClass: 'bg-blue-500/15 text-blue-400' },
  ElastiCache: { icon: elastiCache, chipClass: 'bg-red-500/15 text-red-400' },
  S3: { icon: s3, chipClass: 'bg-green-500/15 text-green-400' },
  IAM: { icon: iam, chipClass: 'bg-rose-500/15 text-rose-400' },
  Logs: { icon: cloudWatch, chipClass: 'bg-pink-500/15 text-pink-400' },
  CloudWatch: { icon: cloudWatch, chipClass: 'bg-pink-500/15 text-pink-400' },
  CloudFront: { icon: cloudFront, chipClass: 'bg-purple-500/15 text-purple-400' },
  CodeBuild: { icon: codeBuild, chipClass: 'bg-[#E9B949]/15 text-[#E9B949]' },
  SecretsManager: { icon: secretsManager, chipClass: 'bg-red-500/15 text-red-400' },
  Route53: { icon: route53, chipClass: 'bg-purple-500/15 text-purple-400' },
  SNS: { icon: sns, chipClass: 'bg-pink-500/15 text-pink-400' },
}

export const DEFAULT_CHIP_CLASS = 'bg-white/[0.06] text-text-muted'
