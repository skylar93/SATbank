'use client';
import { useAuth } from '@/contexts/auth-context';
import { useImpersonation } from '@/hooks/use-impersonation';
import { useState, useEffect } from 'react';

export function ImpersonationBanner() {
  const { user } = useAuth();
  const { stopImpersonation } = useImpersonation();
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    // Check if we're in impersonation mode by looking for the backup session
    const isImpersonatingFlag = localStorage.getItem('original_admin_session') !== null;
    setIsImpersonating(isImpersonatingFlag);

    // Add padding to body when impersonating
    if (isImpersonatingFlag) {
      document.body.style.paddingTop = '40px';
    } else {
      document.body.style.paddingTop = '0px';
    }

    // Cleanup function
    return () => {
      document.body.style.paddingTop = '0px';
    };
  }, [user]);

  if (!isImpersonating) {
    return null; // Don't render anything if not in impersonation mode
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-black p-2 text-center text-sm z-50 border-b-2 border-yellow-600">
      <div className="flex items-center justify-center">
        <span className="mr-2">⚠️</span>
        <span>You are currently viewing the site as a student.</span>
        <button
          onClick={stopImpersonation}
          className="ml-4 px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-medium text-xs"
        >
          Return to Admin View
        </button>
      </div>
    </div>
  );
}