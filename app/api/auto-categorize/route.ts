import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    // 在后台启动识别脚本（不等待完成）
    exec('npx tsx scripts/categorize-products.ts', { cwd: process.cwd() }, (error) => {
      if (error) {
        console.error('后台识别失败:', error);
      }
    });

    return NextResponse.json({
      success: true,
      message: '后台识别已启动'
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('启动识别失败:', error);
    return NextResponse.json({ error: 'Failed to start categorization' }, { status: 500, headers: corsHeaders });
  }
}
