'use client'

import { useRef } from 'react'

// [[Change HP restoration]]: replaces the old auto-rolled Sleep button with one that asks the
// player to physically roll and type in their own result -- a native window.prompt() rather than a
// custom modal, matching this codebase's existing use of window.confirm() (ConfirmButton) instead of
// building dialog UI for simple one-off inputs. Loops on an invalid entry rather than silently
// clamping client-side (the server clamps too, as a safety net, not the primary validation).
export function RollInputButton({
  promptMessage,
  min,
  max,
  fieldName,
  formAction,
  className,
  children,
}: {
  promptMessage: string
  min: number
  max: number
  fieldName: string
  formAction: (formData: FormData) => void | Promise<void>
  className?: string
  children: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    let entry = window.prompt(promptMessage)
    while (entry !== null) {
      const n = Number(entry)
      if (Number.isInteger(n) && n >= min && n <= max) {
        inputRef.current!.value = String(n)
        return
      }
      entry = window.prompt(`Enter a whole number from ${min} to ${max}:`)
    }
    e.preventDefault()
  }

  return (
    <>
      <input ref={inputRef} type="hidden" name={fieldName} />
      <button type="submit" formAction={formAction} className={className} onClick={handleClick}>
        {children}
      </button>
    </>
  )
}
