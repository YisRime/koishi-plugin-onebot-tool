import { Context, Session } from 'koishi'

export class Admin {
  constructor(private ctx: Context) {}

  /**
   * 注册命令
   */
  registerCommands() {
    const getCmd = this.ctx.command('get [id:number]', '获取消息')
      .action(async ({ session }, id) => {
        try {
          // 如果没有提供id，尝试获取当前消息id
          if (!id) {
            // 如果有引用消息，获取引用消息id
            if (session.quote.id) {
              id = Number(session.quote.id)
            } else {
              // 否则获取当前消息id
              id = Number(session.messageId)
            }
          }

          const msg = await session.onebot.getMsg(id)
          return JSON.stringify(msg, null, 2)
        } catch (e) {
          return `获取消息失败: ${e.message}`
        }
      })

    getCmd.subcommand('forward <id:string>', '获取合并转发消息')
      .action(async ({ session }, id) => {
        if (!id) {
          return '请提供合并转发ID'
        }
        try {
          const msg = await session.onebot.getForwardMsg(id)
          return JSON.stringify(msg, null, 2)
        } catch (e) {
          return `获取合并转发消息失败: ${e.message}`
        }
      })
  }
}
