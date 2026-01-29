
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
  Calendar,
  Sparkles,
  MapPin,
  ArrowUpRight,
  QrCode
} from 'lucide-react';
import { Booking, TripMember, ScheduleItem } from '../types';

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
        details: { from: 'HKG', to: 'NRT', date: '12 OCT', time: '09:15', seat: '24A', gate: 'B12', airline: 'Cathay' }
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

  // Load itinerary for linking
  const [itinerary] = useState<ScheduleItem[]>(() => {
    const saved = localStorage.getItem('itinerary');
    return saved ? JSON.parse(saved) : [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string | 'All'>('All');

  useEffect(() => {
    localStorage.setItem('bookings', JSON.stringify(bookings));
  }, [bookings]);

  // Handle highlight request from props
  useEffect(() => {
    if (highlightId) {
       setExpandedId(highlightId);
    }
  }, [highlightId]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this booking?')) {
      setBookings(bookings.filter(b => b.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };

  const handleEdit = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setEditingBooking(booking); 
    setIsModalOpen(true);
  };

  const handleSave = (booking: Booking) => {
    if (editingBooking) {
      setBookings(bookings.map(b => b.id === booking.id ? booking : b));
    } else {
      setBookings([...bookings, { ...booking, id: Date.now().toString() }]);
    }
    setIsModalOpen(false);
    setEditingBooking(null);
  };

  const copyToClipboard = (e: React.MouseEvent, text: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = 
        b.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.referenceNo && b.referenceNo.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesUser = filterUser === 'All' || b.bookedBy === filterUser;

      return matchesSearch && matchesUser;
    });
  }, [bookings, searchTerm, filterUser]);

  // Helper to render the visible "Tab" strip when stacked
  const renderHeaderStrip = (booking: Booking, isExpanded: boolean) => {
    const bookedByMember = members.find(m => m.id === booking.bookedBy);
    
    let icon = <TicketIcon size={18} />;
    let bgColor = 'bg-white';
    let textColor = 'text-navy';
    let borderColor = 'border-accent';
    let accentColor = 'bg-accent';

    switch (booking.type) {
      case 'Flight':
        icon = <Plane size={18} className="text-white" />;
        bgColor = 'bg-navy';
        textColor = 'text-white';
        borderColor = 'border-navy';
        accentColor = 'bg-stitch';
        break;
      case 'Hotel':
        icon = <Hotel size={18} className="text-stitch" />;
        bgColor = 'bg-white';
        textColor = 'text-navy';
        borderColor = 'border-stitch';
        accentColor = 'bg-stitch';
        break;
      case 'Amusement':
        icon = <Sparkles size={18} className="text-navy" />;
        bgColor = 'bg-donald';
        textColor = 'text-navy';
        borderColor = 'border-donald';
        accentColor = 'bg-white';
        break;
      case 'Restaurant':
        icon = <Utensils size={18} className="text-red-400" />;
        bgColor = 'bg-white';
        textColor = 'text-navy';
        borderColor = 'border-red-200';
        accentColor = 'bg-red-200';
        break;
      case 'Car':
        icon = <Car size={18} className="text-navy" />;
        bgColor = 'bg-accent/30';
        textColor = 'text-navy';
        borderColor = 'border-accent';
        accentColor = 'bg-white';
        break;
    }

    // Determine key date/time info for the header
    const displayTime = booking.details.time || booking.details.checkIn || booking.details.datetime?.split('T')[1] || '';
    const displayDate = booking.details.date || booking.details.checkIn || booking.details.datetime?.split('T')[0] || '';

    return (
      <div className={`p-4 flex flex-col justify-between ${bgColor} ${textColor} transition-colors relative overflow-hidden min-h-[90px]`}>
        {/* Decorative Elements */}
        {booking.type === 'Flight' && <div className="absolute right-0 top-0 bottom-0 w-24 bg-white/10 -skew-x-12 translate-x-10" />}
        {booking.type === 'Amusement' && <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 2.5px)', backgroundSize: '12px 12px'}} />}
        
        {/* Top Row: Type & Icon */}
        <div className="flex justify-between items-start mb-1 relative z-10">
           <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-sm ${accentColor === 'bg-white' ? 'bg-white/80' : accentColor}`}>
                {icon}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${booking.type === 'Flight' ? 'bg-white/20' : 'bg-navy/5'}`}>
                {booking.type}
              </span>
           </div>
           
           {/* Booked By Avatar Small */}
           {bookedByMember && (
             <img src={bookedByMember.avatar} className="w-6 h-6 rounded-full border border-white shadow-sm" />
           )}
        </div>

        {/* Bottom Row: Title & Time - Main Info */}
        <div className="flex justify-between items-end relative z-10">
           <div className="flex-1 min-w-0 pr-4">
              <h3 className="font-black text-lg leading-tight truncate">{booking.title}</h3>
              {booking.referenceNo && (
                 <span className={`flex items-center gap-1 text-[9px] font-bold opacity-60 mt-0.5`}>
                   <Hash size={8} /> {booking.referenceNo}
                 </span>
              )}
           </div>
           <div className="text-right flex-shrink-0">
              {displayDate && <p className="text-[9px] font-bold opacity-60 uppercase">{displayDate}</p>}
              {displayTime && <p className="text-sm font-black">{displayTime}</p>}
           </div>
        </div>
      </div>
    );
  };

  const renderBookingDetails = (booking: Booking) => {
    const hasImage = !!booking.imageUrl;
    const linkedItem = itinerary.find(i => i.id === booking.linkedScheduleId);

    return (
      <div className="animate-in fade-in duration-300 bg-white">
        
        {/* LINKED SCHEDULE BANNER */}
        {linkedItem && (
          <div 
            onClick={() => onNavigate('schedule')}
            className="bg-stitch/10 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-stitch/20 transition-colors border-b border-dashed border-stitch/30"
          >
             <div className="flex items-center gap-2 overflow-hidden">
                <MapPin size={12} className="text-stitch flex-shrink-0" />
                <span className="text-[10px] font-black uppercase text-stitch truncate">
                  Linked to: Day {linkedItem.dayIndex + 1} - {linkedItem.location}
                </span>
             </div>
             <ArrowUpRight size={12} className="text-stitch" />
          </div>
        )}

        {/* HERO SECTION: IMAGE / QR CODE (Admission Priority) */}
        <div className="p-4 flex flex-col items-center justify-center bg-white">
           {hasImage ? (
             <div className="w-full rounded-xl border-2 border-navy/5 p-1 shadow-inner bg-cream">
                <img src={booking.imageUrl} alt="Voucher" className="w-full h-auto max-h-[300px] object-contain rounded-lg mix-blend-multiply" />
             </div>
           ) : (
             <div className="w-full h-32 bg-cream rounded-xl border-2 border-dashed border-accent flex flex-col items-center justify-center text-navy/20">
                <QrCode size={40} />
                <p className="text-[10px] font-black uppercase mt-2">No Ticket Image</p>
             </div>
           )}
           <p className="text-[9px] font-bold text-navy/30 uppercase mt-2 tracking-widest">Present at Entry</p>
        </div>

        {/* Perforated Line Effect */}
        <div className="relative h-4 w-full bg-white overflow-hidden my-2">
            <div className="absolute top-1/2 left-0 w-full border-t-2 border-dashed border-accent/60"></div>
            <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-cream rounded-full"></div>
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-cream rounded-full"></div>
        </div>

        {/* DETAILS SECTION */}
        <div className="p-5 pt-0">
          {/* Reference Number Copy Block */}
          {booking.referenceNo && (
            <div 
              onClick={(e) => copyToClipboard(e, booking.referenceNo!)}
              className="flex items-center justify-between p-3 bg-cream rounded-xl border border-accent/50 mb-6 cursor-pointer active:scale-[0.98] transition-transform group"
            >
               <div>
                  <p className="text-[9px] font-black uppercase text-navy/30 tracking-widest">Booking Ref</p>
                  <p className="text-2xl font-black text-navy font-mono tracking-wider">{booking.referenceNo}</p>
               </div>
               <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm text-stitch group-hover:scale-110 transition-transform">
                  <Copy size={14} />
               </div>
            </div>
          )}

          {/* Type Specific Grid */}
          <div className="grid grid-cols-2 gap-y-4 gap-x-6">
            {booking.type === 'Flight' && (
              <>
                <div><p className="text-[9px] font-black text-navy/30 uppercase">From</p><p className="text-lg font-black text-navy">{booking.details.from}</p></div>
                <div><p className="text-[9px] font-black text-navy/30 uppercase">To</p><p className="text-lg font-black text-navy">{booking.details.to}</p></div>
                <div><p className="text-[9px] font-black text-navy/30 uppercase">Gate</p><p className="text-lg font-black text-navy">{booking.details.gate || '-'}</p></div>
                <div><p className="text-[9px] font-black text-navy/30 uppercase">Seat</p><p className="text-lg font-black text-navy">{booking.details.seat || '-'}</p></div>
              </>
            )}

            {(booking.type === 'Hotel' || booking.type === 'Car') && (
               <>
                 <div className="col-span-2"><p className="text-[9px] font-black text-navy/30 uppercase">Address</p><p className="font-bold text-navy">{booking.details.address}</p></div>
                 <div><p className="text-[9px] font-black text-navy/30 uppercase">Start</p><p className="font-bold text-navy">{booking.details.checkIn}</p></div>
                 <div><p className="text-[9px] font-black text-navy/30 uppercase">End</p><p className="font-bold text-navy">{booking.details.checkOut}</p></div>
               </>
            )}

            {/* General Fields for others */}
            {Object.entries(booking.details).map(([key, value]) => {
                if (['from', 'to', 'gate', 'seat', 'checkIn', 'checkOut', 'address', 'imageUrl'].includes(key)) return null;
                return (
                  <div key={key} className={String(value).length > 20 ? 'col-span-2' : ''}>
                     <p className="text-[9px] font-black text-navy/30 uppercase">{key}</p>
                     <p className="font-bold text-navy break-words">{String(value)}</p>
                  </div>
                )
             })}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-accent/30">
             <button onClick={(e) => handleEdit(e, booking)} className="flex items-center gap-1 px-4 py-2 bg-cream rounded-full text-[10px] font-black text-navy hover:bg-stitch hover:text-white transition-colors">
               <Edit2 size={12} /> EDIT
             </button>
             <button onClick={(e) => handleDelete(e, booking.id)} className="flex items-center gap-1 px-4 py-2 bg-cream rounded-full text-[10px] font-black text-red-400 hover:bg-red-400 hover:text-white transition-colors">
               <Trash2 size={12} /> REMOVE
             </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 min-h-screen">
      
      {/* Search & Filter Header */}
      <div className="space-y-4 sticky top-0 bg-cream/95 backdrop-blur-sm z-[60] pt-2 pb-2 -mx-4 px-4 border-b border-accent/20">
         <div className="flex items-center gap-2 bg-white p-3 rounded-2xl-sticker border border-accent shadow-sm">
            <Search size={18} className="text-navy/30" />
            <input 
               type="text" 
               placeholder="Search tickets, Ref No..." 
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="flex-1 bg-transparent border-none p-0 text-navy font-bold placeholder:text-navy/20 focus:ring-0 text-sm"
            />
            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-navy/30" /></button>}
         </div>

         <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button 
               onClick={() => setFilterUser('All')}
               className={`flex-shrink-0 px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all ${filterUser === 'All' ? 'bg-navy border-navy text-white' : 'bg-white border-accent text-navy/40'}`}
            >
               <User size={12} /> <span className="text-[10px] font-black uppercase">All</span>
            </button>
            {members.map(m => (
               <button 
                  key={m.id}
                  onClick={() => setFilterUser(m.id)}
                  className={`flex-shrink-0 pr-3 py-1 rounded-full flex items-center gap-2 border transition-all ${filterUser === m.id ? 'bg-stitch border-stitch text-white pl-1' : 'bg-white border-accent text-navy/40 pl-1'}`}
               >
                  <img src={m.avatar} className="w-5 h-5 rounded-full" />
                  <span className="text-[10px] font-black uppercase">{m.name}</span>
               </button>
            ))}
         </div>
      </div>

      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black text-navy">Ticket Wallet</h2>
          <p className="text-[10px] font-bold text-navy/30 uppercase tracking-[0.2em]">
             {filteredBookings.length} Vouchers Found
          </p>
        </div>
        <button 
          onClick={() => { setEditingBooking(null); setIsModalOpen(true); }}
          className="w-12 h-12 bg-donald rounded-full sticker-shadow border-2 border-white flex items-center justify-center text-navy active:scale-90 transition-transform shadow-lg z-50"
        >
          <Plus size={28} />
        </button>
      </div>
      
      {/* Stacked Layout Container */}
      <div className="relative pb-24 flex flex-col pt-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking, index) => {
             const isExpanded = expandedId === booking.id;
             // Stack logic: Less overlap when expanded
             
             return (
               <div 
                  key={booking.id}
                  onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                  className={`
                     relative w-full rounded-2xl-sticker overflow-hidden border-2 sticker-shadow transition-all duration-500 ease-in-out cursor-pointer
                     ${isExpanded 
                        ? 'z-50 my-4 scale-[1.02] shadow-2xl' 
                        : 'z-0 -mt-16 hover:-mt-12 hover:z-40 hover:scale-[1.01] hover:shadow-lg' // Increased negative margin
                     }
                     ${index === 0 && !isExpanded ? 'mt-0' : ''}
                     ${booking.type === 'Flight' ? 'border-navy' : booking.type === 'Amusement' ? 'border-donald' : 'border-accent'}
                  `}
                  style={{ 
                     // Ensure visual stacking order when collapsed
                     zIndex: isExpanded ? 50 : index 
                  }}
               >
                  {renderHeaderStrip(booking, isExpanded)}
                  
                  {/* Expandable Content Area */}
                  <div className={`transition-[max-height] duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-0'}`}>
                     {renderBookingDetails(booking)}
                  </div>
               </div>
             );
          })
        ) : (
          <div className="py-24 text-center opacity-30 flex flex-col items-center border-2 border-dashed border-accent rounded-3xl bg-paper/50 mt-4">
            <TicketIcon size={56} className="mb-4 text-navy/20" />
            <p className="font-black text-xl">Empty Pocket</p>
            <p className="text-sm font-bold max-w-[200px] mx-auto">No tickets found. Tap + to add one!</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <BookingFormModal 
          initialData={editingBooking} 
          members={members}
          itinerary={itinerary}
          currentUser={currentUser}
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSave} 
        />
      )}
    </div>
  );
};

