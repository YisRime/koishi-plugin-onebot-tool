import { Context, h, Session } from "koishi";
import { Config } from "./index";

/**
 * 戳一戳响应接口
 * @interface PokeResponse
 * @property {('command'|'message')} type - 响应类型，可以是执行命令或发送消息
 * @property {string} content - 响应内容，命令字符串或消息内容
 * @property {number} weight - 响应权重，用于随机选择
 */
interface PokeResponse {
  type: "command" | "message";
  content: string;
  weight: number;
}

/**
 * 戳一戳功能类
 * @class Poke
 * @description 处理戳一戳命令和事件响应
 */
export class Poke {
  private cache = new Map<string, number>();
  private ctx: Context;
  private config: Config['poke'];

  constructor(ctx: Context, config: Config['poke']) {
    this.ctx = ctx;
    this.config = config;
  }

  registerCommand() {

    this.ctx.command('poke [target:user]', '戳一戳')
      .usage('戳一戳指定用户或自己')
      .example('poke @用户 - 戳一戳指定用户')
      .action(async ({ session }, target) => {
        if (!session.onebot) {
          return;
        }

        const params = { user_id: session.userId };
        if (target) {
          params.user_id = target;
        }

        if (session.isDirect) {
          await session.onebot._request("friend_poke", params);
        } else {
          params["group_id"] = session.guildId;
          await session.onebot._request("group_poke", params);
        }
      });

    this.registerNoticeListener();
  }

  /**
   * 注册戳一戳事件监听
   * @description 监听 OneBot 平台的戳一戳通知事件并处理响应
   */
  registerNoticeListener() {
    this.ctx.platform('onebot').on("notice", async (session: Session) => {
      if (session.subtype != "poke") {
        return;
      }
      if (session.targetId != session.selfId) {
        return;
      }

      if (this.config?.interval > 0 && this.cache.has(session.userId)) {
        const ts = this.cache.get(session.userId)!;
        if (session.timestamp - ts < this.config.interval) {
          return;
        }
      }

      this.cache.set(session.userId, session.timestamp);

      if (!this.config?.responses || this.config.responses.length === 0) {
        return;
      }

      const response = this.randomResponse(this.config.responses);

      switch (response.type) {
        case "command":
          await session.execute(response.content);
          break;
        case "message":
          const content = h.parse(response.content, session);
          await session.sendQueued(content);
          break;
      }
    });
  }

  /**
   * 根据权重随机选择一个响应
   * @param {PokeResponse[]} responses - 响应列表
   * @returns {PokeResponse} 选中的响应
   */
  private randomResponse(responses: PokeResponse[]): PokeResponse {
    const totalWeight = responses.reduce((sum, resp) => sum + resp.weight, 0);
    const random = Math.random() * totalWeight;
    let sum = 0;

    for (const response of responses) {
      sum += response.weight;
      if (random < sum) return response;
    }

    return responses[0];
  }
}
