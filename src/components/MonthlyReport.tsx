import React, { useState, useMemo, useEffect } from 'react';
import { RTLogo } from './RTLogo';
import {
  Printer,
  BarChart3,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Calendar,
  Building,
  CheckCircle2,
  Share2,
  Info,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  FileText,
  Wallet,
  AlertCircle,
  Users,
  CreditCard,
  ChevronRight,
  Clock,
  Coins,
  ShieldCheck,
  AlertTriangle,
  CalendarRange,
  X,
  FileDown,
  ExternalLink,
  Award,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Resident,
  CashTransaction,
  RTProfile,
  MONTHS,
  MonthKey,
  DebtItem,
} from '../types';
import { formatRupiah, formatDateIndo, formatPercent, getOfficerForDate } from '../utils/formatters';

interface MonthlyReportProps {
  residents: Resident[];
  transactions: CashTransaction[];
  debts?: DebtItem[];
  profile: RTProfile;
}

type PeriodType = 'SEMUA' | 'TAHUNAN' | 'TRIWULAN' | 'BULANAN' | 'RENTANG_TANGGAL';
type ChartGranularity = 'HARIAN' | 'BULANAN' | 'TRIWULAN' | 'TAHUNAN';
type ReportTab = 'overview' | 'ledger' | 'dues' | 'debts' | 'categories';

const MONTH_INDEX_MAP: Record<MonthKey, number> = {
  Januari: 1,
  Februari: 2,
  Maret: 3,
  April: 4,
  Mei: 5,
  Juni: 6,
  Juli: 7,
  Agustus: 8,
  September: 9,
  Oktober: 10,
  November: 11,
  Desember: 12,
};

const QUARTERS = [
  { id: 'Q1', label: 'Triwulan I (Jan - Mar)', shortLabel: 'TW I (Jan-Mar)', months: ['Januari', 'Februari', 'Maret'] as MonthKey[], startMonth: '01', endMonth: '03' },
  { id: 'Q2', label: 'Triwulan II (Apr - Jun)', shortLabel: 'TW II (Apr-Jun)', months: ['April', 'Mei', 'Juni'] as MonthKey[], startMonth: '04', endMonth: '06' },
  { id: 'Q3', label: 'Triwulan III (Jul - Sep)', shortLabel: 'TW III (Jul-Sep)', months: ['Juli', 'Agustus', 'September'] as MonthKey[], startMonth: '07', endMonth: '09' },
  { id: 'Q4', label: 'Triwulan IV (Okt - Des)', shortLabel: 'TW IV (Okt-Des)', months: ['Oktober', 'November', 'Desember'] as MonthKey[], startMonth: '10', endMonth: '12' },
];

const PIE_COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#64748b', '#d946ef', '#0ea5e9', '#e11d48'
];

