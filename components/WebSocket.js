import Client from "./Client.js";
import { Config, Version } from './index.js'
import { sleep, getUser_id } from '../model/index.js'
import _ from "lodash";
import { redAdapter } from '../model/red/index.js'
// import { satoriAdapter } from '../model/satori/index.js'

let sendSocketList = []
let allSocketList = []

const adapterName = {
    'qg_': {
        name: 'QQGuild',
        user_like: 'qg_%',
        group_like: 'qg_%'
    },
    'wx_': {
        name: 'WeChat',
        user_like: 'wx_%',
        group_like: 'wx_%'
    },
    'wxi': {
        name: 'WeChat',
        user_like: 'wxid_%',
        group_like: '%@chatroom'
    },
    'mv_': {
        name: 'mysVilla',
        user_like: 'mv_%',
        group_like: 'mv_%'
    },
    'ko_': {
        name: 'KOOK',
        user_like: 'ko_%',
        group_like: 'ko_%'
    },
    'tg_': {
        name: 'Telegram',
        user_like: 'tg_%',
        group_like: 'tg_%'
    },
    'dc_': {
        name: 'Discord',
        user_like: 'dc_%',
        group_like: 'dc_%'
    },
    'std': {
        name: 'stdin',
        user_like: 'std%',
        group_like: 'std%'
    }
}

async function createWebSocket(data) {
    if (typeof data.close != 'undefined' && typeof data.closed == 'undefined') {
        data.closed = data.close
        delete data.close
    }
if (Array.isArray(data.uin)) {
        for (const uin of data.uin) {
            const str = String(uin)
            const i = _.cloneDeep(data)
            i.name += `(${str.slice(0, 4) + "..." + str.slice(-2)})`
            i.uin = uin
            await createWebSocket(i)
        }
        return
    }
    const client = new Client(data)
if (typeof client.self_id === 'string') {
        client.self_id = await getUser_id({ user_id: client.self_id })
        client.adapter = adapterName[client.uin?.substring?.(0, 3)]
    } else {
        const self_id = String(client.self_id)
        if (/^(2854|3889)/.test(self_id) && self_id.length === 10) {
            client.adapter = {
                name: 'QQBot',
                user_like: [
                    self_id + '%',
                    'qg_%'
                ],
                group_like: [
                    self_id + '%',
                    'qg_%'
                ]
            }
        } else if (!Version.isTrss && self_id.startsWith('1020') && self_id.length === 9) {
            client.adapter = {
                name: 'QQBot',
                user_like: [
                    self_id + '%',
                    'qg_%'
                ],
                group_like: [
                    self_id + '%',
                    'qg_%'
                ]
            }
        }
    }
    setAllSocketList(client)
    if (data.address == 'ws_address') return
    if (data.closed) return
    sendSocketList = sendSocketList.filter(i => i.name != data.name)
    switch (Number(data.type)) {
        case 1:
            if (!await checkVersion(data)) return
            client.createWs()
            sendSocketList.push(client)
            break;
        case 2:
            if (!await checkVersion(data)) return
            client.createServer()
            sendSocketList.push(client)
            break
        case 3:
            client.createGSUidWs()
            sendSocketList.push(client)
            break
        case 4:
            if (Version.isTrss) return
            // client.createQQNT()
            redAdapter.connect(client)
            break
        case 5:
            if (!await checkVersion(data)) return
            client.createHttp()
            break
        case 6:
            if (!await checkVersion(data)) return
            client.createHttpPost()
            sendSocketList.push(client)
            break
        default:
            return;
    }
}

function setAllSocketList(data) {
    allSocketList = allSocketList.filter(i => i.name != data.name)
    allSocketList.push(data)
}

async function checkVersion(data) {
    if (Version.isTrss) {
        if (!data.uin) {
            logger.warn(`[ws-plugin] ${data.name} 缺少配置项uin 请删除连接后重新#ws添加连接`)
            return false
        } else {
            let log = false
            for (let i = 0; i < 20; i++) {
                if (Version.protocol.some(i => i == Bot[data.uin]?.version?.name)) {
                    return true
                }
                if (!log) {
                    logger.warn(`[ws-plugin] ${data.name} 暂未适配当前协议端或未连接对应协议端,20秒后重新判断`)
                    log = true
                }
                await sleep(1000)
            }
            logger.warn(`[ws-plugin] ${data.name} 暂未适配当前协议端或未连接对应协议端 ${data.uin}`)
            return false
        }
    } else if (Bot.uin == '88888') {
        if (!data.uin) {
            logger.warn(`[ws-plugin] ${data.name} 缺少配置项uin 请删除连接后重新#ws添加连接`)
            return false
        }
    }
    return true
}

async function modifyWebSocket(target) {
    // if (Version.isTrss) return
    switch (target.type) {
        case 'add':
        case 'open':
            if (target.data.type == 4) {
                const client = new Client(target.data)
                setAllSocketList(client)
                redAdapter.connect(client)
            } else {
                createWebSocket(target.data)
            }
            break;
        case 'del':
        case 'close':
            for (const i of allSocketList) {
                if (i.name == target.data.name) {
                    i.close()
                    break
                }
            }
            break
        default:
            return;
    }
}

function clearWebSocket() {
    for (const i of allSocketList) {
        i.close()
    }
}


async function initWebSocket() {
    // if (Version.isTrss) return
    for (const i of Config.servers) {
        await createWebSocket(i)
    }
}


export {
    initWebSocket,
    clearWebSocket,
    modifyWebSocket,
    allSocketList,
    setAllSocketList,
    sendSocketList,
    createWebSocket
}

