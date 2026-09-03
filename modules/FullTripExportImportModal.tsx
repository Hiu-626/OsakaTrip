import React, { useState, useRef } from 'react';
import { 
  X, 
  Download, 
  Upload, 
  FileJson, 
  FileSpreadsheet, 
  Check, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Ticket, 
  Wallet, 
  CheckSquare, 
  Users, 
  Sparkles, 
  Copy,
  ChevronRight,
  Info
} from 'lucide-react';
import { Trip, ScheduleItem, Booking, Expense, PlanningItem, TripMember, TripConfig } from '../types.ts';

interface FullTripExportImportModalProps {
  currentTrip: Trip;
  allTrips: Trip[];
  onClose: () => void;
  onImportTrip: (importedTrip: Trip, mode: 'new' | 'overwrite') => Promise<void>;
  onForceSaveCloud: () => void;
  isSyncing: boolean;
}

export const FullTripExportImportModal: React.FC<FullTripExportImportModalProps> = ({
  currentTrip,
  allTrips,
  onClose,
  onImportTrip,
  onForceSaveCloud,
  isSyncing
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Import State
  const [importedTripData, setImportedTripData] = useState<Trip | null>(null);
  const [importFileName, setImportFileName] = useState<string>('');
  const [importMode, setImportMode] = useState<'new' | 'overwrite'>('new');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to gather latest active trip data directly from localStorage to ensure 100% synchronization
  const getLiveTripData = (): Trip => {
    let cfg: any = {
      tripName: currentTrip.tripName,
      region: currentTrip.region,
      startDate: currentTrip.startDate,
      duration: currentTrip.duration,
      coverEmoji: currentTrip.coverEmoji || '✈️'
    };
    try {
      const c = localStorage.getItem('tripConfig');
      if (c) cfg = { ...cfg, ...JSON.parse(c) };
    } catch (e) {}

    let itinerary: ScheduleItem[] = currentTrip.itinerary || [];
    try {
      const it = localStorage.getItem('itinerary');
      if (it) itinerary = JSON.parse(it);
    } catch (e) {}

    let pool: ScheduleItem[] = currentTrip.pool || [];
    try {
      const p = localStorage.getItem('inspiration_pool');
      if (p) pool = JSON.parse(p);
    } catch (e) {}

    let bookings: Booking[] = currentTrip.bookings || [];
    try {
      const b = localStorage.getItem('bookings');
      if (b) bookings = JSON.parse(b);
    } catch (e) {}

    let expenses: Expense[] = currentTrip.expenses || [];
    try {
      const ex = localStorage.getItem('expenses');
      if (ex) expenses = JSON.parse(ex);
    } catch (e) {}

    let planningItems: PlanningItem[] = currentTrip.planningItems || [];
    try {
      const pl = localStorage.getItem('planning_items');
      if (pl) planningItems = JSON.parse(pl);
    } catch (e) {}

    let members: TripMember[] = currentTrip.members || [];
    try {
      const m = localStorage.getItem('trip_members');
      if (m) members = JSON.parse(m);
    } catch (e) {}

    let currencySettings = currentTrip.currencySettings;
    try {
      const activeCurrencies = localStorage.getItem('activeCurrencies');
      const displayCurrency = localStorage.getItem('displayCurrency');
      const exchangeRates = localStorage.getItem('exchangeRates');
      if (activeCurrencies || displayCurrency || exchangeRates) {
        currencySettings = {
          activeCurrencies: activeCurrencies ? JSON.parse(activeCurrencies) : ['JPY', 'HKD', 'AUD', 'USD', 'EUR', 'TWD'],
          displayCurrency: displayCurrency || 'HKD',
          rates: exchangeRates ? JSON.parse(exchangeRates) : undefined
        };
      }
    } catch (e) {}

    return {
      id: currentTrip.id,
      tripName: cfg.tripName || currentTrip.tripName,
      region: cfg.region || currentTrip.region,
      startDate: cfg.startDate || currentTrip.startDate,
      duration: cfg.duration || currentTrip.duration,
      coverEmoji: cfg.coverEmoji || currentTrip.coverEmoji || '✈️',
      createdAt: currentTrip.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members,
      itinerary,
      pool,
      bookings,
      expenses,
      planningItems,
      currencySettings
    };
  };

  // Export Full JSON Backup
  const handleExportJSON = () => {
    const liveData = getLiveTripData();
    const jsonStr = JSON.stringify(liveData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (liveData.tripName || 'OhanaTrip').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeName}_FullBackup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("成功匯出完整旅程 JSON 備份檔！");
  };

  // Export Comprehensive Multi-Section CSV Report
  const handleExportComprehensiveCSV = () => {
    const live = getLiveTripData();
    let csv = "\ufeff"; // UTF-8 BOM for Excel Chinese/Cantonese characters

    // 1. Trip Overview Section
    csv += "=========================================================\n";
    csv += "=== 1. 旅程基本資訊 (TRIP OVERVIEW) ===\n";
    csv += "=========================================================\n";
    csv += "旅程名稱,目的地,出發日期,天數,成員名單,最後更新\n";
    const memberNames = live.members.map(m => m.name).join("; ");
    csv += `"${live.tripName || ''}","${live.region || ''}","${live.startDate || ''}",${live.duration},"${memberNames}","${new Date().toLocaleString()}"\n\n`;

    // 2. Itinerary Section
    csv += "=========================================================\n";
    csv += "=== 2. 行程規劃 (ITINERARY & SCHEDULE) ===\n";
    csv += "=========================================================\n";
    csv += "天數 Day,時間 Time,標題 Title,類別 Category,地點 Location,交通距離 Distance,備註 Notes\n";
    const sortedItinerary = [...live.itinerary].sort((a, b) => {
      if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
      return (a.time || '').localeCompare(b.time || '');
    });
    sortedItinerary.forEach(item => {
      const dayLabel = `第 ${item.dayIndex + 1} 天`;
      const timeStr = item.time ? (item.endTime ? `${item.time} - ${item.endTime}` : item.time) : '全天';
      csv += `"${dayLabel}","${timeStr}","${(item.title || '').replace(/"/g, '""')}","${item.category || ''}","${(item.location || '').replace(/"/g, '""')}","${(item.distanceInfo || '').replace(/"/g, '""')}","${(item.notes || '').replace(/"/g, '""')}"\n`;
    });
    if (sortedItinerary.length === 0) {
      csv += "無行程紀錄\n";
    }
    csv += "\n";

    // 3. Inspiration Pool Section
    csv += "=========================================================\n";
    csv += "=== 3. 景點靈感池 (INSPIRATION POOL) ===\n";
    csv += "=========================================================\n";
    csv += "標題 Title,類別 Category,地點 Location,備註 Notes\n";
    (live.pool || []).forEach(item => {
      csv += `"${(item.title || '').replace(/"/g, '""')}","${item.category || ''}","${(item.location || '').replace(/"/g, '""')}","${(item.notes || '').replace(/"/g, '""')}"\n`;
    });
    if ((live.pool || []).length === 0) {
      csv += "無靈感池項目\n";
    }
    csv += "\n";

    // 4. Bookings Section
    csv += "=========================================================\n";
    csv += "=== 4. 預訂票券、機票、飯店 (BOOKINGS & RESERVATIONS) ===\n";
    csv += "=========================================================\n";
    csv += "類型 Type,項目名稱 Title,確認代號 Ref/PNR,日期時間 Date/Time,地點 Location,費用 Cost,訂購人 Booked By,備註 Notes\n";
    (live.bookings || []).forEach(b => {
      const booker = live.members.find(m => m.id === b.bookedBy)?.name || '未指定';
      const details = b.details || {};
      const timeInfo = details.time || details.checkIn || details.dateTime || '';
      const locationInfo = details.location || details.address || details.airport || '';
      const noteInfo = details.notes || details.desc || '';
      csv += `"${b.type || ''}","${(b.title || '').replace(/"/g, '""')}","${(b.referenceNo || '').replace(/"/g, '""')}","${timeInfo}","${(locationInfo || '').replace(/"/g, '""')}",${b.cost || 0},"${booker}","${(noteInfo || '').replace(/"/g, '""')}"\n`;
    });
    if ((live.bookings || []).length === 0) {
      csv += "無預訂票券\n";
    }
    csv += "\n";

    // 5. Expenses Section
    csv += "=========================================================\n";
    csv += "=== 5. 記帳與分帳明細 (EXPENSES & SETTLEMENT) ===\n";
    csv += "=========================================================\n";
    csv += "日期 Date,項目 Title,類別 Category,金額 Amount,幣別 Currency,付款人 Paid By,分帳成員 Split With\n";
    (live.expenses || []).forEach(exp => {
      const payer = live.members.find(m => m.id === exp.paidBy)?.name || '未知';
      const splitNames = exp.splitWith.map(id => live.members.find(m => m.id === id)?.name || id).join("; ");
      csv += `"${exp.date}","${(exp.title || '').replace(/"/g, '""')}","${exp.category}",${exp.amount},"${exp.currency}","${payer}","${splitNames}"\n`;
    });
    if ((live.expenses || []).length === 0) {
      csv += "無記帳明細\n";
    }
    csv += "\n";

    // 6. Planning Checklist Section
    csv += "=========================================================\n";
    csv += "=== 6. 行李與購物清單 (PLANNING & CHECKLIST) ===\n";
    csv += "=========================================================\n";
    csv += "分類 Section,項目名稱 Item,負責人 Assignee,完成狀態 Status\n";
    (live.planningItems || []).forEach(p => {
      const assigneeName = p.assignedTo === 'All' ? '全體人員' : (live.members.find(m => m.id === p.assignedTo)?.name || p.assignedTo);
      const statusStr = p.completed ? '已完成 [V]' : '未完成 [ ]';
      const typeStr = p.type === 'Packing' ? '行李打包' : '購物採買';
      csv += `"${typeStr}","${(p.title || '').replace(/"/g, '""')}","${assigneeName}","${statusStr}"\n`;
    });
    if ((live.planningItems || []).length === 0) {
      csv += "無清單項目\n";
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = (live.tripName || 'OhanaTrip').replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
    link.setAttribute("href", url);
    link.setAttribute("download", `${safeName}_綜合總表_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("成功匯出涵蓋行程、票券、記帳、清單的綜合總表 CSV！");
  };

  // Robust RFC 4180 CSV Parser
  const parseCSVText = (text: string): string[][] => {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let insideQuote = false;
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

  // Parse Uploaded CSV File (handles comprehensive multi-section or single-section)
  const parseUploadedCSV = (content: string, fileName: string): Trip => {
    const rows = parseCSVText(content);
    
    let tripName = fileName.replace(/\.[^/.]+$/, '').replace(/_綜合總表.*|_FullBackup.*/, '') || '匯入旅程';
    let region = 'Japan';
    let startDate = new Date().toISOString().split('T')[0];
    let duration = 5;
    let coverEmoji = '✈️';
    
    const itinerary: ScheduleItem[] = [];
    const pool: ScheduleItem[] = [];
    const bookings: Booking[] = [];
    const expenses: Expense[] = [];
    const planningItems: PlanningItem[] = [];
    let members: TripMember[] = [...currentTrip.members];

    let currentSection = 'unknown';

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length === 0) continue;
      const first = (row[0] || '').trim();

      // Check section headers
      if (first.includes('===') || first.startsWith('---')) {
        const line = row.join(' ').toLowerCase();
        if (line.includes('1.') || line.includes('overview') || line.includes('基本資訊')) {
          currentSection = 'overview';
        } else if (line.includes('2.') || line.includes('itinerary') || line.includes('schedule') || line.includes('行程規劃')) {
          currentSection = 'itinerary';
        } else if (line.includes('3.') || line.includes('inspiration') || line.includes('靈感池')) {
          currentSection = 'pool';
        } else if (line.includes('4.') || line.includes('booking') || line.includes('預訂票券') || line.includes('機票')) {
          currentSection = 'bookings';
        } else if (line.includes('5.') || line.includes('expense') || line.includes('記帳') || line.includes('花費')) {
          currentSection = 'expenses';
        } else if (line.includes('6.') || line.includes('planning') || line.includes('checklist') || line.includes('清單')) {
          currentSection = 'planning';
        }
        continue;
      }

      // Skip table header rows
      const lowerRow = row.map(c => c.toLowerCase());
      if (lowerRow.some(c => c.includes('title') || c.includes('day') || c.includes('amount') || c.includes('標題') || c.includes('天數') || c.includes('金額'))) {
        continue;
      }

      // Process according to detected or implicit section
      if (currentSection === 'overview' && row.length >= 4) {
        if (row[0]) tripName = row[0];
        if (row[1]) region = row[1];
        if (row[2]) startDate = row[2];
        if (row[3]) duration = parseInt(row[3]) || duration;
        if (row[4]) {
          const names = row[4].split(/[,;、]/).map(n => n.trim()).filter(Boolean);
          if (names.length > 0) {
            members = names.map((name, i) => ({
              id: `mem_${Date.now()}_${i}`,
              name,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
            }));
          }
        }
      } else if (currentSection === 'itinerary') {
        // day, time, title, category, location, distance, notes
        const dayStr = row[0] || '';
        const timeStr = row[1] || '';
        const titleStr = row[2] || '';
        if (!titleStr) continue;

        let dayIdx = 0;
        const dayMatch = dayStr.match(/\d+/);
        if (dayMatch) {
          dayIdx = Math.max(0, parseInt(dayMatch[0]) - 1);
        }

        itinerary.push({
          id: `it_${Date.now()}_${r}`,
          dayIndex: dayIdx,
          time: timeStr.includes('-') ? timeStr.split('-')[0].trim() : (timeStr || '10:00'),
          endTime: timeStr.includes('-') ? timeStr.split('-')[1].trim() : undefined,
          title: titleStr,
          category: (row[3] as any) || 'Attraction',
          location: row[4] || '',
          distanceInfo: row[5] || '',
          notes: row[6] || ''
        });
      } else if (currentSection === 'pool') {
        const titleStr = row[0] || '';
        if (!titleStr) continue;
        pool.push({
          id: `pl_${Date.now()}_${r}`,
          dayIndex: -1,
          time: '',
          title: titleStr,
          category: (row[1] as any) || 'Attraction',
          location: row[2] || '',
          notes: row[3] || ''
        });
      } else if (currentSection === 'bookings') {
        const type = (row[0] as any) || 'Ticket';
        const title = row[1] || '';
        if (!title) continue;
        bookings.push({
          id: `bk_${Date.now()}_${r}`,
          type,
          title,
          referenceNo: row[2] || '',
          cost: parseFloat(row[5]) || 0,
          bookedBy: members[0]?.id || '1',
          details: {
            time: row[3] || '',
            location: row[4] || '',
            notes: row[7] || ''
          }
        });
      } else if (currentSection === 'expenses' || (currentSection === 'unknown' && row.some(c => c.includes('JPY') || c.includes('HKD') || c.includes('USD')))) {
        const dateStr = row[0] || new Date().toISOString().split('T')[0];
        const titleStr = row[1] || '';
        const catStr = row[2] || 'Other';
        const amountStr = row[3] || '0';
        const curStr = row[4] || 'JPY';
        const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, '')) || 0;
        if (!titleStr || amount <= 0) continue;

        expenses.push({
          id: `exp_${Date.now()}_${r}`,
          date: dateStr,
          title: titleStr,
          category: catStr,
          amount,
          currency: curStr,
          paidBy: members[0]?.id || '1',
          splitWith: members.map(m => m.id),
          settledBy: []
        });
      } else if (currentSection === 'planning') {
        const sec = row[0] || '';
        const itemTitle = row[1] || '';
        if (!itemTitle) continue;
        planningItems.push({
          id: `plan_${Date.now()}_${r}`,
          type: sec.includes('購物') ? 'Shopping' : 'Packing',
          title: itemTitle,
          assignedTo: 'All',
          completed: (row[3] || '').includes('V') || (row[3] || '').includes('true')
        });
      }
    }

    return {
      id: `trip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      tripName,
      region,
      startDate,
      duration: Math.max(1, duration, itinerary.reduce((max, i) => Math.max(max, i.dayIndex + 1), 1)),
      coverEmoji,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members,
      itinerary,
      pool,
      bookings,
      expenses,
      planningItems
    };
  };

  // Handle file selection (JSON or CSV)
  const handleFileSelect = (file: File) => {
    if (!file) return;
    setImportFileName(file.name);

    const isJson = file.name.endsWith('.json') || file.type.includes('json');
    const isCsv = file.name.endsWith('.csv') || file.type.includes('csv') || file.type.includes('text');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          alert("檔案內容為空，無法讀取。");
          return;
        }

        if (isJson) {
          const parsed = JSON.parse(text);
          if (!parsed.tripName && !parsed.itinerary && !parsed.expenses) {
            alert("無效的旅程備份檔案格式。");
            return;
          }
          const standardizedTrip: Trip = {
            id: parsed.id || `trip_${Date.now()}`,
            tripName: parsed.tripName || '未命名旅程',
            region: parsed.region || 'Japan',
            startDate: parsed.startDate || new Date().toISOString().split('T')[0],
            duration: parsed.duration || 5,
            coverEmoji: parsed.coverEmoji || '✈️',
            createdAt: parsed.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            members: Array.isArray(parsed.members) && parsed.members.length ? parsed.members : currentTrip.members,
            itinerary: Array.isArray(parsed.itinerary) ? parsed.itinerary : [],
            pool: Array.isArray(parsed.pool) ? parsed.pool : [],
            bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
            expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
            planningItems: Array.isArray(parsed.planningItems) ? parsed.planningItems : [],
            currencySettings: parsed.currencySettings
          };
          setImportedTripData(standardizedTrip);
        } else if (isCsv) {
          const tripFromCSV = parseUploadedCSV(text, file.name);
          setImportedTripData(tripFromCSV);
        } else {
          alert("不支援的檔案類型，請提供 .json 或 .csv 檔案。");
        }
      } catch (err) {
        console.error("Error reading import file:", err);
        alert("讀取檔案失敗，請檢查檔案格式是否正確。");
      }
    };

    reader.readAsText(file, 'UTF-8');
  };

  const handleConfirmImport = async () => {
    if (!importedTripData) return;
    setIsImporting(true);
    try {
      await onImportTrip(importedTripData, importMode);
      showToast(`成功匯入「${importedTripData.tripName}」並同步至雲端！`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (e) {
      console.error("Import error:", e);
      alert("匯入過程中發生錯誤，請稍後重試。");
    } finally {
      setIsImporting(false);
    }
  };

  const liveTrip = getLiveTripData();

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-navy/40 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div 
        className="bg-paper w-full max-w-md rounded-3xl-sticker p-6 sticker-shadow border-4 border-stitch/30 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-4 border-b border-accent/40 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-stitch/15 text-stitch flex items-center justify-center font-black">
              {activeTab === 'export' ? <Download size={22} /> : <Upload size={22} />}
            </div>
            <div>
              <h2 className="text-base font-black text-navy uppercase tracking-wider">
                {activeTab === 'export' ? '全旅程匯出與備份' : '全旅程匯入與還原'}
              </h2>
              <p className="text-[10px] font-bold text-navy/40 truncate max-w-[210px]">
                {currentTrip.coverEmoji} {currentTrip.tripName}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-cream rounded-full text-navy/40 hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-cream/70 p-1 rounded-2xl border border-accent/40 mb-4">
          <button
            onClick={() => setActiveTab('export')}
            className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'export'
                ? 'bg-white text-stitch shadow-xs sticker-shadow'
                : 'text-navy/40 hover:text-navy'
            }`}
          >
            <Download size={14} />
            <span>匯出備份 (Export)</span>
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'import'
                ? 'bg-white text-stitch shadow-xs sticker-shadow'
                : 'text-navy/40 hover:text-navy'
            }`}
          >
            <Upload size={14} />
            <span>匯入還原 (Import)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
          {activeTab === 'export' ? (
            /* EXPORT VIEW */
            <div className="space-y-4">
              {/* Data Inclusions Overview Card */}
              <div className="bg-white p-4 rounded-2xl border border-accent/60 sticker-shadow space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-navy/40">即時完整旅程內容</span>
                  <span className="text-[9px] font-bold text-stitch bg-stitch/10 px-2 py-0.5 rounded-full">100% 同步保證</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold text-navy">
                  <div className="flex items-center gap-2 p-2 bg-cream/40 rounded-xl border border-accent/30">
                    <Calendar size={14} className="text-stitch shrink-0" />
                    <span>{liveTrip.itinerary?.length || 0} 筆行程 ({liveTrip.duration}天)</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-cream/40 rounded-xl border border-accent/30">
                    <Ticket size={14} className="text-donald shrink-0" />
                    <span>{liveTrip.bookings?.length || 0} 張票券/機票</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-cream/40 rounded-xl border border-accent/30">
                    <Wallet size={14} className="text-emerald-500 shrink-0" />
                    <span>{liveTrip.expenses?.length || 0} 筆記帳與分帳</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-cream/40 rounded-xl border border-accent/30">
                    <CheckSquare size={14} className="text-purple-500 shrink-0" />
                    <span>{liveTrip.planningItems?.length || 0} 項準備清單</span>
                  </div>
                </div>
                <p className="text-[9px] text-navy/40 pt-1 leading-relaxed">
                  💡 本匯出功能直接讀取最新已編輯的行程、靈感池、預訂代碼、分帳與清單，確保不遺漏任何模組。
                </p>
              </div>

              {/* Export Format Cards */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-navy/40 block">
                  選擇匯出格式 (Export Format)
                </label>

                {/* Option 1: Full JSON Backup */}
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="w-full p-4 rounded-2xl bg-white border-2 border-stitch/30 hover:border-stitch text-left transition-all active:scale-[0.99] sticker-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stitch/10 text-stitch flex items-center justify-center font-black">
                        <FileJson size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-navy group-hover:text-stitch transition-colors">
                            完整旅程備份檔 (.json)
                          </h4>
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black rounded-md uppercase">
                            推薦
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-navy/40 mt-0.5">
                          最完整無損！包含天數、票券代碼、分帳名冊，可 100% 還原至任何裝置。
                        </p>
                      </div>
                    </div>
                    <Download size={16} className="text-stitch shrink-0 mt-1 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </button>

                {/* Option 2: Comprehensive Multi-Section CSV */}
                <button
                  type="button"
                  onClick={handleExportComprehensiveCSV}
                  className="w-full p-4 rounded-2xl bg-white border-2 border-accent/70 hover:border-donald text-left transition-all active:scale-[0.99] sticker-shadow group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-donald/20 text-navy flex items-center justify-center font-black">
                        <FileSpreadsheet size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-navy group-hover:text-stitch transition-colors">
                            全方位綜合總表 (.csv)
                          </h4>
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[8px] font-black rounded-md uppercase">
                            Excel/Numbers
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-navy/40 mt-0.5">
                          UTF-8 BOM 格式，分區整合行程天數、所有票券、全部分帳與行李清單。
                        </p>
                      </div>
                    </div>
                    <Download size={16} className="text-navy/40 group-hover:text-stitch shrink-0 mt-1 group-hover:translate-y-0.5 transition-transform" />
                  </div>
                </button>
              </div>

              {/* Cloud Quick Sync reminder */}
              <div className="p-3 bg-stitch/5 rounded-2xl border border-stitch/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-amber-400 animate-ping' : 'bg-green-500'}`} />
                  <span className="text-[10px] font-bold text-navy">Firebase 雲端已保持連線</span>
                </div>
                <button
                  onClick={onForceSaveCloud}
                  disabled={isSyncing}
                  className="px-2.5 py-1 bg-white border border-stitch/30 hover:bg-stitch hover:text-white rounded-lg text-[9px] font-black uppercase text-stitch transition-all"
                >
                  {isSyncing ? '同步中...' : '手動存檔至雲端'}
                </button>
              </div>
            </div>
          ) : (
            /* IMPORT VIEW */
            <div className="space-y-4">
              {/* Dropzone & File Input */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files?.[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className={`p-6 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                  importedTripData
                    ? 'bg-stitch/5 border-stitch text-navy'
                    : 'bg-white border-accent/80 hover:border-stitch/60 text-navy/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.csv,text/csv,application/json"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <div className="w-12 h-12 mx-auto rounded-2xl bg-paper flex items-center justify-center text-stitch mb-2 shadow-xs">
                  <Upload size={24} />
                </div>
                <p className="text-xs font-black text-navy uppercase tracking-wider">
                  點擊上傳或拖曳檔案至此
                </p>
                <p className="text-[9px] font-bold text-navy/40 mt-1">
                  支援 .json 完整備份檔 或 綜合 .csv 試算表
                </p>
                {importFileName && (
                  <p className="text-[10px] font-mono font-bold text-stitch mt-2 truncate max-w-[280px] mx-auto bg-white py-1 px-3 rounded-lg border border-stitch/20">
                    已選取：{importFileName}
                  </p>
                )}
              </div>

              {/* Imported Data Preview */}
              {importedTripData && (
                <div className="bg-white p-4 rounded-2xl border border-accent/60 sticker-shadow space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-accent/30">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{importedTripData.coverEmoji || '✈️'}</span>
                      <div>
                        <h4 className="text-xs font-black text-navy truncate max-w-[170px]">
                          {importedTripData.tripName}
                        </h4>
                        <p className="text-[8px] font-bold text-navy/40">
                          {importedTripData.region} • {importedTripData.startDate} ({importedTripData.duration}天)
                        </p>
                      </div>
                    </div>
                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                      已驗證格式
                    </span>
                  </div>

                  {/* Summary badges */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-navy">
                    <div className="flex items-center gap-1.5 p-1.5 bg-cream/40 rounded-lg">
                      <Calendar size={12} className="text-stitch" />
                      <span>{importedTripData.itinerary?.length || 0} 筆行程</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-cream/40 rounded-lg">
                      <Ticket size={12} className="text-donald" />
                      <span>{importedTripData.bookings?.length || 0} 張票券</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-cream/40 rounded-lg">
                      <Wallet size={12} className="text-emerald-500" />
                      <span>{importedTripData.expenses?.length || 0} 筆記帳</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-1.5 bg-cream/40 rounded-lg">
                      <CheckSquare size={12} className="text-purple-500" />
                      <span>{importedTripData.planningItems?.length || 0} 項清單</span>
                    </div>
                  </div>

                  {/* Import Strategy */}
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-wider text-navy/40 mb-1.5 block">
                      匯入策略 (Import Strategy)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setImportMode('new')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          importMode === 'new'
                            ? 'bg-stitch/10 border-stitch text-stitch shadow-xs ring-1 ring-stitch/30'
                            : 'bg-white border-accent text-navy/50 hover:bg-cream'
                        }`}
                      >
                        <span className="text-xs font-black block">新增為新旅程</span>
                        <span className="text-[8px] font-bold opacity-70 block mt-0.5">
                          保留所有現有旅程 (推薦)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('overwrite')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          importMode === 'overwrite'
                            ? 'bg-red-50 border-red-400 text-red-500 shadow-xs ring-1 ring-red-300'
                            : 'bg-white border-accent text-navy/50 hover:bg-cream'
                        }`}
                      >
                        <span className="text-xs font-black block">覆蓋當前旅程</span>
                        <span className="text-[8px] font-bold opacity-70 block mt-0.5">
                          更新「{currentTrip.tripName}」
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Button */}
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    disabled={isImporting}
                    className="w-full py-3.5 bg-stitch text-white font-black rounded-xl-sticker text-xs uppercase tracking-widest sticker-shadow active:translate-y-0.5 hover:bg-navy transition-all disabled:opacity-50"
                  >
                    {isImporting ? '匯入與雲端同步中...' : `確認匯入此旅程 (${importMode === 'new' ? '建立新旅程' : '覆蓋更新'})`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[140] bg-navy text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 border border-stitch animate-in slide-in-from-bottom-5">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span className="text-xs font-black tracking-wide">{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
