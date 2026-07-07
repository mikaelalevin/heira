export const MOOD_GRADIENTS: Record<string, string> = {
  rose:  "linear-gradient(135deg, #D9896A 0%, #C45224 100%)",
  ink:   "linear-gradient(135deg, #1A1614 0%, #3D3530 100%)",
  sand:  "linear-gradient(135deg, #C4B8A8 0%, #9A8878 100%)",
  gold:  "linear-gradient(135deg, #C9A961 0%, #8A7038 100%)",
  sage:  "linear-gradient(135deg, #A8B5A0 0%, #6B7A63 100%)",
  plum:  "linear-gradient(135deg, #6B4F5B 0%, #4A3340 100%)",
  dust:  "linear-gradient(135deg, #B8A848 0%, #998731 100%)",
  night: "linear-gradient(135deg, #7D2027 0%, #4A1218 100%)",
};

const RODEBJER_MOODS: Record<string, string> = {
  rose:   "linear-gradient(135deg, #E8D5C8 0%, #B08B70 100%)",  // Opulent Rose Paper
  ink:    "linear-gradient(135deg, #212326 0%, #4A4A48 100%)",  // Deras svarta
  sand:   "linear-gradient(135deg, #F0EBE0 0%, #C8BCAE 100%)",  // Paper
  gold:   "linear-gradient(135deg, #C4B098 0%, #8A7860 100%)",  // Dovare guld
  sage:   "linear-gradient(135deg, #C4C8B8 0%, #7A806B 100%)",  // Dov sage
  plum:   "linear-gradient(135deg, #A08088 0%, #5A4650 100%)",  // Dov plum
  night:  "linear-gradient(135deg, #2A2E38 0%, #14161C 100%)",  // Djup natt
  dust:   "linear-gradient(135deg, #D8CFBE 0%, #A89880 100%)",  // Dust/tan
};

export function moodGradientsFor(brandSlug?: string): Record<string, string> {
  const isRodebjerMode = brandSlug === "rodebjer" || process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";
  return isRodebjerMode ? RODEBJER_MOODS : MOOD_GRADIENTS;
}

export function getMoodGradient(mood: string): string {
  const palette = moodGradientsFor();
  return palette[mood] ?? palette.sand;
}
