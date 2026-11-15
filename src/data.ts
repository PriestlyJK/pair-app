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
  { id: 'us', name: 'Про нас', icon: 'touches/hug' },
  { id: 'emotions', name: 'Эмоции', icon: 'cheatsheet/sec_emotions' },
  { id: 'gifts', name: 'Подарки', icon: 'common/gift' },
  { id: 'food', name: 'Еда', icon: 'cheatsheet/sec_food' },
  { id: 'sizes', name: 'Размеры', icon: 'cheatsheet/sec_sizes' },
  { id: 'people', name: 'Близкие люди', icon: 'cheatsheet/sec_people' },
  { id: 'tastes', name: 'Вкусы', icon: 'cheatsheet/sec_tastes' },
  { id: 'dreams', name: 'Мечты', icon: 'cheatsheet/sec_dreams' },
  { id: 'custom', name: 'Своё', icon: 'cheatsheet/sec_custom' },
]

/* Поле шпаргалки. Ответы хранятся по ключу «раздел.key» — key не меняем никогда, иначе старые ответы потеряются.
   Если у поля нет key, ключ — это label (так было раньше). Поэтому, переписывая вопрос, старый текст переезжает в key.
   hint — пример ответа, показывается как «например: …», когда поле пустое. */
export interface CheatField { key?: string; label: string; icon: string; hint?: string }
export const fieldKey = (f: CheatField) => f.key ?? f.label

