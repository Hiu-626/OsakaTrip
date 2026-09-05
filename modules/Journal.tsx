
import React, { useState, useEffect } from 'react';
import { TripMember, JournalPost } from '../types.ts';
import { 
  Share2, 
  MoreHorizontal, 
  Plus, 
  X, 
  Camera, 
  Edit2, 
  Trash2,
  Send,
  UserCircle2,
  Check
} from 'lucide-react';

const Journal: React.FC<{ 
  currentUser: TripMember; 
  members: TripMember[];
}> = ({ currentUser, members }) => {
  const [posts, setPosts] = useState<JournalPost[]>(() => {
    const saved = localStorage.getItem('journal_posts');
    return saved ? JSON.parse(saved) : [
      { id: '1', authorId: '1', content: "Just landed in Tokyo! The weather is amazing. First meal: Ichiran Ramen! 🍜 #TokyoAdventure", imageUrl: 'https://picsum.photos/seed/tokyo/600/400', date: 'Oct 12, 11:30 AM' },
      { id: '2', authorId: '2', content: "Our hotel view is incredible. Can see the Tokyo Metropolitan Building from here. 🏨✨", imageUrl: 'https://picsum.photos/seed/view/600/400', date: 'Oct 12, 4:00 PM' }
    ];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<JournalPost | null>(null);

  useEffect(() => {
    localStorage.setItem('journal_posts', JSON.stringify(posts));
  }, [posts]);

  const handleDelete = (id: string) => {
    if (confirm('Delete this memory?')) {
      setPosts(posts.filter(p => p.id !== id));
    }
  };

  const handleSave = (post: JournalPost) => {
    if (editingPost) {
      setPosts(posts.map(p => p.id === post.id ? post : p));
    } else {
      setPosts([post, ...posts]);
    }
    setIsModalOpen(false);
    setEditingPost(null);
  };

  const handleShare = async (post: JournalPost) => {
    const author = members.find(m => m.id === post.authorId);
    const shareData = {
      title: `Memory by ${author?.name || 'Friend'}`,
      text: post.content,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      navigator.clipboard.writeText(`${post.content} - Shared from Ohana Trip Planner`);
      alert('Copied to clipboard!');
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-center px-1">
        <div>
          <h2 className="text-2xl font-black text-navy">Travel Journal</h2>
          <p className="text-[10px] font-bold text-navy/30 uppercase tracking-[0.2em]">Our Shared Memories</p>
        </div>
        <button 
          onClick={() => { setEditingPost(null); setIsModalOpen(true); }}
          className="w-12 h-12 bg-stitch rounded-full sticker-shadow border-2 border-white flex items-center justify-center text-white active:scale-90 transition-transform shadow-lg"
        >
          <Plus size={28} />
        </button>
      </div>

      {/* Posts List */}
      <div className="space-y-8">
        {posts.map((post) => {
          const author = members.find(m => m.id === post.authorId);
          return (
            <JournalCard 
              key={post.id} 
              post={post} 
              author={author}
              isAuthor={post.authorId === currentUser.id}
              onEdit={() => { setEditingPost(post); setIsModalOpen(true); }}
              onDelete={() => handleDelete(post.id)}
              onShare={() => handleShare(post)}
            />
          );
        })}

        {posts.length === 0 && (
          <div className="py-20 text-center opacity-30 flex flex-col items-center bg-paper/50 rounded-2xl border-2 border-dashed border-accent">
            <Camera size={48} className="mb-2" />
            <p className="font-black">No memories yet</p>
            <p className="text-sm font-bold">Tap + to record your first moment!</p>
          </div>
        )}
      </div>

      {/* Decorative Footer */}
      <div className="pt-4 flex justify-center opacity-30">
         <div className="px-6 py-2 bg-donald border-2 border-navy rounded-full transform -rotate-2">
            <span className="text-xs font-black uppercase tracking-[0.2em]">Ohana Memories</span>
         </div>
      </div>

      {isModalOpen && (
        <JournalModal 
          currentUser={currentUser}
          members={members}
          initialData={editingPost}
          onClose={() => { setIsModalOpen(false); setEditingPost(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

const JournalCard: React.FC<{ 
  post: JournalPost; 
  author?: TripMember;
  isAuthor: boolean; 
  onEdit: () => void; 
  onDelete: () => void;
  onShare: () => void;
}> = ({ post, author, isAuthor, onEdit, onDelete, onShare }) => {
  const [showMenu, setShowMenu] = useState(false);
  const authorHandle = author?.name.toLowerCase().replace(' ', '_') || 'friend';

  return (
    <div className="bg-paper rounded-2xl-sticker overflow-hidden sticker-shadow border border-accent flex flex-col animate-in slide-in-from-bottom-4 duration-300">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-stitch overflow-hidden bg-cream shadow-sm">
            <img src={author?.avatar} alt="author" className="w-full h-full object-cover" />
          </div>
          <div>
            <h4 className="font-black text-sm text-navy leading-none">{author?.name}</h4>
            <p className="text-[9px] font-black text-navy/30 uppercase mt-1 tracking-wider">{post.date}</p>
          </div>
        </div>
        
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-navy/40 hover:text-navy active:scale-90 transition-all">
            <MoreHorizontal size={20} />
          </button>
          
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 w-32 bg-white rounded-xl sticker-shadow border border-accent z-20 overflow-hidden py-1">
                <button onClick={() => { onShare(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-xs font-black text-navy/60 hover:bg-cream flex items-center gap-2">
                  <Share2 size={12} /> SHARE
                </button>
                {isAuthor && (
                  <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-xs font-black text-navy hover:bg-cream flex items-center gap-2">
                    <Edit2 size={12} className="text-stitch" /> EDIT
                  </button>
                )}
                {isAuthor && (
                  <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full px-4 py-2 text-left text-xs font-black text-red-400 hover:bg-red-50 flex items-center gap-2">
                    <Trash2 size={12} /> DELETE
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {post.imageUrl && (
        <div className="w-full aspect-[4/3] bg-cream overflow-hidden border-y border-accent/30 relative">
          <img src={post.imageUrl} alt="post content" className="w-full h-full object-cover" />
          <div className="absolute bottom-3 right-3 p-2 bg-white/20 backdrop-blur-md rounded-lg sticker-shadow">
             <Share2 size={18} className="text-white drop-shadow-md cursor-pointer active:scale-90" onClick={onShare} />
          </div>
        </div>
      )}
      
      <div className="p-5">
        <p className="text-sm leading-relaxed text-navy/80">
          <span className="font-black mr-2 text-navy">@{authorHandle}</span>
          {post.content}
        </p>
      </div>
    </div>
  );
};

const JournalModal: React.FC<{ 
  currentUser: TripMember;
  members: TripMember[];
  initialData: JournalPost | null; 
  onClose: () => void; 
  onSave: (p: JournalPost) => void 
}> = ({ currentUser, members, initialData, onClose, onSave }) => {
  const [content, setContent] = useState(initialData?.content || '');
  const [imagePreview, setImagePreview] = useState<string>(initialData?.imageUrl || '');
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>(initialData?.authorId || currentUser.id);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDone = () => {
    const post: JournalPost = {
      id: initialData?.id || Date.now().toString(),
      authorId: selectedAuthorId,
      content: content,
      imageUrl: imagePreview,
      date: initialData?.date || new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true })
    };
    onSave(post);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-paper w-full max-w-md rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[82vh] my-auto overflow-hidden animate-in zoom-in-95" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 mb-3 border-b border-accent/40">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-stitch/15 text-stitch rounded-xl font-bold">
              <Camera size={18} />
            </span>
            <div>
              <h3 className="text-base font-black text-navy uppercase tracking-wider">
                {initialData ? '編輯旅行日記' : '新增旅行日記'}
              </h3>
              <p className="text-[10px] font-bold text-navy/40">記錄這趟旅程的美好點滴</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-cream hover:bg-accent/40 rounded-full text-navy/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {/* Post Composition */}
          <div className="bg-white p-4 rounded-2xl border border-accent sticker-shadow flex flex-col min-h-[140px]">
            <label className="text-[10px] font-black uppercase text-navy/40 mb-1.5 block tracking-wider">日記心得 / 動態內容</label>
            <textarea 
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="記錄這刻的心情、美味拉麵、拍下的美景... #TokyoTrip"
              className="flex-1 w-full bg-transparent border-none focus:ring-0 p-0 text-navy placeholder:text-navy/20 text-sm leading-relaxed resize-none font-medium"
            />
          </div>

          {/* Member Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 px-0.5">
               <UserCircle2 size={13} className="text-navy/40" />
               <label className="text-[10px] font-black uppercase text-navy/40 tracking-wider">發佈身分 Post As</label>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {members.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => setSelectedAuthorId(member.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border ${
                    selectedAuthorId === member.id 
                      ? 'bg-navy border-navy text-white sticker-shadow scale-105' 
                      : 'bg-white border-accent text-navy/70 hover:bg-cream'
                  }`}
                >
                  <img src={member.avatar} alt={member.name} className="w-5 h-5 rounded-full object-cover border border-white/40" />
                  <span className="text-[10px] font-black uppercase tracking-tight">{member.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Photo Upload */}
          <div 
            className="w-full aspect-[16/9] bg-white rounded-2xl border-2 border-dashed border-accent flex flex-col items-center justify-center sticker-shadow relative overflow-hidden group cursor-pointer hover:border-stitch/50 transition-all active:scale-98"
            onClick={() => document.getElementById('imageInput')?.click()}
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Camera className="text-white" size={28} />
                </div>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setImagePreview(''); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-red-500 shadow-md hover:bg-red-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center text-navy/30">
                <Camera size={32} className="text-stitch mb-1" />
                <p className="text-[10px] font-black uppercase tracking-wider">點擊上傳或拍攝照片</p>
              </div>
            )}
            <input id="imageInput" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
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
            onClick={handleDone} 
            disabled={!content.trim()} 
            className="flex-2 py-3 bg-stitch hover:bg-navy text-white font-black rounded-xl text-xs uppercase tracking-widest sticker-shadow active:translate-y-0.5 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            <Send size={15} />
            <span>{initialData ? '儲存變更' : '發佈日記'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Journal;
