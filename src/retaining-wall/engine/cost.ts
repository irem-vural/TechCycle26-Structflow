import { calculateMixMetrics } from '../material-selection/mixModel';
import { getDefaultMaterialPrice } from '../material-selection/defaultPrices';
import type { ConcreteMixDesign, MaterialInput, MaterialPrice } from '../material-selection/types';
import { materialQuantityAccountingState } from '../material-selection/units';
import { ConcreteClass, CostResult, EmissionResult, LogisticsInput, QuantityResult } from '../types';

export interface CostEngineInput {
  quantities: QuantityResult;
  emissions: EmissionResult;
  logistics: LogisticsInput;
  concreteClass?: ConcreteClass;
  concreteMix?: ConcreteMixDesign;
}

const DENSITY_CONCRETE_T_PER_M3 = 2.4;
const DENSITY_SOIL_T_PER_M3 = 1.8;

const MATERIAL_DENSITIES_KG_M3: Record<string, number> = {
  cement: 3150,
  fly_ash: 2300,
  slag: 2900,
  silica_fume: 2200,
  metakaolin: 2600,
  natural_fine_aggregate: 2650,
  natural_coarse_aggregate: 2650,
  recycled_fine_aggregate: 2400,
  recycled_coarse_aggregate: 2400,
  water: 1000,
  superplasticizer: 1100,
  air_entraining: 1000,
  accelerator: 1200,
  retarder: 1200,
  steel_fiber: 7850,
  pp_fiber: 910,
  glass_fiber: 2600,
};

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function priceFor(mix: ConcreteMixDesign, material: MaterialInput): MaterialPrice | null {
  return material.price ?? mix.prices?.[material.id] ?? getDefaultMaterialPrice(material.id);
}

function costPerM3(material: MaterialInput, amountKgM3: number | null, price: MaterialPrice | null): number | null {
  if (amountKgM3 == null || price?.value == null || !Number.isFinite(price.value)) return null;
  const density = finite(material.densityKgM3 ?? MATERIAL_DENSITIES_KG_M3[material.id] ?? (material.id === 'water' ? 1000 : null));
  if (price.unit === 'TL/kg') return amountKgM3 * price.value;
  if (price.unit === 'TL/ton') return amountKgM3 / 1000 * price.value;
  if (density == null || density <= 0) return null;
  if (price.unit === 'TL/m³' || price.unit === 'TL/m3') return amountKgM3 / density * price.value;
  return amountKgM3 / density * 1000 * price.value;
}

export function calculateRecipeMaterialCostPerM3(
  concreteMix: ConcreteMixDesign,
  projectConcreteVolumeM3 = 1,
): number | null {
  const metrics = calculateMixMetrics(concreteMix, projectConcreteVolumeM3);
  let complete = true;
  let total = 0;
  for (const material of metrics.materials) {
    const quantityState = materialQuantityAccountingState(material);
    if (quantityState === 'disabled' || quantityState === 'zero') continue;
    const amount = quantityState === 'resolved' ? finite(material.canonicalKgPerM3) : null;
    if (amount == null) {
      complete = false;
      continue;
    }
    const price = priceFor(concreteMix, material);
    const cost = costPerM3(material, amount, price);
    if (cost == null) complete = false;
    total += cost ?? 0;
  }
  return complete ? total : null;
}

function baseCostItems(quantities: QuantityResult, emissions: EmissionResult, logistics: LogisticsInput) {
  const rebarCost = quantities.reinforcementWeight * logistics.rebarPrice;
  const excavationCost = quantities.excavationVolume * (logistics.excavationUnitCost ?? 0);
  const backfillCost = quantities.backfillVolume * (logistics.backfillUnitCost ?? 0);
  const formworkCost = quantities.formworkArea * (logistics.formworkUnitCost ?? 0);
  const rebarLaborCost = quantities.reinforcementWeight * (logistics.rebarLaborUnitCost ?? 0);
  const concreteTons = quantities.concreteVolume * DENSITY_CONCRETE_T_PER_M3;
  const excavationTons = quantities.excavationVolume * DENSITY_SOIL_T_PER_M3;
  const rebarTons = quantities.reinforcementWeight;
  const tariff = logistics.transportRatePerTonKm ?? 0;
  const transportCost =
    concreteTons * logistics.distancePlant * tariff +
    rebarTons * logistics.distanceRebar * tariff +
    excavationTons * logistics.distanceDump * tariff;
  const fuelCost = emissions.machinery.totalCost;
  return { rebarCost, excavationCost, backfillCost, formworkCost, rebarLaborCost, transportCost, fuelCost };
}

