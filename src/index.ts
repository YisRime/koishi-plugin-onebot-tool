import { Context, Schema } from 'koishi'
import {} from "koishi-plugin-adapter-onebot";
import { Zanwo } from './zanwo'
import { Poke } from './poke'
import { Stick } from './stick'

export const name = 'onebot-tool'
export const inject = { optional: ['cron'] }

declare module "koishi" {
  interface Events {
    notice(session: Session): void;
  }

  interface Session {
    targetId?: string;
    subtype?: string;
  }
}

export interface Config {
    autoLike: boolean
    enabled: boolean
    interval?: number
    enableStick?: boolean
    maxTimes?: number
    actionInterval?: number
    cdTime?: number
    responses?: Array<{
      type: "command" | "message";
      content: string;
      weight: number;
    }>
}

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
