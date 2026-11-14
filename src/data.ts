// Пример данных для показа экранов. Потом всё это будет приходить из базы (Supabase).

// Пути относительные: так приложение работает и с корня сайта, и из подпапки (GitHub Pages)
export const A = (p: string) => `assets/${p}.webp`

// «Сегодня» для примера: воскресенье, последний день спринта
export const TODAY = new Date(2026, 10, 15)
export const TODAY_D = 15
export const TOGETHER_SINCE = new Date(2025, 8, 29)
export const daysTogether = () => Math.round((TODAY.getTime() - TOGETHER_SINCE.getTime()) / 864e5)

export type Who = 'me' | 'him'
export type Assignee = Who | 'both'

export const PEOPLE: Record<Who, { name: string; short: string; color: string }> = {
  me: { name: 'Я', short: 'Я', color: 'var(--apricot)' },
  him: { name: 'Он', short: 'Он', color: 'var(--sage)' },
}

// ---------- Трекер ----------
export type TaskType = 'task' | 'wish' | 'date' | 'epic'
export type Status = 'backlog' | 'todo' | 'doing' | 'done'
export type Prio = 'low' | 'normal' | 'urgent'

export interface Task {
  id: number
  title: string
  type: TaskType
  assignee: Assignee
  author: Who
  status: Status
  price: number
  prio: Prio
  deadline?: number // день месяца
  labels: string[]
  checklist?: { text: string; done: boolean }[]
  carried?: number
  photo?: boolean
  epic?: { done: number; total: number }
}

export const TYPE_ICON: Record<TaskType, string> = {
  task: 'tracker/type_task',
  wish: 'tracker/type_wish',
  date: 'tracker/type_date',
  epic: 'tracker/type_epic',
}
export const TYPE_NAME: Record<TaskType, string> = {
  task: 'Задача',
  wish: 'Желание',
  date: 'Свидание',
  epic: 'Эпик',
}
export const PRIO_NAME: Record<Prio, string> = { low: 'Низкий', normal: 'Средний', urgent: 'Высокий' }

export const LABELS: Record<string, { name: string; icon: string }> = {
  us: { name: 'для нас', icon: 'tracker/labels/label_us' },
  date: { name: 'свидание', icon: 'tracker/type_date' },
  gift: { name: 'подарок', icon: 'common/gift' },
  health: { name: 'здоровье', icon: 'tracker/labels/label_health' },
  study: { name: 'учёба', icon: 'tracker/labels/label_study' },
  work: { name: 'работа', icon: 'tracker/labels/label_work' },
  growth: { name: 'саморазвитие', icon: 'common/sprout' },
  trip: { name: 'поездка', icon: 'tracker/labels/label_trip' },
}

export const COLUMNS: { id: Status; name: string; icon: string }[] = [
  { id: 'backlog', name: 'Бэклог', icon: 'tracker/col_backlog' },
  { id: 'todo', name: 'К работе', icon: 'tracker/col_todo' },
  { id: 'doing', name: 'В процессе', icon: 'common/hourglass' },
  { id: 'done', name: 'Готово', icon: 'common/check_cookie' },
]

