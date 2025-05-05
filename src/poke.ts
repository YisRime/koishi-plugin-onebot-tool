import { Context, h, Session } from "koishi";
import { Config } from "./index";
import { utils } from "./utils";

declare module 'koishi' {
  interface Session {
    _responseTriggered?: boolean;
  }
}

interface PokeResponse {
  type: "command" | "message";
  content: string;
  weight: number;
}

/**
 * 拍一拍功能管理类
 * 处理拍一拍命令、自动响应等功能
 */
export class Poke {
  private cache = new Map<string, number>();
  private totalWeight = 0;
  private commandCooldown = new Map<string, number>();
  private imagesUrl: string;
  private logger: any;

  /**
   * 构造函数
   * @param ctx Koishi 上下文
   * @param config 插件配置
   * @param logger 日志记录器
   */
  constructor(private ctx: Context, private config: Config, logger: any) {
    this.logger = logger;
    if (config?.responses?.length) {
      this.totalWeight = config.responses.reduce((sum, resp) => sum + resp.weight, 0);
      if (this.totalWeight > 100) {
        const scale = 100 / this.totalWeight;
        config.responses.forEach(resp => resp.weight *= scale);
        this.totalWeight = 100;
      }
    }
    this.imagesUrl = config.imagesUrl || 'https://raw.githubusercontent.com/YisRime/koishi-plugin-onebot-tool/main/resource/pixiv.json';
  }

  /**
   * 释放资源
   */
  dispose() {
    this.cache.clear();
    this.commandCooldown.clear();
  }

