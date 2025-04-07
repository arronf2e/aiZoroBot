import { ethers } from 'ethers';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import FormData from 'form-data';
import { generate } from 'random-username-generator';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { log, sleep } from './utils.js';



const __dirname = path.dirname(fileURLToPath(import.meta.url));


const api_base_url = "https://api.zoro.org"

const project_id = '9028bb8f-29c1-4740-a229-2cfc1a3460ef'

function createApiClient(token, proxy) {
    const axiosConfig = {
        baseURL: api_base_url,
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

export class Bot {
    constructor(privateKey, proxy, referral_code) {
        this.wallet = new ethers.Wallet(privateKey);
        this.client = createApiClient("", proxy);
        this.referral_code = referral_code;
        this.proxy = proxy;
        log(chalk.yellow(`👛 钱包 ${this.wallet.address}... 开始运行`));
    }

    async login(message = '', signature = '', token = '') {
        // 登录逻辑
        log(chalk.green(message ? `🔐 开始登录中...` : `🔐 获取登录message中...`));
        let loginUrl = `/user-auth/wallet/login-request?strategy=ETHEREUM_SIGNATURE&address=${this.wallet.address}`;
        if (message && signature && token) {
            loginUrl = `/user-auth/login?strategy=ETHEREUM_SIGNATURE&address=${this.wallet.address}&message=${message}&signature=${signature}&token=${token}&inviter=${this.referral_code}`;
        }
        const logRes = await this.client.get(loginUrl);
        log(chalk.green(message ? `🔐 ✅ 登录成功，已登录...` : `🔐 ✅ 登录 message 信息获取成功，准备登录...`));
        if (!message) {
            const message = logRes.data?.message;
            const token = logRes.data?.token;
            const signature = await this.wallet.signMessage(message);
            await sleep(2000)
            await this.login(message, signature, token);
        } else {
            this.client = createApiClient(logRes.data?.tokens?.access_token, this.proxy);
            if (!logRes.data?.user?.nickname) {
                await this.setUserName();
            }
        }
    }

    async setUserName() {
        log(chalk.green(`⏳ 设置用户名...`));
        try {
            const randomName = `${generate()}${Math.floor(Math.random() * 10000)}`;
            await this.client.get(`/user/check-nickname/${randomName}`);
            await this.client.post(`/user/set-nickname?nickname=${randomName}`);
            log(chalk.green(` ✅ 用户名设置成功，用户名：${randomName}`));
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
            await sleep(2000)
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
            await this.client.get('/boost/me?game=false');
            // log(chalk.green(` ✅ 用户名：${response?.nickname}，积分：${response?.points?.bscAddress}`));
        } catch (error) {
            console.error('获取用户信息失败:', error.response?.status, error.response?.data || error.message);
        }
    }

    async getMissonOnboard() {
        log(chalk.green(`⏳ 检测onboard任务状态...`));
        try {
            const response = await this.client.get(`/mission-onboard?id=${project_id}`);
            const result = response.data;
            for (const item of result) {
                const { progress, total, label } = item;
                if (progress === total) {
                    log(chalk.green(` ✅ ${label} 任务已完成，无需执行`));
                    continue;
                }
                if (progress < total) {
                    log(chalk.green(` ✅ ${label} 任务未完成，开始执行任务... ${progress + 1}/${total}`));
                    await sleep(2000)
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
            const response = await this.client.get(`/mission-onboard/${project_id}/missions?pagination%5Bfrom%5D=0&pagination%5Bto%5D=0&filter%5Bhidden%5D=false`);
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
        const maxRetries = 3; // 最大重试次数
        let retryCount = 0;
        
        do {
            try {
                const formData = await this.getRandomImage();
                await this.client.post(`/mission-activity/${uuid}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });
                log(chalk.green(` ✅ ${label} 任务执行成功`));
                await sleep(10000);
                await this.getMissonOnboard();
                return; // 成功则退出方法
            } catch (error) {
                retryCount++;
                if (retryCount <= maxRetries) {
                    const sleepTime = 2000 * retryCount; // 指数退避延迟
                    log(chalk.yellow(`⚠️ ${label} 任务执行失败（${retryCount}/${maxRetries}次重试）: ${error.message}，${sleepTime/1000}秒后重试...`));
                    await sleep(sleepTime);
                } else {
                    log(chalk.red(`❌ ${label} 任务最终失败，已尝试${maxRetries}次`));
                    console.error('执行onboard任务失败:', error.response?.status, error.response?.data || error.message);
                    break;
                }
            }
        } while (retryCount <= maxRetries);
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
                await sleep(10000) // 等待10秒后再加载下一个任务，避免触发Ratelimit
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
