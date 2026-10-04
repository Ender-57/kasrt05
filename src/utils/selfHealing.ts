import { Resident, CashTransaction, MonthKey, MONTHS, RTProfile } from '../types';
import { formatRupiah, getRateForResidentMonth } from './formatters';

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
      // We'll calculate arrears through December or the standard way
      // But let's just use a simple lookup
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

  const healedResidents = Array.from(updatedResidentsMap.values());
  return { healedResidents, healedCount };
};
