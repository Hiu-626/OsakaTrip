
import React, { useState, useEffect, useMemo } from 'react';
import { TripMember, Expense as ExpenseType } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Check, 
  Calculator, 
  RefreshCw, 
  Settings2, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  Wallet,
  ChevronDown,
  Coins,
  Calendar,
  Tag,
  PieChart
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { COLORS } from '../constants';

const Expense: React.FC<{ currentUser: TripMember; members: TripMember[] }> = ({ currentUser, members }) => {
  // --- Data States ---
  const [expenses, setExpenses] = useState<ExpenseType[]>(() => {
    const saved = localStorage.getItem('expenses');
    return saved ? JSON.parse(saved) : [];
  });

  // --- Currency System States ---
  // Active currencies list (e.g. ['JPY', 'HKD'])
  const [activeCurrencies, setActiveCurrencies] = useState<string[]>(() => {
    const saved = localStorage.getItem('activeCurrencies');
    return saved ? JSON.parse(saved) : ['JPY', 'HKD', 'AUD'];
  });

  // Exchange rates relative to JPY (Pivot: 1 Unit Currency = X JPY)
  // Example: HKD: 19.5 means 1 HKD = 19.5 JPY
  const [rates, setRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('exchangeRates');
    return saved ? JSON.parse(saved) : { JPY: 1, HKD: 19.2, AUD: 96.5, USD: 150.0, EUR: 162.0, TWD: 4.7 };
  });

  // User's preferred display currency
  const [displayCurrency, setDisplayCurrency] = useState<string>(() => {
    return localStorage.getItem('displayCurrency') || 'HKD';
  });

  // --- UI States ---
  const [expandedId, setExpandedId] = useState<string | null>(null); // For push-down expansion
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false); // Bottom Drawer for Currencies
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseType | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);

  // Common world currencies for selection
  const AVAILABLE_CURRENCIES = ['JPY', 'HKD', 'AUD', 'USD', 'EUR', 'GBP', 'TWD', 'KRW', 'SGD', 'CNY', 'THB'];

  // --- Effects ---
  useEffect(() => { localStorage.setItem('expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('activeCurrencies', JSON.stringify(activeCurrencies)); }, [activeCurrencies]);
  useEffect(() => { localStorage.setItem('exchangeRates', JSON.stringify(rates)); }, [rates]);
  useEffect(() => { localStorage.setItem('displayCurrency', displayCurrency); }, [displayCurrency]);

  // --- Helpers ---
  // Convert any amount from source currency to target currency using JPY as pivot
  const convert = (amount: number, from: string, to: string) => {
    const rateFrom = rates[from] || 1; // Rate is "How many JPY is 1 unit of X"
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

  // --- Smart Settlement Logic ---
  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach(m => bal[m.id] = 0);
    
    expenses.forEach(exp => {
      // 1. Normalize everything to JPY (Pivot)
      const amountInJPY = exp.amount * (rates[exp.currency] || 1);
      
      // 2. Calculate Payer credit
      bal[exp.paidBy] += amountInJPY;
      
      // 3. Calculate Debtor share
      const splitCount = exp.splitWith.length || 1;
      const shareInJPY = amountInJPY / splitCount;
      
      exp.splitWith.forEach(id => {
        if (bal[id] !== undefined) bal[id] -= shareInJPY;
      });
    });
    return bal;
  }, [expenses, rates, members]);

  // Total spent in Display Currency
  const totalSpentDisplay = useMemo(() => {
    const totalJPY = expenses.reduce((sum, exp) => sum + (exp.amount * (rates[exp.currency] || 1)), 0);
    return convert(totalJPY, 'JPY', displayCurrency);
  }, [expenses, rates, displayCurrency]);

  // Category Breakdown Logic
  const categoryStats = useMemo(() => {
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
  }, [expenses, rates, displayCurrency]);

  // --- Gemini Rate Sync ---
  const fetchRates = async () => {
    if (!process.env.API_KEY) {
      alert("Missing API Key");
      return;
    }
    setLoadingRates(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // We ask for rates of all active currencies against JPY
      const currenciesToFetch = activeCurrencies.filter(c => c !== 'JPY').join(', ');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Get real-time exchange rates for 1 unit of [${currenciesToFetch}] to JPY. Return valid JSON only, like {"HKD": 19.5, "USD": 150.2}.`,
        config: { responseMimeType: "application/json" }
      });
      
      const jsonText = response.text || "{}";
      const newRatesData = JSON.parse(jsonText);
      
      setRates(prev => ({ ...prev, ...newRatesData, JPY: 1 }));
      alert("匯率已更新！ (Rates updated)");
    } catch (e) {
      console.error(e);
      alert("匯率更新失敗 (Failed to update rates).");
    } finally {
      setLoadingRates(false);
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500 relative min-h-screen">
      
      {/* --- DASHBOARD --- */}
      <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl-sticker sticker-shadow border border-stitch/20 relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-donald/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10">
           {/* Top Row: Label & Settings */}
           <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30">Total Trip Spending</p>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1 px-2 py-1 bg-cream rounded-lg text-[9px] font-black text-navy/40 hover:text-stitch transition-colors"
              >
                 <Settings2 size={12} /> Manage
              </button>
           </div>

           {/* Main Amount - Click currency to switch */}
           <div className="flex items-baseline gap-2 mb-6">
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

           {/* Action Buttons */}
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

      {/* --- CATEGORY BREAKDOWN (Replaces Stitch Balance) --- */}
      <div className="bg-white p-5 rounded-2xl-sticker sticker-shadow border border-accent/40 relative overflow-hidden">
        <div className="flex justify-between items-center mb-4">
           <h3 className="text-[10px] font-black text-navy/30 uppercase tracking-[0.2em] flex items-center gap-1">
             <PieChart size={12} /> Breakdown
           </h3>
           <span className="text-[9px] font-bold text-navy/20">in {displayCurrency}</span>
        </div>
        
        <div className="space-y-4">
          {categoryStats.length > 0 ? categoryStats.map((stat, idx) => (
            <div key={stat.name} className="relative group">
              <div className="flex justify-between items-end mb-1.5 z-10 relative">
                 <div className="flex items-center gap-2">
                    <span 
                       className="w-2 h-2 rounded-full" 
                       style={{ backgroundColor: getCategoryColor(stat.name) }}
                    />
                    <span className="text-xs font-black text-navy">{stat.name}</span>
                 </div>
                 <div className="text-right flex items-baseline gap-2">
                   <span className="text-[10px] font-bold text-navy/40">{Math.round(stat.value).toLocaleString()}</span>
                   <span className="text-xs font-black text-navy">{Math.round(stat.percent)}%</span>
                 </div>
              </div>
              
              <div className="w-full h-2.5 bg-cream rounded-full overflow-hidden">
                 <div 
                   className="h-full rounded-full transition-all duration-1000 ease-out"
                   style={{ 
                     width: `${stat.percent}%`,
                     backgroundColor: getCategoryColor(stat.name) 
                   }}
                 />
              </div>
            </div>
          )) : (
            <div className="py-4 text-center opacity-30 text-[10px] font-bold text-navy uppercase tracking-widest">
               No spending data yet
            </div>
          )}
        </div>
      </div>

      {/* --- EXPENSE LIST --- */}
      <div className="space-y-4 pt-2">
         <h3 className="text-[11px] font-black text-navy/20 uppercase tracking-[0.3em] flex items-center gap-2 px-1">
            Activity Log
         </h3>

         {expenses.length > 0 ? (
           <div className="space-y-3">
             {expenses.map((exp) => {
               const payer = members.find(m => m.id === exp.paidBy);
               const isExpanded = expandedId === exp.id;
               
               // Fallback if no title (for old data)
               const displayName = exp.title || exp.category;
               
               return (
                 <div 
                   key={exp.id}
                   onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                   className={`bg-white rounded-2xl-sticker border transition-all duration-300 overflow-hidden cursor-pointer ${isExpanded ? 'border-stitch shadow-lg scale-[1.01] z-10' : 'border-accent/40 sticker-shadow hover:border-stitch/30'}`}
                 >
                    {/* Collapsed View (Always Visible) */}
                    <div className="p-4 flex items-center gap-4">
                       {/* Icon / Category */}
                       <div className="w-10 h-10 rounded-full bg-cream flex items-center justify-center text-lg shadow-inner flex-shrink-0" style={{ color: getCategoryColor(exp.category) }}>
                          {exp.category === 'Food' || exp.category === 'Restaurant' ? '🍜' : 
                           exp.category === 'Transport' ? '🚕' : 
                           exp.category === 'Shopping' ? '🛍️' : 
                           exp.category === 'Stay' ? '🏨' : 
                           exp.category === 'Attraction' || exp.category === 'Ticket' ? '🎫' : '💸'}
                       </div>

                       {/* Main Details */}
                       <div className="flex-1 min-w-0">
                          <h4 className="font-black text-navy text-sm truncate">{displayName}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                             <img src={payer?.avatar} className="w-4 h-4 rounded-full border border-white" />
                             <span className="text-[10px] font-bold text-navy/40 uppercase">{payer?.name} Paid</span>
                          </div>
                       </div>

                       {/* Amount */}
                       <div className="text-right">
                          <p className="font-black text-navy text-sm">{formatMoney(exp.amount, exp.currency)}</p>
                          <p className="text-[9px] font-bold text-navy/20">
                             ≈ {displayCurrency} {Math.round(convert(exp.amount, exp.currency, displayCurrency)).toLocaleString()}
                          </p>
                       </div>
                    </div>

                    {/* Push-Down Expanded Content */}
                    <div className={`bg-stitch/5 border-t border-stitch/10 overflow-hidden transition-[max-height, padding] duration-300 ease-in-out ${isExpanded ? 'max-h-40' : 'max-h-0'}`}>
                       <div className="p-4 flex items-center justify-between">
                          <div className="flex flex-col gap-1">
                             <div className="text-[9px] font-bold text-navy/30 uppercase tracking-wider mb-1">Split With</div>
                             <div className="flex -space-x-2">
                                {exp.splitWith.map(uid => {
                                  const m = members.find(mem => mem.id === uid);
                                  return <img key={uid} src={m?.avatar} className="w-6 h-6 rounded-full border-2 border-white" title={m?.name} />;
                                })}
                             </div>
                          </div>
                          
                          <div className="flex gap-2">
                             <button 
                               onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }}
                               className="p-2 bg-white text-stitch rounded-xl shadow-sm border border-stitch/20 hover:bg-stitch hover:text-white transition-colors flex items-center gap-1 text-[10px] font-black px-3"
                             >
                                <Edit2 size={12} /> EDIT
                             </button>
                             <button 
                               onClick={(e) => { e.stopPropagation(); setExpenses(expenses.filter(e => e.id !== exp.id)); }}
                               className="p-2 bg-white text-red-400 rounded-xl shadow-sm border border-red-100 hover:bg-red-400 hover:text-white transition-colors flex items-center gap-1 text-[10px] font-black px-3"
                             >
                                <Trash2 size={12} /> DELETE
                             </button>
                          </div>
                       </div>
                       <div className="px-4 pb-3 text-[9px] font-bold text-navy/30 text-center uppercase tracking-wider">
                          {exp.date} • Rate used: 1 {exp.currency} ≈ {convert(1, exp.currency, displayCurrency).toFixed(2)} {displayCurrency}
                       </div>
                    </div>
                 </div>
               );
             })}
           </div>
         ) : (
            <div className="py-24 text-center opacity-20 border-2 border-dashed border-accent rounded-3xl bg-paper/50">
               <Wallet size={48} className="mx-auto mb-3" />
               <p className="font-black uppercase text-[10px] tracking-widest">No expenses yet</p>
            </div>
         )}
      </div>

      {/* --- CURRENCY SETTINGS DRAWER (Bottom Sheet) --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/20 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
           <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10 sticker-shadow animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-accent rounded-full mx-auto mb-6 opacity-50" />
              
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-lg font-black text-navy uppercase tracking-widest">Currency & Rates</h3>
                 <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream rounded-full text-navy/40"><X size={20} /></button>
              </div>

              {/* Display Currency Selection */}
              <div className="mb-6">
                 <label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Display Currency</label>
                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {activeCurrencies.map(cur => (
                       <button 
                         key={cur}
                         onClick={() => setDisplayCurrency(cur)}
                         className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 font-black text-xs transition-all ${displayCurrency === cur ? 'bg-navy border-navy text-white shadow-md' : 'bg-white border-accent text-navy/40'}`}
                       >
                         {cur}
                       </button>
                    ))}
                 </div>
              </div>

              {/* Active Currencies Toggle */}
              <div className="mb-6">
                 <label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Active Currencies (My Wallet)</label>
                 <div className="flex flex-wrap gap-2">
                    {AVAILABLE_CURRENCIES.map(cur => {
                       const isActive = activeCurrencies.includes(cur);
                       return (
                          <button 
                             key={cur}
                             onClick={() => setActiveCurrencies(prev => isActive ? prev.filter(c => c !== cur) : [...prev, cur])}
                             className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${isActive ? 'bg-stitch/10 border-stitch text-stitch' : 'bg-cream border-transparent text-navy/20'}`}
                          >
                             {cur}
                          </button>
                       );
                    })}
                 </div>
              </div>
              
              {/* Rate Sync Button */}
              <button 
                 onClick={fetchRates}
                 disabled={loadingRates}
                 className="w-full py-4 bg-navy text-white font-black rounded-2xl-sticker uppercase text-xs tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                 <RefreshCw size={16} className={loadingRates ? 'animate-spin' : ''} />
                 {loadingRates ? 'Syncing with Gemini...' : 'Update Rates with AI'}
              </button>
              
              <p className="text-[9px] text-navy/20 text-center mt-3 font-bold">
                 Using Gemini 1.5 Flash • Base: JPY
              </p>
           </div>
        </div>
      )}

      {/* --- ADD/EDIT EXPENSE MODAL --- */}
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

      {/* --- SETTLEMENT MODAL --- */}
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

// --- Sub-Components ---

const SettlementModal: React.FC<{ 
   balances: Record<string, number>, 
   displayCurrency: string, 
   convert: any, 
   members: TripMember[], 
   onClose: () => void 
}> = ({ balances, displayCurrency, convert, members, onClose }) => {
   
   const suggestions = useMemo(() => {
      const people = Object.entries(balances).map(([id, amount]) => ({ id, amount }));
      const debtors = people.filter(p => p.amount < -1).sort((a, b) => a.amount - b.amount); // Less than -1 JPY to ignore dust
      const creditors = people.filter(p => p.amount > 1).sort((a, b) => b.amount - a.amount);
      
      const transactions = [];
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
        <div className="bg-paper w-full max-w-sm rounded-3xl-sticker p-6 sticker-shadow border-4 border-stitch/30 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
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
                          <img src={from?.avatar} className="w-8 h-8 rounded-full border border-red-200" />
                          <div className="flex flex-col items-center px-2">
                             <p className="text-[9px] font-black text-navy/30 uppercase">PAYS</p>
                             <ArrowRight size={12} className="text-navy/20 my-1" />
                          </div>
                          <img src={to?.avatar} className="w-8 h-8 rounded-full border border-stitch" />
                       </div>
                       <div className="text-right">
                          <p className="font-black text-navy text-lg">{displayCurrency} {amountDisplay.toLocaleString()}</p>
                       </div>
                    </div>
                 );
              }) : (
                 <div className="py-12 text-center text-navy/30 font-black uppercase tracking-widest">
                    All settled up!
                 </div>
              )}
           </div>
        </div>
     </div>
   );
};

const ExpenseModal: React.FC<{ expense: ExpenseType | null; members: TripMember[]; currencies: string[]; onClose: () => void; onSave: (e: ExpenseType) => void }> = ({ expense, members, currencies, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ExpenseType>>(expense || {
    amount: '',
    currency: currencies[0],
    category: '',
    title: '', // New Title field
    paidBy: members[0].id,
    splitWith: members.map(m => m.id),
    date: new Date().toISOString().split('T')[0]
  } as any);

  const categories = ['Food', 'Restaurant', 'Transport', 'Shopping', 'Stay', 'Ticket', 'Attraction', 'Other'];

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-cream/95 backdrop-blur-md animate-in slide-in-from-bottom duration-300">
      <div className="p-4 flex justify-between items-center border-b border-accent/40 bg-white/80">
        <button onClick={onClose} className="text-navy/20 p-2"><X size={24} /></button>
        <h3 className="text-lg font-black text-navy uppercase tracking-[0.2em]">{expense ? 'Edit Expense' : 'New Expense'}</h3>
        <button 
           onClick={() => onSave({ ...formData, title: formData.title || formData.category } as ExpenseType)} 
           className="text-stitch font-black p-2 disabled:opacity-30" 
           disabled={!formData.category || !formData.amount || formData.splitWith?.length === 0}
        >
           SAVE
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
         {/* Amount Input */}
         <div className="bg-white p-8 rounded-3xl-sticker sticker-shadow border border-accent/30 text-center shadow-inner">
            <div className="flex items-center justify-center gap-2">
               <div className="relative">
                  <select 
                     value={formData.currency} 
                     onChange={e => setFormData({...formData, currency: e.target.value})} 
                     className="appearance-none bg-transparent text-xl font-black text-stitch border-none focus:ring-0 pr-6 cursor-pointer"
                  >
                     {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-stitch pointer-events-none" />
               </div>
               <input 
                  type="number" 
                  value={formData.amount || ''} 
                  onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} 
                  placeholder="0" 
                  className="w-full text-5xl font-black text-navy bg-transparent border-none focus:ring-0 text-center placeholder:text-navy/10" 
                  autoFocus 
               />
            </div>
         </div>

         {/* Title (Name) & Date Input */}
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 sticker-shadow shadow-inner space-y-4">
            <div>
               <label className="text-[10px] font-black uppercase text-navy/20 mb-2 block tracking-widest flex items-center gap-1">
                  <Tag size={12} /> Name / Title
               </label>
               <input 
                 type="text" 
                 value={formData.title} 
                 onChange={e => setFormData({...formData, title: e.target.value})} 
                 placeholder="e.g. Ichiran Ramen" 
                 className="w-full font-black text-navy border-none focus:ring-0 p-0 text-xl placeholder:text-navy/10" 
               />
            </div>
            
            <div className="pt-4 border-t border-accent/10">
               <label className="text-[10px] font-black uppercase text-navy/20 mb-2 block tracking-widest flex items-center gap-1">
                  <Calendar size={12} /> Date
               </label>
               <input 
                 type="date" 
                 value={formData.date} 
                 onChange={e => setFormData({...formData, date: e.target.value})} 
                 className="w-full font-bold text-navy bg-transparent border-none focus:ring-0 p-0 text-sm" 
               />
            </div>
         </div>

         {/* Category Chips */}
         <div>
            <label className="text-[10px] font-black uppercase text-navy/20 mb-3 block px-1 tracking-widest">Category (Icon)</label>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
               {categories.map(cat => (
                  <button 
                     key={cat}
                     onClick={() => setFormData({...formData, category: cat})}
                     className={`px-4 py-2 rounded-2xl font-black text-xs uppercase tracking-wider border-2 transition-all ${formData.category === cat ? 'bg-navy border-navy text-white shadow-md' : 'bg-white border-accent text-navy/30'}`}
                  >
                     {cat}
                  </button>
               ))}
            </div>
         </div>

         {/* Payer */}
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 sticker-shadow shadow-inner">
            <label className="text-[10px] font-black uppercase text-navy/20 mb-4 block tracking-widest">Paid By</label>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
               {members.map(m => (
                  <button key={m.id} onClick={() => setFormData({ ...formData, paidBy: m.id })} className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${formData.paidBy === m.id ? 'opacity-100 scale-110' : 'opacity-40 grayscale'}`}>
                     <img src={m.avatar} className={`w-12 h-12 rounded-full object-cover border-2 ${formData.paidBy === m.id ? 'border-stitch shadow-md' : 'border-transparent'}`} />
                     <span className="text-[9px] font-black uppercase">{m.name}</span>
                  </button>
               ))}
            </div>
         </div>

         {/* Split With */}
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 sticker-shadow shadow-inner">
            <label className="text-[10px] font-black uppercase text-navy/20 mb-4 block tracking-widest">Split With</label>
            <div className="grid grid-cols-2 gap-3">
               {members.map(m => {
                  const isSelected = formData.splitWith?.includes(m.id);
                  return (
                     <button 
                        key={m.id} 
                        onClick={() => {
                           const current = formData.splitWith || [];
                           setFormData({ ...formData, splitWith: isSelected ? current.filter(id => id !== m.id) : [...current, m.id] });
                        }} 
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? 'bg-stitch/10 border-stitch text-navy' : 'bg-white border-accent/40 text-navy/20'}`}
                     >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-stitch border-stitch' : 'border-accent'}`}>
                           {isSelected && <Check size={14} className="text-white" />}
                        </div>
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

export default Expense;
