import { Resident, CashTransaction, MonthKey, MONTHS, RTProfile } from '../types';
import { formatRupiah, getRateForResidentMonth } from './formatters';

/**
 * Redistributes payments for a resident that share the same receipt number
 * so that they match the monthly rates.
 */
export const redistributeResidentPayments = (
  resident: Resident,
  profile?: RTProfile
): { resident: Resident; changed: boolean } => {
  const cloned = JSON.parse(JSON.stringify(resident)) as Resident;
  let changed = false;

  if (!cloned.payments) return { resident: cloned, changed: false };

  // Group payments by receiptNo
  const receiptGroups = new Map<string, Array<{ month: MonthKey; amount: number }>>();
  
  Object.entries(cloned.payments).forEach(([m, p]) => {
    if (p && p.paid && p.receiptNo) {
      const group = receiptGroups.get(p.receiptNo) || [];
      group.push({ month: m as MonthKey, amount: p.amount });
      receiptGroups.set(p.receiptNo, group);
    }
  });

  // For each group with > 1 payments
  receiptGroups.forEach((items, receiptNo) => {
    if (items.length <= 1) return;

    // Check if the amounts are evenly divided (all equal or very close due to rounding)
    const firstAmount = items[0].amount;
    const isEvenlyDivided = items.every(item => Math.abs(item.amount - firstAmount) <= 5);

    if (!isEvenlyDivided) return;

    // Let's check if the standard rates for these months are different
    // For example, Jan-Mei (60k) vs Jun-Des (70k)
    const months = items.map(item => item.month);
    const rates = months.map(m => getRateForResidentMonth(cloned, m, profile));
    const firstRate = rates[0];
    const hasDifferentRates = rates.some(r => r !== firstRate);

    if (!hasDifferentRates) return;

    // Calculate the total amount paid in this receipt group
    const totalReceiptAmount = items.reduce((sum, item) => sum + item.amount, 0);

    // Sort the months chronologically
    const sortedMonths = [...months].sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));

    // Calculate standard rates
    const monthRates = sortedMonths.map(m => {
      const rate = getRateForResidentMonth(cloned, m, profile);
      return { month: m, rate };
    });

    const totalRate = monthRates.reduce((sum, item) => sum + item.rate, 0);

    // Redistribute
    let remaining = totalReceiptAmount;
    const newAmounts = new Map<MonthKey, number>();

    monthRates.forEach((item, index) => {
      let allocated = 0;
      if (index === monthRates.length - 1) {
        allocated = remaining;
      } else {
        if (remaining >= item.rate) {
          allocated = item.rate;
        } else {
          allocated = remaining;
        }
      }
      newAmounts.set(item.month, allocated);
      remaining = Math.max(0, remaining - allocated);
    });

    // Check if the redistribution actually changes the amounts
    let isDifferent = false;
    items.forEach(item => {
      const newAmt = newAmounts.get(item.month) || 0;
      if (newAmt !== item.amount) {
        isDifferent = true;
      }
    });

    if (isDifferent) {
      // Apply the redistribution
      sortedMonths.forEach(m => {
        if (cloned.payments[m]) {
          cloned.payments[m]!.amount = newAmounts.get(m) || 0;
        }
      });
      changed = true;
    }
  });

  return { resident: cloned, changed };
};

/**
 * Scans the database for any mismatches where a transaction is recorded in the cashbook (Buku Kas)
 * but the corresponding resident's iuran payment status (Iuran Warga) is not updated.
 * Returns the list of updated residents and the count of healed payment records.
 */
