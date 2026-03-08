#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { execSync } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fs from "fs";
import inquirer from "inquirer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(PROJECT_ROOT, ".env"), quiet: true });
dotenv.config({ path: path.join(PROJECT_ROOT, ".env.local"), override: true, quiet: true });

process.chdir(PROJECT_ROOT);

const program = new Command();

// ============================================
// 安全认证系统
// ============================================

const AUTH_TOKEN_FILE = path.join(process.env.HOME || "", ".uootd-auth");
const SESSION_TIMEOUT = 3600000; // 1 小时

interface AuthSession {
  token: string;
  expiresAt: number;
}

function getStoredPassword(): string | null {
  const password = process.env.UOOTD_CLI_PASSWORD;
  if (!password) {
    console.error(chalk.red("\n❌ 未设置 CLI 密码"));
    console.log(chalk.yellow("\n请在环境变量或项目根目录 .env.local 中设置:"));
    console.log(chalk.gray("   UOOTD_CLI_PASSWORD=your_secure_password\n"));
    process.exit(1);
  }
  return password;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function loadSession(): AuthSession | null {
  try {
    if (!fs.existsSync(AUTH_TOKEN_FILE)) return null;
    const data = fs.readFileSync(AUTH_TOKEN_FILE, "utf-8");
    const session: AuthSession = JSON.parse(data);

    if (Date.now() > session.expiresAt) {
      fs.unlinkSync(AUTH_TOKEN_FILE);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function saveSession(token: string): void {
  const session: AuthSession = {
    token,
    expiresAt: Date.now() + SESSION_TIMEOUT,
  };
  fs.writeFileSync(AUTH_TOKEN_FILE, JSON.stringify(session), { mode: 0o600 });
}

async function authenticate(): Promise<boolean> {
  // 检查是否有有效会话
  const session = loadSession();
  const storedPassword = getStoredPassword();
  const expectedToken = hashPassword(storedPassword!);

  if (session && session.token === expectedToken) {
    return true;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    saveSession(expectedToken);
    return true;
  }

  // 需要重新认证
  console.log(chalk.yellow("\n🔐 需要认证才能使用 CLI 工具\n"));

  let answers: { password: string };

  try {
    answers = await inquirer.prompt([
      {
        type: "password",
        name: "password",
        message: "请输入 CLI 密码:",
        mask: "*",
      },
    ]);
  } catch {
    console.error(chalk.red("\n❌ 认证已取消\n"));
    return false;
  }

  const inputToken = hashPassword(answers.password);

  if (inputToken === expectedToken) {
    saveSession(inputToken);
    console.log(chalk.green("\n✅ 认证成功\n"));
    return true;
  } else {
    console.error(chalk.red("\n❌ 密码错误\n"));
    return false;
  }
}

async function requireAuth(): Promise<void> {
  const authenticated = await authenticate();
  if (!authenticated) {
    process.exit(1);
  }
}

function logOperation(operation: string, details?: any): void {
  const logFile = path.join(PROJECT_ROOT, ".uootd-operations.log");
  const timestamp = new Date().toISOString();
  const user = process.env.USER || "unknown";
  const logEntry = `[${timestamp}] ${user}: ${operation} ${details ? JSON.stringify(details) : ""}\n`;

  fs.appendFileSync(logFile, logEntry);
}

async function confirmDangerousOperation(message: string): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: chalk.yellow(`⚠️  ${message}`),
      default: false,
    },
  ]);

  return answers.confirmed;
}

// ============================================
// 程序配置
// ============================================

program
  .name("uootd")
  .description("UOOTD Luxury Shop CLI - 管理工具（需要认证）")
  .version("1.0.0")
  .hook("preAction", async () => {
    // 跳过认证的命令
    const skipAuthCommands = ["help", "version", "logout"];
    const command = process.argv[2];

    if (!skipAuthCommands.includes(command)) {
      await requireAuth();
    }
  });

// ============================================
// 认证管理命令
// ============================================

