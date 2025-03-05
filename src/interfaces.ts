/**
 * Интерфейс для хранения настроек CrossOver
 */
export interface CrossOverPreferences {
  /** Развернута ли расширенная боковая панель представления Bottle */
  BottleViewSidebarAdvancedExpanded: boolean;

  /** Недавние элементы */
  RecentItems: any[]; // Можно уточнить тип элементов, если известно

  /** Развернута ли панель деталей в боковой панели представления Bottle */
  BottleViewSidebarDetailsExpanded: boolean;

  /** Координаты и размеры окна сохраненной навигационной панели */
  'NSWindow Frame NSNavPanelAutosaveName': string;

  /** Был ли CrossOver запущен ранее */
  SUHasLaunchedBefore: boolean;

  /** Сортировка таблицы завершения работы бутылки */
  'NSTableView Sort Ordering v2 BottleShutdownTable': Buffer;

  /** Отображать ли запрос на оценку */
  AskForRatings: boolean;

  /** Последний корневой каталог ОС */
  NSOSPLastRootDirectory: Buffer;

  /** Координаты и размеры окна регистрации демо */
  'NSWindow Frame DemoRegister': string;

  /** Последняя версия вспомогательной программы */
  LastHelperVersion: number;

  /** Развернута ли панель управления в боковой панели представления Bottle */
  BottleViewSidebarControlPanelsExpanded: boolean;

  /** Включены ли автоматические проверки обновлений */
  SUEnableAutomaticChecks: boolean;

  /** Последний использованный CXFBMenuPlist */
  MostRecentCXFBMenuPlist: Record<string, object>;

  /** Размер развернутой панели навигации в режиме открытия */
  NSNavPanelExpandedSizeForOpenMode: string;

  /** Координаты и размеры окна команды запуска */
  'NSWindow Frame RunCommand': string;

  /** Поддержка v2 таблицы завершения работы бутылки */
  'NSTableView Supports v2 BottleShutdownTable': boolean;

  /** Координаты и размеры окна завершения работы */
  'NSWindow Frame ShuttingDown': string;

  /** Дата первого запуска */
  FirstRunDate: Date;

  /** Разметка субвью для разделенной панели главного окна */
  'NSSplitView Subview Frames MainWindowSplit22': string[];

  /** Папка с бутылками */
  BottleDir: string;

  /** Сортировка таблицы опций установки */
  'NSTableView Sort Ordering v2 InstallOptions.ItemsToInstall': Buffer;

  /** Автоматическое обновление включено */
  SUAutomaticallyUpdate: boolean;

  /** Закладка папки программ */
  ProgramsFolderBookmark: Buffer;

  /** Координаты и размеры окна параметров установки */
  'NSWindow Frame InstallOptions': string;

  /** Координаты и размеры окна напоминания о демо-версии */
  'NSWindow Frame DemoNag': string;

  /** Карта соответствия типов документов и меню */
  DocTypeToMenuPathMap: Record<string, unknown>;

  /** Колонки таблицы завершения работы бутылки */
  'NSTableView Columns v3 BottleShutdownTable': Buffer;

  /** Развернута ли панель действий в боковой панели представления Bottle */
  BottleViewSidebarActionsExpanded: boolean;

  /** Поддержка v2 таблицы параметров установки */
  'NSTableView Supports v2 InstallOptions.ItemsToInstall': boolean;

  /** Разрешена ли отправка профиля пользователя */
  SUSendProfileInfo: boolean;

  /** Колонки таблицы параметров установки */
  'NSTableView Columns v3 InstallOptions.ItemsToInstall': Buffer;

  /** Координаты и размеры главного окна */
  'NSWindow Frame MainWindow': string;

  /** Скрытые идентификаторы лаунчеров */
  HiddenLauncherIDs: string[];

  /** Версия первого запуска */
  FirstRunVersion: string;
}

/** Данные от функции чтения plist файла по пути */
export interface ReadPListFileResult<FileReaded = Object> {
  /** Состояние ошибки при чтении plist файла */
  error: boolean;
  /** Результат чтения plist файла */
  resultRead: FileReaded | null;
  /** Информация о ошибке при чтении plist файла */
  errorData?: Error | null;
}

/** Результат записи plist файла по пути */
export interface WritePListFileResult {
  /** Успешно записано в plist файл по пути или нет */
  success: boolean;
  /** Информация о ошибке при записи plist файла */
  errorData?: Error | null;
}

/** Установочные константы скрипта */
export interface Consts {
  /** Наименование бутылки */
  nameBottle: string;
}
