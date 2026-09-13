import type { EmissionFactor, MaterialPrice } from '../material-selection/types';

/**
 * TEKNOFEST tesliminde kullanici tarafindan onaylanan Excel benchmark seti.
 *
 * Bu modul malzeme uretim emisyonu ve ciplak malzeme fiyatlari icin tek
 * kaynak noktadir. Fiyatlar KDV HARIC TL/kg'dir; KDV yalniz proje maliyet
 * motorunda, proje seviyesinde uygulanir.
 */
export const APPROVED_MATERIAL_DATA_SOURCE = 'TEKNOFEST 2026 · kullanıcı onaylı Excel benchmarkı';
export const APPROVED_MATERIAL_DATA_DATE = '2026-09-12';

export interface ApprovedEmissionBenchmark {
  value: number;
  unit: 'kgCO₂e/kg';
  source: string;
  region: string;
  year?: number;
  notes: string;
  uncertaintyRange?: {
    min: number;
    max: number;
    unit: 'kgCO₂e/kg';
    basis: string;
  };
}

export interface ApprovedPriceBenchmark {
  value: number;
  unit: 'TL/kg';
  currency: 'TRY';
  date: string;
  source: string;
  sourceUrl?: string;
  region: string;
  year?: number;
  notes: string;
}

export interface ApprovedMaterialBenchmark {
  emission?: ApprovedEmissionBenchmark;
  price?: ApprovedPriceBenchmark;
}

const emission = (
  value: number,
  source: string,
  year: number | undefined,
  notes: string,
  region = 'Excel kaynak kaydı',
  uncertaintyRange?: ApprovedEmissionBenchmark['uncertaintyRange'],
): ApprovedEmissionBenchmark => ({
  value,
  unit: 'kgCO₂e/kg',
  source,
  region,
  year,
  notes: `${notes} Sayısal değer ${APPROVED_MATERIAL_DATA_SOURCE} üzerinden kullanıcı tarafından onaylanmıştır.`,
  uncertaintyRange,
});

const price = (
  value: number,
  source: string,
  notes: string,
  region = 'Türkiye',
  year = 2026,
  date = APPROVED_MATERIAL_DATA_DATE,
  sourceUrl?: string,
): ApprovedPriceBenchmark => ({
  value,
  unit: 'TL/kg',
  currency: 'TRY',
  date,
  source,
  sourceUrl,
  region,
  year,
  notes: `${notes} Sayısal değer ${APPROVED_MATERIAL_DATA_SOURCE} üzerinden kullanıcı tarafından onaylanmıştır. Fiyat KDV hariçtir; KDV proje toplamına yalnız bir kez eklenir.`,
});

