"use client"

import type { ReactNode } from "react"
import type { JSX } from "react/jsx-runtime"
import { Toaster } from "@/components/ui/toaster"

export default function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      {children}
      <Toaster />
    </>
  )
}
