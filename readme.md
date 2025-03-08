# koishi-plugin-onebot-tool

[![npm](https://img.shields.io/npm/v/koishi-plugin-onebot-tool?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-onebot-tool)

适用于 Onebot 的小工具, 包含赞我、戳一戳等功能

## 主要功能

### 赞我功能

- 用户发送"赞我"后，机器人会给该用户点赞
- 支持设置管理员账号进行权限管理
- 可配置是否开启回赞提醒功能
- 支持每日自动点赞功能

### 戳一戳响应

- 自定义戳一戳的回复内容
- 支持消息回复和命令执行两种响应方式
- 可设置不同响应的触发权重
- 防刷屏的时间间隔控制

## 插件配置

```yaml
zanwo:
  adminAccount: ''       # 管理员QQ号
  adminOnly: true        # 仅管理员可配置列表
  enableNotify: false    # 开启回赞提醒
  autoLike: true         # 启用每日自动点赞

poke:
  interval: 1000        # 触发冷却时间(ms)
  responses:
    - type: 'message'   # 类型：message(消息)或command(命令)
      content: '<at id={userId}/>戳你一下'
      weight: 50        # 触发概率权重(0-100)
    - type: 'command'
      content: 'poke'
      weight: 50
```

## 使用方法

1. 安装插件后，直接发送"赞我"即可体验点赞功能
2. 戳一戳机器人会根据配置随机回应

## 常见问题

- 点赞功能依赖于平台API支持，部分 Onebot 实现可能不支持
- 如遇到权限问题，请确保机器人具有相应操作权限
