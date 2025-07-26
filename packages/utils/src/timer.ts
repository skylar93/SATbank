export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function parseTimeString(timeString: string): number {
  const parts = timeString.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    return minutes * 60 + seconds;
  }
  return 0;
}

export class Timer {
  private startTime: number = 0;
  private endTime: number = 0;
  private isRunning: boolean = false;

  start(): void {
    this.startTime = Date.now();
    this.isRunning = true;
  }

  stop(): number {
    if (this.isRunning) {
      this.endTime = Date.now();
      this.isRunning = false;
    }
    return this.getElapsed();
  }

  getElapsed(): number {
    if (this.isRunning) {
      return Date.now() - this.startTime;
    }
    return this.endTime - this.startTime;
  }

  reset(): void {
    this.startTime = 0;
    this.endTime = 0;
    this.isRunning = false;
  }
}