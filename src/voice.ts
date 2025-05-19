import { Context, h } from 'koishi'
import { utils } from './utils'

/**
 * AI语音功能管理类
 * 提供AI语音角色列表、语音发送等命令
 */
export class Voice {
  ctx: Context
  logger: any

  /**
   * 构造函数
   * @param ctx Koishi 上下文
   * @param logger 日志记录器
   */
  constructor(ctx: Context, logger: any) {
    this.ctx = ctx
    this.logger = logger
  }

  /**
   * 注册AI语音相关命令
   * @param parentCmd 父命令对象
   */
  registerCommands(parentCmd) {
    /**
     * 获取所有AI语音角色
     * @param session Koishi 会话对象
     * @returns {Promise<Record<number, any[]>>} 角色类型映射表
     */
    const fetchAllCharacters = async (session) => {
      const typeMap = {};
      for (const type of [1, 2]) {
        try {
          const res = await session.onebot._request('get_ai_characters', {
            group_id: session.guildId, chat_type: type,
          });
          res?.data?.forEach(group => {
            if (!group.characters?.length) return;
            typeMap[group.type] ??= [];
            group.characters.forEach(c => {
              if (!typeMap[group.type].some(x => x.character_id === c.character_id)) {
                typeMap[group.type].push(c);
              }
            });
          });
        } catch (e) {
          this.logger.warn('获取AI语音角色失败:', e)
        }
      }
      return typeMap;
    }

    /**
     * 检查参数有效性
     * @param session Koishi 会话对象
     * @param params 参数列表
     * @returns {Promise<boolean>} 是否有效
     */
    const checkParams = async (session, ...params) => {
      if (params.some(p => !p)) {
        const m = await session.send('请输入正确的参数')
        await utils.autoRecall(session, Array.isArray(m) ? m[0] : m)
        return false
      }
      return true
    }

    /**
     * 注册 aisay 命令
     */
    const voice = parentCmd.subcommand('aisay <character:string> <text:text>', 'AI语音')
      .channelFields(['guildId'])
      .usage('使用指定角色发送AI语音')
      .action(async ({ session }, character, text) => {
        if (!await checkParams(session, character, text)) return ''
        try {
          await session.onebot._request('send_group_ai_record', {
            character: character.startsWith('lucy-voice-') ? character : 'lucy-voice-' + character,
            group_id: Number(session.guildId), text,
          })
        } catch (e) {
          this.logger.warn('发送AI语音失败:', e)
        }
        return ''
      })
    voice.subcommand('.list', '角色列表')
      .channelFields(['guildId'])
      .usage('显示所有AI语音角色')
      .action(async ({ session }) => {
        try {
          const typeMap = await fetchAllCharacters(session)
          return Object.entries(typeMap).map(([type, characters]: any) =>
            `${type}:\n${characters.map(c => `${c.character_name}[${c.character_id.replace(/^lucy-voice-/, '')}]`).join('、')}`
          ).join('\n').trim()
        } catch (e) {
          this.logger.warn('获取语音角色列表失败:', e)
          return ''
        }
      })
    voice.subcommand('.text <character:string> <text:text>', '转换语音')
      .channelFields(['guildId'])
      .usage('将文字转换为语音消息')
      .action(async ({ session }, character, text) => {
        if (!await checkParams(session, character, text)) return ''
        try {
          const res = await session.onebot._request('get_ai_record', {
            character: character.startsWith('lucy-voice-') ? character : 'lucy-voice-' + character,
            group_id: Number(session.guildId), text,
          })
          return h('audio', { src: res.data })
        } catch (e) {
          this.logger.warn('文字转AI语音失败:', e)
          return '语音生成失败'
        }
      })
    voice.subcommand('.view <key:string>', '角色预览')
      .channelFields(['guildId'])
      .usage('发送指定角色的预览音频')
      .action(async ({ session }, key) => {
        if (!key) {
          const m = await session.send('请输入角色ID或名称')
          await utils.autoRecall(session, Array.isArray(m) ? m[0] : m)
          return ''
        }
        try {
          const typeMap = await fetchAllCharacters(session)
          let found
          for (const characters of Object.values(typeMap)) {
            found = (characters as any[]).find(c =>
              c.character_id === key ||
              c.character_id.replace(/^lucy-voice-/, '') === key ||
              c.character_name === key
            )
            if (found) break
          }
          if (!found) {
            const m = await session.send('未找到该角色')
            await utils.autoRecall(session, Array.isArray(m) ? m[0] : m)
            return ''
          }
          await session.send(h('audio', { src: found.preview_url }))
        } catch (e) {
          this.logger.warn('语音角色预览失败:', e)
        }
        return ''
      })
  }
}