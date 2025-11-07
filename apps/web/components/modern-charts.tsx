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

  // Handle empty or invalid data
  if (
    !datasets ||
    datasets.length === 0 ||
    datasets.every((d) => !d.data || d.data.length === 0)
  ) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p>No data available</p>
        </div>
      </div>
    )
  }

  const allDataPoints = datasets
    .flatMap((d) => d.data)
    .filter((v) => typeof v === 'number' && !isNaN(v))
  if (allDataPoints.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <p>Invalid data</p>
        </div>
      </div>
    )
  }

  const maxValue = Math.max(...allDataPoints)
  const minValue = Math.min(...allDataPoints)
  const range = maxValue - minValue || 1

  const svgWidth = 800
  const svgHeight = 320
  const padding = 40
  const chartWidth = svgWidth - padding * 2
  const chartHeight = svgHeight - padding * 2

  const getPath = (dataPoints: number[]) => {
    const points = dataPoints
      .map((value, index) => {
        const x =
          dataPoints.length === 1
            ? svgWidth / 2
            : padding + (index / (dataPoints.length - 1)) * chartWidth
        const y =
          padding + chartHeight - ((value - minValue) / range) * chartHeight
        return `${x},${y}`
      })
      .join(' ')

    return `M ${points.split(' ').join(' L ')}`
  }

  const getAreaPath = (dataPoints: number[]) => {
    const topPath = getPath(dataPoints)
    if (dataPoints.length === 1) {
      // For single data point, create a simple circle area
      const x = svgWidth / 2
      const y =
        padding +
        chartHeight -
        ((dataPoints[0] - minValue) / range) * chartHeight
      return `M ${x - 10} ${y} A 10 10 0 1 1 ${x + 10} ${y} A 10 10 0 1 1 ${x - 10} ${y} Z`
    }
    const bottomPath = `L ${padding + chartWidth} ${padding + chartHeight} L ${padding} ${padding + chartHeight} Z`
    return topPath + bottomPath
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full">
      <div className="flex-1 min-w-0">
        <svg
          className="w-full h-80 overflow-visible"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
        <defs>
          {datasets.map((dataset, index) => (
            <linearGradient
              key={index}
              id={`gradient-${index}`}
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop
                offset="0%"
                stopColor={dataset.borderColor}
                stopOpacity="0.2"
              />
              <stop
                offset="100%"
                stopColor={dataset.borderColor}
                stopOpacity="0.05"
              />
            </linearGradient>
          ))}
        </defs>

        {/* Data lines and areas */}
        {datasets.map((dataset, index) => (
          <g key={index}>
            {/* Area fill */}
            <path
              d={getAreaPath(dataset.data)}
              fill={`url(#gradient-${index})`}
            />
            {/* Line */}
            <path
              d={getPath(dataset.data)}
              fill="none"
              stroke={dataset.borderColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Points */}
            {dataset.data.map((value, pointIndex) => {
              const x =
                dataset.data.length === 1
                  ? svgWidth / 2
                  : padding +
                    (pointIndex / (dataset.data.length - 1)) * chartWidth
              const y =
                padding +
                chartHeight -
                ((value - minValue) / range) * chartHeight
              return (
                <circle
                  key={pointIndex}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="white"
                  stroke={dataset.borderColor}
                  strokeWidth="2"
                />
              )
            })}
          </g>
        ))}

        {/* X-axis labels */}
        {labels.map((label, index) => {
          const x =
            labels.length === 1
              ? svgWidth / 2
              : padding + (index / (labels.length - 1)) * chartWidth
          return (
            <text
              key={index}
              x={x}
              y={svgHeight - 10}
              textAnchor="middle"
              fontSize="12"
              fill="#9ca3af"
            >
              {label}
            </text>
          )
        })}

        {/* Y-axis labels */}
        {Array.from({ length: 5 }, (_, i) => {
          const value = minValue + (i / 4) * range
          const y = padding + chartHeight - (i / 4) * chartHeight
          return (
            <text
              key={i}
              x={padding - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fill="#9ca3af"
            >
              {Math.round(value)}
            </text>
          )
        })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-row flex-wrap items-center gap-4 xl:flex-col xl:min-w-[180px]">
        {datasets.map((dataset, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: dataset.borderColor }}
            />
            <span className="text-sm font-medium text-gray-600">
              {dataset.label}
            </span>
          </div>
        ))}
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
