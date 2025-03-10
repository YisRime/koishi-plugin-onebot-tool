import { Context, h, Session } from 'koishi'
import { Config } from './index'

/**
 * 表情回复功能处理类
 */
export class Reaction {
  private readonly logger: ReturnType<Context['logger']>
  private readonly MAX_FACE_ID = 220

  /**
   * 创建表情回复处理器
   * @param ctx Koishi 上下文
   * @param config 表情回复配置
   */
  constructor(private ctx: Context, private config: Config['reaction']) {
    this.logger = ctx.logger('reaction')
  }

  /**
   * 处理消息中的表情回复
   * 由外部中间件调用
   */
  async processMessage(session: Session): Promise<boolean> {
    if (session.userId === session.selfId) return false

    if (!h.select(h.parse(session.content), 'face').length) return false

    try {
      await this.addReaction(session, session.messageId, Math.floor(Math.random() * (this.MAX_FACE_ID + 1)).toString())
      return true
    } catch (error) {
      this.logger.warn('表情回复操作失败:', error)
      return false
    }
  }

  /**
   * 注册表情回复命令
   */
  registerCommand() {
    this.ctx.command('reaction [faceId:string]', '表情回复')
      .usage('回复表情消息，默认点赞，输入表情 ID 回应，使用"all"回复随机表情')
      .example('reaction - 给消息点赞')
      .example('reaction 1,2 - 回复表情(ID:1,2)')
      .example('reaction all - 回复随机表情')
      .action(async ({ session }, faceId) => {
        try {
          const targetMessageId = session.quote?.messageId || session.messageId
          if (!faceId) {
            return this.addReaction(session, targetMessageId, "76")
          }
          if (faceId.toLowerCase() === 'all') {
            return this.sendRandomFaces(session, 20, targetMessageId)
          }
          if (faceId.includes(',')) {
            const validFaceIds = faceId.split(',')
              .map(id => id.trim())
              .filter(id => {
                const numId = parseInt(id)
                return !isNaN(numId) && numId >= 0 && numId <= this.MAX_FACE_ID
              })
            if (!validFaceIds.length) {
              return this.addReaction(session, targetMessageId, "76")
            }
            await Promise.all(validFaceIds.map(id =>
              this.addReaction(session, targetMessageId, id)
            ))
            return
          }
          const isValid = (() => {
            const id = parseInt(faceId)
            return !isNaN(id) && id >= 0 && id <= this.MAX_FACE_ID
          })()

          return this.addReaction(
            session,
            targetMessageId,
            isValid ? faceId : "76"
          )
        } catch (error) {
          this.logger.warn('表情回复操作失败:', error)
        }
      })
  }

  /**
   * 添加表情回应
   */
  private async addReaction(session: Session, messageId: number | string, emojiId: string): Promise<void> {
    await session.onebot._request('set_msg_emoji_like', {
      message_id: messageId,
      emoji_id: emojiId
    })
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  /**
   * 发送多个随机表情
   */
  private async sendRandomFaces(session: Session, count: number, messageId: number | string): Promise<void> {
    const faceIds = new Set<number>()
    while (faceIds.size < Math.min(count, this.MAX_FACE_ID + 1)) {
      faceIds.add(Math.floor(Math.random() * (this.MAX_FACE_ID + 1)))
    }

    try {
      for (const id of faceIds) {
        await this.addReaction(session, messageId, id.toString())
      }
    } catch (error) {
      this.logger.warn('表情回复操作失败:', error)
    }
  }
}
