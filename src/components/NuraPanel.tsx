import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { NUVOVA_CONFIG } from '@/config';
import { cn, formatTime } from '@/lib/utils';
import { Sparkles, X, Send, Loader2, User, Lightbulb, Languages, PenLine, FileText } from 'lucide-react';

interface NuraMessage {
  id: string;
  role: 'user' | 'nura';
  text: string;
  created_at: string;
}

const NURA_GREETING = `Hi! I'm ${NUVOVA_CONFIG.aiName}, your NUVORA AI assistant. I can help you write messages, translate text, summarize chats, answer questions, and more. What can I do for you?`;

const SUGGESTIONS = [
  { icon: FileText, label: 'Summarize my recent chats' },
  { icon: PenLine, label: 'Help me write a polite message' },
  { icon: Languages, label: 'Translate "hello" to Spanish' },
  { icon: Lightbulb, label: 'Fix my grammar' },
];

export function NuraPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<NuraMessage[]>([
    { id: 'greet', role: 'nura', text: NURA_GREETING, created_at: new Date().toISOString() },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: NuraMessage = { id: crypto.randomUUID(), role: 'user', text: text.trim(), created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      const { data, error } = await supabase.functions.invoke('nura', {
        body: { message: text.trim() },
      });
      const reply = error || !data?.reply
        ? localReply(text.trim())
        : data.reply;
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'nura', text: reply, created_at: new Date().toISOString() }]);
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'nura', text: localReply(text.trim()), created_at: new Date().toISOString() }]);
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-lg h-[85vh] sm:h-[600px] bg-white dark:bg-ink-900 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-ink-200 dark:border-ink-800 bg-gradient-to-r from-aqua-500/10 to-ocean-500/10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-1.5">
              {NUVOVA_CONFIG.aiName}
              <span className="text-xs font-normal text-aqua-600 dark:text-aqua-400 bg-aqua-500/10 px-1.5 py-0.5 rounded-full">AI</span>
            </h3>
            <p className="text-xs text-aqua-600 dark:text-aqua-400">Online · Built-in assistant</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition">
            <X size={20} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-ink-50 dark:bg-ink-950">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'nura' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-white" />
                </div>
              )}
              <div className={cn(
                'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm',
                m.role === 'user'
                  ? 'bg-gradient-to-br from-aqua-500 to-ocean-500 text-white rounded-br-md'
                  : 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white rounded-bl-md shadow-sm'
              )}>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <span className={cn('block text-[10px] mt-0.5', m.role === 'user' ? 'text-aqua-100' : 'text-ink-400')}>
                  {formatTime(m.created_at)}
                </span>
              </div>
              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-ink-300 dark:bg-ink-700 flex items-center justify-center shrink-0">
                  <User size={14} className="text-ink-600 dark:text-ink-300" />
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="flex gap-1 px-3 py-3 rounded-2xl bg-white dark:bg-ink-800 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {messages.length <= 1 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => send(s.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300 hover:bg-aqua-50 dark:hover:bg-aqua-950/40 hover:text-aqua-600 transition"
              >
                <s.icon size={12} />
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-3 border-t border-ink-200 dark:border-ink-800 flex items-end gap-2 bg-white dark:bg-ink-900">
          <div className="flex-1 flex items-end gap-2 bg-ink-100 dark:bg-ink-800 rounded-3xl px-4 py-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={`Ask ${NUVOVA_CONFIG.aiName}...`}
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none max-h-24 text-sm"
            />
          </div>
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || busy}
            className="p-3 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 text-white shadow-lg hover:scale-105 active:scale-95 transition disabled:opacity-40 disabled:hover:scale-100"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function localReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('translate')) {
    const map: Record<string, string> = { hello: 'hola', 'thank you': 'gracias', goodbye: 'adiós' };
    const word = Object.keys(map).find((k) => lower.includes(k));
    return word ? `"${word}" in Spanish is "${map[word]}".` : 'I can translate between common languages — just tell me the word or phrase and the target language.';
  }
  if (lower.includes('grammar') || lower.includes('fix')) {
    return 'Sure — paste the text you want me to correct and I will fix spelling, grammar, and punctuation while keeping your meaning intact.';
  }
  if (lower.includes('summar')) {
    return 'I can summarize your chats. Open a conversation and tap the NURA icon in the chat header — I will generate a concise summary of the recent messages.';
  }
  if (lower.includes('write') || lower.includes('message')) {
    return 'Happy to help draft a message. Tell me the tone (formal, friendly, apologetic) and the key points, and I will write it for you.';
  }
  if (lower.includes('hello') || lower.includes('hi')) {
    return `Hello! I am ${NUVOVA_CONFIG.aiName}. How can I help you today?`;
  }
  return `I understand you said: "${input}". I am ${NUVOVA_CONFIG.aiName}, NUVORA's built-in assistant. I can help with writing, translation, summaries, and answering questions. Connect an AI API key to enable full natural conversation.`;
}
