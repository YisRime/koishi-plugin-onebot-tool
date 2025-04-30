import { Context, h, Session } from "koishi";
import { Config } from "./index";
import { utils } from "./utils";

declare module 'koishi' {
  interface Session {
    /** 标记是否已触发响应，用于防止循环响应 */
    _responseTriggered?: boolean;
  }
}

/**
 * 定义拍一拍响应的结构
 * @interface PokeResponse
 */
interface PokeResponse {
  /** 响应类型：命令或消息 */
  type: "command" | "message";
  /** 响应内容：命令字符串或消息文本 */
  content: string;
  /** 触发权重：0-100之间 */
  weight: number;
}

/**
 * 处理拍一拍功能的类
 * 包括拍一拍通知处理、随机响应和命令注册
 */
export class Poke {
  /** 用户拍一拍缓存，记录最后一次拍一拍时间 */
  private cache = new Map<string, number>();
  /** 响应总权重 */
  private totalWeight: number = 0;
  /** 命令冷却时间缓存 */
  private commandCooldown = new Map<string, number>();

  /**
   * 创建拍一拍处理器
   * @param ctx - Koishi 上下文
   * @param config - 拍一拍配置
   */
  constructor(private ctx: Context, private config: Config) {
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
   * 释放缓存占用的内存
   */
  dispose() {
    this.cache.clear();
    this.commandCooldown.clear();
  }

  /**
   * 获取一言内容
   * @param params 一言参数，直接拼接到API URL
   * @returns 一言内容，包含出处和作者
   */
  private async getHitokoto(params?: string): Promise<string> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3000)
      const url = `https://v1.hitokoto.cn/${params ? `?${params}` : ''}`
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!response.ok) return ''
      const data = await response.json()
      if (!data?.hitokoto) return ''
      // 没有来源直接返回一言
      if (!data.from) return data.hitokoto
      // 处理引用部分
      const showAuthor = data.from_who && data.from_who !== data.from
      const citation = `——${showAuthor ? ` ${data.from_who}` : ''}《${data.from}》`
      // 计算字符宽度
      const getTextWidth = (text: string) => [...text].reduce((width, char) =>
        width + (/[\u4e00-\u9fa5\u3000-\u30ff\u3130-\u318f\uac00-\ud7af]/.test(char) ? 2 : 1), 0)
      const contentWidth = getTextWidth(data.hitokoto)
      const citationWidth = getTextWidth(citation)
      const maxWidth = 36
      const referenceWidth = Math.min(contentWidth, maxWidth)
      const spacesNeeded = Math.max(0, referenceWidth - citationWidth)
      return `${data.hitokoto}\n${' '.repeat(spacesNeeded)}${citation}`
    } catch {
      return ''
    }
  }

  /**
   * 替换所有占位符
   * @param content 消息内容
   * @param session 会话对象
   * @returns 替换后的内容
   */
  private async replacePlaceholders(content: string, session: Session): Promise<string> {
    if (!content.includes('{')) {
      return content;
    }
    // 收集所有一言占位符
    const hitokotoMatches = [...content.matchAll(/{hitokoto(?::([^}]*))?}/g)];
    // 如果有一言占位符，并行获取所有一言内容
    let hitokotoContents: {pattern: string, content: string}[] = [];
    if (hitokotoMatches.length > 0) {
      hitokotoContents = await Promise.all(
        hitokotoMatches.map(match =>
          this.getHitokoto(match[1] || '')
            .then(content => ({ pattern: match[0], content }))
        )
      );
    }
    // 一次性替换所有占位符
    let result = content
      // 替换{at}占位符
      .replace(/{at}/g, `<at id="${session.userId}"/>`)
      // 替换{username}占位符
      .replace(/{username}/g, session.username || session.userId)
      // 替换{image:URL}占位符
      .replace(/{image:([^}]+)}/g, '<image url="$1"/>');
    // 替换所有一言占位符
    if (hitokotoContents.length > 0) {
      result = hitokotoContents.reduce(
        (text, { pattern, content }) => text.replace(pattern, content),
        result
      );
    }
    return result;
  }

  /**
   * 注册拍一拍命令
   * 允许用户通过命令发送拍一拍
   */
  registerCommand() {
    this.ctx.command('poke [times:number] [target:string]', '拍一拍')
      .usage('发送拍一拍，可指定次数和目标用户')
      .example('poke 3 - 戳自己三次')
      .example('poke @12345 - 戳用户@12345一次')
      .example('poke 3 @12345 - 戳用户@12345三次')
      .action(async ({ session }, times, target) => {
        try {
          // 检查命令冷却时间
          const cdTime = this.config.cdTime * 1000;
          const now = Date.now();
          // 检查是否是响应触发的命令，如果不是才检查cdTime
          const isResponseTriggered = session._responseTriggered === true;
          if (cdTime > 0 && !isResponseTriggered) {
            const userId = session.userId;
            const lastUsed = this.commandCooldown.get(userId) || 0;
            const cooldownRemaining = lastUsed + cdTime - now;
            if (cooldownRemaining > 0) {
              const seconds = Math.ceil(cooldownRemaining / 1000);
              const msgId = await session.send(`请等待${seconds}秒后再拍一拍哦~`);
              utils.autoRecall(session, Array.isArray(msgId) ? msgId[0] : msgId);
              return;
            }
          }
          if (typeof times === 'string' && !target) {
            target = times;
            times = 1;
          }
          times = Math.max(1, Math.floor(Number(times)));
          if (isNaN(times)) times = 1;
          const maxTimes = this.config.maxTimes;
          if (times > maxTimes) {
            const msgId = await session.send(`单次拍一拍请求不能超过${maxTimes}次哦~`);
            utils.autoRecall(session, Array.isArray(msgId) ? msgId[0] : msgId);
            return;
          }
          // 解析目标用户ID
          const parsedId = target ? utils.parseTarget(target) : null;
          const targetId = (!target || !parsedId) ? session.userId : parsedId;
          const actionInterval = this.config.actionInterval;
          for (let i = 0; i < times; i++) {
            await session.onebot._request('send_poke', {
              user_id: targetId,
              group_id: session.isDirect ? undefined : session.guildId
            });
            if (times > 1 && i < times - 1) {
              await new Promise(resolve => setTimeout(resolve, actionInterval));
            }
          }
          // 更新用户的命令使用时间
          if (this.config.cdTime > 0 && !isResponseTriggered) {
            this.commandCooldown.set(session.userId, now);
          }
          return '';
        } catch (error) {
          this.ctx.logger('poke').warn('拍一拍失败:', error);
          return;
        }
      });
  }

  /**
   * 处理拍一拍通知
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
        // 标记这个会话是由响应触发的
        session._responseTriggered = true;
        await session.execute(response.content);
        delete session._responseTriggered;
      } else {
        // 处理占位符
        const processedContent = await this.replacePlaceholders(response.content, session);
        const segments = processedContent.split('{~}');
        for (const seg of segments) {
          await session.sendQueued(h.parse(seg, session));
        }
      }
      return true;
    } catch (error) {
      this.ctx.logger('poke').warn('拍一拍响应失败:', error);
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