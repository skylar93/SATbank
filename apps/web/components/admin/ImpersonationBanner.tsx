'use client';
import { useAuth } from '@/contexts/auth-context';
import { useImpersonation } from '@/hooks/use-impersonation';
import { useState, useEffect } from 'react';

export function ImpersonationBanner() {
  const { user } = useAuth();
  const { stopImpersonation, getImpersonationData, isImpersonating } = useImpersonation();
  const [impersonationData, setImpersonationData] = useState<any>(null);

  useEffect(() => {
    const checkImpersonationData = () => {
      const data = getImpersonationData();
      setImpersonationData(data);

      // Add padding to body when impersonating
      if (data) {
        document.body.style.paddingTop = '40px';
      } else {
        document.body.style.paddingTop = '0px';
      }
    };

    // Check initial state
    checkImpersonationData();

    // Listen for storage changes to update banner
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'impersonation_data') {
        checkImpersonationData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup function
    return () => {
      document.body.style.paddingTop = '0px';
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [getImpersonationData]);  // Include dependency to re-run when hook updates

  if (!isImpersonating() || !impersonationData) {
    return null; // Don't render anything if not in impersonation mode
  }

  return (
    <div className="fixed top-0 left-0 right-0 bg-yellow-400 text-black p-2 text-center text-sm z-50 border-b-2 border-yellow-600">
      <div className="flex items-center justify-center">
        <span className="mr-2">⚠️</span>
        <span>
          Viewing as <strong>{impersonationData.target_user?.email}</strong> 
          {impersonationData.admin_user && (
            <span className="ml-1 text-xs opacity-75">
              (Admin: {impersonationData.admin_user.email})
            </span>
          )}
        </span>
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