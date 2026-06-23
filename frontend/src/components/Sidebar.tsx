'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string; icon: React.ReactNode };
type NavGroup = { title: string; items: NavItem[]; collapsible?: boolean };

function SvgDashboard() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
    </svg>
  );
}
function SvgResearch() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}
function SvgOrchestrate() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
function SvgCatalog() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10M4 18h6" />
    </svg>
  );
}
function SvgRuns() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" />
    </svg>
  );
}
function SvgLLM() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15M14.25 3.104c.251.023.501.05.75.082M19.8 15l-3.18 3.18a1.5 1.5 0 0 1-2.122 0L12 15.562l-2.498 2.618a1.5 1.5 0 0 1-2.122 0L4.2 15m15.6 0H4.2" />
    </svg>
  );
}
function SvgAgent() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
    </svg>
  );
}
function SvgPrompt() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  );
}
function SvgChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
function SvgBookmark() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}
function SvgCollapse({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  );
}

function NavLink({ href, label, icon, active }: NavItem & { active: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
        ${active
          ? 'bg-indigo-50 text-indigo-700 shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
      <span className={active ? 'text-indigo-600' : 'text-gray-400'}>{icon}</span>
      {label}
    </Link>
  );
}

function NavGroup({ group, pathname, open, onToggle }: { group: NavGroup; pathname: string; open: boolean; onToggle: () => void }) {
  return (
    <div>
      {group.collapsible ? (
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
        >
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-gray-500 transition-colors">
            {group.title}
          </span>
          <span className="text-gray-300 group-hover:text-gray-400 transition-colors">
            <SvgChevron open={open} />
          </span>
        </button>
      ) : (
        <p className="px-3 py-1.5 mb-0.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {group.title}
        </p>
      )}
      {open && (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.href} {...item} active={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))} />
          ))}
        </div>
      )}
    </div>
  );
}

const GROUPS: NavGroup[] = [
  {
    title: 'Core',
    collapsible: false,
    items: [
      { href: '/',           label: 'Dashboard',     icon: <SvgDashboard /> },
      { href: '/new',        label: 'New Research',  icon: <SvgResearch />  },
      { href: '/orchestrate', label: 'Orchestrate',  icon: <SvgOrchestrate /> },
      { href: '/runs',       label: 'All Runs',      icon: <SvgRuns />      },
      { href: '/runs/saved', label: 'Saved',   icon: <SvgBookmark /> },
      { href: '/catalog',    label: 'Catalog',  icon: <SvgCatalog />  },
    ],
  },
  {
    title: 'Settings',
    collapsible: true,
    items: [
      { href: '/settings/llm',    label: 'LLM Config',    icon: <SvgLLM />    },
      { href: '/settings/agents', label: 'Agent Settings', icon: <SvgAgent /> },
      { href: '/settings/prompts', label: 'Prompts',       icon: <SvgPrompt /> },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith('/settings')
  );

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 border-r border-gray-200 bg-white transition-all duration-300 z-30 flex-shrink-0"
      style={{ width: collapsed ? 64 : 220 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-gray-100 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
        >
          <span className="text-white font-bold text-xs">P</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-sm text-gray-900 truncate">
            Prospect<span style={{ background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>IQ</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
        {collapsed ? (
          <div className="space-y-1">
            {GROUPS.flatMap((g) => g.items).map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg mx-auto transition-all duration-150
                    ${active ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                >
                  {item.icon}
                </Link>
              );
            })}
          </div>
        ) : (
          <>
            <NavGroup
              group={GROUPS[0]}
              pathname={pathname}
              open={true}
              onToggle={() => {}}
            />
            <NavGroup
              group={GROUPS[1]}
              pathname={pathname}
              open={settingsOpen}
              onToggle={() => setSettingsOpen((o) => !o)}
            />
          </>
        )}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-gray-100 p-2 flex-shrink-0">
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center w-full h-9 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all duration-150"
        >
          <SvgCollapse collapsed={collapsed} />
        </button>
      </div>
    </aside>
  );
}
