/**
 * tariffs — Prix de l'énergie pour estimer le coût de la consommation dans l'onglet Historique :
 * tarif réglementé EDF (Tarif Bleu, option Base) pour l'électricité, prix repère de la CRE
 * (chauffage, B1) pour le gaz. Part consommation seulement, TTC, abonnements exclus. L'eau prend
 * le prix que Suez remonte (`SuezData.price`).
 *
 * Contrat de la maison : électricité en Base, sans heures creuses (choix de l'utilisateur, 19
 * novembre 2026). Valeurs relevées sur Kelwatt et Selectra (grilles de la CRE) ; une nouvelle
 * grille s'ajoute en tête de liste, à sa date d'effet.
 */

/** A price applying from a day (`yyyy-MM-dd`) until the next entry. */
interface PriceStep {
  from: string;
  /** €/kWh TTC. */
  price: number;
}

/**
 * Tarif Bleu, option Base, 6 kVA (the 9 kVA price differs by less than 1 %). Newest first.
 */
const ELECTRICITY_BASE: readonly PriceStep[] = [
  { from: '2026-08-01', price: 0.2001 },
  { from: '2026-02-01', price: 0.194 },
  { from: '2025-08-01', price: 0.1952 },
  { from: '2025-02-01', price: 0.2016 },
  { from: '2024-02-01', price: 0.2516 },
  { from: '2023-08-01', price: 0.2276 },
  { from: '2023-02-01', price: 0.2062 },
];

/**
 * CRE reference price for gas (heating, B1), month by month. Newest first. Months marked
 * `approximate` were not found with certainty in the published grids: neighbouring value.
 */
const GAS_REFERENCE: readonly (PriceStep & { approximate?: boolean })[] = [
  { from: '2026-12-01', price: 0.16897 },
  { from: '2026-11-01', price: 0.15761 },
  { from: '2026-10-01', price: 0.14558 },
  { from: '2026-09-01', price: 0.13474 },
  { from: '2026-08-01', price: 0.12558 },
  { from: '2026-07-01', price: 0.12766 },
  { from: '2026-06-01', price: 0.11789 },
  { from: '2026-05-01', price: 0.12558 },
  { from: '2026-04-01', price: 0.10415 },
  { from: '2026-03-01', price: 0.10513 },
  { from: '2026-02-01', price: 0.09982 },
  { from: '2026-01-01', price: 0.10192 },
  { from: '2025-12-01', price: 0.1028, approximate: true },
  { from: '2025-11-01', price: 0.10282, approximate: true },
  { from: '2025-10-01', price: 0.10345, approximate: true },
  { from: '2025-09-01', price: 0.10337, approximate: true },
  { from: '2025-08-01', price: 0.10541, approximate: true },
  { from: '2025-07-01', price: 0.10801, approximate: true },
  { from: '2025-06-01', price: 0.10852 },
  { from: '2025-05-01', price: 0.11002 },
  { from: '2025-04-01', price: 0.1162 },
  { from: '2025-03-01', price: 0.11611 },
  { from: '2025-02-01', price: 0.12155 },
  { from: '2025-01-01', price: 0.11876 },
  { from: '2024-12-01', price: 0.11854 },
  { from: '2024-11-01', price: 0.11237 },
  { from: '2024-10-01', price: 0.10932 },
  { from: '2024-09-01', price: 0.11062 },
  { from: '2024-08-01', price: 0.10363 },
  { from: '2024-07-01', price: 0.10495 },
  { from: '2024-06-01', price: 0.10261 },
  { from: '2024-05-01', price: 0.0914 },
  { from: '2024-04-01', price: 0.0894 },
  { from: '2024-03-01', price: 0.08792 },
  // Before March 2024: no published value found, order of magnitude of the winter 2023-2024.
  { from: '2023-01-01', price: 0.11, approximate: true },
];

/** Price of the cubic metre of water when Suez does not report one (€/m³, March 2026). */
export const DEFAULT_WATER_PRICE = 2.74;

const priceOn = <T extends PriceStep>(steps: readonly T[], day: string): T =>
  steps.find((step) => step.from <= day) ?? steps[steps.length - 1];

/**
 * Electricity price of a day.
 *
 * @param day - Day as `yyyy-MM-dd`.
 * @returns €/kWh TTC (consumption part).
 */
export const electricityPrice = (day: string): number => priceOn(ELECTRICITY_BASE, day).price;

/**
 * Gas price of a day.
 *
 * @param day - Day as `yyyy-MM-dd`.
 * @returns €/kWh TTC (consumption part), and whether that month's price is approximate.
 */
export const gasPrice = (day: string): { price: number; approximate: boolean } => {
  const step = priceOn(GAS_REFERENCE, day);
  return { price: step.price, approximate: !!step.approximate };
};
