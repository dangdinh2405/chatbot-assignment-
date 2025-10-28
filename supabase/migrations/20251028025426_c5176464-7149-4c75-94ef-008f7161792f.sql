-- Add user_id to conversations table
ALTER TABLE public.conversations
ADD COLUMN user_id UUID REFERENCES public.chat_users(id) ON DELETE CASCADE;

-- Update RLS policies for conversations
DROP POLICY IF EXISTS "Anyone can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Anyone can create conversations" ON public.conversations;

CREATE POLICY "Anyone can view conversations"
  ON public.conversations FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (user_id = (SELECT id FROM public.chat_users WHERE id = user_id));

-- Create index for user conversations
CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);