export const TASKS: Task[] = [
  { id: 1, title: 'Выбрать билеты на концерт', type: 'task', assignee: 'both', author: 'me', status: 'todo', price: 5, prio: 'urgent', deadline: 15, labels: ['date'] },
  { id: 2, title: 'Онлайн-свидание: готовим одно блюдо по видеосвязи', type: 'date', assignee: 'both', author: 'him', status: 'todo', price: 6, prio: 'normal', deadline: 16, labels: ['us'] },
  { id: 3, title: 'Обновить резюме', type: 'task', assignee: 'him', author: 'him', status: 'todo', price: 8, prio: 'normal', deadline: 18, labels: ['work'], checklist: [ { text: 'Опыт', done: true }, { text: 'Навыки', done: false }, { text: 'Фото', done: false } ] },
  { id: 4, title: 'Прислать голосовое с песней', type: 'wish', assignee: 'him', author: 'me', status: 'todo', price: 2, prio: 'low', labels: ['us'] },
  { id: 5, title: 'Записаться к стоматологу', type: 'task', assignee: 'me', author: 'me', status: 'doing', price: 3, prio: 'normal', deadline: 14, labels: ['health'], carried: 1 },
  { id: 6, title: 'Поездка в Питер летом', type: 'epic', assignee: 'both', author: 'me', status: 'doing', price: 10, prio: 'normal', labels: ['trip'], epic: { done: 2, total: 6 } },
  { id: 7, title: 'Курсовая: глава 2', type: 'task', assignee: 'me', author: 'me', status: 'doing', price: 9, prio: 'urgent', deadline: 17, labels: ['study'], checklist: [ { text: 'Источники', done: true }, { text: 'Черновик', done: true }, { text: 'Правки', done: false } ] },
  { id: 8, title: 'Зал 3 раза за неделю', type: 'task', assignee: 'me', author: 'me', status: 'done', price: 6, prio: 'normal', labels: ['health'], photo: true },
  { id: 9, title: 'Подготовить презентацию', type: 'task', assignee: 'him', author: 'him', status: 'done', price: 7, prio: 'normal', labels: ['work'] },
  { id: 10, title: 'Научиться печь круассаны', type: 'task', assignee: 'both', author: 'him', status: 'backlog', price: 8, prio: 'low', labels: ['growth'] },
  { id: 11, title: 'Сходить на каток', type: 'date', assignee: 'both', author: 'me', status: 'backlog', price: 5, prio: 'low', labels: ['date'] },
  { id: 12, title: 'Подарок на Новый год', type: 'task', assignee: 'him', author: 'him', status: 'backlog', price: 6, prio: 'normal', labels: ['gift'] },
]

// ---------- Касания ----------
export const TOUCHES = [
  { id: 'hug', name: 'Объятие', icon: 'touches/hug' },
  { id: 'kiss', name: 'Поцелуй', icon: 'touches/kiss' },
  { id: 'miss', name: 'Скучаю', icon: 'touches/miss_you' },
  { id: 'call', name: 'Позвони', icon: 'touches/call_me' },
  { id: 'proud', name: 'Горжусь тобой', icon: 'touches/proud' },
  { id: 'morning', name: 'Доброе утро', icon: 'touches/good_morning' },
  { id: 'night', name: 'Спокойной ночи', icon: 'touches/good_night' },
]

// ---------- Календарь, настроение, цикл ----------
export const MOODS = [
  { id: 'great', name: 'Отлично', color: '#F5D58C' },
  { id: 'good', name: 'Хорошо', color: '#F7C4A0' },
  { id: 'calm', name: 'Спокойно', color: '#A8C49A' },
  { id: 'meh', name: 'Так себе', color: '#EAD9C4' },
  { id: 'tired', name: 'Без сил', color: '#BDB6E3' },
  { id: 'sad', name: 'Грустно', color: '#A9D3E8' },
  { id: 'angry', name: 'Злюсь', color: '#E5876A' },
  { id: 'anxious', name: 'Тревожно', color: '#CFC6DD' },
] as const
export type MoodId = (typeof MOODS)[number]['id']

export const NEEDS = [
  { id: 'support', name: 'Поддержка', icon: 'cheatsheet/emotions/emo_support' },
  { id: 'space', name: 'Пространство', icon: 'cheatsheet/health/near_alone' },
  { id: 'attention', name: 'Внимание', icon: 'calendar/needs/need_attention' },
  { id: 'distract', name: 'Отвлечь', icon: 'calendar/needs/need_distract' },
  { id: 'listen', name: 'Выслушать', icon: 'calendar/needs/need_listen' },
]

