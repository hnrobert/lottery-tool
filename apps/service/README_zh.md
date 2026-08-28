# 抽奖系统后端

🌍 中文版 | [English](README.md)

一个支持多种抽奖模式的完整抽奖系统后端服务，基于 Node.js + Express.js + MySQL 构建。
提供符合OpenAPI规范的json协议文档，方便前端开发人员查看和测试API。

## 功能特点

- 🎯 **多种抽奖模式**：支持线上抽奖和线下抽奖
- 🔐 **权限管理**：超级管理员和普通管理员角色
- 🎫 **抽奖码系统**：支持多种格式的抽奖码生成
- 🔗 **Webhook支持**：第三方系统可通过Webhook添加抽奖码
- 📊 **完整统计**：详细的抽奖记录和统计数据
- 🛡️ **安全可靠**：JWT认证、操作日志、错误处理

## 技术栈

- **后端框架**：Node.js + Express.js
- **数据库**：MySQL 8.0+
- **ORM**：Sequelize
- **认证**：JWT
- **日志**：Winston
- **验证**：express-validator

## 安装和使用

### 1. 环境要求

- Node.js >= 16.0.0
- MySQL >= 8.0
- npm 或 yarn

### 2. 安装依赖

```bash
pnpm install
```

### 3. 系统初始化

初次启动时，将会自动进入安装程序，引导您完成数据库配置、管理员账户创建等步骤。

若安装失败，您可以使用自动化安装脚本：

```bash
pnpm run install-system
```

安装脚本将引导您：
- 配置数据库连接
- 创建数据库和表结构
- 设置超级管理员账户
- 生成配置文件

### 4. 启动服务

```bash
# 生产模式
pnpm start

# 开发模式
pnpm dev
```

### 5. 测试API

运行自动化测试确保系统正常工作：

```bash
pnpm test
```

## 抽奖码格式支持

系统支持以下抽奖码格式：

| 格式代码 | 描述 | 示例 |
|---------|------|------|
| `4_digit_number` | 4位纯数字 | 1234 |
| `8_digit_number` | 8位纯数字 | 12345678 |
| `8_digit_alphanumeric` | 8位数字+小写字母 | 12a34b56 |
| `12_digit_number` | 12位纯数字 | 123456789012 |
| `12_digit_alphanumeric` | 12位数字+字母 | 12a34B56c78D |

## API使用示例
具体请参考API文档, 并已提供OpenAPI协议，你可以将``openapi.json`` 导入到Swagger UI更多其他API工具中进行测试。

### 管理员登录

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your_password"
  }'
```

### 创建活动

```bash
curl -X POST http://localhost:3000/api/admin/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "春节抽奖活动",
    "description": "新春佳节，好礼相送",
    "lottery_mode": "online",
    "start_time": "2024-02-01T00:00:00.000Z",
    "end_time": "2024-02-15T23:59:59.000Z",
    "settings": {
      "max_lottery_codes": 1000,
      "lottery_code_format": "8_digit_number"
    }
  }'
```

### 批量创建抽奖码

```bash
curl -X POST http://localhost:3000/api/admin/activities/1/lottery-codes/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "count": 100
  }'
```

### 用户抽奖

```bash
curl -X POST http://localhost:3000/api/lottery/activities/1/draw \
  -H "Content-Type: application/json" \
  -d '{
    "lottery_code": "12345678"
  }'
```

## Webhook集成

### 获取Webhook信息

```bash
curl -X GET http://localhost:3000/api/admin/activities/1/webhook-info \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 通过Webhook添加抽奖码

```bash
curl -X POST http://localhost:3000/api/webhook/activities/WEBHOOK_ID/lottery-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer WEBHOOK_TOKEN" \
  -d '{
    "code": "87654321",
    "participant_info": {
      "name": "张三",
      "phone": "13800138000",
      "email": "zhangsan@example.com"
    }
  }'
```

## 目录结构

