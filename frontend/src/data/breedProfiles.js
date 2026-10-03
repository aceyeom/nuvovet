/**
 * Demo patients for the simulated clinic EMR.
 *
 * Seven realistic cases (4 dogs, 3 cats). Each carries the Korean vet
 * EMR registration fields (동물번호, 동물등록번호, 보호자, 보험 …), today's
 * visit (주호소, SOAP, TX lines), labs with species reference intervals,
 * visit history, the current prescription and one "try this" scenario
 * that triggers the case's teaching point in nuvovet DUR.
 *
 * Narrative fields are bilingual: { ko, en }.
 * Dates are generated relative to today so the chart never looks stale.
 */

import { PATIENT_STATUS_ENUM, SEX_ENUM } from './emrSchema';

const SEX_NORMALIZATION = {
  'Female Spayed': 'Spayed Female',
  'Male Neutered': 'Neutered Male',
  'Female Intact': 'Intact Female',
  'Male Intact': 'Intact Male',
};

// ── Reference intervals (in-house analyser style) ────────────────
export const LAB_REFERENCE = {
  dog: {
    creatinine: [0.5, 1.5, 'mg/dL'], bun: [7, 27, 'mg/dL'], sdma: [0, 14, 'μg/dL'],
    alt: [10, 125, 'U/L'], alp: [23, 212, 'U/L'], glucose: [70, 143, 'mg/dL'],
    hct: [37, 55, '%'], k: [3.5, 5.8, 'mmol/L'], usg: [1.015, 1.045, ''], t4: [1.0, 4.0, 'μg/dL'],
  },
  cat: {
    creatinine: [0.8, 1.8, 'mg/dL'], bun: [16, 36, 'mg/dL'], sdma: [0, 14, 'μg/dL'],
    alt: [12, 130, 'U/L'], alp: [14, 111, 'U/L'], glucose: [71, 159, 'mg/dL'],
    hct: [30, 45, '%'], k: [3.5, 5.8, 'mmol/L'], usg: [1.035, 1.06, ''], t4: [0.8, 4.7, 'μg/dL'],
    ntprobnp: [0, 100, 'pmol/L'],
  },
};

export const LAB_ORDER = ['creatinine', 'bun', 'sdma', 'alt', 'alp', 'glucose', 't4', 'k', 'hct', 'usg', 'ntprobnp'];

// ── Date helpers (relative to today) ─────────────────────────────
function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}
function birthDateFromAge(age) {
  const m = /(\d+)\s*y\s*(\d+)?\s*m?/i.exec(age || '');
  const d = new Date();
  if (!m) return '';
  d.setFullYear(d.getFullYear() - Number(m[1]));
  d.setMonth(d.getMonth() - Number(m[2] || 0));
  d.setDate(Math.min(d.getDate(), 27));
  return iso(d);
}

function withEmrFields(profile, species, fallbackChartId) {
  const normalizedSex = SEX_NORMALIZATION[profile.sex] || profile.sex || 'Unknown';
  const safeSex = SEX_ENUM.includes(normalizedSex) ? normalizedSex : 'Unknown';
  const safeStatus = PATIENT_STATUS_ENUM.includes(profile.patientStatus) ? profile.patientStatus : '정상';
  const ref = LAB_REFERENCE[species] || {};

  // Lab status always follows the reference interval
  const labResults = {};
  for (const [key, lab] of Object.entries(profile.labResults || {})) {
    const r = ref[key];
    const v = parseFloat(lab.value);
    let status = 'normal';
    if (r && Number.isFinite(v)) {
      if (v > r[1]) status = 'high';
      else if (v < r[0]) status = 'low';
    }
    labResults[key] = { ...lab, unit: lab.unit ?? r?.[2] ?? '', ref: r ? [r[0], r[1]] : null, status };
  }

  const visits = (profile.visits || []).map((v) => ({ ...v, date: daysAgo(v.daysAgo) }));
  const dob = profile.dateOfBirth || birthDateFromAge(profile.age);

  return {
    ...profile,
    sex: safeSex,
    labResults,
    visits,
    animalChartId: profile.animalChartId || fallbackChartId,
    animalRegistrationNumber: profile.animalRegistrationNumber || '',
    dateOfBirth: dob,
    patientStatus: safeStatus,
    statusChangeDate: profile.statusChangeDate || '',
    registrationDate: profile.registrationDate || (dob ? `${Number(dob.slice(0, 4)) + 1}${dob.slice(4)}` : ''),
    lastVisitDate: visits[0]?.date || daysAgo(30),
    attendingVet: profile.attendingVet || '',
    primaryVet: profile.primaryVet || '',
    diet: profile.diet || '',
    bloodType: profile.bloodType || '',
    insuranceGroup: profile.insuranceGroup || '',
    privateInsuranceNumber: profile.privateInsuranceNumber || '',
  };
}

