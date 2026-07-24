/**
 * PDFKit-based generators for:
 *   - Rental contract (A4, Thai)
 *   - Bill invoice — Thai landscape (A4 / A5, default A5)
 *   - Bill invoice — English landscape (A4 / A5, default A5)
 *   - Bill invoice — bulk multi-page (single PDF, many bills)
 */
const fs   = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { DEFAULT_CONTRACT_TERMS } = require('./contractDefaults');

const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const ENGLISH_MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

const FONT_REGULAR = path.join(__dirname, 'fonts', 'Sarabun-Regular.ttf');
const FONT_BOLD    = path.join(__dirname, 'fonts', 'Sarabun-Bold.ttf');

function applyFonts(doc) {
    if (fs.existsSync(FONT_REGULAR)) {
        doc.registerFont('thai',      FONT_REGULAR);
        doc.registerFont('thai-bold', fs.existsSync(FONT_BOLD) ? FONT_BOLD : FONT_REGULAR);
    } else {
        doc.registerFont('thai',      'Helvetica');
        doc.registerFont('thai-bold', 'Helvetica-Bold');
    }
    doc.registerFont('reg',  'Helvetica');
    doc.registerFont('bold', 'Helvetica-Bold');
    doc.font('thai');
}

function thaiYear(g) { return Number(g) + 543; }
function fmtMoney(n) {
    return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function intStr(n) {
    if (n === null || n === undefined || n === '') return '';
    const v = Number(n);
    if (!Number.isFinite(v)) return '';
    return String(Math.trunc(v));
}
function fmtThaiDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${thaiYear(d.getFullYear())}`;
}

// ===== Contract (A4 Thai) =====
function generateContractPDF(t, stream) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    applyFonts(doc);
    doc.pipe(stream);

    doc.font('thai-bold').fontSize(20).text('สัญญาเช่าห้องพัก', { align: 'center' });
    doc.moveDown(0.3);
    doc.font('thai-bold').fontSize(14).text(t.apartment_name || '', { align: 'center' });
    doc.font('thai').fontSize(10).text(t.apartment_address || '', { align: 'center' });
    if (t.apartment_phone) doc.text(`โทร: ${t.apartment_phone}`, { align: 'center' });
    doc.moveDown(1);

    doc.fontSize(11);
    doc.text(`ทำที่: ${t.apartment_address || '-'}`);
    doc.text(`วันที่: ${fmtThaiDate(new Date())}`);
    doc.moveDown(0.5);

    doc.font('thai-bold').text('คู่สัญญา');
    doc.font('thai');
    doc.text(`ผู้ให้เช่า: ${t.apartment_name || '-'}`);
    doc.text(`ผู้เช่า:   ${t.full_name}`);
    doc.text(`เลขบัตรประชาชน: ${t.national_id}`);
    if (t.phone_number) doc.text(`โทรศัพท์: ${t.phone_number}`);
    doc.moveDown(0.5);

    doc.font('thai-bold').text('รายละเอียดห้องพัก');
    doc.font('thai');
    doc.text(`ห้องเลขที่: ${t.room_number || '-'}`);
    doc.text(`ค่าเช่าต่อเดือน: ${fmtMoney(t.rental_price)} บาท`);
    doc.text(`วันเริ่มสัญญา: ${fmtThaiDate(t.move_in_date)}`);
    doc.moveDown(0.5);

    doc.font('thai-bold').text('ข้อตกลงและเงื่อนไข');
    doc.font('thai').fontSize(10);
    // Use customized terms from settings if provided, otherwise fall back to defaults.
    const customTerms = (t.contract_terms || '').trim();
    const termLines = customTerms
        ? customTerms.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        : DEFAULT_CONTRACT_TERMS;
    termLines.forEach((line) => doc.text(line, { paragraphGap: 4 }));
    doc.moveDown(2);

    doc.fontSize(11);
    doc.text('ลงชื่อ ............................................. ผู้ให้เช่า');
    doc.moveDown(1);
    doc.text('ลงชื่อ ............................................. ผู้เช่า');
    doc.moveDown(1);
    doc.text('ลงชื่อ ............................................. พยาน');

    doc.end();
}

// =====================================================
// Render ONE invoice page on the given doc.
// Used by both single-bill and bulk-PDF generators.
// =====================================================
function drawInvoiceThai(doc, b) {
    const M       = 28;
    const pageW   = doc.page.width;
    const usableW = pageW - M * 2;
    const BLUE    = '#0000ff';
    const WHITE   = '#ffffff';

    const mmPadded = String(b.month).padStart(2, '0');
    const billNo   = `${b.year}${mmPadded}${b.room_number || ''}`;

    doc.fillColor('black').font('thai').fontSize(11)
       .text(`บิลเลขที่      ${billNo}`, M, M, { width: usableW, align: 'right' });

    doc.moveDown(0.6);
    const aptHeader = [b.apartment_name, b.apartment_address].filter(Boolean).join(' ');
    doc.font('thai-bold').fontSize(15)
       .text(aptHeader, M, doc.y, { width: usableW, align: 'center' });

    doc.moveDown(0.2);
    doc.font('thai').fontSize(11).text(
        `บิลเรียกเก็บเงินค่าเช่าห้อง ประจำเดือน ${mmPadded} ${b.year}`,
        M, doc.y, { width: usableW, align: 'center' }
    );

    doc.moveDown(0.8);
    doc.font('thai').fontSize(11).text(
        `ห้อง :       ${b.room_number || '-'}`,
        M, doc.y, { width: usableW, align: 'right' }
    );
    doc.moveDown(0.4);

    const cols = [
        { key: 'label',  title: '',                w: 0.20, align: 'center' },
        { key: 'last',   title: 'จดเดือนที่แล้ว',  w: 0.13, align: 'center' },
        { key: 'cur',    title: 'จดเดือนนี้',      w: 0.13, align: 'center' },
        { key: 'units',  title: 'จำนวนหน่วย',     w: 0.13, align: 'center' },
        { key: 'rate',   title: 'ราคาต่อหน่วย',   w: 0.13, align: 'center' },
        { key: 'amount', title: 'รวม (บาท)',       w: 0.28, align: 'center' },
    ];
    let xCursor = M;
    const colXs = cols.map((c) => {
        const px = usableW * c.w;
        const out = { ...c, x: xCursor, px };
        xCursor += px;
        return out;
    });

    let rowY = doc.y;
    const headerH = 22;
    doc.rect(M, rowY, usableW, headerH).fillColor(BLUE).fill();
    doc.fillColor(WHITE).font('thai').fontSize(11);
    colXs.forEach((c) =>
        doc.text(c.title, c.x + 4, rowY + 6, { width: c.px - 8, align: c.align })
    );
    rowY += headerH;

    const wUsage = b.rollover_water
        ? (Number(b.water_max_units || 9999) - Number(b.water_units_last)) + Number(b.water_units_current)
        : Number(b.water_units_current) - Number(b.water_units_last);
    const eUsage = b.rollover_electricity
        ? (Number(b.electricity_max_units || 9999) - Number(b.electricity_units_last)) + Number(b.electricity_units_current)
        : Number(b.electricity_units_current) - Number(b.electricity_units_last);

    const dataRows = [
        { label: 'ค่าน้ำ', last: intStr(b.water_units_last), cur: intStr(b.water_units_current),
          units: intStr(wUsage), rate: intStr(b.water_price_per_unit), amount: intStr(b.water_cost) },
        { label: 'ค่าไฟ', last: intStr(b.electricity_units_last), cur: intStr(b.electricity_units_current),
          units: intStr(eUsage), rate: intStr(b.electricity_price_per_unit), amount: intStr(b.electricity_cost) },
        { label: 'ค่าเช่าห้อง',         last: '', cur: '', units: '', rate: '', amount: intStr(b.rent_cost) },
    ];
    // Common-area electricity fee — only shown when it was actually charged.
    if (Number(b.common_fee) > 0) {
        dataRows.push({ label: 'ค่าบริการไฟส่วนกลาง', last: '', cur: '', units: '', rate: '',
                        amount: intStr(b.common_fee) });
    }
    dataRows.push({ label: 'ค่าโทรศัพท์ และอื่นๆ', last: '', cur: '', units: '', rate: '', amount: intStr(b.other_cost) });

    const rowH = 26;
    doc.fillColor('black').font('thai').fontSize(11);
    dataRows.forEach((r) => {
        colXs.forEach((c) =>
            doc.text(String(r[c.key] ?? ''), c.x + 4, rowY + 6,
                     { width: c.px - 8, align: c.align })
        );
        rowY += rowH;
        doc.moveTo(M, rowY).lineTo(M + usableW, rowY).strokeColor('#cccccc').stroke();
    });

    const totalH = 26;
    doc.rect(M, rowY, usableW, totalH).fillColor(BLUE).fill();
    doc.fillColor(WHITE).font('thai-bold').fontSize(13);
    const labelW = colXs.slice(0, 5).reduce((s, c) => s + c.px, 0);
    doc.text('รวมค่าเช่า', M + 4, rowY + 6, { width: labelW - 8, align: 'right' });
    doc.text(intStr(b.total_cost), colXs[5].x + 4, rowY + 6,
             { width: colXs[5].px - 8, align: 'center' });
    rowY += totalH;

    if (b.invoice_footer_text) {
        doc.fillColor('#475569').font('thai').fontSize(10)
           .text(b.invoice_footer_text, M, rowY + 14, { width: usableW, align: 'left' });
    }
    doc.fillColor('black');
}

function drawInvoiceEnglish(doc, b) {
    const M       = 28;
    const pageW   = doc.page.width;
    const usableW = pageW - M * 2;
    const BLUE    = '#0000ff';
    const WHITE   = '#ffffff';

    const mmPadded = String(b.month).padStart(2, '0');
    const billNo   = `${b.year}${mmPadded}${b.room_number || ''}`;

    doc.fillColor('black').font('reg').fontSize(11)
       .text(`Invoice #      ${billNo}`, M, M, { width: usableW, align: 'right' });

    doc.moveDown(0.6);
    const aptHeader = [b.apartment_name, b.apartment_address].filter(Boolean).join(' ');
    doc.font('bold').fontSize(15).text(aptHeader, M, doc.y, { width: usableW, align: 'center' });

    doc.moveDown(0.2);
    doc.font('reg').fontSize(11).text(
        `Rent invoice for ${ENGLISH_MONTHS[b.month - 1]} ${b.year}`,
        M, doc.y, { width: usableW, align: 'center' }
    );

    doc.moveDown(0.8);
    doc.text(`Room :       ${b.room_number || '-'}`,
             M, doc.y, { width: usableW, align: 'right' });
    doc.moveDown(0.4);

    const cols = [
        { key: 'label',  title: '',            w: 0.20, align: 'center' },
        { key: 'last',   title: 'Prev meter',  w: 0.13, align: 'center' },
        { key: 'cur',    title: 'Current',     w: 0.13, align: 'center' },
        { key: 'units',  title: 'Units',       w: 0.13, align: 'center' },
        { key: 'rate',   title: 'Rate',        w: 0.13, align: 'center' },
        { key: 'amount', title: 'Amount (THB)',w: 0.28, align: 'center' },
    ];
    let xCursor = M;
    const colXs = cols.map((c) => {
        const px = usableW * c.w;
        const out = { ...c, x: xCursor, px };
        xCursor += px;
        return out;
    });

    let rowY = doc.y;
    const headerH = 22;
    doc.rect(M, rowY, usableW, headerH).fillColor(BLUE).fill();
    doc.fillColor(WHITE).font('reg').fontSize(11);
    colXs.forEach((c) => doc.text(c.title, c.x + 4, rowY + 6, { width: c.px - 8, align: c.align }));
    rowY += headerH;

    const wUsage = b.rollover_water
        ? (Number(b.water_max_units || 9999) - Number(b.water_units_last)) + Number(b.water_units_current)
        : Number(b.water_units_current) - Number(b.water_units_last);
    const eUsage = b.rollover_electricity
        ? (Number(b.electricity_max_units || 9999) - Number(b.electricity_units_last)) + Number(b.electricity_units_current)
        : Number(b.electricity_units_current) - Number(b.electricity_units_last);

    const rows = [
        { label: 'Water',       last: intStr(b.water_units_last), cur: intStr(b.water_units_current),
          units: intStr(wUsage), rate: intStr(b.water_price_per_unit), amount: intStr(b.water_cost) },
        { label: 'Electricity', last: intStr(b.electricity_units_last), cur: intStr(b.electricity_units_current),
          units: intStr(eUsage), rate: intStr(b.electricity_price_per_unit), amount: intStr(b.electricity_cost) },
        { label: 'Room rent', last: '', cur: '', units: '', rate: '', amount: intStr(b.rent_cost) },
    ];
    // Common-area electricity fee — only shown when it was actually charged.
    if (Number(b.common_fee) > 0) {
        rows.push({ label: 'Common area', last: '', cur: '', units: '', rate: '',
                    amount: intStr(b.common_fee) });
    }
    rows.push({ label: 'Other', last: '', cur: '', units: '', rate: '', amount: intStr(b.other_cost) });
    const rowH = 26;
    doc.fillColor('black').font('reg').fontSize(11);
    rows.forEach((r) => {
        colXs.forEach((c) => doc.text(String(r[c.key] ?? ''), c.x + 4, rowY + 6,
                                       { width: c.px - 8, align: c.align }));
        rowY += rowH;
        doc.moveTo(M, rowY).lineTo(M + usableW, rowY).strokeColor('#cccccc').stroke();
    });

    const totalH = 26;
    doc.rect(M, rowY, usableW, totalH).fillColor(BLUE).fill();
    doc.fillColor(WHITE).font('bold').fontSize(13);
    const labelW = colXs.slice(0, 5).reduce((s, c) => s + c.px, 0);
    doc.text('TOTAL', M + 4, rowY + 6, { width: labelW - 8, align: 'right' });
    doc.text(intStr(b.total_cost), colXs[5].x + 4, rowY + 6,
             { width: colXs[5].px - 8, align: 'center' });
    rowY += totalH;

    if (b.invoice_footer_text) {
        doc.fillColor('#475569').font('reg').fontSize(10)
           .text(b.invoice_footer_text, M, rowY + 14, { width: usableW, align: 'left' });
    }
    doc.fillColor('black');
}

