import { Context } from 'koishi'
import { Config, SignMode } from './index'
import { utils } from './utils'

/**
 * QQ群打卡功能管理类
 * 处理自动打卡、打卡列表管理和相关命令
 */
export class Sign {
  /** 打卡目标群ID集合 */
  private targets = new Set<string>()
  /** 模块名称，用于数据存储 */
  private moduleName = 'sign'
  /** 日志记录器 */
  private logger
  /** Koishi上下文 */
  private ctx
  /** 定时任务对象 */
  private cronJob = null
  /** 定时器 */
  private timer = null
  /** 插件配置 */
  private config

  /**
   * 创建群打卡管理实例
   * @param ctx Koishi上下文
   * @param config 插件配置
   * @param logger 日志记录器
   */
  constructor(ctx: Context, config: Config, logger: any) {
    this.ctx = ctx
    this.config = config
    this.logger = logger
    this.loadTargetsFromFile().catch(err => this.logger.error('加载群打卡列表失败:', err))
    if (this.config.signMode === SignMode.Auto) this.startAutoSignTimer()
  }

  /**
   * 从文件加载打卡目标列表
   * @private
   */
  private async loadTargetsFromFile() {
    this.targets = new Set(await utils.loadModuleData(this.ctx.baseDir, this.moduleName, this.logger))
  }

  /**
   * 启动自动打卡定时器
   * @private
   */
  private startAutoSignTimer() {
    this.cronJob?.dispose()
    this.timer && clearInterval(this.timer)
    this.cronJob = this.timer = null
    if (this.config.signMode !== SignMode.Auto) return
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
   * @param session Koishi 会话对象
   * @returns 群ID数组
   * @private
   */
  private async getAllGroups(session) {
    try {
      return (await session.bot.internal.getGroupList()).map(g => String(g.group_id))
    } catch (e) {
      this.logger.error('获取群列表失败:', e)
      return []
    }
  }

  /**
   * 执行自动群打卡
   * @param session 可选，Koishi 会话对象
   * @private
   */
  private async executeAutoSign(session?) {
    try {
      let targets: string[] = []
      if (this.config.signMode === SignMode.Auto) {
        if (!session?.bot) return
        targets = await this.getAllGroups(session)
      } else {
        targets = [...this.targets]
      }
      if (!targets.length) return
      let successCount = 0
      for (const groupId of targets)
        if (await this.sendGroupSign(session, groupId)) successCount++
        else this.logger.warn(`群 ${groupId} 打卡失败`)
      this.logger.info(`自动群打卡完成：成功 ${successCount}/${targets.length} 个群`)
    } catch (e) {
      this.logger.error('自动群打卡出错：', e)
    }
  }

  /**
   * 处理打卡目标列表的增删查清
   * @param action 操作类型：'add'添加, 'remove'移除, 'get'获取, 'clear'清空
   * @param groupId 群ID，用于add和remove操作
   * @returns 操作结果
   */
  async handleTargets(action: 'add' | 'remove' | 'get' | 'clear', groupId?: string) {
    if (action === 'get') return [...this.targets]
    if (action === 'clear') {
      const changed = !!this.targets.size
      this.targets.clear()
      if (changed) await utils.saveModuleData(this.ctx.baseDir, this.moduleName, [], this.logger)
      return changed
    }
    if (!groupId || !/^\d+$/.test(groupId)) return false
    const changed = action === 'add' ? this.targets.add(groupId) : this.targets.delete(groupId)
    if (changed) await utils.saveModuleData(this.ctx.baseDir, this.moduleName, [...this.targets], this.logger)
    return changed
  }

  /**
   * 发送群打卡请求
   * @param session Koishi 会话对象
   * @param groupId 群ID
   * @returns 是否打卡成功
   */
  async sendGroupSign(session, groupId: string) {
    try {
      await session.bot.internal.sendGroupSign(groupId)
      return true
    } catch { return false }
  }

  /**
   * 注册群打卡相关命令
   * @param parentCmd 父命令对象
   */
  registerCommands(parentCmd) {
    const handleReply = async (session, message) => {
      const msg = await session.send(message)
      await utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
      return ''
    }
    const sign = parentCmd.subcommand('sign', '打卡功能')
      .usage('在当前群进行打卡')
      .action(async ({ session }) => {
        if (!session.guildId) return handleReply(session, '请在群内使用该命令')
        const success = await this.sendGroupSign(session, session.guildId)
        return handleReply(session, success ? `群 ${session.guildId} 打卡成功~` : '群打卡失败')
      })
    sign.subcommand('.list', '查看列表', { authority: 3 })
      .usage('查看打卡群列表')
      .action(async () => {
        const targets = await this.handleTargets('get') as string[]
        return targets.length ? `手动模式 - 当前群打卡列表（共${targets.length}个群）` : '手动模式 - 群打卡列表为空'
      })
    sign.subcommand('.group <target:text>', '指定打卡')
      .usage('打卡指定群')
      .action(async ({ session }, target) => {
        const groupId = target.trim()
        if (!groupId || !/^\d+$/.test(groupId)) return handleReply(session, '请输入有效的群号')
        const success = await this.sendGroupSign(session, groupId)
        return handleReply(session, success ? `群 ${groupId} 打卡成功~` : '群打卡失败')
      })
    sign.subcommand('.all', '全部打卡', { authority: 3 })
      .usage('打卡所有列表中的群')
      .action(async ({ session }) => {
        await handleReply(session, `已开始群打卡，请稍候...`)
        await this.executeAutoSign(session)
        return '群打卡完成'
      })
    sign.subcommand('.add <target:text>', '添加群', { authority: 2 })
      .usage('添加群到打卡列表')
      .action(async ({ session }, target) => {
        const groupId = target.trim()
        if (!groupId || !/^\d+$/.test(groupId)) return handleReply(session, '请输入有效的群号')
        const success = await this.handleTargets('add', groupId)
        return handleReply(session, success ? `已添加群 ${groupId} 到打卡列表` : '添加失败')
      })
    sign.subcommand('.remove <target:text>', '移除群', { authority: 2 })
      .usage('从打卡列表移除群')
      .action(async ({ session }, target) => {
        const groupId = target.trim()
        if (!groupId || !/^\d+$/.test(groupId)) return handleReply(session, '请输入有效的群号')
        const success = await this.handleTargets('remove', groupId)
        return handleReply(session, success ? `已从打卡列表移除群 ${groupId}` : '移除失败')
      })
    sign.subcommand('.clear', '清空列表', { authority: 4 })
      .usage('清空打卡列表')
      .action(async () => {
        await this.handleTargets('clear')
        return '已清空群打卡列表'
      })
  }

  /**
   * 释放资源，清理定时任务和计时器
   */
  dispose() {
    this.cronJob?.dispose()
    this.cronJob = null
    this.timer && clearInterval(this.timer)
    this.timer = null
  }
}