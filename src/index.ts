import { Context, Schema } from 'koishi'
import { ZanwoMgr } from './ZanwoMgr'
import { utils } from './utils'

export const name = 'onebot-tool'

export interface Config {
  adminAccount: string
  enableNotify: boolean
  adminOnly: boolean
  enableAutoBatch: boolean
}

export const Config: Schema<Config> = Schema.object({
  adminAccount: Schema.string().description('管理员账号'),
  enableNotify: Schema.boolean().default(true).description('启用点赞成功时提示点赞主人'),
  adminOnly: Schema.boolean().default(true).description('仅管理员可配置一键点赞列表'),
  enableAutoBatch: Schema.boolean().default(false).description('启用每日自动批量点赞'),
}).description('点赞配置')

export function apply(ctx: Context, config: Config) {
  const zanwoMgr = new ZanwoMgr(ctx);

  // 设置自动点赞任务
  if (config.enableAutoBatch) {
    ctx.setInterval(async () => {
      const targets = zanwoMgr.getList();
      if (targets.length) {
        const bots = Array.from(ctx.bots.values());
        for (const bot of bots) {
          const session = bot.session();
          if (session) {
            await zanwoMgr.sendBatchLikes(session, targets);
            break;
          }
        }
      }
    }, 24 * 60 * 60 * 1000);
  }

/**
 * 点赞命令处理
 * @description
 * 改为子命令结构:
 * 1. zanwo - 默认点赞自己
 * 2. zanwo.list - 查看点赞目标列表
 * 3. zanwo.add - 添加点赞目标
 * 4. zanwo.remove - 移除点赞目标
 * 5. zanwo.user - 指定目标点赞
 */
  const zanwo = ctx.command('zanwo')
    .alias('赞我')
    .usage('自动给你点赞\nzanwo - 为自己点赞\nzanwo.user @用户 - 为指定用户点赞\nzanwo.list - 查看点赞列表\nzanwo.add @用户 - 添加到点赞列表\nzanwo.remove @用户 - 从点赞列表移除')
    .action(async ({ session }) => {
      const success = await zanwoMgr.sendLikes(session, session.userId);
      const message = await session.send(
        success
          ? `点赞完成，记得回赞${config.enableNotify ? config.adminAccount : ''}哦~`
          : '点赞失败'
      );
      await utils.autoRecall(session, message);
    });

  zanwo.subcommand('.list')
    .action(async ({ session }) => {
      if (config.adminOnly && session.userId !== config.adminAccount) {
        return '仅管理员可用';
      }

      const targets = zanwoMgr.getList();
      return targets.length
        ? `当前点赞列表：${targets.join(', ')}`
        : '点赞列表为空';
    });

  zanwo.subcommand('.add <target:text>')
    .action(async ({ session }, target) => {
      if (config.adminOnly && session.userId !== config.adminAccount) {
        return '仅管理员可用';
      }

      const parsedTarget = utils.parseTarget(target);
      if (!parsedTarget) {
        return '找不到指定用户';
      }

      const success = await zanwoMgr.addQQ(parsedTarget);
      return success ? `已添加 ${parsedTarget} 到点赞列表` : '添加失败';
    });

  zanwo.subcommand('.remove <target:text>')
    .action(async ({ session }, target) => {
      if (config.adminOnly && session.userId !== config.adminAccount) {
        return '仅管理员可用';
      }

      const parsedTarget = utils.parseTarget(target);
      if (!parsedTarget) {
        return '找不到指定用户';
      }

      const success = await zanwoMgr.removeQQ(parsedTarget);
      return success ? `已从点赞列表移除 ${parsedTarget}` : '移除失败';
    });

  zanwo.subcommand('.user <target:text>')
    .action(async ({ session }, target) => {
      const parsedTarget = utils.parseTarget(target);
      if (!parsedTarget || parsedTarget === session.userId) {
        const message = await session.send('找不到指定用户');
        await utils.autoRecall(session, message);
        return;
      }

      const success = await zanwoMgr.sendLikes(session, parsedTarget);
      const message = await session.send(
        success
          ? `点赞完成，记得回赞${config.enableNotify ? config.adminAccount : ''}哦~`
          : '点赞失败'
      );
      await utils.autoRecall(session, message);
    });
}
