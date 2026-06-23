'use client';
import { useEffect, useRef, useState } from 'react';
import { getCompanyChat, sendCompanyChat } from '@/lib/api';

type Msg = { role: string; content: string };

export default function CompanyChatDrawer({ projectId, company, onClose }: { projectId: string; company: string; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCompanyChat(projectId, company).then((d) => setMessages(d.history)).catch(() => setMessages([]));
  }, [projectId, company]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setSending(true);
    try {
      const { reply } = await sendCompanyChat(projectId, company, msg);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: '⚠ Failed to get a reply.' }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <div className="relative w-full max-w-md bg-white h-full shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Chat · {company}</p>
            <p className="text-[11px] text-gray-400">reasons over all of this company&apos;s research</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-sm text-gray-400">Ask anything about {company} — e.g. &quot;what&apos;s the strongest angle for outreach?&quot;</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`text-sm rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-indigo-50 ml-8' : 'bg-gray-50 mr-8'}`}>
              <p className="whitespace-pre-wrap text-gray-800">{m.content}</p>
            </div>
          ))}
          {sending && <p className="text-xs text-gray-400">thinking…</p>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-gray-100 p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Message…"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
          <button onClick={send} disabled={sending || !input.trim()} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">Send</button>
        </div>
      </div>
    </div>
  );
}
