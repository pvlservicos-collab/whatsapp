'use client'

import { useState, useRef, useEffect } from 'react'
import { PipelineStage, LeadStageHistory, Pipeline } from '@/lib/types'

interface FunnelMiniMapProps {
  stages: PipelineStage[]
  currentStageId: string
  history: LeadStageHistory[]
  loading?: boolean
  onStageClick?: (stageId: string) => void
  pipelines?: Pipeline[]
  currentPipelineId?: string
  onPipelineChange?: (pipelineId: string) => void
}

const BLUE = '#115AF8'

export default function FunnelMiniMap({
  stages,
  currentStageId,
  history,
  loading,
  onStageClick,
  pipelines,
  currentPipelineId,
  onPipelineChange,
}: FunnelMiniMapProps) {
  const [showPipelineMenu, setShowPipelineMenu] = useState(false)
  const pipelineMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showPipelineMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (pipelineMenuRef.current && !pipelineMenuRef.current.contains(e.target as Node)) {
        setShowPipelineMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPipelineMenu])

  const hasPipelineSwitch = pipelines && pipelines.length > 1 && onPipelineChange
  const currentPipeline = pipelines?.find(p => p.id === currentPipelineId)

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-200" />
            <div className="h-3 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  const sortedStages = [...stages].sort((a, b) => Number(a.rank) - Number(b.rank))
  const currentIdx = sortedStages.findIndex((s) => s.id === currentStageId)

  if (sortedStages.length === 0 || currentIdx === -1) {
    return null
  }

  return (
    <div>
      <div className="relative mb-3" ref={pipelineMenuRef}>
        {hasPipelineSwitch ? (
          <button
            onClick={() => setShowPipelineMenu(!showPipelineMenu)}
            className="flex items-center gap-1.5 cursor-pointer group"
            title="Trocar funil"
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 group-hover:text-blue-500 transition-colors">
              Funil de Vendas
            </p>
            <span className="text-[10px] font-bold text-blue-500 group-hover:text-blue-700 transition-colors">▾</span>
          </button>
        ) : (
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Funil de Vendas
          </p>
        )}
        {currentPipeline && (
          <p
            className={`text-[11px] font-medium mt-0.5 ${hasPipelineSwitch ? 'text-blue-600 cursor-pointer hover:text-blue-700 transition-colors' : 'text-gray-500'}`}
            onClick={hasPipelineSwitch ? () => setShowPipelineMenu(!showPipelineMenu) : undefined}
          >
            {currentPipeline.name}
          </p>
        )}

        {showPipelineMenu && hasPipelineSwitch && (
          <div className="absolute z-50 left-0 top-full mt-1 w-48 bg-white border border-gray-100 rounded-lg shadow-xl py-1 ring-1 ring-black/5">
            {pipelines.map(pipeline => (
              <button
                key={pipeline.id}
                onClick={() => {
                  if (pipeline.id !== currentPipelineId) {
                    onPipelineChange(pipeline.id)
                  }
                  setShowPipelineMenu(false)
                }}
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 transition-colors flex items-center gap-2 ${pipeline.id === currentPipelineId
                  ? 'text-blue-700 font-semibold bg-blue-50/50'
                  : 'text-gray-700'
                  }`}
              >
                {pipeline.id === currentPipelineId && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0" />
                )}
                {pipeline.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes radar-ping {
          0%   { transform: scale(1); opacity: 0.55; }
          75%  { transform: scale(3); opacity: 0; }
          100% { transform: scale(3); opacity: 0; }
        }
        .funnel-row {
          border-radius: 6px;
          margin-left: -6px;
          padding-left: 6px;
          margin-right: -6px;
          padding-right: 6px;
        }
        .funnel-clickable {
          cursor: pointer;
          transition: transform 0.15s ease, background-color 0.15s ease;
        }
        .funnel-clickable:hover {
          transform: translateX(3px);
          background-color: #F6F9FF;
        }
        .funnel-clickable:active {
          transform: translateX(1px) scale(0.98);
        }
      `}</style>

      <div className="relative">
        {sortedStages.map((stage, idx) => {
          const isPast = idx < currentIdx
          const isCurrent = idx === currentIdx
          const isLast = idx === sortedStages.length - 1
          const isActive = isPast || isCurrent
          const isClickable = !isCurrent && !!onStageClick

          const DOT_COL = 14  // fixed column width for all dots
          const DOT_SIZE = isCurrent ? 12 : 8
          const COL_CENTER = DOT_COL / 2

          return (
            <div
              key={stage.id}
              className={`flex items-center gap-2.5 relative funnel-row ${isClickable ? 'funnel-clickable' : ''}`}
              style={{ height: 30 }}
              onClick={isClickable ? () => onStageClick(stage.id) : undefined}
            >
              {/* Dot column — fixed width, dots & line centered inside */}
              <div
                className="relative flex-shrink-0 z-10 flex items-center justify-center"
                style={{ width: DOT_COL, height: DOT_COL }}
              >
                {/* Vertical connector line — precisely centered under the dot */}
                {!isLast && (
                  <div
                    className="absolute"
                    style={{
                      left: '50%',
                      top: '100%',
                      transform: 'translateX(-50%)',
                      width: 1.5,
                      height: 16, // Connects exactly to the top of the next dot container
                      backgroundColor: isActive ? `${BLUE}40` : '#E5E7EB',
                      transition: 'background-color 0.3s ease',
                    }}
                  />
                )}

                {isCurrent ? (
                  <>
                    {/* Radar pulse ring */}
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        backgroundColor: BLUE,
                        animation: 'radar-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                      }}
                    />
                    {/* Outlined current dot */}
                    <div
                      className="absolute rounded-full bg-white"
                      style={{
                        width: DOT_SIZE,
                        height: DOT_SIZE,
                        border: `2.5px solid ${BLUE}`,
                        transition: 'border-color 0.3s ease',
                      }}
                    />
                  </>
                ) : isPast ? (
                  <div
                    className="rounded-full"
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      backgroundColor: BLUE,
                      transition: 'background-color 0.3s ease',
                    }}
                  />
                ) : (
                  <div
                    className="rounded-full bg-white"
                    style={{
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      border: '1.5px solid #D1D5DB',
                      transition: 'border-color 0.3s ease, background-color 0.3s ease',
                    }}
                  />
                )}
              </div>

              {/* Stage label */}
              <p
                className={`text-[13px] leading-none select-none ${isCurrent
                  ? 'font-bold'
                  : isPast
                    ? 'font-medium text-gray-700'
                    : 'font-normal text-gray-400'
                  }`}
                style={{
                  color: isCurrent ? BLUE : undefined,
                  transition: 'color 0.3s ease',
                }}
              >
                {stage.name}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