const VET_PARK = { ko: '박서윤', en: 'Dr. Seoyun Park' };
const VET_OH = { ko: '오현우', en: 'Dr. Hyunwoo Oh' };

export const BREED_DATA = {
  dog: [
    {
      id: 'golden_retriever',
      breed: 'Golden Retriever',
      breedKo: '골든 리트리버',
      demonstrates: 'NSAID gastroprotection in chronic pain management',
      focus: { ko: 'NSAID + 스테로이드', en: 'NSAID + steroid' },
      profile: {
        name: 'Buddy',
        nameKo: '버디',
        age: '7y 4m',
        sex: 'Male Neutered',
        weight: 32.5,
        weightTrend: [33.4, 33.1, 32.8, 32.5],
        bodyCondition: '6/9',
        temperature: '38.8 °C',
        heartRate: '96 bpm',
        respRate: '22 breaths/min',
        allergies: [],
        conditions: ['Hip Dysplasia', 'Seasonal Allergies'],
        history: 'Chronic bilateral hip dysplasia managed with NSAIDs. Seasonal allergic dermatitis — flares in spring/fall. Annual bloodwork WNL. Current on heartworm/flea prevention.',
        labResults: {
          creatinine: { value: '1.1' }, bun: { value: '18' }, alt: { value: '42' },
          alp: { value: '68' }, glucose: { value: '95' }, hct: { value: '48' },
        },
        defaultDrugs: ['meloxicam', 'omeprazole'],
        animalChartId: '1548',
        animalRegistrationNumber: '410000002572601',
        bloodType: 'DEA 1.1+',
        attendingVet: VET_PARK,
        primaryVet: VET_PARK,
        diet: { ko: '관절 처방식', en: 'Joint-support Rx diet' },
        insurance: { ko: '펫보험 가입 · 70% 보장', en: 'Pet insurance · 70% cover' },
        owner: { ko: '김민지', en: 'Minji Kim', phone: '010-****-4821' },
        visit: {
          time: '14:10',
          status: 'inConsult',
          type: { ko: '재진', en: 'Recheck' },
          complaint: { ko: '발·귀 가려움 악화 (2주)', en: 'Itchy paws & ears, worsening (2 wks)' },
          soap: {
            s: { ko: '2주 전부터 발을 핥고 귀를 긁는 행동 증가, 야간에 심함. 식욕·활력 양호. 고관절 통증은 멜록시캄으로 조절 중이며 보행 안정적.', en: 'Licking paws and scratching ears for 2 weeks, worse at night. Appetite and energy normal. Hip pain controlled on meloxicam; gait stable.' },
            o: { ko: 'T 38.8°C · HR 96 · RR 22. 양측 지간 홍반, 외이도 발적(+), 이경상 이물 없음. 고관절 신전 시 경미한 통증.', en: 'T 38.8 °C · HR 96 · RR 22. Bilateral interdigital erythema, erythematous ear canals, no foreign body on otoscopy. Mild pain on hip extension.' },
            a: { ko: '계절성 아토피 피부염 재발 (r/o 식이 알레르기) · 만성 고관절 이형성증', en: 'Seasonal atopic dermatitis flare (r/o food allergy) · chronic hip dysplasia' },
            p: { ko: '항소양 치료 시작, 외이도 세정. 기존 진통 프로토콜 유지 여부 검토. 2주 후 재진.', en: 'Start antipruritic therapy, ear flush. Review the current pain protocol. Recheck in 2 weeks.' },
          },
          tx: ['consultRecheck', 'otoscopy', 'earFlush'],
        },
        rx: [
          { id: 'meloxicam', days: 30, chronic: true },
          { id: 'omeprazole', days: 30, chronic: true },
        ],
        scenario: { add: 'prednisolone', qty: 0.5, days: 7, hint: { ko: '알레르기 악화 — 프레드니솔론 추가', en: 'Allergy flare — add Prednisolone' } },
        visits: [
          { daysAgo: 31, reason: { ko: '정기 검진 · 관절 통증 관리', en: 'Wellness · hip pain management' }, dx: { ko: '고관절 이형성증 — 안정', en: 'Hip dysplasia — stable' }, rx: 'Meloxicam, Omeprazole', dur: 'clear' },
          { daysAgo: 118, reason: { ko: '종합백신 (DHPPL) · 광견병', en: 'Vaccines (DHPPL · rabies)' }, dx: { ko: '예방접종', en: 'Preventive care' }, rx: '—', dur: 'clear' },
          { daysAgo: 205, reason: { ko: '봄철 소양감', en: 'Spring pruritus' }, dx: { ko: '아토피 피부염', en: 'Atopic dermatitis' }, rx: 'Oclacitinib (14d)', dur: 'clear' },
        ],
      },
    },
    {
      id: 'sheltie',
      breed: 'Shetland Sheepdog',
      breedKo: '셔틀랜드 쉽독',
      demonstrates: 'MDR1 mutation + renal compromise drug safety',
      focus: { ko: 'MDR1 · 신장 · 알레르기', en: 'MDR1 · renal · allergy' },
      profile: {
        name: 'Max',
        nameKo: '맥스',
        age: '4y 2m',
        sex: 'Male Neutered',
        weight: 5.2,
        weightTrend: [5.9, 5.7, 5.4, 5.2],
        bodyCondition: '4/9',
        temperature: '38.5 °C',
        heartRate: '102 bpm',
        respRate: '18 breaths/min',
        allergies: ['Penicillin', 'Sulfonamides'],
        conditions: ['Early Stage Renal Failure', 'MDR1 Deficient'],
        history: 'Patient carries ABCB1-1Δ (MDR1) mutation — confirmed by genetic testing. Chronic renal monitoring after CKD IRIS Stage 2 diagnosis. Recent lethargy.',
        labResults: {
          creatinine: { value: '1.8' }, bun: { value: '32' }, sdma: { value: '19' },
          alt: { value: '45' }, alp: { value: '55' }, glucose: { value: '88' },
          hct: { value: '35' }, usg: { value: '1.018' },
        },
        defaultDrugs: ['prednisolone', 'metronidazole', 'enalapril'],
        animalChartId: '2093',
        animalRegistrationNumber: '410000003318842',
        bloodType: 'DEA 1.1−',
        attendingVet: VET_OH,
        primaryVet: VET_PARK,
        diet: { ko: '신장 처방식', en: 'Renal Rx diet' },
        insurance: { ko: '미가입', en: 'Not insured' },
        owner: { ko: '이준호', en: 'Junho Lee', phone: '010-****-1937' },
        visit: {
          time: '13:30',
          status: 'billing',
          type: { ko: '재진', en: 'Recheck' },
          complaint: { ko: 'CKD 2기 재검 · 구충 예정', en: 'CKD stage 2 recheck · parasite prevention due' },
          soap: {
            s: { ko: '활력 회복 중. 음수량 증가 (보호자 추정 600 mL/일). 만성 대장성 설사는 호전. 심장사상충·외부기생충 예방 시기.', en: 'Energy improving. Drinking more (owner estimates 600 mL/day). Chronic large-bowel diarrhea improved. Heartworm / ectoparasite prevention due.' },
            o: { ko: 'T 38.5°C · HR 102 · RR 18. 탈수 약 5%. 수축기 혈압 158 mmHg. USG 1.018.', en: 'T 38.5 °C · HR 102 · RR 18. ~5% dehydrated. Systolic BP 158 mmHg. USG 1.018.' },
            a: { ko: 'CKD IRIS 2기 (CREA 1.8, SDMA 19) · ABCB1-1Δ (MDR1) 변이 — 유전자 검사 확인 · IBD 의심 · 페니실린/설파 알레르기', en: 'CKD IRIS stage 2 (CREA 1.8, SDMA 19) · ABCB1-1Δ (MDR1) mutant — genotyped · suspected IBD · penicillin/sulfa allergy' },
            p: { ko: '에날라프릴 유지, 4주 후 신장 패널 재검. MDR1 안전 구충제 선택 필요.', en: 'Continue enalapril; renal panel in 4 weeks. Choose an MDR1-safe parasite preventive.' },
          },
          tx: ['consultRecheck', 'renalPanel', 'sdma', 'bloodPressure'],
        },
        rx: [
          { id: 'prednisolone', days: 14 },
          { id: 'metronidazole', days: 14 },
          { id: 'enalapril', days: 30, chronic: true },
        ],
        scenario: { add: 'ivermectin', days: 30, hint: { ko: '구충 시기 — 이버멕틴 추가', en: 'Parasite prevention — add Ivermectin' }, alt: 'amoxicillin' },
        visits: [
          { daysAgo: 28, reason: { ko: 'CKD 진단 · IRIS 2기', en: 'CKD diagnosis · IRIS stage 2' }, dx: { ko: '만성 신장병', en: 'Chronic kidney disease' }, rx: 'Enalapril', dur: 'moderate' },
          { daysAgo: 64, reason: { ko: '만성 설사 · IBD 의심', en: 'Chronic diarrhea · IBD suspected' }, dx: { ko: '대장성 설사', en: 'Large-bowel diarrhea' }, rx: 'Prednisolone, Metronidazole', dur: 'clear' },
          { daysAgo: 410, reason: { ko: 'MDR1 유전자 검사', en: 'MDR1 genotyping' }, dx: { ko: 'ABCB1-1Δ 변이 확인', en: 'ABCB1-1Δ mutant confirmed' }, rx: '—', dur: 'clear' },
        ],
      },
    },
    {
      id: 'french_bulldog',
      breed: 'French Bulldog',
      breedKo: '프렌치 불도그',
      demonstrates: 'Corticosteroid + antifungal CYP3A4 interaction',
      focus: { ko: 'CYP3A4 억제', en: 'CYP3A4 inhibition' },
      profile: {
        name: 'Coco',
        nameKo: '코코',
        age: '3y 8m',
        sex: 'Female Spayed',
        weight: 11.8,
        weightTrend: [11.2, 11.5, 11.6, 11.8],
        bodyCondition: '7/9',
        temperature: '39.0 °C',
        heartRate: '110 bpm',
        respRate: '28 breaths/min',
        allergies: [],
        conditions: ['Brachycephalic Syndrome', 'Atopic Dermatitis'],
        history: 'Chronic atopic dermatitis with secondary bacterial pyoderma. Brachycephalic obstructive airway syndrome — mild. Owner reports worsening pruritus over 2 weeks.',
        labResults: {
          creatinine: { value: '0.9' }, bun: { value: '16' }, alt: { value: '38' },
          alp: { value: '72' }, glucose: { value: '101' }, hct: { value: '46' },
        },
        defaultDrugs: ['prednisolone', 'amoxicillin', 'ketoconazole'],
        animalChartId: '871',
        animalRegistrationNumber: '410000001846573',
        bloodType: 'DEA 1.1+',
        attendingVet: VET_PARK,
        primaryVet: VET_PARK,
        diet: { ko: '가수분해 단백 사료', en: 'Hydrolysed-protein diet' },
        insurance: { ko: '펫보험 가입 · 50% 보장', en: 'Pet insurance · 50% cover' },
        owner: { ko: '박서연', en: 'Seoyeon Park', phone: '010-****-2265' },
        visit: {
          time: '10:20',
          status: 'done',
          type: { ko: '재진', en: 'Recheck' },
          complaint: { ko: '소양감 악화 · 농피증 (2주)', en: 'Worsening itch with pyoderma (2 wks)' },
          soap: {
            s: { ko: '2주간 소양감 악화, 옆구리와 얼굴 주름을 긁음. 코골이 변화 없음.', en: 'Itch worse for 2 weeks; scratching flanks and facial folds. Snoring unchanged.' },
            o: { ko: 'T 39.0°C · HR 110 · RR 28 (헐떡임). 복부 구진·농포, 표피 고리; 안면 주름 피부염. 세포학: 구균 +++, 말라세지아 ++.', en: 'T 39.0 °C · HR 110 · RR 28 (panting). Ventral papules/pustules, epidermal collarettes; facial fold dermatitis. Cytology: cocci +++, Malassezia ++.' },
            a: { ko: '아토피 피부염 + 2차 표재성 농피증 · 말라세지아 · BOAS (경도)', en: 'Atopic dermatitis with secondary superficial pyoderma · Malassezia · BOAS (mild)' },
            p: { ko: '항생제 3주, 항진균제, 단기 소염 치료. 3주 후 재진.', en: 'Antibiotics × 3 wks, antifungal, short anti-inflammatory course. Recheck in 3 weeks.' },
          },
          tx: ['consultRecheck', 'cytology'],
        },
        rx: [
          { id: 'prednisolone', days: 7 },
          { id: 'amoxicillin', days: 21 },
          { id: 'ketoconazole', days: 21 },
        ],
        scenario: { add: 'cyclosporine', days: 30, hint: { ko: '장기 관리 — 사이클로스포린 추가', en: 'Long-term control — add Cyclosporine' } },
        visits: [
          { daysAgo: 46, reason: { ko: '안면 주름 피부염', en: 'Facial fold dermatitis' }, dx: { ko: '말라세지아 피부염', en: 'Malassezia dermatitis' }, rx: 'Ketoconazole', dur: 'clear' },
          { daysAgo: 180, reason: { ko: 'BOAS 평가', en: 'BOAS assessment' }, dx: { ko: '단두종 기도 증후군 — 경도', en: 'BOAS — mild' }, rx: '—', dur: 'clear' },
          { daysAgo: 301, reason: { ko: '아토피 피부염 진단', en: 'Atopic dermatitis diagnosed' }, dx: { ko: '아토피 피부염', en: 'Atopic dermatitis' }, rx: 'Prednisolone (taper)', dur: 'clear' },
        ],
      },
    },
    {
      id: 'dachshund',
      breed: 'Dachshund',
      breedKo: '닥스훈트',
      demonstrates: 'Serotonin syndrome risk in multimodal pain therapy',
      focus: { ko: '세로토닌 증후군', en: 'Serotonin syndrome' },
      profile: {
        name: 'Oscar',
        nameKo: '오스카',
        age: '9y 1m',
        sex: 'Male Intact',
        weight: 9.4,
        weightTrend: [9.0, 9.2, 9.3, 9.4],
        bodyCondition: '7/9',
        temperature: '38.6 °C',
        heartRate: '88 bpm',
        respRate: '20 breaths/min',
        allergies: [],
        conditions: ['IVDD — Intervertebral Disc Disease', 'Chronic Pain'],
        history: 'History of T12-L1 disc herniation 2 years ago. Conservative management. Currently on multimodal pain protocol. Periodic flare-ups of back pain with reluctance to jump.',
        labResults: {
          creatinine: { value: '1.0' }, bun: { value: '20' }, alt: { value: '52' },
          alp: { value: '85' }, glucose: { value: '92' }, hct: { value: '44' },
        },
        defaultDrugs: ['meloxicam', 'gabapentin', 'tramadol'],
        animalChartId: '1764',
        animalRegistrationNumber: '410000002094118',
        bloodType: 'DEA 1.1+',
        attendingVet: VET_OH,
        primaryVet: VET_OH,
        diet: { ko: '체중 조절식', en: 'Weight-control diet' },
        insurance: { ko: '펫보험 가입 · 70% 보장', en: 'Pet insurance · 70% cover' },
        owner: { ko: '최도윤', en: 'Doyun Choi', phone: '010-****-7702' },
        visit: {
          time: '14:50',
          status: 'waiting',
          type: { ko: '초진 (신규 문제)', en: 'New problem' },
          complaint: { ko: 'IVDD 통증 재발 · 점프 거부', en: 'IVDD back-pain flare, won’t jump' },
          soap: {
            s: { ko: '3일 전부터 소파에 오르지 않고 안을 때 비명. 식욕 정상. 2년 전 T12–L1 추간판 탈출 병력.', en: 'Won’t jump onto the sofa for 3 days, yelps when picked up. Eating normally. T12–L1 disc herniation 2 years ago.' },
            o: { ko: 'T 38.6°C · HR 88. 척추 후만 자세, 흉요추부 촉진 시 통증. 보행 가능, 고유감각 정상 (Grade 1).', en: 'T 38.6 °C · HR 88. Kyphotic posture, thoracolumbar pain on palpation. Ambulatory, proprioception normal (grade 1).' },
            a: { ko: 'IVDD 재발, Grade 1 — 보존적 치료', en: 'IVDD flare, grade 1 — conservative management' },
            p: { ko: '4주 엄격한 케이지 레스트, 다중 진통 유지, 케이지 불안에 대한 진정제 고려.', en: 'Strict cage rest × 4 weeks; continue multimodal analgesia; consider an anxiolytic for confinement.' },
          },
          tx: ['consultNew', 'neuroExam', 'radiograph'],
        },
        rx: [
          { id: 'meloxicam', days: 14 },
          { id: 'gabapentin', days: 30, chronic: true },
          { id: 'tramadol', days: 7 },
        ],
        scenario: { add: 'trazodone', days: 14, hint: { ko: '케이지 레스트 불안 — 트라조돈 추가', en: 'Cage-rest anxiety — add Trazodone' } },
        visits: [
          { daysAgo: 57, reason: { ko: '정기 검진 · 체중 관리', en: 'Wellness · weight management' }, dx: { ko: '과체중 (BCS 7/9)', en: 'Overweight (BCS 7/9)' }, rx: 'Gabapentin', dur: 'clear' },
          { daysAgo: 190, reason: { ko: '요통 재발 (경도)', en: 'Back pain flare (mild)' }, dx: { ko: 'IVDD Grade 1', en: 'IVDD grade 1' }, rx: 'Meloxicam, Tramadol', dur: 'clear' },
          { daysAgo: 730, reason: { ko: 'T12–L1 추간판 탈출', en: 'T12–L1 disc herniation' }, dx: { ko: '보존적 치료', en: 'Conservative management' }, rx: 'Meloxicam, Gabapentin', dur: 'clear' },
        ],
      },
    },
  ],
  cat: [
    {
      id: 'domestic_sh',
      breed: 'Domestic Shorthair',
      breedKo: '코리안 숏헤어',
      demonstrates: 'Thyroid + renal drug management in senior cats',
      focus: { ko: '신장 부담 · 약물-질환', en: 'Renal load · drug–disease' },
      profile: {
        name: 'Mochi',
        nameKo: '모찌',
        age: '11y 6m',
        sex: 'Female Spayed',
        weight: 4.8,
        weightTrend: [5.6, 5.1, 4.8, 4.8],
        bodyCondition: '5/9',
        temperature: '38.4 °C',
        heartRate: '180 bpm',
        respRate: '24 breaths/min',
        allergies: [],
        conditions: ['Hyperthyroidism', 'Early CKD (IRIS Stage 2)'],
        history: 'Hyperthyroidism diagnosed 6 months ago — on methimazole. Concurrent early CKD. Weight loss stabilized. Periodic vomiting.',
        labResults: {
          creatinine: { value: '2.1' }, bun: { value: '38' }, sdma: { value: '18' },
          alt: { value: '65' }, alp: { value: '48' }, t4: { value: '3.2' }, hct: { value: '28' },
        },
        defaultDrugs: ['methimazole', 'amlodipine', 'maropitant'],
        animalChartId: '2210',
        animalRegistrationNumber: '',
        bloodType: 'A',
        attendingVet: VET_PARK,
        primaryVet: VET_PARK,
        diet: { ko: '신장 처방식 (습식)', en: 'Renal Rx diet (wet)' },
        insurance: { ko: '펫보험 가입 · 70% 보장', en: 'Pet insurance · 70% cover' },
        owner: { ko: '정하은', en: 'Haeun Jung', phone: '010-****-5310' },
        visit: {
          time: '09:40',
          status: 'done',
          type: { ko: '재진', en: 'Recheck' },
          complaint: { ko: '갑상선·CKD 재검 · 간헐적 구토', en: 'Thyroid & CKD recheck · intermittent vomiting' },
          soap: {
            s: { ko: '주 1–2회 헤어볼·사료 구토. 체중 유지. 음수량 증가.', en: 'Vomits hairballs/food 1–2×/week. Weight stable. Drinking more.' },
            o: { ko: 'T 38.4°C · HR 180 · RR 24. 수축기 혈압 172 mmHg. 좌측 갑상선 촉지. BCS 5/9.', en: 'T 38.4 °C · HR 180 · RR 24. Systolic BP 172 mmHg. Left thyroid slip palpable. BCS 5/9.' },
            a: { ko: '갑상선기능항진증 — 조절 중 (TT4 3.2) · CKD IRIS 2기 (CREA 2.1, SDMA 18) · 전신 고혈압', en: 'Hyperthyroidism — controlled (TT4 3.2) · CKD IRIS stage 2 (CREA 2.1, SDMA 18) · systemic hypertension' },
            p: { ko: '메티마졸·암로디핀 유지, 구토 시 마로피탄트. 4주 후 TT4·신장 재검.', en: 'Continue methimazole and amlodipine; maropitant for vomiting. Recheck TT4 and renal panel in 4 weeks.' },
          },
          tx: ['consultRecheck', 'renalPanel', 'thyroid', 'bloodPressure'],
        },
        rx: [
          { id: 'methimazole', days: 30, chronic: true },
          { id: 'amlodipine', days: 30, chronic: true },
          { id: 'maropitant', days: 5 },
        ],
        scenario: { add: 'meloxicam', days: 3, hint: { ko: '점프 시 뻣뻣함 — 멜록시캄 추가', en: 'Stiff when jumping — add Meloxicam' } },
        visits: [
          { daysAgo: 30, reason: { ko: '갑상선 재검', en: 'Thyroid recheck' }, dx: { ko: 'TT4 3.2 — 조절 중', en: 'TT4 3.2 — controlled' }, rx: 'Methimazole', dur: 'clear' },
          { daysAgo: 92, reason: { ko: 'CKD 2기 · 고혈압 진단', en: 'CKD stage 2 · hypertension' }, dx: { ko: 'CKD · 고혈압', en: 'CKD · hypertension' }, rx: 'Amlodipine', dur: 'critical' },
          { daysAgo: 183, reason: { ko: '체중 감소 · 다식', en: 'Weight loss · polyphagia' }, dx: { ko: '갑상선기능항진증', en: 'Hyperthyroidism' }, rx: 'Methimazole', dur: 'clear' },
        ],
      },
    },
    {
      id: 'persian',
      breed: 'Persian',
      breedKo: '페르시안',
      demonstrates: 'Cardiac polypharmacy with electrolyte risk',
      focus: { ko: 'QT 연장 · 심장약', en: 'QT stacking · cardiac' },
      profile: {
        name: 'Luna',
        nameKo: '루나',
        age: '6y 0m',
        sex: 'Female Spayed',
        weight: 3.9,
        weightTrend: [3.8, 3.9, 3.9, 3.9],
        bodyCondition: '5/9',
        temperature: '38.6 °C',
        heartRate: '200 bpm',
        respRate: '26 breaths/min',
        allergies: [],
        conditions: ['Hypertrophic Cardiomyopathy (HCM)'],
        history: 'HCM diagnosed on echocardiogram — moderate concentric hypertrophy. No CHF at this time. Monitoring with serial echocardiograms every 6 months.',
        labResults: {
          creatinine: { value: '1.4' }, bun: { value: '22' }, alt: { value: '34' },
          alp: { value: '38' }, glucose: { value: '105' }, k: { value: '3.9' },
          hct: { value: '40' }, ntprobnp: { value: '410' },
        },
        defaultDrugs: ['enalapril', 'furosemide', 'pimobendan'],
        animalChartId: '1932',
        animalRegistrationNumber: '',
        bloodType: 'B',
        attendingVet: VET_OH,
        primaryVet: VET_OH,
        diet: { ko: '저나트륨 사료', en: 'Low-sodium diet' },
        insurance: { ko: '미가입', en: 'Not insured' },
        owner: { ko: '강지훈', en: 'Jihoon Kang', phone: '010-****-0644' },
        visit: {
          time: '11:00',
          status: 'billing',
          type: { ko: '재진', en: 'Recheck' },
          complaint: { ko: 'HCM 정기검진 · 재채기 4일', en: 'HCM recheck · sneezing for 4 days' },
          soap: {
            s: { ko: '가정 내 안정 시 호흡수 32–36회/분 (이전 24회). 식욕 양호. 4일간 재채기.', en: 'Resting respiratory rate at home 32–36/min (was 24). Eating well. Sneezing for 4 days.' },
            o: { ko: 'T 38.6°C · HR 200 · RR 26. 분마조율, II/VI 수축기 잡음. 심초음파: LV 벽 6.8 mm, LA:Ao 1.7. 경미한 장액성 비루.', en: 'T 38.6 °C · HR 200 · RR 26. Gallop rhythm, grade II/VI systolic murmur. Echo: LV wall 6.8 mm, LA:Ao 1.7. Mild serous nasal discharge.' },
            a: { ko: 'HCM (ACVIM B2) — LA 확장 · 고양이 상부호흡기 감염 의심', en: 'HCM (ACVIM B2) — LA enlarged · suspected feline URI' },
            p: { ko: '심장 프로토콜 유지, 가정 호흡수 모니터링, URI 치료. 3개월 후 심초음파.', en: 'Continue cardiac protocol, monitor home RRR, treat URI. Echo in 3 months.' },
          },
          tx: ['consultRecheck', 'echo', 'ntprobnp'],
        },
        rx: [
          { id: 'enalapril', days: 30, chronic: true },
          { id: 'furosemide', days: 30, chronic: true },
          { id: 'pimobendan', days: 30, chronic: true },
        ],
        scenario: { add: 'enrofloxacin', days: 7, hint: { ko: '상부호흡기 감염 — 엔로플록사신 추가', en: 'Respiratory infection — add Enrofloxacin' } },
        visits: [
          { daysAgo: 91, reason: { ko: '심장 초음파 재검', en: 'Echo recheck' }, dx: { ko: 'LA 확장 — B2', en: 'LA enlargement — B2' }, rx: 'Pimobendan, Furosemide', dur: 'moderate' },
          { daysAgo: 182, reason: { ko: '심잡음 정밀 검사', en: 'Murmur work-up' }, dx: { ko: 'HCM (ACVIM B1)', en: 'HCM (ACVIM B1)' }, rx: 'Enalapril', dur: 'clear' },
          { daysAgo: 365, reason: { ko: '종합백신 (FVRCP)', en: 'Vaccines (FVRCP)' }, dx: { ko: '예방접종', en: 'Preventive care' }, rx: '—', dur: 'clear' },
        ],
      },
    },
    {
      id: 'siamese',
      breed: 'Siamese',
      breedKo: '샴',
      demonstrates: 'Serotonin risk + NSAID use in anxious cats',
      focus: { ko: '세로토닌 증후군', en: 'Serotonin syndrome' },
      profile: {
        name: 'Nabi',
        nameKo: '나비',
        age: '8y 3m',
        sex: 'Male Neutered',
        weight: 4.2,
        weightTrend: [4.4, 4.3, 4.2, 4.2],
        bodyCondition: '4/9',
        temperature: '38.3 °C',
        heartRate: '190 bpm',
        respRate: '22 breaths/min',
        allergies: [],
        conditions: ['Feline Lower Urinary Tract Disease', 'Anxiety'],
        history: 'Recurrent FLUTD episodes — stress-related. Recently switched to urinary diet. Environmental enrichment recommended. Owner reports overgrooming and hiding behavior.',
        labResults: {
          creatinine: { value: '1.3' }, bun: { value: '24' }, alt: { value: '40' },
          alp: { value: '35' }, glucose: { value: '115' }, hct: { value: '42' }, usg: { value: '1.045' },
        },
        defaultDrugs: ['gabapentin', 'trazodone', 'meloxicam'],
        animalChartId: '1405',
        animalRegistrationNumber: '',
        bloodType: 'A',
        attendingVet: VET_PARK,
        primaryVet: VET_OH,
        diet: { ko: '비뇨기 처방식', en: 'Urinary Rx diet' },
        insurance: { ko: '펫보험 가입 · 50% 보장', en: 'Pet insurance · 50% cover' },
        owner: { ko: '윤서아', en: 'Seoa Yoon', phone: '010-****-8159' },
        visit: {
          time: '15:30',
          status: 'waiting',
          type: { ko: '초진 (신규 문제)', en: 'New problem' },
          complaint: { ko: 'FLUTD 재발 · 과도한 그루밍', en: 'FLUTD recurrence · over-grooming' },
          soap: {
            s: { ko: '2일간 화장실에서 힘줌, 소량 빈뇨. 옆집에 새 고양이가 온 뒤 복부 과다 그루밍.', en: 'Straining in the litter box for 2 days, small frequent urinations. Over-grooming the belly since a new cat moved in next door.' },
            o: { ko: 'T 38.3°C · HR 190 · RR 22. 방광 작고 통증, 폐색 없음. 요검사: USG 1.045, pH 6.5, 잠혈 3+, 결정 없음.', en: 'T 38.3 °C · HR 190 · RR 22. Small, painful bladder; not obstructed. UA: USG 1.045, pH 6.5, blood 3+, no crystals.' },
            a: { ko: '고양이 특발성 방광염(FIC) 재발 · 스트레스성 행동', en: 'Feline idiopathic cystitis (FIC) flare · stress-related behaviour' },
            p: { ko: '진통, 환경 개선(MEMO), 항불안 치료. 2주 후 요검사 재검.', en: 'Analgesia, environmental modification (MEMO), anxiolytic. Recheck UA in 2 weeks.' },
          },
          tx: ['consultNew', 'urinalysis'],
        },
        rx: [
          { id: 'gabapentin', days: 14 },
          { id: 'trazodone', days: 14 },
          { id: 'meloxicam', days: 3 },
        ],
        scenario: { add: 'tramadol', days: 5, hint: { ko: '통증 조절 강화 — 트라마돌 추가', en: 'Stronger analgesia — add Tramadol' } },
        visits: [
          { daysAgo: 62, reason: { ko: 'FIC 재발', en: 'FIC flare' }, dx: { ko: '특발성 방광염', en: 'Idiopathic cystitis' }, rx: 'Gabapentin, Meloxicam', dur: 'clear' },
          { daysAgo: 150, reason: { ko: '행동 상담', en: 'Behaviour consult' }, dx: { ko: '스트레스성 그루밍', en: 'Stress-related grooming' }, rx: 'Trazodone', dur: 'clear' },
          { daysAgo: 240, reason: { ko: '배뇨 곤란', en: 'Dysuria' }, dx: { ko: '요도 폐색 없음', en: 'No urethral obstruction' }, rx: '—', dur: 'clear' },
        ],
      },
    },
  ],
};

export function getBreedsForSpecies(species) {
  const breeds = BREED_DATA[species] || [];
  return breeds.map((entry, idx) => ({
    ...entry,
    species,
    profile: withEmrFields(entry.profile, species, `${species === 'dog' ? 'D' : 'C'}-${1000 + idx}`),
  }));
}

export function getBreedProfile(species, breedId) {
  const breeds = getBreedsForSpecies(species);
  return breeds.find((b) => b.id === breedId) || null;
}

/** All demo patients in today's appointment order (waiting list). */
export function getDemoPatients() {
  return [...getBreedsForSpecies('dog'), ...getBreedsForSpecies('cat')].sort((a, b) =>
    a.profile.visit.time.localeCompare(b.profile.visit.time),
  );
}
