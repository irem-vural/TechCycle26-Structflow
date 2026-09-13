/**
 * Concrete quantity units are intentionally kept in one module.  The engine
 * consumes only kg/m³; these types preserve the user's original entry so an
 * export can explain how a value was normalized.
 */
export type MaterialQuantityUnit = '%' | 'kg/m³' | 'kg/m3' | 'kg' | 'ton' | 'm³' | 'm3' | 'L' | 'L/m³' | 'L/m3';

export type InputBasis = 'amount' | 'ratio';

export type CanonicalUnit = 'percent' | 'kgPerM3' | 'kg' | 'ton' | 'm3' | 'L' | 'LPerM3';

export interface MaterialQuantityInput {
  value: number | null;
  unit: MaterialQuantityUnit;
  basis: InputBasis;
  densityKgM3?: number | null;
  rawValue?: number | string | null;
  rawUnit?: string | null;
  canonicalKgPerM3?: number | null;
}

export interface UnitNormalizationContext {
  projectConcreteVolumeM3?: number | null;
  groupTotalKgPerM3?: number | null;
  defaultDensityKgM3?: number | null;
}

export interface UnitNormalizationResult {
  canonicalKgPerM3: number | null;
  warning?: string;
}

export type MaterialQuantityAccountingState = 'disabled' | 'zero' | 'resolved' | 'missing';

export function canonicalUnit(unit: string): CanonicalUnit | null {
  const normalized = unit.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
  if (normalized === '%' || normalized === 'percent' || normalized === 'yüzde') return 'percent';
  if (normalized === 'kg/m³' || normalized === 'kg/m3' || normalized === 'kgperm3') return 'kgPerM3';
  if (normalized === 'kg' || normalized === 'kilogram' || normalized === 'kilograms') return 'kg';
  if (normalized === 'ton' || normalized === 't' || normalized === 'tonne') return 'ton';
  if (normalized === 'm³' || normalized === 'm3' || normalized === 'm^3') return 'm3';
  if (normalized === 'l' || normalized === 'litre' || normalized === 'liter') return 'L';
  if (normalized === 'l/m³' || normalized === 'l/m3' || normalized === 'lperm3') return 'LPerM3';
  return null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) ? value : null;
}

function declaredNumericValue(value: number | string | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][-+]?\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Classifies whether an enabled material has a usable canonical quantity for
 * accounting. An explicit declared quantity of zero is a valid zero even when
 * its unit would otherwise need missing density/project context. Any other
 * enabled row whose canonical kg/m³ cannot be resolved is missing data.
 */
export function materialQuantityAccountingState(
  input: MaterialQuantityInput & { enabled?: boolean },
): MaterialQuantityAccountingState {
  if (input.enabled === false) return 'disabled';

  const canonical = finiteOrNull(input.canonicalKgPerM3);
  if (canonical != null) {
    if (canonical < 0) return 'missing';
    return canonical === 0 ? 'zero' : 'resolved';
  }

  const declared = finiteOrNull(input.value) ?? declaredNumericValue(input.rawValue);
  if (declared === 0) return 'zero';
  return 'missing';
}

/** Normalize one user input. No density or volume is guessed except for water. */
export function normalizeMaterialQuantity(
  input: MaterialQuantityInput,
  context: UnitNormalizationContext = {},
): UnitNormalizationResult {
  const value = finiteOrNull(input.value);
  if (value == null) return { canonicalKgPerM3: null, warning: 'Miktar girilmedi.' };
  if (value < 0) return { canonicalKgPerM3: null, warning: 'Negatif miktar kabul edilmez.' };

  const unit = canonicalUnit(input.unit);
  if (!unit) return { canonicalKgPerM3: null, warning: `Desteklenmeyen birim: ${input.unit}.` };
  if (unit === 'percent') {
    const groupTotal = finiteOrNull(context.groupTotalKgPerM3);
    if (input.basis !== 'ratio') return { canonicalKgPerM3: null, warning: 'Yüzde girişi oran bazlı olmalıdır.' };
    if (groupTotal == null || groupTotal <= 0) {
      return { canonicalKgPerM3: null, warning: 'Yüzdeyi kg/m³ değerine çevirmek için grup toplamı bilinmiyor.' };
    }
    return { canonicalKgPerM3: (value / 100) * groupTotal };
  }

  if (input.basis === 'ratio') {
    return { canonicalKgPerM3: null, warning: 'Oran bazında yalnızca % birimi kullanılabilir.' };
  }

  if (unit === 'kgPerM3' || unit === 'LPerM3') {
    if (unit === 'kgPerM3') return { canonicalKgPerM3: value };
    const density = finiteOrNull(input.densityKgM3 ?? context.defaultDensityKgM3);
    if (density == null || density <= 0) return { canonicalKgPerM3: null, warning: 'L/m³ → kg/m³ için yoğunluk bilinmiyor.' };
    return { canonicalKgPerM3: value * density / 1000 };
  }

  const projectVolume = finiteOrNull(context.projectConcreteVolumeM3);
  if (projectVolume == null || projectVolume <= 0) {
    return { canonicalKgPerM3: null, warning: `${input.unit} → kg/m³ için toplam beton hacmi bilinmiyor.` };
  }

  if (unit === 'kg') return { canonicalKgPerM3: value / projectVolume };
  if (unit === 'ton') return { canonicalKgPerM3: value * 1000 / projectVolume };

  const density = finiteOrNull(input.densityKgM3 ?? context.defaultDensityKgM3);
  if (density == null || density <= 0) {
    return { canonicalKgPerM3: null, warning: `${input.unit} → kg dönüşümü için yoğunluk bilinmiyor.` };
  }
  if (unit === 'm3') return { canonicalKgPerM3: value * density / projectVolume };
  return { canonicalKgPerM3: value * density / 1000 / projectVolume };
}

export function unitLabel(unit: MaterialQuantityUnit): string {
  if (unit === 'kg/m3') return 'kg/m³';
  if (unit === 'm3') return 'm³';
  if (unit === 'L/m3') return 'L/m³';
  return unit;
}

export function formatUnitConversion(input: MaterialQuantityInput, projectConcreteVolumeM3?: number | null): string {
  const result = normalizeMaterialQuantity(input, { projectConcreteVolumeM3 });
  if (result.canonicalKgPerM3 == null) return result.warning ?? 'Dönüşüm yapılamadı.';
  return `${input.value ?? '—'} ${unitLabel(input.unit)} → ${result.canonicalKgPerM3.toFixed(3)} kg/m³`;
}
