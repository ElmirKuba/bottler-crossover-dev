import bplist from 'bplist-parser';
import lodash from 'lodash'; // Используем default import
import fs from 'fs';
import os from 'os';
import {
  Consts,
  CreateBottleResult,
  CrossOverPreferences,
  ReadPListFileResult,
  WritePListFileResult,
} from './interfaces.js';
import bplistCreator from 'bplist-creator';
import path from 'path';
import { exec, execSync } from 'child_process';

/** Константы */
const CONSTS: Consts = {
  nameBottle: 'sampizm_idiotizm_tupizm',
  template: 'win7',
  description: 'Windows7_32_samp',
};

const { cloneDeep } = lodash;

/** Узнать вчерашнюю дату */
function getYesterdayDate(): Date {
  /** Сегодняшняя дата */
  const today = new Date();
  /** Переменная для вчерашней даты */
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
}

/** Прочитать plist файл */
const readPListFile = async <FileReaded>(
  filePath: string
): Promise<ReadPListFileResult<FileReaded>> => {
  try {
    /** Результат парсинга Apple Binary Property List данных в виде JavaScript объекта */
    const resultRead = await new Promise<FileReaded>((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        reject(new Error('Файл не существует: ' + filePath));
        return;
      }

      bplist.parseFile<FileReaded>(filePath, (err, obj) => {
        if (err) {
          reject(new Error('Error reading binary plist: ' + err));
          return;
        }

        /** Результат глубого копирования объекта нулевого элемента массива */
        const cloneCrossOverPreferences = cloneDeep(obj[0]);

        resolve(cloneCrossOverPreferences);
      });
    });

    return {
      error: false,
      resultRead,
    };
  } catch (error) {
    return {
      error: true,
      resultRead: null,
      errorData: error as Error,
    };
  }
};

/** Записать данные в plist файл */
const writePListFile = <FileWrite>(
  filePath: string,
  data: FileWrite
): WritePListFileResult => {
  try {
    /** Парсим JavaScript объект в Apple Binary Property List */
    const bplist = bplistCreator([data]);

    fs.writeFileSync(filePath, bplist);

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      errorData: error as Error,
    };
  }
};

/** Удаляет блок по названию из файла реестра Windows внутри бутылки Crossover */
const removeRegistryBlock = (filePath: string, blockHeader: string) => {
  /** Прочитанный файл */
  const content = fs.readFileSync(filePath, 'utf8');
  // /** Разбили на массив строк */
  const lines = content.split('\n');

  let startIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith(`[${blockHeader}]`)) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    console.error(`Блок [${blockHeader}] не найден.`);
    return;
  }

  for (let i = startIndex + 1; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (trimmedLine === '' || trimmedLine.startsWith('[')) {
      endIndex = i;
      break;
    }
  }

  // endIndex++;

  if (endIndex === -1) {
    endIndex = lines.length;
  }

  lines.splice(startIndex, endIndex - startIndex);

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

  console.log(`Блок [${blockHeader}] успешно удалён.`);
};

/** Проверяет корректность бутылки для CrossOver */
const isBottleValid = (bottleDir: string, bottleName: string): boolean => {
  /** Путь до бутылки */
  const bottlePath = path.join(bottleDir, bottleName);
  if (!fs.existsSync(bottlePath) || !fs.lstatSync(bottlePath).isDirectory()) {
    console.error(
      `Бутылка ${bottlePath} не существует или не является директорией.`
    );
    return false;
  }

  /** Путь до файла системного редактора реестра */
  const systemRegPath = path.join(bottlePath, 'system.reg');
  if (!fs.existsSync(systemRegPath) || !fs.lstatSync(systemRegPath).isFile()) {
    console.error(`Файл system.reg не найден по пути ${systemRegPath}`);
    return false;
  }

  /** Путь до диска C */
  const driveCPath = path.join(bottlePath, 'drive_c');
  if (!fs.existsSync(driveCPath) || !fs.lstatSync(driveCPath).isDirectory()) {
    console.error(`Директория drive_c не найдена по пути ${driveCPath}`);
    return false;
  }
  /** Путь до папки с Windows */
  const windowsPath = path.join(driveCPath, 'windows');
  if (!fs.existsSync(windowsPath) || !fs.lstatSync(windowsPath).isDirectory()) {
    console.error(`Директория windows не найдена в ${driveCPath}`);
    return false;
  }

  /** Вариант пути до DosDevices */
  const dosDevicesPath = path.join(bottlePath, 'DosDevices');
  /** Вариант пути до dosdevices */
  const dosDevicesPathLower = path.join(bottlePath, 'dosdevices');
  if (
    !(
      (fs.existsSync(dosDevicesPath) &&
        fs.lstatSync(dosDevicesPath).isDirectory()) ||
      (fs.existsSync(dosDevicesPathLower) &&
        fs.lstatSync(dosDevicesPathLower).isDirectory())
    )
  ) {
    console.error(
      `Директория DosDevices (или dosdevices) не найдена в ${bottlePath}`
    );
    return false;
  }

  /** Вариант пути до cxbottle */
  const configFile = path.join(bottlePath, 'cxbottle.conf');
  if (!fs.existsSync(configFile) || !fs.statSync(configFile).isFile()) {
    console.error(`Отсутствует конфигурационный файл: ${configFile}`);
    return false;
  }

  try {
    /** Команда для проверки статуса бутылки через службу Crossover */
    const statusCommand = `/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\\ Application/cxbottle --status --bottle "${bottleName}"`;
    /** Результат выполнения команды проверки статуса через службу Crossover */
    const statusOutput = execSync(statusCommand).toString().trim();
    /** Статус наличия в ответе положительного для нас результата */
    const uptodateStatusBottle = statusOutput.includes('Status=uptodate');

    if (!uptodateStatusBottle) {
      console.error(
        `Статус бутылки ${bottleName} не является актуальным. Статус: ${statusOutput}`
      );
      return false;
    }
  } catch (error) {
    console.error(
      `Ошибка при выполнении команды для проверки статуса бутылки: ${
        (error as Error).message
      }`
    );
    return false;
  }

  return true;
};

