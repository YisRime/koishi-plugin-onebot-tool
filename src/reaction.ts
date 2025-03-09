import { Context, h } from 'koishi'
import { Config } from './index'

/**
 * 表情回复功能处理类
 */
export class Reaction {
  /**
   * 创建表情回复处理器
   * @param ctx Koishi 上下文
   * @param config 表情回复配置
   */
  constructor(private ctx: Context, private config: Config['reaction']) {}

  /**
   * 处理消息中的表情回复
   * 由外部中间件调用
   */
  async processMessage(session): Promise<boolean> {
    if (session.userId === session.selfId) return false

    let elements = h.select(h.parse(session.content), 'face')
    if (elements.length === 0) return false

    try {
      // 检测到表情后，随机回复一个表情
      const faceId = this.getRandomFaceId()
      await session.send(h('face', { id: faceId }))
      return true
    } catch (error) {
      this.ctx.logger('reaction').warn('表情回复失败:', error)
      return false
    }
  }

  /**
   * 注册表情回复命令
   */
  registerCommand() {
    this.ctx.command('reaction [faceId:string]', '表情回复')
      .option('all', '-a 回复多个随机表情')
      .usage('回复表情消息')
      .action(async ({ session, options }, faceId) => {
        try {
          if (options.all) {
            return await this.sendRandomFaces(session, 30);
          } else if (faceId) {
            if (!this.isValidFaceId(faceId)) {
              return '表情ID无效，应为0-220之间的数字';
            }
            await session.send(h('face', { id: faceId }));
            return '已发送表情';
          } else {
            const randomFaceId = this.getRandomFaceId();
            await session.send(h('face', { id: randomFaceId }));
            return '已发送随机表情';
          }
        } catch (error) {
          this.ctx.logger('reaction').warn('手动表情回复失败:', error);
          return '表情回复失败';
        }
      });
  }

  /**
   * 判断表情ID是否有效
   * @param faceId 表情ID
   * @returns 是否为有效表情ID
   */
  private isValidFaceId(faceId: string): boolean {
    const id = parseInt(faceId);
    return !isNaN(id) && id >= 0 && id <= 220;
  }

  /**
   * 获取一个随机的表情ID
   * @returns 随机表情ID
   */
  private getRandomFaceId(): string {
    return Math.floor(Math.random() * 221).toString();
  }

  /**
   * 发送多个随机表情
   * @param session 会话对象
   * @param count 表情数量
   * @returns 操作结果消息
   */
  private async sendRandomFaces(session, count: number): Promise<string> {
    const faceIds = new Set<number>();
    while (faceIds.size < Math.min(count, 221)) {
      faceIds.add(Math.floor(Math.random() * 221));
    }

    const faces = Array.from(faceIds).map(id => h('face', { id: id.toString() }));

    const batchSize = 10;
    for (let i = 0; i < faces.length; i += batchSize) {
      const batch = faces.slice(i, i + batchSize);
      await session.send(h('message', batch));

      if (i + batchSize < faces.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return `已发送 ${faces.length} 个随机表情`;
  }
}
