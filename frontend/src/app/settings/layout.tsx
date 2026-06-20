'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/settings/llm',    label: 'LLM Config',     icon: '⬡' },
  { href: '/settings/agents', label: 'Agent Settings',  icon: '⚙' },
  { href: '/settings/prompts', label: 'Prompts',        icon: '◈' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 border-b border-gray-200 pb-0 -mb-1">
        {TABS.map(tab => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 -mb-px
                ${active
                  ? 'border-indigo-500 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <span className={`text-base ${active ? 'text-indigo-500' : 'text-gray-400'}`}>{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