// =====================================================
// Compact single invoice "copy" drawn inside a vertical band starting at
// `top`. Used for the A4 portrait two-copy layout (tenant + owner copies on
// one page). Handles both Thai and English. Ends with two signature lines:
// ผู้เช่าห้อง (tenant) and ผู้รับเงิน (payment receiver).
// =====================================================
function drawInvoiceCopy(doc, b, top, copyLabel, lang) {
    const th       = lang !== 'en';
    const fontReg  = th ? 'thai' : 'reg';
    const fontBold = th ? 'thai-bold' : 'bold';
    const M        = 28;
    const pageW    = doc.page.width;
    const usableW  = pageW - M * 2;
    const BLUE     = '#0000ff';
    const WHITE    = '#ffffff';

    const mmPadded = String(b.month).padStart(2, '0');
    const billNo   = `${b.year}${mmPadded}${b.room_number || ''}`;
    let y = top;

    // Copy label (left) + bill number (right)
    doc.font(fontReg).fontSize(9).fillColor('#64748b')
       .text(copyLabel, M, y, { width: usableW / 2, align: 'left' });
    doc.fillColor('black').fontSize(10)
       .text(`${th ? 'บิลเลขที่' : 'Invoice #'}  ${billNo}`, M, y, { width: usableW, align: 'right' });
    y += 16;

    const aptHeader = [b.apartment_name, b.apartment_address].filter(Boolean).join(' ');
    doc.font(fontBold).fontSize(13).text(aptHeader, M, y, { width: usableW, align: 'center' });
    y += 17;
    doc.font(fontReg).fontSize(10).text(
        th ? `บิลเรียกเก็บเงินค่าเช่าห้อง ประจำเดือน ${mmPadded} ${b.year}`
           : `Rent invoice for ${ENGLISH_MONTHS[b.month - 1]} ${b.year}`,
        M, y, { width: usableW, align: 'center' });
    y += 15;
    doc.text(`${th ? 'ห้อง :' : 'Room :'}  ${b.room_number || '-'}`,
             M, y, { width: usableW, align: 'right' });
    y += 15;

    const cols = th ? [
        { key: 'label',  title: '',               w: 0.20, align: 'center' },
        { key: 'last',   title: 'จดเดือนที่แล้ว', w: 0.13, align: 'center' },
        { key: 'cur',    title: 'จดเดือนนี้',     w: 0.13, align: 'center' },
        { key: 'units',  title: 'จำนวนหน่วย',    w: 0.13, align: 'center' },
        { key: 'rate',   title: 'ราคาต่อหน่วย',  w: 0.13, align: 'center' },
        { key: 'amount', title: 'รวม (บาท)',      w: 0.28, align: 'center' },
    ] : [
        { key: 'label',  title: '',             w: 0.20, align: 'center' },
        { key: 'last',   title: 'Prev meter',   w: 0.13, align: 'center' },
        { key: 'cur',    title: 'Current',      w: 0.13, align: 'center' },
        { key: 'units',  title: 'Units',        w: 0.13, align: 'center' },
        { key: 'rate',   title: 'Rate',         w: 0.13, align: 'center' },
        { key: 'amount', title: 'Amount (THB)', w: 0.28, align: 'center' },
    ];
    let xCursor = M;
    const colXs = cols.map((c) => { const px = usableW * c.w; const o = { ...c, x: xCursor, px }; xCursor += px; return o; });

    const wUsage = b.rollover_water
        ? (Number(b.water_max_units || 9999) - Number(b.water_units_last)) + Number(b.water_units_current)
        : Number(b.water_units_current) - Number(b.water_units_last);
    const eUsage = b.rollover_electricity
        ? (Number(b.electricity_max_units || 9999) - Number(b.electricity_units_last)) + Number(b.electricity_units_current)
        : Number(b.electricity_units_current) - Number(b.electricity_units_last);

    const dataRows = [
        { label: th ? 'ค่าน้ำ' : 'Water', last: intStr(b.water_units_last), cur: intStr(b.water_units_current),
          units: intStr(wUsage), rate: intStr(b.water_price_per_unit), amount: intStr(b.water_cost) },
        { label: th ? 'ค่าไฟ' : 'Electricity', last: intStr(b.electricity_units_last), cur: intStr(b.electricity_units_current),
          units: intStr(eUsage), rate: intStr(b.electricity_price_per_unit), amount: intStr(b.electricity_cost) },
        { label: th ? 'ค่าเช่าห้อง' : 'Room rent', last: '', cur: '', units: '', rate: '', amount: intStr(b.rent_cost) },
    ];
    if (Number(b.common_fee) > 0) {
        dataRows.push({ label: th ? 'ค่าบริการไฟส่วนกลาง' : 'Common area', last: '', cur: '', units: '', rate: '',
                        amount: intStr(b.common_fee) });
    }
    dataRows.push({ label: th ? 'ค่าโทรศัพท์ และอื่นๆ' : 'Other', last: '', cur: '', units: '', rate: '', amount: intStr(b.other_cost) });

    const headerH = 20;
    doc.rect(M, y, usableW, headerH).fillColor(BLUE).fill();
    doc.fillColor(WHITE).font(fontReg).fontSize(10);
    colXs.forEach((c) => doc.text(c.title, c.x + 4, y + 5, { width: c.px - 8, align: c.align }));
    y += headerH;

    const rowH = 20;
    doc.fillColor('black').font(fontReg).fontSize(10);
    dataRows.forEach((r) => {
        colXs.forEach((c) => doc.text(String(r[c.key] ?? ''), c.x + 4, y + 5, { width: c.px - 8, align: c.align }));
        y += rowH;
        doc.moveTo(M, y).lineTo(M + usableW, y).strokeColor('#cccccc').stroke();
    });

    const totalH = 22;
    doc.rect(M, y, usableW, totalH).fillColor(BLUE).fill();
    doc.fillColor(WHITE).font(fontBold).fontSize(12);
    const labelW = colXs.slice(0, 5).reduce((s, c) => s + c.px, 0);
    doc.text(th ? 'รวมค่าเช่า' : 'TOTAL', M + 4, y + 6, { width: labelW - 8, align: 'right' });
    doc.text(intStr(b.total_cost), colXs[5].x + 4, y + 6, { width: colXs[5].px - 8, align: 'center' });
    y += totalH;

    if (b.invoice_footer_text) {
        doc.fillColor('#475569').font(fontReg).fontSize(9)
           .text(b.invoice_footer_text, M, y + 8, { width: usableW, align: 'left' });
        y = doc.y;
    }

    // Signature lines: tenant + payment receiver
    y += 26;
    const half = usableW / 2;
    const tenantSig = th ? 'ลงชื่อ ............................. ผู้เช่าห้อง' : 'Sign ............................. Tenant';
    const payeeSig  = th ? 'ลงชื่อ ............................. ผู้รับเงิน'  : 'Sign ............................. Receiver';
    doc.fillColor('black').font(fontReg).fontSize(10);
    doc.text(tenantSig, M, y, { width: half - 6, align: 'left' });
    doc.text(payeeSig,  M + half, y, { width: half - 6, align: 'left' });
    doc.fillColor('black');
}

