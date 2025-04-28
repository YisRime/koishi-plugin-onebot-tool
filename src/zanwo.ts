import { Context } from 'koishi'
import { resolve } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { Config } from './index'
import { utils } from './utils'

/**
 * QQ点赞功能管理类
 * 处理自动点赞、点赞列表管理和相关命令
 */
export class Zanwo {
  /** 点赞目标用户ID集合 */
  private targets: Set<string> = new Set()
  /** 点赞列表文件路径 */
  private filePath: string
  /** 日志记录器 */
  private logger: any
  /** Koishi上下文 */
  private ctx: Context
  /** 定时任务对象 */
  private cronJob: any
  /** 定时器 */
  private timer: NodeJS.Timeout
  /** 插件配置 */
  private config: Config

  /**
   * 创建点赞管理实例
   * @param ctx - Koishi上下文
   * @param config - 插件配置
   */
  constructor(ctx: Context, config: Config) {
    this.ctx = ctx
    this.config = config
    this.logger = ctx.logger('zanwo')
    this.filePath = resolve(ctx.baseDir, 'data', 'zanwo.json')
    this.loadTargetsFromFile().catch(err => this.logger.error('加载点赞列表失败:', err))
    this.startAutoLikeTimer()
  }

  /**
   * 从文件加载点赞目标列表
   * @returns Promise 加载完成的Promise
   */
  private async loadTargetsFromFile(): Promise<void> {
    if (!existsSync(this.filePath)) return
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'))
      this.targets = new Set(Array.isArray(data) ? data : [])
    } catch (error) {
      this.logger.error('加载点赞列表失败:', error)
      this.targets = new Set()
    }
  }

  /**
   * 启动自动点赞定时器
   * 根据配置使用cron或setInterval
   */
  private startAutoLikeTimer(): void {
    if (this.cronJob) this.cronJob.dispose()
    if (this.timer) clearInterval(this.timer)
    this.cronJob = null
    this.timer = null
    if (!this.config.autoLike || this.targets.size === 0) return
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
   * @param session - 可选的会话对象，用于发送点赞请求
   * @returns Promise 点赞执行完成的Promise
   */
  private async executeAutoLike(session?): Promise<void> {
    const targets = [...this.targets]
    if (!targets.length) return
    try {
      let successCount = 0
      for (const userId of targets) {
        if (await this.sendLike(session, userId)) successCount++
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      this.logger.info(`自动点赞完成：成功 ${successCount}/${targets.length} 人`)
    } catch (error) {
      this.logger.error('自动点赞出错：', error)
    }
  }

  /**
   * 处理点赞目标列表的增删查清
   * @param action - 操作类型：'add'添加, 'remove'移除, 'get'获取, 'clear'清空
   * @param userId - 用户ID，用于add和remove操作
   * @returns 操作结果。get返回目标数组，其他返回布尔值表示成功与否
   */
  async handleTargets(action: 'add' | 'remove' | 'get' | 'clear', userId?: string): Promise<boolean | string[]> {
    if (action === 'get') return [...this.targets]
    if (action === 'clear') {
      const isEmpty = this.targets.size === 0
      if (!isEmpty) {
        this.targets.clear()
        await writeFile(this.filePath, JSON.stringify([...this.targets]))
          .catch(error => this.logger.error('保存点赞列表失败:', error))
      }
      return !isEmpty
    }
    if (!userId || !/^\d+$/.test(userId)) return false
    const result = action === 'add'
      ? (this.targets.add(userId), true)
      : this.targets.delete(userId)
    if (result) {
      await writeFile(this.filePath, JSON.stringify([...this.targets]))
        .catch(error => this.logger.error('保存点赞列表失败:', error))
    }
    return result
  }

  /**
   * 发送点赞请求
   * @param session - 会话对象，用于发送点赞请求
   * @param userId - 目标用户ID
   * @returns Promise<boolean> 点赞是否成功
   */
  async sendLike(session, userId: string): Promise<boolean> {
    try {
      for (let i = 0; i < 5; i++) {
        await session.bot.internal.sendLike(userId, 10)
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 注册点赞相关命令
   */
  registerCommands(): void {
    /**
     * 处理回复并自动撤回
     * @param session - 会话对象
     * @param message - 要发送的消息
     * @returns 空字符串
     */
    const handleReply = async (session, message) => {
      const msg = await session.send(message)
      await utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
      return ''
    }

    const zanwo = this.ctx.command('zanwo', '自动点赞')
      .alias('赞我')
      .usage('自动给你点赞\nzanwo - 为自己点赞\nzanwo.user @用户 - 为指定用户点赞\nzanwo.list - 查看点赞列表\nzanwo.add @用户 - 添加到点赞列表\nzanwo.remove @用户 - 从点赞列表移除\nzanwo.all - 立即点赞列表\nzanwo.clear - 清空点赞列表')
      .action(async ({ session }) => {
        const success = await this.sendLike(session, session.userId)
        return handleReply(session, success ? `点赞完成，记得回赞哦~` : '点赞失败，请尝试添加好友')
      })
    zanwo.subcommand('.list', { authority: 3 })
      .action(async ({}) => {
        const targets = await this.handleTargets('get') as string[];
        return targets.length ? `当前点赞列表（共${targets.length}人）：${targets.join(', ')}` : '点赞列表为空'
      })
    zanwo.subcommand('.add <target:text>', { authority: 2 })
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        if (!userId) return handleReply(session, '找不到指定用户')
        const success = await this.handleTargets('add', userId)
        return handleReply(session, success ? `已添加 ${userId} 到点赞列表` : '添加失败')
      })
    zanwo.subcommand('.remove <target:text>', { authority: 2 })
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        if (!userId) return handleReply(session, '找不到指定用户')
        const success = await this.handleTargets('remove', userId)
        return handleReply(session, success ? `已从点赞列表移除 ${userId}` : '移除失败')
      })
    zanwo.subcommand('.user <target:text>')
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        if (!userId) return handleReply(session, '找不到指定用户')
        const success = await this.sendLike(session, userId)
        return handleReply(session, success ? `点赞完成，记得回赞哦~` : '点赞失败，请尝试添加好友')
      })
    zanwo.subcommand('.all', { authority: 3 })
      .action(async ({ session }) => {
        this.executeAutoLike(session)
        return '已开始点赞'
      })
    zanwo.subcommand('.clear', { authority: 4 })
      .action(async ({}) => {
        this.handleTargets('clear')
        return '已清空点赞列表'
      })
  }

  /**
   * 释放资源
   * 清理定时任务和计时器
   */
  dispose(): void {
    if (this.cronJob) {
      this.cronJob.dispose()
      this.cronJob = null
    }
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}