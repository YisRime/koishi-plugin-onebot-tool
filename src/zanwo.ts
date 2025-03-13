import { Context } from 'koishi'
import { resolve } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { Config } from './index'
import { utils } from './utils'

/**
 * QQ点赞功能管理类
 * 处理自动点赞、用户管理和点赞操作
 */
export class Zanwo {
  /**
   * 存储需要自动点赞的目标ID集合
   */
  private targets: Set<string> = new Set()
  private filePath: string
  private logger: any
  private ctx: Context
  private timer: NodeJS.Timeout
  private config: Config['zanwo']

  /**
   * 创建点赞功能实例
   * @param {Context} ctx - Koishi上下文对象
   * @param {Config['zanwo']} config - 插件配置
   */
  constructor(ctx: Context, config: Config['zanwo']) {
    this.ctx = ctx
    this.config = config
    this.logger = ctx.logger('zanwo')
    this.filePath = resolve(ctx.baseDir, 'data', 'zanwo.json')
    this.loadTargetsFromFile().catch(err =>
      this.logger.error('加载点赞列表失败:', err)
    );

    this.startAutoLikeTimer()
  }

  /**
   * 从文件异步加载点赞目标
   */
  private async loadTargetsFromFile(): Promise<void> {
    try {
      if (existsSync(this.filePath)) {
        const data = JSON.parse(await readFile(this.filePath, 'utf8'))
        this.targets = new Set(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      this.logger.error('加载点赞列表失败:', error)
      this.targets = new Set();
    }
  }

  /**
   * 启动自动点赞定时器
   */
  private startAutoLikeTimer(): void {
    if (this.timer) {
      clearInterval(this.timer)
    }

    if (!this.config.autoLike) {
      return
    }

    this.timer = setInterval(() => {
      this.executeAutoLike()
    }, 86400000)
  }

  /**
   * 执行自动点赞
   * @param {any} session - 会话对象，包含bot实例
   */
  private async executeAutoLike(session?): Promise<void> {
    const targets = [...this.targets]
    if (!targets.length) {
      this.logger.info('自动点赞：点赞列表为空')
      return
    }

    this.logger.info(`开始自动点赞，共 ${targets.length} 人`)

    try {
      let successCount = 0;
      for (const userId of targets) {
        if (!session) {
          session = { bot: this.ctx.bots.find(bot => bot.platform === 'onebot') }
        }
        const success = await this.sendLike(session, userId);
        if (success) successCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.info(`自动点赞完成：成功 ${successCount}/${targets.length} 人`)
    } catch (error) {
      this.logger.error('自动点赞出错:', error)
    }
  }

  /**
   * 异步保存点赞目标列表
   */
  private async saveTargets(): Promise<void> {
    try {
      await writeFile(this.filePath, JSON.stringify([...this.targets]))
    } catch (error) {
      this.logger.error('保存点赞列表失败:', error)
    }
  }

  /**
   * 处理点赞目标列表
   */
  handleTargets(action: 'add' | 'remove' | 'get', userId?: string): boolean | string[] {
    if (action === 'get') return [...this.targets];
    if (!userId || !/^\d+$/.test(userId)) return false;

    if (action === 'add') {
      this.targets.add(userId);
      this.saveTargets();
      return true;
    } else {
      const result = this.targets.delete(userId);
      if (result) this.saveTargets();
      return result;
    }
  }

  /**
   * 向指定用户发送点赞
   */
  async sendLike(session, userId: string, rounds: number = 5): Promise<boolean> {
    try {
      let successCount = 0;
      for (let i = 0; i < rounds; i++) {
        try {
          await session.bot.internal.sendLike(userId, 10);
          successCount++;
        } catch (err) {
        }
      }
      return successCount > 0;
    } catch {
      return false;
    }
  }

  /**
   * 设置点赞相关命令
   */
  registerCommands(): void {
    const { adminAccount, adminOnly, enableNotify } = this.config
    const notifyText = enableNotify ? adminAccount : ''
    const checkAdmin = (session) => !adminOnly || session.userId === adminAccount

    const zanwo = this.ctx.command('zanwo', '自动点赞')
      .alias('赞我')
      .usage('自动给你点赞\nzanwo - 为自己点赞\nzanwo.user @用户 - 为指定用户点赞\nzanwo.list - 查看点赞列表\nzanwo.add @用户 - 添加到点赞列表\nzanwo.remove @用户 - 从点赞列表移除\nzanwo.all - 立即点赞列表')
      .action(async ({ session }) => {
        const success = await this.sendLike(session, session.userId)
        const message = await session.send(success ? `点赞完成，记得回赞${notifyText}哦~` : '点赞失败')
        await utils.autoRecall(session, Array.isArray(message) ? message[0] : message)
      })
    // 查看点赞列表
    zanwo.subcommand('.list', { authority: 2 })
      .action(({ session }) => {
        if (!checkAdmin(session)) return '仅管理员可用'
        const targets = this.handleTargets('get') as string[]
        return targets.length ? `当前点赞列表（共${targets.length}人）：${targets.join(', ')}` : '点赞列表为空'
      })
    // 添加到点赞列表
    zanwo.subcommand('.add <target:text>')
      .action(({ session }, target) => {
        if (!checkAdmin(session)) return '仅管理员可用'
        const userId = utils.parseTarget(target)
        if (!userId) return '找不到指定用户或格式不正确'
        return this.handleTargets('add', userId) ? `已添加 ${userId} 到点赞列表` : '添加失败'
      })
    // 从点赞列表移除
    zanwo.subcommand('.remove <target:text>')
      .action(({ session }, target) => {
        if (!checkAdmin(session)) return '仅管理员可用'
        const userId = utils.parseTarget(target)
        if (!userId) return '找不到指定用户或格式不正确'
        return this.handleTargets('remove', userId) ? `已从点赞列表移除 ${userId}` : '移除失败'
      })
    // 为指定用户点赞
    zanwo.subcommand('.user <target:text>', { authority: 2 })
      .action(async ({ session }, target) => {
        const userId = utils.parseTarget(target)
        if (!userId || userId === session.userId) {
          const message = await session.send('找不到指定用户')
          await utils.autoRecall(session, Array.isArray(message) ? message[0] : message)
          return
        }
        const success = await this.sendLike(session, userId)
        const message = await session.send(success ? `点赞完成，记得回赞${notifyText}哦~` : '点赞失败')
        await utils.autoRecall(session, Array.isArray(message) ? message[0] : message)
      })
    // 执行手动点赞
    zanwo.subcommand('.all', { authority: 2 })
      .action(async ({ session }) => {
        if (!checkAdmin(session)) return '仅管理员可用'
        this.executeAutoLike(session);
        return '已开始执行点赞任务'
      })
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }
}
