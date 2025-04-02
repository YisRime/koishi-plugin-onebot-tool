import { Context } from 'koishi'
import { utils } from './utils'

export class Admin {
  constructor(private ctx: Context) {}

  /**
   * 注册命令
   */
  registerCommands() {
    this.ctx.command('restart', '重启OneBot', { authority: 5 })
      .usage('重启 OneBot 实现和 API 服务')
      .action(async ({ session }) => {
        try {
          await session.onebot.setRestart(2000)
          return '正在重启 OneBot，请稍候...'
        } catch (e) {
          const msg = await session.send(`重启失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    this.ctx.command('clean', '清理缓存', { authority: 4 })
      .usage('清理积攒的缓存文件')
      .action(async ({ session }) => {
        try {
          await session.onebot.cleanCache()
          return '清理缓存成功'
        } catch (e) {
          const msg = await session.send(`清理缓存失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })

    const get = this.ctx.command('get', '获取消息内容')
      .usage('获取指定ID消息的完整内容')
      .option('id', '-i <id:string> 消息ID')
      .action(async ({ session, options }) => {
        let messageId = options.id
        if (!messageId && session.quote) {
          messageId = session.quote.id
        } else if (!messageId && session.messageId) {
          messageId = session.messageId
        }
        try {
          const msg = await session.onebot.getMsg(messageId)
          return JSON.stringify(msg, null, 2)
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    get.subcommand('.forward', '获取合并转发内容')
      .usage('获取指定合并转发ID消息的完整内容')
      .option('id', '-i <id:string> 合并转发ID')
      .action(async ({ session, options }) => {
        let messageId = options.id
        if (!messageId && session.quote) {
          messageId = session.quote.id
        } else if (!messageId && session.messageId) {
          messageId = session.messageId
        }
        try {
          const msg = await session.onebot.getForwardMsg(messageId)
          return JSON.stringify(msg, null, 2)
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    get.subcommand('.record', '获取语音文件')
      .usage('获取指定语音文件并转换格式')
      .option('file', '-f <file:string> 文件名', { type: 'string' })
      .option('format', '-t <format:string> 转换格式 (mp3/amr/wma/m4a/spx/ogg/wav/flac)', { fallback: 'mp3' })
      .action(async ({ session, options }) => {
        let fileName = options.file
        if (!fileName && session.quote) {
          try {
            const content = session.quote.content
            if (content) {
              // 尝试从XML格式解析
              const xmlMatch = /<audio.*?file="(.*?)".*?\/>/i.exec(content)
              if (xmlMatch && xmlMatch[1]) {
                fileName = xmlMatch[1]
              } else {
                // 尝试从CQ码解析
                const cqMatch = /\[CQ:record,file=(.*?)(?:,|])/i.exec(content)
                if (cqMatch && cqMatch[1]) {
                  fileName = cqMatch[1]
                } else {
                  // 尝试从JSON格式解析
                  const jsonMatch = /"file"\s*:\s*"([^"]+)"/i.exec(content)
                  if (jsonMatch && jsonMatch[1]) {
                    fileName = jsonMatch[1]
                  }
                }
              }
            }
          } catch (e) {
            const msg = await session.send(`解析引用消息失败: ${e.message}`)
            utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
            return
          }
        }
        if (!fileName) {
          const msg = await session.send('未发现语音文件')
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
        try {
          const result = await session.onebot.getRecord(fileName, options.format as 'mp3' | 'amr' | 'wma' | 'm4a' | 'spx' | 'ogg' | 'wav' | 'flac')
          return `语音文件路径: ${result.file}`
        } catch (e) {
          const msg = await session.send(`获取语音失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    get.subcommand('.image', '获取图片文件')
      .usage('获取指定图片文件的本地路径')
      .option('file', '-f <file:string> 文件名', { type: 'string' })
      .action(async ({ session, options }) => {
        let fileName = options.file
        if (!fileName && session.quote) {
          try {
            const content = session.quote.content
            if (content) {
              // 尝试从XML格式解析
              const xmlMatch = /<image.*?file="([^"]+)".*?\/>/i.exec(content) ||
                              /<img.*?file="([^"]+)".*?\/>/i.exec(content)
              if (xmlMatch && xmlMatch[1]) {
                fileName = xmlMatch[1]
              } else {
                // 尝试从CQ码解析
                const cqMatch = /\[CQ:image,(?:.*?,)?file=([^,\]]+)(?:,|])/i.exec(content)
                if (cqMatch && cqMatch[1]) {
                  fileName = cqMatch[1]
                } else {
                  // 尝试从JSON格式解析
                  const jsonMatch = /"file"(?:\s*):(?:\s*)"([^"]+)"/i.exec(content)
                  if (jsonMatch && jsonMatch[1]) {
                    fileName = jsonMatch[1]
                  } else {
                    const urlMatch = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|bmp|webp)/i.exec(content)
                    if (urlMatch && urlMatch[0]) {
                      fileName = urlMatch[0]
                    }
                  }
                }
              }
            }
          } catch (e) {
            const msg = await session.send(`解析引用消息失败: ${e.message}`)
            utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
            return
          }
        }
        if (!fileName) {
          const msg = await session.send('未发现图片文件')
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
        try {
          const result = await session.onebot.getImage(fileName)
          return `图片文件路径: ${result.file}`
        } catch (e) {
          const msg = await session.send(`获取图片失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    get.subcommand('.stat', '获取运行状态')
      .usage('获取运行状态信息')
      .action(async ({ session }) => {
        try {
          const status = await session.onebot.getStatus()
          let result = `运行状态: ${status.online ? '在线' : '离线'} | ${status.good ? '正常' : '异常'}\n`
          for (const key in status) {
            if (key !== 'online' && key !== 'good') {
              result += `${key}: ${JSON.stringify(status[key])}\n`
            }
          }
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    get.subcommand('.ver', '获取版本信息')
      .usage('获取版本信息')
      .action(async ({ session }) => {
        try {
          const version = await session.onebot.getVersionInfo()
          let result = `应用标识: ${version.app_name}\n`
          result += `应用版本: ${version.app_version}\n`
          result += `协议版本: ${version.protocol_version}\n`
          for (const key in version) {
            if (key !== 'app_name' && key !== 'app_version' && key !== 'protocol_version') {
              result += `${key}: ${JSON.stringify(version[key])}\n`
            }
          }
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    get.subcommand('.csrf [domain:string]', '获取相关接口凭证', { authority: 4 })
      .usage('获取指定域名的Cookies和CSRF Token')
      .action(async ({ session }, domain) => {
        try {
          const credentials = await session.onebot.getCredentials(domain || '')
          let result = '接口凭证信息:\n'
          result += `CSRF Token: ${credentials.csrf_token}\n`
          result += `Cookies: ${credentials.cookies}`
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })

    const info = get.subcommand('info', '查询本账号信息')
      .usage('查询当前账号的基本信息')
      .action(async ({ session }) => {
        try {
          const info = await session.onebot.getLoginInfo()
          return `账号信息:\n${info.nickname}(${info.user_id})`
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    info.subcommand('.user <user_id:number>', '查询账号信息')
      .usage('查询指定账号的基本信息')
      .option('no-cache', '-n 不使用缓存', { fallback: false })
      .action(async ({ session, options }, user_id) => {
        if (!user_id) {
          const msg = await session.send('请提供QQ')
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
        try {
          const info = await session.onebot.getStrangerInfo(user_id, options['no-cache'])
          return `账号信息:\n${info.nickname}(${info.user_id})\n${info.age} | ${info.sex}`
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    info.subcommand('.friend', '获取本账号好友列表', { authority: 3 })
      .usage('获取本账号的完整好友列表及备注')
      .action(async ({ session }) => {
        try {
          const friends = await session.onebot.getFriendList()
          let result = `好友数量: ${friends.length}\n`
          friends.slice(0, 20).forEach((friend) => {
            result += `${friend.nickname}(${friend.user_id}) | ${friend.remark}\n`
          })
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    info.subcommand('.group', '获取本账号群组列表', { authority: 3 })
      .usage('获取本账号加入的群组列表')
      .action(async ({ session }) => {
        try {
          const groups = await session.onebot.getGroupList()
          let result = `群数量: ${groups.length}\n`
          groups.slice(0, 20).forEach((group) => {
            result += `${group.group_name}(${group.group_id}) | ${group.member_count} 人\n`
          })
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })

    const group = get.subcommand('group [group_id:number]', '查询群信息')
      .usage('查询指定群的基本信息')
      .option('no-cache', '-n 不使用缓存', { fallback: false })
      .action(async ({ session, options }, group_id) => {
        if (!group_id) {
          if (!session.guildId) {
            const msg = await session.send('请提供群号')
            utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
            return
          }
          group_id = parseInt(session.guildId)
        }
        try {
          const info = await session.onebot.getGroupInfo(group_id, options['no-cache'])
          return `群信息: \n${info.group_name}(${info.group_id}) [${info.member_count}/${info.max_member_count}]`
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    group.subcommand('.user <user_id:number> [group_id:number]', '查询群成员信息')
      .usage('查询群内指定成员的基本信息')
      .option('no-cache', '-n 不使用缓存', { fallback: false })
      .action(async ({ session, options }, user_id, group_id) => {
        if (!user_id) {
          const msg = await session.send('请提供QQ号')
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
        if (!group_id) {
          if (!session.guildId) {
            const msg = await session.send('请提供群号')
            utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
            return
          }
          group_id = parseInt(session.guildId)
        }
        try {
          const info = await session.onebot.getGroupMemberInfo(group_id, user_id, options['no-cache'])
          const groupInfo = await session.onebot.getGroupInfo(group_id, options['no-cache'])
          let result = `群${groupInfo.group_name}(${info.group_id})成员: \n${info.nickname}(${info.user_id})`
          if (info.card) {
            result += ` | ${info.card}`
          }
          if (info.role !== 'member') {
            result += ` | ${info.role}`
          }
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    group.subcommand('.list [group_id:number]', '获取群成员列表')
      .usage('获取指定群的成员列表')
      .action(async ({ session }, group_id) => {
        if (!group_id) {
          if (!session.guildId) {
            const msg = await session.send('请提供群号')
            utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
            return
          }
          group_id = parseInt(session.guildId)
        }
        try {
          const members = await session.onebot.getGroupMemberList(group_id)
          const groupInfo = await session.onebot.getGroupInfo(group_id)
          let result = `${groupInfo.group_name}(${group_id}) [${members.length}/${groupInfo.max_member_count}]\n`
          members.slice(0, 20).forEach((member) => {
            let line = `${member.nickname}(${member.user_id})`
            if (member.card) {
              line += ` | ${member.card}`
            }
            if (member.role !== 'member') {
              line += ` | ${member.role}`
            }
            result += line + '\n'
          })
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
    group.subcommand('.honor [group_id:number]', '查询群荣誉信息')
      .usage('可用参数:\n- talkative: 龙王\n- performer: 群聊之火\n- legend: 群聊炽焰\n- strong_newbie: 冒尖小春笋\n- emotion: 快乐之源')
      .option('type', '-t <type> 荣誉类型', { fallback: 'all' })
      .action(async ({ session, options }, group_id) => {
        if (!group_id) {
          if (!session.guildId) {
            const msg = await session.send('请提供群号')
            utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
            return
          }
          group_id = parseInt(session.guildId)
        }
        try {
          const honorInfo = await session.onebot.getGroupHonorInfo(group_id, options.type)
          const groupInfo = await session.onebot.getGroupInfo(group_id)
          let result = `${groupInfo.group_name}(${group_id}) 荣誉信息:\n`

          const honorTypeNames = {
            talkative: '龙王',
            performer: '群聊之火',
            legend: '群聊炽焰',
            strong_newbie: '冒尖小春笋',
            emotion: '快乐之源'
          }
          if (honorInfo.current_talkative) {
            result += `当前龙王: ${honorInfo.current_talkative.nickname}(${honorInfo.current_talkative.user_id})\n`
          }
          for (const type of ['talkative', 'performer', 'legend', 'strong_newbie', 'emotion']) {
            const list = honorInfo[`${type}_list`]
            if (list && list.length) {
              result += `${honorTypeNames[type]} (${list.length}名):\n`
              list.slice(0, 5).forEach((item) => {
                result += `${item.nickname}(${item.user_id}) | ${item.description}\n`
              })
            }
          }
          return result
        } catch (e) {
          const msg = await session.send(`获取失败: ${e.message}`)
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
      })
  }
}
