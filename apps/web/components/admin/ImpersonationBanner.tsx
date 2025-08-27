'use client';
import { useAuth } from '@/contexts/auth-context';
import { useImpersonation } from '@/hooks/use-impersonation';
import { useState, useEffect } from 'react';

export function ImpersonationBanner() {
  const { user } = useAuth();
  const { stopImpersonation, getImpersonationData, isImpersonating } = useImpersonation();
  
  // Initialize with null to avoid hydration issues
  const [impersonationData, setImpersonationData] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  // First useEffect to handle client-side mounting
  useEffect(() => {
    setIsClient(true);
    // Check impersonation data once client-side is ready
    const data = getImpersonationData();
    setImpersonationData(data);
    
    // Add CSS class for impersonation styling
    if (data) {
      document.body.classList.add('impersonation-active');
    } else {
      document.body.classList.remove('impersonation-active');
    }
  }, []); // Empty dependency array - only run once on mount

  // Second useEffect for storage change listener
  useEffect(() => {
    if (!isClient) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'impersonation_data') {
        const data = getImpersonationData();
        setImpersonationData(data);

        // Update CSS class for impersonation styling
        if (data) {
          document.body.classList.add('impersonation-active');
        } else {
          document.body.classList.remove('impersonation-active');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      document.body.classList.remove('impersonation-active');
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient, getImpersonationData]); // Stable dependencies

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