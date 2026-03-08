# 🔐 CLI 安全配置指南

## 安全特性

UOOTD CLI 已经集成了多层安全保护：

### 1. ✅ 密码认证
- 使用前需要输入密码
- 密码存储在环境变量中
- 使用 SHA-256 哈希验证

### 2. ✅ 会话管理
- 认证后创建 1 小时有效会话
- 会话文件权限 600（只有所有者可读写）
- 会话过期自动要求重新认证

### 3. ✅ 操作日志
- 所有操作记录到 `.uootd-operations.log`
- 包含时间戳、用户、操作类型
- 便于审计和追踪

### 4. ✅ 危险操作确认
- AI 优化（消耗 API 额度）
- 数据库迁移（修改数据结构）
- 创建/删除品牌
- 重置进度
- 部署操作

### 5. ✅ 文件权限保护
- 会话文件：600（-rw-------）
- CLI 脚本：700（-rwx------）
- 配置文件：600（-rw-------）

## 快速设置

### 步骤 1: 设置密码

编辑 `.env.local`：

```bash
# 将默认密码改为强密码
UOOTD_CLI_PASSWORD="your_very_strong_password_here"
```

**密码要求：**
- 至少 12 个字符
- 包含大小写字母、数字、特殊字符
- 不要使用常见密码

**示例强密码：**
```bash
UOOTD_CLI_PASSWORD="Ux9#mK2$pL7@nQ4!"
```

### 步骤 2: 保护配置文件

```bash
cd /Users/chengyadong/Documents/uootd商店/luxury-shop

# 设置 .env.local 权限（只有所有者可读写）
chmod 600 .env.local

# 设置 CLI 启动器权限（只有所有者可执行）
chmod 700 bin/uootd.cjs

# 设置脚本目录权限
chmod 700 scripts/*.sh
```

### 步骤 3: 首次使用

```bash
# 交互式终端会要求认证
uootd stats

# 输出：
# 🔐 需要认证才能使用 CLI 工具
# ? 请输入 CLI 密码: ********
# ✅ 认证成功
```

非交互环境（如 OpenClaw、cron、CI）会直接使用 `UOOTD_CLI_PASSWORD` 完成认证，不会弹出提示。

### 步骤 4: 会话管理

```bash
# 查看当前会话状态
uootd whoami

# 输出：
# 👤 当前用户信息:
#    用户: chengyadong
#    会话: 已认证
#    过期时间: 58 分钟后

# 手动登出
uootd logout
```

## 安全最佳实践

### 1. 密码管理

**✅ 推荐：**
- 使用密码管理器生成强密码
- 定期更换密码（每 3-6 个月）
- 不要在多个系统使用相同密码
- 不要将密码提交到 Git

**❌ 避免：**
- 使用简单密码（如 "123456", "password"）
- 将密码写在纸上或文档中
- 通过聊天工具发送密码
- 在公共场所输入密码

### 2. 文件权限

```bash
# 检查关键文件权限
ls -la .env.local
# 应该显示: -rw------- (600)

ls -la ~/.uootd-auth
# 应该显示: -rw------- (600)

ls -la cli/index.ts
# 应该显示: -rwx------ (700)
```

**如果权限不正确：**

```bash
# 修复 .env.local
chmod 600 .env.local

# 修复会话文件
chmod 600 ~/.uootd-auth

# 修复 CLI 脚本
chmod 700 cli/index.ts
```

### 3. 服务器安全

如果在服务器上使用：

```bash
# 1. 创建专用用户
sudo useradd -m -s /bin/bash uootd-admin

# 2. 设置项目目录权限
sudo chown -R uootd-admin:uootd-admin /path/to/luxury-shop
sudo chmod 700 /path/to/luxury-shop

# 3. 只允许特定用户访问
sudo usermod -a -G uootd-admin your_username
```

### 4. 操作审计

定期检查操作日志：

```bash
# 查看最近的操作
tail -n 50 .uootd-operations.log

# 查看特定用户的操作
grep "username" .uootd-operations.log

# 查看危险操作
grep -E "migrate|deploy|reset" .uootd-operations.log
```

### 5. 环境隔离

**生产环境：**

```bash
# 使用不同的密码
UOOTD_CLI_PASSWORD="production_strong_password"

# 限制 CLI 访问
# 只在跳板机上安装 CLI
# 使用 VPN 访问
```

**开发环境：**

```bash
# 使用开发密码
UOOTD_CLI_PASSWORD="dev_password"

# 可以相对宽松
```

## 高级安全配置

### 1. IP 白名单

编辑 `cli/index.ts`，添加 IP 检查：

```typescript
function checkIPWhitelist(): boolean {
  const allowedIPs = process.env.UOOTD_ALLOWED_IPS?.split(",") || [];
  const currentIP = execSync("curl -s ifconfig.me").toString().trim();

  if (allowedIPs.length > 0 && !allowedIPs.includes(currentIP)) {
    console.error(chalk.red("\n❌ IP 地址未授权\n"));
    return false;
  }

  return true;
}
```

在 `.env.local` 中：

