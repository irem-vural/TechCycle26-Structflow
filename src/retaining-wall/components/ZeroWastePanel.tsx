'use client';

import { ArrowRight, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ZeroWasteImpactResult, ZeroWasteMaterialBreakdownItem } from '@/retaining-wall/material-selection/zeroWasteImpact';

function fmt(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function projectTotalLabel(wallLengthM: number | null): string {
  return wallLengthM != null && Number.isFinite(wallLengthM) && wallLengthM > 0
    ? `${fmt(wallLengthM, 1)} m duvar toplamı`
    : 'Proje toplamı';
}

function positiveOrNegative(value: number | null, unit: string, positivePrefix = '+'): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return `0 ${unit}`;
  return value > 0
    ? `${positivePrefix}${fmt(value, 2)} ${unit}`
    : `−${fmt(Math.abs(value), 2)} ${unit}`;
}

function reduction(value: number | null, unit: string): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.005) return `0 ${unit}`;
  return value > 0
    ? `−${fmt(value, 2)} ${unit}`
    : `+${fmt(Math.abs(value), 2)} ${unit} daha fazla`;
}

function percentageReduction(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.05) return '%0,0';
  return value > 0 ? `−%${fmt(value, 1)}` : `+%${fmt(Math.abs(value), 1)} daha yüksek`;
}

function originLabel(origin: ZeroWasteMaterialBreakdownItem['circularityOrigin']): string {
  return {
    virgin: 'Birincil',
    industrial_byproduct: 'Endüstriyel yan ürün',
    recycled_waste: 'Geri dönüştürülmüş atık',
    secondary_material: 'İkincil malzeme',
    alternative_mineral: 'Alternatif mineral',
    unknown: 'Bilinmiyor',
  }[origin];
}

function recipeModeLabel(mode: ZeroWasteImpactResult['activeRecipeMode']): string {
  if (mode === 'custom') return 'Custom / Özel reçete';
  if (mode === 'imported') return 'İçe aktarılan reçete';
  return 'Varsayılan reçete';
}

function measuredValue(value: number | null | undefined, unit: string, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? 'Hesaplanamadı'
    : `${fmt(value, digits)} ${unit}`;
}

function referenceValue(available: boolean, value: number | null | undefined, unit: string, digits = 2): string {
  return available ? measuredValue(value, unit, digits) : 'Referans seçilmedi';
}

function comparisonValue(available: boolean, value: string): string {
  return available ? value : 'Referans gerekli';
}

function carbonValue(
  exact: number | null | undefined,
  known: number | null | undefined,
  unit: string,
  digits: number,
): string {
  if (exact != null && Number.isFinite(exact)) return `${fmt(exact, digits)} ${unit}`;
  if (known != null && Number.isFinite(known)) return `${fmt(known, digits)} ${unit} (bilinen alt toplam)`;
  return 'Hesaplanamadı';
}

