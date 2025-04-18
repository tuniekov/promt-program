require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  enablePaidModels: process.env.ENABLE_PAID_MODELS === 'true',
  
  // Список доступных моделей нейросетей
  availableModels: [
    // Бесплатные модели
    {
      id: 'deepseek/deepseek-chat-v3-0324:free',
      name: 'DeepSeek Chat v3 (Free)',
      description: 'Бесплатная версия DeepSeek Chat v3',
      isPaid: false
    },
    {
      id: 'deepseek/deepseek-v3-base:free',
      name: 'DeepSeek v3 Base (Free)',
      description: 'Базовая бесплатная модель от DeepSeek',
      isPaid: false
    },
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1 (Free)',
      description: 'Бесплатная версия исследовательской модели DeepSeek R1',
      isPaid: false
    },
    // Платные модели
    {
      id: 'anthropic/claude-3-7-sonnet',
      name: 'Claude 3.7 Sonnet',
      description: 'Мощная модель от Anthropic',
      isPaid: true
    },
    {
      id: 'deepseek/deepseek-chat-v3-0324',
      name: 'DeepSeek Chat v3',
      description: 'Продвинутая модель от DeepSeek',
      isPaid: true
    },
    {
      id: 'deepseek/deepseek-r1',
      name: 'DeepSeek R1',
      description: 'Исследовательская модель от DeepSeek',
      isPaid: true
    },
    
  ],
  
  // Настройки запросов к OpenRouter
  openRouterSettings: {
    baseUrl: 'https://openrouter.ai/api/v1',
    timeout: 60000, // 60 секунд
    maxTokens: 4096
  }
};
