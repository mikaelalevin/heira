export const RODEBJER_STORE_FOOTER =
  "Rodebjer Flagship Store Norrmalmstorg\n+46 (8) - 611 01 17\nSmålandsgatan 14, 111 46 Stockholm";

const STORE_SENDER_NAME = "Butik Norrmalmstorg";

/** Name to sign off with, or null if the message is sent from the store itself (no personal name). */
export function getSignoffName(repName: string | null | undefined): string | null {
  if (!repName || repName === STORE_SENDER_NAME) return null;
  return repName;
}
