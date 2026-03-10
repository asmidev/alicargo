import { createContext, useContext, useState, ReactNode } from 'react';

interface CollaborationContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggle: () => void;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

export function CollaborationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = () => setIsOpen(prev => !prev);

  return (
    <CollaborationContext.Provider value={{ isOpen, setIsOpen, toggle }}>
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaboration() {
  const ctx = useContext(CollaborationContext);
  if (!ctx) throw new Error('useCollaboration must be used within CollaborationProvider');
  return ctx;
}
