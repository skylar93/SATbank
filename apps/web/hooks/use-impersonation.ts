'use client';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const IMPERSONATION_DATA_KEY = 'impersonation_data';

export function useImpersonation() {
  const router = useRouter();

  const startImpersonation = async (targetUserId: string) => {
    try {
      // Call the Edge Function to get impersonation data
      const { data: impersonationData, error } = await supabase.functions.invoke(
        'impersonate-user',
        { body: { targetUserId } }
      );

      if (error) throw new Error(error.message);

      // Store impersonation data in localStorage
      localStorage.setItem(IMPERSONATION_DATA_KEY, JSON.stringify(impersonationData));
      
      // Redirect to student dashboard with impersonation mode
      router.push('/student/dashboard');

    } catch (error: any) {
      console.error('Failed to start impersonation:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const stopImpersonation = async () => {
    try {
      // Clear impersonation data
      localStorage.removeItem(IMPERSONATION_DATA_KEY);
      
      // Force reload to properly reset auth state and prevent infinite loading
      window.location.href = '/admin/students';

    } catch (error: any) {
      console.error('Failed to stop impersonation:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const getImpersonationData = () => {
    if (typeof window === 'undefined') return null;
    
    const dataJSON = localStorage.getItem(IMPERSONATION_DATA_KEY);
    if (!dataJSON) return null;
    
    try {
      return JSON.parse(dataJSON);
    } catch {
      return null;
    }
  };

  const isImpersonating = () => {
    return getImpersonationData() !== null;
  };

  return { 
    startImpersonation, 
    stopImpersonation, 
    getImpersonationData, 
    isImpersonating 
  };
}