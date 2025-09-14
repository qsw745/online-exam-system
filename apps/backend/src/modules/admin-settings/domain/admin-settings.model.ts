export interface SystemSettings {
    systemName: string
    allowUserRegistration: boolean
    maxLoginAttempts: number
    /** 可显示/修改的默认密码（你有页面要展示这个字段） */
    defaultPassword?: string
}
