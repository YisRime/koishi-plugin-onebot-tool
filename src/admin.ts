import { Context } from 'koishi'
import { utils } from './utils'

interface OneBotUserInfo {
  // 基础信息
  uid?: string                // 用户唯一标识
  uin?: string | number       // QQ号码
  nick?: string               // 昵称
  user_id: number             // 用户ID (与uin基本一致)
  nickname?: string           // 昵称 (与nick基本一致)
  qid?: string                // QQ靓号/ID
  longNick?: string           // 个性签名
  long_nick?: string          // 个性签名 (标准格式)
  // 个人信息
  constellation?: number      // 星座 (1-12)
  shengXiao?: number          // 生肖 (1-12)
  birthday_year?: number      // 出生年
  birthday_month?: number     // 出生月
  birthday_day?: number       // 出生日
  age?: number                // 年龄
  seex?: string               // 性别
  kBloodType?: number         // 血型
  homeTown?: string           // 家乡 (格式: 省-市-区)
  country?: string            // 国家
  province?: string           // 省份
  city?: string               // 城市
  pos?: string                // 职位
  college?: string            // 学校/院校
  eMail?: string              // 电子邮件
  phoneNum?: string           // 电话号码
  // 账号信息
  regTime?: number            // 注册时间戳
  reg_time?: number           // 注册时间戳 (标准格式)
  qqLevel?: number            // QQ等级
  login_days?: number         // 登录天数
  is_vip?: boolean            // 是否为VIP
  is_years_vip?: boolean      // 是否为年费VIP
  vip_level?: number          // VIP等级
  status?: number             // 状态 (10=离线/20=在线/30=离开/...)
  extStatus?: number          // 扩展状态
  batteryStatus?: number      // 电池状态
  termType?: number           // 终端类型 (0=未知/1=电脑/2=手机/...)
  netType?: number            // 网络类型 (0=未知/1=WiFi/2=流量/...)
  eNetworkType?: number       // 网络类型扩展
  termDesc?: string           // 终端描述
}

export class Admin {
  constructor(private ctx: Context) {}

