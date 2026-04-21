'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';

export default function DashboardRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'surveyor') router.push('/dashboard/survey');
      else if (user.role === 'checker') router.push('/dashboard/checker');
      else if (user.role === 'admin') router.push('/dashboard/admin');
    }
  }, [user, loading, router]);

  return null;
}
