@echo off
:: Установка кодовой страницы UTF-8 для корректного отображения русских символов
chcp 65001 > nul
setlocal enabledelayedexpansion

:: Скрипт для запуска процесса развертывания приложения
:: Автор: Cline
:: Дата: 15.04.2025

echo ===================================================
echo = Мастер развертывания Node.js приложения на Ubuntu =
echo ===================================================
echo.
echo Этот скрипт поможет вам развернуть приложение на сервере Ubuntu 22.04.
echo Вам потребуется:
echo  - IP-адрес сервера Ubuntu
echo  - Имя пользователя SSH
echo  - Пароль SSH
echo  - API ключ для OpenRouter.ai
echo.
echo Процесс состоит из двух этапов:
echo  1. Настройка сервера Ubuntu (установка необходимых пакетов и настроек безопасности)
echo  2. Развертывание приложения на сервер
echo.

:: Запрос данных для подключения к серверу
set /p SERVER_IP="Введите IP-адрес сервера: "
set /p SSH_USER="Введите имя пользователя SSH: "
set /p SSH_PASSWORD="Введите пароль SSH: "

:: Проверка наличия утилит plink и psftp
if not exist plink.exe (
    echo Ошибка: Утилита plink.exe не найдена в текущей директории.
    exit /b 1
)

if not exist psftp.exe (
    echo Ошибка: Утилита psftp.exe не найдена в текущей директории.
    exit /b 1
)

echo.
echo ===================================================
echo = Этап 1: Настройка сервера Ubuntu                 =
echo ===================================================
echo.

:: Проверка наличия файла setup-ubuntu.sh
if not exist setup-ubuntu.sh (
    echo Ошибка: Файл setup-ubuntu.sh не найден в текущей директории.
    exit /b 1
)

:: Копирование скрипта настройки на сервер
echo Копирование скрипта настройки на сервер...
(
echo cd /tmp
echo put setup-ubuntu.sh
echo quit
) > psftp_commands.txt
psftp.exe %SSH_USER%@%SERVER_IP% -pw %SSH_PASSWORD% -b psftp_commands.txt
del psftp_commands.txt

:: Выполнение скрипта настройки на сервере
echo Выполнение скрипта настройки на сервере...
plink.exe -ssh -pw %SSH_PASSWORD% %SSH_USER%@%SERVER_IP% "chmod +x /tmp/setup-ubuntu.sh && sudo -S /tmp/setup-ubuntu.sh"


echo.
echo ===================================================
echo = Этап 2: Развертывание приложения                 =
echo ===================================================
echo.

:: Запрос API ключа для OpenRouter
set /p OPENROUTER_API_KEY="Введите API ключ для OpenRouter: "
set /p ENABLE_PAID_MODELS="Включить платные модели (true/false): "

:: Создание временной директории для подготовки файлов
echo Создание временной директории...
if exist temp_deploy rmdir /S /Q temp_deploy
mkdir temp_deploy

:: Копирование файлов проекта во временную директорию
echo Копирование файлов проекта...
if exist src xcopy /E /Y src temp_deploy\src\ >nul
if exist public xcopy /E /Y public temp_deploy\public\ >nul
if exist package.json copy /Y package.json temp_deploy\ >nul
if exist package-lock.json copy /Y package-lock.json temp_deploy\ >nul
if exist README.md copy /Y README.md temp_deploy\ >nul

:: Создание .env файла
echo Создание .env файла...
echo # Порт для запуска сервера > temp_deploy\.env
echo PORT=3000 >> temp_deploy\.env
echo. >> temp_deploy\.env
echo # API ключ для OpenRouter.ai >> temp_deploy\.env
echo OPENROUTER_API_KEY=%OPENROUTER_API_KEY% >> temp_deploy\.env
echo. >> temp_deploy\.env
echo # Активация платных моделей (true/false) >> temp_deploy\.env
echo ENABLE_PAID_MODELS=%ENABLE_PAID_MODELS% >> temp_deploy\.env

:: Архивирование проекта
echo Архивирование проекта...
cd temp_deploy
tar -czf ../app.tar.gz *
cd ..

:: Проверка наличия архива
if not exist app.tar.gz (
    echo Ошибка: Не удалось создать архив app.tar.gz.
    exit /b 1
)

:: Копирование архива на сервер
echo Копирование архива на сервер...
(
echo cd /tmp
echo put app.tar.gz
echo quit
) > psftp_commands.txt
psftp.exe %SSH_USER%@%SERVER_IP% -pw %SSH_PASSWORD% -b psftp_commands.txt
del psftp_commands.txt

:: Создание скрипта для выполнения на сервере
(
echo #!/bin/bash
echo echo "Распаковка архива..."
echo mkdir -p /var/www/nodeapp
echo tar -xzf /tmp/app.tar.gz -C /var/www/nodeapp
echo cd /var/www/nodeapp
echo echo "Установка зависимостей..."
echo npm ci --production
echo echo "Настройка прав доступа..."
echo chown -R nodeapp:nodeapp /var/www/nodeapp
echo echo "Настройка PM2..."
echo sudo -u nodeapp pm2 delete nodeapp 2^>/dev/null ^|^| true
echo sudo -u nodeapp pm2 start src/server.js --name nodeapp
echo sudo -u nodeapp pm2 save
echo sudo env PATH=\$PATH:/usr/bin pm2 startup systemd -u nodeapp --hp /home/nodeapp
echo sudo systemctl enable pm2-nodeapp
echo echo "Перезапуск Nginx..."
echo sudo systemctl restart nginx
echo echo "Приложение успешно развернуто!"
echo echo "Доступно по адресу: http://%SERVER_IP%"
) > deploy_commands.sh

:: Проверка наличия скрипта
if not exist deploy_commands.sh (
    echo Ошибка: Не удалось создать скрипт deploy_commands.sh.
    exit /b 1
)

:: Копирование скрипта на сервер
echo Копирование скрипта на сервер...
(
echo cd /tmp
echo put deploy_commands.sh
echo quit
) > psftp_commands.txt
psftp.exe %SSH_USER%@%SERVER_IP% -pw %SSH_PASSWORD% -b psftp_commands.txt
del psftp_commands.txt

:: Выполнение скрипта на сервере
echo Развертывание приложения на сервере...
plink.exe -ssh -pw %SSH_PASSWORD% %SSH_USER%@%SERVER_IP% "chmod +x /tmp/deploy_commands.sh && sudo -S /tmp/deploy_commands.sh"

:: Очистка временных файлов
echo Очистка временных файлов...
rmdir /S /Q temp_deploy
del app.tar.gz
del deploy_commands.sh

echo.
echo ===================================================
echo = Развертывание приложения завершено успешно!     =
echo = Приложение доступно по адресу:                  =
echo = http://%SERVER_IP%                              =
echo ===================================================
echo.
echo Для получения дополнительной информации обратитесь к файлу deployment-instructions.md

pause
