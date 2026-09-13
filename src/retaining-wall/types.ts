// ============================================================
// StructFlow — Retaining Wall Module Type Definitions
// ============================================================

import type { ConcreteMixDesign, MixMetrics } from './material-selection/types';

// ── Geometry ──────────────────────────────────────────────────

/** Duvar enkesit geometrisi (m cinsinden) */
export interface WallGeometry {
  /** Duvarın serbest yüksekliği: taban plağı üstünden gövde tepesine (m) */
  H: number;
  /** Taban plağı toplam genişliği (m) */
  x1: number;
  /** Burun (toe) uzunluğu (m) */
  x2: number;
  /** Gövde alt genişliği (m) */
  x3: number;
  /** Gövde üst genişliği (m) */
  x4: number;
  /** Taban plağı kalınlığı (m) */
  x5: number;
  /** Topuk (heel) uzunluğu (m) — readonly/türetilmiş: x1 - x2 - x3 */
  x6: number;
  /** Duvar önündeki zemin derinliği: ön zemin kotundan taban altına Df (m) */
  Df: number;
  /** Duvar uzunluğu — Z ekseni (m) */
  L: number;
}

// ── Zemin Parametreleri ───────────────────────────────────────

/** Kullanıcının sonuç panelinde gördüğü zemin sınıfı. Sayısal parametreler yine esas hesaptır. */
export type SoilType = 'granular' | 'clayey' | 'silty' | 'rockfill' | 'custom';

/** Zemin parametreleri */
export interface SoilParameters {
  /** Zemin türü; geriye dönük projelerde boş kalabilir. */
  type?: SoilType;
  /** Birim hacim ağırlığı (kN/m³) */
  gamma: number;
  /** İçsel sürtünme açısı (derece) */
  phi: number;
  /** Kohezyonu (kPa) */
  c: number;
  /** Zemin eğim açısı (derece) — dolgu için */
  beta: number;
}

// ── Malzeme Sınıfları ────────────────────────────────────────

/** Beton dayanım sınıfı etiketi; RC hesap dayanımları ayrıca rcDesign içinde verilir. */
export type ConcreteClass =
  | 'C20'
  | 'C25'
  | 'C30'
  | 'C35'
  | 'C40'
  | 'C45'
  | 'C50';

/** Donatı sınıfı etiketi; RC hesap akma dayanımı ayrıca rcDesign.fyMpa ile verilir. */
export type RebarClass = 'B420C' | 'B500C';

/** ACI CODE-318-25 ön tasarımında kullanılan açık malzeme özellikleri. */
export interface RcDesignProperties {
  /** Belirtilmiş beton basınç dayanımı f'c (MPa). */
  fcMpa: number;
  /** Donatı akma dayanımı fy (MPa). */
  fyMpa: number;
  /** Büzülme/sıcaklık donatısı brüt alan oranı. */
  shrinkageTemperatureRatio: number;
}

export interface ReinforcementSettings {
  /** Otomatik değer ön metraj içindir; nihai kesit donatısı iç stabilite hesabından gelir. */
  mode: 'automatic' | 'custom';
  customRatioKgM3: number;
  coverMm?: number;
  preferredDiameterMm?: number;
  preferredSpacingMm?: number;
  minSpacingMm?: number;
  maxSpacingMm?: number;
}

// ── Hesaplama Teori Seçimleri ────────────────────────────────

/** Yanal toprak basıncı için proje hesap teorisi. */
export type EarthPressureTheory = 'coulomb';

/** Taşıma gücü hesap yöntemi */
export type BearingCapacityMethod = 'terzaghi';

// ── Kullanıcı Girdileri (Tüm Modül) ─────────────────────────

export interface RetainingWallInput {
  geometry: WallGeometry;
  backfillSoil: SoilParameters;
  foundationSoil: SoilParameters;
  concreteClass: ConcreteClass;
  rebarClass: RebarClass;
  /** Eksik eski projelerde store tarafından proje varsayılanlarıyla tamamlanır. */
  rcDesign?: RcDesignProperties;
  reinforcement?: ReinforcementSettings;
  surchargeLoad: number; // q (kN/m²)
  earthPressureTheory: EarthPressureTheory;
  bearingCapacityMethod: BearingCapacityMethod;
  /** Legacy/UI alanı; final üretim senaryosu düşey sanal düzlemde δ=0°'a normalize eder. */
  wallFrictionAngle: number; // δ
}

// ── Lojistik Girdileri ───────────────────────────────────────