  /**
   * 注册命令
   */
  registerCommands() {
    const admin = this.ctx.command('onebot', 'OneBot 测试工具')

    admin.subcommand('.restart', '重启 OneBot', { authority: 5 })
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
    admin.subcommand('.clean', '清理缓存', { authority: 4 })
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

    const get = admin.subcommand('get', '获取消息内容及状态')
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

    const info = admin.subcommand('info', '查询账号信息')
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
    info.subcommand('.user <user_id:number>', '查询其它账号信息')
      .usage('查询指定账号的基本信息')
      .option('no-cache', '-n 不使用缓存', { fallback: false })
      .action(async ({ session, options }, user_id) => {
        if (!user_id) {
          const msg = await session.send('请提供QQ')
          utils.autoRecall(session, Array.isArray(msg) ? msg[0] : msg)
          return
        }
        try {
          const info = await session.onebot.getStrangerInfo(user_id, options['no-cache']) as OneBotUserInfo
          // 用户详细信息
          let result = `${info.nickname || info.nick}(${info.user_id || info.uin})\n`
          if (info.qid) result += `QID: ${info.qid}\n`
          if (info.uid) result += `UID: ${info.uid}\n`
          const signature = info.long_nick || info.longNick
          if (signature) result += `个性签名: \n${signature}\n`
          // 个人信息
          const personalInfo = []
          if (info.age) personalInfo.push(`年龄: ${info.age}岁`)
          if (info.seex) personalInfo.push(`性别: ${info.seex}`)
          if (info.birthday_year && info.birthday_month && info.birthday_day) {
            personalInfo.push(`生日: ${info.birthday_year}-${info.birthday_month}-${info.birthday_day}`)
          }
          const constellations = ['', '水瓶座', '双鱼座', '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座']
          const shengXiaos = ['', '鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']
          if (info.constellation && info.constellation > 0 && info.constellation <= 12) {
            personalInfo.push(`星座: ${constellations[info.constellation]}`)
          }
          if (info.shengXiao && info.shengXiao > 0 && info.shengXiao <= 12) {
            personalInfo.push(`生肖: ${shengXiaos[info.shengXiao]}`)
          }
          const bloodTypes = ['', 'A型', 'B型', 'AB型', 'O型']
          if (info.kBloodType && info.kBloodType > 0 && info.kBloodType < bloodTypes.length) {
            personalInfo.push(`血型: ${bloodTypes[info.kBloodType]}`)
          }
          if (info.eMail && info.eMail !== '') personalInfo.push(`邮箱: ${info.eMail}`)
          if (info.phoneNum && info.phoneNum !== '-') personalInfo.push(`电话: ${info.phoneNum}`)
          const locationInfo = []
          if (info.country) locationInfo.push(info.country)
          if (info.province) locationInfo.push(info.province)
          if (info.city) locationInfo.push(info.city)
          if (locationInfo.length > 0) {
            personalInfo.push(`地区: ${locationInfo.join(' ')}`)
          }
          if (info.homeTown && info.homeTown !== '0-0-0') {
            const [province, city] = info.homeTown.split('-').map(id => parseInt(id))
            if (province > 0 || city > 0) {
              personalInfo.push(`家乡: ${province}-${city}`)
            }
          }
          if (info.college) personalInfo.push(`学校: ${info.college}`)
          if (info.pos) personalInfo.push(`职位: ${info.pos}`)
          if (personalInfo.length > 0) {
            result += `\n个人信息: \n${personalInfo.join('\n')}\n`
          }
          // 账号和状态信息
          const accountInfo = []
          if (info.qqLevel) {
            accountInfo.push(`QQ等级: ${info.qqLevel}`)
          }
          if (info.is_vip || info.vip_level) {
            let vipStr = `VIP状态: ${info.is_vip ? 'VIP会员' : '非VIP'}`
            if (info.is_years_vip) vipStr += `(年费会员)`
            if (info.vip_level) vipStr += ` 等级${info.vip_level}`
            accountInfo.push(vipStr)
          }
          if (info.status !== undefined) {
            const statusMap = {
              10: '离线',
              20: '在线',
              30: '离开',
              40: '忙碌',
              50: '请勿打扰',
              60: '隐身'
            }
            if (statusMap[info.status]) {
              let statusStr = `状态: ${statusMap[info.status]}`
              const termTypes = ['', '电脑', '手机', '网页', '平板']
              if (info.termType && info.termType > 0 && info.termType < termTypes.length) {
                statusStr += ` - ${termTypes[info.termType]}`
              }
              const netTypes = ['', 'WiFi', '移动网络', '有线网络']
              if (info.netType && info.netType > 0 && info.netType < netTypes.length) {
                statusStr += ` - ${netTypes[info.netType]}`
              }
              accountInfo.push(statusStr)
              if (info.extStatus) {
                accountInfo.push(`扩展状态: ${info.extStatus}`)
              }
              if (info.batteryStatus) {
                const batteryLevel = info.batteryStatus >= 0 && info.batteryStatus <= 100
                  ? `${info.batteryStatus}%`
                  : info.batteryStatus
                accountInfo.push(`电池电量: ${batteryLevel}`)
              }
              const eNetworkTypes = {
                1: '2G网络',
                2: '3G网络',
                3: '4G网络',
                4: '5G网络',
                5: 'WiFi'
              }
              if (info.eNetworkType && eNetworkTypes[info.eNetworkType]) {
                accountInfo.push(`网络类型: ${eNetworkTypes[info.eNetworkType]}`)
              }
              if (info.termDesc && info.termDesc.trim()) {
                accountInfo.push(`终端信息: ${info.termDesc}`)
              }
            }
          }
          if (info.regTime || info.reg_time) {
            const regTimestamp = info.regTime || info.reg_time
            const regDate = new Date(regTimestamp * 1000)
            accountInfo.push(`注册时间: ${regDate.toLocaleDateString()}`)
          }
          if (info.login_days) accountInfo.push(`登录天数: ${info.login_days}天`)
          if (accountInfo.length > 0) {
            result += `\n账号信息: \n${accountInfo.join('\n')}\n`
          }
          return result
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

    const group = admin.subcommand('group [group_id:number]', '查询群信息')
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
