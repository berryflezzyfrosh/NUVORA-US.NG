/*
# NUVORA RLS Policies

Enables RLS and defines row-level security policies for all NUVORA tables.

1. Security
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

2. Important Notes
- All owner columns default to `auth.uid()` so client inserts omitting the owner still pass RLS.
- Membership checks use EXISTS subqueries on chat_members.
*/

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read" ON profiles;
CREATE POLICY "profiles_read" ON profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Chats
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chats_read" ON chats;
CREATE POLICY "chats_read" ON chats FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = chats.id AND chat_members.user_id = auth.uid())
);
DROP POLICY IF EXISTS "chats_insert" ON chats;
CREATE POLICY "chats_insert" ON chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "chats_update" ON chats;
CREATE POLICY "chats_update" ON chats FOR UPDATE TO authenticated USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "chats_delete" ON chats;
CREATE POLICY "chats_delete" ON chats FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- Chat members
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_read" ON chat_members;
CREATE POLICY "members_read" ON chat_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM chat_members cm WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid())
);
DROP POLICY IF EXISTS "members_insert_self" ON chat_members;
CREATE POLICY "members_insert_self" ON chat_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "members_insert_by_creator" ON chat_members;
CREATE POLICY "members_insert_by_creator" ON chat_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_members.chat_id AND chats.created_by = auth.uid())
);
DROP POLICY IF EXISTS "members_update_self" ON chat_members;
CREATE POLICY "members_update_self" ON chat_members FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "members_update_by_creator" ON chat_members;
CREATE POLICY "members_update_by_creator" ON chat_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_members.chat_id AND chats.created_by = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_members.chat_id AND chats.created_by = auth.uid())
);
DROP POLICY IF EXISTS "members_delete_self" ON chat_members;
CREATE POLICY "members_delete_self" ON chat_members FOR DELETE TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "members_delete_by_creator" ON chat_members;
CREATE POLICY "members_delete_by_creator" ON chat_members FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM chats WHERE chats.id = chat_members.chat_id AND chats.created_by = auth.uid())
);

-- Messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_read" ON messages;
CREATE POLICY "messages_read" ON messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid())
);
DROP POLICY IF EXISTS "messages_insert" ON messages;
CREATE POLICY "messages_insert" ON messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM chat_members WHERE chat_members.chat_id = messages.chat_id AND chat_members.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "messages_delete_own" ON messages;
CREATE POLICY "messages_delete_own" ON messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- Contacts
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_read" ON contacts;
CREATE POLICY "contacts_read" ON contacts FOR SELECT TO authenticated USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "contacts_insert" ON contacts;
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "contacts_update" ON contacts;
CREATE POLICY "contacts_update" ON contacts FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "contacts_delete" ON contacts;
CREATE POLICY "contacts_delete" ON contacts FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Calls
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calls_read" ON calls;
CREATE POLICY "calls_read" ON calls FOR SELECT TO authenticated USING (auth.uid() = caller_id OR auth.uid() = callee_id);
DROP POLICY IF EXISTS "calls_insert" ON calls;
CREATE POLICY "calls_insert" ON calls FOR INSERT TO authenticated WITH CHECK (auth.uid() = caller_id);

-- Statuses
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "statuses_read" ON statuses;
CREATE POLICY "statuses_read" ON statuses FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM contacts WHERE contacts.contact_id = statuses.user_id AND contacts.owner_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "statuses_insert" ON statuses;
CREATE POLICY "statuses_insert" ON statuses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "statuses_delete" ON statuses;
CREATE POLICY "statuses_delete" ON statuses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Status views
ALTER TABLE status_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "status_views_read" ON status_views;
CREATE POLICY "status_views_read" ON status_views FOR SELECT TO authenticated USING (
  auth.uid() = viewer_id OR EXISTS (
    SELECT 1 FROM statuses WHERE statuses.id = status_views.status_id AND statuses.user_id = auth.uid()
  )
);
DROP POLICY IF EXISTS "status_views_insert" ON status_views;
CREATE POLICY "status_views_insert" ON status_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = viewer_id);

-- Channels
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "channels_read" ON channels;
CREATE POLICY "channels_read" ON channels FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "channels_insert" ON channels;
CREATE POLICY "channels_insert" ON channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "channels_update" ON channels;
CREATE POLICY "channels_update" ON channels FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "channels_delete" ON channels;
CREATE POLICY "channels_delete" ON channels FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Channel followers
ALTER TABLE channel_followers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "followers_read" ON channel_followers;
CREATE POLICY "followers_read" ON channel_followers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "followers_insert" ON channel_followers;
CREATE POLICY "followers_insert" ON channel_followers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "followers_delete" ON channel_followers;
CREATE POLICY "followers_delete" ON channel_followers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Channel posts
ALTER TABLE channel_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_read" ON channel_posts;
CREATE POLICY "posts_read" ON channel_posts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "posts_insert" ON channel_posts;
CREATE POLICY "posts_insert" ON channel_posts FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = author_id AND EXISTS (SELECT 1 FROM channels WHERE channels.id = channel_posts.channel_id AND channels.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "posts_update" ON channel_posts;
CREATE POLICY "posts_update" ON channel_posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
DROP POLICY IF EXISTS "posts_delete" ON channel_posts;
CREATE POLICY "posts_delete" ON channel_posts FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- Communities
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "communities_read" ON communities;
CREATE POLICY "communities_read" ON communities FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "communities_insert" ON communities;
CREATE POLICY "communities_insert" ON communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "communities_update" ON communities;
CREATE POLICY "communities_update" ON communities FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "communities_delete" ON communities;
CREATE POLICY "communities_delete" ON communities FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Community groups
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cg_read" ON community_groups;
CREATE POLICY "cg_read" ON community_groups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cg_insert" ON community_groups;
CREATE POLICY "cg_insert" ON community_groups FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM communities WHERE communities.id = community_groups.community_id AND communities.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "cg_delete" ON community_groups;
CREATE POLICY "cg_delete" ON community_groups FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM communities WHERE communities.id = community_groups.community_id AND communities.owner_id = auth.uid())
);

-- Blocks
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocks_read" ON blocks;
CREATE POLICY "blocks_read" ON blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocks_insert" ON blocks;
CREATE POLICY "blocks_insert" ON blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
DROP POLICY IF EXISTS "blocks_delete" ON blocks;
CREATE POLICY "blocks_delete" ON blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- Devices
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devices_read" ON devices;
CREATE POLICY "devices_read" ON devices FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "devices_insert" ON devices;
CREATE POLICY "devices_insert" ON devices FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "devices_delete" ON devices;
CREATE POLICY "devices_delete" ON devices FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_read" ON notifications;
CREATE POLICY "notif_read" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert" ON notifications;
CREATE POLICY "notif_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_update" ON notifications;
CREATE POLICY "notif_update" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_delete" ON notifications;
CREATE POLICY "notif_delete" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
