'use client'

import { useState, useRef, useEffect } from 'react'

interface CustomFieldSelectProps {
  options: string[]
  value: string
  onChange: (val: string) => void
  placeholder?: string
}

export default function CustomFieldSelect({ options, value, onChange, placeholder = 'Selecione...' }: CustomFieldSelectProps) {
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

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-[13px] font-medium border-b border-[#2f3b44] pb-1 focus:outline-none focus:border-[#53bdeb] bg-transparent text-left cursor-pointer transition-colors hover:border-[#53bdeb]/50"
      >
        <span className={value ? 'text-[#d1d7db]' : 'text-[#667781]'}>{value || placeholder}</span>
        <svg className={`w-3.5 h-3.5 text-[#8696a0] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-[#233138] border border-[#2f3b44] rounded-lg shadow-xl py-1 max-h-48 overflow-y-auto ring-1 ring-black/20 animate-in fade-in slide-in-from-top-1">
          <button
            type="button"
            className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#2a3942] flex items-center transition-colors ${!value ? 'bg-[#2a3942] text-[#53bdeb] font-semibold' : 'text-[#667781]'}`}
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
          >
            {placeholder}
          </button>

          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              className={`w-full text-left px-3 py-2 text-[13px] hover:bg-[#2a3942] flex items-center transition-colors ${value === opt ? 'bg-[#2a3942] text-[#53bdeb] font-semibold' : 'text-[#d1d7db]'}`}
              onClick={() => {
                onChange(opt)
                setIsOpen(false)
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