export const SECTION_FIELDS: Record<string, CheatField[]> = {
  us: [
    { label: 'От чего тепло на расстоянии', icon: 'common/heart', hint: 'голосовые перед сном, фото из твоего дня, когда помнишь мелочи' },
    { label: 'Сколько хочется созваниваться', icon: 'touches/call_me', hint: 'каждый вечер хотя бы минут десять, в выходные подольше' },
    { label: 'Ритуалы, которые важны', icon: 'touches/good_morning', hint: '«доброе утро» первым делом, «спокойной ночи» голосом' },
    { label: 'Что царапает в переписке', icon: 'common/speech_heart', hint: 'сухое «ок», ответ через пять часов без объяснений' },
    { label: 'Если пропадаю — что это значит', icon: 'touches/miss_you', hint: 'обычно просто устаю от людей: одно тёплое сообщение и не дёргать' },
    { label: 'Что тревожит на расстоянии', icon: 'calendar/mood/mood_anxious', hint: 'когда не знаю, где ты вечером; помогает просто сказать заранее' },
    { label: 'Как мириться после ссоры', icon: 'talk/agreements', hint: 'дать час остыть, потом позвонить, а не писать простыню' },
    { label: 'Запрещённые приёмы в ссоре', icon: 'common/cross_badge', hint: '«ты всегда…», сравнения с бывшими, уходить в игнор' },
    { label: 'Как говорить о сложном', icon: 'talk/talk_queue', hint: 'голосом, а не текстом; не перед сном; сначала спросить, есть ли силы' },
    { label: 'Как называть: да и нет', icon: 'touches/kiss', hint: '«зай» — да, «малыш» — нет, по фамилии — только в шутку' },
    { label: 'Любимое воспоминание о нас', icon: 'memory/days_together', hint: 'как гуляли до утра после первого свидания' },
    { label: 'Первое, что сделать при встрече', icon: 'meetings/meet_place', hint: 'долго обниматься на вокзале, потом поесть и отсыпаться' },
  ],
  emotions: [
    { key: 'Что бесит', label: 'Что выводит из себя', icon: 'cheatsheet/situations/sit_anger', hint: 'когда перебивают, опоздания без предупреждения' },
    { key: 'Как успокоить', label: 'Как успокоить, когда кипит', icon: 'cheatsheet/emotions/emo_calm', hint: 'не спорить, дать выговориться, потом обнять или позвонить' },
    { key: 'Как поддержать', label: 'Как поддержать, когда плохо', icon: 'cheatsheet/emotions/emo_support', hint: 'не давать советов, просто слушать и быть на связи' },
    { label: 'Как понять, что что-то не так', icon: 'calendar/mood/mood_meh', hint: 'отвечаю односложно и пропадаю — значит, накрыло' },
    { label: 'Когда нужна тишина', icon: 'common/moon', hint: 'пишу «я в норме, просто тихо» — это не обида, просто подожди' },
    { label: 'Что задевает, хотя молчу', icon: 'common/raincloud', hint: 'когда забываешь то, что я рассказываю' },
    { key: 'Язык любви', label: 'Как лучше показывать любовь', icon: 'common/two_hearts', hint: 'словами и голосовыми, а не подарками; внимание к мелочам' },
    { key: 'Что радует', label: 'Что поднимает настроение', icon: 'cheatsheet/emotions/emo_joys', hint: 'видео с котами, твоё голосовое, мем про нас' },
    { key: 'О чём не шутить', label: 'О чём лучше не шутить', icon: 'cheatsheet/emotions/emo_no_jokes', hint: 'вес, родители, моя работа' },
  ],
  gifts: [
    { label: 'Хочу, но себе не куплю', icon: 'wishlist/wishlist', hint: 'хорошую сковородку, массаж, кашемировые носки' },
    { label: 'Мелочь, которая всегда радует', icon: 'common/envelope', hint: 'открытка по почте, записка, шоколадка с доставкой' },
    { label: 'Сюрприз или лучше спросить', icon: 'common/gift', hint: 'мелочи — сюрпризом, что-то большое — лучше посоветоваться' },
    { key: 'Цветы', label: 'Цветы: какие радуют', icon: 'cheatsheet/gifts/gift_flowers', hint: 'пионы, тюльпаны; розы — не очень' },
    { key: 'Любимые цвета', label: 'Цвета: нравятся и нет', icon: 'cheatsheet/gifts/gift_colors', hint: 'пыльно-розовый, оливковый; ярко-оранжевый — нет' },
    { key: 'Ароматы', label: 'Запахи: духи, свечи', icon: 'cheatsheet/gifts/gift_scents', hint: 'ваниль, древесные; слишком сладкие — нет' },
    { key: 'Украшения', label: 'Украшения: что ношу', icon: 'cheatsheet/gifts/gift_jewelry', hint: 'серебро, тонкие цепочки; уши не проколоты' },
    { key: 'Бренды', label: 'Где люблю покупать', icon: 'cheatsheet/gifts/gift_brands', hint: 'магазины и бренды, откуда точно понравится' },
    { key: 'Уже есть', label: 'Уже есть — не надо', icon: 'cheatsheet/gifts/gift_has', hint: 'наушники, кофемашина, кружек хватит' },
    { key: 'Не дарить', label: 'Точно не дарить', icon: 'cheatsheet/gifts/gift_no', hint: 'косметику наугад, мягкие игрушки, сертификаты' },
  ],
  food: [
    { key: 'Любимое', label: 'Могу есть хоть каждый день', icon: 'cheatsheet/food/food_love', hint: 'паста с грибами, борщ, сырники' },
    { label: 'Что заказать, чтобы порадовать', icon: 'cheatsheet/health/field_delivery', hint: 'пиццу из той самой пиццерии, кофе с круассаном утром' },
    { key: 'Заказ в кофейне', label: 'Заказ в кофейне', icon: 'cheatsheet/food/food_coffee', hint: 'раф на овсяном, большой, без сиропа' },
    { key: 'Сладкое', label: 'Сладкое, которое точно зайдёт', icon: 'cheatsheet/food/food_sweets', hint: 'чизкейк, киндер, мармеладные мишки' },
    { key: 'Когда грустно', label: 'Еда для утешения', icon: 'common/pot', hint: 'лапша, мандарины, горячий шоколад' },
    { key: 'Перекусы', label: 'Перекусы под сериал', icon: 'cheatsheet/food/food_snacks', hint: 'чипсы с крабом, орешки, сухарики' },
    { key: 'Суши', label: 'Роллы: что брать', icon: 'cheatsheet/food/food_sushi', hint: 'филадельфия, без угря, побольше имбиря' },
    { key: 'Фастфуд', label: 'Фастфуд: обычный заказ', icon: 'cheatsheet/food/food_fastfood', hint: 'бургер без лука, картошка, сырный соус' },
    { key: 'Алкоголь', label: 'Что пью, а что нет', icon: 'cheatsheet/food/food_drinks', hint: 'сухое белое — да, крепкое — нет; или не пью совсем' },
    { key: 'Нелюбимое', label: 'Не ем ни за что', icon: 'cheatsheet/food/food_hate', hint: 'кинза, печень, изюм в выпечке' },
    { label: 'Что приготовить вместе', icon: 'common/two_hearts', hint: 'домашнюю пиццу, сырники на завтрак' },
  ],
  sizes: [
    { label: 'Одежда: верх', icon: 'cheatsheet/sizes/size_top', hint: 'S–M, худи беру L, чтобы свободно' },
    { label: 'Одежда: низ', icon: 'cheatsheet/sizes/size_bottom', hint: 'джинсы 27/32, высокая посадка' },
    { label: 'Обувь', icon: 'cheatsheet/sizes/size_shoes', hint: '38, стопа 24,5 см; кроссовки на полразмера больше' },
    { label: 'Кольцо', icon: 'cheatsheet/sizes/size_ring', hint: '16,5 — безымянный, 17 — указательный' },
    { label: 'Бельё', icon: 'cheatsheet/sizes/size_underwear', hint: 'размер и что нравится: хлопок, без поролона' },
    { label: 'Носки', icon: 'cheatsheet/sizes/size_socks', hint: '36–38, высокие' },
    { label: 'Перчатки', icon: 'cheatsheet/sizes/size_gloves', hint: 'S или обхват ладони в сантиметрах' },
    { label: 'Что сидит хорошо, а что нет', icon: 'cheatsheet/sizes/size_top', hint: 'свободный крой; обтягивающее и колючую шерсть — нет' },
  ],
  people: [
    { key: 'Родители', label: 'Родители: имена, дни рождения', icon: 'cheatsheet/people/ppl_parents', hint: 'мама Ира — 12 марта, любит пионы' },
    { key: 'Друзья', label: 'Близкие друзья: кто есть кто', icon: 'cheatsheet/people/ppl_friends', hint: 'Аня — со школы, Макс — тот, что с собакой' },
    { key: 'Коллеги', label: 'О ком рассказываю с работы', icon: 'cheatsheet/people/ppl_colleagues', hint: 'Лена — начальница, Дима вечно опаздывает' },
    { key: 'Другие', label: 'Кого ещё важно знать', icon: 'cheatsheet/sec_people', hint: 'бабушка, крестница, соседка, которая кормит кота' },
    { label: 'Чей день рождения не забыть', icon: 'cheatsheet/people/ppl_birthday', hint: 'брат — 3 июня, бабушка — 20 ноября' },
    { label: 'Знакомство с моими: что важно', icon: 'common/two_hearts', hint: 'маме — цветы, с папой про рыбалку, про политику — нет' },
    { label: 'О ком лучше не спрашивать', icon: 'common/cross_badge', hint: 'с братом сейчас не общаемся' },
  ],
  tastes: [
    { label: 'Что посмотреть вместе по видео', icon: 'watchlist/status_watching', hint: 'ужастики под одеялом, серию ситкома перед сном' },
    { label: 'Во что поиграть вдвоём онлайн', icon: 'cheatsheet/tastes/taste_games', hint: 'шахматы, кооператив на двоих, слова' },
    { label: 'Песня, которая про нас', icon: 'cheatsheet/tastes/taste_music', hint: 'та, что играла в машине в первую встречу' },
    { key: 'Фильмы', label: 'Фильмы, которые пересматриваю', icon: 'watchlist/movie', hint: 'комедии из нулевых, всё про космос' },
    { key: 'Сериалы', label: 'Сериалы: любимые и что сейчас', icon: 'watchlist/series', hint: 'любимый навсегда и что смотрю сейчас' },
    { key: 'Музыка', label: 'Что сейчас в наушниках', icon: 'cheatsheet/tastes/taste_music', hint: 'исполнители, плейлист, под что засыпаю' },
    { key: 'Книги', label: 'Книги, которые важны', icon: 'cheatsheet/tastes/taste_books', hint: 'что перечитываю и что читаю сейчас' },
    { key: 'Игры', label: 'Во что играю', icon: 'cheatsheet/tastes/taste_games', hint: 'на телефоне, на компьютере, настолки' },
    { key: 'Хобби', label: 'Чем люблю заниматься', icon: 'cheatsheet/tastes/taste_hobby', hint: 'рисую, хожу на скалодром, вяжу под подкасты' },
  ],
  dreams: [
    { key: 'Куда поехать', label: 'Куда поехать вдвоём', icon: 'cheatsheet/dreams/dream_travel', hint: 'Грузия весной, море хоть раз в год, когда-нибудь Исландия' },
    { label: 'Где хочется жить вместе', icon: 'shop/furniture/house', hint: 'город у моря, квартира с балконом и котом' },
    { label: 'Какими вижу нас через пять лет', icon: 'common/sparkle', hint: 'живём вместе, своя собака, путешествуем раз в сезон' },
    { key: 'Большие мечты', label: 'О чём мечтаю, но редко говорю', icon: 'cheatsheet/dreams/dream_big', hint: 'свой дом с садом, своё дело' },
    { key: 'Чему научиться', label: 'Чему хочу научиться', icon: 'cheatsheet/dreams/dream_learn', hint: 'водить машину, итальянский, гитара' },
  ],
  custom: [{ label: 'Заметки', icon: 'cheatsheet/sec_custom', hint: 'всё, что не влезло в другие разделы' }],
}