const moodCycle: MoodId[] = ['good', 'calm', 'great', 'tired', 'good', 'meh', 'calm', 'good', 'sad', 'good', 'great', 'calm', 'anxious', 'good']
const moodCycle2: MoodId[] = ['calm', 'good', 'good', 'meh', 'great', 'good', 'tired', 'calm', 'good', 'angry', 'good', 'great', 'calm']
export function moodFor(who: Who, day: number): MoodId | undefined {
  if (day > TODAY_D) return undefined
  if (day === TODAY_D && who === 'me') return undefined // своё настроение на сегодня ещё не отмечено
  return (who === 'me' ? moodCycle : moodCycle2)[(day * 3) % (who === 'me' ? moodCycle.length : moodCycle2.length)]
}
export function energyFor(who: Who, day: number) {
  return ((day * (who === 'me' ? 7 : 5)) % 5) + 1
}

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'pms'
export const PERIOD_START = 3 // этого месяца
export const CYCLE = 28
export const PERIOD_LEN = 5
export function phaseFor(day: number): Phase {
  const d = ((day - PERIOD_START) % CYCLE + CYCLE) % CYCLE // 0..27
  if (d < PERIOD_LEN) return 'menstrual'
  if (d < 12) return 'follicular'
  if (d < 16) return 'ovulation'
  if (d >= CYCLE - 5) return 'pms'
  return 'luteal'
}
export const PHASES: Record<Phase, { name: string; icon: string; color: string; hint: string }> = {
  menstrual: { name: 'Менструальная фаза', icon: 'cycle/phase_menstrual', color: '#F6C4C0', hint: 'Эстроген и прогестерон на минимуме, матка сокращается: могут быть спазмы и тянуть поясницу, энергии меньше, тянет к теплу и отдыху.' },
  follicular: { name: 'Фолликулярная фаза', icon: 'cycle/phase_follicular', color: '#E1EDD6', hint: 'Эстроген растёт: энергия, настроение и концентрация растут, кожа обычно лучше.' },
  ovulation: { name: 'Овуляция', icon: 'cycle/phase_ovulation', color: '#FBDCCB', hint: 'Пик эстрогена и всплеск ЛГ: пик энергии и либидо, может быть лёгкая боль внизу живота с одной стороны.' },
  luteal: { name: 'Лютеиновая фаза', icon: 'common/moon', color: '#ECEAF8', hint: 'Растёт прогестерон: температура тела чуть выше, больше сонливость и аппетит.' },
  pms: { name: 'ПМС', icon: 'cheatsheet/situations/sit_pms', color: '#D9D2F0', hint: 'Эстроген и прогестерон падают: возможны раздражительность, отёки, вздутие, чувствительность груди, перепады настроения.' },
}

export const MEETING_DAYS = [1, 8]
export const IMPORTANT_DAYS: Record<number, { name: string; icon: string }> = {
  12: { name: 'Годовщина знакомства', icon: 'dates/date_anniversary' },
  19: { name: 'ДР мамы', icon: 'cheatsheet/people/ppl_birthday' },
}

// ---------- Вотчлист ----------
export type WStatus = 'pending' | 'both' | 'watching' | 'watched'
export interface WItem {
  id: number
  title: string
  year: number
  kind: 'movie' | 'series'
  by: Who
  status: WStatus
  myVote?: 'want' | 'maybe' | 'no'
  progress?: { me: number; him: number; total: number }
  rating?: { me: number; him: number }
}
export const WATCHLIST: WItem[] = [
  { id: 1, title: 'Унесённые призраками', year: 2001, kind: 'movie', by: 'him', status: 'pending' },
  { id: 2, title: 'Гордость и предубеждение', year: 2005, kind: 'movie', by: 'him', status: 'pending' },
  { id: 3, title: 'Интерстеллар', year: 2014, kind: 'movie', by: 'me', status: 'both' },
  { id: 4, title: 'Амели', year: 2001, kind: 'movie', by: 'him', status: 'both' },
  { id: 5, title: 'Отель «Гранд Будапешт»', year: 2014, kind: 'movie', by: 'me', status: 'both' },
  { id: 6, title: 'Друзья', year: 1994, kind: 'series', by: 'me', status: 'watching', progress: { me: 7, him: 6, total: 24 } },
  { id: 7, title: 'Шерлок', year: 2010, kind: 'series', by: 'him', status: 'watching', progress: { me: 2, him: 3, total: 3 } },
  { id: 8, title: 'Ла-Ла Ленд', year: 2016, kind: 'movie', by: 'me', status: 'watched', rating: { me: 9, him: 8 } },
  { id: 9, title: 'Начало', year: 2010, kind: 'movie', by: 'him', status: 'watched', rating: { me: 7, him: 10 } },
]

