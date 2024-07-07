export function numberTODate(day: any, month: any, year: any) {
    const now = new Date();
    const d = day ? day : now.getDate();
    const m = month ? month - 1 : now.getMonth();
    const y = year ? year : now.getFullYear();
    return new Date(y, m, d);
}

export function dateToString(date: Date) {
    const month= date.getMonth() + 1;
    const day = date.getDate();
    return `${date.getFullYear()}-${month<10?`0${month}`:month}-${day<10?`0${day}`:day}`;
}