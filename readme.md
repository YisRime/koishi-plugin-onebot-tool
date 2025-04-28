# koishi-plugin-onebot-tool

[![npm](https://img.shields.io/npm/v/koishi-plugin-onebot-tool?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-onebot-tool)

OneBot 工具集，实现自动点赞、拍一拍回应和丰富的表情回复，可自定义配置

## 主要功能

### 点赞

- 用户发送"赞我"后，机器人会给该用户点赞（单次默认点赞5次）
- 支持管理点赞列表，可添加或移除用户
- 支持每日自动点赞功能（基于 cron 或定时器）
- 自动撤回命令响应消息，保持聊天环境整洁

### 拍一拍响应

- 自定义拍一拍的回复内容
- 支持消息回复和命令执行两种响应方式
- 可设置不同响应的触发权重
- 防刷屏的时间间隔控制（可设置为0关闭限制）
- 支持通过命令主动拍一拍他人，可配置单次最大次数和间隔时间
- 丰富的占位符支持，实现个性化回复内容

#### 拍一拍占位符

在拍一拍响应中，可以使用以下占位符:

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `{at}` | 自动@触发拍一拍的用户 | `{at}不要拍我啦！` |
| `{username}` | 用户昵称/用户名 | `你好，{username}！` |
| `{hitokoto:参数}` | 随机一言（直接传递参数） | `{hitokoto:c=a&min_length=10}` |
| `{image:URL}` | 显示图片 | `{image:https://api.sretna.cn/api/anime.php}` |

一言参数请参考[一言API文档](https://developer.hitokoto.cn/sentence/)

### 表情回复功能

- 支持多种表情响应模式：
  - 关闭：不启用表情回应功能
  - 仅关键词：仅对配置的关键词进行表情回应
  - 仅同表情：仅对消息中包含的表情进行同表情回应
  - 二者：同时支持关键词和表情响应
- 支持通过关键词触发特定表情回应，可配置多个关键词和表情映射
- 自动识别消息中的表情元素并添加相应表情回应
- 提供表情ID查询和搜索功能
- 支持发送随机表情和多个表情组合
- 支持超过100种QQ表情，支持数字ID和名称两种引用方式

## 命令说明

### 赞我

- `zanwo` / `赞我` - 为自己点赞（单次点赞5次）
- `zanwo.user @用户` - 为指定用户点赞（支持@和QQ号两种格式）
- `zanwo.list` - 查看当前点赞列表中的用户（需要权限等级3）
- `zanwo.add @用户` - 添加指定用户到点赞列表（需要权限等级2）
- `zanwo.remove @用户` - 从点赞列表移除指定用户（需要权限等级2）
- `zanwo.all` - 立即执行对列表中所有用户的点赞（需要权限等级3）
- `zanwo.clear` - 清空点赞列表中的用户（需要权限等级4）

### 拍一拍

- `poke [次数]` - 发送拍一拍给自己，可指定次数
- `poke [用户]` - 拍指定用户一次
- `poke [次数] [用户]` - 拍指定用户多次
  - 例如：`poke 3 @12345` - 拍用户12345三次

### 表情回复

- `stick [表情ID/名称]` - 使用指定表情回复消息
  - 例如：`stick 76,77` - 使用ID为76和77的表情回复
  - 例如：`stick 赞,踩` - 使用名称为赞和踩的表情回复
- `stick.random [数量]` - 回复随机表情，可指定数量（最多20个）
- `stick.search [关键词]` - 搜索包含关键词的表情
  - 例如：`stick.search 龙` - 搜索包含"龙"的表情
- `stick.list [页码]` - 查看支持的表情列表，分页显示

## 插件配置

```yaml
autoLike: true         # 启用每日自动点赞
stickMode: 'off'       # 表情回复模式：'off'(关闭)、'keyword'(仅关键词)、'emoji'(仅同表情)、'all'(二者)
enabled: true          # 启用自动响应拍一拍
interval: 1000         # 拍一拍响应间隔(ms)，设置为0关闭限制
cdTime: 10             # 命令冷却时间(秒)，设置为0关闭限制
maxTimes: 3            # 单次拍一拍最大次数(1-200)
actionInterval: 500    # 连续拍一拍间隔(ms)
keywordEmojis:         # 关键词触发的表情回应配置
  - keyword: '点赞'     # 触发关键词
    emojiId: '76'      # 表情ID或名称
responses:             # 拍一拍响应列表
  - type: 'message'    # 类型：message(消息)或command(命令)
    content: '{at}你干嘛~{username}！'
    weight: 0          # 触发概率权重(0-100)
  - type: 'message'
    content: '{hitokoto}'
    weight: 0
  - type: 'message'
    content: '{image:https://api.sretna.cn/api/anime.php}'
    weight: 0
  - type: 'command'
    content: 'poke'
    weight: 100
```

## 使用方法

1. 发送"赞我"即可体验点赞功能
2. 拍一拍机器人会根据配置随机回应，可配置响应间隔（设置为0时关闭间隔限制）
3. 使用 `poke` 命令可以主动拍一拍用户，支持多种参数形式
4. 当群成员发送包含表情的消息时，机器人会根据表情回复模式自动添加相应的表情回应
5. 也可以配置关键词触发表情回应，当消息中包含特定关键词时添加对应表情
6. 使用 `stick` 命令可手动为消息添加表情回应，支持多种表情组合
