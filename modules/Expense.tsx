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
  Search,
  CalendarDays,
  FileDown
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
    return saved ? JSON.parse(saved) : ['JPY', 'HKD', 'AUD', 'USD', 'EUR', 'TWD'];
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

  const handleExportCSV = () => {
    let csvContent = "\ufeff"; // BOM for Excel Chinese support
    csvContent += "--- 交易明細 Exported Records ---\n";
    csvContent += "日期 Date,名稱 Title,類別 Category,金額 Amount,幣別 Currency,付款人 Paid By,分帳成員 Split With,轉換後金額 (" + displayCurrency + ")\n";
    
    expenses.forEach(e => {
      const paidBy = members.find(m => m.id === e.paidBy)?.name || "Unknown";
      const splitWith = e.splitWith.map(uid => members.find(m => m.id === uid)?.name).join("; ");
      const converted = Math.round(convert(e.amount, e.currency, displayCurrency));
      csvContent += `${e.date},"${e.title}",${e.category},${e.amount},${e.currency},"${paidBy}","${splitWith}",${converted}\n`;
    });

    csvContent += "\n\n";
    csvContent += "--- 當前餘額 Balances (JPY) ---\n";
    csvContent += "成員 Member,餘額 Balance (JPY)\n";
    Object.entries(balances).forEach(([id, amount]) => {
      const name = members.find(m => m.id === id)?.name || "Unknown";
      csvContent += `"${name}",${Math.round(amount as number)}\n`;
    });

    csvContent += "\n";
    csvContent += "--- 結算建議 Settlement Roadmaps ---\n";
    csvContent += "付款人 From,收款人 To,金額 Amount (" + displayCurrency + ")\n";
    
    const people = Object.entries(balances).map(([id, amount]) => ({ id, amount: amount as number })); 
    const debtors = people.filter(p => p.amount < -1).sort((a, b) => a.amount - b.amount); 
    const creditors = people.filter(p => p.amount > 1).sort((a, b) => b.amount - a.amount); 
    
    let i = 0, j = 0; 
    const dTemp = debtors.map(d => ({ ...d }));
    const cTemp = creditors.map(c => ({ ...c }));
    while (i < dTemp.length && j < cTemp.length) { 
      const amountJPY = Math.min(Math.abs(dTemp[i].amount), cTemp[j].amount); 
      const amountDisplay = Math.round(convert(amountJPY, 'JPY', displayCurrency));
      const fromName = members.find(m => m.id === dTemp[i].id)?.name || "Unknown";
      const toName = members.find(m => m.id === cTemp[j].id)?.name || "Unknown";
      csvContent += `"${fromName}","${toName}",${amountDisplay}\n`;
      dTemp[i].amount += amountJPY; 
      cTemp[j].amount -= amountJPY; 
      if (Math.abs(dTemp[i].amount) < 1) i++; 
      if (cTemp[j].amount < 1) j++; 
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `OhanaTrip_Expense_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryColor = (cat: string) => {
    const map: Record<string, string> = { 'Food': COLORS.restaurant, 'Restaurant': COLORS.restaurant, 'Transport': COLORS.transport, 'Stay': COLORS.stay, 'Shopping': COLORS.shopping, 'Attraction': COLORS.attraction, 'Ticket': COLORS.attraction, 'Other': COLORS.other };
    return map[cat] || COLORS.other;
  };

  const todayDate = new Date().toISOString().split('T')[0];
  
  const statsResult = useMemo(() => {
    const todayExpenses = expenses.filter(e => e.date === todayDate);
    const todayTotalJPY = todayExpenses.reduce((sum, e) => sum + (e.amount * (rates[e.currency] || 1)), 0);
    const totalJPY = expenses.reduce((sum, e) => sum + (e.amount * (rates[e.currency] || 1)), 0);
    let stats: { name: string; value: number; percent: number }[] = [];
    if (breakdownMode === 'category') {
      const catMap: Record<string, number> = {};
      expenses.forEach(e => { 
        const val = convert(e.amount, e.currency, displayCurrency); 
        catMap[e.category] = (catMap[e.category] || 0) + val; 
      });
      stats = Object.entries(catMap).map(([name, value]) => ({ 
        name, 
        value, 
        percent: totalJPY > 0 ? (value / convert(totalJPY, 'JPY', displayCurrency)) * 100 : 0 
      })).sort((a, b) => b.value - a.value);
    } else {
      const dateMap: Record<string, number> = {};
      expenses.forEach(e => { 
        const val = convert(e.amount, e.currency, displayCurrency); 
        dateMap[e.date] = (dateMap[e.date] || 0) + val; 
      });
      stats = Object.entries(dateMap).map(([name, value]) => ({ 
        name, 
        value, 
        percent: totalJPY > 0 ? (value / convert(totalJPY, 'JPY', displayCurrency)) * 100 : 0 
      })).sort((a, b) => b.name.localeCompare(a.name));
    }
    return { 
      todayStats: { count: todayExpenses.length, total: convert(todayTotalJPY, 'JPY', displayCurrency) }, 
      totalSpentDisplay: convert(totalJPY, 'JPY', displayCurrency), 
      breakdownStats: stats 
    };
  }, [expenses, rates, displayCurrency, breakdownMode, todayDate]);

  const { todayStats, totalSpentDisplay, breakdownStats } = statsResult;

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

  const fetchRates = async () => {
    if (!process.env.API_KEY) return;
    setLoadingRates(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const currencies = activeCurrencies.filter(c => c !== 'JPY').join(', ');
      const response = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Rates for 1 unit of [${currencies}] to JPY. Return JSON like {"HKD": 19.5}.`, 
        config: { responseMimeType: "application/json" } 
      });
      const data = JSON.parse(response.text || "{}");
      setRates(prev => ({ ...prev, ...data, JPY: 1 }));
    } catch (e) { console.error(e); }
    finally { setLoadingRates(false); }
  };

  const handleDateFilter = (date: string) => {
    setSelectedFilterDate(selectedFilterDate === date ? null : date);
    setTimeout(() => logRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <div className="space-y-6 pb-24 animate-in relative min-h-screen">
      <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl-sticker sticker-shadow border border-stitch/20 relative overflow-hidden">
        <div className="relative z-10">
           <div className="flex justify-between items-center mb-2">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30">Total Spent</p>
             <div className="flex items-center gap-2">
               <button onClick={handleExportCSV} className="p-1.5 rounded-lg bg-cream text-navy/40 hover:bg-stitch hover:text-white transition-colors" title="Export CSV">
                 <FileDown size={14} />
               </button>
               <button onClick={() => setIsSearchVisible(!isSearchVisible)} className={`p-1.5 rounded-lg transition-colors ${isSearchVisible ? 'bg-stitch text-white' : 'bg-cream text-navy/40'}`}>
                 <Search size={14} />
               </button>
               <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-1 px-2 py-1 bg-cream rounded-lg text-[9px] font-black text-navy/40">
                 <Settings2 size={12} />
               </button>
             </div>
           </div>
           
           <div className="flex items-baseline gap-2 mb-4">
             <button onClick={() => setIsSettingsOpen(true)} className="text-2xl font-black text-stitch flex items-center gap-1">
               {displayCurrency} <ChevronDown size={16} />
             </button>
             <h1 className="text-5xl font-black text-navy tracking-tight">
               {Math.round(totalSpentDisplay).toLocaleString()}
             </h1>
           </div>

           <div onClick={() => handleDateFilter(todayDate)} className={`p-4 mb-6 border rounded-2xl flex justify-between items-center cursor-pointer transition-all active:scale-[0.98] ${selectedFilterDate === todayDate ? 'bg-stitch text-white sticker-shadow' : 'bg-stitch/10 text-navy'}`}>
             <div>
               <p className="text-[9px] font-black uppercase opacity-70">Today</p>
               <h4 className="text-xl font-black">{displayCurrency} {Math.round(todayStats.total).toLocaleString()}</h4>
             </div>
             <div className="text-right">
               <span className="px-2 py-1 rounded-full text-[9px] font-black border bg-white/20 uppercase">
                 {todayStats.count} Records
               </span>
             </div>
           </div>

           <div className="grid grid-cols-2 gap-3">
             <button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className="bg-stitch text-white py-3.5 rounded-2xl-sticker font-black text-xs uppercase flex items-center justify-center gap-2 sticker-shadow active:translate-y-0.5 transition-all">
               <Plus size={16} /> Record
             </button>
             <button onClick={() => setIsSettlementOpen(true)} className="bg-white text-navy border border-accent py-3.5 rounded-2xl-sticker font-black text-xs uppercase flex items-center justify-center gap-2 sticker-shadow active:translate-y-0.5 transition-all">
               <Wallet size={16} /> Settlement
             </button>
           </div>
        </div>
      </div>

      {isSearchVisible && (
        <div className="animate-in slide-in-from-top-2 duration-300">
          <div className="bg-white p-3 rounded-2xl border border-stitch/30 flex items-center gap-2 sticker-shadow">
            <Search size={16} className="text-stitch ml-1" />
            <input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search in log..." className="flex-1 bg-transparent border-none text-sm font-bold text-navy focus:ring-0" />
            {searchTerm && <button onClick={() => setSearchTerm('')}><X size={14} className="text-navy/20" /></button>}
          </div>
        </div>
      )}

      <div className="bg-white p-5 rounded-2xl-sticker sticker-shadow border border-accent/40">
        <div className="flex gap-4 mb-4">
          <button onClick={() => setBreakdownMode('category')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${breakdownMode === 'category' ? 'text-stitch underline underline-offset-4' : 'text-navy/20'}`}>Category</button>
          <button onClick={() => setBreakdownMode('daily')} className={`text-[10px] font-black uppercase tracking-[0.2em] transition-colors ${breakdownMode === 'daily' ? 'text-stitch underline underline-offset-4' : 'text-navy/20'}`}>By Date</button>
        </div>
        <div className="space-y-4">
          {breakdownStats.map((stat) => (
            <div key={stat.name} className={`relative group cursor-pointer transition-all ${breakdownMode === 'daily' ? 'hover:scale-[1.01]' : ''}`} onClick={() => breakdownMode === 'daily' && handleDateFilter(stat.name)}>
              <div className="flex justify-between items-end mb-1 z-10 relative">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : COLORS.stitch }} />
                  <span className={`text-xs font-black ${selectedFilterDate === stat.name ? 'text-stitch' : 'text-navy'}`}>{stat.name}</span>
                  {breakdownMode === 'daily' && stat.name === todayDate && <span className="text-[8px] font-black bg-stitch/10 text-stitch px-1 rounded">TODAY</span>}
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-navy/30 mr-2">{displayCurrency} {Math.round(stat.value).toLocaleString()}</span>
                  <span className="text-xs font-black">{Math.round(stat.percent)}%</span>
                </div>
              </div>
              <div className="w-full h-2.5 bg-cream rounded-full overflow-hidden border border-accent/10">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stat.percent}%`, backgroundColor: breakdownMode === 'category' ? getCategoryColor(stat.name) : COLORS.stitch, opacity: (selectedFilterDate && selectedFilterDate !== stat.name && breakdownMode === 'daily') ? 0.3 : 1 }} />
              </div>
            </div>
          ))}
          {breakdownStats.length === 0 && <p className="text-center py-4 text-xs font-bold text-navy/20 uppercase">No data to display</p>}
        </div>
      </div>

      <div className="space-y-6 pt-2" ref={logRef}>
        <div className="flex justify-between items-center px-1">
          <h3 className="text-[11px] font-black text-navy/20 uppercase tracking-[0.3em] flex items-center gap-2"><CalendarDays size={12} /> Activity Log {selectedFilterDate ? `(${selectedFilterDate})` : ''}</h3>
          {selectedFilterDate && <button onClick={() => setSelectedFilterDate(null)} className="text-[9px] font-black text-stitch border border-stitch px-2 py-0.5 rounded-full uppercase transition-colors hover:bg-stitch hover:text-white">View All</button>}
        </div>
        {Object.entries(groupedExpenses).length > 0 ? Object.entries(groupedExpenses).map(([date, dateExpenses]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-3 px-1">
              <span className={`text-[10px] font-black uppercase tracking-widest ${selectedFilterDate === date ? 'text-stitch' : 'text-navy/40'}`}>{date === todayDate ? 'Today' : date}</span>
              <div className={`h-px flex-1 ${selectedFilterDate === date ? 'bg-stitch/30' : 'bg-accent/30'}`} />
            </div>
            {dateExpenses.map(exp => {
              const isExpanded = expandedId === exp.id;
              const emoji = exp.category === 'Food' || exp.category === 'Restaurant' ? '🍜' : exp.category === 'Transport' ? '🚕' : exp.category === 'Stay' ? '🏨' : exp.category === 'Shopping' ? '🛍️' : exp.category === 'Attraction' ? '🎟️' : '💸';
              return (
                <div key={exp.id} onClick={() => setExpandedId(isExpanded ? null : exp.id)} className={`relative rounded-2xl-sticker border transition-all cursor-pointer overflow-hidden ${isExpanded ? 'bg-white border-stitch shadow-lg ring-1 ring-stitch/10 mb-4' : 'bg-white border-accent/40 sticker-shadow hover:border-stitch/30'}`}>
                  <div className="p-4 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-colors ${isExpanded ? 'bg-stitch/10' : 'bg-cream'}`}>{emoji}</div>
                    <div className="flex-1 truncate">
                      <h4 className="font-black text-sm truncate text-navy">{exp.title}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5"><span className="text-[9px] font-bold text-navy/30 uppercase">{exp.category}</span><span className="text-[9px] text-navy/20">•</span><span className="text-[9px] font-bold text-navy/30 uppercase">Paid by {members.find(m => m.id === exp.paidBy)?.name}</span></div>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-sm text-navy">{exp.currency} {exp.amount.toLocaleString()}</p>
                      {exp.currency !== displayCurrency && <p className="text-[9px] font-bold text-navy/30 mt-0.5">≈ {displayCurrency} {Math.round(convert(exp.amount, exp.currency, displayCurrency)).toLocaleString()}</p>}
                    </div>
                  </div>
                  <div className={`transition-all duration-300 overflow-hidden ${isExpanded ? 'max-h-40 border-t border-stitch/10' : 'max-h-0'}`}>
                    <div className="p-4 pt-3 flex justify-between items-center bg-stitch/5">
                      <div className="flex gap-1">{exp.splitWith.map(uid => <img key={uid} src={members.find(m => m.id === uid)?.avatar} className="w-5 h-5 rounded-full border border-white shadow-sm" title={members.find(m => m.id === uid)?.name} />)}</div>
                      <div className="flex gap-2">
                        <button onClick={(e) => { e.stopPropagation(); setEditingExpense(exp); setIsModalOpen(true); }} className="flex items-center gap-1 px-3 py-1 bg-white rounded-lg text-[10px] font-black text-stitch border border-stitch/20 hover:bg-stitch hover:text-white transition-all"><Edit2 size={10} /> EDIT</button>
                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete this record?')) { setExpenses(expenses.filter(i => i.id !== exp.id)); setExpandedId(null); } }} className="flex items-center gap-1 px-3 py-1 bg-white rounded-lg text-[10px] font-black text-red-400 border border-red-100 hover:bg-red-400 hover:text-white transition-all"><Trash2 size={10} /> DELETE</button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )) : <div className="py-24 text-center opacity-20 border-2 border-dashed border-accent rounded-3xl bg-paper/50 mt-2"><p className="font-black uppercase text-[10px] tracking-widest">No expenses found</p></div>}
      </div>

      {isModalOpen && <ExpenseModal expense={editingExpense} members={members} currencies={activeCurrencies} onClose={() => setIsModalOpen(false)} onSave={(e) => { if (editingExpense) setExpenses(expenses.map(ex => ex.id === e.id ? e : ex)); else setExpenses([{ ...e, id: Date.now().toString() }, ...expenses]); setIsModalOpen(false); }} />}
      
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-navy/20 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 border-4 border-navy sticker-shadow animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-navy uppercase tracking-widest">Settings</h3><button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-cream rounded-full"><X size={20} /></button></div>
            <div className="space-y-6">
              <div><label className="text-[10px] font-black uppercase text-navy/30 mb-3 block tracking-widest">Display Currency</label><div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">{activeCurrencies.map(cur => <button key={cur} onClick={() => setDisplayCurrency(cur)} className={`px-5 py-2.5 rounded-xl border-2 font-black text-xs transition-all ${displayCurrency === cur ? 'bg-navy border-navy text-white sticker-shadow scale-105' : 'bg-white border-accent text-navy/30'}`}>{cur}</button>)}</div></div>
              <button onClick={fetchRates} disabled={loadingRates} className="w-full py-4 bg-navy text-white font-black rounded-2xl-sticker uppercase text-xs tracking-widest flex items-center justify-center gap-2 sticker-shadow active:translate-y-0.5 transition-all disabled:opacity-50"><RefreshCw size={16} className={loadingRates ? 'animate-spin' : ''} /> {loadingRates ? 'SYNCING...' : 'SYNC EXCHANGE RATES'}</button>
              <p className="text-[9px] font-bold text-navy/20 text-center uppercase">Rates powered by Gemini AI</p>
            </div>
          </div>
        </div>
      )}

      {isSettlementOpen && <SettlementModal balances={balances} displayCurrency={displayCurrency} convert={convert} members={members} onClose={() => setIsSettlementOpen(false)} />}
    </div>
  );
};

const SettlementModal: React.FC<{ balances: Record<string, number>, displayCurrency: string, convert: any, members: TripMember[], onClose: () => void }> = ({ balances, displayCurrency, convert, members, onClose }) => {
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
       <div className="bg-paper w-full max-w-sm rounded-3xl p-6 border-4 border-stitch/30 sticker-shadow animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
         <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-navy uppercase tracking-widest">Settlement</h3><button onClick={onClose} className="p-2 bg-cream rounded-full text-navy/20"><X size={18} /></button></div>
         <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 scrollbar-hide">
           {suggestions.length > 0 ? suggestions.map((t, idx) => (
             <div key={idx} className="bg-white p-4 rounded-2xl border border-accent flex items-center justify-between hover:border-stitch/30 transition-colors">
               <div className="flex items-center gap-2">
                 <div className="relative"><img src={members.find(m => m.id === t.from)?.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm" /><div className="absolute -bottom-1 -right-1 bg-red-400 w-3 h-3 rounded-full border border-white" /></div>
                 <ArrowRight size={14} className="text-navy/20 mx-1" />
                 <div className="relative"><img src={members.find(m => m.id === t.to)?.avatar} className="w-8 h-8 rounded-full border border-white shadow-sm" /><div className="absolute -bottom-1 -right-1 bg-green-400 w-3 h-3 rounded-full border border-white" /></div>
               </div>
               <div className="text-right">
                 <p className="font-black text-navy text-sm tabular-nums">{displayCurrency} {Math.round(convert(t.amount, 'JPY', displayCurrency)).toLocaleString()}</p>
                 <p className="text-[9px] font-bold text-navy/30 uppercase">{members.find(m => m.id === t.from)?.name} → {members.find(m => m.id === t.to)?.name}</p>
               </div>
             </div>
           )) : <p className="text-center py-10 text-xs font-black text-navy/20 uppercase tracking-widest">All Ohana settled up! 🤙</p>}
         </div>
       </div>
     </div>
   );
};

const ExpenseModal: React.FC<{ expense: ExpenseType | null; members: TripMember[]; currencies: string[]; onClose: () => void; onSave: (e: ExpenseType) => void }> = ({ expense, members, currencies, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ExpenseType>>(expense || { amount: 0, currency: currencies[0], category: 'Other', title: '', paidBy: members[0].id, splitWith: members.map(m => m.id), settledBy: [], date: new Date().toISOString().split('T')[0] });
  const categories = ['Food', 'Transport', 'Stay', 'Shopping', 'Attraction', 'Other'];
  const toggleSplit = (uid: string) => {
    const current = formData.splitWith || [];
    if (current.includes(uid)) { if (current.length > 1) setFormData({ ...formData, splitWith: current.filter(id => id !== uid) }); }
    else { setFormData({ ...formData, splitWith: [...current, uid] }); }
  };
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-navy/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-paper w-full max-w-md rounded-3xl p-6 sticker-shadow border-t-4 border-stitch animate-in zoom-in-95 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6"><h3 className="text-lg font-black text-navy uppercase tracking-widest">{expense ? 'Edit Record' : 'New Expense'}</h3><button onClick={onClose} className="p-2 bg-cream rounded-full"><X size={20} /></button></div>
        <div className="space-y-5">
          <div className="flex gap-2">
            <div className="flex-1 bg-cream rounded-2xl border border-accent p-4 flex items-baseline gap-2 sticker-shadow"><span className="text-xs font-black text-navy/30">{formData.currency}</span><input type="number" value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full bg-transparent border-none p-0 font-black text-3xl text-navy focus:ring-0" /></div>
            <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="p-4 bg-white border border-accent rounded-2xl font-black text-sm sticker-shadow outline-none focus:border-stitch">{currencies.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <div className="bg-cream rounded-2xl border border-accent p-4 sticker-shadow"><label className="text-[9px] font-black uppercase text-navy/30 mb-1 block tracking-wider">Title</label><input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Ichiran Ramen" className="w-full bg-transparent border-none p-0 font-bold text-navy text-lg focus:ring-0" /></div>
          <div className="grid grid-cols-2 gap-3"><div className="bg-white p-3 border border-accent rounded-xl"><label className="text-[9px] font-black uppercase text-navy/30 mb-1 block">Date</label><input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="w-full bg-transparent border-none p-0 font-bold text-xs text-navy" /></div><div className="bg-white p-3 border border-accent rounded-xl"><label className="text-[9px] font-black uppercase text-navy/30 mb-1 block">Category</label><select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full bg-transparent border-none p-0 font-bold text-xs text-navy outline-none">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
          <div><label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Paid By</label><div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">{members.map(m => <button key={m.id} onClick={() => setFormData({ ...formData, paidBy: m.id })} className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${formData.paidBy === m.id ? 'bg-navy text-white border-navy sticker-shadow scale-105' : 'bg-white border-accent text-navy/40'}`}><img src={m.avatar} className="w-5 h-5 rounded-full border border-white/20" /><span className="text-[9px] font-black uppercase">{m.name}</span></button>)}</div></div>
          <div><label className="text-[10px] font-black uppercase text-navy/30 mb-2 block tracking-widest">Split With</label><div className="flex flex-wrap gap-2">{members.map(m => { const isSelected = formData.splitWith?.includes(m.id); return (<button key={m.id} onClick={() => toggleSplit(m.id)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isSelected ? 'bg-stitch/10 border-stitch text-stitch font-black' : 'bg-white border-accent text-navy/30'}`}><div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-stitch' : 'bg-accent'}`} /><span className="text-[9px] uppercase">{m.name}</span></button>); })}</div></div>
          <button onClick={() => onSave(formData as ExpenseType)} disabled={!formData.title || !formData.amount} className="w-full py-4 bg-stitch text-white font-black rounded-2xl-sticker uppercase text-xs tracking-[0.2em] mt-2 sticker-shadow active:translate-y-0.5 transition-all disabled:opacity-30">{expense ? 'UPDATE RECORD' : 'SAVE EXPENSE'}</button>
        </div>
      </div>
    </div>
  );
};

export default Expense;