export interface LogisticsInput {
  /** Beton santrali mesafesi — tek yön (km) */
  distancePlant: number;
  /** Katı atık depolama tesisi mesafesi — tek yön (km) */
  distanceDump: number;
  /** Donatı (demir) tedarikçisi mesafesi — tek yön (km) */
  distanceRebar: number;
  /** Kalıp tedarikçisi mesafesi — tek yön (km) */
  distanceFormwork: number;
  /** Kırmaşas ocağı mesafesi — tek yön (km) — ileride eklenecek */
  distanceCrushedStone: number;
  /** Dizel ₺/L — kullanıcı girer */
  dieselPrice: number;
  /** Günlük çalışma süresi (saat) */
  dailyWorkHours: number;
  /** Beton m³ fiyatı (₺) */
  concretePrice: number;
  /** Bölge/teklif bazlı, kullanıcı tarafından düzenlenebilen hazır beton fiyatları. */
  concretePricesByClass?: Partial<Record<ConcreteClass, number>>;
  /** Donatı ton fiyatı (₺) */
  rebarPrice: number;

  // ── Ek Maliyet Kalemleri ──
  /** Kazı işçilik+makine birim fiyatı (₺/m³) */
  excavationUnitCost: number;
  /** Dolgu işçilik+sıkıştırma birim fiyatı (₺/m³) */
  backfillUnitCost: number;
  /** Kalıp kurma+sökme birim fiyatı (₺/m²) */
  formworkUnitCost: number;
  /** Donatı işçilik birim fiyatı — bükme+montaj (₺/ton) */
  rebarLaborUnitCost: number;
  /** Karayolu nakliye tarifesi (₺/ton·km) */
  transportRatePerTonKm: number;
  /** Genel gider + kâr marjı (%) */
  overheadPercent: number;
  /** KDV oranı (%) */
  vatPercent: number;
}

// ── Toprak Basıncı Sonuçları ─────────────────────────────────

export interface EarthPressureResult {
  theory: EarthPressureTheory;
  /** Final scenario convention: vertical virtual plane at heel edge. */
  activeConvention?: 'heel-edge-vertical-virtual-plane';
  /** Active-pressure wall/interface friction angle actually used (deg). */
  wallFrictionAngle?: number;
  /** Backfill surface slope angle actually used by the active model (deg). */
  backfillSlopeAngle?: number;
  /** Virtual-plane inclination from horizontal actually used (deg). */
  virtualPlaneAngle?: number;
  Ka: number;
  Kp: number;
  /** Zemin öz-ağırlığından gelen aktif bileşke (kN/m). */
  PaSoil: number;
  /** Sürşarjdan gelen aktif bileşke (kN/m). */
  PaSurcharge: number;
  Pa: number; // kN/m'
  Pp: number; // kN/m'
  PaSoil_h: number;
  PaSoil_v: number;
  PaSurcharge_h: number;
  PaSurcharge_v: number;
  Pa_h: number; // yatay bileşen
  Pa_v: number; // düşey bileşen
  /** Aktif zemin üçgeninin taban plağı üstünden etki yüksekliği (m). */
  soilLeverArm: number;
  /** Sürşarj dikdörtgeninin taban plağı üstünden etki yüksekliği (m). */
  surchargeLeverArm: number;
  /** Pasif basınçta gerçekten kullanılan ön zemin yüksekliği (m). */
  passiveHeight: number;
}

// ── Stabilite Sonuçları ──────────────────────────────────────

export type SafetyStatus = 'safe' | 'marginal' | 'unsafe';

export interface StabilityCheck {
  factorOfSafety: number;
  requiredFS: number;
  status: SafetyStatus;
  /** Adım adım hesap detayları */
  steps: CalculationStep[];
}

export interface CalculationStep {
  description: string;
  formula: string;
  variables: Record<string, number>;
  result: number;
  unit: string;
  reference?: string; // standart maddesi
}

export interface StabilityResult {
  sliding: StabilityCheck;
  overturning: StabilityCheck;
  bearingCapacity: StabilityCheck;
  /** Taban merkezine göre eksantrisite büyüklüğü |e| (m). */
  eccentricity: number;
  /** İşaretli eksantrisite; + işareti burun tarafına kaymayı ifade eder. */
  signedEccentricity?: number;
  /** Eksantrisite teşhisi için B-2|e| etkin genişliği (m); qult hesabına ikinci kez uygulanmaz. */
  effectiveBearingWidth?: number;
  qMax: number; // kN/m²
  qMin: number; // kN/m²
  /** Gerçek taban temas dağılımının burun ucundaki gerilmesi (kPa). */
  qToe?: number;
  /** Gerçek taban temas dağılımının topuk ucundaki gerilmesi (kPa). */
  qHeel?: number;
  /** Basınç temas bölgesinin başlangıcı, burun ucundan x (m). */
  compressionStartX?: number;
  /** Basınç temas bölgesinin bitişi, burun ucundan x (m). */
  compressionEndX?: number;
  /** Açık tasarım varsayımları / mühendislik uyarıları. */
  warnings?: string[];
}

