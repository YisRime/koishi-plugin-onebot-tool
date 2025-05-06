import { Session, h } from 'koishi';
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync, statSync } from 'fs';
import { resolve, extname } from 'path';

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
   * 检查文件是否为图片
   */
  isImageFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  },

  /**
   * 获取本地目录中的图片文件列表
   */
  async getLocalImages(dirPath: string, logger: any): Promise<string[]> {
    try {
      if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) return [];
      const files = await readdir(dirPath);
      const imagePaths = files
        .filter(file => this.isImageFile(file))
        .map(file => resolve(dirPath, file));
      return imagePaths;
    } catch (e) {
      logger.error(`读取图片目录失败: ${e.message}`);
      return [];
    }
  },

  /**
   * 获取Pixiv图片链接数组（支持网络JSON或本地目录）
   */
  async getPixivLinks(baseDir: string, path: string, logger: any): Promise<string[]> {
    // 判断是URL还是本地路径
    if (path.startsWith('http://') || path.startsWith('https://')) {
      // 处理网络JSON的情况
      const filePath = resolve(baseDir, 'data', 'pixiv.json');
      if (!existsSync(filePath)) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 30000);
          const res = await fetch(path, { signal: controller.signal });
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
    } else {
      return this.getLocalImages(path, logger);
    }
  }
}