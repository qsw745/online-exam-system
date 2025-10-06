// src/shared/api/nprogress-axios.ts
import type { AxiosInstance } from 'axios'
import axios from 'axios'
import NProgress from 'nprogress'

let pending = 0
const start = () => {
  if (pending === 0) NProgress.start()
  pending += 1
}
const done = () => {
  pending = Math.max(0, pending - 1)
  if (pending === 0) NProgress.done()
}

export function attachNProgressToAxios(instance: AxiosInstance) {
  instance.interceptors.request.use(
    config => {
      start()
      return config
    },
    error => {
      done()
      return Promise.reject(error)
    }
  )

  instance.interceptors.response.use(
    response => {
      done()
      return response
    },
    error => {
      done()
      return Promise.reject(error)
    }
  )
}

// 如果你偶尔也用默认 axios，也可以顺便挂一下：
export function attachToGlobalAxios() {
  attachNProgressToAxios(axios)
}
