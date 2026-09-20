import React, { useState } from 'react';
import { CampaignMapData, CampaignMapNode } from '../../types';
import {
  X,
  Map,
  Compass,
  Swords,
  HelpCircle,
  Tent,
  Crown,
  Sparkles,
  CheckCircle2,
  Lock,
  Flag,
  Navigation,
  Layers,
  Clock
} from 'lucide-react';

interface CampaignMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  mapData?: CampaignMapData;
  campaignTitle: string;
  currentRound: number;
  duration?: 'short' | 'medium' | 'long';
  genre?: string;
  onSelectRoute?: (targetNodeId: string) => void;
}

const GENRE_LABELS: Record<string, string> = {
  fantasy: '⚔️ Фэнтези',
  cyberpunk: '🦾 Киберпанк',
  mafia: '🕵️ Мафия 1930',
  scifi: '🚀 Sci-Fi Космос',
  detective: '🔍 Детектив',
  horror: '🕯️ Хоррор',
};

const DURATION_LABELS: Record<string, { label: string; maxRounds: number }> = {
  short: { label: '⚡ Короткая (10 раундов)', maxRounds: 10 },
  medium: { label: '🛡️ Средняя (16 раундов)', maxRounds: 16 },
  long: { label: '👑 Длительная (20+ раундов)', maxRounds: 20 },
};

