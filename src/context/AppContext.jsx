/**
 * AppContext — provides user, session, audio, and reef state to every tab.
 * Avoids prop-drilling across the 5-tab shell.
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useUser }    from '../hooks/useUser.js'
import { useSession } from '../hooks/useSession.js'
import { useAudio }   from '../hooks/useAudio.js'
import { useReef }    from '../hooks/useReef.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const user    = useUser()
  const session = useSession(user.userId)
  const audio   = useAudio()
  const reef    = useReef(user.userId)
  const [reviewInExercise, setReviewInExercise] = useState(false)

  // Pending algae accumulates while reef is still loading
  const pendingAlgaeRef = useRef(0)
  useEffect(() => {
    if (reef.loaded && pendingAlgaeRef.current > 0) {
      reef.addAlgae(pendingAlgaeRef.current)
      pendingAlgaeRef.current = 0
    }
  }, [reef.loaded])

  function safeAddAlgae(amount) {
    if (amount <= 0) return
    if (reef.loaded) {
      reef.addAlgae(amount)
    } else {
      pendingAlgaeRef.current += amount
    }
  }

  // Award algae for each completed exercise — proportional to IDM × precision
  const lastResultRef = useRef(null)
  useEffect(() => {
    const r = session.exerciseResult
    if (r && r !== lastResultRef.current) {
      lastResultRef.current = r
      safeAddAlgae(r.algaeEarned ?? 0)
    }
  }, [session.exerciseResult])

  // Award session completion bonus when phase reaches 'summary'
  const bonusGivenRef = useRef(false)
  useEffect(() => {
    if (session.phase === 'summary') {
      if (!bonusGivenRef.current) {
        bonusGivenRef.current = true
        safeAddAlgae(session.summaryData.algaeBonus ?? 0)
      }
    } else {
      bonusGivenRef.current = false
    }
  }, [session.phase])

  return (
    <AppContext.Provider value={{ user, session, audio, reef, reviewInExercise, setReviewInExercise }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
