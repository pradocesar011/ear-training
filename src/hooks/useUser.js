/**
 * useUser — manages user identity.
 *
 * Flow:
 *   - Return visit (code in localStorage): load user silently, skip welcome screen.
 *   - First visit (no stored code): generate a suggested code, expose it via
 *     `suggestedCode`. Do NOT save to DB until the user calls `confirmCode()`.
 *   - User can replace their code at any time via `enterCode(code)`.
 *   - `logout()` clears localStorage and returns to the new-user welcome state.
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase.js'
import {
  generateUserCode,
  getStoredCode, storeCode, clearStoredCode,
  storeLanguage,
} from '../lib/utils.js'

export function useUser() {
  const { i18n } = useTranslation()

  const [userCode,       setUserCode]       = useState(null)
  const [suggestedCode,  setSuggestedCode]  = useState(null)
  const [userId,         setUserId]         = useState(null)
  const [onboardingDone, setOnboardingDone] = useState(true)   // true until we know otherwise
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState(null)

  useEffect(() => { initUser() }, [])

  // ── Initialisation ────────────────────────────────────────────────────────

  async function initUser() {
    setLoading(true)
    setError(null)
    const stored = getStoredCode()
    if (stored) {
      await loadUser(stored)
    } else {
      // Don't save yet — just prepare a suggestion
      const suggestion = await generateUniqueCode()
      setSuggestedCode(suggestion)
    }
    setLoading(false)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  async function generateUniqueCode() {
    for (let i = 0; i < 10; i++) {
      const code = generateUserCode()
      const { data } = await supabase
        .from('users').select('code').eq('code', code).maybeSingle()
      if (!data) return code
    }
    return generateUserCode()   // very unlikely to collide after 10 tries
  }

  async function loadUser(code) {
    const upper = code.trim().toUpperCase()
    const { data, error: err } = await supabase
      .from('users')
      .select('id, code, language, onboarding_done')
      .eq('code', upper)
      .single()

    if (err || !data) { setError('not_found'); return false }

    storeCode(data.code)
    setUserCode(data.code)
    setUserId(data.id)
    setOnboardingDone(data.onboarding_done ?? true)
    setSuggestedCode(null)
    if (data.language && data.language !== i18n.language) {
      i18n.changeLanguage(data.language)
      storeLanguage(data.language)
    }
    return true
  }

  async function saveNewUser(code) {
    // Handle rare race-condition collision: retry with a new code
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error: err } = await supabase
        .from('users')
        .insert({ code, language: i18n.language.slice(0, 2), onboarding_done: false })
        .select('id, code')
        .single()

      if (!err && data) {
        storeCode(data.code)
        setUserCode(data.code)
        setUserId(data.id)
        setOnboardingDone(false)
        setSuggestedCode(null)
        return true
      }

      // Unique constraint violation → try a fresh code
      if (err?.code === '23505') {
        code = await generateUniqueCode()
      } else {
        // Fallback: work offline
        storeCode(code)
        setUserCode(code)
        setUserId(null)
        setOnboardingDone(false)
        setSuggestedCode(null)
        return true
      }
    }
    return false
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Called when a new user accepts the suggested code and clicks "Start".
   * Saves the code to Supabase and localStorage.
   */
  const confirmCode = useCallback(async (code) => {
    setLoading(true)
    setError(null)
    const ok = await saveNewUser(code ?? suggestedCode)
    setLoading(false)
    return ok
  }, [suggestedCode, i18n])

  /**
   * Called when an existing user types their code to recover progress.
   */
  const enterCode = useCallback(async (code) => {
    setLoading(true)
    setError(null)
    const ok = await loadUser(code)
    if (!ok) setError('not_found')
    setLoading(false)
    return ok
  }, [i18n])

  /**
   * Clear all local state and return to the new-user welcome screen.
   * Generates a new code suggestion so the welcome screen has something to show.
   */
  const logout = useCallback(async () => {
    clearStoredCode()
    setUserCode(null)
    setUserId(null)
    setError(null)
    const suggestion = await generateUniqueCode()
    setSuggestedCode(suggestion)
  }, [])

  const completeOnboarding = useCallback(async () => {
    setOnboardingDone(true)
    if (userId) {
      await supabase.from('users').update({ onboarding_done: true }).eq('id', userId)
    }
  }, [userId])

  const changeLanguage = useCallback(async (lang) => {
    i18n.changeLanguage(lang)
    storeLanguage(lang)
    if (userId) {
      await supabase.from('users').update({ language: lang }).eq('id', userId)
    }
  }, [userId, i18n])

  return {
    userCode,
    suggestedCode,
    userId,
    onboardingDone,
    loading,
    error,
    confirmCode,
    enterCode,
    logout,
    changeLanguage,
    completeOnboarding,
  }
}