export const CampaignMapModal: React.FC<CampaignMapModalProps> = ({
  isOpen,
  onClose,
  mapData,
  campaignTitle,
  currentRound,
  duration = 'medium',
  genre = 'fantasy',
  onSelectRoute,
}) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (!isOpen) return null;

  const durationInfo = DURATION_LABELS[duration] || DURATION_LABELS.medium;
  const rawNodes = mapData?.nodes || [];
  const edges = mapData?.edges || [];
  const currentNodeId = mapData?.currentNodeId || rawNodes[0]?.id || '';

  // Collision avoidance & progressive layout along X and Y
  const nodes = React.useMemo(() => {
    if (!rawNodes || rawNodes.length === 0) return [];
    const copy = rawNodes.map(n => ({ ...n }));

    // Ensure progressive X and separate colliding coordinates
    for (let i = 1; i < copy.length; i++) {
      const prev = copy[i - 1];
      const curr = copy[i];
      if (curr.x <= prev.x + 13) {
        curr.x = Math.min(95, prev.x + 14);
      }
      if (Math.abs(curr.y - prev.y) < 18) {
        curr.y = prev.y > 50 ? Math.max(22, prev.y - 32) : Math.min(78, prev.y + 32);
      }
    }
    return copy;
  }, [rawNodes]);

  const activeSelectedId = selectedNodeId || currentNodeId;
  const selectedNode = nodes.find(n => n.id === activeSelectedId) || nodes[0];

  // Calculate campaign completion %
  const visitedCount = nodes.filter(n => n.status === 'visited').length;
  const currentIdx = nodes.findIndex(n => n.id === currentNodeId);
  const progressPercent = Math.min(
    100,
    Math.round(((currentIdx >= 0 ? currentIdx + 0.5 : visitedCount) / Math.max(1, nodes.length)) * 100)
  );

  const getNodeIcon = (type: CampaignMapNode['type'], className = 'w-4 h-4') => {
    switch (type) {
      case 'start':
        return <Flag className={className} />;
      case 'battle':
        return <Swords className={className} />;
      case 'mystery':
        return <HelpCircle className={className} />;
      case 'rest':
        return <Tent className={className} />;
      case 'boss':
        return <Crown className={className} />;
      case 'climax':
        return <Sparkles className={className} />;
      default:
        return <Compass className={className} />;
    }
  };

  const getNodeTypeLabel = (type: CampaignMapNode['type']) => {
    switch (type) {
      case 'start':
        return 'Начало пути';
      case 'battle':
        return 'Боевое столкновение';
      case 'mystery':
        return 'Загадка / Тайна';
      case 'rest':
        return 'Лагерь / Привал';
      case 'boss':
        return 'Битва с боссом';
      case 'climax':
        return 'Кульминация и финал';
      default:
        return 'Ключевая локация';
    }
  };

  const getNodeStatusBadge = (status: CampaignMapNode['status'], isCurrent: boolean) => {
    if (isCurrent) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1.5 animate-pulse">
          <Navigation className="w-3.5 h-3.5 text-amber-400" />
          Отряд находится здесь
        </span>
      );
    }
    switch (status) {
      case 'visited':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Пройдено
          </span>
        );
      case 'discovered':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950/40 text-sky-400 border border-sky-800/40 flex items-center gap-1">
            <Compass className="w-3 h-3" /> Впереди по маршруту
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <Lock className="w-3 h-3" /> Скрыто туманом войны
          </span>
        );
    }
  };

  // Convert normalized coordinates (0-100) to SVG viewbox coords (1000x500)
  const getSvgCoords = (x: number, y: number) => {
    const svgX = 60 + (x / 100) * 880;
    const svgY = 50 + (y / 100) * 400;
    return { x: svgX, y: svgY };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-fantasy-panel border border-fantasy-border/90 rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-fantasy-border flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 shadow-sm">
              <Map className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold font-rpg text-amber-400">
                  Интерактивная карта сюжета
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {GENRE_LABELS[genre] || genre}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-950/50 text-blue-300 border border-blue-800/40">
                  {durationInfo.label}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950/50 text-indigo-300 border border-indigo-800/40">
                  Раунд {currentRound} / {durationInfo.maxRounds}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-xl mt-0.5">
                {campaignTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Campaign Progress Bar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-fantasy-border/50 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Прогресс кампании:</span>
            <span className="font-bold font-mono text-amber-300">{progressPercent}%</span>
          </div>

          <div className="flex-1 max-w-md h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-amber-400 transition-all duration-500 rounded-full shadow-glow-gold"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Раунд {currentRound}</span>
          </div>
        </div>

        {/* Map Canvas Area */}
        <div className="flex-1 min-h-[360px] sm:min-h-[420px] p-3 relative bg-gradient-to-b from-[#0a0f1d] to-[#040810] overflow-hidden select-none">
          {/* Subtle grid texture overlay */}
          <div
            className="absolute inset-0 opacity-15 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          {/* SVG Map Canvas */}
          <svg
            viewBox="0 0 1000 500"
            className="w-full h-full filter drop-shadow-md"
            style={{ overflow: 'visible' }}
          >
            <defs>
              {/* Glowing Filters */}
              <filter id="glow-gold" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter id="glow-emerald" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="edge-visited" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="edge-current" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#fbbf24" />
              </linearGradient>
            </defs>

            {/* Connecting Edges */}
            {edges.map((edge, idx) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const p1 = getSvgCoords(fromNode.x, fromNode.y);
              const p2 = getSvgCoords(toNode.x, toNode.y);

              const isVisitedEdge = fromNode.status === 'visited' && (toNode.status === 'visited' || toNode.id === currentNodeId);
              const isCurrentEdge = fromNode.id === currentNodeId || toNode.id === currentNodeId;

              // Curved bezier path for organic road feeling
              const midX = (p1.x + p2.x) / 2;
              const midY = (p1.y + p2.y) / 2 + ((idx % 2 === 0 ? 1 : -1) * 15);
              const d = `M ${p1.x} ${p1.y} Q ${midX} ${midY} ${p2.x} ${p2.y}`;

              return (
                <g key={`edge-${edge.from}-${edge.to}-${idx}`}>
                  {/* Background shadow path */}
                  <path
                    d={d}
                    fill="none"
                    stroke="#020617"
                    strokeWidth="7"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  {/* Active glowing or dashed line */}
                  <path
                    d={d}
                    fill="none"
                    stroke={
                      isVisitedEdge
                        ? 'url(#edge-visited)'
                        : isCurrentEdge
                        ? 'url(#edge-current)'
                        : '#334155'
                    }
                    strokeWidth={isCurrentEdge ? '3.5' : isVisitedEdge ? '3' : '2'}
                    strokeDasharray={isVisitedEdge ? 'none' : isCurrentEdge ? '6 4' : '4 4'}
                    strokeLinecap="round"
                    filter={isVisitedEdge ? 'url(#glow-emerald)' : isCurrentEdge ? 'url(#glow-gold)' : undefined}
                    opacity={isVisitedEdge ? 0.9 : isCurrentEdge ? 1 : 0.4}
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node, idx) => {
              const coords = getSvgCoords(node.x, node.y);
              const isCurrent = node.id === currentNodeId;
              const isSelected = node.id === activeSelectedId;
              const isVisited = node.status === 'visited';
              const isDiscovered = node.status === 'discovered';
              const isLocked = node.status === 'locked' && !isCurrent;

              // Alternating / smart label placement to prevent label collisions
              const isLabelAbove = node.y > 52 || (idx % 2 === 1);
              const labelY = isLabelAbove ? (isCurrent ? -34 : -30) : (isCurrent ? 34 : 30);
              const squadBadgeY = isLabelAbove ? (isCurrent ? 34 : 30) : (isCurrent ? -34 : -30);

              // Node color scheme
              let circleFill = '#0f172a';
              let circleStroke = '#475569';
              let iconColor = '#94a3b8';

              if (isCurrent) {
                circleFill = '#78350f';
                circleStroke = '#f59e0b';
                iconColor = '#fef08a';
              } else if (isVisited) {
                circleFill = '#064e3b';
                circleStroke = '#10b981';
                iconColor = '#6ee7b7';
              } else if (isDiscovered) {
                circleFill = '#1e293b';
                circleStroke = '#38bdf8';
                iconColor = '#7dd3fc';
              }

              return (
                <g
                  key={node.id}
                  transform={`translate(${coords.x}, ${coords.y})`}
                  className="group cursor-pointer select-none"
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  {/* Stable pulse ring for current party location without SVG scale/spin jitter */}
                  {isCurrent && (
                    <>
                      <circle
                        r="32"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        opacity="0.7"
                      />
                      <circle
                        r="38"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="1"
                        opacity="0.3"
                      />
                    </>
                  )}

                  {/* Selection indicator ring */}
                  {isSelected && !isCurrent && (
                    <circle
                      r="28"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                      opacity="0.9"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={isCurrent ? 22 : 18}
                    fill={circleFill}
                    stroke={circleStroke}
                    strokeWidth={isCurrent ? 3 : isSelected ? 2.5 : 2}
                    filter={isCurrent ? 'url(#glow-gold)' : isVisited ? 'url(#glow-emerald)' : undefined}
                    className="transition-all duration-200 group-hover:stroke-amber-300 group-hover:stroke-[3px]"
                  />

                  {/* Node icon placeholder (foreignObject with lucide icon) */}
                  <foreignObject
                    x={isCurrent ? -12 : -10}
                    y={isCurrent ? -12 : -10}
                    width={isCurrent ? 24 : 20}
                    height={isCurrent ? 24 : 20}
                    className="pointer-events-none"
                  >
                    <div
                      className="flex items-center justify-center w-full h-full"
                      style={{ color: iconColor }}
                    >
                      {isLocked ? (
                        <Lock className="w-3.5 h-3.5 opacity-60" />
                      ) : (
                        getNodeIcon(node.type, isCurrent ? 'w-4 h-4' : 'w-3.5 h-3.5')
                      )}
                    </div>
                  </foreignObject>

                  {/* Node Title Badge */}
                  <g transform={`translate(0, ${labelY})`}>
                    <rect
                      x={-(node.title.length * 4.2)}
                      y="-10"
                      width={node.title.length * 8.4}
                      height="20"
                      rx="6"
                      fill="#020617"
                      fillOpacity="0.88"
                      stroke={isSelected ? '#f59e0b' : '#334155'}
                      strokeWidth={isSelected ? 1.5 : 0.8}
                      className="transition-colors group-hover:stroke-amber-400"
                    />
                    <text
                      textAnchor="middle"
                      y="4"
                      fontSize="10"
                      fontWeight="700"
                      fill={isCurrent ? '#fef08a' : isVisited ? '#a7f3d0' : isSelected ? '#ffffff' : '#cbd5e1'}
                      className="font-sans pointer-events-none"
                    >
                      {node.title}
                    </text>
                  </g>

                  {/* "Отряд здесь" pointer token */}
                  {isCurrent && (
                    <g transform={`translate(0, ${squadBadgeY})`}>
                      <rect
                        x="-44"
                        y="-12"
                        width="88"
                        height="20"
                        rx="10"
                        fill="#b45309"
                        stroke="#fef08a"
                        strokeWidth="1.5"
                      />
                      <text
                        textAnchor="middle"
                        y="2"
                        fontSize="9"
                        fontWeight="800"
                        fill="#ffffff"
                        className="font-rpg uppercase tracking-wider pointer-events-none"
                      >
                        ⚡ Отряд здесь
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="p-4 sm:p-5 bg-slate-900/90 border-t border-fantasy-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-amber-400 font-bold border border-slate-700">
                  Акт {selectedNode.act}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-medium text-slate-300 border border-slate-700 flex items-center gap-1">
                  {getNodeIcon(selectedNode.type, 'w-3 h-3')}
                  {getNodeTypeLabel(selectedNode.type)}
                </span>
                {getNodeStatusBadge(selectedNode.status, selectedNode.id === currentNodeId)}
              </div>

              <h4 className="text-base font-bold font-rpg text-slate-100">
                {selectedNode.title}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                {selectedNode.description || 'Таинственный рубеж приключения. Готовьтесь преодолеть испытания и раскрыть тайны.'}
              </p>
            </div>

            {/* Action Route Choice Button */}
            {onSelectRoute && selectedNode.id !== currentNodeId && (selectedNode.status === 'discovered' || edges.some(e => e.from === currentNodeId && e.to === selectedNode.id)) && (
              <button
                type="button"
                onClick={() => {
                  onSelectRoute(selectedNode.id);
                  onClose();
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-rpg text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 shrink-0"
              >
                <Navigation className="w-4 h-4" />
                <span>Выбрать этот маршрут</span>
              </button>
            )}

            {/* Map Legend */}
            <div className="flex items-center gap-3 text-[11px] text-slate-400 flex-wrap bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Пройдено</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span>Текущий рубеж</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <span>Впереди</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                <span>Закрыто</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
