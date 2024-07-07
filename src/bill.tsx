import { Context, Session, h } from 'koishi'
import * as utils from './utils'
import { Config } from './index';

export interface Bill {
    id: number
    name: string
    currency: string
    user: string
    limit: number
}

export interface BillDetail {
    id: number
    billId: number
    name: string
    amount: number
    currency: string
    date: Date
    note: string
}

export async function exchangeCurrency(amount: number, from: string, to: string, ctx: Context) {
    let r = await ctx.http.get(`https://www.mastercard.com.cn/settlement/currencyrate/conversion-rate`, {
        params: {
            fxDate: '0000-00-00',
            transCurr: from,
            crdhldBillCurr: to,
            bankFee: '0',
            transAmt: amount
        }
    })
    // console.log(r)
    return r?.data ? r.data.crdhldBillAmt : null;
}

export async function createBill(name: string, currency: string, user: string, limit: number, config: Config, ctx: Context) {
    if (!name) return '请输入账本名[X﹏X]';
    const duplicate = await ctx.database.get('rina.bill', { name: [name], })
    if (duplicate.length != 0) { return '账本已存在[X﹏X]'; }

    if (!currency) currency = config.defaultCurrency;
    if (currency != 'cny' && currency != 'jpy') return '币种无效,请输入cny或jpy[X﹏X]';

    await ctx.database.create('rina.bill', { name: name, currency: currency, user: user, limit: limit })
    return '账本创建成功! [=^▽^=]';
}

export async function deleteBill(name: string, ctx: Context) {
    if (!name) return '请输入账本名[X﹏X]';
    const bill = await ctx.database.get('rina.bill', { name: [name] })
    if (bill.length == 0) return '账本不存在[X﹏X]';
    await ctx.database.remove('rina.bill', { name: [name] })
    await ctx.database.remove('rina.billDetail', { billId: [bill[0].id] })
    return '账本删除成功! [=^▽^=]';
}

export async function updateBill(name: string, new_name: string, currency: string, user: string, limit: number, ctx: Context) {
    if (!name) return '请输入账本名[X﹏X]';
    const bill = await ctx.database.get('rina.bill', { name: [name] })
    if (bill.length == 0) return '账本不存在[X﹏X]';

    if (!new_name) new_name = bill[0].name;
    const duplicate = await ctx.database.get('rina.bill', { name: [new_name], })
    if (duplicate.length != 0) { return '新名称无效,账本已存在[X﹏X]'; }

    if (!currency) currency = bill[0].currency;
    if (currency != 'cny' && currency != 'jpy') return '币种无效,请输入cny或jpy[X﹏X]';

    if (!user) user = bill[0].user;
    if (!limit) limit = bill[0].limit;

    await ctx.database.upsert('rina.bill', (row: any) => [{ id: bill[0].id, name: new_name, currency: currency, user: user, limit: limit }]);

    return '账本更新成功! [=^▽^=]';
}

export async function listBill(ctx: Context) {
    const bill = await ctx.database.get('rina.bill', {})
    if (bill.length == 0) return '没有任何账本[◔‿◔]';

    const message = bill.map((b: any) => `${b.name}(币种:${b.currency},所属用户:${b.user ? b.user : '无'},限额:${b.limit ? b.limit : '无'})`).join('\n');
    return message;
}

export async function mergeBill(name: string, target: string, removeOld: boolean, ctx: Context) {
    if (!name || !target) return '请输入账本名[X﹏X]';
    const bill = await ctx.database.get('rina.bill', { name: [name] })
    if (bill.length == 0) return '账本不存在[X﹏X]';
    const targetBill = await ctx.database.get('rina.bill', { name: [target] })
    if (targetBill.length == 0) return '目标账本不存在[X﹏X]';

    const old_arr = await ctx.database.get('rina.billDetail', { billId: [bill[0].id] })
    const new_arr = old_arr.map((old: any) => ({ id: old.id, billId: targetBill[0].id }));

    await ctx.database.upsert('rina.billDetail', (row: any) => new_arr)
    if (removeOld) await ctx.database.remove('rina.bill', { name: [name] })
    return '账本合并成功! [=^▽^=]';
}