/** Cost has two mutually exclusive concrete modes: ready-mix or recipe. */
export function calculateCost(input: CostEngineInput): CostResult {
  const { quantities, emissions, logistics, concreteMix } = input;
  const base = baseCostItems(quantities, emissions, logistics);
  const missingPrices: string[] = [];
  const missingAmounts: string[] = [];
  const recipeMaterialCosts: CostResult['recipeMaterialCosts'] = [];
  let recipeCostPerM3: number | null = null;
  let concreteCost: number | null;
  let concreteCostMode: CostResult['concreteCostMode'] = concreteMix?.priceMode ?? 'readyMix';

  if (concreteMix && concreteMix.priceMode === 'recipe') {
    const metrics = calculateMixMetrics(concreteMix, quantities.concreteVolume);
    let complete = true;
    let total = 0;
    for (const material of metrics.materials) {
      const quantityState = materialQuantityAccountingState(material);
      if (quantityState === 'disabled' || quantityState === 'zero') continue;
      const amount = quantityState === 'resolved' ? finite(material.canonicalKgPerM3) : null;
      const price = priceFor(concreteMix, material);
      const cost = costPerM3(material, amount, price);
      if (amount == null) {
        complete = false;
        missingAmounts.push(material.id);
      } else if (cost == null) {
        complete = false;
        missingPrices.push(material.id);
      }
      total += cost ?? 0;
      recipeMaterialCosts.push({
        id: material.id,
        name: material.name,
        amountKgM3: amount,
        projectAmountKg: amount == null ? null : amount * quantities.concreteVolume,
        costPerM3: cost,
        projectCost: cost == null ? null : cost * quantities.concreteVolume,
        price: price?.value ?? null,
        priceUnit: price?.unit,
        priceCurrency: price?.currency ?? null,
        priceDate: price?.date ?? null,
        source: price?.source ?? null,
        sourceUrl: price?.sourceUrl ?? null,
        priceRegion: price?.region ?? null,
        priceYear: price?.year ?? null,
        priceNotes: price?.notes ?? null,
      });
    }
    recipeCostPerM3 = complete ? total : null;
    concreteCost = recipeCostPerM3 == null ? null : recipeCostPerM3 * quantities.concreteVolume;
  } else {
    concreteCostMode = 'readyMix';
    const selectedConcreteClass = input.concreteClass ?? concreteMix?.targetConcreteClass;
    const classPrice = selectedConcreteClass == null
      ? undefined
      : logistics.concretePricesByClass?.[selectedConcreteClass];
    const unitPrice = classPrice ?? concreteMix?.readyMixPrice?.value ?? logistics.concretePrice;
    concreteCost = finite(unitPrice) == null ? null : quantities.concreteVolume * (unitPrice ?? 0);
    recipeCostPerM3 = finite(unitPrice);
  }

  const materialCost = concreteCost == null ? null : concreteCost + base.rebarCost;
  const subtotal = materialCost == null ? null : materialCost + base.excavationCost + base.backfillCost + base.formworkCost + base.rebarLaborCost + base.transportCost + base.fuelCost;
  const overhead = subtotal == null ? null : subtotal * Math.max(0, logistics.overheadPercent ?? 0) / 100;
  const vat = subtotal == null || overhead == null ? null : (subtotal + overhead) * Math.max(0, logistics.vatPercent ?? 0) / 100;
  const totalCost = subtotal == null || overhead == null || vat == null ? null : subtotal + overhead + vat;
  const dataComplete = concreteCost != null && missingPrices.length === 0 && missingAmounts.length === 0;
  const warnings = [
    ...(missingAmounts.length > 0 ? [`Malzeme miktarı çözümlenemedi: ${[...new Set(missingAmounts)].join(', ')}.`] : []),
    ...(missingPrices.length > 0 ? [`Malzeme fiyatı eksik: ${[...new Set(missingPrices)].join(', ')}.`] : []),
    ...(concreteCost == null ? ['Beton maliyeti hesaplanamadı.'] : []),
  ];

  return {
    concreteCost,
    rebarCost: base.rebarCost,
    excavationCost: base.excavationCost,
    backfillCost: base.backfillCost,
    formworkCost: base.formworkCost,
    rebarLaborCost: base.rebarLaborCost,
    transportCost: base.transportCost,
    fuelCost: base.fuelCost,
    materialCost,
    subtotal,
    overhead,
    vat,
    totalCost,
    unitCostPerM3: totalCost == null || quantities.concreteVolume <= 0 ? null : totalCost / quantities.concreteVolume,
    unitCostPerMeterWall: totalCost == null || quantities.wallLength <= 0 ? null : totalCost / quantities.wallLength,
    concreteCostPerM3: concreteCost == null || quantities.concreteVolume <= 0 ? null : concreteCost / quantities.concreteVolume,
    concreteCostPerMeterWall: concreteCost == null || quantities.wallLength <= 0 ? null : concreteCost / quantities.wallLength,
    concreteCostMode,
    recipeCostPerM3,
    recipeMaterialCosts,
    missingPrices: [...new Set(missingPrices)],
    missingAmounts: [...new Set(missingAmounts)],
    dataComplete,
    warnings,
  };
}
