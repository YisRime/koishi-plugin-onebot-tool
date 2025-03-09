import { Context, h } from 'koishi'
import { Config } from './index'

/**
 * 表情回复功能处理类
 */
export class Reaction {
  /**
   * 创建表情回复处理器
   * @param ctx Koishi 上下文
   * @param config 表情回复配置
   */
  constructor(private ctx: Context, private config: Config['reaction']) {}

  /**
   * 处理消息中的表情回复
   * 由外部中间件调用
   */
  async processMessage(session): Promise<boolean> {
    if (session.userId === session.selfId) return false

    let elements = h.select(h.parse(session.content), 'face')
    if (elements.length === 0) return false

    try {
      const faceId = this.getRandomFaceId()
      await session.onebot._request('set_msg_emoji_like', {
        message_id: session.messageId,
        emoji_id: faceId
      })
      return true
    } catch (error) {
      this.ctx.logger('reaction').warn('表情回复失败:', error)
      return false
    }
  }

  /**
   * 注册表情回复命令
   */
  registerCommand() {
    this.ctx.command('reaction [faceId:string]', '表情回复')
      .option('all', '-a 回复多个随机表情')
      .usage('回复表情消息')
      .action(async ({ session, options }, faceId) => {
        try {
          const targetMessageId = session.quote?.messageId || session.messageId;

          if (options.all) {
            await this.sendRandomFaces(session, 30, Number(targetMessageId));
            return;
          } else if (faceId) {
            if (!this.isValidFaceId(faceId)) {
              return '表情ID无效，应为0-220之间的数字';
            }
            await session.onebot._request('set_msg_emoji_like', {
              message_id: targetMessageId,
              emoji_id: faceId
            });
            return;
          } else {
            const randomFaceId = this.getRandomFaceId();
            await session.onebot._request('set_msg_emoji_like', {
              message_id: targetMessageId,
              emoji_id: randomFaceId
            });
            return;
          }
        } catch (error) {
          this.ctx.logger('reaction').warn('手动表情回复失败:', error);
          return '表情回复失败';
        }
      });
  }

  /**
   * 判断表情ID是否有效
   * @param faceId 表情ID
   * @returns 是否为有效表情ID
   */
  private isValidFaceId(faceId: string): boolean {
    const id = parseInt(faceId);
    return !isNaN(id) && id >= 0 && id <= 220;
  }

  /**
   * 获取一个随机的表情ID
   * @returns 随机表情ID
   */
  private getRandomFaceId(): string {
    return Math.floor(Math.random() * 221).toString();
  }

  /**
   * 发送多个随机表情
   * @param session 会话对象
   * @param count 表情数量
   * @param targetMessageId 目标消息ID
   * @returns 操作结果消息，仅在失败时返回
   */
  private async sendRandomFaces(session, count: number, targetMessageId?: number): Promise<string | void> {
    const messageId = targetMessageId || session.quote?.messageId || session.messageId;
    if (!messageId) {
      return '无法确定目标消息';
    }

    const faceIds = new Set<number>();
    while (faceIds.size < Math.min(count, 221)) {
      faceIds.add(Math.floor(Math.random() * 221));
    }

    for (const id of faceIds) {
      try {
        await session.onebot._request('set_msg_emoji_like', {
          message_id: messageId,
          emoji_id: id.toString()
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        this.ctx.logger('reaction').warn('添加表情回应失败:', error);
      }
    }


    return;
  }
}
