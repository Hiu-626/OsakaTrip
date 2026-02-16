
import React, { useState, useEffect, useMemo } from 'react';
import { TripMember, Expense as ExpenseType } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  RefreshCw, 
  Settings2, 
  ArrowRight,
  Wallet,
  ChevronDown,
  Calendar,
  Tag,
  PieChart,
  CheckCircle2,
  Users,
  Search,
  BarChart3,
  FilterX
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { COLORS } from '../constants';

const Expense: React.FC<{ currentUser: TripMember; members: TripMember[] }> = ({ currentUser, members }) => {
  // --- Data States ---
  const [expenses, setExpenses] = useState<ExpenseType[]>(() => {
    const saved = localStorage.getItem('expenses');
    const parsed = saved ? JSON.parse(saved) : [];
    // Ensure data is properly structured
    return parsed.map((e: any) => ({
      ...e,
      settledBy: e.settledBy || (e.isSettled ? e.splitWith : [])
    }));
  });

  // --- Currency System States ---
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>(() => {
    const saved = localStorage.getItem('activeCurrencies');
    return saved ? JSON.parse(saved) : ['JPY', 'HKD', 'AUD'];
  });

  const [rates, setRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('exchangeRates');
    return saved ? JSON.parse(saved) : { JPY: 1, HKD: 19.2, AUD: 96.5, USD: 150.0, EUR: 162.0, TWD: 4.7 };
  });

  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    return localStorage.getItem('displayCurrency') || 'HKD';
  });

  // --- UI States ---
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseType | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  
  const [breakdownMode, setBreakdownMode] = useState<'category' | 'daily'>('category');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterDate, setSelectedFilterDate] = useState<string | null>(null);

  const AVAILABLE_CURRENCIES = ['JPY', 'HKD', 'AUD', 'USD', 'EUR', 'GBP', 'TWD', 'KRW', 'SGD', 'CNY', 'THB'];

  // --- Effects ---
  useEffect(() => { localStorage.setItem('expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('activeCurrencies', JSON.stringify(activeCurrencies)); }, [activeCurrencies]);
  useEffect(() => { localStorage.setItem('exchangeRates', JSON.stringify(rates)); }, [rates]);
  useEffect(() => { localStorage.setItem('displayCurrency', displayCurrency); }, [displayCurrency]);

  // --- Helpers ---
  const convert = (amount: number, from: string, to: string) => {
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    const amountInJPY = amount * rateFrom;
    return amountInJPY / rateTo;
  };

  const formatMoney = (amount: number, currency: string) => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}`;
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = {
      'Food': COLORS.restaurant,
      'Restaurant': COLORS.restaurant,
      'Transport': COLORS.transport,
      'Stay': COLORS.stay,
      'Shopping': COLORS.shopping,
      'Attraction': COLORS.attraction,
      'Ticket': COLORS.attraction,
      'Other': COLORS.other
    };
    return map[cat] || COLORS.other;
  };

  const toggleMemberSettled = (e: React.MouseEvent, expenseId: string, memberId: string) => {
    e.stopPropagation();
    setExpenses(prev => prev.map(exp => {
      if (exp.id === expenseId) {
        const currentSettled = exp.settledBy || [];
        const isSettled = currentSettled.includes(memberId);
        return {
          ...exp,
          settledBy: isSettled 
            ? currentSettled.filter(id => id !== memberId) 
            : [...currentSettled, memberId]
        };
      }
      return exp;
    }));
  };

  // --- Derived Data ---
  
  const todayDate = new Date().toISOString().split('T')[0];

  // FIX: Recalculate everything strictly based on current expenses array
  const todayStats = useMemo(() => {
    const todayExpenses = expenses.filter(e => e.date === todayDate);
    const totalJPY = todayExpenses.reduce((sum, exp) => sum + (exp.amount * (rates[exp.currency] || 1)), 0);
    return {
      count: todayExpenses.length,
      total: convert(totalJPY, 'JPY', displayCurrency)
    };
  }, [expenses, rates, displayCurrency, todayDate]);

  const totalSpentDisplay = useMemo(() => {
    const totalJPY = expenses.reduce((sum, exp) => sum + (exp.amount * (rates[exp.currency] || 1)), 0);
    return convert(totalJPY, 'JPY', displayCurrency);
  }, [expenses, rates, displayCurrency]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchSearch = exp.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          exp.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = selectedFilterDate ? exp.date === selectedFilterDate : true;
      return matchSearch && matchDate;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, searchTerm, selectedFilterDate]);

  const breakdownStats = useMemo(() => {
    if (breakdownMode === 'category') {
      const stats: Record<string, number> = {};
      let total = 0;
      expenses.forEach(exp => {
        const val = convert(exp.amount, exp.currency, displayCurrency);
        const cat = exp.category || 'Other';
        stats[cat] = (stats[cat] || 0) + val;
        total += val;
      });
      return Object.entries(stats)
        .map(([name, value]) => ({ 
          name, 
          value, 
          percent: total > 0 ? (value / total) * 100 : 0 
        }))
        .sort((a, b) => b.value - a.value);
    } else {
      const stats: Record<string, number> = {};
      let total = 0;
      expenses.forEach(exp => {
        const val = convert(exp.amount, exp.currency, displayCurrency);
        const date = exp.date;
        stats[date] = (stats[date] || 0) + val;
        total += val;
      });
      return Object.entries(stats)
        .map(([name, value]) => ({ 
          name, 
          value, 
          percent: total > 0 ? (value / total) * 100 : 0 
        }))
        .sort((a, b) => b.name.localeCompare(a.name)); 
    }
  }, [expenses, rates, displayCurrency, breakdownMode]);

  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach(m => bal[m.id] = 0);
    
    expenses.forEach(exp => {
      const amountInJPY = exp.amount * (rates[exp.currency] || 1);
      const splitCount = exp.splitWith.length || 1;
      const shareInJPY = amountInJPY / splitCount;
      
      exp.splitWith.forEach(debtorId => {
        if (exp.settledBy?.includes(debtorId)) return; 
        if (debtorId !== exp.paidBy) {
          if (bal[debtorId] !== undefined) bal[debtorId] -= shareInJPY;
          if (bal[exp.paidBy] !== undefined) bal[exp.paidBy] += shareInJPY;
        }
      });
    });
    return bal;
  }, [expenses, rates, members]);

  const fetchRates = async () => {
    if (!process.env.API_KEY) {
      alert("Missing API Key");
      return;
    }
    setLoadingRates(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currenciesToFetch = activeCurrencies.filter(c => c !== 'JPY').join(', ');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Get real-time exchange rates for 1 unit of [${currenciesToFetch}] to JPY. Return valid JSON only, like {"HKD": 19.5, "USD": 150.2}.`,
        config: { responseMimeType: "application/json" }
      });
      const jsonText = response.text || "{}";
      const newRatesData = JSON.parse(jsonText);
      setRates(prev => ({ ...prev, ...newRatesData, JPY: 1 }));
      alert("匯率已更新！");
    } catch (e) {
      console.error(e);
      alert("匯率更新失敗。");
    } finally {
      setLoadingRates(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in relative min-h-screen">
      
      {/* --- DASHBOARD --- */}
      <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl-sticker sticker-shadow border border-stitch/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-donald/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
           <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30">Total Trip Spending</p>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsSearchVisible(!isSearchVisible)}
                  className={`p-1.5 rounded-lg transition-colors ${isSearchVisible ? 'bg-stitch text-white' : 'bg-cream text-navy/40 hover:text-stitch'}`}
                >
                  <Search size={14} />
                </button>
                <button 
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 bg-cream rounded-lg text-[9px] font-black text-navy/40 hover:text-stitch transition-colors"
                >
                  <Settings2 size={12} /> Manage
                </button>
              </div>
           </div>

           <div className="flex items-baseline gap-2 mb-4">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-2xl font-black text-stitch/80 hover:bg-stitch/10 px-2 rounded-lg transition-colors flex items-center gap-1"
              >
                 {displayCurrency} <ChevronDown size={16} />
              </button>
              <h1 className="text-5xl font-black text-navy tracking-tight">
                 {Math.round(totalSpentDisplay).toLocaleString()}
              </h1>
           </div>

           {/* Today's Summary Block - Interactive Filter */}
           <div 
             onClick={() => setSelectedFilterDate(selectedFilterDate === todayDate ? null : todayDate)}
             className={`p-4 mb-6 border rounded-2xl flex justify-between items-center cursor-pointer transition-all ${selectedFilterDate === todayDate ? 'bg-stitch text-white border-stitch shadow-lg scale-[1.02]' : 'bg-stitch/10 text-navy border-stitch/20 hover:bg-stitch/20'}`}
           >
             <div>
               <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${selectedFilterDate === todayDate ? 'text-white/80' : 'text-stitch'}`}>Today's Summary</p>
               <h4 className="text-xl font-black">{displayCurrency} {Math.round(todayStats.total).toLocaleString()}</h4>
             </div>
             <div className="text-right">
               <span className={`px-2 py-1 rounded-full text-[9px] font-black border ${selectedFilterDate === todayDate ? 'bg-white/20 border-white text-white' : 'bg-white border-stitch/20 text-stitch'}`}>
                 {todayStats.count} RECORDS
               </span>
               <p className="text-[8px] font-bold mt-1 opacity-50">{selectedFilterDate === todayDate ? 'FILTER ON' : 'TAP TO VIEW'}</p>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => { setEditingExpense(null); setIsModalOpen(true); }}
                className="bg-stitch text-white py-3.5 rounded-2xl-sticker font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 sticker-shadow active:scale-95 transition-all shadow-lg shadow-stitch/20"
              >
                 <Plus size={16} /> Record
              </button>
              <button 
                onClick={() => setIsSettlementOpen(true)}
                className="bg-white text-navy border border-accent py-3.5 rounded-2xl-sticker font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 sticker-shadow active:scale-95 transition-all"
              >
                 <Wallet size={16} /> Quick Settle
              </button>
           </div>
        </div>
      </div>

      {/* --- SEARCH BAR (Toggleable) --- */}
      {isSearchVisible && (
        <div className="animate-in">
          <div className="bg-white p-3 rounded-2xl border border-stitch/30 flex items-center gap-2">
            <Search size={16} className="text-stitch ml-1" />
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search title or category..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-navy p-0"
              autoFocus
            />
            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={16} className="text-navy/20" /></button>}
          </div>
        </div>
      )}

      {/* --- BREAKDOWN SECTION (Clickable Bars for Drill-down) --- */}
      <div className="bg-white p-5 rounded-2xl-sticker sticker-shadow border border-accent/40 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
           <div className="flex gap-4">
              <button 
                onClick={() => setBreakdownMode('category')}
                className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors ${breakdownMode === 'category' ? 'text-stitch' : 'text-navy/20'}`}
              >
                <PieChart size={12} /> Category
              </button>
              <button 
                onClick={() => setBreakdownMode('daily')}
                className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 transition-colors ${breakdownMode === 'daily' ? 'text-stitch' : 'text-navy/20'}`}
              >
                <BarChart3 size={12} /> Daily
              </button>
           </div>
           <span className="text-[9px] font-bold text-navy/20">in {displayCurrency}</span>
        </div>
        
        <div className="space-y-4">
          {breakdownStats.length > 0 ? breakdownStats.map((stat) => (
            <div 
              key={stat.name} 
              onClick={() => {
                if (breakdownMode === 'daily') {
                  setSelectedFilterDate(selectedFilterDate === stat.name ? null : stat.name);
                }
              }}
              className={`relative group ${breakdownMode === 'daily' ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
            >
              <div className="flex justify-between items-end mb-1.5 z-10 relative">
                 <div className="flex items-center gap-2">
                    <span 
                       className="w-2 h-2 rounded-full" 
                       style={{ backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : (selectedFilterDate === stat.name ? COLORS.stitch : '#E0E5D5') }}
                    />
                    <span className={`text-xs font-black transition-colors ${selectedFilterDate === stat.name ? 'text-stitch' : 'text-navy'}`}>
                      {stat.name}
                    </span>
                 </div>
                 <div className="text-right flex items-baseline gap-2">
                   <span className="text-[10px] font-bold text-navy/40">{Math.round(stat.value).toLocaleString()}</span>
                   <span className="text-xs font-black text-navy">{Math.round(stat.percent)}%</span>
                 </div>
              </div>
              <div className="w-full h-2.5 bg-cream rounded-full overflow-hidden">
                 <div 
                   className="h-full rounded-full transition-all duration-700 ease-out"
                   style={{ 
                     width: `${stat.percent}%`,
                     backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : (selectedFilterDate === stat.name ? COLORS.stitch : COLORS.stitch + '44')
                   }}
                 />
              </div>
            </div>
          )) : (
            <div className="py-4 text-center opacity-30 text-[10px] font-bold text-navy uppercase tracking-widest">
               No data available
            </div>
          )}
        </div>
        {breakdownMode === 'daily' && (
           <p className="text-[8px] font-black text-navy/20 text-center mt-4 uppercase tracking-widest">Tap date for details</p>
        )}
      </div>

      {/* --- ACTIVITY LOG --- */}
      <div className="space-y-4 pt-2">
         <div className="flex justify-between items-center px-1">
            <h3 className="text-[11px] font-black text-navy/20 uppercase tracking-[0.3em] flex items-center gap-2">
               Activity Log {selectedFilterDate && <span className="text-stitch bg-stitch/10 px-2 rounded-full">/ {selectedFilterDate}</span>}
            </h3>
            {selectedFilterDate && (
               <button 
                 onClick={() => setSelectedFilterDate(null)}
                 className="flex items-center gap-1 text-[9px] font-black text-stitch uppercase"
               >
                 <FilterX size={10} /> Clear Filter
               </button>
            )}
         </div>

         {filteredExpenses.length > 0 ? (
           <div className="space-y-3">
             {filteredExpenses.map((exp) => {
               const payer = members.find(m => m.id === exp.paidBy);
               const isExpanded = expandedId === exp.id;
               const displayName = exp.title || exp.category;
               const allSettled = exp.splitWith.length > 0 && exp.splitWith.every(id => exp.settledBy?.includes(id));
               const partiallySettled = exp.settledBy && exp.settledBy.length > 0 && !allSettled;

               return (
                 <div 
                   key={exp.id}
                   onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                   className={`
                      relative rounded-2xl-sticker border transition-all duration-300 overflow-hidden cursor-pointer 
                      ${isExpanded ? 'bg-white border-stitch shadow-lg scale-[1.01] z-10' : 'bg-white border-accent/40 sticker-shadow'}
                      ${allSettled ? 'opacity-70 bg-gray-50/50' : ''}
                   `}
                 >
                    <div className="p-4 flex items-center gap-4 relative">
                       {/* Date Badge */}
                       <div className="absolute top-2 right-4 text-[8px] font-black text-navy/20 uppercase tracking-widest flex items-center gap-1">
                         <Calendar size={8} /> {exp.date}
                       </div>

                       <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner flex-shrink-0 bg-cream`} style={{ color: allSettled ? '#999' : getCategoryColor(exp.category) }}>
                          {exp.category === 'Food' || exp.category === 'Restaurant' ? '🍜' : 
                           exp.category === 'Transport' ? '🚕' : 
                           exp.category === 'Shopping' ? '🛍️' : 
                           exp.category === 'Stay' ? '🏨' : 
                           exp.category === 'Attraction' || exp.category === 'Ticket' ? '🎫' : '💸'}
                       </div>

                       <div className="flex-1 min-w-0">
                          <h4 className={`font-black text-sm truncate ${allSettled ? 'text-navy/50 line-through' : 'text-navy'}`}>{displayName}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                             <img src={payer?.avatar} className={`w-4 h-4 rounded-full border border-white`} />
                             <span className="text-[10px] font-bold text-navy/40 uppercase">{payer?.name} Paid</span>
                          </div>
                       </div>

                       <div className="text-right">
                          <p className={`font-black text-sm ${allSettled ? 'text-navy/40' : 'text-navy'}`}>{formatMoney(exp.amount, exp.currency)}</p>
                          <p className="text-[9px] font-bold text-navy/20">
                             ≈ {displayCurrency} {Math.round(convert(exp.amount, exp.currency, displayCurrency)).toLocaleString()}
                          </p>
                       </div>
                    </div>

                    <div className={`bg-stitch/5 border-t border-stitch/10 overflow-hidden transition-[max-height, padding] duration-300 ease-in-out ${isExpanded ? 'max-h-80' : 'max-h-0'}`}>
                       <div className="p-4 flex flex-col gap-3">
                          <div className="bg-white rounded-xl border border-accent/40 p-3">
                             <p className="text-[9px] font-bold text-navy/30 uppercase mb-2">Split Status</p>
                             <div className="space-y-2">
                               {exp.splitWith.map(uid => {
                                  const m = members.find(mem => mem.id === uid);
                                  const isMemberSettled = exp.settledBy?.includes(uid);
                                  const isPayer = uid === exp.paidBy;
                                  return (
                                     <button 
                                        key={uid}
                                        onClick={(e) => toggleMemberSettled(e, exp.id, uid)}
                                        className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all ${
                                           isMemberSettled 
                                           ? 'bg-green-50 border-green-200' 
                                           : isPayer 
                                              ? 'bg-cream border-transparent cursor-default'
                                              : 'bg-white border-accent'
                                        }`}
                                        disabled={isPayer}
                                     >
                                        <div className="flex items-center gap-2">
                                           <img src={m?.avatar} className={`w-6 h-6 rounded-full border border-white`} />
                                           <span className={`text-[10px] font-black uppercase ${isMemberSettled ? 'text-green-600' : 'text-navy'}`}>
                                              {m?.name} {isPayer && '(Payer)'}
                                           </span>
                                        </div>
                                        {!isPayer && isMemberSettled && <Check size={12} className="text-green-600" />}
                                     </button>
                                  );
                               })}
                             </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                             <button 
                               onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }}
                               className="p-2 bg-white text-stitch rounded-xl border border-stitch/20 text-[10px] font-black px-3"
                             >
                                <Edit2 size={12} /> EDIT
                             </button>
                             <button 
                               onClick={(e) => { e.stopPropagation(); if(confirm('Delete record?')) setExpenses(expenses.filter(e => e.id !== exp.id)); }}
                               className="p-2 bg-white text-red-400 rounded-xl border border-red-100 text-[10px] font-black px-3"
                             >
                                <Trash2 size={12} /> DELETE
                             </button>
                          </div>
                       </div>
                    </div>
                 </div>
               );
             })}
           </div>
         ) : (
            <div className="py-24 text-center opacity-20 border-2 border-dashed border-accent rounded-3xl">
               <Wallet size={48} className="mx-auto mb-3" />
               <p className="font-black uppercase text-[10px] tracking-widest">Empty pocket</p>
            </div>
         )}
      </div>

      {/* --- SETTINGS DRAWER --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/20 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
           <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10 sticker-shadow animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-accent rounded-full mx-auto mb-6 opacity-50" />
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-navy uppercase tracking-widest">Settings</h3>
                 <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream rounded-full text-navy/40"><X size={20} /></button>
              </div>
              <div className="mb-6">
                 <label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Display Currency</label>
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {activeCurrencies.map(cur => (
                       <button 
                         key={cur}
                         onClick={() => setDisplayCurrency(cur)}
                         className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 font-black text-xs ${displayCurrency === cur ? 'bg-navy border-navy text-white' : 'bg-white border-accent text-navy/40'}`}
                       >
                         {cur}
                       </button>
                    ))}
                 </div>
              </div>
              <button 
                 onClick={fetchRates}
                 disabled={loadingRates}
                 className="w-full py-4 bg-navy text-white font-black rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2"
              >
                 <RefreshCw size={16} className={loadingRates ? 'animate-spin' : ''} />
                 {loadingRates ? 'Syncing...' : 'Update Exchange Rates'}
              </button>
           </div>
        </div>
      )}

      {isModalOpen && (
        <ExpenseModal 
          expense={editingExpense} 
          members={members} 
          currencies={activeCurrencies}
          onClose={() => setIsModalOpen(false)} 
          onSave={(e) => {
            if (editingExpense) setExpenses(expenses.map(ex => ex.id === e.id ? e : ex));
            else setExpenses([{ ...e, id: Date.now().toString() }, ...expenses]);
            setIsModalOpen(false);
          }} 
        />
      )}

      {isSettlementOpen && (
         <SettlementModal 
            balances={balances} 
            displayCurrency={displayCurrency} 
            convert={convert} 
            members={members}
            onClose={() => setIsSettlementOpen(false)} 
         />
      )}
    </div>
  );
};

// --- Helper Components ---

const SettlementModal: React.FC<{ 
   balances: Record<string, number>, 
   displayCurrency: string, 
   convert: any, 
   members: TripMember[], 
   onClose: () => void 
}> = ({ balances, displayCurrency, convert, members, onClose }) => {
   
   const suggestions = useMemo(() => {
      const people = Object.entries(balances).map(([id, amount]) => ({ id, amount: amount as number }));
      const debtors = people.filter(p => p.amount < -1).sort((a, b) => a.amount - b.amount);
      const creditors = people.filter(p => p.amount > 1).sort((a, b) => b.amount - a.amount);
      
      const transactions: { from: string; to: string; amount: number }[] = [];
      let i = 0, j = 0;
      
      while (i < debtors.length && j < creditors.length) {
         const debtor = debtors[i];
         const creditor = creditors[j];
         const amount = Math.min(Math.abs(debtor.amount), creditor.amount);
         transactions.push({ from: debtor.id, to: creditor.id, amount });
         debtor.amount += amount;
         creditor.amount -= amount;
         if (Math.abs(debtor.amount) < 1) i++;
         if (creditor.amount < 1) j++;
      }
      return transactions;
   }, [balances]);

   return (
     <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-navy/5 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-paper w-full max-w-sm rounded-3xl p-6 sticker-shadow border-4 border-stitch/30 animate-in" onClick={e => e.stopPropagation()}>
           <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-navy uppercase tracking-widest">Settlement Plan</h3>
              <button onClick={onClose} className="p-2 bg-cream rounded-full text-navy/20"><X size={20} /></button>
           </div>
           <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {suggestions.length > 0 ? suggestions.map((tx, idx) => {
                 const from = members.find(m => m.id === tx.from);
                 const to = members.find(m => m.id === tx.to);
                 const amountDisplay = Math.round(convert(tx.amount, 'JPY', displayCurrency));
                 return (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-accent flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <img src={from?.avatar} className="w-8 h-8 rounded-full" />
                          <ArrowRight size={14} className="text-navy/20" />
                          <img src={to?.avatar} className="w-8 h-8 rounded-full" />
                       </div>
                       <div className="text-right">
                          <p className="font-black text-navy text-lg">{displayCurrency} {amountDisplay.toLocaleString()}</p>
                       </div>
                    </div>
                 );
              }) : (
                 <div className="py-12 text-center text-navy/30 font-black uppercase">All clear!</div>
              )}
           </div>
        </div>
     </div>
   );
};

const ExpenseModal: React.FC<{ expense: ExpenseType | null; members: TripMember[]; currencies: string[]; onClose: () => void; onSave: (e: ExpenseType) => void }> = ({ expense, members, currencies, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ExpenseType>>(expense || {
    amount: 0,
    currency: currencies[0],
    category: 'Other',
    title: '',
    paidBy: members[0].id,
    splitWith: members.map(m => m.id),
    settledBy: [],
    date: new Date().toISOString().split('T')[0],
  } as any);

  const categories = ['Food', 'Restaurant', 'Transport', 'Shopping', 'Stay', 'Ticket', 'Attraction', 'Other'];

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-cream/95 backdrop-blur-md animate-in">
      <div className="p-4 flex justify-between items-center border-b border-accent bg-white/80">
        <button onClick={onClose} className="text-navy/20 p-2"><X size={24} /></button>
        <h3 className="text-lg font-black text-navy uppercase tracking-[0.2em]">{expense ? 'Edit' : 'New'} Record</h3>
        <button onClick={() => onSave({ ...formData, title: formData.title || formData.category } as ExpenseType)} className="text-stitch font-black p-2" disabled={!formData.amount}>SAVE</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
         <div className="bg-white p-8 rounded-3xl-sticker sticker-shadow border border-accent/30 text-center">
            <div className="flex items-center justify-center gap-2">
               <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="bg-transparent text-xl font-black text-stitch border-none focus:ring-0">
                  {currencies.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <input type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} placeholder="0" className="w-full text-5xl font-black text-navy bg-transparent border-none focus:ring-0 text-center" autoFocus />
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 sticker-shadow space-y-4">
            <div>
               <label className="text-[10px] font-black uppercase text-navy/20 mb-2 block tracking-widest"><Tag size={12} /> Name</label>
               <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Ramen" className="w-full font-black text-navy border-none focus:ring-0 p-0 text-xl" />
            </div>
            <div className="pt-4 border-t border-accent/10">
               <label className="text-[10px] font-black uppercase text-navy/20 mb-2 block tracking-widest"><Calendar size={12} /> Date</label>
               <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full font-bold text-navy bg-transparent border-none focus:ring-0 p-0" />
            </div>
         </div>
         <div>
            <label className="text-[10px] font-black uppercase text-navy/20 mb-3 block px-1 tracking-widest">Category</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               {categories.map(cat => (
                  <button key={cat} onClick={() => setFormData({...formData, category: cat})} className={`px-4 py-2 rounded-2xl font-black text-xs uppercase border-2 transition-all ${formData.category === cat ? 'bg-navy border-navy text-white' : 'bg-white border-accent text-navy/30'}`}>{cat}</button>
               ))}
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 sticker-shadow">
            <label className="text-[10px] font-black uppercase text-navy/20 mb-4 block tracking-widest">Paid By</label>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
               {members.map(m => (
                  <button key={m.id} onClick={() => setFormData({ ...formData, paidBy: m.id })} className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${formData.paidBy === m.id ? 'opacity-100 scale-110' : 'opacity-40 grayscale'}`}>
                     <img src={m.avatar} className={`w-10 h-10 rounded-full object-cover border-2 ${formData.paidBy === m.id ? 'border-stitch' : 'border-transparent'}`} />
                     <span className="text-[9px] font-black uppercase">{m.name}</span>
                  </button>
               ))}
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 sticker-shadow">
            <label className="text-[10px] font-black uppercase text-navy/20 mb-4 block tracking-widest">Split With</label>
            <div className="grid grid-cols-2 gap-3">
               {members.map(m => {
                  const isSelected = formData.splitWith?.includes(m.id);
                  return (
                     <button 
                        key={m.id} 
                        onClick={() => {
                           const current = formData.splitWith || [];
                           const newSplit = isSelected ? current.filter(id => id !== m.id) : [...current, m.id];
                           setFormData({ ...formData, splitWith: newSplit });
                        }} 
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? 'bg-stitch/10 border-stitch text-navy' : 'bg-white border-accent text-navy/20'}`}
                     >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-stitch border-stitch' : 'border-accent'}`}>{isSelected && <Check size={12} className="text-white" />}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest">{m.name}</span>
                     </button>
                  );
               })}
            </div>
         </div>
      </div>
    </div>
  );
};

// Internal icon component for FilterX
const FilterX = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 3h10v2h-10z"/><path d="M11 9h10v2h-10z"/><path d="M11 15h10v2h-10z"/><path d="M4 3h2v18h-2z"/><path d="M7 6l-3-3-3 3"/>
  </svg>
);

export default Expense;
