import React, { useState, useEffect } from 'react';

export interface TimerProps {
  initialTime: number; // in seconds
  onTimeUp?: () => void;
  onTick?: (remainingTime: number) => void;
}

export const Timer: React.FC<TimerProps> = ({ initialTime, onTimeUp, onTick }) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          const newTime = time - 1;
          onTick?.(newTime);
          if (newTime === 0) {
            onTimeUp?.();
            setIsActive(false);
          }
          return newTime;
        });
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, onTimeUp, onTick]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="timer">
      <div className="timer-display">{formatTime(timeLeft)}</div>
      <div className="timer-controls">
        <button onClick={() => setIsActive(!isActive)}>
          {isActive ? 'Pause' : 'Start'}
        </button>
        <button onClick={() => { setTimeLeft(initialTime); setIsActive(false); }}>
          Reset
        </button>
      </div>
    </div>
  );
};