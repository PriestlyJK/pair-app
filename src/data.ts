// Справочники приложения: магазин, метки, разделы шпаргалки и т. п. Данных пользователя здесь нет.

// Пути относительные: так приложение работает и с корня сайта, и из подпапки (GitHub Pages)
export const A = (p: string) => `assets/${p}.webp`


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
  deadline?: string // 'YYYY-MM-DD'
  since?: string // когда попала в спринт
  doneAt?: string
  // Общая задача: кто когда отметил свою часть (каждый получает свои монеты, закрыта — когда оба)
  doneBy?: Partial<Record<Who, string>>
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

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'pms'
export const PHASES: Record<Phase, { name: string; icon: string; color: string; hint: string }> = {
  menstrual: { name: 'Менструальная фаза', icon: 'cycle/phase_menstrual', color: '#F6C4C0', hint: 'Эстроген и прогестерон на минимуме, матка сокращается: могут быть спазмы и тянуть поясницу, энергии меньше, тянет к теплу и отдыху.' },
  follicular: { name: 'Фолликулярная фаза', icon: 'cycle/phase_follicular', color: '#E1EDD6', hint: 'Эстроген растёт: энергия, настроение и концентрация растут, кожа обычно лучше.' },
  ovulation: { name: 'Овуляция', icon: 'cycle/phase_ovulation', color: '#FBDCCB', hint: 'Пик эстрогена и всплеск ЛГ: пик энергии и либидо, может быть лёгкая боль внизу живота с одной стороны.' },
  luteal: { name: 'Лютеиновая фаза', icon: 'common/moon', color: '#ECEAF8', hint: 'Растёт прогестерон: температура тела чуть выше, больше сонливость и аппетит.' },
  pms: { name: 'ПМС', icon: 'cheatsheet/situations/sit_pms', color: '#D9D2F0', hint: 'Эстроген и прогестерон падают: возможны раздражительность, отёки, вздутие, чувствительность груди, перепады настроения.' },
}

// ---------- Ачивки ----------
// Получены они или нет, считается из ваших данных (screens/Together.tsx)
export const ACHIEVEMENTS = [
  { id: 'meet1', name: 'Первая встреча', tier: 'bronze', icon: 'meetings/meet_button' },
  { id: 'meet10', name: '10 встреч', tier: 'silver', icon: 'common/two_hearts' },
  { id: 'meet25', name: '25 встреч', tier: 'gold', icon: 'common/two_hearts' },
  { id: 'meet50', name: '50 встреч', tier: 'gold', icon: 'common/two_hearts' },
  { id: 'task1', name: 'Первая задача', tier: 'bronze', icon: 'common/check_cookie' },
  { id: 'task50', name: '50 задач', tier: 'silver', icon: 'tracker/type_task' },
  { id: 'epic', name: 'Покорили вершину', tier: 'gold', icon: 'tracker/type_epic' },
  { id: 'clean', name: 'Без хвостов', tier: 'silver', icon: 'tracker/sprint_start' },
  { id: 'pet', name: 'Новый питомец', tier: 'bronze', icon: 'pet/selection/basket_open' },
  { id: 'grown', name: 'Питомец вырос', tier: 'gold', icon: 'pet/ui/level_badge' },
  { id: 'photo7', name: 'Неделя кадров', tier: 'bronze', icon: 'common/camera' },
  { id: 'photo30', name: 'Месяц кадров', tier: 'silver', icon: 'common/camera' },
  { id: 'hug100', name: '100 объятий', tier: 'silver', icon: 'touches/hug' },
  { id: 'movies', name: 'Киноклуб', tier: 'silver', icon: 'watchlist/status_watched' },
  { id: 'days100', name: '100 дней', tier: 'silver', icon: 'memory/days_together' },
  { id: 'year', name: 'Год вместе', tier: 'gold', icon: 'memory/days_together' },
  { id: 'bet1', name: 'Первый спор', tier: 'bronze', icon: 'bets/bet' },
  { id: 'pet2', name: 'Нас стало больше', tier: 'special', icon: 'shop/coupons/second_pet' },
] as const
export const ACH_HINT: Record<string, string> = {
  meet1: 'Отметьте первую встречу', meet10: '10 встреч вживую', meet25: '25 встреч вживую', meet50: '50 встреч вживую',
  task1: 'Закройте первую задачу', task50: 'Закройте 50 задач', epic: 'Закройте эпик', clean: 'Закройте все задачи недели (от 3 штук)',
  pet: 'Заведите питомца', grown: 'Питомец дорастёт до 10 уровня', photo7: '7 дней подряд фото дня вдвоём', photo30: '30 дней подряд фото дня вдвоём',
  hug100: 'Отправьте 100 объятий', movies: 'Посмотрите вместе 5 фильмов', days100: '100 дней вместе', year: 'Год вместе',
  bet1: 'Заключите первый спор', pet2: 'Накопите на второго питомца',
}

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

