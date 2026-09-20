import { CampaignMapData, CampaignMapNode, CampaignMapEdge } from '../../domain/types';

export class CampaignMapGenerator {
  public generateCampaignMap(
    title: string,
    setting: string,
    genre: string = 'fantasy',
    duration: 'short' | 'medium' | 'long' = 'medium'
  ): CampaignMapData {
    const normGenre = genre.toLowerCase();

    if (duration === 'short') {
      return this.generateShortMap(title, normGenre);
    } else if (duration === 'long') {
      return this.generateLongMap(title, normGenre);
    } else {
      return this.generateMediumMap(title, normGenre);
    }
  }

  private generateShortMap(title: string, genre: string): CampaignMapData {
    // 10 rounds target, 6 nodes
    const isCyber = /cyber|кибер/i.test(genre);
    const isMafia = /mafia|мафи/i.test(genre);
    const isScifi = /sci|космос/i.test(genre);
    const isHorror = /horror|хоррор|мистик/i.test(genre);

    let nodes: CampaignMapNode[];

    if (isCyber) {
      nodes = [
        { id: 'node_1', title: 'Неоновый переулок', description: 'Точка сбора отряда под кислотным дождём. Взлом шлюза нижнего уровня.', act: 1, type: 'start', status: 'current', x: 10, y: 50 },
        { id: 'node_2', title: 'Охранный КПП', description: 'Автоматические турели и кибер-дозорные синдиката.', act: 1, type: 'battle', status: 'discovered', x: 28, y: 35 },
        { id: 'node_3', title: 'Серверный узел', description: 'Зашифрованные терминалы и секретные схемы комплекса.', act: 2, type: 'mystery', status: 'locked', x: 48, y: 65 },
        { id: 'node_4', title: 'Вентиляционная шахта', description: 'Альтернативный обходной путь мимо сканеров биометрии.', act: 2, type: 'battle', status: 'locked', x: 66, y: 35 },
        { id: 'node_5', title: 'Кибер-убежище', description: 'Временный перерыв для перезарядки батарей и стимуляторов.', act: 3, type: 'rest', status: 'locked', x: 80, y: 50 },
        { id: 'node_6', title: 'Главное ИИ-Ядро', description: 'Финальная схватка с боевым роботом-хранителем и сброс протокола.', act: 3, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else if (isMafia) {
      nodes = [
        { id: 'node_1', title: 'Подпольный бар «Спикизи»', description: 'Дым сигар, джаз и получение наводки на склад конкурентов.', act: 1, type: 'start', status: 'current', x: 10, y: 50 },
        { id: 'node_2', title: 'Стрелка в доках', description: 'Засада боевиков с автоматами Томпсона у грузовых барж.', act: 1, type: 'battle', status: 'discovered', x: 28, y: 35 },
        { id: 'node_3', title: 'Контора ростовщика', description: 'Вскрытие сейфа с бухгалтерской книгой и компроматом.', act: 2, type: 'mystery', status: 'locked', x: 48, y: 65 },
        { id: 'node_4', title: 'Погоня по мосту', description: 'Бронированные седаны, стрельба на ходу и прорыв заграждения.', act: 2, type: 'battle', status: 'locked', x: 66, y: 35 },
        { id: 'node_5', title: 'Тайная квартира', description: 'Перевязка ран, распределение боеприпасов и подготовка штурма.', act: 3, type: 'rest', status: 'locked', x: 80, y: 50 },
        { id: 'node_6', title: 'Особняк Дона', description: 'Решающая перестрелка в мраморном холле и суд над синдикатом.', act: 3, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else if (isScifi) {
      nodes = [
        { id: 'node_1', title: 'Шлюзовая камера', description: 'Стыковка со дрейфующим заброшенным исследовательским судном.', act: 1, type: 'start', status: 'current', x: 10, y: 50 },
        { id: 'node_2', title: 'Грузовой ангар', description: 'Схватка с вышедшими из строя погрузочными дронами.', act: 1, type: 'battle', status: 'discovered', x: 28, y: 35 },
        { id: 'node_3', title: 'Био-лаборатория', description: 'Поиск бортовых журналов и образца неизвестного мутагена.', act: 2, type: 'mystery', status: 'locked', x: 48, y: 65 },
        { id: 'node_4', title: 'Реакторный отсек', description: 'Утечка плазмы и нападение мутировавших организмов.', act: 2, type: 'battle', status: 'locked', x: 66, y: 35 },
        { id: 'node_5', title: 'Медотсек корабля', description: 'Автоматическая капсула дезинфекции и пополнение запасов кислорода.', act: 3, type: 'rest', status: 'locked', x: 80, y: 50 },
        { id: 'node_6', title: 'Командный мостик', description: 'Уничтожение био-матери и активация автопилота спасения.', act: 3, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else if (isHorror) {
      nodes = [
        { id: 'node_1', title: 'Ворота поместья', description: 'Скрип ржавого железа, ледяной туман и зажжённые фонари.', act: 1, type: 'start', status: 'current', x: 10, y: 50 },
        { id: 'node_2', title: 'Заросший сад', description: 'Нападение обезумевших псов и колючих оживших лоз.', act: 1, type: 'battle', status: 'discovered', x: 28, y: 35 },
        { id: 'node_3', title: 'Библиотека оккультиста', description: 'Расшифровка гримуара и поиск защитного знака Древних.', act: 2, type: 'mystery', status: 'locked', x: 48, y: 65 },
        { id: 'node_4', title: 'Зеркальная галерея', description: 'Искажённые призраки прошлого пытаются утащить героев в зазеркалье.', act: 2, type: 'battle', status: 'locked', x: 66, y: 35 },
        { id: 'node_5', title: 'Освящённая часовня', description: 'Защитный круг мела и травяной отвар для восстановления рассудка.', act: 3, type: 'rest', status: 'locked', x: 80, y: 50 },
        { id: 'node_6', title: 'Алтарь в подземелье', description: 'Срыв жертвоприношения и битва с порождением Бездны.', act: 3, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else {
      // Fantasy default
      nodes = [
        { id: 'node_1', title: 'Вход в подземелье', description: 'Разрушенные каменные арки, покрытые мхом и древними рунами.', act: 1, type: 'start', status: 'current', x: 10, y: 50 },
        { id: 'node_2', title: 'Аванпост дозора', description: 'Засада гоблинов и сторожевых волков у сигнального костра.', act: 1, type: 'battle', status: 'discovered', x: 28, y: 35 },
        { id: 'node_3', title: 'Затопленный склеп', description: 'Поиск тайного рычага и древнего ключа в гробнице рыцаря.', act: 2, type: 'mystery', status: 'locked', x: 48, y: 65 },
        { id: 'node_4', title: 'Подвесной мост', description: 'Схватка с троллем на узких скрипучих канатах над пропастью.', act: 2, type: 'battle', status: 'locked', x: 66, y: 35 },
        { id: 'node_5', title: 'Тайный альков', description: 'Безопасная ниша у родника с целебной водой для краткого привала.', act: 3, type: 'rest', status: 'locked', x: 80, y: 50 },
        { id: 'node_6', title: 'Тронный зал Владыки', description: 'Финальная битва с вожаком темных сил и снятие проклятия.', act: 3, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    }

    const edges: CampaignMapEdge[] = [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_2', to: 'node_3' },
      { from: 'node_2', to: 'node_4' },
      { from: 'node_3', to: 'node_5' },
      { from: 'node_4', to: 'node_5' },
      { from: 'node_5', to: 'node_6' },
    ];

    return { nodes, edges, currentNodeId: 'node_1' };
  }

  private generateMediumMap(title: string, genre: string): CampaignMapData {
    // 16 rounds target, 9 nodes across 5 acts
    const isCyber = /cyber|кибер/i.test(genre);
    const isMafia = /mafia|мафи/i.test(genre);
    const isScifi = /sci|космос/i.test(genre);
    const isHorror = /horror|хоррор|мистик/i.test(genre);

    let nodes: CampaignMapNode[];

    if (isCyber) {
      nodes = [
        { id: 'node_1', title: 'Крыши Верхнего Города', description: 'Высадка с ави, сканирование периметра мегабашни.', act: 1, type: 'start', status: 'current', x: 8, y: 50 },
        { id: 'node_2', title: 'Линия лазерных датчиков', description: 'Обезвреживание охранных протоколов и кибер-дозорных.', act: 1, type: 'battle', status: 'discovered', x: 22, y: 30 },
        { id: 'node_3', title: 'Взлом терминала черного хода', description: 'Нетраннер подбирает шифр к шахте грузового лифта.', act: 1, type: 'mystery', status: 'discovered', x: 22, y: 70 },
        { id: 'node_4', title: 'Офисный сектор корпорации', description: 'Перестрелка с элитным спецназом среди стеклянных перегородок.', act: 2, type: 'battle', status: 'locked', x: 40, y: 35 },
        { id: 'node_5', title: 'Серверная комната R&D', description: 'Загрузка секретных файлов прототипа квантового чипа.', act: 3, type: 'mystery', status: 'locked', x: 45, y: 65 },
        { id: 'node_6', title: 'Технический этаж (Убежище)', description: 'Быстрый полевой ремонт киберимплантов и смена магазинов.', act: 3, type: 'rest', status: 'locked', x: 60, y: 50 },
        { id: 'node_7', title: 'Лаборатория киборгов', description: 'Битва с прототипом боевого экзоскелета «Цербер».', act: 4, type: 'battle', status: 'locked', x: 75, y: 35 },
        { id: 'node_8', title: 'Шахта главного лифта', description: 'Отражение волн дронов во время скоростного спуска.', act: 4, type: 'battle', status: 'locked', x: 75, y: 65 },
        { id: 'node_9', title: 'Главное Хранилище Данных', description: 'Финальная схватка с главой безопасности корпорации.', act: 5, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else if (isMafia) {
      nodes = [
        { id: 'node_1', title: 'Штаб семьи Моретти', description: 'Инструктаж от капореджиме за бокалом виски перед рейдом.', act: 1, type: 'start', status: 'current', x: 8, y: 50 },
        { id: 'node_2', title: 'Засада в Чайна-тауне', description: 'Перестрелка с людьми Сальери на узких улицах под фонарями.', act: 1, type: 'battle', status: 'discovered', x: 22, y: 30 },
        { id: 'node_3', title: 'Отель «Метрополь»', description: 'Подкуп портье и поиск номера предателя семьи.', act: 1, type: 'mystery', status: 'discovered', x: 22, y: 70 },
        { id: 'node_4', title: 'Склад контрабанды в порту', description: 'Штурм ангара с нелегальным спиртным и пулемётами.', act: 2, type: 'battle', status: 'locked', x: 40, y: 35 },
        { id: 'node_5', title: 'Бухгалтерия синдиката', description: 'Вскрытие тайного сейфа с долговыми расписками судей.', act: 3, type: 'mystery', status: 'locked', x: 45, y: 65 },
        { id: 'node_6', title: 'Загородная конспиративная дача', description: 'Отдых, зарядка дисковых магазинов Томпсона, план облавы.', act: 3, type: 'rest', status: 'locked', x: 60, y: 50 },
        { id: 'node_7', title: 'Блокада полицейского кордона', description: 'Прорыв через патрульные автомобили и коррумпированных копов.', act: 4, type: 'battle', status: 'locked', x: 75, y: 35 },
        { id: 'node_8', title: 'Винный погреб ресторана', description: 'Ближний бой на револьверах и ножах среди дубовых бочек.', act: 4, type: 'battle', status: 'locked', x: 75, y: 65 },
        { id: 'node_9', title: 'Пентхаус Крестного Отца', description: 'Финальное противостояние за контроль над всем городом.', act: 5, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else if (isScifi) {
      nodes = [
        { id: 'node_1', title: 'Орбитальная платформа', description: 'Спуск шаттла сквозь ионизированную атмосферу планеты.', act: 1, type: 'start', status: 'current', x: 8, y: 50 },
        { id: 'node_2', title: 'Периметр аванпоста', description: 'Столкновение с обезумевшими боевыми автоматонами.', act: 1, type: 'battle', status: 'discovered', x: 22, y: 30 },
        { id: 'node_3', title: 'Центр связи', description: 'Перехват зашифрованного сигнала бедствия и поиск ключа допуска.', act: 1, type: 'mystery', status: 'discovered', x: 22, y: 70 },
        { id: 'node_4', title: 'Крио-хранилище колонистов', description: 'Защита капсул от роя ксеноморфных паразитов.', act: 2, type: 'battle', status: 'locked', x: 40, y: 35 },
        { id: 'node_5', title: 'Лаборатория ксенобиологии', description: 'Изучение уязвимостей внеземного симбиота.', act: 3, type: 'mystery', status: 'locked', x: 45, y: 65 },
        { id: 'node_6', title: 'Герметичный отсек жизнеобеспечения', description: 'Смена фильтров скафандров и подзарядка энергоячеек.', act: 3, type: 'rest', status: 'locked', x: 60, y: 50 },
        { id: 'node_7', title: 'Генератор гравитационного поля', description: 'Бой в условиях нестабильной невесомости.', act: 4, type: 'battle', status: 'locked', x: 75, y: 35 },
        { id: 'node_8', title: 'Внешняя обшивка станции', description: 'Опасный выход в открытый космос под огнем турелей.', act: 4, type: 'battle', status: 'locked', x: 75, y: 65 },
        { id: 'node_9', title: 'Гипердвигатель и Матка Роя', description: 'Финальная битва и запуск двигателей на гиперпрыжок.', act: 5, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else if (isHorror) {
      nodes = [
        { id: 'node_1', title: 'Порог Проклятого Особняка', description: 'Захлопнувшиеся тяжелые двери, ледяной сквозняк и вой в стенах.', act: 1, type: 'start', status: 'current', x: 8, y: 50 },
        { id: 'node_2', title: 'Бальный зал теней', description: 'Атака фантомов и оживших доспехов под звуки клавесина.', act: 1, type: 'battle', status: 'discovered', x: 22, y: 30 },
        { id: 'node_3', title: 'Кабинет пропавшего лорда', description: 'Поиск дневника с формулой защитного ритуала.', act: 1, type: 'mystery', status: 'discovered', x: 22, y: 70 },
        { id: 'node_4', title: 'Зимний сад кошмаров', description: 'Хищные растения-людоеды и туман, вызывающий галлюцинации.', act: 2, type: 'battle', status: 'locked', x: 40, y: 35 },
        { id: 'node_5', title: 'Тайная комната зеркал', description: 'Разгадка шифра на стекле, открывающего путь в склепы.', act: 3, type: 'mystery', status: 'locked', x: 45, y: 65 },
        { id: 'node_6', title: 'Освященная ротонда', description: 'Привал у серебряного источника, восстановление самообладания.', act: 3, type: 'rest', status: 'locked', x: 60, y: 50 },
        { id: 'node_7', title: 'Катакомбы предков', description: 'Схватка со сворой упырей и скелетов-стражей.', act: 4, type: 'battle', status: 'locked', x: 75, y: 35 },
        { id: 'node_8', title: 'Лабиринт пыток', description: 'Преодоление смертоносных ловушек и освобождение пленников.', act: 4, type: 'mystery', status: 'locked', x: 75, y: 65 },
        { id: 'node_9', title: 'Черный Алтарь Безумия', description: 'Кульминационная битва с Древним Демоном склепа.', act: 5, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    } else {
      // Fantasy default
      nodes = [
        { id: 'node_1', title: 'Врата Древних Руин', description: 'Отряд переступает границу забытого подземного королевства.', act: 1, type: 'start', status: 'current', x: 8, y: 50 },
        { id: 'node_2', title: 'Авангард гоблинов-разбойников', description: 'Первая стычка у сторожевого костра в колонном зале.', act: 1, type: 'battle', status: 'discovered', x: 22, y: 30 },
        { id: 'node_3', title: 'Зал Забытых Фресок', description: 'Изучение древних барельефов и поиск потайного рычага.', act: 1, type: 'mystery', status: 'discovered', x: 22, y: 70 },
        { id: 'node_4', title: 'Подвесной мост через пропасть', description: 'Схватка с горными троллями над ревущей подземной рекой.', act: 2, type: 'battle', status: 'locked', x: 40, y: 35 },
        { id: 'node_5', title: 'Оружейная палата гномов', description: 'Вскрытие зачарованного сундука с древней экипировкой.', act: 3, type: 'mystery', status: 'locked', x: 45, y: 65 },
        { id: 'node_6', title: 'Привал у Лунного Родника', description: 'Краткий отдых, перевязка ран и восстановление сил.', act: 3, type: 'rest', status: 'locked', x: 60, y: 50 },
        { id: 'node_7', title: 'Гнездо пещерных виверн', description: 'Опасный прорыв сквозь скальные выступы под градом когтей.', act: 4, type: 'battle', status: 'locked', x: 75, y: 35 },
        { id: 'node_8', title: 'Магический барьер жрецов', description: 'Разрушение резонирующих кристаллов темного культа.', act: 4, type: 'mystery', status: 'locked', x: 75, y: 65 },
        { id: 'node_9', title: 'Тронный Зал Владыки Тьмы', description: 'Решающая эпическая битва за судьбу подземелья и сокровища.', act: 5, type: 'boss', status: 'locked', x: 92, y: 50 },
      ];
    }

    const edges: CampaignMapEdge[] = [
      { from: 'node_1', to: 'node_2' },
      { from: 'node_1', to: 'node_3' },
      { from: 'node_2', to: 'node_4' },
      { from: 'node_3', to: 'node_5' },
      { from: 'node_4', to: 'node_6' },
      { from: 'node_5', to: 'node_6' },
      { from: 'node_6', to: 'node_7' },
      { from: 'node_6', to: 'node_8' },
      { from: 'node_7', to: 'node_9' },
      { from: 'node_8', to: 'node_9' },
    ];

    return { nodes, edges, currentNodeId: 'node_1' };
  }

  private generateLongMap(title: string, genre: string): CampaignMapData {
    // 20+ rounds target, 13 nodes across 5 acts
    const base = this.generateMediumMap(title, genre);
    const extraNodes: CampaignMapNode[] = [
      { id: 'node_10', title: 'Забытые Катакомбы', description: 'Глубокие ярусы с древними ловушками и ценными артефактами.', act: 2, type: 'mystery', status: 'locked', x: 32, y: 50 },
      { id: 'node_11', title: 'Элитный Караул', description: 'Схватка с бронированными телохранителями главного антагониста.', act: 4, type: 'battle', status: 'locked', x: 84, y: 25 },
      { id: 'node_12', title: 'Святилище Скорби', description: 'Древний алтарь, требующий клятвы или жертвы ради великой силы.', act: 4, type: 'mystery', status: 'locked', x: 84, y: 75 },
      { id: 'node_13', title: 'Великая Кульминация', description: 'Эпический финал: многофазный бой и определение судьбы мира.', act: 5, type: 'climax', status: 'locked', x: 98, y: 50 },
    ];

    const allNodes = [...base.nodes, ...extraNodes];
    // Connect extra nodes
    const allEdges = [
      ...base.edges,
      { from: 'node_2', to: 'node_10' },
      { from: 'node_10', to: 'node_6' },
      { from: 'node_7', to: 'node_11' },
      { from: 'node_8', to: 'node_12' },
      { from: 'node_11', to: 'node_9' },
      { from: 'node_12', to: 'node_9' },
      { from: 'node_9', to: 'node_13' },
    ];

    return { nodes: allNodes, edges: allEdges, currentNodeId: 'node_1' };
  }

  public advanceCampaignMap(
    map: CampaignMapData,
    currentRound: number,
    duration: 'short' | 'medium' | 'long' = 'medium'
  ): CampaignMapData {
    if (!map || !Array.isArray(map.nodes) || map.nodes.length === 0) {
      return map;
    }

    const totalRounds = duration === 'short' ? 10 : duration === 'long' ? 20 : 16;
    // Map progression step
    const nodeCount = map.nodes.length;
    // Calculate targeted node index based on round progress
    const rawProgress = Math.min(1, Math.max(0, (currentRound - 1) / (totalRounds - 1)));
    const targetNodeIndex = Math.min(nodeCount - 1, Math.floor(rawProgress * nodeCount));

    const currentNode = map.nodes[targetNodeIndex] || map.nodes[0];
    const currentNodeId = currentNode.id;

    // Update node statuses
    const updatedNodes = map.nodes.map((node, idx) => {
      if (idx < targetNodeIndex) {
        return { ...node, status: 'visited' as const };
      } else if (idx === targetNodeIndex) {
        return { ...node, status: 'current' as const };
      } else if (idx === targetNodeIndex + 1) {
        return { ...node, status: 'discovered' as const };
      } else {
        // Also check if reachable directly via an edge from current node
        const isDirectChild = map.edges?.some(e => e.from === currentNodeId && e.to === node.id);
        if (isDirectChild) {
          return { ...node, status: 'discovered' as const };
        }
        return { ...node, status: (node.status === 'visited' ? 'visited' : 'locked') as any };
      }
    });

    return {
      nodes: updatedNodes,
      edges: map.edges || [],
      currentNodeId,
    };
  }
}

export const campaignMapGenerator = new CampaignMapGenerator();
