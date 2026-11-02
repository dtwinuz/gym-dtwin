import { useState } from 'react'
import { parseNum } from '../../app/session'

interface Props {
  value: number | undefined
  onChange: (v: number | undefined) => void
  label: string
  placeholder?: string
  integer?: boolean
  disabled?: boolean
}

/** A number field that keeps what is being typed and takes a comma as a decimal point. */
export default function NumInput({ value, onChange, label, placeholder, integer, disabled }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value == null ? '' : String(value))
  return (
    <input
      className="num" type="text" inputMode={integer ? 'numeric' : 'decimal'} autoComplete="off" value={shown} aria-label={label} placeholder={placeholder} disabled={disabled}
      onFocus={e => { setDraft(shown); e.target.select() }}
      onBlur={() => setDraft(null)}
      onChange={e => {
        const text = e.target.value
        if (!/^[\d.,]*$/.test(text)) return
        setDraft(text)
        onChange(parseNum(text, integer))
      }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
    />
  )
}
