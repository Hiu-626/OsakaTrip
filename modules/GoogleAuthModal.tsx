import React, { useState, useEffect } from 'react';
import { 
  X, 
  LogIn, 
  LogOut, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  User as UserIcon, 
  Mail, 
  Cloud, 
  RefreshCw,
  Sparkles,
  AlertCircle,
  ExternalLink,
  Users
} from 'lucide-react';
import { GoogleAuthUser, LoginAuditRecord, TripMember } from '../types.ts';
import { signInWithGoogle, signOutGoogle, fetchLoginRecords } from '../firebase.ts';

interface GoogleAuthModalProps {
  currentUser: GoogleAuthUser | null;
  onClose: () => void;
  onAddMemberFromGoogle?: (member: TripMember) => void;
  onForceSync?: () => void;
  isSyncing?: boolean;
}

export const GoogleAuthModal: React.FC<GoogleAuthModalProps> = ({
  currentUser,
  onClose,
  onAddMemberFromGoogle,
  onForceSync,
  isSyncing = false
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [records, setRecords] = useState<LoginAuditRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [addedAsMember, setAddedAsMember] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser?.uid) {
      setLoadingRecords(true);
      fetchLoginRecords(currentUser.uid)
        .then(data => setRecords(data))
        .finally(() => setLoadingRecords(false));
    }
  }, [currentUser]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Google sign in failed:", err);
      if (err.code === 'auth/popup-blocked') {
        setErrorMsg('瀏覽器阻擋了登入快顯視窗，請允許彈出式視窗後再試一次，或在獨立分頁中開啟本應用程式。');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setErrorMsg('登入視窗已關閉。');
      } else {
        setErrorMsg(err.message || 'Google 登入失敗，請稍後再試。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOutGoogle();
      setRecords([]);
    } catch (err: any) {
      console.error("Google sign out error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMeToTrip = () => {
    if (!currentUser || !onAddMemberFromGoogle) return;
    const newMember: TripMember = {
      id: currentUser.uid || `google_${Date.now()}`,
      name: currentUser.displayName || currentUser.email?.split('@')[0] || '我 (Google)',
      avatar: currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.displayName || 'Google')}`
    };
    onAddMemberFromGoogle(newMember);
    setAddedAsMember(true);
    setTimeout(() => setAddedAsMember(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-navy/40 backdrop-blur-xs animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-paper w-full max-w-md rounded-3xl-sticker p-5 sm:p-6 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[82vh] my-auto overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-accent/40 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white border border-accent/60 flex items-center justify-center sticker-shadow">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-black text-navy uppercase tracking-wider">
                Google / Gmail 登入記錄
              </h2>
              <p className="text-[10px] font-bold text-navy/40">
                {currentUser ? '已連結 Google 帳戶並啟用同步記錄' : '登入以記錄旅行歷程與雲端同步'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-cream rounded-full text-navy/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {currentUser ? (
            /* Logged In View */
            <div className="space-y-4">
              {/* Profile Card */}
              <div className="bg-white p-4 rounded-2xl border border-accent/60 sticker-shadow space-y-3">
                <div className="flex items-center gap-3">
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      alt={currentUser.displayName || 'User'} 
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full border-2 border-stitch/30 object-cover sticker-shadow shrink-0" 
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-stitch/15 text-stitch flex items-center justify-center font-black text-xl shrink-0">
                      {(currentUser.displayName || 'G')[0].toUpperCase()}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-black text-navy truncate">
                        {currentUser.displayName || 'Google 使用者'}
                      </h3>
                      <ShieldCheck size={14} className="text-stitch shrink-0" title="已完成 Gmail 驗證" />
                    </div>
                    <p className="text-xs font-bold text-navy/60 truncate flex items-center gap-1 mt-0.5">
                      <Mail size={12} className="text-navy/40 shrink-0" />
                      <span>{currentUser.email}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[9px] font-black uppercase">
                        已登入記錄
                      </span>
                      <span className="text-[9px] font-bold text-navy/40 truncate">
                        UID: {currentUser.uid.slice(0, 8)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick actions for logged in user */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-accent/30">
                  {onAddMemberFromGoogle && (
                    <button
                      onClick={handleAddMeToTrip}
                      className={`py-2 px-3 rounded-xl border text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                        addedAsMember
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-cream/60 hover:bg-stitch hover:text-white border-accent/60 text-navy'
                      }`}
                    >
                      <Users size={12} />
                      <span>{addedAsMember ? '已加入成員！' : '加入目前旅程成員'}</span>
                    </button>
                  )}

                  {onForceSync && (
                    <button
                      onClick={onForceSync}
                      disabled={isSyncing}
                      className="py-2 px-3 rounded-xl bg-stitch text-white hover:bg-navy border border-stitch text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Cloud size={12} className={isSyncing ? 'animate-bounce' : ''} />
                      <span>{isSyncing ? '同步中...' : '同步至此帳號'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Login Audit & Activity Records */}
              <div className="bg-white p-4 rounded-2xl border border-accent/60 sticker-shadow space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-stitch" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-navy/60">
                      Gmail 登入活動記錄
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-navy/40">
                    {records.length} 筆記錄
                  </span>
                </div>

                {loadingRecords ? (
                  <div className="py-4 text-center text-xs font-bold text-navy/40 flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-stitch" />
                    <span>載入登入記錄中...</span>
                  </div>
                ) : records.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 divide-y divide-accent/30">
                    {records.map((rec, i) => (
                      <div key={rec.id || i} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-1.5 font-black text-navy text-[11px]">
                            <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                            <span>Google 帳號驗證登入</span>
                          </div>
                          <p className="text-[9px] text-navy/40 truncate max-w-[200px] mt-0.5">
                            {rec.userAgent ? rec.userAgent.split(')')[0].replace('Mozilla/5.0 (', '') : 'Web 瀏覽器'}
                          </p>
                        </div>
                        <span className="text-[9px] font-mono font-bold text-navy/50 shrink-0">
                          {new Date(rec.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 text-center text-[10px] font-bold text-navy/40">
                    目前登入即時記錄已存檔於 Firebase
                  </div>
                )}
              </div>

              {/* Sign Out / Switch Account */}
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
              >
                <LogOut size={14} />
                <span>登出 Google 帳號</span>
              </button>
            </div>
          ) : (
            /* Not Logged In View */
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-2xl border border-accent/60 sticker-shadow text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-3xl bg-stitch/10 text-stitch flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-black text-navy uppercase tracking-wider">
                    連結 Google / Gmail 帳號
                  </h3>
                  <p className="text-[11px] font-bold text-navy/50 mt-1 max-w-[280px] mx-auto leading-relaxed">
                    登入後即可將您的行程規劃、預訂票券、記帳分攤與準備清單自動記錄並綁定至您的 Google 帳號。
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2 text-left">
                  <div className="flex items-center gap-2 p-2 bg-cream/50 rounded-xl text-xs font-bold text-navy">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>自動記錄登入足跡與同步時間</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-cream/50 rounded-xl text-xs font-bold text-navy">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>跨裝置或新瀏覽器隨時登入讀取</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-cream/50 rounded-xl text-xs font-bold text-navy">
                    <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                    <span>直接作為旅程成員參與分帳與備忘指派</span>
                  </div>
                </div>

                {/* Primary Google Login Button */}
                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 bg-white hover:bg-cream/50 border-2 border-stitch/30 hover:border-stitch text-navy font-black rounded-2xl text-xs uppercase tracking-wider flex items-center justify-center gap-3 transition-all active:scale-95 sticker-shadow disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{isLoading ? '驗證連線中...' : '使用 Google (Gmail) 登入'}</span>
                </button>
              </div>

              <div className="p-3 bg-cream/70 rounded-xl border border-accent/40 text-[9px] text-navy/50 leading-relaxed">
                💡 登入將開啟 Google 安全驗證視窗。若在嵌入式預覽中被瀏覽器安全性攔截，請允許快顯視窗或直接在獨立分頁開啟本應用程式。
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
