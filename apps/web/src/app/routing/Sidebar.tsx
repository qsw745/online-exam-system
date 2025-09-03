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
  Award,
  Shield
} from 'lucide-react'

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
          label: '题库管理', 
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
        { path: '/profile', icon: User, label: '个人资料', description: '管理个人信息' },
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
        { 
          path: '/admin/questions', 
          icon: FileQuestion, 
          label: '题库管理', 
          description: '题库相关功能',
          subItems: [
            { path: '/questions/browse', icon: BookOpen, label: '题目浏览', description: '浏览和查看题目' },
            { path: '/admin/questions', icon: FileQuestion, label: '题库维护', description: '题库的增删改查、批量导入等功能' },
            { path: '/questions/favorites', icon: Heart, label: '收藏管理', description: '管理收藏的题目' },
          ]
        },
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
        { 
          path: '/admin/tasks', 
          icon: Clock, 
          label: '任务管理', 
          description: '任务相关功能',
          subItems: [
            { path: '/admin/tasks/maintenance', icon: Settings, label: '任务维护', description: '发布和管理任务' },
            { path: '/admin/tasks/assignments', icon: FileText, label: '任务分配', description: '查看任务分配情况' },
          ]
        },
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
        { 
          path: '/admin/questions', 
          icon: FileQuestion, 
          label: '题库管理', 
          description: '题库管理功能',
          subItems: [
            { path: '/questions/browse', icon: BookOpen, label: '题目浏览', description: '浏览和查看题目' },
            { path: '/questions/manage', icon: Settings, label: '题目管理', description: '管理题目内容' },
            { path: '/admin/questions', icon: FileQuestion, label: '题库维护', description: '题库的增删改查、批量导入等功能' },
            { path: '/questions/favorites', icon: Heart, label: '收藏管理', description: '管理收藏的题目' },
          ]
        },
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
        { 
          path: '/admin/tasks', 
          icon: Clock, 
          label: '任务管理', 
          description: '任务相关功能',
          subItems: [
            { path: '/admin/tasks/maintenance', icon: Settings, label: '任务维护', description: '发布和管理任务' },
            { path: '/admin/tasks/assignments', icon: FileText, label: '任务分配', description: '查看任务分配情况' },
          ]
        },
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
        { path: '/admin/menus', icon: Settings, label: '菜单管理', description: '管理系统菜单' },
        { path: '/admin/roles', icon: Shield, label: '角色管理', description: '管理系统角色' },
        { path: '/admin/notifications', icon: Bell, label: '通知管理', description: '发送和管理通知' },
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
    <aside style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: 'white',
      borderRight: '1px solid #e5e7eb',
      transition: 'all 0.3s ease-in-out',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      width: collapsed ? '64px' : '288px'
    }}>
      {/* Logo 区域 */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                background: 'linear-gradient(to right, #3b82f6, #4f46e5)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BookOpen style={{ width: '20px', height: '20px', color: 'white' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', margin: 0 }}>在线刷题系统</h1>
                <p style={{ fontSize: '12px', color: '#6b7280', textTransform: 'capitalize', margin: 0 }}>{userRole}</p>
              </div>
            </div>
          )}
          
          {collapsed && (
            <div style={{
              width: '32px',
              height: '32px',
              margin: '0 auto',
              background: 'linear-gradient(to right, #3b82f6, #4f46e5)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BookOpen style={{ width: '20px', height: '20px', color: 'white' }} />
            </div>
          )}
          
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              padding: '6px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {collapsed ? (
              <ChevronRight style={{ width: '16px', height: '16px', color: '#4b5563' }} />
            ) : (
              <ChevronLeft style={{ width: '16px', height: '16px', color: '#4b5563' }} />
            )}
          </button>
        </div>
      </div>
      
      {/* 导航菜单 */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {menuGroups.map((group, groupIndex) => (
            <div key={groupIndex} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {!collapsed && (
                <h3 style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0 12px',
                  marginBottom: '8px'
                }}>
                  {group.title}
                </h3>
              )}
              
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
                    <li key={item.path} style={{ marginBottom: '4px' }}>
                      <div style={{ position: 'relative' }}>
                        {hasSubItems ? (
                          <NavLink
                            to={item.subItems?.[0]?.path || item.path}
                            onClick={() => {
                              // 展开菜单
                              setExpandedMenus(prev => ({ ...prev, [item.path]: true }))
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              transition: 'all 0.2s',
                              backgroundColor: isActive || hasActiveSubItem ? '#dbeafe' : 'transparent',
                              color: isActive || hasActiveSubItem ? '#1d4ed8' : '#374151',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              if (!(isActive || hasActiveSubItem)) {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#111827';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!(isActive || hasActiveSubItem)) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#374151';
                              }
                            }}
                            title={collapsed ? item.label : ''}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <Icon style={{
                                flexShrink: 0,
                                transition: 'transform 0.2s',
                                width: '20px',
                                height: '20px'
                              }} />
                              
                              {!collapsed && (
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.label}</div>
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
                                style={{
                                  padding: '4px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#bfdbfe'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              >
                                {isExpanded ? 
                                  <ChevronUp style={{ width: '16px', height: '16px' }} /> : 
                                  <ChevronDown style={{ width: '16px', height: '16px' }} />
                                }
                              </button>
                            )}
                          </NavLink>
                        ) : (
                          <NavLink
                            to={item.path}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              transition: 'all 0.2s',
                              backgroundColor: isActive ? '#dbeafe' : 'transparent',
                              color: isActive ? '#1d4ed8' : '#374151',
                              textDecoration: 'none'
                            }}
                            onMouseEnter={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.backgroundColor = '#f3f4f6';
                                e.currentTarget.style.color = '#111827';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isActive) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#374151';
                              }
                            }}
                            title={collapsed ? item.label : ''}
                          >
                            <Icon style={{
                              flexShrink: 0,
                              transition: 'transform 0.2s',
                              width: '20px',
                              height: '20px'
                            }} />
                            
                            {!collapsed && (
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.label}</div>
                              </div>
                            )}
                          </NavLink>
                        )}
                      </div>
                      
                      {/* 子菜单项 */}
                      {!collapsed && hasSubItems && isExpanded && (
                        <ul style={{
                          marginTop: '2px',
                          marginLeft: '20px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          borderLeft: '1px solid #e5e7eb',
                          paddingLeft: '4px'
                        }}>
                          {item.subItems?.map(subItem => {
                            const SubIcon = subItem.icon
                            const isSubActive = location.pathname === subItem.path
                            
                            return (
                              <li key={subItem.path}>
                                <NavLink
                                  to={subItem.path}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '6px 8px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s',
                                    fontSize: '12px',
                                    backgroundColor: isSubActive ? '#dbeafe' : 'transparent',
                                    color: isSubActive ? '#1d4ed8' : '#374151',
                                    textDecoration: 'none'
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSubActive) {
                                      e.currentTarget.style.backgroundColor = '#f3f4f6';
                                      e.currentTarget.style.color = '#111827';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSubActive) {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.color = '#374151';
                                    }
                                  }}
                                >
                                  <SubIcon style={{
                                    width: '14px',
                                    height: '14px',
                                    flexShrink: 0,
                                    transition: 'transform 0.2s'
                                  }} />
                                  
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: '500' }}>{subItem.label}</div>
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
      <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb' }}>
        <button
          onClick={() => {
            signOut();
            window.location.href = '/login';
          }}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '8px',
            transition: 'all 0.2s',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#374151',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#fef2f2';
            e.currentTarget.style.color = '#dc2626';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#374151';
          }}
          title={collapsed ? '退出登录' : ''}
        >
          <LogOut style={{
            width: '20px',
            height: '20px',
            flexShrink: 0,
            transition: 'transform 0.2s'
          }} />
          
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: '500', fontSize: '14px' }}>退出登录</div>
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
