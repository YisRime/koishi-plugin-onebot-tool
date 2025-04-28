import { Context, h, Session } from 'koishi'
import { EMOJI_MAP, COMMON_EMOJIS } from './emojimap'
import { Config, StickMode } from './index'

/**
 * 表情回复功能处理类
 * 处理消息中的表情元素并作出表情回应
 */
export class Stick {
  /** 日志记录器 */
  private readonly logger: ReturnType<Context['logger']>
  /** 数字形式的表情ID列表 */
  private readonly numericEmojiIds: string[]
  /** 关键词到表情ID的映射 */
  private readonly keywordMap: Map<string, string> = new Map()
  /** 表情回复模式 */
  private readonly mode: StickMode

  /**
   * 创建表情回复处理器实例
   * @param ctx - Koishi 上下文
   * @param config - 配置项
   */
  constructor(private ctx: Context, private config?: Config) {
    this.logger = ctx.logger('stick')
    this.numericEmojiIds = Object.values(EMOJI_MAP).filter(id => /^\d+$/.test(id))
    this.mode = config?.stickMode || StickMode.Off
    // 初始化关键词映射
    if (config?.keywordEmojis?.length) {
      for (const item of config.keywordEmojis) {
        const emojiId = this.resolveEmojiId(item.emojiId)
        if (emojiId) {
          this.keywordMap.set(item.keyword, emojiId)
        } else {
          this.logger.warn(`无效的表情ID或名称: ${item.emojiId}`)
        }
      }
    }
  }

  /**
   * 解析表情ID - 将名称或ID转换为有效的表情ID
   * @param input - 表情名称或ID
   * @returns 有效的表情ID或null
   */
  private resolveEmojiId(input: string): string | null {
    if (EMOJI_MAP[input]) return EMOJI_MAP[input]
    if (/^\d+$/.test(input) || input === 'default' || COMMON_EMOJIS.some(emoji => input.startsWith(emoji)))
      return input
    return null
  }

  /**
   * 处理消息中的表情回复
   * @param session - 会话对象
   * @returns 是否成功添加了表情回应
   */
  async processMessage(session: Session): Promise<boolean> {
    if (session.userId === session.selfId) return false
    try {
      // 处理关键词表情
      let responded = false
      if (this.keywordMap.size > 0) {
        for (const [keyword, emojiId] of this.keywordMap.entries()) {
          if (session.content.includes(keyword)) {
            await this.addReaction(session, session.messageId, emojiId)
            responded = true
          }
        }
      }
      // 如果仅处理关键词模式，则直接返回
      if (this.mode === StickMode.KeywordOnly) return responded
      // 处理表情元素
      const elements = h.select(h.parse(session.content), 'face')
      for (const element of elements) {
        if (element.attrs?.id) {
          await this.addReaction(session, session.messageId, element.attrs.id)
          responded = true
        }
      }
      return responded
    } catch (error) {
      this.logger.warn('表情处理失败:', error)
      return false
    }
  }

  /**
   * 格式化表情列表
   * @param emojiList - 表情列表，每项为[名称, ID]的元组
   * @param page - 页码，默认为1
   * @param keyword - 搜索关键词
   * @returns 格式化后的表情列表文本
   */
  private formatEmojiList(emojiList: [string, string][], page = 1, keyword = ''): string {
    // 排序表情列表
    emojiList.sort((a, b) => {
      const numA = parseInt(a[1]), numB = parseInt(b[1]);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      if (!isNaN(numA)) return -1;
      if (!isNaN(numB)) return 1;
      return a[1].localeCompare(b[1]);
    });
    const totalItems = emojiList.length;
    if (totalItems === 0) return keyword ? `没有找到表情"${keyword}"` : '没有可用的表情';
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
   * 添加和配置相关的命令行接口
   */
  registerCommand() {
    const handleError = (error: any, message: string) => {
      this.logger.warn(message, error);
      return `${message.replace(':', '')}`;
    };
    const stick = this.ctx.command('stick [faceId:string]', '表情回复')
      .usage('回复表情消息，默认点赞，支持输入多个表情 ID 或名称')
      .example('stick 76,77 - 使用表情ID回复')
      .example('stick 赞,踩 - 使用表情名称回复')
      .action(async ({ session }, faceId) => {
        try {
          const targetMessageId = session.quote?.messageId || session.messageId;
          if (!faceId) {
            return this.addReaction(session, targetMessageId, "76");
          }
          // 处理多个表情ID
          if (faceId.includes(',')) {
            let validFaceIds = faceId.split(',')
              .map(part => this.resolveEmojiId(part.trim()))
              .filter(Boolean) as string[];
            if (validFaceIds.length === 0) {
              return this.addReaction(session, targetMessageId, "76");
            }
            // 限制并发送表情
            for (const id of validFaceIds.slice(0, 20)) {
              await this.addReaction(session, targetMessageId, id);
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            return;
          }
          // 处理单个表情
          const emojiId = this.resolveEmojiId(faceId) || "76";
          return this.addReaction(session, targetMessageId, emojiId);
        } catch (error) {
          return handleError(error, '表情回复失败:');
        }
      });
    stick.subcommand('.random [count:number]', '回复随机表情')
      .action(async ({ session }, count = 1) => {
        try {
          const targetMessageId = session.quote?.messageId || session.messageId;
          return this.sendRandomFaces(session, Math.min(count, 20), targetMessageId);
        } catch (error) {
          return handleError(error, '随机表情发送失败:');
        }
      });
    stick.subcommand('.search [keyword:string]', '搜索表情')
      .example('stick.search 龙 - 搜索包含"龙"的表情')
      .action(({ }, keyword) => {
        try {
          if (!keyword) return '请输入要搜索的关键词';
          const emojiList = Object.entries(EMOJI_MAP).filter(([name]) => name.includes(keyword));
          return this.formatEmojiList(emojiList, 1, keyword);
        } catch (error) {
          return handleError(error, '表情搜索失败:');
        }
      });
    stick.subcommand('.list [page:number]', '查看支持的表情列表')
      .action(({}, page = 1) => {
        try {
          return this.formatEmojiList(Object.entries(EMOJI_MAP), page);
        } catch (error) {
          return handleError(error, '表情列表获取失败:');
        }
      });
  }

  /**
   * 添加表情回应
   * @param session - 会话对象
   * @param messageId - 消息ID
   * @param emojiId - 表情ID
   */
  private async addReaction(session: Session, messageId: number | string, emojiId: string): Promise<void> {
    await session.onebot._request('set_msg_emoji_like', {
      message_id: messageId,
      emoji_id: emojiId
    });
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 发送多个随机表情
   * @param session - 会话对象
   * @param count - 表情数量
   * @param messageId - 目标消息ID
   */
  private async sendRandomFaces(session: Session, count: number, messageId: number | string): Promise<void> {
    if (this.numericEmojiIds.length === 0) return;
    // 随机选择表情
    const shuffled = [...this.numericEmojiIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    // 依次发送表情
    for (const id of shuffled.slice(0, Math.min(count, 20, this.numericEmojiIds.length))) {
      await this.addReaction(session, messageId, id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}