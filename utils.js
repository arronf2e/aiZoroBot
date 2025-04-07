let chalk;
import('chalk').then(module => {
    chalk = module.default;
}).catch(err => {
    console.error('Failed to import chalk:', err);
    process.exit(1);
});

const thread_delay = 30; // 随机延迟 0 到 30 秒
const thread_count = 5; // 线程数量
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms)); // 休眠函数
const log = msg => {
    const time = new Date().toLocaleTimeString();
    console.log(`${chalk.gray(`[${time}]`)} ${msg}`);
}

module.exports = {
    thread_delay,
    thread_count,
    sleep,
    log
};
