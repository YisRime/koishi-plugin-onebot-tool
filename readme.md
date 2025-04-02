# koishi-plugin-onebot-tool

[![npm](https://img.shields.io/npm/v/koishi-plugin-onebot-tool?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-onebot-tool)

适用于 Onebot 的 QQ 工具集，提供自动点赞、个性化戳一戳响应和丰富的表情回复功能

## 主要功能

### 赞我功能

- 用户发送"赞我"后，机器人会给该用户点赞
- 支持管理点赞列表，可添加或移除用户
- 可配置是否开启回赞提醒功能
- 支持每日自动点赞功能

### 戳一戳响应

- 自定义戳一戳的回复内容
- 支持消息回复和命令执行两种响应方式
- 可设置不同响应的触发权重
- 防刷屏的时间间隔控制（可设置为0关闭限制）
- 支持通过命令主动戳一戳他人，可配置单次最大次数和间隔时间

### 表情回复功能

- 支持自动识别消息中的表情并作出回应
- 提供表情ID查询命令
- 支持发送随机表情

## 命令说明

### 赞我

- `zanwo` / `赞我` - 为自己点赞
- `zanwo.user @用户` - 为指定用户点赞
- `zanwo.list` - 查看当前点赞列表中的用户
- `zanwo.clear` - 清空点赞列表中的用户
- `zanwo.add @用户` - 添加指定用户到点赞列表
- `zanwo.remove @用户` - 从点赞列表移除指定用户
- `zanwo.all` - 立即执行对列表中所有用户的点赞

### 戳一戳

- `poke [次数]` - 发送戳一戳给自己，可指定次数
- `poke [用户]` - 戳指定用户一次
- `poke [次数] [用户]` - 戳指定用户多次
  - 例如：`poke 3 @12345` - 戳用户12345三次

### 表情回复

- `stick [表情ID/名称]` - 使用指定表情回复消息
  - 例如：`stick 76,77` - 使用ID为76和77的表情回复
  - 例如：`stick 赞,踩` - 使用名称为赞和踩的表情回复
- `stick.random [数量]` - 回复随机表情，默认发送20个
- `stick.search [关键词]` - 搜索包含关键词的表情
  - 例如：`stick.search 龙` - 搜索包含"龙"的表情
    - `stick.search.list [页码]` - 查看支持的表情列表，分页显示

## 插件配置

```yaml
zanwo:
  adminAccount: ''       # 管理员QQ号
  adminOnly: true        # 仅管理员可配置列表
  enableNotify: false    # 开启回赞提醒
  autoLike: true         # 启用每日自动点赞

poke:
  enabled: true          # 是否启用戳一戳功能
  interval: 1000         # 触发冷却时间(ms)，设置为0关闭限制
  cdTime: 10             # 命令冷却时间(秒)，设置为0关闭限制
  maxTimes: 3            # 单次戳一戳请求最大次数(1-200)
  actionInterval: 500    # 请求多次戳一戳之间的间隔(ms)
  enableStick: false     # 是否启用表情回复功能
  responses:
    - type: 'message'    # 类型：message(消息)或command(命令)
      content: '<at id={userId}/>你干嘛~'
      weight: 50         # 触发概率权重(0-100)
    - type: 'command'
      content: 'poke'
      weight: 50
```

## 使用方法

1. 安装插件后，直接发送"赞我"即可体验点赞功能
2. 戳一戳机器人会根据配置随机回应，可配置响应间隔（设置为0时关闭间隔限制）
3. 使用 `poke` 命令可以主动戳一戳用户，支持多种参数形式
4. 使用表情回复需要先在配置中启用该功能

## 常见问题

- 点赞功能依赖于平台API支持，部分 Onebot 实现可能不支持
- 如遇到权限问题，请确保机器人具有相应操作权限
- 表情ID在不同版本的QQ客户端可能略有差异
