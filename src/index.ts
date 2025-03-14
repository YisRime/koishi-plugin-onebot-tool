import { Context, Schema } from 'koishi'
import {} from "koishi-plugin-adapter-onebot";
import { Zanwo } from './zanwo'
import { Poke } from './poke'
import { Stick } from './stick'

export const name = 'onebot-tool'

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
  zanwo: {
    adminAccount: string
    adminOnly: boolean
    enableNotify: boolean
    autoLike: boolean
  }
  poke: {
    enabled: boolean
    interval?: number
    enableStick?: boolean
    maxTimes?: number
    actionInterval?: number
    responses?: Array<{
      type: "command" | "message";
      content: string;
      weight: number;
    }>
  }
}

export const Config: Schema<Config> = Schema.object({
  zanwo: Schema.object({
    adminAccount: Schema.string()
      .description('管理员账号')
      .default(''),
    enableNotify: Schema.boolean()
      .description('开启回赞提醒')
      .default(false),
    adminOnly: Schema.boolean()
      .description('仅管理员可配置列表')
      .default(true),
    autoLike: Schema.boolean()
      .description('开启自动批量点赞')
      .default(true),
  }).description('点赞配置'),

  poke: Schema.object({
    enabled: Schema.boolean()
      .description('启用戳一戳响应')
      .default(true),
    interval: Schema.number()
      .default(1000).min(0)
      .description('最小响应间隔（毫秒）'),
    maxTimes: Schema.number()
      .default(5).min(1).max(200)
      .description('单次戳一戳请求最大次数'),
    actionInterval: Schema.number()
      .default(500).min(100)
      .description('请求多次戳一戳之间间隔（毫秒）'),
    responses: Schema.array(Schema.object({
      type: Schema.union([
        Schema.const('command').description('执行命令'),
        Schema.const('message').description('发送消息')
      ]).description('响应类型'),
      content: Schema.string().description('响应内容'),
      weight: Schema.number()
        .default(50).min(0).max(100)
        .description('触发权重')
    }))
    .role('table').default([
      {
        type: 'message',
        content: '<at id={userId}/>你干嘛~',
        weight: 50
      },
      {
        type: 'command',
        content: 'poke',
        weight: 50
      }
    ])
    .description('响应列表'),
    enableStick: Schema.boolean()
      .description('启用自动表情回复')
      .default(false)
  }).description('戳一戳及表情回复配置')
})

export function apply(ctx: Context, config: Config) {
  const onebotCtx = ctx.platform('onebot')

  const zanwo = new Zanwo(onebotCtx, config.zanwo)
  const poke = new Poke(onebotCtx, config.poke)
  const stick = new Stick(onebotCtx)

  zanwo.registerCommands()
  poke.registerCommand()
  stick.registerCommand()

  if (config.poke.enableStick) {
    onebotCtx.middleware(async (session, next) => {
      await stick.processMessage(session);
      return next();
    });
  }

  if (config.poke.enabled) {
    onebotCtx.on('notice', async (session) => {
      await poke.processNotice(session);
    });
  }

  ctx.on('dispose', () => {
    zanwo.dispose()
    poke.dispose()
  })
}