program
  .command("logout")
  .description("登出并清除会话")
  .action(() => {
    if (fs.existsSync(AUTH_TOKEN_FILE)) {
      fs.unlinkSync(AUTH_TOKEN_FILE);
      console.log(chalk.green("\n✅ 已登出\n"));
    } else {
      console.log(chalk.yellow("\n⚠️  没有活动会话\n"));
    }
  });

program
  .command("whoami")
  .description("显示当前用户信息")
  .action(() => {
    const session = loadSession();
    const user = process.env.USER || "unknown";

    console.log(chalk.blue("\n👤 当前用户信息:\n"));
    console.log(`   用户: ${chalk.green(user)}`);
    console.log(`   会话: ${session ? chalk.green("已认证") : chalk.red("未认证")}`);

    if (session) {
      const expiresIn = Math.floor((session.expiresAt - Date.now()) / 60000);
      console.log(`   过期时间: ${chalk.yellow(expiresIn)} 分钟后\n`);
    } else {
      console.log("");
    }
  });

// ============================================
// 产品管理命令
// ============================================

const products = program.command("products").description("产品管理");

products
  .command("optimize")
  .description("AI 优化产品数据（批量处理）")
  .option("-a, --all", "一次性处理所有产品")
  .option("-b, --batch <size>", "批量大小", "10")
  .action(async (options) => {
    const confirmed = await confirmDangerousOperation(
      "AI 优化会消耗 API 额度，确认继续？"
    );

    if (!confirmed) {
      console.log(chalk.yellow("\n⏹️  操作已取消\n"));
      return;
    }

    console.log(chalk.blue("🤖 启动 AI 产品优化...\n"));
    logOperation("products:optimize", options);

    const script = options.all
      ? "scripts/ai-optimize-products.ts"
      : "scripts/ai-optimize-batch.ts";

    try {
      execSync(`npx tsx ${script}`, {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });
    } catch (error) {
      console.error(chalk.red("\n❌ 优化失败"));
      logOperation("products:optimize:failed", { error: String(error) });
      process.exit(1);
    }
  });

products
  .command("check")
  .description("检查产品数据质量")
  .action(() => {
    console.log(chalk.blue("🔍 检查数据质量...\n"));
    logOperation("products:check");

    try {
      execSync("npx tsx scripts/check-data-integrity.ts", {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });
    } catch (error) {
      console.error(chalk.red("\n❌ 检查失败"));
      process.exit(1);
    }
  });

