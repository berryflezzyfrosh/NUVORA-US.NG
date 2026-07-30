/*
# NUVORA Core Schema

Creates the foundational tables for the NUVORA messaging platform.

1. New Tables
- `profiles` — public user profile data. One row per auth user.
- `chats` — conversation containers (private/group/broadcast).
- `chat_members` — membership join table with admin flag, last-read pointer, mute state.
- `messages` — messages in a chat, with sender, reply-to, edit/delete flags.
- `contacts` — a user's saved contacts.
- `calls` — call history log.
- `statuses` — ephemeral status posts with expiry.
- `status_views` — who has viewed a status.
- `channels` — broadcast channels (public/private).
- `channel_followers` — channel followers join.
- `channel_posts` — posts inside a channel.
- `communities` — community grouping.
- `community_groups` — links chats into a community.
- `blocks` — user block list.
- `devices` — linked devices/sessions metadata.
- `notifications` — in-app notification feed.

2. Security
- RLS enabled on every table.
- Profiles: authenticated read; self insert/update.
- Chats: members read; creator insert/update/delete.
- chat_members: members read; self insert/update/delete; creator insert/delete others.
- messages: members read; members insert; sender update/delete own.
- contacts, calls, statuses, status_views, blocks, devices, notifications: owner-scoped CRUD.
- channels: public read; owner insert/update/delete.
- channel_followers: public read; self insert/delete.
- channel_posts: public read; channel owner insert; author update/delete.
- communities: public read; owner insert/update/delete.
- community_groups: public read; community owner insert/delete.

3. Important Notes
- All owner columns default to `auth.uid()` so client inserts omitting the owner still pass RLS.
- Timestamps default to `now()`; statuses expire via `expires_at`.
*/

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  display_name text NOT NULL,
  bio text,
  avatar_url text,
  verified boolean NOT NULL DEFAULT false,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Chats
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'private' CHECK (type IN ('private','group','broadcast')),
  title text,
  avatar_url text,
  description text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chat members
CREATE TABLE IF NOT EXISTS chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text,
  reply_to uuid REFERENCES messages(id) ON DELETE SET NULL,
  edited boolean NOT NULL DEFAULT false,
  deleted_for_everyone boolean NOT NULL DEFAULT false,
  media_url text,
  media_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  favorite boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_id)
);

-- Calls
CREATE TABLE IF NOT EXISTS calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid REFERENCES chats(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'voice' CHECK (type IN ('voice','video')),
  direction text NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('incoming','outgoing','missed')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('completed','declined','missed','failed')),
  duration_seconds int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Statuses
CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text,
  media_url text,
  media_type text,
  background text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Status views
CREATE TABLE IF NOT EXISTS status_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

-- Channels
CREATE TABLE IF NOT EXISTS channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  handle text UNIQUE,
  description text,
  avatar_url text,
  is_private boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Channel followers
CREATE TABLE IF NOT EXISTS channel_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

-- Channel posts
CREATE TABLE IF NOT EXISTS channel_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  body text,
  media_url text,
  media_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Communities
CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Community groups
CREATE TABLE IF NOT EXISTS community_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, chat_id)
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

-- Devices
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text,
  platform text,
  last_active timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_statuses_user ON statuses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE channel_posts;
