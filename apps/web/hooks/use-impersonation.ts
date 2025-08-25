'use client';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const ADMIN_SESSION_KEY = 'original_admin_session';

export function useImpersonation() {
  const router = useRouter();

  const startImpersonation = async (targetUserId: string) => {
    try {
      // 1. Backup the current admin session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
      }

      // 2. Call the Edge Function to get an impersonated session
      const { data: impersonatedSession, error } = await supabase.functions.invoke(
        'impersonate-user',
        { body: { targetUserId } }
      );

      if (error) throw new Error(error.message);

      // 3. Set the new session and redirect
      await supabase.auth.setSession(impersonatedSession);
      router.push('/student/dashboard');

    } catch (error: any) {
      console.error('Failed to start impersonation:', error);
      alert(`Error: ${error.message}`);
      // Clear any backup if failed
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  };

  const stopImpersonation = async () => {
    try {
      const sessionJSON = localStorage.getItem(ADMIN_SESSION_KEY);
      if (!sessionJSON) throw new Error("No original session found.");
      
      const originalSession = JSON.parse(sessionJSON);
      await supabase.auth.setSession(originalSession);

      localStorage.removeItem(ADMIN_SESSION_KEY);
      router.push('/admin/students');

    } catch (error: any) {
      console.error('Failed to stop impersonation:', error);
      alert(`Error: ${error.message}`);
    }
  };

  return { startImpersonation, stopImpersonation };
}