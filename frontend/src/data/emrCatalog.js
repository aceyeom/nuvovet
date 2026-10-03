/**
 * EMR presentation catalogue for the demo clinic.
 *
 * Maps formulary drug ids to the product names, prices and default
 * regimens a Korean veterinary EMR would show on its TX/RX screen
 * (처치/처방). Purely presentational — DUR logic never reads prices.
 */

import { getDrugById } from './drugDatabase';
import { freqToTimesPerDay } from './emrSchema';

// Product label per formulary id (generic names only, no brands)
export const RX_PRODUCTS = {
  meloxicam:     { ko: '멜록시캄 1.5mg/mL 현탁액', en: 'Meloxicam 1.5 mg/mL oral susp.', perDay: 1200 },
  carprofen:     { ko: '카프로펜 25mg 정', en: 'Carprofen 25 mg tab', perDay: 1500 },
  firocoxib:     { ko: '피로콕시브 57mg 정', en: 'Firocoxib 57 mg tab', perDay: 1800 },
  prednisolone:  { ko: '프레드니솔론 5mg 정', en: 'Prednisolone 5 mg tab', perDay: 700 },
  dexamethasone: { ko: '덱사메타손 2mg/mL 주사', en: 'Dexamethasone 2 mg/mL inj.', perDay: 3500 },
  omeprazole:    { ko: '오메프라졸 10mg 캡슐', en: 'Omeprazole 10 mg cap', perDay: 900 },
  gabapentin:    { ko: '가바펜틴 100mg 캡슐', en: 'Gabapentin 100 mg cap', perDay: 1400 },
  tramadol:      { ko: '트라마돌 50mg 정', en: 'Tramadol 50 mg tab', perDay: 1100 },
  amoxicillin:   { ko: '아목시실린 250mg 정', en: 'Amoxicillin 250 mg tab', perDay: 1000 },
  enrofloxacin:  { ko: '엔로플록사신 15mg 정', en: 'Enrofloxacin 15 mg tab', perDay: 1500 },
  metronidazole: { ko: '메트로니다졸 250mg 정', en: 'Metronidazole 250 mg tab', perDay: 900 },
  ketoconazole:  { ko: '케토코나졸 200mg 정', en: 'Ketoconazole 200 mg tab', perDay: 1600 },
  cyclosporine:  { ko: '사이클로스포린 50mg 캡슐', en: 'Cyclosporine 50 mg cap', perDay: 5500 },
  oclacitinib:   { ko: '오클라시티닙 5.4mg 정', en: 'Oclacitinib 5.4 mg tab', perDay: 3500 },
  enalapril:     { ko: '에날라프릴 5mg 정', en: 'Enalapril 5 mg tab', perDay: 900 },
  furosemide:    { ko: '푸로세미드 20mg 정', en: 'Furosemide 20 mg tab', perDay: 600 },
  pimobendan:    { ko: '피모벤단 1.25mg 정', en: 'Pimobendan 1.25 mg tab', perDay: 2800 },
  digoxin:       { ko: '디곡신 0.125mg 정', en: 'Digoxin 0.125 mg tab', perDay: 900 },
  amlodipine:    { ko: '암로디핀 2.5mg 정 (¼)', en: 'Amlodipine 2.5 mg tab (¼)', perDay: 1200 },
  methimazole:   { ko: '메티마졸 5mg 정', en: 'Methimazole 5 mg tab', perDay: 1300 },
  maropitant:    { ko: '마로피탄트 16mg 정', en: 'Maropitant 16 mg tab', perDay: 4500 },
  trazodone:     { ko: '트라조돈 50mg 정', en: 'Trazodone 50 mg tab', perDay: 1200 },
  fluoxetine:    { ko: '플루옥세틴 10mg 캡슐', en: 'Fluoxetine 10 mg cap', perDay: 1200 },
  phenobarbital: { ko: '페노바르비탈 30mg 정', en: 'Phenobarbital 30 mg tab', perDay: 700 },
  ivermectin:    { ko: '이버멕틴 68μg 츄어블', en: 'Ivermectin 68 µg chewable', perDose: 12000 },
  selamectin:    { ko: '셀라멕틴 스팟온', en: 'Selamectin spot-on', perDose: 18000 },
};

