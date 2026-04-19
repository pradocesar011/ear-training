import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function AdminLogin({ onLogin }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const correct = import.meta.env.VITE_ADMIN_PASSWORD
    if (password === correct) {
      onLogin()
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm">
        <h2 className="text-xl font-bold text-white mb-6">{t('admin.login_heading')}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            placeholder={t('admin.password_label')}
            className={`bg-zinc-950 border rounded-lg px-4 py-2 text-white
              focus:outline-none focus:ring-2 focus:ring-cyan-500
              ${error ? 'border-rose-500' : 'border-zinc-700'}`}
          />
          {error && (
            <p className="text-rose-500 text-sm">{t('admin.wrong_password')}</p>
          )}
          <button
            type="submit"
            className="py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors"
          >
            {t('admin.login_button')}
          </button>
        </form>
      </div>
    </div>
  )
}
