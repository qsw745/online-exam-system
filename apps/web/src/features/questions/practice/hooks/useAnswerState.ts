// features/questions/practice/hooks/useAnswerState.ts
import { useCallback, useState } from 'react'
import { isAnswerCorrect } from '../utils/answer'

type AnswerableQuestion = {
  type: 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | string
  options?: any[]
  correctIndices?: number[]
  correct_answer?: number[] | string
}

export function useAnswerState() {
  const [selected, setSelected] = useState<number[]>([])
  const [text, setText] = useState('')
  const [answered, setAnswered] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [showExp, setShowExp] = useState(false)

  const reset = useCallback(() => {
    setSelected([])
    setText('')
    setAnswered(false)
    setCorrect(false)
    setShowExp(false)
  }, [])

  const choose = useCallback(
    (q: AnswerableQuestion, idx: number) => {
      if (answered) return
      if (q.type === 'single_choice' || q.type === 'true_false') setSelected([idx])
      else if (q.type === 'multiple_choice') {
        setSelected(prev => (prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]))
      }
    },
    [answered]
  )

  const submit = useCallback(
    (q: AnswerableQuestion) => {
      const ok = isAnswerCorrect(q, selected, text)
      setCorrect(ok)
      setAnswered(true)
      setShowExp(true)
      return ok
    },
    [selected, text]
  )

  return {
    selected,
    text,
    setText,
    answered,
    correct,
    showExp,
    setShowExp,
    reset,
    choose,
    submit,
  }
}
