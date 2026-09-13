import { WallGeometry } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

export interface GeometryMetrics {
  totalCrossSectionArea: number; // m²
  /** 1 metrelik şerit için beton hacmi (m³/m) */
  concreteVolumePerMeter: number; // m³/m
  centerOfGravity: Point2D; // m
  /** 1 metrelik şerit için kazı hacmi (m³/m) */
  excavationVolumePerMeter: number; // m³/m
  /** 1 metrelik şerit için dolgu hacmi (m³/m) */
  backfillVolumePerMeter: number; // m³/m
  /** 1 metrelik şerit için kalıp alanı (m²/m) */
  formworkAreaPerMeter: number; // m²/m

  // ── Toplam (L ile ölçeklenmiş) değerler ──
  /** Toplam beton hacmi (m³) = concreteVolumePerMeter × L */
  totalConcreteVolume: number;
  /** Toplam kalıp alanı (m²): yan iki yüz dahil = formworkAreaPerMeter × L + 2 × crossSectionArea */
  totalFormworkArea: number;
  /** Toplam kazı hacmi — şev payı dahil (m³) */
  totalExcavationVolume: number;
  /** Toplam dolgu hacmi (m³) */
  totalBackfillVolume: number;
  /** Duvar uzunluğu (m) */
  wallLength: number;

  heelWidth: number; // m
  stemHeight: number; // m
}

/**
 * Duvar geometrisine bağlı metraj ve ağırlık merkezi hesaplamaları.
 * Varsayım: Gövdenin (stem) ön yüzü diktir. Arka yüzü eğimlidir.
 * Orijin (0,0) noktası: Taban plağının sol alt köşesi (Burun ucu altı).
 */
export function calculateGeometryMetrics(geo: WallGeometry): GeometryMetrics {
  const { H, x1, x2, x3, x4, x5, Df, L } = geo;
  // Geriye uyum: eski senaryolar için L yoksa 1m şerit gibi davran
  const wallLength = Number.isFinite(L) && L > 0 ? L : 1;

  // H is the free stem height measured from the TOP of the base slab to the
  // wall top. Base thickness x5 is therefore not subtracted from H.
  const stemHeight = H;
  const heelWidth = x1 - x2 - x3;

  // 1. Taban Plağı (Base Slab)
  const baseArea = x1 * x5;
  const baseCGx = x1 / 2;
  const baseCGy = x5 / 2;

  // 2. Gövde Dikdörtgen Kısmı (Stem Rectangular Part - Front)
  const stemRectArea = x4 * stemHeight;
  const stemRectCGx = x2 + x4 / 2;
  const stemRectCGy = x5 + stemHeight / 2;

  // 3. Gövde Üçgen Kısmı (Stem Triangular Part - Back)
  const triangleBase = x3 - x4;
  const stemTriArea = 0.5 * triangleBase * stemHeight;
  // Üçgenin ağırlık merkezi tabanından h/3, dik kenarından b/3 uzaklıktadır.
  const stemTriCGx = x2 + x4 + triangleBase / 3;
  const stemTriCGy = x5 + stemHeight / 3;

  // Toplam Alan ve Hacim
  const totalCrossSectionArea = baseArea + stemRectArea + stemTriArea;
  const concreteVolumePerMeter = totalCrossSectionArea; // 1 metre derinlik için

  // Ağırlık Merkezi (Center of Gravity)
  const safeArea = totalCrossSectionArea > 0 ? totalCrossSectionArea : 1;
  const cgX =
    (baseArea * baseCGx + stemRectArea * stemRectCGx + stemTriArea * stemTriCGx) / safeArea;

  const cgY =
    (baseArea * baseCGy + stemRectArea * stemRectCGy + stemTriArea * stemTriCGy) / safeArea;

  // Kazı Hacmi (1m şerit): x1 × Df + yan şev payı (1:1.5) — şev kütlesi iki taraf için:
  // 2 × (0.5 × (1.5 × Df) × Df) = 1.5 × Df²
  const excavationVolumePerMeter = x1 * Df + 1.5 * Df * Df;

  // Dolgu Hacmi (Backfill + Top of Toe)
  const backfillOnHeel = Math.max(0, heelWidth) * stemHeight;
  const fillOnToe = x2 * Math.max(0, Df - x5);
  const backfillVolumePerMeter = backfillOnHeel + fillOnToe;

  // Kalıp Alanı (1m şerit): ön+arka taban + ön gövde + arka eğimli gövde
  const slantedStemLength = Math.sqrt(Math.pow(triangleBase, 2) + Math.pow(stemHeight, 2));
  const formworkAreaPerMeter = x5 + x5 + stemHeight + slantedStemLength;

  // ── Toplam değerler ──
  const totalConcreteVolume = concreteVolumePerMeter * wallLength;
  // Yan iki yüz: duvar başı ve sonundaki kesit alanları
  const totalFormworkArea = formworkAreaPerMeter * wallLength + 2 * totalCrossSectionArea;
  // Kazı: şev payı uçlarda da ek konik hacim ekler — yaklaşık: baz formülü × L + uç koniler
  const endConesVolume = (2 / 3) * 1.5 * Df * Df * Df; // iki uç şev payı (yaklaşık)
  const totalExcavationVolume = excavationVolumePerMeter * wallLength + endConesVolume;
  const totalBackfillVolume = backfillVolumePerMeter * wallLength;

  return {
    totalCrossSectionArea,
    concreteVolumePerMeter,
    centerOfGravity: { x: cgX, y: cgY },
    excavationVolumePerMeter,
    backfillVolumePerMeter,
    formworkAreaPerMeter,

    totalConcreteVolume,
    totalFormworkArea,
    totalExcavationVolume,
    totalBackfillVolume,
    wallLength,

    heelWidth,
    stemHeight,
  };
}