export const APPROVED_MATERIAL_BENCHMARKS: Readonly<Record<string, ApprovedMaterialBenchmark>> = {
  cement: {
    emission: emission(0.8, 'Al-Hamrani et al. (2021)', 2021, 'Portland çimentosu malzeme üretim benchmarkı.'),
    price: price(3.3119, 'VGM 2026 resmi analiz', 'Portland çimentosu çıplak malzeme fiyatı.'),
  },
  fly_ash: {
    emission: emission(0.01, 'Rawat & Pasla (2024)', 2024, 'Uçucu kül malzeme üretim/işleme benchmarkı.'),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'Uçucu kül için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  slag: {
    emission: emission(0.09, 'Rawat & Pasla (2024)', 2024, 'GGBFS malzeme üretim/işleme benchmarkı.'),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'GGBFS için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  silica_fume: {
    emission: emission(0.025, 'Ashraf et al. (2022)', 2022, 'Silis dumanı malzeme üretim/işleme benchmarkı.'),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'Silis dumanı için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  metakaolin: {
    emission: emission(0.33, 'Hammond & Jones (ICE)', undefined, 'Metakaolin malzeme üretim benchmarkı.'),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'Metakaolin için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  natural_coarse_aggregate: {
    emission: emission(0.04, 'Al-Hamrani et al. (2021)', 2021, 'Doğal iri agrega üretim benchmarkı.'),
    price: price(0.62, 'Ankara 2026 piyasa verisi', 'Doğal iri agrega çıplak malzeme fiyatı.', 'Ankara, Türkiye'),
  },
  natural_fine_aggregate: {
    emission: emission(0.004, 'Al-Hamrani et al. (2021)', 2021, 'Doğal ince agrega üretim benchmarkı.'),
    price: price(0.72, 'Ankara 2026 piyasa verisi', 'Doğal ince agrega çıplak malzeme fiyatı.', 'Ankara, Türkiye'),
  },
  recycled_aggregate_unspecified: {
    emission: emission(0.008, 'Belirlenecek', undefined, 'RCA merkez emisyon faktörü; Excel kaynak hücresi henüz doğrulanmış bir literatür atfı vermemektedir.', 'Excel kaynak kaydı', {
      min: 0.004,
      max: 0.012,
      unit: 'kgCO₂e/kg',
      basis: 'Kullanıcı onaylı Excel belirsizlik aralığı',
    }),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'Geri dönüştürülmüş agrega için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  recycled_fine_aggregate: {
    emission: emission(0.008, 'Belirlenecek', undefined, 'RCA merkez emisyon faktörü; Excel kaynak hücresi henüz doğrulanmış bir literatür atfı vermemektedir.', 'Excel kaynak kaydı', {
      min: 0.004,
      max: 0.012,
      unit: 'kgCO₂e/kg',
      basis: 'Kullanıcı onaylı Excel belirsizlik aralığı',
    }),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'Geri dönüştürülmüş ince agrega için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  recycled_coarse_aggregate: {
    emission: emission(0.008, 'Belirlenecek', undefined, 'RCA merkez emisyon faktörü; Excel kaynak hücresi henüz doğrulanmış bir literatür atfı vermemektedir.', 'Excel kaynak kaydı', {
      min: 0.004,
      max: 0.012,
      unit: 'kgCO₂e/kg',
      basis: 'Kullanıcı onaylı Excel belirsizlik aralığı',
    }),
    price: price(0, 'Proje maliyet kabulü · 2026-09-13', 'Geri dönüştürülmüş iri agrega için varsayılan satın alma maliyeti 0 TL/kg kabul edilir; lojistik maliyeti mesafeye göre ayrıca hesaplanır.'),
  },
  water: {
    emission: emission(0.0003, 'Genel LCA kabulü', undefined, 'Karışım suyu üretim benchmarkı.'),
    price: price(0.0648, 'VGM 2026', 'Karışım suyu çıplak malzeme fiyatı.'),
  },
  superplasticizer: {
    emission: emission(1.88, 'European Federation of Concrete (2015)', 2015, 'Süperakışkanlaştırıcı üretim benchmarkı.'),
    price: price(42.00, 'ÇŞİDB 2026 poz 10.300.2032', 'Süperakışkanlaştırıcı çıplak malzeme fiyatı.'),
  },
  reinforcement_steel: {
    emission: emission(0.7, 'worldsteel / Climatiq', undefined, 'Donatı çeliği üretim benchmarkı.'),
    price: price(30.76, '11 Eylül 2026 Türkiye piyasa verisi', 'Donatı çeliği piyasa fiyatından KDV ayrıştırılmış çıplak malzeme fiyatı.', 'Türkiye', 2026, '2026-09-11'),
  },
  sodium_hydroxide: {
    emission: emission(1.915, 'NaOH (Excel kaynak hücresi)', undefined, 'Sodyum hidroksit emisyon benchmarkı; kaynak hücresi doğrulanabilir yayın künyesi içermemektedir.'),
    price: price(73.4, '2026 Türkiye piyasa verisi', 'Sodyum hidroksit fiyatı %100 katı madde eşdeğerine normalize edilmiştir.'),
  },
};

export function getApprovedEmissionBenchmark(materialId: string): ApprovedEmissionBenchmark | null {
  return APPROVED_MATERIAL_BENCHMARKS[materialId]?.emission ?? null;
}

export function getApprovedPriceBenchmark(materialId: string): ApprovedPriceBenchmark | null {
  return APPROVED_MATERIAL_BENCHMARKS[materialId]?.price ?? null;
}

export function getApprovedEmissionFactor(materialId: string): EmissionFactor | null {
  const benchmark = getApprovedEmissionBenchmark(materialId);
  if (!benchmark) return null;
  return {
    value: benchmark.value,
    unit: benchmark.unit,
    source: benchmark.source,
    region: benchmark.region,
    year: benchmark.year,
    notes: benchmark.uncertaintyRange
      ? `${benchmark.notes} Belirsizlik aralığı: ${benchmark.uncertaintyRange.min}-${benchmark.uncertaintyRange.max} ${benchmark.uncertaintyRange.unit}.`
      : benchmark.notes,
  };
}

export function getApprovedMaterialPrice(materialId: string): MaterialPrice | null {
  const benchmark = getApprovedPriceBenchmark(materialId);
  return benchmark ? { ...benchmark } : null;
}

/** Approved rebar benchmark converted from TL/kg to the legacy TL/ton input. */
export function approvedRebarPriceTlPerTon(): number {
  const value = getApprovedPriceBenchmark('reinforcement_steel')?.value;
  if (value == null) throw new Error('Onaylı donatı çeliği fiyatı tanımlı değil.');
  return value * 1000;
}
