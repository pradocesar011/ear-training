import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TABS = [
  {
    to: '/',
    end: true,
    labelKey: 'nav.train',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8}
        stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
    ),
  },
  {
    to: '/reef',
    end: false,
    labelKey: 'nav.reef',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8}
        stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 3c-1.5 3-4 4.5-4 7a4 4 0 008 0c0-2.5-2.5-4-4-7z" />
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M8 17c-2 .5-3.5 1.5-3.5 2.5S6 21 12 21s7.5-.5 7.5-1.5S19 18 17 17.5" />
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M6 13c-1.5.5-2.5 1-2.5 1.5M18 13c1.5.5 2.5 1 2.5 1.5" />
      </svg>
    ),
  },
  {
    to: '/progress',
    end: false,
    labelKey: 'nav.progress',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8}
        stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    to: '/review',
    end: false,
    labelKey: 'nav.review',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8}
        stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    to: '/profile',
    end: false,
    labelKey: 'nav.profile',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={active ? 2.2 : 1.8}
        stroke="currentColor" className="w-6 h-6">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { t } = useTranslation()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-zinc-950 border-t border-zinc-800/60
                    flex items-stretch safe-area-inset-bottom"
         style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {TABS.map(({ to, end, labelKey, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
             ${isActive ? 'text-cyan-400' : 'text-zinc-500 hover:text-zinc-300'}`
          }
        >
          {({ isActive }) => (
            <>
              {icon(isActive)}
              <span className="text-[10px] font-medium tracking-wide">{t(labelKey)}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
