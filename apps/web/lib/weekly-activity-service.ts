import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export interface WeeklyActivityData {
  days: string[]
  studyTime: number[]
  practiceTests: number[]
}

export class WeeklyActivityService {
  static async fetchWeeklyActivityData(
    userId: string
  ): Promise<WeeklyActivityData> {
    try {
      // Get last 7 days of test attempts
      const last7Days = this.getLast7Days()
      const supabase = createClientComponentClient()

      const { data: attempts, error } = await supabase
        .from('test_attempts')
        .select('started_at, completed_at, status')
        .eq('user_id', userId)
        .gte('started_at', last7Days.toISOString())
        .order('started_at', { ascending: true })

      if (error) {
        return this.getEmptyWeeklyData()
      }

      // Initialize weekly stats for each day
      const weeklyStats: {
        [key: string]: { studyTime: number; practiceTests: number }
      } = {
        Sun: { studyTime: 0, practiceTests: 0 },
        Mon: { studyTime: 0, practiceTests: 0 },
        Tue: { studyTime: 0, practiceTests: 0 },
        Wed: { studyTime: 0, practiceTests: 0 },
        Thu: { studyTime: 0, practiceTests: 0 },
        Fri: { studyTime: 0, practiceTests: 0 },
        Sat: { studyTime: 0, practiceTests: 0 },
      }

      // Process each attempt
      attempts?.forEach((attempt) => {
        const dayOfWeek = this.getDayOfWeek(attempt.started_at)

        // Only count completed exams
        if (attempt.status === 'completed' && attempt.completed_at) {
          weeklyStats[dayOfWeek].practiceTests++

          // Calculate study time in hours (exam duration)
          const duration = this.calculateDurationInHours(
            attempt.started_at,
            attempt.completed_at
          )
          weeklyStats[dayOfWeek].studyTime += duration
        }
      })

      return {
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        studyTime: [
          Math.round(weeklyStats.Mon.studyTime),
          Math.round(weeklyStats.Tue.studyTime),
          Math.round(weeklyStats.Wed.studyTime),
          Math.round(weeklyStats.Thu.studyTime),
          Math.round(weeklyStats.Fri.studyTime),
          Math.round(weeklyStats.Sat.studyTime),
          Math.round(weeklyStats.Sun.studyTime),
        ],
        practiceTests: [
          weeklyStats.Mon.practiceTests,
          weeklyStats.Tue.practiceTests,
          weeklyStats.Wed.practiceTests,
          weeklyStats.Thu.practiceTests,
          weeklyStats.Fri.practiceTests,
          weeklyStats.Sat.practiceTests,
          weeklyStats.Sun.practiceTests,
        ],
      }
    } catch (error) {
      return this.getEmptyWeeklyData()
    }
  }

  private static getDayOfWeek(dateString: string): string {
    const date = new Date(dateString)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days[date.getDay()]
  }

  private static calculateDurationInHours(
    startTime: string,
    endTime: string
  ): number {
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    const durationInMs = end - start
    return durationInMs / (1000 * 60 * 60) // Convert to hours
  }

  private static getLast7Days(): Date {
    const date = new Date()
    date.setDate(date.getDate() - 7)
    date.setHours(0, 0, 0, 0) // Set to beginning of day
    return date
  }

  private static getEmptyWeeklyData(): WeeklyActivityData {
    return {
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      studyTime: [0, 0, 0, 0, 0, 0, 0],
      practiceTests: [0, 0, 0, 0, 0, 0, 0],
    }
  }
}