// ---------- Шпаргалка ----------
export const CHEAT_SECTIONS = [
  { id: 'sizes', name: 'Размеры', icon: 'cheatsheet/sec_sizes' },
  { id: 'food', name: 'Еда', icon: 'cheatsheet/sec_food' },
  { id: 'gifts', name: 'Подарки', icon: 'common/gift' },
  { id: 'emotions', name: 'Эмоции', icon: 'cheatsheet/sec_emotions' },
  { id: 'people', name: 'Люди', icon: 'cheatsheet/sec_people' },
  { id: 'tastes', name: 'Вкусы', icon: 'cheatsheet/sec_tastes' },
  { id: 'dreams', name: 'Мечты', icon: 'cheatsheet/sec_dreams' },
  { id: 'custom', name: 'Своё', icon: 'cheatsheet/sec_custom' },
]

export interface CheatField { label: string; icon: string; hint?: string }
export const SECTION_FIELDS: Record<string, CheatField[]> = {
  sizes: [
    { label: 'Одежда: верх', icon: 'cheatsheet/sizes/size_top', hint: 'например, M, худи — L' },
    { label: 'Одежда: низ', icon: 'cheatsheet/sizes/size_bottom' },
    { label: 'Обувь', icon: 'cheatsheet/sizes/size_shoes', hint: 'размер и длина стопы' },
    { label: 'Кольцо', icon: 'cheatsheet/sizes/size_ring' },
    { label: 'Бельё', icon: 'cheatsheet/sizes/size_underwear' },
    { label: 'Носки', icon: 'cheatsheet/sizes/size_socks' },
    { label: 'Перчатки', icon: 'cheatsheet/sizes/size_gloves' },
  ],
  food: [
    { label: 'Любимое', icon: 'cheatsheet/food/food_love' },
    { label: 'Нелюбимое', icon: 'cheatsheet/food/food_hate' },
    { label: 'Заказ в кофейне', icon: 'cheatsheet/food/food_coffee' },
    { label: 'Суши', icon: 'cheatsheet/food/food_sushi' },
    { label: 'Фастфуд', icon: 'cheatsheet/food/food_fastfood' },
    { label: 'Сладкое', icon: 'cheatsheet/food/food_sweets' },
    { label: 'Алкоголь', icon: 'cheatsheet/food/food_drinks' },
    { label: 'Когда грустно', icon: 'common/pot' },
    { label: 'Перекусы', icon: 'cheatsheet/food/food_snacks' },
  ],
  gifts: [
    { label: 'Любимые цвета', icon: 'cheatsheet/gifts/gift_colors' },
    { label: 'Цветы', icon: 'cheatsheet/gifts/gift_flowers' },
    { label: 'Ароматы', icon: 'cheatsheet/gifts/gift_scents' },
    { label: 'Бренды', icon: 'cheatsheet/gifts/gift_brands' },
    { label: 'Украшения', icon: 'cheatsheet/gifts/gift_jewelry' },
    { label: 'Уже есть', icon: 'cheatsheet/gifts/gift_has' },
    { label: 'Не дарить', icon: 'cheatsheet/gifts/gift_no' },
  ],
  emotions: [
    { label: 'Что бесит', icon: 'cheatsheet/situations/sit_anger' },
    { label: 'Как успокоить', icon: 'cheatsheet/emotions/emo_calm' },
    { label: 'Как поддержать', icon: 'cheatsheet/emotions/emo_support' },
    { label: 'Язык любви', icon: 'common/two_hearts' },
    { label: 'О чём не шутить', icon: 'cheatsheet/emotions/emo_no_jokes' },
    { label: 'Что радует', icon: 'cheatsheet/emotions/emo_joys' },
  ],
  people: [
    { label: 'Родители', icon: 'cheatsheet/people/ppl_parents', hint: 'имена, дни рождения' },
    { label: 'Друзья', icon: 'cheatsheet/people/ppl_friends' },
    { label: 'Коллеги', icon: 'cheatsheet/people/ppl_colleagues' },
    { label: 'Другие', icon: 'cheatsheet/sec_people' },
  ],
  tastes: [
    { label: 'Фильмы', icon: 'watchlist/movie' },
    { label: 'Сериалы', icon: 'watchlist/series' },
    { label: 'Музыка', icon: 'cheatsheet/tastes/taste_music' },
    { label: 'Книги', icon: 'cheatsheet/tastes/taste_books' },
    { label: 'Игры', icon: 'cheatsheet/tastes/taste_games' },
    { label: 'Хобби', icon: 'cheatsheet/tastes/taste_hobby' },
  ],
  dreams: [
    { label: 'Куда поехать', icon: 'cheatsheet/dreams/dream_travel' },
    { label: 'Чему научиться', icon: 'cheatsheet/dreams/dream_learn' },
    { label: 'Большие мечты', icon: 'cheatsheet/dreams/dream_big' },
  ],
  custom: [{ label: 'Заметки', icon: 'cheatsheet/sec_custom' }],
}

