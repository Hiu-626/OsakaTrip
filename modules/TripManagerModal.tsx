import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Copy, 
  Check, 
  Calendar, 
  MapPin, 
  Clock, 
  Cloud, 
  RefreshCw, 
  Compass, 
  Users, 
  Sparkles,
  Plane,
  Download
} from 'lucide-react';
import { Trip, TripMember, TripConfig } from '../types.ts';
import { COLORS } from '../constants.ts';

interface TripManagerModalProps {
  trips: Trip[];
  currentTripId: string;
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
  onCreateTrip: (tripData: { tripName: string; region: string; startDate: string; duration: number; coverEmoji: string }) => void;
  onUpdateTrip: (tripId: string, updates: Partial<Trip>) => void;
  onDuplicateTrip: (tripId: string) => void;
  onDeleteTrip: (tripId: string) => void;
  onForceSync: () => void;
  isSyncing: boolean;
  lastSyncTime: string;
  onOpenFullExport?: () => void;
}

const EMOJI_PRESETS = ['✈️', '🗼', '🌸', '🍜', '🏖️', '🏔️', '🏰', '🎡', '🎒', '🛍️', '🍣', '🚆'];

const TripManagerModal: React.FC<TripManagerModalProps> = ({
  trips,
  currentTripId,
  onClose,
  onSelectTrip,
  onCreateTrip,
  onUpdateTrip,
  onDuplicateTrip,
  onDeleteTrip,
  onForceSync,
  isSyncing,
  lastSyncTime,
  onOpenFullExport
}) => {
  const [activeSubModal, setActiveSubModal] = useState<'list' | 'create' | 'edit'>('list');
  const [editingTripId, setEditingTripId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formRegion, setFormRegion] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDuration, setFormDuration] = useState(5);
  const [formEmoji, setFormEmoji] = useState('✈️');

  const openCreateModal = () => {
    setFormName('');
    setFormRegion('Japan');
    setFormStartDate(new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]);
    setFormDuration(5);
    setFormEmoji('✈️');
    setActiveSubModal('create');
  };

  const openEditModal = (trip: Trip) => {
    setEditingTripId(trip.id);
    setFormName(trip.tripName);
    setFormRegion(trip.region);
    setFormStartDate(trip.startDate);
    setFormDuration(trip.duration);
    setFormEmoji(trip.coverEmoji || '✈️');
    setActiveSubModal('edit');
  };

  const handleSaveCreate = () => {
    if (!formName.trim()) return;
    onCreateTrip({
      tripName: formName.trim(),
      region: formRegion.trim() || 'Japan',
      startDate: formStartDate,
      duration: Math.max(1, formDuration),
      coverEmoji: formEmoji
    });
    setActiveSubModal('list');
  };

  const handleSaveEdit = () => {
    if (!editingTripId || !formName.trim()) return;
    onUpdateTrip(editingTripId, {
      tripName: formName.trim(),
      region: formRegion.trim() || 'Japan',
      startDate: formStartDate,
      duration: Math.max(1, formDuration),
      coverEmoji: formEmoji
    });
    setActiveSubModal('list');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-paper w-full max-w-md rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[82vh] my-auto overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-accent/40 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-stitch/20 text-stitch flex items-center justify-center font-black text-xl">
              <Compass size={22} />
            </div>
            <div>
              <h2 className="text-lg font-black text-navy uppercase tracking-wider">
                {activeSubModal === 'list' ? '旅程管理 My Trips' : activeSubModal === 'create' ? '新增旅程 New Trip' : '編輯旅程 Edit Trip'}
              </h2>
              <p className="text-[10px] font-bold text-navy/40 uppercase">
                {trips.length} 個旅程 • Firebase 雲端同步
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-cream rounded-full text-navy/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        {activeSubModal === 'list' ? (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Cloud Sync Status Bar */}
            <div className="bg-white/80 border border-accent/60 rounded-2xl p-3 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-green-500'}`} />
                <div>
                  <p className="text-[10px] font-black text-navy uppercase tracking-tight">
                    {isSyncing ? 'Firebase 儲存同步中...' : 'Firebase 雲端連線正常'}
                  </p>
                  <p className="text-[8px] font-bold text-navy/30">
                    上次儲存：{lastSyncTime || '剛剛'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {onOpenFullExport && (
                  <button
                    onClick={onOpenFullExport}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-paper border border-stitch/40 text-stitch rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-stitch hover:text-white transition-all active:scale-95 sticker-shadow"
                    title="匯出/匯入全旅程資料 (含行程/票券/記帳/清單)"
                  >
                    <Download size={12} />
                    <span>匯出/匯入</span>
                  </button>
                )}
                <button
                  onClick={onForceSync}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stitch text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-navy transition-all active:scale-95 disabled:opacity-50"
                >
                  <Cloud size={12} className={isSyncing ? 'animate-bounce' : ''} />
                  <span>立即儲存</span>
                </button>
              </div>
            </div>

            {/* Trips List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-hide">
              {trips.map((trip) => {
                const isCurrent = trip.id === currentTripId;
                const scheduleCount = trip.itinerary?.length || 0;
                const expenseCount = trip.expenses?.length || 0;
                const memberCount = trip.members?.length || 0;

                return (
                  <div
                    key={trip.id}
                    onClick={() => {
                      if (!isCurrent) onSelectTrip(trip.id);
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                      isCurrent
                        ? 'bg-white border-stitch shadow-md ring-2 ring-stitch/20'
                        : 'bg-cream/70 border-accent hover:border-stitch/40 hover:bg-white'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute top-0 right-0 bg-stitch text-white text-[8px] font-black px-2.5 py-0.5 rounded-bl-xl uppercase tracking-widest flex items-center gap-1">
                        <Check size={9} /> 當前旅程
                      </div>
                    )}

                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-paper border border-accent flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                        {trip.coverEmoji || '✈️'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black text-navy truncate leading-tight">
                            {trip.tripName}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3 text-[10px] font-bold text-navy/40 mt-1">
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={11} className="text-stitch" />
                            {trip.region}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar size={11} className="text-donald" />
                            {trip.startDate} ({trip.duration}天)
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-accent/30 text-[9px] font-black text-navy/30">
                          <span>{scheduleCount} 行程</span>
                          <span>•</span>
                          <span>{expenseCount} 筆帳目</span>
                          <span>•</span>
                          <span>{memberCount} 位成員</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="mt-3 pt-2 flex justify-between items-center border-t border-accent/20">
                      <div className="flex items-center gap-1">
                        {!isCurrent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTrip(trip.id);
                            }}
                            className="px-3 py-1 bg-stitch text-white rounded-lg text-[10px] font-black uppercase hover:bg-navy transition-all"
                          >
                            切換至此旅程
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          title="編輯旅程"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(trip);
                          }}
                          className="p-1.5 bg-paper rounded-lg text-navy/40 hover:text-stitch hover:bg-stitch/10 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          title="複製旅程"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateTrip(trip.id);
                          }}
                          className="p-1.5 bg-paper rounded-lg text-navy/40 hover:text-donald hover:bg-donald/20 transition-colors"
                        >
                          <Copy size={13} />
                        </button>
                        {trips.length > 1 && (
                          <button
                            title="刪除旅程"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`確定要刪除「${trip.tripName}」嗎？這將無法復原！`)) {
                                onDeleteTrip(trip.id);
                              }
                            }}
                            className="p-1.5 bg-paper rounded-lg text-navy/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Add Button */}
            <div className="pt-4 mt-2 border-t border-accent/40">
              <button
                onClick={openCreateModal}
                className="w-full py-3.5 bg-donald text-navy font-black rounded-2xl-sticker text-xs uppercase tracking-widest flex items-center justify-center gap-2 sticker-shadow active:translate-y-0.5 hover:brightness-105 transition-all"
              >
                <Plus size={16} /> 新增旅程 (Add Trip)
              </button>
            </div>
          </div>
        ) : (
          /* Create / Edit Form */
          <div className="flex-1 flex flex-col justify-between overflow-y-auto space-y-4 pr-1">
            <div className="space-y-4">
              {/* Emoji Selector */}
              <div>
                <label className="text-[10px] font-black uppercase text-navy/40 mb-1.5 block tracking-wider">
                  旅程封面圖示 (Cover Emoji)
                </label>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {EMOJI_PRESETS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormEmoji(emoji)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all flex-shrink-0 border-2 ${
                        formEmoji === emoji
                          ? 'bg-stitch/20 border-stitch scale-110 shadow-sm'
                          : 'bg-white border-accent hover:border-stitch/30'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Trip Name */}
              <div>
                <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block tracking-wider">
                  旅程名稱 (Trip Name) *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="例如：東京賞櫻之旅 2025、沖繩放空行"
                  className="w-full p-3.5 bg-white rounded-xl border border-accent font-bold text-navy text-sm focus:border-stitch outline-none sticker-shadow"
                />
              </div>

              {/* Destination / Region */}
              <div>
                <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block tracking-wider">
                  目的地 / 地區 (Destination)
                </label>
                <input
                  type="text"
                  value={formRegion}
                  onChange={(e) => setFormRegion(e.target.value)}
                  placeholder="例如：Tokyo, Japan 或 墾丁、首爾"
                  className="w-full p-3.5 bg-white rounded-xl border border-accent font-bold text-navy text-sm focus:border-stitch outline-none sticker-shadow"
                />
              </div>

              {/* Start Date & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block tracking-wider">
                    出發日期 (Start Date)
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full p-3.5 bg-white rounded-xl border border-accent font-bold text-navy text-xs focus:border-stitch outline-none sticker-shadow"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-navy/40 mb-1 block tracking-wider">
                    天數 (Duration Days)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formDuration}
                    onChange={(e) => setFormDuration(parseInt(e.target.value) || 1)}
                    className="w-full p-3.5 bg-white rounded-xl border border-accent font-bold text-navy text-sm focus:border-stitch outline-none sticker-shadow"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="pt-4 border-t border-accent/40 flex gap-3">
              <button
                type="button"
                onClick={() => setActiveSubModal('list')}
                className="flex-1 py-3.5 bg-cream border border-accent text-navy/60 font-black rounded-2xl text-xs uppercase tracking-wider hover:bg-accent/20 transition-all"
              >
                取消 Cancel
              </button>
              <button
                type="button"
                onClick={activeSubModal === 'create' ? handleSaveCreate : handleSaveEdit}
                disabled={!formName.trim()}
                className="flex-1 py-3.5 bg-stitch text-white font-black rounded-2xl-sticker text-xs uppercase tracking-widest sticker-shadow active:translate-y-0.5 hover:bg-navy transition-all disabled:opacity-40"
              >
                {activeSubModal === 'create' ? '立即建立旅程' : '儲存變更 Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripManagerModal;