function DataCell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-2.5 py-2 font-mono text-xs text-[var(--sf-text-secondary)] ${className}`}>{children}</td>;
}

function ImpactTable({ impact }: { impact: ZeroWasteImpactResult }) {
  const rows: Array<{ label: string; reference: string; active: string; gain: string; gainTone: 'positive' | 'negative' | 'neutral' }> = [
    {
      label: 'Beton hacmi',
      reference: referenceValue(impact.referenceAvailable, impact.concreteVolumeM3, 'm³'),
      active: measuredValue(impact.concreteVolumeM3, 'm³'),
      gain: impact.referenceAvailable ? 'Aynı geometri' : 'Referans gerekli',
      gainTone: 'neutral',
    },
    {
      label: 'Geri kazanılmış / ikincil malzeme',
      reference: referenceValue(impact.referenceAvailable, impact.reference.recoveredMaterialProjectTon, 'ton'),
      active: measuredValue(impact.active.recoveredMaterialProjectTon, 'ton'),
      gain: comparisonValue(impact.referenceAvailable, positiveOrNegative(impact.savings.recoveredMaterialTon, 'ton')),
      gainTone: impact.savings.recoveredMaterialTon == null ? 'neutral' : impact.savings.recoveredMaterialTon >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Çimento tüketimi',
      reference: referenceValue(impact.referenceAvailable, impact.reference.cementProjectTon, 'ton'),
      active: measuredValue(impact.active.cementProjectTon, 'ton'),
      gain: comparisonValue(impact.referenceAvailable, reduction(impact.savings.cementTon, 'ton')),
      gainTone: impact.savings.cementTon == null ? 'neutral' : impact.savings.cementTon >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Doğal agrega tüketimi',
      reference: referenceValue(impact.referenceAvailable, impact.reference.naturalAggregateProjectTon, 'ton'),
      active: measuredValue(impact.active.naturalAggregateProjectTon, 'ton'),
      gain: comparisonValue(impact.referenceAvailable, reduction(impact.savings.naturalAggregateTon, 'ton')),
      gainTone: impact.savings.naturalAggregateTon == null ? 'neutral' : impact.savings.naturalAggregateTon >= 0 ? 'positive' : 'negative',
    },
  ];

  return (
    <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--sf-divider)] pb-2">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">Atık Azaltımı ve Doğal Kaynak Kullanımı</h2>
        <span className="text-xs text-[var(--sf-text-muted)]">{projectTotalLabel(impact.wallLengthM)}</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--sf-border-subtle)]">
        <table className="w-full min-w-[510px] border-collapse">
          <thead className="bg-[var(--sf-bg-panel-raised)] text-xs uppercase tracking-wide text-[var(--sf-text-muted)]">
            <tr>
              <th className="px-2.5 py-2 text-left font-semibold">Gösterge</th>
              <th className="px-2.5 py-2 text-right font-semibold">Referans tasarım</th>
              <th className="px-2.5 py-2 text-right font-semibold">Aktif reçete</th>
              <th className="px-2.5 py-2 text-right font-semibold">Kazanç</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--sf-divider)]">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-2.5 py-2 text-xs text-[var(--sf-text-secondary)]">{row.label}</td>
                <DataCell className="text-right text-[var(--sf-text-muted)]">{row.reference}</DataCell>
                <DataCell className="text-right text-[var(--sf-text-primary)]">{row.active}</DataCell>
                <DataCell className={`text-right ${row.gainTone === 'positive' ? 'text-[var(--sf-status-success)]' : row.gainTone === 'negative' ? 'text-[var(--sf-status-warning)]' : 'text-[var(--sf-text-muted)]'}`}>{row.gain}</DataCell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!impact.referenceAvailable && <p className="mt-2 rounded-md border border-[var(--sf-status-info)] bg-[var(--sf-status-info-bg)] px-2.5 py-2 text-xs leading-4 text-[var(--sf-text-secondary)]"><strong>{recipeModeLabel(impact.activeRecipeMode)}</strong> aktif ve gerçek dozajlarıyla hesaplanıyor. Yalnızca “kazanç/fark” sütunlarını üretmek için ayrıca bir referans reçete gerekir.</p>}
    </section>
  );
}

function CarbonTable({ impact }: { impact: ZeroWasteImpactResult }) {
  const referenceUnitCarbon = impact.referenceAvailable
    ? carbonValue(impact.reference.recipeCarbonKgM3, impact.reference.knownRecipeCarbonKgM3, 'kg CO₂e/m³', 1)
    : 'Referans seçilmedi';
  const referenceProjectCarbon = impact.referenceAvailable
    ? carbonValue(impact.reference.recipeCarbonProjectTon, impact.reference.knownRecipeCarbonProjectTon, 'ton CO₂e', 2)
    : 'Referans seçilmedi';
  const activeUnitCarbon = carbonValue(impact.active.recipeCarbonKgM3, impact.active.knownRecipeCarbonKgM3, 'kg CO₂e/m³', 1);
  const activeProjectCarbon = carbonValue(impact.active.recipeCarbonProjectTon, impact.active.knownRecipeCarbonProjectTon, 'ton CO₂e', 2);
  return (
    <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--sf-divider)] pb-2">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">Karbon Emisyonu</h2>
        <Popover>
          <PopoverTrigger type="button" className="flex size-6 cursor-pointer items-center justify-center rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-muted)] transition-colors hover:border-[var(--sf-border-strong)] hover:text-[var(--sf-text-primary)]" title="Karşılaştırma kapsamı" aria-label="Karşılaştırma kapsamı">
            <Info className="size-3" />
          </PopoverTrigger>
          <PopoverContent align="end" side="bottom" sideOffset={6} positionerClassName="z-[120]" className="z-[120] w-64 gap-0 rounded-lg border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] p-2.5 text-xs leading-relaxed text-[var(--sf-text-secondary)] shadow-[var(--sf-shadow-overlay)]">
            Bu karşılaştırma beton reçetesine bağlı malzeme üretim emisyonlarını kapsamaktadır. Donatı, şantiye ve lojistik emisyonları CO₂ sekmesinde ayrıca raporlanır.
          </PopoverContent>
        </Popover>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--sf-border-subtle)]">
        <table className="w-full min-w-[470px] border-collapse">
          <thead className="bg-[var(--sf-bg-panel-raised)] text-xs uppercase tracking-wide text-[var(--sf-text-muted)]">
            <tr><th className="px-2.5 py-2 text-left font-semibold">Gösterge</th><th className="px-2.5 py-2 text-right font-semibold">Referans</th><th className="px-2.5 py-2 text-right font-semibold">Alternatif</th><th className="px-2.5 py-2 text-right font-semibold">Azaltım</th></tr>
          </thead>
          <tbody className="divide-y divide-[var(--sf-divider)]">
            <tr>
              <td className="px-2.5 py-2 text-xs text-[var(--sf-text-secondary)]">Birim emisyon</td>
              <DataCell className="text-right text-[var(--sf-text-muted)]">{referenceUnitCarbon}</DataCell>
              <DataCell className="text-right text-[var(--sf-text-primary)]">{activeUnitCarbon}</DataCell>
              <DataCell className={`text-right ${impact.savings.carbonPercent != null && impact.savings.carbonPercent > 0 ? 'text-[var(--sf-status-success)]' : impact.savings.carbonPercent != null && impact.savings.carbonPercent < 0 ? 'text-[var(--sf-status-warning)]' : 'text-[var(--sf-text-muted)]'}`}>{comparisonValue(impact.referenceAvailable, percentageReduction(impact.savings.carbonPercent))}</DataCell>
            </tr>
            <tr>
              <td className="px-2.5 py-2 text-xs text-[var(--sf-text-secondary)]">{projectTotalLabel(impact.wallLengthM)}</td>
              <DataCell className="text-right text-[var(--sf-text-muted)]">{referenceProjectCarbon}</DataCell>
              <DataCell className="text-right text-[var(--sf-text-primary)]">{activeProjectCarbon}</DataCell>
              <DataCell className={`text-right ${impact.savings.carbonTon != null && impact.savings.carbonTon > 0 ? 'text-[var(--sf-status-success)]' : impact.savings.carbonTon != null && impact.savings.carbonTon < 0 ? 'text-[var(--sf-status-warning)]' : 'text-[var(--sf-text-muted)]'}`}>{comparisonValue(impact.referenceAvailable, reduction(impact.savings.carbonTon, 'ton CO₂e'))}</DataCell>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ActiveMaterialImpactTable({ impact }: { impact: ZeroWasteImpactResult }) {
  return (
    <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5">
      <div className="mb-2 flex items-start justify-between gap-2 border-b border-[var(--sf-divider)] pb-2">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">Aktif reçete · malzeme ve CO₂ hesabı</h2>
          <p className="mt-0.5 text-xs leading-4 text-[var(--sf-text-muted)]">0 emisyon faktörü geçerli bir sayısal değerdir; eksik veri gibi davranılmaz ve toplam hesaba 0 katkı ile dahil edilir.</p>
        </div>
        <span className="shrink-0 rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-2 py-1 text-xs font-semibold text-[var(--sf-text-secondary)]">{recipeModeLabel(impact.activeRecipeMode)}</span>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--sf-border-subtle)]">
        <table className="w-full min-w-[700px] border-collapse">
          <thead className="bg-[var(--sf-bg-panel-raised)] text-xs uppercase tracking-wide text-[var(--sf-text-muted)]">
            <tr>
              <th className="px-2.5 py-2 text-left font-semibold">Malzeme</th>
              <th className="px-2.5 py-2 text-right font-semibold">Aktif dozaj</th>
              <th className="px-2.5 py-2 text-right font-semibold">CO₂ hesabı dozajı</th>
              <th className="px-2.5 py-2 text-right font-semibold">EF</th>
              <th className="px-2.5 py-2 text-right font-semibold">CO₂e / m³</th>
              <th className="px-2.5 py-2 text-right font-semibold">Proje CO₂e</th>
              <th className="px-2.5 py-2 text-left font-semibold">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--sf-divider)]">
            {impact.activeMaterialImpacts.map((item) => {
              const zeroFactor = item.factorKgCo2ePerKg === 0;
              const accountingDiffers = item.recipeAmountKgM3 != null
                && item.accountingAmountKgM3 != null
                && Math.abs(item.recipeAmountKgM3 - item.accountingAmountKgM3) > 1e-9;
              return (
                <tr key={item.id}>
                  <td className="px-2.5 py-2">
                    <p className="text-xs font-medium text-[var(--sf-text-secondary)]">{item.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--sf-text-muted)]">{originLabel(item.circularityOrigin)}{item.factorSource ? ` · ${item.factorSource}` : ''}</p>
                  </td>
                  <DataCell className="text-right text-[var(--sf-text-primary)]">{fmt(item.recipeAmountKgM3, 2)} kg/m³</DataCell>
                  <DataCell className={`text-right ${accountingDiffers ? 'text-[var(--sf-status-warning)]' : 'text-[var(--sf-text-secondary)]'}`}>{fmt(item.accountingAmountKgM3, 2)} kg/m³</DataCell>
                  <DataCell className={`text-right ${zeroFactor ? 'text-[var(--sf-text-secondary)]' : item.factorKgCo2ePerKg == null ? 'text-[var(--sf-status-warning)]' : 'text-[var(--sf-text-secondary)]'}`}>{fmt(item.factorKgCo2ePerKg, 4)}</DataCell>
                  <DataCell className={`text-right ${zeroFactor ? 'text-[var(--sf-text-secondary)]' : 'text-[var(--sf-text-primary)]'}`}>{fmt(item.emissionKgCo2eM3, 2)} kg</DataCell>
                  <DataCell className="text-right text-[var(--sf-text-secondary)]">{fmt(item.projectEmissionTon, 3)} ton</DataCell>
                  <td className="px-2.5 py-2 text-xs">
                    {item.factorKgCo2ePerKg == null
                      ? <span className="rounded border border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] px-1.5 py-0.5 text-[var(--sf-status-warning)]">EF eksik</span>
                      : <span className="text-[var(--sf-text-muted)]">Hesaba dahil</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {impact.activeMaterialImpacts.length === 0 && <p className="mt-2 text-xs text-[var(--sf-text-muted)]">Pozitif dozajlı aktif reçete malzemesi bulunmuyor.</p>}
    </section>
  );
}

function PerformancePanel({ impact }: { impact: ZeroWasteImpactResult }) {
  const { strength } = impact;
  const statusClass = strength.status === 'preserved'
    ? 'border-[var(--sf-status-success)] bg-[var(--sf-status-success-bg)] text-[var(--sf-status-success)]'
    : strength.status === 'loss'
      ? 'border-[var(--sf-status-warning)] bg-[var(--sf-status-warning-bg)] text-[var(--sf-status-warning)]'
      : 'border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] text-[var(--sf-text-secondary)]';
  const statusText = strength.status === 'preserved'
    ? 'Dayanım korunuyor'
    : strength.status === 'loss'
      ? 'Dayanım kaybı var'
      : 'Deneysel doğrulama eksik';
  return (
    <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--sf-divider)] pb-2">
        <h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">Performans doğrulaması</h2>
        <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${statusClass}`}>{statusText}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2">
          <p className="text-xs text-[var(--sf-text-muted)]">Referans deneysel dayanım</p>
          <p className="mt-1 font-mono text-sm text-[var(--sf-text-primary)]">{fmt(strength.referenceMpa, 1)} <span className="text-xs text-[var(--sf-text-muted)]">MPa</span></p>
          <p className="mt-1 text-xs text-[var(--sf-text-muted)]">{strength.referenceAgeDays == null ? 'Deney yaşı belirtilmemiş' : `${strength.referenceAgeDays} gün`}</p>
        </div>
        <div className="rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2">
          <p className="text-xs text-[var(--sf-text-muted)]">Aktif deneysel dayanım</p>
          <p className="mt-1 font-mono text-sm text-[var(--sf-text-primary)]">{fmt(strength.activeMpa, 1)} <span className="text-xs text-[var(--sf-text-muted)]">MPa</span></p>
          <p className="mt-1 text-xs text-[var(--sf-text-muted)]">{strength.activeAgeDays == null ? 'Deney yaşı belirtilmemiş' : `${strength.activeAgeDays} gün`}</p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[var(--sf-divider)] pt-2 text-xs">
        <span className="text-[var(--sf-text-muted)]">Hedef beton sınıfı</span><strong className="text-right text-[var(--sf-text-primary)]">{strength.targetConcreteClass}</strong>
        <span className="text-[var(--sf-text-muted)]">Sınıf alt sınırı</span><strong className="text-right font-mono text-[var(--sf-text-primary)]">{fmt(strength.targetStrengthMpa, 1)} MPa</strong>
      </div>
      {(strength.referenceMpa != null && strength.activeMpa != null) && <p className="mt-2 rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2.5 py-2 text-xs text-[var(--sf-text-secondary)]">Referans: <strong className="text-[var(--sf-text-primary)]">{fmt(strength.referenceMpa, 1)} MPa</strong> <ArrowRight className="mx-1 inline size-3 text-[var(--sf-text-muted)]" /> Aktif: <strong className="text-[var(--sf-text-primary)]">{fmt(strength.activeMpa, 1)} MPa</strong></p>}
      {!strength.comparableAge && (strength.referenceMpa != null || strength.activeMpa != null) && <p className="mt-2 text-xs leading-relaxed text-[var(--sf-status-warning)]">Deney yaşları karşılaştırılabilir değil veya belirtilmemiş; 28 gün varsayılmadı.</p>}
      {strength.targetSatisfied === false && <p className="mt-2 text-xs leading-relaxed text-[var(--sf-status-warning)]">Aktif deney sonucu seçili beton sınıfı alt sınırını karşılamıyor.</p>}
    </section>
  );
}

