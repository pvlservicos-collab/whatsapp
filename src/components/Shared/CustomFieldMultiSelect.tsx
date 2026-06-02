'use client'

import { useState, useRef, useEffect } from 'react'

interface CustomFieldMultiSelectProps {
  options: string[]
  value: string[]
  onChange: (val: string[]) => void
  placeholder?: string
}

export default function CustomFieldMultiSelect({ options, value, onChange, placeholder = 'Selecione...' }: CustomFieldMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const toggleOption = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  const displayText = value.length > 0 ? value.join(', ') : ''

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-[13px] font-medium border-b border-gray-200 pb-1 focus:outline-none focus:border-blue-500 bg-transparent text-left cursor-pointer transition-colors hover:border-blue-300 gap-1"
      >
        <span className={`truncate ${displayText ? 'text-gray-800' : 'text-gray-400'}`}>{displayText || placeholder}</span>
        <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-100 rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto ring-1 ring-black/5">
          {value.length > 0 && (
            <button
              type="button"
              className="w-full text-left px-3 py-2 text-[13px] text-gray-400 hover:bg-gray-50 transition-colors border-b border-gray-50"
              onClick={() => {
                onChange([])
              }}
            >
              Limpar seleção
            </button>
          )}

          {options.map((opt) => {
            const isSelected = value.includes(opt)
            return (
              <button
                key={opt}
                type="button"
                className={`w-full text-left px-3 py-2 text-[13px] hover:bg-gray-50 flex items-center gap-2 transition-colors ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}
                onClick={() => toggleOption(opt)}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  )}
                </div>
                <span className={isSelected ? 'font-semibold' : ''}>{opt}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
