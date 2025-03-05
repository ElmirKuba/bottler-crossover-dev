const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Функция для создания бутылки
function createBottle(bottleDir, bottleName, template, description = '') {
  const bottlePath = path.join(bottleDir, bottleName);

  // Проверяем, существует ли бутылка
  if (fs.existsSync(bottlePath)) {
    console.log(`Бутылка ${bottleName} уже существует.`);
    return;
  }

  // Полный путь к cxbottle
  const cxbottlePath =
    '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/CrossOver-Hosted\\ Application/cxbottle';
  const command = `${cxbottlePath} --create --bottle "${bottleName}" --description "${description}" --template "${template}"`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Ошибка при создании бутылки: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Ошибка: ${stderr}`);
      return;
    }

    console.log(`Бутылка создана: ${stdout}`);
    if (fs.existsSync(bottlePath)) {
      console.log(`Директория бутылки создана: ${bottlePath}`);
    } else {
      console.error(`Директория бутылки не найдена после создания.`);
    }
  });
}

// Пример вызова
const bottleDir = path.join(
  process.env.HOME,
  'Library',
  'Application Support',
  'CrossOver',
  'Bottles'
);
const bottleName = 'sampizm_idiotizm_tupizm';
const template = 'win7';
const description = 'Windows7_32_samp';

createBottle(bottleDir, bottleName, template, description);