function RecoveredBreakdown({ impact }: { impact: ZeroWasteImpactResult }) {
  return (
    <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-[var(--sf-divider)] pb-2">
        <div><h2 className="text-sm font-semibold tracking-tight text-[var(--sf-text-primary)]">Geri kazanılmış malzeme dağılımı</h2><p className="mt-0.5 text-xs text-[var(--sf-text-muted)]">Aktif reçete · kg/m³ ve proje tonu</p></div>
        <span className="font-mono text-xs text-[var(--sf-text-secondary)]">Toplam {fmt(impact.active.recoveredMaterialKgM3, 1)} kg/m³</span>
      </div>
      {impact.recoveredBreakdown.length === 0 ? <p className="text-xs leading-4 text-[var(--sf-text-muted)]">Tanımlı ve pozitif miktarlı geri kazanılmış/ikincil malzeme bulunmuyor.</p> : (
        <div className="overflow-x-auto rounded-md border border-[var(--sf-border-subtle)]">
          <table className="w-full min-w-[420px] border-collapse">
            <thead className="bg-[var(--sf-bg-panel-raised)] text-xs uppercase tracking-wide text-[var(--sf-text-muted)]"><tr><th className="px-2.5 py-2 text-left font-semibold">Malzeme</th><th className="px-2.5 py-2 text-left font-semibold">Kaynak</th><th className="px-2.5 py-2 text-right font-semibold">kg/m³</th><th className="px-2.5 py-2 text-right font-semibold">Proje ton</th></tr></thead>
            <tbody className="divide-y divide-[var(--sf-divider)]">
              {impact.recoveredBreakdown.map((item) => <tr key={item.id}><td className="px-2.5 py-2 text-xs text-[var(--sf-text-secondary)]">{item.name}</td><td className="px-2.5 py-2 text-xs text-[var(--sf-text-muted)]">{originLabel(item.circularityOrigin)}</td><DataCell className="text-right">{fmt(item.kgM3, 1)}</DataCell><DataCell className="text-right text-[var(--sf-text-primary)]">{fmt(item.projectTon, 2)}</DataCell></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function QualityPanel({ impact }: { impact: ZeroWasteImpactResult }) {
  return (
    <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] px-3 py-2.5">
      <div className="flex items-start gap-2">
        {impact.warnings.length > 0 ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--sf-status-warning)]" /> : <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--sf-status-success)]" />}
        <div className="min-w-0">
          <h2 className="text-xs font-semibold text-[var(--sf-text-primary)]">Veri kalitesi</h2>
          {impact.warnings.length === 0 ? <p className="mt-1 text-xs leading-4 text-[var(--sf-status-success)]">Sıfır Atık karşılaştırması için kullanılan veriler tamam.</p> : <div className="mt-1 space-y-1 text-xs leading-4 text-[var(--sf-status-warning)]">{impact.warnings.map((warning) => <p key={warning}>• {warning}</p>)}</div>}
        </div>
      </div>
    </section>
  );
}

function DatasetFindings() {
  return (
    <details className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] px-3 py-2.5">
      <summary className="cursor-pointer list-none text-xs font-semibold text-[var(--sf-text-secondary)] [&::-webkit-details-marker]:hidden">Veri seti bulguları</summary>
      <div className="mt-2 space-y-1.5 border-t border-[var(--sf-divider)] pt-2 text-xs leading-relaxed text-[var(--sf-text-muted)]">
        <p>Bu değerler aktif projenin sonucu değildir; analiz edilen veri setinin genel istatistiklerini göstermektedir.</p>
        <p>Veri setinde atık/ikincil malzeme içeren karışımların ortalaması yaklaşık 193 kg/m³; en yüksek ikame grubunda oran %76,9 seviyesine ulaşmaktadır.</p>
        <p>Karşılaştırılabilir 81 alternatif tasarımın %46&apos;sında referans dayanımı korunurken karbon emisyonu düşmüştür; bu grubun ortalama azaltımı %15,4&apos;tür. Bazı tasarımlarda azaltım %40&apos;ın üzerine çıkmıştır.</p>
      </div>
    </details>
  );
}

export function ZeroWasteSummaryCard({ impact, onOpen }: { impact: ZeroWasteImpactResult; onOpen: () => void }) {
  const activeAvailable = impact.active.circularAlternativeMaterialProjectTon != null;
  const comparisonComplete = impact.referenceAvailable
    && impact.savings.cementTon != null
    && impact.savings.carbonPercent != null;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] px-3 py-2.5 text-left transition-colors hover:border-[var(--sf-border-default)] hover:bg-[var(--sf-bg-hover)]">
      <span className="h-8 w-0.5 shrink-0 rounded-full bg-[var(--sf-border-strong)]" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--sf-text-muted)]">Sıfır Atık Performansı</span>
        {comparisonComplete
          ? <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--sf-text-primary)]">{recipeModeLabel(impact.activeRecipeMode)} · {fmt(impact.active.circularAlternativeMaterialProjectTon, 2)} ton döngüsel/alternatif malzeme · {reduction(impact.savings.cementTon, 'ton')} çimento · {percentageReduction(impact.savings.carbonPercent)} reçete CO₂e</span>
          : activeAvailable
            ? <span className="mt-0.5 block text-xs leading-4 text-[var(--sf-text-secondary)]"><strong>{recipeModeLabel(impact.activeRecipeMode)}</strong> aktif · {fmt(impact.active.circularAlternativeMaterialProjectTon, 2)} ton döngüsel/alternatif malzeme hesaplandı{impact.referenceAvailable ? '; karşılaştırma verileri eksik.' : '; referans seçilirse farklar da gösterilir.'}</span>
            : <span className="mt-0.5 block text-xs leading-4 text-[var(--sf-text-secondary)]">Aktif reçetedeki malzeme miktarlarını tamamlayın.</span>}
      </span>
      <ArrowRight className="size-4 shrink-0 text-[var(--sf-text-muted)]" />
    </button>
  );
}

