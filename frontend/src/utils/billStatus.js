/**
 * Derive a bill's payment status, shared between admin and tenant pages.
 *
 *   no bill                         -> null  (caller decides what to show)
 *   paid_at set                     -> 'paid'    "ชำระค่าเช่าแล้ว"
 *   no payment_due_day configured   -> 'issued'  "ออกบิลแล้ว"
 *   today <= due date               -> 'pending' "รอชำระ"
 *   today >  due date               -> 'overdue' "เกินกำหนด" (with late fee)
 *
 * Bills are expected to carry the apartment's payment_due_day and
 * late_fee_per_day (joined from expense_settings) when calling this.
 */
export function paymentStatus(bill, now = new Date()) {
    if (!bill) return null;
    if (bill.paid_at) {
        return { kind: 'paid', label: 'ชำระค่าเช่าแล้ว',
                 cls: 'bg-green-100 text-green-800' };
    }
    const dueDayRaw = bill.payment_due_day;
    if (dueDayRaw == null || dueDayRaw === '') {
        return { kind: 'issued', label: 'ออกบิลแล้ว',
                 cls: 'bg-blue-100 text-blue-800' };
    }
    // Clamp due day to last day of that month
    const lastDay = new Date(bill.year, bill.month, 0).getDate();
    const day = Math.min(parseInt(dueDayRaw, 10), lastDay);
    const dueDate = new Date(bill.year, bill.month, day, 23, 59, 59);

    if (now.getTime() <= dueDate.getTime()) {
        return { kind: 'pending', label: 'รอชำระ',
                 cls: 'bg-amber-100 text-amber-800' };
    }
    const days = Math.ceil((now.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
    const lateFee = +(Number(bill.late_fee_per_day || 0) * days).toFixed(2);
    return {
        kind: 'overdue', label: 'เกินกำหนด',
        cls: 'bg-red-100 text-red-800',
        days_overdue: days, late_fee: lateFee,
    };
}
