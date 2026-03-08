// 直接使用 luxury-shop 的 sendEmail 函数发送测试邮件
import { sendEmail } from "../lib/email";
import fs from "fs";
import path from "path";

const templatePath = path.join(process.env.HOME!, "clawd", "scripts", "templates", "uootd-welcome-email.html");
const emailHtml = fs.readFileSync(templatePath, "utf-8");

const testRecipient = "Chengyadong1112@gmail.com";
const emailSubject = "Welcome to Uootd - Your Luxury Fashion Destination 🎁";

async function sendTestEmail() {
  console.log(`发送测试邮件到: ${testRecipient}`);
  
  try {
    await sendEmail({
      to: testRecipient,
      subject: emailSubject,
      html: emailHtml,
    });
    
    console.log("\n✅ 发送成功！");
    console.log("\n请检查邮箱:", testRecipient);
    console.log("- 检查收件箱");
    console.log("- 如果没收到，检查垃圾邮件文件夹");
    console.log("- 邮件主题:", emailSubject);
  } catch (error) {
    console.error("\n❌ 发送失败:", error);
    process.exit(1);
  }
}

sendTestEmail();
