import { Session, h } from 'koishi';
import { readFile, writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

/**
 * 工具函数集合
 * 提供通用工具方法供插件其他模块使用
 */
export const utils = {
  /**
   * 解析目标用户ID (支持@元素、@数字格式或纯数字)
   * @param target - 要解析的目标字符串，可以是纯数字、`@`元素或`@`数字格式
   * @returns 解析出的用户ID，如果解析失败则返回null
   */
  parseTarget(target: string): string | null {
    if (!target) return null
    // 尝试解析at元素
    try {
      const atElement = h.select(h.parse(target), 'at')[0]
      if (atElement?.attrs?.id) return atElement.attrs.id;
    } catch {}
    // 尝试匹配@数字格式或纯数字
    const atMatch = target.match(/@(\d+)/)
    const userId = atMatch ? atMatch[1] : (/^\d+$/.test(target.trim()) ? target.trim() : null);
    // 验证ID格式：5-10位数字
    return userId && /^\d{5,10}$/.test(userId) ? userId : null;
  },

  /**
   * 自动撤回消息
   * @param session - 会话对象
   * @param message - 要撤回的消息ID
   * @param delay - 撤回延迟时间(毫秒)，默认10s
   * @returns Promise<void>
   */
  async autoRecall(session: Session, message: string | number, delay: number = 10000): Promise<void> {
    if (!message) return
    try {
      setTimeout(async () => {
        await session.bot?.deleteMessage(session.channelId, message.toString())
      }, delay)
    } catch (error) {
    }
  },

  /**
   * 读取所有模块数据
   * @param baseDir - 基础目录
   * @param logger - 日志记录器
   * @returns 包含所有模块数据的对象
   */
  async getAllModuleData(baseDir: string, logger: any): Promise<Record<string, string[]>> {
    const filePath = resolve(baseDir, 'data', 'onebot-tool.json');
    if (!existsSync(filePath)) {
      return {};
    }

    try {
      const content = await readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      return typeof data === 'object' && data !== null ? data : {};
    } catch (error) {
      logger.error('读取数据文件失败:', error);
      return {};
    }
  },

  /**
   * 保存所有模块数据
   * @param baseDir - 基础目录
   * @param data - 要保存的数据
   * @param logger - 日志记录器
   * @returns 是否保存成功
   */
  async saveAllModuleData(baseDir: string, data: Record<string, string[]>, logger: any): Promise<boolean> {
    const filePath = resolve(baseDir, 'data', 'onebot-tool.json');

    try {
      await writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      logger.error('保存数据文件失败:', error);
      return false;
    }
  },

  /**
   * 加载指定模块的数据
   * @param baseDir - 基础目录
   * @param moduleName - 模块名称
   * @param logger - 日志记录器
   * @returns 模块数据数组
   */
  async loadModuleData(baseDir: string, moduleName: string, logger: any): Promise<string[]> {
    const allData = await this.getAllModuleData(baseDir, logger);
    return Array.isArray(allData[moduleName]) ? allData[moduleName] : [];
  },

  /**
   * 保存指定模块的数据
   * @param baseDir - 基础目录
   * @param moduleName - 模块名称
   * @param data - 要保存的数据
   * @param logger - 日志记录器
   * @returns 是否保存成功
   */
  async saveModuleData(baseDir: string, moduleName: string, data: string[], logger: any): Promise<boolean> {
    const allData = await this.getAllModuleData(baseDir, logger);
    allData[moduleName] = data;
    return await this.saveAllModuleData(baseDir, allData, logger);
  },

  /**
   * 获取Pixiv图片链接数组（本地无则自动下载）
   * @param baseDir 基础目录
   * @param url 下载链接
   * @param logger 日志
   */
  async getPixivLinks(baseDir: string, url: string, logger: any): Promise<string[]> {
    const filePath = resolve(baseDir, 'data', 'pixiv.json');
    if (!existsSync(filePath)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`下载失败: ${res.status}`);
        const text = await res.text();
        await writeFile(filePath, text, 'utf8');
      } catch (e) {
        logger.error('下载JSON文件失败:', e);
        return [];
      }
    }
    try {
      const content = await readFile(filePath, 'utf8');
      const arr = JSON.parse(content);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      logger.error('读取Pixiv链接失败:', e);
      return [];
    }
  }
}