import { Context, h, Session } from 'koishi'
import { Config } from './index'
import { EMOJI_MAP, COMMON_EMOJIS } from './emojimap'

/**
 * 表情回复功能处理类
 */
export class Stick {
  private readonly logger: ReturnType<Context['logger']>
  private readonly numericEmojiIds: string[]

  /**
   * 创建表情回复处理器
   * @param ctx Koishi 上下文
   * @param config 表情回复配置
   */
  constructor(private ctx: Context, private config: Config['stick']) {
    this.logger = ctx.logger('stick')
    // 预处理数字表情ID列表
    this.numericEmojiIds = Object.values(EMOJI_MAP)
      .filter(id => /^\d+$/.test(id))
  }

  /**
   * 解析表情ID - 将名称或ID转换为有效的表情ID
   * @param input 表情名称或ID
   * @returns 有效的表情ID，如果无效则返回null
   */
  private resolveEmojiId(input: string): string | null {
    // 检查EMOJI_MAP中是否有对应名称
    if (EMOJI_MAP[input]) {
      return EMOJI_MAP[input]
    }
    // 检查是否为数字ID
    if (/^\d+$/.test(input)) {
      return input
    }
    // 检查是否为默认表情
    if (input === 'default') {
      return input
    }
    // 检查是否以emoji开头
    if (COMMON_EMOJIS.some(emoji => input.startsWith(emoji))) {
      return input
    }
    // 无效的表情ID/名称
    return null
  }

  /**
   * 处理消息中的表情回复
   * 由外部中间件调用
   */
  async processMessage(session: Session): Promise<boolean> {
    if (session.userId === session.selfId) return false
    const elements = h.select(h.parse(session.content), 'face')
    if (!elements.length) return false
    return this.wrapWithErrorHandling(async () => {
      let responded = false
      for (const element of elements) {
        if (element.attrs?.id) {
          await this.addReaction(session, session.messageId, element.attrs.id)
          responded = true
        }
      }
      return responded
    }, false)
  }

  /**
   * 获取目标消息ID
   */
  private getTargetMessageId(session: Session): string | number {
    return session.quote?.messageId || session.messageId
  }

  /**
   * 错误处理包装器
   * @param fn 需要执行的异步函数
   * @param defaultValue 发生错误时返回的默认值
   */
  private async wrapWithErrorHandling<T>(fn: () => Promise<T>, defaultValue: T): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      this.logger.warn('表情操作失败:', error)
      return defaultValue
    }
  }

  /**
   * 对表情列表进行排序
   */
  private sortEmojiList(emojiList: [string, string][]): [string, string][] {
    return emojiList.sort((a, b) => {
      const numA = parseInt(a[1]);
      const numB = parseInt(b[1]);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return a[1].localeCompare(b[1]);
    });
  }

  /**
   * 格式化表情列表为文本显示
   */
  private formatEmojiList(emojiList: [string, string][], page = 1, keyword = ''): string {
    const totalItems = emojiList.length;
    if (totalItems === 0) {
      return keyword ? `没有找到表情"${keyword}"` : '没有可用的表情';
    }
    const itemsPerRow = 4;
    const rowsPerPage = 9;
    const pageSize = itemsPerRow * rowsPerPage;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const validPage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (validPage - 1) * pageSize;
    const currentPageItems = emojiList.slice(startIdx, startIdx + pageSize);
    const formattedRows = [];
    for (let i = 0; i < currentPageItems.length; i += itemsPerRow) {
      const row = currentPageItems.slice(i, i + itemsPerRow)
        .map(([name, id]) => `${name}-${id}`).join('|');
      formattedRows.push(row);
    }
    const header = keyword
      ? `表情"${keyword}"（共${totalItems}个）`
      : `表情列表（第${validPage}/${totalPages}页）`;
    return header + '\n' + formattedRows.join('\n');
  }

  /**
   * 注册表情回复命令
   */
  registerCommand() {
    const stick = this.ctx.command('stick [faceId:string]', '表情回复')
      .usage('回复表情消息，默认点赞，支持输入多个表情 ID 或名称')
      .example('stick 76,77 - 使用表情ID回复')
      .example('stick 赞,踩 - 使用表情名称回复')
      .action(({ session }, faceId) => {
        return this.wrapWithErrorHandling(async () => {
          const targetMessageId = this.getTargetMessageId(session);
          if (!faceId) {
            return this.addReaction(session, targetMessageId, "76");
          }
          // 处理多个表情ID
          if (faceId.includes(',')) {
            const parts = faceId.split(',').map(part => part.trim());
            const validFaceIds = parts
              .map(part => this.resolveEmojiId(part))
              .filter(Boolean) as string[];
            if (validFaceIds.length === 0) {
              return this.addReaction(session, targetMessageId, "76");
            }
            // 依次发送表情
            for (const id of validFaceIds) {
              await this.addReaction(session, targetMessageId, id);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            return;
          }
          // 处理单个表情
          const emojiId = this.resolveEmojiId(faceId) || "76";
          return this.addReaction(session, targetMessageId, emojiId);
        }, undefined);
      });

    // 随机表情子命令
    stick.subcommand('.random [count:number]', '回复随机表情', { authority: 2 })
      .action(({ session }, count = 20) => {
        return this.wrapWithErrorHandling(async () => {
          const targetMessageId = this.getTargetMessageId(session);
          return this.sendRandomFaces(session, count, targetMessageId);
        }, undefined);
      });

    // 表情搜索子命令
    stick.subcommand('.search [keyword:string]', '搜索表情')
      .example('stick.search 龙 - 搜索包含"龙"的表情')
      .action(({ }, keyword) => {
        return this.wrapWithErrorHandling(async () => {
          if (!keyword) {
            return '请输入要搜索的关键词';
          }
          const emojiList = this.sortEmojiList(
            Object.entries(EMOJI_MAP).filter(([name]) => name.includes(keyword))
          );
          return this.formatEmojiList(emojiList, 1, keyword);
        }, '搜索表情失败');
      })
      // 表情列表子命令
      .subcommand('.list [page:number]', '查看支持的表情列表')
      .action(({}, page = 1) => {
        return this.wrapWithErrorHandling(async () => {
          const emojiList = this.sortEmojiList(Object.entries(EMOJI_MAP));
          return this.formatEmojiList(emojiList, page);
        }, '获取表情列表失败');
      });
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
   * Fisher-Yates洗牌算法随机打乱数组
   */
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
  }

  /**
   * 发送多个随机表情
   */
  private async sendRandomFaces(session: Session, count: number, messageId: number | string): Promise<void> {
    if (this.numericEmojiIds.length === 0) {
      return
    }
    const safeCount = Math.min(count, 20, this.numericEmojiIds.length)
    const selectedEmojis = this.shuffleArray(this.numericEmojiIds).slice(0, safeCount)
    // 依次发送表情
    for (const id of selectedEmojis) {
      await this.addReaction(session, messageId, id)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
}
