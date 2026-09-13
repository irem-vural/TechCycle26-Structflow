import { calculateMachineryEmissions, MachineryEmissionInput } from './machinery';
import { calculateMaterialsEmissions, MaterialsEmissionInput } from './materials';
import { EmissionResult } from '../../types';

export interface EmissionsInput extends MachineryEmissionInput, MaterialsEmissionInput {}

/**
 * Toplam Proje Emisyonlarını Hesaplar (Modül 4)
 */
export function calculateEmissions(input: EmissionsInput): EmissionResult {
  const machinery = calculateMachineryEmissions(input);
  const materials = calculateMaterialsEmissions(input);

  // Beton Lojistiği Emisyonları (Makine hesabı içindeki Mikser ve Pompa emisyonlarıdır)
  const logistics = {
    mixerLogistics: machinery.concreteMixer.emission,
    pumpLogistics: machinery.concretePump.emission,
    totalEmission: machinery.concreteMixer.emission + machinery.concretePump.emission,
  };

  const grandTotal = materials.totalEmission == null ? null : machinery.totalEmission + materials.totalEmission;
  const grandTotalPerMeter = grandTotal == null || input.quantities.wallLength <= 0
    ? null
    : grandTotal / input.quantities.wallLength;
  const knownSubtotal = machinery.totalEmission + materials.knownSubtotal;
  const materialNames = new Map(materials.byMaterial.map((item) => [item.id, item.name]));
  const readableName = (id: string) => materialNames.get(id)
    ?? (id === 'alkali_activator' ? 'Alkali aktivatör' : id === 'active_concrete_mix' ? 'Aktif beton reçetesi' : id);
  const warnings = [
    ...(materials.missingFactors.length > 0 ? [`Eksik emisyon faktörü: ${materials.missingFactors.map(readableName).join(', ')}.`] : []),
    ...(materials.missingAmounts.length > 0 ? [`Eksik malzeme miktarı: ${materials.missingAmounts.map(readableName).join(', ')}.`] : []),
  ];

  return {
    machinery: {
      excavator: machinery.excavator,
      dumperTruck: machinery.dumperTruck,
      rebarTruck: machinery.rebarTruck,
      concreteMixer: machinery.concreteMixer,
      concretePump: machinery.concretePump,
      compactor: machinery.compactor,
      totalEmission: machinery.totalEmission,
      totalFuel: machinery.totalFuel,
      totalCost: machinery.totalCost,
    },
    materials,
    logistics,
    grandTotal,
    grandTotalPerMeter,
    knownSubtotal,
    dataComplete: materials.dataComplete,
    warnings,
  };
}
