import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Ticket, 
  Wallet, 
  CheckSquare, 
  ChevronDown,
  Cloud,
  RefreshCw,
  Compass,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { MOCK_MEMBERS, MOCK_TRIP_CONFIG } from './constants.ts';
import { TripMember, TripConfig, Trip } from './types.ts';
import Schedule from './modules/Schedule.tsx';
import Bookings from './modules/Bookings.tsx';
import Expense from './modules/Expense.tsx';
import Planning from './modules/Planning.tsx';
import TripManagerModal from './modules/TripManagerModal.tsx';
import { 
  saveTripToFirebase, 
  fetchTripsFromFirebase, 
  deleteTripFromFirebase, 
  subscribeToTrips 
} from './firebase.ts';

type Tab = 'schedule' | 'bookings' | 'expense' | 'planning';

// Initial default trip template
const createDefaultTrip = (): Trip => ({
  id: 'trip_default_tokyo',
  tripName: 'Tokyo Adventure 2024',
  region: 'Tokyo, Japan',
  startDate: MOCK_TRIP_CONFIG.startDate,
  duration: MOCK_TRIP_CONFIG.duration,
  coverEmoji: '🗼',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  members: MOCK_MEMBERS,
  itinerary: [
    { id: '1', dayIndex: 0, time: '10:00', endTime: '11:30', title: 'Arrival', location: 'NRT Terminal 1', category: 'Transport' },
    { id: '2', dayIndex: 0, time: '13:30', endTime: '14:30', title: 'Lunch', location: 'Ichiran Shinjuku', category: 'Restaurant' },
  ],
  pool: [
    { id: 'p1', dayIndex: -1, time: '--:--', title: 'Idea', location: 'TeamLab Planets', category: 'Attraction' },
    { id: 'p2', dayIndex: -1, time: '--:--', title: 'Idea', location: 'Shibuya Sky', category: 'Attraction' },
  ],
  bookings: [
    {
      id: '1',
      type: 'Flight',
      title: 'CX504 Pacific Air',
      referenceNo: 'M7X9L2',
      bookedBy: '1',
      cost: 0,
      imageUrl: 'https://picsum.photos/seed/flight/600/200',
      details: { from: 'HKG', to: 'NRT', date: '12 OCT', time: '09:15', arrivalTime: '14:30', seat: '24A', gate: 'B12', airline: 'Cathay', class: 'Economy', flightNo: 'CX504' }
    },
    {
      id: '2',
      type: 'Hotel',
      title: 'Shinjuku Prince Hotel',
      referenceNo: 'H-992831',
      bookedBy: '2',
      cost: 45000,
      imageUrl: '',
      details: { address: 'Kabukicho, Tokyo', checkIn: '12 OCT', checkOut: '17 OCT', room: 'Superior King' }
    }
  ],
  expenses: [],
  planningItems: [
    { id: '1', type: 'Packing', title: 'Passport', assignedTo: 'All', completed: true },
    { id: '2', type: 'Packing', title: 'Japan Rail Pass', assignedTo: 'All', completed: false },
    { id: '3', type: 'Packing', title: 'Camera Batteries', assignedTo: '1', completed: false }
  ]
});

