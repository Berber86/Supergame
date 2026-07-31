import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface TabOption<T extends string> {
  id: T
  label: string
  icon?: ReactNode
}

interface TabsProps<T extends string> {
  value: T
  options: TabOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
  idBase?: string
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
  idBase,
}: TabsProps<T>) {
  const generatedId = useId().replace(/:/g, '')
  const base = idBase ?? `tabs-${generatedId}`
  const buttonRefs = useRef(new Map<T, HTMLButtonElement>())

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let nextIndex: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % options.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + options.length) % options.length
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = options.length - 1
    else return
    event.preventDefault()
    const next = options[nextIndex]
    onChange(next.id)
    buttonRefs.current.get(next.id)?.focus()
  }

  return (
    <div className={className} role="tablist" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <button
          key={option.id}
          ref={(element) => {
            if (element) buttonRefs.current.set(option.id, element)
            else buttonRefs.current.delete(option.id)
          }}
          id={`${base}-tab-${option.id}`}
          role="tab"
          aria-selected={value === option.id}
          aria-controls={`${base}-panel`}
          tabIndex={value === option.id ? 0 : -1}
          className={value === option.id ? 'active' : ''}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => moveFocus(event, index)}
        >
          {option.icon}
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

interface TabPanelProps {
  idBase: string
  tabId: string
  children: ReactNode
  className?: string
}

export function TabPanel({ idBase, tabId, children, className = '' }: TabPanelProps) {
  return (
    <div
      id={`${idBase}-panel`}
      role="tabpanel"
      aria-labelledby={`${idBase}-tab-${tabId}`}
      className={className}
      tabIndex={0}
    >
      {children}
    </div>
  )
}
