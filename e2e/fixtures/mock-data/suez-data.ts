/**
 * Mock Suez water consumption data for testing.
 */

import { SuezData } from '../../../src/services/energy';

// Generate last 30 days of data ending today
const generateSuezData = (): SuezData => {
  const dailyConsumption = [];
  const now = new Date();
  const price = 2.74;

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    // Add consumption between 50 L and 250 L
    const value = 50 + (i % 7) * 25 + (i % 3) * 15;
    dailyConsumption.push({
      date: date.toISOString(),
      value,
      isEstimate: i === 0, // Mark today/yesterday as estimate optionally
    });
  }

  return {
    price,
    dailyConsumption,
  };
};

export const SUEZ_DATA = generateSuezData();