const BookingFormModal: React.FC<{ 
  initialData: Booking | null; 
  members: TripMember[]; 
  itinerary: ScheduleItem[];
  currentUser: TripMember; 
  onClose: () => void; 
  onSave: (b: Booking) => void 
}> = ({ initialData, members, itinerary, currentUser, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Booking>>(initialData || {
    type: 'Hotel',
    title: '',
    referenceNo: '',
    bookedBy: currentUser.id,
    linkedScheduleId: '',
    cost: 0,
    imageUrl: '',
    details: {}
  });

  const [imagePreview, setImagePreview] = useState<string>(initialData?.imageUrl || '');

  const types: Booking['type'][] = ['Flight', 'Hotel', 'Car', 'Restaurant', 'Amusement', 'Ticket'];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setFormData({ ...formData, imageUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImagePreview('');
    setFormData({ ...formData, imageUrl: '' });
  };

  const updateDetail = (key: string, value: any) => {
    setFormData({
      ...formData,
      details: { ...formData.details, [key]: value }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-cream/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
      <div className="p-4 flex justify-between items-center border-b border-accent bg-paper">
        <button onClick={onClose} className="text-navy/40 p-2"><X size={24} /></button>
        <h3 className="text-lg font-black text-navy uppercase tracking-widest">{initialData ? 'Edit Entry' : 'New Ticket'}</h3>
        <button onClick={() => onSave(formData as Booking)} className="text-stitch font-black p-2" disabled={!formData.title}>DONE</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
        {/* Type Selection */}
        <div className="bg-paper p-4 rounded-2xl-sticker border border-accent sticker-shadow">
          <label className="text-[10px] font-black uppercase text-navy/40 mb-3 block">Category</label>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {types.map(t => (
              <button
                key={t}
                onClick={() => setFormData({ ...formData, type: t })}
                className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                  formData.type === t ? 'bg-navy text-white sticker-shadow scale-105' : 'bg-accent/20 text-navy/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Linked Schedule Item (New) */}
        <div className="bg-paper p-4 rounded-2xl-sticker border border-accent sticker-shadow">
           <label className="text-[10px] font-black uppercase text-navy/40 mb-2 block flex items-center gap-1">
             <Calendar size={12} /> Connect to Schedule
           </label>
           <div className="relative">
             <select 
                value={formData.linkedScheduleId || ''}
                onChange={e => setFormData({...formData, linkedScheduleId: e.target.value})}
                className="w-full bg-cream border border-accent rounded-xl p-3 font-bold text-sm appearance-none focus:ring-0 focus:border-stitch"
             >
                <option value="">-- Unlinked --</option>
                {itinerary.filter(i => i.title || i.location).map(item => (
                   <option key={item.id} value={item.id}>
                      Day {item.dayIndex + 1} - {item.location || item.title} ({item.time})
                   </option>
                ))}
             </select>
             <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">▼</div>
           </div>
        </div>

        {/* Reference & Booker Info */}
        <div className="bg-paper p-4 rounded-2xl-sticker border border-accent sticker-shadow space-y-4">
           <div>
              <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block">Booking Reference / PNR</label>
              <div className="flex items-center gap-2 bg-accent/10 p-2 rounded-xl border border-accent/20">
                 <Hash size={16} className="text-navy/30" />
                 <input 
                   type="text" 
                   value={formData.referenceNo || ''} 
                   onChange={e => setFormData({ ...formData, referenceNo: e.target.value.toUpperCase() })} 
                   placeholder="e.g. M7X9L2" 
                   className="w-full font-black text-navy bg-transparent border-none p-0 focus:ring-0 uppercase placeholder:normal-case" 
                 />
              </div>
           </div>

           <div>
              <label className="text-[10px] font-black uppercase text-navy/40 mb-2 block">Who Booked This?</label>
              <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                 {members.map(m => (
                    <button 
                       key={m.id}
                       onClick={() => setFormData({...formData, bookedBy: m.id})}
                       className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${formData.bookedBy === m.id ? 'bg-stitch border-stitch text-white' : 'bg-white border-accent text-navy/40'}`}
                    >
                       <img src={m.avatar} className="w-5 h-5 rounded-full" />
                       <span className="text-[10px] font-black uppercase">{m.name}</span>
                    </button>
                 ))}
              </div>
           </div>
        </div>

        {/* Voucher Snapshot */}
        <div 
          className="w-full aspect-[21/9] bg-white rounded-2xl-sticker sticker-shadow border-2 border-dashed border-accent flex flex-col items-center justify-center relative overflow-hidden group transition-all active:scale-95"
          onClick={() => document.getElementById('imageInput')?.click()}
        >
          {imagePreview ? (
            <div className="relative w-full h-full">
               <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
               <button 
                  onClick={(e) => { e.stopPropagation(); removeImage(); }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
               >
                 <X size={14} />
               </button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-navy/20 w-full h-full justify-center">
              <Camera size={40} className="mb-2" />
              <p className="text-[10px] font-black uppercase">Snap Ticket / Voucher</p>
              <p className="text-[8px] opacity-60 mt-1 uppercase">(Required for entry)</p>
            </div>
          )}
          <input id="imageInput" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        {/* Main Details */}
        <div className="bg-paper p-4 rounded-2xl-sticker border border-accent sticker-shadow space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block">Title / Place</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={e => setFormData({ ...formData, title: e.target.value })} 
              placeholder="e.g. Disney Ticket" 
              className="w-full text-xl font-black text-navy bg-transparent border-none p-0 focus:ring-0" 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {formData.type === 'Flight' && (
              <>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">From</label><input type="text" placeholder="HKG" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.from || ''} onChange={e => updateDetail('from', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">To</label><input type="text" placeholder="NRT" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.to || ''} onChange={e => updateDetail('to', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">Date</label><input type="text" placeholder="12 OCT" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.date || ''} onChange={e => updateDetail('date', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">Time</label><input type="time" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.time || ''} onChange={e => updateDetail('time', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">Seat</label><input type="text" placeholder="1A" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.seat || ''} onChange={e => updateDetail('seat', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">Gate</label><input type="text" placeholder="-" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.gate || ''} onChange={e => updateDetail('gate', e.target.value)} /></div>
              </>
            )}
            
            {(formData.type === 'Hotel' || formData.type === 'Car') && (
               <>
                 <div className="col-span-2"><label className="text-[9px] uppercase opacity-40 font-bold block">Address/Pick up</label><input type="text" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.address || ''} onChange={e => updateDetail('address', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">Check In/Start</label><input type="date" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.checkIn || ''} onChange={e => updateDetail('checkIn', e.target.value)} /></div>
                 <div><label className="text-[9px] uppercase opacity-40 font-bold block">Check Out/End</label><input type="date" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.checkOut || ''} onChange={e => updateDetail('checkOut', e.target.value)} /></div>
               </>
            )}

            {['Restaurant', 'Amusement', 'Ticket'].includes(formData.type!) && (
               <>
                 <div className="col-span-2"><label className="text-[9px] uppercase opacity-40 font-bold block">Date & Time</label><input type="datetime-local" className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.datetime || ''} onChange={e => updateDetail('datetime', e.target.value)} /></div>
                 <div className="col-span-2"><label className="text-[9px] uppercase opacity-40 font-bold block">Notes</label><input type="text" placeholder="Table no, Entry code..." className="w-full font-bold bg-cream/50 p-2 rounded-lg" value={formData.details?.notes || ''} onChange={e => updateDetail('notes', e.target.value)} /></div>
               </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Bookings;
