export type ChatType = 'private' | 'group' | 'broadcast';

export interface Profile {
  id: string;
  username: string | null;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  phone: string | null;
  verified: boolean;
  last_seen: string | null;
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string | null;
  avatar_url: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  is_admin: boolean;
  muted: boolean;
  pinned: boolean;
  archived: boolean;
  last_read_at: string | null;
  joined_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string | null;
  reply_to: string | null;
  edited: boolean;
  deleted_for_everyone: boolean;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  updated_at: string;
  sender?: Profile;
  reply_to_message?: Message | null;
}

export interface Contact {
  id: string;
  owner_id: string;
  contact_id: string;
  favorite: boolean;
  created_at: string;
  profile?: Profile;
}

export interface Call {
  id: string;
  chat_id: string | null;
  caller_id: string;
  callee_id: string | null;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'declined' | 'missed' | 'failed';
  duration_seconds: number;
  created_at: string;
  callee?: Profile | null;
  caller?: Profile | null;
}

export interface Status {
  id: string;
  user_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  background: string | null;
  expires_at: string;
  created_at: string;
  profile?: Profile;
}

export interface Channel {
  id: string;
  name: string;
  handle: string | null;
  description: string | null;
  avatar_url: string | null;
  is_private: boolean;
  verified: boolean;
  owner_id: string;
  created_at: string;
}

export interface ChannelPost {
  id: string;
  channel_id: string;
  author_id: string;
  body: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  name: string | null;
  platform: string | null;
  last_active: string | null;
  created_at: string;
}
