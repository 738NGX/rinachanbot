import { Context, Logger, h } from 'koishi';
import { URLSearchParams } from 'url';

const trans_logger = new Logger('rinachanbot-translate');

export async function google_translate(ctx: Context, text: string, toLanguage: string) {
    if (!['zh', 'ja', 'en'].includes(toLanguage)) { toLanguage = 'zh' }

    const params = new URLSearchParams({
        client: 'gtx',
        sl: 'auto',
        tl: toLanguage,
        dt: 't',
        q: text
    });
    const url = `https://translate.google.com/translate_a/single?${params.toString()}`;

    trans_logger.info(url);

    try {
        const res = await ctx.http.get(url);
        return res[0].map((item: any) => item[0]).join(' ');
    } catch (error) {
        console.error(error);
        throw new Error('请求失败，请重试！');
    }
}

export async function message_translate(session: any, ctx: Context, toLanguage: string) {
    const quotemessage = session.quote.content;
    if (!quotemessage) {
        return '请回复一条消息[X﹏X]';
    }
    let quotetexts = h.select(quotemessage, 'text').map(item => item.attrs.content);
    quotetexts = quotetexts.map(item => item.replace(/\n/g, ' '));
    quotetexts.forEach(async (item) => {
        //trans_logger.info(item)
        try{
            const result = await google_translate(ctx, item, toLanguage);
            session.send(result);
        } catch (error) {
            console.error(error);
            session.send('请求超时,尝试缩短消息长度或稍后再试[X﹏X]');
        }
    });
}