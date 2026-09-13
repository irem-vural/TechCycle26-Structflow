// ============================================================
// StructFlow — Geometri Doğrulama Modülü
// ============================================================

import type { GeometryValidationError, WallGeometry, GeometryFieldKey } from '../types';

/** Her geometri alanı için min/max/step sınırları */
export interface GeometryLimit {
  min: number;
  max: number;
  step: number;
  /** Birim (sadece UI gösterimi için) */
  unit: string;
  /** Kullanıcı dostu etiket */
  label: string;
}

export const GEOMETRY_LIMITS: Record<GeometryFieldKey, GeometryLimit> = {
  H: { min: 1.5, max: 15, step: 0.1, unit: 'm', label: 'Gövde Yüksekliği (H)' },
  x1: { min: 1, max: 12, step: 0.1, unit: 'm', label: 'Taban Plağı Toplam Genişliği (x1)' },
  x2: { min: 0, max: 6, step: 0.1, unit: 'm', label: 'Burun Uzunluğu (x2)' },
  x3: { min: 0.2, max: 3, step: 0.05, unit: 'm', label: 'Gövde Alt Genişliği (x3)' },
  x4: { min: 0.2, max: 3, step: 0.05, unit: 'm', label: 'Gövde Üst Genişliği (x4)' },
  x5: { min: 0.3, max: 3, step: 0.05, unit: 'm', label: 'Taban Plağı Kalınlığı (x5)' },
  x6: { min: 0.1, max: 12, step: 0.1, unit: 'm', label: 'Topuk Uzunluğu (x6)' },
  Df: { min: 0.5, max: 6, step: 0.1, unit: 'm', label: 'Temel Derinliği (Df)' },
  L: { min: 1, max: 200, step: 0.5, unit: 'm', label: 'Duvar Uzunluğu (L)' },
};

/**
 * Bir değeri ilgili alanın min/max sınırlarına sıkıştırır.
 */
export function clampGeometryValue(field: GeometryFieldKey, value: number): number {
  const limit = GEOMETRY_LIMITS[field];
  if (!limit) return value;
  if (!Number.isFinite(value)) return limit.min;
  return Math.min(Math.max(value, limit.min), limit.max);
}

/**
 * Geometri parametrelerini statik kurallara göre doğrular.
 * Dönen dizi boşsa geometri geçerlidir.
 */
export function validateGeometry(geo: WallGeometry): GeometryValidationError[] {
  const errors: GeometryValidationError[] = [];

  // 1. Sınır kontrolleri (error seviyesi)
  (Object.keys(GEOMETRY_LIMITS) as GeometryFieldKey[]).forEach((key) => {
    const value = geo[key];
    const limit = GEOMETRY_LIMITS[key];
    if (!Number.isFinite(value)) {
      errors.push({ field: key, severity: 'error', message: `${limit.label} sayısal olmalı` });
      return;
    }
    if (value < limit.min) {
      errors.push({
        field: key,
        severity: 'error',
        message: `${limit.label} en az ${limit.min} ${limit.unit} olmalı`,
      });
    } else if (value > limit.max) {
      errors.push({
        field: key,
        severity: 'error',
        message: `${limit.label} en fazla ${limit.max} ${limit.unit} olabilir`,
      });
    }
  });

  if (geo.x6 <= 0) {
    errors.push({
      field: 'x1',
      severity: 'error',
      message: 'Topuk uzunluğu (x6) pozitif olmalı: x1 > x2 + x3',
    });
  }

  // 2. Geometrik tutarlılık kuralları
  if (geo.Df > geo.H + geo.x5) {
    errors.push({
      field: 'Df',
      severity: 'error',
      message: 'Temel derinliği (Df), toplam duvar yüksekliğinden (H + x5) büyük olamaz',
    });
  }

  if (geo.Df < geo.x5) {
    errors.push({
      field: 'Df',
      severity: 'warning',
      message: 'Gömülme derinliği (Df) en az temel kalınlığı (x5) kadar olmalı',
    });
  }

  if (geo.x2 + geo.x3 > geo.x1) {
    errors.push({
      field: 'x1',
      severity: 'error',
      message: 'Topuk genişliği negatif: x2 + x3 toplam genişlik x1\'i aşıyor',
    });
  }

  if (geo.x2 + geo.x3 === geo.x1) {
    errors.push({
      field: 'x1',
      severity: 'warning',
      message: 'Topuk genişliği sıfır: x1 > x2 + x3 olmalı',
    });
  }

  if (geo.x4 > geo.x3) {
    errors.push({
      field: 'x4',
      severity: 'error',
      message: 'Gövde üst kalınlığı (x4), gövde alt kalınlığından (x3) büyük olamaz',
    });
  }

  // 3. Asgari gövde oran kontrolü (uyarı)
  const stemHeight = geo.H;
  if (stemHeight > 0 && geo.x3 < Math.max(0.2, stemHeight / 12)) {
    errors.push({
      field: 'x3',
      severity: 'warning',
      message: 'Gövde alt kalınlığı (x3) stem yüksekliğine göre çok ince olabilir (öneri: H/12)',
    });
  }

  return errors;
}

/**
 * Sadece kritik hataları (severity='error') döner.
 */
export function hasBlockingErrors(errors: GeometryValidationError[]): boolean {
  return errors.some((e) => e.severity === 'error');
}
