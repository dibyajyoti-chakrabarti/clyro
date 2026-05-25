import { createContext, useContext, useEffect, useState } from 'react'
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const loadAuthState = async () => {
      try {
        const [currentUser, currentSession] = await Promise.all([
          getCurrentUser(),
          fetchAuthSession(),
        ])

        if (!isMounted) {
          return
        }

        setUser(currentUser)
        setSession(currentSession)
      } catch {
        if (!isMounted) {
          return
        }

        setUser(null)
        setSession(null)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadAuthState()

    return () => {
      isMounted = false
    }
  }, [])

  const logout = async () => {
    await signOut()
    setUser(null)
    setSession(null)
  }

  const value = {
    user,
    session,
    isAuthenticated: user !== null,
    isLoading,
    logout,
  }

  if (isLoading) {
    return null
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return context
}