export function ZeroWastePanel({ impact }: { impact: ZeroWasteImpactResult }) {
  const activeCarbonTotal = carbonValue(
    impact.active.recipeCarbonProjectTon,
    impact.active.knownRecipeCarbonProjectTon,
    'ton',
    2,
  );
  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel)] p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--sf-text-muted)]">Sıfır Atık Etkisi</p><p className="mt-1 text-xs leading-4 text-[var(--sf-text-muted)]">Aynı geometri ve beton hacmi için aktif reçetenin ölçülebilir malzeme etkisi.</p></div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <span className="rounded-md border border-[var(--sf-border-default)] bg-[var(--sf-bg-panel-raised)] px-2 py-1 text-xs font-semibold text-[var(--sf-text-secondary)]">{recipeModeLabel(impact.activeRecipeMode)}</span>
            <span className="rounded-md border border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)] px-2 py-1 text-xs text-[var(--sf-text-muted)]">{impact.referenceAvailable ? 'Referans karşılaştırması' : 'Aktif reçete hesabı'}</span>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-[var(--sf-divider)] pt-3">
          <div><p className="text-xs text-[var(--sf-text-muted)]">Döngüsel / alternatif malzeme</p><p className="mt-1 font-mono text-2xl font-semibold text-[var(--sf-text-primary)]">{fmt(impact.active.circularAlternativeMaterialProjectTon, 2)} <span className="text-xs font-normal text-[var(--sf-text-muted)]">ton</span></p></div>
          <div className="text-right text-xs text-[var(--sf-text-muted)]"><p>Aktif reçete · {recipeModeLabel(impact.activeRecipeMode)}</p><p className="mt-0.5 max-w-[170px] truncate text-[var(--sf-text-secondary)]" title={impact.activeMixName}>{impact.activeMixName}</p></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-[var(--sf-divider)] pt-2 sm:grid-cols-4">
          <CompactMetric
            label={impact.referenceAvailable ? 'Çimento azalımı' : 'Çimento'}
            value={impact.referenceAvailable ? reduction(impact.savings.cementTon, 'ton') : measuredValue(impact.active.cementProjectTon, 'ton')}
            positive={impact.referenceAvailable && impact.savings.cementTon != null && impact.savings.cementTon > 0}
          />
          <CompactMetric
            label={impact.referenceAvailable ? 'Doğal agrega azalımı' : 'Doğal agrega'}
            value={impact.referenceAvailable ? reduction(impact.savings.naturalAggregateTon, 'ton') : measuredValue(impact.active.naturalAggregateProjectTon, 'ton')}
            positive={impact.referenceAvailable && impact.savings.naturalAggregateTon != null && impact.savings.naturalAggregateTon > 0}
          />
          <CompactMetric
            label={impact.referenceAvailable ? 'CO₂e farkı' : 'Reçete CO₂e'}
            value={impact.referenceAvailable ? reduction(impact.savings.carbonTon, 'ton') : activeCarbonTotal}
            positive={impact.referenceAvailable && impact.savings.carbonTon != null && impact.savings.carbonTon > 0}
          />
          <CompactMetric
            label="CO₂ azaltımı"
            value={comparisonValue(impact.referenceAvailable, percentageReduction(impact.savings.carbonPercent))}
            positive={impact.referenceAvailable && impact.savings.carbonPercent != null && impact.savings.carbonPercent > 0}
          />
        </div>
        <p className="mt-2 text-xs leading-4 text-[var(--sf-text-muted)]">Üst metrik döngüsel/alternatif malzeme sınıfını gösterir. Metakaolin bu grupta “alternatif mineral” olarak sayılır; geri dönüştürülmüş atık olarak etiketlenmez.</p>
        <p className="mt-2 border-t border-[var(--sf-divider)] pt-2 text-xs text-[var(--sf-text-muted)]">{impact.wallLengthM == null ? '—' : `${fmt(impact.wallLengthM, 1)} m`} istinat duvarı · {impact.concreteVolumeM3 == null ? '—' : `${fmt(impact.concreteVolumeM3, 2)} m³`} beton · {impact.referenceMixName ? `${impact.referenceMixName} → ${impact.activeMixName}` : `${recipeModeLabel(impact.activeRecipeMode)} aktif; referans karşılaştırması seçilmedi`}</p>
      </section>

      <QualityPanel impact={impact} />
      <ImpactTable impact={impact} />
      <ActiveMaterialImpactTable impact={impact} />
      <CarbonTable impact={impact} />
      <PerformancePanel impact={impact} />
      <RecoveredBreakdown impact={impact} />
      <DatasetFindings />
    </div>
  );
}

function CompactMetric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return <div className={`rounded-md border px-2 py-1.5 ${positive ? 'border-[var(--sf-status-success)] bg-[var(--sf-status-success-bg)]' : 'border-[var(--sf-border-subtle)] bg-[var(--sf-bg-panel-raised)]'}`}><span className="block text-xs uppercase tracking-wide text-[var(--sf-text-muted)]">{label}</span><span className={`mt-0.5 block truncate font-mono text-xs font-semibold ${positive ? 'text-[var(--sf-status-success)]' : 'text-[var(--sf-text-secondary)]'}`}>{value}</span></div>;
}