products
  .command("list")
  .description("列出所有产品")
  .option("-l, --limit <number>", "限制数量", "20")
  .option("-b, --brand <slug>", "按品牌筛选")
  .option("-c, --category <slug>", "按分类筛选")
  .action(async (options) => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    logOperation("products:list", options);

    try {
      const where: any = { isActive: true };
      if (options.brand) where.brand = { slug: options.brand };
      if (options.category) where.category = { slug: options.category };

      const products = await prisma.product.findMany({
        where,
        include: { brand: true, category: true },
        take: parseInt(options.limit),
        orderBy: { createdAt: "desc" },
      });

      console.log(chalk.blue(`\n📦 找到 ${products.length} 个产品:\n`));

      products.forEach((p, i) => {
        console.log(
          `${i + 1}. ${chalk.green(p.titleEn)} ${chalk.gray(`(${p.slug})`)}`
        );
        console.log(
          `   品牌: ${p.brand?.name || "无"} | 分类: ${p.category?.nameEn || "无"} | 价格: $${p.price}`
        );
        console.log("");
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(chalk.red("❌ 查询失败:"), error);
      process.exit(1);
    }
  });

products
  .command("scrape <url>")
  .description("从网址采集商品并自动上传")
  .option("--no-ai", "禁用 AI 识别")
  .action(async (url, options) => {
    console.log(chalk.blue(`\n🕷️  开始采集商品: ${url}\n`));
    logOperation("products:scrape", { url, ...options });

    try {
      // 调用本地 API 导入商品
      const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const response = await fetch(`${apiUrl}/api/import-product`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: url,
          enableAI: options.ai !== false,
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log(chalk.green("\n✅ 商品采集成功!\n"));
        console.log(`   产品 ID: ${result.productId}`);
        console.log(`   Slug: ${result.slug}`);
        console.log(`   分类: ${result.category}`);
        console.log("");
      } else {
        console.error(chalk.red(`\n❌ 采集失败: ${result.error}\n`));
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red("\n❌ 采集失败:"), error);
      process.exit(1);
    }
  });

products
  .command("scrape-batch <file>")
  .description("批量采集商品（从文件读取 URL 列表）")
  .option("--no-ai", "禁用 AI 识别")
  .action(async (file, options) => {
    console.log(chalk.blue(`\n🕷️  批量采集商品: ${file}\n`));
    logOperation("products:scrape-batch", { file, ...options });

    try {
      const fs = await import("fs");
      const content = fs.readFileSync(file, "utf-8");
      const urls = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));

      console.log(chalk.blue(`📋 找到 ${urls.length} 个 URL\n`));

      let success = 0;
      let failed = 0;

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        console.log(chalk.gray(`[${i + 1}/${urls.length}] ${url}`));

        try {
          const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
          const response = await fetch(`${apiUrl}/api/import-product`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceUrl: url,
              enableAI: options.ai !== false,
            }),
          });

          const result = await response.json();

          if (result.success) {
            console.log(chalk.green(`   ✅ 成功: ${result.slug}\n`));
            success++;
          } else {
            console.log(chalk.red(`   ❌ 失败: ${result.error}\n`));
            failed++;
          }
        } catch (error) {
          console.log(chalk.red(`   ❌ 错误: ${error}\n`));
          failed++;
        }

        // 延迟避免请求过快
        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(chalk.blue("\n📊 批量采集完成:\n"));
      console.log(`   成功: ${chalk.green(success)}`);
      console.log(`   失败: ${chalk.red(failed)}`);
      console.log("");
    } catch (error) {
      console.error(chalk.red("\n❌ 批量采集失败:"), error);
      process.exit(1);
    }
  });

// ============================================
// 品牌管理命令
// ============================================

const brands = program.command("brands").description("品牌管理");

brands
  .command("list")
  .description("列出所有品牌")
  .action(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    logOperation("brands:list");

    try {
      const brands = await prisma.brand.findMany({
        where: { isActive: true },
        include: {
          _count: { select: { products: true } },
        },
        orderBy: { name: "asc" },
      });

      console.log(chalk.blue(`\n🏷️  找到 ${brands.length} 个品牌:\n`));

      brands.forEach((b, i) => {
        console.log(
          `${i + 1}. ${chalk.green(b.name)} ${chalk.gray(`(${b.slug})`)}`
        );
        console.log(`   产品数: ${b._count.products}`);
        console.log("");
      });

      await prisma.$disconnect();
    } catch (error) {
      console.error(chalk.red("❌ 查询失败:"), error);
      process.exit(1);
    }
  });

brands
  .command("create <name>")
  .description("创建新品牌")
  .option("-s, --slug <slug>", "自定义 slug")
  .action(async (name, options) => {
    const confirmed = await confirmDangerousOperation(
      `确认创建品牌 "${name}"？`
    );

    if (!confirmed) {
      console.log(chalk.yellow("\n⏹️  操作已取消\n"));
      return;
    }

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    const slug =
      options.slug ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    logOperation("brands:create", { name, slug });

    try {
      const brand = await prisma.brand.create({
        data: { name, slug, isActive: true },
      });

      console.log(chalk.green("\n✅ 品牌创建成功!"));
      console.log(`   名称: ${brand.name}`);
      console.log(`   Slug: ${brand.slug}`);
      console.log(`   ID: ${brand.id}\n`);

      await prisma.$disconnect();
    } catch (error: any) {
      if (error.code === "P2002") {
        console.error(chalk.red("\n❌ 品牌已存在（slug 重复）"));
      } else {
        console.error(chalk.red("❌ 创建失败:"), error);
      }
      logOperation("brands:create:failed", { error: String(error) });
      process.exit(1);
    }
  });

