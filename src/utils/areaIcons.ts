/**
 * UI Mapping Utility
 * Maps Home Assistant areas and entity names to Lucide-React icons for consistent visuals.
 */
import type { IconComponent } from '../types/icon';
import {
  Lightbulb,
  Sun,
  Moon,
  Lamp,
  DoorOpen,
  Shrub,
  Armchair,
  Warehouse,
  BookOpen,
  Bed,
  Tv,
  Sofa,
  ChefHat,
  Utensils,
  Bath,
  ShowerHead,
  Key,
  Briefcase,
  Laptop,
  Flower2,
  TreePine,
  Car,
  WashingMachine,
  Gamepad2,
} from 'lucide-react';

/** Dictionary of all selectable icons for rooms, with their label. */
export const ROOM_ICONS: Record<string, { icon: IconComponent; label: string }> = {
  Lamp: { icon: Lamp, label: 'Salon (Lampe)' },
  Sofa: { icon: Sofa, label: 'Salon (Canapé)' },
  Tv: { icon: Tv, label: 'Salon (TV)' },
  Bed: { icon: Bed, label: 'Chambre (Lit)' },
  Moon: { icon: Moon, label: 'Chambre (Lune)' },
  ChefHat: { icon: ChefHat, label: 'Cuisine (Toque)' },
  Utensils: { icon: Utensils, label: 'Cuisine (Ustensiles)' },
  Sun: { icon: Sun, label: 'Cuisine (Soleil)' },
  Bath: { icon: Bath, label: 'Salle de bain (Baignoire)' },
  ShowerHead: { icon: ShowerHead, label: 'Salle de bain (Douche)' },
  Lightbulb: { icon: Lightbulb, label: 'Ampoule' },
  DoorOpen: { icon: DoorOpen, label: 'Entrée (Porte)' },
  Key: { icon: Key, label: 'Entrée (Clé)' },
  Briefcase: { icon: Briefcase, label: 'Bureau (Mallette)' },
  Laptop: { icon: Laptop, label: 'Bureau (Ordinateur)' },
  Shrub: { icon: Shrub, label: 'Jardin (Arbuste)' },
  Flower2: { icon: Flower2, label: 'Jardin (Fleur)' },
  TreePine: { icon: TreePine, label: 'Jardin (Sapin)' },
  Armchair: { icon: Armchair, label: 'Terrasse' },
  Warehouse: { icon: Warehouse, label: 'Garage (Entrepôt)' },
  Car: { icon: Car, label: 'Garage (Voiture)' },
  WashingMachine: { icon: WashingMachine, label: 'Buanderie' },
  Gamepad2: { icon: Gamepad2, label: 'Salle de jeux' },
  BookOpen: { icon: BookOpen, label: 'Bibliothèque' },
};

/**
 * Returns the Lucide icon component that best matches the given HA area or entity name.
 * Checks for a custom user-defined icon name first.
 * Falls back to Lightbulb for unrecognised strings.
 *
 * @param area - Area or entity name string from Home Assistant.
 * @param customIcons - Optional custom room icons mapping from preferences.
 * @returns A Lucide React icon component.
 */
export const getIconForArea = (area: string, customIcons?: Record<string, string>) => {
  if (customIcons && customIcons[area]) {
    const customIconName = customIcons[area];
    if (ROOM_ICONS[customIconName]) {
      return ROOM_ICONS[customIconName].icon;
    }
  }

  // Accents removed so that "Entrée" matches the keyword "entree".
  const lower = area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (lower.includes('chambre') || lower.includes('bed')) return Moon;
  if (lower.includes('cuisine') || lower.includes('kitchen')) return Sun;
  if (lower.includes('salon') || lower.includes('living')) return Lamp;
  if (lower.includes('bain') || lower.includes('bath')) return Lightbulb;
  if (lower.includes('entree') || lower.includes('hall') || lower.includes('entry'))
    return DoorOpen;
  if (lower.includes('jardin') || lower.includes('garden')) return Shrub;
  if (lower.includes('terrasse') || lower.includes('terrace') || lower.includes('patio'))
    return Armchair;
  if (lower.includes('garage') || lower.includes('parking')) return Warehouse;
  if (lower.includes('bibliotheque') || lower.includes('library')) return BookOpen;
  return Lightbulb;
};
