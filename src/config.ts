export const NUVOVA_CONFIG = {
  appName: 'NUVORA',
  aiName: 'NURA',
  creator: 'Barry Courage',
  FACEBOOK_PROFILE_URL: 'https://www.facebook.com/your-profile',
  tagline: 'Messaging, reimagined.',
  version: '1.0.0',
  supabaseStorageBucket: import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ?? 'avatars',
} as const;
