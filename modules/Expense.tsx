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
  FileDown,
  FileUp,
  Download,
  CheckCircle2,
  AlertCircle,
  Zap,
  Layers,
  FileText,
  Split,
  Check,
  Globe
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { COLORS } from '../constants.ts';

const FAST_PRESETS = [
  { emoji: '🍜', title: '早餐', category: 'Food', amount: 800 },
  { emoji: '🍱', title: '午餐', category: 'Food', amount: 1500 },
  { emoji: '🍲', title: '晚餐', category: 'Food', amount: 3000 },
  { emoji: '🍢', title: '居酒屋', category: 'Food', amount: 4500 },
  { emoji: '🚇', title: '地鐵/交通', category: 'Transport', amount: 220 },
  { emoji: '🚕', title: '的士/計程車', category: 'Transport', amount: 1800 },
  { emoji: '🏪', title: '超商便利店', category: 'Food', amount: 650 },
  { emoji: '☕', title: '咖啡飲料', category: 'Food', amount: 450 },
  { emoji: '🛍️', title: '藥妝免稅', category: 'Shopping', amount: 5000 },
  { emoji: '🎟️', title: '景點門票', category: 'Attraction', amount: 2000 },
  { emoji: '🏨', title: '飯店住宿', category: 'Stay', amount: 12000 }
];

interface ExpenseProps {
  currentUser: TripMember;
  members: TripMember[];
  onOpenFullExport?: () => void;
}