// ============================================
// 数据库管理命令（危险操作）
// ============================================

const db = program.command("db").description("数据库管理");

db.command("migrate")
  .description("运行数据库迁移")
  .action(async () => {
    const confirmed = await confirmDangerousOperation(
      "数据库迁移可能会修改数据结构，确认继续？"
    );

    if (!confirmed) {
      console.log(chalk.yellow("\n⏹️  操作已取消\n"));
      return;
    }

    console.log(chalk.blue("🗄️  运行数据库迁移...\n"));
    logOperation("db:migrate");

    try {
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });
      console.log(chalk.green("\n✅ 迁移完成"));
    } catch (error) {
      console.error(chalk.red("\n❌ 迁移失败"));
      logOperation("db:migrate:failed", { error: String(error) });
      process.exit(1);
    }
  });

db.command("studio")
  .description("打开 Prisma Studio")
  .action(() => {
    console.log(chalk.blue("🎨 启动 Prisma Studio...\n"));
    logOperation("db:studio");

    execSync("npx prisma studio", {
      stdio: "inherit",
      cwd: PROJECT_ROOT,
    });
  });

db.command("backup")
  .description("备份数据库")
  .action(() => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql`;

    console.log(chalk.blue(`💾 备份数据库到 ${filename}...\n`));
    logOperation("db:backup", { filename });

    try {
      execSync(`mkdir -p backups && pg_dump $DATABASE_URL > backups/${filename}`, {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
        shell: "/bin/bash",
      });
      console.log(chalk.green(`\n✅ 备份完成: backups/${filename}`));
    } catch (error) {
      console.error(chalk.red("\n❌ 备份失败"));
      logOperation("db:backup:failed", { error: String(error) });
      process.exit(1);
    }
  });

// ============================================
// AI 命令
// ============================================

const ai = program.command("ai").description("AI 工具");

ai.command("test")
  .description("测试 AI API 连接")
  .action(() => {
    console.log(chalk.blue("🧪 测试 AI 连接...\n"));
    logOperation("ai:test");

    try {
      execSync("npx tsx scripts/test-ai-connection.ts", {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });
    } catch (error) {
      console.error(chalk.red("\n❌ 测试失败"));
      process.exit(1);
    }
  });

ai.command("status")
  .description("查看 AI 优化进度")
  .action(() => {
    const progressFile = path.join(PROJECT_ROOT, ".ai-optimization-progress.json");

    if (!fs.existsSync(progressFile)) {
      console.log(chalk.yellow("\n⚠️  没有找到进度文件"));
      console.log(chalk.gray("   运行 'uootd products optimize' 开始优化\n"));
      return;
    }

    const progress = JSON.parse(fs.readFileSync(progressFile, "utf-8"));

    console.log(chalk.blue("\n📊 AI 优化进度:\n"));
    console.log(`   已处理: ${chalk.green(progress.processedIds.length)} 个产品`);
    console.log(`   成功: ${chalk.green(progress.stats.success)}`);
    console.log(`   失败: ${chalk.red(progress.stats.failed)}`);
    console.log(`   跳过: ${chalk.yellow(progress.stats.skipped)}`);
    console.log(`   最后更新: ${progress.lastProcessedAt}\n`);
  });

ai.command("reset")
  .description("重置 AI 优化进度")
  .action(async () => {
    const confirmed = await confirmDangerousOperation(
      "确认重置 AI 优化进度？这将从头开始处理所有产品。"
    );

    if (!confirmed) {
      console.log(chalk.yellow("\n⏹️  操作已取消\n"));
      return;
    }

    const progressFile = path.join(PROJECT_ROOT, ".ai-optimization-progress.json");
    logOperation("ai:reset");

    if (fs.existsSync(progressFile)) {
      fs.unlinkSync(progressFile);
      console.log(chalk.green("\n✅ 进度已重置\n"));
    } else {
      console.log(chalk.yellow("\n⚠️  没有找到进度文件\n"));
    }
  });

// ============================================
// 开发命令
// ============================================

const dev = program.command("dev").description("开发工具");

dev
  .command("start")
  .description("启动开发服务器")
  .action(() => {
    console.log(chalk.blue("🚀 启动开发服务器...\n"));
    logOperation("dev:start");

    execSync("npm run dev", {
      stdio: "inherit",
      cwd: PROJECT_ROOT,
    });
  });

dev
  .command("build")
  .description("构建生产版本")
  .action(() => {
    console.log(chalk.blue("🔨 构建生产版本...\n"));
    logOperation("dev:build");

    try {
      execSync("npm run build", {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });
      console.log(chalk.green("\n✅ 构建完成"));
    } catch (error) {
      console.error(chalk.red("\n❌ 构建失败"));
      process.exit(1);
    }
  });

// ============================================
// 部署命令（危险操作）
// ============================================

program
  .command("deploy")
  .description("一键部署（迁移 + AI 优化）")
  .option("--skip-ai", "跳过 AI 优化")
  .action(async (options) => {
    const confirmed = await confirmDangerousOperation(
      "部署会运行数据库迁移和 AI 优化，确认继续？"
    );

    if (!confirmed) {
      console.log(chalk.yellow("\n⏹️  操作已取消\n"));
      return;
    }

    console.log(chalk.blue("🚀 开始部署...\n"));
    logOperation("deploy", options);

    try {
      console.log(chalk.blue("📝 [1/3] 运行数据库迁移..."));
      execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });

      console.log(chalk.blue("\n🔄 [2/3] 生成 Prisma Client..."));
      execSync("npx prisma generate", {
        stdio: "inherit",
        cwd: PROJECT_ROOT,
      });

      if (!options.skipAi) {
        console.log(chalk.blue("\n🤖 [3/3] 运行 AI 优化..."));
        execSync("npx tsx scripts/ai-optimize-batch.ts", {
          stdio: "inherit",
          cwd: PROJECT_ROOT,
        });
      } else {
        console.log(chalk.yellow("\n⏭️  [3/3] 跳过 AI 优化"));
      }

      console.log(chalk.green("\n✅ 部署完成!\n"));
    } catch (error) {
      console.error(chalk.red("\n❌ 部署失败"));
      logOperation("deploy:failed", { error: String(error) });
      process.exit(1);
    }
  });

// ============================================
// 统计命令
// ============================================

program
  .command("stats")
  .description("显示网站统计信息")
  .action(async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    logOperation("stats");

    try {
      const [
        totalProducts,
        totalBrands,
        totalCategories,
        totalVariants,
        productsWithBrand,
        productsWithVariants,
      ] = await Promise.all([
        prisma.product.count(),
        prisma.brand.count({ where: { isActive: true } }),
        prisma.category.count({ where: { status: "ACTIVE" } }),
        prisma.productVariant.count(),
        prisma.product.count({ where: { brandId: { not: null } } }),
        prisma.product.count({ where: { variants: { some: {} } } }),
      ]);

      console.log(chalk.blue("\n📊 网站统计:\n"));
      console.log(`   产品总数: ${chalk.green(totalProducts)}`);
      console.log(`   品牌数: ${chalk.green(totalBrands)}`);
      console.log(`   分类数: ${chalk.green(totalCategories)}`);
      console.log(`   变体数: ${chalk.green(totalVariants)}`);
      console.log(
        `   有品牌的产品: ${chalk.green(productsWithBrand)} (${Math.round((productsWithBrand / totalProducts) * 100)}%)`
      );
      console.log(
        `   有变体的产品: ${chalk.green(productsWithVariants)} (${Math.round((productsWithVariants / totalProducts) * 100)}%)`
      );
      console.log("");

      await prisma.$disconnect();
    } catch (error) {
      console.error(chalk.red("❌ 查询失败:"), error);
      process.exit(1);
    }
  });

program.parse();
