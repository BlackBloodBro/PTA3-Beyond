'use client'

export function ConfirmButton({
  confirmMessage,
  className,
  children,
  formAction,
  disabled,
}: {
  confirmMessage: string
  className?: string
  children: React.ReactNode
  // Optional so this can still stand in for a plain submit button that relies on its <form>'s own
  // action (e.g. Delete), not just the "one form, multiple formAction-bound buttons" shape (e.g.
  // the trainer level +/- buttons).
  formAction?: (formData: FormData) => void | Promise<void>
  disabled?: boolean
}) {
  return (
    <button
      type="submit"
      className={className}
      formAction={formAction}
      disabled={disabled}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault()
        }
      }}
    >
      {children}
    </button>
  )
}