```
backend-2/
├── src/
│   ├── app.ts                 # 应用入口
│   ├── config/
│   │   └── database.ts        # 数据库配置
│   ├── middleware/
│   │   ├── auth.ts           # 认证中间件
│   │   ├── errorHandler.ts   # 错误处理
│   │   └── operationLogger.ts # 操作日志
│   ├── models/               # 数据模型
│   │   ├── User.ts
│   │   ├── Activity.ts
│   │   ├── Prize.ts
│   │   ├── LotteryCode.ts
│   │   ├── LotteryRecord.ts
│   │   └── OperationLog.ts
│   ├── routes/               # 路由
│   │   ├── auth.ts          # 认证路由
│   │   ├── admin/           # 管理员路由
│   │   ├── lottery.ts       # 抽奖路由
│   │   ├── webhook.ts       # Webhook路由
│   │   └── system.ts        # 系统管理路由
│   └── utils/               # 工具函数
│       ├── logger.ts
│       ├── customError.ts
│       └── lotteryCodeGenerator.ts
├── scripts/
│   ├── install.ts           # 安装脚本
│   └── test-apis.ts         # API测试脚本
├── logs/                    # 日志文件
├── config/                  # 配置文件
├── package.json
└── README.md
```

## 环境变量 ENV

系统运行时需要以下环境变量（安装脚本会自动生成）：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lottery_system
DB_USER=root
DB_PASSWORD=your_password

# JWT配置
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## Docker 部署说明

### 问题解决

之前的 `ELIFECYCLE Command failed with exit code 1` 错误是因为应用在Docker环境中尝试运行交互式安装脚本，但Docker容器是非交互式的。

### 解决方案

#### 1. 修改了应用启动逻辑

- 在Docker环境中自动跳过交互式安装
- 添加了Docker环境检测
- 数据库连接失败时不会立即退出应用

#### 2. 使用方法

**方法一：使用Docker Compose（推荐）**

1. 修改 `docker-compose.yml` 中的数据库配置：

```yaml
environment:
  DB_HOST: your-actual-database-host
  DB_USER: your-actual-db-user
  DB_PASSWORD: your-actual-db-password
```

2. 启动服务：

```bash
docker-compose up -d
```

3. 查看日志：

```bash
docker-compose logs -f lottery-backend
```

**方法二：单独使用Docker**

1. 构建镜像：

```bash
docker build -t lottery-backend .
```

2. 运行容器（需要设置环境变量）：

```bash
docker run -d \
  --name lottery-backend \
  -p 3000:3000 \
  -e DB_HOST=your-database-host \
  -e DB_USER=your-db-user \
  -e DB_PASSWORD=your-db-password \
  -e JWT_SECRET=your-jwt-secret \
  lottery-backend
```

#### 3. 环境变量说明

必需的环境变量：

- `DB_HOST`: 数据库主机地址
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `DB_NAME`: 数据库名称（可选，默认：lottery_system）
- `JWT_SECRET`: JWT密钥

可选的环境变量：

- `DB_PORT`: 数据库端口（默认：3306）
- `PORT`: 应用端口（默认：3000）
- `NODE_ENV`: 环境（默认：production）
- `CORS_ORIGIN`: CORS来源（默认：*）

#### 4. 测试部署

启动后，可以通过以下方式测试：

```bash
# 健康检查
curl http://localhost:3000/health

# 查看容器状态
docker ps

# 查看日志
docker logs lottery-backend
```

#### 5. 故障排除

如果容器仍然启动失败：

1. 检查环境变量是否正确设置
2. 确保数据库服务可访问
3. 查看详细日志：`docker logs lottery-backend`


## 开发说明
### 添加新的抽奖码格式

1. 在 `src/utils/lotteryCodeGenerator.ts` 中添加新格式
2. 更新验证规则
3. 更新API文档

## 故障排除
### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License

## 联系方式

如有问题或建议，请联系开发团队。