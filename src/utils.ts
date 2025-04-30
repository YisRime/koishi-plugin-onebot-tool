import { Session, h } from 'koishi';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

/**
 * 工具函数集合
 * 提供通用工具方法供插件其他模块使用
 */
export const utils = {
  /**
   * 解析目标用户ID (支持@元素、@数字格式或纯数字)
   */
  parseTarget(target: string): string | null {
    if (!target) return null;
    try {
      const at = h.select(h.parse(target), 'at')[0]?.attrs?.id;
      if (at) return at;
    } catch {}
    const m = target.match(/@?(\d{5,10})/);
    return m ? m[1] : null;
  },

  /**
   * 自动撤回消息
   */
  async autoRecall(session: Session, message: string | number, delay = 10000): Promise<void> {
    if (!message) return;
    setTimeout(() => session.bot?.deleteMessage(session.channelId, message.toString()), delay);
  },

  /**
   * 读取所有模块数据
   */
  async getAllModuleData(baseDir: string, logger: any): Promise<Record<string, string[]>> {
    const filePath = resolve(baseDir, 'data', 'onebot-tool.json');
    if (!existsSync(filePath)) return {};
    try {
      const data = JSON.parse(await readFile(filePath, 'utf8'));
      return typeof data === 'object' && data ? data : {};
    } catch (e) {
      logger.error('读取数据文件失败:', e);
      return {};
    }
  },

  /**
   * 保存所有模块数据
   */
  async saveAllModuleData(baseDir: string, data: Record<string, string[]>, logger: any): Promise<boolean> {
    try {
      await writeFile(resolve(baseDir, 'data', 'onebot-tool.json'), JSON.stringify(data, null, 2));
      return true;
    } catch (e) {
      logger.error('保存数据文件失败:', e);
      return false;
    }
  },

  /**
   * 加载指定模块的数据
   */
  async loadModuleData(baseDir: string, moduleName: string, logger: any): Promise<string[]> {
    return (await this.getAllModuleData(baseDir, logger))[moduleName] ?? [];
  },

  /**
   * 保存指定模块的数据
   */
  async saveModuleData(baseDir: string, moduleName: string, data: string[], logger: any): Promise<boolean> {
    const allData = await this.getAllModuleData(baseDir, logger);
    allData[moduleName] = data;
    return this.saveAllModuleData(baseDir, allData, logger);
  },

  /**
   * 获取Pixiv图片链接数组（本地无则自动下载）
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
        await writeFile(filePath, await res.text(), 'utf8');
      } catch (e) {
        logger.error('下载JSON文件失败:', e);
        return [];
      }
    }
    try {
      const arr = JSON.parse(await readFile(filePath, 'utf8'));
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      logger.error('读取Pixiv链接失败:', e);
      return [];
    }
  }
}