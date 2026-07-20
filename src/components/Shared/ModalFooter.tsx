interface ModalFooterProps {
    onClear: () => void
    onApply: () => void
}

export default function ModalFooter({ onClear, onApply }: ModalFooterProps) {
    return (
        <div className="flex items-center justify-end gap-6 px-8 py-6 border-t border-gray-100 mt-auto bg-white">
            <button
                onClick={onClear}
                className="text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wide"
            >
                Limpar Filtros
            </button>
            <button
                onClick={onApply}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-95"
            >
                APLICAR FILTROS
            </button>
        </div>
    )
}
