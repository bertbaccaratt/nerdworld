'use client';

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair, AlertOctagon, Target, Timer, RadioTower, Zap, X, ExternalLink } from 'lucide-react';

interface Alert {
  id: string;
  city: string;
  originName: string;
  type: string;
  launchTime: number;
  impactTime: number;
  origin: [number, number];
  target: [number, number];
  threatLevel: string;
  status: string;
  source: string;
  sourceUrl?: string;
  timeToImpactMs: number;
}

interface WarSimulatorPanelProps {
  onClose: () => void;
  onLocate: (lat: number, lng: number) => void;
  isMobile?: boolean;
}

function WarSimulatorPanelInner({ onClose, onLocate, isMobile }: WarSimulatorPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [defcon, setDefcon] = useState(4);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Local tick for smooth countdowns
    const tick = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/war-simulator');
        if (res.ok) {
          const data = await res.json();
          setAlerts(data.alerts);
          setDefcon(data.defcon);
        }
      } catch (e) {
        console.warn('War Simulator fetch error:', e);
      }
    };

    fetchAlerts();
    // Poll every 3 seconds
    const iv = setInterval(fetchAlerts, 3000);
    return () => clearInterval(iv);
  }, []);

  const getDefconColor = (level: number) => {
    switch (level) {
      case 1: return '#FF0000'; // White/Red
      case 2: return '#FF3D3D'; // Red
      case 3: return '#FF9500'; // Yellow/Orange
      case 4: return '#00E676'; // Green
      case 5: return '#00B0FF'; // Blue
      default: return '#00E676';
    }
  };

  const formatTMinus = (impactTime: number) => {
    const diff = impactTime - now;
    if (diff <= 0) return 'IMPACT';
    const s = Math.floor(diff / 1000);
    const ms = Math.floor((diff % 1000) / 10);
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `T-${String(m).padStart(2,'0')}:${String(rs).padStart(2,'0')}.${String(ms).padStart(2,'0')}`;
  };

  return (
    <motion.div
      initial={isMobile ? {} : { opacity: 0, x: 20 }}
      animate={isMobile ? {} : { opacity: 1, x: 0 }}
      exit={isMobile ? {} : { opacity: 0, x: 20 }}
      className={`${isMobile ? 'w-full' : 'glass-panel border-red-500/30'} flex flex-col pointer-events-auto overflow-hidden`}
      style={{ boxShadow: (!isMobile && defcon <= 2) ? '0 0 20px rgba(255,0,0,0.2)' : undefined }}
    >
      {!isMobile && (
        <div className="flex items-center justify-between px-4 py-3 bg-red-500/10 border-b border-red-500/30">
        <div className="flex items-center gap-2">
          <RadioTower className={`w-4 h-4 ${defcon <= 2 ? 'text-red-500 animate-pulse' : 'text-[var(--gold-primary)]'}`} />
          <span className="hud-text text-[12px] text-white">WAR SIMULATOR</span>
          <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[9px] font-bold border border-red-500/30">LIVE ALERTS</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 border border-red-500/30 bg-black/50 rounded">
            <span className="text-[9px] font-mono text-red-400">DEFCON</span>
            <span className="text-[12px] font-mono font-bold" style={{ color: getDefconColor(defcon) }}>{defcon}</span>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      )}

      <div className={`${isMobile ? 'p-1 max-h-[50vh]' : 'p-3 max-h-[60vh]'} overflow-y-auto styled-scrollbar`}>
        {alerts.length === 0 ? (
          <div className="py-8 text-center flex flex-col items-center opacity-50">
            <Target className="w-8 h-8 text-[var(--alert-green)] mb-2" />
            <span className="text-[10px] font-mono text-[var(--alert-green)] tracking-widest">AIRSPACE CLEAR</span>
            <span className="text-[8px] font-mono text-[var(--text-muted)] mt-1">NO ACTIVE THREATS DETECTED</span>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {alerts.map((alert) => {
                const diff = alert.impactTime - now;
                const isImminent = diff > 0 && diff < 15000; // < 15s
                const hasImpacted = diff <= 0;

                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative overflow-hidden rounded-lg border ${hasImpacted ? 'border-red-900/50 bg-red-900/10' : 'border-red-500/30 bg-black/60'} p-2.5 cursor-pointer hover:bg-red-500/10 transition-colors`}
                    onClick={() => onLocate(alert.target[1], alert.target[0])}
                  >
                    {isImminent && (
                      <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                    )}
                    <div className="flex justify-between items-start mb-1.5 relative z-10">
                      <div className="flex items-center gap-1.5">
                        <AlertOctagon className={`w-3.5 h-3.5 ${hasImpacted ? 'text-red-800' : 'text-red-500'}`} />
                        <span className={`text-[10px] font-mono font-bold tracking-wider ${hasImpacted ? 'text-red-800' : 'text-red-400'}`}>
                          {alert.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${hasImpacted ? 'bg-red-900/30 text-red-700' : 'bg-red-500/20 text-red-400'}`}>
                        <Timer className="w-3 h-3" />
                        <span className={isImminent ? 'animate-pulse text-white' : ''}>{formatTMinus(alert.impactTime)}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 mt-2 relative z-10">
                      <div>
                        <div className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1"><Zap className="w-2.5 h-2.5" /> ORIGIN</div>
                        <div className={`text-[11px] font-mono truncate ${hasImpacted ? 'text-[var(--text-muted)]' : 'text-white'}`}>{alert.originName}</div>
                      </div>
                      <div>
                        <div className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1"><Crosshair className="w-2.5 h-2.5" /> TARGET</div>
                        <div className={`text-[11px] font-mono font-bold truncate ${hasImpacted ? 'text-[var(--text-muted)]' : 'text-[var(--gold-primary)]'}`}>{alert.city}</div>
                      </div>
                    </div>

                    {alert.sourceUrl && (
                      <div className="mt-2.5 pt-2 border-t border-red-500/20 relative z-10">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(alert.sourceUrl, '_blank', 'noopener,noreferrer');
                          }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[9px] font-mono font-bold rounded border border-red-500/20 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> VERIFY SOURCE
                        </button>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default memo(WarSimulatorPanelInner);
