const birthdays = [
    { month: 1, date: 1, name: '黑泽黛雅', role: '角色', group: 'Aqours' },
    { month: 1, date: 9, name: 'Liyuu', role: '声优', group: 'Liella!' },
    { month: 1, date: 13, name: '村野沙耶香', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 1, date: 17, name: '小泉花阳', role: '角色', group: 'μ\'s' },
    { month: 1, date: 20, name: '薇恩·玛格丽特', role: '角色', group: 'Liella!' },
    { month: 1, date: 23, name: '中须霞', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 1, date: 28, name: '野中心菜', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 1, date: 28, name: '叶山风花', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 1, date: 31, name: '久保田未梦', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 2, date: 1, name: '楠田亚衣奈', role: '声优', group: 'μ\'s' },
    { month: 2, date: 5, name: '艾玛·维尔德', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 2, date: 5, name: '小宫有纱', role: '声优', group: 'Aqours' },
    { month: 2, date: 7, name: '伊波杏树', role: '声优', group: 'Aqours' },
    { month: 2, date: 10, name: '松浦果南', role: '角色', group: 'Aqours' },
    { month: 2, date: 12, name: '田野麻美', role: '声优', group: 'Saint Snow' },
    { month: 2, date: 15, name: '钟岚珠', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 2, date: 19, name: '降幡爱', role: '声优', group: 'Aqours' },
    { month: 2, date: 23, name: '绘森彩', role: '声优', group: 'Liella!' },
    { month: 2, date: 25, name: '岚千砂都', role: '角色', group: 'Liella!' },
    { month: 2, date: 27, name: '小泉萌香', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 2, date: 28, name: '徒町小铃', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 3, date: 1, name: '上原步梦', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 3, date: 4, name: '国木田花丸', role: '角色', group: 'Aqours' },
    { month: 3, date: 5, name: '矢野妃菜喜', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 3, date: 8, name: '岬奈子', role: '声优', group: 'Liella!' },
    { month: 3, date: 15, name: '园田海未', role: '角色', group: 'μ\'s' },
    { month: 3, date: 28, name: '吉武千飒', role: '声优', group: 'Sunny Passion' },
    { month: 4, date: 3, name: '樱坂雫', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 4, date: 3, name: '坂仓花', role: '声优', group: 'Liella!' },
    { month: 4, date: 10, name: '樱小路希奈子', role: '角色', group: 'Liella!' },
    { month: 4, date: 13, name: '大熊和奏', role: '声优', group: 'Liella!' },
    { month: 4, date: 17, name: '渡边曜', role: '角色', group: 'Aqours' },
    { month: 4, date: 17, name: '相良茉优', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 4, date: 19, name: '西木野真姬', role: '角色', group: 'μ\'s' },
    { month: 4, date: 25, name: '前田佳织里', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 5, date: 1, name: '涩谷香音', role: '角色', group: 'Liella!' },
    { month: 5, date: 2, name: 'Pile', role: '声优', group: 'μ\'s' },
    { month: 5, date: 2, name: '大西亚玖璃', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 5, date: 4, name: '鹿角圣良', role: '角色', group: 'Saint Snow' },
    { month: 5, date: 15, name: '林鼓子', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 5, date: 16, name: '青山渚', role: '声优', group: 'Liella!' },
    { month: 5, date: 19, name: '久保百合花', role: '声优', group: 'μ\'s' },
    { month: 5, date: 21, name: '榆井希实', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 5, date: 22, name: '日野下花帆', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 5, date: 24, name: '内田秀', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 5, date: 30, name: '宫下爱', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 6, date: 9, name: '东条希', role: '角色', group: 'μ\'s' },
    { month: 6, date: 9, name: '结木由奈', role: '声优', group: 'Sunny Passion' },
    { month: 6, date: 13, name: '小原鞠莉', role: '角色', group: 'Aqours' },
    { month: 6, date: 15, name: '乙宗梢', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 6, date: 17, name: '若菜四季', role: '角色', group: 'Liella!' },
    { month: 6, date: 28, name: '三森铃子', role: '声优', group: 'μ\'s' },
    { month: 6, date: 29, name: '朝香果林', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 7, date: 1, name: '佩顿尚未', role: '声优', group: 'Liella!' },
    { month: 7, date: 12, name: '南条爱乃', role: '声优', group: 'μ\'s' },
    { month: 7, date: 13, name: '津岛善子', role: '角色', group: 'Aqours' },
    { month: 7, date: 17, name: '唐可可', role: '角色', group: 'Liella!' },
    { month: 7, date: 18, name: '薮岛朱音', role: '声优', group: 'Liella!' },
    { month: 7, date: 22, name: '矢泽妮可', role: '角色', group: 'μ\'s' },
    { month: 7, date: 23, name: '内田彩', role: '声优', group: 'μ\'s' },
    { month: 7, date: 23, name: '铃木爱奈', role: '声优', group: 'Aqours' },
    { month: 8, date: 1, name: '高海千歌', role: '角色', group: 'Aqours' },
    { month: 8, date: 3, name: '高坂穗乃果', role: '角色', group: 'μ\'s' },
    { month: 8, date: 5, name: '法元明菜', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 8, date: 7, name: '鬼塚夏美', role: '角色', group: 'Liella!' },
    { month: 8, date: 8, name: '优木雪菜', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 8, date: 8, name: '逢田梨香子', role: '声优', group: 'Aqours' },
    { month: 8, date: 11, name: '圣泽悠奈', role: '角色', group: 'Sunny Passion' },
    { month: 8, date: 16, name: '齐藤朱夏', role: '声优', group: 'Aqours' },
    { month: 8, date: 20, name: '月音粉', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 8, date: 28, name: '佐佐木琴子', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 8, date: 31, name: '大泽瑠璃乃', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 9, date: 7, name: '村上奈津实', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 9, date: 12, name: '南小鸟', role: '角色', group: 'μ\'s' },
    { month: 9, date: 17, name: '樱井阳菜', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 9, date: 19, name: '樱内梨子', role: '角色', group: 'Aqours' },
    { month: 9, date: 20, name: '指出毬亚', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 9, date: 21, name: '黑泽露比', role: '角色', group: 'Aqours' },
    { month: 9, date: 24, name: '安养寺姬芽', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 9, date: 25, name: '高槻加奈子', role: '声优', group: 'Aqours' },
    { month: 9, date: 27, name: '结那', role: '声优', group: 'Liella!' },
    { month: 9, date: 28, name: '平安名堇', role: '角色', group: 'Liella!' },
    { month: 9, date: 30, name: '伊达小百合', role: '声优', group: 'Liella!' },
    { month: 10, date: 5, name: '三船栞子', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 10, date: 6, name: '田中千惠美', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 10, date: 16, name: '鬼头明里', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 10, date: 20, name: '百生吟子', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 10, date: 21, name: '绚濑绘里', role: '角色', group: 'μ\'s' },
    { month: 10, date: 23, name: '小林爱香', role: '声优', group: 'Aqours' },
    { month: 10, date: 24, name: '花宫初奈', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 10, date: 26, name: '饭田里穗', role: '声优', group: 'μ\'s' },
    { month: 10, date: 29, name: '米女芽衣', role: '角色', group: 'Liella!' },
    { month: 11, date: 1, name: '星空凛', role: '角色', group: 'μ\'s' },
    { month: 11, date: 1, name: '铃原希实', role: '声优', group: 'Liella!' },
    { month: 11, date: 2, name: '诹访奈奈香', role: '声优', group: 'Aqours' },
    { month: 11, date: 8, name: '来栖凛', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 11, date: 13, name: '天王寺璃奈', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 11, date: 17, name: '夕雾缀理', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 11, date: 19, name: '菅叶和', role: '声优', group: '莲之空女学院学园偶像俱乐部' },
    { month: 11, date: 24, name: '叶月恋', role: '角色', group: 'Liella!' },
    { month: 12, date: 2, name: '柊摩央', role: '角色', group: 'Sunny Passion' },
    { month: 12, date: 6, name: '米娅·泰勒', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 12, date: 10, name: '新田惠海', role: '声优', group: 'μ\'s' },
    { month: 12, date: 12, name: '鹿角理亚', role: '角色', group: 'Saint Snow' },
    { month: 12, date: 16, name: '近江彼方', role: '角色', group: '虹咲学园学园偶像同好会' },
    { month: 12, date: 20, name: '藤岛慈', role: '角色', group: '莲之空女学院学园偶像俱乐部' },
    { month: 12, date: 22, name: '楠木灯', role: '声优', group: '虹咲学园学园偶像同好会' },
    { month: 12, date: 23, name: '佐藤日向', role: '声优', group: 'Saint Snow' },
    { month: 12, date: 26, name: '德井青空', role: '声优', group: 'μ\'s' },
    { month: 12, date: 28, name: '鬼塚冬毬', role: '角色', group: 'Liella!' }
];

export function getBirthdays(month: number | undefined) {
    const now = new Date();
    const ifAvailMonth = month && month >= 1 && month <= 12;
    const currentMonth = ifAvailMonth ? month : now.getMonth() + 1;
    const currentMonthBirthdays = birthdays.filter(b => b.month === currentMonth);

    const formatBirthdays = (birthdays: any[]) => {
        return birthdays.map(b => `${b.month}月${b.date}日 ${b.name} (${b.group}, ${b.role})`).join('\n');
    }

    return `${currentMonth}月的生日信息[╹▽╹]\n${formatBirthdays(currentMonthBirthdays)}}`;
}
export function getBirthdaysByDate(month: number, date: number) {
    const birthdaysByDate = birthdays.filter(b => b.month === month && b.date === date);
    if(birthdaysByDate.length===0) return `今天没有人过生日[╹▽╹]`;

    const formatBirthdays = (birthdays: any[]) => {
        return birthdays.map(b => `${b.name} (${b.group}, ${b.role})`).join('\n');
    }

    const she=birthdaysByDate.length>1?'她们':'她';

    return `今天是${she}的生日,祝${she}生日快乐[≧▽≦]\n${formatBirthdays(birthdaysByDate)}`;
}