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
    this.ctx.command('poke [target:text]', '戳一戳')
      .usage('戳一戳指定用户或自己')
      .example('poke - 戳一戳自己')
      .example('poke @用户 - 戳一戳指定用户')
      .example('poke 123456 - 戳一戳用户123456')
      .action(async ({ session }, target) => {
        if (!session.onebot) return;

        try {
          const parsedId = target ? utils.parseTarget(target) : null;
          const targetId = (!target || !parsedId) ? session.userId : parsedId;

          await session.onebot._request('send_poke', {
            user_id: targetId,
            group_id: session.isDirect ? undefined : session.guildId
          });

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
