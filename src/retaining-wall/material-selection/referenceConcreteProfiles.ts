import type { ConcreteClass } from '../types';

/**
 * StructFlow başlangıç/reference beton profilleri.
 *
 * Bunlar herhangi bir beton standardının zorunlu veya reçete-preskriptif
 * değerleri değildir. Kullanıcı yeni bir sınıf seçtiğinde yalnızca düzenlenebilir
 * bir başlangıç noktası sağlar; nihai reçete laboratuvar deneyi ve proje için
 * geçerli uygunluk kriterleriyle doğrulanmalıdır.
 */
export const STRUCTFLOW_REFERENCE_PROFILE_SOURCE = 'StructFlow reference/starter data';
export const STRUCTFLOW_REFERENCE_PROFILE_NOTE =
  'Yazılım başlangıç profili; standardın zorunlu beton reçetesi değildir. Nihai dozaj laboratuvar deneyiyle doğrulanmalıdır.';

export interface StructFlowReferenceConcreteProfile {
  concreteClass: ConcreteClass;
  characteristicCylinderStrengthMpa: number;
  targetStrength7DaysMpa: number;
  targetStrength28DaysMpa: number;
  targetLongTermAgeDays: 56;
  targetLongTermStrengthMpa: number;
  starterRecipe: {
    cementKgM3: number;
    waterKgM3: number;
    coarseAggregateKgM3: number;
    fineAggregateKgM3: number;
  };
}

export const STRUCTFLOW_REFERENCE_CONCRETE_PROFILES: Readonly<Record<ConcreteClass, StructFlowReferenceConcreteProfile>> = {
  C20: {
    concreteClass: 'C20',
    characteristicCylinderStrengthMpa: 20,
    targetStrength7DaysMpa: 14.7,
    targetStrength28DaysMpa: 20,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 25,
    starterRecipe: { cementKgM3: 260, waterKgM3: 175, coarseAggregateKgM3: 1050, fineAggregateKgM3: 850 },
  },
  C25: {
    concreteClass: 'C25',
    characteristicCylinderStrengthMpa: 25,
    targetStrength7DaysMpa: 18.3,
    targetStrength28DaysMpa: 25,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 30,
    starterRecipe: { cementKgM3: 300, waterKgM3: 175, coarseAggregateKgM3: 1050, fineAggregateKgM3: 830 },
  },
  C30: {
    concreteClass: 'C30',
    characteristicCylinderStrengthMpa: 30,
    targetStrength7DaysMpa: 22,
    targetStrength28DaysMpa: 30,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 35,
    starterRecipe: { cementKgM3: 350, waterKgM3: 175, coarseAggregateKgM3: 1050, fineAggregateKgM3: 800 },
  },
  C35: {
    concreteClass: 'C35',
    characteristicCylinderStrengthMpa: 35,
    targetStrength7DaysMpa: 25.7,
    targetStrength28DaysMpa: 35,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 40,
    starterRecipe: { cementKgM3: 380, waterKgM3: 170, coarseAggregateKgM3: 1050, fineAggregateKgM3: 780 },
  },
  C40: {
    concreteClass: 'C40',
    characteristicCylinderStrengthMpa: 40,
    targetStrength7DaysMpa: 29.3,
    targetStrength28DaysMpa: 40,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 45,
    starterRecipe: { cementKgM3: 400, waterKgM3: 165, coarseAggregateKgM3: 1050, fineAggregateKgM3: 770 },
  },
  C45: {
    concreteClass: 'C45',
    characteristicCylinderStrengthMpa: 45,
    targetStrength7DaysMpa: 33,
    targetStrength28DaysMpa: 45,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 50,
    starterRecipe: { cementKgM3: 420, waterKgM3: 160, coarseAggregateKgM3: 1050, fineAggregateKgM3: 760 },
  },
  C50: {
    concreteClass: 'C50',
    characteristicCylinderStrengthMpa: 50,
    targetStrength7DaysMpa: 36.7,
    targetStrength28DaysMpa: 50,
    targetLongTermAgeDays: 56,
    targetLongTermStrengthMpa: 55,
    starterRecipe: { cementKgM3: 450, waterKgM3: 155, coarseAggregateKgM3: 1050, fineAggregateKgM3: 740 },
  },
};

export function getStructFlowReferenceConcreteProfile(concreteClass: ConcreteClass): StructFlowReferenceConcreteProfile {
  return STRUCTFLOW_REFERENCE_CONCRETE_PROFILES[concreteClass];
}

export function getStructFlowCharacteristicStrengthMpa(concreteClass: ConcreteClass): number {
  return getStructFlowReferenceConcreteProfile(concreteClass).characteristicCylinderStrengthMpa;
}