  /**
   * 获取一言内容
   * @param params 可选参数
   * @returns 一言内容字符串
   * @private
   */
  private async getHitokoto(params?: string): Promise<string> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const url = `https://v1.hitokoto.cn/${params ? `?${params}` : ''}`;
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) return '';
      const data = await response.json();
      if (!data?.hitokoto) return '';
      if (!data.from) return data.hitokoto;
      const showAuthor = data.from_who && data.from_who !== data.from;
      const citation = `——${showAuthor ? ` ${data.from_who}` : ''}《${data.from}》`;
      const getTextWidth = (text: string) => [...text].reduce((w, c) =>
        w + (/[\u4e00-\u9fa5\u3000-\u30ff\u3130-\u318f\uac00-\ud7af]/.test(c) ? 2 : 1), 0);
      const contentWidth = getTextWidth(data.hitokoto), citationWidth = getTextWidth(citation), maxWidth = 36;
      const spaces = Math.max(0, Math.min(contentWidth, maxWidth) - citationWidth);
      return `${data.hitokoto}\n${' '.repeat(spaces)}${citation}`;
    } catch { return ''; }
  }

  /**
   * 替换响应内容中的占位符
   * @param content 响应内容
   * @param session Koishi 会话对象
   * @returns 替换后的内容
   * @private
   */
  private async replacePlaceholders(content: string, session: Session): Promise<string> {
    if (!content.includes('{')) return content;
    const hitokotoMatches = [...content.matchAll(/{hitokoto(?::([^}]*))?}/g)];
    const pixivMatches = [...content.matchAll(/{pixiv}/g)];
    let hitokotoContents = hitokotoMatches.length
      ? await Promise.all(hitokotoMatches.map(m => this.getHitokoto(m[1]).then(content => ({ pattern: m[0], content }))))
      : [];
    let pixivContents = [];
    if (pixivMatches.length) {
      const arr = await utils.getPixivLinks(this.ctx.baseDir, this.imagesUrl, this.logger);
      pixivContents = await Promise.all(pixivMatches.map(async m => {
        let content = '';
        if (Array.isArray(arr) && arr.length) {
          const candidate = arr[Math.floor(Math.random() * arr.length)];
          try {
            const res = await fetch(candidate, { headers: { 'Referer': 'https://www.pixiv.net/' } });
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              const ext = candidate.split('.').pop()?.toLowerCase() || 'jpg';
              const mime = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
              content = `<image src="base64://${buffer.toString('base64')}" type="${mime}"/>`;
            }
          } catch (e) { this.logger.error('图片发送失败:', e); }
        }
        return { pattern: m[0], content };
      }));
    }
    let result = content
      .replace(/{at}/g, `<at id="${session.userId}"/>`)
      .replace(/{username}/g, session.username || session.userId)
      .replace(/{image:([^}]+)}/g, '<image url="$1"/>');
    hitokotoContents.forEach(({ pattern, content }) => result = result.replace(pattern, content));
    pixivContents.forEach(({ pattern, content }) => result = result.replace(pattern, content));
    return result;
  }

  /**
   * 注册拍一拍命令
   * @param parentCmd 父命令对象
   */
  registerCommand(parentCmd) {
    parentCmd.subcommand('poke [times:number] [target:string]', '拍一拍')
      .usage('发送拍一拍，可指定次数和目标用户')
      .example('poke @12345 - 拍用户@12345一次')
      .example('poke 3 @12345 - 拍用户@12345三次')
      .action(async ({ session }, times, target) => {
        try {
          const cdTime = this.config.cdTime * 1000, now = Date.now();
          const isResponseTriggered = session._responseTriggered === true;
          if (cdTime > 0 && !isResponseTriggered) {
            const lastUsed = this.commandCooldown.get(session.userId) || 0;
            const cooldownRemaining = lastUsed + cdTime - now;
            if (cooldownRemaining > 0) {
              const msgId = await session.send(`请等待${Math.ceil(cooldownRemaining / 1000)}秒后再拍一拍哦~`);
              utils.autoRecall(session, Array.isArray(msgId) ? msgId[0] : msgId);
              return;
            }
          }
          if (typeof times === 'string' && !target) [target, times] = [times, 1];
          times = Math.max(1, Math.floor(Number(times)));
          if (isNaN(times)) times = 1;
          if (times > this.config.maxTimes) {
            const msgId = await session.send(`单次拍一拍请求不能超过${this.config.maxTimes}次哦~`);
            utils.autoRecall(session, Array.isArray(msgId) ? msgId[0] : msgId);
            return;
          }
          const parsedId = target ? utils.parseTarget(target) : null;
          const targetId = (!target || !parsedId) ? session.userId : parsedId;
          for (let i = 0; i < times; i++) {
            await session.onebot._request('send_poke', {
              user_id: targetId,
              group_id: session.isDirect ? undefined : session.guildId
            });
            if (times > 1 && i < times - 1) await new Promise(r => setTimeout(r, this.config.actionInterval));
          }
          if (this.config.cdTime > 0 && !isResponseTriggered) this.commandCooldown.set(session.userId, now);
          return '';
        } catch { return; }
      });
  }

  /**
   * 处理拍一拍通知事件
   * @param session Koishi 会话对象
   * @returns 是否已响应
   */
  async processNotice(session: Session): Promise<boolean> {
    if (session.subtype !== "poke" || session.targetId !== session.selfId) return false;
    if (this.config?.interval > 0) {
      const lastTime = this.cache.get(session.userId);
      if (lastTime && (session.timestamp - lastTime < this.config.interval)) return false;
      this.cache.set(session.userId, session.timestamp);
    }
    if (!this.config?.responses?.length) return false;
    const response = this.randomResponse();
    if (!response) return false;
    try {
      if (response.type === "command") {
        session._responseTriggered = true;
        await session.execute(response.content);
        delete session._responseTriggered;
      } else {
        for (const seg of response.content.split('{~}')) {
          await session.sendQueued(h.parse(await this.replacePlaceholders(seg, session), session));
        }
      }
      return true;
    } catch { return false; }
  }

  /**
   * 随机选择一个拍一拍响应
   * @returns 响应对象
   * @private
   */
  private randomResponse(): PokeResponse {
    if (!this.config?.responses?.length) return null;
    const responses = this.config.responses;
    let sum = 0, random = Math.random() * this.totalWeight;
    for (const response of responses) if ((sum += response.weight) > random) return response;
    return responses[0];
  }
}