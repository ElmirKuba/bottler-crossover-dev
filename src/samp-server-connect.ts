process.env.LANG = 'ru_RU.UTF-8';

import { exec } from 'child_process';

// Функция для запуска SAMP через CrossOver
function startSamp(
  ip: string,
  port: string,
  bottleName: string,
  sampPath: string
): void {
  // Путь к утилите cxstart на macOS
  const cxstartPath =
    '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/cxstart';

  // Формируем команду
  const command = `${cxstartPath} --bottle ${bottleName} "${sampPath}" ${ip}:${port}`;

  // Запускаем процесс
  exec(command, (error) => {
    if (error) {
      console.error(`Ошибка запуска: ${error.message}`);
      alert(`Не удалось запустить SAMP: ${error.message}`);
    } else {
      console.log('SAMP успешно запущен!');
    }
  });
}

// Пример вызова функции
const ip = '51.89.8.242';
const port = '7777';
const bottleName = 'sampizm_idiotizm_tupizm';
const sampPath = 'C:\\SAMP\\samp.exe';

startSamp(ip, port, bottleName, sampPath);
