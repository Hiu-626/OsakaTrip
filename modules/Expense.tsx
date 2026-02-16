
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TripMember, Expense as ExpenseType } from '../types.ts';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  RefreshCw, 
  Settings2, 
  ArrowRight,
  Wallet,
  ChevronDown,
  Search
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { COLORS } from '../constants.ts';

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
    const map: Record<string, string> = { 'Food': COLORS.restaurant, 'Restaurant': COLORS.restaurant, 'Transport': COLORS.transport, 'Stay': COLORS.stay, 'Shopping': COLORS.shopping, 'Attraction': COLORS.attraction, 'Ticket': COLORS.attraction, 'Other': COLORS.other };
    return map[cat] || COLORS.other;
  };

  const todayDate = new Date().toISOString().split('T')[0];
  
  // Fix: Explicitly type useMemo return to avoid 'unknown' inference for breakdownStats and resolve map() error.
  const { todayStats, totalSpentDisplay, breakdownStats } = useMemo<{
    todayStats: { count: number; total: number };
    totalSpentDisplay: number;
    breakdownStats: any[];
  }>(() => {
    const todayExpenses = expenses.filter(e => e.date === todayDate);
    const todayTotalJPY = todayExpenses.reduce((sum, e) => sum + (e.amount * (rates[e.currency] || 1)), 0);
    const totalJPY = expenses.reduce((sum, e) => sum + (e.amount * (rates[e.currency] || 1)), 0);
    let stats: any[] = [];
    if (breakdownMode === 'category') {
      const catMap: Record<string, number> = {};
      expenses.forEach(e => { const val = convert(e.amount, e.currency, displayCurrency); catMap[e.category] = (catMap[e.category] || 0) + val; });
      stats = Object.entries(catMap).map(([name, value]) => ({ name, value, percent: totalJPY > 0 ? (value / convert(totalJPY, 'JPY', displayCurrency)) * 100 : 0 })).sort((a, b) => b.value - a.value);
    } else {
      const dateMap: Record<string, number> = {};
      expenses.forEach(e => { const val = convert(e.amount, e.currency, displayCurrency); dateMap[e.date] = (dateMap[e.date] || 0) + val; });
      stats = Object.entries(dateMap).map(([name, value]) => ({ name, value, percent: totalJPY > 0 ? (value / convert(totalJPY, 'JPY', displayCurrency)) * 100 : 0 })).sort((a, b) => b.name.localeCompare(a.name));
    }
    return { todayStats: { count: todayExpenses.length, total: convert(todayTotalJPY, 'JPY', displayCurrency) }, totalSpentDisplay: convert(totalJPY, 'JPY', displayCurrency), breakdownStats: stats };
  }, [expenses, rates, displayCurrency, breakdownMode, todayDate]);

  const groupedExpenses = useMemo(() => {
    const filtered = expenses.filter(e => {
      const matchSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) || e.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchDate = selectedFilterDate ? e.date === selectedFilterDate : true;
      return matchSearch && matchDate;
    }).sort((a, b) => b.date.localeCompare(a.date));
    const groups: Record<string, ExpenseType[]> = {};
    filtered.forEach(e => { if (!groups[e.date]) groups[e.date] = []; groups[e.date].push(e); });
    return groups;
  }, [expenses, searchTerm, selectedFilterDate]);

  const balances = useMemo(() => {
    const bal: Record<string, number> = {};
    members.forEach(m => bal[m.id] = 0);
    expenses.forEach(exp => {
      const amountJPY = exp.amount * (rates[exp.currency] || 1);
      const shareJPY = amountJPY / (exp.splitWith.length || 1);
      exp.splitWith.forEach(uid => { if (exp.settledBy?.includes(uid)) return; if (uid !== exp.paidBy) { if (bal[uid] !== undefined) bal[uid] -= shareJPY; if (bal[exp.paidBy] !== undefined) bal[exp.paidBy] += shareJPY; } });
    });
    return bal;
  }, [expenses, rates, members]);

  const fetchRates = async () => {
    if (!process.env.API_KEY) return;
    setLoadingRates(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currencies = activeCurrencies.filter(c => c !== 'JPY').join(', ');
      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: `Rates for 1 unit of [${currencies}] to JPY. Return JSON like {"HKD": 19.5}.`, config: { responseMimeType: "application/json" } });
      const data = JSON.parse(response.text || "{}");
      setRates(prev => ({ ...prev, ...data, JPY: 1 }));
    } catch (e) { console.error(e); }
    finally { setLoadingRates(false); }
  };
  const scrollToLog = () => logRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="space-y-6 pb-24 animate-in relative min-h-screen">
      <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl-sticker sticker-shadow border border-stitch/20 relative overflow-hidden">
        <div className="relative z-10">
           <div className="flex justify-between items-center mb-2"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30">Total Spent</p><div className="flex items-center gap-2"><button onClick={() => setIsSearchVisible(!isSearchVisible)} className={`p-1.5 rounded-lg ${isSearchVisible ? 'bg-stitch text-white' : 'bg-cream text-navy/40'}`}><Search size={14} /></button><button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1 px-2 py-1 bg-cream rounded-lg text-[9px] font-black text-navy/40"><Settings2 size={12} /></button></div></div>
           <div className="flex items-baseline gap-2 mb-4"><button onClick={() => setIsSettingsOpen(true)} className="text-2xl font-black text-stitch flex items-center gap-1">{displayCurrency} <ChevronDown size={16} /></button><h1 className="text-5xl font-black text-navy tracking-tight">{Math.round(totalSpentDisplay).toLocaleString()}</h1></div>
           <div onClick={() => { setSelectedFilterDate(selectedFilterDate === todayDate ? null : todayDate); scrollToLog(); }} className={`p-4 mb-6 border rounded-2xl flex justify-between items-center cursor-pointer ${selectedFilterDate === todayDate ? 'bg-stitch text-white' : 'bg-stitch/10 text-navy'}`}><div><p className="text-[9px] font-black uppercase opacity-70">Today</p><h4 className="text-xl font-black">{displayCurrency} {Math.round(todayStats.total).toLocaleString()}</h4></div><div className="text-right"><span className="px-2 py-1 rounded-full text-[9px] font-black border bg-white/20">{todayStats.count} RECORDS</span></div></div>
           <div className="grid grid-cols-2 gap-3"><button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className="bg-stitch text-white py-3.5 rounded-2xl-sticker font-black text-xs uppercase flex items-center justify-center gap-2 sticker-shadow"><Plus size={16} /> Record</button><button onClick={() => setIsSettlementOpen(true)} className="bg-white text-navy border border-accent py-3.5 rounded-2xl-sticker font-black text-xs uppercase flex items-center justify-center gap-2 sticker-shadow"><Wallet size={16} /> Settlement</button></div>
        </div>
      </div>
      {isSearchVisible && <div className="slide-down"><div className="bg-white p-3 rounded-2xl border border-stitch/30 flex items-center gap-2"><Search size={16} className="text-stitch ml-1" /><input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." className="flex-1 bg-transparent border-none text-sm font-bold text-navy" /></div></div>}
      <div className="bg-white p-5 rounded-2xl-sticker sticker-shadow border border-accent/40"><div className="flex gap-4 mb-4"><button onClick={() => setBreakdownMode('category')} className={`text-[10px] font-black uppercase tracking-[0.2em] ${breakdownMode === 'category' ? 'text-stitch' : 'text-navy/20'}`}>Category</button><button onClick={() => setBreakdownMode('daily')} className={`text-[10px] font-black uppercase tracking-[0.2em] ${breakdownMode === 'daily' ? 'text-stitch' : 'text-navy/20'}`}>Daily</button></div><div className="space-y-4">{breakdownStats.map((stat: any) => <div key={stat.name} className="relative group"><div className="flex justify-between items-end mb-1 z-10 relative"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : COLORS.stitch }} /><span className="text-xs font-black">{stat.name}</span></div><span className="text-xs font-black">{Math.round(stat.percent)}%</span></div><div className="w-full h-2.5 bg-cream rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${stat.percent}%`, backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : COLORS.stitch }} /></div></div>)}</div></div>
      <div className="space-y-6 pt-2" ref={logRef}><div className="flex justify-between items-center px-1"><h3 className="text-[11px] font-black text-navy/20 uppercase tracking-[0.3em]">Log</h3>{selectedFilterDate && <button onClick={() => setSelectedFilterDate(null)} className="text-[9px] font-black text-stitch uppercase">Clear</button>}</div>{Object.entries(groupedExpenses).map(([date, dateExpenses]) => <div key={date} className="space-y-3"><div className="flex items-center gap-3 px-1"><span className="text-[10px] font-black text-navy/40 uppercase tracking-widest">{date}</span><div className="h-px flex-1 bg-accent/30" /></div>{dateExpenses.map(exp => { const isExpanded = expandedId === exp.id; return <div key={exp.id} onClick={() => setExpandedId(isExpanded ? null : exp.id)} className={`relative rounded-2xl-sticker border transition-all cursor-pointer ${isExpanded ? 'bg-white border-stitch shadow-lg' : 'bg-white border-accent/40 sticker-shadow'}`}><div className="p-4 flex items-center gap-4"><div className="w-10 h-10 rounded-full flex items-center justify-center text-lg bg-cream">{exp.category === 'Food' ? '🍜' : exp.category === 'Transport' ? '🚕' : '💸'}</div><div className="flex-1 truncate"><h4 className="font-black text-sm truncate">{exp.title}</h4></div><div className="text-right"><p className="font-black text-sm text-navy">{exp.currency} {exp.amount}</p></div></div>{isExpanded && <div className="p-4 pt-0 border-t border-stitch/10"><div className="flex justify-end gap-2 mt-3"><button onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }} className="p-2 text-stitch text-[10px] font-black">EDIT</button><button onClick={(e) => { e.stopPropagation(); setExpenses(expenses.filter(i => i.id !== exp.id)); }} className="p-2 text-red-400 text-[10px] font-black">DELETE</button></div></div>}</div>; })}</div>)}</div>
      {isModalOpen && <ExpenseModal expense={editingExpense} members={members} currencies={activeCurrencies} onClose={() => setIsModalOpen(false)} onSave={(e) => { if (editingExpense) setExpenses(expenses.map(ex => ex.id === e.id ? e : ex)); else setExpenses([{ ...e, id: Date.now().toString() }, ...expenses]); setIsModalOpen(false); }} />}
      {isSettingsOpen && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-navy/20 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}><div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10" onClick={e => e.stopPropagation()}><div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-navy uppercase">Settings</h3><button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream rounded-full"><X size={20} /></button></div><div className="mb-6"><label className="text-[10px] font-black uppercase text-navy/30 mb-2 block">Display Currency</label><div className="flex gap-2 overflow-x-auto pb-2">{activeCurrencies.map(cur => <button key={cur} onClick={() => setDisplayCurrency(cur)} className={`px-4 py-2 rounded-xl border-2 font-black text-xs ${displayCurrency === cur ? 'bg-navy border-navy text-white' : 'bg-white border-accent'}`}>{cur}</button>)}</div></div><button onClick={fetchRates} disabled={loadingRates} className="w-full py-4 bg-navy text-white font-black rounded-2xl uppercase text-xs tracking-widest flex items-center justify-center gap-2"><RefreshCw size={16} className={loadingRates ? 'animate-spin' : ''} /> SYNC RATES</button></div></div>}
      {isSettlementOpen && <SettlementModal balances={balances} displayCurrency={displayCurrency} convert={convert} members={members} onClose={() => setIsSettlementOpen(false)} />}
    </div>
  );
};

