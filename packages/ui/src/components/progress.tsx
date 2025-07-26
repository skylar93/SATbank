import React from 'react';

export interface ProgressProps {
  value: number; // 0-100
  max?: number;
  className?: string;
  showLabel?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({ 
  value, 
  max = 100, 
  className = '', 
  showLabel = true 
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`progress ${className}`}>
      <div className="progress-bar" style={{ width: `${percentage}%` }} />
      {showLabel && (
        <span className="progress-label">{Math.round(percentage)}%</span>
      )}
    </div>
  );
};

export interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 40,
  strokeWidth = 4,
  className = ''
}) => {
  const percentage = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`circular-progress ${className}`}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="progress-ring-background"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="progress-ring-progress"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
    </div>
  );
};