// Safe initial loader migrating old single-trip localStorage if present
const getInitialTripsData = (): { trips: Trip[]; currentId: string } => {
  try {
    const savedTrips = localStorage.getItem('ohana_all_trips');
    const savedCurrentId = localStorage.getItem('ohana_current_trip_id');
    if (savedTrips) {
      const parsed = JSON.parse(savedTrips);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validId = parsed.some(t => t.id === savedCurrentId) ? savedCurrentId! : parsed[0].id;
        return { trips: parsed, currentId: validId };
      }
    }
  } catch (e) {
    console.error('Error reading saved trips list:', e);
  }

  // Migrate existing single-trip localStorage keys if available
  const defaultTrip = createDefaultTrip();
  try {
    const savedConfig = localStorage.getItem('tripConfig');
    if (savedConfig) {
      const c = JSON.parse(savedConfig);
      defaultTrip.tripName = c.tripName || defaultTrip.tripName;
      defaultTrip.region = c.region || defaultTrip.region;
      defaultTrip.startDate = c.startDate || defaultTrip.startDate;
      defaultTrip.duration = c.duration || defaultTrip.duration;
      defaultTrip.coverEmoji = c.coverEmoji || defaultTrip.coverEmoji;
    }
    const savedMembers = localStorage.getItem('trip_members');
    if (savedMembers) defaultTrip.members = JSON.parse(savedMembers);
    const savedItinerary = localStorage.getItem('itinerary');
    if (savedItinerary) defaultTrip.itinerary = JSON.parse(savedItinerary);
    const savedPool = localStorage.getItem('inspiration_pool');
    if (savedPool) defaultTrip.pool = JSON.parse(savedPool);
    const savedBookings = localStorage.getItem('bookings');
    if (savedBookings) defaultTrip.bookings = JSON.parse(savedBookings);
    const savedExpenses = localStorage.getItem('expenses');
    if (savedExpenses) defaultTrip.expenses = JSON.parse(savedExpenses);
    const savedPlanning = localStorage.getItem('planning_items');
    if (savedPlanning) defaultTrip.planningItems = JSON.parse(savedPlanning);
  } catch (e) {
    console.warn('Could not migrate legacy storage:', e);
  }

  localStorage.setItem('ohana_all_trips', JSON.stringify([defaultTrip]));
  localStorage.setItem('ohana_current_trip_id', defaultTrip.id);
  return { trips: [defaultTrip], currentId: defaultTrip.id };
};

