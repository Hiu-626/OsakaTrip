
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plane, 
  Hotel, 
  Car, 
  Utensils, 
  Ticket as TicketIcon, 
  Plus, 
  X, 
  Camera, 
  Edit2, 
  Trash2, 
  Hash, 
  Search,
  User,
  Copy,
  Sparkles,
  MapPin,
  ArrowUpRight,
  Wand2,
  CopyPlus,
  ChevronUp,
  ChevronDown,
  Download,
  Link
} from 'lucide-react';
import { Booking, TripMember, ScheduleItem } from '../types.ts';
import { GoogleGenAI } from "@google/genai";

interface BookingsProps {
  members: TripMember[];
  currentUser: TripMember;
  onNavigate: (tab: string, id?: string) => void;
  highlightId?: string | null;
}

const Bookings: React.FC<BookingsProps> = ({ members, currentUser, onNavigate, highlightId }) => {
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const saved = localStorage.getItem('bookings');
    return saved ? JSON.parse(saved) : [
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
    ];
  });

  const [itinerary, setItinerary] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('itinerary');
    return saved ? JSON.parse(saved) : [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string | 'All'>('All');

  useEffect(() => {
    localStorage.setItem('bookings', JSON.stringify(bookings));
  }, [bookings]);

  useEffect(() => {
    const saved = localStorage.getItem('itinerary');
    if (saved) setItinerary(JSON.parse(saved));
    if (highlightId) setExpandedId(highlightId);
  }, [highlightId, isModalOpen]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete?')) {
      setBookings(bookings.filter(b => b.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setEditingBooking(booking); 
    setIsModalOpen(true);
  };

  const handleDuplicate = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    const newBooking: Booking = { ...booking, id: Date.now().toString(), title: `${booking.title} (Copy)` };
    const index = bookings.findIndex(b => b.id === booking.id);
    const newBookings = [...bookings];
    newBookings.splice(index + 1, 0, newBooking);
    setBookings(newBookings);
  };

  const handleMove = (e: React.MouseEvent, id: string, direction: 'up' | 'down') => {
    e.stopPropagation();
    const index = bookings.findIndex(b => b.id === id);
    if (index === -1) return;
    const newBookings = [...bookings];
    if (direction === 'up') {
      if (index === 0) return;
      [newBookings[index - 1], newBookings[index]] = [newBookings[index], newBookings[index - 1]];
    } else {
      if (index === newBookings.length - 1) return;
      [newBookings[index + 1], newBookings[index]] = [newBookings[index], newBookings[index + 1]];
    }
    setBookings(newBookings);
  };

  const handleSave = (booking: Booking) => {
    if (editingBooking) setBookings(bookings.map(b => b.id === booking.id ? booking : b));
    else setBookings([...bookings, { ...booking, id: Date.now().toString() }]);
    setIsModalOpen(false);
    setEditingBooking(null);
  };

  const copyToClipboard = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.type.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (b.referenceNo && b.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesUser = filterUser === 'All' || b.bookedBy === filterUser;
      return matchesSearch && matchesUser;
    });
  }, [bookings, searchTerm, filterUser]);

  const renderHeaderStrip = (booking: Booking, isExpanded: boolean, index: number, total: number) => {
    let icon = <TicketIcon size={18} />;
    let bgColor = 'bg-white';
    let textColor = 'text-navy';
    let accentColor = 'bg-accent';

    switch (booking.type) {
      case 'Flight': icon = <Plane size={18} className="text-white" />; bgColor = 'bg-navy'; textColor = 'text-white'; accentColor = 'bg-stitch'; break;
      case 'Hotel': icon = <Hotel size={18} className="text-stitch" />; accentColor = 'bg-stitch'; break;
      case 'Amusement': icon = <Sparkles size={18} className="text-navy" />; bgColor = 'bg-donald'; accentColor = 'bg-white'; break;
      case 'Restaurant': icon = <Utensils size={18} className="text-red-400" />; accentColor = 'bg-red-200'; break;
      case 'Car': icon = <Car size={18} className="text-navy" />; bgColor = 'bg-accent/30'; accentColor = 'bg-white'; break;
    }

    const displayTime = booking.details.time || booking.details.checkIn || booking.details.datetime?.split('T')[1] || '';
    const displayDate = booking.details.date || booking.details.checkIn || booking.details.datetime?.split('T')[0] || '';
    const arrivalTime = booking.details.arrivalTime;

    return (
      <div className={`flex relative min-h-[100px] ${bgColor} ${textColor} transition-colors overflow-hidden`}>
        <div className="flex-1 p-4 flex flex-col relative z-10">
          <div className="flex justify-between items-start mb-2">
             <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${accentColor === 'bg-white' ? 'bg-white/80' : accentColor}`}>{icon}</div>
                <div className="flex flex-col">
                  <span className={`text-[9px] font-black uppercase tracking-widest opacity-60`}>{booking.type}</span>
                  <span className="text-xs font-black leading-none">{displayDate}</span>
                </div>
             </div>
             <div className="text-right">
                {booking.type === 'Flight' && arrivalTime ? (
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-black">{displayTime}</span>
                      <span className="opacity-50 text-[10px]">➔</span>
                      <span className="text-sm font-black">{arrivalTime}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-lg font-black">{displayTime}</p>
                )}
             </div>
          </div>
          <div className="flex-1">
            <h3 className="font-black text-lg leading-tight truncate pr-2">{booking.title}</h3>
            {booking.referenceNo && (
              <span className="flex items-center gap-1 text-[9px] font-bold opacity-60 mt-0.5">
                <Hash size={8} /> {booking.referenceNo}
              </span>
            )}
          </div>
        </div>
        <div className={`w-10 flex flex-col items-center justify-center gap-1 border-l ${booking.type === 'Flight' ? 'border-white/10 bg-black/10' : 'border-black/5 bg-black/5'}`} onClick={e => e.stopPropagation()}>
           <button onClick={(e) => handleMove(e, booking.id, 'up')} disabled={index === 0} className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-20"><ChevronUp size={14} /></button>
           <button onClick={(e) => handleDuplicate(e, booking)} className="p-1.5 rounded-full hover:bg-white/20"><CopyPlus size={12} /></button>
           <button onClick={(e) => handleMove(e, booking.id, 'down')} disabled={index === total - 1} className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-20"><ChevronDown size={14} /></button>
        </div>
      </div>
    );
  };

  const renderBookingDetails = (booking: Booking) => {
    const hasImage = !!booking.imageUrl;
    const linkedItem = itinerary.find(i => i.id === booking.linkedScheduleId);
    
    const DetailField = ({ label, value, fullWidth = false }: { label: string, value: any, fullWidth?: boolean }) => {
       if (!value || value === '') return null;
       return (
         <div className={`${fullWidth ? 'col-span-2' : ''}`}>
            <p className="text-[9px] font-black text-navy/30 uppercase tracking-widest mb-0.5">{label}</p>
            <p className="font-bold text-navy text-sm break-words leading-tight">{String(value)}</p>
         </div>
       );
    };

    return (
      <div className="animate-in fade-in duration-300 bg-white rounded-b-2xl-sticker overflow-hidden">
        {linkedItem && (
          <div onClick={() => onNavigate('schedule')} className="bg-stitch/10 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-stitch/20 transition-colors border-b border-dashed border-stitch/30">
             <div className="flex items-center gap-2 overflow-hidden">
                <MapPin size={12} className="text-stitch flex-shrink-0" />
                <span className="text-[10px] font-black uppercase text-stitch truncate">
                  Linked to: Day {linkedItem.dayIndex + 1} - {linkedItem.location}
                </span>
             </div>
             <ArrowUpRight size={12} className="text-stitch" />
          </div>
        )}
        {hasImage && (
          <div className="p-4 bg-white">
            <div className="w-full rounded-xl border-2 border-navy/5 p-1 shadow-inner bg-cream relative group">
              <img src={booking.imageUrl} alt="Voucher" className="w-full h-auto max-h-[300px] object-contain rounded-lg mix-blend-multiply" />
              <a href={booking.imageUrl} download={`ticket-${booking.id}.jpg`} onClick={e => e.stopPropagation()} className="absolute bottom-2 right-2 p-2 bg-white/80 rounded-full shadow-sm text-navy/40 hover:text-navy opacity-0 group-hover:opacity-100 transition-opacity">
                <Download size={14} />
              </a>
            </div>
          </div>
        )}
        <div className="relative h-4 w-full bg-white overflow-hidden -mt-1 mb-1">
          <div className="absolute top-1/2 left-0 w-full border-t-2 border-dashed border-accent/40"></div>
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-cream rounded-full border-r border-accent/20"></div>
          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-cream rounded-full border-l border-accent/20"></div>
        </div>
        <div className="p-5 pt-2 pb-6">
          {booking.referenceNo && (
            <div onClick={(e) => copyToClipboard(e, booking.referenceNo!)} className="flex items-center justify-between p-3 bg-cream/50 rounded-xl border border-accent/30 mb-5 cursor-pointer active:scale-[0.99] transition-transform group hover:border-stitch/30">
              <div>
                <p className="text-[9px] font-black uppercase text-navy/30 tracking-widest">Booking Ref</p>
                <p className="text-xl font-black text-navy font-mono tracking-wider">{booking.referenceNo}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-stitch group-hover:scale-110 transition-transform"><Copy size={14} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-y-5 gap-x-4">
            {booking.type === 'Flight' && (
              <>
                {(booking.details.from || booking.details.to) && (
                  <div className="col-span-2 flex items-center gap-4 p-3 rounded-xl border border-accent/30 bg-white shadow-sm mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-black text-navy/30 uppercase tracking-wider">From</p>
                      <p className="text-xl font-black text-navy truncate">{booking.details.from}</p>
                      <p className="text-[10px] font-bold text-navy/40">{booking.details.time}</p>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-20"><Plane size={20} className="rotate-90 text-navy" /><div className="w-12 border-t-2 border-dashed border-navy"></div></div>
                    <div className="flex-1 text-right min-w-0">
                      <p className="text-[9px] font-black text-navy/30 uppercase tracking-wider">To</p>
                      <p className="text-xl font-black text-navy truncate">{booking.details.to}</p>
                      <p className="text-[10px] font-bold text-navy/40">{booking.details.arrivalTime}</p>
                    </div>
                  </div>
                )}
                <DetailField label="Airline" value={booking.details.airline} />
                <DetailField label="Flight No" value={booking.details.flightNo} />
                <DetailField label="Gate" value={booking.details.gate} />
                <DetailField label="Seat" value={booking.details.seat} />
                <DetailField label="Class" value={booking.details.class} />
              </>
            )}
            {(booking.type === 'Hotel' || booking.type === 'Car') && (
              <>
                <DetailField label="Address" value={booking.details.address} fullWidth />
                <DetailField label="Check-In" value={booking.details.checkIn} />
                <DetailField label="Check-Out" value={booking.details.checkOut} />
                <DetailField label="Room" value={booking.details.room || booking.details.vehicle} fullWidth />
              </>
            )}
            {Object.entries(booking.details).map(([key, value]) => {
              const skip = ['from', 'to', 'gate', 'seat', 'checkIn', 'checkOut', 'address', 'airline', 'flightNo', 'class', 'room', 'vehicle', 'arrivalTime', 'time', 'date'];
              if (skip.includes(key)) return null;
              return <DetailField key={key} label={key} value={value} fullWidth={String(value).length > 20} />;
            })}
          </div>
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-accent/30">
            <button onClick={(e) => handleEdit(e, booking)} className="flex items-center gap-1 px-4 py-2 bg-cream rounded-full text-[10px] font-black text-navy hover:bg-stitch hover:text-white transition-colors"><Edit2 size={12} /> EDIT</button>
            <button onClick={(e) => handleDelete(e, booking.id)} className="flex items-center gap-1 px-4 py-2 bg-cream rounded-full text-[10px] font-black text-red-400 hover:bg-red-400 hover:text-white transition-colors"><Trash2 size={12} /> REMOVE</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 min-h-screen">
      <div className="flex justify-between items-center px-1 sticky top-0 bg-cream/95 backdrop-blur-sm z-[60] py-4 border-b border-accent/20">
        <div>
          <h2 className="text-2xl font-black text-navy">Ticket Wallet</h2>
          <p className="text-[10px] font-bold text-navy/30 uppercase tracking-[0.2em]">{filteredBookings.length} Vouchers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsSearchVisible(!isSearchVisible)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isSearchVisible ? 'bg-navy text-white' : 'bg-white text-navy/40 border border-accent'}`}><Search size={18} /></button>
          <button onClick={() => { setEditingBooking(null); setIsModalOpen(true); }} className="w-10 h-10 bg-donald rounded-full flex items-center justify-center text-navy shadow-lg border border-white active:scale-90 transition-transform"><Plus size={20} /></button>
        </div>
      </div>

      {isSearchVisible && (
        <div className="animate-in slide-in-from-top-2 fade-in duration-200 -mt-2 mb-4 bg-white p-4 rounded-2xl-sticker border border-accent sticker-shadow">
          <div className="flex items-center gap-2 bg-cream p-3 rounded-xl border border-accent/50 mb-3">
            <input type="text" placeholder="Search tickets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 bg-transparent border-none p-0 text-navy font-bold placeholder:text-navy/20 focus:ring-0 text-sm" autoFocus />
            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-navy/30" /></button>}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button onClick={() => setFilterUser('All')} className={`flex-shrink-0 px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all ${filterUser === 'All' ? 'bg-navy border-navy text-white' : 'bg-white border-accent text-navy/40'}`}><User size={12} /> <span className="text-[10px] font-black uppercase">All</span></button>
            {members.map(m => (
              <button key={m.id} onClick={() => setFilterUser(m.id)} className={`flex-shrink-0 pr-3 py-1 rounded-full flex items-center gap-2 border transition-all ${filterUser === m.id ? 'bg-stitch border-stitch text-white pl-1' : 'bg-white border-accent text-navy/40 pl-1'}`}>
                <img src={m.avatar} className="w-5 h-5 rounded-full" />
                <span className="text-[10px] font-black uppercase">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="relative pb-24 flex flex-col pt-4 px-1">
        {filteredBookings.length > 0 ? filteredBookings.map((booking, index) => {
          const isExpanded = expandedId === booking.id;
          return (
            <div key={booking.id} onClick={() => setExpandedId(isExpanded ? null : booking.id)} 
              className={`relative w-full rounded-2xl-sticker overflow-hidden border-2 sticker-shadow transition-all duration-500 cursor-pointer ${isExpanded ? 'z-50 my-4 scale-[1.02] shadow-2xl' : 'z-0 -mt-12 hover:-mt-10 hover:z-40'} ${index === 0 && !isExpanded ? 'mt-0' : ''} ${booking.type === 'Flight' ? 'border-navy' : booking.type === 'Amusement' ? 'border-donald' : 'border-accent'}`} 
              style={{ zIndex: isExpanded ? 50 : index }}>
              {renderHeaderStrip(booking, isExpanded, index, filteredBookings.length)}
              <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-0'}`}>
                {renderBookingDetails(booking)}
              </div>
            </div>
          );
        }) : (
          <div className="py-24 text-center opacity-30 flex flex-col items-center border-2 border-dashed border-accent rounded-3xl bg-paper/50 mt-4">
            <TicketIcon size={56} className="mb-4 text-navy/20" />
            <p className="font-black text-xl">Empty Wallet</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <BookingFormModal initialData={editingBooking} members={members} itinerary={itinerary} currentUser={currentUser} onClose={() => setIsModalOpen(false)} onSave={handleSave} />
      )}
    </div>
  );
};

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6)); 
      };
    };
  });
};

