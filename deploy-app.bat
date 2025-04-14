@echo off
setlocal enabledelayedexpansion

:: Скрипт для развертывания Node.js приложения на сервер Ubuntu
:: Автор: Cline
:: Дата: 15.04.2025

echo ===================================================
echo = Скрипт развертывания Node.js приложения на Ubuntu =
echo ===================================================

:: Запрос данных для подключения к серверу
set /p SERVER_IP="Введите IP-адрес сервера: "
set /p SSH_USER="Введите имя пользователя SSH: "
set /p SSH_PASSWORD="Введите пароль SSH: "

:: Проверка наличия утилиты scp и ssh
where scp >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Ошибка: Утилита scp не найдена. Убедитесь, что OpenSSH установлен в вашей системе.
    exit /b 1
)

where ssh >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Ошибка: Утилита ssh не найдена. Убедитесь, что OpenSSH установлен в вашей системе.
    exit /b 1
)

:: Создание временной директории для подготовки файлов
echo Создание временной директории...
mkdir temp_deploy 2>nul

:: Копирование файлов проекта во временную директорию
echo Копирование файлов проекта...
xcopy /E /Y ..\* temp_deploy\ >nul

:: Создание .env файла
echo Создание .env файла...
set /p OPENROUTER_API_KEY="Введите API ключ для OpenRouter: "
set /p ENABLE_PAID_MODELS="Включить платные модели (true/false): "

(
echo # Порт для запуска сервера
echo PORT=3000
echo.
echo # API ключ для OpenRouter.ai
echo OPENROUTER_API_KEY=%OPENROUTER_API_KEY%
echo.
echo # Активация платных моделей (true/false)
echo ENABLE_PAID_MODELS=%ENABLE_PAID_MODELS%
) > temp_deploy\.env

:: Архивирование проекта
echo Архивирование проекта...
cd temp_deploy
tar -czf ../app.tar.gz *
cd ..

:: Копирование архива на сервер
echo Копирование архива на сервер...
echo %SSH_PASSWORD% | scp -o StrictHostKeyChecking=no app.tar.gz %SSH_USER%@%SERVER_IP%:/tmp/

:: Выполнение команд на сервере
echo Развертывание приложения на сервере...

:: Создание скрипта для выполнения на сервере
(
echo #!/bin/bash
echo echo "Распаковка архива..."
echo mkdir -p /var/www/nodeapp
echo tar -xzf /tmp/app.tar.gz -C /var/www/nodeapp
echo cd /var/www/nodeapp
echo.
echo echo "Установка зависимостей..."
echo npm ci --production
echo.
echo echo "Настройка прав доступа..."
echo chown -R nodeapp:nodeapp /var/www/nodeapp
echo.
echo echo "Настройка PM2..."
echo sudo -u nodeapp pm2 delete nodeapp 2>/dev/null || true
echo sudo -u nodeapp pm2 start src/server.js --name nodeapp
echo sudo -u nodeapp pm2 save
echo sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u nodeapp --hp /home/nodeapp
echo sudo systemctl enable pm2-nodeapp
echo.
echo echo "Перезапуск Nginx..."
echo systemctl restart nginx
echo.
echo echo "Приложение успешно развернуто!"
echo echo "Доступно по адресу: http://%SERVER_IP%"
) > deploy_commands.sh

:: Копирование скрипта на сервер
echo %SSH_PASSWORD% | scp -o StrictHostKeyChecking=no deploy_commands.sh %SSH_USER%@%SERVER_IP%:/tmp/

:: Выполнение скрипта на сервере
echo %SSH_PASSWORD% | ssh -o StrictHostKeyChecking=no %SSH_USER%@%SERVER_IP% "chmod +x /tmp/deploy_commands.sh && sudo /tmp/deploy_commands.sh"

:: Очистка временных файлов
echo Очистка временных файлов...
rmdir /S /Q temp_deploy
del app.tar.gz
del deploy_commands.sh

echo ===================================================
echo = Развертывание приложения завершено успешно!     =
echo = Приложение доступно по адресу:                  =
echo = http://%SERVER_IP%                              =
echo ===================================================

pause
