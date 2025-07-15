'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
)

interface ProgressChartProps {
  data: {
    labels: string[]
    scores: number[]
  }
}

export function ProgressChart({ data }: ProgressChartProps) {
  const maxScore = Math.max(...data.scores)
  const minScore = Math.min(...data.scores)
  const latestScore = data.scores[data.scores.length - 1]
  const improvement = data.scores.length > 1 ? latestScore - data.scores[data.scores.length - 2] : 0
  
  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">Latest Score</p>
          <p className="text-2xl font-bold text-gray-900">{latestScore}</p>
          <p className={`text-sm font-medium ${improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {improvement >= 0 ? '+' : ''}{improvement} from last test
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 mb-1">Best Score</p>
          <p className="text-xl font-bold text-violet-600">{maxScore}</p>
        </div>
      </div>

      {/* Clean Line Chart */}
      <div className="relative h-64 bg-gray-50 rounded-2xl p-6">
        
        <svg className="w-full h-full" viewBox="0 0 400 200">
          <defs>
            <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(139, 92, 246, 0.2)" />
              <stop offset="100%" stopColor="rgba(139, 92, 246, 0.02)" />
            </linearGradient>
          </defs>
          
          {/* Grid lines */}
          {[50, 100, 150].map((y) => (
            <line
              key={y}
              x1="50"
              y1={y}
              x2="350"
              y2={y}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          
          {/* Score line and area */}
          {data.scores.length > 1 && (
            <>
              <path
                d={`M 50 ${175 - ((data.scores[0] - 1000) / 600) * 125} ${data.scores.map((score, index) => 
                  `L ${50 + (index / (data.scores.length - 1)) * 300} ${175 - ((score - 1000) / 600) * 125}`
                ).join(' ')} L ${50 + ((data.scores.length - 1) / (data.scores.length - 1)) * 300} 175 L 50 175 Z`}
                fill="url(#scoreGradient)"
              />
              <path
                d={`M 50 ${175 - ((data.scores[0] - 1000) / 600) * 125} ${data.scores.map((score, index) => 
                  `L ${50 + (index / (data.scores.length - 1)) * 300} ${175 - ((score - 1000) / 600) * 125}`
                ).join(' ')}`}
                fill="none"
                stroke="rgb(139, 92, 246)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
          
          {/* Score points */}
          {data.scores.map((score, index) => (
            <circle
              key={index}
              cx={50 + (index / (data.scores.length - 1)) * 300}
              cy={175 - ((score - 1000) / 600) * 125}
              r="4"
              fill="white"
              stroke="rgb(139, 92, 246)"
              strokeWidth="2"
            />
          ))}
          
          {/* Y-axis labels */}
          {[1000, 1200, 1400, 1600].map((score) => (
            <text
              key={score}
              x="40"
              y={180 - ((score - 1000) / 600) * 125}
              textAnchor="end"
              fontSize="12"
              fill="rgb(107, 114, 128)"
            >
              {score}
            </text>
          ))}
          
          {/* X-axis labels */}
          {data.labels.map((label, index) => (
            <text
              key={index}
              x={50 + (index / (data.scores.length - 1)) * 300}
              y="195"
              textAnchor="middle"
              fontSize="12"
              fill="rgb(107, 114, 128)"
            >
              {label}
            </text>
          ))}
        </svg>
      </div>

      {/* Progress Insights */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs text-gray-600 mb-1">Improvement</p>
          <p className={`text-lg font-bold ${latestScore - data.scores[0] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {latestScore - data.scores[0] >= 0 ? '+' : ''}{latestScore - data.scores[0]}
          </p>
        </div>
        <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs text-gray-600 mb-1">Tests Taken</p>
          <p className="text-lg font-bold text-gray-900">{data.scores.length}</p>
        </div>
        <div className="text-center p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs text-gray-600 mb-1">To Goal</p>
          <p className="text-lg font-bold text-violet-600">{1600 - latestScore}</p>
        </div>
      </div>
    </div>
  )
}

interface SubjectPerformanceProps {
  data: {
    reading: number
    writing: number
    math: number
  }
}

export function SubjectPerformanceChart({ data }: SubjectPerformanceProps) {
  const totalScore = data.reading + data.writing + data.math
  const readingWritingPercentage = ((data.reading + data.writing) / 800) * 100
  const mathPercentage = (data.math / 800) * 100

  return (
    <div className="relative">
      {/* Custom Circular Progress */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative">
          <svg width="160" height="160" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="rgba(243, 244, 246, 1)"
              strokeWidth="12"
            />
            {/* Reading & Writing arc */}
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="url(#gradient1)"
              strokeWidth="12"
              strokeDasharray={`${(readingWritingPercentage / 100) * 439.8} 439.8`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            {/* Math arc */}
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="url(#gradient2)"
              strokeWidth="12"
              strokeDasharray={`${(mathPercentage / 100) * 439.8} 439.8`}
              strokeDashoffset={`-${(readingWritingPercentage / 100) * 439.8}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
            {/* Gradient definitions */}
            <defs>
              <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
              <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-900">{totalScore}</div>
            <div className="text-sm text-gray-500">Total Score</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"></div>
            <span className="text-sm font-medium text-gray-700">Reading & Writing</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{data.reading + data.writing}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-700"></div>
            <span className="text-sm font-medium text-gray-700">Math</span>
          </div>
          <span className="text-sm font-bold text-gray-900">{data.math}</span>
        </div>
      </div>
    </div>
  )
}

interface WeeklyActivityProps {
  data: {
    days: string[]
    studyTime: number[]
    practiceTests: number[]
  }
}

export function WeeklyActivityChart({ data }: WeeklyActivityProps) {
  const maxValue = Math.max(...data.studyTime, ...data.practiceTests)

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center justify-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-violet-500 to-purple-500"></div>
          <span className="text-sm font-medium text-gray-600">Study Hours</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-rose-500"></div>
          <span className="text-sm font-medium text-gray-600">Practice Tests</span>
        </div>
      </div>

      {/* Custom Bar Chart */}
      <div className="space-y-4">
        {data.days.map((day, index) => (
          <div key={day} className="flex items-center space-x-4">
            <div className="w-8 text-sm font-medium text-gray-600">{day}</div>
            
            {/* Study Time Bar */}
            <div className="flex-1 flex items-center space-x-3">
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(data.studyTime[index] / (maxValue || 1)) * 100}%` }}
                />
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 text-right">
                {data.studyTime[index]}h
              </div>
            </div>
            
            {/* Practice Tests Bar */}
            <div className="flex-1 flex items-center space-x-3">
              <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${(data.practiceTests[index] / (maxValue || 1)) * 100}%` }}
                />
              </div>
              <div className="w-12 text-sm font-medium text-gray-900 text-right">
                {data.practiceTests[index]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="pt-4 border-t border-gray-100">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.studyTime.reduce((a, b) => a + b, 0)}h
            </div>
            <div className="text-sm text-gray-600">Total Study Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.practiceTests.reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Tests</div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface CircularProgressProps {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
}

export function CircularProgress({ 
  percentage, 
  size = 120, 
  strokeWidth = 8, 
  color = 'rgb(139, 92, 246)' 
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(229, 231, 235, 1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dasharray 0.6s ease-in-out',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{Math.round(percentage)}%</span>
      </div>
    </div>
  )
}