const SettlementModal: React.FC<{ balances: Record<string, number>, displayCurrency: string, convert: any, members: TripMember[], onClose: () => void }> = ({ balances, displayCurrency, convert, members, onClose }) => {
   // Fix: Explicitly type suggestions as any[] to avoid 'unknown' inference and fix map() error.
   const suggestions = useMemo<any[]>(() => { 
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
       <div className="bg-paper w-full max-sm rounded-3xl p-6 border-4 border-stitch/30" onClick={e => e.stopPropagation()}>
         <h3 className="text-lg font-black text-navy uppercase tracking-widest mb-6">Settlement</h3>
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
    date: new Date().toISOString().split('T')[0] 
  });
  const categories = ['Food', 'Transport', 'Stay', 'Shopping', 'Attraction', 'Other'];

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-navy/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-paper w-full max-md rounded-t-3xl p-6 sticker-shadow border-t-4 border-stitch animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-black text-navy uppercase">{expense ? 'Edit Record' : 'New Record'}</h3>
          <button onClick={onClose} className="p-2 bg-cream rounded-full"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="number" value={formData.amount} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} placeholder="0" className="flex-1 p-4 bg-cream rounded-2xl font-black text-2xl border border-accent" />
            <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="p-4 bg-white border border-accent rounded-2xl font-black">{currencies.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="What for? e.g. Sushi" className="w-full p-4 bg-cream rounded-2xl font-bold border border-accent" />
          <div className="grid grid-cols-2 gap-3">
             <div><label className="text-[10px] font-black uppercase text-navy/30 mb-1 block">Date</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full p-3 bg-white border border-accent rounded-xl font-bold text-xs" /></div>
             <div><label className="text-[10px] font-black uppercase text-navy/30 mb-1 block">Category</label><select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full p-3 bg-white border border-accent rounded-xl font-bold text-xs">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-navy/30 mb-1 block">Paid By</label>
            <div className="flex gap-2 overflow-x-auto pb-1">{members.map(m => <button key={m.id} onClick={() => setFormData({ ...formData, paidBy: m.id })} className={`flex-shrink-0 flex items-center gap-2 p-2 rounded-full border transition-all ${formData.paidBy === m.id ? 'bg-navy text-white border-navy' : 'bg-white border-accent text-navy/40'}`}><img src={m.avatar} className="w-5 h-5 rounded-full" /><span className="text-[10px] font-black uppercase pr-1">{m.name}</span></button>)}</div>
          </div>
          <button onClick={() => onSave(formData as ExpenseType)} disabled={!formData.title || !formData.amount} className="w-full py-4 bg-stitch text-white font-black rounded-2xl uppercase text-xs tracking-widest mt-4">SAVE</button>
        </div>
      </div>
    </div>
  );
};

export default Expense;
