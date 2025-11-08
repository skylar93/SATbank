'use client'

interface ScoreProgressProps {
  data: {
    labels: string[]
    datasets: {
      label: string
      data: number[]
      borderColor: string
      backgroundColor: string
      fill?: boolean
    }[]
  }
}

export function ModernScoreProgress({ data }: ScoreProgressProps) {
  const { labels, datasets } = data
  const primaryDataset = datasets?.[0]
  const values = primaryDataset?.data || []

  if (!primaryDataset || values.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        No data available
      </div>
    )
  }

  const numericValues = values.filter(
    (value): value is number => typeof value === 'number' && !isNaN(value)
  )

  if (numericValues.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        Invalid score data
      </div>
    )
  }

  const latestScore = numericValues[numericValues.length - 1]
  const previousScore =
    numericValues.length > 1
      ? numericValues[numericValues.length - 2]
      : numericValues[0]
  const firstScore = numericValues[0]
  const change = latestScore - previousScore
  const totalImprovement = latestScore - firstScore
  const bestScore = Math.max(...numericValues)

  const maxValue = Math.max(...numericValues)
  const minValue = Math.min(...numericValues)
  const range = maxValue - minValue || 1

  const svgWidth = 1000
  const svgHeight = 320
  const padding = 60
  const chartWidth = svgWidth - padding * 2
  const chartHeight = svgHeight - padding * 2

  const getCoordinates = (value: number, index: number, length: number) => {
    const x =
      length === 1 ? svgWidth / 2 : padding + (index / (length - 1)) * chartWidth
    const y = padding + chartHeight - ((value - minValue) / range) * chartHeight
    return { x, y }
  }

  const getLabelX = (index: number, length: number) =>
    length === 1
      ? svgWidth / 2
      : padding + (index / (length - 1 || 1)) * chartWidth

  const areaPath = () => {
    if (numericValues.length === 1) {
      const { x, y } = getCoordinates(numericValues[0], 0, 1)
      return `M ${x - 12} ${y} A 12 12 0 1 1 ${x + 12} ${y} A 12 12 0 1 1 ${x - 12} ${y} Z`
    }

    const points = numericValues
      .map((value, index) => {
        const { x, y } = getCoordinates(value, index, numericValues.length)
        return `${x},${y}`
      })
      .join(' ')

    return `M ${points.split(' ').join(' L ')} L ${
      padding + chartWidth
    } ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`
  }

  const linePath = () => {
    const points = numericValues
      .map((value, index) => {
        const { x, y } = getCoordinates(value, index, numericValues.length)
        return `${x},${y}`
      })
      .join(' ')

    return `M ${points.split(' ').join(' L ')}`
  }

  const horizontalLines = Array.from({ length: 5 }, (_, i) => {
    const value = minValue + (i / 4) * range
    const y = padding + chartHeight - (i / 4) * chartHeight
    return { value: Math.round(value), y }
  })

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full lg:w-64 rounded-2xl border border-violet-100 bg-white/80 p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Current Score
        </p>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-4xl font-bold text-gray-900">
            {latestScore}
          </span>
          <span
            className={`text-sm font-semibold ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}
          >
            {change >= 0 ? '+' : ''}
            {change}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          vs. previous test ({previousScore})
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Best Score
            </p>
            <p className="text-xl font-semibold text-gray-900">{bestScore}</p>
          </div>
          <div className="rounded-xl border border-violet-100 bg-gradient-to-r from-violet-50 to-violet-100/60 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
              Improvement
            </p>
            <p className="text-xl font-semibold text-violet-900">
              {totalImprovement >= 0 ? '+' : ''}
              {totalImprovement} points
            </p>
            <p className="text-xs text-violet-700/70">
              {numericValues.length} exams tracked
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-2xl border border-violet-100/70 bg-gradient-to-br from-white via-violet-50 to-emerald-50 p-4 shadow-inner">
        <div className="relative h-72">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <defs>
              <linearGradient id="score-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.25)" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
              </linearGradient>
              <linearGradient id="score-line" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {horizontalLines.map((line, index) => (
              <g key={index}>
                <line
                  x1={padding}
                  y1={line.y}
                  x2={padding + chartWidth}
                  y2={line.y}
                  stroke="rgba(148, 163, 184, 0.3)"
                  strokeDasharray="6 6"
                />
                <text
                  x={padding - 10}
                  y={line.y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-400"
                >
                  {line.value}
                </text>
              </g>
            ))}

            {/* Area & line */}
            <path d={areaPath()} fill="url(#score-fill)" />
            <path
              d={linePath()}
              fill="none"
              stroke="url(#score-line)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Points */}
            {numericValues.map((value, index) => {
              const { x, y } = getCoordinates(value, index, numericValues.length)
              return (
                <g key={index}>
                  <circle cx={x} cy={y} r={6} fill="#fff" stroke="#a855f7" strokeWidth={2} />
                  <text
                    x={x}
                    y={y - 12}
                    textAnchor="middle"
                    className="text-xs font-semibold fill-gray-700"
                  >
                    {value}
                  </text>
                </g>
              )
            })}

            {/* X labels */}
            {labels.map((label, index) => {
              const x = getLabelX(index, labels.length || 1)
              return (
                <text
                  key={index}
                  x={x}
                  y={svgHeight - 10}
                  textAnchor="middle"
                  className="text-xs fill-gray-400"
                >
                  {label}
                </text>
              )
            })}
          </svg>
        </div>
      </div>
    </div>
  )
}

interface StatsCardProps {
  title: string
  value: string | number
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  miniChart?: {
    data: number[]
    color: string
  }
}

export function StatsCard({
  title,
  value,
  change,
  changeType,
  miniChart,
}: StatsCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600'
      case 'negative':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive':
        return '↗'
      case 'negative':
        return '↘'
      default:
        return '→'
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <div className={`flex items-center mt-2 ${getChangeColor()}`}>
            <span className="text-sm font-medium">
              {getChangeIcon()} {change}
            </span>
          </div>
        </div>
        {miniChart && (
          <div className="w-16 h-12">
            <MiniLineChart data={miniChart.data} color={miniChart.color} />
          </div>
        )}
      </div>
    </div>
  )
}

interface MiniLineChartProps {
  data: number[]
  color: string
}

function MiniLineChart({ data, color }: MiniLineChartProps) {
  // Filter out invalid data and ensure we have valid numbers
  const validData = data.filter(
    (value) => typeof value === 'number' && !isNaN(value) && isFinite(value)
  )

  // Create a unique gradient ID to avoid conflicts
  const gradientId = `gradient-${color.replace('#', '')}-${Math.random().toString(36).substr(2, 9)}`

  // Handle edge cases
  if (validData.length === 0) {
    // No valid data - render empty chart
    return (
      <svg width="64" height="48" className="overflow-visible">
        <line
          x1="4"
          y1="24"
          x2="60"
          y2="24"
          stroke={color}
          strokeWidth="1"
          opacity="0.3"
        />
      </svg>
    )
  }

  if (validData.length === 1) {
    // Single data point - render horizontal line
    return (
      <svg width="64" height="48" className="overflow-visible">
        <line x1="4" y1="24" x2="60" y2="24" stroke={color} strokeWidth="2" />
        <circle cx="32" cy="24" r="3" fill={color} />
      </svg>
    )
  }

  const max = Math.max(...validData)
  const min = Math.min(...validData)
  const range = max - min || 1
  const padding = 4 // Add padding to prevent clipping

  const points = validData
    .map((value, index) => {
      const x = padding + (index / (validData.length - 1)) * (64 - padding * 2)
      const y = padding + (1 - (value - min) / range) * (48 - padding * 2)

      // Double-check for NaN values
      if (isNaN(x) || isNaN(y)) {
        return `${padding},24` // fallback to left center
      }

      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="64" height="48" className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M ${padding},${48 - padding} L ${points} L ${64 - padding},${48 - padding} Z`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Add dots for each data point */}
      {validData.map((value, index) => {
        const x =
          padding + (index / (validData.length - 1)) * (64 - padding * 2)
        const y = padding + (1 - (value - min) / range) * (48 - padding * 2)
        return <circle key={index} cx={x} cy={y} r="1.5" fill={color} />
      })}
    </svg>
  )
}
