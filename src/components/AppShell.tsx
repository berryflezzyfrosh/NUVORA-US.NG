import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { NUVOVA_CONFIG } from '@/config';
import type { Chat, ChatMember, Message, Profile, MessageReaction } from '@/types';
import { Avatar } from '@/components/Avatar';
import { NuvoLogo } from '@/components/NuvoLogo';
import { cn, formatTime, relativeTime } from '@/lib/utils';
import {
  MessageSquare, Search, Plus, Users, Megaphone, Pin, Archive, Star,
  ChevronLeft, Send, Phone, Video, MoreVertical, Paperclip, Smile,
  Check, CheckCheck, Reply, Edit3, Trash2, Copy, Forward, X, Sparkles,
  Settings, UserCircle, Radio, Bell, Image as ImageIcon, Mic, Info,
  Globe, Shield, Lock, LogOut, Moon, Sun, Camera, Bookmark,
  Trash, UserPlus, ChevronRight, Play, Pause, Volume2, PhoneOff,
  MicOff, VideoOff, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Users2, Crown, Hash, Eye, EyeOff, BellOff, Download, Monitor,
  Heart, ThumbsUp, Laugh, Frown, Zap, PartyPopper, PlusCircle
} from 'lucide-react';
import { NuraPanel } from '@/components/NuraPanel';
import { NewChatModal } from '@/components/NewChatModal';
import { useTheme } from '@/lib/theme';

type View = 'chats' | 'contacts' | 'status' | 'channels' | 'calls' | 'communities' | 'settings' | 'about';