const BookingFormModal: React.FC<{ initialData: Booking | null; members: TripMember[]; itinerary: ScheduleItem[]; currentUser: TripMember; onClose: () => void; onSave: (b: Booking) => void }> = ({ initialData, members, itinerary, currentUser, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Booking>>(initialData || { type: 'Ticket', title: '', referenceNo: '', bookedBy: currentUser.id, linkedScheduleId: '', cost: 0, imageUrl: '', details: {} });
  const [imagePreview, setImagePreview] = useState<string>(initialData?.imageUrl || '');
  const [isScanning, setIsScanning] = useState(false);
  const types: Booking['type'][] = ['Flight', 'Hotel', 'Car', 'Restaurant', 'Amusement', 'Ticket'];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setIsScanning(true);
        const compressedBase64 = await compressImage(file);
        setImagePreview(compressedBase64);
        setFormData(prev => ({ ...prev, imageUrl: compressedBase64 }));
        
        if (!process.env.API_KEY) { setIsScanning(false); return; }
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const base64Data = compressedBase64.split(',')[1]; 
        const response = await ai.models.generateContent({
           model: 'gemini-3-flash-preview',
           contents: {
             parts: [
               { inlineData: { mimeType: 'image/jpeg', data: base64Data } },
               { text: `Analyze this image. Extract details into JSON format. Return ONLY JSON.` }
             ]
           }
        });
        const extracted = JSON.parse(response.text?.replace(/```json|```/g, '').trim() || '{}');
        if (extracted) { setFormData(prev => ({ ...prev, ...extracted })); }
      } catch (error) { console.error("Scan failed", error); } finally { setIsScanning(false); }
    }
  };

  const updateDetail = (key: string, value: any) => {
    setFormData({ ...formData, details: { ...formData.details, [key]: value } });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-cream/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
      <div className="p-4 flex justify-between items-center border-b border-accent bg-paper">
        <button onClick={onClose} className="text-navy/40 p-2"><X size={24} /></button>
        <h3 className="text-lg font-black text-navy uppercase tracking-widest">{initialData ? 'Edit Ticket' : 'New Ticket'}</h3>
        <button onClick={() => onSave(formData as Booking)} className="text-stitch font-black p-2" disabled={!formData.title}>DONE</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
        <div className="w-full aspect-[21/9] bg-white rounded-2xl-sticker border-2 border-dashed border-accent flex flex-col items-center justify-center relative overflow-hidden cursor-pointer" onClick={() => document.getElementById('imageInput')?.click()}>
          {imagePreview ? (
            <div className="relative w-full h-full">
              <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              {isScanning && <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center text-white"><Wand2 className="animate-pulse" /></div>}
            </div>
          ) : (
            <div className="flex flex-col items-center text-navy/20"><Camera size={40} /><p className="text-[10px] font-black uppercase">Snap Ticket</p></div>
          )}
          <input id="imageInput" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>
        <div className="bg-paper p-4 rounded-2xl-sticker border border-accent sticker-shadow">
          <label className="text-[10px] font-black uppercase text-navy/40 mb-3 block">Category</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {types.map(t => <button key={t} onClick={() => setFormData({ ...formData, type: t })} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase transition-all ${formData.type === t ? 'bg-navy text-white' : 'bg-accent/20'}`}>{t}</button>)}
          </div>
        </div>
        <div className="bg-paper p-4 rounded-2xl-sticker border border-accent sticker-shadow space-y-4">
          <div><label className="text-[10px] font-black uppercase text-navy/40 mb-1 block">Title</label><input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Disney Ticket" className="w-full text-xl font-black text-navy bg-transparent border-none p-0 focus:ring-0" /></div>
          <div><label className="text-[10px] font-black uppercase text-navy/40 mb-1 block">Ref No</label><input type="text" value={formData.referenceNo} onChange={e => setFormData({ ...formData, referenceNo: e.target.value.toUpperCase() })} placeholder="e.g. M7X9L2" className="w-full font-black text-navy bg-transparent border-none p-0 focus:ring-0 uppercase" /></div>
        </div>
      </div>
    </div>
  );
};

export default Bookings;
