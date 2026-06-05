import { Amplify } from 'aws-amplify'

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
      region: import.meta.env.VITE_COGNITO_REGION,
      signUpVerificationMethod: 'code',
      loginWith: {
        oauth: {
          domain: import.meta.env.VITE_COGNITO_DOMAIN,
          scopes: ['email', 'openid', 'profile'],
          redirectSignIn: [
            'http://localhost:5173/auth/callback',
            import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/auth/callback` : '',
          ].filter(Boolean),
          redirectSignOut: [
            'http://localhost:5173/',
            import.meta.env.VITE_APP_URL ? `${import.meta.env.VITE_APP_URL}/` : '',
          ].filter(Boolean),
          responseType: 'code',
        },
      },
    },
  },
})