const QUICK_REACTIONS = [
  { emoji: '👍', icon: ThumbsUp },
  { emoji: '❤️', icon: Heart },
  { emoji: '😂', icon: Laugh },
  { emoji: '😮', icon: Zap },
  { emoji: '😢', icon: Frown },
  { emoji: '🎉', icon: PartyPopper },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const [view, setView] = useState<View>('chats');
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [members, setMembers] = useState<Record<string, Profile[]>>({});
  const [memberInfo, setMemberInfo] = useState<Record<string, ChatMember[]>>({});
  const [lastMessages, setLastMessages] = useState<Record<string, Message | null>>({});
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNura, setShowNura] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups' | 'archived'>('all');
  const [callState, setCallState] = useState<{ chat: Chat; type: 'voice' | 'video' } | null>(null);

  const loadChats = useCallback(async () => {
    if (!profile) return;
    const { data: memData } = await supabase
      .from('chat_members')
      .select('chat_id, user_id, is_admin, muted, pinned, archived, last_read_at, joined_at, profiles!inner(*)')
      .eq('user_id', profile.id);

    if (!memData || memData.length === 0) {
      setChats([]);
      return;
    }
    const chatIds = memData.map((m) => m.chat_id);
    const { data: chatData } = await supabase
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .order('updated_at', { ascending: false });

    const memberMap: Record<string, Profile[]> = {};
    const infoMap: Record<string, ChatMember[]> = {};
    for (const m of memData as any[]) {
      if (!memberMap[m.chat_id]) memberMap[m.chat_id] = [];
      if (!infoMap[m.chat_id]) infoMap[m.chat_id] = [];
      if (m.profiles) memberMap[m.chat_id].push(m.profiles as Profile);
      infoMap[m.chat_id].push({
        id: m.id, chat_id: m.chat_id, user_id: m.user_id,
        is_admin: m.is_admin, muted: m.muted, pinned: m.pinned, archived: m.archived,
        last_read_at: m.last_read_at, joined_at: m.joined_at,
      });
    }
    setMembers(memberMap);
    setMemberInfo(infoMap);
    setChats(chatData ?? []);

    for (const cid of chatIds) {
      supabase
        .from('messages')
        .select('*, sender:profiles!messages_sender_id_fkey(*)')
        .eq('chat_id', cid)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          setLastMessages((prev) => ({ ...prev, [cid]: data }));
        });
    }
  }, [profile]);

  useEffect(() => {
    loadChats();
    const sub = supabase
      .channel('chat_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, () => loadChats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, () => loadChats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadChats())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [loadChats]);

  const otherMember = (chat: Chat): Profile | null => {
    if (!profile) return null;
    if (chat.type !== 'private') return null;
    const list = members[chat.id] ?? [];
    return list.find((p) => p.id !== profile.id) ?? null;
  };

  const chatTitle = (chat: Chat): string => {
    if (chat.type === 'private') {
      const other = otherMember(chat);
      return other?.display_name ?? 'Unknown';
    }
    return chat.title ?? 'Group';
  };

  const chatAvatar = (chat: Chat): string | null => {
    if (chat.type === 'private') {
      const other = otherMember(chat);
      return other?.avatar_url ?? null;
    }
    return chat.avatar_url;
  };

  const isPinned = (chatId: string) => memberInfo[chatId]?.find((m) => m.user_id === profile?.id)?.pinned ?? false;
  const isArchived = (chatId: string) => memberInfo[chatId]?.find((m) => m.user_id === profile?.id)?.archived ?? false;
  const isMuted = (chatId: string) => memberInfo[chatId]?.find((m) => m.user_id === profile?.id)?.muted ?? false;

  const togglePin = async (chatId: string) => {
    if (!profile) return;
    const myMember = memberInfo[chatId]?.find((m) => m.user_id === profile.id);
    if (!myMember) return;
    await supabase.from('chat_members').update({ pinned: !myMember.pinned }).eq('id', myMember.id);
    loadChats();
  };

  const toggleArchive = async (chatId: string) => {
    if (!profile) return;
    const myMember = memberInfo[chatId]?.find((m) => m.user_id === profile.id);
    if (!myMember) return;
    await supabase.from('chat_members').update({ archived: !myMember.archived }).eq('id', myMember.id);
    loadChats();
  };

  const startPrivateChat = async (other: Profile) => {
    if (!profile) return;
    setShowNura(false);
    setMobileChatOpen(true);
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
        setActiveChat(existing.chat as unknown as Chat);
        setView('chats');
        return;
      }
    }

    const { data: chat } = await supabase.from('chats').insert({ type: 'private', created_by: profile.id }).select('*').maybeSingle();
    if (chat) {
      await supabase.from('chat_members').insert([
        { chat_id: chat.id, user_id: profile.id },
        { chat_id: chat.id, user_id: other.id },
      ]);
      setActiveChat(chat as Chat);
      setView('chats');
    }
  };

  const filtered = chats.filter((c) => {
    if (filter === 'archived') return isArchived(c.id);
    if (isArchived(c.id)) return false;
    if (filter === 'groups') return c.type === 'group';
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return chatTitle(c).toLowerCase().includes(q);
  }).sort((a, b) => {
    const ap = isPinned(a.id) ? 1 : 0;
    const bp = isPinned(b.id) ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return (
    <div className="h-screen flex bg-ink-50 dark:bg-ink-950 text-ink-900 dark:text-white overflow-hidden">
      <aside className={cn(
        'w-80 shrink-0 bg-white dark:bg-ink-900 border-r border-ink-200 dark:border-ink-800 flex flex-col transition-all relative',
        mobileChatOpen ? 'hidden md:flex' : 'flex'
      )}>
        <div className="p-4 border-b border-ink-200 dark:border-ink-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <NuvoLogo size={36} />
              <span className="font-extrabold text-lg tracking-tight">NUVORA</span>
            </div>
            <button
              onClick={() => setShowNura(true)}
              className="p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition group"
              title="Ask NURA"
            >
              <Sparkles size={20} className="text-aqua-500 group-hover:scale-110 transition" />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 transition"
            />
          </div>
        </div>

        <div className="flex gap-1 px-3 py-2 overflow-x-auto">
          {(['all', 'unread', 'groups', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap capitalize transition',
                filter === f
                  ? 'bg-aqua-500 text-white shadow-sm'
                  : 'bg-ink-100 dark:bg-ink-800 text-ink-400 hover:bg-ink-200 dark:hover:bg-ink-700'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-ink-400 px-6 text-center">
              <MessageSquare size={40} className="mb-3 opacity-40" />
              <p className="text-sm">
                No chats yet. Tap the + button to create a new chat, invite users, and start messaging.
              </p>
            </div>
          ) : (
            filtered.map((chat) => {
              const lm = lastMessages[chat.id];
              const lastText = lm?.deleted_for_everyone ? 'Message deleted' : lm?.body ?? 'Tap to chat';
              return (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  title={chatTitle(chat)}
                  avatarUrl={chatAvatar(chat)}
                  lastMessage={lastText}
                  lastTime={lm?.created_at ?? chat.updated_at}
                  senderName={lm?.sender?.display_name}
                  active={activeChat?.id === chat.id}
                  pinned={isPinned(chat.id)}
                  muted={isMuted(chat.id)}
                  onClick={() => { setActiveChat(chat); setMobileChatOpen(true); }}
                  onPin={() => togglePin(chat.id)}
                  onArchive={() => toggleArchive(chat.id)}
                />
              );
            })
          )}
        </div>

        <button
          onClick={() => setShowNewChat(true)}
          className="absolute bottom-24 left-6 w-12 h-12 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 text-white shadow-lg shadow-aqua-500/30 hover:scale-110 active:scale-95 transition flex items-center justify-center z-10"
        >
          <Plus size={24} />
        </button>

        <nav className="border-t border-ink-200 dark:border-ink-800 p-1.5 flex justify-between gap-1 px-2 overflow-x-auto">
          <NavIcon icon={MessageSquare} label="Chats" active={view === 'chats'} onClick={() => setView('chats')} />
          <NavIcon icon={UserCircle} label="Contacts" active={view === 'contacts'} onClick={() => setView('contacts')} />
          <NavIcon icon={Radio} label="Status" active={view === 'status'} onClick={() => setView('status')} />
          <NavIcon icon={Megaphone} label="Channels" active={view === 'channels'} onClick={() => setView('channels')} />
          <NavIcon icon={Users2} label="Communities" active={view === 'communities'} onClick={() => setView('communities')} />
          <NavIcon icon={Phone} label="Calls" active={view === 'calls'} onClick={() => setView('calls')} />
          <NavIcon icon={Settings} label="Settings" active={view === 'settings'} onClick={() => setView('settings')} />
        </nav>
      </aside>

      <main className={cn('flex-1 flex flex-col min-w-0', mobileChatOpen ? 'flex' : 'hidden md:flex')}>
        {view !== 'chats' ? (
          <SecondaryView
            view={view}
            setView={setView}
            onBack={() => setView('chats')}
            onCall={(chat, type) => setCallState({ chat, type })}
            onMessage={startPrivateChat}
          />
        ) : activeChat ? (
          <ChatView
            chat={activeChat}
            members={members[activeChat.id] ?? []}
            onBack={() => setMobileChatOpen(false)}
            onShowNura={() => setShowNura(true)}
            onCall={(type) => setCallState({ chat: activeChat, type })}
          />
        ) : (
          <EmptyState onShowNura={() => setShowNura(true)} />
        )}
      </main>

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} onCreated={(c) => { setActiveChat(c); setShowNewChat(false); setMobileChatOpen(true); }} />}
      {showNura && <NuraPanel onClose={() => setShowNura(false)} />}
      {callState && <CallScreen chat={callState.chat} type={callState.type} members={members[callState.chat.id] ?? []} onClose={() => setCallState(null)} />}
    </div>
  );
}

function NavIcon({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition', active ? 'text-aqua-500' : 'text-ink-400 hover:text-ink-600 dark:hover:text-ink-200')}>
      <Icon size={20} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function ChatListItem({ chat, title, avatarUrl, lastMessage, lastTime, senderName, active, pinned, muted, onClick, onPin, onArchive }: {
  chat: Chat; title: string; avatarUrl: string | null; lastMessage: string; lastTime: string;
  senderName?: string; active: boolean; pinned: boolean; muted: boolean;
  onClick: () => void; onPin: () => void; onArchive: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-3 hover:bg-ink-50 dark:hover:bg-ink-800/50 transition text-left',
          active && 'bg-aqua-50 dark:bg-aqua-950/20'
        )}
      >
        <div className="relative">
          <Avatar name={title} url={avatarUrl} size={48} />
          {chat.type === 'private' && (
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-aqua-500 ring-2 ring-white dark:ring-ink-900" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold truncate">{title}</span>
              {muted && <BellOff size={12} className="text-ink-400 shrink-0" />}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {pinned && <Pin size={12} className="text-ink-400" />}
              <span className="text-xs text-ink-400">{relativeTime(lastTime)}</span>
            </div>
          </div>
          <p className="text-sm text-ink-400 truncate">
            {chat.type === 'group' && senderName && <span className="font-medium text-ink-500 dark:text-ink-300">{senderName.split(' ')[0]}: </span>}
            {lastMessage}
          </p>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-ink-200 dark:hover:bg-ink-700 transition"
      >
        <MoreVertical size={14} className="text-ink-400" />
      </button>
      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-2 top-12 z-20 bg-white dark:bg-ink-800 rounded-xl shadow-xl ring-1 ring-ink-200 dark:ring-ink-700 py-1 w-40 text-sm">
            <button onClick={() => { onPin(); setMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-100 dark:hover:bg-ink-700 transition text-left">
              <Pin size={14} /> {pinned ? 'Unpin' : 'Pin'}
            </button>
            <button onClick={() => { onArchive(); setMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-100 dark:hover:bg-ink-700 transition text-left">
              <Archive size={14} /> {pinned ? 'Archive' : 'Archive'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ onShowNura }: { onShowNura: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-ink-50 dark:bg-ink-950 text-center px-8">
      <NuvoLogo size={80} className="drop-shadow-xl mb-6" />
      <h2 className="text-2xl font-bold mb-2">Welcome to NUVORA</h2>
      <p className="text-ink-400 max-w-md mb-6">
        Select a conversation to start messaging, or create a new chat. Your messages are private and secured.
      </p>
      <button
        onClick={onShowNura}
        className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-aqua-500 to-ocean-500 text-white font-semibold shadow-lg shadow-aqua-500/25 hover:scale-105 transition"
      >
        <Sparkles size={18} />
        Ask NURA anything
      </button>
    </div>
  );
}

function ChatView({ chat, members, onBack, onShowNura, onCall }: { chat: Chat; members: Profile[]; onBack: () => void; onShowNura: () => void; onCall: (type: 'voice' | 'video') => void }) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Record<string, MessageReaction[]>>({});
  const [input, setInput] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const other = chat.type === 'private' ? members.find((m) => m.id !== profile?.id) : null;
  const title = chat.type === 'private' ? (other?.display_name ?? 'Unknown') : (chat.title ?? 'Group');

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(*), reply_to_message:messages!messages_reply_to_fkey(*)')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages(data ?? []);

    const { data: reactData } = await supabase
      .from('message_reactions')
      .select('*, user:profiles!message_reactions_user_id_fkey(display_name)')
      .in('message_id', (data ?? []).map((m) => m.id));
    const rMap: Record<string, MessageReaction[]> = {};
    for (const r of reactData ?? []) {
      if (!rMap[r.message_id]) rMap[r.message_id] = [];
      rMap[r.message_id].push(r);
    }
    setReactions(rMap);
  }, [chat.id]);

  useEffect(() => {
    loadMessages();
    const sub = supabase
      .channel(`chat-${chat.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, () => loadMessages())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, () => loadMessages())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, () => loadMessages())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => loadMessages())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [chat.id, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!profile || !input.trim()) return;
    if (editingId) {
      await supabase.from('messages').update({ body: input.trim(), edited: true, updated_at: new Date().toISOString() }).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('messages').insert({
        chat_id: chat.id,
        body: input.trim(),
        reply_to: replyTo?.id ?? null,
      });
    }
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);
  };

  const deleteMessage = async (m: Message) => {
    await supabase.from('messages').update({ deleted_for_everyone: true, body: null, updated_at: new Date().toISOString() }).eq('id', m.id);
    setMenuFor(null);
  };

  const startEdit = (m: Message) => {
    setEditingId(m.id);
    setInput(m.body ?? '');
    setMenuFor(null);
  };

  const copyMessage = (m: Message) => {
    if (m.body) navigator.clipboard.writeText(m.body);
    setMenuFor(null);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!profile) return;
    const existing = reactions[messageId]?.find((r) => r.user_id === profile.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: profile.id, emoji });
    }
    setReactionFor(null);
  };

  const startRecording = () => {
    setRecording(true);
    setRecordTime(0);
    recordTimer.current = setInterval(() => setRecordTime((t) => t + 1), 1000);
  };

  const stopRecording = () => {
    setRecording(false);
    if (recordTimer.current) clearInterval(recordTimer.current);
    setRecordTime(0);
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800">
          <ChevronLeft size={20} />
        </button>
        <Avatar name={title} url={chat.type === 'private' ? other?.avatar_url : chat.avatar_url} size={40} />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">{title}</h3>
          <p className="text-xs text-ink-400">
            {chat.type === 'private' ? (other?.verified ? 'verified' : 'online') : `${members.length} members`}
          </p>
        </div>
        <button onClick={() => onCall('voice')} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition" title="Voice call">
          <Phone size={18} />
        </button>
        <button onClick={() => onCall('video')} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition" title="Video call">
          <Video size={18} />
        </button>
        <button onClick={onShowNura} className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition" title="Ask NURA">
          <Sparkles size={18} className="text-aqua-500" />
        </button>
        <button className="p-2 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition">
          <MoreVertical size={18} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1 chat-bg-light dark:chat-bg-dark">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-400 text-center">
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === profile?.id;
            if (m.deleted_for_everyone) {
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <span className="text-xs italic text-ink-400 px-3 py-1.5 rounded-xl bg-ink-100 dark:bg-ink-800/50">
                    This message was deleted
                  </span>
                </div>
              );
            }
            const msgReactions = reactions[m.id] ?? [];
            return (
              <div key={m.id} className={cn('group relative flex flex-col', mine ? 'items-end' : 'items-start')}>
                {m.reply_to_message && (
                  <div className={cn('max-w-xs mb-1 px-3 py-1 text-xs rounded-lg border-l-2 border-aqua-400 bg-ink-100 dark:bg-ink-800/60 text-ink-500', mine ? 'self-end' : 'self-start')}>
                    {m.reply_to_message.body ?? 'Media'}
                  </div>
                )}
                <div
                  className={cn(
                    'relative max-w-[75%] px-3.5 py-2 rounded-2xl text-sm',
                    mine
                      ? 'bg-gradient-to-br from-aqua-500 to-ocean-500 text-white rounded-br-md'
                      : 'bg-white dark:bg-ink-800 text-ink-900 dark:text-white rounded-bl-md shadow-sm'
                  )}
                >
                  {chat.type !== 'private' && !mine && m.sender && (
                    <span className="block text-xs font-semibold mb-0.5 text-ocean-500">{m.sender.display_name}</span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <div className={cn('flex items-center gap-1 mt-0.5', mine ? 'justify-end text-aqua-100' : 'text-ink-400')}>
                    {m.edited && <span className="text-[10px] italic">edited</span>}
                    <span className="text-[10px]">{formatTime(m.created_at)}</span>
                    {mine && <CheckCheck size={13} className="text-aqua-100" />}
                  </div>

                  {msgReactions.length > 0 && (
                    <div className={cn('flex gap-1 mt-1 flex-wrap', mine ? 'justify-end' : 'justify-start')}>
                      {msgReactions.reduce((acc: { emoji: string; count: number }[], r) => {
                        const ex = acc.find((a) => a.emoji === r.emoji);
                        if (ex) ex.count++;
                        else acc.push({ emoji: r.emoji, count: 1 });
                        return acc;
                      }, []).map((r) => (
                        <span key={r.emoji} className="text-xs bg-ink-100 dark:bg-ink-700/60 rounded-full px-1.5 py-0.5">
                          {r.emoji} {r.count > 1 && r.count}
                        </span>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                    className="absolute -top-2 opacity-0 group-hover:opacity-100 transition right-1 w-6 h-6 rounded-full bg-ink-200 dark:bg-ink-700 flex items-center justify-center"
                  >
                    <MoreVertical size={12} />
                  </button>

                  {menuFor === m.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                      <div className="absolute z-30 top-4 right-0 bg-white dark:bg-ink-800 rounded-xl shadow-xl ring-1 ring-ink-200 dark:ring-ink-700 py-1 w-44 text-sm">
                        <div className="flex justify-around px-2 py-1.5 border-b border-ink-100 dark:border-ink-700">
                          {QUICK_REACTIONS.map((qr) => (
                            <button key={qr.emoji} onClick={() => { toggleReaction(m.id, qr.emoji); setMenuFor(null); }} className="text-lg hover:scale-125 transition">
                              {qr.emoji}
                            </button>
                          ))}
                        </div>
                        <MenuBtn icon={Reply} label="Reply" onClick={() => { setReplyTo(m); setMenuFor(null); }} />
                        <MenuBtn icon={Copy} label="Copy" onClick={() => copyMessage(m)} />
                        <MenuBtn icon={Forward} label="Forward" onClick={() => setMenuFor(null)} />
                        {mine && <MenuBtn icon={Edit3} label="Edit" onClick={() => startEdit(m)} />}
                        {mine && <MenuBtn icon={Trash2} label="Delete" danger onClick={() => deleteMessage(m)} />}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {replyTo && (
        <div className="px-4 py-2 bg-ink-100 dark:bg-ink-800/60 border-t border-ink-200 dark:border-ink-700 flex items-center gap-2 text-sm">
          <Reply size={16} className="text-aqua-500" />
          <span className="flex-1 truncate text-ink-500">Replying to: {replyTo.body ?? 'Media'}</span>
          <button onClick={() => setReplyTo(null)} className="p-1 rounded hover:bg-ink-200 dark:hover:bg-ink-700"><X size={16} /></button>
        </div>
      )}

      {showEmoji && (
        <div className="px-4 py-3 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800 grid grid-cols-10 gap-1">
          {['😀','😂','🥰','😎','🤔','😢','😡','👍','👎','❤️','🔥','🎉','✨','💯','🙏','👏','🤝','💪','😴','🤯','😍','🥳','😇','🤗','🙄','😱','🥺','😏','🎶','☕'].map((e) => (
            <button key={e} onClick={() => insertEmoji(e)} className="text-xl p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition">{e}</button>
          ))}
        </div>
      )}

      {showAttach && (
        <div className="px-4 py-3 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800 grid grid-cols-4 gap-3">
          <AttachBtn icon={ImageIcon} label="Photo" color="bg-violet-500" onClick={() => setShowAttach(false)} />
          <AttachBtn icon={Camera} label="Camera" color="bg-rose-500" onClick={() => setShowAttach(false)} />
          <AttachBtn icon={Mic} label="Audio" color="bg-amber-500" onClick={() => setShowAttach(false)} />
          <AttachBtn icon={Bookmark} label="Document" color="bg-ocean-500" onClick={() => setShowAttach(false)} />
        </div>
      )}

      <div className="p-3 bg-white dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800 flex items-end gap-2">
        <button onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); }} className="p-2.5 rounded-full hover:bg-ink-100 dark:hover:bg-ink-800 transition" title="Attach">
          <Paperclip size={20} className={cn('text-ink-400 transition', showAttach && 'rotate-45 text-aqua-500')} />
        </button>
        <div className="flex-1 flex items-end gap-2 bg-ink-100 dark:bg-ink-800 rounded-3xl px-4 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={editingId ? 'Edit message...' : 'Type a message...'}
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none max-h-24 text-sm"
          />
          <button onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); }} className="p-1 text-ink-400 hover:text-aqua-500 transition">
            <Smile size={20} />
          </button>
        </div>
        {input.trim() ? (
          <button onClick={send} className="p-3 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 text-white shadow-lg hover:scale-105 active:scale-95 transition">
            <Send size={18} />
          </button>
        ) : recording ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-rose-500 font-mono">{Math.floor(recordTime / 60)}:{String(recordTime % 60).padStart(2, '0')}</span>
            <button onClick={stopRecording} className="p-3 rounded-full bg-rose-500 text-white shadow-lg hover:scale-105 transition">
              <Trash2 size={18} />
            </button>
            <button onClick={stopRecording} className="p-3 rounded-full bg-aqua-500 text-white shadow-lg hover:scale-105 transition">
              <Send size={18} />
            </button>
          </div>
        ) : (
          <button onClick={startRecording} className="p-2.5 rounded-full hover:bg-ink-100 dark:hover:bg-ink-800 transition" title="Voice note">
            <Mic size={20} className="text-ink-400" />
          </button>
        )}
      </div>
    </div>
  );
}

function MenuBtn({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 hover:bg-ink-100 dark:hover:bg-ink-700 transition text-left',
        danger ? 'text-rose-500' : 'text-ink-700 dark:text-ink-200'
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function AttachBtn({ icon: Icon, label, color, onClick }: { icon: any; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition">
      <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', color)}>
        <Icon size={22} className="text-white" />
      </div>
      <span className="text-xs text-ink-500 dark:text-ink-300">{label}</span>
    </button>
  );
}

function CallScreen({ chat, type, members, onClose }: { chat: Chat; type: 'voice' | 'video'; members: Profile[]; onClose: () => void }) {
  const { profile } = useAuth();
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [connected, setConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 2000);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => { clearTimeout(t); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const other = chat.type === 'private' ? members.find((m) => m.id !== profile?.id) : null;
  const name = chat.type === 'private' ? (other?.display_name ?? 'Unknown') : (chat.title ?? 'Group');

  const fmtDuration = `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-gradient-to-br from-ink-900 via-ink-950 to-ink-900 p-6">
      {type === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt={name} className="w-full h-full object-cover opacity-40" />
          ) : (
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-aqua-500 to-ocean-500 flex items-center justify-center text-5xl font-bold text-white">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center mt-12">
        {type === 'voice' && (
          <Avatar name={name} url={other?.avatar_url ?? chat.avatar_url} size={120} className="ring-4 ring-white/20" />
        )}
        <h2 className="mt-6 text-2xl font-bold text-white">{name}</h2>
        <p className="mt-2 text-sm text-white/60">
          {connected ? (
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-aqua-500 animate-pulse" />
              {type === 'video' ? 'Video call' : 'Voice call'} · {fmtDuration}
            </span>
          ) : (
            'Calling...'
          )}
        </p>
      </div>

      {type === 'video' && videoOff && (
        <div className="absolute top-6 right-6 w-32 h-44 rounded-2xl bg-ink-800 flex items-center justify-center ring-2 ring-white/10">
          <span className="text-xs text-white/40">You</span>
        </div>
      )}

      <div className="relative z-10 flex items-center gap-4 mb-12">
        <CallBtn icon={muted ? MicOff : Mic} active={muted} onClick={() => setMuted(!muted)} />
        <CallBtn icon={videoOff ? VideoOff : Video} active={videoOff} onClick={() => setVideoOff(!videoOff)} />
        <CallBtn icon={Volume2} active={speaker} onClick={() => setSpeaker(!speaker)} />
        <button onClick={onClose} className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-xl transition hover:scale-105">
          <PhoneOff size={26} className="text-white" />
        </button>
      </div>
    </div>
  );
}

function CallBtn({ icon: Icon, active, onClick }: { icon: any; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('w-14 h-14 rounded-full flex items-center justify-center transition hover:scale-105', active ? 'bg-white text-ink-900' : 'bg-white/10 text-white backdrop-blur')}>
      <Icon size={22} />
    </button>
  );
}

function SecondaryView({ view, setView, onBack, onCall, onMessage }: { view: View; setView: (v: View) => void; onBack: () => void; onCall: (chat: Chat, type: 'voice' | 'video') => void; onMessage: (other: Profile) => void }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-4 bg-white dark:bg-ink-900 border-b border-ink-200 dark:border-ink-800">
        <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800"><ChevronLeft size={20} /></button>
        <h2 className="text-lg font-semibold capitalize">{view}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {view === 'contacts' && <ContactsView onMessage={onMessage} />}
        {view === 'status' && <StatusView />}
        {view === 'channels' && <ChannelsView />}
        {view === 'communities' && <CommunitiesView />}
        {view === 'calls' && <CallsView />}
        {view === 'settings' && <SettingsView />}
        {view === 'about' && <AboutView />}
      </div>
    </div>
  );
}

function ContactsView({ onMessage }: { onMessage: (other: Profile) => void }) {
  const { profile } = useAuth();
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    supabase.from('contacts').select('profile:profiles!contacts_contact_id_fkey(*)').eq('owner_id', profile.id).then(({ data }) => {
      setContacts((data ?? []).map((d: any) => d.profile).filter(Boolean));
    });
    supabase.from('profiles').select('*').neq('id', profile.id).limit(50).then(({ data }) => setAllUsers(data ?? []));
  }, [profile]);

  const addContact = async (p: Profile) => {
    if (!profile) return;
    await supabase.from('contacts').insert({ owner_id: profile.id, contact_id: p.id });
    setContacts((prev) => [...prev, p]);
  };

  const filtered = allUsers.filter((u) => !contacts.some((c) => c.id === u.id));
  const searchResults = filtered.filter((u) => u.display_name.toLowerCase().includes(search.toLowerCase()) || (u.username ?? '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find people by name or username..." className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400" />
      </div>
      <h3 className="text-sm font-semibold text-ink-400 mb-3">Your Contacts ({contacts.length})</h3>
      <div className="space-y-1 mb-8">
        {contacts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition">
            <Avatar name={c.display_name} url={c.avatar_url} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{c.display_name}</p>
              <p className="text-xs text-ink-400 truncate">@{c.username ?? 'no-username'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onMessage(c)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-aqua-500 border border-aqua-200 hover:bg-aqua-50 transition">
                Message
              </button>
              {c.verified && <span className="text-xs text-ocean-500 font-medium">Verified</span>}
            </div>
          </div>
        ))}
        {contacts.length === 0 && <p className="text-sm text-ink-400">No contacts yet. Add people below.</p>}
      </div>
      {searchResults.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-ink-400 mb-3">Suggested</h3>
          <div className="space-y-1">
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition">
                <Avatar name={u.display_name} url={u.avatar_url} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.display_name}</p>
                  <p className="text-xs text-ink-400 truncate">@{u.username ?? 'no-username'}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onMessage(u)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white text-aqua-500 border border-aqua-200 hover:bg-aqua-50 transition">
                    Message
                  </button>
                  <button onClick={() => addContact(u)} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-aqua-500 text-white hover:bg-aqua-600 transition">
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusView() {
  const { profile } = useAuth();
  const [statuses, setStatuses] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState('from-aqua-500 to-ocean-500');

  const load = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase.from('statuses').select('*, profile:profiles!statuses_user_id_fkey(*)').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false });
    setStatuses(data ?? []);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    if (!profile || !text.trim()) return;
    await supabase.from('statuses').insert({ user_id: profile.id, body: text.trim(), background: bgColor });
    setText('');
    load();
  };

  const bgOptions = [
    'from-aqua-500 to-ocean-500',
    'from-rose-500 to-pink-600',
    'from-amber-500 to-orange-600',
    'from-violet-500 to-purple-600',
    'from-ink-700 to-ink-900',
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Post a status</h3>
        <div className="flex gap-2 mb-3">
          {bgOptions.map((bg) => (
            <button key={bg} onClick={() => setBgColor(bg)} className={cn('w-8 h-8 rounded-full bg-gradient-to-br transition', bg, bgColor === bg && 'ring-2 ring-offset-2 ring-aqua-400 dark:ring-offset-ink-950')} />
          ))}
        </div>
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="What's on your mind?" className="flex-1 px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400" />
          <button onClick={post} className="px-4 py-2.5 rounded-xl bg-aqua-500 text-white font-medium text-sm hover:bg-aqua-600 transition">Post</button>
        </div>
      </div>
      <h3 className="text-sm font-semibold text-ink-400 mb-3">Recent Updates</h3>
      <div className="space-y-3">
        {statuses.map((s) => (
          <div key={s.id} className={cn('p-6 rounded-2xl text-white relative overflow-hidden', s.background ? `bg-gradient-to-br ${s.background}` : 'bg-gradient-to-br from-aqua-500 to-ocean-500')}>
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={s.profile?.display_name ?? 'User'} url={s.profile?.avatar_url} size={36} />
              <div>
                <p className="font-medium text-sm text-white">{s.profile?.display_name}</p>
                <p className="text-xs text-white/70">{relativeTime(s.created_at)}</p>
              </div>
            </div>
            <p className="text-lg font-medium">{s.body}</p>
          </div>
        ))}
        {statuses.length === 0 && <p className="text-sm text-ink-400">No status updates. Be the first to share!</p>}
      </div>
    </div>
  );
}

function ChannelsView() {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('channels').select('*').order('created_at', { ascending: false });
    setChannels(data ?? []);
    if (profile) {
      const { data: f } = await supabase.from('channel_followers').select('channel_id').eq('user_id', profile.id);
      setFollowed(new Set((f ?? []).map((x) => x.channel_id)));
    }
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!profile || !name.trim()) return;
    await supabase.from('channels').insert({ name: name.trim(), owner_id: profile.id, description: desc.trim() || null, handle: name.trim().toLowerCase().replace(/\s+/g, '-') });
    setName('');
    setDesc('');
    load();
  };

  const toggleFollow = async (channelId: string) => {
    if (!profile) return;
    if (followed.has(channelId)) {
      await supabase.from('channel_followers').delete().eq('channel_id', channelId).eq('user_id', profile.id);
      setFollowed((prev) => { const n = new Set(prev); n.delete(channelId); return n; });
    } else {
      await supabase.from('channel_followers').insert({ channel_id: channelId, user_id: profile.id });
      setFollowed((prev) => new Set(prev).add(channelId));
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Create a channel</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" className="w-full px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 mb-2" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 mb-2" />
        <button onClick={create} className="px-4 py-2.5 rounded-xl bg-aqua-500 text-white font-medium text-sm hover:bg-aqua-600 transition">Create Channel</button>
      </div>
      <div className="space-y-2">
        {channels.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">{c.name[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate flex items-center gap-1">{c.name} {c.verified && <Check size={14} className="text-ocean-500" />}</p>
              <p className="text-xs text-ink-400 truncate">{c.description ?? 'No description'}</p>
            </div>
            <button onClick={() => toggleFollow(c.id)} className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition', followed.has(c.id) ? 'bg-ink-100 dark:bg-ink-700 text-ink-500' : 'bg-aqua-500 text-white hover:bg-aqua-600')}>
              {followed.has(c.id) ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
        {channels.length === 0 && <p className="text-sm text-ink-400">No channels yet.</p>}
      </div>
    </div>
  );
}

function CommunitiesView() {
  const { profile } = useAuth();
  const [communities, setCommunities] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('communities').select('*').order('created_at', { ascending: false });
    setCommunities(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!profile || !name.trim()) return;
    await supabase.from('communities').insert({ name: name.trim(), owner_id: profile.id, description: desc.trim() || null });
    setName('');
    setDesc('');
    load();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h3 className="font-semibold mb-3">Create a community</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Community name" className="w-full px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 mb-2" />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 mb-2" />
        <button onClick={create} className="px-4 py-2.5 rounded-xl bg-aqua-500 text-white font-medium text-sm hover:bg-aqua-600 transition">Create Community</button>
      </div>
      <div className="space-y-3">
        {communities.map((c) => (
          <div key={c.id} className="p-4 rounded-2xl bg-white dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aqua-500 to-ocean-500 flex items-center justify-center text-white font-bold text-xl">{c.name[0]}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate flex items-center gap-1.5">{c.name}</p>
                <p className="text-xs text-ink-400 truncate">{c.description ?? 'No description'}</p>
              </div>
            </div>
          </div>
        ))}
        {communities.length === 0 && <p className="text-sm text-ink-400">No communities yet. Create one to bring groups together.</p>}
      </div>
    </div>
  );
}

function CallsView() {
  const { profile } = useAuth();
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    supabase.from('calls').select('*, callee:profiles!calls_callee_id_fkey(*), caller:profiles!calls_caller_id_fkey(*)').or(`caller_id.eq.${profile.id},callee_id.eq.${profile.id}`).order('created_at', { ascending: false }).limit(50).then(({ data }) => setCalls(data ?? []));
  }, [profile]);

  const dirIcon = (direction: string, type: string) => {
    if (direction === 'missed') return <PhoneMissed size={16} className="text-rose-500" />;
    if (direction === 'incoming') return <PhoneIncoming size={16} className="text-aqua-500" />;
    return <PhoneOutgoing size={16} className="text-ink-400" />;
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h3 className="font-semibold mb-4">Call History</h3>
      <div className="space-y-1">
        {calls.map((c) => {
          const other = c.caller_id === profile?.id ? c.callee : c.caller;
          const isMissed = c.direction === 'missed' || c.status === 'missed';
          return (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 transition">
              <Avatar name={other?.display_name ?? 'Unknown'} url={other?.avatar_url} size={42} />
              <div className="flex-1 min-w-0">
                <p className={cn('font-medium truncate', isMissed && 'text-rose-500')}>{other?.display_name ?? 'Unknown'}</p>
                <div className="flex items-center gap-1.5">
                  {dirIcon(c.direction, c.type)}
                  <span className="text-xs text-ink-400">{c.direction} · {c.type} · {relativeTime(c.created_at)}</span>
                </div>
              </div>
              {c.type === 'video' ? <Video size={18} className="text-ink-400" /> : <Phone size={18} className="text-ink-400" />}
            </div>
          );
        })}
        {calls.length === 0 && <p className="text-sm text-ink-400">No call history.</p>}
      </div>
    </div>
  );
}

function SettingsView() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [section, setSection] = useState<'main' | 'privacy' | 'security' | 'notifications'>('main');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? '');
    setBio(profile.bio ?? '');
    setUsername(profile.username ?? '');
  }, [profile]);

  const save = async () => {
    if (!profile) return;
    setError(null);
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim();

    if (trimmedName.length < 2) {
      setError('Display name must be at least 2 characters.');
      return;
    }

    setSaving(true);

    if (trimmedUsername && trimmedUsername !== profile.username) {
      const { data: existing, error: existingError } = await supabase.from('profiles').select('id').eq('username', trimmedUsername).maybeSingle();
      if (existingError) {
        setError(existingError.message);
        setSaving(false);
        return;
      }
      if (existing) {
        setError('Username is already taken.');
        setSaving(false);
        return;
      }
    }

    await supabase.from('profiles').update({ display_name: trimmedName, bio, username: trimmedUsername || null }).eq('id', profile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;
    setPhotoError(null);
    setUploadingPhoto(true);

    const bucket = NUVOVA_CONFIG.supabaseStorageBucket;
    const extension = file.name.split('.').pop() ?? 'jpg';
    const path = `profiles/${profile.id}/avatar.${extension}`;

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (uploadError) {
      setPhotoError(uploadError.message);
      setUploadingPhoto(false);
      return;
    }

    const urlResponse = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = urlResponse?.data?.publicUrl;
    if (!publicUrl) {
      setPhotoError('Unable to create profile image URL.');
      setUploadingPhoto(false);
      return;
    }

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
    await refreshProfile();
    setUploadingPhoto(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const removePhoto = async () => {
    if (!profile) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', profile.id);
    await refreshProfile();
    setUploadingPhoto(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (section !== 'main') {
    return (
      <div className="max-w-2xl mx-auto">
        <button onClick={() => setSection('main')} className="flex items-center gap-1 text-sm text-ink-400 hover:text-aqua-500 transition mb-4">
          <ChevronLeft size={16} /> Back to settings
        </button>
        {section === 'privacy' && <PrivacySettings />}
        {section === 'security' && <SecuritySettings />}
        {section === 'notifications' && <NotificationSettings />}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          <Avatar name={profile?.display_name ?? 'User'} url={profile?.avatar_url} size={88} />
          <button onClick={handlePhotoSelect} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-aqua-500 flex items-center justify-center shadow-lg hover:scale-110 transition" title="Change profile photo">
            <Camera size={16} className="text-white" />
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        <h3 className="mt-3 font-semibold text-lg">{profile?.display_name}</h3>
        <p className="text-sm text-ink-400">@{profile?.username ?? 'no-username'}</p>
        {profile?.phone && <p className="text-sm text-ink-400">{profile.phone}</p>}
        <div className="mt-3 flex items-center gap-2">
          <button onClick={handlePhotoSelect} className="px-3 py-1.5 rounded-full bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-700 transition text-xs">
            {uploadingPhoto ? 'Uploading...' : 'Change photo'}
          </button>
          {profile?.avatar_url && (
            <button onClick={removePhoto} className="px-3 py-1.5 rounded-full border border-ink-200 dark:border-ink-700 text-xs text-ink-700 dark:text-ink-200 hover:bg-ink-100 dark:hover:bg-ink-800 transition">
              Remove photo
            </button>
          )}
        </div>
        {photoError && <p className="mt-2 text-xs text-rose-600">{photoError}</p>}
      </div>

      <section className="space-y-4">
        <h3 className="font-semibold">Profile</h3>
        {error && <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl px-4 py-2">{error}</div>}
        <SettingInput label="Display name" value={displayName} onChange={setDisplayName} />
        <SettingInput label="Username" value={username} onChange={(v) => setUsername(v.replace(/[^a-zA-Z0-9_]/g, ''))} />
        <div>
          <label className="text-xs font-medium text-ink-400 mb-1 block">Bio</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400 resize-none" />
        </div>
        <button onClick={save} disabled={saving || uploadingPhoto} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-aqua-500 to-ocean-500 text-white font-medium text-sm hover:shadow-lg transition disabled:opacity-60">
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold mb-2">Preferences</h3>
        <SettingsRow icon={theme === 'dark' ? Moon : Sun} label="Appearance" value={theme} onClick={toggleTheme} />
        <SettingsRow icon={Shield} label="Privacy" onClick={() => setSection('privacy')} chevron />
        <SettingsRow icon={Lock} label="Security" onClick={() => setSection('security')} chevron />
        <SettingsRow icon={Bell} label="Notifications" onClick={() => setSection('notifications')} chevron />
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold mb-2">Account</h3>
        <SettingsRow icon={Monitor} label="Linked devices" value="1 active" chevron />
        <SettingsRow icon={Download} label="Chat backup" value="Auto" chevron />
        <SettingsRow icon={LogOut} label="Sign out" onClick={signOut} danger />
      </section>
    </div>
  );
}

function PrivacySettings() {
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [profilePhoto, setProfilePhoto] = useState('everyone');
  const [statusPrivacy, setStatusPrivacy] = useState('contacts');

  return (
    <div className="space-y-6">
      <h3 className="font-semibold flex items-center gap-2"><Shield size={18} className="text-aqua-500" /> Privacy</h3>
      <ToggleRow label="Read receipts" desc="Show when you've read messages" value={readReceipts} onChange={setReadReceipts} />
      <ToggleRow label="Last seen" desc="Show when you were last active" value={lastSeen} onChange={setLastSeen} />
      <SelectRow label="Profile photo" value={profilePhoto} options={['everyone', 'contacts', 'nobody']} onChange={setProfilePhoto} />
      <SelectRow label="Status privacy" value={statusPrivacy} options={['everyone', 'contacts', 'nobody']} onChange={setStatusPrivacy} />
    </div>
  );
}

function SecuritySettings() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [autoLock, setAutoLock] = useState('1min');

  return (
    <div className="space-y-6">
      <h3 className="font-semibold flex items-center gap-2"><Lock size={18} className="text-aqua-500" /> Security</h3>
      <ToggleRow label="Two-factor authentication" desc="Add an extra layer of security" value={twoFactor} onChange={setTwoFactor} />
      <ToggleRow label="Biometric lock" desc="Use fingerprint or face to unlock" value={biometric} onChange={setBiometric} />
      <SelectRow label="Auto-lock timer" value={autoLock} options={['immediately', '1min', '5min', '15min']} onChange={setAutoLock} />
      <div className="p-4 rounded-xl bg-aqua-50 dark:bg-aqua-950/20 ring-1 ring-aqua-200 dark:ring-aqua-800">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} className="text-aqua-500" />
          <span className="text-sm font-medium">End-to-end encryption</span>
        </div>
        <p className="text-xs text-ink-400">Your messages and calls are secured with end-to-end encryption. Only you and the people you're talking with can read or listen to them.</p>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [messageNotifs, setMessageNotifs] = useState(true);
  const [groupNotifs, setGroupNotifs] = useState(true);
  const [callNotifs, setCallNotifs] = useState(true);
  const [preview, setPreview] = useState(true);

  return (
    <div className="space-y-6">
      <h3 className="font-semibold flex items-center gap-2"><Bell size={18} className="text-aqua-500" /> Notifications</h3>
      <ToggleRow label="Message notifications" desc="Notify when you receive messages" value={messageNotifs} onChange={setMessageNotifs} />
      <ToggleRow label="Group notifications" desc="Notify for group chat activity" value={groupNotifs} onChange={setGroupNotifs} />
      <ToggleRow label="Call notifications" desc="Notify for incoming calls" value={callNotifs} onChange={setCallNotifs} />
      <ToggleRow label="Show preview" desc="Display message content in notifications" value={preview} onChange={setPreview} />
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-ink-400">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className={cn('w-12 h-7 rounded-full transition relative shrink-0', value ? 'bg-aqua-500' : 'bg-ink-300 dark:bg-ink-700')}>
        <span className={cn('absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-all', value ? 'left-6' : 'left-1')} />
      </button>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700">
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button key={opt} onClick={() => onChange(opt)} className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition capitalize', value === opt ? 'bg-aqua-500 text-white' : 'bg-ink-100 dark:bg-ink-700 text-ink-400')}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, value, onClick, chevron, danger }: { icon: any; label: string; value?: string; onClick?: () => void; chevron?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn('w-full flex items-center gap-3 p-4 rounded-xl bg-white dark:bg-ink-800 ring-1 ring-ink-200 dark:ring-ink-700 transition text-left', danger ? 'hover:ring-rose-400' : 'hover:ring-aqua-400')}>
      <Icon size={18} className={cn(danger ? 'text-rose-500' : 'text-aqua-500')} />
      <span className={cn('text-sm font-medium flex-1', danger && 'text-rose-500')}>{label}</span>
      {value && <span className="text-sm text-ink-400 capitalize">{value}</span>}
      {chevron && <ChevronRight size={16} className="text-ink-400" />}
    </button>
  );
}

function AboutView() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex flex-col items-center text-center mb-8">
        <NuvoLogo size={80} className="drop-shadow-xl mb-4" />
        <h2 className="text-2xl font-bold">NUVORA</h2>
        <p className="text-sm text-ink-400">Version {NUVOVA_CONFIG.version}</p>
      </div>
      <p className="text-center text-ink-500 dark:text-ink-400 mb-8">
        NUVORA is a modern messaging platform with end-to-end encrypted messaging, voice and video calls, status updates, channels, communities, and a built-in AI assistant named {NUVOVA_CONFIG.aiName}.
      </p>
      <div className="text-center">
        <p className="text-sm text-ink-400 mb-1">Created by</p>
        <a
          href={NUVOVA_CONFIG.FACEBOOK_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-lg font-semibold text-aqua-500 hover:underline"
        >
          {NUVOVA_CONFIG.creator}
        </a>
      </div>
      <div className="mt-8 p-4 rounded-xl bg-aqua-50 dark:bg-aqua-950/20 ring-1 ring-aqua-200 dark:ring-aqua-800 text-center">
        <p className="text-xs text-ink-400">
          <Lock size={14} className="inline mr-1 text-aqua-500" />
          Your messages and calls are end-to-end encrypted.
        </p>
      </div>
    </div>
  );
}

function SettingInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-ink-400 mb-1 block">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-4 py-2.5 text-sm rounded-xl bg-ink-100 dark:bg-ink-800 outline-none focus:ring-2 ring-aqua-400" />
    </div>
  );
}