// Treatment (TX) catalogue — consult / diagnostics / procedures
export const TX_ITEMS = {
  consultRecheck: { ko: '진찰료 - 재진', en: 'Consultation — recheck', category: 'consult', price: 15000 },
  consultNew:     { ko: '진찰료 - 초진', en: 'Consultation — new problem', category: 'consult', price: 20000 },
  otoscopy:       { ko: '이경 검사', en: 'Otoscopic exam', category: 'diagnostic', price: 10000 },
  earFlush:       { ko: '외이도 세정', en: 'Ear canal flush', category: 'procedure', price: 12000 },
  cytology:       { ko: '피부 세포학 검사', en: 'Skin cytology', category: 'diagnostic', price: 15000 },
  renalPanel:     { ko: '혈액검사 - 신장 패널', en: 'Blood test — renal panel', category: 'diagnostic', price: 45000 },
  sdma:           { ko: 'SDMA 검사', en: 'SDMA test', category: 'diagnostic', price: 30000 },
  urinalysis:     { ko: '요검사 (UA/USG)', en: 'Urinalysis (UA/USG)', category: 'diagnostic', price: 15000 },
  bloodPressure:  { ko: '혈압 측정', en: 'Blood pressure', category: 'diagnostic', price: 10000 },
  thyroid:        { ko: '갑상선 검사 (TT4)', en: 'Thyroid (TT4)', category: 'diagnostic', price: 35000 },
  neuroExam:      { ko: '신경학적 검사', en: 'Neurological exam', category: 'diagnostic', price: 20000 },
  radiograph:     { ko: '방사선 촬영 (2매)', en: 'Radiographs (2 views)', category: 'diagnostic', price: 60000 },
  echo:           { ko: '심장 초음파', en: 'Echocardiogram', category: 'diagnostic', price: 80000 },
  ntprobnp:       { ko: 'NT-proBNP 검사', en: 'NT-proBNP', category: 'diagnostic', price: 40000 },
  subqFluids:     { ko: '피하 수액 (100mL)', en: 'SC fluids (100 mL)', category: 'fluids', price: 15000 },
};

export function productLabel(drug, lang) {
  if (!drug) return '';
  const p = RX_PRODUCTS[drug.id];
  if (p) return lang === 'ko' ? p.ko : p.en;
  return drug.name;
}

function roundWon(v) {
  return Math.max(100, Math.round(v / 100) * 100);
}

export function linePrice(drugId, days) {
  const p = RX_PRODUCTS[drugId];
  if (!p) return roundWon(1000 * days);
  if (p.perDose) return roundWon(p.perDose * Math.max(1, Math.round(days / 30)));
  return roundWon(p.perDay * days);
}

let lineSeq = 0;
const nextLineId = () => `rx-${Date.now().toString(36)}-${(lineSeq += 1)}`;

/**
 * Build a prescription line for the TX/RX table.
 * qty is mg/kg (or the drug's own unit) — defaults to the species dose.
 */
export function makeRxLine(drugOrId, species, { qty, days, times, isNew = false, folder } = {}) {
  const drug = typeof drugOrId === 'string' ? getDrugById(drugOrId) : drugOrId;
  if (!drug) return null;
  const defaultQty = drug.defaultDose?.[species];
  const isMonthly = /monthly/i.test(drug.freq || '');
  return {
    lineId: nextLineId(),
    drugId: drug.id,
    drug,
    qty: qty ?? (defaultQty != null ? defaultQty : ''),
    days: days ?? (isMonthly ? 30 : 7),
    times: times ?? (isMonthly ? 1 : freqToTimesPerDay(drug.freq)),
    route: /iv/i.test(drug.route || '') ? 'PO' : (drug.route === 'Topical' ? 'Top' : drug.route || 'PO'),
    isNew,
    folder: folder || null,
  };
}

/**
 * Calculated per-administration dose (계산량 = 투여량 × 체중) and course
 * total (전체 = 계산량 × 일수 × 횟수), mirroring the EMR auto-calculation.
 */
export function lineMetrics(line, weight) {
  const unit = line.drug?.unit || 'mg/kg';
  const perKg = /\/kg/.test(unit);
  const qty = Number(line.qty) || 0;
  const calculated = perKg ? qty * (Number(weight) || 0) : qty;
  const monthly = /monthly/i.test(line.drug?.freq || '');
  const total = monthly
    ? calculated * Math.max(1, Math.round(line.days / 30))
    : calculated * (Number(line.days) || 1) * (Number(line.times) || 1);
  const round = (v) => Math.round(v * 100) / 100;
  return {
    unit: perKg ? 'mg/kg' : 'mg',
    calculated: round(calculated),
    total: round(total),
    price: linePrice(line.drugId, line.days),
  };
}

export function formatWon(v) {
  return `₩${Math.round(v).toLocaleString('ko-KR')}`;
}
