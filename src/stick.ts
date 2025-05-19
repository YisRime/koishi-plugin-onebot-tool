import { Context, h, Session } from 'koishi'
import { EMOJI_MAP, COMMON_EMOJIS } from './emojimap'
import { Config, StickMode } from './index'

/**
 * 表情回应功能处理类
 * 处理消息中的表情元素并作出表情回应
 */
export class Stick {
  private readonly logger: ReturnType<Context['logger']>
  private readonly numericEmojiIds: string[]
  private readonly keywordMap = new Map<string, string>()
  private readonly mode: StickMode

  /**
   * 构造函数
   * @param ctx Koishi 上下文
   * @param config 插件配置
   * @param logger 日志记录器
   */
  constructor(ctx: Context, config?: Config, logger?: any) {
    this.logger = logger || ctx.logger('stick')
    this.numericEmojiIds = Object.values(EMOJI_MAP).filter(id => /^\d+$/.test(id))
    this.mode = config?.stickMode || StickMode.Off
    config?.keywordEmojis?.forEach(item => {
      const emojiId = this.resolveEmojiId(item.emojiId)
      emojiId ? this.keywordMap.set(item.keyword, emojiId) : this.logger.warn(`无效的表情ID或名称: ${item.emojiId}`)
    })
  }

  /**
   * 解析表情ID - 将名称或ID转换为有效的表情ID
   * @param input 表情名称或ID
   * @returns 有效的表情ID或null
   * @private
   */
  private resolveEmojiId(input: string): string | null {
    if (EMOJI_MAP[input]) return EMOJI_MAP[input]
    if (/^\d+$/.test(input) || input === 'default' || COMMON_EMOJIS.some(e => input.startsWith(e))) return input
    return null
  }

  /**
   * 处理消息中的表情回应
   * @param session Koishi 会话对象
   * @returns 是否已作出表情回应
   */
  async processMessage(session: Session): Promise<boolean> {
    if (session.userId === session.selfId) return false
    try {
      let responded = false
      // 关键词表情
      for (const [keyword, emojiId] of this.keywordMap)
        if (session.content.includes(keyword)) {
          await this.addReaction(session, session.messageId, emojiId)
          responded = true
        }
      if (this.mode === StickMode.KeywordOnly) return responded
      // 表情元素
      for (const element of h.select(h.parse(session.content), 'face'))
        if (element.attrs?.id) {
          await this.addReaction(session, session.messageId, element.attrs.id)
          responded = true
        }
      return responded
    } catch (error) {
      this.logger.warn('表情处理失败:', error)
      return false
    }
  }

  /**
   * 格式化表情列表
   * @param emojiList 表情列表
   * @param page 页码
   * @param keyword 搜索关键词
   * @returns 格式化后的表情列表字符串
   * @private
   */
  private formatEmojiList(emojiList: [string, string][], page = 1, keyword = ''): string {
    emojiList.sort((a, b) => {
      const numA = parseInt(a[1]), numB = parseInt(b[1])
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB
      if (!isNaN(numA)) return -1
      if (!isNaN(numB)) return 1
      return a[1].localeCompare(b[1])
    })
    const total = emojiList.length
    if (!total) return keyword ? `没有找到表情"${keyword}"` : '没有可用的表情'
    const itemsPerRow = 4, rowsPerPage = 9, pageSize = itemsPerRow * rowsPerPage
    const totalPages = Math.ceil(total / pageSize) || 1
    const validPage = Math.min(Math.max(1, page), totalPages)
    const startIdx = (validPage - 1) * pageSize
    const current = emojiList.slice(startIdx, startIdx + pageSize)
    const rows = []
    for (let i = 0; i < current.length; i += itemsPerRow)
      rows.push(current.slice(i, i + itemsPerRow).map(([n, id]) => `${n}-${id}`).join('|'))
    const header = keyword
      ? `表情"${keyword}"（共${total}个）`
      : `表情列表（第${validPage}/${totalPages}页）`
    return header + '\n' + rows.join('\n')
  }

  /**
   * 注册表情回应命令
   * @param parentCmd 父命令对象
   */
  registerCommand(parentCmd) {
    const handleError = (e: any, msg: string) => (this.logger.warn(msg, e), msg.replace(':', ''))
    const stick = parentCmd.subcommand('stick [faceId:string]', '表情回应')
      .usage('对消息进行表情回应，默认点赞')
      .example('stick 76,77 - 使用表情ID 76和77回应')
      .example('stick 赞,踩 - 使用"赞"和"踩"表情回应')
      .action(async ({ session }, faceId) => {
        try {
          const targetId = session.quote?.messageId || session.messageId
          if (!faceId) return this.addReaction(session, targetId, "76")
          const ids = faceId.split(',').map(s => this.resolveEmojiId(s.trim())).filter(Boolean) as string[]
          if (!ids.length) return this.addReaction(session, targetId, "76")
          for (const id of ids.slice(0, 20)) {
            await this.addReaction(session, targetId, id)
            await new Promise(r => setTimeout(r, 500))
          }
        } catch (e) { return handleError(e, '表情回应失败:') }
      })
    stick.subcommand('.random [count:number]', '随机表情')
      .usage('使用随机表情回应消息')
      .action(async ({ session }, count = 1) => {
        try {
          const targetId = session.quote?.messageId || session.messageId
          return this.sendRandomFaces(session, Math.min(count, 20), targetId)
        } catch (e) { return handleError(e, '随机表情发送失败:') }
      })
    stick.subcommand('.search [keyword:string]', '搜索表情')
      .usage('搜索指定关键词的表情')
      .action(({}, keyword) => {
        try {
          if (!keyword) return '请输入要搜索的关键词'
          return this.formatEmojiList(Object.entries(EMOJI_MAP).filter(([n]) => n.includes(keyword)), 1, keyword)
        } catch (e) { return handleError(e, '表情搜索失败:') }
      })
    stick.subcommand('.list [page:number]', '表情列表')
      .usage('分页查看表情列表')
      .action(({}, page = 1) => {
        try { return this.formatEmojiList(Object.entries(EMOJI_MAP), page) }
        catch (e) { return handleError(e, '表情列表获取失败:') }
      })
  }

  /**
   * 添加表情回应
   * @param session Koishi 会话对象
   * @param messageId 消息ID
   * @param emojiId 表情ID
   * @private
   */
  private async addReaction(session: Session, messageId: number | string, emojiId: string) {
    await session.onebot._request('set_msg_emoji_like', { message_id: messageId, emoji_id: emojiId })
    await new Promise(r => setTimeout(r, 100))
  }

  /**
   * 发送多个随机表情
   * @param session Koishi 会话对象
   * @param count 数量
   * @param messageId 消息ID
   * @private
   */
  private async sendRandomFaces(session: Session, count: number, messageId: number | string) {
    if (!this.numericEmojiIds.length) return
    const shuffled = [...this.numericEmojiIds]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    for (const id of shuffled.slice(0, Math.min(count, 20, shuffled.length))) {
      await this.addReaction(session, messageId, id)
      await new Promise(r => setTimeout(r, 500))
    }
  }
}