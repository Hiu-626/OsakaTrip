
import React, { useState, useEffect } from 'react';
import { TripMember, PlanningItem } from '../types.ts';
import { Plus, Trash2, Check, User, X, Users, Edit2 } from 'lucide-react';

const Planning: React.FC<{ members: TripMember[] }> = ({ members }) => {
  const [activeTab, setActiveTab] = useState<'Packing' | 'Shopping'>('Packing');
  const [items, setItems] = useState<PlanningItem[]>(() => {
    const saved = localStorage.getItem('planning_items');
    return saved ? JSON.parse(saved) : [
      { id: '1', type: 'Packing', title: 'Passport', assignedTo: 'All', completed: true },
      { id: '2', type: 'Packing', title: 'Japan Rail Pass', assignedTo: 'All', completed: false },
      { id: '3', type: 'Packing', title: 'Camera Batteries', assignedTo: members[0]?.id || 'All', completed: false },
    ];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  
  const [itemTitle, setItemTitle] = useState('');
  const [itemAssignee, setItemAssignee] = useState('All');

  useEffect(() => {
    localStorage.setItem('planning_items', JSON.stringify(items));
  }, [items]);

  const filteredItems = items.filter(item => item.type === activeTab);

  const toggleComplete = (id: string) => {
    setItems(items.map(item => item.id === id ? { ...item, completed: !item.completed } : item));
  };

  const deleteItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setItems(items.filter(item => item.id !== id));
  };

  const openAddModal = () => {
    setModalMode('add');
    setItemTitle('');
    setItemAssignee('All');
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const openEditModal = (e: React.MouseEvent, item: PlanningItem) => {
    e.stopPropagation();
    setModalMode('edit');
    setItemTitle(item.title);
    setItemAssignee(item.assignedTo);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!itemTitle.trim()) return;

    if (modalMode === 'add') {
      const newItem: PlanningItem = {
        id: Date.now().toString(),
        type: activeTab,
        title: itemTitle,
        assignedTo: itemAssignee,
        completed: false
      };
      setItems([...items, newItem]);
    } else if (editingItem) {
      setItems(items.map(item => item.id === editingItem.id ? { ...item, title: itemTitle, assignedTo: itemAssignee } : item));
    }
    
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex bg-accent/20 p-1.5 rounded-2xl border border-accent/40">
        {(['Packing', 'Shopping'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl font-black text-xs tracking-widest transition-all ${
              activeTab === tab ? 'bg-white text-navy sticker-shadow scale-[1.02]' : 'text-navy/30 hover:text-navy/50'
            }`}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredItems.length > 0 ? filteredItems.map((item) => {
          const assignee = members.find(m => m.id === item.assignedTo);
          return (
            <div 
              key={item.id} 
              onClick={() => toggleComplete(item.id)}
              className={`bg-white p-4 rounded-xl-sticker sticker-shadow border transition-all cursor-pointer group flex items-center gap-4 ${
                item.completed ? 'opacity-40 grayscale border-accent' : 'border-accent/40 hover:border-stitch/30'
              }`}
            >
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                item.completed ? 'bg-stitch border-stitch' : 'border-accent'
              }`}>
                {item.completed && <Check size={16} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm text-navy truncate ${item.completed ? 'line-through decoration-navy/20' : ''}`}>
                  {item.title}
                </p>
                <div className="flex items-center gap-1.5 text-[9px] font-black text-navy/30 mt-1 uppercase tracking-tighter">
                  {item.assignedTo === 'All' ? (
                    <><Users size={10} className="text-stitch/50" /> Everyone</>
                  ) : (
                    <><img src={assignee?.avatar} className="w-3 h-3 rounded-full" /> {assignee?.name}</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={(e) => openEditModal(e, item)}
                  className="text-navy/10 hover:text-stitch p-2"
                 >
                   <Edit2 size={16} />
                 </button>
                 <button 
                  onClick={(e) => deleteItem(e, item.id)}
                  className="text-navy/10 hover:text-red-400 p-2"
                 >
                   <Trash2 size={16} />
                 </button>
              </div>
            </div>
          );
        }) : (
          <div className="py-20 text-center opacity-20 border-2 border-dashed border-accent rounded-3xl bg-paper/50">
             <p className="font-black uppercase text-[10px] tracking-widest">List is clear!</p>
          </div>
        )}

        <button 
          onClick={openAddModal}
          className="w-full py-5 rounded-xl-sticker border-2 border-dashed border-accent text-navy/30 font-black flex items-center justify-center gap-3 hover:bg-white transition-all active:scale-95 group"
        >
          <div className="p-1.5 bg-accent/20 rounded-full group-hover:bg-stitch/10 group-hover:text-stitch transition-colors">
            <Plus size={20} />
          </div>
          ADD {activeTab.toUpperCase()} ITEM
        </button>
      </div>

      <div className="bg-white p-5 rounded-3xl-sticker border border-accent/40 sticker-shadow relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none transform rotate-12">✅</div>
        <h4 className="text-[10px] font-black text-navy/30 mb-4 uppercase tracking-[0.3em] flex items-center gap-2">
          <Check size={12} className="text-stitch" /> Checklist Progress
        </h4>
        <div className="flex items-center gap-4">
          <div className="h-2.5 flex-1 bg-cream rounded-full overflow-hidden border border-accent/20">
            <div 
              className="h-full bg-stitch transition-all duration-1000 shadow-[0_0_8px_rgba(110,193,228,0.4)]" 
              style={{ width: `${(filteredItems.filter(i => i.completed).length / (filteredItems.length || 1)) * 100}%` }} 
            />
          </div>
          <span className="text-[10px] font-black text-stitch tabular-nums">
            {filteredItems.filter(i => i.completed).length}/{filteredItems.length}
          </span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-paper w-full max-w-sm rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[82vh] my-auto overflow-hidden animate-in zoom-in-95" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-accent/40">
              <div>
                <h3 className="text-base font-black text-navy uppercase tracking-wider">
                  {modalMode === 'add' ? `新增${activeTab === 'Packing' ? '行李清單' : '購物清單'}` : '編輯清單項目'}
                </h3>
                <p className="text-[10px] font-bold text-navy/40">為旅程做好萬全準備</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2 bg-cream hover:bg-accent/40 rounded-full text-navy/40 hover:text-navy transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              <div className="bg-white p-3.5 rounded-2xl border border-accent">
                <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block tracking-wider">項目名稱</label>
                <input 
                  autoFocus
                  type="text" 
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  placeholder={activeTab === 'Packing' ? '例如：護照、行動電源、防曬乳' : '例如：合利他命、伴手禮盒、吹風機'}
                  className="w-full bg-transparent border-none p-0 font-black text-navy text-base focus:ring-0 placeholder:text-navy/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-navy/40 mb-2 block px-0.5 tracking-wider">指派成員 Assign To</label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                  <button 
                    type="button"
                    onClick={() => setItemAssignee('All')}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl font-black text-[10px] border uppercase transition-all ${
                      itemAssignee === 'All' 
                        ? 'bg-navy border-navy text-white sticker-shadow' 
                        : 'bg-white border-accent text-navy/60 hover:bg-cream'
                    }`}
                  >
                    👥 全員 Everyone
                  </button>
                  {members.map(m => (
                    <button 
                      key={m.id}
                      type="button"
                      onClick={() => setItemAssignee(m.id)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[10px] border uppercase transition-all ${
                        itemAssignee === m.id 
                          ? 'bg-stitch border-stitch text-white sticker-shadow' 
                          : 'bg-white border-accent text-navy/60 hover:bg-cream'
                      }`}
                    >
                      <img src={m.avatar} className="w-4 h-4 rounded-full object-cover" alt={m.name} />
                      <span>{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="pt-3 mt-3 border-t border-accent/40 flex items-center gap-2">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="flex-1 py-3 bg-cream hover:bg-accent/30 text-navy/60 font-black rounded-xl text-xs uppercase tracking-wider transition-colors"
              >
                取消
              </button>
              <button 
                type="button"
                onClick={handleSave}
                disabled={!itemTitle.trim()}
                className="flex-2 py-3 bg-stitch hover:bg-navy text-white font-black rounded-xl text-xs uppercase tracking-widest sticker-shadow active:translate-y-0.5 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>{modalMode === 'add' ? '確認新增' : '儲存變更'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Planning;