export const MEDCARD: CheatField[] = [
  { label: 'Аллергии', icon: 'cheatsheet/health/med_allergy', hint: 'пыльца, кошки, пенициллин' },
  { label: 'Нельзя есть', icon: 'cheatsheet/health/med_intolerance', hint: 'лактоза, орехи' },
  { label: 'Плохая реакция', icon: 'cheatsheet/health/med_bad_reaction', hint: 'на какие лекарства и что бывает' },
  { key: 'Постоянные', label: 'Принимаю постоянно', icon: 'cheatsheet/health/med_regular', hint: 'витамины, таблетки, которые пью каждый день' },
  { label: 'Хроническое', icon: 'cheatsheet/health/med_chronic', hint: 'гастрит, мигрени' },
  { label: 'Группа крови', icon: 'cheatsheet/health/med_blood', hint: 'II+' },
  { label: 'Врачи', icon: 'cheatsheet/health/med_doctors', hint: 'стоматолог: имя, клиника, телефон' },
  { label: 'Экстренный контакт', icon: 'cheatsheet/health/med_emergency', hint: 'кому звонить, если что: имя и телефон' },
  { label: 'Аптечка дома', icon: 'cheatsheet/health/home_kit', hint: 'что есть и где лежит' },
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

// Когда болит что-то телесное
export const SITUATION_FIELDS: CheatField[] = [
  { key: 'Что помогает', label: 'Что помогает', icon: 'cheatsheet/health/field_helps', hint: 'тёмная комната, тишина, крепкий чай' },
  { key: 'Что принимает', label: 'Что принимаю', icon: 'cheatsheet/health/field_meds', hint: 'название и как обычно пью — как советовал врач' },
  { key: 'Что принести', label: 'Что принести', icon: 'cheatsheet/health/field_bring', hint: 'грелку, плед, воду с лимоном' },
  { key: 'Заказать доставкой', label: 'Что заказать доставкой', icon: 'cheatsheet/health/field_delivery', hint: 'куриный бульон, имбирный чай, леденцы' },
  { key: 'Как быть рядом', label: 'Как быть рядом, даже издалека', icon: 'cheatsheet/health/near_alone', hint: 'созвониться и просто побыть вместе, писать раз в пару часов' },
  { key: 'Чего не делать', label: 'Чего не делать', icon: 'common/cross_badge', hint: 'не спрашивать каждые пять минут, как я' },
  { key: 'Когда к врачу', label: 'Когда пора к врачу', icon: 'cheatsheet/health/field_doctor', hint: 'если не проходит пару дней или становится хуже' },
]

// Когда плохо на душе — тут лекарства и «что принести» не к месту, нужны другие вопросы
export const FEEL_SITUATIONS = ['anxiety', 'burnout', 'sad', 'anger', 'overwhelmed']
export const FEEL_FIELDS: CheatField[] = [
  { label: 'Как это заметить', icon: 'calendar/mood/mood_meh', hint: 'отвечаю коротко, пропадаю, не сплю до ночи' },
  { key: 'Что помогает', label: 'Что помогает', icon: 'cheatsheet/health/field_helps', hint: 'прогулка, душ, поплакать под сериал' },
  { label: 'Что сказать', icon: 'common/speech_heart', hint: '«я рядом», «это пройдёт», «хочешь, просто послушаю»' },
  { key: 'Чего не делать', label: 'Чего не говорить и не делать', icon: 'common/cross_badge', hint: 'не говорить «успокойся», не давать советов сразу' },
  { key: 'Как быть рядом', label: 'Как быть рядом, даже издалека', icon: 'cheatsheet/health/near_alone', hint: 'созвон без слов, писать, даже если не отвечаю' },
  { key: 'Заказать доставкой', label: 'Что прислать или заказать', icon: 'cheatsheet/health/field_delivery', hint: 'вкусняшку из любимой кофейни, цветы без повода' },
  { key: 'Когда к врачу', label: 'Когда пора волноваться', icon: 'cheatsheet/health/field_doctor', hint: 'если так дольше пары недель — вместе найти психолога' },
]
// Вопросы для ситуации. Старые поля, где уже что-то написано, тоже показываем — чтобы ответ не пропал.
export const situationFields = (id: string, has: (key: string) => boolean): CheatField[] => {
  const base = FEEL_SITUATIONS.includes(id) ? FEEL_FIELDS : SITUATION_FIELDS
  const extra = [...SITUATION_FIELDS, ...FEEL_FIELDS].filter(f => !base.some(b => fieldKey(b) === fieldKey(f)) && has(`sit.${id}.${fieldKey(f)}`))
  return [...base, ...extra.filter((f, i) => extra.findIndex(x => fieldKey(x) === fieldKey(f)) === i)]
}
export const ALL_SITUATION_FIELDS = [...SITUATION_FIELDS, ...FEEL_FIELDS.filter(f => !SITUATION_FIELDS.some(s => fieldKey(s) === fieldKey(f)))]

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
