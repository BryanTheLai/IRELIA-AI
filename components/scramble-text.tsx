"use client"

import { useEffect, useState, useRef } from "react"

interface ScrambleTextProps {
  text: string
  className?: string
}

const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()"

export function ScrambleText({ text, className = "" }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isScrambling, setIsScrambling] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Keep internal displayText in sync when the parent changes the `text` prop.
  // Don't override while an active scramble animation is running.
  useEffect(() => {
    if (!isScrambling) setDisplayText(text)
  }, [text, isScrambling])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const scramble = () => {
    if (isScrambling) return

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    setIsScrambling(true)
    let iterations = 0
    const maxIterations = text.length

    intervalRef.current = setInterval(() => {
      setDisplayText(
        text
          .split("")
          .map((char, index) => {
            if (index < iterations) {
              return text[index]
            }
            return chars[Math.floor(Math.random() * chars.length)]
          })
          .join(""),
      )

      iterations += 1 / 3

      if (iterations >= maxIterations) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        setDisplayText(text)
        setIsScrambling(false)
      }
    }, 30)
  }

  return (
    <span className={`font-mono cursor-pointer ${className}`} onMouseEnter={scramble}>
      {displayText}
    </span>
  )
}