export const MonthlyReport: React.FC<MonthlyReportProps> = ({
  residents,
  transactions,
  debts = [],
  profile,
}) => {
  // Tab State
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // Filter States
  const [periodType, setPeriodType] = useState<PeriodType>('BULANAN');
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>('September');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q3');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-09-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-30');

  // Chart Specific Controls
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('HARIAN');
  const [chartMetricView, setChartMetricView] = useState<'all' | 'cashflow' | 'balance'>('all');

  // Official PDF Print Preview Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Automatically update chart granularity when periodType changes
  useEffect(() => {
    if (periodType === 'BULANAN' || periodType === 'RENTANG_TANGGAL') {
      setChartGranularity('HARIAN');
    } else if (periodType === 'TRIWULAN') {
      setChartGranularity('HARIAN');
    } else if (periodType === 'TAHUNAN') {
      setChartGranularity('BULANAN');
    }
  }, [periodType, selectedMonth, selectedQuarter]);

  // Active months based on period filter
  const relevantMonths = useMemo<MonthKey[]>(() => {
    if (periodType === 'BULANAN') {
      return [selectedMonth];
    }
    if (periodType === 'TRIWULAN') {
      const q = QUARTERS.find((item) => item.id === selectedQuarter);
      return q ? q.months : MONTHS;
    }
    if (periodType === 'TAHUNAN' || periodType === 'SEMUA') {
      return MONTHS;
    }
    if (periodType === 'RENTANG_TANGGAL') {
      const startM = parseInt(customStartDate.slice(5, 7), 10);
      const endM = parseInt(customEndDate.slice(5, 7), 10);
      return MONTHS.filter((m) => {
        const num = MONTH_INDEX_MAP[m];
        return num >= (startM || 1) && num <= (endM || 12);
      });
    }
    return MONTHS;
  }, [periodType, selectedMonth, selectedQuarter, customStartDate, customEndDate]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (periodType === 'SEMUA') return true;
      if (periodType === 'TAHUNAN') {
        return tx.date.startsWith(selectedYear);
      }
      if (periodType === 'BULANAN') {
        const mIndex = MONTH_INDEX_MAP[selectedMonth];
        const prefix = `${selectedYear}-${mIndex < 10 ? `0${mIndex}` : mIndex}`;
        return tx.date.startsWith(prefix);
      }
      if (periodType === 'TRIWULAN') {
        const q = QUARTERS.find((item) => item.id === selectedQuarter);
        if (!q) return true;
        const txMonth = tx.date.slice(5, 7);
        return tx.date.startsWith(selectedYear) && txMonth >= q.startMonth && txMonth <= q.endMonth;
      }
      if (periodType === 'RENTANG_TANGGAL') {
        return (!customStartDate || tx.date >= customStartDate) && (!customEndDate || tx.date <= customEndDate);
      }
      return true;
    });
  }, [transactions, periodType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate]);

  // Filtered Debts & Piutang
  const filteredDebts = useMemo(() => {
    return debts.filter((d) => {
      if (periodType === 'SEMUA') return true;
      if (periodType === 'TAHUNAN') return d.date.startsWith(selectedYear);
      if (periodType === 'BULANAN') {
        const mIndex = MONTH_INDEX_MAP[selectedMonth];
        const prefix = `${selectedYear}-${mIndex < 10 ? `0${mIndex}` : mIndex}`;
        return d.date.startsWith(prefix);
      }
      if (periodType === 'TRIWULAN') {
        const q = QUARTERS.find((item) => item.id === selectedQuarter);
        if (!q) return true;
        const dMonth = d.date.slice(5, 7);
        return d.date.startsWith(selectedYear) && dMonth >= q.startMonth && dMonth <= q.endMonth;
      }
      if (periodType === 'RENTANG_TANGGAL') {
        return (!customStartDate || d.date >= customStartDate) && (!customEndDate || d.date <= customEndDate);
      }
      return true;
    });
  }, [debts, periodType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate]);

  // Overall Running Balance across chronological transactions
  const chronologicalWithBalance = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    let running = 0;
    return sorted.map((tx, idx) => {
      if (tx.type === 'MASUK') running += tx.amount;
      else running -= tx.amount;
      return {
        ...tx,
        seq: idx + 1,
        balanceAfter: running,
      };
    });
  }, [transactions]);

  // Current Total Overall Cash Balance
  const currentTotalBalance = useMemo(() => {
    let masuk = 0;
    let keluar = 0;
    transactions.forEach((tx) => {
      if (tx.type === 'MASUK') masuk += tx.amount;
      else keluar += tx.amount;
    });
    return masuk - keluar;
  }, [transactions]);

  // Dues & Resident Compliance Calculations
  const duesMetrics = useMemo(() => {
    const occupiedResidents = residents.filter((r) => !r.isVacant);
    const totalOccupiedCount = occupiedResidents.length || 1;

    let totalDuesCollected = 0;
    let totalTargetDues = 0;
    let fullyPaidHouses = 0;
    let unpaidHouses = 0;
    const delinquentList: Array<{
      resident: Resident;
      unpaidMonths: MonthKey[];
      unpaidAmount: number;
    }> = [];

    occupiedResidents.forEach((res) => {
      let resPaidInPeriod = 0;
      let resTargetInPeriod = 0;
      const resUnpaidMonths: MonthKey[] = [];
      let resUnpaidSum = 0;

      relevantMonths.forEach((m) => {
        const mIndex = MONTH_INDEX_MAP[m];
        const monthlyRate = res.customMonthlyRate !== undefined
          ? res.customMonthlyRate
          : mIndex <= 5
          ? 60000
          : 70000;

        resTargetInPeriod += monthlyRate;
        const payment = res.payments[m];

        if (payment && payment.paid) {
          resPaidInPeriod += payment.amount || monthlyRate;
        } else {
          resUnpaidMonths.push(m);
          resUnpaidSum += monthlyRate;
        }
      });

      totalDuesCollected += resPaidInPeriod;
      totalTargetDues += resTargetInPeriod;

      if (resUnpaidMonths.length === 0) {
        fullyPaidHouses++;
      } else {
        unpaidHouses++;
        delinquentList.push({
          resident: res,
          unpaidMonths: resUnpaidMonths,
          unpaidAmount: resUnpaidSum,
        });
      }
    });

    const totalArrears = Math.max(0, totalTargetDues - totalDuesCollected);
    const rawCompliance = totalTargetDues > 0 ? (totalDuesCollected / totalTargetDues) * 100 : 0;
    const complianceRate = Math.round(rawCompliance);
    const complianceRateFormatted = formatPercent(rawCompliance, 2);

    return {
      totalDuesCollected,
      totalTargetDues,
      totalArrears,
      complianceRate,
      complianceRateFormatted,
      fullyPaidHouses,
      unpaidHouses,
      totalOccupiedCount,
      delinquentList: delinquentList.sort((a, b) => b.unpaidAmount - a.unpaidAmount),
    };
  }, [residents, relevantMonths]);

  // Cashbook In/Out/Surplus Metrics for filtered period
  const cashMetrics = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredTransactions.forEach((tx) => {
      if (tx.type === 'MASUK') income += tx.amount;
      else expense += tx.amount;
    });

    const surplus = income - expense;

    const lastMatchingTx = [...chronologicalWithBalance]
      .filter((t) => filteredTransactions.some((ft) => ft.id === t.id))
      .pop();
    const periodClosingBalance = lastMatchingTx ? lastMatchingTx.balanceAfter : currentTotalBalance;

    return {
      income,
      expense,
      surplus,
      periodClosingBalance,
    };
  }, [filteredTransactions, chronologicalWithBalance, currentTotalBalance]);

  // Saldo Awal Bendahara Lama metric (dikecualikan dari iuran wajib maupun luar iuran wajib)
  const initialBalanceMetrics = useMemo(() => {
    const initialTxs = filteredTransactions.filter(
      (t) =>
        t.type === 'MASUK' &&
        (t.category === 'Saldo Awal' || t.description.toLowerCase().includes('saldo awal'))
    );
    const total = initialTxs.reduce((sum, t) => sum + t.amount, 0);
    return {
      total,
      count: initialTxs.length,
      items: initialTxs,
    };
  }, [filteredTransactions]);

  // Non-dues income metrics (pemasukan di luar iuran wajib & di luar saldo awal bendahara lama)
  const nonDuesIncomeMetrics = useMemo(() => {
    const nonDuesTx = filteredTransactions.filter(
      (t) =>
        t.type === 'MASUK' &&
        t.category !== 'Iuran Warga' &&
        t.category !== 'Saldo Awal' &&
        !t.description.toLowerCase().includes('saldo awal')
    );
    const total = nonDuesTx.reduce((sum, t) => sum + t.amount, 0);
    const count = nonDuesTx.length;

    return {
      total,
      count,
      items: nonDuesTx,
    };
  }, [filteredTransactions]);

  // Debts & Piutang summary
  const debtMetrics = useMemo(() => {
    let totalPiutang = 0;
    let remainingPiutang = 0;
    let totalUtang = 0;
    let remainingUtang = 0;

    debts.forEach((d) => {
      if (d.type === 'PIUTANG') {
        totalPiutang += d.amount;
        remainingPiutang += d.status === 'BELUM_LUNAS' ? d.remainingAmount : 0;
      } else {
        totalUtang += d.amount;
        remainingUtang += d.status === 'BELUM_LUNAS' ? d.remainingAmount : 0;
      }
    });

    return {
      totalPiutang,
      remainingPiutang,
      totalUtang,
      remainingUtang,
      piutangList: debts.filter((d) => d.type === 'PIUTANG'),
      utangList: debts.filter((d) => d.type === 'UTANG'),
    };
  }, [debts]);

  // Active Chart Data Calculation
  const activeChartData = useMemo(() => {
    if (chartGranularity === 'HARIAN') {
      const txs = filteredTransactions.length > 0 ? filteredTransactions : transactions;
      const sortedTxs = [...txs].sort((a, b) => a.date.localeCompare(b.date));

      if (sortedTxs.length === 0) return [];

      const dateMap = new Map<string, {
        date: string;
        pemasukan: number;
        pengeluaran: number;
        txList: CashTransaction[];
      }>();

      sortedTxs.forEach((tx) => {
        const existing = dateMap.get(tx.date) || {
          date: tx.date,
          pemasukan: 0,
          pengeluaran: 0,
          txList: [],
        };

        if (tx.type === 'MASUK') {
          existing.pemasukan += tx.amount;
        } else {
          existing.pengeluaran += tx.amount;
        }
        existing.txList.push(tx);
        dateMap.set(tx.date, existing);
      });

      const result: Array<{
        key: string;
        displayLabel: string;
        fullTitle: string;
        pemasukan: number;
        pengeluaran: number;
        surplus: number;
        saldoBerjalan: number;
        txCount: number;
        details: string[];
      }> = [];

      Array.from(dateMap.values()).forEach((item) => {
        const [y, m, d] = item.date.split('-');
        const shortLabel = `${d}/${m}`;
        const monthName = MONTHS[parseInt(m, 10) - 1] || m;
        const fullTitle = `${parseInt(d, 10)} ${monthName} ${y}`;

        const lastTxOnDate = [...chronologicalWithBalance]
          .filter((t) => t.date <= item.date)
          .pop();

        const saldo = lastTxOnDate ? lastTxOnDate.balanceAfter : 0;

        result.push({
          key: item.date,
          displayLabel: shortLabel,
          fullTitle: fullTitle,
          pemasukan: item.pemasukan,
          pengeluaran: item.pengeluaran,
          surplus: item.pemasukan - item.pengeluaran,
          saldoBerjalan: saldo,
          txCount: item.txList.length,
          details: item.txList.map(
            (t) => `${t.type === 'MASUK' ? '+ ' : '- '}${formatRupiah(t.amount)} (${t.description})`
          ),
        });
      });

      return result;
    }

    if (chartGranularity === 'BULANAN') {
      let running = 0;
      return MONTHS.map((monthName, idx) => {
        const monthNum = idx + 1;
        const monthPrefix = `${selectedYear}-${monthNum < 10 ? `0${monthNum}` : monthNum}`;

        const totalTxMasuk = transactions
          .filter((t) => t.type === 'MASUK' && t.date.startsWith(monthPrefix))
          .reduce((sum, t) => sum + t.amount, 0);

        const totalTxKeluar = transactions
          .filter((t) => t.type === 'KELUAR' && t.date.startsWith(monthPrefix))
          .reduce((sum, t) => sum + t.amount, 0);

        const surplus = totalTxMasuk - totalTxKeluar;
        running += surplus;

        return {
          key: monthPrefix,
          displayLabel: monthName.slice(0, 3),
          fullTitle: `Bulan ${monthName} ${selectedYear}`,
          pemasukan: totalTxMasuk,
          pengeluaran: totalTxKeluar,
          surplus,
          saldoBerjalan: running,
          txCount: transactions.filter((t) => t.date.startsWith(monthPrefix)).length,
          details: [],
        };
      });
    }

    if (chartGranularity === 'TRIWULAN') {
      let running = 0;
      return QUARTERS.map((q) => {
        const totalTxMasuk = transactions
          .filter((t) => {
            const m = t.date.slice(5, 7);
            return t.date.startsWith(selectedYear) && m >= q.startMonth && m <= q.endMonth && t.type === 'MASUK';
          })
          .reduce((sum, t) => sum + t.amount, 0);

        const totalTxKeluar = transactions
          .filter((t) => {
            const m = t.date.slice(5, 7);
            return t.date.startsWith(selectedYear) && m >= q.startMonth && m <= q.endMonth && t.type === 'KELUAR';
          })
          .reduce((sum, t) => sum + t.amount, 0);

        const surplus = totalTxMasuk - totalTxKeluar;
        running += surplus;

        return {
          key: q.id,
          displayLabel: q.shortLabel,
          fullTitle: `${q.label} ${selectedYear}`,
          pemasukan: totalTxMasuk,
          pengeluaran: totalTxKeluar,
          surplus,
          saldoBerjalan: running,
          txCount: transactions.filter((t) => {
            const m = t.date.slice(5, 7);
            return t.date.startsWith(selectedYear) && m >= q.startMonth && m <= q.endMonth;
          }).length,
          details: [],
        };
      });
    }

    const years = Array.from(new Set(transactions.map((t) => t.date.slice(0, 4)))).sort();
    if (years.length === 0) years.push('2026');

    let yearlyRunning = 0;
    return years.map((y) => {
      const totalTxMasuk = transactions
        .filter((t) => t.type === 'MASUK' && t.date.startsWith(y))
        .reduce((sum, t) => sum + t.amount, 0);

      const totalTxKeluar = transactions
        .filter((t) => t.type === 'KELUAR' && t.date.startsWith(y))
        .reduce((sum, t) => sum + t.amount, 0);

      const surplus = totalTxMasuk - totalTxKeluar;
      yearlyRunning += surplus;

      return {
        key: y,
        displayLabel: `Th ${y}`,
        fullTitle: `Tahun ${y}`,
        pemasukan: totalTxMasuk,
        pengeluaran: totalTxKeluar,
        surplus,
        saldoBerjalan: yearlyRunning,
        txCount: transactions.filter((t) => t.date.startsWith(y)).length,
        details: [],
      };
    });
  }, [chartGranularity, filteredTransactions, transactions, selectedYear, chronologicalWithBalance]);

  // Expense Category Breakdown for the filtered period
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;

    filteredTransactions
      .filter((t) => t.type === 'KELUAR')
      .forEach((t) => {
        map[t.category] = (map[t.category] || 0) + t.amount;
        total += t.amount;
      });

    return Object.entries(map)
      .map(([name, value], index) => {
        const rawPercentage = total > 0 ? (value / total) * 100 : 0;
        return {
          name,
          value,
          percentage: rawPercentage,
          formattedPercentage: formatPercent(rawPercentage, 2),
          color: PIE_COLORS[index % PIE_COLORS.length],
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Current period label text
  const currentPeriodText = useMemo(() => {
    if (periodType === 'BULANAN') return `Bulan ${selectedMonth} ${selectedYear}`;
    if (periodType === 'TRIWULAN') {
      const q = QUARTERS.find((item) => item.id === selectedQuarter);
      return `${q ? q.label : selectedQuarter} ${selectedYear}`;
    }
    if (periodType === 'RENTANG_TANGGAL') {
      return `${formatDateIndo(customStartDate)} s.d. ${formatDateIndo(customEndDate)}`;
    }
    if (periodType === 'SEMUA') {
      return 'Semua Riwayat Transaksi';
    }
    return `Tahun Anggaran ${selectedYear}`;
  }, [periodType, selectedMonth, selectedYear, selectedQuarter, customStartDate, customEndDate]);

  // Generate Formal Green-Themed Printable HTML Document
  const generateReportHtml = () => {
    // Tentukan tanggal acuan untuk tanda tangan laporan (akhir periode atau hari ini)
    const reportDateStr = periodType === 'BULANAN'
      ? `${selectedYear}-${(MONTHS.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}-28`
      : new Date().toISOString().slice(0, 10);

    const chairOfficer = getOfficerForDate(profile, 'Ketua RT', reportDateStr);
    const treasurerOfficer = getOfficerForDate(profile, 'Bendahara', reportDateStr);

    return `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Laporan Kas & Keuangan RT 05 / RW 08 Satriajaya - ${currentPeriodText}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 15mm 15mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box;
          }
          body {
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            color: #0f172a;
            line-height: 1.4;
            font-size: 10.5pt;
            margin: 0;
            padding: 12px;
            background-color: #ffffff;
          }
          .kop {
            background: linear-gradient(135deg, #065f46 0%, #047857 100%) !important;
            color: #ffffff !important;
            padding: 16px 20px;
            border-radius: 10px;
            margin-bottom: 16px;
            text-align: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            border-bottom: 3px solid #10b981;
          }
          .kop h2 {
            font-size: 15pt;
            font-weight: 800;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #ffffff !important;
          }
          .kop h3 {
            font-size: 11pt;
            font-weight: 600;
            margin: 3px 0 0 0;
            text-transform: uppercase;
            color: #a7f3d0 !important;
          }
          .kop p {
            font-size: 8.5pt;
            margin: 4px 0 0 0;
            color: #ecfdf5 !important;
          }
          .doc-header {
            text-align: center;
            margin: 12px 0 16px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
          }
          .doc-header h1 {
            font-size: 13pt;
            font-weight: 800;
            margin: 0;
            text-transform: uppercase;
            color: #065f46 !important;
            letter-spacing: 0.5px;
          }
          .doc-header p {
            font-size: 9.5pt;
            margin: 3px 0 0 0;
            color: #475569;
          }
          .section-title {
            font-size: 10.5pt;
            font-weight: 700;
            margin: 14px 0 6px 0;
            text-transform: uppercase;
            color: #065f46 !important;
            display: flex;
            align-items: center;
            gap: 6px;
            border-left: 4px solid #10b981;
            padding-left: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 9.5pt;
            background-color: #ffffff;
          }
          th {
            background-color: #065f46 !important;
            color: #ffffff !important;
            font-weight: 700;
            text-align: left;
            padding: 7px 9px;
            border: 1px solid #047857;
            font-size: 9pt;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          td {
            border: 1px solid #cbd5e1;
            padding: 6px 9px;
            color: #1e293b;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
          .font-bold { font-weight: 700; }
          .text-income { color: #047857 !important; font-weight: 700; }
          .text-expense { color: #b91c1c !important; font-weight: 700; }
          .bg-total { background-color: #f1f5f9 !important; font-weight: 700; }
          .bg-highlight {
            background-color: #ecfdf5 !important;
            border-left: 4px solid #10b981 !important;
            font-weight: 800;
            color: #065f46 !important;
          }
          .badge-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 9999px;
            font-size: 8pt;
            font-weight: 700;
            background-color: #d1fae5 !important;
            color: #065f46 !important;
            border: 1px solid #a7f3d0;
          }
          .signatures {
            width: 100%;
            border: none;
            margin-top: 25px;
            background: transparent;
          }
          .signatures td {
            border: none;
            padding: 0;
            text-align: center;
            width: 50%;
            background: transparent;
          }
          .sig-space { height: 55px; }
          .sig-name {
            font-weight: 700;
            border-bottom: 2px solid #0f172a;
            display: inline-block;
            min-width: 180px;
            padding-bottom: 2px;
            color: #0f172a;
          }
          .footer-note {
            font-size: 8pt;
            color: #64748b;
            text-align: center;
            margin-top: 18px;
            font-style: italic;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="background:#0f172a; color:#fff; padding:12px 18px; margin-bottom:16px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="display:inline-block; width:10px; height:10px; background:#10b981; border-radius:50%;"></span>
            <span><strong>Pratinjau Cetak Laporan Resmi Hijau</strong> — RT 05 / RW 08 Satriajaya</span>
          </div>
          <button onclick="window.print()" style="background:#10b981; color:#fff; border:none; padding:8px 18px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12px; box-shadow:0 2px 4px rgba(0,0,0,0.2);">
            🖨 Cetak / Simpan ke PDF
          </button>
        </div>

        <div class="kop">
          <div style="display: flex; align-items: center; justify-content: center; gap: 16px;">
            <div style="width: 62px; height: 62px; background: #ffffff; border-radius: 50%; padding: 2px; flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.2); overflow: hidden; display: flex; align-items: center; justify-content: center;">
              <img src="/logo-rt05.png" alt="Logo RT 05" style="width: 100%; height: 100%; object-fit: contain; border-radius: 50%;" />
            </div>
            <div style="text-align: center;">
              <h2>PENGURUS RUKUN TETANGGA 05 / RUKUN WARGA 08</h2>
              <h3>DESA SATRIAJAYA, KECAMATAN TAMBUN UTARA, KABUPATEN BEKASI</h3>
              <p>Sekretariat: RT 05 / RW 08 Satriajaya, Tambun Utara, Bekasi, Jawa Barat</p>
            </div>
          </div>
        </div>

        <div class="doc-header">
          <h1>LAPORAN PERTANGGUNGJAWABAN KAS & KEUANGAN RT</h1>
          <p>Periode Laporan: <strong>${currentPeriodText}</strong></p>
        </div>

        <div class="section-title">I. Ringkasan Eksekutif Arus Kas & Saldo RT</div>
        <table>
          <thead>
            <tr>
              <th>Uraian Rekapitulasi Kas</th>
              <th class="text-right" style="width: 150px;">Jumlah Nominal</th>
              <th style="width: 220px;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Pemasukan Kas</td>
              <td class="text-right font-mono text-income">${formatRupiah(cashMetrics.income)}</td>
              <td>Iuran: ${formatRupiah(duesMetrics.totalDuesCollected)} | Luar Iuran: ${formatRupiah(nonDuesIncomeMetrics.total)}${initialBalanceMetrics.total > 0 ? ` | Saldo Awal Bendahara Lama: ${formatRupiah(initialBalanceMetrics.total)}` : ''}</td>
            </tr>
            <tr>
              <td>Total Pengeluaran Kas Operasional</td>
              <td class="text-right font-mono text-expense">${formatRupiah(cashMetrics.expense)}</td>
              <td>Biaya operasional, kebersihan & keamanan</td>
            </tr>
            <tr class="bg-total">
              <td>Surplus / (Defisit) Periode Ini</td>
              <td class="text-right font-mono font-bold ${cashMetrics.surplus >= 0 ? 'text-income' : 'text-expense'}">
                ${formatRupiah(cashMetrics.surplus)}
              </td>
              <td>Selisih pemasukan vs pengeluaran</td>
            </tr>
            <tr class="bg-highlight">
              <td>SALDO KAS RT TERKINI</td>
              <td class="text-right font-mono font-bold" style="font-size: 11pt; color: #065f46 !important;">
                ${formatRupiah(currentTotalBalance)}
              </td>
              <td style="color: #065f46 !important;">Kas fisik & rekening kas RT 05 / RW 08</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">II. Rekapitulasi Iuran & Kepatuhan Warga (${duesMetrics.totalOccupiedCount} KK Aktif)</div>
        <table>
          <thead>
            <tr>
              <th>Target Iuran Periode</th>
              <th class="text-right">Iuran Diterima</th>
              <th class="text-right">Total Tunggakan</th>
              <th class="text-center">Kepatuhan Warga</th>
              <th class="text-center">Status Lunas</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-mono">${formatRupiah(duesMetrics.totalTargetDues)}</td>
              <td class="text-right font-mono text-income">${formatRupiah(duesMetrics.totalDuesCollected)}</td>
              <td class="text-right font-mono text-expense">${formatRupiah(duesMetrics.totalArrears)}</td>
              <td class="text-center">
                <span class="badge-status">${duesMetrics.complianceRateFormatted}</span>
              </td>
              <td class="text-center font-bold">${duesMetrics.fullyPaidHouses} dari ${duesMetrics.totalOccupiedCount} KK Lunas</td>
            </tr>
          </tbody>
        </table>

        ${categoryBreakdown.length > 0 ? `
        <div class="section-title">III. Rincian Alokasi Realisasi Pengeluaran Kas</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px;" class="text-center">No</th>
              <th>Pos Kategori Pengeluaran</th>
              <th class="text-right" style="width: 150px;">Realisasi Biaya</th>
              <th class="text-center" style="width: 90px;">Porsi (%)</th>
            </tr>
          </thead>
          <tbody>
            ${categoryBreakdown.map((cat, idx) => `
              <tr>
                <td class="text-center font-mono">${idx + 1}</td>
                <td>${cat.name}</td>
                <td class="text-right font-mono font-bold">${formatRupiah(cat.value)}</td>
                <td class="text-center font-mono font-bold">${cat.formattedPercentage}</td>
              </tr>
            `).join('')}
            <tr class="bg-total">
              <td colspan="2" class="text-right font-bold">TOTAL PENGELUARAN</td>
              <td class="text-right font-mono text-expense font-bold">${formatRupiah(cashMetrics.expense)}</td>
              <td class="text-center font-bold font-mono">100,00%</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        ${(debtMetrics.remainingPiutang > 0 || debtMetrics.remainingUtang > 0) ? `
        <div class="section-title">IV. Rekapitulasi Utang & Piutang Kas RT</div>
        <table>
          <thead>
            <tr>
              <th>Jenis Kewajiban / Hak</th>
              <th class="text-right">Total Plafon</th>
              <th class="text-right">Sisa Belum Selesai</th>
              <th>Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Piutang Kasbon RT (Dipinjamkan)</td>
              <td class="text-right font-mono">${formatRupiah(debtMetrics.totalPiutang)}</td>
              <td class="text-right font-mono font-bold" style="color: #b45309 !important;">${formatRupiah(debtMetrics.remainingPiutang)}</td>
              <td>Dana kasbon dipinjamkan yang belum lunas tertagih</td>
            </tr>
            <tr>
              <td>Utang RT (Kewajiban Pengurus)</td>
              <td class="text-right font-mono">${formatRupiah(debtMetrics.totalUtang)}</td>
              <td class="text-right font-mono font-bold text-expense">${formatRupiah(debtMetrics.remainingUtang)}</td>
              <td>Kewajiban pinjaman masuk kas RT</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        <table class="signatures">
          <tr>
            <td>
              Mengetahui,<br>
              <strong>Ketua RT 05 / RW 08 Satriajaya</strong>
              <div class="sig-space"></div>
              <span class="sig-name">${chairOfficer.name || profile.chairpersonName || 'Ketua RT'}</span>
            </td>
            <td>
              ${profile.subdistrict || 'Satriajaya'}, ${formatDateIndo(new Date().toISOString().split('T')[0])}<br>
              <strong>Bendahara Pengurus RT</strong>
              <div class="sig-space"></div>
              <span class="sig-name">${treasurerOfficer.name || profile.treasurerName || 'Bendahara RT'}</span>
            </td>
          </tr>
        </table>

        <div class="footer-note">
          Dokumen laporan pertanggungjawaban keuangan ini diterbitkan secara sah, resmi, dan transparan untuk seluruh warga RT 05 / RW 08 Satriajaya.
        </div>
      </body>
      </html>
    `;
  };

  // Direct In-App Print Trigger using clean dedicated iframe
  const handleTriggerPrint = () => {
    const html = generateReportHtml();
    
    // Create or find hidden iframe for printing
    let iframe = document.getElementById('rt-print-frame') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'rt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 350);
    }
  };

  // Open standalone clean printable document in new tab/window
  const handleOpenStandalonePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      handleTriggerPrint();
      return;
    }

    const html = generateReportHtml();
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Open Print Preview Modal
  const handleOpenPrintModal = () => {
    setIsPrintModalOpen(true);
  };

  // WhatsApp Share Handler
  const handleShareSummary = () => {
    const text =
      `*LAPORAN KAS & KEUANGAN RT TRANSPARAN*\n` +
      `*RT 05 / RW 08 SATRIAJAYA*\n` +
      `🗓 Periode: *${currentPeriodText}*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💵 *RINGKASAN ARUS KAS:*\n` +
      `• Total Pemasukan: *${formatRupiah(cashMetrics.income)}*\n` +
      `• Total Pengeluaran: *${formatRupiah(cashMetrics.expense)}*\n` +
      `• Surplus / (Defisit): *${formatRupiah(cashMetrics.surplus)}*\n` +
      `• Saldo Kas RT: *${formatRupiah(currentTotalBalance)}*\n\n` +
      `🏘 *STATUS IURAN & KEPATUHAN:*\n` +
      `• Iuran Warga Terkumpul: *${formatRupiah(duesMetrics.totalDuesCollected)}*\n` +
      `• Total Tunggakan Warga: *${formatRupiah(duesMetrics.totalArrears)}*\n` +
      `• Tingkat Kepatuhan: *${duesMetrics.complianceRate}%* (${duesMetrics.fullyPaidHouses}/${duesMetrics.totalOccupiedCount} KK Lunas)\n\n` +
      `📑 *UTANG & PIUTANG (KASBON):*\n` +
      `• Piutang Kasbon Belum Lunas: *${formatRupiah(debtMetrics.remainingPiutang)}*\n` +
      `• Kewajiban Utang RT: *${formatRupiah(debtMetrics.remainingUtang)}*\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Laporan resmi dapat dicek melalui portal transparansi RT.\n\n` +
      `_Salam rukun,_\n*Pengurus RT 05 / RW 08 Satriajaya*`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Custom Tooltip Formatter for Recharts
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataItem = payload[0]?.payload;
      return (
        <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs font-sans space-y-2 max-w-xs">
          <div className="border-b border-slate-700 pb-1.5 flex items-center justify-between">
            <span className="font-bold text-slate-200">{dataItem?.fullTitle || label}</span>
            {dataItem?.txCount > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700">
                {dataItem.txCount} Transaksi
              </span>
            )}
          </div>

          <div className="space-y-1">
            {payload.map((entry: any, index: number) => (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                  <span>{entry.name}:</span>
                </span>
                <span className="font-mono font-bold text-white">
                  {formatRupiah(entry.value)}
                </span>
              </div>
            ))}
          </div>

          {dataItem?.details && dataItem.details.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                Rincian Transaksi Hari Ini:
              </span>
              <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1 text-[10px] text-slate-300 font-mono">
                {dataItem.details.map((detail: string, i: number) => (
                  <div key={i} className="truncate" title={detail}>
                    {detail}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Top Header Actions (Hidden in Print) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>Laporan Keuangan & Kas Transparan</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Analisis grafik arus kas, saldo berjalan, iuran warga, kepatuhan, tunggakan, dan utang-piutang
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleShareSummary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer border border-emerald-200/60"
          >
            <Share2 className="w-4 h-4" />
            <span>Bagikan WhatsApp</span>
          </button>
          <button
            onClick={handleOpenPrintModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak PDF Resmi</span>
          </button>
        </div>
      </div>

      {/* FILTER PANEL JANGKA WAKTU & DATA KEUANGAN (Hidden in Print) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
            <Filter className="w-4 h-4 text-emerald-600" />
            <span>Filter Jangka Waktu & Periode Laporan</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Pilih jangka waktu untuk menyesuaikan seluruh kalkulasi, grafik & cetak</span>
          </div>
        </div>

        {/* Period Type Selection Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <button
            onClick={() => setPeriodType('TAHUNAN')}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
              periodType === 'TAHUNAN'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            📅 Tahunan (2026)
          </button>
          <button
            onClick={() => setPeriodType('BULANAN')}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
              periodType === 'BULANAN'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            🗓 Bulanan
          </button>
          <button
            onClick={() => setPeriodType('TRIWULAN')}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
              periodType === 'TRIWULAN'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            📊 Triwulan (Kuartal)
          </button>
          <button
            onClick={() => setPeriodType('RENTANG_TANGGAL')}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center ${
              periodType === 'RENTANG_TANGGAL'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            ⏱ Rentang Tanggal
          </button>
          <button
            onClick={() => setPeriodType('SEMUA')}
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer text-center col-span-2 sm:col-span-1 ${
              periodType === 'SEMUA'
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            📁 Semua Riwayat
          </button>
        </div>

        {/* Secondary Detailed Filter Controls */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 flex flex-wrap items-center gap-3 text-xs">
          {periodType === 'TAHUNAN' && (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">Pilih Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              >
                <option value="2026">Tahun 2026</option>
                <option value="2025">Tahun 2025</option>
              </select>
            </div>
          )}

          {periodType === 'BULANAN' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="2026">2026</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Bulan:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value as MonthKey)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {MONTHS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {periodType === 'TRIWULAN' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Tahun:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  <option value="2026">2026</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Pilih Triwulan:</span>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                >
                  {QUARTERS.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {periodType === 'RENTANG_TANGGAL' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Dari Tanggal:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">Sampai Tanggal:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {periodType === 'SEMUA' && (
            <span className="text-slate-600 font-medium">
              Menampilkan seluruh data pembukuan kas dari awal transaksi hingga saat ini.
            </span>
          )}

          <div className="ml-auto text-[11px] text-slate-500 font-medium">
            Periode Aktif: <strong className="text-slate-900">{currentPeriodText}</strong> ({filteredTransactions.length} Transaksi)
          </div>
        </div>
      </div>

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Iuran Terkumpul & Pemasukan Luar Iuran Wajib */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider">Iuran & Pemasukan Lain</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">Iuran Wajib</span>
                <div className="text-xl font-black text-emerald-700 font-mono tracking-tight">
                  {formatRupiah(duesMetrics.totalDuesCollected)}
                </div>
              </div>
              <div className="border-l border-slate-100 pl-2">
                <span className="text-[10px] uppercase font-bold text-blue-600 block leading-tight">Luar Iuran Wajib</span>
                <div className="text-sm font-black text-blue-700 font-mono tracking-tight mt-1">
                  {formatRupiah(nonDuesIncomeMetrics.total)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100 flex-wrap gap-1">
            <span>{duesMetrics.fullyPaidHouses} dari {duesMetrics.totalOccupiedCount} KK Lunas</span>
            {initialBalanceMetrics.total > 0 ? (
              <span className="font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-200" title="Saldo awal penyerahan bendahara lama">
                Saldo Awal: {formatRupiah(initialBalanceMetrics.total)}
              </span>
            ) : (
              <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px] border border-blue-200/60">
                {nonDuesIncomeMetrics.count > 0 ? `${nonDuesIncomeMetrics.count} tx luar iuran` : '0 tx luar iuran'}
              </span>
            )}
          </div>
        </div>

        {/* 2. Total Tunggakan & Kepatuhan */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Tunggakan & Kepatuhan</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 font-mono">
              {formatRupiah(duesMetrics.totalArrears)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>Kepatuhan: <strong className="text-slate-800">{duesMetrics.complianceRate}%</strong></span>
            <span className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
              duesMetrics.complianceRate >= 90 ? 'bg-emerald-100 text-emerald-800' : duesMetrics.complianceRate >= 75 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {duesMetrics.complianceRate >= 90 ? 'Sangat Baik' : duesMetrics.complianceRate >= 75 ? 'Baik' : 'Perlu Diingatkan'}
            </span>
          </div>
        </div>

        {/* 3. Total Pemasukan vs Pengeluaran Kas */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Arus Kas Periode</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xs font-medium text-slate-600 space-y-0.5">
            <div className="flex justify-between items-center">
              <span>Masuk:</span>
              <span className="font-mono font-bold text-emerald-700">{formatRupiah(cashMetrics.income)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Keluar:</span>
              <span className="font-mono font-bold text-rose-600">{formatRupiah(cashMetrics.expense)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
            <span>Surplus Periode:</span>
            <span className={`font-mono font-bold ${cashMetrics.surplus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {formatRupiah(cashMetrics.surplus)}
            </span>
          </div>
        </div>

        {/* 4. Saldo Kas & Utang Piutang */}
        <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 text-white p-4.5 rounded-2xl shadow-xs border border-emerald-800/40">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider">Saldo Kas RT & Kasbon</span>
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
            {formatRupiah(currentTotalBalance)}
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-300 mt-2 pt-2 border-t border-slate-700/60">
            <span>Piutang: <strong className="text-amber-300 font-mono">{formatRupiah(debtMetrics.remainingPiutang)}</strong></span>
            <span>Utang RT: <strong className="text-rose-300 font-mono">{formatRupiah(debtMetrics.remainingUtang)}</strong></span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs (Hidden in Print) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1 overflow-x-auto print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Grafik & Ringkasan Eksekutif</span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Buku Besar Transaksi Kas ({filteredTransactions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('dues')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'dues'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          <span>Rekap Iuran & Tunggakan Warga</span>
        </button>
        <button
          onClick={() => setActiveTab('debts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'debts'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Utang & Piutang Kasbon ({debts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'categories'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <PieChartIcon className="w-3.5 h-3.5" />
          <span>Rincian Pengeluaran per Kategori</span>
        </button>
      </div>

      {/* TAB 1: GRAFIK & RINGKASAN EKSEKUTIF */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Main Chart Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>
                    Grafik Tren Pemasukan, Pengeluaran & Saldo Berjalan (
                    {chartGranularity === 'HARIAN' && 'Harian Sesuai Tanggal Transaksi'}
                    {chartGranularity === 'BULANAN' && `Bulanan Th ${selectedYear}`}
                    {chartGranularity === 'TRIWULAN' && `Triwulan Th ${selectedYear}`}
                    {chartGranularity === 'TAHUNAN' && 'Perbandingan Tahunan'}
                    )
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {chartGranularity === 'HARIAN' && 'Menampilkan pemasukan, pengeluaran, dan saldo kas riil per setiap tanggal transaksi'}
                  {chartGranularity === 'BULANAN' && 'Menampilkan total akumulasi pemasukan, pengeluaran, dan saldo per bulan (Jan - Des)'}
                  {chartGranularity === 'TRIWULAN' && 'Menampilkan total kuartal Q1, Q2, Q3, dan Q4'}
                  {chartGranularity === 'TAHUNAN' && 'Menampilkan pertumbuhan kas antar tahun anggaran'}
                </p>
              </div>

              {/* View Granularity Selector & Metric View Selector */}
              <div className="flex flex-wrap items-center gap-2 print:hidden">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setChartGranularity('HARIAN')}
                    title="Tampilkan per tanggal transaksi harian"
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                      chartGranularity === 'HARIAN'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <CalendarRange className="w-3 h-3" />
                    <span>Harian</span>
                  </button>
                  <button
                    onClick={() => setChartGranularity('BULANAN')}
                    title="Tampilkan per bulan (Jan - Des)"
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      chartGranularity === 'BULANAN'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => setChartGranularity('TRIWULAN')}
                    title="Tampilkan per triwulan (Q1 - Q4)"
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      chartGranularity === 'TRIWULAN'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Triwulan
                  </button>
                  <button
                    onClick={() => setChartGranularity('TAHUNAN')}
                    title="Tampilkan per tahun"
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      chartGranularity === 'TAHUNAN'
                        ? 'bg-emerald-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tahunan
                  </button>
                </div>

                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setChartMetricView('all')}
                    className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      chartMetricView === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setChartMetricView('cashflow')}
                    className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      chartMetricView === 'cashflow' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Arus Kas
                  </button>
                  <button
                    onClick={() => setChartMetricView('balance')}
                    className={`px-2 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      chartMetricView === 'balance' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Saldo
                  </button>
                </div>
              </div>
            </div>

            {/* Recharts Component */}
            {activeChartData.length === 0 ? (
              <div className="h-80 w-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <Info className="w-8 h-8 text-slate-300 mb-2" />
                <span>Tidak ada data transaksi kas yang sesuai pada periode ini.</span>
              </div>
            ) : (
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={activeChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis
                      dataKey="displayLabel"
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)}jt`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                    {(chartMetricView === 'all' || chartMetricView === 'balance') && (
                      <Area
                        type="monotone"
                        dataKey="saldoBerjalan"
                        name="Saldo Berjalan"
                        fill="#d1fae5"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fillOpacity={0.4}
                      />
                    )}

                    {(chartMetricView === 'all' || chartMetricView === 'cashflow') && (
                      <Bar
                        dataKey="pemasukan"
                        name="Pemasukan Kas"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    )}

                    {(chartMetricView === 'all' || chartMetricView === 'cashflow') && (
                      <Bar
                        dataKey="pengeluaran"
                        name="Pengeluaran Kas"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Secondary Charts: Category Breakdown & Data Table */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-emerald-600" />
                  <span>Komposisi Pengeluaran ({periodType})</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Alokasi biaya operasional berdasarkan kategori
                </p>

                {categoryBreakdown.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    Tidak ada pengeluaran pada periode ini
                  </div>
                ) : (
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={categoryBreakdown.slice(0, 6)}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryBreakdown.slice(0, 6).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value: any) => formatRupiah(Number(value))}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 mt-4 pt-4 border-t border-slate-100 max-h-48 overflow-y-auto">
                {categoryBreakdown.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                      <span className="text-slate-700 truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 shrink-0">
                      {formatRupiah(item.value)} <span className="text-[10px] text-slate-400 font-normal">({item.formattedPercentage})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs lg:col-span-2 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <span>Rincian Titik Data Grafik ({chartGranularity})</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 mb-4">
                  Tabel nilai angka pemasukan, pengeluaran, surplus, dan saldo berjalan
                </p>

                <div className="overflow-x-auto max-h-64 overflow-y-auto touch-pan-x">
                  <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="bg-slate-50 text-slate-700 font-bold border-y border-slate-200">
                        <th className="py-2.5 px-3">Periode / Tanggal</th>
                        <th className="py-2.5 px-3 text-right">Pemasukan</th>
                        <th className="py-2.5 px-3 text-right">Pengeluaran</th>
                        <th className="py-2.5 px-3 text-right">Surplus/(Defisit)</th>
                        <th className="py-2.5 px-3 text-right">Saldo Kas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeChartData.map((row) => (
                        <tr key={row.key} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 font-semibold text-slate-800">
                            {row.fullTitle}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                            {row.pemasukan > 0 ? formatRupiah(row.pemasukan) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-rose-600">
                            {row.pengeluaran > 0 ? formatRupiah(row.pengeluaran) : '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            <span className={row.surplus >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              {formatRupiah(row.surplus)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                            {formatRupiah(row.saldoBerjalan)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BUKU BESAR TRANSAKSI KAS */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Buku Besar Transaksi Kas (Sesuai Filter Periode)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan {filteredTransactions.length} transaksi kas pada periode yang dipilih
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Masuk: {formatRupiah(cashMetrics.income)}
              </span>
              <span className="text-rose-700 font-bold bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                Keluar: {formatRupiah(cashMetrics.expense)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="py-2.5 px-3 text-center w-12">NO</th>
                  <th className="py-2.5 px-3 w-24">TANGGAL</th>
                  <th className="py-2.5 px-3 w-28">NO BUKTI</th>
                  <th className="py-2.5 px-3 w-32">KATEGORI</th>
                  <th className="py-2.5 px-3">URAIAN TRANSAKSI</th>
                  <th className="py-2.5 px-3 text-right w-28">MASUK (DEBET)</th>
                  <th className="py-2.5 px-3 text-right w-28">KELUAR (KREDIT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Tidak ada transaksi kas pada periode yang dipilih.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx, idx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500 bg-slate-50/50">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono whitespace-nowrap text-slate-700">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                        {tx.receiptNumber || '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {tx.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {tx.description}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700">
                        {tx.type === 'MASUK' ? formatRupiah(tx.amount) : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600">
                        {tx.type === 'KELUAR' ? formatRupiah(tx.amount) : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-xs border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3 px-3 text-right uppercase">
                    Total Arus Kas Periode
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-emerald-700">
                    {formatRupiah(cashMetrics.income)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-rose-700">
                    {formatRupiah(cashMetrics.expense)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: REKAP IURAN & DAFTAR TUNGGAKAN WARGA */}
      {activeTab === 'dues' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl">
              <span className="text-xs font-semibold text-emerald-800 uppercase block mb-1">
                Iuran Berhasil Diterima
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-700">
                {formatRupiah(duesMetrics.totalDuesCollected)}
              </div>
              <p className="text-[11px] text-emerald-600 mt-1">
                Realisasi iuran dari warga pada periode {periodType}
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl">
              <span className="text-xs font-semibold text-rose-800 uppercase block mb-1">
                Total Tunggakan Tertunda
              </span>
              <div className="text-2xl font-bold font-mono text-rose-600">
                {formatRupiah(duesMetrics.totalArrears)}
              </div>
              <p className="text-[11px] text-rose-600 mt-1">
                {duesMetrics.unpaidHouses} rumah warga memiliki tagihan tertunda
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl">
              <span className="text-xs font-semibold text-blue-800 uppercase block mb-1">
                Tingkat Kepatuhan Warga
              </span>
              <div className="text-2xl font-bold font-mono text-blue-700">
                {duesMetrics.complianceRate}%
              </div>
              <p className="text-[11px] text-blue-600 mt-1">
                {duesMetrics.fullyPaidHouses} dari {duesMetrics.totalOccupiedCount} rumah lunas tertib
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Daftar Warga dengan Tagihan / Tunggakan Periode Ini</span>
            </h3>

            {duesMetrics.delinquentList.length === 0 ? (
              <div className="py-8 text-center bg-emerald-50 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-emerald-900">Luar Biasa! Tidak Ada Tunggakan</p>
                <p className="text-xs text-emerald-700 mt-0.5">Seluruh warga aktif telah melunasi iuran pada periode ini.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-200">
                      <th className="py-2.5 px-3">NO. RUMAH</th>
                      <th className="py-2.5 px-3">NAMA KEPALA KELUARGA</th>
                      <th className="py-2.5 px-3">BULAN BELUM LUNAS</th>
                      <th className="py-2.5 px-3 text-right">TOTAL TUNGGAKAN</th>
                      <th className="py-2.5 px-3 text-center">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {duesMetrics.delinquentList.map((item) => (
                      <tr key={item.resident.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 bg-slate-50/50">
                          {item.resident.houseNo}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {item.resident.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          <div className="flex flex-wrap gap-1">
                            {item.unpaidMonths.map((m) => (
                              <span key={m} className="px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-medium">
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                          {formatRupiah(item.unpaidAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            Menunggak {item.unpaidMonths.length} Bln
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REKAP UTANG & PIUTANG KASBON */}
      {activeTab === 'debts' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Daftar Piutang RT (Kasbon Dipinjamkan)
                </span>
                <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg">
                  Sisa: {formatRupiah(debtMetrics.remainingPiutang)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Dana kas RT yang dipinjamkan / kasbon yang belum lunas tertagih
              </p>

              <div className="space-y-2">
                {debtMetrics.piutangList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Tidak ada data piutang kasbon.</p>
                ) : (
                  debtMetrics.piutangList.map((p) => (
                    <div key={p.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{p.personName}</span>
                        <span className="text-[11px] text-slate-500">Tanggal: {p.date} • {p.notes || 'Kasbon'}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-amber-700 block">{formatRupiah(p.remainingAmount)}</span>
                        <span className={`text-[10px] font-bold ${p.status === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {p.status === 'LUNAS' ? 'LUNAS' : `Sisa dari ${formatRupiah(p.amount)}`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Daftar Utang RT (Kewajiban Pengurus)
                </span>
                <span className="text-xs font-mono font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-lg">
                  Sisa: {formatRupiah(debtMetrics.remainingUtang)}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Pinjaman atau dana pihak ketiga yang menjadi kewajiban kas RT
              </p>

              <div className="space-y-2">
                {debtMetrics.utangList.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">Tidak ada utang RT tercatat.</p>
                ) : (
                  debtMetrics.utangList.map((u) => (
                    <div key={u.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 block">{u.personName}</span>
                        <span className="text-[11px] text-slate-500">Tanggal: {u.date} • {u.notes || 'Pinjaman Masuk'}</span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-rose-700 block">{formatRupiah(u.remainingAmount)}</span>
                        <span className={`text-[10px] font-bold ${u.status === 'LUNAS' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {u.status === 'LUNAS' ? 'LUNAS' : `Sisa dari ${formatRupiah(u.amount)}`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: RINCIAN PENGELUARAN PER KATEGORI */}
      {activeTab === 'categories' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-emerald-600" />
            <span>Rincian Realisasi Pengeluaran per Kategori ({periodType})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categoryBreakdown.map((item) => (
              <div
                key={item.name}
                className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatRupiah(item.value)}{' '}
                    <span className="text-[10px] text-slate-500 font-normal">
                      ({item.formattedPercentage})
                    </span>
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL PRATINJAU & CETAK DOKUMEN PDF RESMI HIJAU */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header Actions */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-wide">Pratinjau Dokumen Laporan Resmi (PDF Hijau)</h3>
                  <p className="text-[11px] text-slate-400">RT 05 / RW 08 Satriajaya • {currentPeriodText}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenStandalonePrint}
                  title="Buka dokumen di tab baru untuk hasil cetak A4 optimal"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors cursor-pointer border border-slate-700"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru</span>
                </button>
                <button
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Printable Formal Paper Document Preview with Green Header */}
            <div className="p-6 sm:p-10 overflow-y-auto bg-slate-100 flex justify-center">
              <div className="bg-white w-full max-w-3xl p-6 sm:p-10 rounded-xl shadow-lg border border-slate-300 font-sans text-slate-900 text-xs sm:text-sm leading-relaxed">
                {/* Official Letterhead with Rich Green Theme & RT Logo */}
                <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 text-white p-5 rounded-xl shadow-sm mb-6 border-b-4 border-emerald-500 flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                  <RTLogo className="w-16 h-16 sm:w-18 sm:h-18 border-2 border-white/90 shadow-md shrink-0 bg-white" />
                  <div>
                    <h2 className="text-base sm:text-lg font-black tracking-wider uppercase text-white font-sans">
                      PENGURUS RUKUN TETANGGA 05 / RUKUN WARGA 08
                    </h2>
                    <h3 className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-emerald-200 font-sans mt-0.5">
                      DESA SATRIAJAYA, KECAMATAN TAMBUN UTARA, KABUPATEN BEKASI
                    </h3>
                    <p className="text-[11px] text-emerald-100 font-sans mt-1">
                      Sekretariat: RT 05 / RW 08 Satriajaya, Tambun Utara, Bekasi, Jawa Barat
                    </p>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center my-4 pb-3 border-b-2 border-slate-200">
                  <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-emerald-900 font-sans">
                    LAPORAN PERTANGGUNGJAWABAN KAS & KEUANGAN RT
                  </h1>
                  <p className="text-xs text-slate-600 font-sans mt-1">
                    Periode Laporan: <strong className="text-slate-900">{currentPeriodText}</strong>
                  </p>
                </div>

                {/* Section I: Cashflow Summary */}
                <div className="mt-5 mb-2">
                  <h4 className="font-bold uppercase text-xs text-emerald-900 mb-2 flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
                    I. Ringkasan Eksekutif Arus Kas & Saldo RT
                  </h4>
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-emerald-800 text-white font-bold">
                        <th className="border border-emerald-900 p-2 text-left">Uraian Rekapitulasi Kas</th>
                        <th className="border border-emerald-900 p-2 text-right w-36">Jumlah Nominal</th>
                        <th className="border border-emerald-900 p-2 text-left">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="border border-slate-300 p-2 font-medium">Total Pemasukan Kas</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-700">{formatRupiah(cashMetrics.income)}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">
                          Iuran: {formatRupiah(duesMetrics.totalDuesCollected)} • Luar Iuran: {formatRupiah(nonDuesIncomeMetrics.total)}
                          {initialBalanceMetrics.total > 0 && (
                            <span className="text-slate-500 block text-[11px]">
                              Saldo Awal Bendahara Lama: {formatRupiah(initialBalanceMetrics.total)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-slate-300 p-2 font-medium">Total Pengeluaran Kas Operasional</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold text-rose-600">{formatRupiah(cashMetrics.expense)}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">Biaya operasional lingkungan RT</td>
                      </tr>
                      <tr className="bg-slate-50 font-bold">
                        <td className="border border-slate-300 p-2">Surplus / (Defisit) Periode Ini</td>
                        <td className={`border border-slate-300 p-2 text-right font-mono ${cashMetrics.surplus >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {formatRupiah(cashMetrics.surplus)}
                        </td>
                        <td className="border border-slate-300 p-2 text-slate-600">Selisih pemasukan vs pengeluaran</td>
                      </tr>
                      <tr className="bg-emerald-50 font-bold border-t-2 border-emerald-600">
                        <td className="border border-slate-300 p-2 text-emerald-950 font-bold">SALDO KAS RT TERKINI</td>
                        <td className="border border-slate-300 p-2 text-right font-mono text-emerald-800 text-sm font-extrabold">{formatRupiah(currentTotalBalance)}</td>
                        <td className="border border-slate-300 p-2 text-emerald-900">Kas fisik & rekening kas RT 05 / RW 08</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section II: Dues & Compliance */}
                <div className="mt-5 mb-2">
                  <h4 className="font-bold uppercase text-xs text-emerald-900 mb-2 flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
                    II. Rekapitulasi Iuran & Kepatuhan Warga ({duesMetrics.totalOccupiedCount} KK Aktif)
                  </h4>
                  <table className="w-full border-collapse border border-slate-300 text-xs">
                    <thead>
                      <tr className="bg-emerald-800 text-white font-bold">
                        <th className="border border-emerald-900 p-2 text-left">Target Iuran</th>
                        <th className="border border-emerald-900 p-2 text-right">Iuran Diterima</th>
                        <th className="border border-emerald-900 p-2 text-right">Total Tunggakan</th>
                        <th className="border border-emerald-900 p-2 text-center">Kepatuhan Warga</th>
                        <th className="border border-emerald-900 p-2 text-center">Status Lunas</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-slate-300 p-2 font-mono">{formatRupiah(duesMetrics.totalTargetDues)}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-700">{formatRupiah(duesMetrics.totalDuesCollected)}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold text-rose-600">{formatRupiah(duesMetrics.totalArrears)}</td>
                        <td className="border border-slate-300 p-2 text-center">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[10px] border border-emerald-300">
                            {duesMetrics.complianceRateFormatted}
                          </span>
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-semibold">{duesMetrics.fullyPaidHouses} dari {duesMetrics.totalOccupiedCount} KK</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Section III: Expense Category Breakdown */}
                {categoryBreakdown.length > 0 && (
                  <div className="mt-5 mb-2">
                    <h4 className="font-bold uppercase text-xs text-emerald-900 mb-2 flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
                      III. Rincian Alokasi Realisasi Pengeluaran Kas
                    </h4>
                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-emerald-800 text-white font-bold">
                          <th className="border border-emerald-900 p-2 text-center w-10">No</th>
                          <th className="border border-emerald-900 p-2 text-left">Pos Kategori Pengeluaran</th>
                          <th className="border border-emerald-900 p-2 text-right w-36">Realisasi Biaya</th>
                          <th className="border border-emerald-900 p-2 text-center w-20">Porsi (%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {categoryBreakdown.map((cat, idx) => (
                          <tr key={cat.name}>
                            <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                            <td className="border border-slate-300 p-2 font-medium">{cat.name}</td>
                            <td className="border border-slate-300 p-2 text-right font-mono font-bold">{formatRupiah(cat.value)}</td>
                            <td className="border border-slate-300 p-2 text-center font-mono font-semibold">{cat.formattedPercentage}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold">
                          <td colSpan={2} className="border border-slate-300 p-2 text-right font-bold">TOTAL PENGELUARAN</td>
                          <td className="border border-slate-300 p-2 text-right font-mono text-rose-600 font-bold">{formatRupiah(cashMetrics.expense)}</td>
                          <td className="border border-slate-300 p-2 text-center font-bold font-mono">100,00%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Section IV: Debts & Piutang if any */}
                {(debtMetrics.remainingPiutang > 0 || debtMetrics.remainingUtang > 0) && (
                  <div className="mt-5 mb-2">
                    <h4 className="font-bold uppercase text-xs text-emerald-900 mb-2 flex items-center gap-1.5 border-l-4 border-emerald-500 pl-2">
                      IV. Rekapitulasi Utang & Piutang Kas RT
                    </h4>
                    <table className="w-full border-collapse border border-slate-300 text-xs">
                      <thead>
                        <tr className="bg-emerald-800 text-white font-bold">
                          <th className="border border-emerald-900 p-2 text-left">Jenis Kewajiban / Hak</th>
                          <th className="border border-emerald-900 p-2 text-right">Total Plafon</th>
                          <th className="border border-emerald-900 p-2 text-right">Sisa Belum Selesai</th>
                          <th className="border border-emerald-900 p-2 text-left">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-slate-300 p-2 font-medium">Piutang Kasbon RT (Dipinjamkan)</td>
                          <td className="border border-slate-300 p-2 text-right font-mono">{formatRupiah(debtMetrics.totalPiutang)}</td>
                          <td className="border border-slate-300 p-2 text-right font-mono font-bold text-amber-700">{formatRupiah(debtMetrics.remainingPiutang)}</td>
                          <td className="border border-slate-300 p-2 text-slate-600">Dana kasbon dipinjamkan yang belum lunas</td>
                        </tr>
                        <tr>
                          <td className="border border-slate-300 p-2 font-medium">Utang RT (Kewajiban Pengurus)</td>
                          <td className="border border-slate-300 p-2 text-right font-mono">{formatRupiah(debtMetrics.totalUtang)}</td>
                          <td className="border border-slate-300 p-2 text-right font-mono font-bold text-rose-600">{formatRupiah(debtMetrics.remainingUtang)}</td>
                          <td className="border border-slate-300 p-2 text-slate-600">Kewajiban pinjaman masuk kas RT</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Signatures & Stamp */}
                {(() => {
                  const reportDateStr = periodType === 'BULANAN'
                    ? `${selectedYear}-${(MONTHS.indexOf(selectedMonth) + 1).toString().padStart(2, '0')}-28`
                    : new Date().toISOString().slice(0, 10);
                  const previewChair = getOfficerForDate(profile, 'Ketua RT', reportDateStr);
                  const previewTreasurer = getOfficerForDate(profile, 'Bendahara', reportDateStr);

                  return (
                    <div className="mt-8 pt-4 grid grid-cols-2 gap-8 text-center text-xs">
                      <div>
                        <p className="text-slate-600 mb-14">
                          Mengetahui,<br />
                          <strong className="text-slate-900">Ketua RT 05 / RW 08 Satriajaya</strong>
                        </p>
                        <p className="font-bold text-slate-900 border-b-2 border-slate-800 inline-block px-6 pb-0.5">
                          {previewChair.name || profile.chairpersonName || 'Ketua RT'}
                        </p>
                        {previewChair.periodText && (
                          <p className="text-[10px] text-slate-400 mt-0.5">({previewChair.periodText})</p>
                        )}
                      </div>

                      <div>
                        <p className="text-slate-600 mb-14">
                          {profile.subdistrict || 'Satriajaya'}, {formatDateIndo(new Date().toISOString().split('T')[0])}<br />
                          <strong className="text-slate-900">Bendahara Pengurus RT</strong>
                        </p>
                        <p className="font-bold text-slate-900 border-b-2 border-slate-800 inline-block px-6 pb-0.5">
                          {previewTreasurer.name || profile.treasurerName || 'Bendahara RT'}
                        </p>
                        {previewTreasurer.periodText && (
                          <p className="text-[10px] text-slate-400 mt-0.5">({previewTreasurer.periodText})</p>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="mt-8 text-center text-[10px] text-slate-500 italic border-t border-slate-200 pt-3">
                  Dokumen laporan pertanggungjawaban keuangan ini diterbitkan secara sah, resmi, dan transparan untuk seluruh warga RT 05 / RW 08 Satriajaya.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
