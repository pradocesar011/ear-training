import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/admin',            label: 'Global',     end: true },
  { to: '/admin/actions',    label: 'Actions'              },
  { to: '/admin/comparison', label: 'Comparison'           },
  { to: '/admin/intervals',  label: 'Intervals'            },
  { to: '/admin/sessions',   label: 'Sessions'             },
]

export default function AdminShell() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <nav className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center gap-1 sticky top-0 z-20">
        <span className="text-zinc-500 text-xs font-semibold uppercase tracking-widest mr-6">
          Admin
        </span>
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-cyan-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-6xl px-6 py-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
