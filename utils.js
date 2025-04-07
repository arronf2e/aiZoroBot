import chalk from 'chalk';

export const thread_delay = 30; // 随机延迟 0 到 30 秒
export const thread_count = 5; // 线程数量
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms)); // 休眠函数
export const log = msg => {
    const time = new Date().toLocaleTimeString();
    console.log(`${chalk.gray(`[${time}]`)} ${msg}`);
}