// A4 portrait: two copies (tenant + owner) on one page, split by a dashed
// cut line in the middle.
function drawInvoiceA4TwoCopy(doc, b, lang) {
    const th    = lang !== 'en';
    const M     = 28;
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const mid   = pageH / 2;

    drawInvoiceCopy(doc, b, M, th ? 'ส่วนของผู้เช่า' : "Tenant's copy", lang);

    // Dashed cut line across the middle
    doc.save();
    doc.dash(5, { space: 3 }).moveTo(M, mid).lineTo(pageW - M, mid)
       .strokeColor('#94a3b8').lineWidth(0.8).stroke().undash();
    doc.restore();
    doc.font(th ? 'thai' : 'reg').fontSize(8).fillColor('#94a3b8')
       .text(th ? '— ตัดตามรอยประ —' : '— cut here —', M, mid - 11, { width: pageW - M * 2, align: 'center' });
    doc.fillColor('black');

    drawInvoiceCopy(doc, b, mid + 16, th ? 'ส่วนของเจ้าของหอ' : "Owner's copy", lang);
}

// A4 = portrait (two-copy layout); A5 = landscape (single copy).
function pageOpts(size) {
    if (size === 'A4') return { size: 'A4', layout: 'portrait', margin: 28 };
    return { size: 'A5', layout: 'landscape', margin: 28 };
}

