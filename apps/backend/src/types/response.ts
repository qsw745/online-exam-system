export interface BaseResponse {
  success: boolean;
}

export interface SuccessResponse<T = null> extends BaseResponse {
  success: true;
  data: T;
}

export interface ErrorResponse extends BaseResponse {
  success: false;
  error: string;
}

export type ApiResponse<T = null> = SuccessResponse<T> | ErrorResponse;