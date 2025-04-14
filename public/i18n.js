// Модуль для работы с переводами
let currentLanguage = localStorage.getItem('language') || 'ru';
let translations = {};

// Загрузка переводов для указанного языка
async function loadTranslations(lang) {
  try {
    const response = await fetch(`/locales/${lang}.json`);
    if (!response.ok) {
      throw new Error(`Не удалось загрузить переводы для языка ${lang}`);
    }
    translations = await response.json();
    document.documentElement.lang = lang; // Обновляем атрибут lang у html
    applyTranslations();
    return true;
  } catch (error) {
    console.error('Ошибка при загрузке переводов:', error);
    return false;
  }
}

// Получение перевода по ключу
function i18n(key, defaultText = '') {
  return translations[key] || defaultText || key;
}

// Применение переводов ко всем элементам с атрибутом data-i18n
function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      if (element.getAttribute('placeholder')) {
        element.setAttribute('placeholder', i18n(key, element.getAttribute('placeholder')));
      }
    } else {
      element.textContent = i18n(key, element.textContent);
    }
  });
}

// Изменение языка
function changeLanguage(lang) {
  if (lang === currentLanguage) return;
  
  currentLanguage = lang;
  localStorage.setItem('language', lang);
  loadTranslations(lang);
  
  // Обновляем активный класс у переключателей языка
  document.querySelectorAll('.language-switcher button').forEach(button => {
    if (button.getAttribute('data-lang') === lang) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });
}

// Инициализация модуля i18n
async function initI18n() {
  // Загружаем переводы для текущего языка
  await loadTranslations(currentLanguage);
  
  // Устанавливаем активный класс для текущего языка
  document.querySelectorAll('.language-switcher button').forEach(button => {
    if (button.getAttribute('data-lang') === currentLanguage) {
      button.classList.add('active');
    }
  });
  
  // Добавляем обработчики событий для переключателей языка
  document.querySelectorAll('.language-switcher button').forEach(button => {
    button.addEventListener('click', () => {
      const lang = button.getAttribute('data-lang');
      changeLanguage(lang);
    });
  });
}

// Экспортируем функции
window.i18n = i18n;
window.changeLanguage = changeLanguage;
window.initI18n = initI18n;
