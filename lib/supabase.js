import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jgbjoqmoogvzytqnbtam.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnYmpvcW1vb2d2enl0cW5idGFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MjMzMzksImV4cCI6MjEwMDQ5OTMzOX0.uE7DxMkxZbdT5wpJk3WdBb-IXjNk5XScz5zOCGhGALI'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)