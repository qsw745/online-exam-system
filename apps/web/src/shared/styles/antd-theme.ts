import { ThemeConfig } from 'antd';

// Ant Design主题配置
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    // 可以根据需要添加更多自定义配置
  },
  components: {
    Button: {
      colorPrimary: '#1677ff',
      algorithm: true,
    },
    Input: {
      colorPrimary: '#1677ff',
    },
    Select: {
      colorPrimary: '#1677ff',
    },
    // 可以为其他组件添加自定义配置
  },
};

// 暗色主题配置
export const darkAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1668dc',
    borderRadius: 6,
    colorBgContainer: '#141414',
    colorBgElevated: '#1f1f1f',
    colorText: 'rgba(255, 255, 255, 0.85)',
    colorTextSecondary: 'rgba(255, 255, 255, 0.45)',
  },
  components: {
    Button: {
      colorPrimary: '#1668dc',
      algorithm: true,
    },
    Input: {
      colorPrimary: '#1668dc',
    },
    Select: {
      colorPrimary: '#1668dc',
    },
  },
};