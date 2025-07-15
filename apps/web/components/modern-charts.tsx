'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

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
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context: any) {
            return `${context.dataset.label}: ${context.parsed.y}`
          }
        }
      }
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12
          }
        },
        border: {
          display: false
        }
      },
      y: {
        display: true,
        grid: {
          color: '#f3f4f6',
          drawBorder: false
        },
        ticks: {
          color: '#9ca3af',
          font: {
            size: 12
          },
          callback: function(value: any) {
            return value
          }
        },
        border: {
          display: false
        }
      }
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 3
      },
      point: {
        radius: 0,
        hoverRadius: 6,
        hoverBorderWidth: 2,
        hoverBorderColor: '#fff'
      }
    }
  }

  return (
    <div className="h-80">
      <Line data={data} options={options} />
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

export function StatsCard({ title, value, change, changeType, miniChart }: StatsCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive': return 'text-green-600'
      case 'negative': return 'text-red-600'
      default: return 'text-gray-500'
    }
  }

  const getChangeIcon = () => {
    switch (changeType) {
      case 'positive': return '↗'
      case 'negative': return '↘'
      default: return '→'
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <div className={`flex items-center mt-2 ${getChangeColor()}`}>
            <span className="text-sm font-medium">{getChangeIcon()} {change}</span>
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
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 64
    const y = 48 - ((value - min) / range) * 48
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width="64" height="48" className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M 0,48 L ${points} L 64,48 Z`}
        fill={`url(#gradient-${color})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}