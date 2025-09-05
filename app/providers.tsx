"use client"

import type { ReactNode } from "react"
import type { JSX } from "react/jsx-runtime"

export default function Providers({ children }: { children: ReactNode }): JSX.Element {
  return <>{children}</>
}
