-- Message reactions
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reactions_read" ON message_reactions;
CREATE POLICY "reactions_read" ON message_reactions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM chat_members WHERE chat_members.chat_id = (
    SELECT messages.chat_id FROM messages WHERE messages.id = message_reactions.message_id
  ) AND chat_members.user_id = auth.uid())
);
DROP POLICY IF EXISTS "reactions_insert" ON message_reactions;
CREATE POLICY "reactions_insert" ON message_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "reactions_delete" ON message_reactions;
CREATE POLICY "reactions_delete" ON message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add pinned and archived to chat_members
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;
ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add phone to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;

-- Index
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
