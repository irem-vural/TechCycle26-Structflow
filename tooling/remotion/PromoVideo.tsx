import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const FONT = 'Inter, Segoe UI, Arial, sans-serif';
const MONO = 'JetBrains Mono, Consolas, monospace';

const COLORS = {
  ink: '#0a0d13',
  white: '#f7f9fc',
  muted: '#aeb8c8',
  blue: '#7da7ff',
  blueStrong: '#5b82e5',
  green: '#83d6a4',
  amber: '#e8bb67',
};

type ShotConfig = {
  src: string;
  title?: string;
  kicker?: string;
  note?: string;
  accent?: string;
  scaleFrom?: number;
  scaleTo?: number;
  xFrom?: number;
  xTo?: number;
  yFrom?: number;
  yTo?: number;
  darken?: number;
  labelPosition?: 'left' | 'right';
};

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function easeProgress(frame: number, duration: number) {
  return interpolate(frame, [0, duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
}

function sceneOpacity(frame: number, duration: number, fade = 18) {
  const inOpacity = interpolate(frame, [0, fade], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const outOpacity = interpolate(frame, [duration - fade, duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return Math.min(inOpacity, outOpacity);
}

function FilmGrain({ frame }: { frame: number }) {
  const offsetX = (frame * 17) % 43;
  const offsetY = (frame * 29) % 47;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: 'none',
        opacity: 0.045,
        mixBlendMode: 'screen',
        backgroundImage:
          'radial-gradient(circle at 20% 30%, rgba(255,255,255,.6) 0 .45px, transparent .7px), radial-gradient(circle at 70% 80%, rgba(255,255,255,.45) 0 .45px, transparent .7px)',
        backgroundSize: '7px 7px, 9px 9px',
        backgroundPosition: `${offsetX}px ${offsetY}px, ${-offsetX}px ${-offsetY}px`,
      }}
    />
  );
}

function FeatureLabel({
  frame,
  duration,
  kicker,
  title,
  note,
  accent = COLORS.blue,
  position = 'left',
}: {
  frame: number;
  duration: number;
  kicker?: string;
  title?: string;
  note?: string;
  accent?: string;
  position?: 'left' | 'right';
}) {
  if (!title && !kicker && !note) return null;
  const enter = interpolate(frame, [10, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const exit = interpolate(frame, [duration - 34, duration - 10], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = Math.min(enter, exit);
  const translateY = (1 - enter) * 22;
  return (
    <div
      style={{
        position: 'absolute',
        left: position === 'left' ? 54 : undefined,
        right: position === 'right' ? 54 : undefined,
        bottom: 52,
        width: 560,
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: '22px 26px 23px',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,.13)',
        background: 'linear-gradient(135deg, rgba(8,12,18,.91), rgba(8,12,18,.72))',
        boxShadow: '0 18px 70px rgba(0,0,0,.38)',
        backdropFilter: 'blur(14px)',
      }}
    >
      {kicker ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: accent,
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          <span style={{ width: 28, height: 2, borderRadius: 2, background: accent }} />
          {kicker}
        </div>
      ) : null}
      {title ? (
        <div
          style={{
            marginTop: kicker ? 13 : 0,
            color: COLORS.white,
            fontFamily: FONT,
            fontSize: 34,
            lineHeight: 1.05,
            fontWeight: 750,
            letterSpacing: '-0.035em',
          }}
        >
          {title}
        </div>
      ) : null}
      {note ? (
        <div
          style={{
            marginTop: 10,
            color: COLORS.muted,
            fontFamily: FONT,
            fontSize: 15,
            lineHeight: 1.48,
          }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

function UiShot({ frame, duration, config }: { frame: number; duration: number; config: ShotConfig }) {
  const p = easeProgress(frame, duration);
  const scale = interpolate(p, [0, 1], [config.scaleFrom ?? 1, config.scaleTo ?? 1.035]);
  const x = interpolate(p, [0, 1], [config.xFrom ?? 0, config.xTo ?? 0]);
  const y = interpolate(p, [0, 1], [config.yFrom ?? 0, config.yTo ?? 0]);
  const opacity = sceneOpacity(frame, duration);
  const darken = clamp(config.darken ?? 0);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, opacity, overflow: 'hidden' }}>
      <Img
        src={staticFile(config.src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
          transformOrigin: 'center center',
          filter: 'saturate(1.02) contrast(1.015)',
        }}
      />
      {darken > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${darken})` }} /> : null}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(0,0,0,.12), transparent 15%, transparent 76%, rgba(0,0,0,.24)), linear-gradient(to right, rgba(0,0,0,.07), transparent 22%, transparent 78%, rgba(0,0,0,.07))',
        }}
      />
      <FeatureLabel
        frame={frame}
        duration={duration}
        kicker={config.kicker}
        title={config.title}
        note={config.note}
        accent={config.accent}
        position={config.labelPosition}
      />
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
}

function SplashShot({ frame, duration }: { frame: number; duration: number }) {
  const p = easeProgress(frame, duration);
  const zoom = interpolate(p, [0, 1], [1, 1.045]);
  const titleIn = interpolate(frame, [48, 82], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const titleOut = interpolate(frame, [duration - 42, duration - 12], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textOpacity = Math.min(titleIn, titleOut);
  return (
    <AbsoluteFill style={{ backgroundColor: '#15181d', opacity: sceneOpacity(frame, duration, 20), overflow: 'hidden' }}>
      <Img
        src={staticFile('remotion/ui/01-splash.png')}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${zoom})` }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 88,
          textAlign: 'center',
          opacity: textOpacity,
          transform: `translateY(${(1 - titleIn) * 18}px)`,
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.2em', color: COLORS.blue }}>
          İSTİNAT DUVARI ANALİZ & TASARIM
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: FONT,
            fontSize: 31,
            fontWeight: 700,
            letterSpacing: '-0.025em',
            color: COLORS.white,
          }}
        >
          Gerçek arayüz. Tek mühendislik akışı.
        </div>
      </div>
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
}

function FinalShot({ frame, duration }: { frame: number; duration: number }) {
  const p = easeProgress(frame, duration);
  const scale = interpolate(p, [0, 1], [1.025, 1.075]);
  const overlay = interpolate(frame, [35, 78], [0, 0.58], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const text = interpolate(frame, [62, 104], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, opacity: sceneOpacity(frame, duration, 12), overflow: 'hidden' }}>
      <Img
        src={staticFile('remotion/ui/09-workspace-final.png')}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})` }}
      />
      <AbsoluteFill style={{ background: `rgba(5,8,13,${overlay})` }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          opacity: text,
          transform: `translateY(${(1 - text) * 24}px)`,
        }}
      >
        <div style={{ color: COLORS.blue, fontFamily: MONO, fontSize: 13, letterSpacing: '0.22em', fontWeight: 700 }}>
          STRUCTFLOW · İSTİNAT DUVARI
        </div>
        <div
          style={{
            marginTop: 20,
            color: COLORS.white,
            fontFamily: FONT,
            fontSize: 70,
            lineHeight: 0.98,
            fontWeight: 760,
            letterSpacing: '-0.055em',
          }}
        >
          Tasarla. Hesapla.
          <br />
          <span style={{ color: COLORS.green }}>Kararı görünür kıl.</span>
        </div>
        <div
          style={{
            marginTop: 25,
            maxWidth: 780,
            color: '#c4cbd5',
            fontFamily: FONT,
            fontSize: 20,
            lineHeight: 1.45,
          }}
        >
          Geometri, 3B model, stabilite, donatı, sürdürülebilirlik ve proje maliyeti aynı çalışma alanında.
        </div>
      </div>
      <FilmGrain frame={frame} />
    </AbsoluteFill>
  );
}

export const RetainingWallPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shots: Array<{ from: number; duration: number; config: ShotConfig }> = [
    {
      from: 150,
      duration: 190,
      config: {
        src: 'remotion/ui/02-project-hub.png',
        kicker: 'Proje Merkezi',
        title: 'Projeden çalışma alanına.',
        note: 'StructFlow proje merkezi, mevcut çalışmalar ve yeni istinat duvarı projeleri için tek başlangıç noktası.',
        accent: COLORS.blue,
        scaleFrom: 1,
        scaleTo: 1.035,
        xFrom: 0,
        xTo: -14,
        labelPosition: 'left',
      },
    },
    {
      from: 315,
      duration: 300,
      config: {
        src: 'remotion/ui/03-workspace-overview.png',
        kicker: 'Tek Ekran · Canlı Model',
        title: 'Geometri, 3B görünüm ve sonuçlar aynı anda.',
        note: 'Videodaki ekran doğrudan uygulamanın kendisi: sol tarafta girdiler, merkezde gerçek 3B model, sağda aktif hesap sonuçları.',
        accent: COLORS.blue,
        scaleFrom: 1.005,
        scaleTo: 1.07,
        xFrom: 0,
        xTo: -12,
        yFrom: 0,
        yTo: -5,
        labelPosition: 'left',
      },
    },
    {
      from: 585,
      duration: 235,
      config: {
        src: 'remotion/ui/04-soil-inputs.png',
        kicker: 'Zemin Parametreleri',
        title: 'Zemin verisi modele doğrudan bağlı.',
        note: 'Birim hacim ağırlıkları, sürtünme açıları, sürşarj ve basınç parametreleri aynı çalışma alanında yönetilir.',
        accent: COLORS.amber,
        scaleFrom: 1.025,
        scaleTo: 1.075,
        xFrom: 15,
        xTo: 28,
        labelPosition: 'right',
      },
    },
    {
      from: 790,
      duration: 260,
      config: {
        src: 'remotion/ui/05-engineering-results.png',
        kicker: 'Mühendislik Sonuçları',
        title: 'Stabilite kontrolleri açık ve okunabilir.',
        note: 'Kayma, devrilme ve taşıma gücü kontrolleri aktif tasarım senaryosuyla birlikte görüntülenir.',
        accent: COLORS.green,
        scaleFrom: 1.01,
        scaleTo: 1.065,
        xFrom: -6,
        xTo: -24,
        labelPosition: 'left',
      },
    },
    {
      from: 1020,
      duration: 270,
      config: {
        src: 'remotion/ui/06-sustainability.png',
        kicker: 'Sürdürülebilirlik',
        title: 'Reçete, malzeme ve CO₂e aynı karar ekranında.',
        note: 'Beton sınıfı ve reçete bileşenleri; malzeme tüketimi, alternatifler ve çevresel performansla birlikte izlenir.',
        accent: COLORS.green,
        scaleFrom: 1.015,
        scaleTo: 1.07,
        xFrom: 0,
        xTo: -20,
        labelPosition: 'left',
      },
    },
    {
      from: 1260,
      duration: 240,
      config: {
        src: 'remotion/ui/07-cost-logistics.png',
        kicker: 'Maliyet & Lojistik',
        title: 'Maliyet ve mesafe etkisi birlikte görünür.',
        note: 'Beton, donatı, kazı, dolgu, kalıp, nakliye ve makine kalemleri aktif geometri üzerinden proje maliyetine bağlanır.',
        accent: COLORS.amber,
        scaleFrom: 1.015,
        scaleTo: 1.065,
        xFrom: 4,
        xTo: -18,
        labelPosition: 'right',
      },
    },
    {
      from: 1470,
      duration: 190,
      config: {
        src: 'remotion/ui/08-reinforcement.png',
        kicker: 'Donatı Tasarımı',
        title: 'Betonarme detayları aynı modelin parçası.',
        note: 'Donatı girdileri ve mühendislik sonuçları, geometri ve malzeme kararlarından kopmadan birlikte değerlendirilir.',
        accent: COLORS.blue,
        scaleFrom: 1.01,
        scaleTo: 1.055,
        xFrom: 6,
        xTo: -10,
        labelPosition: 'left',
      },
    },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, fontFamily: FONT, color: COLORS.white }}>
      <Audio src={staticFile('audio/structflow-ambient.mp3')} volume={0.28} />

      <Sequence from={0} durationInFrames={180}>
        <SplashShot frame={frame} duration={180} />
      </Sequence>

      {shots.map(({ from, duration, config }) => (
        <Sequence key={`${from}-${config.src}`} from={from} durationInFrames={duration}>
          <UiShot frame={frame - from} duration={duration} config={config} />
        </Sequence>
      ))}

      <Sequence from={1630} durationInFrames={170}>
        <FinalShot frame={frame - 1630} duration={170} />
      </Sequence>

      <div
        style={{
          position: 'absolute',
          right: 24,
          bottom: 19,
          fontFamily: MONO,
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'rgba(255,255,255,.34)',
          opacity: frame < 1600 ? 1 : 0,
        }}
      >
        REAL UI CAPTURE · {fps} FPS · 1920×1080
      </div>
    </AbsoluteFill>
  );
};
