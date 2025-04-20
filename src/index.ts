import { Context, Schema } from 'koishi'
import {} from "koishi-plugin-adapter-onebot";
import {} from 'koishi-plugin-cron'
import { Zanwo } from './zanwo'
import { Poke } from './poke'
import { Stick } from './stick'

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
    /** 戳一戳目标ID */
    targetId?: string;
    /** 通知子类型 */
    subtype?: string;
  }
}

/**
 * 插件配置接口
 */
export interface Config {
    /** 是否启用每日自动点赞 */
    autoLike: boolean
    /** 是否启用戳一戳自动响应 */
    enabled: boolean
    /** 戳一戳响应间隔(毫秒) */
    interval?: number
    /** 是否启用表情自动回复 */
    enableStick?: boolean
    /** 单次戳一戳最大次数 */
    maxTimes?: number
    /** 连续戳一戳间隔(毫秒) */
    actionInterval?: number
    /** 命令冷却时间(秒) */
    cdTime?: number
    /** 戳一戳响应列表 */
    responses?: Array<{
      /** 响应类型：命令或消息 */
      type: "command" | "message";
      /** 响应内容 */
      content: string;
      /** 响应触发权重 */
      weight: number;
    }>
}

/**
 * 插件配置模式定义
 */
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    autoLike: Schema.boolean()
      .description('启用每日自动点赞').default(true),
    enableStick: Schema.boolean()
      .description('启用自动回复表情').default(false)
  }).description('工具配置'),
  Schema.object({
    cdTime: Schema.number()
      .description('命令冷却时间（秒）').default(10).min(0),
    maxTimes: Schema.number()
      .description('单次次数限制').default(3).min(1).max(200),
    actionInterval: Schema.number()
      .description('戳一戳间隔（毫秒）').default(500).min(100),
    enabled: Schema.boolean()
      .description('启用自动响应戳一戳').default(true),
    interval: Schema.number()
      .description('戳一戳响应间隔（毫秒）').default(1000).min(0),
    responses: Schema.array(Schema.object({
      type: Schema.union([
        Schema.const('command').description('执行命令'),
        Schema.const('message').description('发送消息')
      ]).description('响应类型'),
      content: Schema.string().description('响应内容'),
      weight: Schema.number()
        .description('触发权重').default(50).min(0).max(100),
    })).default([
      { type: 'message', content: '<at id={userId}/>你干嘛~', weight: 0 },
      { type: 'command', content: 'poke', weight: 100 }
    ]).description('响应列表').role('table'),
  }).description('戳一戳配置')
])

/**
 * 插件主入口函数
 * @param ctx - Koishi上下文
 * @param config - 插件配置
 */
export function apply(ctx: Context, config: Config) {
  const zanwo = new Zanwo(ctx, config)
  const poke = new Poke(ctx, config)
  const stick = new Stick(ctx)

  zanwo.registerCommands()
  poke.registerCommand()
  stick.registerCommand()

  if (config.enableStick) {
    ctx.middleware(async (session, next) => {
      await stick.processMessage(session);
      return next();
    });
  }
  if (config.enabled) {
    ctx.on('notice', async (session) => {
      await poke.processNotice(session);
    });
  }

  ctx.on('dispose', () => {
    zanwo.dispose()
    poke.dispose()
  })
}