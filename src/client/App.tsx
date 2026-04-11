import { AuthProvider } from './contexts/AuthContext.js';
import { SocketProvider } from './contexts/SocketContext.js';
import { AppRouter } from './router.js';

export function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRouter />
      </SocketProvider>
    </AuthProvider>
  );
}
