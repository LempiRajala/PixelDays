# Captcha Microservice

Микросервис для генерации и валидации графической капчи. 
Реализован на Go с использованием Redis в качестве хранилища сессий.

## Технологии
- **Language:** Go 1.22+
- **Database:** Redis (TTL сессий 5 минут)
- **Containerization:** Docker, Docker Compose
- **Security:** Искажение символов, цветовой шум и линии для защиты от OCR.

## Запуск проекта
Для запуска всей инфраструктуры (Go-сервис + Redis) выполните:

```
docker-compose up --build
```
#### Сервис будет доступен по адресу: http://localhost:8080/captcha
