import { Context, Schema } from 'koishi'
import {} from "koishi-plugin-adapter-onebot";
import { Zanwo } from './zanwo'
import { Poke } from './poke'
import { Reaction } from './reaction'

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
    responses?: Array<{
      type: "command" | "message";
      content: string;
      weight: number;
    }>
  }
  reaction: {
    enabled: boolean
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
      .description('最小触发间隔（毫秒）'),
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
        content: '<at id={userId}/>戳你一下',
        weight: 50
      },
      {
        type: 'command',
        content: 'poke',
        weight: 50
      }
    ])
    .description('响应列表')
  }).description('戳一戳配置'),

  reaction: Schema.object({
    enabled: Schema.boolean()
      .description('启用表情回复')
      .default(true)
  }).description('表情回复配置')
})

export function apply(ctx: Context, config: Config) {
  const onebotCtx = ctx.platform('onebot')

  const zanwo = new Zanwo(onebotCtx, config.zanwo)
  const poke = new Poke(onebotCtx, config.poke)
  const reaction = new Reaction(onebotCtx, config.reaction)

  zanwo.registerCommands()
  poke.registerCommand()
  reaction.registerCommand()

  if (config.reaction.enabled) {
    onebotCtx.middleware(async (session, next) => {
      await reaction.processMessage(session);
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