export const runSelfHealing = (
  residents: Resident[],
  transactions: CashTransaction[],
  profile?: RTProfile
): { healedResidents: Resident[]; healedCount: number } => {
  let healedCount = 0;
  const houseNoToResidentMap = new Map<string, Resident>();
  residents.forEach((r) => {
    houseNoToResidentMap.set(r.houseNo.trim(), r);
  });

  // Clone residents to prevent mutation
  const updatedResidentsMap = new Map<string, Resident>(
    residents.map((r) => [r.id, JSON.parse(JSON.stringify(r))])
  );

  // We only look at income transactions in the "Iuran Warga" category
  const duesTransactions = transactions.filter(
    (tx) => tx.type === 'MASUK' && tx.category === 'Iuran Warga'
  );

  duesTransactions.forEach((tx) => {
    const desc = tx.description || '';
    
    // 1. Find the resident house number from description
    // Standard template: "Iuran warga No. 376 (Supartono) - Bulan Oktober 2026"
    // Let's use a regex to extract the house number following "No."
    const houseNoMatch = desc.match(/No\.\s*([^\s(]+)/i);
    if (!houseNoMatch) return;
    
    const houseNo = houseNoMatch[1].trim();
    const resident = houseNoToResidentMap.get(houseNo);
    if (!resident) return;

    // Get the cloned resident record
    const clonedResident = updatedResidentsMap.get(resident.id);
    if (!clonedResident) return;

    // 2. Identify which months are mentioned in the description
    const foundMonths: MonthKey[] = [];
    MONTHS.forEach((m) => {
      // Case-insensitive search for month name as a discrete word or part of month description
      const regex = new RegExp(`\\b${m}\\b`, 'i');
      if (regex.test(desc)) {
        foundMonths.push(m);
      }
    });

    if (foundMonths.length === 0) return;

    // 3. For each found month, ensure it is marked as paid
    const perMonthAmount = Math.round(tx.amount / foundMonths.length);
    let residentChanged = false;

    foundMonths.forEach((m) => {
      if (!clonedResident.payments) {
        clonedResident.payments = {};
      }

      const payment = clonedResident.payments[m];
      if (!payment || !payment.paid) {
        clonedResident.payments[m] = {
          paid: true,
          amount: payment?.amount || perMonthAmount || 70000,
          paidAt: tx.date,
          receiptNo: tx.receiptNumber || `KW-AUTO-${tx.id.slice(-4)}`,
          note: payment?.note || 'Sinkronisasi Otomatis Kas',
          paymentMethod: 'Tunai', // Fallback
        };
        residentChanged = true;
        healedCount++;
      }
    });

    if (residentChanged) {
      // Recalculate arrears
      let arrears = 0;
      MONTHS.forEach((m) => {
        if (!clonedResident.isVacant) {
          const p = clonedResident.payments[m];
          if (!p || !p.paid) {
            const rate = getRateForResidentMonth(clonedResident, m, profile);
            arrears += rate;
          }
        }
      });

      clonedResident.arrearsAmount = arrears;
      clonedResident.arrearsStatusText = arrears === 0 ? 'LUNAS' : formatRupiah(arrears);
      updatedResidentsMap.set(clonedResident.id, clonedResident);
    }
  });

  // 4. Run payment redistribution for all residents (corrects evenly split multi-month iuran)
  updatedResidentsMap.forEach((clonedResident, id) => {
    const { resident: redistributed, changed } = redistributeResidentPayments(clonedResident, profile);
    if (changed) {
      // Recalculate arrears
      let arrears = 0;
      MONTHS.forEach((m) => {
        if (!redistributed.isVacant) {
          const p = redistributed.payments[m];
          const rate = getRateForResidentMonth(redistributed, m, profile);
          if (!p || !p.paid) {
            arrears += rate;
          } else if (p.amount < rate) {
            arrears += rate - p.amount;
          }
        }
      });

      redistributed.arrearsAmount = arrears;
      redistributed.arrearsStatusText = arrears === 0 ? 'LUNAS' : formatRupiah(arrears);
      updatedResidentsMap.set(id, redistributed);
      healedCount++;
    }
  });

  const healedResidents = Array.from(updatedResidentsMap.values());
  return { healedResidents, healedCount };
};
