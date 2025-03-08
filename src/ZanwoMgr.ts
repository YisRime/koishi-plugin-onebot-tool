import { Context } from 'koishi'
import { resolve } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

/**
 * 赞我管理器类
 * 管理QQ点赞功能，包括目标管理和点赞操作
 * @class ZanwoMgr
 */
export class ZanwoMgr {
  /**
   * 存储需要自动点赞的目标ID集合
   * @private
   * @type {Set<string>}
   */
  private likeTargets: Set<string> = new Set();
  private filePath: string;

  /**
   * 创建赞我管理器实例
   * @param {Context} ctx - Koishi上下文对象
   */
  constructor(private ctx: Context) {
    this.filePath = resolve(ctx.baseDir, 'data', 'zanwo.json');
    this.loadData();
  }

  /**
   * 从JSON文件加载点赞列表数据
   */
  private loadData(): void {
    try {
      if (existsSync(this.filePath)) {
        const data = JSON.parse(readFileSync(this.filePath, 'utf8'));
        this.likeTargets = new Set(data);
      }
    } catch (error) {
      this.ctx.logger.error('Failed to load zanwo data:', error)
    }
  }

  /**
   * 将点赞列表数据保存到JSON文件
   */
  private saveData(): void {
    try {
      writeFileSync(this.filePath, JSON.stringify([...this.likeTargets]));
    } catch (error) {
      this.ctx.logger.error('Failed to save zanwo data:', error)
    }
  }

  /**
   * 添加一个ID到点赞列表
   * @param target - 要添加的ID
   * @returns 添加是否成功
   */
  async addQQ(target: string): Promise<boolean> {
    if (!/^\d+$/.test(target)) return false
    this.likeTargets.add(target)
    this.saveData()
    return true
  }

  /**
   * 从点赞列表中移除一个ID
   * @param target - 要移除的ID
   * @returns 移除是否成功
   */
  async removeQQ(target: string): Promise<boolean> {
    if (!this.likeTargets.has(target)) return false
    this.likeTargets.delete(target)
    this.saveData()
    return true
  }

  /**
   * 获取当前赞我列表中的所有ID
   * @returns ID字符串数组
   */
  getList(): string[] {
    return [...this.likeTargets];
  }

  /**
   * 向指定用户发送点赞
   * @param session - 会话上下文
   * @param targetId - 目标用户ID
   * @param count - 点赞次数，默认5次
   * @param concurrency - 并发数，默认3
   * @returns 点赞是否成功完成
   */
  async sendLikes(session, targetId: string, count: number = 5, concurrency: number = 3): Promise<boolean> {
    const chunks: number[][] = [];
    for (let i = 0; i < count; i += concurrency) {
      chunks.push(Array(Math.min(concurrency, count - i)).fill(1));
    }

    try {
      for (const chunk of chunks) {
        const promises = chunk.map(() =>
          session.bot.internal.sendLike(targetId, 10).catch(() => null)
        );

        await Promise.all([
          ...promises,
          new Promise(resolve => setTimeout(resolve, 500))
        ]);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 执行批量点赞操作
   * @param {Session} session - 会话上下文
   * @param {string[]} targetIds - 目标用户ID列表
   * @param {number} [count=5] - 每个目标的点赞次数
   * @param {number} [concurrency=3] - 单用户并发数
   * @returns {Promise<Map<string, boolean>>} 点赞结果映射
   */
  async sendBatchLikes(
    session,
    targetIds: string[],
    count: number = 5,
    concurrency: number = 3
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const targetId of targetIds) {
      results.set(targetId, await this.sendLikes(session, targetId, count, concurrency));
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}
