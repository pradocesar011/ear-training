/**
 * AppContext — provides user, session, and audio state to every tab.
 * Avoids prop-drilling across the 4-tab shell.
 */

import { createContext, useContext } from 'react'
import { useUser }    from '../hooks/useUser.js'
import { useSession } from '../hooks/useSession.js'
import { useAudio }   from '../hooks/useAudio.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const user    = useUser()
  const session = useSession(user.userId)
  const audio   = useAudio()

  return (
    <AppContext.Provider value={{ user, session, audio }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
