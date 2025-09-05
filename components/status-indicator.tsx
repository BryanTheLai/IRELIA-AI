interface StatusIndicatorProps {
  status: "online" | "offline" | "connecting" | "error"
  label: string
}

export function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const getStatusColor = () => {
    switch (status) {
      case "online":
        return "bg-green-500"
      case "connecting":
        return "bg-yellow-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs font-mono">
      <div className={`w-2 h-2 rounded-full ${getStatusColor()} animate-pulse`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  )
}
