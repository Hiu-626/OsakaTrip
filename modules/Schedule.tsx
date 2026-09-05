
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MapPin, 
  Settings, 
  Plus, 
  X, 
  GripVertical,
  Trash2,
  Check,
  Sparkles,
  Lightbulb,
  LayoutGrid,
  MoreHorizontal,
  CalendarDays,
  ArrowRight,
  Navigation,
  Ticket as TicketIcon,
  Download,
  Upload,
  FileJson,
  Edit2,
  Clock,
  ShoppingBag,
  Utensils,
  Smile,
  Image as ImageIcon,
  Camera,
  RotateCcw
} from 'lucide-react';
import { TripConfig, ScheduleItem, Category, TripMember, Booking } from '../types.ts';
import { COLORS } from '../constants.ts';

interface ScheduleProps {
  config: TripConfig;
  members: TripMember[];
  currentUser: TripMember;
  onAddMember: (name: string, avatar: string) => void;
  onUpdateMember: (id: string, name: string, avatar: string) => void;
  onDeleteMember: (id: string) => void;
  onSwitchUser: (member: TripMember) => void;
  onNavigate: (tab: any, id?: string) => void;
  onOpenFullExport?: () => void;
}

const Schedule: React.FC<ScheduleProps> = ({ 
  config: initialConfig, 
  members, 
  currentUser, 
  onAddMember, 
  onUpdateMember,
  onDeleteMember, 
  onSwitchUser,
  onNavigate,
  onOpenFullExport
}) => {
  const [config, setConfig] = useState<TripConfig>(() => {
    const saved = localStorage.getItem('tripConfig');
    return saved ? JSON.parse(saved) : initialConfig;
  });

  const [itinerary, setItinerary] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('itinerary');
    return saved ? JSON.parse(saved) : [
      { id: '1', dayIndex: 0, time: '10:00', endTime: '11:30', title: 'Arrival', location: 'NRT Terminal 1', category: 'Transport' as Category },
      { id: '2', dayIndex: 0, time: '13:30', endTime: '14:30', title: 'Lunch', location: 'Ichiran Shinjuku', category: 'Restaurant' as Category },
    ];
  });

  const [pool, setPool] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('inspiration_pool');
    return saved ? JSON.parse(saved) : [
      { id: 'p1', dayIndex: -1, time: '--:--', title: 'Idea', location: 'TeamLab Planets', category: 'Attraction' as Category },
      { id: 'p2', dayIndex: -1, time: '--:--', title: 'Idea', location: 'Shibuya Sky', category: 'Attraction' as Category },
    ];
  });

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDay, setSelectedDay] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);
  const [addItemTarget, setAddItemTarget] = useState<'schedule' | 'pool'>('schedule');
  const [movingItem, setMovingItem] = useState<ScheduleItem | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberAvatarType, setNewMemberAvatarType] = useState<'emoji' | 'upload' | 'random'>('emoji');
  const [newMemberEmoji, setNewMemberEmoji] = useState('😎');
  const [uploadedAvatar, setUploadedAvatar] = useState('');
  const [draggedData, setDraggedData] = useState<{ item: ScheduleItem, source: 'pool' | 'schedule' } | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [isPoolDragOver, setIsPoolDragOver] = useState(false);
  const [swipeId, setSwipeId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem('tripConfig', JSON.stringify(config)); }, [config]);
  useEffect(() => { localStorage.setItem('itinerary', JSON.stringify(itinerary)); }, [itinerary]);
  useEffect(() => { localStorage.setItem('inspiration_pool', JSON.stringify(pool)); }, [pool]);

  useEffect(() => {
    const savedBookings = localStorage.getItem('bookings');
    if (savedBookings) {
      setBookings(JSON.parse(savedBookings));
    }
  }, [isAddModalOpen, selectedDay]);

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

  const getDurationString = (start: string, end?: string) => {
    if (!end || end === '--:--') return '';
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diffMins = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMins < 0) diffMins += 24 * 60;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m` : ''}`.trim();
  };

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

  const deleteItem = (id: string, from: 'pool' | 'schedule') => {
    if (from === 'pool') setPool(pool.filter(i => i.id !== id));
    else setItinerary(itinerary.filter(i => i.id !== id));
    setSwipeId(null);
  };

  const moveItemToDay = (item: ScheduleItem, targetDayIndex: number) => {
    if (item.dayIndex === -1) {
       setPool(pool.filter(i => i.id !== item.id));
    } else {
       setItinerary(itinerary.filter(i => i.id !== item.id));
    }
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

  const openEditModal = (e: React.MouseEvent, item: ScheduleItem, target: 'pool' | 'schedule') => {
    e.stopPropagation();
    setAddItemTarget(target);
    setModalMode('edit');
    setEditingItem(item);
    setIsAddModalOpen(true);
    setSwipeId(null);
  };

  const handlePoolItemClick = (item: ScheduleItem) => {
    setMovingItem(item);
  };

  const handleSaveItem = (itemData: any) => {
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
      const oldDayIndex = editingItem.dayIndex;
      if (oldDayIndex !== targetDayIndex) {
         if (oldDayIndex === -1) setPool(prev => prev.filter(i => i.id !== editingItem.id));
         else setItinerary(prev => prev.filter(i => i.id !== editingItem.id));
         if (targetDayIndex === -1) setPool(prev => [...prev, updatedItem]);
         else setItinerary(prev => [...prev, updatedItem]);
      } else {
         if (targetDayIndex === -1) setPool(pool.map(i => i.id === updatedItem.id ? updatedItem : i));
         else setItinerary(itinerary.map(i => i.id === updatedItem.id ? updatedItem : i));
      }
    }
    setIsAddModalOpen(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.src = ev.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const size = 200;
          canvas.width = size;
          canvas.height = size;
          const ratio = Math.max(size / img.width, size / img.height);
          const centerShift_x = (size - img.width * ratio) / 2;
          const centerShift_y = (size - img.height * ratio) / 2;
          ctx?.drawImage(img, 0, 0, img.width, img.height, centerShift_x, centerShift_y, img.width * ratio, img.height * ratio);
          setUploadedAvatar(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const startEditingMember = (member: TripMember) => {
    setEditingMemberId(member.id);
    setNewMemberName(member.name);
    if (member.avatar.startsWith('data:image/svg')) {
      setNewMemberAvatarType('emoji');
      setNewMemberEmoji('😎');
    } else if (member.avatar.startsWith('data:image')) {
      setNewMemberAvatarType('upload');
      setUploadedAvatar(member.avatar);
    } else {
      setNewMemberAvatarType('random');
    }
  };

  const cancelEditingMember = () => {
    setEditingMemberId(null);
    setNewMemberName('');
    setUploadedAvatar('');
    setNewMemberAvatarType('emoji');
  };

  const handleMemberSubmit = () => {
    if (newMemberName.trim()) {
      let avatarUrl = '';
      if (newMemberAvatarType === 'emoji') {
         const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f8f9f5" rx="20" ry="20"/><text y=".9em" font-size="80" x="50" text-anchor="middle">${newMemberEmoji}</text></svg>`;
         avatarUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      } else if (newMemberAvatarType === 'upload' && uploadedAvatar) {
         avatarUrl = uploadedAvatar;
      } else if (newMemberAvatarType === 'random') {
         if (editingMemberId) {
            const existing = members.find(m => m.id === editingMemberId);
            if (existing && !existing.avatar.startsWith('data:')) {
               avatarUrl = existing.avatar;
            } else {
               const randomId = Math.floor(Math.random() * 1000);
               avatarUrl = `https://picsum.photos/seed/${newMemberName}${randomId}/200`;
            }
         } else {
            const randomId = Math.floor(Math.random() * 1000);
            avatarUrl = `https://picsum.photos/seed/${newMemberName}${randomId}/200`;
         }
      }
      if (editingMemberId) onUpdateMember(editingMemberId, newMemberName.trim(), avatarUrl);
      else onAddMember(newMemberName.trim(), avatarUrl);
      cancelEditingMember();
    }
  };

  const handleOpenMaps = (e: React.MouseEvent, location: string) => {
    e.stopPropagation();
    const query = encodeURIComponent(location);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const handleExportData = () => {
    if (onOpenFullExport) {
      setIsSettingsOpen(false);
      onOpenFullExport();
      return;
    }
    const backupData = {
      tripConfig: localStorage.getItem('tripConfig'),
      itinerary: localStorage.getItem('itinerary'),
      inspiration_pool: localStorage.getItem('inspiration_pool'),
      trip_members: localStorage.getItem('trip_members'),
      bookings: localStorage.getItem('bookings'),
      expenses: localStorage.getItem('expenses'),
      journal_posts: localStorage.getItem('journal_posts'),
      planning_items: localStorage.getItem('planning_items'),
      baseCurrency: localStorage.getItem('baseCurrency'),
      timestamp: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OhanaTrip_Backup_${(config.tripName || 'Trip').replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (link.parentNode) link.parentNode.removeChild(link);
      URL.revokeObjectURL(url);
    }, 45000);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(jsonStr).catch(() => {});
    }
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (window.confirm('⚠️ 警告：匯入行程檔案將會「完全覆蓋」目前所有的行程、記帳與票券資料。\n\n確定要載入備份檔案嗎？')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.tripConfig) localStorage.setItem('tripConfig', data.tripConfig);
          if (data.itinerary) localStorage.setItem('itinerary', data.itinerary);
          if (data.inspiration_pool) localStorage.setItem('inspiration_pool', data.inspiration_pool);
          if (data.trip_members) localStorage.setItem('trip_members', data.trip_members);
          if (data.bookings) localStorage.setItem('bookings', data.bookings);
          if (data.expenses) localStorage.setItem('expenses', data.expenses);
          if (data.journal_posts) localStorage.setItem('journal_posts', data.journal_posts);
          if (data.planning_items) localStorage.setItem('planning_items', data.planning_items);
          if (data.baseCurrency) localStorage.setItem('baseCurrency', data.baseCurrency);
          alert('✅ 匯入成功！App 將重新啟動以載入新行程。');
          window.location.reload();
        } catch (error) {
          alert('❌ 匯入失敗：檔案格式錯誤或損毀。');
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <div className="bg-stitch text-white p-6 rounded-2xl-sticker sticker-shadow flex justify-between items-center relative overflow-hidden border-2 border-white/20">
        <div className="z-10">
          <p className="text-[10px] font-black opacity-70 uppercase tracking-[0.3em] mb-1">Adventure Starts In</p>
          <h2 className="text-4xl font-black drop-shadow-sm">{countdown} Days</h2>
        </div>
        <div className="text-6xl opacity-20 absolute -right-2 -bottom-2 transform rotate-12 z-0">🏝️</div>
      </div>

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
        <div className={`min-h-[110px] p-4 rounded-2xl-sticker border-2 border-dashed flex gap-3 overflow-x-auto snap-x scrollbar-hide items-center ${isPoolDragOver ? 'bg-stitch/10 border-stitch' : 'bg-white border-accent'}`}>
          {pool.length > 0 ? pool.map((item) => (
            <div 
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item, 'pool')}
              onDragEnd={handleDragEnd}
              onClick={() => handlePoolItemClick(item)}
              className="flex-shrink-0 w-44 snap-center cursor-pointer active:cursor-grabbing group"
            >
              <div className="bg-paper p-3 rounded-xl-sticker sticker-shadow border border-accent relative hover:-translate-y-1 transition-transform duration-300 active:scale-105 active:shadow-xl h-full">
                 <div className="flex justify-between items-start mb-2 relative z-10">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider text-white" style={{ backgroundColor: COLORS[item.category.toLowerCase() as keyof typeof COLORS] || COLORS.stitch }}>
                      {item.category}
                    </span>
                    <div className="flex items-center gap-1">
                       <button onClick={(e) => openEditModal(e, item, 'pool')} className="text-navy/20 hover:text-stitch bg-cream p-1 rounded-full"><Edit2 size={10} /></button>
                       <button onClick={(e) => {e.stopPropagation(); deleteItem(item.id, 'pool')}} className="text-navy/20 hover:text-red-400 bg-cream p-1 rounded-full"><X size={10} /></button>
                    </div>
                 </div>
                 <h4 className="font-black text-navy text-sm leading-tight mb-1 truncate">{item.location}</h4>
                 <div className="flex items-center justify-between mt-2 pt-2 border-t border-accent/30">
                    <p className="text-[9px] font-bold text-navy/30 truncate flex-1">{item.notes || 'Tap to assign day'}</p>
                    <div className="p-1 bg-stitch/10 text-stitch rounded-full animate-pulse"><ArrowRight size={12} /></div>
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

      <div className="space-y-4 min-h-[300px]" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { if (e.target === e.currentTarget) handleDropOnScheduleList(-1); }}>
        {currentDayItems.length > 0 ? currentDayItems.map((item, idx) => {
          const linkedBooking = bookings.find(b => b.linkedScheduleId === item.id);
          const durationStr = getDurationString(item.time, item.endTime);
          return (
            <div key={item.id} className="relative group transition-all" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); handleDropOnScheduleList(idx); }}>
              <div className="flex items-start gap-3 relative" draggable onDragStart={(e) => handleDragStart(e, item, 'schedule')} onDragEnd={handleDragEnd} onClick={(e) => openEditModal(e, item, 'schedule')}>
                <div className="mt-8 text-navy/10 cursor-grab active:cursor-grabbing group-hover:text-navy/30 transition-colors hidden md:block"><GripVertical size={20} /></div>
                <div className="flex-1 relative overflow-hidden rounded-xl-sticker cursor-pointer">
                  <div className={`absolute inset-0 bg-red-500 flex items-center px-6 transition-opacity ${swipeId === item.id ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                    <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id, 'schedule'); }} className="text-white flex items-center gap-2 font-black"><Trash2 size={20} /> DELETE</button>
                  </div>
                  <div className={`bg-paper p-5 rounded-xl-sticker sticker-shadow border border-accent transition-all duration-300 active:scale-[1.02] hover:border-stitch/50 ${swipeId === item.id ? 'translate-x-32' : 'translate-x-0'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white shadow-sm" style={{ backgroundColor: COLORS[item.category.toLowerCase() as keyof typeof COLORS] || COLORS.stitch }}>{item.category}</span>
                        {durationStr && <div className="flex items-center gap-1 text-[9px] font-bold text-navy/40 bg-accent/20 px-2 py-1 rounded-full"><Clock size={10} />{durationStr}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                         <button onClick={(e) => { e.stopPropagation(); setMovingItem(item); }} className="p-2 bg-cream text-navy/30 rounded-full hover:bg-stitch hover:text-white transition-colors"><CalendarDays size={16} /></button>
                         <button onClick={(e) => { e.stopPropagation(); setSwipeId(swipeId === item.id ? null : item.id); }} className="text-navy/20 active:scale-125 transition-transform"><MoreHorizontal size={20} /></button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 mb-3">
                       <h3 className="text-2xl font-black text-navy leading-none tracking-tight">{item.title || item.location}</h3>
                       <div className="flex items-center gap-1.5 text-navy/50"><MapPin size={12} className="text-stitch" /><span className="text-xs font-bold truncate">{item.location}</span></div>
                    </div>
                    <div className="flex items-center justify-between border-t border-accent/30 pt-3 mt-1">
                       <div className="text-xl font-black text-navy tabular-nums">{item.time}{item.endTime && <span className="text-navy/30 text-base font-bold ml-1">- {item.endTime}</span>}</div>
                       <div className="flex gap-2">
                          <button onClick={(e) => handleOpenMaps(e, item.location)} className="flex items-center gap-1 px-3 py-1.5 bg-cream rounded-full border border-accent text-[10px] font-black text-navy/60 hover:bg-green-100 hover:text-green-700 transition-all active:scale-95"><Navigation size={10} /> GO</button>
                          {linkedBooking && <button onClick={(e) => { e.stopPropagation(); onNavigate('bookings', linkedBooking.id); }} className="flex items-center gap-1 px-3 py-1.5 bg-donald/20 rounded-full border border-donald/50 text-[10px] font-black text-navy/70 hover:bg-donald hover:text-navy transition-all active:scale-95"><TicketIcon size={10} /> TICKET</button>}
                       </div>
                    </div>
                    {item.notes && <div className="mt-3 text-[10px] text-navy/60 bg-cream/50 p-2 rounded-lg italic leading-relaxed whitespace-pre-wrap">{item.notes}</div>}
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
        <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 bg-white text-navy rounded-full sticker-shadow border border-accent flex items-center justify-center active:scale-90 transition-transform"><Settings size={20} /></button>
        <button onClick={() => openAddModal('schedule')} className="w-14 h-14 bg-donald text-navy rounded-full sticker-shadow border-2 border-paper flex items-center justify-center active:scale-95 transition-transform shadow-lg"><Plus size={32} /></button>
      </div>

      {movingItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-navy/30 backdrop-blur-xs animate-in fade-in" onClick={() => setMovingItem(null)}>
           <div className="bg-paper w-full max-w-sm rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 animate-in zoom-in-95 my-auto max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-accent/40">
                 <h3 className="text-base font-black text-navy uppercase tracking-wider">移至指定天數</h3>
                 <button onClick={() => setMovingItem(null)} className="p-1.5 bg-cream hover:bg-accent/40 rounded-full text-navy/40"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2.5 overflow-y-auto pr-1">
                 {days.map(day => (
                    <button key={day.index} onClick={() => moveItemToDay(movingItem, day.index)} className={`p-3 rounded-2xl border-2 transition-all text-left ${movingItem.dayIndex === day.index ? 'bg-navy border-navy text-white sticker-shadow' : 'bg-white border-accent text-navy hover:border-stitch'}`}>
                       <p className="text-[9px] font-black uppercase opacity-60 mb-0.5">{day.weekday}</p>
                       <p className="text-lg font-black">{day.date}</p>
                    </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-navy/30 backdrop-blur-xs animate-in fade-in" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-paper w-full max-w-md rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 relative animate-in zoom-in-95 flex flex-col max-h-[80vh] my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
             <div className="flex justify-between items-center mb-4 pb-3 border-b border-accent/40">
               <div>
                 <h3 className="text-lg font-black text-navy uppercase tracking-wider">旅程設定 Settings</h3>
                 <p className="text-[10px] font-bold text-navy/40">調整旅程基本資訊與成員</p>
               </div>
               <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream hover:bg-accent/40 rounded-full text-navy/40 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto pr-1 space-y-5 flex-1 min-h-0">
               <div className="space-y-3">
                 <h4 className="text-[10px] font-black uppercase text-navy/40 tracking-[0.2em]">基本資訊 General</h4>
                 <div><label className="text-[10px] uppercase text-navy/40 block mb-1 font-bold">旅程名稱</label><input type="text" value={config.tripName || ''} onChange={e => setConfig({...config, tripName: e.target.value})} className="w-full p-2.5 bg-cream rounded-xl font-bold border border-accent text-sm" /></div>
                 <div><label className="text-[10px] uppercase text-navy/40 block mb-1 font-bold">目的地/地區</label><input type="text" value={config.region} onChange={e => setConfig({...config, region: e.target.value})} className="w-full p-2.5 bg-cream rounded-xl font-bold border border-accent text-sm" /></div>
                 <div className="grid grid-cols-2 gap-3">
                   <div><label className="text-[10px] uppercase text-navy/40 block mb-1 font-bold">出發日期</label><input type="date" value={config.startDate} onChange={e => setConfig({...config, startDate: e.target.value})} className="w-full p-2.5 bg-cream rounded-xl font-bold border border-accent text-xs" /></div>
                   <div><label className="text-[10px] uppercase text-navy/40 block mb-1 font-bold">天數</label><input type="number" value={config.duration} onChange={e => setConfig({...config, duration: parseInt(e.target.value) || 1})} className="w-full p-2.5 bg-cream rounded-xl font-bold border border-accent text-sm" /></div>
                 </div>
               </div>
               <div className="space-y-3 pt-4 border-t border-accent/40">
                 <h4 className="text-[10px] font-black uppercase text-navy/40 tracking-[0.2em]">成員管理 Members</h4>
                 <div className="space-y-2">
                    {members.map(member => (
                       <div key={member.id} className="flex items-center justify-between p-2.5 bg-cream rounded-xl border border-accent/50 group">
                          <div className="flex items-center gap-2.5"><img src={member.avatar} className="w-7 h-7 rounded-full border border-white object-cover" /><div><p className="font-black text-xs text-navy">{member.name}</p></div></div>
                          <div className="flex items-center gap-1">
                             <button onClick={() => startEditingMember(member)} className="p-1.5 text-navy/40 hover:text-stitch active:scale-90 transition-colors"><Edit2 size={14} /></button>
                             {currentUser.id !== member.id && <button onClick={() => onDeleteMember(member.id)} className="p-1.5 text-navy/40 hover:text-red-400 active:scale-90 transition-colors"><Trash2 size={14} /></button>}
                          </div>
                       </div>
                    ))}
                 </div>
                 <div className={`bg-cream p-3.5 rounded-xl border transition-all ${editingMemberId ? 'border-stitch ring-1 ring-stitch shadow-md' : 'border-accent/60'}`}>
                    <div className="flex justify-between items-center mb-2"><p className="text-[10px] font-black uppercase text-navy/40 tracking-widest">{editingMemberId ? '編輯成員資料' : '新增旅伴成員'}</p>{editingMemberId && <button onClick={cancelEditingMember} className="flex items-center gap-1 text-[9px] font-bold text-red-400 uppercase"><RotateCcw size={10} /> 取消</button>}</div>
                    <div className="space-y-2.5">
                       <input type="text" value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="輸入成員名稱" className="w-full p-2.5 bg-white border border-accent rounded-xl text-xs font-bold focus:ring-2 focus:ring-stitch outline-none" />
                       <div className="flex gap-1 p-1 bg-white rounded-lg border border-accent/40">
                          <button onClick={() => setNewMemberAvatarType('emoji')} className={`flex-1 py-1 rounded-md text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all ${newMemberAvatarType === 'emoji' ? 'bg-donald text-navy shadow-sm' : 'text-navy/30'}`}><Smile size={12} /> Emoji</button>
                          <button onClick={() => setNewMemberAvatarType('upload')} className={`flex-1 py-1 rounded-md text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all ${newMemberAvatarType === 'upload' ? 'bg-stitch text-white shadow-sm' : 'text-navy/30'}`}><Upload size={12} /> 上傳</button>
                          <button onClick={() => setNewMemberAvatarType('random')} className={`flex-1 py-1 rounded-md text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all ${newMemberAvatarType === 'random' ? 'bg-white border text-navy shadow-sm' : 'text-navy/30'}`}><ImageIcon size={12} /> 隨機</button>
                       </div>
                       {newMemberAvatarType === 'emoji' && <div className="flex items-center gap-2"><input type="text" maxLength={2} value={newMemberEmoji} onChange={e => setNewMemberEmoji(e.target.value)} className="w-10 h-10 text-center text-xl bg-white border border-accent rounded-xl focus:ring-2 focus:ring-donald outline-none" /><p className="text-[10px] text-navy/40 font-bold">選擇一個 Emoji 表情</p></div>}
                       {newMemberAvatarType === 'upload' && <div className="w-full h-20 border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white relative overflow-hidden group hover:border-stitch/50 transition-colors" onClick={() => document.getElementById('setting-avatar-upload')?.click()}>{uploadedAvatar ? <div className="relative w-full h-full group-hover:opacity-90 transition-opacity"><img src={uploadedAvatar} className="w-full h-full object-cover" /><div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20"><Camera size={18} className="text-white drop-shadow-md" /></div><button onClick={(e) => { e.stopPropagation(); setUploadedAvatar(''); }} className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 active:scale-95 transition-all z-10"><X size={10} strokeWidth={3} /></button></div> : <><Camera size={18} className="text-stitch mb-0.5" /><span className="text-[10px] font-black text-navy/40 uppercase">點擊上傳頭像</span></>}<input id="setting-avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" /></div>}
                       <button onClick={handleMemberSubmit} disabled={!newMemberName.trim()} className="w-full py-2.5 bg-navy text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 mt-1 hover:bg-navy/90 active:scale-95 transition-all">{editingMemberId ? <><Check size={14} /> 儲存成員變更</> : <><Plus size={14} /> 新增成員</>}</button>
                    </div>
                 </div>
               </div>
               <div className="space-y-3 pt-4 border-t border-accent/40">
                 <h4 className="text-[10px] font-black uppercase text-navy/40 tracking-[0.2em] flex items-center gap-1.5"><FileJson size={12} /> 資料備份 Data Backup</h4>
                 <div className="grid grid-cols-2 gap-2.5">
                   <button onClick={handleExportData} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-navy/5 border border-navy/10 rounded-xl hover:bg-stitch/10 hover:border-stitch/30 transition-colors active:scale-95"><div className="p-1.5 bg-white rounded-full text-navy shadow-xs"><Download size={16} /></div><span className="text-[10px] font-black uppercase tracking-wider text-navy">匯出備份</span></button>
                   <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-donald/10 border border-donald/20 rounded-xl hover:bg-donald/20 hover:border-donald/40 transition-colors active:scale-95"><div className="p-1.5 bg-white rounded-full text-navy shadow-xs"><Upload size={16} /></div><span className="text-[10px] font-black uppercase tracking-wider text-navy">匯入備份</span><input type="file" ref={fileInputRef} onChange={handleImportData} accept=".json" className="hidden" /></button>
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
      {isAddModalOpen && (
        <AddItemModal target={addItemTarget} mode={modalMode} initialData={editingItem} duration={config.duration} startDate={config.startDate} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveItem} />
      )}
    </div>
  );
};

const AddItemModal: React.FC<{ target: 'pool' | 'schedule'; mode: 'add' | 'edit'; initialData: ScheduleItem | null; duration: number; startDate: string; onClose: () => void; onSave: (item: any) => void }> = ({ target, mode, initialData, duration, startDate, onClose, onSave }) => {
  const [formData, setFormData] = useState({ 
    dayIndex: initialData?.dayIndex !== undefined ? initialData.dayIndex : (target === 'pool' ? -1 : 0), 
    time: initialData?.time || '10:00', 
    endTime: initialData?.endTime || '', 
    title: initialData?.title || '', 
    location: initialData?.location || '', 
    category: initialData?.category || 'Attraction', 
    notes: initialData?.notes || '', 
  });
  const [showDetails, setShowDetails] = useState(target === 'schedule' || mode === 'edit'); 
  const categories: Category[] = ['Attraction', 'Restaurant', 'Transport', 'Stay', 'Shopping', 'Other'];
  const daysOptions = Array.from({ length: duration }, (_, i) => { 
    const d = new Date(startDate); 
    d.setDate(d.getDate() + i); 
    return { index: i, label: `Day ${i + 1} - ${d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}` }; 
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-paper w-full max-w-md rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[82vh] my-auto overflow-hidden animate-in zoom-in-95" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 mb-3 border-b border-accent/40">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-stitch/15 text-stitch flex items-center justify-center font-bold">
              <MapPin size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-navy uppercase tracking-wider">
                {mode === 'add' ? (target === 'pool' ? '新增靈感景點' : '新增行程站點') : '編輯行程景點'}
              </h3>
              <p className="text-[10px] font-bold text-navy/40">
                {target === 'pool' ? '放入靈感池待排' : `排入特定天數行程`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-cream hover:bg-accent/40 rounded-full text-navy/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {/* Main Input - Location */}
          <div className="bg-white p-4 rounded-2xl border border-accent sticker-shadow">
            <label className="text-[10px] font-black uppercase text-navy/40 mb-1.5 block tracking-wider">地點 / 景點名稱 (必填)</label>
            <div className="flex items-center gap-2.5">
              <MapPin size={22} className="text-stitch flex-shrink-0" />
              <input 
                autoFocus 
                type="text" 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})} 
                placeholder="例如：清水寺、心齋橋、東京鐵塔" 
                className="w-full text-lg font-black bg-transparent border-none p-0 focus:ring-0 text-navy placeholder:text-navy/20" 
              />
            </div>
            <div className="mt-3 pt-3 border-t border-accent/20">
               <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block tracking-wider">備註標題 (選填)</label>
               <input 
                 type="text" 
                 value={formData.title} 
                 onChange={e => setFormData({...formData, title: e.target.value})} 
                 placeholder="活動簡稱 (例如：買伴手禮、拍照)" 
                 className="w-full text-sm font-bold bg-transparent border-none p-0 focus:ring-0 text-navy/80 placeholder:text-navy/20" 
               />
            </div>
          </div>

          {/* Categories Chips */}
          <div>
             <label className="text-[10px] font-black uppercase text-navy/40 mb-2 block px-0.5 tracking-wider">景點類別 Category</label>
             <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {categories.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFormData({...formData, category: cat as any})}
                    className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all ${
                      formData.category === cat 
                        ? 'bg-navy border-navy text-white sticker-shadow scale-105' 
                        : 'bg-white border-accent text-navy/50 hover:bg-cream'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
             </div>
          </div>

          {/* Details toggle */}
          <div className="space-y-3">
             {!showDetails && (
                <button 
                  type="button"
                  onClick={() => setShowDetails(true)} 
                  className="w-full py-2.5 text-xs font-black text-stitch uppercase tracking-widest flex items-center justify-center gap-1.5 hover:bg-stitch/10 bg-stitch/5 rounded-xl transition-colors border border-stitch/20"
                >
                   <Plus size={14} /> 設定時間、指定天數與備註
                </button>
             )}
             
             {showDetails && (
               <div className="space-y-3 animate-in fade-in duration-200">
                 <div className="bg-white p-3.5 rounded-2xl border border-accent">
                   <label className="text-[10px] font-black uppercase text-navy/40 mb-1.5 block">指定天數 Day</label>
                   <select 
                     value={formData.dayIndex} 
                     onChange={e => setFormData({...formData, dayIndex: parseInt(e.target.value)})} 
                     className="w-full font-black text-sm bg-transparent border-none p-0 focus:ring-0 text-navy cursor-pointer"
                   >
                     <option value={-1}>💡 靈感池 Inspiration Pool (無特定日期)</option>
                     {daysOptions.map(d => (
                       <option key={d.index} value={d.index}>{d.label}</option>
                     ))}
                   </select>
                 </div>

                 <div className="bg-white p-3.5 rounded-2xl border border-accent">
                   <label className="text-[10px] font-black uppercase text-navy/40 mb-1.5 block">時間安排 Time</label>
                   <div className="flex items-center gap-2">
                     <div className="flex-1">
                       <span className="text-[9px] uppercase text-navy/30 font-bold block mb-1">開始時間</span>
                       <input 
                         type="time" 
                         value={formData.time} 
                         onChange={e => setFormData({...formData, time: e.target.value})} 
                         className="w-full font-black text-base bg-transparent border-none p-0 focus:ring-0 text-navy" 
                       />
                     </div>
                     <ArrowRight size={14} className="text-navy/20 mt-4 shrink-0" />
                     <div className="flex-1">
                       <span className="text-[9px] uppercase text-navy/30 font-bold block mb-1">結束時間 (選填)</span>
                       <input 
                         type="time" 
                         value={formData.endTime} 
                         onChange={e => setFormData({...formData, endTime: e.target.value})} 
                         className="w-full font-black text-base bg-transparent border-none p-0 focus:ring-0 text-navy/60" 
                       />
                     </div>
                   </div>
                 </div>

                 <div className="bg-white p-3.5 rounded-2xl border border-accent">
                   <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block">詳細備註 / 交通資訊</label>
                   <textarea 
                     rows={2} 
                     value={formData.notes} 
                     onChange={e => setFormData({...formData, notes: e.target.value})} 
                     placeholder="例如：地鐵御堂筋線、預約號碼、門票已在 Klook 購買..." 
                     className="w-full text-xs bg-transparent border-none p-0 focus:ring-0 resize-none font-medium text-navy placeholder:text-navy/20" 
                   />
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="pt-3 mt-3 border-t border-accent/40 flex items-center gap-2">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 py-3 bg-cream hover:bg-accent/30 text-navy/60 font-black rounded-xl text-xs uppercase tracking-wider transition-colors"
          >
            取消
          </button>
          <button 
            type="button" 
            onClick={() => onSave(formData)} 
            disabled={!formData.location.trim()} 
            className="flex-2 py-3 bg-stitch hover:bg-navy text-white font-black rounded-xl text-xs uppercase tracking-widest sticker-shadow active:translate-y-0.5 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Check size={15} />
            <span>{mode === 'add' ? '完成新增' : '儲存變更'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Schedule;
