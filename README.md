# aiZoro 自动作图+任务机器人

邀请链接：https://ai.zoro.org?refCode=SsjS8-RcFDJBtnp

这是一个用于自动完成 aiZoro 平台每日上传图片任务及做任务的 Node.js 脚本。

## 功能特性
- 自动登录 aiZoro 平台
- 自动完成每日上传图片任务
- 支持多账号并发执行
- 支持代理设置
- 定时任务功能（默认每天北京时间早上8点执行）

## 使用说明

### 1. 环境准备
确保已安装 Node.js (建议版本 16+)

### 2. 安装依赖
```bash
npm install
```

### 3. 配置账号信息
在 `private_keys.txt` 文件中配置你的 Coresky 私钥（一行一个）。
```txt
private_key1
private_key2
...
```

在 `proxies.txt` 文件中配置你的 代理信息（一行一个）。
```txt
socks5://127.0.0.1:1080
...
```


### 4. 运行脚本(默认每天早上8点执行，推荐使用pm2启动)
```bash
node main.js # 直接运行
pm2 start main.js # 使用pm2启动

# 邀请
node invite.js # 直接运行
```
