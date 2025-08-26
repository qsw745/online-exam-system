import { createPool, Pool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
  console.error('缺少必要的数据库配置环境变量');
  process.exit(1);
}

const pool: Pool = createPool({
  // 数据库连接配置
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true,
  multipleStatements: false,
  namedPlaceholders: true,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  charset: 'utf8mb4',
  timezone: '+08:00'
});

// 测试数据库连接
pool.getConnection()
  .then(connection => {
    console.log('数据库连接成功');
    connection.release();
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
    process.exit(1);
  });

// 监听连接错误
pool.on('error', (err: Error) => {
  console.error('数据库连接池错误:', err.message);
  if ('code' in err) {
    const dbError = err as Error & { code: string };
    if (dbError.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('数据库连接丢失');
    } else if (dbError.code === 'ER_CON_COUNT_ERROR') {
      console.error('数据库连接数过多');
    } else if (dbError.code === 'ECONNREFUSED') {
      console.error('数据库连接被拒绝');
    } else {
      console.error('未知数据库错误');
    }
  }
});

export { pool };