const Expense: React.FC<ExpenseProps> = ({ currentUser, members, onOpenFullExport }) => {
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
  const [showExportMenu, setShowExportMenu] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Quick preset click handler
  const handleQuickPresetClick = (preset: typeof FAST_PRESETS[0]) => {
    setEditingExpense({
      id: '',
      title: preset.title,
      category: preset.category,
      amount: preset.amount,
      currency: activeCurrencies[0] || 'JPY',
      paidBy: currentUser.id || members[0].id,
      splitWith: members.map(m => m.id),
      settledBy: [],
      date: new Date().toISOString().split('T')[0]
    });
    setIsModalOpen(true);
  };

  // CSV Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importedPreview, setImportedPreview] = useState<{ fileName: string; items: ExpenseType[] } | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importToast, setImportToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Robust RFC 4180 CSV Parser
  const parseCSVText = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuote = false;
    // Strip BOM
    const clean = text.replace(/^\uFEFF/, '');

    for (let i = 0; i < clean.length; i++) {
      const ch = clean[i];
      const nextCh = clean[i + 1];

      if (ch === '"') {
        if (insideQuote && nextCh === '"') {
          currentCell += '"';
          i++;
        } else {
          insideQuote = !insideQuote;
        }
      } else if (ch === ',' && !insideQuote) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if ((ch === '\r' || ch === '\n') && !insideQuote) {
        if (ch === '\r' && nextCh === '\n') i++;
        currentRow.push(currentCell.trim());
        if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }

    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell.trim());
      if (currentRow.some(c => c !== '')) {
        rows.push(currentRow);
      }
    }

    return rows;
  };

  const processCSVContent = (content: string, fileName: string) => {
    try {
      const rows = parseCSVText(content);
      if (!rows || rows.length === 0) {
        alert("無法讀取 CSV 內容或檔案為空。");
        return;
      }

      // Identify header row
      let headerIdx = -1;
      let colDate = -1;
      let colTitle = -1;
      let colCategory = -1;
      let colAmount = -1;
      let colCurrency = -1;
      let colPaidBy = -1;
      let colSplitWith = -1;

      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i].map(c => c.toLowerCase());
        const hasDate = row.some(c => c.includes('date') || c.includes('日期'));
        const hasAmount = row.some(c => c.includes('amount') || c.includes('金額') || c.includes('價錢') || c.includes('費用'));
        const hasTitle = row.some(c => c.includes('title') || c.includes('名稱') || c.includes('項目') || c.includes('item'));

        if ((hasDate && hasAmount) || (hasDate && hasTitle) || (hasTitle && hasAmount)) {
          headerIdx = i;
          rows[i].forEach((col, idx) => {
            const lower = col.toLowerCase();
            if (lower.includes('date') || lower.includes('日期')) colDate = idx;
            else if (lower.includes('title') || lower.includes('名稱') || lower.includes('項目') || lower.includes('item') || lower.includes('desc')) colTitle = idx;
            else if (lower.includes('category') || lower.includes('類別') || lower.includes('分類')) colCategory = idx;
            else if (lower.includes('amount') || lower.includes('金額') || lower.includes('費用') || lower.includes('價錢') || lower.includes('cost')) colAmount = idx;
            else if (lower.includes('currency') || lower.includes('幣別') || lower.includes('貨幣')) colCurrency = idx;
            else if (lower.includes('paid') || lower.includes('付款')) colPaidBy = idx;
            else if (lower.includes('split') || lower.includes('分帳') || lower.includes('分攤')) colSplitWith = idx;
          });
          break;
        }
      }

      // Default fallback column mapping if header wasn't detected
      if (headerIdx === -1) {
        const firstRow = rows[0].map(c => c.toLowerCase());
        if (firstRow[0]?.includes('---')) {
          headerIdx = 1;
        } else {
          headerIdx = 0;
        }
        colDate = 0;
        colTitle = 1;
        colCategory = 2;
        colAmount = 3;
        colCurrency = 4;
        colPaidBy = 5;
        colSplitWith = 6;
      }

      const parsed: ExpenseType[] = [];
      const startRow = headerIdx + 1;

      for (let i = startRow; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || (row.length === 1 && !row[0])) continue;

        // Stop if reaching exported balances or settlement sections
        const firstCell = (row[0] || '').trim();
        if (firstCell.startsWith('---') || firstCell.includes('Balances') || firstCell.includes('餘額') || firstCell.includes('Settlement') || firstCell.includes('結算')) {
          break;
        }

        const rawDate = (colDate >= 0 && row[colDate]) ? row[colDate].trim() : '';
        const rawTitle = (colTitle >= 0 && row[colTitle]) ? row[colTitle].trim() : '';
        const rawCat = (colCategory >= 0 && row[colCategory]) ? row[colCategory].trim() : '';
        const rawAmount = (colAmount >= 0 && row[colAmount]) ? row[colAmount].trim() : '';
        const rawCur = (colCurrency >= 0 && row[colCurrency]) ? row[colCurrency].trim() : '';
        const rawPaidBy = (colPaidBy >= 0 && row[colPaidBy]) ? row[colPaidBy].trim() : '';
        const rawSplitWith = (colSplitWith >= 0 && row[colSplitWith]) ? row[colSplitWith].trim() : '';

        // Clean amount
        const cleanAmount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, ''));
        if (isNaN(cleanAmount) || cleanAmount <= 0) {
          continue;
        }

        // Clean date
        let dateVal = new Date().toISOString().split('T')[0];
        const dateMatch = rawDate.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        if (dateMatch) {
          const y = dateMatch[1];
          const m = dateMatch[2].padStart(2, '0');
          const d = dateMatch[3].padStart(2, '0');
          dateVal = `${y}-${m}-${d}`;
        }

        // Clean category
        let category: any = 'Other';
        const catLower = rawCat.toLowerCase();
        if (catLower.includes('food') || catLower.includes('rest') || catLower.includes('餐') || catLower.includes('食') || catLower.includes('吃')) {
          category = 'Food';
        } else if (catLower.includes('trans') || catLower.includes('交') || catLower.includes('車') || catLower.includes('機票') || catLower.includes('鐵')) {
          category = 'Transport';
        } else if (catLower.includes('stay') || catLower.includes('hotel') || catLower.includes('住') || catLower.includes('宿') || catLower.includes('房')) {
          category = 'Stay';
        } else if (catLower.includes('shop') || catLower.includes('購') || catLower.includes('買')) {
          category = 'Shopping';
        } else if (catLower.includes('attr') || catLower.includes('ticket') || catLower.includes('門票') || catLower.includes('景點')) {
          category = 'Attraction';
        }

        // Clean currency
        let currency = displayCurrency || 'JPY';
        const curMatch = rawCur.toUpperCase().match(/[A-Z]{3}/);
        if (curMatch && activeCurrencies.includes(curMatch[0])) {
          currency = curMatch[0];
        } else if (curMatch) {
          currency = curMatch[0];
        }

        // Clean Paid By
        let paidBy = currentUser?.id || members[0]?.id || '1';
        if (rawPaidBy) {
          const matchedMember = members.find(m => 
            m.name.toLowerCase() === rawPaidBy.toLowerCase() || 
            m.id === rawPaidBy || 
            rawPaidBy.toLowerCase().includes(m.name.toLowerCase())
          );
          if (matchedMember) {
            paidBy = matchedMember.id;
          }
        }

        // Clean Split With
        let splitWith = members.map(m => m.id);
        if (rawSplitWith && !rawSplitWith.toLowerCase().includes('all') && !rawSplitWith.includes('全部') && !rawSplitWith.includes('所有')) {
          const tokens = rawSplitWith.split(/[,;、/]/).map(t => t.trim().toLowerCase()).filter(Boolean);
          const matchedIds: string[] = [];
          tokens.forEach(tok => {
            const m = members.find(mem => mem.name.toLowerCase() === tok || mem.id === tok || mem.name.toLowerCase().includes(tok));
            if (m && !matchedIds.includes(m.id)) {
              matchedIds.push(m.id);
            }
          });
          if (matchedIds.length > 0) {
            splitWith = matchedIds;
          }
        }

        parsed.push({
          id: `imp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          date: dateVal,
          title: rawTitle || '未命名支出',
          category,
          amount: cleanAmount,
          currency,
          paidBy,
          splitWith,
          settledBy: []
        });
      }

      if (parsed.length === 0) {
        alert("未能從此 CSV 檔案解析出任何有效交易紀錄。請確認包含：日期、名稱、金額、幣別等欄位。");
        return;
      }

      setImportedPreview({
        fileName,
        items: parsed
      });
      setImportMode('append');
      setIsImportModalOpen(true);
    } catch (err) {
      console.error("Error parsing CSV:", err);
      alert("解析 CSV 檔案時發生錯誤，請確認檔案格式是否正確。");
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        processCSVContent(content, file.name);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDownloadTemplate = () => {
    let tpl = "\ufeff";
    tpl += "日期 Date,名稱 Title,類別 Category,金額 Amount,幣別 Currency,付款人 Paid By,分帳成員 Split With\n";
    const samplePayer = members[0]?.name || "Stitch";
    const sampleSplit = members.map(m => m.name).join("; ");
    tpl += `2024-10-12,一蘭拉麵,Food,3200,JPY,"${samplePayer}","${sampleSplit}"\n`;
    tpl += `2024-10-12,東京地鐵一日券,Transport,800,JPY,"${members[1]?.name || samplePayer}","${sampleSplit}"\n`;
    tpl += `2024-10-13,新宿王子大飯店,Stay,45000,JPY,"${samplePayer}","${sampleSplit}"\n`;
    tpl += `2024-10-14,藥妝店伴手禮,Shopping,8500,JPY,"${samplePayer}","${samplePayer}"\n`;

    const blob = new Blob([tpl], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "OhanaTrip_Expense_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmImport = () => {
    if (!importedPreview || importedPreview.items.length === 0) return;

    if (importMode === 'replace') {
      setExpenses(importedPreview.items);
    } else {
      setExpenses(prev => [...importedPreview.items, ...prev]);
    }

    setImportToast(`成功匯入 ${importedPreview.items.length} 筆記帳紀錄！`);
    setTimeout(() => setImportToast(null), 3500);
    setIsImportModalOpen(false);
    setImportedPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    <div 
      className="space-y-6 pb-24 animate-in relative min-h-screen"
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files?.[0]) {
          handleFileSelect(e.dataTransfer.files[0]);
        }
      }}
    >
      <div className="bg-white/95 backdrop-blur-md p-6 rounded-3xl-sticker sticker-shadow border border-stitch/20 relative overflow-hidden">
        <div className="relative z-10">
           <div className="flex justify-between items-center mb-2">
             <p className="text-[10px] font-black uppercase tracking-[0.2em] text-navy/30">Total Spent</p>
             <div className="flex items-center gap-2">
               <div className="relative">
                 <button 
                   onClick={() => setShowExportMenu(!showExportMenu)} 
                   className="p-1.5 rounded-lg bg-cream text-navy/40 hover:bg-stitch hover:text-white transition-colors" 
                   title="Export Options / 匯出資料"
                 >
                   <FileDown size={14} />
                 </button>
                 {showExportMenu && (
                   <div className="absolute right-0 top-8 z-50 w-52 bg-white rounded-2xl p-1.5 border border-stitch/30 shadow-xl animate-in zoom-in-95">
                     <button
                       type="button"
                       onClick={() => {
                         setShowExportMenu(false);
                         handleExportCSV();
                       }}
                       className="w-full text-left px-3 py-2 rounded-xl text-xs font-black text-navy hover:bg-cream flex items-center gap-2"
                     >
                       <FileText size={14} className="text-stitch shrink-0" />
                       <div>
                         <div>匯出記帳 CSV</div>
                         <div className="text-[8px] font-bold text-navy/40">只包含目前記帳明細與結算</div>
                       </div>
                     </button>
                     {onOpenFullExport && (
                       <button
                         type="button"
                         onClick={() => {
                           setShowExportMenu(false);
                           onOpenFullExport();
                         }}
                         className="w-full text-left px-3 py-2 rounded-xl text-xs font-black text-stitch hover:bg-stitch/10 flex items-center gap-2 border-t border-accent/30 mt-1"
                       >
                         <Layers size={14} className="text-donald shrink-0" />
                         <div>
                           <div>匯出全旅程資料</div>
                           <div className="text-[8px] font-bold text-navy/40">行程、票券、清單、記帳完整備份</div>
                         </div>
                       </button>
                     )}
                   </div>
                 )}
               </div>
               <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg bg-cream text-navy/40 hover:bg-stitch hover:text-white transition-colors" title="Import CSV / 匯入 CSV">
                 <FileUp size={14} />
               </button>
               <input 
                 ref={fileInputRef} 
                 type="file" 
                 accept=".csv,text/csv" 
                 onChange={handleFileInputChange} 
                 className="hidden" 
               />
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

           <div onClick={() => handleDateFilter(todayDate)} className={`p-4 mb-5 border rounded-2xl flex justify-between items-center cursor-pointer transition-all active:scale-[0.98] ${selectedFilterDate === todayDate ? 'bg-stitch text-white sticker-shadow' : 'bg-stitch/10 text-navy'}`}>
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
             <button onClick={() => { setEditingExpense(null); setIsModalOpen(true); }} className="bg-stitch text-white py-3.5 rounded-2xl-sticker font-black text-xs uppercase flex items-center justify-center gap-2 sticker-shadow active:translate-y-0.5 hover:bg-navy transition-all">
               <Plus size={16} /> 記一筆 Record
             </button>
             <button onClick={() => setIsSettlementOpen(true)} className="bg-white text-navy border border-accent py-3.5 rounded-2xl-sticker font-black text-xs uppercase flex items-center justify-center gap-2 sticker-shadow active:translate-y-0.5 hover:bg-cream transition-all">
               <Wallet size={16} /> 分帳結算 Settlement
             </button>
           </div>

           {/* Quick One-Tap Fast Log Row */}
           <div className="mt-4 pt-3.5 border-t border-accent/40">
             <div className="flex items-center justify-between mb-2 px-0.5">
               <span className="text-[10px] font-black uppercase tracking-wider text-navy/60 flex items-center gap-1.5">
                 <Zap size={13} className="text-donald fill-donald" />
                 常用快速記帳 (One-Tap Fast Log)
               </span>
               <span className="text-[9px] font-bold text-navy/30">點擊即刻開填</span>
             </div>
             <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
               {FAST_PRESETS.map((preset, idx) => (
                 <button
                   key={idx}
                   type="button"
                   onClick={() => handleQuickPresetClick(preset)}
                   className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-cream/70 hover:bg-stitch hover:text-white border border-accent/60 hover:border-stitch rounded-xl text-xs font-black text-navy transition-all active:scale-95 shadow-xs group"
                 >
                   <span className="text-sm">{preset.emoji}</span>
                   <span className="group-hover:text-white">{preset.title}</span>
                 </button>
               ))}
             </div>
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

      {/* Toast Notification */}
      {importToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] bg-navy text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-stitch animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-black tracking-wide">{importToast}</span>
        </div>
      )}

      {/* CSV Import Preview Modal */}
      {isImportModalOpen && importedPreview && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-in fade-in" onClick={() => setIsImportModalOpen(false)}>
          <div className="bg-paper w-full max-w-md rounded-3xl-sticker p-5 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex justify-between items-center pb-3 border-b border-accent/40 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-stitch/15 text-stitch flex items-center justify-center font-black">
                  <FileUp size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-navy uppercase tracking-wider">匯入記帳 CSV</h3>
                  <p className="text-[10px] font-bold text-navy/40 truncate max-w-[210px]">
                    檔案：{importedPreview.fileName}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-1.5 bg-cream rounded-full text-navy/40 hover:text-navy">
                <X size={18} />
              </button>
            </div>

            {/* Status & Template download */}
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="bg-white p-3 rounded-2xl border border-accent/60 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black text-navy">已解析 {importedPreview.items.length} 筆有效紀錄</span>
                </div>
                <button 
                  onClick={handleDownloadTemplate} 
                  className="text-[10px] font-bold text-stitch hover:underline flex items-center gap-1 uppercase"
                  title="下載標準 CSV 格式空白範本"
                >
                  <Download size={12} /> 下載空白範本
                </button>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="text-[9px] font-black uppercase text-navy/40 mb-1.5 block tracking-wider">匯入模式 (Import Mode)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      importMode === 'append'
                        ? 'bg-stitch/10 border-stitch text-stitch shadow-xs ring-1 ring-stitch/30'
                        : 'bg-white border-accent text-navy/50 hover:bg-cream'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <Plus size={13} />
                      <span>新增附加 (推薦)</span>
                    </div>
                    <p className="text-[8px] font-bold opacity-70 mt-0.5">
                      保留現有 {expenses.length} 筆，加入新明細
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      importMode === 'replace'
                        ? 'bg-red-50 border-red-400 text-red-500 shadow-xs ring-1 ring-red-300'
                        : 'bg-white border-accent text-navy/50 hover:bg-cream'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <RefreshCw size={13} />
                      <span>覆蓋現有記帳</span>
                    </div>
                    <p className="text-[8px] font-bold opacity-70 mt-0.5">
                      清除現有資料，完全替換
                    </p>
                  </button>
                </div>
              </div>

              {/* Preview List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 border border-accent/40 rounded-2xl p-2 bg-cream/40 min-h-[140px]">
                <div className="flex justify-between items-center px-1 sticky top-0 bg-cream/95 backdrop-blur-xs py-1 border-b border-accent/30 mb-1">
                  <p className="text-[9px] font-black uppercase text-navy/40">
                    明細預覽清單 (Preview)
                  </p>
                  <p className="text-[9px] font-bold text-navy/30">
                    共 {importedPreview.items.length} 筆
                  </p>
                </div>
                {importedPreview.items.map((item, idx) => {
                  const payer = members.find(m => m.id === item.paidBy);
                  return (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-accent/40 flex items-center justify-between text-xs shadow-xs">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono font-bold text-navy/40">{item.date}</span>
                          <span className="font-black text-navy truncate">{item.title}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-navy/40 font-bold">
                          <span className="px-1.5 py-0.2 bg-stitch/10 text-stitch rounded-sm font-black text-[8px] uppercase">{item.category}</span>
                          <span>付款：{payer?.name || '未知'}</span>
                          <span>分帳：{item.splitWith.length} 人</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-black text-navy text-xs">{item.currency} {item.amount.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-accent/40 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="flex-1 py-3 bg-cream border border-accent text-navy/60 font-black rounded-xl text-xs uppercase tracking-wider hover:bg-accent/20 transition-all"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex-1 py-3 bg-stitch text-white font-black rounded-xl-sticker text-xs uppercase tracking-widest sticker-shadow active:translate-y-0.5 hover:bg-navy transition-all"
                >
                  確認匯入 ({importedPreview.items.length} 筆)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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

const CATEGORY_ITEMS = [
  { id: 'Food', label: '餐飲美食', emoji: '🍜', activeBg: 'bg-amber-500 text-white border-amber-600', idleBg: 'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100' },
  { id: 'Transport', label: '交通出行', emoji: '🚇', activeBg: 'bg-sky-500 text-white border-sky-600', idleBg: 'bg-sky-50/70 text-sky-800 border-sky-200 hover:bg-sky-100' },
  { id: 'Stay', label: '飯店住宿', emoji: '🏨', activeBg: 'bg-indigo-500 text-white border-indigo-600', idleBg: 'bg-indigo-50/70 text-indigo-800 border-indigo-200 hover:bg-indigo-100' },
  { id: 'Shopping', label: '購物採買', emoji: '🛍️', activeBg: 'bg-rose-500 text-white border-rose-600', idleBg: 'bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100' },
  { id: 'Attraction', label: '景點門票', emoji: '🎟️', activeBg: 'bg-emerald-500 text-white border-emerald-600', idleBg: 'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100' },
  { id: 'Other', label: '其他雜支', emoji: '📦', activeBg: 'bg-slate-600 text-white border-slate-700', idleBg: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' },
];

const MODAL_PRESETS = [
  { title: '早餐', category: 'Food', emoji: '🍜' },
  { title: '午餐', category: 'Food', emoji: '🍱' },
  { title: '晚餐', category: 'Food', emoji: '🍲' },
  { title: '居酒屋', category: 'Food', emoji: '🍢' },
  { title: '地鐵票', category: 'Transport', emoji: '🚇' },
  { title: '的士車資', category: 'Transport', emoji: '🚕' },
  { title: 'JR新幹線', category: 'Transport', emoji: '🚅' },
  { title: '超商便利店', category: 'Food', emoji: '🏪' },
  { title: '咖啡飲料', category: 'Food', emoji: '☕' },
  { title: '藥妝免稅', category: 'Shopping', emoji: '🛍️' },
  { title: '景點門票', category: 'Attraction', emoji: '🎟️' },
  { title: '飯店住宿', category: 'Stay', emoji: '🏨' },
];

const QUICK_AMOUNTS = [
  { label: '+100', val: 100 },
  { label: '+500', val: 500 },
  { label: '+1,000', val: 1000 },
  { label: '+5,000', val: 5000 },
  { label: '+10,000', val: 10000 },
];

const ExpenseModal: React.FC<{ expense: ExpenseType | null; members: TripMember[]; currencies: string[]; onClose: () => void; onSave: (e: ExpenseType) => void }> = ({ expense, members, currencies, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<ExpenseType>>(expense || { 
    amount: 0, 
    currency: currencies[0] || 'JPY', 
    category: 'Food', 
    title: '', 
    paidBy: members[0]?.id || '', 
    splitWith: members.map(m => m.id), 
    settledBy: [], 
    date: new Date().toISOString().split('T')[0] 
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const handleApplyPreset = (preset: typeof MODAL_PRESETS[0]) => {
    setFormData(prev => ({
      ...prev,
      title: preset.title,
      category: preset.category
    }));
  };

  const handleAddAmount = (val: number) => {
    setFormData(prev => ({
      ...prev,
      amount: (prev.amount || 0) + val
    }));
  };

  const handleClearAmount = () => {
    setFormData(prev => ({ ...prev, amount: 0 }));
  };

  const toggleSplit = (uid: string) => {
    const current = formData.splitWith || [];
    if (current.includes(uid)) { 
      if (current.length > 1) {
        setFormData({ ...formData, splitWith: current.filter(id => id !== uid) }); 
      }
    } else { 
      setFormData({ ...formData, splitWith: [...current, uid] }); 
    }
  };

  const handleSelectAllSplit = () => {
    setFormData(prev => ({ ...prev, splitWith: members.map(m => m.id) }));
  };

  const handleSelectSoloSplit = () => {
    if (formData.paidBy) {
      setFormData(prev => ({ ...prev, splitWith: [prev.paidBy!] }));
    }
  };

  const splitCount = formData.splitWith?.length || 1;
  const perPersonAmount = Math.round((formData.amount || 0) / splitCount);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-navy/30 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-paper w-full max-w-lg rounded-3xl p-6 sticker-shadow border-t-4 border-stitch animate-in zoom-in-95 overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-stitch/10 text-stitch rounded-xl">
              <Zap size={18} />
            </span>
            <div>
              <h3 className="text-base font-black text-navy uppercase tracking-wider">
                {expense?.id ? '編輯花費 Record' : '快速記帳 Fast Log'}
              </h3>
              <p className="text-[9px] font-bold text-navy/40">點擊標籤快速帶入，點擊按鈕快速加減金額</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-cream hover:bg-accent rounded-full text-navy/40 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Quick Preset Chips Row */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] font-black uppercase text-navy/40 tracking-wider">常用項目快捷預填</label>
              <span className="text-[8px] font-bold text-stitch">一鍵帶入名稱與類別</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {MODAL_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black transition-all active:scale-95 border ${
                    formData.title === p.title && formData.category === p.category
                      ? 'bg-stitch text-white border-stitch shadow-xs'
                      : 'bg-white hover:bg-cream text-navy/70 border-accent/70'
                  }`}
                >
                  <span>{p.emoji}</span>
                  <span>{p.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Currency Box */}
          <div>
            <label className="text-[9px] font-black uppercase text-navy/40 mb-1.5 block tracking-wider">花費金額 Amount</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-white rounded-2xl border-2 border-stitch/30 focus-within:border-stitch p-3.5 flex items-baseline gap-2 sticker-shadow transition-colors">
                <span className="text-sm font-black text-navy/40">{formData.currency}</span>
                <input 
                  type="number" 
                  autoFocus={!expense?.id}
                  value={formData.amount || ''} 
                  onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} 
                  placeholder="0" 
                  className="w-full bg-transparent border-none p-0 font-black text-3xl text-navy focus:ring-0" 
                />
              </div>
              <select 
                value={formData.currency} 
                onChange={e => setFormData({ ...formData, currency: e.target.value })} 
                className="px-4 py-3 bg-white border border-accent rounded-2xl font-black text-sm text-navy sticker-shadow outline-none focus:border-stitch cursor-pointer"
              >
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Quick Amount Increment Pills */}
            <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-0.5 scrollbar-hide">
              {QUICK_AMOUNTS.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddAmount(q.val)}
                  className="flex-shrink-0 px-2.5 py-1 bg-cream hover:bg-stitch hover:text-white border border-accent/60 rounded-xl text-[11px] font-black text-navy transition-all active:scale-90"
                >
                  {q.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearAmount}
                className="flex-shrink-0 px-2.5 py-1 bg-red-50 hover:bg-red-500 hover:text-white border border-red-200 text-red-600 rounded-xl text-[11px] font-black transition-all active:scale-90"
              >
                C 歸零
              </button>
            </div>
          </div>

          {/* Title Input */}
          <div className="bg-white rounded-2xl border border-accent p-3 sticker-shadow">
            <label className="text-[9px] font-black uppercase text-navy/40 mb-1 block tracking-wider">項目名稱 Title</label>
            <input 
              type="text" 
              value={formData.title || ''} 
              onChange={e => setFormData({ ...formData, title: e.target.value })} 
              placeholder="例如：一蘭拉麵、地鐵西瓜卡加值、藥妝店" 
              className="w-full bg-transparent border-none p-0 font-black text-navy text-base focus:ring-0 placeholder:text-navy/20" 
            />
          </div>

          {/* Visual Category Selection Grid */}
          <div>
            <label className="text-[9px] font-black uppercase text-navy/40 mb-1.5 block tracking-wider">消費類別 Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_ITEMS.map(cat => {
                const isSelected = formData.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.id })}
                    className={`py-2 px-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                      isSelected ? `${cat.activeBg} shadow-sm scale-[1.02]` : cat.idleBg
                    }`}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-[11px] font-black tracking-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Selector with Quick Buttons */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[9px] font-black uppercase text-navy/40 tracking-wider">消費日期 Date</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, date: todayStr })}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-colors ${
                    formData.date === todayStr ? 'bg-stitch text-white' : 'bg-cream text-navy/50 hover:text-navy'
                  }`}
                >
                  今天
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, date: yesterdayStr })}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-colors ${
                    formData.date === yesterdayStr ? 'bg-stitch text-white' : 'bg-cream text-navy/50 hover:text-navy'
                  }`}
                >
                  昨天
                </button>
              </div>
            </div>
            <div className="bg-white p-2.5 border border-accent rounded-xl">
              <input 
                type="date" 
                value={formData.date || todayStr} 
                onChange={e => setFormData({ ...formData, date: e.target.value })} 
                className="w-full bg-transparent border-none p-0 font-bold text-xs text-navy outline-none" 
              />
            </div>
          </div>

          {/* Paid By Selection */}
          <div>
            <label className="text-[9px] font-black uppercase text-navy/40 mb-2 block tracking-wider">付款人 Paid By</label>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {members.map(m => {
                const isPayer = formData.paidBy === m.id;
                return (
                  <button 
                    key={m.id} 
                    type="button"
                    onClick={() => setFormData({ ...formData, paidBy: m.id })} 
                    className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
                      isPayer 
                        ? 'bg-navy text-white border-navy sticker-shadow scale-105' 
                        : 'bg-white border-accent text-navy/60 hover:bg-cream'
                    }`}
                  >
                    <img src={m.avatar} className="w-5 h-5 rounded-full border border-white/20" alt={m.name} />
                    <span className="text-[10px] font-black uppercase">{m.name}</span>
                    {isPayer && <Check size={12} className="text-donald" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Split With Selection & Quick Helpers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[9px] font-black uppercase text-navy/40 tracking-wider">分帳成員 Split With</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllSplit}
                  className="px-2 py-0.5 rounded-lg bg-cream hover:bg-stitch hover:text-white text-navy/60 text-[10px] font-black transition-colors"
                >
                  👥 全員平分
                </button>
                <button
                  type="button"
                  onClick={handleSelectSoloSplit}
                  className="px-2 py-0.5 rounded-lg bg-cream hover:bg-stitch hover:text-white text-navy/60 text-[10px] font-black transition-colors"
                >
                  👤 個人自負
                </button>
              </div>
            </div>

            {/* Member Chips */}
            <div className="flex flex-wrap gap-2">
              {members.map(m => { 
                const isSelected = formData.splitWith?.includes(m.id); 
                return (
                  <button 
                    key={m.id} 
                    type="button"
                    onClick={() => toggleSplit(m.id)} 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                      isSelected 
                        ? 'bg-stitch/10 border-stitch text-stitch font-black shadow-xs' 
                        : 'bg-white border-accent text-navy/30'
                    }`}
                  >
                    <img src={m.avatar} className="w-4 h-4 rounded-full" alt={m.name} />
                    <span className="text-[10px] uppercase">{m.name}</span>
                    {isSelected && <Check size={11} className="text-stitch" />}
                  </button>
                ); 
              })}
            </div>

            {/* Real-time Dynamic Split Calculation Hint */}
            <div className="mt-2.5 p-2.5 rounded-xl bg-stitch/5 border border-stitch/15 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Split size={14} className="text-stitch shrink-0" />
                <span className="text-[11px] font-black text-navy/70">
                  {splitCount > 1 
                    ? `每人平分：約 ${formData.currency} ${perPersonAmount.toLocaleString()} (共 ${splitCount} 人)`
                    : splitCount === 1 && formData.splitWith?.[0] === formData.paidBy
                      ? '個人支出，不列入他人分帳'
                      : `由付款人全額代付 (${members.find(m => m.id === formData.splitWith?.[0])?.name || '指定成員'})`
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Submit Action Button */}
          <button 
            type="button"
            onClick={() => onSave(formData as ExpenseType)} 
            disabled={!formData.title || !formData.amount} 
            className="w-full py-4 bg-stitch hover:bg-navy text-white font-black rounded-2xl-sticker uppercase text-xs tracking-[0.2em] mt-2 sticker-shadow active:translate-y-0.5 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            <Check size={16} />
            {expense?.id ? '更新記錄 UPDATE' : '儲存記帳 SAVE EXPENSE'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Expense;
