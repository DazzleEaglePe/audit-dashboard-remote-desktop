import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import { router } from './routes';
import TokenGate from './auth/TokenGate';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TokenGate>
          <RouterProvider router={router} />
          <Toaster richColors closeButton position="top-right" />
        </TokenGate>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
