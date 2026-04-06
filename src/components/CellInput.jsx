import { useState, useEffect, useRef } from 'react'
import Select from 'react-select'

/**
 * CellInput — Google Sheets-style inline editable cell.
 * 
 * - Arrow Up/Down: instant vertical row navigation
 * - Enter/Tab: save + move RIGHT to the next cell in the same row
 * - Escape: cancel edit
 * - Focus: auto-select for quick typing
 * - Row Highlighting: Handled natively via CSS `:focus-within`
 */
export default function CellInput({ value, type = 'text', onChange, minWidth = 100, isSelect = false, isMulti = false, options = [], list }) {
    const [val, setVal] = useState(value || '')
    const [flashState, setFlashState] = useState('') // 'saved' | 'unsaved' | ''
    const prevValueRef = useRef(value)
    const ref = useRef(null)

    // Sync external value changes into local state
    useEffect(() => { 
        if (prevValueRef.current !== undefined && value !== prevValueRef.current) {
            // value updated from parent/server
            setTimeout(() => {
                setFlashState('saved')
                setTimeout(() => setFlashState(''), 1500)
            }, 0)
        }
        prevValueRef.current = value
        setTimeout(() => setVal(value || ''), 0)
    }, [value])

    const isUnsaved = value !== undefined && val !== (value || '')
    const currentFlashState = isUnsaved ? 'unsaved' : flashState

    function saveIfChanged() {
        if (val != (value || '')) {
            onChange(val)
        }
    }

    function focusCellInDirection(direction) {
        // Find the input element that has focus (React Select has an internal input)
        const activeEl = document.activeElement
        if (!activeEl) return false

        const tr = activeEl.closest('tr')
        if (!tr) return false

        // Get all focusable inputs in the current row
        const rowInputs = Array.from(tr.querySelectorAll('input:not([readonly]), select')).filter(el => {
            // Ignore hidden dummy inputs from react-select
            return el.type !== 'hidden' && el.tabIndex !== -1
        })

        const currentIndex = rowInputs.indexOf(activeEl)
        if (currentIndex === -1) return false

        if (direction === 'right') {
            const nextInput = rowInputs[currentIndex + 1]
            if (nextInput) {
                nextInput.focus()
                return true
            }
            return false // end of row
        }

        if (direction === 'left') {
            const prevInput = rowInputs[currentIndex - 1]
            if (prevInput) {
                prevInput.focus()
                return true
            }
            return false // start of row
        }

        // For Up/Down, we need to find the same logical input index in the adjacent row
        let targetRow = null
        if (direction === 'up') targetRow = tr.previousElementSibling
        if (direction === 'down') targetRow = tr.nextElementSibling

        if (targetRow) {
            const targetInputs = Array.from(targetRow.querySelectorAll('input:not([readonly]), select')).filter(el => el.type !== 'hidden' && el.tabIndex !== -1)
            const targetInput = targetInputs[currentIndex] || targetInputs[targetInputs.length - 1]
            if (targetInput) {
                targetInput.focus()
                return true
            }
        }

        return false
    }

    const handleFocus = (e) => {
        if (!isSelect && e.target.select) e.target.select()
    }

    const handleBlur = () => {
        saveIfChanged()
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            saveIfChanged()
            // Shift+Enter goes left, Enter goes right
            focusCellInDirection(e.shiftKey ? 'left' : 'right')
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault()
            saveIfChanged()
            focusCellInDirection('up')
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            saveIfChanged()
            focusCellInDirection('down')
        }
        if (e.key === 'Escape') {
            setVal(value || '')
            e.target.blur()
        }
    }

    if (isSelect) {
        // Convert string to array of option objects for react-select
        const currentVals = val ? val.split(',').map(s => s.trim()).filter(Boolean) : []
        const currentOptions = isMulti
            ? currentVals.map(v => options.find(o => o.value === v) || { value: v, label: v })
            : (options.find(o => o.value === val) || null)

        const customStyles = {
            control: (base) => ({
                ...base,
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                minHeight: '28px',
                cursor: 'text',
                alignItems: 'center'
            }),
            valueContainer: (base) => ({
                ...base,
                padding: '0 2px',
                flexWrap: 'wrap',
                maxHeight: 'none',
                overflowY: 'visible'
            }),
            input: (base) => ({
                ...base,
                margin: 0,
                padding: 0,
                color: 'var(--color-text)'
            }),
            singleValue: (base) => ({
                ...base,
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            }),
            multiValue: (base) => ({
                ...base,
                backgroundColor: 'rgba(99, 102, 241, 0.2)', // Indigo soft
                borderRadius: '4px',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                margin: '2px'
            }),
            multiValueLabel: (base) => ({
                ...base,
                color: 'var(--color-text)',
                fontSize: '0.75rem',
                padding: '1px 4px'
            }),
            multiValueRemove: (base) => ({
                ...base,
                color: 'var(--color-text)',
                cursor: 'pointer',
                ':hover': {
                    backgroundColor: 'var(--color-danger)',
                    color: 'white',
                },
            }),
            menu: (base) => ({
                ...base,
                backgroundColor: 'var(--color-bg-hover)',
                border: '1px solid var(--color-border)',
                zIndex: 9999,
                minWidth: '200px'
            }),
            menuPortal: base => ({ ...base, zIndex: 9999 }),
            option: (base, state) => ({
                ...base,
                backgroundColor: state.isFocused ? 'var(--color-primary)' : 'transparent',
                color: state.isFocused ? '#ffffff' : 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.85rem'
            }),
            dropdownIndicator: () => ({ display: 'none' }),
            indicatorSeparator: () => ({ display: 'none' }),
            clearIndicator: () => ({ display: 'none' })
        }

        const extraStyle = {}
        if (currentFlashState === 'saved') {
            extraStyle.background = 'rgba(52, 211, 153, 0.15)'
            extraStyle.border = '1px solid rgba(52, 211, 153, 0.5)'
        } else if (currentFlashState === 'unsaved') {
            extraStyle.background = 'rgba(251, 191, 36, 0.08)'
            extraStyle.border = '1px solid rgba(251, 191, 36, 0.4)'
        }

        return (
            <div
                className={`sheet-input elite-scrollbar ${currentFlashState}`}
                style={{ minWidth, maxWidth: minWidth, padding: 0, overflow: 'visible', ...extraStyle, transition: 'all 0.3s' }}
                onKeyDown={(e) => {
                    // Custom override to allow jumping cells with left/right arrows when nothing is typed
                    if (e.key === 'ArrowRight' && !e.target.value) {
                        e.preventDefault()
                        focusCellInDirection('right')
                    }
                    if (e.key === 'ArrowLeft' && !e.target.value) {
                        e.preventDefault()
                        focusCellInDirection('left')
                    }
                    if (e.key === 'Escape') {
                        if (document.activeElement) document.activeElement.blur()
                    }
                }}
            >
                <Select
                    isMulti={isMulti}
                    options={options}
                    value={currentOptions}
                    styles={customStyles}
                    menuPortalTarget={document.body}
                    closeMenuOnSelect={!isMulti}
                    placeholder=""
                    noOptionsMessage={() => "No encontrado"}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    onChange={(selected) => {
                        let newValue = ''
                        if (isMulti) {
                            newValue = selected ? selected.map(s => s.value).join(', ') : ''
                        } else {
                            newValue = selected ? selected.value : ''
                        }
                        setVal(newValue)
                        // Immediate save
                        onChange(newValue)
                    }}
                />
            </div>
        )
    }

    const extraStyle = {}
    if (currentFlashState === 'saved') {
        extraStyle.background = 'rgba(52, 211, 153, 0.15)'
        extraStyle.border = '1px solid rgba(52, 211, 153, 0.5)'
    } else if (currentFlashState === 'unsaved') {
        extraStyle.background = 'rgba(251, 191, 36, 0.08)'
        extraStyle.border = '1px solid rgba(251, 191, 36, 0.4)'
    }

    return (
        <input
            ref={ref}
            type={type}
            className={`sheet-input ${type === 'number' ? 'number' : ''} ${currentFlashState}`}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            style={{ minWidth, width: '100%', transition: 'all 0.3s', ...extraStyle }}
            list={list}
        />
    )
}
