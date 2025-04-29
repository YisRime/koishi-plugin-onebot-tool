import { Context } from 'koishi'
import { resolve } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { Config, SignMode } from './index'
import { utils } from './utils'

/**
 * QQ群打卡功能管理类
 * 处理自动打卡、打卡列表管理和相关命令
 */
export class Sign {
  /** 打卡目标群ID集合 */
  private targets: Set<string> = new Set()
  /** 打卡列表文件路径 */
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
   * 创建群打卡管理实例
   * @param ctx - Koishi上下文
   * @param config - 插件配置
   */
  constructor(ctx: Context, config: Config) {
    this.ctx = ctx
    this.config = config
    this.logger = ctx.logger('sign')
    this.filePath = resolve(ctx.baseDir, 'data', 'sign.json')
    this.loadTargetsFromFile().catch(err => this.logger.error('加载群打卡列表失败:', err))
    this.startAutoSignTimer()
  }

  /**
   * 从文件加载打卡目标列表
   * @returns Promise 加载完成的Promise
   */
  private async loadTargetsFromFile(): Promise<void> {
    if (!existsSync(this.filePath)) return
    try {
      const data = JSON.parse(await readFile(this.filePath, 'utf8'))
      this.targets = new Set(Array.isArray(data) ? data : [])
    } catch (error) {
      this.logger.error('加载群打卡列表失败:', error)
      this.targets = new Set()
    }
  }

  /**
   * 启动自动打卡定时器
   * 根据配置使用cron或setInterval
   */
  private startAutoSignTimer(): void {
    if (this.cronJob) this.cronJob.dispose()
    if (this.timer) clearInterval(this.timer)
    this.cronJob = null
    this.timer = null
    // 如果打卡功能关闭，则不启动定时器
    if (this.config.signMode === SignMode.Off) return
    // 手动模式下检查目标列表大小
    if (this.config.signMode === SignMode.Manual && this.targets.size === 0) return
    if (typeof this.ctx.cron === 'function') {
      this.cronJob = this.ctx.cron('0 0 * * *', () => this.executeAutoSign())
      this.logger.info('已设置每日自动群打卡定时任务')
    } else {
      this.timer = setInterval(() => this.executeAutoSign(), 86400000)
      this.logger.info('已设置每日自动群打卡定时器')
    }
  }

  /**
   * 获取所有群列表
   * @param session - 会话对象
   * @returns Promise<string[]> 群ID列表
   */
  private async getAllGroups(session): Promise<string[]> {
    try {
      const groups = await session.bot.internal.getGroupList()
      return groups.map(group => String(group.group_id))
    } catch (error) {
      this.logger.error('获取群列表失败:', error)
      return []
    }
  }

  /**
   * 执行自动群打卡
   * @param session - 可选的会话对象，用于发送打卡请求
   * @returns Promise 打卡执行完成的Promise
   */
  private async executeAutoSign(session?): Promise<void> {
    try {
      let targets: string[] = []
      // 根据模式选择打卡目标
      if (this.config.signMode === SignMode.Auto) {
        if (!session?.bot) return
        targets = await this.getAllGroups(session)
      } else {
        targets = [...this.targets]
      }
      if (!targets.length) return
      let successCount = 0
      let totalCount = targets.length
      for (const groupId of targets) {
        if (await this.sendGroupSign(session, groupId)) {
          successCount++
        } else {
          this.logger.warn(`群 ${groupId} 打卡失败`)
        }
      }
      this.logger.info(`自动群打卡完成：成功 ${successCount}/${totalCount} 个群`)
    } catch (error) {
      this.logger.error('自动群打卡出错：', error)
    }
  }

  /**
   * 处理打卡目标列表的增删查清
   * @param action - 操作类型：'add'添加, 'remove'移除, 'get'获取, 'clear'清空
   * @param groupId - 群ID，用于add和remove操作
   * @returns 操作结果。get返回目标数组，其他返回布尔值表示成功与否
   */
  async handleTargets(action: 'add' | 'remove' | 'get' | 'clear', groupId?: string): Promise<boolean | string[]> {
    if (action === 'get') return [...this.targets]
    if (action === 'clear') {
      const isEmpty = this.targets.size === 0
      if (!isEmpty) {
        this.targets.clear()
        await writeFile(this.filePath, JSON.stringify([...this.targets]))
          .catch(error => this.logger.error('保存群打卡列表失败:', error))
      }
      return !isEmpty
    }
    if (!groupId || !/^\d+$/.test(groupId)) return false
    const result = action === 'add'
      ? (this.targets.add(groupId), true)
      : this.targets.delete(groupId)
    if (result) {
      await writeFile(this.filePath, JSON.stringify([...this.targets]))
        .catch(error => this.logger.error('保存群打卡列表失败:', error))
    }
    return result
  }

  /**
   * 发送群打卡请求
   * @param session - 会话对象，用于发送打卡请求
   * @param groupId - 目标群ID
   * @returns Promise<boolean> 打卡是否成功
   */
  async sendGroupSign(session, groupId: string): Promise<boolean> {
    try {
      await session.bot.internal.sendGroupSign(groupId)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 注册群打卡相关命令
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

    const sign = this.ctx.command('sign', '群打卡')
      .usage('群打卡\nsign - 当前群打卡\nsign.group <群号> - 为指定群打卡\nsign.list - 查看打卡列表\nsign.add <群号> - 添加到打卡列表\nsign.remove <群号> - 从打卡列表移除\nsign.all - 立即打卡所有群\nsign.clear - 清空打卡列表')
      .action(async ({ session }) => {
        if (!session.guildId) return handleReply(session, '请在群内使用该命令')
        const success = await this.sendGroupSign(session, session.guildId)
        return handleReply(session, success ? `群 ${session.guildId} 打卡成功~` : '群打卡失败')
      })
    sign.subcommand('.list', { authority: 3 })
      .action(async () => {
        const targets = await this.handleTargets('get') as string[];
        return targets.length ? `手动模式 - 当前群打卡列表（共${targets.length}个群）` :
          '手动模式 - 群打卡列表为空'
      })
    sign.subcommand('.group <target:text>')
      .action(async ({ session }, target) => {
        const groupId = target.trim()
        if (!groupId || !/^\d+$/.test(groupId)) return handleReply(session, '请输入有效的群号')
        const success = await this.sendGroupSign(session, groupId)
        return handleReply(session, success ? `群 ${groupId} 打卡成功~` : '群打卡失败')
      })
    sign.subcommand('.all', { authority: 3 })
      .action(async ({ session }) => {
        await handleReply(session, `已开始群打卡，请稍候...`)
        await this.executeAutoSign(session)
        return '群打卡完成'
      })
    sign.subcommand('.add <target:text>', { authority: 2 })
      .action(async ({ session }, target) => {
        const groupId = target.trim()
        if (!groupId || !/^\d+$/.test(groupId)) return handleReply(session, '请输入有效的群号')
        const success = await this.handleTargets('add', groupId)
        return handleReply(session, success ? `已添加群 ${groupId} 到打卡列表` : '添加失败')
      })
    sign.subcommand('.remove <target:text>', { authority: 2 })
      .action(async ({ session }, target) => {
        const groupId = target.trim()
        if (!groupId || !/^\d+$/.test(groupId)) return handleReply(session, '请输入有效的群号')
        const success = await this.handleTargets('remove', groupId)
        return handleReply(session, success ? `已从打卡列表移除群 ${groupId}` : '移除失败')
      })

    sign.subcommand('.clear', { authority: 4 })
      .action(async () => {
        await this.handleTargets('clear')
        return '已清空群打卡列表'
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