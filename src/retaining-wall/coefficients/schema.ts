// ============================================================
// Katsayı Tipi Tanımları + Metadata
// ============================================================

/** Katsayı kaynağı türü */
export type SourceType = 'standard' | 'literature' | 'assumption';

/** Güvenilirlik seviyesi */
export type Reliability = 'high' | 'medium' | 'low';

/** Katsayı tanımı — her katsayı bu yapıya uyar */
export interface Coefficient {
  /** Benzersiz anahtar (programatik) */
  key: string;
  /** Katsayının sembolü (FE_eksk, Ka vb.) */
  symbol: string;
  /** Varsayılan değer */
  value: number;
  /** Birim */
  unit: string;
  /** Kaynak referansı */
  source: string;
  /** Kaynak türü */
  sourceType: SourceType;
  /** Kaynağın doğrulanabilir adresi */
  sourceUrl?: string;
  /** Faktörün temsil ettiği bölge / veri seti kapsamı */
  region?: string;
  /** Kaynak veya veri seti yılı */
  year?: number;
  /** Sistem sınırı ve kullanım notları */
  notes?: string;
  /** Güvenilirlik seviyesi */
  reliability: Reliability;
  /** Türkçe açıklama */
  description: string;
  /** Kullanıcı tarafından düzenlenebilir mi? */
  isEditable: boolean;
  /** Kategori (gruplama için) */
  category: CoefficientCategory;
}

export type CoefficientCategory =
  | 'excavator'
  | 'dumper_truck'
  | 'rebar_truck'
  | 'concrete_mixer'
  | 'concrete_pump'
  | 'compactor'
  | 'emission_factor'
  | 'material_emission';

/** Kullanıcı tarafından özelleştirilmiş katsayı */
export interface CustomCoefficient {
  key: string;
  customValue: number;
  isModified: boolean;
}
