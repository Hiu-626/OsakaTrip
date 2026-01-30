
import React, { useState, useRef } from 'react';
import { TripMember, ScheduleItem, Booking, Expense, JournalPost, TripConfig } from '../types';
import { 
  LogOut, 
  Settings, 
  Award, 
  Map, 
  Plus, 
  UserPlus, 
  X, 
  Trash2, 
  Check,
  Sparkles,
  FileDown,
  Loader2,
  Smile,
  Image as ImageIcon,
  Link,
  Upload,
  Camera
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MembersProps {
  currentUser: TripMember;
  members: TripMember[];
  onSwitch: (user: TripMember) => void;
  onAdd: (name: string, avatar: string) => void;
  onDelete: (id: string) => void;
}

const Members: React.FC<MembersProps> = ({ currentUser, members, onSwitch, onAdd, onDelete }) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Add Member State
  const [newName, setNewName] = useState('');
  const [avatarType, setAvatarType] = useState<'preset' | 'emoji' | 'upload'>('preset');
  const [selectedAvatar, setSelectedAvatar] = useState('https://picsum.photos/seed/new_member/200'); // Holds final URL or current preset selection
  const [emojiChar, setEmojiChar] = useState('😎');
  const [uploadedAvatar, setUploadedAvatar] = useState('');

  const exportRef = useRef<HTMLDivElement>(null);

  const avatarOptions = [
    'https://picsum.photos/seed/stitch/200',
    'https://picsum.photos/seed/donald/200',
    'https://picsum.photos/seed/lilo/200',
    'https://picsum.photos/seed/daisy/200',
    'https://picsum.photos/seed/mickey/200',
    'https://picsum.photos/seed/minnie/200',
    'https://picsum.photos/seed/goofy/200'
  ];

  const handleExportPDF = async () => {
    setIsExporting(true);
    
    // 從 localStorage 獲取數據
    const itinerary: ScheduleItem[] = JSON.parse(localStorage.getItem('itinerary') || '[]');
    const bookings: Booking[] = JSON.parse(localStorage.getItem('bookings') || '[]');
    const expenses: Expense[] = JSON.parse(localStorage.getItem('expenses') || '[]');
    const journalPosts: JournalPost[] = JSON.parse(localStorage.getItem('journal_posts') || '[]');
    const tripConfig: TripConfig = JSON.parse(localStorage.getItem('tripConfig') || '{}');
    const baseCurrency = localStorage.getItem('baseCurrency') || 'JPY';

    // 建立一個臨時的隱藏元素來渲染 PDF 內容
    const printWindow = document.createElement('div');
    printWindow.style.position = 'fixed';
    printWindow.style.left = '-9999px';
    printWindow.style.top = '0';
    printWindow.style.width = '800px';
    printWindow.style.backgroundColor = '#F8F9F5';
    printWindow.style.fontFamily = 'Quicksand, sans-serif';
    document.body.appendChild(printWindow);

    // 渲染 PDF 模板
    printWindow.innerHTML = `
      <div style="padding: 40px; color: #1F3C88;">
        <!-- 封面 -->
        <div style="text-align: center; margin-bottom: 60px; padding: 40px; background: white; border-radius: 40px; border: 4px solid #6EC1E4;">
          <h1 style="font-size: 48px; margin-bottom: 10px;">${tripConfig.tripName || 'Ohana Trip'}</h1>
          <p style="font-size: 18px; opacity: 0.6; margin-bottom: 30px;">${tripConfig.region} | ${tripConfig.startDate} (${tripConfig.duration} Days)</p>
          <div style="display: flex; justify-content: center; gap: 20px;">
            ${members.map(m => `
              <div style="text-align: center;">
                <img src="${m.avatar}" style="width: 60px; hieght: 60px; border-radius: 50%; border: 3px solid #FFD966;" />
                <p style="font-size: 12px; font-weight: bold; margin-top: 5px;">${m.name}</p>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 行程 -->
        <div style="margin-bottom: 40px;">
          <h2 style="border-bottom: 4px solid #FFD966; display: inline-block; padding-bottom: 5px; margin-bottom: 20px;">📅 Schedule</h2>
          ${Array.from({length: tripConfig.duration}).map((_, dayIdx) => {
            const dayItems = itinerary.filter(i => i.dayIndex === dayIdx);
            return `
              <div style="margin-bottom: 20px;">
                <h3 style="font-size: 16px; color: #6EC1E4;">Day ${dayIdx + 1}</h3>
                ${dayItems.map(item => `
                  <div style="display: flex; gap: 15px; background: white; padding: 10px; border-radius: 15px; margin-bottom: 10px;">
                    <span style="font-weight: bold; min-width: 50px;">${item.time}</span>
                    <span>${item.location}</span>
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>

        <!-- 財務 -->
        <div style="margin-bottom: 40px;">
          <h2 style="border-bottom: 4px solid #6EC1E4; display: inline-block; padding-bottom: 5px; margin-bottom: 20px;">💰 Expenses Summary</h2>
          <div style="background: white; padding: 20px; border-radius: 20px; border: 2px dashed #E0E5D5;">
            <p style="font-size: 24px; font-weight: 1000;">Total: ${baseCurrency} ${expenses.reduce((acc, e) => acc + e.amount, 0).toLocaleString()}</p>
            <p style="font-size: 12px; opacity: 0.5;">* Based on your recorded transactions</p>
          </div>
        </div>

        <!-- 回憶 -->
        <div>
          <h2 style="border-bottom: 4px solid #6EC1E4; display: inline-block; padding-bottom: 5px; margin-bottom: 20px;">📸 Memory Highlights</h2>
          <div style="display: grid; grid-template-cols: 1fr 1fr; gap: 20px;">
            ${journalPosts.slice(0, 4).map(post => `
              <div style="background: white; padding: 15px; border-radius: 20px;">
                <p style="font-size: 12px; font-style: italic;">"${post.content.substring(0, 100)}..."</p>
                <p style="font-size: 10px; margin-top: 10px; text-align: right;">— ${members.find(m => m.id === post.authorId)?.name}</p>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 100px; opacity: 0.2; font-size: 10px;">
          Ohana means family. Family means nobody gets left behind or forgotten.
        </div>
      </div>
    `;

    try {
      const canvas = await html2canvas(printWindow, { useCORS: true, scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Ohana_Trip_${tripConfig.tripName || 'Report'}.pdf`);
    } catch (e) {
      console.error("PDF Export failed", e);
      alert("導出失敗，請檢查網路連接後再試一次。");
    } finally {
      document.body.removeChild(printWindow);
      setIsExporting(false);
    }
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
          const size = 200; // Resize to 200x200
          canvas.width = size;
          canvas.height = size;
          
          // Center Crop
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

  const handleAddSubmit = () => {
    if (newName.trim()) {
      let finalAvatar = selectedAvatar;
      
      if (avatarType === 'emoji') {
         const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f8f9f5" rx="20" ry="20"/><text y=".9em" font-size="80" x="50" text-anchor="middle">${emojiChar}</text></svg>`;
         finalAvatar = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      } else if (avatarType === 'upload' && uploadedAvatar) {
         finalAvatar = uploadedAvatar;
      }

      onAdd(newName.trim(), finalAvatar);
      setNewName('');
      setUploadedAvatar('');
      setIsAddModalOpen(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Current User Profile Section */}
      <div className="text-center py-4 bg-white/40 rounded-3xl-sticker p-6 border border-white/60 sticker-shadow">
        <div className="relative inline-block">
          <div className="w-32 h-32 rounded-full border-4 border-donald sticker-shadow overflow-hidden mb-4 p-1 bg-white">
            <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full rounded-full object-cover" />
          </div>
          <div className="absolute bottom-4 right-0 w-10 h-10 bg-stitch text-white rounded-full flex items-center justify-center border-4 border-paper sticker-shadow animate-pulse">
            <Sparkles size={18} />
          </div>
        </div>
        <h2 className="text-3xl font-black text-navy">{currentUser.name}</h2>
        <p className="text-[10px] font-black text-navy/30 uppercase tracking-[0.2em] mt-1">Active Trip Planner</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white p-4 rounded-xl-sticker sticker-shadow border border-accent flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-stitch/10 text-stitch rounded-full flex items-center justify-center mb-2">
               <Award size={20} />
            </div>
            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Badges</p>
            <p className="text-sm font-black text-navy">12 Collected</p>
         </div>
         <div className="bg-white p-4 rounded-xl-sticker sticker-shadow border border-accent flex flex-col items-center text-center">
            <div className="w-10 h-10 bg-donald/10 text-donald rounded-full flex items-center justify-center mb-2">
               <Map size={20} />
            </div>
            <p className="text-[10px] font-black opacity-40 uppercase tracking-widest">Visited</p>
            <p className="text-sm font-black text-navy">4 Spots</p>
         </div>
      </div>

      {/* Trip Members Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-sm font-black text-navy uppercase tracking-[0.2em]">Trip Ohana</h3>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="p-2 bg-stitch/10 text-stitch rounded-full hover:bg-stitch hover:text-white transition-all active:scale-90"
          >
            <UserPlus size={18} />
          </button>
        </div>
        
        <div className="space-y-3">
          {members.map((member) => (
            <div 
              key={member.id}
              className={`w-full p-4 rounded-xl-sticker sticker-shadow border-2 flex items-center gap-4 transition-all group ${
                currentUser.id === member.id ? 'bg-stitch/5 border-stitch' : 'bg-white border-accent'
              }`}
            >
              <button 
                onClick={() => onSwitch(member)}
                className="flex flex-1 items-center gap-4 text-left"
              >
                <div className={`relative w-12 h-12 rounded-full border-2 overflow-hidden flex-shrink-0 ${currentUser.id === member.id ? 'border-stitch' : 'border-accent'}`}>
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                  {currentUser.id === member.id && (
                    <div className="absolute inset-0 bg-stitch/20 flex items-center justify-center">
                      <Check size={20} className="text-white drop-shadow-md" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-black text-navy text-sm">{member.name}</h4>
                  <p className="text-[9px] font-bold text-navy/30 uppercase tracking-wider">
                    {currentUser.id === member.id ? 'Currently Controlling' : 'View Stats'}
                  </p>
                </div>
              </button>
              
              {member.id !== currentUser.id && (
                <button 
                  onClick={() => onDelete(member.id)}
                  className="p-2 text-navy/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Export Section */}
      <div className="pt-4 border-t border-accent/40">
        <button 
          onClick={handleExportPDF}
          disabled={isExporting}
          className="w-full py-5 bg-navy text-white font-black rounded-2xl-sticker sticker-shadow flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl disabled:opacity-50"
        >
          {isExporting ? <Loader2 size={24} className="animate-spin" /> : <FileDown size={24} />}
          <div className="text-left">
            <p className="text-xs uppercase tracking-widest leading-none">Export Ohana Memory</p>
            <p className="text-[9px] font-bold opacity-40 uppercase mt-1">Generate PDF Travel Report</p>
          </div>
        </button>
      </div>

      {/* Add Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy/20 backdrop-blur-sm animate-in fade-in" onClick={() => setIsAddModalOpen(false)}>
          <div className="bg-paper w-full max-w-sm rounded-3xl-sticker p-6 sticker-shadow border-4 border-stitch animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-navy uppercase tracking-widest">New Traveler</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-cream rounded-full text-navy/40"><X size={20} /></button>
            </div>
            
            <div className="space-y-6">
              {/* Avatar Preview */}
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full border-4 border-stitch overflow-hidden mb-4 p-1 bg-white sticker-shadow flex items-center justify-center">
                   {avatarType === 'emoji' ? (
                      <span className="text-6xl">{emojiChar}</span>
                   ) : (
                      <img src={avatarType === 'upload' && uploadedAvatar ? uploadedAvatar : selectedAvatar} alt="preview" className="w-full h-full rounded-full object-cover" />
                   )}
                </div>

                {/* Avatar Type Selector */}
                <div className="flex gap-2 p-1 bg-cream rounded-xl border border-accent/60 mb-3">
                   <button onClick={() => setAvatarType('preset')} className={`p-2 rounded-lg ${avatarType === 'preset' ? 'bg-white shadow-sm text-navy' : 'text-navy/40'}`}><ImageIcon size={16} /></button>
                   <button onClick={() => setAvatarType('emoji')} className={`p-2 rounded-lg ${avatarType === 'emoji' ? 'bg-white shadow-sm text-navy' : 'text-navy/40'}`}><Smile size={16} /></button>
                   <button onClick={() => setAvatarType('upload')} className={`p-2 rounded-lg ${avatarType === 'upload' ? 'bg-white shadow-sm text-navy' : 'text-navy/40'}`}><Upload size={16} /></button>
                </div>
                
                {/* Inputs based on type */}
                {avatarType === 'preset' && (
                  <div className="flex gap-2 overflow-x-auto w-full pb-2 scrollbar-hide px-2">
                    {avatarOptions.map((av, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setSelectedAvatar(av)}
                        className={`flex-shrink-0 w-10 h-10 rounded-full border-2 transition-all ${selectedAvatar === av ? 'border-stitch scale-110' : 'border-transparent opacity-50'}`}
                      >
                        <img src={av} alt="option" className="w-full h-full rounded-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                {avatarType === 'emoji' && (
                  <div className="w-full">
                     <input 
                       type="text" 
                       maxLength={2}
                       value={emojiChar} 
                       onChange={e => setEmojiChar(e.target.value)} 
                       className="w-full text-center text-4xl bg-white border-b-2 border-accent focus:border-stitch outline-none py-2"
                     />
                     <p className="text-center text-[10px] uppercase font-bold text-navy/30 mt-1">Type an Emoji</p>
                  </div>
                )}

                {avatarType === 'upload' && (
                  <div 
                    className="w-full h-24 border-2 border-dashed border-accent rounded-xl flex flex-col items-center justify-center cursor-pointer bg-white relative overflow-hidden group hover:border-stitch/50 transition-colors"
                    onClick={() => document.getElementById('member-avatar-upload')?.click()}
                  >
                     {uploadedAvatar ? (
                        <div className="relative w-full h-full group-hover:opacity-50 transition-opacity">
                           <img src={uploadedAvatar} className="w-full h-full object-cover" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                             <Camera size={20} className="text-navy" />
                           </div>
                        </div>
                     ) : (
                        <>
                           <Camera size={20} className="text-stitch mb-1" />
                           <span className="text-[10px] font-black text-navy/40 uppercase">Tap to Upload</span>
                        </>
                     )}
                     <input 
                       id="member-avatar-upload"
                       type="file" 
                       accept="image/*"
                       onChange={handleAvatarUpload}
                       className="hidden" 
                     />
                  </div>
                )}
              </div>

              <div className="bg-cream p-4 rounded-2xl border border-accent">
                <label className="text-[10px] font-black uppercase text-navy/30 mb-1 block tracking-widest">Member Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Lilo"
                  className="w-full bg-transparent border-none p-0 font-black text-navy text-lg focus:ring-0 placeholder:text-navy/10"
                />
              </div>

              <button 
                onClick={handleAddSubmit}
                disabled={!newName.trim()}
                className="w-full py-4 bg-stitch text-white font-black rounded-xl-sticker sticker-shadow active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                JOIN THE OHANA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decorative Logout Styled Button */}
      <button className="w-full py-4 text-red-300 font-black flex items-center justify-center gap-2 mt-4 active:scale-95 transition-all text-xs tracking-widest uppercase">
        <LogOut size={16} />
        Leave Trip
      </button>
    </div>
  );
};

export default Members;
