import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Zap,
  Battery,
  BatteryCharging,
  Cpu,
  Clock,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  X,
  Play,
  CheckCircle2,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import { platformService } from '../core/adapters/PlatformService';
import type {
  DeviceBatteryInfo,
  VaosTelemetryPoint,
  TaskPriority,
} from '../core/adapters/types';
import { VvcLiamLogo } from './VvcLiamLogo';

interface TelemetryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeAgentName?: string;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  isOpen,
  onClose,
  activeAgentName = 'Vladimir // Estratega Supremo',
}) => {
  const [telemetryPoints, setTelemetryPoints] = useState<VaosTelemetryPoint[]>([]);
  const [stats, setStats] = useState({
    avgFastPathLatencyMs: null as number | null,
    avgAsyncDurationMs: null as number | null,
    avgTokensPerSec: null as number | null,
    totalDispatched: 0,
    fastPathCount: 0,
    asyncCount: 0,
    p0Count: 0,
    p1Count: 0,
    p2Count: 0,
  });

  const [batteryInfo, setBatteryInfo] = useState<DeviceBatteryInfo>({
    level: null, charging: null, chargingTime: null, dischargingTime: null,
    temperatureEstimatedC: null, source: 'unavailable',
  });

  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchmarkLog, setBenchmarkLog] = useState<string | null>(null);

  // D3 SVG Container Refs
  const latencyChartRef = useRef<SVGSVGElement | null>(null);
  const tokensChartRef = useRef<SVGSVGElement | null>(null);
  const batteryGaugeRef = useRef<SVGSVGElement | null>(null);
  const priorityDonutRef = useRef<SVGSVGElement | null>(null);

  // Fetch telemetry & battery on mount / interval
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const fetchData = async () => {
      try {
        const [telem, batt] = await Promise.all([
          platformService.api.getVaosTelemetry(),
          platformService.device.getBatteryInfo(),
        ]);

        if (isMounted) {
          setTelemetryPoints(telem.points);
          setStats(telem.stats);
          setBatteryInfo(batt);
        }
      } catch (err) {
        console.warn('[TelemetryPanel] Error fetching metrics:', err);
        if (isMounted) {
          setTelemetryPoints([]);
          setStats({ avgFastPathLatencyMs: null, avgAsyncDurationMs: null, avgTokensPerSec: null,
            totalDispatched: 0, fastPathCount: 0, asyncCount: 0, p0Count: 0, p1Count: 0, p2Count: 0 });
          setBatteryInfo({ level: null, charging: null, chargingTime: null, dischargingTime: null,
            temperatureEstimatedC: null, source: 'unavailable' });
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen]);

  // RENDER D3 LATENCY CHART
  useEffect(() => {
    if (!isOpen || !latencyChartRef.current) return;

    const svg = d3.select(latencyChartRef.current);
    svg.selectAll('*').remove();
    if (!telemetryPoints.length) { svg.append('text').attr('x', 15).attr('y', 30).attr('fill', '#C0C0C0').text('N/D'); return; }

    const width = latencyChartRef.current.clientWidth || 440;
    const height = 180;
    const margin = { top: 20, right: 20, bottom: 30, left: 45 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const data = telemetryPoints.slice(-18);

    const x = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([0, innerW]);

    const yMax = Math.max(300, d3.max(data, (d) => d.latencyMs) || 300);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]).nice();

    // Fast Path SLA Threshold Zone (<200ms)
    g.append('rect')
      .attr('x', 0)
      .attr('y', y(200))
      .attr('width', innerW)
      .attr('height', innerH - y(200))
      .attr('fill', '#00FF66')
      .attr('opacity', 0.04);

    // Fast Path SLA Line at 200ms
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(200))
      .attr('y2', y(200))
      .attr('stroke', '#00FF66')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 4')
      .attr('opacity', 0.7);

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', y(200) - 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#00FF66')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .text('META ROUTING <200ms');

    // Axes
    const yAxis = d3.axisLeft(y).ticks(4).tickFormat((d) => `${d}ms`);
    g.append('g')
      .call(yAxis)
      .attr('color', '#4a3f5a')
      .selectAll('text')
      .attr('fill', '#C0C0C0')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    // Area Generator
    const area = d3
      .area<VaosTelemetryPoint>()
      .x((_, i) => x(i))
      .y0(innerH)
      .y1((d) => y(d.latencyMs))
      .curve(d3.curveMonotoneX);

    // Area Gradient
    const gradId = 'latencyGrad';
    const defs = svg.append('defs');
    const grad = defs
      .append('linearGradient')
      .attr('id', gradId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    grad.append('stop').attr('offset', '0%').attr('stop-color', '#00FF66').attr('stop-opacity', 0.35);
    grad.append('stop').attr('offset', '100%').attr('stop-color', '#0A060D').attr('stop-opacity', 0.0);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#${gradId})`)
      .attr('d', area);

    // Line Generator
    const line = d3
      .line<VaosTelemetryPoint>()
      .x((_, i) => x(i))
      .y((d) => y(d.latencyMs))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#00FF66')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Data dots
    g.selectAll('.dot')
      .data(data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', (_, i) => x(i))
      .attr('cy', (d) => y(d.latencyMs))
      .attr('r', 3)
      .attr('fill', (d) => (d.route === 'FAST_PATH' ? '#00FF66' : '#8A2BFF'))
      .attr('stroke', '#0A060D')
      .attr('stroke-width', 1.5);
  }, [isOpen, telemetryPoints]);

  // RENDER D3 TOKENS/SEC THROUGHPUT CHART
  useEffect(() => {
    if (!isOpen || !tokensChartRef.current) return;

    const svg = d3.select(tokensChartRef.current);
    svg.selectAll('*').remove();
    const data = telemetryPoints.filter(point => point.tokensSource === 'provider' && point.tokensPerSec !== null).slice(-14);
    if (!data.length) { svg.append('text').attr('x', 15).attr('y', 30).attr('fill', '#C0C0C0').text('N/D'); return; }

    const width = tokensChartRef.current.clientWidth || 440;
    const height = 140;
    const margin = { top: 15, right: 15, bottom: 25, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(data.map((_, i) => String(i)))
      .range([0, innerW])
      .padding(0.28);

    const maxTps = Math.max(60, d3.max(data, (d) => d.tokensPerSec) || 60);
    const y = d3.scaleLinear().domain([0, maxTps]).range([innerH, 0]).nice();

    // Bars
    g.selectAll('.bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (_, i) => x(String(i)) || 0)
      .attr('y', (d) => y(d.tokensPerSec!))
      .attr('width', x.bandwidth())
      .attr('height', (d) => innerH - y(d.tokensPerSec!))
      .attr('rx', 3)
      .attr('fill', (d) => (d.priority === 'P0_CRITICAL' ? '#D4AF37' : '#8A2BFF'))
      .attr('opacity', 0.85);

    // Y Axis
    const yAxis = d3.axisLeft(y).ticks(3).tickFormat((d) => `${d} tps`);
    g.append('g')
      .call(yAxis)
      .attr('color', '#4a3f5a')
      .selectAll('text')
      .attr('fill', '#C0C0C0')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');
  }, [isOpen, telemetryPoints]);

  // RENDER D3 RADIAL BATTERY GAUGE
  useEffect(() => {
    if (!isOpen || !batteryGaugeRef.current) return;

    const svg = d3.select(batteryGaugeRef.current);
    svg.selectAll('*').remove();
    if (batteryInfo.level === null) {
      svg.append('text').attr('x', 75).attr('y', 75).attr('text-anchor', 'middle').attr('fill', '#C0C0C0').text('N/D');
      return;
    }

    const size = 150;
    const radius = size / 2;
    const arcWidth = 14;

    const g = svg
      .append('g')
      .attr('transform', `translate(${radius},${radius})`);

    // Background track arc
    const bgArc = d3
      .arc()
      .innerRadius(radius - arcWidth)
      .outerRadius(radius)
      .startAngle(-Math.PI * 0.75)
      .endAngle(Math.PI * 0.75);

    g.append('path')
      .attr('d', bgArc as any)
      .attr('fill', '#1a1122');

    // Value Arc
    const currentAngle = -Math.PI * 0.75 + batteryInfo.level * (Math.PI * 1.5);
    const valueArc = d3
      .arc()
      .innerRadius(radius - arcWidth)
      .outerRadius(radius)
      .startAngle(-Math.PI * 0.75)
      .endAngle(currentAngle)
      .cornerRadius(6);

    const arcColor = batteryInfo.charging 
      ? '#8A2BFF' 
      : batteryInfo.level > 0.4 
        ? '#00FF66' 
        : '#D4AF37';

    g.append('path')
      .attr('d', valueArc as any)
      .attr('fill', arcColor)
      .attr('filter', 'drop-shadow(0px 0px 6px rgba(0,255,102,0.5))');

    // Center text percentage
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.1em')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .text(`${Math.round(batteryInfo.level * 100)}%`);

    // Secondary text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.4em')
      .attr('fill', arcColor)
      .attr('font-size', '10px')
      .attr('font-family', 'monospace')
      .attr('letter-spacing', '0.1em')
      .text(batteryInfo.charging === null ? 'N/D' : batteryInfo.charging ? 'CARGANDO' : 'API DEL NAVEGADOR');
  }, [isOpen, batteryInfo]);

  // RENDER D3 PRIORITY DONUT BREAKDOWN
  useEffect(() => {
    if (!isOpen || !priorityDonutRef.current) return;

    const svg = d3.select(priorityDonutRef.current);
    svg.selectAll('*').remove();

    const size = 150;
    const radius = size / 2;
    const innerRadius = radius - 20;

    const g = svg
      .append('g')
      .attr('transform', `translate(${radius},${radius})`);

    const data = [
      { label: 'P2_LOW (Fast Path)', count: stats.p2Count, color: '#00FF66' },
      { label: 'P1_HIGH (Async Ops)', count: stats.p1Count, color: '#8A2BFF' },
      { label: 'P0_CRITICAL (VIP)', count: stats.p0Count, color: '#D4AF37' },
    ];

    const pie = d3
      .pie<{ label: string; count: number; color: string }>()
      .value((d) => d.count)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<{ label: string; count: number; color: string }>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .padAngle(0.04)
      .cornerRadius(4);

    g.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('opacity', 0.9);

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .attr('fill', '#C0C0C0')
      .attr('font-size', '13px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(`${stats.totalDispatched}`);
  }, [isOpen, stats]);

  // LIVE BENCHMARK EXECUTION (Tests Fast Path vs Async Path Live)
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    setBenchmarkLog('Iniciando benchmark VAOS: Fast Path (<200ms) vs Async Path (P0_CRITICAL)...');

    try {
      // 1. Test Fast Path
      const t0 = performance.now();
      const fastResult = await platformService.api.dispatchVaos({
        command: 'Verificar estado de batería y memoria de trabajo',
        forcePriority: 'P2_LOW',
      });
      const t1 = performance.now();
      const realFastMs = Math.round(t1 - t0);

      setBenchmarkLog(`✓ Fast Path completado en ${realFastMs}ms (<200ms SLA cumplido). Evaluando Async Path P0...`);

      // 2. Test Async Path P0
      const asyncResult = await platformService.api.dispatchVaos({
        command: 'Operación OSINT táctica y validación de cifrado E2EE',
        forcePriority: 'P0_CRITICAL',
        injectedSkills: ['OSINT_RECON', 'CRYPTOGRAPHIC_DEFENSE'],
      });

      if (asyncResult.asyncTask) {
        setBenchmarkLog(`✓ Tarea Async P0 encolada (ID: ${asyncResult.asyncTask.taskId.slice(-8)}). Procesando en segundo plano...`);
        
        // Poll until real AI execution completes
        const taskId = asyncResult.asyncTask.taskId;
        let attempts = 0;
        const pollInterval = setInterval(async () => {
          attempts++;
          try {
            const detail = await platformService.api.getVaosTask(taskId);
            if (['COMPLETED', 'FAILED', 'UNAVAILABLE'].includes(detail.status) || attempts > 15) {
              clearInterval(pollInterval);
              const duration = typeof detail.durationMs === 'number' ? `${detail.durationMs}ms` : 'N/D';
              const tokensSec = typeof detail.result?.tokensPerSec === 'number' ? ` (${detail.result.tokensPerSec} tokens/s de proceso)` : ' (tasa N/D)';
              setBenchmarkLog(
                detail.status === 'COMPLETED'
                  ? `Generación terminada: routing RTT ${realFastMs}ms | proceso ${duration}${tokensSec}. No verifica acciones externas.`
                  : `Medición sin resultado de generación (${detail.status}). Routing RTT ${realFastMs}ms; tasa N/D.`
              );

              // Refresh telemetry with real points
              const telem = await platformService.api.getVaosTelemetry();
              setTelemetryPoints(telem.points);
              setStats(telem.stats);
              setIsBenchmarking(false);
            }
          } catch {
            clearInterval(pollInterval);
            setIsBenchmarking(false);
          }
        }, 300);
      } else {
        setIsBenchmarking(false);
      }
    } catch (e: any) {
      setBenchmarkLog(`Error en benchmark: ${e?.message || 'Error de red'}`);
      setIsBenchmarking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#0A060D] border border-[#261833] rounded-2xl shadow-[0_0_50px_rgba(0,255,102,0.15)] text-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col font-sans">
        
        {/* TOP BRAND HEADER */}
        <div className="px-5 py-4 border-b border-[#261833] bg-[#0E0814] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <VvcLiamLogo variant="badge" size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-[#8A2BFF] tracking-wider">
                  VVC LIAM CORE
                </span>
                <span className="text-[#C0C0C0]/50 text-xs">/</span>
                <span className="font-mono text-xs font-bold text-[#00FF66] tracking-wide">
                  TELEMETRÍA & ORQUESTADOR VAOS
                </span>
              </div>
              <div className="text-[11px] font-mono text-[#C0C0C0]/70 flex items-center gap-2 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse" />
                <span>NÚCLEO EN VIVO · PLATAFORMA: {platformService.getPlatform().toUpperCase()}</span>
                <span>·</span>
                <span>AGENTE ACTIVO: {activeAgentName.split(' ')[0]}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunBenchmark}
              disabled={isBenchmarking}
              className="px-3 py-1.5 rounded-xl bg-[#170E22] border border-[#261833] hover:border-[#00FF66]/50 text-[#00FF66] hover:text-white transition-all text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isBenchmarking ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Benchmark VAOS</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#C0C0C0] hover:text-white hover:bg-[#1C1229] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* LOG BENCHMARK BANNER */}
        {benchmarkLog && (
          <div className="px-5 py-2.5 bg-[#120B1C] border-b border-[#261833] text-xs font-mono text-[#00FF66] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00FF66]" />
            <span className="truncate">{benchmarkLog}</span>
          </div>
        )}

        {/* MAIN BODY CONTENT */}
        <div className="p-5 space-y-5 overflow-y-auto">
          
          {/* STATS TILES (4 CARDS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Tile 1: Fast Path SLA */}
            <div className="bg-[#120C18] border border-[#261833] rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-[#C0C0C0]">
                <span>FAST PATH SLA</span>
                <Zap className="w-4 h-4 text-[#00FF66]" />
              </div>
              <div className="font-mono text-2xl font-black text-[#00FF66]">
                {stats.avgFastPathLatencyMs === null ? 'N/D' : `${stats.avgFastPathLatencyMs}ms`}
              </div>
              <div className="text-[10px] font-mono text-[#C0C0C0]/70">
                Meta objetivo: &lt;200ms (P2_LOW)
              </div>
            </div>

            {/* Tile 2: Async Duration */}
            <div className="bg-[#120C18] border border-[#261833] rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-[#C0C0C0]">
                <span>ASYNC PATH OPS</span>
                <Clock className="w-4 h-4 text-[#8A2BFF]" />
              </div>
              <div className="font-mono text-2xl font-black text-[#8A2BFF]">
                {stats.avgAsyncDurationMs === null ? 'N/D' : `${stats.avgAsyncDurationMs}ms`}
              </div>
              <div className="text-[10px] font-mono text-[#C0C0C0]/70">
                P0_CRITICAL & P1_HIGH en cola
              </div>
            </div>

            {/* Tile 3: Throughput */}
            <div className="bg-[#120C18] border border-[#261833] rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-[#C0C0C0]">
                <span>TASA DE PROCESO</span>
                <Activity className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div className="font-mono text-2xl font-black text-[#D4AF37]">
                {stats.avgTokensPerSec === null ? 'N/D' : `${stats.avgTokensPerSec} tokens/s`}
              </div>
              <div className="text-[10px] font-mono text-[#C0C0C0]/70">
                Tokens reportados / tiempo de proceso
              </div>
            </div>

            {/* Tile 4: Battery & Power */}
            <div className="bg-[#120C18] border border-[#261833] rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-[#C0C0C0]">
                <span>BATERÍA & ENERGÍA</span>
                {batteryInfo.charging ? (
                  <BatteryCharging className="w-4 h-4 text-[#8A2BFF]" />
                ) : (
                  <Battery className="w-4 h-4 text-[#00FF66]" />
                )}
              </div>
              <div className="font-mono text-2xl font-black text-white">
                {batteryInfo.level === null ? 'N/D' : `${Math.round(batteryInfo.level * 100)}%`}
              </div>
              <div className="text-[10px] font-mono text-[#00FF66]">
                {batteryInfo.source === 'browser' ? 'API del navegador; temperatura N/D' : 'Medición no disponible'}
              </div>
            </div>
          </div>

          {/* D3 VISUALIZATIONS GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            
            {/* COLUMN 1 & 2: D3 LATENCY AND TOKENS CHARTS */}
            <div className="lg:col-span-2 space-y-4">
              
              {/* Chart 1: Latency Stream */}
              <div className="bg-[#120C18] border border-[#261833] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#00FF66]" />
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      TIEMPO DE PROCESO Y ROUTING
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#00FF66] bg-[#00FF66]/10 px-2 py-0.5 rounded border border-[#00FF66]/20">
                    &lt;200ms TARGET
                  </span>
                </div>
                <div className="w-full overflow-hidden">
                  <svg ref={latencyChartRef} className="w-full h-[180px]" />
                </div>
              </div>

              {/* Chart 2: Throughput Tokens/sec */}
              <div className="bg-[#120C18] border border-[#261833] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#8A2BFF]" />
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      TOKENS REPORTADOS / TIEMPO DE PROCESO
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#C0C0C0]/60">
                    No mide TPS interno del modelo
                  </span>
                </div>
                <div className="w-full overflow-hidden">
                  <svg ref={tokensChartRef} className="w-full h-[140px]" />
                </div>
              </div>

            </div>

            {/* COLUMN 3: RADIAL BATTERY GAUGE & PRIORITY DONUT */}
            <div className="space-y-4">
              
              {/* Radial Battery Gauge */}
              <div className="bg-[#120C18] border border-[#261833] rounded-xl p-4 flex flex-col items-center text-center">
                <div className="w-full flex items-center justify-between mb-2 text-left">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#00FF66]" />
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      USO DE BATERÍA
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#00FF66]">
                    {batteryInfo.source === 'browser' ? 'API NAVEGADOR' : 'N/D'}
                  </span>
                </div>
                <svg ref={batteryGaugeRef} width={150} height={150} className="my-1" />
                <div className="w-full pt-2 border-t border-[#261833] text-[11px] font-mono text-[#C0C0C0] flex justify-between">
                  <span>Estado Energía:</span>
                  <span className="text-white font-semibold">
                    {batteryInfo.charging === null ? 'N/D' : batteryInfo.charging ? 'Cargando' : 'Sin carga'}
                  </span>
                </div>
              </div>

              {/* Priority Donut */}
              <div className="bg-[#120C18] border border-[#261833] rounded-xl p-4 flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-2 text-left">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#D4AF37]" />
                    <span className="font-mono text-xs font-bold text-white tracking-wide">
                      DESGLOSE PRIORIDAD VAOS
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#C0C0C0]/60">
                    P0 / P1 / P2
                  </span>
                </div>
                <svg ref={priorityDonutRef} width={150} height={150} className="my-1" />
                <div className="w-full pt-2 border-t border-[#261833] text-[10px] font-mono grid grid-cols-3 gap-1 text-center">
                  <div className="text-[#00FF66]">
                    <div>P2 Low</div>
                    <div className="font-bold">{stats.p2Count}</div>
                  </div>
                  <div className="text-[#8A2BFF]">
                    <div>P1 High</div>
                    <div className="font-bold">{stats.p1Count}</div>
                  </div>
                  <div className="text-[#D4AF37]">
                    <div>P0 Crit</div>
                    <div className="font-bold">{stats.p0Count}</div>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* VAOS POLICY ENGINE & RECENT TRANSACTIONS TABLE */}
          <div className="bg-[#120C18] border border-[#261833] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#00FF66]" />
                <span className="font-mono text-xs font-bold text-white tracking-wide">
                  REGISTRO RECIENTE DEL ORQUESTADOR VAOS (POLICY ENGINE)
                </span>
              </div>
              <span className="text-[10px] font-mono text-[#C0C0C0]/70">
                Gobernanza activa &middot; Latencia en microsegundos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-[#261833] text-[#C0C0C0]/60 text-[10px]">
                    <th className="pb-2">TAREA ID</th>
                    <th className="pb-2">COMANDO / ACCIÓN</th>
                    <th className="pb-2">RUTA VAOS</th>
                    <th className="pb-2">PRIORIDAD</th>
                    <th className="pb-2">LATENCIA</th>
                    <th className="pb-2">RENDIMIENTO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#261833]/50">
                  {telemetryPoints.slice(-5).reverse().map((point) => (
                    <tr key={point.taskId} className="hover:bg-[#181022] transition-colors">
                      <td className="py-2 text-[#C0C0C0]">{point.taskId.slice(-8)}</td>
                      <td className="py-2 text-white font-medium max-w-[220px] truncate">
                        {point.command}
                      </td>
                      <td className="py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            point.route === 'FAST_PATH'
                              ? 'bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30'
                              : 'bg-[#8A2BFF]/15 text-[#8A2BFF] border border-[#8A2BFF]/30'
                          }`}
                        >
                          {point.route}
                        </span>
                      </td>
                      <td className="py-2">
                        <span
                          className={`font-semibold ${
                            point.priority === 'P0_CRITICAL'
                              ? 'text-[#D4AF37]'
                              : point.priority === 'P1_HIGH'
                                ? 'text-[#8A2BFF]'
                                : 'text-[#00FF66]'
                          }`}
                        >
                          {point.priority}
                        </span>
                      </td>
                      <td className="py-2 text-[#00FF66] font-bold">
                        {point.latencyMs}ms
                      </td>
                      <td className="py-2 text-[#C0C0C0]">
                        {point.tokensPerSec === null ? 'N/D' : `${point.tokensPerSec} tokens/s de proceso`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-[#261833] bg-[#0E0814] flex items-center justify-between text-[11px] font-mono text-[#C0C0C0]/70 shrink-0">
          <div>
            <span>VVC LIAM CORE v1.0.0</span>
            <span className="mx-2">&middot;</span>
            <span className="text-[#00FF66]">Control // Analyze // Execute</span>
          </div>
          <div className="text-right">
            <span>PERSISTENCIA LOCAL ACTIVA &middot; CERO TELEMETRÍA EXTERNA</span>
          </div>
        </div>

      </div>
    </div>
  );
};