/** Создает бутылку */
const createBottle = async (
  bottleDir: string,
  bottleName: string,
  template: string,
  description: string = ''
): Promise<CreateBottleResult> => {
  /** Путь до бутылки */
  const bottlePath = path.join(bottleDir, bottleName);

  if (fs.existsSync(bottlePath)) {
    console.log(
      `Бутылка ${bottleName} уже существует, потому что путь не свободен!`
    );
    return {
      error: true,
      resultCreatedBottle: null,
      errorData: null,
    };
  }

  /** Команда для создания бутылки через службу Crossover */
  const createCommand = `/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\\ Application/cxbottle --create --bottle "${bottleName}" --description "${description}" --template "${template}"`;

  try {
    /** Результат создания бутылки */
    const resultCreatedBottle = await new Promise<string[]>(
      (resolve, reject) => {
        exec(createCommand, (error, stdout, stderr) => {
          if (error) {
            // Реальная ошибка, если процесс завершился с ненулевым кодом выхода
            reject(new Error(`Ошибка при создании бутылки: ${error.message}`));
            return;
          }

          // Логируем stderr как информационный вывод, а не ошибку
          if (stderr) {
            console.log(`Информационный вывод: ${stderr}`);
          }

          const successMessage: string[] = [`Бутылка создана`, stdout];

          if (fs.existsSync(bottlePath)) {
            successMessage.push(`Директория бутылки создана: ${bottlePath}`);
          } else {
            reject(new Error(`Директория бутылки не найдена после создания.`));
            return;
          }

          resolve(successMessage);
        });
      }
    );

    return {
      error: false,
      resultCreatedBottle,
    };
  } catch (error) {
    return {
      error: true,
      resultCreatedBottle: null,
      errorData: error as Error,
    };
  }
};

/** Главная функция */
const main = async (): Promise<void> => {
  console.log(
    '____________________________________________________________________________________________________'
  );

  console.log('Установочные константы скрипта:', CONSTS);

  /** Путь к домашней дирректории MacOS */
  const homeDir = os.homedir();
  /** Наименование домашней дирректории MacOS */
  const userFolder = homeDir.split('/').pop();
  /** Путь к файлу конфигурации CrossOver */
  const filePath = `/Users/${userFolder}/Library/Preferences/com.codeweavers.CrossOver.plist`;

  /** Результаты прочитанного plist файла */
  const pListFileReaded = await readPListFile<CrossOverPreferences>(filePath);

  /** Путь до бутылок */
  const bottleDir = pListFileReaded.resultRead!.BottleDir;

  if (pListFileReaded.error) {
    console.error(
      'Файл не был прочитан, работа скрипта остановлена преждевременно!'
    );
    console.error(pListFileReaded);
    return;
  }

  console.log('Файл прочитан успешно');

  /** Вчерашняя дата */
  const yesterdaysDate = getYesterdayDate();

  /** Модифицированные данные plist файла */
  const modifiedCrossOverPreferences: CrossOverPreferences = {
    ...(pListFileReaded.resultRead as CrossOverPreferences),
    FirstRunDate: yesterdaysDate,
    SUEnableAutomaticChecks: false,
  };

  /** Результаты записанного plist файла */
  const pListFileWrited = writePListFile<CrossOverPreferences>(
    filePath,
    modifiedCrossOverPreferences
  );

  if (!pListFileWrited.success) {
    console.error(
      'Файл не был записан, работа скрипта остановлена преждевременно!'
    );
    console.error(pListFileReaded);
    return;
  }

  console.log('Файл записан успешно');

  /** Статус корректности бутылки */
  const validStatusBottle = isBottleValid(bottleDir, CONSTS.nameBottle);

  if (!validStatusBottle) {
    console.error(`Бутылка ${CONSTS.nameBottle} некорректна или повреждена.`);

    const createdBottleResult = await createBottle(
      bottleDir,
      CONSTS.nameBottle,
      CONSTS.template,
      CONSTS.description
    );

    if (createdBottleResult.error) {
      console.error('Бутылка не была создана!');
      console.error(createdBottleResult);
    }

    console.error('Бутылка создана!');
    console.log(createdBottleResult.resultCreatedBottle);
    return;
  }

  console.log(`Бутылка корректна: "${CONSTS.nameBottle}"!`);

  removeRegistryBlock(
    `${bottleDir}/${CONSTS.nameBottle}/system.reg`,
    'Software\\\\CodeWeavers\\\\CrossOver\\\\cxoffice'
  );

  console.log(
    '____________________________________________________________________________________________________'
  );
};

main();

/**
 *
 * /Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\ Application/cxbottle --create --bottle "sampizm_idiotizm_tupizm" --description "Windows7_32_samp" --template "win7"
 * ! создает бутылку
 *
 * /Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\ Application/cxbottle --status --bottle "sampizm_idiotizm_tupizm"
 * ! проверка статуса бутылки
 *
 */
