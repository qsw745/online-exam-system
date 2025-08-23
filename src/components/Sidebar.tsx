import React, { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { 
  BookOpen, 
  BarChart3, 
  FileQuestion, 
  Trophy, 
  User, 
  Settings, 
  BookMarked,
  Clock,
  Users,
  PlusCircle,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Home,
  GraduationCap,
  BookOpenCheck,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  ChevronUp,
  Bell,
  TrendingUp,
  Heart,
  MessageSquare,
  FileText,
  Award
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

interface MenuItem {
  path: string
  icon: React.ElementType
  label: string
  description: string
  subItems?: MenuItem[]
  className?: string
}

interface MenuGroup {
  title: string
  items: MenuItem[]
}

interface SidebarProps {
  userRole: 'student' | 'teacher' | 'admin'
}

const Sidebar: React.FC<SidebarProps> = ({ userRole }) => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})
  const { signOut } = useAuth()
  
  // 学生菜单分组
  const studentMenuGroups: MenuGroup[] = [
    {
      title: '学习中心',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: '个人首页', description: '学习数据概览' },
        { path: '/tasks', icon: Clock, label: '我的任务', description: '查看和参加考试任务' },
        { 
          path: '/questions', 
          icon: FileQuestion, 
          label: '题库学习', 
          description: '浏览和练习题目',
          subItems: [
            { path: '/questions/all', icon: BookOpen, label: '全部题目', description: '浏览所有题目' },
            { path: '/questions/favorites', icon: BookMarked, label: '收藏题目', description: '查看收藏的题目' },
            { path: '/questions/wrong', icon: BookOpenCheck, label: '错题本', description: '查看做错的题目' },
          ]
        },
        { path: '/results', icon: Trophy, label: '答题记录', description: '查看答题历史' },
        { path: '/learning-progress', icon: TrendingUp, label: '学习进度', description: '查看学习轨迹和统计' },
      ]
    },
    {
      title: '互动社区',
      items: [
        { path: '/leaderboard', icon: Award, label: '排行榜', description: '查看排名和竞赛' },
        { path: '/discussion', icon: MessageSquare, label: '讨论区', description: '题目讨论和学习交流' },
        { path: '/favorites', icon: Heart, label: '收藏夹', description: '个人题库管理' },
      ]
    },
    {
      title: '个人设置',
      items: [
        { path: '/notifications', icon: Bell, label: '通知中心', description: '查看系统通知' },
        { path: '/profile', icon: User, label: '个人中心', description: '管理个人信息' },
        { path: '/settings', icon: Settings, label: '系统设置', description: '偏好与通知设置' },
      ]
    }
  ]
  
  // 教师菜单分组
  const teacherMenuGroups: MenuGroup[] = [
    {
      title: '数据分析',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: '数据看板', description: '统计数据概览' },
        { path: '/admin/grades', icon: BarChart3, label: '成绩管理', description: '查看学生成绩' },
        { path: '/analytics', icon: BarChart3, label: '数据统计', description: '查看详细统计' },
        { path: '/leaderboard', icon: Award, label: '排行榜', description: '查看排名和竞赛' },
      ]
    },
    {
      title: '内容管理',
      items: [
        { path: '/admin/questions', icon: FileQuestion, label: '题目管理', description: '管理题库内容' },
        { 
          path: '/admin/papers', 
          icon: BookMarked, 
          label: '试卷管理', 
          description: '创建和管理试卷',
          subItems: [
            { path: '/admin/papers/list', icon: FolderOpen, label: '试卷列表', description: '查看所有试卷' },
            { path: '/admin/paper-create', icon: PlusCircle, label: '创建试卷', description: '创建新试卷' },
          ]
        },
        { path: '/admin/tasks', icon: Clock, label: '任务管理', description: '发布和管理任务' },
      ]
    },
    {
      title: '系统管理',
      items: [
        { path: '/notifications', icon: Bell, label: '通知管理', description: '发送和管理通知' },
        { path: '/logs', icon: FileText, label: '日志管理', description: '查看系统日志' },
        { path: '/discussion', icon: MessageSquare, label: '讨论区', description: '管理讨论内容' },
      ]
    },
    {
      title: '个人设置',
      items: [
        { path: '/notifications', icon: Bell, label: '通知中心', description: '查看系统通知' },
        { path: '/profile', icon: User, label: '个人中心', description: '管理个人信息' },
        { path: '/settings', icon: Settings, label: '系统设置', description: '偏好与通知设置' },
      ]
    }
  ]
  
  // 管理员菜单分组
  const adminMenuGroups: MenuGroup[] = [
    {
      title: '系统概览',
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: '管理首页', description: '系统数据概览' },
        { path: '/admin/users', icon: Users, label: '用户管理', description: '管理系统用户' },
        { path: '/leaderboard', icon: Award, label: '排行榜', description: '查看排名和竞赛' },
      ]
    },
    {
      title: '内容管理',
      items: [
        { path: '/admin/questions', icon: FileQuestion, label: '题目管理', description: '管理所有题目' },
        { 
          path: '/admin/papers', 
          icon: BookMarked, 
          label: '试卷管理', 
          description: '管理所有试卷',
          subItems: [
            { path: '/admin/papers/list', icon: FolderOpen, label: '试卷列表', description: '查看所有试卷' },
            { path: '/admin/paper-create', icon: PlusCircle, label: '创建试卷', description: '创建新试卷' },
          ]
        },
        { path: '/admin/tasks', icon: Clock, label: '任务管理', description: '管理所有任务' },
        { path: '/discussion', icon: MessageSquare, label: '讨论区', description: '管理讨论内容' },
      ]
    },
    {
      title: '数据分析',
      items: [
        { path: '/analytics', icon: BarChart3, label: '数据统计', description: '查看详细统计' },
        { path: '/learning-progress', icon: TrendingUp, label: '学习进度', description: '查看用户学习统计' },
      ]
    },
    {
      title: '系统管理',
      items: [
        { path: '/notifications', icon: Bell, label: '通知管理', description: '发送和管理通知' },
        { path: '/logs', icon: FileText, label: '日志管理', description: '查看系统日志' },
        { path: '/favorites', icon: Heart, label: '收藏夹管理', description: '管理用户收藏' },
      ]
    },
    {
      title: '个人设置',
      items: [
        { path: '/notifications', icon: Bell, label: '通知中心', description: '查看系统通知' },
        { path: '/profile', icon: User, label: '个人中心', description: '管理个人信息' },
        { path: '/settings', icon: Settings, label: '系统设置', description: '系统配置管理' },
      ]
    }
  ]
  
  // 根据用户角色获取对应的菜单分组
  const getMenuGroups = (): MenuGroup[] => {
    switch (userRole) {
      case 'admin':
        return adminMenuGroups
      case 'teacher':
        return teacherMenuGroups
      default:
        return studentMenuGroups
    }
  }
  
  const menuGroups = getMenuGroups()
  
  return (
    <aside className={cn(
      'flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out shadow-lg',
      collapsed ? 'w-16' : 'w-72'
    )}>
      {/* Logo 区域 */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">在线刷题系统</h1>
                <p className="text-xs text-gray-500 capitalize">{userRole}</p>
              </div>
            </div>
          )}
          
          {collapsed && (
            <div className="w-8 h-8 mx-auto bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
          )}
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
      </div>
      
      {/* 导航菜单 */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-6">
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="space-y-2">
              {!collapsed && (
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                  {group.title}
                </h3>
              )}
              
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = location.pathname === item.path || 
                    (item.subItems && item.subItems.some(subItem => location.pathname === subItem.path))
                  const hasSubItems = item.subItems && item.subItems.length > 0
                  const isExpanded = expandedMenus[item.path] || false
                  
                  // 检查是否有子菜单项处于激活状态
                  const hasActiveSubItem = hasSubItems && item.subItems?.some(subItem => 
                    location.pathname === subItem.path
                  )
                  
                  // 如果有子菜单项处于激活状态，自动展开父菜单
                  React.useEffect(() => {
                    if (hasActiveSubItem && !isExpanded) {
                      setExpandedMenus(prev => ({ ...prev, [item.path]: true }))
                    }
                  }, [location.pathname])
                  
                  return (
                    <li key={item.path} className="mb-1">
                      <div className="relative">
                        {hasSubItems ? (
                          <NavLink
                            to={item.subItems?.[0]?.path || item.path}
                            onClick={() => {
                              // 展开菜单
                              setExpandedMenus(prev => ({ ...prev, [item.path]: true }))
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group',
                              isActive || hasActiveSubItem
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                              item.className
                            )}
                            title={collapsed ? item.label : ''}
                          >
                            <div className="flex items-center space-x-3">
                              <Icon className={cn(
                                'flex-shrink-0 transition-transform group-hover:scale-110',
                                collapsed ? 'w-5 h-5' : 'w-5 h-5'
                              )} />
                              
                              {!collapsed && (
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{item.label}</div>
                                </div>
                              )}
                            </div>
                            
                            {!collapsed && hasSubItems && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setExpandedMenus(prev => ({ ...prev, [item.path]: !prev[item.path] }))
                                }}
                                className="p-1 hover:bg-blue-200 rounded transition-colors"
                              >
                                {isExpanded ? 
                                  <ChevronUp className="w-4 h-4" /> : 
                                  <ChevronDown className="w-4 h-4" />
                                }
                              </button>
                            )}
                          </NavLink>
                        ) : (
                          <NavLink
                            to={item.path}
                            className={cn(
                              'flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group',
                              isActive
                                ? 'bg-blue-100 text-blue-700'
                                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
                              item.className
                            )}
                            title={collapsed ? item.label : ''}
                          >
                            <Icon className={cn(
                              'flex-shrink-0 transition-transform group-hover:scale-110',
                              collapsed ? 'w-5 h-5' : 'w-5 h-5'
                            )} />
                            
                            {!collapsed && (
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{item.label}</div>
                              </div>
                            )}
                          </NavLink>
                        )}
                      </div>
                      
                      {/* 子菜单项 */}
                      {!collapsed && hasSubItems && isExpanded && (
                        <ul className="mt-0.5 ml-5 space-y-0.5 border-l border-gray-200 pl-1">
                          {item.subItems?.map(subItem => {
                            const SubIcon = subItem.icon
                            const isSubActive = location.pathname === subItem.path
                            
                            return (
                              <li key={subItem.path}>
                                <NavLink
                                  to={subItem.path}
                                  className={cn(
                                    'flex items-center space-x-2 px-2 py-1.5 rounded transition-all duration-200 group text-xs',
                                    isSubActive
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                                  )}
                                >
                                  <SubIcon className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:scale-110" />
                                  
                                  <div className="flex-1 min-w-0">
                                      <div className="font-medium">{subItem.label}</div>
                                    </div>
                                </NavLink>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      
      {/* 底部区域 */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => {
            signOut();
            window.location.href = '/login';
          }}
          className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 group text-gray-700 hover:bg-red-50 hover:text-red-600"
          title={collapsed ? '退出登录' : ''}
        >
          <LogOut className="w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110" />
          
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">退出登录</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
