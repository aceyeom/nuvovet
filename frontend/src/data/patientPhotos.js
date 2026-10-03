/**
 * Patient photos for the demo chart.
 *
 * Real photographs from Unsplash, matched to each patient's breed and
 * served from the Unsplash CDN (imgix). The Unsplash License allows free
 * commercial use without attribution; photographers are credited here
 * and in the image alt text anyway.
 *
 * `crop=entropy` keeps the animal (the most detailed region) in frame
 * when the original is cropped to a square.
 */

const CDN = 'https://images.unsplash.com/';

export const PATIENT_PHOTOS = {
  golden_retriever: { src: 'photo-1552053831-71594a27632d', by: 'Richard Brutyo', page: 'https://unsplash.com/photos/Sg3XwuEpybU' },
  australian_shepherd: { src: 'photo-1565893370389-417bf171ac14', by: 'Joakim Nådell', page: 'https://unsplash.com/photos/7I-1Ba5Psxs' },
  french_bulldog: { src: 'photo-1506532876253-45e83404042b', by: 'speckfechta', page: 'https://unsplash.com/photos/PK65bPGTUIE' },
  dachshund: { src: 'photo-1565042081499-89cb1246c819', by: 'Kevin Jackson', page: 'https://unsplash.com/photos/sy7hBaKkn3Y' },
  domestic_sh: { src: 'photo-1543852786-1cf6624b9987', by: 'Jae Park', page: 'https://unsplash.com/photos/7GX5aICb5i4' },
  persian: { src: 'photo-1548366086-7f1b76106622', by: 'Rana Sawalha', page: 'https://unsplash.com/photos/X7UR0BDz-UY' },
  siamese: { src: 'photo-1568152950566-c1bf43f4ab28', by: 'Alex Meier', page: 'https://unsplash.com/photos/KGiQFgF7dkc' },
};

/** Square, retina-ready photo URL for a breed id, or null. */
export function patientPhotoUrl(breedId, size = 64) {
  const p = PATIENT_PHOTOS[breedId];
  if (!p) return null;
  const px = Math.round(size * 2);
  return `${CDN}${p.src}?w=${px}&h=${px}&fit=crop&crop=entropy&auto=format&q=70`;
}

export function patientPhotoCredit(breedId) {
  return PATIENT_PHOTOS[breedId]?.by || '';
}
