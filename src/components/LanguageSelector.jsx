import { useTranslation } from 'react-i18next'

export default function LanguageSelector({ onChange }) {
  const { i18n } = useTranslation()
  const current = i18n.language?.slice(0, 2) ?? 'es'

  function select(lang) {
    i18n.changeLanguage(lang)
    onChange?.(lang)
  }

  return (
    <div className="flex gap-1">
      {['es', 'en'].map(lang => (
        <button
          key={lang}
          onClick={() => select(lang)}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-colors
            ${current === lang
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}` }style={{ padding: '10px' }}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
