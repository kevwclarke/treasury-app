import { createClient } from '@supabase/supabase-js'

const isTest = process.env.NODE_ENV === 'test'

const supabaseUrl =
  process.env.REACT_APP_SUPABASE_URL ||
  (isTest ? 'https://test-project.supabase.co' : '')

const supabaseAnonKey =
  process.env.REACT_APP_SUPABASE_ANON_KEY || (isTest ? 'test-anon-key-for-jest' : '')

if (
  (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) &&
  !isTest
) {
  // eslint-disable-next-line no-console
  console.warn(
    'Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY. Copy .env.example to .env.local and set your Supabase project values.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
