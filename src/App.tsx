import { ThemeProvider } from '@/lib/theme';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthScreen } from '@/components/AuthScreen';
import { AppShell } from '@/components/AppShell';
import { Loader2 } from 'lucide-react';

function Gate() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 size={32} className="animate-spin text-emerald-500" />
      </div>
    );
  }
  if (!session) return <AuthScreen />;
  return <AppShell />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
