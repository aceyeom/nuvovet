// Species-specific toxicity hardstops — substances that must never be
// dispensed to the given species, matched against name / substance / brands.
export const SPECIES_HARDSTOPS = {
  cat: {
    acetaminophen: 'Acetaminophen (paracetamol) is acutely fatal in cats. Cats lack glucuronyl transferase and cannot metabolise it.',
    paracetamol:   'Paracetamol is acutely fatal in cats. Cats lack glucuronyl transferase and cannot metabolise it.',
    permethrin:    'Permethrin is a potent feline neurotoxin. Even small topical exposures cause seizures and death.',
    ibuprofen:     'Ibuprofen is highly toxic to cats causing acute renal failure and GI perforation.',
    naproxen:      'Naproxen is toxic to cats with a very narrow safety margin — do not use.',
    benzocaine:    'Benzocaine causes methaemoglobinaemia in cats and can be fatal.',
    'tea tree':    'Tea tree oil (melaleuca) is neurotoxic to cats even at low topical doses.',
    melaleuca:     'Melaleuca (tea tree) oil is neurotoxic to cats.',
    xylitol:       'Xylitol causes severe hypoglycaemia and liver failure.',
    'onion':       'Onion/garlic compounds cause Heinz body haemolytic anaemia in cats.',
    'garlic':      'Garlic compounds cause Heinz body haemolytic anaemia in cats.',
  },
  dog: {
    xylitol:   'Xylitol causes severe hypoglycaemia and acute hepatic necrosis in dogs.',
    grapes:    'Grapes/raisins cause acute renal failure in dogs via an unknown mechanism.',
    raisins:   'Raisins cause acute renal failure in dogs via an unknown mechanism.',
    macadamia: 'Macadamia nuts cause tremors and hyperthermia in dogs.',
  },
};

export function checkHardstop(drug, species) {
  const checks = SPECIES_HARDSTOPS[species] || {};
  const nameStr = `${drug.name || ''} ${drug.activeSubstance || ''} ${(drug.brandNames || []).join(' ')}`.toLowerCase();
  for (const [fragment, reason] of Object.entries(checks)) {
    if (nameStr.includes(fragment)) return reason;
  }
  return null;
}
