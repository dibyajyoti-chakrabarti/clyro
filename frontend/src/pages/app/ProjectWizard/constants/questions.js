// AWS account type is no longer asked as an intent question — Step 2 (Connect
// your AWS account) captures it directly, right before verifying the role, since
// it's needed to compare against the account's actual verified plan type.
export const ACCOUNT_TYPE_OPTIONS = [
  {
    value: 'paid',
    label: 'Paid account — I\'m fine paying for the right resources',
    recommended: true,
  },
  {
    value: 'free_tier',
    label: 'Free tier — I want to stay within free limits',
    note: 'NAT Gateway and some services will be excluded to avoid charges',
  },
]

export function getQuestions() {
  return [
    {
      id: 'environment',
      question: 'What environment is this deployment for?',
      type: 'choice',
      options: [
        { value: 'production', label: 'Production' },
        { value: 'staging', label: 'Staging / Testing' },
        { value: 'development', label: 'Development' },
      ],
    },
    {
      id: 'scale',
      question: 'How many users do you expect at launch?',
      type: 'choice',
      options: [
        { value: 'solo', label: 'Just me or a small internal team' },
        { value: 'small', label: 'Small user base — under 1,000 users' },
        { value: 'medium', label: 'Public product — expecting real traffic' },
        { value: 'large', label: 'High scale — expecting significant load' },
      ],
    },
  ]
}
