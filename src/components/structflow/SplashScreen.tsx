'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  onFinished: () => void;
  ready?: boolean;
}

const STARTUP_READY_TIMEOUT_MS = 6000;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function scheduleAnimationFrame(callback: FrameRequestCallback): number {
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    return window.requestAnimationFrame(callback);
  }
  return window.setTimeout(() => callback(typeof performance?.now === 'function' ? performance.now() : Date.now()), 16);
}

function cancelScheduledAnimationFrame(id: number): void {
  if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(id);
  } else {
    window.clearTimeout(id);
  }
}

export default function SplashScreen({ onFinished, ready = true }: SplashScreenProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'exit'>('loading');
  const signalledRef = useRef(false);
  const readyRef = useRef(ready);

  useEffect(() => {
    readyRef.current = ready;
  }, [ready]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      readyRef.current = true;
    }, STARTUP_READY_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // ── Signal Electron to show the window on first render ──────
  useLayoutEffect(() => {
    if (signalledRef.current) return;
    signalledRef.current = true;
    // Small delay to ensure the splash DOM has painted before showing the window
    scheduleAnimationFrame(() => {
      if (typeof window.electronAPI?.splashReady === 'function') {
        window.electronAPI.splashReady();
      }
    });
  }, []);

  // ── Smooth progress timeline ────────────────────────────────
  useEffect(() => {
    const duration = 2200;
    const start = performance.now();
    let frame = 0;
    let reachedCap = false;
    let capReleaseTime = 0;
    const progressAtCapRelease = 95;

    const tick = (now: number) => {
      const isReady = readyRef.current;

      if (!isReady) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const next = t >= 1 ? 100 : Math.min(easeOutCubic(t) * 100, 99.4);

        if (next >= 95) {
          setProgress(95);
          reachedCap = true;
        } else {
          setProgress(next);
        }
        frame = scheduleAnimationFrame(tick);
      } else {
        if (reachedCap) {
          if (capReleaseTime === 0) {
            capReleaseTime = now;
          }
          const elapsed = now - capReleaseTime;
          const resumeDuration = 400; // takes 400ms to go from 95% to 100%
          const t = Math.min(elapsed / resumeDuration, 1);
          const next = progressAtCapRelease + (100 - progressAtCapRelease) * t;
          setProgress(next);
          if (t < 1) {
            frame = scheduleAnimationFrame(tick);
          }
        } else {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const next = t >= 1 ? 100 : Math.min(easeOutCubic(t) * 100, 99.4);
          setProgress(next);
          if (next < 100) {
            frame = scheduleAnimationFrame(tick);
          }
        }
      }
    };

    frame = scheduleAnimationFrame(tick);
    return () => cancelScheduledAnimationFrame(frame);
  }, []);

  // ── Trigger exit animation when progress completes ──────────
  useEffect(() => {
    if (progress < 100 || phase !== 'loading') return;
    // Short pause at 100% before exit
    const timer = setTimeout(() => setPhase('exit'), 300);
    return () => clearTimeout(timer);
  }, [progress, phase]);

  // ── Call onFinished after exit animation completes ──────────
  useEffect(() => {
    if (phase !== 'exit') return;
    const timer = setTimeout(() => {
      if (typeof window.electronAPI?.splashFinished === 'function') {
        window.electronAPI.splashFinished();
      }
      onFinished();
    }, 420);
    return () => clearTimeout(timer);
  }, [phase, onFinished]);

  const roundedProgress = Math.min(Math.round(progress), 100);

  return (
    <div
      className={`splash-root ${phase === 'exit' ? 'splash-exit' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div className="splash-ambient" />

      {/* ── Brand Container ─────────────────────────────────── */}
      <div className="splash-brand">
        {/* Logo with orbital glow */}
        <div className="splash-logo-wrap">
          <div className="splash-logo-glow" />
          <div className="splash-logo-ring" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            xmlSpace="preserve"
            viewBox="0 0 1683.31 2040.48"
            className="splash-logo-svg"
          >
            <defs>
              <style type="text/css">
                {`
                  .fil0 { fill: #030509; }
                  .fil2 { fill: url(#id0); }
                  .fil5 { fill: url(#id1); }
                  .fil1 { fill: url(#id2); }
                  .fil3 { fill: url(#id3); }
                  .fil4 { fill: url(#id4); }
                `}
              </style>
              <linearGradient id="id0" gradientUnits="userSpaceOnUse" x1="809.27" y1="1597.84" x2="1736.47" y2="886.15">
                <stop offset="0" style={{ stopOpacity: 1, stopColor: "#C4C4C9" }} />
                <stop offset="1" style={{ stopOpacity: 1, stopColor: "white" }} />
              </linearGradient>
              <linearGradient id="id1" gradientUnits="userSpaceOnUse" x1="226.16" y1="550.79" x2="624.03" y2="9.68">
                <stop offset="0" style={{ stopOpacity: 1, stopColor: "#0947A9" }} />
                <stop offset="0.192157" style={{ stopOpacity: 1, stopColor: "#0947A7" }} />
                <stop offset="0.54902" style={{ stopOpacity: 1, stopColor: "#0946A5" }} />
                <stop offset="0.937255" style={{ stopOpacity: 1, stopColor: "#0F4595" }} />
                <stop offset="1" style={{ stopOpacity: 1, stopColor: "#164385" }} />
              </linearGradient>
              <linearGradient id="id2" gradientUnits="userSpaceOnUse" href="#id0" x1="1133.69" y1="559.34" x2="1382.73" y2="-1.65" />
              <linearGradient id="id3" gradientUnits="userSpaceOnUse" href="#id0" x1="1104.2" y1="1664.01" x2="1689.35" y2="1162.33" />
              <linearGradient id="id4" gradientUnits="userSpaceOnUse" x1="858.12" y1="1421.08" x2="-37.25" y2="1065.71">
                <stop offset="0" style={{ stopOpacity: 1, stopColor: "#273F5E" }} />
                <stop offset="0.196078" style={{ stopOpacity: 1, stopColor: "#184283" }} />
                <stop offset="0.560784" style={{ stopOpacity: 1, stopColor: "#0846A8" }} />
                <stop offset="0.937255" style={{ stopOpacity: 1, stopColor: "#1050B4" }} />
                <stop offset="1" style={{ stopOpacity: 1, stopColor: "#185AC1" }} />
              </linearGradient>
            </defs>
            <g id="Katman_x0020_1">
              <g>
                <path className="fil0" d="M1476.97 557.68l-640.12 -339.61 0 -218.07 842.73 446.89 -202.61 110.79zm-638.21 -340.76l638.2 338.59 198.6 -108.6 -836.8 -443.75 0 213.75z"/>
                <polygon id="_1" className="fil1" points="1476.97,557.68 836.84,218.07 836.84,0 1679.58,446.89 "/>
              </g>
              <g>
                <path className="fil0" d="M1677.66 450.07l-813.31 433.96 0 1151.87 190.3 -101.54 0 -917.77c0,-0.79 0.48,-1.47 1.17,-1.76l621.84 -331.8 0 -232.97zm5.64 -5.17l-820.87 437.99 0 1156.19 194.13 -103.58 0 -918.91 623.01 -332.42 0 -237.29 3.73 -1.99z"/>
                <polygon id="_1_3" className="fil2" points="1683.31,444.9 862.44,882.9 862.44,2039.09 1056.57,1935.51 1056.57,1016.6 1679.58,684.18 1679.58,446.89 "/>
              </g>
              <g>
                <path className="fil0" d="M1300.57 1803.15l0 -457c0,-0.79 0.48,-1.47 1.17,-1.76l375.93 -200.59 0 -219.15 -561.78 299.75 0 677.3 184.68 -98.54zm1.91 1.14l0 -458.14 377.1 -201.22 0 -223.47 -565.6 301.79 0 681.62 188.51 -100.58z"/>
                <polygon id="_1_4" className="fil3" points="1302.48,1804.29 1302.48,1346.15 1679.58,1144.94 1679.58,921.47 1113.97,1223.26 1113.97,1904.88 "/>
              </g>
              <g>
                <path className="fil0" d="M-0 446.3l820.87 437.99 0 237.29 -621.43 -331.58 0 237.29 621.43 331.58 0 681.62 -817.14 -436 0 -220.86 621.47 331.61 0 -237.29 -621.47 -331.61 0 -698.04 -3.73 -1.99zm818.95 439.13l-813.31 -433.96 0 693.73 620.31 330.98c0.69,0.29 1.17,0.97 1.17,1.76l0 237.29 -0.01 0c0,0.3 -0.07,0.61 -0.22,0.9 -0.49,0.93 -1.65,1.28 -2.58,0.78l-618.66 -330.11 0 216.54 813.31 433.96 0 -677.3 -620.26 -330.96c-0.69,-0.29 -1.17,-0.97 -1.17,-1.76l0 -237.29 0.01 0c0,-0.3 0.07,-0.61 0.22,-0.9 0.49,-0.93 1.65,-1.28 2.58,-0.78l618.62 330.08 0 -232.97z"/>
                <polygon id="_1_5" className="fil4" points="-0,446.3 820.87,884.29 820.87,1121.58 199.44,790 199.44,1027.29 820.87,1358.87 820.87,2040.48 3.73,1604.48 3.73,1383.62 625.2,1715.23 625.2,1477.94 3.73,1146.33 3.73,448.29 "/>
              </g>
              <g>
                <path className="fil0" d="M206.35 556.91l638.2 -338.59 0 -213.75 -836.8 443.75 198.6 108.6zm-0.01 2.17l640.12 -339.61 0 -218.07 -842.73 446.89 202.61 110.79z"/>
                <polygon id="_1_6" className="fil5" points="206.34,559.08 846.46,219.47 846.46,1.4 3.73,448.29 "/>
              </g>
            </g>
          </svg>
        </div>

        {/* Separator */}
        <div className="splash-separator" />

        {/* Text */}
        <div className="splash-text">
          <h1 className="splash-title">
            Struct<span className="splash-title-accent">Flow</span>
          </h1>
          <p className="splash-subtitle">Güvenli ve sürdürülebilir tasarım</p>
        </div>
      </div>

      {/* ── Progress bar at absolute bottom ─────────────────── */}
      <div className="splash-progress-track">
        <div
          className="splash-progress-fill"
          style={{ width: `${roundedProgress}%` }}
        />
        {/* Shimmer effect on the fill */}
        <div
          className="splash-progress-shimmer"
          style={{ width: `${roundedProgress}%` }}
        />
      </div>
    </div>
  );
}
