'use client';

import type { SafetyStatus, Scenario, SectionDesign } from '../types';
import { PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3 } from '../engine/constants';
import { calculateZeroWasteImpact } from '../material-selection/zeroWasteImpact';
import { buildScenarioReportModel } from './reportModel';
import { retainingWallReportTemplate } from './reportTemplate';

export interface PdfExportOptions {
  projectName?: string;
}

type ReportValue = string | number | null | undefined;

function fmt(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function escapeHtml(value: ReportValue): string {
  const text = value == null ? '—' : String(value);
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeFileStem(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90) || 'istinat-duvari';
}

function statusText(status: SafetyStatus | undefined): string {
  if (status === 'safe') return 'UYGUN';
  if (status === 'marginal') return 'UYGUN';
  if (status === 'unsafe') return 'UYGUN DEĞİL';
  return 'HESAPLANMADI';
}

function statusClass(status: SafetyStatus | undefined): string {
  if (status === 'safe') return 'ok';
  if (status === 'marginal') return 'ok';
  if (status === 'unsafe') return 'bad';
  return 'na';
}

function rankStatus(status: SafetyStatus | undefined): number {
  return status === 'unsafe' ? 3 : status === 'marginal' || status === 'safe' ? 1 : 0;
}

function worstStatus(statuses: Array<SafetyStatus | undefined>): SafetyStatus | undefined {
  return statuses.reduce<SafetyStatus | undefined>((worst, status) => (
    rankStatus(status) > rankStatus(worst) ? status : worst
  ), undefined);
}

function sectionUtilization(section: SectionDesign | undefined): number | null {
  if (!section) return null;
  const moment = section.momentCapacity > 0 ? section.momentDemand / section.momentCapacity : null;
  const shear = section.shearCapacity > 0 ? section.shearDemand / section.shearCapacity : null;
  const ratios = [moment, shear].filter((value): value is number => value != null && Number.isFinite(value));
  return ratios.length ? Math.max(...ratios) * 100 : null;
}

function sectionStatus(section: SectionDesign | undefined): SafetyStatus | undefined {
  if (!section) return undefined;
  return worstStatus([section.flexuralStatus, section.shearStatus]);
}

function reportFingerprint(scenario: Scenario): string {
  const serialized = JSON.stringify({
    input: scenario.input,
    logistics: scenario.logistics,
    concreteMix: scenario.concreteMix,
    customCoefficients: scenario.customCoefficients ?? {},
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

function materialAmount(scenario: Scenario, id: string): number | null {
  return scenario.concreteMix.materials.find((material) => material.id === id)?.canonicalKgPerM3 ?? null;
}

function shareOfTotal(part: number | null, total: number | null): string {
  if (part == null || total == null || !Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '—';
  return `%${fmt((part / total) * 100, 1)}`;
}

function concreteClassLabel(value: string): string {
  return value.includes('/') ? value : `${value}`;
}

function warningRows(warnings: string[], unsafe: boolean): string {
  const scoped: Array<{ title: string; message: string; tone: string; label: string; mark: string }> = [];
  if (unsafe) {
    scoped.push({
      title: 'Mühendislik kontrolü uygun değil',
      message: 'En az bir stabilite veya betonarme ön-kontrol sonucu gerekli sınırı sağlamıyor. Uygulama öncesi tasarımın revize edilmesi gerekir.',
      tone: 'var(--red)', label: 'KONTROL', mark: '!',
    });
  }
  warnings.slice(0, unsafe ? 2 : 3).forEach((message, index) => scoped.push({
    title: index === 0 ? 'Hesap / veri uyarısı' : 'Mühendislik notu',
    message,
    tone: 'var(--amber)', label: 'UYARI', mark: '!',
  }));
  scoped.push({
    title: 'Kapsam dışı etkiler',
    message: 'Yeraltı suyu, hidrostatik basınç, deprem etkisi ve genel harici yatay/düşey yükler bu sürümün istinat duvarı hesap modelinde tanımlı değildir; raporda sıfır kabul edilmez.',
    tone: 'var(--muted)', label: 'HESAPLANMADI', mark: '–',
  });
  scoped.push({
    title: 'Betonarme sonuçlarının kapsamı',
    message: 'Betonarme sonuçları ACI CODE-318-25 referanslı ön boyutlandırma / preliminary screening niteliğindedir; nihai uygulama projesi ve tam uygunluk beyanı değildir.',
    tone: 'var(--muted)', label: 'ÖN KONTROL', mark: '–',
  });
  return scoped.slice(0, 5).map((item) => `
      <div class="warning-item" style="color:${item.tone}"><div class="mark">${item.mark}</div><div class="txt"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.message)}</span></div><span class="status ${item.label === 'KONTROL' ? 'bad' : item.label === 'UYARI' ? 'warn' : 'na'}">${escapeHtml(item.label)}</span></div>`).join('');
}

function materialRows(scenario: Scenario): string {
  const enabled = scenario.concreteMix.materials.filter((item) => item.enabled && item.canonicalKgPerM3 != null);
  const shown = enabled.slice(0, 8);
  const rows = shown.map((material) => (
    `<tr><td>${escapeHtml(material.name)}</td><td class="num">${escapeHtml(fmt(material.canonicalKgPerM3, 1))}</td><td>kg/m³</td></tr>`
  ));
  if (enabled.length > shown.length) {
    rows.push(`<tr><td colspan="3" class="muted">+ ${enabled.length - shown.length} etkin reçete malzemesi Ek B / proje verisinde kayıtlıdır.</td></tr>`);
  }
  return rows.length ? rows.join('') : '<tr><td colspan="3" class="muted">Etkin reçete malzemesi bulunamadı.</td></tr>';
}

/**
 * Reviewed A4 HTML template + active Scenario data. This is deliberately pure
 * so unit tests can verify that no live value is silently replaced by demo data.
 */
export function buildScenarioReportHtml(
  scenario: Scenario,
  options: PdfExportOptions = {},
  generatedAt = new Date(),
): string {
  const report = buildScenarioReportModel(scenario);
  const geometry = scenario.input.geometry;
  const earth = scenario.earthPressures;
  const stability = scenario.stability;
  const quantities = scenario.quantities;
  const cost = scenario.cost;
  const internal = scenario.internalStability;
  const rcStem = internal?.stem;
  const rcToe = internal?.toe;
  const rcHeel = internal?.heel;
  const rcStatus = worstStatus([sectionStatus(rcStem), sectionStatus(rcToe), sectionStatus(rcHeel)]);
  const eccentricityLimit = geometry.x1 / 6;
  const eccentricityStatus: SafetyStatus | undefined = stability
    ? stability.eccentricity <= eccentricityLimit + 1e-9 ? 'safe' : 'unsafe'
    : undefined;
  const basePressureStatus: SafetyStatus | undefined = stability
    ? stability.qMin >= -1e-9 ? 'safe' : 'unsafe'
    : undefined;
  const overallStatus = worstStatus([
    stability?.sliding.status,
    stability?.overturning.status,
    stability?.bearingCapacity.status,
    eccentricityStatus,
    basePressureStatus,
    rcStatus,
  ]);
  const projectName = options.projectName?.trim()
    || (scenario.name && scenario.name !== 'Aktif Tasarım' ? scenario.name : 'İstinat Duvarı Projesi');
  const localeDate = generatedAt.toLocaleDateString('tr-TR');
  const localeDateTime = generatedAt.toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  const stamp = `${generatedAt.getFullYear()}${String(generatedAt.getMonth() + 1).padStart(2, '0')}${String(generatedAt.getDate()).padStart(2, '0')}`;
  const shortId = scenario.id.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || reportFingerprint(scenario).slice(-6);
  const reportNumber = `SF-RW-${stamp}-${shortId}`;
  const reportId = `RW-${stamp}-${shortId}`;

  const concreteWeight = geometry.x1 * geometry.x5 * PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3;
  const stemRectArea = geometry.x4 * geometry.H;
  const stemTriArea = 0.5 * Math.max(0, geometry.x3 - geometry.x4) * geometry.H;
  const stemArea = stemRectArea + stemTriArea;
  const stemWeight = stemArea * PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3;
  const stemRectX = geometry.x2 + geometry.x4 / 2;
  const stemTriX = geometry.x2 + geometry.x4 + Math.max(0, geometry.x3 - geometry.x4) / 3;
  const stemArm = stemArea > 0 ? (stemRectArea * stemRectX + stemTriArea * stemTriX) / stemArea : geometry.x2 + geometry.x3 / 2;
  const baseArm = geometry.x1 / 2;
  const heelSoilWeight = scenario.input.backfillSoil.gamma * geometry.H * geometry.x6;
  const heelSoilArm = geometry.x2 + geometry.x3 + geometry.x6 / 2;
  const toeSoilHeight = Math.max(0, geometry.Df - geometry.x5);
  const toeSoilWeight = scenario.input.foundationSoil.gamma * geometry.x2 * toeSoilHeight;
  const toeSoilArm = geometry.x2 / 2;
  const surchargeWeight = scenario.input.surchargeLoad * geometry.x6;
  const surchargeWeightArm = heelSoilArm;
  const totalV = concreteWeight + stemWeight + heelSoilWeight + toeSoilWeight + surchargeWeight;
  const resistingMoment = concreteWeight * baseArm + stemWeight * stemArm + heelSoilWeight * heelSoilArm + toeSoilWeight * toeSoilArm + surchargeWeight * surchargeWeightArm;
  const activeSoilArm = geometry.x5 + (earth?.soilLeverArm ?? geometry.H / 3);
  const activeSurchargeArm = geometry.x5 + (earth?.surchargeLeverArm ?? geometry.H / 2);
  const overturningMoment = (earth?.PaSoil_h ?? 0) * activeSoilArm + (earth?.PaSurcharge_h ?? 0) * activeSurchargeArm;
  const baseInterfaceAngle = 2 * scenario.input.foundationSoil.phi / 3;
  const baseFriction = totalV * Math.tan(baseInterfaceAngle * Math.PI / 180);
  const baseAdhesion = 2 * scenario.input.foundationSoil.c * geometry.x1 / 3;
  const passive = earth?.Pp ?? 0;
  const totalResistance = baseFriction + baseAdhesion + passive;
  const qUlt = stability?.bearingCapacity.steps.find((step) => /q_?ult|nihai taşıma gücü/i.test(`${step.formula} ${step.description}`))?.result ?? null;
  const qAllow = qUlt != null && stability ? qUlt / stability.bearingCapacity.requiredFS : null;

  const concreteUnitPrice = cost?.concreteCostPerM3
    ?? (cost?.concreteCost != null && quantities?.concreteVolume ? cost.concreteCost / quantities.concreteVolume : null);
  const carbonTotal = report.carbon.grandTotalProjectKgCo2e;
  const carbonConcrete = report.carbon.recipeProductionProjectKgCo2e;
  const carbonRebar = report.carbon.reinforcementProjectKgCo2e;
  const zeroWaste = calculateZeroWasteImpact(scenario);
  const warnings = [...new Set([
    ...report.warnings,
    ...(scenario.engineeringWarnings ?? []),
    ...(stability?.warnings ?? []),
    ...(scenario.mixMetrics.warnings ?? []),
    ...(scenario.mixMetrics.errors ?? []),
    ...(quantities?.reinforcementWarnings ?? []),
    ...(cost?.warnings ?? []),
    ...(scenario.emissions?.warnings ?? []),
    ...(zeroWaste.warnings ?? []),
  ])];

  const values: Record<string, ReportValue> = {
    'project.name': projectName,
    'project.code': 'Belirtilmedi',
    'project.location': 'Belirtilmedi',
    'report.number': reportNumber,
    'report.revision': 'R00',
    'report.date': localeDate,
    'report.status': overallStatus ? `HESAP TAMAMLANDI · ${statusText(overallStatus)}` : 'HESAPLANMADI',
    'report.id': reportId,
    'report.generatedAt': localeDateTime,
    'report.inputHash': reportFingerprint(scenario),
    'report.revisionNote': 'Otomatik teknik rapor üretimi',
    'software.version': 'v1.0.0',
    'engine.version': 'StructFlow mühendislik çekirdeği',
    'schema.version': 'Rapor şeması 2',
    'approval.preparedBy': '—', 'approval.preparedAt': '—', 'approval.checkedBy': '—', 'approval.checkedAt': '—', 'approval.approvedBy': '—', 'approval.approvedAt': '—',

    'geometry.wallHeight': fmt(geometry.H, 2),
    'geometry.baseWidth': fmt(geometry.x1, 2),
    'geometry.toe': fmt(geometry.x2, 2),
    'geometry.heel': fmt(geometry.x6, 2),
    'geometry.baseThickness': fmt(geometry.x5, 2),
    'geometry.stemTop': fmt(geometry.x4, 2),
    'geometry.stemBottom': fmt(geometry.x3, 2),
    'materials.concreteClass': concreteClassLabel(scenario.input.concreteClass),
    'materials.fck': fmt(scenario.input.rcDesign?.fcMpa, 1),
    'materials.concreteGamma': fmt(PROJECT_CONCRETE_UNIT_WEIGHT_KN_M3, 1),
    'materials.rebarClass': scenario.input.rebarClass,
    'materials.fyk': fmt(scenario.input.rcDesign?.fyMpa, 0),
    'materials.Es': 'Programda tanımlı değil',

    'soil.phi': fmt(scenario.input.backfillSoil.phi, 1),
    'soil.fill.gamma': fmt(scenario.input.backfillSoil.gamma, 1),
    'soil.fill.phi': fmt(scenario.input.backfillSoil.phi, 1),
    'soil.fill.c': fmt(scenario.input.backfillSoil.c, 1),
    'soil.fill.delta': fmt(earth?.wallFrictionAngle ?? 0, 1),
    'soil.foundation.gamma': fmt(scenario.input.foundationSoil.gamma, 1),
    'soil.foundation.phi': fmt(scenario.input.foundationSoil.phi, 1),
    'soil.foundation.c': fmt(scenario.input.foundationSoil.c, 1),
    'soil.foundation.qAllow': fmt(qAllow, 1),
    'loads.surcharge': fmt(scenario.input.surchargeLoad, 1),
    'loads.waterLevel': 'Hesap modelinde tanımlı değil',
    'loads.horizontal': 'Programda tanımlı değil',
    'loads.vertical': 'Programda tanımlı değil',
    'analysis.earthPressureMethod': report.methods.scenarioLateralEarthPressure,
    'analysis.passiveEnabled': passive > 0 ? 'Etkin · Df üzerinden' : 'Etki yok',
    'analysis.waterEnabled': 'Desteklenmiyor',
    'analysis.seismicEnabled': 'Bu sürümde hesaplanmıyor',
    'coefficients.Ka': fmt(earth?.Ka, 4),
    'coefficients.Kp': fmt(earth?.Kp, 4),
    'coefficients.mu': fmt(Math.tan(baseInterfaceAngle * Math.PI / 180), 4),
    'earthPressure.Pagamma': fmt(earth?.PaSoil_h, 2),
    'earthPressure.Paq': fmt(earth?.PaSurcharge_h, 2),
    'earthPressure.Pw': 'Hesaplanmıyor',
    'earthPressure.totalH': fmt(earth?.Pa_h, 2),

    'forces.stem.weight': fmt(stemWeight, 2), 'forces.stem.arm': fmt(stemArm, 2), 'forces.stem.moment': fmt(stemWeight * stemArm, 2),
    'forces.base.weight': fmt(concreteWeight, 2), 'forces.base.arm': fmt(baseArm, 2), 'forces.base.moment': fmt(concreteWeight * baseArm, 2),
    'forces.heelSoil.weight': fmt(heelSoilWeight, 2), 'forces.heelSoil.arm': fmt(heelSoilArm, 2), 'forces.heelSoil.moment': fmt(heelSoilWeight * heelSoilArm, 2),
    'forces.toeSoil.weight': fmt(toeSoilWeight, 2), 'forces.toeSoil.arm': fmt(toeSoilArm, 2), 'forces.toeSoil.moment': fmt(toeSoilWeight * toeSoilArm, 2),
    'forces.verticalSurcharge.weight': fmt(surchargeWeight, 2), 'forces.verticalSurcharge.arm': fmt(surchargeWeightArm, 2), 'forces.verticalSurcharge.moment': fmt(surchargeWeight * surchargeWeightArm, 2),
    'forces.active.value': fmt(earth?.PaSoil_h, 2), 'forces.active.arm': fmt(activeSoilArm, 2), 'forces.active.moment': fmt((earth?.PaSoil_h ?? 0) * activeSoilArm, 2),
    'forces.surcharge.value': fmt(earth?.PaSurcharge_h, 2), 'forces.surcharge.arm': fmt(activeSurchargeArm, 2), 'forces.surcharge.moment': fmt((earth?.PaSurcharge_h ?? 0) * activeSurchargeArm, 2),
    'forces.water.value': 'Hesaplanmıyor', 'forces.water.arm': '—', 'forces.water.moment': '—',
    'forces.totalV': fmt(totalV, 2),
    'moments.resisting': fmt(resistingMoment, 2),
    'moments.overturning': fmt(overturningMoment, 2),

    'checks.sliding.fs': fmt(stability?.sliding.factorOfSafety, 2), 'checks.sliding.limit': fmt(stability?.sliding.requiredFS, 2), 'checks.sliding.status': statusText(stability?.sliding.status), 'checks.sliding.statusClass': statusClass(stability?.sliding.status),
    'checks.overturning.fs': fmt(stability?.overturning.factorOfSafety, 2), 'checks.overturning.limit': fmt(stability?.overturning.requiredFS, 2), 'checks.overturning.status': statusText(stability?.overturning.status), 'checks.overturning.statusClass': statusClass(stability?.overturning.status),
    'checks.eccentricity.e': fmt(stability?.eccentricity, 3), 'checks.eccentricity.limit': fmt(eccentricityLimit, 3), 'checks.eccentricity.status': statusText(eccentricityStatus), 'checks.eccentricity.statusClass': statusClass(eccentricityStatus),
    'eccentricity.xR': fmt(stability?.signedEccentricity == null ? null : geometry.x1 / 2 - stability.signedEccentricity, 3),
    'checks.bearing.qmax': fmt(stability?.qMax, 1), 'checks.bearing.qmin': fmt(stability?.qMin, 1), 'checks.bearing.allowable': fmt(qAllow, 1), 'checks.bearing.status': statusText(stability?.bearingCapacity.status), 'checks.bearing.statusClass': statusClass(stability?.bearingCapacity.status),
    'checks.bearing.minStatus': statusText(basePressureStatus), 'checks.bearing.minStatusClass': statusClass(basePressureStatus),
    'checks.rc.utilization': sectionUtilization(rcStem) == null && sectionUtilization(rcToe) == null && sectionUtilization(rcHeel) == null ? '—' : `%${fmt(Math.max(sectionUtilization(rcStem) ?? 0, sectionUtilization(rcToe) ?? 0, sectionUtilization(rcHeel) ?? 0), 0)}`,
    'checks.rc.status': statusText(rcStatus), 'checks.rc.statusClass': statusClass(rcStatus),
    'summary.overallStatus': statusText(overallStatus), 'summary.overallStatusClass': statusClass(overallStatus),

    'sliding.friction': fmt(baseFriction, 2), 'sliding.cohesion': fmt(baseAdhesion, 2), 'sliding.passive': fmt(passive, 2), 'sliding.totalResistance': fmt(totalResistance, 2),
    'sliding.active': fmt(earth?.PaSoil_h, 2), 'sliding.surcharge': fmt(earth?.PaSurcharge_h, 2), 'sliding.water': 'Hesaplanmıyor', 'sliding.totalDriving': fmt(earth?.Pa_h, 2),

    'rc.stem.MEd': fmt(rcStem?.momentDemand, 1), 'rc.stem.VEd': fmt(rcStem?.shearDemand, 1), 'rc.stem.AsReq': fmt(rcStem?.requiredAs, 0), 'rc.stem.AsProv': fmt(rcStem?.reinforcement.area, 0), 'rc.stem.utilization': sectionUtilization(rcStem) == null ? '—' : `%${fmt(sectionUtilization(rcStem), 0)}`, 'rc.stem.utilizationWidth': `${Math.min(100, Math.max(0, sectionUtilization(rcStem) ?? 0)).toFixed(0)}%`, 'rc.stem.status': statusText(sectionStatus(rcStem)), 'rc.stem.statusClass': statusClass(sectionStatus(rcStem)), 'rc.stem.bar': rcStem ? `Ø${rcStem.reinforcement.diameter}` : '—', 'rc.stem.spacing': rcStem?.reinforcement.spacing ?? '—', 'rc.stem.distributionBar': rcStem?.secondaryReinforcement ? `Ø${rcStem.secondaryReinforcement.diameter}` : '—', 'rc.stem.distributionSpacing': rcStem?.secondaryReinforcement?.spacing ?? '—',
    'rc.toe.MEd': fmt(rcToe?.momentDemand, 1), 'rc.toe.VEd': fmt(rcToe?.shearDemand, 1), 'rc.toe.AsReq': fmt(rcToe?.requiredAs, 0), 'rc.toe.AsProv': fmt(rcToe?.reinforcement.area, 0), 'rc.toe.utilization': sectionUtilization(rcToe) == null ? '—' : `%${fmt(sectionUtilization(rcToe), 0)}`, 'rc.toe.utilizationWidth': `${Math.min(100, Math.max(0, sectionUtilization(rcToe) ?? 0)).toFixed(0)}%`, 'rc.toe.status': statusText(sectionStatus(rcToe)), 'rc.toe.statusClass': statusClass(sectionStatus(rcToe)), 'rc.toe.bar': rcToe ? `Ø${rcToe.reinforcement.diameter}` : '—', 'rc.toe.spacing': rcToe?.reinforcement.spacing ?? '—',
    'rc.heel.MEd': fmt(rcHeel?.momentDemand, 1), 'rc.heel.VEd': fmt(rcHeel?.shearDemand, 1), 'rc.heel.AsReq': fmt(rcHeel?.requiredAs, 0), 'rc.heel.AsProv': fmt(rcHeel?.reinforcement.area, 0), 'rc.heel.utilization': sectionUtilization(rcHeel) == null ? '—' : `%${fmt(sectionUtilization(rcHeel), 0)}`, 'rc.heel.utilizationWidth': `${Math.min(100, Math.max(0, sectionUtilization(rcHeel) ?? 0)).toFixed(0)}%`, 'rc.heel.status': statusText(sectionStatus(rcHeel)), 'rc.heel.statusClass': statusClass(sectionStatus(rcHeel)), 'rc.heel.bar': rcHeel ? `Ø${rcHeel.reinforcement.diameter}` : '—', 'rc.heel.spacing': rcHeel?.reinforcement.spacing ?? '—',

    'quantities.concrete': fmt(quantities?.concreteVolume, 2), 'quantities.rebar': fmt(quantities?.reinforcementWeightKg ?? (quantities ? quantities.reinforcementWeight * 1000 : null), 0), 'quantities.formwork': fmt(quantities?.formworkArea, 2), 'quantities.excavation': fmt(quantities?.excavationVolume, 2), 'quantities.backfill': fmt(quantities?.backfillVolume, 2),
    'cost.unit.concrete': fmt(concreteUnitPrice, 2), 'cost.unit.rebar': fmt(scenario.logistics.rebarPrice / 1000, 2), 'cost.unit.formwork': fmt(scenario.logistics.formworkUnitCost, 2), 'cost.unit.excavation': fmt(scenario.logistics.excavationUnitCost, 2), 'cost.unit.backfill': fmt(scenario.logistics.backfillUnitCost, 2),
    'cost.items.concrete': fmt(cost?.concreteCost, 2), 'cost.items.rebar': fmt(cost?.rebarCost, 2), 'cost.items.formwork': fmt(cost?.formworkCost, 2), 'cost.items.excavation': fmt(cost?.excavationCost, 2), 'cost.items.backfill': fmt(cost?.backfillCost, 2), 'cost.total': fmt(cost?.totalCost, 2),

    'carbon.boundary': 'Malzeme üretimi + şantiye makineleri + beton lojistiği',
    'carbon.factor.concrete': fmt(report.carbon.recipeProductionKgCo2ePerM3, 2), 'carbon.factor.rebar': fmt(scenario.emissions?.materials.byMaterial.find((item) => item.id === 'reinforcement_steel')?.factorKgCo2ePerKg, 4),
    'carbon.concrete': fmt(carbonConcrete, 1), 'carbon.concreteShare': shareOfTotal(carbonConcrete, carbonTotal),
    'carbon.rebar': fmt(carbonRebar, 1), 'carbon.rebarShare': shareOfTotal(carbonRebar, carbonTotal),
    'carbon.machinery': fmt(report.carbon.siteMachineryProjectKgCo2e, 1), 'carbon.siteMachinery': fmt(report.carbon.siteMachineryProjectKgCo2e, 1),
    'carbon.logistics': fmt(report.carbon.concreteLogisticsProjectKgCo2e, 1), 'carbon.total': fmt(carbonTotal, 1), 'carbon.totalTon': carbonTotal == null ? '—' : fmt(carbonTotal / 1000, 2), 'carbon.totalPerM3': fmt(report.carbon.grandTotalPerConcreteM3, 1), 'carbon.totalPerMeter': fmt(report.carbon.grandTotalPerWallMeter, 1),
    'mix.name': scenario.concreteMix.recipeMode === 'custom' ? `Özel reçete · ${scenario.concreteMix.name}` : scenario.concreteMix.name,
    'mix.cement': fmt(materialAmount(scenario, 'cement'), 1), 'mix.water': fmt(materialAmount(scenario, 'water'), 1), 'mix.fineAggregate': fmt(materialAmount(scenario, 'natural_fine_aggregate'), 1), 'mix.coarseAggregate': fmt(materialAmount(scenario, 'natural_coarse_aggregate'), 1), 'mix.flyAsh': fmt(materialAmount(scenario, 'fly_ash'), 1), 'mix.admixture': fmt(materialAmount(scenario, 'superplasticizer'), 1),
    'mix.totalBinder': fmt(scenario.mixMetrics.totalBinderKgM3, 1), 'mix.waterBinderRatio': fmt(scenario.mixMetrics.waterBinderRatio, 3), 'mix.totalDosage': fmt(scenario.mixMetrics.totalFreshMassKgM3, 1),

    // This report is a snapshot of the active design. An optimization result is
    // not silently invented when no candidate scenario is selected.
    'optimization.base.concrete': fmt(quantities?.concreteVolume, 2), 'optimization.opt.concrete': '—', 'optimization.delta.concrete': '—',
    'optimization.base.cost': fmt(cost?.totalCost, 2), 'optimization.opt.cost': '—', 'optimization.delta.cost': '—',
    'optimization.base.co2': fmt(report.carbon.grandTotalProjectKgCo2e, 1), 'optimization.opt.co2': '—', 'optimization.delta.co2': '—',
  };

  let html = retainingWallReportTemplate();
  html = html.replace('<!--REPORT_MATERIAL_ROWS-->', materialRows(scenario));
  html = html.replace('<!--REPORT_WARNING_ROWS-->', warningRows(warnings, overallStatus === 'unsafe'));
  for (const [key, value] of Object.entries(values)) {
    html = html.replaceAll(`{{${key}}}`, escapeHtml(value));
  }
  // Fail visibly rather than leaking raw template tokens into a customer PDF.
  html = html.replace(/\{\{[^{}]+\}\}/g, '—');
  return html;
}

/**
 * Desktop builds use Electron/Chromium printToPDF so the reviewed HTML and PDF
 * share the same rendering engine. Browser development builds open the same
 * generated HTML and invoke the browser print dialog as a fallback.
 */
export async function exportScenarioToPdf(scenario: Scenario, options: PdfExportOptions = {}): Promise<void> {
  const html = buildScenarioReportHtml(scenario, options);
  const projectName = options.projectName?.trim() || 'istinat-duvari';
  const defaultName = `${safeFileStem(projectName)}-teknik-rapor.pdf`;
  if (window.electronAPI?.exportPdfReport) {
    const result = await window.electronAPI.exportPdfReport({ html, defaultName });
    if (!result.canceled && 'error' in result) throw new Error(result.error);
    return;
  }

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const reportWindow = window.open(url, '_blank');
  if (!reportWindow) {
    URL.revokeObjectURL(url);
    throw new Error('Rapor penceresi açılamadı. Tarayıcı açılır pencere iznini kontrol edin.');
  }
  reportWindow.addEventListener('load', () => reportWindow.print(), { once: true });
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