// ── İç Stabilite ─────────────────────────────────────────────

export interface ReinforcementAssignment {
  /** 1.00 m tasarım şeridindeki nominal çubuk yoğunluğu (adet/m); sonlu proje çubuk adedi değildir. */
  count: number;
  diameter: number; // mm
  spacing: number; // mm
  area: number; // mm²
}

export interface SectionDesign {
  /** Bu sonuç yalnızca ön boyutlandırma/ön donatı tasarımıdır. */
  designBasis?: 'preliminary';
  designStandard?: 'ACI CODE-318-25';
  momentDemand: number; // kN·m
  momentCapacity: number; // kN·m
  shearDemand: number; // kN
  shearCapacity: number; // kN
  requiredAs: number; // mm²
  /** Moment ve ACI ön-kontrol minimumundan gelen yapısal talep. */
  flexuralRequiredAs?: number; // mm²
  /** Kullanıcının kg/m³ olarak verdiği uygulama hedefinin As karşılığı. */
  requestedAs?: number; // mm²
  minAs: number; // mm²
  maxAs: number; // mm²
  reinforcement: ReinforcementAssignment;
  /** Bir metre duvar şeridinde dağıtma/büzülme-sıcaklık donatısı. */
  secondaryRequiredAs?: number; // mm²/m
  secondaryReinforcement?: ReinforcementAssignment;
  developmentLength: number; // mm
  /** Donatı kütlesi hesabında kullanılan eleman serbest/konsol uzunluğu. */
  memberLengthM?: number;
  effectiveDepthMm?: number;
  sectionThicknessMm?: number;
  reinforcementRatio?: number;
  /** Talep ve uygulanan donatının 1 m şerit kütlesi. */
  requiredRebarKgPerMeter?: number;
  appliedRebarKgPerMeter?: number;
  shearStatus?: SafetyStatus;
  flexuralStatus?: SafetyStatus;
  warnings?: string[];
}

export interface InternalStabilityResult {
  stem: SectionDesign;
  toe: SectionDesign;
  heel: SectionDesign;
}

// ── Metraj ───────────────────────────────────────────────────

/**
 * Tüm hacim/ağırlık alanları TOPLAM duvar içindir (L ile çarpılmıştır).
 * *PerMeter alanları 1 metrelik şerit için referans değerlerdir.
 */
export interface QuantityResult {
  // Toplam değerler
  concreteVolume: number; // m³
  reinforcementWeight: number; // ton
  formworkArea: number; // m²
  excavationVolume: number; // m³
  backfillVolume: number; // m³

  // 1 metre şerit referans değerleri
  concreteVolumePerMeter: number; // m³/m
  reinforcementWeightPerMeter: number; // ton/m
  /** Açık birim: 1 m duvar için uygulanan donatı. */
  reinforcementWeightKg?: number; // kg
  reinforcementWeightKgPerMeter?: number; // kg/m
  /** Açık birim: hesap motorunun talep ettiği donatı. */
  reinforcementRequiredKg?: number; // kg
  reinforcementRequiredKgPerMeter?: number; // kg/m
  formworkAreaPerMeter: number; // m²/m
  excavationVolumePerMeter: number; // m³/m
  backfillVolumePerMeter: number; // m³/m

  /** Duvar uzunluğu (m) — referans */
  wallLength: number;
  reinforcementRatioKgM3?: number;
  reinforcementMode?: 'automatic' | 'custom' | 'structural';
  reinforcementRequestedRatioKgM3?: number | null;
  reinforcementWarnings?: string[];
}

// ── Emisyon ──────────────────────────────────────────────────

export interface MachineryEmissionDetail {
  machineName: string;
  workingTime: number; // saat
  fuelConsumption: number; // L
  emission: number; // kg CO2-eq
  cost: number; // ₺
}