// ===== Single bill — Thai or English =====
function generateInvoicePDF(b, size, stream) {
    const doc = new PDFDocument(pageOpts(size));
    applyFonts(doc);
    doc.pipe(stream);
    if (size === 'A4') drawInvoiceA4TwoCopy(doc, b, 'th');
    else               drawInvoiceThai(doc, b);
    doc.end();
}

function generateInvoicePDFEnglish(b, size, stream) {
    const doc = new PDFDocument(pageOpts(size));
    applyFonts(doc);
    doc.pipe(stream);
    if (size === 'A4') drawInvoiceA4TwoCopy(doc, b, 'en');
    else               drawInvoiceEnglish(doc, b);
    doc.end();
}

// ===== Bulk: many bills → one PDF, one bill per page =====
function generateInvoicePDFBulk(bills, size, lang, stream) {
    const opts = pageOpts(size);
    const doc = new PDFDocument(opts);
    applyFonts(doc);
    doc.pipe(stream);

    const drawA5 = lang === 'en' ? drawInvoiceEnglish : drawInvoiceThai;
    bills.forEach((b, i) => {
        if (i > 0) doc.addPage(opts);
        if (size === 'A4') drawInvoiceA4TwoCopy(doc, b, lang);
        else               drawA5(doc, b);
    });
    doc.end();
}

module.exports = {
    generateContractPDF,
    generateInvoicePDF,
    generateInvoicePDFEnglish,
    generateInvoicePDFBulk,
};
