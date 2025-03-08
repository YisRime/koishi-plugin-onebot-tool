import { Session, h } from 'koishi';

/**
 * 消息处理工具集
 * @namespace messageHandler
 */
const messageHandler = {
  /**
   * 自动撤回消息
   * @param {Session} session - 会话上下文
   * @param {any} message - 要撤回的消息
   * @param {number} delay - 延迟时间(毫秒)
   * @returns {Promise<() => void>} 取消撤回的函数
   */
  autoRecall: async (session: Session, message: any, delay = 10000) => {
    if (!message) return;
    const timer = setTimeout(async () => {
      try {
        const messages = Array.isArray(message) ? message : [message];
        await Promise.all(messages.map(msg => {
          const msgId = typeof msg === 'string' ? msg : msg?.id;
          if (msgId) return session.bot.deleteMessage(session.channelId, msgId);
        }));
      } catch (error) {
        console.warn('Auto recall failed:', error);
      }
    }, delay);
    return () => clearTimeout(timer);
  }
};

/**
 * 工具函数集合
 * @namespace utils
 */
export const utils = {
  /**
   * 解析目标用户ID
   * @param {string} input - 输入文本
   * @returns {string|null} 解析后的用户ID
   */
  parseTarget: (input: string): string | null => {
    if (!input?.trim()) return null;
    const parsed = h.parse(input)[0];
    return parsed?.type === 'at' ? parsed.attrs.id : input.trim();
  },

  ...messageHandler
};

