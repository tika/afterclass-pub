/**
 * Dice coefficient string similarity
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function compareTwoStrings(s1: string, s2: string): number {
  const str1 = s1.toLowerCase();
  const str2 = s2.toLowerCase();

  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return 0;

  // Create bigrams
  const bigrams1 = new Map<string, number>();
  for (let i = 0; i < str1.length - 1; i++) {
    const bigram = str1.substring(i, i + 2);
    bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
  }

  let intersectionSize = 0;
  for (let i = 0; i < str2.length - 1; i++) {
    const bigram = str2.substring(i, i + 2);
    const count = bigrams1.get(bigram) || 0;
    if (count > 0) {
      bigrams1.set(bigram, count - 1);
      intersectionSize++;
    }
  }

  return (2.0 * intersectionSize) / (str1.length + str2.length - 2);
}
