import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../../components/LoadingSpinner'
import toast from 'react-hot-toast'
import { api, users as users2 } from '../../lib/api'
import {
  Search,
  Filter,
  Edit,
  Eye,
  UserCheck,
  UserX,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Users,
  X,
  Star
} from 'lucide-react'
import Pagination from '../../components/ui/Pagination'

interface User {
  id: number
  email: string
  role: 'student' | 'teacher' | 'admin'
  nickname?: string
  school?: string
  class_name?: string
  experience_points: number
  level: number
  created_at: string
  updated_at: string
}

interface UserStatistics {
  totalSubmissions: number
  completedSubmissions: number
  averageScore: number
}

interface UserDetail extends User {
  statistics: UserStatistics
}

// 防抖函数，延迟执行搜索
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
};

const UserManagementPage: React.FC = () => {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalUsers, setTotalUsers] = useState(0)
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    role: '',
    nickname: '',
    school: '',
    class_name: ''
  })
  
  // 表单验证状态
  const [formErrors, setFormErrors] = useState({
    nickname: ''
  })
  
  // 创建搜索输入框的引用
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // 不再使用防抖处理搜索词，直接在输入变化时触发搜索
  
  const [limit, setLimit] = useState(20)

  // 当防抖后的搜索词变化时，重置页码到第一页并保持输入框焦点
  useEffect(() => {
    setCurrentPage(1)
    // 保持搜索框的焦点
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [roleFilter])
  // 页面初始化时加载用户数据
  useEffect(() => {
    loadUsers()
  }, [])

  // 当页码、角色筛选或每页条数变化时，加载用户数据
  // 搜索词的变化已经在另一个useEffect中处理
  useEffect(() => {
    loadUsers()
  }, [currentPage, roleFilter, limit])

  // 标记是否是搜索触发的加载
  const isSearchTriggered = useRef(true)
  // 标记是否正在使用输入法
  const isComposing = useRef(false)

  // 移除对debouncedSearchTerm的依赖，直接在输入变化时触发搜索

  const loadUsers = async () => {
    try {
      setLoading(true)
      console.log('开始加载用户数据，参数:', { page: currentPage, limit, search: searchTerm, role: roleFilter })
      
      // 确保使用当前的searchTerm而不是debouncedSearchTerm
      const { data } = await users2.getAll({
        page: currentPage,
        limit,
        search: searchTerm, // 使用当前的searchTerm
        role: roleFilter
      })

      console.log('用户数据加载成功:', data)
      setUsers(data.users || [])
      setTotalUsers(data.total || 0)
      console.log('设置用户数据:', data.users?.length, '条记录，总计:', data.total)
    } catch (error: any) {
      console.error('加载用户列表错误:', error)
      toast.error(error.response?.data?.message || '加载用户失败')
    } finally {
      setLoading(false)
      console.log('用户数据加载完成，loading状态已设置为false')
      
      // 在加载完成后聚焦到搜索框
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 0)
    }
  }

  const loadUserDetail = async (userId: number) => {
    try {
      const { data } = await users2.getById(userId)

      setSelectedUser(data)
      setShowDetailModal(true)
    } catch (error: any) {
      console.error('加载用户详情错误:', error)
      toast.error(error.response?.data?.message || '加载用户详情失败')
    }
  }

  const validateForm = () => {
    let isValid = true
    const errors = {
      nickname: ''
    }
    
    // 验证昵称
    if (editForm.nickname.trim() === '') {
      errors.nickname = '昵称不能为空'
      isValid = false
    } else if (editForm.nickname.length > 20) {
      errors.nickname = '昵称不能超过20个字符'
      isValid = false
    }
    
    setFormErrors(errors)
    return isValid
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingUser) return
    
    // 表单验证
    if (!validateForm()) {
      toast.error('请修正表单错误')
      return
    }

    try {
      // 直接使用api调用，确保正确处理响应
      const response = await api.put(`/users/${editingUser.id}`, editForm)
      
      if (!response.success) {
        throw new Error(response.error || '更新失败')
      }
      
      // 更新本地用户列表中的用户数据
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === editingUser.id 
            ? { 
                ...user, 
                role: editForm.role, 
                nickname: editForm.nickname, 
                school: editForm.school, 
                class_name: editForm.class_name 
              } 
            : user
        )
      )
      
      toast.success('用户信息更新成功')
      setShowEditModal(false)
      setEditingUser(null)
      // 重新加载用户列表以确保数据同步
      loadUsers()
    } catch (error: any) {
      console.error('更新用户错误:', error)
      toast.error(error.response?.data?.message || '更新失败')
    }
  }

  const openEditModal = (user: User) => {
    setEditingUser(user)
    setEditForm({
      role: user.role,
      nickname: user.nickname || '',
      school: user.school || '',
      class_name: user.class_name || ''
    })
    // 重置表单错误状态
    setFormErrors({
      nickname: ''
    })
    setShowEditModal(true)
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return '管理员'
      case 'teacher': return '教师'
      case 'student': return '学生'
      default: return '未知'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'teacher': return 'bg-blue-100 text-blue-800'
      case 'student': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const totalPages = Math.ceil(totalUsers / limit)

  // 只在初始加载且没有用户数据时显示全屏加载
  if (loading && users.length === 0 && currentPage === 1) {
    return <LoadingSpinner text="加载用户管理..." />
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">用户管理</h1>
        <p className="text-gray-600 mt-1">管理系统用户和权限</p>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="flex-1 relative group">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-hover:text-blue-500 transition-colors duration-200">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                // 非输入法状态下，立即触发搜索
                if (!isComposing.current) {
                  // 设置一个短暂的延迟，让React有时间更新状态
                  setTimeout(() => loadUsers(), 50);
                }
              }}
              // 添加onCompositionStart和onCompositionEnd事件处理中文输入法
              onCompositionStart={() => {
                // 标记正在使用输入法
                isComposing.current = true;
              }}
              onCompositionEnd={(e) => {
                // 输入法输入完成
                isComposing.current = false;
                // 确保搜索词是最终输入的值
                setSearchTerm(e.target.value);
                // 手动触发一次搜索
                setTimeout(() => loadUsers(), 50);
              }}
              onKeyDown={(e) => {
                // 当用户按下回车键时立即触发搜索
                if (e.key === 'Enter') {
                  loadUsers();
                }
              }}
              placeholder="搜索用户邮箱或昵称..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none bg-gray-50 hover:bg-white focus:bg-white transition-colors duration-200"
              ref={searchInputRef}
              autoFocus
            />
            {searchTerm && (
              <button 
                onClick={() => {
                  setSearchTerm('');
                  // 清空搜索词后立即触发搜索
                  // 增加延迟确保状态更新后再请求
                  setTimeout(() => {
                    console.log('清空搜索，当前searchTerm:', '');
                    loadUsers();
                  }, 50);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none bg-gray-50 hover:bg-white focus:bg-white transition-colors duration-200 appearance-none"
            >
              <option value="">所有角色</option>
              <option value="student">学生</option>
              <option value="teacher">教师</option>
              <option value="admin">管理员</option>
            </select>
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
        
        {/* 搜索状态提示 */}
        {(searchTerm || roleFilter) && (
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <AlertCircle className="w-4 h-4 mr-2 text-blue-500" />
            <span>
              当前筛选: 
              {searchTerm && (
                <span className="ml-1 text-blue-600">搜索 "{searchTerm}"</span>
              )}
              {searchTerm && roleFilter && <span className="mx-1">和</span>}
              {roleFilter && (
                <span className="text-blue-600">
                  角色 "{roleFilter === 'student' ? '学生' : roleFilter === 'teacher' ? '教师' : '管理员'}"
                </span>
              )}
              <button 
                onClick={() => {
                  setSearchTerm('')
                  setRoleFilter('')
                  setCurrentPage(1)
                }}
                className="ml-2 text-red-500 hover:text-red-700 focus:outline-none transition-colors duration-200"
              >
                清除筛选
              </button>
            </span>
          </div>
        )}
      </div>

      {/* 用户列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">角色</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学校/班级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">等级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-100 p-4 rounded-full mb-3">
                        <Users className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="text-lg font-medium">暂无用户数据</p>
                      {(searchTerm || roleFilter) && (
                        <p className="text-sm mt-2">尝试使用其他搜索条件或<button 
                          onClick={() => {
                            setSearchTerm('')
                            setRoleFilter('')
                            setCurrentPage(1)
                          }}
                          className="text-blue-500 hover:text-blue-700 focus:outline-none transition-colors duration-200"
                        >清除筛选</button></p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                          {user.nickname ? user.nickname.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.nickname || '未设置昵称'}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{user.school || '未设置'}</div>
                      <div className="text-sm text-gray-500">{user.class_name || '未设置'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-1 rounded-full mr-2 flex items-center">
                          <Star className="w-3 h-3 mr-1 text-yellow-600 fill-current" />
                          Lv.{user.level}
                        </span>
                        <span className="text-sm text-gray-500">{user.experience_points} XP</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => loadUserDetail(user.id)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none transition-colors duration-150 shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          查看
                        </button>
                        <button
                          onClick={() => openEditModal(user)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none transition-colors duration-150 shadow-sm"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          编辑
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 增强版分页组件 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalUsers}
          pageSize={limit}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newPageSize) => {
            setLimit(newPageSize)
            setCurrentPage(1) // 重置到第一页
          }}
          showSizeChanger={true}
          showQuickJumper={true}
          showTotal={true}
          pageSizeOptions={[10, 20, 50, 100]}
          size="default"
        />
      </div>

      {/* 用户详情模态框 */}
      {showDetailModal && selectedUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-blue-600 px-4 py-3">
                <h3 className="text-lg leading-6 font-medium text-white flex items-center">
                  <Eye className="w-5 h-5 mr-2" />
                  用户详情
                </h3>
              </div>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="grid grid-cols-1 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Users className="w-4 h-4 mr-2 text-blue-500" />
                      基本信息
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">邮箱</p>
                        <p className="font-medium">{selectedUser.email}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">昵称</p>
                        <p className="font-medium">{selectedUser.nickname || '未设置'}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">角色</p>
                        <p>
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(selectedUser.role)}`}>
                            {getRoleLabel(selectedUser.role)}
                          </span>
                        </p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">注册时间</p>
                        <p className="font-medium">{new Date(selectedUser.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">学校</p>
                        <p className="font-medium">{selectedUser.school || '未设置'}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">班级</p>
                        <p className="font-medium">{selectedUser.class_name || '未设置'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                      <Filter className="w-4 h-4 mr-2 text-blue-500" />
                      学习统计
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">等级</p>
                        <p className="font-medium text-lg">Lv.{selectedUser.level}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">经验值</p>
                        <p className="font-medium text-lg">{selectedUser.experience_points}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100">
                        <p className="text-xs text-gray-500">平均分数</p>
                        <p className="font-medium text-lg">{selectedUser.statistics.averageScore.toFixed(1)}</p>
                      </div>
                      <div className="p-2 bg-white rounded border border-gray-100 md:col-span-3 grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">总提交次数</p>
                          <p className="font-medium text-lg">{selectedUser.statistics.totalSubmissions}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">完成次数</p>
                          <p className="font-medium text-lg">{selectedUser.statistics.completedSubmissions}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowDetailModal(false)}
                  className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none transition-colors duration-200 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <X className="w-4 h-4 mr-2" />
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false)
                    openEditModal(selectedUser)
                  }}
                  className="mt-3 w-full inline-flex justify-center items-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors duration-200 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  编辑用户
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑用户模态框 */}
      {showEditModal && editingUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-blue-600 px-4 py-3">
                <h3 className="text-lg leading-6 font-medium text-white flex items-center">
                  <Edit className="w-5 h-5 mr-2" />
                  编辑用户
                </h3>
              </div>
              <form onSubmit={handleEditUser}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">角色 <span className="text-red-500">*</span></label>
                      <select
                        id="role"
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                        className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none sm:text-sm rounded-md bg-gray-50 hover:bg-white transition-colors duration-200"
                      >
                        <option value="student">学生</option>
                        <option value="teacher">教师</option>
                        <option value="admin">管理员</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">选择用户的系统角色</p>
                    </div>
                    
                    <div>
                      <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">昵称 <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        id="nickname"
                        value={editForm.nickname}
                        onChange={(e) => {
                          setEditForm({ ...editForm, nickname: e.target.value })
                          // 实时验证
                          if (e.target.value.trim() === '') {
                            setFormErrors({...formErrors, nickname: '昵称不能为空'})
                          } else if (e.target.value.length > 20) {
                            setFormErrors({...formErrors, nickname: '昵称不能超过20个字符'})
                          } else {
                            setFormErrors({...formErrors, nickname: ''})
                          }
                        }}
                        className={`block w-full px-3 py-2 border ${formErrors.nickname ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none sm:text-sm bg-gray-50 hover:bg-white transition-colors duration-200`}
                      />
                      {formErrors.nickname && (
                        <p className="mt-1 text-xs text-red-500 flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          {formErrors.nickname}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">用户在系统中显示的名称</p>
                    </div>
                    
                    <div>
                      <label htmlFor="school" className="block text-sm font-medium text-gray-700 mb-1">学校</label>
                      <input
                        type="text"
                        id="school"
                        value={editForm.school}
                        onChange={(e) => setEditForm({ ...editForm, school: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm bg-gray-50 hover:bg-white transition-colors duration-200"
                      />
                      <p className="mt-1 text-xs text-gray-500">用户所属的学校名称</p>
                    </div>
                    
                    <div>
                      <label htmlFor="class_name" className="block text-sm font-medium text-gray-700 mb-1">班级</label>
                      <input
                        type="text"
                        id="class_name"
                        value={editForm.class_name}
                        onChange={(e) => setEditForm({ ...editForm, class_name: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm bg-gray-50 hover:bg-white transition-colors duration-200"
                      />
                      <p className="mt-1 text-xs text-gray-500">用户所属的班级名称</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none transition-colors duration-200 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    保存更改
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingUser(null)
                    }}
                    className="mt-3 w-full inline-flex justify-center items-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none transition-colors duration-200 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default UserManagementPage