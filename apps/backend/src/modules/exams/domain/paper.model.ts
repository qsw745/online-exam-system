// src/modules/exams/domain/paper.model.ts
import type { RowDataPacket } from 'mysql2'

export interface IPaper extends RowDataPacket {
  id: number
  title: string
  description: string
  difficulty: 'easy' | 'medium' | 'hard'
  total_score: number
  duration: number
  created_at: Date
  updated_at: Date
}

export interface IPaperQuestion extends RowDataPacket {
  paper_id: number
  question_id: number
  score: number
  order: number
  question_title: string
  question_type: string
  question_content: string
  question_options: string
  question_answer: string
}

export interface IQuestion extends RowDataPacket {
  id: number
  title: string
  question_type: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

export type PaperData = { paper: IPaper }
export type PaperListData = { papers: IPaper[]; total: number }
export type PaperQuestionData = { questions: IPaperQuestion[] }