export const MEDCARD: CheatField[] = [
  { label: 'Аллергии', icon: 'cheatsheet/health/med_allergy' },
  { label: 'Нельзя есть', icon: 'cheatsheet/health/med_intolerance' },
  { label: 'Плохая реакция', icon: 'cheatsheet/health/med_bad_reaction', hint: 'на какие лекарства' },
  { label: 'Постоянные', icon: 'cheatsheet/health/med_regular', hint: 'что принимает постоянно' },
  { label: 'Хроническое', icon: 'cheatsheet/health/med_chronic' },
  { label: 'Группа крови', icon: 'cheatsheet/health/med_blood' },
  { label: 'Врачи', icon: 'cheatsheet/health/med_doctors' },
  { label: 'Экстренный контакт', icon: 'cheatsheet/health/med_emergency' },
  { label: 'Аптечка дома', icon: 'cheatsheet/health/home_kit' },
]

export const SITUATIONS = [
  { id: 'headache', name: 'Болит голова', icon: 'cheatsheet/situations/sit_headache' },
  { id: 'stomach', name: 'Живот, тошнота', icon: 'cheatsheet/situations/sit_stomach' },
  { id: 'fever', name: 'Простуда', icon: 'cheatsheet/situations/sit_fever' },
  { id: 'throat', name: 'Горло, насморк', icon: 'cheatsheet/situations/sit_throat' },
  { id: 'period', name: 'Месячные', icon: 'cheatsheet/situations/sit_period' },
  { id: 'pms', name: 'ПМС', icon: 'cheatsheet/situations/sit_pms' },
  { id: 'allergy', name: 'Аллергия', icon: 'cheatsheet/health/med_allergy' },
  { id: 'tooth', name: 'Зуб', icon: 'cheatsheet/situations/sit_tooth' },
  { id: 'back', name: 'Спина, мышцы', icon: 'cheatsheet/situations/sit_back' },
  { id: 'injury', name: 'Порез, ушиб', icon: 'cheatsheet/situations/sit_injury' },
  { id: 'hangover', name: 'Похмелье', icon: 'cheatsheet/situations/sit_hangover' },
  { id: 'insomnia', name: 'Не спится', icon: 'cheatsheet/situations/sit_insomnia' },
  { id: 'tired', name: 'Усталость', icon: 'calendar/energy/energy_1' },
  { id: 'anxiety', name: 'Тревога', icon: 'cheatsheet/situations/sit_anxiety' },
  { id: 'burnout', name: 'Выгорание', icon: 'cheatsheet/situations/sit_burnout' },
  { id: 'sad', name: 'Грусть', icon: 'common/raincloud' },
  { id: 'anger', name: 'Злость', icon: 'cheatsheet/situations/sit_anger' },
  { id: 'overwhelmed', name: 'Накрыло', icon: 'cheatsheet/situations/sit_overwhelmed' },
]

// Одинаковые поля у каждой ситуации
export const SITUATION_FIELDS: CheatField[] = [
  { label: 'Что принимает', icon: 'cheatsheet/health/field_meds', hint: 'лекарство и дозировку пишет сам человек' },
  { label: 'Что принести', icon: 'cheatsheet/health/field_bring' },
  { label: 'Заказать доставкой', icon: 'cheatsheet/health/field_delivery' },
  { label: 'Что помогает', icon: 'cheatsheet/health/field_helps' },
  { label: 'Чего не делать', icon: 'common/cross_badge' },
  { label: 'Как быть рядом', icon: 'cheatsheet/health/near_alone' },
  { label: 'Когда к врачу', icon: 'cheatsheet/health/field_doctor' },
]

// ---------- Вместе ----------
export const TOGETHER_TILES = [
  { id: 'photos', name: 'Фото дня', icon: 'common/camera' },
  { id: 'watchlist', name: 'Вотчлист', icon: 'watchlist/status_watching' },
  { id: 'wishlist', name: 'Вишлисты', icon: 'wishlist/wishlist' },
  { id: 'bucket', name: 'Bucket list', icon: 'bucket/bucket' },
  { id: 'places', name: 'Карта мест', icon: 'cheatsheet/dreams/dream_travel' },
  { id: 'memory', name: 'Память', icon: 'memory/days_together' },
  { id: 'challenges', name: 'Челленджи', icon: 'challenges/challenge' },
  { id: 'bets', name: 'Споры', icon: 'bets/bet' },
  { id: 'talk', name: 'Надо поговорить', icon: 'talk/talk_queue' },
  { id: 'gratitude', name: 'Благодарности', icon: 'talk/gratitude' },
  { id: 'agreements', name: 'Договорённости', icon: 'talk/agreements' },
  { id: 'achievements', name: 'Ачивки', icon: 'achievements/frame_gold' },
]
