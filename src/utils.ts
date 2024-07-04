export function numberTODate(day: any, month: any, year: any) {
    const now = new Date();
    const d = day ? day : now.getDate();
    const m = month ? month - 1 : now.getMonth();
    const y = year ? year : now.getFullYear();
    return new Date(y, m, d);
}