import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = createClient(
      'https://yqlodgboglcicrymywww.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxbG9kZ2JvZ2xjaWNyeW15d3d3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MDc4OTMsImV4cCI6MjA4NTk4Mzg5M30.XyztN4RVZyPaHmFIKGKnn7OBccQDcbGXy04btQOSRkw'
    );

    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Auth exchange error:', error);
        return NextResponse.redirect(new URL('/auth?error=auth_failed', request.url));
      }

      return NextResponse.redirect(new URL(next, request.url));
    } catch (error) {
      console.error('Callback error:', error);
      return NextResponse.redirect(new URL('/auth?error=callback_error', request.url));
    }
  }

  return NextResponse.redirect(new URL('/auth', request.url));
}
