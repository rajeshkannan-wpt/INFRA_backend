// providers/SessionProvider.tsx
// §7.3 — Root provider. Wires session management + force_logout socket
// so both are active from the moment the app mounts.
import React, { createContext, useContext, ReactNode } from 'react';
import { useSession } from '@/hooks/useSession';
import { useForceLogout } from '@/hooks/useForceLogout';

type SessionContextType = ReturnType<typeof useSession>;

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();

  // §7.3 — Connect socket.io and listen for force_logout.
  // This is active the entire time the user is authenticated.
  // When a force_logout arrives (handoff on another device),
  // useForceLogout clears SecureStore and navigates to phone-entry.
  useForceLogout(session.userId, session.deviceId);

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return context;
}