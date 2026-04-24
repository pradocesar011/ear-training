import { useState, useEffect } from 'react'
import { Routes, Route, Outlet, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { AppProvider, useAppContext } from './context/AppContext.jsx'

import BottomNav            from './components/BottomNav.jsx'
import WelcomeScreen        from './screens/WelcomeScreen.jsx'
import TrainScreen          from './screens/TrainScreen.jsx'
import ExerciseScreen       from './screens/ExerciseScreen.jsx'
import ResultScreen         from './screens/ResultScreen.jsx'
import SessionSummaryScreen from './screens/SessionSummaryScreen.jsx'
import ProgressScreen       from './screens/ProgressScreen.jsx'
import ReviewScreen         from './screens/ReviewScreen.jsx'
import ProfileScreen        from './screens/ProfileScreen.jsx'
import ReefScreen           from './screens/ReefScreen.jsx'

import AdminLogin       from './admin/AdminLogin.jsx'
import AdminShell       from './admin/AdminShell.jsx'
import AdminDashboard   from './admin/AdminDashboard.jsx'
import AdminActions     from './admin/AdminActions.jsx'
import AdminUserDetail  from './admin/AdminUserDetail.jsx'
import AdminComparison  from './admin/AdminComparison.jsx'
import AdminIntervals   from './admin/AdminIntervals.jsx'
import AdminSessionLog  from './admin/AdminSessionLog.jsx'

import { SESSION } from './config/constants.js'

// ── Admin (no nav, no context needed) ────────────────────────────────────────
function AdminRoute() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === '1')
  if (!authed) return <AdminLogin onLogin={() => { sessionStorage.setItem('admin_authed','1'); setAuthed(true) }} />
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index                element={<AdminDashboard />} />
        <Route path="actions"       element={<AdminActions />} />
        <Route path="comparison"    element={<AdminComparison />} />
        <Route path="intervals"     element={<AdminIntervals />} />
        <Route path="sessions"      element={<AdminSessionLog />} />
      </Route>
      <Route path="user/:userId"    element={<AdminUserDetail />} />
    </Routes>
  )
}

// ── Train tab — renders the full exercise flow or the idle landing ─────────────
function TrainTab() {
  const { t } = useTranslation()
  const { user, session, audio } = useAppContext()

  const {
    phase, isFirstExercise, isLastExercise,
    currentExercise, hearingsLeft, noteIndex, lastNoteResult,
    exerciseResult, summaryData, activeOctaves,
    startSession, submitNote, useHearing,
    extraHearings, useExtraHearing,
    nextExercise, endSession, resetSession,
  } = session

  // 20-minute soft reminder (only during active exercise)
  const [showReminder, setShowReminder] = useState(false)
  useEffect(() => {
    if (phase === 'exercise') {
      const timer = setTimeout(() => setShowReminder(true), SESSION.SOFT_LIMIT_MINUTES * 60 * 1000)
      return () => { clearTimeout(timer); setShowReminder(false) }
    }
    setShowReminder(false)
  }, [phase])

  async function handleNote(note) {
    await audio.playNote(note)
    submitNote(note)
  }

  // First visit (or after logout): no confirmed code → show onboarding
  if (!user.userCode) {
    return (
      <WelcomeScreen
        suggestedCode={user.suggestedCode}
        loading={user.loading}
        onConfirm={user.confirmCode}
        onEnterCode={user.enterCode}
        onChangeLanguage={user.changeLanguage}
      />
    )
  }

  if (phase === 'exercise' && currentExercise) {
    return (
      <>
        {showReminder && (
          <div className="fixed top-0 inset-x-0 bg-orange-950/80 text-orange-200 text-sm text-center py-2 px-4 z-50">
            {t('session.time_reminder')}
          </div>
        )}
        <ExerciseScreen
          exercise={currentExercise}
          hearingsLeft={hearingsLeft}
          noteIndex={noteIndex}
          lastNoteResult={lastNoteResult}
          isFirstExercise={isFirstExercise}
          activeOctaves={activeOctaves}
          extraHearings={extraHearings}
          onNote={handleNote}
          onPlay={useHearing}
          onUseExtraHearing={useExtraHearing}
          onEnd={endSession}
          audio={audio}
        />
      </>
    )
  }

  if (phase === 'result' && exerciseResult) {
    return (
      <ResultScreen
        result={exerciseResult}
        isLastExercise={isLastExercise}
        onNext={nextExercise}
        onEnd={endSession}
      />
    )
  }

  if (phase === 'summary') {
    return (
      <SessionSummaryScreen
        summary={summaryData}
        userCode={user.userCode}
        onNewSession={resetSession}
      />
    )
  }

  // phase === 'idle'
  return <TrainScreen />
}

// ── AppShell — wraps all tabs; hides nav during active exercise ───────────────
function AppShell() {
  const { session } = useAppContext()
  const { phase } = session

  // Hide nav so exercise keyboard has full screen
  const hideNav = phase === 'exercise'

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className={`flex-1 overflow-y-auto ${hideNav ? '' : 'pb-16'}`}>
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AppProvider>
      <Routes>
        {/* Admin — standalone, no nav */}
        <Route path="/admin/*" element={<AdminRoute />} />

        {/* Main app shell */}
        <Route element={<AppShell />}>
          <Route path="/"           element={<TrainTab />} />
          <Route path="/progress"   element={<ProgressScreen />} />
          <Route path="/review"     element={<ReviewScreen />} />
          <Route path="/profile"    element={<ProfileScreen />} />
          <Route path="/reef"       element={<ReefScreen />} />
          <Route path="*"           element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AppProvider>
  )
}
