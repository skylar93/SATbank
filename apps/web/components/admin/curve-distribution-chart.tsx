"use client"

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface CurvePoint {
  raw: number
  lower: number
  upper: number
}

interface CurveDistributionChartProps {
  curveName: string
  curveData: CurvePoint[]
  type?: 'line' | 'bar'
  height?: number
}

export function CurveDistributionChart({ 
  curveName, 
  curveData, 
  type = 'line',
  height = 500 
}: CurveDistributionChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('table')

  if (!curveData || curveData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No curve data available</p>
      </div>
    )
  }

  // Transform data for chart
  const chartData = curveData.map(point => ({
    raw: point.raw,
    average: Math.round((point.lower + point.upper) / 2),
    lower: point.lower,
    upper: point.upper,
    range: point.upper - point.lower
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{`Raw Score: ${label}`}</p>
          <p className="text-blue-600">{`Scaled: ${data.lower} - ${data.upper}`}</p>
          <p className="text-purple-600">{`Average: ${data.average}`}</p>
          <p className="text-gray-600">{`Range: ±${Math.round(data.range/2)}`}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-white rounded-lg p-4 border">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{curveName}</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'chart'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Table
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-2">
          <span>Raw Score Range: {Math.min(...curveData.map(p => p.raw))} - {Math.max(...curveData.map(p => p.raw))}</span>
          <span>Scaled Score Range: {Math.min(...curveData.map(p => p.lower))} - {Math.max(...curveData.map(p => p.upper))}</span>
        </div>
      </div>
      
      {viewMode === 'chart' ? (
        <ResponsiveContainer width="100%" height={height}>
          {type === 'line' ? (
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="raw" 
                label={{ value: 'Raw Score', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Scaled Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="average" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                type="monotone" 
                dataKey="lower" 
                stroke="#94a3b8" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="upper" 
                stroke="#94a3b8" 
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="raw" 
                label={{ value: 'Raw Score', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Scaled Score', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="average" 
                fill="#8b5cf6"
                radius={[2, 2, 0, 0]}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      ) : (
        <div className="border rounded-lg overflow-hidden" style={{ height }}>
          <div className="overflow-auto h-full">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-900 border-b">Raw Score</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900 border-b">Scaled Range</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900 border-b">Average</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-900 border-b">Range</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {chartData.map((point, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {point.raw}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <span className="inline-flex items-center space-x-1">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {point.lower}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {point.upper}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                        {point.average}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      ±{Math.round(point.range / 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="bg-purple-50 p-3 rounded">
          <div className="font-medium text-purple-900">Difficulty</div>
          <div className="text-purple-700">
            {(() => {
              const avgSlope = chartData.reduce((acc, curr, i, arr) => {
                if (i === 0) return acc
                return acc + ((curr.average - arr[i-1].average) / (curr.raw - arr[i-1].raw))
              }, 0) / (chartData.length - 1)
              return avgSlope > 7 ? 'Easy' : avgSlope > 5 ? 'Medium' : 'Hard'
            })()}
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded">
          <div className="font-medium text-blue-900">Avg Range</div>
          <div className="text-blue-700">
            ±{Math.round(chartData.reduce((acc, curr) => acc + curr.range, 0) / chartData.length / 2)}
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <div className="font-medium text-green-900">Points</div>
          <div className="text-green-700">{chartData.length}</div>
        </div>
        <div className="bg-orange-50 p-3 rounded">
          <div className="font-medium text-orange-900">Scale Type</div>
          <div className="text-orange-700">
            {Math.max(...curveData.map(p => p.upper)) <= 800 ? 'Section' : 'Total'}
          </div>
        </div>
      </div>
    </div>
  )
}