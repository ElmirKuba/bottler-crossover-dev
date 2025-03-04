import bplist from 'bplist-parser';
import lodash from 'lodash'; // Используем default import
import fs from 'fs';
import os from 'os';
import {
  CrossOverPreferences,
  ReadPListFileResult,
  WritePListFileResult,
} from './interfaces.js';
import bplistCreator from 'bplist-creator';

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

/** Главная функция */
const main = async (): Promise<void> => {
  console.log(
    '____________________________________________________________________________________________________'
  );

  /** Путь к домашней дирректории MacOS */
  const homeDir = os.homedir();
  /** Наименование домашней дирректории MacOS */
  const userFolder = homeDir.split('/').pop();
  /** Путь к файлу конфигурации CrossOver */
  const filePath = `/Users/${userFolder}/Library/Preferences/com.codeweavers.CrossOver.plist`;

  /** Результаты прочитанного plist файла */
  const pListFileReaded = await readPListFile<CrossOverPreferences>(filePath);

  if (pListFileReaded.error) {
    console.error(
      'Файл не был прочитан, работа скрипта остановлена преждевременно!'
    );
    console.error(pListFileReaded);
    return;
  }

  /** Вчерашняя дата */
  const yesterdaysDate = getYesterdayDate();

  /** Модифицированные данные plist файла */
  const modifiedCrossOverPreferences: CrossOverPreferences = {
    ...(pListFileReaded.resultRead as CrossOverPreferences),
    FirstRunDate: yesterdaysDate,
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

  console.log(
    '____________________________________________________________________________________________________'
  );
};

main();
