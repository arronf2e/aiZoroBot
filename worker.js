import { workerData, parentPort } from 'worker_threads';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ethers } from 'ethers';
import axios from 'axios';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import { generate } from 'random-username-generator';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 工具函数
const log = msg => {
    const time = new Date().toLocaleTimeString();
    parentPort.postMessage(`${chalk.gray(`[${time}]`)} ${msg}`);
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const THREAD_DELAY = Math.random() * (workerData.MAX_THREAD_DELAY) * 1000; // 随机延迟 0-60 秒

const PROJECT_ID = '9028bb8f-29c1-4740-a229-2cfc1a3460ef'

// 核心业务流程
async function mainLoop() {
    try {
        log(chalk.yellow(`⇄ 开始登录...，使用代理 ${workerData.proxy || '无'}`));
        const worker = new Worker(workerData);
        await worker.login();
        await delay(1000)
        await worker.getMe();
        await worker.getScoreboard();
        await delay(5000)
        await worker.checkIn();
        await delay(2000)
        await worker.getMe();
        await worker.getScoreboard();
        await worker.getMissonOnboard();
        await delay(5000)
        await worker.getProfileTasks();
    } catch (error) {
        console.log(error, 'error')
        log(chalk.red(`流程错误: ${error.data}`));
    }
}

function createApiClient(token, proxy) {
    const axiosConfig = {
        baseURL: workerData.base.api_base_url,
        headers: {
            "accept": "*/*",
            "accept-language": "zh-CN,zh;q=0.9",
            "priority": "u=1, i",
            "sec-ch-ua": "\"Chromium\";v=\"134\", \"Not:A-Brand\";v=\"24\", \"Google Chrome\";v=\"134\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"macOS\"",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-site",
            "origin": "https://ai.zoro.org",
            "referer": "https://ai.zoro.org/",
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0',
            "authorization": `Bearer ${token}`,
        }
    };

    if (proxy) {
        const isSocksProxy = proxy.includes('socks');
        // Use the appropriate agent based on the proxy type
        if (isSocksProxy) {
            axiosConfig.httpAgent = new SocksProxyAgent(proxy);
            axiosConfig.httpsAgent = new SocksProxyAgent(proxy);
        } else {
            axiosConfig.httpAgent = new HttpsProxyAgent(proxy);
            axiosConfig.httpsAgent = new HttpsProxyAgent(proxy);
        }
    }

    return axios.create(axiosConfig);
}

class Worker {
    constructor(workerData) {
        this.workerData = workerData;
        this.wallet = new ethers.Wallet(workerData.privateKey);
        this.client = createApiClient("", workerData.proxy);
        log(chalk.yellow(`👛 钱包 ${this.wallet.address.slice(0, 6)}... 开始运行`));
    }

    async login(message = '', signature = '', token = '') {
        // 登录逻辑
        log(chalk.green(message ? `🔐 开始登录中...` : `🔐 获取登录message中...`));
        let loginUrl = `/user-auth/wallet/login-request?strategy=ETHEREUM_SIGNATURE&address=${this.wallet.address}`;
        if (message && signature && token) {
            loginUrl = `/user-auth/login?strategy=ETHEREUM_SIGNATURE&address=${this.wallet.address}&message=${message}&signature=${signature}&token=${token}&inviter=${workerData.base.referral_code}`;
        }
        const logRes = await this.client.get(loginUrl);
        log(chalk.green(message ? `🔐 ✅ 登录成功，已登录...` : `🔐 ✅ 登录 message 信息获取成功，准备登录...`));
        if (!message) {
            const message = logRes.data?.message;
            const token = logRes.data?.token;
            const signature = await this.wallet.signMessage(message);
            await delay(2000)
            await this.login(message, signature, token);
        } else {
            this.client = createApiClient(logRes.data?.tokens?.access_token, this.workerData.proxy);
            if (!logRes.data?.user?.nickname) {
                await this.setUserName();
            }
        }
    }

    async setUserName() {
        // 有点问题，待修复
        log(chalk.green(`⏳ 设置用户名...`));
        try {
            const randomName = `${generate()}${Math.floor(Math.random() * 10000)}`;
            await this.client.get(`/user/check-nickname/${randomName}`);
            await this.client.post(`/user/set-nickname?nickname=${randomName}`);
            log(chalk.green(` ✅ 用户名设置成功，用户名：${response?.user?.nickname}`));
        } catch (error) {
            console.error('设置用户名失败:', error.response?.status, error.response?.data || error.message);
            return null;
        }
    }

    async checkIn() {
        log(chalk.green(`⏳ 检查当天签到信息...`));
        try {
            const response = await this.client.get('/daily-rewards/today-info');
            if (response.todayClaimed) {
                log(chalk.green(` ✅ 今日已签到，无需重复签到`));
                return;
            }
            await delay(2000)
            log(chalk.green(`⏳ 今日未签到，开始签到...`));
            // 有点问题，待修复 
            await this.client.post('/daily-rewards/claim', null, {
                headers: {
                    'content-length': '0'
                }
            });
            log(chalk.green(` ✅ 签到成功`));
        } catch (error) {
            console.error('签到失败:', error.response?.status, error.response?.data || error.message);
            return null;
        }
    }

    async getScoreboard() {
        log(chalk.green(`⏳ 获取积分排行榜...`));
        try {
            const response = await this.client.get('/scoreboard/me');
            const result = response.data;
            log(chalk.green(` ✅ 用户名：${result?.user?.nickname}，bsc地址：${result?.user?.bscAddress}，排名：${result?.rank}，余额：${result?.balance}，邀请码：${result?.user?.refCode}`));
        } catch (error) {
            console.error('获取积分排行榜信息失败:', error.response?.status, error.response?.data || error.message);
        }
    }

    async getMe() {
        log(chalk.green(`⏳ 获取用户信息...`));
        try {
            const response = await this.client.get('/boost/me?game=false');
            // log(chalk.green(` ✅ 用户名：${response?.nickname}，积分：${response?.points?.bscAddress}`));
        } catch (error) {
            console.error('获取用户信息失败:', error.response?.status, error.response?.data || error.message);
        }
    }

    async getMissonOnboard() {
        log(chalk.green(`⏳ 检测onboard任务状态...`));
        try {
            const response = await this.client.get(`/mission-onboard?id=${PROJECT_ID}`);
            const result = response.data;
            for (const item of result) {
                const { progress, total, label } = item;
                if (progress === total) {
                    log(chalk.green(` ✅ ${label} 任务已完成，无需执行`));
                    continue;
                }
                if (progress < total) {
                    log(chalk.green(` ✅ ${label} 任务未完成，开始执行任务... ${progress + 1}/${total}`));
                    await delay(2000)
                    const id = await this.getUploadId();
                    await this.doMissionOnboard(label, id);
                }
            }
        } catch (error) {
            console.error('检测onboard任务执行失败:', error.response?.status, error.response?.data || error.message);
            return null;
        }
    }

    async getUploadId() {
        log(chalk.green(`⏳ 获取文件上传id...`));
        try {
            const response = await this.client.get(`/mission-onboard/${PROJECT_ID}/missions?pagination%5Bfrom%5D=0&pagination%5Bto%5D=0&filter%5Bhidden%5D=false`);
            return response?.data?.data?.[0]?.id;
        } catch (error) {
            console.error('获取文件上传id失败:', error.response?.status, error.response?.data || error.message);
        }
    }

    async getRandomImage() {
        try {
            const imagesDir = path.join(__dirname, 'images');
            // 获取images文件夹中的所有图片文件
            const files = fs.readdirSync(imagesDir).filter(file =>
                ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(file).toLowerCase())
            );

            if (files.length === 0) {
                log(chalk.red('❌ images文件夹中没有图片'));
                return null;
            }

            // 随机选择一张图片
            const randomFile = files[Math.floor(Math.random() * files.length)];
            const imagePath = path.join(imagesDir, randomFile);

            // 创建FormData并添加图片
            const formData = new FormData();
            formData.append('image', fs.createReadStream(imagePath), {
                filename: randomFile,
                contentType: 'image/jpeg'
            });

            return formData;
        } catch (error) {
            console.error('获取随机图片失败:', error.message);
            return null;
        }
    }

    async doMissionOnboard(label, uuid) {
        log(chalk.green(`⏳ 开始执行 ${label} 任务...`));
        try {
            const formData = await this.getRandomImage();
            await this.client.post(`/mission-activity/${uuid}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            log(chalk.green(` ✅ ${label} 任务执行成功`));
            await delay(10000)
            await this.getMissonOnboard(); // 任务完成后再次检查任务执行状态
        } catch (error) {
            console.error('执行onboard任务失败:', error.response?.status, error.response?.data || error.message);
        }
    }

    async getProfileTasks() {
        // 获取模型列表逻辑
        log(chalk.green(`⏳ 加载社交任务...`));
        try {
            const response = await this.client.get('/missions', {
                params: {
                    'filter[progress]': true,
                    'filter[rewards]': true,
                    'filter[completedPercent]': true,
                    'filter[hidden]': false,
                    'filter[target]': 'WEB',
                    'filter[date]': new Date().toISOString(),
                    'filter[grouped]': true,
                    'filter[status]': 'AVAILABLE',
                    'filter[excludeCategories]': ['REFERRALS', 'LEARNING_ONBOARDING']
                }
            });

            const tasks = response.data?.data;
            log(chalk.green(` ✅ 成功加载 ${tasks.length} 个社交任务`));
            for (const task of tasks) {
                const { id, label, progress, translateKey, description } = task;
                if (progress !== '0') {
                    log(chalk.green(` ✅ ${label} 任务已完成，无需执行`));
                    continue;
                }
                if (translateKey === 'connectTwitter') {
                    log(chalk.green(` 🔐 ${label} 任务需要手动绑定，无法执行`));
                    continue;
                }
                if (description === 'Link your cryptocurrency TON wallet') {
                    log(chalk.green(` 🔐 ${label} 任务需要手动绑定，无法执行`));
                    continue;
                }
                await this.doProfileTask(label, id); // 调用方法来执行任务
                await delay(10000) // 等待10秒后再加载下一个任务，避免触发Ratelimit
            }

        } catch (error) {
            console.error('加载社交任务失败:', error.response?.status, error.response?.data || error.message);
            return null;
        }
    }

    async doProfileTask(label, id) {
        log(chalk.green(`⏳ 开始执行社交任务：${label}...`));
        try {
            await this.client.post(`/mission-activity/${id}`);
            log(chalk.green(` ✅ 社交任务：${label}执行成功`));
        } catch (error) {
            console.error(`社交任务：${label}执行失败:`, error.response?.status, error.response?.data || error.message);
            return null;
        }
    }
}

async function startWithDelay() {
    log(chalk.yellow(`⏳ 线程将在 ${(THREAD_DELAY / 1000).toFixed(1)} 秒后开始...`));
    // await new Promise(resolve => setTimeout(resolve, THREAD_DELAY));
    mainLoop();
}

// 替换原来的启动命令
startWithDelay();
