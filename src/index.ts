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

  // ${bottleDir}/${CONSTS.nameBottle}/user.reg

  console.log(
    '____________________________________________________________________________________________________'
  );
};

main();

/**
 *
 * /Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\ Application/cxbottle --create --bottle "НАЗВАНИЕ БУТЫЛКИ В КАВЫЧКАХ" --description "Windows7_32_samp" --template "win7"
 * ! создает бутылку
 *
 * /Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\ Application/cxbottle --status --bottle "НАЗВАНИЕ БУТЫЛКИ В КАВЫЧКАХ"
 * ! проверка статуса бутылки
 *
 * HKEY_CURRENT_USER\Software\SAMP (Software\\SAMP)
 * ! Тут самп хранит настройки:
 * [Software\\SAMP] 1741192462
 * #time=1db8dec732d7024
 * "ClientID"="SMJahratI2IkFOF"
 * "gta_sa_exe"="C:\\SAMP\\gta_sa.exe"
 * "PlayerName"="YourNickName"
 *
 * https://gitflic.ru/project/elmirweb/samp-files-launcher-learn - репозиторий с файлами гта са
 */

/**
 * файлы гта самп:

➜  SAMP find . -type f -exec sh -c 'echo "{} $(stat -f "%z" "{}") $(shasum "{}" | cut -d" " -f1)"' \;

./vorbisHooked.dll 65536 905d33aa70ad00d513c701cce22ad6fdb9d7d463
./anim/cuts.img 270096384 7b6e93200bbd3d836993fa3b9b6dca78ab7e7e4a
./anim/anim.img 10942464 1449d14a6e0e5a5af099bd084de51fb9fe4e7efa
./anim/ped.ifp 1433248 05e72e4fe28a202989bbd96d80a0f3c8f5513749
./menupatch.asi 2048 c526305c3397b9f68d97faf69afdf5fa517debce
./rcon.exe 36864 ac682119ac4dc51d8db82fd4a6a0e1f108b74a94
./SAMPFUNCS/GameExitFix.sf 7168 3186021e66e83565c3dd36f9206f0da5db23f424
./SAMPFUNCS/SAMPFUNCS.log 3206 1a9797cbc6a7b452dbacbb043cf2c1afaefceb7e
./SAMPFUNCS/sampfuncs-settings.ini 338 afb3d619375cd0329e6712a783a18925c6e64c05
./Redist/dxwebsetup.exe 292184 3c8243734cf43dd7bb2332ba05b58ccacfa4377c
./Redist/VCRHyb64bit.exe 44467132 985979f09c7dc3a1242b85f3c6028584e54eda5b
./Redist/README.txt 239 dbe25e0ac06a8b253c4d71bb0a72de18417f038d
./Redist/VCRHyb32bit.exe 26012348 1b6239628078e719112f78c5a6b301f7287ac4f5
./MoonLoader.asi 2076672 03a86ab537d3925701f0f071b0186f12b25fc1b1
./unins000.exe 1364599 1636e2a48896391e6263396770b9a48c38bd3c52
./GZFlashingFix by alferov.asi 19968 f616f4849866f2adf1a614dfcb4d702a106e01aa
./gtaweap3.ttf 103552 1fffd7004263d6bc2efc055281a083905f042a18
./resetRemove.asi 7168 a9c6203d8be8b8f225e17049679a413f72e08a74
./plugins/MiTurboFix.asi 1398560 ed4325a3d05cf77eec01528805b04600b41b6482
./plugins/global.ini 167 00b66f299e3c06627dc2436a118738a7b43b7565
./vorbisFile.dll 53760 e4fb5e60b70cb62ebeb98f40c22a708c45228a00
./crashes.cfg 195 25d74a5f723ae8c1c4d89d790bfc4d970f18ef3a
./bass.dll 124060 da41b5f405c6dcaa0730cc86363d09262f8741c8
./CLEO.asi 334848 a1de63b4e565d37c85960a276768061dc8bc4138
./sampgui.png 14091 3e1e1c6ffbfb092631fdb955e931da92a13d2589
./lua51.dll 606208 583cdab08519d99f49234965ffd07688ccf52c56
./cleo.log 2160 f1b5c41e26d475eb32f5e3c150a0e6c1b8518638
./models/player.img 66738176 b7bba3c2300f1f83a73118256e8f5e9315617155
./models/particle.txd 650536 e95aa7bf5f709fcb214faf010b70fdd55665ccf9
./models/gta3.img 960462848 a9f9efb6644ccc3916312bc5f169b4cf0e21c59d
./models/gta_int.img 150024192 cc09131d9a7e8eb41ef6d080119a3c53708e1ef8
./models/fronten2.txd 3933224 06f92d83008686426099d59137208395501d915d
./models/fronten3.txd 9512 a3ae50d7a0faacfe7bc144fcb421e1ccbff0c06c
./models/effects.fxp 616708 e1d4d7e8b39f795dbf78ca935548acbf3c5a015f
./models/fronten1.txd 108200 3356ac2bad0f8664093da775ee3f78afaf41ac53
./models/misc.txd 23976 8cc31d33a9b549923165220f854ee0e38e5b357a
./models/fronten_pc.txd 2344 30ea28f9250ed2b766edb056a0a90ac982c64904
./models/cutscene.img 26947584 2cc14a7307feb2453e3219f8073cf991d7806ce2
./models/fonts.txd 2097448 33eaef239d5cf923a5a42725a4a1db7ea501138a
./models/grass/plant1.txd 42152 e20f25e74f3ce806a19079811ae1f64decdbd117
./models/grass/grass2_2.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass0_1.dff 1596 667615c5946c8d76d3a8944c6152a6536d727fc9
./models/grass/grass2_3.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass2_1.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass0_3.dff 1600 35d16703045e7d0898c0aad5a99ee539205e0cc8
./models/grass/grass0_2.dff 1596 302168932aceedc390ebb8d5ab10251764aa91ad
./models/grass/grass2_4.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass0_4.dff 1601 5dd8e6f548a0428528b2da02776e1dad34be7746
./models/grass/grass1_3.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass3_1.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/plant1.dff 2072 8201958100a3ca77b80231ee65a130268cd1398c
./models/grass/grass1_2.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass3_2.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass3_3.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass1_1.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass1_4.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/grass/grass3_4.dff 1981 9efc70003517fb180d4341125c382f826598353b
./models/coll/peds.col 21477 641b3aa612f31d274a49074cf376d2ceef13ce4f
./models/coll/weapons.col 560 8568baa74c4683f84689c4fee1e4b7240edca6c9
./models/coll/vehicles.col 1096 006fcdca86ffdea15478c1a52aeb908fff19115c
./models/effectsPC.txd 407080 49ee57befc2d236a1cfa3377446095f4faac137a
./models/txd/LD_RCE4.txd 197416 d189d2c87f1656deae9949b106728c333d48b9f8
./models/txd/LD_CARD.txd 441000 4764de7c392ab837995e277727f3bc27dfa657e4
./models/txd/LD_RCE5.txd 32936 edd1f4af340a2f9e428747e8b4a0f8cfc9890117
./models/txd/LD_RCE2.txd 197416 b63d72a2590e8297e61a69dfedb8393786bf0bf0
./models/txd/LD_RCE3.txd 197416 b45b1d8eed068410d2b6e567d79a1340b4bb820c
./models/txd/load0uk.txd 131240 05eaa24524cdd4459673ebe4667147e7bfe20805
./models/txd/LD_RCE1.txd 197416 1ce12777f3b9428e332fc0a19cccd6d1296d9a51
./models/txd/LD_POKE.txd 480936 d54af216186744e322bdfc248fddec77882e6a81
./models/txd/INTRO3.TXD 131240 d954d85af26e1ddc94176798bab50f36de352154
./models/txd/LOADSUK.txd 1968040 c407dbdb0285ac29051960926417e099dc279720
./models/txd/loadsc13.txd 131240 0d19461c33da8463cc253cb881317674ec9b62be
./models/txd/loadsc0.txd 131240 ac57022fd8426d58843ab95e70333098d6f24f10
./models/txd/splash2.txd 65704 d528969940ab600344e65292924a2acade9c4109
./models/txd/splash3.txd 40 587c09ccfd83dd6f2284c0bc7d95d42ea1ad7a81
./models/txd/loadsc1.txd 131240 326c9b1b6e7d07b884917bac658437927ffb795a

./models/txd/LD_OTB2.txd 198056 28ba8f3ea8f06876993ae7e127df2fd4a9a6143b
./models/txd/loadsc12.txd 131240 f936b49a40161c046ce026d6d01d2b961f205983
./models/txd/intro2.txd 131240 f521c135f9aa1e65d6ba799187600a486f944e3d
./models/txd/loadsc10.txd 131240 860d2df202f1286a0c7d1970cc33f4c64bddfd54
./models/txd/loadsc3.txd 131240 3592e430152ed12ac0ba3a638716fb167bf689ea
./models/txd/splash1.txd 65704 eb437cfdc4f234376dc2e9523e6f5e440e796ac8
./models/txd/LOADSCS.txd 4065704 f2bf42b7d151f2f427465279da2e0ea1831ed086
./models/txd/loadsc2.txd 131240 432e1ba24ac2d28702ba800a24de90c25d1ab084
./models/txd/loadsc11.txd 131240 6118ac827f1517eda46a9ebc0ea69079622dce52
./models/txd/intro1.txd 131240 f4cb45c53daefd351086462e94bfb9df480ca20e
./models/txd/LD_POOL.txd 9000 44a043d822168e12b918b12b017b187a16d2ea31
./models/txd/loadsc6.txd 131240 b433a3ff5afe63964460e88aea7039dfb2993e61
./models/txd/LD_RACE.txd 427688 9c0572343a427a0e841b902e8c3947c0e3be7a5d
./models/txd/LD_SLOT.txd 13096 1934de4ebc6e2bb0eb4fd0a36ecd24f54b61815d
./models/txd/loadsc7.txd 131240 cfae534cd59d526bf8f046d27c3699b196684ff8
./models/txd/loadsc14.txd 131240 5e492a372ce351b2b06e03949b068cc01f37b496
./models/txd/intro4.txd 131240 76652550bfbc64c2d4ecb0b6dbdb713dddd0648f
./models/txd/loadsc5.txd 131240 4c4ccace566883207a9b6faaae9fb825d8809b01
./models/txd/loadsc4.txd 131240 6071e58be60635d3a22c2b239b58e0eaeb97dea9
./models/txd/LD_DRV.txd 258096 5feff536bae21be3bf748b966a6dd4028c3ff08a
./models/txd/loadsc9.txd 131240 7ef7b3ac56c4621b1c9dd9d71f700e6992275f5c
./models/txd/loadsc8.txd 131240 537ed933fc578eeb67fa89d82e029fa5c2c63956
./models/txd/ld_shtr.txd 683048 8401af44d1018c1b0aaa180eb41d0727a57fb5a3
./models/txd/outro.txd 263336 01b5ad4c6cb73e6ff1e3e09e1a75a1d941de8b5e
./models/txd/LD_OTB.txd 998584 6d1bbffb8b2ccb13ac90bfe9e5f3bffe80c70252
./models/txd/LD_ROUL.txd 6568 fdb8bbd7de61b76752870484dcb59563250b0ed7
./models/txd/ld_grav.txd 667944 b0e159628ca7cbbb98b5b0d3ecc5a93804c179e7
./models/txd/LD_BUM.txd 16816 4cf38cf0d7f363b36693176b9a47d255a79d6fb0
./models/txd/LD_NONE.txd 113864 78aa52ed4ddcd1d2562245a7ec1fc2fb9cf6962d
./models/txd/LD_SPAC.txd 186312 d459039c9d3b74a041063d0733938850b5f2a54b
./models/txd/LD_BEAT.txd 22312 c347c312a37ac6f2620922f2bdc1215c1b6924f1
./models/txd/LD_TATT.txd 104488 bc64dc013314941677c754e4d79722595e927813
./models/txd/LD_DUAL.txd 186312 95f767e839ce9ed2e327e9324dc9b2a926327575
./models/txd/LD_CHAT.txd 5928 4f516735e283b0671425768bb6139f20eff53a1b
./models/txd/LD_PLAN.txd 84528 3fffa75b8cadcb5b4f77cc6f70da2a23d4676461
./models/generic/arrow.DFF 4849 918bc77a28110171eac462df96ca10c7666d302b
./models/generic/wheels.txd 23976 cbd83671770ae10b91dc09e646aaeb93a84d7651
./models/generic/vehicle.txd 1360296 2f1695b97a86d4319f094375dc1186aedac78fce
./models/generic/zonecylb.DFF 2260 d06b511804f1271346b74de5332972ac9b6cb45b
./models/generic/air_vlo.DFF 7100 3900f4aad21c002b6580f489a1a50684636034d1
./models/generic/wheels.DFF 129843 1f4ef93cf1d6c078c62cf4b3507370ce6b1793ed
./models/generic/hoop.dff 3701 eadb8a296a370aa7e4ee5da989112782170e8a34
./models/hud.txd 215208 880666b550e61cf1127fa7ebbdac5d8f3a9bfc92
./models/pcbtns.txd 4648 b29182a6cbe49ca2f41c8ab2fe0cdffd4e4199ee
./samp_debug.exe 147456 5a307b11eedf77749de2601318be6c2fff1fde12
./ASI Loader ReadMe.txt 2885 8fede05f6ed3315a9dbf8b1f011c564c994b2ccc
./MiTurboFix.asi 1398568 883c03099682b443e3ea8cc8e22b90852f40f811
./eax.dll 188416 b5f626330520a970d10ece04fed62552d5ac7ffd
./SilentPatchSA.asi 282624 586b5bc7d28385897ac27e182ec6383088bbc47c
./mouse.png 784 9d5ac6f6c4710738699d437938524641d3fcfa93
./samp.exe 527888 90daa7390ff389069901a77298a779dc49b4dd4f
./audio/CONFIG/StrmPaks.dat 272 ae27e333f8ef994a7afd64d1cb5a815ddbd4b786
./audio/CONFIG/PakFiles.dat 468 406f63036e4243ccc3e7d1ba5efc41d800ffc7b8
./audio/CONFIG/TrakLkup.dat 23064 88ad98ea4a1c92a1da8f686bd1fb76fc80fdee5b
./audio/CONFIG/AudioEventHistory.txt 114056 cd4886a0d85f11d4fae47c8e6c6d746ce51d1c84
./audio/CONFIG/BankLkup.dat 1836 465b886f50ffc42193a2852cc9367a5b5adc2113
./audio/CONFIG/EventVol.dat 45402 3bc1f72d40325ce4922e51d122a9442f40e38f50
./audio/CONFIG/BankSlot.dat 216902 ba1ab2f58bc2406c5e4a5d064e1838aa72d3b314
./audio/streams/MH 1754080 87e05ff47a783559c70c4b8564f056846727f6dd
./audio/streams/HC 1327100 19f2aa2fc68a66acc965edbb28b404be5e70b66b
./audio/streams/MR 1696380 5c10c32e5e62d662322e279b9a4d046f9b507237
./audio/streams/DS 2065660 cf27302c880ad9a16bed4af34bc25fe8c1bc16b7
./audio/streams/CR 1800240 304287531791524ea6eec6b80c86059aa7edbcf9
./audio/streams/CH 1500200 3fe99bd5cc662ed8f2977cfdb82ce522c8c456cf
./audio/streams/CO 1788700 4b733619c325965813679da578c175e8e56b089d
./audio/streams/TK 1165540 60ec5d87c307340fbef2b189b60abf48c2e0a367
./audio/streams/ADVERTS 796260 94c3162b8c52e3d3acf84436314b579779d5d662
./audio/streams/RG 1961800 277e27311328edaebfae073496f58b69ea641921
./audio/streams/BEATS 30454668 76b181730b7d90c1b9518a86147c782811d1f443
./audio/streams/NJ 1500200 3fe99bd5cc662ed8f2977cfdb82ce522c8c456cf
./audio/streams/AA 761640 c12d0b46e8d3cc5d63dc1651c56a3555d5bfaeab
./audio/streams/AMBIENCE 46514719 4cfeadca298c10ae58a805e1dc78410183d0ec68
./audio/streams/CUTSCENE 1734018 63de5a7f2311199a2ed544d762bcffb920d2eb3c
./audio/streams/RE 1857940 25e5183db1c3e518836f973b348c6487dca339c5
./audio/SFX/SPC_GA 2078274 770255f513b161681fc83ae3e37c70a2fed55cac
./audio/SFX/FEET 354020 d4291cc70338dd08706634f133bc11605c1f9d71
./audio/SFX/SPC_NA 12191242 57c0f4bac2b5394695adfd177498f8f5b22c67eb
./audio/SFX/SCRIPT 2283522 16788738928cff7e6750e4047cf2ba9ef5ccdc36
./audio/SFX/GENRL 23283516 c130f851942ae3836592a14c4fec6871418e92be
./audio/SFX/SPC_PA 4636020 f3304b45a3507175dabff7081b86d2e6b6372d73
./audio/SFX/PAIN_A 6704240 fe012eb06efcd500bb579f8ce4655e679981be76
./audio/SFX/SPC_EA 893604 7c57c17a525c600f6c189968d9d5e4a6391186d4
./audio/SFX/SPC_FA 13748712 7a592f16206501985b200c847096c27d27237ca7
./stream.ini 197 0a4c510cfec4b929c205b9914e4c0b8b1c82eb4e
./scripts/global.ini 154 e72dff9c74baf115e522cc148ddd17335ffc263f
./SilentPatchSA.ini 2783 8b422023354bea54d008b2239b371f657447109d
./movies/GTAtitles.mpg 21577541 4b89d23a14d13494b6f083f70bfb7115d4055376
./movies/Logo.mpg 1822720 f7d86cfc4bfc4a489a36a7451218544cee885ebf
./movies/GTAtitles.srt 4034 ac94c7bcd53e86c0aca892c5d2502e847a35c8dc
./unins000.dat 52771 19c3f59500a12cc7556f5044ab4e8e30d3c0b95d
./crashes.asi 285696 07b7daa7ec14372bf95f9a032d1ac0b015bf484f
./update.exe 586264 583f837ae1c8808189aed51e785c072b1f339435
./ogg.dll 36864 b00735e08b821aa9fc5850084ae057b5f618fb2a
./RefreshRateFixByDarkP1xel32.LOG 53 fcd847d22946a44be103ef837d4b747f6b992a5b

./MoonLoaderUninstall.exe 157509 8afa5ee3fd324b3fab90c49bee74e569ea71da9b
./moonloader/reload_all.lua 458 db43057855869865cb447741c7e8f34ea3a0fa11
./moonloader/moonloader.log 1624 8c88fd803c9036d42fe3bf3c6749629cf71b0002
./moonloader/lib/sampfuncs.lua 15207 6697e26fca4866066683b0aa822b92dae0ae1566
./moonloader/lib/bitex.lua 557 b5dfbebd378502333a36447529c85bd6f039cd49
./moonloader/lib/iconv/README-lua-iconv 4755 97646079663ad8d5bbbd294c72459d5500ef8769
./moonloader/lib/iconv/README-libiconv 5801 d5c65781fd31830cd3bac92157e96d120a5a442d
./moonloader/lib/iconv/COPYING-libiconv 25291 0e8e850b0580fbaaa0872326cb1b8ad6adda9b0d
./moonloader/lib/vector3d.lua 1770 39b19408b235c6681f6d91ac350e83b8354ccd71
./moonloader/lib/encoding.lua 2636 ae7f28d9eb94eeb8f1f9e60d5def7e72475682ca
./moonloader/lib/iconv.dll 1000960 6944c38c5d00dfffd16246944d597a3f88210534
./moonloader/lib/game/weapons.lua 2443 1320764dd6242e1527f6f74ca5b3cb6e0295a937
./moonloader/lib/game/models.lua 12767 c92788cece35404d1502af604f103f6b070609b3
./moonloader/lib/game/keys.lua 1062 65e7007635c46a79aba5ff633dd0d4790b50314c
./moonloader/lib/game/globals.lua 28363 5fe1e68474463fc985e477bc525f264fc1f1606f
./moonloader/lib/vkeys.lua 9814 f38a6bd40af71237bced2c467f41338d3a12716b
./moonloader/lib/matrix3x3.lua 2070 a32982a4cc7dc702f54a81a975960e6ac49286b4
./moonloader/lib/windows/init.lua 184 b80319fd6808dcded54ed265472a208d08313ace
./moonloader/lib/windows/message.lua 26909 2e1c64ba56670ef38b0f23fb19bf3fc8ae476e0f
./moonloader/lib/samp/raknet.lua 12181 c34634d27068b2c10424b960ea5afdcb0ca18779
./moonloader/lib/samp/events.lua 26829 651bfbb74a1335835e6c35a983baff6b83c34fba
./moonloader/lib/samp/events/bitstream_io.lua 7155 e9ff4f6ed51bc72a06687e1e3884dd746639709a
./moonloader/lib/samp/events/extra_types.lua 1573 d7543be5a88ce8276c6a6be223b90b8b38ea3657
./moonloader/lib/samp/events/utils.lua 1385 bc711bdb8431e90bfd8f5d9e7e30baef974e5da3
./moonloader/lib/samp/events/handlers.lua 17405 e11ae2da0b1f178203c2e4fc37448f7cb7e3567e
./moonloader/lib/samp/events/core.lua 3880 e7b643acaf0833804d00fa35944056a52e587fff
./moonloader/lib/samp/synchronization.lua 4296 cf86bd4bbf09357407a642d7adaab44614081e85
./moonloader/lib/moonloader.lua 3171 d6ce49a39fcf3a794ed80b8490d9f58a1bfe8c8e
./moonloader/AutoReboot.lua 2781 8555b1ce520eabed3a3b633a83ea079fbc13aef7
./moonloader/SF Integration.lua 2422 0d9d7fe2c363f5d4ea3f17a8793ab8746fb9c888
./text/italian.gxt 751379 b2b48cea01205c8b76621b5f37f4f696ac50ce5e
./text/spanish.gxt 738276 5ab19fc900e2af1c869e174827f5c055fe44cd0d
./text/french.gxt 798974 5721fb4a42e18c46456b4e21900488a59ad69a18
./text/american.gxt 766936 e9065fe3b64d67aff04ddf7aed32596a9bebbb43
./text/german.gxt 812934 e3bf75927ca802369f881b23f23c0e6a29919a94
./SAMPFUNCS.asi 1726464 a4e4e14f8baf38b8678f728cc88a180f1f970600
./RefreshRateFixByDarkP1xel32.asi 75264 433de4740b871659ee4aa64b483874b0922ca6d8
./vorbis.dll 1060864 c89297e75b6813cf8950e278a5c390e2c5f9d9f6
./samp-license.txt 3950 7d312967f5bfe9a2a97ece01ce4b2ed842b87245
./data/maps/veh_mods/veh_mods.ide 7323 837e9fb430b801326762e6f29c6357507821ba46
./data/maps/tunnels.ipl 3230 78f3af350f6a872ca55d27fc3cbf821eea7f25c6
./data/maps/occluLA.ipl 35956 e2e473cbc13235a911ee860c5e2d421e11ba525c
./data/maps/occluveg.ipl 17944 e66478fcc1828d3c90487a6dd4a59d3e1816163d
./data/maps/txd.ide 323 ea24153d92d70ea42a73af27d5b036639337534f
./data/maps/paths3.ipl 2428066 595d3703f2c2253ee1fe3e4044e56d6db86baf21
./data/maps/paths2.ipl 2292241 e954e5a18ba35385cb50e3a6f662c12f6843f2c6
./data/maps/occluint.ipl 2338 fa9b77ce9bc5c2b661f40a6b469282e26722f7a0
./data/maps/paths5.ipl 457678 399a43f8af382ba3a121798328a046158946b6bb
./data/maps/paths4.ipl 253014 fb82080bd1eeb88a8f850fedfc122defe06bb1fe
./data/maps/occlusf.ipl 16114 00ab43180510cd8e0551dec6dc4dd7d10a08ca9f
./data/maps/SF/SFw.ide 16473 0f27bc375bf7cc928fd2d06c22989d35d09ece36
./data/maps/SF/SFs.ide 18948 6f65d50ddd082e6b9afed0ea53f6901d5758c71b
./data/maps/SF/SFe.ide 16223 c4fbe432e1da7b186d47d1e956220aa1675cb363
./data/maps/SF/SFSe.ide 30227 9dfb9eaff4a0176aec9c0d73039389263c645c67
./data/maps/SF/SFn.ipl 26201 fdead4906fb3274e400f53add858434989c81f0c
./data/maps/SF/SFxref.ide 4631 42730092366c61c8aad6082abe6c8d18f6596b26
./data/maps/SF/SFe.ipl 26707 9fcfb465e2bff8c5ca229c294d0065d07efb372b
./data/maps/SF/SFs.ipl 37969 0a58ef8fc1090f57d6c98b3f69740adcecff194a
./data/maps/SF/SFw.ipl 29247 4642cae7f956086b88dc0913d280f05c4bb5c5db
./data/maps/SF/SFSe.ipl 53359 82658842d0d371d00611fdf2a4397acdfe633c7f
./data/maps/SF/SFn.ide 11219 2daec3d19c337a209947b669993a964d49428928
./data/maps/vegas/VegasS.ide 18656 3275dfe5eda37d3e6ff1eaf6ed297338b4999729
./data/maps/vegas/vegasE.ide 35542 afb89bc18f9bfdd4c4910c424b35f5cfed6f85d0
./data/maps/vegas/VegasW.ide 25456 172d63fddbd2f5d28513501f1541657565066d9d
./data/maps/vegas/vegasN.ipl 36651 50179f6de49fc701455e9a2045271aa2fdf8a9c8
./data/maps/vegas/vegaxref.ide 5751 5b2dd92c634144af47defd52c19c1ffe9cbd2edc
./data/maps/vegas/vegasW.ipl 49867 75726290288369bee7573c3d2862f7925ad29e7c
./data/maps/vegas/vegasE.ipl 61084 ae0696565f4f96c0685b5ea5602f4516db344223
./data/maps/vegas/vegasS.ipl 30343 6b97e45a993f37bc4a76c872cec00cf3b91bd776
./data/maps/vegas/VegasN.ide 23715 a57d4645f7d633a0e3f6ed9a3178173f79f52d92
./data/maps/vegas/vegaxref.ipl 3661 e0fdf2b16927e3b528a63784d2775bd67b5e0f4f
./data/maps/generic/dynamic2.ide 10509 d5e98da76e714cc8f22140fbe16011f708a6ca4d
./data/maps/generic/procobj.ide 4755 e118613b608b9c236b005152dfedbb0fed2d5027
./data/maps/generic/dynamic.ide 4611 f325f7c32f04c57d09cf9bd43e8606473e358669
./data/maps/generic/vegepart.ide 8062 cb01bc2a7942089f9fa92e71bafee321e9607ff2
./data/maps/generic/barriers.ide 1437 42416db11f71aa7e4d7dbb07c52b88d7fb7a5531
./data/maps/generic/multiobj.ide 5020 40dec556c3311c3f473e0252ec5d4d030befbe24
./data/maps/Audiozon.ipl 10802 c18484e6269e2ed954bf0f19a47ffe5040169434
./data/maps/paths.ipl 2658607 50aa155acdec67078a45c55f6c77c136ff2d362a
./data/maps/interior/gen_int3.ide 3252 836e8846211357fd1289e16074faaa344551c746
./data/maps/interior/gen_int2.ide 10941 d1454a322f537f6f44130b2c50e976ff4d62e90c
./data/maps/interior/propext.ide 2340 201e2ff6ecefbfb49cdc28907f223f6e9e9b8afd
./data/maps/interior/gen_int1.ide 2747 f9228615fec4a3aaa6f6161eca60615dd027f535
./data/maps/interior/gen_int5.ide 4682 94e8decb4da5f86fbf1a65e2ceba34f6ffedc3c0
./data/maps/interior/savehous.ide 1724 3864c6cf5522d1016040d42f7fac575e06f92f2b
./data/maps/interior/gen_intb.ide 5459 aa8723ebab4d8eca6ca57b96cb799bb87fb19fc2
./data/maps/interior/gen_int4.ide 2323 98c0faad4b1f28fd516b5efbf913ed24c09880ef
./data/maps/interior/int_LA.ipl 1312 15f5891857ffbf1e7155b15c47b74dae8a3cb8b8
./data/maps/interior/stadint.ide 2851 9f6b420a0ce6e5efaf03374808f48ce78755f09a
./data/maps/interior/int_veg.ipl 5299 2c1826c9d31d1cdc106a31f65cafa6299328c4a9
./data/maps/interior/int_cont.ipl 910 8e51b3666ce7058b4b72e153a962078235ab8a5e
./data/maps/interior/int_SF.ipl 1334 a7804f09a3347f45005c61cffc5318ba84e1c147
./data/maps/interior/gen_intb.ipl 1626 e69340bb416d2fb0c33857ad728338d47fe291ea
./data/maps/interior/props.ide 26326 972857494a3d20d0072ee3a03562d2a36ba07223
./data/maps/interior/gen_int4.ipl 1185 7ffb7d4a58df25026cdcf0de2d59095090aa10b0
./data/maps/interior/gen_int5.ipl 2988 9b84f71fb63a94559d488e0a629d1d67410238af
./data/maps/interior/savehous.ipl 2959 12992c31030236891ae980e2f77f69617d058e39
./data/maps/interior/int_LA.ide 6002 52dba6968d7ef8a7df872b5cf54d31d1718f78ff
./data/maps/interior/stadint.ipl 6299 1d2c6d1cdb45d10ab5725d8dabdede4c013d4808
./data/maps/interior/gen_int2.ipl 1683 aff13c4a1ffd01488bcaf984394881a1299cc974
./data/maps/interior/props2.ide 21174 4ff35761739df882e2a169b15c64a05691a51010
./data/maps/interior/gen_int3.ipl 2091 b736e3705e7c335ac66f3de790889b1559b4f94f
./data/maps/interior/gen_int1.ipl 21074 89381d81884d8c7e566e32ec94f78bc588f9b2b9
./data/maps/interior/int_cont.ide 385 03dd12532e138938eb56433208d3967991857b4c
./data/maps/interior/int_veg.ide 4684 299c0fc4bfbdb3e6fd7413d0e2141ebe41489442
./data/maps/interior/int_SF.ide 1260 b0632e0aff8f20c193491b3a6a53bdefb875ec63
./data/maps/LA/LAn.ipl 14264 6bcd0c74b006ef6c50d493a085a04343a52e9da0
./data/maps/LA/LaWn.ipl 24330 f25824d23a5e8766b6d1400f626701d2451032f5
./data/maps/LA/LAe2.ide 21906 16b79b54aa5e52744e7abaa180d2ac59d2b3f790
./data/maps/LA/LAs2.ipl 38441 1db6483f61584c527b511cf93ce8357632612475
./data/maps/LA/LAw.ide 9411 9f8e0fcf7aff37ccfa034bf1cc308dba41215ba6
./data/maps/LA/LAn2.ide 9565 620d54351af569990d66e99a3a63fce9b0874b0f

!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

./data/maps/LA/LAhills.ide 10601 09ea5763f1168e4bea8f65f87a6fa9c5d8e0c121
./data/maps/LA/LAs.ide 12575 fd6a08368fd529b0437c6e3d6651cccc51116d3e
./data/maps/LA/LAw2.ide 11060 1dd153aaa2ba88c452d12be7717fe4054f717a54
./data/maps/LA/LAe.ide 12249 ca936d4dc7893c22ffcdecfe5e2c96fc520db4a9
./data/maps/LA/LAn.ide 11107 091e87379d5294255ba956df80a7bb58708e922e
./data/maps/LA/LaWn.ide 13092 bacf9bdb5da2f67761c265775354de6f0a58718d
./data/maps/LA/LAe2.ipl 33651 8fef5631ddc29922c3db8262631a9d57f1b2388c
./data/maps/LA/LAn2.ipl 13185 ff1aad43821b6723972e0cb8c0691d3d95363550
./data/maps/LA/LAhills.ipl 34506 ffe0d1e6344b7417388f666c3636f52b286fe1d2
./data/maps/LA/LAe.ipl 27328 7b35b00c918091298a94a21ff297491d0b9330d3
./data/maps/LA/LAs.ipl 22414 9fa9b101a987b2ee13cf470691dc37d6990052b0
./data/maps/LA/LAxref.ide 10473 a1d0c9fe4fb18478cd94ccec49dfdc4e80c8933e
./data/maps/LA/LAw2.ipl 18232 22cecccd8f063eb43f4c29b516724ff3c1190d07
./data/maps/LA/LAw.ipl 15105 1c99b6f4336915f353a2a6c8894ec83ded16c9b4
./data/maps/LA/LAs2.ide 12364 5e45041c6340cb7883c4d92d7d6718f9ad7aaf30
./data/maps/cull.ipl 104318 3b53c352b7d41c1a141a0d7099ef4b1a61831265
./data/maps/leveldes/seabed.ide 12039 5ba36ac78ef90788c8816a4cce841867d8e932bc
./data/maps/leveldes/leveldes.ide 360 1d665bdd621dbc13cbf7e2b2dbdb336449f4f11d
./data/maps/leveldes/levelmap.ide 3194 87ea89e009878b63295e70fe1bf33ace354241d4
./data/maps/leveldes/seabed.ipl 23342 515cde21c8e91d3197b422f3410404a19f852298
./data/maps/leveldes/leveldes.ipl 165 00b553e9f7c7596bdb38f804e516166a2cc2b9e8
./data/maps/leveldes/levelmap.ipl 4675 7db7cb06ca017a16c92854b32c7495e6629fb511
./data/maps/leveldes/levelxre.ide 9897 5f5a43c12533f3f575e0d544370d9c479e28a45e
./data/maps/country/countryw.ipl 35057 eb9bddcd1c57431b5c3ef89b50cd7e4b05554bad
./data/maps/country/countryS.ipl 33835 f7241a23b3fd9b0f644a43c97ea7aca9cfbcf13d
./data/maps/country/countrye.ipl 49301 1b2938a36a8a7c35fcd2f742af79d10c46ae7dbe
./data/maps/country/counxref.ide 8493 e146716755b8b92a3b881b216eecc400d0db62cf
./data/maps/country/countryN.ide 11308 82444c011f05be6dd56d33d19b74d3770e41c8e1
./data/maps/country/countn2.ide 35439 a4305ebcfce1ac7ed7c594435e7171945cea311e
./data/maps/country/countrye.ide 34529 7d5b25405872596249a112e4c1d08a317ea94081
./data/maps/country/countryS.ide 18450 f16300d9af0802e7ba91a0d50ac9d6d1ce23356f
./data/maps/country/countryW.ide 19704 cc2e5f1911b3ca706cc9d626ee2e0021ab875d12
./data/maps/country/countryN.ipl 14407 4343a96dff1dc0af1c07143e1085f94d309ca10a
./data/maps/country/countn2.ipl 41665 cdd206be9435f120f6c5866ab58e78c8db10a4f1
./data/maps/occlu.ipl 1012 2c87d230461851f748d48bd2b0a81a7284ea1616
./data/carcols.dat 15361 08f037e99850e2e84c15170098f29b84c3df2ba3
./data/melee.dat 6306 7ce426ff0e91863d63fb54cdebbfcb8bf26e47e3
./data/gta_quick.dat 1079 495a274a7aa326b24d2f6affede181ed41c7509d
./data/gridref.dat 1498 57d88132ccc4171fea1c95f46c22770fbde8502c
./data/surface.dat 576 93043b25a77e5beb244bd7901a96403374d810d5
./data/clothes.dat 5317 6465512c6eef7d05c0582b8a6539fa60fef44aa2
./data/cargrp.dat 3963 990c7d078b15b285ac89392eec13f6a89c639f39
./data/vehicles.ide 21093 b20dcf4f54ae39d41503002e201b398366de6127
./data/txdcut.ide 478 31683ba0bee92987061df12ea2f3e26aa933166b
./data/statdisp.dat 7333 85221f4551b45cf6686402426011bbff3a8567c5
./data/polydensity.dat 288020 96536cb561cfcc35c4c287ee35a3fc40bff5b026
./data/water1.dat 60063 7c99ba72a1f2a6fad03aa2a9731691d572aed701
./data/animgrp.dat 3096 d731d8cf855f297b8a464065f7f59833146c39c2
./data/Paths/NODES36.DAT 52546 9de74360d475886b4906bb381be207002b21674e
./data/Paths/NODES22.DAT 120014 899c465c024cb72bfeb9e36a8b44790ccd8c4566
./data/Paths/NODES23.DAT 87652 e5f819eff7bda7483ba25a289702e3493a929cdc
./data/Paths/NODES37.DAT 46690 d4e17dd49788246647d2502632927b9d7156848d
./data/Paths/NODES9.DAT 32516 4b5adfe3d8e9b3f6381d40e22af2afc5103aad7a
./data/Paths/tracks3.dat 8328 b980ef803a1c4cc58c2e59f9dc722884600a7e24
./data/Paths/NODES21.DAT 138482 1fbf7369da374dfdbdcb33cafa1f5ede083c8900
./data/Paths/NODES35.DAT 28442 672fe34899b7cdf3904bca1fbdcf5d1a42c95998
./data/Paths/NODES34.DAT 50594 1dc0ffef3bba0ecf2b024ece5b9db9bc452109c7
./data/Paths/NODES20.DAT 76652 e66915634df33becea7ac45c5d53d3728d193ef9
./data/Paths/tracks2.dat 1892 3b2ae7604c1b5f18a69d89491e13afe6107f386b
./data/Paths/NODES8.DAT 32112 6d7f400ae89b91457f378d7be03c04241746d33e
./data/Paths/NODES18.DAT 17234 245c276facfd62c0e98ed0f43531641b8c476993
./data/Paths/NODES24.DAT 94334 4e2dc7dd5182739442fbe0763206fcc0a467de3d
./data/Paths/NODES30.DAT 20098 6641250ba2de034777e42c0aeccbe6aba47f9dc7
./data/Paths/NODES31.DAT 22552 934aa156074b5a2df0e99f8d02bdaabd01fe50eb
./data/Paths/NODES25.DAT 95160 3e07e823f37f7d7980ec5355a4fbd2ba4d3c3677
./data/Paths/NODES19.DAT 39862 e674caa78cf415005ce694eda33bf018f2236ff9
./data/Paths/train.dat 2476 c571b42ceee7f3d9d626eb86cfc73ba345f48d72
./data/Paths/NODES33.DAT 113784 18f5befd580f1aa53773358e91a981d766eedb05
./data/Paths/NODES27.DAT 26342 c981d5177291fde4cc1fca38858f6838576b1351
./data/Paths/NODES26.DAT 55378 3e234c9b9cffed18b0dd1949584b5e67134953c3
./data/Paths/NODES32.DAT 126744 800cf9a42b08700cc93d44aeb87d99b4e5b75bdb
./data/Paths/tracks4.dat 18347 e8810adde5267d0ce6502eb8dc03045ef8e953cc
./data/Paths/NODES55.DAT 84904 632e146a12fe9649a83734a03fe63b3aa93eff5c
./data/Paths/NODES41.DAT 141844 45891581fa4d066aac8db79ce0512526d1db3c38
./data/Paths/NODES40.DAT 115172 8beb38b7c79f4adcd9735ecf3e295c151f9c4489
./data/Paths/NODES54.DAT 127874 6bc27fd456a391f6023f9ce6ea0df4b97239541b
./data/Paths/NODES42.DAT 35716 af27e5f35d30ca65a6cfc01093b3c1afe9509926
./data/Paths/NODES56.DAT 33350 04b4939956018c1aedef9234e8fdb0c021991775
./data/Paths/NODES57.DAT 19212 2f97c8d8ffafae50d06a208721ef6c6a93fdcbeb
./data/Paths/NODES43.DAT 45006 db7052502cb51165a415e1d978e69bb6621816c8
./data/Paths/NODES47.DAT 85050 e587f8e0ab8194332a31809350de601b7d48f2ab
./data/Paths/NODES53.DAT 65650 510ef1fb29cdd351330d8065e83b88effc350514
./data/Paths/NODES52.DAT 37934 6ff750643cea7de4b70052592937884a3400b035
./data/Paths/NODES46.DAT 123954 c76dabc2348c4b59f6c728302339ff9bb8b26584
./data/Paths/NODES50.DAT 32076 6db8ad2e60bd8ba980ab4654ebacbd5314dc7b56
./data/Paths/NODES44.DAT 49032 016dc563cf0dac09faf83e9524a81c5de2b5a2e2
./data/Paths/NODES45.DAT 40270 5f38eb2ce3699a963940a04e9d86dcbc8d2ce555
./data/Paths/NODES51.DAT 18704 009cf5445f6187485f869c8b8326a76abbcaa95f
./data/Paths/NODES60.DAT 14464 86ae40a62833c182d9009eba8310ba49de6dc06e
./data/Paths/ROADBLOX.DAT 1304 21f74c610acf72bb45e7d231f8a102fa4f7c0ed9
./data/Paths/NODES48.DAT 26170 abdc124a7e892ef2b0ba3943d717a5ecc1a093cc
./data/Paths/NODES49.DAT 14948 65617b511edf2f165de9f8e75ee17d2d8c0fd532
./data/Paths/NODES61.DAT 60284 82e5ebd01ecb89dd83cd1fe365a1b97867e193e2
./data/Paths/train2.dat 4232 7fb0f23e3db4d07362ed6580d5974e803d50d4b3
./data/Paths/NODES63.DAT 71530 642d1e0b52a410618c4938ad9674f2d9219fa8ec
./data/Paths/NODES62.DAT 70972 6a9b4b6691c4a94a83ad54e018eae8e23957a1ac
./data/Paths/NODES59.DAT 28114 283e01964c52fd6a7e79db67c19e0595c39cd83b
./data/Paths/NODES58.DAT 18858 7b4baafb5854fb8cbd5700b3a92d909f799f15ed
./data/Paths/NODES3.DAT 12438 da8b782bdb32990ff961f03f467e19c7a9a237d9
./data/Paths/NODES17.DAT 36952 d9db532f3153f63a7282f3dd6f0a2d01a41cd14f
./data/Paths/NODES16.DAT 19250 1845f6d560fea251257bcd2ea2a9230ebf5d0176
./data/Paths/NODES2.DAT 11396 e1292744fdbdb92be4e75dc581fd6838c5e06124
./data/Paths/NODES0.DAT 13458 a53059949a410eaf5f73cdad0ba07419dc38baed
./data/Paths/NODES14.DAT 121566 74913b480e456e6f1b359c13e99bea70b7811cc8
./data/Paths/NODES28.DAT 84224 536dd3fa1cc1f49233ed9d3581cb7a8e70212763
./data/Paths/NODES29.DAT 36556 1398f2ce1d3c69cbf39a247d9a816271d8c4a7a6
./data/Paths/NODES15.DAT 93802 1d16e271c81ee65f2354fca0a6ce2f9217d98571
./data/Paths/NODES1.DAT 35996 36ea6cbf1bf0e4911eed3c704ce0f9bf335bb1fe
./data/Paths/NODES5.DAT 16804 346d343e35c73d47e1926be0aa990e5abe9b71ec
./data/Paths/NODES39.DAT 42486 f2c6c84aef3523547b634dca2488dc7252456175
./data/Paths/NODES11.DAT 28886 e96b889561060a032810dc8fc17303ec848f53a8
./data/Paths/spath0.dat 1886 163f5476fe852b7fe6f40e8c3fe1d13640163de2
./data/Paths/NODES10.DAT 15100 d0be21fe6c78479edd262cca9355fdf76f76ae90
./data/Paths/NODES38.DAT 59616 c44e23777f50a7d0ff513ab945e1798dd6ca867e
./data/Paths/NODES4.DAT 5402 a7ef78d6e5aab65e92071ca28366c131d93121d8
./data/Paths/tracks.dat 25474 198455b880de569c6bc8520705ac0b692ff2eae5
./data/Paths/NODES6.DAT 50642 615b594ae067174315d8c0ed231d9293d4accf29
./data/Paths/carrec.img 2357248 597045841961e7d4adb0746f98e6c6092c409010
./data/Paths/NODES12.DAT 110342 b0b26cfc2c3a9872bd96a006e11cbbf402310356
./data/Paths/NODES13.DAT 117488 3bec4d0668985b83932c6b9a89ece7efd87616fc
./data/Paths/NODES7.DAT 24464 01744bbd7b9fa3e8082287fef29f425f697ef2bc
./data/shopping.dat 46875 7b1cebb652b0317d5842606729bb5b31a1035369
./data/peds.ide 33401 91af0203a563b53b300434dff5f97ea6a2b49188
./data/procobj.dat 10019 e186e89d1269a15ee235cb6cef67d12a999bea98
./data/script/script.img 581632 169310f78b8a77e6d6fc65e682a68f2a2f6c5f63
./data/script/main.scm 3079599 abeeba49669359c57b7ef2888c7263117f488cea
./data/water.dat 70099 a6b909879d5d2126c183eae8816ba80aece2df84
./data/pedgrp.dat 5792 70d904ed429c056aa3e07500c8b1d6c803ff8cfe
./data/handling.cfg 64532 2324de99ad3023ccc222f627aaa39769f29bc9d4
./data/numplate.dat 1145 07c28588e44aa27da250c6c9599ceefeec37b727
./data/gta.dat 3776 6cea5702d04793c77ed9ed5eea83e1d89abee090
./data/timecycp.dat 40520 cb0f86c5b96fe004a4536af04f3b9617f61fe6d9
./data/popcycle.dat 127108 3f381fbb78ec592e0d5283b05df37d032cfc8707
./data/pedstats.dat 3604 660ee6274b4f3c8323b4d22b85e006f3543bf99f
./data/default.ide 4679 2bb79de5fefd15a305ff81e32bdf0ebcd2602e35
./data/object.dat 126118 f41e2c3e62a9b7c8a8cded8e3e3850e0f3804219
./data/weapon.dat 11585 f327a789562355d337bfe5b28e65b1b0d18c824d
./data/Icons/saicon3.ICN 65800 e6627a0eef7f631bb03ad79b977a2e9fdc137933
./data/Icons/saicon2.ICN 65800 e6627a0eef7f631bb03ad79b977a2e9fdc137933
./data/Icons/bin.ico 766 3115cfc53d0ae8ab330fd7a117b526405d9e1b27
./data/Icons/saicon.ICN 65800 e6627a0eef7f631bb03ad79b977a2e9fdc137933
./data/plants.dat 9887 5576de10ab4b7a9e984f474137a392fab8378989
./data/fonts.dat 3316 a5e4d5222b1d7ddb8365cff496680995976c1c78
./data/carmods.dat 9110 f197f70bbc9b4bd8f3ba5720577e631d399a714a
./data/map.zon 436 4fa511361cb42b2d5efc9bab7f83eeb1b1b9cfaf
./data/animviewer.dat 1807 936c93b25bd976fb3f94f12c6cd5c8dc67a01dfd
./data/surfaud.dat 6530 c0dac3d24a8ac717138bc2bc6fc622a9be2f774a
./data/Decision/Cop.ped 2354 c10a1431f36dc1f546d248a5d0b1099303056e33
./data/Decision/MISSION.grp 530 ac05ac5e9c1ec026f9e237f48dbf224c917781cf
./data/Decision/Allowed/Cop.ped 4908 95ee313f613a8db1b7894cefd81399db46119bb5
./data/Decision/Allowed/MISSION.grp 2758 ee687bed20b5028494a8812aff567b2b5413487b
./data/Decision/Allowed/RANDOM2.grp 4623 3fb224d401d9da4f72596ecdb3b93afdd88c6bfd
./data/Decision/Allowed/GangMbr.ped 6194 9f1fda37546db5f002ec1dd02e1114553811e33f
./data/Decision/Allowed/R_Weak.ped 6289 240977dd45c01fcc3f9852106ff91beef8781d10
./data/Decision/Allowed/m_steal.ped 3663 540e2676aba6f6890ca5ca60427cc74a0fe90c8a
./data/Decision/Allowed/m_norm.ped 4142 bc312280fc9e547663e29a8f7e774741661e6c09
./data/Decision/Allowed/R_Norm.ped 6450 4cc9f919c2da7e8d96bc56ce49f2344c0e29a04d
./data/Decision/Allowed/m_empty.ped 982 f25453a1de08522697c6c2d14112ed8beb2baf6d
./data/Decision/Allowed/m_weak.ped 4062 ef72ce321eaaedbeedbc627d754d2374b01aa81b
./data/Decision/Allowed/m_tough.ped 3980 83ba6de5cba262178ffed37affee5ef09036eae2
./data/Decision/Allowed/Fireman.ped 4435 6ac77cde3980b2a24c2e5654c6216c96c8a55d3f
./data/Decision/Allowed/RANDOM.grp 4623 e5df340f36584cc050f3447bd88d43d59864606a
./data/Decision/Allowed/Indoors.ped 2809 41b51b5bc9d5f07cfde045d95e3fb299c17441ad
./data/Decision/Allowed/RANDOM.ped 4142 bc312280fc9e547663e29a8f7e774741661e6c09
./data/Decision/Allowed/m_plyr.ped 2000 0dbe8ce33c657c54b175528d04d04aace8b91f91
./data/Decision/Allowed/R_Tough.ped 6378 55448d472e2e5a61397f980c412cad4d3cb5c5da
./data/Decision/BLANK.ped 621 7a80cfd082c2128fb738aa676b717a6b71f96ee1
./data/Decision/andyd/ADtemp.ped 3725 ba16473360c095183f916e07629533f7816bdaa6
./data/Decision/andyd/ADgrp.grp 2063 90825b818b8d6ea7192017b83d1aa1bab466bd35
./data/Decision/GangMbr.ped 3067 83704d8750eba1d74d1ab1a56899210c7604e79e
./data/Decision/m_norm.ped 2085 b8023f8c1a39705db456a79dd917b745ed46dcec
./data/Decision/FLAT.ped 399 e9b849bf308670b4fbc89a2a133e94c259c635cf
./data/Decision/m_empty.ped 654 a199ffa39be7c3c7fe40396b27ef54a7809e7a5c
./data/Decision/PedEvent.txt 1298 2e9c3117b2e3aa6b411c51d4dbd7152a05320cad
./data/Decision/m_weak.ped 2085 b8023f8c1a39705db456a79dd917b745ed46dcec
./data/Decision/MISSION.ped 891 89815aaf3e6f4738311b217e02cb33438656465d
./data/Decision/ChrisM/CMblnk.ped 397 b9a95206820d89c89a82c9454cfcb14040f5f47e
./data/Decision/ChrisM/m_std_cm.ped 1071 85a2d917edf70393ed11a785136eb9b617459df4
./data/Decision/m_tough.ped 2085 b8023f8c1a39705db456a79dd917b745ed46dcec
./data/Decision/david/hei2_sc.ped 403 ec95204e4ca6550a2411fa59e2dddcad19a06f08
./data/Decision/david/dam_sec.ped 677 eac77c01e0e890dde3a9f6a5c8f171d2baf36295
./data/Decision/chris/maf5.ped 1130 d271107b54ee0632ddd800e37df6fbedcd6e65d6
./data/Decision/chris/ryder3.ped 1170 2b988d969deb2d10dc201c85823420fa17a91a91
./data/Decision/Imran/std2_is.ped 633 7b7a61a6a878c5b2e1d47aeb125269b62edecf31
./data/Decision/Imran/sci1_is.ped 672 bc4d004f98ddf757af24a1a707f399cd0963a0bd
./data/Decision/Imran/std1_is.ped 383 6d57effb811e0df9f3862484e2b1970d5a72a48e
./data/Decision/m_std.ped 1487 de1466c3db134d8c9317144f7390b7e6beba34ec
./data/Decision/Craig/crack1.ped 796 e9c18dde6efd59ff8a1252bcf8ab43af98688537
./data/Decision/GROVE.ped 393 93af656c9a63a2ef3c5dd178b1a7e83fd51844e6
./data/Decision/Indoors.ped 1928 257e0fcda6d7c7d4049ddd3711c5e7d5cbdbfac8
./data/Decision/m_infrm.ped 1539 6eecc1049880a77a751f42e9b8d09bc7763097e7
./data/default.dat 577 1ced43455b685ad4cf7fef835cb395939e5cdb26
./data/ped.dat 1276 e54dce795a16f55be6726efd6fde19c07b279a99
./data/furnitur.dat 16480 4c0c0409adef67472ef2509c38ba286ca74d2a54
./data/main.sc 6020 f9c12911463291fd07a08a6587b0c3ac1935e083
./data/ar_stats.dat 3593 4f82f38aa5816a76c8ca46932e14cd4c5d63f239
./data/AudioEvents.txt 166161 2d932fd2fd3ee4fa9fbe5198ccda920e362e4ec1
./data/timecyc.dat 40037 7e62208e249460ea97439d7098146e895abd8b8b
./data/info.zon 28139 cb4cd557fdb02cd6cdfab4745a2d2d5d268b1cb0
./data/surfinfo.dat 28106 92eb973c898368b31b1a7172d417528073778310
./samp.saa 2689408 5361378143beee5086935f6eaac5af2004c623a5
./sampaux3.ttf 11544 d6f0c8b5f29181e4915ed3cb1bb04b55117bab14
./gta_sa.exe 14383616 69e86f5ff95cf4aac55caa6de4ca9e3e3a149560
./SAMP/samaps.txd 656040 d64ba932095df01aec31255147078d8820f500df
./SAMP/SAMP.ide 89347 5aef67fcfe871e3828b4686553c9471cf9b72497
./SAMP/CUSTOM.ide 0 da39a3ee5e6b4b0d3255bfef95601890afd80709
./SAMP/SAMPCOL.img 3305472 cf5ec69bc0725c3b6b55c5934bfecac971060572
./SAMP/SAMP.img 47261696 fba6b6ce9d6ec0743e8c4137c8808d3ad1bf9f8e
./SAMP/custom.img 8192 8c2dd82d07d41977946eb12225e017d08ff19d81
./SAMP/SAMP.ipl 2291 32d5cc60c1b56d62f0a4d5503ac1f60b1a1c97f1
./SAMP/blanktex.txd 33320 901fd1c737e95f09c096826eb547849ca1873b85
./samp.dll 2199552 56c15c64ff098e04c319221b5a88142421e5ae34

 */