const App: React.FC = () => {
  const initialData = useRef(getInitialTripsData());
  const [trips, setTrips] = useState<Trip[]>(initialData.current.trips);
  const [currentTripId, setCurrentTripId] = useState<string>(initialData.current.currentId);
  const [tripVersion, setTripVersion] = useState<number>(0);

  const [activeTab, setActiveTab] = useState<Tab>('schedule');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string>('剛剛');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSaveToast, setShowSaveToast] = useState<boolean>(false);
  const [isTripManagerOpen, setIsTripManagerOpen] = useState<boolean>(false);

  // Active trip derived helper
  const currentTrip = trips.find(t => t.id === currentTripId) || trips[0] || createDefaultTrip();

  // Active Trip Config
  const [tripConfig, setTripConfig] = useState<TripConfig>({
    tripName: currentTrip.tripName,
    region: currentTrip.region,
    startDate: currentTrip.startDate,
    duration: currentTrip.duration,
    coverEmoji: currentTrip.coverEmoji || '✈️'
  });

  // Active Members
  const [members, setMembers] = useState<TripMember[]>(() => {
    return currentTrip.members?.length ? currentTrip.members : MOCK_MEMBERS;
  });

  // Current User
  const [currentUser, setCurrentUser] = useState<TripMember>(() => {
    try {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed && parsed.id) {
          const exists = members.find(m => m.id === parsed.id);
          return exists || members[0];
        }
      }
    } catch (e) {
      console.error('Failed to parse currentUser from localStorage', e);
    }
    return members[0];
  });

  // Save trips array to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('ohana_all_trips', JSON.stringify(trips));
  }, [trips]);

  // Save activeTab
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab') as Tab;
    if (savedTab && ['schedule', 'bookings', 'expense', 'planning'].includes(savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Capture current state of the active trip from local submodules
  const captureCurrentTripData = (tripId: string): Trip => {
    const existing = trips.find(t => t.id === tripId) || currentTrip;
    let cfg = tripConfig;
    try {
      const c = localStorage.getItem('tripConfig');
      if (c) cfg = JSON.parse(c);
    } catch (e) {}

    let itinerary = existing.itinerary || [];
    try {
      const it = localStorage.getItem('itinerary');
      if (it) itinerary = JSON.parse(it);
    } catch (e) {}

    let pool = existing.pool || [];
    try {
      const p = localStorage.getItem('inspiration_pool');
      if (p) pool = JSON.parse(p);
    } catch (e) {}

    let bookings = existing.bookings || [];
    try {
      const b = localStorage.getItem('bookings');
      if (b) bookings = JSON.parse(b);
    } catch (e) {}

    let expenses = existing.expenses || [];
    try {
      const ex = localStorage.getItem('expenses');
      if (ex) expenses = JSON.parse(ex);
    } catch (e) {}

    let planningItems = existing.planningItems || [];
    try {
      const pl = localStorage.getItem('planning_items');
      if (pl) planningItems = JSON.parse(pl);
    } catch (e) {}

    let currentMembers = members;
    try {
      const m = localStorage.getItem('trip_members');
      if (m) currentMembers = JSON.parse(m);
    } catch (e) {}

    return {
      id: tripId,
      tripName: cfg.tripName || existing.tripName,
      region: cfg.region || existing.region,
      startDate: cfg.startDate || existing.startDate,
      duration: cfg.duration || existing.duration,
      coverEmoji: cfg.coverEmoji || existing.coverEmoji || '✈️',
      createdAt: existing.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: currentMembers,
      itinerary,
      pool,
      bookings,
      expenses,
      planningItems
    };
  };

  // Switch to another trip
  const handleSwitchTrip = (targetTripId: string) => {
    if (targetTripId === currentTripId) {
      setIsTripManagerOpen(false);
      return;
    }

    // 1. Snapshot current trip
    const capturedCurrent = captureCurrentTripData(currentTripId);
    const updatedTrips = trips.map(t => t.id === currentTripId ? capturedCurrent : t);

    // 2. Find target trip
    const targetTrip = updatedTrips.find(t => t.id === targetTripId);
    if (!targetTrip) return;

    // 3. Write target trip data to submodules' localStorage keys
    const newConfig: TripConfig = {
      tripName: targetTrip.tripName,
      region: targetTrip.region,
      startDate: targetTrip.startDate,
      duration: targetTrip.duration,
      coverEmoji: targetTrip.coverEmoji || '✈️'
    };

    localStorage.setItem('tripConfig', JSON.stringify(newConfig));
    localStorage.setItem('itinerary', JSON.stringify(targetTrip.itinerary || []));
    localStorage.setItem('inspiration_pool', JSON.stringify(targetTrip.pool || []));
    localStorage.setItem('bookings', JSON.stringify(targetTrip.bookings || []));
    localStorage.setItem('expenses', JSON.stringify(targetTrip.expenses || []));
    localStorage.setItem('planning_items', JSON.stringify(targetTrip.planningItems || []));
    localStorage.setItem('trip_members', JSON.stringify(targetTrip.members || MOCK_MEMBERS));
    localStorage.setItem('ohana_current_trip_id', targetTrip.id);
    localStorage.setItem('ohana_all_trips', JSON.stringify(updatedTrips));

    // 4. Update parent state
    setTrips(updatedTrips);
    setCurrentTripId(targetTrip.id);
    setTripConfig(newConfig);
    setMembers(targetTrip.members || MOCK_MEMBERS);
    setCurrentUser((targetTrip.members && targetTrip.members[0]) || members[0]);
    setTripVersion(v => v + 1);
    setIsTripManagerOpen(false);

    // Background sync current captured to Firebase
    saveTripToFirebase(capturedCurrent).catch(console.warn);
  };

  // Create a new trip
  const handleCreateTrip = async (data: { tripName: string; region: string; startDate: string; duration: number; coverEmoji: string }) => {
    const newTripId = 'trip_' + Date.now();
    const newTrip: Trip = {
      id: newTripId,
      tripName: data.tripName,
      region: data.region,
      startDate: data.startDate,
      duration: data.duration,
      coverEmoji: data.coverEmoji,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: members.length > 0 ? members : MOCK_MEMBERS,
      itinerary: [
        { id: '1', dayIndex: 0, time: '10:00', endTime: '11:30', title: '抵達 ' + data.region, location: data.region, category: 'Transport' }
      ],
      pool: [],
      bookings: [],
      expenses: [],
      planningItems: [
        { id: '1', type: 'Packing', title: '護照 / 證件', assignedTo: 'All', completed: false },
        { id: '2', type: 'Packing', title: '充電器與行動電源', assignedTo: 'All', completed: false }
      ]
    };

    const currentCaptured = captureCurrentTripData(currentTripId);
    const updatedTrips = [...trips.map(t => t.id === currentTripId ? currentCaptured : t), newTrip];

    // Write new trip to localStorage
    const newConfig: TripConfig = {
      tripName: newTrip.tripName,
      region: newTrip.region,
      startDate: newTrip.startDate,
      duration: newTrip.duration,
      coverEmoji: newTrip.coverEmoji
    };
    localStorage.setItem('tripConfig', JSON.stringify(newConfig));
    localStorage.setItem('itinerary', JSON.stringify(newTrip.itinerary));
    localStorage.setItem('inspiration_pool', JSON.stringify(newTrip.pool));
    localStorage.setItem('bookings', JSON.stringify(newTrip.bookings));
    localStorage.setItem('expenses', JSON.stringify(newTrip.expenses));
    localStorage.setItem('planning_items', JSON.stringify(newTrip.planningItems));
    localStorage.setItem('trip_members', JSON.stringify(newTrip.members));
    localStorage.setItem('ohana_current_trip_id', newTrip.id);
    localStorage.setItem('ohana_all_trips', JSON.stringify(updatedTrips));

    setTrips(updatedTrips);
    setCurrentTripId(newTrip.id);
    setTripConfig(newConfig);
    setMembers(newTrip.members);
    setTripVersion(v => v + 1);
    setIsTripManagerOpen(false);

    // Save both to Firebase
    setIsSyncing(true);
    await Promise.all([
      saveTripToFirebase(currentCaptured),
      saveTripToFirebase(newTrip)
    ]);
    setIsSyncing(false);
    setLastSync(new Date().toLocaleTimeString());
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 3000);
  };

  // Update trip general info
  const handleUpdateTrip = async (tripId: string, updates: Partial<Trip>) => {
    const updatedTrips = trips.map(t => {
      if (t.id === tripId) {
        return {
          ...t,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }
      return t;
    });

    setTrips(updatedTrips);
    localStorage.setItem('ohana_all_trips', JSON.stringify(updatedTrips));

    if (tripId === currentTripId) {
      setTripConfig(prev => ({
        ...prev,
        ...updates
      }));
      localStorage.setItem('tripConfig', JSON.stringify({
        ...tripConfig,
        ...updates
      }));
      setTripVersion(v => v + 1);
    }

    const updatedTrip = updatedTrips.find(t => t.id === tripId);
    if (updatedTrip) {
      setIsSyncing(true);
      await saveTripToFirebase(updatedTrip);
      setIsSyncing(false);
      setLastSync(new Date().toLocaleTimeString());
    }
  };

  // Duplicate a trip
  const handleDuplicateTrip = async (tripId: string) => {
    const source = tripId === currentTripId ? captureCurrentTripData(currentTripId) : trips.find(t => t.id === tripId);
    if (!source) return;

    const clonedTrip: Trip = {
      ...source,
      id: 'trip_' + Date.now(),
      tripName: `${source.tripName} (副本)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newTrips = [...trips, clonedTrip];
    setTrips(newTrips);
    localStorage.setItem('ohana_all_trips', JSON.stringify(newTrips));

    setIsSyncing(true);
    await saveTripToFirebase(clonedTrip);
    setIsSyncing(false);
    setLastSync(new Date().toLocaleTimeString());
    setShowSaveToast(true);
    setTimeout(() => setShowSaveToast(false), 2500);
  };

  // Delete a trip
  const handleDeleteTrip = async (tripId: string) => {
    if (trips.length <= 1) {
      alert("必須至少保留一個旅程喔！");
      return;
    }

    const newTrips = trips.filter(t => t.id !== tripId);
    setTrips(newTrips);
    localStorage.setItem('ohana_all_trips', JSON.stringify(newTrips));

    // If deleted trip was active, switch to first available
    if (tripId === currentTripId) {
      handleSwitchTrip(newTrips[0].id);
    }

    setIsSyncing(true);
    await deleteTripFromFirebase(tripId);
    setIsSyncing(false);
    setLastSync(new Date().toLocaleTimeString());
  };

  // Force Save to Firebase
  const handleForceSave = async () => {
    setIsSyncing(true);
    try {
      const activeCaptured = captureCurrentTripData(currentTripId);
      const updatedTrips = trips.map(t => t.id === currentTripId ? activeCaptured : t);
      setTrips(updatedTrips);
      localStorage.setItem('ohana_all_trips', JSON.stringify(updatedTrips));

      // Save all trips to Firebase
      await Promise.all(updatedTrips.map(t => saveTripToFirebase(t)));
      setLastSync(new Date().toLocaleTimeString());
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) {
      console.error("Firebase save failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  // Initialize Firebase connection and load cloud trips
  useEffect(() => {
    let isMounted = true;

    const syncInitialCloud = async () => {
      setIsSyncing(true);
      try {
        const cloudTrips = await fetchTripsFromFirebase();
        if (!isMounted) return;

        if (cloudTrips && cloudTrips.length > 0) {
          setTrips(prev => {
            const map = new Map<string, Trip>();
            prev.forEach(t => map.set(t.id, t));
            cloudTrips.forEach(ct => {
              const local = map.get(ct.id);
              if (!local || (ct.updatedAt || '') >= (local.updatedAt || '')) {
                map.set(ct.id, ct);
              }
            });
            const merged = Array.from(map.values());
            localStorage.setItem('ohana_all_trips', JSON.stringify(merged));
            return merged;
          });
          setLastSync(new Date().toLocaleTimeString());
        } else {
          // Firebase is brand new: seed current initial trip to Firebase!
          const active = captureCurrentTripData(currentTripId);
          await saveTripToFirebase(active);
        }
      } catch (err) {
        console.warn("Initial cloud sync note:", err);
      } finally {
        if (isMounted) setIsSyncing(false);
      }
    };

    syncInitialCloud();

    // Subscribe to remote changes
    const unsubscribe = subscribeToTrips((cloudTrips) => {
      if (!isMounted || !cloudTrips || cloudTrips.length === 0) return;
      setTrips(prev => {
        const map = new Map<string, Trip>();
        prev.forEach(t => map.set(t.id, t));
        let hasNew = false;
        cloudTrips.forEach(ct => {
          const local = map.get(ct.id);
          if (!local || (ct.updatedAt || '') > (local.updatedAt || '')) {
            map.set(ct.id, ct);
            hasNew = true;
          }
        });
        if (!hasNew) return prev;
        const result = Array.from(map.values());
        localStorage.setItem('ohana_all_trips', JSON.stringify(result));
        return result;
      });
      setLastSync(new Date().toLocaleTimeString());
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Periodic Auto-Sync to Firebase (every 15 seconds if active)
  useEffect(() => {
    const timer = setInterval(() => {
      const active = captureCurrentTripData(currentTripId);
      saveTripToFirebase(active).then(() => {
        setLastSync(new Date().toLocaleTimeString());
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(timer);
  }, [currentTripId, trips]);

  const handleSwitchUser = (user: TripMember) => {
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  };

  const handleAddMember = (name: string, avatar: string) => {
    const newMember: TripMember = { id: Date.now().toString(), name, avatar };
    const updated = [...members, newMember];
    setMembers(updated);
    localStorage.setItem('trip_members', JSON.stringify(updated));
    handleUpdateTrip(currentTripId, { members: updated });
  };

  const handleUpdateMember = (id: string, name: string, avatar: string) => {
    const updated = members.map(m => m.id === id ? { ...m, name, avatar } : m);
    setMembers(updated);
    localStorage.setItem('trip_members', JSON.stringify(updated));
    if (currentUser.id === id) {
      setCurrentUser({ ...currentUser, name, avatar });
      localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, name, avatar }));
    }
    handleUpdateTrip(currentTripId, { members: updated });
  };

  const handleDeleteMember = (id: string) => {
    if (id === currentUser.id) {
      alert("Ohana! 你不能刪除目前正在使用的身分。");
      return;
    }
    if (confirm("確定要移除這位成員嗎？這會影響分帳計算。")) {
      const updated = members.filter(m => m.id !== id);
      setMembers(updated);
      localStorage.setItem('trip_members', JSON.stringify(updated));
      handleUpdateTrip(currentTripId, { members: updated });
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
          key={`${currentTripId}_${tripVersion}`}
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
          key={`${currentTripId}_${tripVersion}`}
          members={members} 
          currentUser={currentUser} 
          onNavigate={handleNavigate}
          highlightId={highlightId}
        />
      );
      case 'expense': return (
        <Expense 
          key={`${currentTripId}_${tripVersion}`}
          currentUser={currentUser} 
          members={members} 
          onOpenFullExport={() => setIsFullExportModalOpen(true)}
        />
      );
      case 'planning': return (
        <Planning 
          key={`${currentTripId}_${tripVersion}`}
          members={members} 
        />
      );
      default: return (
        <Schedule 
          key={`${currentTripId}_${tripVersion}`}
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
    <div className="flex flex-col h-screen max-w-md mx-auto bg-cream shadow-2xl relative overflow-hidden font-sans">
      {/* Top Header Bar with Trip Switcher & Cloud Storage Sync */}
      <header className="absolute top-0 left-0 right-0 z-[60] px-3 py-2 flex justify-between items-center bg-paper/90 backdrop-blur-md border-b border-accent/40 shadow-sm">
        {/* Active Trip Button / Switcher */}
        <button 
          onClick={() => setIsTripManagerOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-white border border-stitch/30 hover:border-stitch rounded-full sticker-shadow text-navy transition-all active:scale-95 group max-w-[65%]"
          title="點擊切換或新增旅程"
        >
          <span className="text-sm">{currentTrip.coverEmoji || '✈️'}</span>
          <span className="text-xs font-black truncate max-w-[130px] group-hover:text-stitch transition-colors">
            {currentTrip.tripName || '我的旅程'}
          </span>
          <ChevronDown size={14} className="text-stitch group-hover:translate-y-0.5 transition-transform flex-shrink-0" />
        </button>

        {/* Cloud Sync Status & Manual Save Button */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleForceSave}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-stitch hover:text-white border border-accent/60 rounded-full text-[10px] font-black text-navy/70 transition-all active:scale-95 sticker-shadow"
            title="點擊立即儲存至 Firebase 雲端"
          >
            <Cloud size={13} className={isSyncing ? 'animate-bounce text-amber-500' : 'text-green-500'} />
            <span>{isSyncing ? '儲存中...' : '儲存雲端'}</span>
          </button>
        </div>
      </header>

      {/* Floating Save Toast Notification */}
      {showSaveToast && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-[70] bg-navy text-white px-4 py-2 rounded-2xl shadow-xl border border-stitch/40 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 size={16} className="text-green-400" />
          <span className="text-xs font-black tracking-wide">已成功儲存至 Firebase 雲端！</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-14">
        {renderContent()}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-paper/90 backdrop-blur-lg border-t border-accent px-2 py-3 flex justify-around items-center z-50 rounded-t-3xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)] safe-bottom">
        <NavButton active={activeTab === 'schedule'} onClick={() => handleNavigate('schedule')} icon={<Calendar size={22} />} label="行程" />
        <NavButton active={activeTab === 'bookings'} onClick={() => handleNavigate('bookings')} icon={<Ticket size={22} />} label="票券" />
        <NavButton active={activeTab === 'expense'} onClick={() => handleNavigate('expense')} icon={<Wallet size={22} />} label="記帳" />
        <NavButton active={activeTab === 'planning'} onClick={() => handleNavigate('planning')} icon={<CheckSquare size={22} />} label="清單" />
      </nav>

      {/* Trip Manager Modal (Switch trips, Add trip, Edit, Delete, Cloud sync) */}
      {isTripManagerOpen && (
        <TripManagerModal 
          trips={trips}
          currentTripId={currentTripId}
          onClose={() => setIsTripManagerOpen(false)}
          onSelectTrip={handleSwitchTrip}
          onCreateTrip={handleCreateTrip}
          onUpdateTrip={handleUpdateTrip}
          onDuplicateTrip={handleDuplicateTrip}
          onDeleteTrip={handleDeleteTrip}
          onForceSync={handleForceSave}
          isSyncing={isSyncing}
          lastSyncTime={lastSync}
          onOpenFullExport={() => setIsFullExportModalOpen(true)}
        />
      )}
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