export interface EmissionResult {
  /** Makine emisyonları toplamı */
  machinery: {
    excavator: MachineryEmissionDetail;
    dumperTruck: MachineryEmissionDetail;
    rebarTruck: MachineryEmissionDetail;
    concreteMixer: MachineryEmissionDetail;
    concretePump: MachineryEmissionDetail;
    compactor: MachineryEmissionDetail;
    totalEmission: number; // kg CO2-eq
    totalFuel: number; // L
    totalCost: number; // ₺
  };
  /** Malzeme üretim emisyonları */
  materials: {
    cement: number | null;
    aggregate: number | null;
    /** İri agrega emisyonu (detay) */
    coarseAggregate: number | null;
    /** İnce agrega emisyonu (detay) */
    fineAggregate: number | null;
    steel: number | null;
    totalEmission: number | null; // kg CO2-eq; null when a used factor is missing
    knownSubtotal: number;
    byMaterial: Array<{
      id: string;
      name: string;
      amountKgM3: number | null;
      projectAmountKg: number | null;
      factorKgCo2ePerKg: number | null;
      factorRegion?: string | null;
      factorYear?: number | null;
      factorNotes?: string | null;
      emissionKgCo2eM3: number | null;
      emissionKgCo2eProject: number | null;
      source?: string | null;
      sourceUrl?: string | null;
    }>;
    missingFactors: string[];
    missingAmounts: string[];
    dataComplete: boolean;
  };
  /** Beton lojistik emisyonları */
  logistics: {
    mixerLogistics: number;
    pumpLogistics: number;
    totalEmission: number; // kg CO2-eq
  };
  /** Toplam proje emisyonu */
  grandTotal: number | null; // kg CO2-eq; null when a material total is incomplete
  grandTotalPerMeter?: number | null; // kg CO2-eq/m
  knownSubtotal: number;
  dataComplete: boolean;
  warnings: string[];
}

// ── Maliyet ──────────────────────────────────────────────────

export interface CostResult {
  // Detay kalemler
  concreteCost: number | null;
  rebarCost: number;
  excavationCost: number;
  backfillCost: number;
  formworkCost: number;
  rebarLaborCost: number;
  transportCost: number;
  fuelCost: number;

  // Toplamlar
  materialCost: number | null; // beton + donatı (geriye uyumluluk)
  subtotal: number | null; // tüm kalemlerin ham toplamı (overhead/vat öncesi)
  overhead: number | null; // subtotal × overhead%
  vat: number | null; // (subtotal + overhead) × vat%
  totalCost: number | null; // subtotal + overhead + vat

  // Birim metrikler
  unitCostPerM3: number | null; // ₺/m³ (beton hacmine göre)
  unitCostPerMeterWall: number | null; // ₺/m (duvar uzunluğuna göre)
  /** Yalnızca aktif beton reçetesinin hacim birim maliyeti. */
  concreteCostPerM3?: number | null;
  concreteCostPerMeterWall?: number | null;
  concreteCostMode: 'readyMix' | 'recipe';
  recipeCostPerM3: number | null;
  recipeMaterialCosts: Array<{
    id: string;
    name: string;
    amountKgM3: number | null;
    projectAmountKg: number | null;
    costPerM3: number | null;
    projectCost: number | null;
    price?: number | null;
    priceUnit?: string;
    priceCurrency?: string | null;
    priceDate?: string | null;
    source?: string | null;
    sourceUrl?: string | null;
    priceRegion?: string | null;
    priceYear?: number | null;
    priceNotes?: string | null;
  }>;
  missingPrices: string[];
  missingAmounts: string[];
  dataComplete: boolean;
  warnings: string[];
}

// ── Geometri Doğrulama ───────────────────────────────────────

export type GeometryFieldKey = keyof WallGeometry;

export interface GeometryValidationError {
  field: GeometryFieldKey | 'general';
  severity: 'error' | 'warning';
  message: string;
}

// ── Senaryo / Optimizasyon ───────────────────────────────────

export interface Scenario {
  id: string;
  name: string;
  input: RetainingWallInput;
  logistics: LogisticsInput;
  concreteMix: ConcreteMixDesign;
  /** Excel/PDF ve karşılaştırmaların aynı katsayı setini kullanabilmesi için saklanır. */
  customCoefficients?: Record<string, number>;
  mixMetrics: MixMetrics;
  earthPressures?: EarthPressureResult;
  internalStability?: InternalStabilityResult;
  stability?: StabilityResult;
  quantities?: QuantityResult;
  emissions?: EmissionResult;
  cost?: CostResult;
  /** Runtime normalizasyonu ve hesap konvansiyonu hakkında mühendislik notları. */
  engineeringWarnings?: string[];
  createdAt: Date;
}