// ---------- Ачивки ----------
export const ACHIEVEMENTS = [
  { name: 'Первая встреча', tier: 'bronze', icon: 'meetings/meet_button', done: true },
  { name: '10 встреч', tier: 'silver', icon: 'common/two_hearts', done: true },
  { name: '25 встреч', tier: 'gold', icon: 'common/two_hearts', done: true },
  { name: '50 встреч', tier: 'gold', icon: 'common/two_hearts', done: false },
  { name: 'Первая задача', tier: 'bronze', icon: 'common/check_cookie', done: true },
  { name: '50 задач', tier: 'silver', icon: 'tracker/type_task', done: true },
  { name: 'Покорили вершину', tier: 'gold', icon: 'tracker/type_epic', done: false },
  { name: 'Без хвостов', tier: 'silver', icon: 'tracker/sprint_start', done: true },
  { name: 'Новый питомец', tier: 'bronze', icon: 'pet/selection/basket_open', done: true },
  { name: 'Питомец вырос', tier: 'gold', icon: 'pet/ui/level_badge', done: false },
  { name: 'Неделя кадров', tier: 'bronze', icon: 'common/camera', done: true },
  { name: 'Месяц кадров', tier: 'silver', icon: 'common/camera', done: false },
  { name: '100 объятий', tier: 'silver', icon: 'touches/hug', done: true },
  { name: 'Киноклуб', tier: 'silver', icon: 'watchlist/status_watched', done: false },
  { name: '100 дней', tier: 'silver', icon: 'memory/days_together', done: true },
  { name: 'Год вместе', tier: 'gold', icon: 'memory/days_together', done: false },
  { name: 'Первый спор', tier: 'bronze', icon: 'bets/bet', done: true },
  { name: 'Нас стало больше', tier: 'special', icon: 'shop/coupons/second_pet', done: false },
] as const

