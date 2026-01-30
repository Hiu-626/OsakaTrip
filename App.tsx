
import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Ticket, 
  Wallet, 
  CheckSquare, 
} from 'lucide-react';
import { MOCK_MEMBERS, MOCK_TRIP_CONFIG } from './constants';
import { TripMember } from './types';
import Schedule from './modules/Schedule';
import Bookings from './modules/Bookings';
import Expense from './modules/Expense';
import Planning from './modules/Planning';

type Tab = 'schedule' | 'bookings' | 'expense' | 'planning';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string>(new Date().toLocaleTimeString());
  const [members, setMembers] = useState<TripMember[]>(() => {
    const saved = localStorage.getItem('trip_members');
    return saved ? JSON.parse(saved) : MOCK_MEMBERS;
  });
  const [currentUser, setCurrentUser] = useState<TripMember>(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      const exists = members.find(m => m.id === parsed.id);
      return exists || members[0];
    }
    return members[0];
  });
  const [tripConfig, setTripConfig] = useState(MOCK_TRIP_CONFIG);

  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab') as Tab;
    if (savedTab && ['schedule', 'bookings', 'expense', 'planning'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('trip_members', JSON.stringify(members));
    setLastSync(new Date().toLocaleTimeString());
  }, [members]);

  useEffect(() => {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }, [currentUser]);

  const handleSwitchUser = (user: TripMember) => {
    setCurrentUser(user);
  };

  const handleAddMember = (name: string, avatar: string) => {
    const newMember: TripMember = { id: Date.now().toString(), name, avatar };
    setMembers([...members, newMember]);
  };

  const handleUpdateMember = (id: string, name: string, avatar: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, name, avatar } : m));
    // If updating current user, update local state too
    if (currentUser.id === id) {
      setCurrentUser({ ...currentUser, name, avatar });
    }
  };

  const handleDeleteMember = (id: string) => {
    if (id === currentUser.id) {
      alert("Ohana! 你不能刪除目前正在使用的身分。");
      return;
    }
    if (confirm("確定要移除這位成員嗎？這會影響分帳計算。")) {
      setMembers(members.filter(m => m.id !== id));
    }
  };

  const handleNavigate = (tab: Tab, id?: string) => {
    setActiveTab(tab);
    if (id) {
      setHighlightId(id);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'schedule': return (
        <Schedule 
          config={tripConfig} 
          members={members}
          currentUser={currentUser}
          onAddMember={handleAddMember}
          onUpdateMember={handleUpdateMember}
          onDeleteMember={handleDeleteMember}
          onSwitchUser={handleSwitchUser}
          onNavigate={handleNavigate}
        />
      );
      case 'bookings': return (
        <Bookings 
          members={members} 
          currentUser={currentUser} 
          onNavigate={handleNavigate}
          highlightId={highlightId}
        />
      );
      case 'expense': return <Expense currentUser={currentUser} members={members} />;
      case 'planning': return <Planning members={members} />;
      default: return (
        <Schedule 
          config={tripConfig} 
          members={members}
          currentUser={currentUser}
          onAddMember={handleAddMember}
          onUpdateMember={handleUpdateMember}
          onDeleteMember={handleDeleteMember}
          onSwitchUser={handleSwitchUser}
          onNavigate={handleNavigate}
        />
      );
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-cream shadow-2xl relative overflow-hidden">
      {/* Top Sync Bar (Aesthetic) */}
      <div className="absolute top-0 left-0 right-0 z-[60] px-4 py-1 flex justify-center items-center gap-1.5 pointer-events-none">
        <div className="bg-navy/10 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-1">
          <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-[8px] font-black text-navy/40 uppercase tracking-widest">
            Ohana Sync: {lastSync}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-10">
        {renderContent()}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-paper/90 backdrop-blur-lg border-t border-accent px-2 py-3 flex justify-around items-center z-50 rounded-t-3xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)] safe-bottom">
        <NavButton active={activeTab === 'schedule'} onClick={() => handleNavigate('schedule')} icon={<Calendar size={22} />} label="行程" />
        <NavButton active={activeTab === 'bookings'} onClick={() => handleNavigate('bookings')} icon={<Ticket size={22} />} label="票券" />
        <NavButton active={activeTab === 'expense'} onClick={() => handleNavigate('expense')} icon={<Wallet size={22} />} label="記帳" />
        <NavButton active={activeTab === 'planning'} onClick={() => handleNavigate('planning')} icon={<CheckSquare size={22} />} label="清單" />
      </nav>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all duration-300 ${active ? 'text-stitch scale-110' : 'text-navy/30'}`}
  >
    <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-stitch/10' : 'bg-transparent'}`}>
      {icon}
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-tighter ${active ? 'opacity-100' : 'opacity-60'}`}>{label}</span>
  </button>
);

export default App;
