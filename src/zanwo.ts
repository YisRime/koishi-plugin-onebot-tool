import { Context } from 'koishi'
import { Config, ZanwoMode } from './index'
import { utils } from './utils'

/**
 * QQ点赞功能管理类
 * 处理自动点赞、点赞列表管理和相关命令
 */
export class Zanwo {
  private targets = new Set<string>()
  private moduleName = 'zanwo'
  private logger: any
  private ctx: Context
  private cronJob: any
  private timer: NodeJS.Timeout
  private config: Config

  /**
   * 构造函数
   * @param ctx Koishi 上下文
   * @param config 插件配置
   * @param logger 日志记录器
   */
  constructor(ctx: Context, config: Config, logger: any) {
    this.ctx = ctx
    this.config = config
    this.logger = logger
    this.loadTargetsFromFile().catch(err => this.logger.error('加载点赞列表失败:', err))
    if (this.config.zanwoMode === ZanwoMode.Auto) this.startAutoLikeTimer()
  }

  /**
   * 从文件加载点赞目标列表
   * @private
   */
  private async loadTargetsFromFile() {
    this.targets = new Set(await utils.loadModuleData(this.ctx.baseDir, this.moduleName, this.logger))
  }

  /**
   * 启动自动点赞定时器
   * @private
   */
  private startAutoLikeTimer() {
    this.cronJob?.dispose()
    this.timer && clearInterval(this.timer)
    this.cronJob = this.timer = null
    if (this.config.zanwoMode !== ZanwoMode.Auto || !this.targets.size) return
    if (typeof this.ctx.cron === 'function') {
      this.cronJob = this.ctx.cron('0 0 * * *', () => this.executeAutoLike())
      this.logger.info('已设置每日自动点赞定时任务')
    } else {
      this.timer = setInterval(() => this.executeAutoLike(), 86400000)
      this.logger.info('已设置每日自动点赞定时器')
    }
  }

  /**
   * 执行自动点赞
   * @param session 可选，Koishi 会话对象
   * @private
   */
  private async executeAutoLike(session?) {
    const targets = [...this.targets]
    if (!targets.length) return
    try {
      let successCount = 0
      for (const userId of targets) {
        if (await this.sendLike(session, userId)) successCount++
        await new Promise(r => setTimeout(r, 1000))
      }
      this.logger.info(`自动点赞完成：成功 ${successCount}/${targets.length} 人`)
    } catch (error) {
      this.logger.error('自动点赞出错：', error)
    }
  }

  /**
   * 处理点赞目标列表的增删查清
   * @param action 操作类型：'add'添加, 'remove'移除, 'get'获取, 'clear'清空
   * @param userId 用户ID，用于add和remove操作
   * @returns 操作结果。get返回目标数组，其他返回布尔值表示成功与否
   */
  async handleTargets(action: 'add' | 'remove' | 'get' | 'clear', userId?: string) {
    if (action === 'get') return [...this.targets]
    if (action === 'clear') {
      const isEmpty = !this.targets.size
      if (!isEmpty) {
        this.targets.clear()
        await utils.saveModuleData(this.ctx.baseDir, this.moduleName, [], this.logger)
      }
      return !isEmpty
    }
    if (!userId || !/^\d+$/.test(userId)) return false
    const result = action === 'add' ? !!this.targets.add(userId) : this.targets.delete(userId)
    if (result) await utils.saveModuleData(this.ctx.baseDir, this.moduleName, [...this.targets], this.logger)
    return result
  }

  /**
   * 发送点赞请求
   * @param session Koishi 会话对象
   * @param userId QQ用户ID
   * @returns 是否点赞成功
   */
  async sendLike(session, userId: string) {
    let success = false
    for (let i = 0; i < 5; i++) {
      try {
        await session.bot.internal.sendLike(userId, 10)
        success = true
      } catch {
        break
      }
    }
    return success
  }

  /**
   * 注册点赞相关命令
   * @param parentCmd 父命令对象
   */
  registerCommands(parentCmd) {
    const handleReply = async (session, message) => {
      const msg = await session.send(message)
      await utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
      return ''
    }
    const zanwo = parentCmd.subcommand('zanwo', '点赞')
      .alias('赞我')
      .usage('点赞自己 50 下')
      .action(async ({ session }) => handleReply(session, (await this.sendLike(session, session.userId)) ? `点赞完成，记得回赞哦~` : '点赞失败，请尝试添加好友'))
    zanwo.subcommand('.list', { authority: 3 })
      .usage('查看点赞列表')
      .action(async () => {
        const targets = await this.handleTargets('get') as string[]
        return targets.length ? `当前点赞列表（共${targets.length}人）：${targets.join(', ')}` : '点赞列表为空'
      })
    zanwo.subcommand('.add <target:text>', { authority: 2 })
      .usage('添加用户到点赞列表')
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        return handleReply(session, userId && await this.handleTargets('add', userId) ? `已添加 ${userId} 到点赞列表` : '添加失败')
      })
    zanwo.subcommand('.remove <target:text>', { authority: 2 })
      .usage('从点赞列表移除用户')
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        return handleReply(session, userId && await this.handleTargets('remove', userId) ? `已从点赞列表移除 ${userId}` : '移除失败')
      })
    zanwo.subcommand('.user <target:text>')
      .usage('点赞指定用户')
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        return handleReply(session, userId && await this.sendLike(session, userId) ? `点赞完成，记得回赞哦~` : '点赞失败，请尝试添加好友')
      })
    zanwo.subcommand('.all', { authority: 3 })
      .usage('立即点赞列表中所有人')
      .action(async ({ session }) => (this.executeAutoLike(session), '已开始点赞'))
    zanwo.subcommand('.clear', { authority: 4 })
      .usage('清空点赞列表')
      .action(async () => (this.handleTargets('clear'), '已清空点赞列表'))
  }

  /**
   * 释放资源
   */
  dispose() {
    this.cronJob?.dispose()
    this.cronJob = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}