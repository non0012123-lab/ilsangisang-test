import { createContext, useContext, useState, type ReactNode } from 'react';
import type { ScheduleEntry, Client, HandoverDoc } from '../types';
import { SCHEDULE_ENTRIES, CLIENTS, HANDOVER_DOCS } from '../data/mockData';

interface AppContextType {
  entries: ScheduleEntry[];
  setEntries: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  handoverDocs: HandoverDoc[];
  setHandoverDocs: React.Dispatch<React.SetStateAction<HandoverDoc[]>>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ScheduleEntry[]>(SCHEDULE_ENTRIES);
  const [clients, setClients] = useState<Client[]>(CLIENTS);
  const [handoverDocs, setHandoverDocs] = useState<HandoverDoc[]>(HANDOVER_DOCS);
  return (
    <AppContext.Provider value={{ entries, setEntries, clients, setClients, handoverDocs, setHandoverDocs }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
