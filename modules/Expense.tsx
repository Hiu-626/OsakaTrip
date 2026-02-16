
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Search,
  BarChart3,
  FilterX
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { COLORS } from '../constants';

const Expense: React.FC<{ currentUser: TripMember; members: TripMember[] }> = ({ currentUser, members }) => {
  const [expenses, setExpenses] = useState<ExpenseType[]>(() => {
    const saved = localStorage.getItem('expenses');
    return saved ? JSON.parse(saved) : [];
  });

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
  
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { localStorage.setItem('expenses', JSON.stringify(expenses)); }, [expenses]);
  useEffect(() => { localStorage.setItem('activeCurrencies', JSON.stringify(activeCurrencies)); }, [activeCurrencies]);
  useEffect(() => { localStorage.setItem('exchangeRates', JSON.stringify(rates)); }, [rates]);
  useEffect(() => { localStorage.setItem('displayCurrency', displayCurrency); }, [displayCurrency]);

  const convert = (amount: number, from: string, to: string) => {
    const rateFrom = rates[from] || 1;
    const rateTo = rates[to] || 1;
    return (amount * rateFrom) / rateTo;
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

  const todayDate = new Date().toISOString().split('T')[0];

  const { todayStats, totalSpentDisplay, breakdownStats } = useMemo(() => {
    const todayExpenses = expenses.filter(e => e.date === todayDate);
    const todayTotalJPY = todayExpenses.reduce((sum, e) => sum + (e.amount * (rates[e.currency] || 1)), 0);
    const totalJPY = expenses.reduce((sum, e) => sum + (e.amount * (rates[e.currency] || 1)), 0);

    let stats: any[] = [];
    if (breakdownMode === 'category') {
      const catMap: Record<string, number> = {};
      expenses.forEach(e => {
        const val = convert(e.amount, e.currency, displayCurrency);
        catMap[e.category] = (catMap[e.category] || 0) + val;
      });
      stats = Object.entries(catMap).map(([name, value]) => ({
        name, value, percent: totalJPY > 0 ? (value / convert(totalJPY, 'JPY', displayCurrency)) * 100 : 0
      })).sort((a, b) => b.value - a.value);
    } else {
      const dateMap: Record<string, number> = {};
      expenses.forEach(e => {
        const val = convert(e.amount, e.currency, displayCurrency);
        dateMap[e.date] = (dateMap[e.date] || 0) + val;
      });
      stats = Object.entries(dateMap).map(([name, value]) => ({
        name, value, percent: totalJPY > 0 ? (value / convert(totalJPY, 'JPY', displayCurrency)) * 100 : 0
      })).sort((a, b) => b.name.localeCompare(a.name));
    }

    return {
      todayStats: { count: todayExpenses.length, total: convert(todayTotalJPY, 'JPY', displayCurrency) },
      totalSpentDisplay: convert(totalJPY, 'JPY', displayCurrency),
      breakdownStats: stats
    };
  }, [expenses, rates, displayCurrency, breakdownMode, todayDate]);

  const groupedExpenses = useMemo(() => {
    const filtered = expenses.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = selectedFilterDate ? e.date === selectedFilterDate : true;
      return matchSearch && matchDate;
    }).sort((a, b) => b.date.localeCompare(a.date));

    const groups: Record<string, ExpenseType[]> = {};
    filtered.forEach(e => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return groups;
  }, [expenses, searchTerm, selectedFilterDate]);

  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach(m => bal[m.id] = 0);
    expenses.forEach(exp => {
      const amountJPY = exp.amount * (rates[exp.currency] || 1);
      const shareJPY = amountJPY / (exp.splitWith.length || 1);
      exp.splitWith.forEach(uid => {
        if (exp.settledBy?.includes(uid)) return;
        if (uid !== exp.paidBy) {
          if (bal[uid] !== undefined) bal[uid] -= shareJPY;
          if (bal[exp.paidBy] !== undefined) bal[exp.paidBy] += shareJPY;
        }
      });
    });
    return bal;
  }, [expenses, rates, members]);

  const fetchRates = async () => {
    if (!process.env.API_KEY) return alert("Missing API Key");
    setLoadingRates(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currencies = activeCurrencies.filter(c => c !== 'JPY').join(', ');
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Exchange rates for 1 unit of [${currencies}] to JPY. Return JSON like {"HKD": 19.5}.`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || "{}");
      setRates(prev => ({ ...prev, ...data, JPY: 1 }));
      alert("Updated!");
    } catch (e) { alert("Failed to update rates"); }
    finally { setLoadingRates(false); }
  };

  const scrollToLog = () => logRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="space-y-6 pb-24 animate-in relative min-h-screen">
      <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl-sticker sticker-shadow border border-stitch/20 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-donald/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
           <div className="flex justify-between items-center mb-2">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30">Total Trip Spending</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setIsSearchVisible(!isSearchVisible)} className={`p-1.5 rounded-lg transition-colors ${isSearchVisible ? 'bg-stitch text-white' : 'bg-cream text-navy/40 hover:text-stitch'}`}>
                  <Search size={14} />
                </button>
                <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1 px-2 py-1 bg-cream rounded-lg text-[9px] font-black text-navy/40 hover:text-stitch transition-colors">
                  <Settings2 size={12} />
                </button>
              </div>
           </div>
           <div className="flex items-baseline gap-2 mb-4">
              <button onClick={() => setIsSettingsOpen(true)} className="text-2xl font-black text-stitch flex items-center gap-1">
                 {displayCurrency} <ChevronDown size={16} />
              </button>
              <h1 className="text-5xl font-black text-navy tracking-tight tabular-nums">
                 {Math.round(totalSpentDisplay).toLocaleString()}
              </h1>
           </div>
           <div onClick={() => { setSelectedFilterDate(selectedFilterDate === todayDate ? null : todayDate); scrollToLog(); }} className={`p-4 mb-6 border rounded-2xl flex justify-between items-center cursor-pointer transition-all ${selectedFilterDate === todayDate ? 'bg-stitch text-white border-stitch shadow-md' : 'bg-stitch/10 text-navy border-stitch/20'}`}>
             <div>
               <p className="text-[9px] font-black uppercase tracking-widest opacity-70">Today's Total</p>
               <h4 className="text-xl font-black tabular-nums">{displayCurrency} {Math.round(todayStats.total).toLocaleString()}</h4>
             </div>
             <div className="text-right">
               <span className="px-2 py-1 rounded-full text-[9px] font-black border bg-white/20 border-white/40">
                 {todayStats.count} RECORDS
               </span>
             </div>
           </div>
           <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className="bg-stitch text-white py-3.5 rounded-2xl-sticker font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 sticker-shadow active:scale-95 transition-all">
                 <Plus size={16} /> Record
              </button>
              <button onClick={() => setIsSettlementOpen(true)} className="bg-white text-navy border border-accent py-3.5 rounded-2xl-sticker font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 sticker-shadow active:scale-95 transition-all">
                 <Wallet size={16} /> Settlement
              </button>
           </div>
        </div>
      </div>

      {isSearchVisible && (
        <div className="slide-down">
          <div className="bg-white p-3 rounded-2xl border border-stitch/30 flex items-center gap-2">
            <Search size={16} className="text-stitch ml-1" />
            <input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search records..." className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold text-navy" />
            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={16} className="text-navy/20" /></button>}
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl-sticker sticker-shadow border border-accent/40 relative">
        <div className="flex justify-between items-center mb-4">
           <div className="flex gap-4">
              <button onClick={() => setBreakdownMode('category')} className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 ${breakdownMode === 'category' ? 'text-stitch' : 'text-navy/20'}`}>
                <PieChart size={12} /> Category
              </button>
              <button onClick={() => setBreakdownMode('daily')} className={`text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-1.5 ${breakdownMode === 'daily' ? 'text-stitch' : 'text-navy/20'}`}>
                <BarChart3 size={12} /> Daily
              </button>
           </div>
        </div>
        <div className="space-y-4">
          {breakdownStats.map((stat) => (
            <div key={stat.name} onClick={() => { if(breakdownMode === 'daily') { setSelectedFilterDate(selectedFilterDate === stat.name ? null : stat.name); scrollToLog(); }}} className={`relative group ${breakdownMode === 'daily' ? 'cursor-pointer' : ''}`}>
              <div className="flex justify-between items-end mb-1 z-10 relative">
                 <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : (selectedFilterDate === stat.name ? COLORS.stitch : '#E0E5D5') }} />
                    <span className={`text-xs font-black ${selectedFilterDate === stat.name ? 'text-stitch' : 'text-navy'}`}>{stat.name}</span>
                 </div>
                 <span className="text-xs font-black text-navy tabular-nums">{Math.round(stat.percent)}%</span>
              </div>
              <div className="w-full h-2.5 bg-cream rounded-full overflow-hidden">
                 <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stat.percent}%`, backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : (selectedFilterDate === stat.name ? COLORS.stitch : COLORS.stitch + '33') }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6 pt-2" ref={logRef}>
         <div className="flex justify-between items-center px-1">
            <h3 className="text-[11px] font-black text-navy/20 uppercase tracking-[0.3em] flex items-center gap-2">
               Activity Log {selectedFilterDate && <span className="text-stitch">/ {selectedFilterDate}</span>}
            </h3>
            {selectedFilterDate && (
               <button onClick={() => setSelectedFilterDate(null)} className="text-[9px] font-black text-stitch uppercase flex items-center gap-1">
                 <FilterX size={10} /> Clear
               </button>
            )}
         </div>
         {Object.entries(groupedExpenses).length > 0 ? Object.entries(groupedExpenses).map(([date, dateExpenses]) => (
            <div key={date} className="space-y-3">
               <div className="flex items-center gap-3 px-1">
                  <span className="text-[10px] font-black text-navy/40 uppercase tracking-widest flex items-center gap-1">
                    <Calendar size={10} /> {date}
                  </span>
                  <div className="h-px flex-1 bg-accent/30" />
               </div>
               {dateExpenses.map(exp => {
                 const payer = members.find(m => m.id === exp.paidBy);
                 const isExpanded = expandedId === exp.id;
                 const allSettled = exp.splitWith.length > 0 && exp.splitWith.every(id => exp.settledBy?.includes(id));
                 return (
                    <div key={exp.id} onClick={() => setExpandedId(isExpanded ? null : exp.id)} className={`relative rounded-2xl-sticker border transition-all overflow-hidden cursor-pointer ${isExpanded ? 'bg-white border-stitch shadow-lg z-10' : 'bg-white border-accent/40 sticker-shadow'}`}>
                       <div className="p-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-cream" style={{ color: getCategoryColor(exp.category) }}>
                             {exp.category === 'Food' || exp.category === 'Restaurant' ? '🍜' : 
                              exp.category === 'Transport' ? '🚕' : 
                              exp.category === 'Shopping' ? '🛍️' : 
                              exp.category === 'Stay' ? '🏨' : 
                              exp.category === 'Attraction' || exp.category === 'Ticket' ? '🎫' : '💸'}
                          </div>
                          <div className="flex-1 truncate">
                             <h4 className={`font-black text-sm truncate ${allSettled ? 'text-navy/40 line-through' : 'text-navy'}`}>{exp.title}</h4>
                             <p className="text-[10px] font-bold text-navy/40 uppercase">{payer?.name} Paid</p>
                          </div>
                          <div className="text-right">
                             <p className="font-black text-sm tabular-nums text-navy">{exp.currency} {exp.amount.toLocaleString()}</p>
                             <p className="text-[9px] font-bold text-navy/20 tabular-nums">≈ {displayCurrency} {Math.round(convert(exp.amount, exp.currency, displayCurrency)).toLocaleString()}</p>
                          </div>
                       </div>
                       {isExpanded && (
                          <div className="p-4 pt-0 bg-stitch/5 border-t border-stitch/10 animate-in">
                             <div className="bg-white rounded-xl border border-accent/40 p-3 mb-3 mt-3">
                                <p className="text-[9px] font-black uppercase text-navy/30 mb-2">Split Status</p>
                                <div className="space-y-2">
                                  {exp.splitWith.map(uid => {
                                     const m = members.find(mem => mem.id === uid);
                                     const isSettled = exp.settledBy?.includes(uid);
                                     return (
                                        <div key={uid} className={`flex items-center justify-between p-2 rounded-lg border ${isSettled ? 'bg-green-50 border-green-200' : 'bg-white border-accent'}`}>
                                           <div className="flex items-center gap-2">
                                              <img src={m?.avatar} className="w-5 h-5 rounded-full" />
                                              <span className={`text-[10px] font-black uppercase ${isSettled ? 'text-green-600' : 'text-navy'}`}>{m?.name}</span>
                                           </div>
                                           {isSettled && <Check size={12} className="text-green-600" />}
                                        </div>
                                     );
                                  })}
                                </div>
                             </div>
                             <div className="flex justify-end gap-2">
                                <button onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }} className="p-2 text-stitch border border-stitch/20 rounded-xl text-[10px] font-black px-4">EDIT</button>
                                <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete?')) setExpenses(expenses.filter(i => i.id !== exp.id)); }} className="p-2 text-red-400 border border-red-100 rounded-xl text-[10px] font-black px-4">DELETE</button>
                             </div>
                          </div>
                       )}
                    </div>
                 );
               })}
            </div>
         )) : (
            <div className="py-24 text-center opacity-20 border-2 border-dashed border-accent rounded-3xl">
               <Wallet size={48} className="mx-auto mb-3" />
               <p className="font-black uppercase text-[10px] tracking-widest">No matching records</p>
            </div>
         )}
      </div>

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

      {isSettingsOpen && (
         <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/20 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
            <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10 animate-in" onClick={e => e.stopPropagation()}>
               <div className="w-12 h-1 bg-accent rounded-full mx-auto mb-6 opacity-50" />
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-navy uppercase tracking-widest">Settings</h3>
                  <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream rounded-full"><X size={20} /></button>
               </div>
               <div className="mb-6">
                  <label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Display Currency</label>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                     {activeCurrencies.map(cur => (
                        <button key={cur} onClick={() => setDisplayCurrency(cur)} className={`flex-shrink-0 px-4 py-2 rounded-xl border-2 font-black text-xs ${displayCurrency === cur ? 'bg-navy border-navy text-white' : 'bg-white border-accent text-navy/40'}`}>{cur}</button>
                     ))}
                  </div>
               </div>
               <button onClick={fetchRates} disabled={loadingRates} className="w-full py-4 bg-navy text-white font-black rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2">
                  <RefreshCw size={16} className={loadingRates ? 'animate-spin' : ''} /> SYNC RATES
               </button>
            </div>
         </div>
      )}

      {isSettlementOpen && <SettlementModal balances={balances} displayCurrency={displayCurrency} convert={convert} members={members} onClose={() => setIsSettlementOpen(false)} />}
    </div>
  );
};

const SettlementModal: React.FC<{ balances: Record<string, number>, displayCurrency: string, convert: any, members: TripMember[], onClose: () => void }> = ({ balances, displayCurrency, convert, members, onClose }) => {
   const suggestions = useMemo(() => {
      const people = Object.entries(balances).map(([id, amount]) => ({ id, amount: amount as number }));
      const debtors = people.filter(p => p.amount < -1).sort((a, b) => a.amount - b.amount);
      const creditors = people.filter(p => p.amount > 1).sort((a, b) => b.amount - a.amount);
      const tx: any[] = [];
      let i = 0, j = 0;
      while (i < debtors.length && j < creditors.length) {
         const amount = Math.min(Math.abs(debtors[i].amount), creditors[j].amount);
         tx.push({ from: debtors[i].id, to: creditors[j].id, amount });
         debtors[i].amount += amount;
         creditors[j].amount -= amount;
         if (Math.abs(debtors[i].amount) < 1) i++;
         if (creditors[j].amount < 1) j++;
      }
      return tx;
   }, [balances]);

   return (
     <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-navy/5 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-paper w-full max-w-sm rounded-3xl p-6 sticker-shadow border-4 border-stitch/30 animate-in" onClick={e => e.stopPropagation()}>
           <h3 className="text-lg font-black text-navy uppercase tracking-widest mb-6">Settlement Plan</h3>
           <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {suggestions.map((t, idx) => (
                 <div key={idx} className="bg-white p-4 rounded-2xl border border-accent flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <img src={members.find(m => m.id === t.from)?.avatar} className="w-6 h-6 rounded-full" />
                       <ArrowRight size={14} className="text-navy/20" />
                       <img src={members.find(m => m.id === t.to)?.avatar} className="w-6 h-6 rounded-full" />
                    </div>
                    <p className="font-black text-navy text-sm">{displayCurrency} {Math.round(convert(t.amount, 'JPY', displayCurrency)).toLocaleString()}</p>
                 </div>
              ))}
              {suggestions.length === 0 && <p className="text-center py-10 font-black opacity-20 uppercase tracking-widest">All settled!</p>}
           </div>
        </div>
     </div>
   );
};

const ExpenseModal: React.FC<{ expense: ExpenseType | null; members: TripMember[]; currencies: string[]; onClose: () => void; onSave: (e: ExpenseType) => void }> = ({ expense, members, currencies, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ExpenseType>>(expense || { amount: 0, currency: currencies[0], category: 'Other', title: '', paidBy: members[0].id, splitWith: members.map(m => m.id), settledBy: [], date: new Date().toISOString().split('T')[0] });
  const categories = ['Food', 'Restaurant', 'Transport', 'Shopping', 'Stay', 'Ticket', 'Attraction', 'Other'];

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-cream/98 animate-in">
      <div className="p-4 flex justify-between items-center border-b border-accent bg-white/80">
        <button onClick={onClose} className="text-navy/20 p-2"><X size={24} /></button>
        <h3 className="text-lg font-black text-navy uppercase tracking-widest">{expense ? 'Edit' : 'New'} Record</h3>
        <button onClick={() => onSave({ ...formData, title: formData.title || formData.category } as ExpenseType)} className="text-stitch font-black p-2" disabled={!formData.amount}>SAVE</button>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-24">
         <div className="bg-white p-8 rounded-3xl-sticker border border-accent/30 text-center">
            <div className="flex items-center justify-center gap-2">
               <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="bg-transparent text-xl font-black text-stitch border-none">
                  {currencies.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
               <input type="number" value={formData.amount || ''} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} placeholder="0" className="w-full text-5xl font-black text-navy bg-transparent border-none text-center" autoFocus />
            </div>
         </div>
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30 space-y-4">
            <div><label className="text-[10px] font-black uppercase text-navy/20 mb-1 block"><Tag size={12} /> Name</label><input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Lunch" className="w-full font-black text-navy border-none p-0 text-xl" /></div>
            <div className="pt-4 border-t border-accent/10"><label className="text-[10px] font-black uppercase text-navy/20 mb-1 block"><Calendar size={12} /> Date</label><input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full font-bold text-navy bg-transparent border-none p-0" /></div>
         </div>
         <div><label className="text-[10px] font-black uppercase text-navy/20 mb-3 block tracking-widest px-1">Category</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{categories.map(cat => <button key={cat} onClick={() => setFormData({...formData, category: cat})} className={`px-4 py-2 rounded-2xl font-black text-xs uppercase border-2 ${formData.category === cat ? 'bg-navy border-navy text-white' : 'bg-white border-accent text-navy/30'}`}>{cat}</button>)}</div></div>
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30"><label className="text-[10px] font-black uppercase text-navy/20 mb-4 block tracking-widest">Paid By</label><div className="flex gap-4 overflow-x-auto pb-2">{members.map(m => <button key={m.id} onClick={() => setFormData({ ...formData, paidBy: m.id })} className={`flex-shrink-0 flex flex-col items-center gap-2 transition-all ${formData.paidBy === m.id ? 'opacity-100 scale-110' : 'opacity-40 grayscale'}`}><img src={m.avatar} className={`w-10 h-10 rounded-full border-2 ${formData.paidBy === m.id ? 'border-stitch' : 'border-transparent'}`} /><span className="text-[9px] font-black uppercase">{m.name}</span></button>)}</div></div>
         <div className="bg-white p-5 rounded-2xl-sticker border border-accent/30"><label className="text-[10px] font-black uppercase text-navy/20 mb-4 block tracking-widest">Split With</label><div className="grid grid-cols-2 gap-3">{members.map(m => { const isSelected = formData.splitWith?.includes(m.id); return <button key={m.id} onClick={() => { const current = formData.splitWith || []; const newSplit = isSelected ? current.filter(id => id !== m.id) : [...current, m.id]; setFormData({ ...formData, splitWith: newSplit }); }} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isSelected ? 'bg-stitch/10 border-stitch text-navy' : 'bg-white border-accent/40 text-navy/20'}`}><div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-stitch border-stitch' : 'border-accent'}`}>{isSelected && <Check size={12} className="text-white" />}</div><span className="text-[10px] font-black uppercase">{m.name}</span></button>; })}</div></div>
      </div>
    </div>
  );
};

export default Expense;