```bash
UOOTD_ALLOWED_IPS="192.168.1.100,10.0.0.50"
```

### 2. 时间窗口限制

只允许在特定时间使用：

```typescript
function checkTimeWindow(): boolean {
  const hour = new Date().getHours();
  const allowedStart = parseInt(process.env.UOOTD_ALLOWED_HOUR_START || "0");
  const allowedEnd = parseInt(process.env.UOOTD_ALLOWED_HOUR_END || "24");

  if (hour < allowedStart || hour >= allowedEnd) {
    console.error(chalk.red("\n❌ 当前时间不允许使用 CLI\n"));
    return false;
  }

  return true;
}
```

在 `.env.local` 中：

```bash
# 只允许工作时间使用（9:00-18:00）
UOOTD_ALLOWED_HOUR_START="9"
UOOTD_ALLOWED_HOUR_END="18"
```

### 3. 双因素认证（2FA）

使用 TOTP（Time-based One-Time Password）：

```bash
npm install speakeasy qrcode-terminal
```

添加到 CLI：

```typescript
import speakeasy from "speakeasy";

// 生成 2FA 密钥（首次设置）
const secret = speakeasy.generateSecret({ name: "UOOTD CLI" });

// 验证 2FA 代码
function verify2FA(token: string): boolean {
  const secret = process.env.UOOTD_2FA_SECRET;
  if (!secret) return true; // 如果未启用 2FA，跳过

  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
  });
}
```

### 4. 操作频率限制

防止暴力破解：

```typescript
const loginAttempts = new Map<string, number>();

function checkRateLimit(user: string): boolean {
  const attempts = loginAttempts.get(user) || 0;

  if (attempts >= 5) {
    console.error(chalk.red("\n❌ 登录尝试次数过多，请 10 分钟后再试\n"));
    return false;
  }

  return true;
}
```

## 监控和告警

### 1. 失败登录告警

```bash
# 添加到 crontab
*/5 * * * * grep "认证失败" /path/to/.uootd-operations.log | tail -n 10 | mail -s "CLI 认证失败告警" admin@example.com
```

### 2. 危险操作通知

```bash
# 监控危险操作
*/10 * * * * grep -E "migrate|deploy|reset" /path/to/.uootd-operations.log | tail -n 5 | mail -s "CLI 危险操作通知" admin@example.com
```

### 3. 异常 IP 告警

```bash
# 检测新 IP 登录
*/15 * * * * /path/to/check-new-ip.sh
```

## 应急响应

### 如果密码泄露：

```bash
# 1. 立即更改密码
nano .env.local
# 修改 UOOTD_CLI_PASSWORD

# 2. 清除所有会话
rm ~/.uootd-auth

# 3. 检查操作日志
grep "$(date +%Y-%m-%d)" .uootd-operations.log

# 4. 如有异常，回滚数据库
uootd db restore backups/latest.sql
```

### 如果发现未授权操作：

```bash
# 1. 查看操作日志
cat .uootd-operations.log | grep "suspicious_user"

# 2. 禁用 CLI（临时）
chmod 000 cli/index.ts

# 3. 审计数据库变更
uootd db audit

# 4. 恢复数据（如需要）
uootd db restore backups/backup-before-incident.sql
```

## 合规性

### GDPR / 数据保护

- ✅ 操作日志记录所有数据访问
- ✅ 可以追踪谁访问了什么数据
- ✅ 可以生成审计报告

### SOC 2 / 安全审计

- ✅ 强制认证
- ✅ 会话管理
- ✅ 操作日志
- ✅ 访问控制

## 常见问题

### Q: 忘记密码怎么办？

**A:** 密码存储在 `.env.local` 中，可以直接查看或修改：

```bash
grep UOOTD_CLI_PASSWORD .env.local
```

### Q: 会话过期太快？

**A:** 修改 `cli/index.ts` 中的 `SESSION_TIMEOUT`：

```typescript
const SESSION_TIMEOUT = 7200000; // 改为 2 小时
```

### Q: 如何禁用认证（开发环境）？

**A:** 不推荐，但如果必须：

```bash
# 在 .env.local 中添加
UOOTD_CLI_SKIP_AUTH="true"
```

然后修改 CLI 代码跳过认证检查。

### Q: 多人使用如何管理？

**A:** 为每个人创建不同的密码：

```bash
# 用户 A
UOOTD_CLI_PASSWORD_USER_A="password_a"

# 用户 B
UOOTD_CLI_PASSWORD_USER_B="password_b"
```

修改认证逻辑支持多密码。

## 总结

✅ **已实现的安全特性：**
- 密码认证
- 会话管理
- 操作日志
- 危险操作确认
- 文件权限保护

✅ **推荐的额外措施：**
- 使用强密码
- 定期更换密码
- 监控操作日志
- 限制文件权限
- 定期备份数据库

✅ **高级安全选项：**
- IP 白名单
- 时间窗口限制
- 双因素认证
- 操作频率限制

---

**安全级别：** 🔒🔒🔒 高
**最后更新：** 2026-03-04
