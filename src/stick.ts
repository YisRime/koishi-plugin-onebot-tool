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

    try {
      let responded = false
      for (const element of elements) {
        if (element.attrs?.id) {
          await this.addReaction(session, session.messageId, element.attrs.id)
          responded = true
        }
      }
      return responded
    } catch (error) {
      this.logger.warn('表情回复操作失败:', error)
      return false
    }
  }

  /**
   * 注册表情回复命令
   */
  registerCommand() {
    const stick = this.ctx.command('stick [faceId:string]', '表情回复')
      .usage('回复表情消息，默认点赞，支持输入多个表情 ID 或名称')
      .example('stick 76,77 - 使用表情ID回复')
      .example('stick 赞,踩 - 使用表情名称回复')
      .action(async ({ session }, faceId) => {
        try {
          const targetMessageId = session.quote?.messageId || session.messageId
          if (!faceId) {
            return this.addReaction(session, targetMessageId, "76")
          }
          // 处理多个表情ID
          if (faceId.includes(',')) {
            const parts = faceId.split(',').map(part => part.trim())
            const validFaceIds = parts
              .map(part => this.resolveEmojiId(part))
              .filter(Boolean) as string[]

            if (validFaceIds.length === 0) {
              return this.addReaction(session, targetMessageId, "76")
            }
            // 依次发送表情
            for (const id of validFaceIds) {
              await this.addReaction(session, targetMessageId, id)
              await new Promise(resolve => setTimeout(resolve, 500))
            }
            return
          }
          // 处理单个表情
          const emojiId = this.resolveEmojiId(faceId) || "76"
          return this.addReaction(session, targetMessageId, emojiId)
        } catch (error) {
          this.logger.warn('表情回复操作失败:', error)
        }
      })

    // 随机表情子命令
    stick.subcommand('.random [count:number]', '回复随机表情', { authority: 2 })
      .action(async ({ session }, count = 20) => {
        try {
          const targetMessageId = session.quote?.messageId || session.messageId
          return this.sendRandomFaces(session, count, targetMessageId)
        } catch (error) {
          this.logger.warn('随机表情回复操作失败:', error)
        }
      })

    // 表情列表查询子命令
    stick.subcommand('.list [keyword:string]', '查看支持的表情列表')
      .option('page', '-p <page:number> 页码', { fallback: 1 })
      .example('stick.list - 查看所有表情')
      .example('stick.list 龙 - 查看包含"龙"的表情')
      .action(({ options }, keyword) => {
        try {
          let emojiList = Object.entries(EMOJI_MAP)
            .filter(([name]) => !keyword || name.includes(keyword))
            .sort((a, b) => a[0].localeCompare(b[0]));
          const totalItems = emojiList.length;
          if (totalItems === 0) {
            return `没有找到${keyword ? `包含"${keyword}"的` : ''}表情`;
          }
          if (keyword) {
            const formattedItems = [];
            for (let i = 0; i < emojiList.length; i += 5) {
              const row = emojiList.slice(i, i + 5)
                .map(([name, id]) => `${name}(${id})`)
                .join(' | ');
              formattedItems.push(row);
            }
            return `搜索"${keyword}"结果: ${totalItems}个\n` + formattedItems.join('\n');
          }
          // 浏览模式：使用分页
          else {
            const { page } = options;
            const pageNum = Math.max(1, page);
            const pageSize = 50;
            const totalPages = Math.ceil(totalItems / pageSize) || 1;
            const validPage = Math.min(pageNum, totalPages);
            const startIdx = (validPage - 1) * pageSize;
            const currentPageItems = emojiList.slice(startIdx, startIdx + pageSize);
            const formattedItems = [];
            for (let i = 0; i < currentPageItems.length; i += 5) {
              const row = currentPageItems.slice(i, i + 5)
                .map(([name, id]) => `${name}(${id})`)
                .join('|');
              formattedItems.push(row);
            }
            const header = `表情列表 ${validPage}/${totalPages}页`;
            return header + '\n' + formattedItems.join('\n');
          }
        } catch (error) {
          this.logger.warn('获取表情列表失败:', error);
          return '获取表情列表失败';
        }
      });
    // 骰子子命令
    stick.subcommand('.dice [value:number]', '发送骰子')
    .usage('发送骰子，可指定骰子点数(1-6)')
      .example('stick.dice - 随机骰子')
      .example('stick.dice 6 - 指定6点')
      .action(async ({ session }, value) => {
        try {
          if (value !== undefined) {
            const validValue = Math.max(1, Math.min(6, Math.floor(value)));
            return session.send(h('dice', { result: String(validValue) }));
          }
          return session.send(h('dice'));
        } catch (error) {
          this.logger.warn('骰子发送失败:', error);
          return '发送骰子失败';
        }
      });
    // 猜拳子命令
    stick.subcommand('.rps [type:string]', '发送猜拳')
      .usage('发送猜拳，可指定结果(1=布,2=剪刀,3=石头/拳头)')
      .example('stick.rps - 随机猜拳')
      .example('stick.rps 3/石头 - 出石头/拳头')
      .action(async ({ session }, type) => {
        try {
          if (type !== undefined) {
            let value: number | undefined;
            if (/^[1-3]$/.test(type)) {
              value = parseInt(type);
            }
            else {
              const typeMap = {
                '石头': 3,
                '拳头': 3,
                '剪刀': 2,
                '布': 1,
              };
              value = typeMap[type.toLowerCase()];
            }
            if (value !== undefined) {
              return session.send(h('rps', { result: String(value) }));
            }
            return `不支持的类型: ${type}，请使用 1-3 或 布/剪刀/石头/拳头`;
          }
          return session.send(h('rps'));
        } catch (error) {
          this.logger.warn('猜拳发送失败:', error);
          return '发送猜拳失败';
        }
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
    try {
      if (this.numericEmojiIds.length === 0) {
        this.logger.warn('没有可用的表情')
        return
      }
      const safeCount = Math.min(
        count,
        20,
        this.numericEmojiIds.length
      )
      const selectedEmojis = this.shuffleArray(this.numericEmojiIds).slice(0, safeCount)
      // 依次发送表情
      for (const id of selectedEmojis) {
        await this.addReaction(session, messageId, id)
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    } catch (error) {
      this.logger.warn('表情回复操作失败:', error)
    }
  }
}
