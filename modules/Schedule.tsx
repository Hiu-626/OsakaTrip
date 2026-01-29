
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, 
  Settings, 
  Plus, 
  X, 
  GripVertical,
  Trash2,
  Sparkles,
  Lightbulb,
  LayoutGrid,
  MoreHorizontal,
  CalendarDays,
  ArrowRight,
  Navigation,
  Ticket as TicketIcon
} from 'lucide-react';
import { TripConfig, ScheduleItem, Category, TripMember, Booking } from '../types';
import { COLORS } from '../constants';

interface ScheduleProps {
  config: TripConfig;
  members: TripMember[];
  currentUser: TripMember;
  onAddMember: (name: string, avatar: string) => void;
  onDeleteMember: (id: string) => void;
  onSwitchUser: (member: TripMember) => void;
  onNavigate: (tab: any, id?: string) => void;
}

const Schedule: React.FC<ScheduleProps> = ({ 
  config: initialConfig, 
  members, 
  currentUser, 
  onAddMember, 
  onDeleteMember, 
  onSwitchUser,
  onNavigate
}) => {
  const [config, setConfig] = useState<TripConfig>(() => {
    const saved = localStorage.getItem('tripConfig');
    return saved ? JSON.parse(saved) : initialConfig;
  });

  const [itinerary, setItinerary] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('itinerary');
    return saved ? JSON.parse(saved) : [
      { id: '1', dayIndex: 0, time: '10:00', title: 'Arrival', location: 'NRT Terminal 1', category: 'Transport' as Category },
      { id: '2', dayIndex: 0, time: '13:30', title: 'Lunch', location: 'Ichiran Shinjuku', category: 'Food' as Category },
    ];
  });

  const [pool, setPool] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('inspiration_pool');
    return saved ? JSON.parse(saved) : [
      { id: 'p1', dayIndex: -1, time: '--:--', title: 'Idea', location: 'TeamLab Planets', category: 'Attraction' as Category },
      { id: 'p2', dayIndex: -1, time: '--:--', title: 'Idea', location: 'Shibuya Sky', category: 'Attraction' as Category },
    ];
  });

  // State to hold bookings for linking
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [selectedDay, setSelectedDay] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<'schedule' | 'pool'>('schedule');
  
  // New state for "Move to Day" modal
  const [movingItem, setMovingItem] = useState<ScheduleItem | null>(null);

  const [newMemberName, setNewMemberName] = useState('');
  const [draggedData, setDraggedData] = useState<{ item: ScheduleItem, source: 'pool' | 'schedule' } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [isPoolDragOver, setIsPoolDragOver] = useState(false);
  const [swipeId, setSwipeId] = useState<string | null>(null);

  useEffect(() => { localStorage.setItem('tripConfig', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('itinerary', JSON.stringify(itinerary)); }, [itinerary]);
  useEffect(() => { localStorage.setItem('inspiration_pool', JSON.stringify(pool)); }, [pool]);

  // Load bookings to check for links
  useEffect(() => {
    const savedBookings = localStorage.getItem('bookings');
    if (savedBookings) {
      setBookings(JSON.parse(savedBookings));
    }
  }, [isAddModalOpen, selectedDay]); // Refresh when modals close or day changes just in case

  const countdown = useMemo(() => {
    const start = new Date(config.startDate).getTime();
    const now = new Date().getTime();
    const diff = Math.ceil((start - now) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }, [config.startDate]);

  const days = useMemo(() => {
    return Array.from({ length: config.duration }, (_, i) => {
      const d = new Date(config.startDate);
      d.setDate(d.getDate() + i);
      return {
        index: i,
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' })
      };
    });
  }, [config.startDate, config.duration]);

  const currentDayItems = useMemo(() => 
    itinerary.filter(item => item.dayIndex === selectedDay).sort((a, b) => a.time.localeCompare(b.time)),
  [itinerary, selectedDay]);

  // Drag & Drop
  const handleDragStart = (e: React.DragEvent, item: ScheduleItem, source: 'pool' | 'schedule') => {
    setDraggedData({ item, source });
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '0.5';
  };
  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = '1';
    setDraggedData(null);
    setDragOverDay(null);
    setIsPoolDragOver(false);
  };
  const handleDropOnDayButton = (dayIndex: number) => {
    if (!draggedData) return;
    const { item, source } = draggedData;
    if (source === 'pool') setPool(prev => prev.filter(i => i.id !== item.id));
    else setItinerary(prev => prev.filter(i => i.id !== item.id));
    setItinerary(prev => [...prev, { ...item, dayIndex: dayIndex }]);
    setSelectedDay(dayIndex);
  };
  const handleDropOnPool = () => {
    if (!draggedData) return;
    const { item, source } = draggedData;
    if (source === 'schedule') {
      setItinerary(prev => prev.filter(i => i.id !== item.id));
      setPool(prev => [...prev, { ...item, dayIndex: -1 }]);
    }
  };
  const handleDropOnScheduleList = (targetIndex: number) => {
    if (!draggedData) return;
    const { item, source } = draggedData;
    let newList = [...itinerary];
    if (source === 'schedule') newList = newList.filter(i => i.id !== item.id);
    else setPool(prev => prev.filter(i => i.id !== item.id));
    const currentItems = newList.filter(i => i.dayIndex === selectedDay);
    const newItem = { ...item, dayIndex: selectedDay };
    const otherDaysItems = newList.filter(i => i.dayIndex !== selectedDay);
    if (targetIndex === -1) currentItems.push(newItem);
    else currentItems.splice(targetIndex, 0, newItem);
    setItinerary([...otherDaysItems, ...currentItems]);
  };

  // CRUD & Move
  const deleteItem = (id: string, from: 'pool' | 'schedule') => {
    if (from === 'pool') setPool(pool.filter(i => i.id !== id));
    else setItinerary(itinerary.filter(i => i.id !== id));
    setSwipeId(null);
  };

  const moveItemToDay = (item: ScheduleItem, targetDayIndex: number) => {
    // Remove from current list
    if (item.dayIndex === -1) {
       setPool(pool.filter(i => i.id !== item.id));
    } else {
       setItinerary(itinerary.filter(i => i.id !== item.id));
    }
    // Add to new day
    const updatedItem = { ...item, dayIndex: targetDayIndex };
    setItinerary(prev => [...prev, updatedItem]);
    setMovingItem(null);
    setSelectedDay(targetDayIndex);
  };

  const openAddModal = (target: 'pool' | 'schedule') => {
    setAddItemTarget(target);
    setModalMode('add');
    setEditingItem(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: ScheduleItem, target: 'pool' | 'schedule') => {
    setAddItemTarget(target);
    setModalMode('edit');
    setEditingItem(item);
    setIsAddModalOpen(true);
    setSwipeId(null);
  };

  const handleSaveItem = (itemData: any) => {
    // Check if dayIndex changed during edit (for schedule items)
    const targetDayIndex = itemData.dayIndex !== undefined ? itemData.dayIndex : (addItemTarget === 'schedule' ? selectedDay : -1);

    if (modalMode === 'add') {
      const newItem: ScheduleItem = { 
        ...itemData, 
        id: Date.now().toString(), 
        dayIndex: targetDayIndex
      };
      if (targetDayIndex === -1) setPool([...pool, newItem]);
      else setItinerary([...itinerary, newItem]);
    } else if (editingItem) {
      const updatedItem = { ...editingItem, ...itemData, dayIndex: targetDayIndex };
      
      // Handle moving between pool and schedule or changing days
      const oldDayIndex = editingItem.dayIndex;
      
      if (oldDayIndex !== targetDayIndex) {
         // Remove from old location
         if (oldDayIndex === -1) setPool(prev => prev.filter(i => i.id !== editingItem.id));
         else setItinerary(prev => prev.filter(i => i.id !== editingItem.id));
         
         // Add to new location
         if (targetDayIndex === -1) setPool(prev => [...prev, updatedItem]);
         else setItinerary(prev => [...prev, updatedItem]);
      } else {
         // Just update in place
         if (targetDayIndex === -1) setPool(pool.map(i => i.id === updatedItem.id ? updatedItem : i));
         else setItinerary(itinerary.map(i => i.id === updatedItem.id ? updatedItem : i));
      }
    }
    setIsAddModalOpen(false);
  };

  const handleAddMemberSubmit = () => {
    if (newMemberName.trim()) {
      const randomId = Math.floor(Math.random() * 1000);
      onAddMember(newMemberName.trim(), `https://picsum.photos/seed/${newMemberName}${randomId}/200`);
      setNewMemberName('');
    }
  };

  const handleOpenMaps = (e: React.MouseEvent, location: string) => {
    e.stopPropagation();
    const query = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Countdown Card */}
      <div className="bg-stitch text-white p-6 rounded-2xl-sticker sticker-shadow flex justify-between items-center relative overflow-hidden border-2 border-white/20">
        <div className="z-10">
          <p className="text-[10px] font-black opacity-70 uppercase tracking-[0.3em] mb-1">Adventure Starts In</p>
          <h2 className="text-4xl font-black drop-shadow-sm">{countdown} Days</h2>
        </div>
        <div className="text-6xl opacity-20 absolute -right-2 -bottom-2 transform rotate-12 z-0">🏝️</div>
      </div>

      {/* Inspiration Pool Area */}
      <div 
        className={`transition-all duration-300 ${isPoolDragOver ? 'scale-[1.02]' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsPoolDragOver(true); }}
        onDragLeave={() => setIsPoolDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsPoolDragOver(false); handleDropOnPool(); }}
      >
        <div className="flex justify-between items-center px-1 mb-2">
           <h3 className="text-sm font-black text-navy flex items-center gap-2">
             <Sparkles size={16} className="text-donald" />
             Inspiration Pool
           </h3>
           <button 
              onClick={() => openAddModal('pool')}
              className="text-[10px] font-black bg-white px-2 py-1 rounded-full text-navy/40 border border-accent hover:text-stitch active:scale-95"
           >
             + IDEA
           </button>
        </div>
        
        <div className={`
           min-h-[100px] p-4 rounded-2xl-sticker border-2 border-dashed flex gap-3 overflow-x-auto snap-x scrollbar-hide items-center
           ${isPoolDragOver ? 'bg-stitch/10 border-stitch' : 'bg-white border-accent'}
        `}>
          {pool.length > 0 ? pool.map((item) => (
            <div 
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item, 'pool')}
              onDragEnd={handleDragEnd}
              onClick={() => openEditModal(item, 'pool')}
              className="flex-shrink-0 w-40 snap-center cursor-pointer active:cursor-grabbing group"
            >
              <div className="bg-paper p-3 rounded-xl-sticker sticker-shadow border border-accent relative hover:-translate-y-1 transition-transform duration-300 active:scale-105 active:shadow-xl h-full">
                 <div className="flex justify-between items-start mb-2">
                    <span 
                      className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider text-white"
                      style={{ backgroundColor: COLORS[item.category.toLowerCase() as keyof typeof COLORS] || COLORS.stitch }}
                    >
                      {item.category}
                    </span>
                    <button onClick={(e) => {e.stopPropagation(); deleteItem(item.id, 'pool')}} className="text-navy/10 hover:text-red-400"><X size={12} /></button>
                 </div>
                 <h4 className="font-black text-navy text-sm leading-tight mb-1 truncate">{item.location}</h4>
                 <div className="flex items-center justify-between mt-2 pt-2 border-t border-accent/30">
                    <p className="text-[9px] font-bold text-navy/30 truncate flex-1">{item.notes || 'No notes'}</p>
                    {/* Move Button for Pool items */}
                    <button 
                       onClick={(e) => { e.stopPropagation(); setMovingItem(item); }}
                       className="p-1 text-stitch hover:bg-stitch/10 rounded-full"
                    >
                       <ArrowRight size={12} />
                    </button>
                 </div>
              </div>
            </div>
          )) : (
            <div className="w-full text-center text-navy/20 flex flex-col items-center justify-center py-2" onClick={() => openAddModal('pool')}>
               <Lightbulb size={24} className="mb-1" />
               <p className="text-[10px] font-black uppercase tracking-widest">Drag items here or Tap to Add</p>
            </div>
          )}
        </div>
      </div>

      {/* Date Picker */}
      <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide snap-x -mx-4 px-4">
        {days.map((day) => (
          <button
            key={day.index}
            onClick={() => setSelectedDay(day.index)}
            onDragOver={(e) => { e.preventDefault(); setDragOverDay(day.index); }}
            onDragLeave={() => setDragOverDay(null)}
            onDrop={(e) => { e.preventDefault(); handleDropOnDayButton(day.index); }}
            className={`flex-shrink-0 w-16 py-3 rounded-xl-sticker border-2 transition-all flex flex-col items-center snap-center relative ${
              selectedDay === day.index ? 'bg-donald border-white text-navy sticker-shadow scale-105 z-10' : 
              dragOverDay === day.index ? 'bg-stitch text-white border-stitch scale-110 shadow-lg z-20' : 'bg-paper border-accent opacity-50 text-navy'
            }`}
          >
            <p className="text-[10px] font-black uppercase leading-none mb-1 opacity-60">{day.weekday}</p>
            <p className="text-xl font-black leading-none">{day.date.split(' ')[1]}</p>
          </button>
        ))}
      </div>

      {/* Itinerary List */}
      <div 
        className="space-y-4 min-h-[300px]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { if (e.target === e.currentTarget) handleDropOnScheduleList(-1); }}
      >
        {currentDayItems.length > 0 ? currentDayItems.map((item, idx) => {
          // Check for linked bookings
          const linkedBooking = bookings.find(b => b.linkedScheduleId === item.id);

          return (
            <div 
              key={item.id} 
              className="relative group transition-all"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.stopPropagation(); handleDropOnScheduleList(idx); }}
            >
              <div 
                className="flex items-start gap-3 relative"
                draggable
                onDragStart={(e) => handleDragStart(e, item, 'schedule')}
                onDragEnd={handleDragEnd}
                onClick={() => openEditModal(item, 'schedule')}
              >
                <div className="mt-6 text-navy/10 cursor-grab active:cursor-grabbing group-hover:text-navy/30 transition-colors hidden md:block">
                  <GripVertical size={20} />
                </div>

                <div className="flex-1 relative overflow-hidden rounded-xl-sticker cursor-pointer">
                  {/* Delete Action Background */}
                  <div className={`absolute inset-0 bg-red-500 flex items-center px-6 transition-opacity ${swipeId === item.id ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id, 'schedule'); }} className="text-white flex items-center gap-2 font-black">
                      <Trash2 size={20} /> DELETE
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className={`bg-paper p-5 rounded-xl-sticker sticker-shadow border border-accent transition-all duration-300 active:scale-[1.02] hover:border-stitch/50 ${swipeId === item.id ? 'translate-x-32' : 'translate-x-0'}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl font-black text-navy tracking-tight">{item.time}</div>
                        <span 
                          className="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider text-white shadow-sm" 
                          style={{ backgroundColor: COLORS[item.category.toLowerCase() as keyof typeof COLORS] || COLORS.stitch }}
                        >
                          {item.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                         {/* Move Button for Mobile */}
                         <button 
                           onClick={(e) => { e.stopPropagation(); setMovingItem(item); }}
                           className="p-2 bg-cream text-navy/30 rounded-full hover:bg-stitch hover:text-white transition-colors"
                         >
                            <CalendarDays size={16} />
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); setSwipeId(swipeId === item.id ? null : item.id); }} 
                           className="text-navy/20 active:scale-125 transition-transform"
                         >
                            <MoreHorizontal size={20} />
                         </button>
                      </div>
                    </div>
                    
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <MapPin size={16} className="text-stitch flex-shrink-0" />
                          <h3 className="text-xl font-black text-navy leading-tight truncate">{item.location}</h3>
                        </div>
                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {/* Navigate Button */}
                          <button 
                            onClick={(e) => handleOpenMaps(e, item.location)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cream rounded-full border border-accent text-[10px] font-black text-navy/60 hover:bg-green-100 hover:text-green-700 hover:border-green-200 transition-all active:scale-95"
                          >
                            <Navigation size={10} /> GO
                          </button>
                          
                          {/* Linked Ticket Button */}
                          {linkedBooking && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onNavigate('bookings', linkedBooking.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-donald/20 rounded-full border border-donald/50 text-[10px] font-black text-navy/70 hover:bg-donald hover:text-navy transition-all active:scale-95"
                            >
                              <TicketIcon size={10} /> TICKET
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {item.notes && <div className="mt-4 pt-4 border-t border-accent/50 text-[10px] text-navy/70 italic leading-relaxed whitespace-pre-wrap">{item.notes}</div>}
                  </div>
                </div>
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center opacity-30 flex flex-col items-center bg-paper/50 rounded-2xl border-2 border-dashed border-accent">
            <LayoutGrid size={40} className="mb-2" />
            <p className="font-black text-lg">Day {selectedDay + 1} is open</p>
            <p className="text-sm font-bold">Tap + to plan</p>
          </div>
        )}
      </div>

      <div className="fixed bottom-24 right-6 flex flex-col gap-3 z-50">
        <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 bg-white text-navy rounded-full sticker-shadow border border-accent flex items-center justify-center active:scale-90 transition-transform">
          <Settings size={20} />
        </button>
        <button onClick={() => openAddModal('schedule')} className="w-14 h-14 bg-donald text-navy rounded-full sticker-shadow border-2 border-paper flex items-center justify-center active:scale-95 transition-transform shadow-lg">
          <Plus size={32} />
        </button>
      </div>

      {/* Move to Day Modal */}
      {movingItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-navy/20 backdrop-blur-sm animate-in fade-in" onClick={() => setMovingItem(null)}>
           <div className="bg-paper w-full max-w-sm rounded-3xl-sticker p-6 sticker-shadow border-4 border-stitch/20 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-navy uppercase tracking-widest">Move to Day</h3>
                 <button onClick={() => setMovingItem(null)} className="p-2 bg-cream rounded-full text-navy/40"><X size={20} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                 {days.map(day => (
                    <button
                       key={day.index}
                       onClick={() => moveItemToDay(movingItem, day.index)}
                       className={`p-4 rounded-2xl border-2 transition-all text-left ${
                          movingItem.dayIndex === day.index 
                             ? 'bg-navy border-navy text-white' 
                             : 'bg-white border-accent text-navy hover:border-stitch'
                       }`}
                    >
                       <p className="text-[9px] font-black uppercase opacity-60 mb-1">{day.weekday}</p>
                       <p className="text-xl font-black">{day.date}</p>
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-navy/20 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-paper w-full max-w-sm rounded-3xl-sticker p-6 sticker-shadow border-4 border-stitch/20 relative animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-black text-navy uppercase tracking-wider">Settings</h3>
               <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream rounded-full text-navy/40"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto pr-2 space-y-6 flex-1">
               <div className="space-y-4">
                 <h4 className="text-[10px] font-black uppercase text-navy/40 tracking-[0.2em]">General</h4>
                 <div><label className="text-[10px] uppercase text-navy/40 block">Region</label><input type="text" value={config.region} onChange={e => setConfig({...config, region: e.target.value})} className="w-full p-3 bg-cream rounded-xl font-bold border border-accent" /></div>
                 <div className="grid grid-cols-2 gap-4">
                   <div><label className="text-[10px] uppercase text-navy/40 block">Start</label><input type="date" value={config.startDate} onChange={e => setConfig({...config, startDate: e.target.value})} className="w-full p-3 bg-cream rounded-xl font-bold border border-accent text-xs" /></div>
                   <div><label className="text-[10px] uppercase text-navy/40 block">Days</label><input type="number" value={config.duration} onChange={e => setConfig({...config, duration: parseInt(e.target.value) || 1})} className="w-full p-3 bg-cream rounded-xl font-bold border border-accent" /></div>
                 </div>
               </div>
               <div className="space-y-4 pt-4 border-t border-accent/40">
                 <h4 className="text-[10px] font-black uppercase text-navy/40 tracking-[0.2em]">Members</h4>
                 <div className="space-y-2">
                    {members.map(member => (
                       <div key={member.id} className="flex items-center justify-between p-3 bg-cream rounded-xl border border-accent/50 group">
                          <div className="flex items-center gap-3">
                             <img src={member.avatar} className="w-8 h-8 rounded-full border border-white" />
                             <div><p className="font-black text-sm text-navy">{member.name}</p></div>
                          </div>
                          {currentUser.id !== member.id && <button onClick={() => onDeleteMember(member.id)} className="p-2 text-navy/10 hover:text-red-400"><Trash2 size={16} /></button>}
                       </div>
                    ))}
                 </div>
                 <div className="flex gap-2">
                    <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="New Name" className="flex-1 p-3 bg-white border border-accent rounded-xl text-sm font-bold" />
                    <button onClick={handleAddMemberSubmit} disabled={!newMemberName.trim()} className="px-4 bg-navy text-white rounded-xl font-black"><Plus size={20} /></button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <AddItemModal 
          target={addItemTarget} 
          mode={modalMode}
          initialData={editingItem} 
          duration={config.duration}
          startDate={config.startDate}
          onClose={() => setIsAddModalOpen(false)} 
          onSave={handleSaveItem} 
        />
      )}
    </div>
  );
};

// Simplified Add/Edit Modal
const AddItemModal: React.FC<{ 
  target: 'schedule' | 'pool'; 
  mode: 'add' | 'edit';
  initialData: ScheduleItem | null; 
  duration: number;
  startDate: string;
  onClose: () => void; 
  onSave: (item: any) => void 
}> = ({ target, mode, initialData, duration, startDate, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    dayIndex: initialData?.dayIndex !== undefined ? initialData.dayIndex : (target === 'pool' ? -1 : 0),
    time: initialData?.time || '10:00', 
    title: initialData?.title || 'Activity', 
    location: initialData?.location || '', 
    category: initialData?.category || 'Attraction', 
    notes: initialData?.notes || '',
  });
  const [showDetails, setShowDetails] = useState(target === 'schedule'); // Auto-show details for Schedule

  const categories: Category[] = ['Attraction', 'Food', 'Transport', 'Stay', 'Other'];

  const daysOptions = Array.from({ length: duration }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return {
       index: i,
       label: `Day ${i + 1} - ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    };
  });

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-cream animate-in slide-in-from-bottom duration-300">
      <div className="p-4 flex justify-between items-center border-b border-accent bg-paper">
        <button onClick={onClose} className="text-navy/40 p-2"><X size={24} /></button>
        <h3 className="text-lg font-black text-navy uppercase tracking-widest">
           {mode === 'add' ? (target === 'pool' ? 'New Idea' : 'Add Stop') : 'Edit Item'}
        </h3>
        <button onClick={() => onSave(formData)} className="text-stitch font-black p-2" disabled={!formData.location}>DONE</button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Main Input - Location */}
        <div className="bg-paper p-6 rounded-3xl-sticker border border-accent sticker-shadow">
          <label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Where to?</label>
          <div className="flex items-center gap-3">
            <MapPin size={28} className="text-stitch flex-shrink-0" />
            <input 
              autoFocus 
              type="text" 
              value={formData.location} 
              onChange={e => setFormData({...formData, location: e.target.value})} 
              placeholder="e.g. Tokyo Tower" 
              className="w-full text-2xl font-black bg-transparent border-none p-0 focus:ring-0 placeholder:text-navy/10" 
            />
          </div>
        </div>

        {/* Categories Chips */}
        <div>
           <label className="text-[10px] font-black uppercase text-navy/30 mb-3 block px-1 tracking-widest">Category</label>
           <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFormData({...formData, category: cat as any})}
                  className={`flex-shrink-0 px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                    formData.category === cat 
                      ? 'bg-navy border-navy text-white sticker-shadow scale-105' 
                      : 'bg-white border-accent text-navy/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
           </div>
        </div>

        {/* Collapsible Details including Day Selector */}
        <div className="space-y-4">
           {target === 'pool' && !showDetails && (
              <button 
                onClick={() => setShowDetails(true)}
                className="w-full py-3 text-xs font-black text-stitch uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-stitch/5 rounded-xl transition-colors"
              >
                 <Plus size={14} /> Add Time, Day & Notes
              </button>
           )}

           {showDetails && (
             <div className="animate-in slide-in-from-top-4 fade-in duration-300 space-y-4">
               {/* Day Selector (Modify Date Function) */}
               <div className="bg-white p-4 rounded-2xl border border-accent">
                   <label className="text-[10px] font-black uppercase text-navy/30 mb-2 block">Day</label>
                   <select 
                      value={formData.dayIndex} 
                      onChange={e => setFormData({...formData, dayIndex: parseInt(e.target.value)})}
                      className="w-full font-black text-lg bg-transparent border-none p-0 focus:ring-0 text-navy"
                   >
                      <option value={-1}>Inspiration Pool (No Date)</option>
                      {daysOptions.map(d => (
                         <option key={d.index} value={d.index}>{d.label}</option>
                      ))}
                   </select>
               </div>

               <div className="bg-white p-4 rounded-2xl border border-accent">
                   <label className="text-[10px] font-black uppercase text-navy/30 mb-1 block">Time</label>
                   <input type="time" value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} className="w-full font-black text-lg bg-transparent border-none p-0 focus:ring-0" />
               </div>

               <div className="bg-white p-4 rounded-2xl border border-accent">
                  <label className="text-[10px] font-black uppercase text-navy/30 mb-1 block">Notes</label>
                  <textarea rows={3} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Details..." className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 resize-none font-medium" />
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Schedule;
