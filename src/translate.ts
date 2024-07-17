import { Context } from 'koishi';
import { URLSearchParams } from 'url';

export async function google_translate(ctx: Context, text: string, toLanguage: string) {
    const params = new URLSearchParams({ 
        client: 'gtx',
        sl: 'auto',
        tl: toLanguage,
        dt: 't',
        q: text
    });
    const url = `https://translate.google.com/translate_a/single?${params.toString()}`;

    try {
        const res = await ctx.http.get(url);
        return res[0][0][0];
    } catch (error) {
        console.error(error);
        throw new Error('请求失败，请重试！');
    }
}