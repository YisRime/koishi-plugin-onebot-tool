import { Session, h } from 'koishi';

/**
 * 工具函数集合
 */
export const utils = {
  /**
   * 解析目标用户ID
   * @param target 可能包含用户ID的文本
   * @returns 解析出的用户ID或null
   */
  parseTarget(target: string): string | null {
    if (!target) return null

    try {
      const elements = h.parse(target)
      const atElement = h.select(elements, 'at')[0]
      if (atElement && atElement.attrs?.id) {
        return atElement.attrs.id
      }
    } catch (e) {
    }

    const atMatch = target.match(/@(\d+)/)
    if (atMatch) return atMatch[1]
    if (/^\d+$/.test(target.trim())) return target.trim()

    return null
  },

  /**
   * 自动撤回消息
   * @param session 会话对象
   * @param message 消息ID
   * @param delay 延迟时间（毫秒）
   */
  async autoRecall(session: Session, message: string | number, delay: number = 5000): Promise<void> {
    if (!message) return

    try {
      setTimeout(async () => {
        await session.bot?.deleteMessage(session.channelId, message.toString())
      }, delay)
    } catch (error) {
    }
  }
}
