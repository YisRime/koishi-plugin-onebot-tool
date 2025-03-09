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
  private disposer: (() => void) | null = null;
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
   * 清理资源，移除事件监听器
   */
  dispose() {
    if (this.disposer) {
      this.disposer();
      this.disposer = null;
    }
    this.cache.clear();
  }

  /**
   * 注册戳一戳命令
   */
  registerCommand() {
    this.ctx.command('poke <target:text>', '戳一戳')
      .usage('戳一戳指定用户或自己')
      .example('poke @用户 - 戳一戳指定用户')
      .action(async ({ session }, target) => {
        if (!session.onebot) return;

        const targetId = target ? utils.parseTarget(target) : session.userId;
        if (!targetId) {
          return '无法识别目标用户';
        }

        const params = {
          user_id: targetId,
          group_id: session.isDirect ? undefined : session.guildId
        };

        const api = session.isDirect ? "friend_poke" : "group_poke";
        try {
          await session.onebot._request(api, params);
        } catch (error) {
          return '戳一戳失败，请稍后重试';
        }
      });

    this.registerNoticeListener();
  }

  /**
   * 注册戳一戳通知监听器
   */
  registerNoticeListener() {
    this.disposer = this.ctx.platform('onebot').on("notice", async (session: Session) => {
      if (session.subtype !== "poke" || session.targetId !== session.selfId) {
        return;
      }

      if (this.config?.interval > 0) {
        const lastTime = this.cache.get(session.userId);
        if (lastTime && (session.timestamp - lastTime < this.config.interval)) {
          return;
        }
        this.cache.set(session.userId, session.timestamp);
      }

      if (!this.config?.responses?.length) return;
      const response = this.randomResponse();

      if (response.type === "command") {
        await session.execute(response.content);
      } else {
        await session.sendQueued(h.parse(response.content, session));
      }
    });
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
