import { cards, meanings } from './tarot_data'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

export default function shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]
    }
    return array
}

export async function singleTarot(session: any,tarotImagesDir: string) {
    const cardLength = Object.keys(cards).length
    const randomIndex = Math.floor(Math.random() * cardLength)
    let cardKey = Object.keys(cards)[randomIndex]
    let imageFile = `${pathToFileURL(path.join(`${tarotImagesDir}`, `${cardKey}.jpg`))}`
    let cardValue = ''

    // 特殊: 愚者有两张
    if (cardKey === '愚者') {
        const rand = Math.floor(Math.random() * 2 + 1)
        imageFile = `${pathToFileURL(path.join(`${tarotImagesDir}`, `愚者${rand}.jpg`))}`
    }

    // 特殊: 正位和逆位
    if (typeof cards[cardKey] === 'object') {
        const rand = Math.floor(Math.random() * 2 + 1)
        cardValue = rand === 1 ? cards[cardKey].正位 : cards[cardKey].逆位
        cardKey += rand === 1 ? '（正位）' : '（逆位）'
    }
    else {
        cardValue = cards[cardKey]
    }

    await session.send(<image url={imageFile} />)

    return <message>
        <p>锵锵锵，塔罗牌的预言是~</p>
        <p>{cardKey}</p>
        <p>其释义为: {cardValue}</p>
    </message>
}

export async function tarot(session: any,tarotImagesDir: string) {
    const cardLength = Object.keys(cards).length
    const randomIndices = new Set<number>()
    while (randomIndices.size < 4) {
        const index = Math.floor(Math.random() * cardLength + 1)
        if (!randomIndices.has(index))
            randomIndices.add(index)
    }
    const indices = [...randomIndices]
    const cardKeys = shuffle(Object.keys(cards))
    const chain = []
    const timesKeys = []
    let rand: number, imageFile: string, cardKey: string, cardValue: string

    for (let i = 0; i < indices.length; i++) {
        const index = indices[i]
        cardKey = cardKeys[index - 1]

        if (!cardKey) {
            console.error('cardKey is undefined', cardKey, indices)
            return '出现未知问题，请联系管理员'
        }

        const meaningKey = Object.keys(meanings)[i]
        const meaningValue = meanings[meaningKey]
        imageFile = `${pathToFileURL(path.join(`${tarotImagesDir}`, `${cardKey}.jpg`))}`

        // 特殊: 愚者有两张
        if (cardKey === '愚者') {
            rand = Math.floor(Math.random() * 2 + 1)
            imageFile = `${pathToFileURL(path.join(`${tarotImagesDir}`, `愚者${rand}.jpg`))}`
        }

        // 特殊: 正位和逆位
        if (typeof cards[cardKey] === 'object') {
            rand = Math.floor(Math.random() * 2 + 1)
            cardValue = rand === 1 ? cards[cardKey].正位 : cards[cardKey].逆位
            cardKey += rand === 1 ? '（正位）' : '（逆位）'
        }
        else {
            cardValue = cards[cardKey]
        }

        const msg = `${meaningKey}，${meaningValue}\n${cardKey}，${cardValue}`
        timesKeys.push(cardKey)
        chain.push({
            text: `第 ${i + 1} 轮`,
            msg,
            imageFile,
        })
    }

    await session.send(`你抽到了：${timesKeys.join(' -- ')}`)

    return <message forward>
        {chain.map((msg) => {
            return <message>
                <author user-id={session.selfId} />
                <p>{msg.text}</p>
                <p>{msg.msg}</p>
                <image url={msg.imageFile} />
            </message>
        })}
    </message>
}