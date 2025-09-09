import type { RowDataPacket } from 'mysql2'

export interface ITaskStats extends RowDataPacket {
  total_tasks: number
  completed_tasks: number
}
export interface IScoreStats extends RowDataPacket {
  average_score: number
  best_score: number
}

export type DashboardStatsData = {
  total_tasks: number
  completed_tasks: number
  average_score: number
  best_score: number
}
