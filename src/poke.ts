import { Context, h, Session } from "koishi";
import { Config } from "./index";
import { utils } from "./utils";

/**
 * 定义戳一戳响应的结构
 * @interface PokeResponse
 */
interface PokeResponse {
  type: "command" | "message";
  content: string;
  weight: number;
}

/**
 * 处理戳一戳功能的类
 */
export class Poke {
  private cache = new Map<string, number>();
  private totalWeight: number = 0;

  /**
   * 创建戳一戳处理器
   * @param ctx Koishi 上下文
   * @param config 戳一戳配置
   */
  constructor(private ctx: Context, private config: Config['poke']) {
    if (config?.responses?.length) {
      this.totalWeight = config.responses.reduce((sum, resp) => sum + resp.weight, 0);
      if (this.totalWeight > 100) {
        const scaleFactor = 100 / this.totalWeight;
        config.responses.forEach(resp => {
          resp.weight = resp.weight * scaleFactor;
        });
        this.totalWeight = 100;
      }
    }
  }

  /**
   * 清理资源
   */
  dispose() {
    this.cache.clear();
  }

  /**
   * 注册戳一戳命令
   */
  registerCommand() {
    this.ctx.command('poke [times:number]', '戳一戳')
      .option('user', '-u <target:string> 指定目标用户')
      .usage('发送戳一戳，可指定次数和目标用户')
      .example('poke 3 - 戳自己三次')
      .example('poke 3 -u @12345 - 戳用户12345三次')
      .action(async ({ session, options }, times = 1) => {
        try {
          times = Math.max(1, Math.floor(Number(times)));
          if (isNaN(times)) times = 1;
          // 添加次数限制
          if (times > 10) {
            return '单次戳一戳不能超过10次哦~';
          }
          // 解析目标用户ID
          const target = options.user;
          const parsedId = target ? utils.parseTarget(target) : null;
          const targetId = (!target || !parsedId) ? session.userId : parsedId;
          // 发送多次戳一戳
          for (let i = 0; i < times; i++) {
            await session.onebot._request('send_poke', {
              user_id: targetId,
              group_id: session.isDirect ? undefined : session.guildId
            });
            if (times > 1 && i < times - 1) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }

          return '';
        } catch (error) {
          this.ctx.logger('poke').warn('戳一戳失败:', error);
          return;
        }
      });
  }

  /**
   * 处理戳一戳通知
   * 由外部监听器调用
   */
  async processNotice(session: Session): Promise<boolean> {
    if (session.subtype !== "poke" || session.targetId !== session.selfId) {
      return false;
    }

    if (this.config?.interval > 0) {
      const lastTime = this.cache.get(session.userId);
      if (lastTime && (session.timestamp - lastTime < this.config.interval)) {
        return false;
      }
      this.cache.set(session.userId, session.timestamp);
    }

    if (!this.config?.responses?.length) return false;
    const response = this.randomResponse();
    if (!response) return false;

    try {
      if (response.type === "command") {
        await session.execute(response.content);
      } else {
        await session.sendQueued(h.parse(response.content, session));
      }
      return true;
    } catch (error) {
      this.ctx.logger('poke').warn('戳一戳响应失败:', error);
      return false;
    }
  }

  /**
   * 随机选择一个响应
   * @returns 选中的响应，如果没有配置响应则返回null
   */
  private randomResponse(): PokeResponse {
    if (!this.config?.responses?.length) return null;

    const responses = this.config.responses;
    const random = Math.random() * this.totalWeight;
    let sum = 0;

    for (const response of responses) {
      sum += response.weight;
      if (random < sum) return response;
    }

    return responses[0];
  }
}
