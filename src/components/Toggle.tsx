interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  className?: string
}

export function Toggle({ checked, onChange, label, className = '' }: ToggleProps) {
  return (
    <button
      type="button"
      className={`toggle-control ${checked ? 'active' : ''} ${className}`.trim()}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <i aria-hidden="true" />
    </button>
  )
}