// ---------- Магазин ----------
export interface ShopItem { id: string; name: string; price: number; icon: string; note?: string }
export const SHOP: Record<string, ShopItem[]> = {
  food: [
    { id: 'bowl', name: 'Миска корма', price: 5, icon: 'shop/food/bowl_basic', note: 'сытость +50' },
    { id: 'fish', name: 'Рыба', price: 15, icon: 'shop/food/treat_fish', note: 'сытость +15, счастье +10' },
    { id: 'bone', name: 'Кость', price: 15, icon: 'shop/food/treat_bone', note: 'сытость +15, счастье +10' },
    { id: 'cheese', name: 'Сыр', price: 20, icon: 'shop/food/treat_cheese', note: 'сытость +15, счастье +10' },
    { id: 'straw', name: 'Клубника', price: 20, icon: 'shop/food/treat_strawberry', note: 'сытость +15, счастье +10' },
    { id: 'milk', name: 'Молоко', price: 25, icon: 'shop/food/treat_milk', note: 'сытость +15, счастье +10' },
    { id: 'cupcake', name: 'Капкейк', price: 40, icon: 'shop/food/treat_cupcake', note: 'сытость +15, счастье +30' },
  ],
  toys: [
    { id: 'ball', name: 'Мяч', price: 40, icon: 'shop/toys/ball' },
    { id: 'mouse', name: 'Мышь', price: 45, icon: 'shop/toys/mouse' },
    { id: 'yarn', name: 'Клубок', price: 50, icon: 'shop/toys/yarn' },
    { id: 'bellball', name: 'Мяч с колокольчиком', price: 50, icon: 'shop/toys/bell_ball' },
    { id: 'squeaky', name: 'Кость-пищалка', price: 55, icon: 'shop/toys/squeaky_bone' },
    { id: 'frisbee', name: 'Фрисби', price: 60, icon: 'shop/toys/frisbee' },
    { id: 'teaser', name: 'Удочка с пером', price: 70, icon: 'shop/toys/teaser' },
    { id: 'teddy', name: 'Плюшевый медведь', price: 80, icon: 'shop/toys/teddy' },
  ],
  acc: [
    { id: 'bow', name: 'Бант', price: 100, icon: 'shop/accessories/acc_bow' },
    { id: 'leaf', name: 'Росток', price: 110, icon: 'shop/accessories/acc_leaf' },
    { id: 'collar', name: 'Ошейник', price: 120, icon: 'shop/accessories/acc_bell_collar' },
    { id: 'scarf', name: 'Шарф', price: 140, icon: 'shop/accessories/acc_scarf' },
    { id: 'bandana', name: 'Бандана', price: 140, icon: 'shop/accessories/acc_bandana' },
    { id: 'bowtie', name: 'Бабочка', price: 150, icon: 'shop/accessories/acc_bowtie' },
    { id: 'beanie', name: 'Шапка', price: 180, icon: 'shop/accessories/acc_beanie' },
    { id: 'wreath', name: 'Венок', price: 180, icon: 'shop/accessories/acc_flower_crown' },
    { id: 'bucket', name: 'Панама', price: 200, icon: 'shop/accessories/acc_bucket_hat' },
    { id: 'glasses', name: 'Очки', price: 220, icon: 'shop/accessories/acc_glasses' },
    { id: 'bunny', name: 'Уши кролика', price: 230, icon: 'shop/accessories/acc_bunny_ears' },
    { id: 'party', name: 'Праздничный колпак', price: 250, icon: 'shop/accessories/acc_party_hat' },
  ],
  furniture: [
    { id: 'rug', name: 'Ковёр', price: 200, icon: 'shop/furniture/rug' },
    { id: 'plant', name: 'Растение', price: 220, icon: 'shop/furniture/plant' },
    { id: 'pillow', name: 'Подушка', price: 220, icon: 'shop/furniture/pillow' },
    { id: 'curtains', name: 'Шторы', price: 230, icon: 'shop/furniture/curtains' },
    { id: 'blanket', name: 'Плед', price: 240, icon: 'shop/furniture/blanket' },
    { id: 'frame', name: 'Фоторамка', price: 250, icon: 'shop/furniture/photo_frame' },
    { id: 'nightlight', name: 'Ночник', price: 260, icon: 'shop/furniture/night_light' },
    { id: 'toybasket', name: 'Корзина для игрушек', price: 280, icon: 'shop/furniture/toy_basket' },
    { id: 'bed', name: 'Лежанка', price: 300, icon: 'shop/furniture/bed' },
    { id: 'shelf', name: 'Полка с книгами', price: 300, icon: 'shop/furniture/bookshelf' },
    { id: 'garland', name: 'Гирлянда', price: 320, icon: 'shop/furniture/garland' },
    { id: 'clock', name: 'Часы', price: 350, icon: 'shop/furniture/clock' },
    { id: 'scratcher', name: 'Когтеточка', price: 400, icon: 'shop/furniture/scratcher' },
    { id: 'armchair', name: 'Кресло', price: 500, icon: 'shop/furniture/armchair' },
    { id: 'aquarium', name: 'Аквариум', price: 550, icon: 'shop/furniture/aquarium' },
    { id: 'house', name: 'Дом для питомца', price: 600, icon: 'shop/furniture/house' },
  ],
}

export const COUPONS_FROM_HIM = [
  { id: 'c1', name: 'Я выбираю фильм', price: 60, icon: 'watchlist/movie', size: 'small' },
  { id: 'c2', name: 'Массаж 30 минут при встрече', price: 200, icon: 'shop/coupons/cpn_massage', size: 'medium' },
  { id: 'c3', name: 'Завтрак доставкой', price: 250, icon: 'shop/coupons/cpn_breakfast', size: 'medium' },
  { id: 'c4', name: 'Свидание полностью по твоему сценарию', price: 600, icon: 'tracker/type_date', size: 'large' },
  { id: 'c5', name: 'День исполнения желаний', price: 1000, icon: 'tracker/type_wish', size: 'large' },
] as const

