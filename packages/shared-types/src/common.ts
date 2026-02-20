export interface BaseEntity {
  id: string
  created_at: string
  updated_at: string
}

export type ModuleType = 'english1' | 'english2' | 'math1' | 'math2' | 'tcf_reading'

export interface TimeLimit {
  module: ModuleType
  duration: number // in minutes
}