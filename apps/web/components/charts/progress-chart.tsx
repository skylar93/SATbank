'use client'

import { useMemo } from 'react'

interface DataPoint {
  label: string
  value: number
  date?: string
}

interface ProgressChartProps {
  data: DataPoint[]
  title: string
  type?: 'line' | 'bar'
  color?: string
  height?: number
}

export function ProgressChart({ 
  data, 
  title, 
  type = 'line', 
  color = '#3B82F6',
  height = 200 
}: ProgressChartProps) {
  const { maxValue, minValue, chartData } = useMemo(() => {
    if (data.length === 0) return { maxValue: 0, minValue: 0, chartData: [] }
    
    const values = data.map(d => d.value)
    const max = Math.max(...values)
    const min = Math.min(...values)
    
    // Add some padding to the range
    const range = max - min
    const padding = range * 0.1
    const maxVal = max + padding
    const minVal = Math.max(0, min - padding)
    
    // Calculate positions for visualization
    const chartHeight = height - 40 // Leave space for labels
    const chartWidth = 100 // Percentage width per point
    
    const processedData = data.map((point, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 90 + 5 // 5% margin on each side
      const y = maxVal > minVal 
        ? ((maxVal - point.value) / (maxVal - minVal)) * chartHeight + 20
        : chartHeight / 2
      
      return {
        ...point,
        x,
        y,
        normalizedValue: maxVal > minVal ? (point.value - minVal) / (maxVal - minVal) : 0.5
      }
    })
    
    return {
      maxValue: maxVal,
      minValue: minVal,
      chartData: processedData
    }
  }, [data, height])

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          No data available
        </div>
      </div>
    )
  }

  const formatValue = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
    return value.toString()
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      
      {/* Chart Container */}
      <div className="relative" style={{ height: `${height}px` }}>
        <svg 
          width="100%" 
          height={height}
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          
          {type === 'line' ? (
            <>
              {/* Line path */}
              <path
                d={`M ${chartData.map(d => `${d.x},${d.y}`).join(' L ')}`}
                fill="none"
                stroke={color}
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              
              {/* Data points */}
              {chartData.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r="3"
                  fill={color}
                  className="drop-shadow-sm hover:r-4 transition-all cursor-pointer"
                >
                  <title>{`${point.label}: ${point.value}`}</title>
                </circle>
              ))}
              
              {/* Fill area under line */}
              <path
                d={`M ${chartData[0]?.x},${height - 20} L ${chartData.map(d => `${d.x},${d.y}`).join(' L ')} L ${chartData[chartData.length - 1]?.x},${height - 20} Z`}
                fill={color}
                fillOpacity="0.1"
              />
            </>
          ) : (
            /* Bar chart */
            chartData.map((point, index) => {
              const barWidth = 80 / chartData.length
              const barHeight = point.normalizedValue * (height - 40)
              const barX = point.x - barWidth / 2
              const barY = height - 20 - barHeight
              
              return (
                <rect
                  key={index}
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  fillOpacity="0.8"
                  className="hover:fill-opacity-100 transition-all cursor-pointer"
                >
                  <title>{`${point.label}: ${point.value}`}</title>
                </rect>
              )
            })
          )}
        </svg>
        
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 py-5">
          <span>{formatValue(maxValue)}</span>
          <span>{formatValue((maxValue + minValue) / 2)}</span>
          <span>{formatValue(minValue)}</span>
        </div>
        
        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-gray-500 px-2">
          {chartData.map((point, index) => (
            <span 
              key={index} 
              className="truncate max-w-16"
              style={{ 
                position: 'absolute',
                left: `${point.x}%`,
                transform: 'translateX(-50%)'
              }}
            >
              {point.label}
            </span>
          ))}
        </div>
      </div>
      
      {/* Legend/Summary */}
      <div className="mt-4 flex justify-between text-sm text-gray-600">
        <span>
          {data.length} data points
        </span>
        <span>
          Range: {formatValue(minValue)} - {formatValue(maxValue)}
        </span>
      </div>
    </div>
  )
}