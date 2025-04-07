import fs from 'fs';
import {ethers} from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { mainLoop } from './main.js';

dotenv.config();

if (!process.env.REFERRAL_CODE) {
    console.error('❌ 请在 .env 文件中设置 REFERRAL_CODE');
    process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WALLET_FILE = path.join(__dirname, 'wallet.csv');

// 新增 sleep 方法
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function generateWallets(count = 1) {
    const wallets = [];

    for (let i = 0; i < count; i++) {
        const wallet = ethers.Wallet.createRandom();
        wallets.push({
            mnemonic: wallet.mnemonic.phrase,
            privateKey: wallet.privateKey,
            address: wallet.address
        });
    }

    return wallets;
}

function saveWallets(wallets, randomReferralCode) {
    try {
        let existingData = [];
        if (fs.existsSync(WALLET_FILE)) {
            const rawData = fs.readFileSync(WALLET_FILE, 'utf8');
            const lines = rawData.split('\n'); // 跳过表头
            existingData = lines.map(line => {
                const [address, privateKey, mnemonic, referral_code] = line.split(',');
                return { address, privateKey, mnemonic, referral_code };
            });
        }

        // 合并新旧数据
        const combinedData = [...existingData, ...wallets];

        if(wallets.length < 1){
            return;
        }
        // 写入合并后的数据
        const csvData = combinedData.map(w => `${w.address},${w.privateKey},${w.mnemonic},${randomReferralCode}`).join('\n');
        fs.writeFileSync(WALLET_FILE, `${csvData}`);
        console.log(`✅ 成功新增 ${wallets.length} 个钱包，当前总计邀请 ${combinedData.length} 个钱包`);
    } catch (error) {
        console.error('❌ 文件保存失败:', error.message);
        process.exit(1);
    }
}

async function main() {
    // 从 REFERRAL_CODE 中随机获取一个邀请码
    const referralCodes = JSON.parse(process.env.REFERRAL_CODE);
    for (const referralCode of referralCodes) {
        console.log(`🎁 本次使用的邀请码: ${referralCode}`);

        const walletCount = process.env.INVITE_COUNT;
        const wallets = generateWallets(parseInt(walletCount));

        const saveWallet = [];

        for (const wallet of wallets) {
            console.log('------------------------------');
            console.log(`🔑 钱包地址: ${wallet.address} 开始注册`);
            await mainLoop(wallet.privateKey, null, referralCode);
            console.log('------------------------------');
            saveWallet.push(wallet);
        }
        saveWallets(saveWallet, referralCode);
    }
    console.log('🛡️ 请妥善保管生成的助记词和私钥！');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    // 每小时执行一次（在整点执行）
    cron.schedule('0 * * * *', () => {
        console.log(chalk.cyan(`\n🕒 ${new Date().toLocaleString()} 开始执行邀请任务`));
        main();
    }, {
        timezone: "Asia/Shanghai"
    });

    // 立即执行一次
    console.log(chalk.cyan(`\n🕒 ${new Date().toLocaleString()} 立即执行邀请任务`));
    main();
}
