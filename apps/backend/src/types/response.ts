export interface BaseResponse {
  success: boolean
  message?: string
}

export interface SuccessResponse<T = null> extends BaseResponse {
  success: true
  data: T
  message?: string
}

export interface ErrorResponse extends BaseResponse {
  success: false
  error: string
}

export type ApiResponse<T = null> = SuccessResponse<T> | ErrorResponse
