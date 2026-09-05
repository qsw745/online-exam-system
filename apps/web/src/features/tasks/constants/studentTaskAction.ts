import dayjs from '@/shared/utils/dayjs'
import { isStartableStatus } from './taskStatus'

type StudentTask = {
  type?: string
  status: string
  start_time?: string | null
  end_time?: string | null
  my_result_id?: number | string | null
  my_result_status?: string | null
}

export function getStudentTaskAction(task: StudentTask, now = Date.now()) {
  const resultStatus = String(task.my_result_status || '').toLowerCase()
  const completed = task.type === 'exam' && ['completed', 'submitted', 'graded'].includes(resultStatus)
  const visibleStatus = completed ? 'completed' : resultStatus === 'in_progress' ? 'in_progress' : task.status
  if (completed) {
    return {
      visibleStatus,
      label: task.my_result_id != null ? '查看成绩' : '已完成',
      disabled: task.my_result_id == null,
      reason: task.my_result_id == null ? '成绩暂未发布，请稍后查看' : undefined,
    }
  }
  const label = resultStatus === 'in_progress'
    ? (task.type === 'exam' ? '继续考试' : '继续练习')
    : (task.type === 'exam' ? '开始考试' : '开始练习')
  const start = task.start_time ? dayjs(task.start_time) : null
  const end = task.end_time ? dayjs(task.end_time) : null
  const reason = (start && !start.isValid()) || (end && !end.isValid())
    ? '任务时间异常，请联系老师'
    : start && now < start.valueOf()
      ? '未到开始时间'
      : end && now >= end.valueOf()
        ? '已过截止时间'
        : !isStartableStatus(task.status)
          ? '当前任务暂不可开始'
          : undefined
  return { visibleStatus, label, disabled: !!reason, reason }
}
