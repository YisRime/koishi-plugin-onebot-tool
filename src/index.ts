import { Context, Schema } from 'koishi'
import {} from "koishi-plugin-adapter-onebot";
import {} from 'koishi-plugin-cron'
import { Zanwo } from './zanwo'
import { Poke } from './poke'
import { Stick } from './stick'
import { Sign } from './sign'
import { Voice } from './voice'

export const name = 'onebot-tool'
export const inject = { optional: ['cron'] }

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📌 插件说明</h2>
  <p>📖 <strong>使用文档</strong>：请点击左上角的 <strong>插件主页</strong> 查看插件使用文档</p>
  <p>🔍 <strong>更多插件</strong>：可访问 <a href="https://github.com/YisRime" style="color:#4a6ee0;text-decoration:none;">苡淞的 GitHub</a> 查看本人的所有插件</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">❤️ 支持与反馈</h2>
  <p>🌟 喜欢这个插件？请在 <a href="https://github.com/YisRime" style="color:#e0574a;text-decoration:none;">GitHub</a> 上给我一个 Star！</p>
  <p>🐛 遇到问题？请通过 <strong>Issues</strong> 提交反馈，或加入 QQ 群 <a href="https://qm.qq.com/q/PdLMx9Jowq" style="color:#e0574a;text-decoration:none;"><strong>855571375</strong></a> 进行交流</p>