export async function createBillDetail(bill: string, name: string, amount: number, currency: string, day: number, month: number, year: number, note: string, ctx: Context) {
    if (!bill) return '请输入账本名[X﹏X]';
    let billObj = await ctx.database.get('rina.bill', { name: [bill] })
    if (billObj.length == 0) return '账本不存在[X﹏X]';
    billObj = billObj[0];

    if (!name) return '请输入账目名[X﹏X]';
    if (!amount) return '请输入金额[X﹏X]';

    if (!currency) currency = billObj.currency;
    const date = utils.numberTODate(day, month, year);

    await ctx.database.create('rina.billDetail', { billId: billObj.id, name: name, amount: amount, currency: currency, date: date, note: note })
    return '记账成功! [=^▽^=]';
}

export async function deleteBillDetail(id: number, ctx: Context) {
    if (!id) return '请输入账目ID[X﹏X]';
    const billDetail = await ctx.database.get('rina.billDetail', { id: [id] })
    if (billDetail.length == 0) return '账目不存在[X﹏X]';
    await ctx.database.remove('rina.billDetail', { id: [id] })
    return '账目删除成功! [=^▽^=]';
}

export async function showBillInfo(name: string, rate: number, ctx: Context) {
    if (!name) return '请输入账本名[X﹏X]';
    const bill = await ctx.database.get('rina.bill', { name: [name] })
    if (bill.length == 0) return '账本不存在[X﹏X]';

    const billDetail_cny = await ctx.database.get('rina.billDetail', { billId: [bill[0].id], currency: ['cny'] })
    const billDetail_jpy = await ctx.database.get('rina.billDetail', { billId: [bill[0].id], currency: ['jpy'] })
    const sum_cny = billDetail_cny.reduce((acc: number, cur: any) => acc + cur.amount, 0);
    const sum_jpy = billDetail_jpy.reduce((acc: number, cur: any) => acc + cur.amount, 0);

    const using_rate = rate ? rate : await exchangeCurrency(1, 'jpy', 'cny', ctx);

    const total_cny = sum_cny + sum_jpy * using_rate;
    const total_jpy = sum_jpy + sum_cny / using_rate;

    return <message>
        <p>{`账本名:${bill[0].name}`}</p>
        <p>{`关联用户:${bill[0].user ? h('at', { id: bill[0].user }) : '无'}`}</p>
        <p>{`限额:${bill[0].limit ? bill[0].limit : '无'}${bill[0].currency}`}</p>
        <p>{`总金额:${total_cny.toFixed(2)}cny或${total_jpy.toFixed(2)}jpy`}</p>
        <p>{`(包括${sum_cny.toFixed(2)}cny和${sum_jpy.toFixed(2)}jpy,参考汇率1jpy=${using_rate.toFixed(4)}rmb)`}</p>
    </message>;
}

export async function listBillDetail(name: string, session: Session, ctx: Context) {
    if (!name) return '请输入账本名[X﹏X]';
    const bill = await ctx.database.get('rina.bill', { name: [name] })
    if (bill.length == 0) return '账本不存在[X﹏X]';
    const billDetail = await ctx.database.get('rina.billDetail', { billId: [bill[0].id] })
    if (billDetail.length == 0) return '账目为空[◔‿◔]';

    return <message forward>
        {billDetail.map((b: any) => {
            return <message>
                <author user-id={session.selfId} />
                <p>{`${b.id}-${b.name}`}</p>
                <p>{`金额:${b.amount}${b.currency}\n日期:${utils.dateToString(b.date)}\n备注:${b.note}`}</p>
            </message>
        })}
    </message>
}