import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { Bot } from './bot.js';
import { thread_count, thread_delay, log, sleep } from './utils.js';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 读取私钥和csv中的私钥
const PRIVATE_KEYS = (() => {
  try {
    // 读取 private_keys.txt
    const privateKeys = fs.readFileSync(path.join(__dirname, 'private_keys.txt'), 'utf8')
      .split('\n').map(l => l.trim()).filter(l => l).map(key => {
        return {
          privateKey: key,
          referral_code: process.env.REFERRAL_CODE[0]
        }
      });

    // 读取 wallet.csv
    if (fs.existsSync(path.join(__dirname, 'wallet.csv'))) {
      const csvData = fs.readFileSync(path.join(__dirname, 'wallet.csv'), 'utf8')
        .split('\n'); // 跳过表头
      const walletKeys = csvData.filter(l => l)?.map(line => {
        return {
          privateKey: line.split(',')[1],
          referral_code: line.split(',')[3]
        }
      });
      return [...privateKeys, ...walletKeys];
    }

    return privateKeys;
  } catch (error) {
    console.error(chalk.red('读取私钥文件失败:'), error.message);
    return [];
  }
})();

const PROXY_URLS = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, 'proxies.txt'), 'utf8')
      .split('\n').map(l => l.trim()).filter(l => l);
  } catch (error) {
    console.error(chalk.red('读取代理文件失败:'), error.message);
    return [];
  }
})();

// 核心业务流程
export async function mainLoop(privateKey, proxy, referral_code) {
    try {
        log(chalk.yellow(`⇄ 开始登录...，使用代理 ${proxy || '无'}`));
        const worker = new Bot(privateKey, proxy, referral_code);
        await worker.login();
        await sleep(1000)
        await worker.getMe();
        await worker.getScoreboard();
        await sleep(5000)
        await worker.checkIn();
        await sleep(2000)
        await worker.getMe();
        await worker.getScoreboard();
        await worker.getMissonOnboard();
        await sleep(5000)
        await worker.getProfileTasks();
    } catch (error) {
        console.log(error, 'error')
        log(chalk.red(`流程错误: ${error.data}`));
    }
}

async function startTask() {
  let currentIndex = 0;
  const maxThreads = thread_count || 5;
  const maxsleep = thread_delay || 60;

  // 创建线程池
  const workerPromises = [];
  while (currentIndex < PRIVATE_KEYS.length) {
    const batch = PRIVATE_KEYS.slice(currentIndex, currentIndex + maxThreads);
    // 为当前批次创建 Promise 数组
    const batchPromises = batch.map((pk, i) => {
      const sleepTime = Math.random() * maxsleep * 1000;
      return new Promise(resolve => setTimeout(resolve, sleepTime))
        .then(async () => {
          const proxy = PROXY_URLS?.length > 0 ? PROXY_URLS[currentIndex % PROXY_URLS.length] : null;
          await mainLoop(pk.privateKey, proxy, pk.referral_code)
        });
    });

    // 执行当前批次的任务
    await Promise.all(batchPromises);
    console.log(chalk.green(`✅ 已完成第 ${Math.ceil(currentIndex / maxThreads) + 1} 批任务`));
    
    // 更新索引
    currentIndex += maxThreads;
  }

  // 等待所有线程完成
  await Promise.all(workerPromises);
  console.log(chalk.green('✅ 所有任务已完成'));
}

// 主程序启动
if (process.env.PM2 || import.meta.url === `file://${process.argv[1]}`) {
  console.log(chalk.bold.green("=================== Aizoro 自动机器人 ==================="));
  
  if (!PRIVATE_KEYS.length) {
    console.log(chalk.red("❌ 未找到有效私钥，请创建 private_keys.txt 文件"));
    process.exit(1);
  }

  // 添加定时任务
  // 默认每天北京时间早上9点执行
  cron.schedule("0 9 * * *", () => {
    console.log(chalk.cyan(`\n🕒 ${new Date().toLocaleString()} 触发定时任务`));
    startTask();
  }, {
    scheduled: true,
    timezone: "Asia/Shanghai"
  });

  // 立即执行一次
  startTask();
}
