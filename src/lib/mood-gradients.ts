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

export function getMoodGradient(mood: string): string {
  return MOOD_GRADIENTS[mood] ?? MOOD_GRADIENTS.sand;
}
