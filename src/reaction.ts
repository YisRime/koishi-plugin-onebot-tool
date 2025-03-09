import { Context, h } from 'koishi'
import { Config } from './index'

/**
 * 表情回应功能处理类
 */
export class Reaction {
  /**
   * 创建表情回应处理器
   * @param ctx Koishi 上下文
   * @param config 表情回应配置
   */
  constructor(private ctx: Context, private config: Config['reaction']) {}

  /**
   * 处理消息中的表情回应
   * 由外部中间件调用
   */
  async processMessage(session): Promise<boolean> {
    if (session.platform !== 'onebot') return false
    if (session.userId === session.selfId) return false

    let elements = h.select(h.parse(session.content), 'face')
    if (elements.length === 0) return false

    try {
      for (let element of elements) {
        if (this.config.groupReaction && session.guildId) {
          await session.onebot._request('set_group_reaction', {
            group_id: session.guildId,
            message_id: session.messageId,
            code: element.attrs.id,
            is_add: true
          }).catch(() => {})
        }

        // 尝试对表情点赞
        if (this.config.emojiLike) {
          await session.onebot._request('set_msg_emoji_like', {
            message_id: session.messageId,
            emoji_id: element.attrs.id
          }).catch(() => {})
        }

        if (elements.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      return true
    } catch (error) {
      this.ctx.logger('reaction').warn('表情回应失败:', error)
      return false
    }
  }

  /**
   * 注册表情回应命令
   */
  registerCommand() {
    this.ctx.command('reaction [faceId:string]', '表情回应')
      .alias('回应')
      .option('all', '-a 回应所有表情')
      .usage('引用消息并发送此命令可回应消息表情')
      .example('reaction - 回应引用消息中的第一个表情')
      .example('reaction -a - 回应引用消息中的所有表情')
      .example('reaction 123 - 回应特定ID的表情')
      .action(async ({ session, options }, faceId) => {
        if (session.platform !== 'onebot') {
          return '该功能仅支持 OneBot 适配器';
        }

        // 检查引用消息
        const quote = session.quote;
        if (!quote) {
          return '请引用一条包含表情的消息';
        }

        // 获取引用消息ID
        const messageId = quote.messageId;
        if (!messageId) {
          return '无法获取引用消息ID';
        }

        try {
          if (faceId) {
            await this.sendReaction(session, messageId, faceId);
            return '已发送表情回应';
          } else {
            const elements = h.select(h.parse(quote.content), 'face');
            if (elements.length === 0) {
              return '引用的消息中没有表情';
            }

            if (options.all) {
              let count = 0;
              for (let element of elements) {
                await this.sendReaction(session, messageId, element.attrs.id);
                count++;
                if (elements.length > 1) {
                  await new Promise(resolve => setTimeout(resolve, 300));
                }
              }
              return `已回应 ${count} 个表情`;
            } else {
              await this.sendReaction(session, messageId, elements[0].attrs.id);
              return '已回应表情';
            }
          }
        } catch (error) {
          this.ctx.logger('reaction').warn('手动表情回应失败:', error);
          return '表情回应失败';
        }
      });
  }

  /**
   * 发送表情回应
   * @param session 会话对象
   * @param messageId 消息ID
   * @param emojiId 表情ID
   */
  private async sendReaction(session, messageId: string, emojiId: string): Promise<void> {
    if (this.config.groupReaction && session.guildId) {
      await session.onebot._request('set_group_reaction', {
        group_id: session.guildId,
        message_id: messageId,
        code: emojiId,
        is_add: true
      }).catch(() => {});
    }

    if (this.config.emojiLike) {
      await session.onebot._request('set_msg_emoji_like', {
        message_id: messageId,
        emoji_id: emojiId
      }).catch(() => {});
    }
  }
}