// ---------- Шпаргалка ----------
export const CHEAT_SECTIONS = [
  { id: 'sizes', name: 'Размеры', icon: 'cheatsheet/sec_sizes', filled: 6, total: 7 },
  { id: 'health', name: 'Здоровье', icon: 'cheatsheet/sec_health', filled: 14, total: 27 },
  { id: 'food', name: 'Еда', icon: 'cheatsheet/sec_food', filled: 8, total: 10 },
  { id: 'gifts', name: 'Подарки', icon: 'common/gift', filled: 5, total: 8 },
  { id: 'emotions', name: 'Эмоции', icon: 'cheatsheet/sec_emotions', filled: 4, total: 6 },
  { id: 'people', name: 'Люди', icon: 'cheatsheet/sec_people', filled: 3, total: 4 },
  { id: 'tastes', name: 'Вкусы', icon: 'cheatsheet/sec_tastes', filled: 5, total: 6 },
  { id: 'dreams', name: 'Мечты', icon: 'cheatsheet/sec_dreams', filled: 2, total: 3 },
  { id: 'custom', name: 'Своё', icon: 'cheatsheet/sec_custom', filled: 1, total: 1 },
]

export const SECTION_FIELDS: Record<string, { label: string; icon: string; value?: string }[]> = {
  sizes: [
    { label: 'Одежда: верх', icon: 'cheatsheet/sizes/size_top', value: 'L, худи — XL' },
    { label: 'Одежда: низ', icon: 'cheatsheet/sizes/size_bottom', value: '32/32' },
    { label: 'Обувь', icon: 'cheatsheet/sizes/size_shoes', value: '43 · стопа 27,5 см' },
    { label: 'Кольцо', icon: 'cheatsheet/sizes/size_ring', value: '20,5 · безымянный' },
    { label: 'Бельё', icon: 'cheatsheet/sizes/size_underwear', value: 'L' },
    { label: 'Носки', icon: 'cheatsheet/sizes/size_socks', value: '42–44' },
    { label: 'Перчатки', icon: 'cheatsheet/sizes/size_gloves' },
  ],
  food: [
    { label: 'Любимое', icon: 'cheatsheet/food/food_love', value: 'паста с креветками, сырники' },
    { label: 'Нелюбимое', icon: 'cheatsheet/food/food_hate', value: 'варёный лук, оливки' },
    { label: 'Заказ в кофейне', icon: 'cheatsheet/food/food_coffee', value: 'раф на овсяном, без сиропа' },
    { label: 'Суши', icon: 'cheatsheet/food/food_sushi', value: 'Филадельфия, без огурца' },
    { label: 'Фастфуд', icon: 'cheatsheet/food/food_fastfood', value: 'чизбургер + наггетсы' },
    { label: 'Сладкое', icon: 'cheatsheet/food/food_sweets', value: 'медовик' },
    { label: 'Алкоголь', icon: 'cheatsheet/food/food_drinks', value: 'сидр, без крепкого' },
    { label: 'Когда грустно', icon: 'common/pot', value: 'суп с фрикадельками' },
    { label: 'Перекусы', icon: 'cheatsheet/food/food_snacks' },
  ],
  gifts: [
    { label: 'Любимые цвета', icon: 'cheatsheet/gifts/gift_colors', value: 'тёмно-зелёный, бежевый' },
    { label: 'Цветы', icon: 'cheatsheet/gifts/gift_flowers' },
    { label: 'Ароматы', icon: 'cheatsheet/gifts/gift_scents', value: 'древесные, без сладкого' },
    { label: 'Бренды', icon: 'cheatsheet/gifts/gift_brands', value: 'Uniqlo, New Balance' },
    { label: 'Украшения', icon: 'cheatsheet/gifts/gift_jewelry', value: 'серебро, только часы' },
    { label: 'Уже есть', icon: 'cheatsheet/gifts/gift_has', value: 'наушники, термос' },
    { label: 'Не дарить', icon: 'cheatsheet/gifts/gift_no', value: 'парфюм без пробы' },
  ],
  emotions: [
    { label: 'Что бесит', icon: 'cheatsheet/situations/sit_anger', value: 'когда перебивают' },
    { label: 'Как успокоить', icon: 'cheatsheet/emotions/emo_calm', value: 'дать выговориться, не советовать сразу' },
    { label: 'Как поддержать', icon: 'cheatsheet/emotions/emo_support', value: 'голосовое + сказать «я рядом»' },
    { label: 'Язык любви', icon: 'common/two_hearts', value: '1. время 2. прикосновения 3. слова' },
    { label: 'О чём не шутить', icon: 'cheatsheet/emotions/emo_no_jokes' },
    { label: 'Что радует', icon: 'cheatsheet/emotions/emo_joys', value: 'мемы с котами, кофе с утра' },
  ],
  people: [
    { label: 'Родители', icon: 'cheatsheet/people/ppl_parents', value: 'мама Ольга (ДР 19.11), папа Игорь' },
    { label: 'Друзья', icon: 'cheatsheet/people/ppl_friends', value: 'Дима, Саша — со школы' },
    { label: 'Коллеги', icon: 'cheatsheet/people/ppl_colleagues', value: 'тимлид Аня' },
    { label: 'Другие', icon: 'cheatsheet/sec_people' },
  ],
  tastes: [
    { label: 'Фильмы', icon: 'watchlist/movie', value: 'Нолан, Уэс Андерсон' },
    { label: 'Сериалы', icon: 'watchlist/series', value: 'ситкомы' },
    { label: 'Музыка', icon: 'cheatsheet/tastes/taste_music', value: 'инди, lo-fi' },
    { label: 'Книги', icon: 'cheatsheet/tastes/taste_books', value: 'фантастика' },
    { label: 'Игры', icon: 'cheatsheet/tastes/taste_games', value: 'кооп-игры' },
    { label: 'Хобби', icon: 'cheatsheet/tastes/taste_hobby' },
  ],
  dreams: [
    { label: 'Куда поехать', icon: 'cheatsheet/dreams/dream_travel', value: 'Япония весной' },
    { label: 'Чему научиться', icon: 'cheatsheet/dreams/dream_learn', value: 'гитара' },
    { label: 'Большие мечты', icon: 'cheatsheet/dreams/dream_big' },
  ],
  custom: [{ label: 'Заметки', icon: 'cheatsheet/sec_custom', value: 'не любит звонки без предупреждения' }],
}