</div>
`

declare module "koishi" {
  interface Events {
    /** 通知事件 */
    notice(session: Session): void;
  }

  interface Session {
    /** 拍一拍目标ID */
    targetId?: string;
    /** 通知子类型 */
    subtype?: string;
  }
}

/**
 * 表情回应模式
 */
export enum StickMode {
  /** 关闭表情回应 */
  Off = 'off',
  /** 仅回应关键词 */
  KeywordOnly = 'keyword',
  /** 仅处理包含表情 */
  EmojiOnly = 'emoji',
  /** 处理所有表情 */
  All = 'all'
}

/**
 * 打卡模式
 */
export enum SignMode {
  /** 关闭打卡功能 */
  Off = 'off',
  /** 手动模式：使用手动添加的群列表 */
  Manual = 'manual',
  /** 自动模式：自动获取所有群 */
  Auto = 'auto'
}

/**
 * 插件配置接口
 */
export interface Config {
    /** 是否启用每日自动点赞 */
    autoLike: boolean
    /** 打卡模式设置 */
    signMode?: SignMode
    /** 是否启用拍一拍自动响应 */
    enabled: boolean
    /** 拍一拍响应间隔(毫秒) */
    interval?: number
    /** 表情回应模式 */
    stickMode?: StickMode
    /** 单次拍一拍最大次数 */
    maxTimes?: number
    /** 连续拍一拍间隔(毫秒) */
    actionInterval?: number
    /** 命令冷却时间(秒) */
    cdTime?: number
    /** 拍一拍响应列表 */
    responses?: Array<{
      /** 响应类型：命令或消息 */
      type: "command" | "message";
      /** 响应内容 */
      content: string;
      /** 响应触发权重 */
      weight: number;
    }>
    /** 关键词表情映射列表 */
    keywordEmojis?: Array<{
      /** 触发关键词 */
      keyword: string;
      /** 回应的表情ID或名称 */
      emojiId: string;
    }>
    /** Pixiv图片链接json下载地址 */
    imagesUrl?: string
    /** 是否启用 Zanwo 命令 */
    enableZanwo?: boolean
    /** 是否启用 Poke 命令 */
    enablePoke?: boolean
    /** 是否启用 Stick 命令 */
    enableStick?: boolean
    /** 是否启用 Sign 命令 */
    enableSign?: boolean
    /** 是否启用 Voice 命令 */
    enableVoice?: boolean
}

/**
 * 插件配置模式定义
 */
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    enableZanwo: Schema.boolean().description('启用赞我').default(true),
    enableSign: Schema.boolean().description('启用打卡').default(true),
    enablePoke: Schema.boolean().description('启用拍一拍').default(true),
    enableStick: Schema.boolean().description('启用表情回应').default(true),
    enableVoice: Schema.boolean().description('启用 AI 语音').default(true)
  }).description('开关配置'),
  Schema.object({
    autoLike: Schema.boolean()
      .description('启用自动点赞').default(false),
    signMode: Schema.union([
      Schema.const(SignMode.Off).description('关闭'),
      Schema.const(SignMode.Manual).description('手动'),
      Schema.const(SignMode.Auto).description('自动')
    ]).description('群打卡模式').default(SignMode.Off),
    stickMode: Schema.union([
      Schema.const(StickMode.Off).description('关闭'),
      Schema.const(StickMode.All).description('二者'),
      Schema.const(StickMode.KeywordOnly).description('仅关键词'),
      Schema.const(StickMode.EmojiOnly).description('仅同表情')
    ]).description('表情回应模式').default(StickMode.Off),
    keywordEmojis: Schema.array(Schema.object({
      keyword: Schema.string().description('触发关键词'),
      emojiId: Schema.string().description('表情名称/ID')
    })).default([
      { keyword: '点赞', emojiId: '76' }
    ]).description('关键词列表').role('table')
  }).description('工具配置'),
  Schema.object({
    cdTime: Schema.number()
      .description('命令冷却时间（秒）').default(10).min(0),
    maxTimes: Schema.number()
      .description('单次次数限制').default(3).min(1).max(200),
    actionInterval: Schema.number()
      .description('拍一拍间隔（毫秒）').default(500).min(100),
    enabled: Schema.boolean()
      .description('启用自动响应').default(true),
    interval: Schema.number()
      .description('自动响应间隔（毫秒）').default(1000).min(0),
    imagesUrl: Schema.string()
      .description('图片数据地址').role('link')
      .default('https://raw.githubusercontent.com/YisRime/koishi-plugin-onebot-tool/main/resource/pixiv.json'),
    responses: Schema.array(Schema.object({
      type: Schema.union([
        Schema.const('command').description('执行命令'),
        Schema.const('message').description('发送消息')
      ]).description('响应类型'),
      content: Schema.string().description('响应内容'),
      weight: Schema.number()
        .description('触发权重').default(50).min(0).max(100)
    })).default([
      { type: 'message', content: '{at}你干嘛~{username}！', weight: 0 },
      { type: 'message', content: '{hitokoto}', weight: 0 },
      { type: 'message', content: '稍等哦~插画一会就来~{~}{pixiv}', weight: 100 },
      { type: 'command', content: 'poke', weight: 0 }
    ]).description('响应列表').role('table')
  }).description('拍一拍配置')
])

/**
 * 插件主入口函数
 * @param ctx - Koishi上下文
 * @param config - 插件配置
 */
export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('onebot-tool')
  const zanwo = new Zanwo(ctx, config, logger)
  const poke = new Poke(ctx, config, logger)
  const stick = new Stick(ctx, config, logger)
  const sign = new Sign(ctx, config, logger)
  const voice = new Voice(ctx, logger)

  const qtool = ctx.command('qtool', 'QQ 工具')
    .usage('点赞、打卡、拍一拍、表情回应和AI语音')

  config.enableZanwo !== false && zanwo.registerCommands(qtool)
  config.enablePoke !== false && poke.registerCommand(qtool)
  config.enableStick !== false && stick.registerCommand(qtool)
  config.enableVoice !== false && voice.registerCommands(qtool)
  config.enableSign !== false && config.signMode === SignMode.Manual && sign.registerCommands(qtool)

  if (config.stickMode !== StickMode.Off && config.enableStick !== false) {
    ctx.middleware(async (session, next) => {
      await stick.processMessage(session)
      return next()
    })
  }
  if (config.enabled && config.enablePoke !== false) {
    ctx.on('notice', poke.processNotice.bind(poke))
  }

  ctx.on('dispose', () => {
    zanwo.dispose()
    poke.dispose()
    sign.dispose()
  })
}