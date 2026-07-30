import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Chat, Profile } from '@/types';
import { Avatar } from '@/components/Avatar';
import { X, Search, Users, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NewChatModal({ onClose, onCreated }: { onClose: () => void; onCreated: (chat: Chat) => void }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'select' | 'group'>('select');
  const [selected, setSelected] = useState<Profile[]>([]);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    if (!profile) return;
    supabase.from('profiles').select('*').neq('id', profile.id).limit(50).then(({ data }) => setUsers(data ?? []));
  }, [profile]);

  const startPrivate = async (other: Profile) => {
    if (!profile) return;
    setBusy(true);
    // check existing private chat
    const { data: myChats } = await supabase.from('chat_members').select('chat_id').eq('user_id', profile.id);
    if (myChats && myChats.length > 0) {
      const { data: existing } = await supabase
        .from('chat_members')
        .select('chat_id, chat:chats!inner(*)')
        .eq('user_id', other.id)
        .in('chat_id', myChats.map((m) => m.chat_id))
        .eq('chat.type', 'private')
        .maybeSingle();
      if (existing?.chat) {
        onCreated(existing.chat as unknown as Chat);
        setBusy(false);
        return;
      }
    }
    const { data: chat } = await supabase.from('chats').insert({ type: 'private', created_by: profile.id }).select('*').maybeSingle();
    if (chat) {
      await supabase.from('chat_members').insert([
        { chat_id: chat.id, user_id: profile.id },
        { chat_id: chat.id, user_id: other.id },
      ]);
      onCreated(chat as Chat);
    }
    setBusy(false);
  };

  const createGroup = async () => {
    if (!profile || selected.length === 0 || !groupName.trim()) return;
    setBusy(true);
    const { data: chat } = await supabase.from('chats').insert({ type: 'group', title: groupName.trim(), created_by: profile.id }).select('*').maybeSingle();
    if (chat) {
      const members = [{ chat_id: chat.id, user_id: profile.id, is_admin: true }, ...selected.map((s) => ({ chat_id: chat.id, user_id: s.id }))];
      await supabase.from('chat_members').insert(members);
      onCreated(chat as Chat);
    }
    setBusy(false);
  };

  const filtered = users.filter((u) =>
    u.display_name.toLowerCase().includes(search.toLowerCase()) ||
    (u.username ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (p: Profile) => {
    setSelected((prev) => prev.some((s) => s.id === p.id) ? prev.filter((s) => s.id !== p.id) : [...prev, p]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md h-[80vh] sm:h-[600px] bg-white dark:bg-slate-900 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"><X size={20} /></button>
          <h3 className="font-semibold flex-1">{mode === 'group' ? 'New Group' : 'New Chat'}</h3>
          <button
            onClick={() => setMode(mode === 'group' ? 'select' : 'group')}
            className="text-sm font-medium text-aqua-500 hover:text-aqua-600"
          >
            {mode === 'group' ? 'Cancel' : 'Group'}
          </button>
        </div>

        {mode === 'group' && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 outline-none focus:ring-2 ring-aqua-400"
            />
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {selected.map((s) => (
                  <span key={s.id} className="text-xs px-2 py-1 rounded-full bg-aqua-100 dark:bg-aqua-950/40 text-aqua-600">{s.display_name}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="relative p-3 border-b border-slate-200 dark:border-slate-800">
          <Search size={16} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people..." className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-slate-100 dark:bg-slate-800 outline-none focus:ring-2 ring-aqua-400" />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.map((u) => {
            const isSel = selected.some((s) => s.id === u.id);
            return (
              <button
                key={u.id}
                onClick={() => mode === 'group' ? toggleSelect(u) : startPrivate(u)}
                disabled={busy}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition text-left disabled:opacity-50"
              >
                <Avatar name={u.display_name} url={u.avatar_url} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.display_name}</p>
                  <p className="text-xs text-slate-400 truncate">@{u.username ?? 'no-username'}</p>
                </div>
                {mode === 'group' && (
                  <div className={cn('w-5 h-5 rounded-full border-2 transition', isSel ? 'bg-aqua-500 border-aqua-500' : 'border-ink-300 dark:border-ink-600')} />
                )}
              </button>
            );
          })}
          {filtered.length === 0 && !busy && (
            <p className="text-center text-sm text-slate-400 py-8">No people found.</p>
          )}
        </div>

        {mode === 'group' && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={createGroup}
              disabled={busy || !groupName.trim() || selected.length === 0}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-aqua-500 to-ocean-500 text-white font-semibold shadow-lg shadow-aqua-500/25 hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
              Create Group ({selected.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