export const MEDCARD = [
  { label: 'Аллергии', icon: 'cheatsheet/health/med_allergy', value: 'пыльца берёзы (апрель–май)' },
  { label: 'Нельзя есть', icon: 'cheatsheet/health/med_intolerance', value: 'лактоза — немного можно' },
  { label: 'Плохая реакция', icon: 'cheatsheet/health/med_bad_reaction' },
  { label: 'Постоянные', icon: 'cheatsheet/health/med_regular', value: 'витамин D' },
  { label: 'Хроническое', icon: 'cheatsheet/health/med_chronic' },
  { label: 'Группа крови', icon: 'cheatsheet/health/med_blood', value: 'II+' },
  { label: 'Врачи', icon: 'cheatsheet/health/med_doctors' },
  { label: 'Экстренный контакт', icon: 'cheatsheet/health/med_emergency', value: 'мама' },
  { label: 'Аптечка дома', icon: 'cheatsheet/health/home_kit', value: 'есть: нурофен, пластыри' },
]

export const SITUATIONS = [
  { id: 'headache', name: 'Болит голова', icon: 'cheatsheet/situations/sit_headache', filled: true },
  { id: 'stomach', name: 'Живот, тошнота', icon: 'cheatsheet/situations/sit_stomach', filled: true },
  { id: 'fever', name: 'Простуда', icon: 'cheatsheet/situations/sit_fever', filled: true },
  { id: 'throat', name: 'Горло, насморк', icon: 'cheatsheet/situations/sit_throat' },
  { id: 'period', name: 'Месячные', icon: 'cheatsheet/situations/sit_period' },
  { id: 'pms', name: 'ПМС', icon: 'cheatsheet/situations/sit_pms' },
  { id: 'allergy', name: 'Аллергия', icon: 'cheatsheet/health/med_allergy', filled: true },
  { id: 'tooth', name: 'Зуб', icon: 'cheatsheet/situations/sit_tooth' },
  { id: 'back', name: 'Спина, мышцы', icon: 'cheatsheet/situations/sit_back' },
  { id: 'injury', name: 'Порез, ушиб', icon: 'cheatsheet/situations/sit_injury' },
  { id: 'hangover', name: 'Похмелье', icon: 'cheatsheet/situations/sit_hangover' },
  { id: 'insomnia', name: 'Не спится', icon: 'cheatsheet/situations/sit_insomnia' },
  { id: 'tired', name: 'Усталость', icon: 'calendar/energy/energy_1' },
  { id: 'anxiety', name: 'Тревога', icon: 'cheatsheet/situations/sit_anxiety', filled: true },
  { id: 'burnout', name: 'Выгорание', icon: 'cheatsheet/situations/sit_burnout' },
  { id: 'sad', name: 'Грусть', icon: 'common/raincloud', filled: true },
  { id: 'anger', name: 'Злость', icon: 'cheatsheet/situations/sit_anger' },
  { id: 'overwhelmed', name: 'Накрыло', icon: 'cheatsheet/situations/sit_overwhelmed' },
]

export const SITUATION_EXAMPLE = {
  name: 'Болит голова',
  icon: 'cheatsheet/situations/sit_headache',
  fields: [
    { label: 'Что принимает', icon: 'cheatsheet/health/field_meds', value: 'Ибупрофен 400 мг, не больше 2 раз в день (пишет сам)' },
    { label: 'Что принести', icon: 'cheatsheet/health/field_bring', value: 'холодную воду с лимоном, тёмные очки' },
    { label: 'Заказать доставкой', icon: 'cheatsheet/health/field_delivery', value: 'вода без газа, бананы, таблетки из списка выше' },
    { label: 'Что помогает', icon: 'cheatsheet/health/field_helps', value: 'тишина, затемнить комнату, лёгкий массаж шеи' },
    { label: 'Чего не делать', icon: 'common/cross_badge', value: 'не звонить по видео, не включать музыку' },
    { label: 'Как быть рядом', icon: 'cheatsheet/health/near_alone', value: 'дать побыть одному, написать через час' },
    { label: 'Когда к врачу', icon: 'cheatsheet/health/field_doctor', value: 'если больше суток или с температурой и тошнотой' },
  ],
}

// ---------- Вместе ----------
export const TOGETHER_TILES = [
  { id: 'photos', name: 'Фото дня', icon: 'common/camera', note: 'архив' },
  { id: 'watchlist', name: 'Вотчлист', icon: 'watchlist/status_watching', note: '2 ждут голоса' },
  { id: 'wishlist', name: 'Вишлисты', icon: 'wishlist/wishlist', note: '12 желаний' },
  { id: 'bucket', name: 'Bucket list', icon: 'bucket/bucket', note: '4 из 23' },
  { id: 'memory', name: 'Память', icon: 'memory/days_together', note: '1 капсула' },
  { id: 'challenges', name: 'Челленджи', icon: 'challenges/challenge', note: 'день 4 из 7' },
  { id: 'bets', name: 'Споры', icon: 'bets/bet', note: 'счёт 3 : 2' },
  { id: 'talk', name: 'Надо поговорить', icon: 'talk/talk_queue', note: '1 тема' },
  { id: 'gratitude', name: 'Благодарности', icon: 'talk/gratitude', note: '38 «спасибо»' },
  { id: 'agreements', name: 'Договорённости', icon: 'talk/agreements', note: '6 правил' },
  { id: 'achievements', name: 'Ачивки', icon: 'achievements/frame_gold', note: '11 из 47' },
]
